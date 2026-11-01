import { getSystemPrompt } from './portfolioKnowledge.js';

let engineInstance = null;
let activeWorker = null;
let initPromise = null;
let currentModelId = null;
let CreateWebWorkerMLCEngine = null;
let isCurrentStreamAborted = false;

/**
 * Lazy-loads the WebLLM engine constructor only when needed.
 */
async function getCreateWebWorkerMLCEngine() {
  if (!CreateWebWorkerMLCEngine) {
    const webllm = await import('@mlc-ai/web-llm');
    CreateWebWorkerMLCEngine = webllm.CreateWebWorkerMLCEngine;
  }
  return CreateWebWorkerMLCEngine;
}

/**
 * Checks whether WebGPU is supported on the user's browser and hardware.
 * Probes for adapter capabilities, shader-f16 support, and attaches device loss listeners.
 */
export async function checkWebGPUSupport() {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return {
      supported: false,
      reason: 'WebGPU is not supported by your current browser. To run local in-browser AI, please use Google Chrome (v113+), Microsoft Edge (v113+), or a browser with WebGPU enabled.'
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      return {
        supported: false,
        reason: 'A compatible graphics adapter (GPU) was not found. Please ensure hardware acceleration is enabled in your browser settings (Settings > System > Use graphics acceleration).'
      };
    }

    const hasShaderF16 = adapter.features.has('shader-f16');

    // Attach device probe to detect memory exhaustion and device loss early
    try {
      const device = await adapter.requestDevice({
        requiredFeatures: hasShaderF16 ? ['shader-f16'] : []
      });

      if (device && device.lost) {
        device.lost.then((info) => {
          console.warn(`[WebGPU] Device lost (${info.reason}): ${info.message}`);
          resetEngine();
        });
      }
    } catch (probeErr) {
      console.warn('[WebGPU] Optional device probe warning:', probeErr);
    }

    // Exact model IDs from @mlc-ai/web-llm prebuilt registry:
    const selectedModel = hasShaderF16
      ? 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
      : 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';

    return {
      supported: true,
      hasShaderF16,
      modelId: selectedModel
    };
  } catch (err) {
    return {
      supported: false,
      reason: `Could not initialize WebGPU: ${err.message || err}`
    };
  }
}

/**
 * Initializes the WebLLM engine inside a dedicated Web Worker.
 * Uses a shared Promise to prevent multiple initialization race conditions (Bug 5C).
 * Reports download progress and caches weights in browser CacheStorage.
 *
 * @param {Function} onProgress - Callback receiving { progress: number, text: string }
 * @returns {Promise<{ success: boolean, engine: any, modelId: string }>}
 */
export async function initializeModel(onProgress) {
  if (engineInstance) {
    return { success: true, engine: engineInstance, modelId: currentModelId };
  }

  // If initialization is already in flight, reuse the active promise
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const gpuCheck = await checkWebGPUSupport();
      if (!gpuCheck.supported) {
        throw new Error(gpuCheck.reason);
      }

      currentModelId = gpuCheck.modelId;

      // Spin up dedicated Web Worker
      activeWorker = new Worker(
        new URL('./ai-worker.js', import.meta.url),
        { type: 'module' }
      );

      activeWorker.onerror = (workerErr) => {
        console.error('[WebWorker] Runtime error in AI worker:', workerErr);
        resetEngine();
      };

      const createEngine = await getCreateWebWorkerMLCEngine();

      engineInstance = await createEngine(
        activeWorker,
        currentModelId,
        {
          initProgressCallback: (report) => {
            if (typeof onProgress === 'function') {
              onProgress(report);
            }
          }
        }
      );

      return { success: true, engine: engineInstance, modelId: currentModelId };
    } catch (error) {
      resetEngine();
      let friendlyMessage = error.message || 'Model initialization failed.';
      if (friendlyMessage.includes('quota') || friendlyMessage.includes('storage')) {
        friendlyMessage = 'Insufficient browser storage quota to cache model weights. Please free up disk space and try again.';
      } else if (friendlyMessage.includes('network') || friendlyMessage.includes('Failed to fetch')) {
        friendlyMessage = 'Network connection dropped while downloading model weights. Please check your internet and click Retry.';
      }
      throw new Error(friendlyMessage);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Returns whether the engine is ready for queries.
 */
export function isModelReady() {
  return engineInstance !== null;
}

/**
 * Interrupts active text generation and sets the abort cancellation flag.
 */
export function stopGeneration() {
  isCurrentStreamAborted = true;
  if (engineInstance) {
    try {
      engineInstance.interruptGenerate();
    } catch (err) {
      console.warn('Failed to interrupt generation:', err);
    }
  }
}

/**
 * Sends a message along with recent conversation history and streams tokens back.
 * Guarantees the latest user message is included exactly once (Fixes Bug 5A).
 * Properly respects stopGeneration() cancellation (Fixes Bug 5E).
 *
 * @param {Array<{role: string, content: string}>} conversationHistory - Prior conversation turns
 * @param {string} userMessage - Latest user message
 * @param {Function} onToken - Callback invoked with full accumulated text
 * @returns {Promise<{ text: string, aborted: boolean }>}
 */
export async function streamChatCompletion(conversationHistory, userMessage, onToken) {
  if (!engineInstance) {
    throw new Error('AI Model is not initialized yet. Please start the assistant first.');
  }

  isCurrentStreamAborted = false;

  const systemMessage = {
    role: 'system',
    content: getSystemPrompt()
  };

  // Build clean history without duplicate injection (Bug 5A)
  const historyCopy = Array.isArray(conversationHistory) ? [...conversationHistory] : [];
  const cleanUserText = (userMessage || '').trim();

  // If the last item in conversationHistory isn't already this user prompt, append it
  const lastItem = historyCopy[historyCopy.length - 1];
  if (!lastItem || lastItem.role !== 'user' || lastItem.content !== cleanUserText) {
    if (cleanUserText) {
      historyCopy.push({ role: 'user', content: cleanUserText });
    }
  }

  // Keep context compact (system prompt + last 6 messages max)
  const trimmedHistory = historyCopy.slice(-6);

  const messages = [
    systemMessage,
    ...trimmedHistory
  ];

  let accumulatedText = '';

  try {
    const completion = await engineInstance.chat.completions.create({
      messages,
      temperature: 0.6,
      max_tokens: 350,
      stream: true
    });

    for await (const chunk of completion) {
      if (isCurrentStreamAborted) {
        break;
      }
      const delta = chunk.choices[0]?.delta?.content || '';
      accumulatedText += delta;
      if (typeof onToken === 'function' && !isCurrentStreamAborted) {
        onToken(accumulatedText);
      }
    }

    return {
      text: accumulatedText,
      aborted: isCurrentStreamAborted
    };
  } catch (err) {
    if (isCurrentStreamAborted) {
      return { text: accumulatedText, aborted: true };
    }
    throw err;
  }
}

/**
 * Resets the active engine, terminates the worker, and clears memory.
 */
export function resetEngine() {
  if (engineInstance) {
    try {
      engineInstance.interruptGenerate();
    } catch (_) {}
  }
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  engineInstance = null;
  initPromise = null;
  isCurrentStreamAborted = false;
}

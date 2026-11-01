import { getSystemPrompt } from './portfolioKnowledge.js';

let engineInstance = null;
let activeWorker = null;
let initPromise = null;
let currentModelId = null;
let CreateWebWorkerMLCEngine = null;
let isCurrentStreamAborted = false;

// Active model specification metadata
export const MODEL_METADATA = {
  name: 'SmolLM2-360M-Instruct',
  q4f16_id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  q4f32_id: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
  downloadSizeMB: 194.18,
  vramRequiredF16MB: 376.06,
  vramRequiredF32MB: 579.61,
  defaultMaxTokens: 128,
  contextWindowOverride: 2048
};

/**
 * Dynamically loads the WebLLM engine constructor only when needed.
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
 * Probes adapter features, checks for shader-f16 support, and attaches device loss listeners.
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

    // Avoid creating a second WebGPU device just for probing. The WebLLM
    // engine creates and owns the device it uses for inference.

    // Select optimized SmolLM2-360M model based on hardware shader support:
    const selectedModel = hasShaderF16
      ? MODEL_METADATA.q4f16_id
      : MODEL_METADATA.q4f32_id;

    return {
      supported: true,
      hasShaderF16,
      modelId: selectedModel,
      downloadSizeMB: MODEL_METADATA.downloadSizeMB,
      vramRequiredMB: hasShaderF16 ? MODEL_METADATA.vramRequiredF16MB : MODEL_METADATA.vramRequiredF32MB
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
 * Uses a singleton Promise latch to prevent concurrent duplicate initializations.
 * Reports download progress and caches weights in browser CacheStorage/IndexedDB.
 *
 * @param {Function} onProgress - Callback receiving { progress: number, text: string }
 * @returns {Promise<{ success: boolean, engine: any, modelId: string }>}
 */
export async function initializeModel(onProgress) {
  if (engineInstance) {
    return { success: true, engine: engineInstance, modelId: currentModelId };
  }

  // Reuse in-flight initialization promise if already active
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

      // Spin up dedicated Web Worker for inference (keeps main UI thread responsive)
      activeWorker = new Worker(
        new URL('./ai-worker.js', import.meta.url),
        { type: 'module' }
      );

      activeWorker.onerror = (workerErr) => {
        console.error('[WebWorker] Runtime error in AI worker:', workerErr);
        resetEngine();
      };

      const createEngine = await getCreateWebWorkerMLCEngine();

      // Configure engine with progress tracking and optimized context window override
      engineInstance = await createEngine(
        activeWorker,
        currentModelId,
        {
          initProgressCallback: (report) => {
            if (typeof onProgress === 'function') {
              onProgress(report);
            }
          }
        },
        {
          context_window_size: MODEL_METADATA.contextWindowOverride
        }
      );

      return { success: true, engine: engineInstance, modelId: currentModelId };
    } catch (error) {
      resetEngine();
      let friendlyMessage = error.message || 'Model initialization failed.';
      if (friendlyMessage.includes('quota') || friendlyMessage.includes('storage')) {
        friendlyMessage = 'Insufficient browser storage quota to cache model weights. Please free up disk space and try again.';
      } else if (friendlyMessage.includes('network') || friendlyMessage.includes('Failed to fetch')) {
        friendlyMessage = 'Network connection dropped while downloading model weights. Please check your internet connection and click Retry.';
      } else if (friendlyMessage.includes('memory') || friendlyMessage.includes('allocation')) {
        friendlyMessage = 'GPU memory allocation failed. Please close other GPU-intensive tabs and try again.';
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
 * Returns the currently active model identifier.
 */
export function getCurrentModelId() {
  return currentModelId;
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
 * - Deduplicates user prompt to prevent double insertion.
 * - Caps conversation context to the last 4 turns (2 rounds) for low latency.
 * - Limits response to ~128 tokens by default for instant responses.
 * - Respects stopGeneration() cancellation tokens.
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

  // Build clean history without duplicate injection
  const historyCopy = Array.isArray(conversationHistory) ? [...conversationHistory] : [];
  const cleanUserText = (userMessage || '').trim();

  // If the last item in conversationHistory isn't already this user prompt, append it
  const lastItem = historyCopy[historyCopy.length - 1];
  if (!lastItem || lastItem.role !== 'user' || lastItem.content !== cleanUserText) {
    if (cleanUserText) {
      historyCopy.push({ role: 'user', content: cleanUserText });
    }
  }

  // Keep context length compact: system prompt + last 4 messages max (2 conversation turns)
  // This drastically reduces prefill time and prevents memory bloat on consecutive questions
  const trimmedHistory = historyCopy.slice(-4);

  const messages = [
    systemMessage,
    ...trimmedHistory
  ];

  let accumulatedText = '';

  try {
    const completion = await engineInstance.chat.completions.create({
      messages,
      temperature: 0.5,
      max_tokens: MODEL_METADATA.defaultMaxTokens, // 128 tokens default for high responsiveness
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
    // Inspect for WebGPU device loss or memory issues during inference
    if (err.message && (err.message.includes('device is lost') || err.message.includes('out of memory'))) {
      resetEngine();
    }
    throw err;
  }
}

/**
 * Resets the active engine, terminates the worker, and frees memory.
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

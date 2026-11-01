import { getSystemPrompt } from './portfolioKnowledge.js';

let engineInstance = null;
let activeWorker = null;
let isInitializing = false;
let currentModelId = null;
let CreateWebWorkerMLCEngine = null;

/**
 * Lazy-loads the WebLLM engine module only when requested.
 */
async function getCreateWebWorkerMLCEngine() {
  if (!CreateWebWorkerMLCEngine) {
    const webllm = await import('@mlc-ai/web-llm');
    CreateWebWorkerMLCEngine = webllm.CreateWebWorkerMLCEngine;
  }
  return CreateWebWorkerMLCEngine;
}

/**
 * Checks whether WebGPU is supported on the user's browser and device.
 * Checks for shader-f16 support to determine the optimal quantized model.
 */
export async function checkWebGPUSupport() {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return {
      supported: false,
      reason: 'WebGPU is not supported by your current browser. To run local in-browser AI, please use Google Chrome (v113+), Microsoft Edge (v113+), or a browser with WebGPU enabled.'
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason: 'A compatible graphics adapter (GPU) was not found. Please ensure hardware acceleration is enabled in your browser settings.'
      };
    }

    const hasShaderF16 = adapter.features.has('shader-f16');
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
 * Reports download progress and caches weights in browser storage.
 */
export async function initializeModel(onProgress) {
  if (engineInstance) {
    return { success: true, engine: engineInstance, modelId: currentModelId };
  }

  if (isInitializing) {
    throw new Error('Model is already in the process of initializing.');
  }

  isInitializing = true;

  try {
    const gpuCheck = await checkWebGPUSupport();
    if (!gpuCheck.supported) {
      throw new Error(gpuCheck.reason);
    }

    currentModelId = gpuCheck.modelId;

    // Spin up the Web Worker using standard Vite module syntax
    activeWorker = new Worker(
      new URL('./ai-worker.js', import.meta.url),
      { type: 'module' }
    );

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

    isInitializing = false;
    return { success: true, engine: engineInstance, modelId: currentModelId };
  } catch (error) {
    isInitializing = false;
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    engineInstance = null;
    throw error;
  }
}

/**
 * Returns whether the engine is ready for queries.
 */
export function isModelReady() {
  return engineInstance !== null;
}

/**
 * Interrupts current text generation.
 */
export function stopGeneration() {
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
 *
 * @param {Array<{role: string, content: string}>} conversationHistory - Previous messages
 * @param {string} userMessage - New user prompt
 * @param {Function} onToken - Callback invoked with full accumulated text
 * @returns {Promise<string>} - Complete assistant response
 */
export async function streamChatCompletion(conversationHistory, userMessage, onToken) {
  if (!engineInstance) {
    throw new Error('AI Model is not initialized yet. Please start the assistant first.');
  }

  const systemMessage = {
    role: 'system',
    content: getSystemPrompt()
  };

  // Limit recent history to keep context compact (last 6 messages max)
  const trimmedHistory = conversationHistory.slice(-6);

  const messages = [
    systemMessage,
    ...trimmedHistory,
    { role: 'user', content: userMessage.trim() }
  ];

  let accumulatedText = '';

  const completion = await engineInstance.chat.completions.create({
    messages,
    temperature: 0.6,
    max_tokens: 350,
    stream: true
  });

  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content || '';
    accumulatedText += delta;
    if (typeof onToken === 'function') {
      onToken(accumulatedText);
    }
  }

  return accumulatedText;
}

/**
 * Resets the active engine and conversation context.
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
  isInitializing = false;
}

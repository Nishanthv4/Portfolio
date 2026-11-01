import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Hook the WebWorkerMLCEngineHandler to worker message events
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => {
  handler.onmessage(msg);
};


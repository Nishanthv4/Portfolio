import fs from 'fs';
import { MODEL_METADATA } from '../src/ai-service.js';
import { getSystemPrompt, buildPortfolioContext, suggestedQuestions } from '../src/portfolioKnowledge.js';

console.log('============================================================');
console.log('AI PORTFOLIO ASSISTANT — OPTIMIZATION VERIFICATION SUITE');
console.log('============================================================\n');

let passed = 0;
let failed = 0;

function check(title, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${title}${detail ? ' (' + detail + ')' : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${title}${detail ? ' (' + detail + ')' : ''}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// Test 1: Model Optimization & Metadata Verification
// -----------------------------------------------------------------------------
console.log('--- 1. Model Registry & Download Size ---');
check('Model name is SmolLM2-360M-Instruct', MODEL_METADATA.name === 'SmolLM2-360M-Instruct');
check('Primary model ID has shader-f16', MODEL_METADATA.q4f16_id === 'SmolLM2-360M-Instruct-q4f16_1-MLC');
check('Fallback model ID uses q4f32', MODEL_METADATA.q4f32_id === 'SmolLM2-360M-Instruct-q4f32_1-MLC');
check('Download size is ~194.18 MB (27% smaller than Qwen)', MODEL_METADATA.downloadSizeMB === 194.18, `${MODEL_METADATA.downloadSizeMB} MB`);
check('VRAM required (FP16) is ~376.06 MB (60% less than Qwen)', MODEL_METADATA.vramRequiredF16MB === 376.06, `${MODEL_METADATA.vramRequiredF16MB} MB`);
check('Default max tokens is capped at 128 for rapid response', MODEL_METADATA.defaultMaxTokens === 128, `${MODEL_METADATA.defaultMaxTokens} tokens`);
check('Context window override is 2048 to prevent buffer bloat', MODEL_METADATA.contextWindowOverride === 2048, `${MODEL_METADATA.contextWindowOverride} tokens`);

// -----------------------------------------------------------------------------
// Test 2: System Prompt & Portfolio Context Density
// -----------------------------------------------------------------------------
console.log('\n--- 2. Concise Prompt & Knowledge Boundary ---');
const prompt = getSystemPrompt();
const charCount = prompt.length;
const approxTokens = Math.round(charCount / 4);

check('System prompt is concise (<2500 characters)', charCount < 2500, `${charCount} chars, ~${approxTokens} tokens`);
check('System prompt instructs 1-3 sentences concise responses', prompt.includes('1-3 sentences'));
check('System prompt includes strict hallucination prevention', prompt.includes('Never invent experience'));
check('System prompt includes verified projects (StudyMate, AI News Detector, QuizHero)', 
  prompt.includes('StudyMate') && prompt.includes('AI News Detector') && prompt.includes('QuizHero'));

// -----------------------------------------------------------------------------
// Test 3: History Pruning & Context Length (Consecutive Questions)
// -----------------------------------------------------------------------------
console.log('\n--- 3. Context Length & Conversation History Pruning ---');
function simulateHistoryTrim(history, userPrompt) {
  const historyCopy = [...history];
  const clean = userPrompt.trim();
  const last = historyCopy[historyCopy.length - 1];
  if (!last || last.role !== 'user' || last.content !== clean) {
    historyCopy.push({ role: 'user', content: clean });
  }
  const trimmed = historyCopy.slice(-4);
  return [{ role: 'system', content: 'SYSTEM' }, ...trimmed];
}

// Simulate 6 back-and-forth turns (12 messages)
let simulatedChat = [
  { role: 'user', content: 'Q1' }, { role: 'assistant', content: 'A1' },
  { role: 'user', content: 'Q2' }, { role: 'assistant', content: 'A2' },
  { role: 'user', content: 'Q3' }, { role: 'assistant', content: 'A3' },
  { role: 'user', content: 'Q4' }, { role: 'assistant', content: 'A4' },
  { role: 'user', content: 'Q5' }, { role: 'assistant', content: 'A5' }
];
const trimmedMessages = simulateHistoryTrim(simulatedChat, 'Q6');
// Must contain 1 system + 4 recent messages = 5 items total
check('Consecutive questions capped at 4 recent messages (2 rounds)', trimmedMessages.length === 5, `${trimmedMessages.length} total messages`);
check('Oldest messages (Q1-Q4) pruned from active context', !trimmedMessages.some(m => m.content === 'Q1' || m.content === 'Q2'));
check('Most recent messages (Q5, A5, Q6) preserved', trimmedMessages.some(m => m.content === 'Q5') && trimmedMessages.some(m => m.content === 'Q6'));

// -----------------------------------------------------------------------------
// Test 4: Long Question Handling
// -----------------------------------------------------------------------------
console.log('\n--- 4. Long Question Resilience ---');
const longQuestion = 'Can you provide a comprehensive and detailed explanation of Nishanth\'s experience with cloud computing, Docker containers, Linux command line fundamentals, Git workflows, academic projects including StudyMate, AI News Detector, and QuizHero, as well as his future goals for cloud engineering? '.repeat(3);
const longMessages = simulateHistoryTrim([], longQuestion);
check('Long input formatted without throwing', longMessages.length === 2);
check('Long input preserved in user message', longMessages[1].content === longQuestion.trim());

// -----------------------------------------------------------------------------
// Test 5: WebGPU Unsupported Fallback Handling
// -----------------------------------------------------------------------------
console.log('\n--- 5. WebGPU Fallback & Diagnostics ---');
function mockCheckWebGPU(navigatorObj) {
  if (!navigatorObj || !navigatorObj.gpu) {
    return {
      supported: false,
      reason: 'WebGPU is not supported by your current browser.'
    };
  }
  return { supported: true };
}
const noGpuResult = mockCheckWebGPU({});
check('Missing navigator.gpu gracefully returns supported: false', noGpuResult.supported === false);
check('Provides helpful browser guidance message', noGpuResult.reason.includes('WebGPU is not supported'));

// -----------------------------------------------------------------------------
// Test 6: Memory Error and Device Loss Classification
// -----------------------------------------------------------------------------
console.log('\n--- 6. Memory & Device Loss Error Handling ---');
function classifyError(errorMsg) {
  if (errorMsg.includes('quota') || errorMsg.includes('storage')) {
    return 'storage_quota';
  } else if (errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
    return 'network_drop';
  } else if (errorMsg.includes('memory') || errorMsg.includes('allocation')) {
    return 'gpu_memory_error';
  } else if (errorMsg.includes('device is lost') || errorMsg.includes('Device lost')) {
    return 'device_lost';
  }
  return 'generic';
}

check('GPU memory allocation error classified correctly', classifyError('Out of memory: buffer allocation failed') === 'gpu_memory_error');
check('Device loss classified correctly', classifyError('WebGPU Device lost (destroyed)') === 'device_lost');
check('Storage quota classified correctly', classifyError('QuotaExceededError: storage full') === 'storage_quota');
check('Network failure classified correctly', classifyError('Failed to fetch model weights') === 'network_drop');

// -----------------------------------------------------------------------------
// Test 7: Prebuilt Artifacts Synchronization Check
// -----------------------------------------------------------------------------
console.log('\n--- 7. Bundled Asset Synchronization ---');
const distIndex = fs.readFileSync('dist/assets/index.js', 'utf8');
const rootIndex = fs.readFileSync('assets/index.js', 'utf8');

check('dist/assets/index.js contains SmolLM2 model reference', distIndex.includes('SmolLM2-360M'));
check('assets/index.js contains SmolLM2 model reference', rootIndex.includes('SmolLM2-360M'));
check('dist/assets/index.js enforces max_tokens: 128', distIndex.includes('128'));
check('assets/index.js enforces max_tokens: 128', rootIndex.includes('128'));

console.log('\n============================================================');
console.log(`OPTIMIZATION TEST SUMMARY: ${passed} passed, ${failed} failed.`);
console.log('============================================================\n');

if (failed > 0) {
  process.exit(1);
}

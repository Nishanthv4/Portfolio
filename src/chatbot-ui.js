import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { checkWebGPUSupport, initializeModel, isModelReady, streamChatCompletion, stopGeneration } from './ai-service.js';
import { suggestedQuestions } from './portfolioKnowledge.js';

marked.setOptions({
  breaks: true,
  gfm: true
});

/**
 * Sanitizes Markdown-generated HTML to prevent XSS (Fixes Bug 5B).
 * Permits standard formatting tags, code snippets, and safe links.
 */
function renderSafeMarkdown(markdownText) {
  const rawHtml = marked.parse(markdownText || '');
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote',
      'a', 'span', 'hr'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'title']
  });
}

/**
 * Chatbot UI Controller
 */
export class ChatbotUI {
  constructor() {
    this.conversationHistory = [];
    this.isGenerating = false;
    this.isOpen = false;
    this.initStatus = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'error'
    this.selectedModelId = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

    this.initDOMElements();
    this.bindEvents();
    this.renderSuggestedQuestions();
  }

  initDOMElements() {
    this.floatingBtn = document.getElementById('aiChatToggle');
    this.panel = document.getElementById('aiChatPanel');
    this.closeBtn = document.getElementById('aiChatClose');
    this.clearBtn = document.getElementById('aiChatClear');
    this.messagesList = document.getElementById('aiChatMessages');
    this.inputField = document.getElementById('aiChatInput');
    this.sendBtn = document.getElementById('aiChatSend');
    this.stopBtn = document.getElementById('aiChatStop');
    this.statusDot = document.getElementById('aiStatusDot');
    this.statusText = document.getElementById('aiStatusText');
    this.welcomeBanner = document.getElementById('aiWelcomeBanner');
    this.startBtn = document.getElementById('aiStartBtn');
    this.progressWrapper = document.getElementById('aiProgressWrapper');
    this.progressBar = document.getElementById('aiProgressBar');
    this.progressText = document.getElementById('aiProgressText');
    this.errorCard = document.getElementById('aiErrorCard');
    this.errorMsg = document.getElementById('aiErrorMsg');
    this.retryBtn = document.getElementById('aiRetryBtn');
    this.suggestedBox = document.getElementById('aiSuggestedQuestions');
  }

  bindEvents() {
    if (this.floatingBtn) {
      this.floatingBtn.addEventListener('click', () => this.togglePanel());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.togglePanel(false));
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearChat());
    }

    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => this.startEngine());
    }

    if (this.retryBtn) {
      this.retryBtn.addEventListener('click', () => this.startEngine());
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => {
        stopGeneration();
        this.setGenerating(false);
      });
    }

    if (this.inputField) {
      this.inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });

      // Auto-expand textarea
      this.inputField.addEventListener('input', () => {
        this.inputField.style.height = 'auto';
        this.inputField.style.height = Math.min(this.inputField.scrollHeight, 120) + 'px';
      });
    }

    // Keyboard shortcut to close chatbot with Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.togglePanel(false);
      }
    });
  }

  togglePanel(forceState) {
    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
    if (this.panel) {
      this.panel.classList.toggle('open', this.isOpen);
      this.panel.setAttribute('aria-hidden', String(!this.isOpen));
    }

    if (this.floatingBtn) {
      this.floatingBtn.classList.toggle('active', this.isOpen);
      this.floatingBtn.setAttribute('aria-expanded', String(this.isOpen));
    }

    if (this.isOpen) {
      if (isModelReady() && this.inputField) {
        setTimeout(() => this.inputField.focus(), 250);
      }
      this.scrollToBottom();
    }
  }

  renderSuggestedQuestions() {
    if (!this.suggestedBox) return;
    this.suggestedBox.innerHTML = '';

    suggestedQuestions.forEach((q) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ai-suggested-chip';
      btn.textContent = q;
      btn.addEventListener('click', () => {
        if (!isModelReady()) {
          this.startEngine().then((ready) => {
            if (ready) {
              this.sendMessage(q);
            }
          });
        } else {
          this.sendMessage(q);
        }
      });
      this.suggestedBox.appendChild(btn);
    });
  }

  async startEngine() {
    if (isModelReady()) return true;

    this.setStatus('loading', 'Checking WebGPU...');
    this.showProgress(true);
    this.hideError();

    try {
      const gpuCheck = await checkWebGPUSupport();
      if (!gpuCheck.supported) {
        this.setStatus('error', 'WebGPU Unavailable');
        this.showError(gpuCheck.reason);
        this.showProgress(false);
        return false;
      }

      this.selectedModelId = gpuCheck.modelId;
      this.setStatus('loading', 'Loading Model...');

      await initializeModel((report) => {
        this.handleProgressUpdate(report);
      });

      this.setStatus('ready', 'Model Ready (Local WebGPU)');
      this.showProgress(false);
      if (this.welcomeBanner) {
        this.welcomeBanner.classList.add('hidden');
      }

      this.appendAssistantMessage(
        `👋 Hello! I am **Nishanth's AI Portfolio Assistant**, running **100% locally inside your browser via WebGPU** using **Qwen2.5-0.5B**.\n\nYou can ask me anything about Nishanth's **projects (StudyMate, AI News Detector)**, **technical skills (C, C++, Python, Linux, Docker, AWS)**, or **career interests**!`
      );

      if (this.inputField) {
        this.inputField.focus();
      }

      return true;
    } catch (err) {
      console.error('Failed to initialize local LLM:', err);
      this.setStatus('error', 'Initialization Failed');
      this.showError(err.message || 'Failed to download and initialize the WebGPU model.');
      this.showProgress(false);
      return false;
    }
  }

  handleProgressUpdate(report) {
    if (!report) return;

    let percent = 0;
    if (typeof report.progress === 'number') {
      percent = Math.round(report.progress * 100);
    }

    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }

    if (this.progressText) {
      const text = report.text || 'Preparing WebGPU runtime...';
      this.progressText.textContent = `${text} (${percent}%)`;
    }
  }

  setStatus(state, text) {
    this.initStatus = state;
    if (this.statusDot) {
      this.statusDot.className = `ai-status-dot dot-${state}`;
    }
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  showProgress(visible) {
    if (this.progressWrapper) {
      this.progressWrapper.classList.toggle('hidden', !visible);
    }
    if (this.startBtn) {
      this.startBtn.disabled = visible;
    }
  }

  showError(message) {
    if (this.errorCard && this.errorMsg) {
      this.errorMsg.textContent = message;
      this.errorCard.classList.remove('hidden');
    }
  }

  hideError() {
    if (this.errorCard) {
      this.errorCard.classList.add('hidden');
    }
  }

  setGenerating(isGen) {
    this.isGenerating = isGen;
    if (this.sendBtn) {
      this.sendBtn.classList.toggle('hidden', isGen);
    }
    if (this.stopBtn) {
      this.stopBtn.classList.toggle('hidden', !isGen);
    }
    if (this.inputField) {
      this.inputField.disabled = isGen;
    }
  }

  async handleSendMessage() {
    if (!this.inputField || this.isGenerating) return;
    const text = this.inputField.value.trim();
    if (!text) return;

    this.inputField.value = '';
    this.inputField.style.height = 'auto';

    if (!isModelReady()) {
      const ready = await this.startEngine();
      if (!ready) return;
    }

    await this.sendMessage(text);
  }

  async sendMessage(userText) {
    if (this.isGenerating || !userText || !userText.trim()) return;

    const trimmedUserText = userText.trim();

    // Minimize suggested question chips once conversation begins
    if (this.suggestedBox) {
      this.suggestedBox.classList.add('minimized');
    }

    // Append user message to UI and history exactly once (Fixes Bug 5A)
    this.appendUserMessage(trimmedUserText);
    this.conversationHistory.push({ role: 'user', content: trimmedUserText });

    // Create assistant message placeholder
    const assistantBubble = this.createAssistantPlaceholder();
    this.setGenerating(true);
    this.scrollToBottom();

    try {
      let fullResponse = '';
      const streamResult = await streamChatCompletion(
        this.conversationHistory,
        trimmedUserText,
        (partialText) => {
          fullResponse = partialText;
          if (assistantBubble) {
            assistantBubble.innerHTML = renderSafeMarkdown(partialText);
          }
          this.scrollToBottom();
        }
      );

      // Handle cancellation vs normal completion (Fixes Bug 5E)
      if (streamResult && streamResult.aborted) {
        if (!fullResponse) {
          if (assistantBubble) {
            assistantBubble.innerHTML = `<em>[Response stopped by user]</em>`;
          }
        } else if (assistantBubble) {
          assistantBubble.innerHTML = renderSafeMarkdown(fullResponse) + `<br><small style="color:var(--text-muted);font-size:0.75rem;"><em>(Generation stopped)</em></small>`;
        }
        if (fullResponse) {
          this.conversationHistory.push({ role: 'assistant', content: fullResponse });
        }
      } else {
        const finalText = streamResult?.text || fullResponse;
        if (finalText) {
          if (assistantBubble) {
            assistantBubble.innerHTML = renderSafeMarkdown(finalText);
          }
          this.conversationHistory.push({ role: 'assistant', content: finalText });
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      if (assistantBubble) {
        assistantBubble.innerHTML = `<span class="ai-error-inline">⚠️ Error generating response: ${this.escapeHTML(err.message || 'Generation failed')}. Please click Retry.</span>`;
      }
    } finally {
      this.setGenerating(false);
      this.scrollToBottom();
      if (this.inputField) {
        this.inputField.focus();
      }
    }
  }

  appendUserMessage(text) {
    if (!this.messagesList) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-message ai-message-user';
    msgEl.innerHTML = `
      <div class="ai-bubble user-bubble">
        <p>${this.escapeHTML(text)}</p>
      </div>
    `;
    this.messagesList.appendChild(msgEl);
    this.scrollToBottom();
  }

  createAssistantPlaceholder() {
    if (!this.messagesList) return null;
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-message ai-message-assistant';
    msgEl.innerHTML = `
      <div class="ai-avatar-mini" aria-hidden="true">NV</div>
      <div class="ai-bubble assistant-bubble">
        <span class="ai-typing-indicator">
          <span></span><span></span><span></span>
        </span>
      </div>
    `;
    this.messagesList.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl.querySelector('.assistant-bubble');
  }

  appendAssistantMessage(markdownText) {
    if (!this.messagesList) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-message ai-message-assistant';
    msgEl.innerHTML = `
      <div class="ai-avatar-mini" aria-hidden="true">NV</div>
      <div class="ai-bubble assistant-bubble">
        ${renderSafeMarkdown(markdownText)}
      </div>
    `;
    this.messagesList.appendChild(msgEl);
    this.scrollToBottom();
  }

  clearChat() {
    if (this.isGenerating) {
      stopGeneration();
      this.setGenerating(false);
    }

    this.conversationHistory = [];
    if (this.messagesList) {
      this.messagesList.innerHTML = '';
    }

    if (this.suggestedBox) {
      this.suggestedBox.classList.remove('minimized');
    }

    if (isModelReady()) {
      this.appendAssistantMessage(
        `🧹 Conversation cleared. How can I help you explore Nishanth's background, skills, or projects?`
      );
    }
  }

  scrollToBottom() {
    if (this.messagesList) {
      this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

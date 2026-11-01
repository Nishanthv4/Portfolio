import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  checkWebGPUSupport,
  initializeModel,
  isModelReady,
  streamChatCompletion,
  stopGeneration,
  MODEL_METADATA
} from './ai-service.js';
import { suggestedQuestions } from './portfolioKnowledge.js';

marked.setOptions({
  breaks: true,
  gfm: true
});

/**
 * Sanitizes Markdown-generated HTML to prevent XSS.
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
 * Optimized for low-latency streaming, non-blocking UI, and responsive typing.
 */
export class ChatbotUI {
  constructor() {
    this.conversationHistory = [];
    this.isGenerating = false;
    this.isOpen = false;
    this.initStatus = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'error'
    this.selectedModelId = MODEL_METADATA.q4f16_id;
    this.rafId = null;
    this.generationSequence = 0;
    this.activeGenerationId = null;
    this.conversationVersion = 0;

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
        // Keep the request lock until the stream promise settles. Re-enabling
        // Send immediately here can overlap two generations on the same engine.
        stopGeneration();
        this.stopBtn.disabled = true;
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
        const conversationVersion = this.conversationVersion;
        if (!isModelReady()) {
          this.startEngine().then((ready) => {
            if (ready && conversationVersion === this.conversationVersion) {
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
      this.setStatus('loading', `Loading SmolLM2 (~${gpuCheck.downloadSizeMB} MB)...`);

      await initializeModel((report) => {
        this.handleProgressUpdate(report);
      });

      this.setStatus('ready', 'Model Ready (SmolLM2-360M · WebGPU)');
      this.showProgress(false);
      if (this.welcomeBanner) {
        this.welcomeBanner.classList.add('hidden');
      }

      this.appendAssistantMessage(
        `👋 Hello! I am **Nishanth's AI Portfolio Assistant**, running **100% locally in your browser via WebGPU** using **SmolLM2-360M** (ultralight ~194 MB model).\n\nYou can ask me anything about Nishanth's **projects (StudyMate, AI News Detector, QuizHero)**, **technical skills (C, C++, Python, Linux, Docker, AWS)**, or **career goals**!`
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

  /**
   * Toggles generation UI state.
   * NOTE: Input field is intentionally kept ENABLED during generation so the user
   * can freely type their next thought without UI freezing or lag.
   */
  setGenerating(isGen) {
    this.isGenerating = isGen;
    if (this.sendBtn) {
      this.sendBtn.classList.toggle('hidden', isGen);
    }
    if (this.stopBtn) {
      this.stopBtn.classList.toggle('hidden', !isGen);
      this.stopBtn.disabled = !isGen;
    }
    if (this.inputField) {
      this.inputField.placeholder = isGen
        ? 'AI is responding... (Type your next question)'
        : 'Ask about Nishanth\'s skills, projects, or background...';
    }
  }

  async handleSendMessage() {
    // Prevent duplicate concurrent submission while generating
    if (!this.inputField || this.isGenerating) return;
    const text = this.inputField.value.trim();
    if (!text) return;

    // If the conversation is cleared while the model initializes, do not
    // submit a message that belongs to the previous conversation state.
    const conversationVersion = this.conversationVersion;

    // Immediately clear input field for responsiveness
    this.inputField.value = '';
    this.inputField.style.height = 'auto';

    if (!isModelReady()) {
      const ready = await this.startEngine();
      if (!ready) {
        this.inputField.value = text;
        return;
      }
    }

    if (conversationVersion !== this.conversationVersion) return;
    await this.sendMessage(text);
  }

  async sendMessage(userText) {
    if (this.isGenerating || !userText || !userText.trim()) return;

    const trimmedUserText = userText.trim();
    const generationId = ++this.generationSequence;
    const conversationVersion = this.conversationVersion;
    this.activeGenerationId = generationId;

    const isCurrentRequest = () =>
      this.activeGenerationId === generationId &&
      this.conversationVersion === conversationVersion;

    // Minimize suggested chips once chat starts
    if (this.suggestedBox) {
      this.suggestedBox.classList.add('minimized');
    }

    this.appendUserMessage(trimmedUserText);
    this.conversationHistory.push({ role: 'user', content: trimmedUserText });

    const assistantBubble = this.createAssistantPlaceholder();
    this.setGenerating(true);
    this.scrollToBottom();

    let latestText = '';
    const throttledUpdate = (newText) => {
      if (!isCurrentRequest()) return;
      latestText = newText;

      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          if (!isCurrentRequest() || !assistantBubble || !latestText) return;
          assistantBubble.innerHTML = renderSafeMarkdown(latestText);
          this.scrollToBottom();
        });
      }
    };

    try {
      const streamResult = await streamChatCompletion(
        this.conversationHistory,
        trimmedUserText,
        throttledUpdate
      );

      // A cleared conversation invalidates every update from this request.
      if (!isCurrentRequest()) return;

      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      if (streamResult && streamResult.aborted) {
        if (!latestText) {
          if (assistantBubble) {
            assistantBubble.innerHTML = '<em>[Response stopped by user]</em>';
          }
        } else if (assistantBubble) {
          assistantBubble.innerHTML =
            renderSafeMarkdown(latestText) +
            '<br><small style="color:var(--text-muted);font-size:0.75rem;"><em>(Generation stopped)</em></small>';
          this.conversationHistory.push({ role: 'assistant', content: latestText });
        }
      } else {
        const finalText = streamResult?.text || latestText;
        if (finalText) {
          if (assistantBubble) {
            assistantBubble.innerHTML = renderSafeMarkdown(finalText);
          }
          this.conversationHistory.push({ role: 'assistant', content: finalText });
        }
      }
    } catch (err) {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (isCurrentRequest()) {
        console.error('Chat error:', err);
        if (assistantBubble) {
          assistantBubble.innerHTML =
            `<span class="ai-error-inline">⚠️ Error generating response: ${this.escapeHTML(err.message || 'Generation failed')}. Please click Retry.</span>`;
        }
      }
    } finally {
      // A cancelled request still owns the UI lock until its promise settles.
      // The generation id check prevents an older request from unlocking a newer one.
      if (this.activeGenerationId === generationId) {
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
        this.activeGenerationId = null;
        this.setGenerating(false);

        if (this.conversationVersion === conversationVersion) {
          this.scrollToBottom();
          if (this.inputField) this.inputField.focus();
        }
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
    // Invalidate any in-flight response before clearing the visible conversation.
    // Keep the send lock until the interrupted stream actually settles.
    if (this.isGenerating) {
      stopGeneration();
      if (this.stopBtn) this.stopBtn.disabled = true;
    }

    this.conversationVersion += 1;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
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

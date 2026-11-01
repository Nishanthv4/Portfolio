import { ChatbotUI } from './chatbot-ui.js';

// Initialize AI Portfolio Assistant when DOM is ready
function initAssistant() {
  if (document.getElementById('aiChatPanel') && !window.portfolioChatbot) {
    window.portfolioChatbot = new ChatbotUI();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssistant);
} else {
  initAssistant();
}

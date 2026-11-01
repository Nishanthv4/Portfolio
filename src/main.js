import '../script.js';
import { ChatbotUI } from './chatbot-ui.js';

// Initialize AI Portfolio Assistant when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.portfolioChatbot = new ChatbotUI();
});


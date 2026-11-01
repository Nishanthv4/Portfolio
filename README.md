# Nishanth V — Personal Developer Portfolio & In-Browser AI Assistant

A modern, responsive, developer-focused portfolio website for **Nishanth V**, a First-Year Computer Science and Engineering undergraduate at **R.M.D. Engineering College**, featuring a **100% private, client-side WebGPU AI Assistant** running directly inside the visitor's browser.

🌐 **Live Website**: [https://nishanthv4.github.io/Portfolio/](https://nishanthv4.github.io/Portfolio/)  
🚀 **Alternative Deployment**: Ready for immediate one-click deployment on **Vercel**

---

## 1. Project Overview

This portfolio serves as a central engineering workspace and professional identity showcase, highlighting:
- **Core Engineering Foundations**: C, C++, Python, Data Structures, and algorithmic problem solving.
- **Web & Mobile Applications**: StudyMate, AI News Detector, and QuizHero.
- **Cloud & DevOps Journey**: Actively exploring Linux administration, Docker containerization, AWS cloud architecture, and CI/CD automation.
- **Local In-Browser AI Assistant**: An interactive conversational agent answering questions about Nishanth's background, verified skills, and academic projects with **zero cloud inference latency, zero server costs, and complete visitor privacy**.

---

## 2. Key Features

- **Interactive Developer Terminal**: Embedded interactive command line simulating real Linux commands (`cat interests.txt`, `tools --list`, `ping contact`, `clear`) with an animated typewriter sequence.
- **In-Browser WebGPU AI Assistant**:
  - Powered by `@mlc-ai/web-llm` running the **Qwen2.5-0.5B-Instruct** quantized model.
  - Dedicated Web Worker execution ensures the main browser UI thread stays silky-smooth at 60 FPS.
  - Model weights cached in browser `CacheStorage` for instant subsequent loads.
  - Safe HTML parsing using `DOMPurify` to prevent cross-site scripting (XSS).
  - Explicit user activation (no heavy model downloads on page load).
  - Live streaming responses, token progress bars, stop generation, and conversation reset.
- **Responsive & Accessible Design**:
  - Dark-themed terminal aesthetic with custom CSS variables and high-contrast typography (`Inter` & `Fira Code`).
  - Mobile drawer navigation with keyboard accessibility (`Escape` key modal closure, `T` shortcut for terminal).
  - Semantic HTML5 structure with ARIA landmark attributes and `<noscript>` visibility fallbacks.
- **Direct Gmail Web Compose**:
  - Bypasses desktop Outlook handlers by opening Gmail web compose directly (`mail.google.com/mail/?view=cm...`) with pre-filled subject and body.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Core** | HTML5, CSS3, Modern ES6+ JavaScript (zero external UI framework dependencies for core site) |
| **AI Inference** | `@mlc-ai/web-llm` (v0.2.87), WebGPU API, Web Workers |
| **Model** | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (with automatic fallback to `q4f32_1` on GPUs without FP16) |
| **Markdown & Security** | `marked` (v18.1.2), `dompurify` (v3.4.17) |
| **Build System & Bundler**| Vite 8, Rollup, Node.js (v20+ / v22+) |
| **Hosting & CI/CD** | Vercel (primary), GitHub Pages, GitHub Actions |

---

## 4. Project Directory Structure

```text
Nishanth_portfolio/
├── .github/
│   └── workflows/
│       └── deploy.yml            # Automated GitHub Actions deployment workflow
├── assets/
│   ├── ai-news-detector.png      # AI News Detector application screenshot
│   ├── StudyMate.png             # StudyMate planner application screenshot
│   ├── quizhero-preview.svg      # QuizHero architectural diagram
│   ├── avatar.svg                # Developer avatar badge
│   ├── favicon.svg               # Browser favicon
│   ├── resume.pdf                # Resume document placeholder
│   ├── index.js                  # Prebundled WebGPU AI assistant controller
│   ├── ai-worker.js              # WebLLM worker thread
│   └── lib.js                    # Quantized WebLLM engine runtime & DOMPurify bundle
├── public/
│   ├── robots.txt                # Search engine crawler instructions
│   └── sitemap.xml               # SEO XML sitemap
├── src/
│   ├── ai-service.js             # WebGPU detection, shared init promise & MLC engine controller
│   ├── ai-worker.js              # Worker entry point
│   ├── chatbot-ui.js             # UI state, DOMPurify markdown rendering & streaming
│   ├── main.js                   # Application bootstrap
│   └── portfolioKnowledge.js     # Compact verified facts extractor & system prompt
├── index.html                    # Main semantic HTML document
├── style.css                     # Custom design system & responsive styling
├── script.js                     # Zero-dependency interactive portfolio controller
├── portfolio.json                # Single source of truth for verified portfolio data
├── package.json                  # Project dependencies & build scripts
├── vercel.json                   # Vercel deployment configuration & security headers
├── vite.config.js                # Vite build and worker bundling configuration
└── README.md                     # Documentation
```

---

## 5. Local Development & Installation

### Prerequisites
- **Node.js**: Version 20.x or 22.x+
- **Browser**: Google Chrome 113+, Microsoft Edge 113+, or any browser with WebGPU enabled.

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Nishanthv4/Portfolio.git
   cd Portfolio
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your WebGPU-capable browser.

4. **Build for production**:
   ```bash
   npm run build
   ```
   Outputs the optimized, minified bundle into the `dist/` folder.

5. **Preview the production build locally**:
   ```bash
   npm run preview
   ```

---

## 6. AI Portfolio Assistant: Architecture & Hardware Requirements

### How WebLLM Works
Traditional AI chatbots send user prompts over the internet to remote cloud APIs (e.g., OpenAI or Gemini). This portfolio assistant uses `@mlc-ai/web-llm` to execute machine learning models **directly on your computer's GPU via WebGPU**.

1. **Explicit Activation**: The model is never downloaded on page load. A visitor must explicitly click **Start AI Assistant**.
2. **Download & Caching**: On the first launch, the browser downloads quantized model weights (~350MB). The weights are stored in browser `CacheStorage`. Subsequent visits load in under 2 seconds directly from disk without re-downloading.
3. **Web Worker Threading**: Tensor arithmetic and inference run in an isolated Web Worker. The webpage UI remains completely responsive during token generation.
4. **Factual Grounding**: The model is prompted with factual facts strictly extracted from `portfolio.json`. It is instructed never to invent experience, certifications, or accomplishments.

### Hardware & Browser Compatibility
- **Supported Browsers**: Google Chrome (v113+), Microsoft Edge (v113+), Brave, Opera, Chrome on Android.
- **Hardware**: Any modern dedicated or integrated graphics card (Intel Iris Xe, AMD Radeon, NVIDIA GeForce, Apple Silicon M1/M2/M3/M4).
- **Fallback**: If a visitor opens the portfolio on an unsupported device or mobile browser without WebGPU, the assistant displays a clear explanation with instructions on how to enable hardware acceleration.

---

## 7. Deployment Instructions

### Deploying to Vercel (Recommended)
1. Fork or push this repository to your GitHub account.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your `Portfolio` repository.
4. Vercel automatically detects the build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. Your site will be live on a fast global edge network with custom security headers automatically applied from `vercel.json`.

### Deploying to GitHub Pages
1. Go to your repository on GitHub.
2. Navigate to **Settings > Pages**.
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`
   - **Branch**: Select `gh-pages` (or `main`) and folder `/ (root)`
   - Click **Save**.
4. To redeploy from your machine:
   ```bash
   npm run deploy
   ```

---

## 8. Known Limitations

- **WebGPU Support on iOS**: Safari on iOS does not yet have full default WebGPU support in stable channels. Visitors on iOS Safari will see the friendly fallback message.
- **Initial Download Bandwidth**: The initial download requires ~350MB of internet data. Once downloaded, the model operates completely offline without consuming bandwidth.

---

## 9. Contact & Social Profiles

- **Email**: [nishanthv4@gmail.com](mailto:nishanthv4@gmail.com)
- **LinkedIn**: [linkedin.com/in/nishanth-v-129367360](https://www.linkedin.com/in/nishanth-v-129367360/)
- **GitHub**: [github.com/Nishanthv4](https://github.com/Nishanthv4)
- **X (Twitter)**: [x.com/nishant61972303](https://x.com/nishant61972303)
- **Institution**: R.M.D. Engineering College, Tamil Nadu, India

---

*Authored by Nishanth V. Clean, accessible, privacy-respecting engineering.*


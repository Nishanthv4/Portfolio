# Nishanth V — Developer Portfolio

A responsive personal portfolio for Nishanth V, a first-year B.Tech Computer Science and Engineering student at R.M.D. Engineering College. The site presents practical projects, skills, learning goals, contact details, and an optional local-inference AI assistant.

**Live portfolio:** https://nishanthv4.github.io/Portfolio/  
**Source repository:** https://github.com/Nishanthv4/Portfolio

## Highlights

- Responsive portfolio built with semantic HTML, CSS, and JavaScript.
- Interactive terminal with predefined demonstration commands.
- Project detail dialogs and contact form that prepares a Gmail draft.
- Local-inference AI portfolio assistant using WebLLM, WebGPU, and a dedicated Web Worker.
- Markdown output sanitized with DOMPurify before it is inserted into the page.
- GitHub Actions workflow that runs the test suite, builds the site, verifies generated assets, and deploys GitHub Pages.

## AI assistant architecture

The assistant runs inference in the visitor's browser. It does not send visitor prompts to a hosted Gemini or OpenAI inference API.

- Runtime: `@mlc-ai/web-llm`
- Model: `SmolLM2-360M-Instruct`
- Quantization: `q4f16_1` when the adapter supports `shader-f16`, otherwise `q4f32_1`
- Approximate model download size reported by the application: 194 MB
- Context window override: 2,048 tokens
- Default response limit: 128 tokens
- Execution: module Web Worker with WebGPU

The visitor must explicitly start the assistant. The first start downloads the model weights; later starts may reuse browser-cached data. WebGPU availability and performance vary by browser, operating system, graphics driver, and GPU memory. If WebGPU is unavailable, the assistant displays an explanatory fallback.

The portfolio page itself loads Google Fonts from Google's font CDN. The AI model is downloaded from its configured model host, so the initial model load requires an internet connection.

## Projects

| Project | Description | Public source |
|---|---|---|
| StudyMate | Local-first student planner concept with timetable, tasks, missed-task rescheduling, exam countdown, and backup/restore | Not published yet |
| AI News Detector | AI-assisted credibility analysis concept focused on context and source signals, not absolute true/false judgments | Not published yet |
| QuizHero | React and TypeScript quiz application with Capacitor Android packaging | [GitHub](https://github.com/Nishanthv4/Quizhero) |
| Cloud Infrastructure & Microservices | Planned learning project for Linux, Docker, AWS, and CI/CD | Not published yet |

Project descriptions and skill levels are maintained in `portfolio.json`. Keep that file aligned with what is implemented and publicly demonstrable.

## Local development

### Requirements

- Node.js 22
- npm
- A current browser; WebGPU is only required to run the optional local AI assistant.

### Install and run

```bash
git clone https://github.com/Nishanthv4/Portfolio.git
cd Portfolio
npm ci
npm run dev
```

Vite serves the site at `http://localhost:3000`.

### Test and production build

```bash
npm test
npm run build
npm run preview
```

The production build performs these steps:

1. Bundles the assistant modules from `src/`.
2. Preserves the generated hashed Web Worker filename so it matches the URL referenced by the assistant entry bundle.
3. Builds the website with Vite.
4. Copies the main portfolio controller into `dist/`.
5. Verifies that the assistant entry point, runtime library, worker, and local assets exist in the final output.

The build verification fails when the worker reference cannot be resolved to a file in `dist/assets/`.

## Deployment

### GitHub Pages

The `.github/workflows/deploy.yml` workflow runs on pushes to `main`. It installs dependencies, runs `npm test`, builds and verifies the site, then deploys the `dist/` directory.

In repository settings, configure **Pages → Build and deployment → Source: GitHub Actions**. Do not configure Pages to publish the repository root directly.

### Vercel

Import this repository into Vercel. Use:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

The repository's `vercel.json` supplies the Vercel build and response-header configuration.

## Repository structure

```text
.
├── .github/workflows/     # CI and GitHub Pages deployment
├── assets/                # Images, icons, generated assistant bundles, resume
├── scripts/               # Assistant build and production verification
├── src/                   # AI assistant source modules
├── index.html             # Portfolio markup
├── style.css              # Responsive styling
├── script.js              # Portfolio interactions
├── portfolio.json         # Structured portfolio facts and project data
├── test-suite.js          # Automated source/data/security checks
├── package.json
├── vercel.json
└── README.md
```

## Contact

- Email: nishanthv4@gmail.com
- GitHub: https://github.com/Nishanthv4
- LinkedIn: https://www.linkedin.com/in/nishanth-v-129367360/
- X: https://x.com/nishant61972303

---

Authored by Nishanth V.

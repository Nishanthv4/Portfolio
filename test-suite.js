import fs from 'fs';
import createDOMPurify from 'dompurify';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

console.log('====================================================');
console.log('NISHANTH V PORTFOLIO — AUTOMATED VERIFICATION SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

// --------------------------------------------------------------------------
// TEST 1: portfolio.json Data Integrity
// --------------------------------------------------------------------------
console.log('--- 1. Testing portfolio.json schema and verified facts ---');
const portfolioRaw = fs.readFileSync('portfolio.json', 'utf8');
const portfolio = JSON.parse(portfolioRaw);

assert(portfolio.profile.name === 'Nishanth V', 'Profile name is Nishanth V');
assert(portfolio.profile.education.institution === 'R.M.D. Engineering College', 'Institution is R.M.D. Engineering College');
assert(portfolio.profile.education.academicYear === 'First Year', 'Academic level is First Year');
assert(portfolio.profile.contact.email === 'nishanthv4@gmail.com', 'Email is nishanthv4@gmail.com');
assert(portfolio.profile.contact.github === 'https://github.com/Nishanthv4', 'GitHub link verified');
assert(portfolio.profile.contact.linkedin.includes('nishanth-v'), 'LinkedIn link verified');
assert(portfolio.profile.contact.twitter.includes('nishant61972303'), 'Twitter/X link verified');
assert(portfolio.projects.length >= 3, 'Projects list contains verified projects (StudyMate, AI News Detector, QuizHero)');
assert(portfolio.projects.some(p => p.name === 'QuizHero' && p.github === 'https://github.com/Nishanthv4/Quizhero'), 'QuizHero verified with genuine GitHub repo');

// --------------------------------------------------------------------------
// TEST 2: DOMPurify XSS Sanitization (Fix 5B)
// --------------------------------------------------------------------------
console.log('\n--- 2. Testing Markdown XSS Sanitization with DOMPurify ---');

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

const safeInput = '**Hello** this is `code` and [link](https://github.com/Nishanthv4)';
const safeOutput = renderSafeMarkdown(safeInput);
assert(safeOutput.includes('<strong>Hello</strong>'), 'Safe markdown tags (<strong>) preserved');
assert(safeOutput.includes('<code>code</code>'), 'Code tags (<code>) preserved');
assert(safeOutput.includes('href="https://github.com/Nishanthv4"'), 'Safe links preserved');

const maliciousInput = 'Normal text <script>alert("xss")</script><img src="x" onerror="alert(1)">';
const sanitizedOutput = renderSafeMarkdown(maliciousInput);
assert(!sanitizedOutput.includes('<script>'), 'Dangerous <script> tag completely stripped');
assert(!sanitizedOutput.includes('onerror'), 'Dangerous onerror attribute completely stripped');

// --------------------------------------------------------------------------
// TEST 3: Duplicate User Message Logic (Fix 5A)
// --------------------------------------------------------------------------
console.log('\n--- 3. Testing Duplicate User Message Prevention ---');

function buildCleanModelMessages(history, userMessage) {
  const historyCopy = Array.isArray(history) ? [...history] : [];
  const cleanUserText = (userMessage || '').trim();

  const lastItem = historyCopy[historyCopy.length - 1];
  if (!lastItem || lastItem.role !== 'user' || lastItem.content !== cleanUserText) {
    if (cleanUserText) {
      historyCopy.push({ role: 'user', content: cleanUserText });
    }
  }

  const trimmedHistory = historyCopy.slice(-6);
  return [{ role: 'system', content: 'SYSTEM_PROMPT' }, ...trimmedHistory];
}

// Case A: User message ALREADY in history
const historyWithUser = [
  { role: 'user', content: 'Tell me about StudyMate' }
];
const messagesA = buildCleanModelMessages(historyWithUser, 'Tell me about StudyMate');
const userCountA = messagesA.filter(m => m.role === 'user' && m.content === 'Tell me about StudyMate').length;
assert(userCountA === 1, 'User message present exactly ONCE when already pushed to history');

// Case B: User message NOT in history
const historyEmpty = [];
const messagesB = buildCleanModelMessages(historyEmpty, 'What is your stack?');
const userCountB = messagesB.filter(m => m.role === 'user' && m.content === 'What is your stack?').length;
assert(userCountB === 1, 'User message present exactly ONCE when not pre-pushed to history');

// --------------------------------------------------------------------------
// TEST 4: HTML Structure & Accessibility
// --------------------------------------------------------------------------
console.log('\n--- 4. Testing index.html Structure & Accessibility ---');
const indexHtml = fs.readFileSync('index.html', 'utf8');

assert(indexHtml.includes('<a href="#main-content" class="skip-link">'), 'Accessibility skip link present');
assert(indexHtml.includes('id="modal-studymate"'), 'StudyMate modal present');
assert(indexHtml.includes('id="modal-ainews"'), 'AI News Detector modal present');
assert(indexHtml.includes('id="modal-quizhero"'), 'QuizHero modal present');
assert(indexHtml.includes('script.js'), 'script.js linked directly in index.html');
assert(indexHtml.includes('assets/index.js'), 'assets/index.js linked directly for AI Assistant');
assert(indexHtml.includes('noscript'), 'Noscript fallback style present in index.html');
assert(!indexHtml.includes('src="/src/main.js"'), 'Absolute path /src/main.js eliminated');

// --------------------------------------------------------------------------
// TEST 5: CSS Reveal Fallback
// --------------------------------------------------------------------------
console.log('\n--- 5. Testing CSS Reveal Fallback ---');
const styleCss = fs.readFileSync('style.css', 'utf8').replace(/\r\n/g, '\n');

assert(styleCss.includes('.reveal {\n  opacity: 1;\n  transform: none;'), 'CSS .reveal defaults to opacity: 1 (failsafe)');
assert(styleCss.includes('html.js-ready .reveal:not(.visible)'), 'CSS scroll hide only active when js-ready is confirmed');
assert(styleCss.includes('@media (prefers-reduced-motion: reduce)'), 'Prefers-reduced-motion respected');

// --------------------------------------------------------------------------
// TEST 6: Deployment Configuration
// --------------------------------------------------------------------------
console.log('\n--- 6. Testing Deployment Configs (Vercel & GitHub Pages) ---');
const vercelJson = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
assert(vercelJson.buildCommand === 'npm run build', 'Vercel buildCommand is npm run build');
assert(vercelJson.outputDirectory === 'dist', 'Vercel outputDirectory is dist');
assert(Array.isArray(vercelJson.headers), 'Vercel security headers configured');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(!packageJson.homepage, 'Conflicting homepage property removed from package.json');
assert(packageJson.dependencies['@mlc-ai/web-llm'], 'web-llm dependency verified');
assert(packageJson.dependencies['dompurify'], 'dompurify dependency verified');
assert(packageJson.dependencies['marked'], 'marked dependency verified');

// --------------------------------------------------------------------------
// TEST 7: AI worker build regression and truthful project data
// --------------------------------------------------------------------------
console.log('\n--- 7. Testing AI worker build regression and truthful project data ---');
const buildScript = fs.readFileSync('scripts/build-assistant.js', 'utf8');
const knowledgeSource = fs.readFileSync('src/portfolioKnowledge.js', 'utf8');
const readmeSource = fs.readFileSync('README.md', 'utf8');
const workflowSource = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');

assert(buildScript.includes('path.join(targetAssets, file)'), 'AI build preserves generated worker filenames');
assert(!buildScript.includes("destName = 'ai-worker.js'"), 'AI build no longer renames hashed workers');
assert(knowledgeSource.includes('Not publicly published yet'), 'AI assistant does not invent unpublished repository links');
assert(portfolio.projects.find(p => p.name === 'StudyMate')?.github === null, 'StudyMate repository marked unpublished');
assert(portfolio.projects.find(p => p.name === 'AI News Detector')?.github === null, 'AI News Detector repository marked unpublished');
assert(portfolio.experience.extracurricular.includes('Independent project development'), 'Experience copy avoids unsupported club participation');
assert(readmeSource.includes('SmolLM2-360M-Instruct'), 'README documents the implemented SmolLM2 model');
assert(!readmeSource.includes('Qwen2.5-0.5B'), 'README no longer documents the retired Qwen model');
assert(workflowSource.includes('npm test'), 'GitHub Pages deployment runs automated tests');
assert(packageJson.scripts.test === 'node test-suite.js', 'npm test script is configured');

// --------------------------------------------------------------------------
// TEST 8: Modal keyboard focus management
// --------------------------------------------------------------------------
console.log('\n--- 8. Testing modal keyboard accessibility ---');
const applicationScript = fs.readFileSync('script.js', 'utf8');
assert(applicationScript.includes('modalTriggerToRestore'), 'Modal records the trigger for focus restoration');
assert(applicationScript.includes("event.key !== 'Tab'"), 'Modal traps keyboard Tab navigation');
assert(applicationScript.includes('trigger.focus()'), 'Modal restores focus after closing');

// --------------------------------------------------------------------------
// TEST 9: Accurate public project source links
// --------------------------------------------------------------------------
console.log('\n--- 9. Testing project repository links ---');
const projectSourceLinks = [...new JSDOM(indexHtml).window.document.querySelectorAll('.project-card .proj-btn-github[href]')];
assert(projectSourceLinks.length === 1, 'Only projects with a public source repository render a source link');
assert(projectSourceLinks[0]?.getAttribute('href') === 'https://github.com/Nishanthv4/Quizhero', 'QuizHero links to its actual public repository');
assert(indexHtml.includes('Repository not published'), 'Unpublished projects show a non-clickable repository status');

// --------------------------------------------------------------------------
// TEST 11: Published resume asset
// --------------------------------------------------------------------------
console.log('\n--- 11. Testing source and public resume copies ---');
const sourceResume = fs.readFileSync('assets/resume.pdf');
const publicResume = fs.readFileSync('public/assets/resume.pdf');
assert(sourceResume.subarray(0, 5).toString('ascii') === '%PDF-', 'Source resume is a valid PDF');
assert(publicResume.subarray(0, 5).toString('ascii') === '%PDF-', 'Public resume is a valid PDF');
assert(sourceResume.length > 4000, 'Source resume is not the placeholder PDF');
assert(publicResume.length > 4000, 'Public resume is not the placeholder PDF');

// --------------------------------------------------------------------------
// TEST 10: Production build verification guard
// --------------------------------------------------------------------------
console.log('\n--- 10. Testing production build verification guard ---');
assert(fs.existsSync('scripts/verify-build.js'), 'Production build verification script exists');
assert(packageJson.scripts.build.includes('scripts/verify-build.js'), 'Production build runs the asset verification guard');

console.log('\n====================================================');
console.log(`TEST SUITE SUMMARY: ${passedTests} / ${totalTests} assertions passed.`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

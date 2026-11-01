import fs from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('dist');
const assetsRoot = path.join(distRoot, 'assets');

function fail(message) {
  console.error(`[verify-build] FAIL: ${message}`);
  process.exit(1);
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`${label} is missing: ${path.relative(distRoot, filePath)}`);
  }
  console.log(`[verify-build] OK: ${label}`);
}

requireFile(path.join(distRoot, 'index.html'), 'built HTML');
requireFile(path.join(distRoot, 'script.js'), 'portfolio interaction bundle');
requireFile(path.join(assetsRoot, 'index.js'), 'AI assistant entry bundle');
requireFile(path.join(assetsRoot, 'lib.js'), 'AI runtime bundle');

const entrySource = fs.readFileSync(path.join(assetsRoot, 'index.js'), 'utf8');
const assetFiles = fs.readdirSync(assetsRoot);
const generatedWorkers = assetFiles.filter(name =>
  name.startsWith('ai-worker') && name.endsWith('.js')
);

if (generatedWorkers.length === 0) {
  fail('No generated ai-worker JavaScript asset was found in dist/assets/');
}

const executableBundles = assetFiles
  .filter(name => name.endsWith('.js') && !generatedWorkers.includes(name))
  .map(name => fs.readFileSync(path.join(assetsRoot, name), 'utf8'));

if (!executableBundles.some(source => source.includes('new Worker('))) {
  fail('AI bundles do not contain a Web Worker constructor');
}

// Vite can rewrite worker URLs during its second HTML build pass. Check any
// remaining explicit filename references when present, but always require
// the actual generated worker asset and the app's worker constructor.
const explicitReferences = generatedWorkers.filter(name =>
  executableBundles.some(source => source.includes(name))
);

if (explicitReferences.length > 0) {
  console.log(`[verify-build] OK: explicit worker reference resolves to ${explicitReferences.join(', ')}`);
} else {
  console.log(`[verify-build] OK: generated worker asset exists (${generatedWorkers.join(', ')}) and AI bundle creates a Worker`);
}

const html = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
if (!html.includes('assets/index.js') || !html.includes('script.js')) {
  fail('Built HTML is missing the portfolio or AI assistant entry point');
}

console.log('[verify-build] All production asset checks passed.');

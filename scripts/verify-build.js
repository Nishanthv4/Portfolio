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
const workerPattern = /["']([^"']*ai-worker[^"']*\.js)["']/g;
const workerReferences = [...entrySource.matchAll(workerPattern)]
  .map(match => path.basename(match[1].split('?')[0]));

if (workerReferences.length === 0) {
  fail('No generated WebLLM worker URL was found in assets/index.js');
}

const validWorkers = workerReferences.filter(name =>
  fs.existsSync(path.join(assetsRoot, name))
);

if (validWorkers.length === 0) {
  fail(`Worker URL does not resolve to a file in dist/assets/: ${workerReferences.join(', ')}`);
}

console.log(`[verify-build] OK: worker URL resolves to ${validWorkers.join(', ')}`);

const html = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
if (!html.includes('assets/index.js') || !html.includes('script.js')) {
  fail('Built HTML is missing the portfolio or AI assistant entry point');
}

console.log('[verify-build] All production asset checks passed.');

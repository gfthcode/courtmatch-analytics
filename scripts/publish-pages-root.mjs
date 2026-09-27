import { cp, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const buildDirectory = resolve('dist');
const repositoryRoot = resolve('.');
const legacyEnhancementFiles = new Set([
  'home-enhance.js',
  'home-lead-v2.css',
  'home-lead.css',
  'home-style-force.js',
  'salary-vault-20260923.js',
  'salary-vault-lite.js',
]);

for (const entry of await readdir(buildDirectory)) {
  if (entry === 'data' || entry === 'dist' || legacyEnhancementFiles.has(entry)) continue;
  await cp(resolve(buildDirectory, entry), resolve(repositoryRoot, entry), {
    recursive: true,
    force: true,
  });
}

console.log('Published the built Pages entrypoints and assets to the repository root.');

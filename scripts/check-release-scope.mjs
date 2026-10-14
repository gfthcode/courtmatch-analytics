import { execFileSync } from 'node:child_process';

const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const allowIndex = args.indexOf('--allow');
const allowed = allowIndex < 0 ? [] : args.slice(allowIndex + 1);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: pnpm release:check -- --allow <exact/path> [<exact/path> ...]');
  console.log('Checks the staged production release on main; unstaged and untracked files are never included.');
  process.exit(0);
}

if (allowIndex < 0 || allowed.length === 0 || allowed.some((path) => path.startsWith('-') || path.includes('*') || path.includes('..'))) {
  console.error('Release blocked: provide one or more exact, safe paths with --allow. Wildcards and parent paths are not accepted.');
  process.exit(1);
}

const branch = run(['branch', '--show-current']);
if (branch !== 'main') {
  console.error(`Release blocked: production releases must be prepared on main (current branch: ${branch || 'detached HEAD'}).`);
  process.exit(1);
}

const staged = run(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
if (staged.length === 0) {
  console.error('Release blocked: no staged files. Stage only the changes intended for this release, then rerun the check.');
  process.exit(1);
}

const allowSet = new Set(allowed);
const unexpected = staged.filter((path) => !allowSet.has(path));
if (unexpected.length > 0) {
  console.error('Release blocked: staged files outside the explicit release scope:');
  for (const path of unexpected) console.error(`  - ${path}`);
  process.exit(1);
}

const removed = run(['diff', '--cached', '--diff-filter=DR', '--name-only', '-z']).split('\0').filter(Boolean);
if (removed.length > 0) {
  console.error('Release blocked: staged deletions/renames require a separate explicit review:');
  for (const path of removed) console.error(`  - ${path}`);
  process.exit(1);
}

try {
  const reviewable = staged.filter((path) => !/^assets\/index-[A-Za-z0-9_-]+\.(js|css)$/.test(path));
  execFileSync('git', ['diff', '--cached', '--check', '--', ...reviewable], { stdio: 'pipe' });
} catch (error) {
  console.error('Release blocked: staged changes contain whitespace errors.');
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  process.exit(1);
}

console.log(`Release scope passed on ${branch}; ${staged.length} staged file(s) are all explicitly allowed:`);
for (const path of staged) console.log(`  - ${path}`);
console.log('Unstaged and untracked files are excluded from this staged release.');

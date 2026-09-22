import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const validator = resolve(root, 'scripts/validate-data.mjs');
const sourceData = resolve(root, 'data');

async function validateFixture(mutator) {
  const directory = await mkdtemp(join(tmpdir(), 'courtmatch-data-'));
  await cp(sourceData, directory, { recursive: true });
  try {
    await mutator(directory);
    return spawnSync(process.execPath, [validator, directory], { encoding: 'utf8' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeManifest(directory, patch) {
  const path = join(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  Object.assign(manifest, patch);
  await writeFile(path, `${JSON.stringify(manifest)}\n`);
}

test('accepts an explicitly marked demo catalogue regardless of current published mode', async () => {
  const result = await validateFixture((directory) => writeManifest(directory, { status: 'demo', isDemo: true }));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated safe demo manifest/);
});

test('rejects contradictory demo and live flags', async () => {
  const result = await validateFixture((directory) => writeManifest(directory, { status: 'live', isDemo: true }));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CourtMatch data validation failed/);
});

test('rejects a live catalogue without its required payloads', async () => {
  const result = await validateFixture(async (directory) => {
    await writeManifest(directory, { status: 'live', isDemo: false });
    await Promise.all(['players.json', 'teams.json', 'matchups.json', 'playtypes.json'].map((name) => rm(join(directory, name), { force: true })));
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CourtMatch data validation failed/);
});

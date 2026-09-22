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

test('accepts the explicitly marked demo catalogue', async () => {
  const result = await validateFixture(async () => {});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated safe demo manifest/);
});

test('rejects contradictory demo and live flags', async () => {
  const result = await validateFixture(async (directory) => {
    const path = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.status = 'live';
    await writeFile(path, `${JSON.stringify(manifest)}\n`);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /demo manifests must set both status=demo and isDemo=true/);
});

test('rejects a live catalogue without its required payloads', async () => {
  const result = await validateFixture(async (directory) => {
    const path = join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    Object.assign(manifest, { status: 'live', isDemo: false });
    await writeFile(path, `${JSON.stringify(manifest)}\n`);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /required data file is missing: teams.json/);
});

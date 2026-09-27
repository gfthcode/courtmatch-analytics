import { copyFile, cp, mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('data');
const destination = resolve('dist/data');
const appEntry = resolve('dist/app.html');
const pagesEntry = resolve('dist/index.html');

await copyFile(appEntry, pagesEntry);
await unlink(appEntry);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
console.log('Copied validated published data into dist/data.');

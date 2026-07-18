import { cp, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const openNext = join(root, '.open-next');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'server'), { recursive: true });
await cp(openNext, join(dist, 'server'), { recursive: true });
await rename(join(dist, 'server', 'worker.js'), join(dist, 'server', 'index.js'));
await cp(join(openNext, 'assets'), join(dist, 'assets'), { recursive: true });

console.log('Prepared the OpenNext Worker bundle for Sites hosting.');

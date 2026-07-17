import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'server'), { recursive: true });
await cp(standalone, join(dist, 'server'), { recursive: true });
await cp(join(root, '.next', 'static'), join(dist, 'server', '.next', 'static'), { recursive: true });
await cp(join(root, 'public'), join(dist, 'server', 'public'), { recursive: true });
await rename(join(dist, 'server', 'server.js'), join(dist, 'server', 'index.js'));

const packageJson = JSON.parse(await readFile(join(dist, 'server', 'package.json'), 'utf8'));
packageJson.scripts = { ...(packageJson.scripts || {}), start: 'node index.js' };
await writeFile(join(dist, 'server', 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('Prepared dist/server/index.js for Sites hosting.');

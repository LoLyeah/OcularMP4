import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const openNext = join(root, '.open-next');
const dist = join(root, 'dist');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

// Next's Node runtime currently imports its development-only file logger while
// booting the server bundle. That logger pulls in `fs`/`path` through CommonJS,
// which crashes in the ESM-only Cloudflare Worker runtime before a route can
// render. Logging is already handled by the Worker platform, so neutralize
// that optional hook in the generated server bundle before packaging it.
const handlerPath = join(openNext, 'server-functions', 'default', 'handler.mjs');
const handler = await readFile(handlerPath, 'utf8');
const withoutNodeFileLogger = handler.replace(
  /var require_console_file=__commonJS\(\{[\s\S]*?console-file\.js"\(exports\)\{[\s\S]*?\}\}\);var require_work_unit_async_storage_instance/,
  'var require_console_file=__commonJS({"console-file.js"(exports){"use strict";}});var require_work_unit_async_storage_instance',
);
if (withoutNodeFileLogger === handler) {
  throw new Error('Could not remove Next.js Node-only console logger from the Worker bundle.');
}
await writeFile(handlerPath, withoutNodeFileLogger);

// Version the dynamic server module and update the main Worker import. Sites
// may reuse an unchanged entrypoint and its previously uploaded module graph;
// a release-specific path guarantees the patched handler is uploaded with the
// new deployment.
const versionedHandlerName = `handler-${version}.mjs`;
await rename(handlerPath, join(openNext, 'server-functions', 'default', versionedHandlerName));
const workerPath = join(openNext, 'worker.js');
const worker = await readFile(workerPath, 'utf8');
const versionedWorker = worker.replace(
  './server-functions/default/handler.mjs',
  `./server-functions/default/${versionedHandlerName}`,
);
if (versionedWorker === worker) {
  throw new Error('Could not version the OpenNext server module import.');
}
await writeFile(workerPath, versionedWorker);

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'server'), { recursive: true });
await cp(openNext, join(dist, 'server'), { recursive: true });
await rename(join(dist, 'server', 'worker.js'), join(dist, 'server', 'index.js'));
await cp(join(openNext, 'assets'), join(dist, 'assets'), { recursive: true });
await mkdir(join(dist, '.openai'), { recursive: true });
await cp(join(root, '.openai', 'hosting.json'), join(dist, '.openai', 'hosting.json'));

console.log('Prepared the OpenNext Worker bundle for Sites hosting.');

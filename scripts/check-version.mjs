import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const version = packageJson.version;
const files = [
  ['public/sw.js', `APP_VERSION = '${version}'`],
  ['public/manifest.json', '"short_name": "OcularMP4"'],
  ['components/settings-panel.tsx', `>${version}<`],
];

for (const [file, marker] of files) {
  const content = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (!content.includes(marker)) {
    console.error(`Version check could not validate ${file}.`);
    process.exitCode = 1;
  }
}

console.log(`OcularMP4 version ${version} is consistent.`);

import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');
const replacements = [
  ["  const buildLabel = activeLab === 'journey'\n    ? 'LAB 06'", "  const buildLabel = activeLab === 'journey'\n    ? 'LAB 07'"],
  ["  const buildStatus = activeLab === 'journey'\n    ? 'URL JOURNEY ACTIVE'", "  const buildStatus = activeLab === 'journey'\n    ? 'GOD MODE JOURNEY ACTIVE'"],
];
for (const [search, replacement] of replacements) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one App topbar label match, found ${count}.`);
  source = source.replace(search, replacement);
}
fs.writeFileSync(path, source);
console.log('Aligned active Journey topbar with Lab 07 GOD MODE.');

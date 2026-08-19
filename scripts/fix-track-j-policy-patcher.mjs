import fs from 'node:fs';

const path = 'scripts/apply-track-j-policy-slice.mjs';
let source = fs.readFileSync(path, 'utf8');
source = source.split('\\\\`').join('\\`');
source = source.split('\\\\${').join('\\${');
fs.writeFileSync(path, source);
console.log('Normalized temporary Track J patcher quoting.');

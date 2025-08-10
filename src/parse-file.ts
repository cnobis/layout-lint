import fs from 'node:fs';
import { parseLayoutSpec } from './index.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: tsx src/parse-file.ts <file.layout>');
  process.exit(1);
}
const src = fs.readFileSync(file, 'utf8');
const out = parseLayoutSpec(src);
console.log(JSON.stringify(out, null, 2));

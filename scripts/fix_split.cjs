const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/input\.split\('\n\n'\)/g, "input.split('\\n')");
code = code.replace(/input\.split\('\n'\)/g, "input.split('\\n')");

// Also let's check what exactly is around line 838.
const splitPattern = /input\.split\('\s+'\)/g;
// actually let's just find and replace the block
const oldSplit = `rows={input.split('
').length > 1 ? Math.min(input.split('
').length, 4) : 1}`;

const newSplit = `rows={input.split('\\n').length > 1 ? Math.min(input.split('\\n').length, 4) : 1}`;

if (code.includes(oldSplit)) {
  code = code.replace(oldSplit, newSplit);
} else {
  // Try another approach
  code = code.replace(/rows=\{input\.split\('[\r\n]+'\)\.length > 1 \? Math\.min\(input\.split\('[\r\n]+'\)\.length, 4\) : 1\}/g, newSplit);
}

fs.writeFileSync('src/App.tsx', code);

import fs from "fs";

let data = fs.readFileSync('src/data.ts', 'utf8');

function fixQuotes(csvStr) {
  let inQuotes = false;
  let fixed = '';
  for (let i = 0; i < csvStr.length; i++) {
    if (csvStr[i] === '"') {
      inQuotes = !inQuotes;
    }
    if (csvStr[i] === '\n' && inQuotes) {
      fixed += ' | ';
    } else {
      fixed += csvStr[i];
    }
  }
  return fixed;
}

let fixedData = fixQuotes(data);
fs.writeFileSync('src/data.ts', fixedData);
console.log("Fixed newlines inside quotes!");

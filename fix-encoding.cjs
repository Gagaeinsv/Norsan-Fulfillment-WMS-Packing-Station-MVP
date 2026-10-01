const fs = require('fs');
const path = require('path');

function getAllTsFiles(dir) {
  const result = [];
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      result.push(...getAllTsFiles(full));
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      result.push(full);
    }
  });
  return result;
}

const files = getAllTsFiles('src');

const replacements = [
  ['â€¢', '\u2022'],  // •
  ['â€™', '\u2019'],  // '
  ['â€œ', '\u201C'],  // "
  ['â€\u009D', '\u201D'], // "
  ['â€', '\u201D'],   // " fallback
  ['Ã ', '\u00E0'],   // à
  ['Ã©', '\u00E9'],   // é
  ['Ã¨', '\u00E8'],   // è
  ['Ã¬', '\u00EC'],   // ì
  ['Ã²', '\u00F2'],   // ò
  ['Ã¹', '\u00F9'],   // ù
  ['Ã\u00B9', '\u00F9'], // ù alt
];

let totalFixed = 0;
files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let fixed = content;
  replacements.forEach(([from, to]) => {
    while (fixed.includes(from)) {
      fixed = fixed.split(from).join(to);
    }
  });
  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log('Fixed:', filePath);
    totalFixed++;
  }
});

console.log(`\nDone. Fixed ${totalFixed} files.`);

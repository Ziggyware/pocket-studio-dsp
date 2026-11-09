const fs = require('fs');
const path = require('path');
const glob = require('glob');

const output = [];
const files = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'index.html',
  'tailwind.config.js',
  'src/main.tsx',
  'src/App.tsx',
  'src/types.ts',
  'src/constants.ts',
  'src/index.css',
  'src/components/*.tsx',
  'src/services/*.ts',
  'src/utils/*.ts'
];

let allPaths = [];
files.forEach(pattern => {
  const matched = glob.sync(pattern);
  allPaths = allPaths.concat(matched);
});

allPaths = [...new Set(allPaths)].filter(f => fs.statSync(f).isFile());

allPaths.forEach(file => {
  output.push(`// --- ${file} ---`);
  output.push(fs.readFileSync(file, 'utf8'));
  output.push('');
});

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}
fs.writeFileSync('public/source-export.txt', output.join('\n'));
console.log('Source export created at public/source-export.txt');

const fs = require('fs');
const path = require('path');

const output = [];
const rootFiles = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'index.html',
  'tailwind.config.js',
  'App.tsx',
  'index.tsx',
  'types.ts',
  'constants.ts'
];

function readDirRecursive(dir) {
    if (!fs.existsSync(dir)) return [];
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(readDirRecursive(file));
        } else {
            results.push(file);
        }
    });
    return results;
}

const allFiles = [
  ...rootFiles, 
  ...readDirRecursive('components'),
  ...readDirRecursive('services'),
  ...readDirRecursive('utils'),
  ...readDirRecursive('hooks')
];

allFiles.forEach(file => {
  if (fs.existsSync(file)) {
      output.push(`// ==========================================`);
      output.push(`// FILE: ${file}`);
      output.push(`// ==========================================`);
      output.push(fs.readFileSync(file, 'utf8'));
      output.push('');
  }
});

fs.writeFileSync('source-export.txt', output.join('\n'));
console.log('Source export created at source-export.txt');

import fs from 'node:fs/promises';

const file = new URL('../app.js', import.meta.url);
let source = await fs.readFile(file, 'utf8');
const before = "{x:300,y:270,zone:'control'}";
const after = "{x:390,y:165,zone:'control'}";
if (source.includes(before)) {
  source = source.replace(before, after);
  await fs.writeFile(file, source);
  console.log('level node placement refined');
} else if (source.includes(after)) {
  console.log('level node placement already refined');
} else {
  throw new Error('Unable to locate control-zone node');
}

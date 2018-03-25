import { readPakFromBuffer } from '../lib';
import fs from 'fs';

const pakFileName = 'test.pak';
const pakFileData = fs.readFileSync(pakFileName);
const files = readPakFromBuffer(pakFileData);
for (const file of files) {
  const {
    name, size, type, data, isDirectory,
  } = file;
  if (isDirectory) {
    console.log(`mkdir: ${name}`);
    fs.mkdirSync(name);
  } else {
    console.log(`write file: ${name}, size: ${size}`);
    fs.writeFileSync(name, data);
  }
}

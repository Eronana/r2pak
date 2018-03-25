r2pak
=====
`r2pak` is a library used to uncompress pak file

## Usage
```typescript
import { readPakFromBuffer } from 'r2pak';
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
```

## API
### readPakFromBuffer(buffer:Buffer)
- `buffer` the pak file buffer
- Returns: File[]

### File
- name: string
- type: FileType
- size: number
- isDirectory: boolean
- data: Buffer

### FileType
- RAW = 0
- LZSS = 1
- DIRECTORY = 2
- LZSSXOR = 3

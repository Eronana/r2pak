import * as iconv from 'iconv-lite';

const defaultOptions = { fileNameEncoding: 'gbk', cacheData: false };

export interface Options {
  fileNameEncoding:string;
  cacheData:boolean;
}

export const readPakFromBuffer = (
  buffer:Buffer,
  options = defaultOptions,
) => {
  const intView = new Uint32View(buffer, buffer.length - 9);
  let fileIndexOffset = intView.get(0);
  const fileCount = intView.get(1);
  const files = Array<File>(fileCount);
  for (let i = 0; i < fileCount; i++) {
    ({
      file: files[i],
      nextOffset: fileIndexOffset,
    } = readFile(buffer, fileIndexOffset, options));
  }
  return files;
};

export enum FileType {
  RAW = 0,
  LZSS = 1,
  DIRECTORY = 2,
  LZSSXOR = 3,
}

export interface FileInfo {
  fileName:string;
  fileType:FileType;
  dataOffset:number;
  encodedSize:number;
  originalSize:number;
}

export class File {
  private buffer:Buffer;
  private fileInfo:FileInfo;
  private cache:boolean;
  private cachedData?:Buffer = undefined;

  constructor(buffer:Buffer, fileInfo:FileInfo, cache = false) {
    this.buffer = buffer.slice(
      fileInfo.dataOffset,
      fileInfo.dataOffset + fileInfo.encodedSize,
    );
    this.fileInfo = fileInfo;
    this.cache = cache;
  }

  private decode() {
    switch (this.fileInfo.fileType) {
      case FileType.LZSS:
        return LzssDecode(this.buffer, this.fileInfo.originalSize);
      case FileType.DIRECTORY:
      case FileType.RAW:
        return this.buffer;
        case FileType.LZSSXOR:
          return LzssXorDecode(this.buffer, this.fileInfo.originalSize);
      default:
        throw new Error(`unknow file type: ${this.fileInfo.fileType}`);
    }
  }

  get name() {
    return this.fileInfo.fileName
    ;
  }

  get type() {
    return this.fileInfo.fileType;
  }

  get size() {
    return this.fileInfo.originalSize;
  }

  get isDirectory() {
    return this.fileInfo.fileType === FileType.DIRECTORY;
  }

  get data() {
    let data = this.cachedData;
    if (!data) {
      data = this.decode();
      if (this.cache) {
        this.cachedData = data;
      }
    }
    return data;
  }
}

const BufferMemcpy = (
  buffer:Buffer,
  destOffset:number,
  srcOffset:number,
  length:number,
) => {
  const destView = new Uint8Array(buffer.buffer, destOffset, length);
  const srcView = new Uint8Array(buffer.buffer, srcOffset, length);
  destView.set(srcView);
};

const LzssXorDecode = (buffer:Buffer, originalSize:number) => {
  const xorData = [0xFF21, 0x834F, 0x675F, 0x0034, 0xF237, 0x815F, 0x4765, 0x0233];
  const outBuffer = new Buffer(originalSize);
  let inIdx = 0, outIdx = 0;
  let flags = 0, counter = 0;
  while (inIdx < buffer.length) {
    if (counter++ & 7) {
      flags >>= 1;
    } else {
      flags = (buffer[inIdx++] ^ 0xb4);
      if (inIdx >= buffer.length) {
        break;
      }
    }
    if (flags & 1) {
      const pair = buffer.readUInt16LE(inIdx) ^ xorData[(flags >> 3) & 7];
      const pos = pair & 0x0fff;
      const length = (pair >> 12) + 2;
      BufferMemcpy(outBuffer, outIdx, outIdx - pos, length);
      inIdx += 2;
      outIdx += length;
    } else {
      outBuffer[outIdx++] = buffer[inIdx++] ^ 0xb4;
    }
  }
  return outBuffer;
};

const LzssDecode = (buffer:Buffer, originalSize:number) => {
  const outBuffer = new Buffer(originalSize);
  let inIdx = 0, outIdx = 0;
  let flags = 0;
  while (inIdx < buffer.length) {
    if (!((flags >>= 1) & 0x100)) {
      flags = buffer[inIdx++] | 0xff00;
      if (inIdx >= buffer.length) {
        break;
      }
    }
    if (flags & 1) {
      const pair = buffer.readUInt16LE(inIdx);
      const pos = pair & 0x0fff;
      const length = (pair >> 12) + 2;
      BufferMemcpy(outBuffer, outIdx, outIdx - pos, length);
      inIdx += 2;
      outIdx += length;
    } else {
      outBuffer[outIdx++] = buffer[inIdx++];
    }
  }
  return outBuffer;
};

class Uint32View {
  private buffer:Buffer;
  private offset:number;

  constructor(buffer:Buffer, offset:number = 0) {
    this.buffer = buffer;
    this.offset = offset;
  }

  public get (idx:number = 0) {
    return this.buffer.readUInt32LE(this.offset + idx * 4);
  }

  public gets (idx:number, count?:number) {
    if (!count) {
      count = idx;
      idx = 0;
    }
    const result = Array<number>(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.get(idx++);
    }
    return result;
  }
}

interface ReadFileResult {
  file:File;
  nextOffset:number;
}

const readFile = (
  buffer:Buffer,
  offset:number,
  options = defaultOptions,
) : ReadFileResult => {
  const fileNameLength = buffer[offset];
  const fileType = buffer[offset + 1];
  const intView = new Uint32View(buffer, offset + 2);
  const [
    dataOffset,
    encodedSize,
    originalSize,
  ] = intView.gets(3);
  const fileNameOffset
    = offset  // original offset
    + 1       // file name length
    + 1       // file type
    + 4 * 3   // dataOffset, encodedSize , originalSize
    ;
  const fileNameBuffer = buffer.slice(
    fileNameOffset,
    fileNameOffset + fileNameLength,
  );
  const fileName = iconv.decode(fileNameBuffer, options.fileNameEncoding);

  const file = new File(buffer, {
    fileName,
    fileType,
    dataOffset,
    encodedSize,
    originalSize,
  }, options.cacheData);
  const nextOffset
    = fileNameOffset
    + fileNameLength
    + 1 // '\0' the end of string
    ;
  return { file, nextOffset };
};

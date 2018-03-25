import { readPakFromBuffer } from '../lib';
import { createHash } from 'crypto';

document.ondragover = function (e) {
  e.preventDefault();
  return false;
};

document.ondrop = function (e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  fileNameLabel.innerText = `File: ${file.name}`;
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = function () {
    const data = reader.result;
    loadFile(data);
  };
};

const toFileSize = (size:number) => {
  if (size < 1024) {
    return `${size}B`;
  }
  size /= 1024;
  if (size < 1024) {
    return `${size.toFixed(2)}KB`;
  }
  size /= 1024;
  if (size < 1024) {
    return `${size.toFixed(2)}MB`;
  }
  return `${size.toFixed(2)}GB`;
};

document.write('<h3>drop a pak file here.</h3>');
const fileNameLabel = document.createElement('h4');
document.body.appendChild(fileNameLabel);
const chkMd5 = document.createElement('input');
chkMd5.type = 'checkbox';
document.body.appendChild(chkMd5);
document.write('show md5 hash');

const filesDiv = document.createElement('div');
document.body.appendChild(filesDiv);

const loadFile = (buffer:ArrayBuffer) => {
  const files = readPakFromBuffer(new Buffer(buffer), {fileNameEncoding: 'gbk', cacheData: true});
  filesDiv.innerHTML = `<p>file size: ${buffer.byteLength} (${toFileSize(buffer.byteLength)})<br>`
                     + `file count: ${files.length}</p>`;
  const totalTag = document.createElement('p');
  filesDiv.appendChild(totalTag);
  const showMd5 = chkMd5.checked;
  let totalSize = 0;
  for (const file of files) {
    let fileDom;
    if (file.isDirectory) {
      fileDom = document.createElement('b');
      fileDom.innerText = `${file.name}/`;
    } else {
      totalSize += file.size;
      fileDom = document.createElement('a');
      if (showMd5) {
        const hash = createHash('md5');
        fileDom.innerText = `[${hash.update(file.data).digest('hex')}] `;
      }
      fileDom.innerText += `${file.name} (${toFileSize(file.size)})`;
      fileDom.href = 'javascript:void(0)';
      fileDom.addEventListener('click', (e) => {
        try {
          const blob = new Blob([file.data], {type: `application/octet-stream`});
          const d = document.createElement('a');
          d.download = file.name;
          d.href = URL.createObjectURL(blob);
          d.click();
        } catch (err) {
          console.error(err);
          alert(err.message);
        }
      });
    }
    const p = document.createElement('p');
    p.appendChild(fileDom);
    filesDiv.appendChild(p);
  }
  totalTag.innerText = `original size: ${totalSize} (${toFileSize(totalSize)})\n`
                     + `ratio: ${(buffer.byteLength * 100 / totalSize).toFixed(2)}%`;

};

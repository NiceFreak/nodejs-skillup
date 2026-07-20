const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'package.json');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('读取文件失败: ', err);
    return;
  }

  console.log('文件读取完成，开始注册定时器...');

  setTimeout(() => {
    console.log('setTimeout');
  }, 0);

  setImmediate(() => {
    console.log('setImmediate');
  });
});
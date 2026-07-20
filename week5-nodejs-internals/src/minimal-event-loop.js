// 请自行扩展现有 minimal-event-loop.js
// 加入一个打印 timeout 的 setTimeout(0)
// 和一个打印 immediate 的 setImmediate

console.log('start');
process.nextTick(() => console.log('nextTick'));
Promise.resolve().then(() => console.log('promise'));
setTimeout(() => {
    console.log('setTimeout');
}, 0);

setImmediate(() => {
    console.log('setImmediate');
});
console.log('end');

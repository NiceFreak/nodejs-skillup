# Week 5 · Node.js 底层原理

本目录使用仓库根目录 `.nvmrc` 中的 Node.js 版本，不需要安装第三方依赖。

D1 的首轮实验固定使用 CommonJS，先隔离观察事件循环调度。ESM 顶层执行上下文可能改变 `process.nextTick` 与 microtask 的观察顺序，基线通过后再单独对照。

## 环境准备

从仓库根目录执行：

```bash
nvm use
cd week5-nodejs-internals
node --version
```

预期 Node.js 主版本为 24。

## D1 运行入口

完成运行前预测后，普通运行：

```bash
npm run day1
```

需要修改文件后自动重跑时：

```bash
npm run day1:watch
```

核心实验代码由学习者填写在 `src/minimal-event-loop.js`；运行前先把预测写入当天笔记。

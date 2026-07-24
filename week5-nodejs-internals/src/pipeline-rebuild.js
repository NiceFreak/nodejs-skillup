// pipeline-rebuild-v2.js
// 基于“一页笔记”重建 pipeline 成功与失败路径，对照真实文件 I/O 场景

const fs = require('fs');
const path = require('path');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

// ---------- 配置 ----------
const INPUT_FILE = path.join(__dirname, 'input-rebuild.txt');
const OUTPUT_FILE = path.join(__dirname, 'output-rebuild.txt');
const FAIL_DIR = __dirname; // 用于失败路径（写入目录会报错）

// ---------- 准备输入文件 ----------
function prepareInputFile() {
    const content =
        'Hello World!\n' +
        'This is a test for pipeline rebuild.\n' +
        'abcdefghijklmnopqrstuvwxyz\n' +
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ\n' +
        '1234567890\n' +
        'Goodbye!\n';
    fs.writeFileSync(INPUT_FILE, content, 'utf8');
    console.log('[setup] 输入文件已创建:', INPUT_FILE);
}

// ---------- 大写转换 Transform ----------
function createUpperTransform() {
    return new Transform({
        transform(chunk, encoding, callback) {
            // 逐字节转换小写字母为大写（不依赖字符串，保持 Buffer 操作）
            const out = Buffer.alloc(chunk.length);
            for (let i = 0; i < chunk.length; i++) {
                const byte = chunk[i];
                out[i] = (byte >= 0x61 && byte <= 0x7a) ? byte - 0x20 : byte;
            }
            callback(null, out);
        }
    });
}

// ---------- 成功路径 ----------
async function runSuccess() {
    console.log('\n========== 成功路径 ==========');
    const readable = fs.createReadStream(INPUT_FILE);
    const writable = fs.createWriteStream(OUTPUT_FILE);
    const transform = createUpperTransform();

    // 可选事件监听，帮助观察生命周期
    readable.on('close', () => console.log('[success] Readable closed'));
    writable.on('close', () => console.log('[success] Writable closed'));
    transform.on('end', () => console.log('[success] Transform ended'));

    await pipelineAsync(readable, transform, writable);
    console.log('[success] pipeline 完成');

    // 验证数据完整性
    const inputBuf = fs.readFileSync(INPUT_FILE);
    const outputBuf = fs.readFileSync(OUTPUT_FILE);
    console.log(`[success] 输入大小: ${inputBuf.length} B, 输出大小: ${outputBuf.length} B`);
    console.log(`[success] 大小一致: ${inputBuf.length === outputBuf.length}`);

    // 逐字节比较（转大写后）
    const expected = Buffer.from(inputBuf.toString('utf8').toUpperCase(), 'utf8');
    const match = expected.equals(outputBuf);
    console.log(`[success] 内容转大写匹配: ${match}`);
}

// ---------- 失败路径（输出端错误） ----------
async function runFailure() {
    console.log('\n========== 失败路径（输出端为目录） ==========');
    const readable = fs.createReadStream(INPUT_FILE);
    const writable = fs.createWriteStream(FAIL_DIR); // 将目录作为文件路径，会触发 EISDIR
    const transform = createUpperTransform();

    readable.on('close', () => console.log('[failure] Readable closed'));
    writable.on('close', () => console.log('[failure] Writable closed'));
    transform.on('end', () => console.log('[failure] Transform ended'));

    try {
        await pipelineAsync(readable, transform, writable);
        console.log('[failure] ⚠️ pipeline 意外成功（不应发生）');
    } catch (err) {
        console.log(`[failure] ✅ 捕获错误: ${err.code} - ${err.message}`);
        // 验证资源清理（笔记中强调的“收口”）
        console.log(`[failure] Readable destroyed: ${readable.destroyed}`);
        console.log(`[failure] Transform destroyed: ${transform.destroyed}`);
        console.log(`[failure] Writable destroyed: ${writable.destroyed}`);
        // 所有流应为 true，表示已自动销毁
    }
}

// ---------- 主流程 ----------
(async function main() {
    prepareInputFile();

    await runSuccess();

    // 清理输出文件（可选，方便多次运行）
    if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

    await runFailure();

    // 清理输入文件
    if (fs.existsSync(INPUT_FILE)) fs.unlinkSync(INPUT_FILE);
    console.log('\n[cleanup] 临时文件已删除');
})().catch(console.error);

const fs = require('fs');
const path = require('path');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);

// ============ 配置 ============
const INPUT_FILE = path.join(__dirname, 'input.txt');
const OUTPUT_FILE = path.join(__dirname, 'output.txt');
const FAIL_OUTPUT = __dirname; // __dirname 是当前脚本所在的 src/ 目录，已存在

// ============ 工具：创建 ASCII 输入文件 ============
function createInputFile() {
    const content = 'Hello World!\nThis is a test file for Node.js pipeline.\n' +
        'abcdefghijklmnopqrstuvwxyz\n1234567890\nGoodbye!\n';
    fs.writeFileSync(INPUT_FILE, content, 'utf8');
    console.log(`[setup] 输入文件已创建: ${INPUT_FILE}`);
}

// ============ 辅助：创建纯大写转换 Transform ============
function createUpperTransform() {
    return new Transform({
        transform(chunk, encoding, callback) {
            const upper = Buffer.alloc(chunk.length);
            for (let i = 0; i < chunk.length; i++) {
                const byte = chunk[i];
                // a-z 字节范围 0x61-0x7a，转大写只需减去 0x20
                upper[i] = (byte >= 0x61 && byte <= 0x7a) ? byte - 0x20 : byte;
            }
            callback(null, upper);
        }
    });
}

// ============ 成功路径 ============
async function runSuccess() {
    console.log('\n========== 成功路径测试 ==========');
    const readable = fs.createReadStream(INPUT_FILE);
    const writable = fs.createWriteStream(OUTPUT_FILE);
    const transform = createUpperTransform();

    readable.on('close', () => console.log('[success] Readable close'));
    writable.on('close', () => console.log('[success] Writable close'));
    transform.on('end', () => console.log('[success] Transform end'));

    await pipelineAsync(readable, transform, writable);
    console.log('[success] pipeline 完成');

    const inputBuf = fs.readFileSync(INPUT_FILE);
    const outputBuf = fs.readFileSync(OUTPUT_FILE);
    console.log(`[success] 输入: ${inputBuf.length} 字节, 输出: ${outputBuf.length} 字节`);
    console.log(`[success] 字节数不变: ${inputBuf.length === outputBuf.length}`);

    const inputStr = inputBuf.toString('utf8');
    const outputStr = outputBuf.toString('utf8');
    console.log(`[success] 原始:\n${inputStr}`);
    console.log(`[success] 转换:\n${outputStr}`);
    console.log(`[success] 内容匹配预期: ${outputStr === inputStr.replace(/[a-z]/g, c => c.toUpperCase())}`);
}

// ============ 失败路径 ============
async function runFailure() {
    console.log('\n========== 失败路径测试 ==========');
    const readable = fs.createReadStream(INPUT_FILE);
    const writable = fs.createWriteStream(FAIL_OUTPUT); // 写入目录，触发 EISDIR
    const transform = createUpperTransform();

    readable.on('close', () => console.log('[failure] Readable close'));
    writable.on('close', () => console.log('[failure] Writable close'));
    transform.on('end', () => console.log('[failure] Transform end'));

    try {
        await pipelineAsync(readable, transform, writable);
        console.log('[failure] pipeline 意外成功（不应发生）');
    } catch (err) {
        console.log(`[failure] pipeline 错误: ${err.code} - ${err.message}`);
        console.log(`[failure] Readable destroyed: ${readable.destroyed}`);
        console.log(`[failure] Transform destroyed: ${transform.destroyed}`);
        console.log(`[failure] Writable destroyed: ${writable.destroyed}`);
    }
}

// ============ 主流程 ============
async function main() {
    createInputFile();

    await runSuccess();

    // 清理成功测试的输出文件（可选）
    // if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

    await runFailure();

    // 可选清理 input.txt
    // fs.unlinkSync(INPUT_FILE);
}

main().catch(console.error);

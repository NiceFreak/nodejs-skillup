const http = require('http');

// - `http.createServer()` 拿到的回调,参数是什么?那两个对象各自管什么?
//  回调函数的参数是 `req` 和 `res`，分别代表请求对象和响应对象
// - 你怎么把一句话"写回去"给客户端?响应结束需要做什么动作?
// res.writeHead() 可以把一句话"写回去"给客户端
// 响应结束需要调用 `res.end()` 方法来结束响应并发送数据给客户端。
// - 如果什么都不做、不结束响应,浏览器端会发生什么?(故意试一下)
// 如果什么都不做、不结束响应，浏览器端会一直等待服务器的响应，页面会一直处于加载状态，直到超时或服务器发送响应为止
// - 此刻你想根据不同 URL 返回不同内容,得自己写什么?(先别实现,只在脑子里记下这个痛点——Express 的价值马上就从这里冒出来)
// 你需要自己写路由逻辑，根据请求的 URL 来返回不同的内容, 比如我要写 /about 返回关于我们的信息, /contact 返回联系方式等
// 我需要再写两个 if/else 或 switch 语句来判断 req.url 的值, 然后根据不同的 URL 返回不同的内容

const server = http.createServer((req, res) => {
    // `Content-Type` 在每个分支里都一样,这个可以留在前面;但状态码不一样。能不能想出一种写法,让头部只发一次、但状态码是变量?
    // 答案: 可以先定义一个变量来存储状态码，然后在 switch 语句中根据不同的 URL 设置该变量的值，最后在 switch 语句结束后统一调用 res.writeHead() 方法发送响应头。这样就可以只发送一次响应头，但状态码是根据 URL 动态设置的。
    // res.writeHead(200, { 'Content-Type': 'text/plain' }); // 设置响应头，状态码为200，内容类型为纯文本
    let statusCode = 200; // 默认状态码为200
    let responseText = ''; // 响应内容
    switch (req.url) {
        case '/':
            responseText = 'Hello, World!'; // 根路径返回 "Hello, World!"
            break;
        case '/about':
            responseText = 'This is the about page.'; // /about 路径返回关于页面的信息
            break;
        case '/contact':
            responseText = 'Contact us at contact@example.com'; // /contact 路径返回联系方式信息
            break;
        default:
            statusCode = 404; // 设置状态码为404
            responseText = '404 Not Found'; // 返回404错误信息
    }
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' }); // 发送响应头
    res.end(responseText); // 结束响应
    // res.write('Response has been sent to the client.\n');
    //     node server.js
    // Server running at http://localhost:3000/
    // node:events:487
    //       throw er; // Unhandled 'error' event
    //       ^

    // Error [ERR_STREAM_WRITE_AFTER_END]: write after end
    //     at write_ (node:_http_outgoing:905:11)
    //     at ServerResponse.write (node:_http_outgoing:854:15)
    //     at Server.<anonymous> (/Users/nezha/Documents/nodejs-skillup/week2-express/src/server.js:30:9)
    //     at Server.emit (node:events:509:28)
    //     at parserOnIncoming (node:_http_server:1226:12)
    //     at HTTPParser.parserOnHeadersComplete (node:_http_common:125:17)
    // Emitted 'error' event on ServerResponse instance at:
    //     at emitErrorNt (node:_http_outgoing:877:9)
    //     at process.processTicksAndRejections (node:internal/process/task_queues:91:21) {
    //   code: 'ERR_STREAM_WRITE_AFTER_END'
    // }
});

const PORT = 3000; // 定义服务器监听的端口号
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`); // 服务器启动后输出提示信息
});

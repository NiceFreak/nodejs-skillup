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
    res.writeHead(200, { 'Content-Type': 'text/plain' }); // 设置响应头，状态码为200，内容类型为纯文本
    switch (req.url) {
        case '/':
            res.write('Welcome to the Home Page\n'); // 根路径返回欢迎信息
            break;
        case '/about':
            res.write('This is the About Page\n'); // /about 路径返回关于页面信息
            break;
        case '/contact':
            res.write('This is the Contact Page\n'); // /contact 路径返回联系方式信息
            break;
        default:
            res.write('404 Not Found\n'); // 其他路径返回404错误信息
    }
    res.end(); // 结束响应
});

const PORT = 3000; // 定义服务器监听的端口号
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`); // 服务器启动后输出提示信息
}); 

const Scan = require('./scan')
const http = require('http')
const server = http.createServer()
const Controller = require('./controller')
const controller = new Controller()
const PORT = 5090

server.on('request', async (req, res) => {
  /************  设置跨域预检，非预设范围的字段信息，则请求失败 start ************/
  // 设置请求头为允许跨域
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5080');
  // 设置服务器支持的所有头信息字段
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, Accept, X-Requested-With, sessionToken');
  // 设置服务器支持的所有跨域请求的方法
  res.setHeader('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');

  if (req.method === "OPTIONS") { // 跨域请求前浏览器先发送一次OPTIONS请求，预检字段信息是否符合预设范围内
    res.setHeader('Access-Control-Max-Age', 86400);  // 设置预检缓存，避免重复预检浪费带宽
    res.status = 200;
    res.end();
    return;
  }
  /************  设置跨域预检，非预设范围的字段信息，则请求失败 end ************/

  const url = req.url
  if (url === "/api/verify") {
    await controller.handleVerifyUpload(req, res);
    return
  }

  if (req.url === "/api/merge") {
    await controller.handleMerge(req, res);
    return;
  }

  if (req.url === "/api/upload") {
    await controller.handleFormData(req, res);
  }
})

server.listen(PORT, () => {
  console.log(`正在监听 ${PORT} 端口`)
  Scan.start()
});

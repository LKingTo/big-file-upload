const http = require('http')
const server = http.createServer()
const controller = require('./controller')

server.on('request', async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  const url = req.url
  if (url === '/api/verify') {
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

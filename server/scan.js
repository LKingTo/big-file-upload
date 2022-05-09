const fse = require('fs-extra')
const path = require('path')
const schedule = require('node-schedule')

const CHUNK_DIR = path.resolve(__dirname, '..', 'assets/chunks')

const remove = (file, stats) => {
  // 文件最后修改时间超过限期，则删除
  const now = new Date().getTime()
  const offset = now - stats.ctimeMs
  if (offset > 24 * 60 * 60 * 1000) {
    console.log('[删除文件碎片]', file)
    fse.unlinkSync(file)
  }
}

const scan = (dir, callback) => {
  const files = fse.readdirSync(dir)
  files.forEach(filename => {
    const fileDir = path.resolve(dir, filename)
    const stats = fse.statSync(fileDir)
    if (stats.isDirectory()) {
      scan(fileDir, remove)
      const dirFiles = fse.readdirSync(fileDir)
      if (!dirFiles.length) {
        fse.rmdirSync(fileDir)
      }
      return
    }
    if (callback) {
      callback(fileDir, stats)
    }
  })
}

const start = (dir = CHUNK_DIR) => {
  console.log('CHUNK_DIR', CHUNK_DIR)
  if (!fse.existsSync(dir)) {
    console.log('[扫描目录不存在]')
    return
  }
  // 每1min扫描一次
  /***
   * scheduleJob通配符用法：https://github.com/node-schedule/node-schedule
   每分钟的第30秒触发： '30 * * * * *'
   每小时的1分30秒触发 ：'30 1 * * * *'
   每天的凌晨1点1分30秒触发 ：'30 1 1 * * *'
   每月的1日1点1分30秒触发 ：'30 1 1 1 * *'
   2016年的1月1日1点1分30秒触发 ：'30 1 1 1 2016 *'
   每周1的1点1分30秒触发 ：'30 1 1 * * 1'
   ***/
  schedule.scheduleJob('0 * * * * *', function() {
    console.log('[开始扫描碎片]', new Date())
    scan(dir)
  })
}

exports.start = start

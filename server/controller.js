const fse = require('fs-extra')
const Multiparty = require('multiparty')
const path = require('path')

const UPLOAD_DIR = path.resolve(__dirname, '..', 'assets') // 大文件存储目录

const extractExt = (filename) => {
  const name = '' + filename
  return name.slice(name.lastIndexOf('.'), name.length)
}

const resolveFilePath = (filename, fileHash) => path.resolve(UPLOAD_DIR, `${fileHash}${extractExt(filename)}`)

const resolveChunkDir = fileHash => path.resolve(UPLOAD_DIR, fileHash)

const resolvePost = (req) => new Promise((resolve) => {
  let chunk = ''
  req.on('data', (data) => {
    chunk += data
  })
  req.on('end', () => {
    resolve(JSON.parse(chunk))
  })
})

const createUploadedList = async (fileHash) => {
  const chunkDir = resolveChunkDir(fileHash);
  return fse.existsSync(chunkDir) ?
    await fse.readdir(chunkDir) :
    []
}

const mergeFileChunk = async (filePath, fileHash, size) => {
  const chunkDir = path.resolve(UPLOAD_DIR, fileHash)
  const chunkPaths = fse.readdirSync(chunkDir)
  console.log('chunkPaths', chunkPaths)
  // 按切片命名索引排序
  chunkPaths.sort((a, b) => a.split('-'[1]) - b.split('-')[1])
  // 可读流导入可写流方式，合并生成文件
  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      return new Promise(resolve => {
        const writeStream = fse.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size
        })
        const readStream = fse.createReadStream(path.resolve(chunkDir, chunkPath))
        readStream.on('end', () => {
          // fse.unlinkSync(chunkPath)  // 移除切片文件
          resolve()
        })
        readStream.pipe(writeStream)
      })
    })
  )
  // fse.rmdirSync(chunkDir)  // 删除切片目录
}

class Controller {
  // 验证是否已上传\已上传切片下标
  async handleVerifyUpload (req, res) {
    const data = await resolvePost(req)
    const { filename, fileHash } = data
    const filePath = resolveFilePath(filename, fileHash)
    if (fse.existsSync(filePath)) {
      res.end(JSON.stringify({
        shouldUpload: false
      }))
    } else {
      res.end(JSON.stringify({
        shouldUpload: true,
        uploadedList: await createUploadedList(fileHash)  // 已上传的切片数组
      }))
    }
  }

  // 合并切片
  async handleMerge (req, res) {
    const data = resolvePost(req)
    const {filename, fileHash, size} = data
    const filePath = resolveFilePath(filename, fileHash)
    await mergeFileChunk(filePath, fileHash, size)
    res.end(JSON.stringify({
      message: "file merged success",
      code: 0
    }))
  }

  // 处理上传的文件切片
  async handleFormData (req, res) {
    const multiParty = new Multiparty.Form()
    multiParty.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err)
        res.status = 500
        res.end('process file chunk failed')
        return
      }
      const [chunk] = files.chunk;
      const [hash] = fields.hash; // `${fileHash}-${index}`格式
      const [fileHash] = fields.fileHash;
      const [filename] = fields.filename;
      const filePath = resolveFilePath(filename, fileHash)
      const chunkDir = resolveChunkDir(fileHash)
      if (fse.existsSync(filePath)) {
        // 文件存在直接返回
        res.end('file exist.')
        return;
      }
      if (!fse.existsSync(chunkDir)) {
        // 创建切片文件夹
        await fse.mkdir(chunkDir);
      }
      console.log("chunk.path:", chunk.path);
      // 切片移动到对应切片文件夹内
      await fse.move(chunk.path, path.resolve(chunkDir, hash));
      res.end("received file chunk");
    })
  }
}

module.exports = Controller

self.importScripts('/workers/spark-md5.min.js');

self.onmessage = e => {
  const { fileChunkList } = e.data
  const spark = new self.SparkMD5.ArrayBuffer()
  let percentage = 0, count = 0
  const loadNext = index => {
    // 通过reader读取切片内容
    const reader = new FileReader()
    reader.readAsArrayBuffer(fileChunkList[index].file)
    reader.onload = e => {
      count++
      console.log('fileArrayBuffer', e.target.result)
      // 计算每份切片的hash
      spark.append(e.target.result)
      if (count === fileChunkList.length) {
        self.postMessage({
          percentage: 100,
          hash: spark.end()  // 返回合并后的hash
        })
        self.close()  // 关闭子线程
      } else {
        percentage += 100 / fileChunkList.length
        self.postMessage({
          percentage
        })
        loadNext(count)
      }
    }
  }
  loadNext(0)
}


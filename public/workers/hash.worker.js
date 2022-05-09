self.importScripts('/workers/spark-md5.min.js');

const MAX_SIZE = 50 * 1024 * 1024

self.onmessage = e => {
  const { fileChunkList, totalSize } = e.data
  const len = fileChunkList.length
  const spark = new self.SparkMD5.ArrayBuffer()
  let percentage = 0, count = 0
  const loadNext = index => {
    // 通过reader读取切片内容
    const reader = new FileReader()
    let file = fileChunkList[index].file, shadowFile
    /******************** 大文件计算md5，采用抽样hash START *********************/
    if (totalSize > MAX_SIZE) {
      if (index !== 0 && index !== len - 1) {
        // 首尾切片取全部内容，其他切片的取首中尾三个地方各2个字节
        const m = Math.floor(file.size / 2)
        shadowFile = new Blob([file.slice(0, 2), file.slice(m, m + 2), file.slice(-2, file.size)])
      }
    }
    /******************** 大文件计算md5，采用抽样hash END *********************/
    const blob = shadowFile || file
    reader.readAsArrayBuffer(blob)
    reader.onload = e => {
      count++
      //console.log('fileArrayBuffer', e.target.result)
      // 计算每份切片的hash
      spark.append(e.target.result)
      if (count === len) {
        self.postMessage({
          percentage: 100,
          hash: spark.end()  // 返回合并后的hash
        })
        console.timeEnd('Calc_Hash')
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
  console.time('Calc_Hash')
  loadNext(0)
}


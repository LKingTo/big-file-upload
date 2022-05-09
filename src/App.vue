<template>
  <div id="app">
    <div class="controllers">
      <input type="file" :disabled="status !== Status.wait" @change="handleFileChange">
      <el-button type="primary" @click="handleUpload" :disabled="uploadDisabled">上传</el-button>
      <el-button type="primary" @click="handleResume" v-if="status === Status.pause">恢复</el-button>
      <el-button @click="handlePause" :disabled="status !== Status.uploading || !container.hash"
      >暂停
      </el-button>
    </div>
    <div class="progress">
      <div>计算文件 hash</div>
      <el-progress :percentage="toFixed(hashPercentage)"></el-progress>
      <div>总进度</div>
      <el-progress :percentage="toFixed(fakeUploadPercentage)"></el-progress>
    </div>
    <el-table :data="data">
      <el-table-column prop="hash" label="切片hash" align="center"></el-table-column>
      <el-table-column label="大小(kb)" align="center" width="120">
        <template #default="scope">
          {{ transformByte(scope.row.size) }}
        </template>
      </el-table-column>
      <el-table-column label="进度" align="center">
        <template #default="scope">
          <el-progress :percentage="scope.row.percentage" :format="percentageFormat" :status="scope.row.percentage === 100 ? 'success' : ''"></el-progress>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
<script>
const SIZE = 10 * 1024 * 1024

/**
 * 生成文件切片
 * @param file
 * @param size
 * @returns {Array<{file: {size, type}}>}
 */
function createFileChunk (file, size = SIZE) {
  const fileChunkList = []
  let current = 0
  while (current < file.size) {
    fileChunkList.push({ file: file.slice(current, current + size) })
    current += size
  }
  return fileChunkList
}
</script>
<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { verifyUpload, uploadFile, mergeChunk } from './rest'

let REQUEST_LIST = []
const Status = reactive({
  wait: 'wait',
  pause: 'pause',
  uploading: 'uploading',
})
const container = reactive({
  file: null,
  hash: '',
  worker: null,
})

const status = ref(Status.wait)
const data = ref([])
const hashPercentage = ref(0)
// 当暂停时会取消 xhr 导致进度条后退，为了避免这种情况，需要定义一个假的进度条
const fakeUploadPercentage = ref(0)

const uploadDisabled = computed(() => !container.file || [Status.pause, Status.uploading].includes(status.value))
const uploadPercentage = computed(() => {
  if (!container.file || !data.value.length) return 0
  const loaded = data.value.map(item => item.size * item.percentage).reduce((prev, cur) => prev + cur)
  return parseInt((loaded / container.file.size).toFixed(2))
})

const transformByte = val => Number((val / 1024).toFixed(0))
const toFixed = (val, digits = 2) => Number(Number(val).toFixed(digits))
const percentageFormat = (percentage) => (percentage === 100 ? '' : `${percentage}%`)
const handleFileChange = (e) => {
  const [file] = e.target.files
  if (!file) return
  console.log('file', file)
  container.file = file
}
const handleUpload = async (e) => {
  if (!container.file) return
  status.value = Status.uploading
  // 创建文件切片
  const fileChunkList = createFileChunk(container.file)
  //console.log('fileChunkList', fileChunkList)
  // 生成文件hash
  container.hash = await calcHash(fileChunkList)
  //console.log('fileHash', container.hash)
  // 根据hash验证文件是否已上传过
  const { shouldUpload, uploadedList } = await verifyUpload(container.file.name, container.hash)
  console.log('uploadedList', shouldUpload, uploadedList)
  if (!shouldUpload) {
    ElMessage.success('秒传：改文件已存在，无需上传')
    status.value = Status.wait
    return
  }
  // 开始分块上传
  data.value = fileChunkList.map(({ file }, index) => ({
    index,
    fileHash: container.hash,
    hash: container.hash + '-' + index,
    chunk: file,
    size: file.size,   // todo 利用http慢启动，动态调整每个chunk的size
    percentage: uploadedList.includes(container.hash + '-' + index) ? 100 : 0
  }))
  await uploadChunks(uploadedList)
}
const handleResume = async (e) => {
  status.value = Status.uploading
  const {uploadedList} = await verifyUpload(container.file.name, container.hash)
  data.value.forEach(chunk => (uploadedList.includes(chunk.hash) && (chunk.percentage = 100)))
  await uploadChunks(uploadedList)
}
const handlePause = () => {
  if (status.value !== Status.uploading || !container.hash) {
    return
  }
  status.value = Status.pause
  resetData()
}

function resetData () {
  REQUEST_LIST.forEach((xhr) => xhr?.abort())
  REQUEST_LIST = []
  if (container.worker) {
    container.worker.onmessage = null
  }
}

// 生成文件hash（通过spark-md5），避免阻塞交互，在worker线程处理
// todo 缓存文件hash
function calcHash (fileChunkList) {
  return new Promise(resolve => {
    container.worker = new Worker('/workers/hash.worker.js')
    container.worker.postMessage({ fileChunkList })
    container.worker.onmessage = e => {
      const { percentage, hash } = e.data
      hashPercentage.value = percentage
      if (hash) {
        resolve(hash)
      }
    }
  })
}

async function uploadChunks (uploadedList = []) {
  const promises = []
  data.value.forEach(({ hash, chunk, index }) => {
    if (uploadedList.includes(hash)) {
      return
    }
    const formData = new FormData()
    formData.append('chunk', chunk)
    formData.append('hash', hash)
    formData.append('filename', container.file.name)
    formData.append('fileHash', container.hash)
    // todo 并发请求限流
    promises.push(uploadFile({
      formData,
      onProgress: createProgressHandler(data.value[index]),
      requestList: REQUEST_LIST
    }))
  })
  await Promise.allSettled(promises)
  // 若：之前上传的切片数量 + 本次上传的切片数量 = 所有切片数量，合并切片
  if (uploadedList.length + promises.length === data.value.length) {
    await mergeChunk(container.file.name, container.hash, SIZE)
    ElMessage.success('上传成功')
    status.value = Status.wait
  }
}

function createProgressHandler(item) {
  return e => {
    const percentage = parseInt(String((e.loaded / e.total) * 100))
    percentage > item.percentage && (item.percentage = percentage)
  }
}

watch(uploadPercentage, now => {
  if (now > fakeUploadPercentage.value) {
    fakeUploadPercentage.value = now
  }
})
</script>

<style>
</style>

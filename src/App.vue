<template>
  <div id="app">
    <div class="controllers">
      <input type="file" :disabled="status !== Status.wait" @change="handleFileChange">
      <el-button type="primary" @click="handleUpload" :disabled="uploadDisabled">上传</el-button>
      <el-button type="primary" @click="handleResume" v-if="status === Status.pause">恢复</el-button>
      <el-button @click="handlePause" :disabled="status !== Status.uploading || !container.hash"
      >暂停</el-button>
    </div>
    <div class="progress">
      <div>计算文件 hash</div>
      <el-progress :percentage="hashPercentage"></el-progress>
      <div>总进度</div>
      <el-progress :percentage="fakeUploadPercentage"></el-progress>
    </div>
    <el-table :data="data">
      <el-table-column prop="hash" label="切片hash" align="center"></el-table-column>
      <el-table-column label="大小(kb)" align="center" width="120">
        <template #default="scope">
          {{transformByte(scope.row.size)}}
        </template>
      </el-table-column>
      <el-table-column label="进度" align="center">
        <template #default="scope">
          <el-progress :percentage="scope.row.percentage" status="success"></el-progress>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
<script>
  const SIZE = .5 * 1024 * 1024;
  // 生成文件切片
  function createFileChunk(file, size = SIZE) {
    const fileChunkList = []
    let current = 0
    while (current < file.size) {
      fileChunkList.push({file: file.slice(current, current + size)})
      current += size
    }
    return fileChunkList
  }
  // 生成文件hash（通过spark-md5），避免阻塞交互，在worker线程处理
  function calcHash() {
    return new Promise(resolve => {
      resolve('')
    })
  }
</script>
<script setup>
  import {ref, reactive, computed, watch} from 'vue'
  const Status = reactive({
    wait: "wait",
    pause: "pause",
    uploading: "uploading",
  })
  const container = reactive({
    file: null,
    hash: "",
    worker: null,
  })

  const status = ref(Status.wait)
  const data = ref([])
  const requestList = ref([])
  const hashPercentage = ref(0)
  // 当暂停时会取消 xhr 导致进度条后退，为了避免这种情况，需要定义一个假的进度条
  const fakeUploadPercentage = ref(0)

  const uploadDisabled = computed(() => !container.file || [Status.pause, Status.uploading].includes(status.value))
  const uploadPercentage = computed(() => {
    if (!container.file || !data.value.length) return 0;
    const loaded = data.value.map(item => item.size * item.percentage).reduce((prev, cur) => prev + cur)
    return parseInt((loaded / container.file.size).toFixed(2))
  })

  const transformByte = val => Number((val / 1024).toFixed(0));
  const handleFileChange = (e) => {
    const [file] = e.target.files;
    if (!file) return
    console.log('file', file)
    container.file = file
  }
  const handleUpload = async (e) => {
    if (!container.file) return
    status.value = Status.uploading
    // 创建文件切片
    const fileChunkList = createFileChunk(container.file)
    console.log('fileChunkList', fileChunkList)
    // 生成文件hash
    container.hash = await calcHash(fileChunkList)
  }
  const handleResume = (e) => {
    console.log(e)
  }
  const handlePause = () => {
    status.value = Status.pause
    resetData()
  }

  function resetData() {
    requestList.value.forEach((xhr) => xhr?.abort());
    requestList.value = [];
    if (container.worker) {
      container.worker.onmessage = null;
    }
    console.log('resetData')
  }

  watch(uploadPercentage, now => {
    if (now > fakeUploadPercentage.value) {
      fakeUploadPercentage.value = now
    }
  })
</script>

<style>
</style>

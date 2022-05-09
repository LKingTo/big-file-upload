const URL = 'http://localhost:5090'

function request ({
  url,
  method = 'POST',
  data,
  headers = {},
  onProgress = (e) => e,
  requestList
}) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = onProgress
    xhr.open(method, url);
    // 可设置默认请求类型，避免预检请求
    //xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    Object.keys(headers).forEach((key) =>
      xhr.setRequestHeader(key, headers[key])
    );
    xhr.send(data)
    xhr.onload = e => {
      if (requestList) {
        // 请求完成的在列表中移除
        const xhrIndex = requestList.findIndex((item) => item === xhr);
        requestList.splice(xhrIndex, 1);
      }
      resolve({
        data: e.target.response,
      });
    }
    // 记录进行中的请求，便于暴露xhr给外部执行中止请求
    requestList?.push(xhr)
  })
}

export const verifyUpload = async (filename, fileHash) => {
  const {data} = await request({
    url: `${URL}/api/verify`,
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      filename,
      fileHash,
    }),
  })
  return JSON.parse(data)
}

export const uploadFile = async ({formData, onProgress, requestList}) => {
  return request({
    url: `${URL}/api/upload`,
    /*** FormData上传，需确保不要自定义content-type，
     *    由浏览器自动添加带boundary的content-type:multipart/form-data，否则会请求失败
     ***/
    data: formData,
    onProgress,
    requestList
  })
}

export const mergeChunk = async (filename, fileHash, size) => {
  return request({
    url: `${URL}/api/merge`,
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify({ filename, fileHash, size }),
  })
}

export default {
  verifyUpload,
  uploadFile,
  mergeChunk
}

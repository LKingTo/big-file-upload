# big-file-upload

## Project setup
```
yarn install
```

### Compiles and hot-reloads for development
```
yarn serve
```

### Compiles and minifies for production
```
yarn build
```

### Lints and fixes files
```
yarn lint
```

### Customize configuration
See [Configuration Reference](https://cli.vuejs.org/config/).

### Todo List
 - 抽样hash：首尾切片取全部内容，其他切片的取首中尾三个地方各2个字节，适用于大文件的快速校验
 - 慢启动策略：根据上一个切片上传时间，调整下一个切片上传的size
 - 并发请求、重试

### 参考文献
 - [大文件的分片上传、断点续传及其相关拓展实践](https://mp.weixin.qq.com/s/vf3gbRxPR9T_xFwWuSVABg)

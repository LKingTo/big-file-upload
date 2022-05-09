module.exports = {
  devServer: {
    port: 5080,
    open: true,
    proxy: {
      '/api/': {
        target: 'http://localhost:5090/',
        ws: false
      }
    }
  }
}

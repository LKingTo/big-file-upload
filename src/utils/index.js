
/**
 * 并发请求限制
 * @param preRequestList
 * @param maxNum
 * @returns {Promise<unknown>}
 */
export const multiRequest = (preRequestList = [], maxNum) => {
  // 请求总数量
  const len = preRequestList.length;
  // 根据请求数量创建一个数组来保存请求的结果
  const result = new Array(len).fill(false);
  // 当前完成的数量
  let count = 0;

  return new Promise((resolve) => {
    // 请求maxNum个
    while (count < maxNum) {
      next();
    }
    async function next() {
      let current = count++;
      // 处理边界条件
      if (current >= len) {
        // 请求全部完成就将promise置为成功状态, 然后将result作为promise值返回
        !result.includes(false) && resolve(result);
        return;
      }
      const request = preRequestList[current];
      console.log(`开始 ${current}`, new Date().toLocaleString());
      let res
      try {
        res = await request()
      } catch (e) {
        console.log(`结束 ${current}`, new Date().toLocaleString());
        result[current] = e;
        // 请求没有全部完成, 就递归
        if (current < len) {
          next();
        }
        return
      }
      // 保存请求结果
      result[current] = res;
      console.log(`完成 ${current}`, new Date().toLocaleString());
      // 请求没有全部完成, 就递归
      if (current < len) {
        next();
      }
    }
  });
}

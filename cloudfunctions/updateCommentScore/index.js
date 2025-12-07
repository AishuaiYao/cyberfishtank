// 云函数：更新comment集合的score
// 解决权限问题和时效问题
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { fishName, action, openid, scoreChange } = event
  
  if (!fishName || !action || !openid) {
    return {
      success: false,
      error: '参数不完整'
    }
  }
  
  if (action !== 'star' && action !== 'unstar') {
    return {
      success: false,
      error: '无效的action参数'
    }
  }
  
  // 验证scoreChange参数
  const validScoreChange = scoreChange !== undefined && scoreChange !== null ? Number(scoreChange) : (action === 'star' ? 1 : -1)
  
  try {
    console.log(`开始更新comment score: ${fishName}, ${action}, ${openid}, 变化量: ${validScoreChange}`)
    
    // 1. 查询comment记录
    const commentResult = await db.collection('comment')
      .where({
        fishName: fishName
      })
      .get()
    
    if (commentResult.data.length === 0) {
      return {
        success: false,
        error: '未找到对应的comment记录'
      }
    }
    
    // 2. 获取当前score（解决时效问题）
    const comment = commentResult.data[0]
    const currentScore = comment.score || 0
    
    // 3. 计算新score（使用前端传递的正确变化量）
    const newScore = currentScore + validScoreChange
    
    console.log(`Score变化: ${currentScore} → ${newScore} (${action}, 变化量: ${validScoreChange})`)
    
    // 4. 使用原子操作更新comment记录，避免并发问题
    const updateResult = await db.collection('comment')
      .doc(comment._id)
      .update({
        data: {
          score: db.command.inc(validScoreChange), // 使用原子操作
          lastUpdateBy: openid, // 记录最后更新者
          lastUpdateTime: new Date() // 记录最后更新时间
        }
      })
    
    if (updateResult.stats.updated === 0) {
      return {
        success: false,
        error: '更新comment记录失败'
      }
    }
    
    console.log(`成功更新comment score: ${fishName}, 新score: ${newScore}`)
    
    return {
      success: true,
      message: '更新成功',
      fishName: fishName,
      oldScore: currentScore,
      newScore: newScore,
      action: action,
      updateTime: new Date().toISOString()
    }
    
  } catch (error) {
    console.error('更新comment score失败:', error)
    return {
      success: false,
      error: error.message || '未知错误'
    }
  }
}
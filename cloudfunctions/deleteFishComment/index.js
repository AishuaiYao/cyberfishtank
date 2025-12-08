// 云函数：删除comment集合中的记录
const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { fishName } = event
  
  if (!fishName) {
    return {
      success: false,
      error: '参数不完整'
    }
  }
  
  try {
    console.log(`开始删除评论: ${fishName}`)
    
    // 1. 查询comment记录
    const commentResult = await db.collection('comment')
      .where({
        fishName: fishName
      })
      .get()
    
    if (commentResult.data.length === 0) {
      return {
        success: true,
        message: '未找到对应的comment记录，无需删除'
      }
    }
    
    console.log(`找到 ${commentResult.data.length} 条评论记录`)
    
    // 2. 删除所有匹配的记录
    const deletePromises = commentResult.data.map(comment => 
      db.collection('comment').doc(comment._id).remove()
    )
    
    await Promise.all(deletePromises)
    
    console.log(`成功删除 ${commentResult.data.length} 条评论记录`)
    
    return {
      success: true,
      message: `成功删除 ${commentResult.data.length} 条评论记录`
    }
  } catch (error) {
    console.error('删除评论失败:', error)
    return {
      success: false,
      error: error.message || '删除评论失败'
    }
  }
}
// cloudfunctions/deleteFishInteractions/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { fishName } = event
  
  if (!fishName) {
    return {
      success: false,
      error: '缺少fishName参数'
    }
  }

  try {
    console.log(`开始删除鱼 ${fishName} 的所有交互记录`)
    
    const db = cloud.database()
    
    // 查询所有相关的交互记录
    const queryResult = await db.collection('interaction')
      .where({
        fishName: fishName
      })
      .get()

    console.log(`找到 ${queryResult.data.length} 条相关交互记录`)

    if (queryResult.data.length === 0) {
      console.log('没有找到相关的交互记录')
      return {
        success: true,
        deletedCount: 0,
        message: '没有找到相关的交互记录'
      }
    }

    // 批量删除所有相关交互记录
    const deletePromises = queryResult.data.map(interaction =>
      db.collection('interaction')
        .doc(interaction._id)
        .remove()
    )

    const deleteResults = await Promise.all(deletePromises)
    
    console.log(`成功删除鱼 ${fishName} 的 ${queryResult.data.length} 条交互记录`)

    return {
      success: true,
      deletedCount: queryResult.data.length,
      message: `成功删除鱼 ${fishName} 的 ${queryResult.data.length} 条交互记录`
    }
  } catch (error) {
    console.error('删除交互记录失败:', error)
    return {
      success: false,
      error: error.message,
      message: '删除交互记录失败'
    }
  }
}
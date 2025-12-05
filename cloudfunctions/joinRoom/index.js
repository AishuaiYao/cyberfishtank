// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { roomId, openid } = event

  if (!roomId || !openid) {
    return {
      success: false,
      message: '参数不完整'
    }
  }

  try {
    const db = cloud.database()
    
    // 查找并更新teamworker记录
    const result = await db.collection('drawing').where({
      roomId: roomId,
      role: 'teamworker'
    }).update({
      data: {
        uid: openid
      }
    })

    console.log('更新结果:', result)

    if (result.stats.updated > 0) {
      return {
        success: true,
        message: '成功加入房间'
      }
    } else {
      return {
        success: false,
        message: '房间不存在或已满员'
      }
    }
  } catch (error) {
    console.error('加入房间失败:', error)
    return {
      success: false,
      message: '加入房间失败: ' + error.message
    }
  }
}
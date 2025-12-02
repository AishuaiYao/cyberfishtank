const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const { content, openid } = event
  
  if (!content) {
    return {
      success: false,
      error: '缺少content参数'
    }
  }

  if (!openid) {
    return {
      success: false,
      error: '缺少openid参数'
    }
  }

  try {
    console.log(`开始校验文本内容: "${content}"`)
    
    // 使用云调用进行文本内容安全校验
    const result = await cloud.openapi.security.msgSecCheck({
      openid: openid,
      scene: 1, // 1-资料场景
      version: 2, // 固定为2
      content: content
    })

    console.log('文本安全校验结果:', result)

    // 根据校验结果返回
    const { suggest, label } = result.result || {}
    
    if (suggest === 'pass') {
      return {
        success: true,
        isSafe: true,
        suggest: suggest,
        label: label
      }
    } else {
      return {
        success: true,
        isSafe: false,
        suggest: suggest,
        label: label,
        message: suggest === 'risky' ? '内容存在风险' : '内容需要人工复核'
      }
    }

  } catch (error) {
    console.error('文本安全校验失败:', error)
    
    // 如果是权限错误，可能是云调用配置问题
    if (error.errCode === 40001 || error.errCode === -604101) {
      return {
        success: false,
        error: '权限配置错误，请检查云函数权限配置',
        errCode: error.errCode
      }
    }
    
    return {
      success: false,
      error: error.message || '校验服务异常',
      errCode: error.errCode
    }
  }
}
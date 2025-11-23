// cloudfunctions/getOpenid/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  console.log('微信上下文:', {
    OPENID: wxContext.OPENID,
    APPID: wxContext.APPID,
    UNIONID: wxContext.UNIONID
  })

  // 确保返回真实的openid
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}
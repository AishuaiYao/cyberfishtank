// updateDrawingData 云函数 - 处理协作者绘画数据更新

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  console.log('updateDrawingData云函数调用:', event);
  
  // 获取微信上下文，直接获取openid
  const wxContext = cloud.getWXContext();
  const actualUserOpenid = wxContext.OPENID;
  
  const { roomId, role, operationType, trace, color, lineWidth } = event;
  
  console.log('updateDrawingData云函数调用参数:', { 
    roomId, 
    role, 
    operationType, 
    traceLength: trace ? trace.length : 0, 
    color, 
    lineWidth,
    actualUserOpenid
  });
  
  try {
    // 验证参数
    if (!roomId || !role) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '缺少必要参数: roomId 或 role'
      };
    }
    
    const db = cloud.database();
    
    // 1. 查询房间数据
    const roomResult = await db.collection('drawing')
      .where({
        roomId: roomId,
        role: role
      })
      .get();
    
    if (roomResult.data.length === 0) {
      return {
        success: false,
        errorCode: 'ROOM_NOT_FOUND',
        message: '房间不存在或角色不匹配'
      };
    }
    
    const roomData = roomResult.data[0];
    console.log('找到房间数据:', roomData);
    
    // 2. 验证权限
    // 对于teamworker角色，验证openid是否匹配
    if (role === 'teamworker' && roomData.uid && roomData.uid !== actualUserOpenid && roomData.uid !== '') {
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '无权限更新此协作者数据'
      };
    }
    
    // 对于homeowner角色，验证openid是否匹配
    if (role === 'homeowner' && roomData.uid !== actualUserOpenid) {
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '无权限更新此房主数据'
      };
    }
    
    // 3. 如果是teamworker且uid为空，则设置uid（首次操作）
    let updateFields = {
      operationType: operationType || 'draw',
      lastUpdated: new Date()
    };
    
    // 如果提供了绘画数据，则更新
    if (trace !== undefined) {
      updateFields.trace = trace;
    }
    if (color !== undefined) {
      updateFields.color = color;
    }
    if (lineWidth !== undefined) {
      updateFields.lineWidth = lineWidth;
    }
    
    // 如果是teamworker且uid为空，则设置uid
    if (role === 'teamworker' && (!roomData.uid || roomData.uid === '')) {
      updateFields.uid = actualUserOpenid;
    }
    
    // 4. 更新房间数据（云函数在服务端运行，不受客户端权限限制）
    const updateResult = await db.collection('drawing')
      .doc(roomData._id)
      .update({
        data: updateFields
      });
    
    console.log('绘画数据更新结果:', updateResult);
    
    if (updateResult.stats.updated === 1) {
      // 5. 获取更新后的完整房间数据
      const updatedRoomResult = await db.collection('drawing')
        .doc(roomData._id)
        .get();
      
      return {
        success: true,
        message: '绘画数据更新成功',
        roomData: updatedRoomResult.data,
        roomId: roomId
      };
    } else {
      return {
        success: false,
        errorCode: 'UPDATE_FAILED',
        message: '绘画数据更新失败'
      };
    }
    
  } catch (error) {
    console.error('updateDrawingData云函数执行失败:', error);
    return {
      success: false,
      errorCode: 'SERVER_ERROR',
      message: '服务器错误: ' + error.message
    };
  }
};
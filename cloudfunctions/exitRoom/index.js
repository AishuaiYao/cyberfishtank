// exitRoom 云函数 - 处理房间退出逻辑
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { roomId, role, userOpenid } = event;
  
  console.log('exitRoom云函数调用:', { roomId, role, userOpenid });
  
  try {
    // 验证参数
    if (!roomId || !role) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '缺少必要参数: roomId 或 role'
      };
    }
    
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
        message: '房间不存在'
      };
    }
    
    const roomData = roomResult.data[0];
    console.log('找到房间数据:', roomData);
    
    // 2. 验证权限：只有房主可以更新房主数据，协作者可以更新协作者数据
    if (role === 'homeowner' && roomData.uid !== userOpenid) {
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '无权限更新房主数据'
      };
    }
    
    if (role === 'teamworker' && roomData.uid !== userOpenid) {
      return {
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: '无权限更新协作者数据'
      };
    }
    
    // 3. 更新房间数据（云函数在服务端运行，不受客户端权限限制）
    const updateResult = await db.collection('drawing')
      .doc(roomData._id)
      .update({
        data: {
          operationType: 'exit',
          lastUpdated: new Date()
        }
      });
    
    console.log('房间退出状态更新结果:', updateResult);
    
    if (updateResult.stats.updated === 1) {
      return {
        success: true,
        message: '房间退出状态更新成功',
        roomId: roomId,
        role: role
      };
    } else {
      return {
        success: false,
        errorCode: 'UPDATE_FAILED',
        message: '房间退出状态更新失败'
      };
    }
    
  } catch (error) {
    console.error('exitRoom云函数执行失败:', error);
    return {
      success: false,
      errorCode: 'SERVER_ERROR',
      message: '服务器错误: ' + error.message
    };
  }
};
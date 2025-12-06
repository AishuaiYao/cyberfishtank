// joinRoom 云函数 - 处理房间加入逻辑
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { roomId, userOpenid } = event;
  
  console.log('joinRoom云函数调用:', { roomId, userOpenid });
  
  try {
    // 验证参数
    if (!roomId || !userOpenid) {
      return {
        success: false,
        errorCode: 'INVALID_PARAMS',
        message: '缺少必要参数: roomId 或 userOpenid'
      };
    }
    
    // 1. 查询房间数据
    const roomResult = await db.collection('drawing')
      .where({
        roomId: roomId,
        role: 'teamworker'
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
    
    // 2. 检查房间是否已被占用
    if (roomData.uid && roomData.uid !== '') {
      return {
        success: false,
        errorCode: 'ROOM_OCCUPIED',
        message: '房间已被占用'
      };
    }
    
    // 3. 更新房间数据（云函数在服务端运行，不受客户端权限限制）
    const updateResult = await db.collection('drawing')
      .doc(roomData._id)
      .update({
        data: {
          uid: userOpenid,
          updateTime: new Date(),
          lastUpdated: new Date()
        }
      });
    
    console.log('房间数据更新结果:', updateResult);
    
    if (updateResult.stats.updated === 1) {
      // 4. 获取更新后的完整房间信息
      const updatedRoomResult = await db.collection('drawing')
        .doc(roomData._id)
        .get();
      
      return {
        success: true,
        message: '加入房间成功',
        roomData: updatedRoomResult.data,
        roomId: roomId
      };
    } else {
      return {
        success: false,
        errorCode: 'UPDATE_FAILED',
        message: '房间数据更新失败'
      };
    }
    
  } catch (error) {
    console.error('joinRoom云函数执行失败:', error);
    return {
      success: false,
      errorCode: 'SERVER_ERROR',
      message: '服务器错误: ' + error.message
    };
  }
};
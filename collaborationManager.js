// collaborationManager_new.js - 协作管理器
const { config } = require('./config.js');

class CollaborationManager {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.databaseManager = eventHandler.databaseManager;
    
    // 房间信息
    this.roomId = null;
    this.userRole = null; // 'homeowner' 或 'teamworker'
    
    // 监听器
    this.homeownerWatch = null;
    this.teamworkerWatch = null;
    this.pollingInterval = null;
    
    // 回调函数
    this.onDrawingOperationReceived = null;
    this.onTeammateOperationApplied = null;
    
    // 状态
    this.isInitialized = false;
    this.isWatching = false;
    
    // 房主退出检测相关
    this.isHomeownerExited = false;
    this.isTeamworkerExited = false;
  }

  // 初始化协作管理器
  async initialize(roomId, userRole) {
    try {
      console.log(`初始化协作管理器，房间: ${roomId}, 角色: ${userRole}`);

      this.roomId = roomId;
      this.userRole = userRole;

      // 根据角色设置不同的监听
      if (userRole === 'homeowner') {
        // 房主监听协作者数据变化
        await this.setupTeamworkerWatcher();

        // 初始化房主数据字段，确保有默认值
        await this.initializeDrawingData('homeowner');
      } else {
        // 协作者监听房主数据变化
        await this.setupHomeownerWatcher();

        // 初始化协作者数据字段，确保有默认值
        await this.initializeDrawingData('teamworker');
      }

      this.isInitialized = true;
      console.log(`协作管理器初始化成功，角色: ${userRole}`);
      return true;
    } catch (error) {
      console.error('协作管理器初始化失败:', error);
      return false;
    }
  }

  // 设置房主数据监听（协作者使用）
  async setupHomeownerWatcher() {
    try {
      console.log('设置房主数据监听');

      this.homeownerWatch = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: 'homeowner'
        })
        .watch({
          onChange: (snapshot) => {
            console.log('监听到房主数据变化:', snapshot);

            if (snapshot.type === 'init' && snapshot.docs && snapshot.docs.length > 0) {
              // 初始化时检查房主数据
              this.handleHomeownerData(snapshot.docs[0]);
            } else if (snapshot.docChanges && snapshot.docChanges.length > 0) {
              // 处理数据变化
              const change = snapshot.docChanges[0];
              if (change.dataType === 'update' && change.doc) {
                this.handleHomeownerData(change.doc);
              }
            }
          },
          onError: (error) => {
            console.error('房主数据监听出错:', error);
            // 监听出错，使用轮询方案
            this.startHomeownerPolling();
          }
        });

      this.isWatching = true;
      console.log('房主数据监听设置成功');
    } catch (error) {
      console.error('设置房主数据监听失败:', error);
      // 使用轮询方案
      this.startHomeownerPolling();
    }
  }

  // 设置协作者数据监听（房主使用）
  async setupTeamworkerWatcher() {
    try {
      console.log('设置协作者数据监听');

      this.teamworkerWatch = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: 'teamworker'
        })
        .watch({
          onChange: (snapshot) => {
            console.log('监听到协作者数据变化:', snapshot);

            if (snapshot.type === 'init' && snapshot.docs && snapshot.docs.length > 0) {
              // 初始化时检查协作者数据
              this.handleTeamworkerData(snapshot.docs[0]);
            } else if (snapshot.docChanges && snapshot.docChanges.length > 0) {
              // 处理数据变化
              const change = snapshot.docChanges[0];
              if (change.dataType === 'update' && change.doc) {
                this.handleTeamworkerData(change.doc);
              }
            }
          },
          onError: (error) => {
            console.error('协作者数据监听出错:', error);
            // 监听出错，使用轮询方案
            this.startTeamworkerPolling();
          }
        });

      this.isWatching = true;
      console.log('协作者数据监听设置成功');
    } catch (error) {
      console.error('设置协作者数据监听失败:', error);
      // 使用轮询方案
      this.startTeamworkerPolling();
    }
  }

  // 处理房主数据变化（协作者侧）
  handleHomeownerData(homeownerData) {
    console.log('处理房主数据:', homeownerData);

    // 优先检查operationType，特别是exit操作
    if (homeownerData.operationType) {
      if (homeownerData.operationType === 'exit' && !this.isHomeownerExited) {
        this.handleHomeownerOperationType('exit');
        return;
      }

      // 处理绘画操作同步
      this.syncOperationFromHomeowner(homeownerData);
    } else {
      // 如果没有operationType但有其他字段变化，可能是因为初始化或字段更新
      // 检查是否有trace、color或lineWidth字段，如果有，可能是绘画操作
      if (homeownerData.trace || homeownerData.color || homeownerData.lineWidth) {
        console.log('检测到房主绘画数据变化，但缺少operationType，默认为draw操作');
        // 设置默认操作类型
        homeownerData.operationType = homeownerData.color === '#FFFFFF' ? 'erase' : 'draw';
        this.syncOperationFromHomeowner(homeownerData);
      }
    }
  }

  // 处理协作者数据变化（房主侧）
  handleTeamworkerData(teamworkerData) {
    console.log('处理协作者数据:', teamworkerData);

    // 优先检查operationType，特别是exit操作
    if (teamworkerData.operationType) {
      if (teamworkerData.operationType === 'exit' && !this.isTeamworkerExited) {
        this.handleTeamworkerOperationType('exit');
        return;
      }

      // 处理绘画操作同步
      this.syncOperationFromTeamworker(teamworkerData);
    } else {
      // 如果没有operationType但有其他字段变化，可能是因为初始化或字段更新
      // 检查是否有trace、color或lineWidth字段，如果有，可能是绘画操作
      if (teamworkerData.trace || teamworkerData.color || teamworkerData.lineWidth) {
        console.log('检测到协作者绘画数据变化，但缺少operationType，默认为draw操作');
        // 设置默认操作类型
        teamworkerData.operationType = teamworkerData.color === '#FFFFFF' ? 'erase' : 'draw';
        this.syncOperationFromTeamworker(teamworkerData);
      }
    }
  }

  // 处理房主操作类型（协作者侧）
  handleHomeownerOperationType(operationType) {
    console.log(`房主操作类型: ${operationType}`);

    if (operationType === 'exit' && !this.isHomeownerExited) {
      console.log('检测到房主退出');
      this.isHomeownerExited = true;

      // 通知协作者处理房主退出
      if (this.eventHandler && this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.team) {
        this.eventHandler.touchHandlers.team.handleHomeownerExit();
      }
    }
  }

  // 处理协作者操作类型（房主侧）
  handleTeamworkerOperationType(operationType) {
    console.log(`协作者操作类型: ${operationType}`);

    if (operationType === 'exit' && !this.isTeamworkerExited) {
      console.log('检测到协作者退出');
      this.isTeamworkerExited = true;

      // 房主处理协作者退出
      if (this.eventHandler && this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.team) {
        this.eventHandler.touchHandlers.team.handleTeamworkerExit();
      }
    }
  }

  // 启动房主数据轮询（协作者使用）
  startHomeownerPolling() {
    console.log('启动房主数据轮询');

    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.databaseManager.cloudDb
          .collection('drawing')
          .where({
            roomId: this.roomId,
            role: 'homeowner'
          })
          .get();

        if (result.data && result.data.length > 0) {
          console.log('轮询获取到房主数据:', result.data[0]);
          this.handleHomeownerData(result.data[0]);
        }
      } catch (error) {
        console.error('轮询房主数据失败:', error);
      }
    }, 2000); // 缩短轮询间隔
  }

  // 启动协作者数据轮询（房主使用）
  startTeamworkerPolling() {
    console.log('启动协作者数据轮询');

    this.pollingInterval = setInterval(async () => {
      try {
        const result = await this.databaseManager.cloudDb
          .collection('drawing')
          .where({
            roomId: this.roomId,
            role: 'teamworker'
          })
          .get();

        if (result.data && result.data.length > 0) {
          console.log('轮询获取到协作者数据:', result.data[0]);
          this.handleTeamworkerData(result.data[0]);
        }
      } catch (error) {
        console.error('轮询协作者数据失败:', error);
      }
    }, 2000); // 缩短轮询间隔
  }

  // 停止所有监听
  stop() {
    console.log('停止协作管理器');

    // 停止数据库监听
    if (this.homeownerWatch) {
      this.homeownerWatch.close();
      this.homeownerWatch = null;
    }

    if (this.teamworkerWatch) {
      this.teamworkerWatch.close();
      this.teamworkerWatch = null;
    }

    // 停止轮询
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.isWatching = false;
    console.log('协作管理器已停止');
  }

  // 记录操作（房主使用）
  async recordOperation(operationType, trace, color, lineWidth) {
    if (!this.isInitialized || this.userRole !== 'homeowner') {
      console.warn('房主记录操作失败：未初始化或角色不匹配', {
        isInitialized: this.isInitialized,
        userRole: this.userRole
      });
      return false;
    }

    try {
      console.log('房主记录操作:', {
        operationType,
        traceLength: trace ? trace.length : 0,
        color,
        lineWidth,
        roomId: this.roomId
      });

      const success = await this.databaseManager.updateDrawingData(
        this.roomId,
        'homeowner',
        {
          operationType: operationType,
          trace: trace || [],
          color: color || '#000000',
          lineWidth: lineWidth || 2,
          lastUpdated: new Date(),
          role: 'homeowner', // 添加角色标识
          userRole: this.userRole // 添加当前用户角色
        }
      );

      if (success) {
        console.log('房主操作记录成功');
      } else {
        console.error('房主操作记录失败');
      }

      return success;
    } catch (error) {
      console.error('记录房主操作失败:', error);
      return false;
    }
  }

  // 记录操作（协作者使用）
  async recordTeamworkerOperation(operationType, trace, color, lineWidth) {
    if (!this.isInitialized || this.userRole !== 'teamworker') {
      console.warn('协作者记录操作失败：未初始化或角色不匹配', {
        isInitialized: this.isInitialized,
        userRole: this.userRole
      });
      return false;
    }

    try {
      console.log('协作者记录操作:', {
        operationType,
        traceLength: trace ? trace.length : 0,
        color,
        lineWidth,
        roomId: this.roomId
      });

      const success = await this.databaseManager.updateDrawingData(
        this.roomId,
        'teamworker',
        {
          operationType: operationType,
          trace: trace || [],
          color: color || '#000000',
          lineWidth: lineWidth || 2,
          lastUpdated: new Date(),
          role: 'teamworker', // 添加角色标识
          userRole: this.userRole // 添加当前用户角色
        }
      );

      if (success) {
        console.log('协作者操作记录成功');
      } else {
        console.error('协作者操作记录失败');
      }

      return success;
    } catch (error) {
      console.error('记录协作者操作失败:', error);
      return false;
    }
  }

  // 同步房主操作到协作者画布
  syncOperationFromHomeowner(homeownerData) {
    console.log('开始同步房主操作:', homeownerData);

    if (!this.eventHandler || !this.eventHandler.touchHandlers || !this.eventHandler.touchHandlers.main) {
      console.error('无法同步操作：缺少必要的事件处理器');
      return;
    }

    const operationType = homeownerData.operationType;
    const trace = homeownerData.trace || [];
    const color = homeownerData.color || '#000000';
    const lineWidth = homeownerData.lineWidth || 2;
    const role = homeownerData.role || 'homeowner'; // 从数据中获取角色，默认为homeowner

    console.log(`准备同步房主操作: ${operationType}, 轨迹点数: ${trace.length}, 颜色: ${color}, 线宽: ${lineWidth}, 角色: ${role}`);

    switch (operationType) {
      case 'draw':
        this.renderDrawOperation(trace, color, lineWidth, role);
        console.log('房主绘制操作同步完成');
        break;
      case 'erase':
        this.renderEraseOperation(trace, lineWidth, role);
        console.log('房主擦除操作同步完成');
        break;
      case 'undo':
        this.renderUndoOperation(role);
        console.log('房主撤销操作同步完成');
        break;
      case 'flip':
        this.renderFlipOperation(role);
        console.log('房主翻转操作同步完成');
        break;
      default:
        console.warn('未知的房主操作类型:', operationType);
    }
  }

  // 同步协作者操作到房主画布
  syncOperationFromTeamworker(teamworkerData) {
    console.log('开始同步协作者操作:', teamworkerData);

    if (!this.eventHandler || !this.eventHandler.touchHandlers || !this.eventHandler.touchHandlers.main) {
      console.error('无法同步操作：缺少必要的事件处理器');
      return;
    }

    const operationType = teamworkerData.operationType;
    const trace = teamworkerData.trace || [];
    const color = teamworkerData.color || '#000000';
    const lineWidth = teamworkerData.lineWidth || 2;
    const role = teamworkerData.role || 'teamworker'; // 从数据中获取角色，默认为teamworker

    console.log(`准备同步协作者操作: ${operationType}, 轨迹点数: ${trace.length}, 颜色: ${color}, 线宽: ${lineWidth}, 角色: ${role}`);

    switch (operationType) {
      case 'draw':
        this.renderDrawOperation(trace, color, lineWidth, role);
        console.log('协作者绘制操作同步完成');
        break;
      case 'erase':
        this.renderEraseOperation(trace, lineWidth, role);
        console.log('协作者擦除操作同步完成');
        break;
      case 'undo':
        this.renderUndoOperation(role);
        console.log('协作者撤销操作同步完成');
        break;
      case 'flip':
        this.renderFlipOperation(role);
        console.log('协作者翻转操作同步完成');
        break;
      default:
        console.warn('未知的协作者操作类型:', operationType);
    }
  }

  // 渲染绘制操作
  renderDrawOperation(trace, color, lineWidth, role) {
    if (!trace || trace.length < 2) {
      console.warn('无效的绘制轨迹数据');
      return;
    }

    const gameState = this.eventHandler.gameState;
    const ctx = this.eventHandler.canvas.getContext('2d');
    const positions = require('./config.js').getAreaPositions();
    const drawingAreaY = positions.drawingAreaY;

    // 保存当前绘图状态
    ctx.save();

    // 开始绘制路径
    ctx.beginPath();
    ctx.moveTo(trace[0].x, trace[0].y);

    for (let i = 1; i < trace.length; i++) {
      ctx.lineTo(trace[i].x, trace[i].y);
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 恢复绘图状态
    ctx.restore();

    // 创建包含角色信息的路径对象
    const pathObject = {
      points: [...trace],
      color: color,
      size: lineWidth,
      isEraser: false,
      id: Date.now() + Math.random(), // 添加唯一ID
      timestamp: Date.now(),
      role: role, // 添加角色信息
      operationType: 'draw'
    };

    // 将路径添加到游戏状态中（用于撤销等操作）
    gameState.drawingPaths.push(pathObject);

    // 同时添加到对应角色的历史栈
    gameState.addOperationToRoleHistory(role, pathObject);

    console.log(`已渲染${role}绘制操作，${trace.length}个点`);
  }

  // 渲染擦除操作
  renderEraseOperation(trace, lineWidth, role) {
    if (!trace || trace.length < 2) {
      console.warn('无效的擦除轨迹数据');
      return;
    }

    const gameState = this.eventHandler.gameState;
    const ctx = this.eventHandler.canvas.getContext('2d');
    const positions = require('./config.js').getAreaPositions();
    const drawingAreaY = positions.drawingAreaY;

    // 保存当前绘图状态
    ctx.save();

    // 开始擦除路径
    ctx.beginPath();
    ctx.moveTo(trace[0].x, trace[0].y);

    for (let i = 1; i < trace.length; i++) {
      ctx.lineTo(trace[i].x, trace[i].y);
    }

    ctx.strokeStyle = '#FFFFFF'; // 擦除使用白色
    ctx.lineWidth = lineWidth * 2; // 擦除线宽稍大
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 恢复绘图状态
    ctx.restore();

    // 创建包含角色信息的路径对象
    const pathObject = {
      points: [...trace],
      color: '#FFFFFF',
      size: lineWidth * 2,
      isEraser: true,
      id: Date.now() + Math.random(), // 添加唯一ID
      timestamp: Date.now(),
      role: role, // 添加角色信息
      operationType: 'erase'
    };

    // 将擦除路径添加到游戏状态中
    gameState.drawingPaths.push(pathObject);

    // 同时添加到对应角色的历史栈
    gameState.addOperationToRoleHistory(role, pathObject);

    console.log(`已渲染${role}擦除操作，${trace.length}个点`);
  }

  // 渲染撤销操作
  renderUndoOperation(sourceRole) {
    const gameState = this.eventHandler.gameState;

    // 如果没有明确指定来源角色，则使用对方角色（因为这是接收对方的撤销操作）
    const roleToUndo = sourceRole || (this.userRole === 'homeowner' ? 'teamworker' : 'homeowner');

    // 确认指定角色是否有操作可撤销
    if (gameState.getOperationCountByRole(roleToUndo) === 0) {
      console.warn(`${roleToUndo}没有可撤销的操作`);
      return;
    }

    // 执行基于角色的撤销
    const success = gameState.undoByRole(roleToUndo);

    if (success) {
      console.log(`已同步${roleToUndo}的撤销操作`);

      // 修复：使用与主触摸处理器相同的重绘方法，确保一致性
      if (this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.main) {
        this.eventHandler.touchHandlers.main.redrawCanvasAfterUndo();
      } else {
        // 备用方案：使用自己的重绘方法
        this.redrawCanvas();
      }
    } else {
      console.warn(`${roleToUndo}撤销操作失败`);
    }
  }

  // 新增：渲染翻转操作
  renderFlipOperation(sourceRole) {
    const gameState = this.eventHandler.gameState;
    
    console.log(`开始同步${sourceRole}的翻转操作`);

    // 检查是否有可翻转的路径
    if (gameState.drawingPaths.length === 0) {
      console.warn(`${sourceRole}尝试翻转，但画布为空`);
      return;
    }

    // 执行翻转操作
    const success = gameState.flipCanvas();

    if (success) {
      console.log(`已同步${sourceRole}的翻转操作`);

      // 重新绘制整个界面（包括翻转后的路径）
      if (this.eventHandler.uiManager) {
        this.eventHandler.uiManager.drawGameUI(gameState);
      } else {
        this.redrawCanvas();
      }
    } else {
      console.warn(`${sourceRole}翻转操作失败`);
    }
  }

  // 重绘画布
  redrawCanvas() {
    const gameState = this.eventHandler.gameState;
    const ctx = this.eventHandler.canvas.getContext('2d');

    // 通过UIManager重新绘制整个UI，确保背景和所有元素都正确显示
    if (this.eventHandler.uiManager) {
      this.eventHandler.uiManager.drawGameUI(gameState);
    } else {
      // 备用方案：直接重绘画布
      const positions = require('./config.js').getAreaPositions();
      const drawingAreaY = positions.drawingAreaY;

      // 清除绘画区域
      ctx.clearRect(12, drawingAreaY, require('./config.js').config.screenWidth - 24, require('./config.js').config.drawingAreaHeight);

      // 重新绘制所有路径
      gameState.drawingPaths.forEach(path => {
        if (path.points && path.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(path.points[0].x, path.points[0].y);

          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }

          ctx.strokeStyle = path.color;
          ctx.lineWidth = path.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          
          // 调试输出：显示绘制的路径信息
          if (path.role) {
            console.log(`重绘${path.role}的路径，颜色: ${path.color}, 点数: ${path.points.length}, 操作ID: ${path.id || '无ID'}`);
          }
        }
      });
    }
  }

  // 初始化绘画数据，确保有默认值
  async initializeDrawingData(role) {
    try {
      console.log(`初始化 ${role} 绘画数据`);

      // 检查记录是否存在
      const result = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: role
        })
        .get();

      if (result.data.length === 0) {
        console.warn(`未找到房间 ${this.roomId} 角色 ${role} 的数据`);
        return false;
      }

      // 初始化字段，确保有默认值
      const docId = result.data[0]._id;
      await this.databaseManager.cloudDb
        .collection('drawing')
        .doc(docId)
        .update({
          data: {
            operationType: 'draw', // 默认操作类型
            trace: [], // 默认空轨迹
            color: '#000000', // 默认黑色
            lineWidth: 2, // 默认线宽
            lastUpdated: new Date()
          }
        });

      console.log(`${role} 绘画数据初始化成功`);
      return true;
    } catch (error) {
      console.error(`初始化 ${role} 绘画数据失败:`, error);
      return false;
    }
  }

  // 优化路径传输
  optimizePathTransmission(trace) {
    // 简单的路径优化，可以根据需要扩展
    if (!trace || trace.length < 3) {
      return trace;
    }

    // 这里可以添加更复杂的路径优化算法
    // 例如：Douglas-Peucker算法等

    return trace;
  }
}

module.exports = CollaborationManager;
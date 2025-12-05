// collaborationManager.js - 多人协作绘画实时同步核心模块
const Utils = require('./utils.js');

class CollaborationManager {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.databaseManager = eventHandler.databaseManager;
    this.gameState = eventHandler.gameState;
    
    // 角色标识
    this.userRole = null; // 'homeowner' 或 'teamworker'
    this.roomId = null;
    this.userOpenid = null;
    
    // 同步相关状态
    this.isInitialized = false;
    this.isMonitoring = false;
    this.watchInstance = null;
    
    // 操作序列号管理
    this.operationSequence = 0;
    this.lastSyncedSequence = 0;
    
    // 操作缓冲和批处理
    this.operationBuffer = [];
    this.batchSize = 5;
    this.batchInterval = 500; // 500ms
    this.batchTimer = null;
    
    // 网络延迟补偿
    this.networkLatency = 100; // 默认估计延迟100ms
    this.latencyBuffer = [];
    
    // 冲突解决
    this.pendingOperations = new Map(); // key: sequence, value: operation
    this.approvedOperations = new Map(); // key: sequence, value: operation
    
    // 网络质量监测
    this.networkQualityTimer = null;
    
    // 回调函数
    this.onDrawingOperationReceived = null;
    this.onTeammateOperationApplied = null;
    this.onSynchronizationComplete = null;
    
    console.log('协作管理器初始化完成');
  }

  // 初始化协作会话
  async initialize(roomId, userRole) {
    try {
      console.log(`初始化协作会话，房间ID: ${roomId}, 角色: ${userRole}`);
      
      this.roomId = roomId;
      this.userRole = userRole;
      this.userOpenid = await this.eventHandler.getRealUserOpenid();
      
      // 重置状态
      this.operationSequence = 0;
      this.lastSyncedSequence = 0;
      this.operationBuffer = [];
      this.pendingOperations.clear();
      this.approvedOperations.clear();
      
      // 获取当前绘画状态
      await this.loadCurrentDrawingState();
      
      // 启动网络质量监测
      this.startNetworkQualityMonitoring();
      
      // 根据角色设置不同的监听
      if (this.userRole === 'teamworker') {
        // 作为协作者，监听房主的操作
        await this.startMonitoringHomeownerOperations();
        
        // 初始化时同步一次房主状态
        await this.syncHomeownerState();
      } else if (this.userRole === 'homeowner') {
        // 作为房主，监听协作者的操作
        await this.startMonitoringTeamworkerOperations();
      }
      
      this.isInitialized = true;
      console.log(`协作会话初始化完成，角色: ${this.userRole}`);
      
      return true;
    } catch (error) {
      console.error('初始化协作会话失败:', error);
      return false;
    }
  }

  // 新增：协作者同步房主状态
  async syncHomeownerState() {
    try {
      console.log('协作者同步房主状态');
      
      // 获取房主的绘画数据
      const homeownerData = await this.databaseManager.getDrawingData(this.roomId, 'homeowner');
      
      if (homeownerData) {
        console.log('获取到房主绘画数据，开始同步');
        
        // 更新本地游戏状态
        if (homeownerData.drawingPaths && Array.isArray(homeownerData.drawingPaths)) {
          // 更新绘画路径
          this.gameState.drawingPaths = [...homeownerData.drawingPaths];
          
          // 完整重绘画布
          this.redrawEntireCanvas(homeownerData.drawingPaths);
        }
        
        // 更新绘制设置
        if (homeownerData.color) {
          this.gameState.currentColor = homeownerData.color;
          this.gameState.isEraser = homeownerData.color === '#FFFFFF';
        }
        
        if (homeownerData.lineWidth) {
          this.gameState.brushSize = homeownerData.lineWidth;
        }
        
        // 更新序列号
        this.lastSyncedSequence = homeownerData.sequence || 0;
        
        // 触发界面重绘
        if (this.eventHandler.uiManager) {
          this.eventHandler.uiManager.drawGameUI(this.gameState);
        }
        
        console.log('房主状态同步完成');
      } else {
        console.warn('未找到房主绘画数据');
      }
    } catch (error) {
      console.error('同步房主状态失败:', error);
    }
  }

  // 加载当前绘画状态
  async loadCurrentDrawingState() {
    try {
      console.log('加载当前绘画状态');
      
      const result = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: this.userRole
        })
        .get();
      
      if (result.data.length > 0) {
        const drawingData = result.data[0];
        
        // 恢复序列号
        this.operationSequence = drawingData.sequence || 0;
        this.lastSyncedSequence = this.operationSequence;
        
        // 恢复绘画路径（仅恢复路径数据，不进行渲染，因为绘画内容已经在界面上）
        if (drawingData.drawingPaths && drawingData.drawingPaths.length > 0) {
          console.log(`加载到 ${drawingData.drawingPaths.length} 条绘画路径`);
          
          // 将保存的路径同步到gameState（但不触发重绘，因为界面已显示）
          this.gameState.drawingPaths = drawingData.drawingPaths;
        }
      }
      
      console.log('绘画状态加载完成');
    } catch (error) {
      console.error('加载绘画状态失败:', error);
    }
  }

  // 协作者角色：记录操作并同步到数据库
  async recordTeamworkerOperation(operationType, trace = null, color = null, lineWidth = null) {
    if (!this.isInitialized || this.userRole !== 'teamworker') {
      return false;
    }
    
    try {
      // 生成新的序列号
      this.operationSequence += 1;
      const sequence = this.operationSequence;
      
      // 应用网络延迟补偿
      const networkCompensatedTimestamp = Date.now();
      
      // 构建操作对象
      const operation = {
        sequence: sequence,
        timestamp: networkCompensatedTimestamp,
        operationType: operationType,
        trace: trace,
        color: color,
        lineWidth: lineWidth
      };
      
      // 验证操作完整性
      const validation = this.validateOperation(operation);
      if (!validation.valid) {
        console.error('协作者操作验证失败:', validation.reason);
        return false;
      }
      
      // 添加到待处理操作
      this.pendingOperations.set(sequence, operation);
      
      console.log(`协作者记录操作 ${sequence}: ${operationType}`, {
        traceLength: trace ? trace.length : 0,
        color,
        lineWidth
      });
      
      // 使用智能批处理
      this.smartBatchOperation(operation);
      
      return true;
    } catch (error) {
      console.error('协作者记录操作失败:', error);
      return false;
    }
  }

  // 房主角色：记录操作并同步到数据库
  async recordOperation(operationType, trace = null, color = null, lineWidth = null) {
    if (!this.isInitialized || this.userRole !== 'homeowner') {
      return false;
    }
    
    try {
      // 生成新的序列号
      this.operationSequence += 1;
      const sequence = this.operationSequence;
      
      // 应用网络延迟补偿
      const networkCompensatedTimestamp = Date.now();
      
      // 构建操作对象
      const operation = {
        sequence: sequence,
        timestamp: networkCompensatedTimestamp,
        operationType: operationType,
        trace: trace,
        color: color,
        lineWidth: lineWidth
      };
      
      // 验证操作完整性
      const validation = this.validateOperation(operation);
      if (!validation.valid) {
        console.error('操作验证失败:', validation.reason);
        return false;
      }
      
      // 添加到待处理操作
      this.pendingOperations.set(sequence, operation);
      
      console.log(`记录操作 ${sequence}: ${operationType}`, {
        traceLength: trace ? trace.length : 0,
        color,
        lineWidth
      });
      
      // 使用智能批处理
      this.smartBatchOperation(operation);
      
      return true;
    } catch (error) {
      console.error('记录操作失败:', error);
      return false;
    }
  }

  // 批处理：将缓冲区中的操作同步到数据库
  async flushOperationBatch() {
    if (this.operationBuffer.length === 0) {
      return;
    }
    
    try {
      // 获取当前缓冲区中的所有操作
      const operations = [...this.operationBuffer];
      this.operationBuffer = [];
      
      // 清除批处理定时器
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
      
      // 根据用户角色确定要更新的记录
      const role = this.userRole; // 'homeowner' 或 'teamworker'
      
      // 获取当前数据库记录并检测冲突
      const result = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: role
        })
        .get();
      
      if (result.data.length === 0) {
        console.error(`未找到${role}绘画记录`);
        // 出错时，将操作重新放回缓冲区
        this.operationBuffer.unshift(...operations);
        return;
      }
      
      const record = result.data[0];
      const dbSequence = record.sequence || 0;
      
      // 检测序列号冲突
      const conflictDetected = this.detectSequenceConflict(operations, dbSequence);
      
      if (conflictDetected) {
        console.warn('检测到序列号冲突，执行冲突解决');
        await this.resolveSequenceConflict(record, operations);
        return;
      }
      
      // 构建更新数据，确保使用最新的序列号
      const latestOperation = operations[operations.length - 1];
      const updateData = {
        sequence: latestOperation.sequence,
        lastUpdated: new Date(),
        operationType: latestOperation.operationType,
        color: latestOperation.color,
        lineWidth: latestOperation.lineWidth,
        // 对于trace，只保存最新的完整路径
        trace: latestOperation.trace || null
      };
      
      // 同步绘画路径（完整路径）
      if (this.gameState.drawingPaths.length > 0) {
        updateData.drawingPaths = this.gameState.drawingPaths;
      }
      
      // 执行数据库更新
      const updateResult = await this.databaseManager.cloudDb
        .collection('drawing')
        .doc(record._id)
        .update({
          data: updateData
        });
      
      if (updateResult.stats.updated > 0) {
        // 标记操作已批准
        operations.forEach(op => {
          this.pendingOperations.delete(op.sequence);
          this.approvedOperations.set(op.sequence, op);
          this.lastSyncedSequence = Math.max(this.lastSyncedSequence, op.sequence);
        });
        
        console.log(`成功同步 ${operations.length} 个${role}操作到数据库，序列号: ${latestOperation.sequence}`);
      } else {
        // 更新失败，将操作重新放回缓冲区
        console.warn('数据库更新失败，操作将重新排队');
        this.operationBuffer.unshift(...operations);
      }
      
    } catch (error) {
      console.error('批处理操作失败:', error);
      
      // 出错时，将操作重新放回缓冲区，稍后重试
      this.operationBuffer.unshift(...this.operationBuffer);
    }
  }

  // 检测序列号冲突
  detectSequenceConflict(operations, dbSequence) {
    if (operations.length === 0) {
      return false;
    }
    
    // 如果缓冲区中最小的序列号小于或等于数据库中的序列号，则存在冲突
    const minBufferSequence = Math.min(...operations.map(op => op.sequence));
    
    if (minBufferSequence <= dbSequence) {
      console.warn(`检测到序列号冲突: 缓冲区最小序列号=${minBufferSequence}, 数据库序列号=${dbSequence}`);
      return true;
    }
    
    return false;
  }

  // 解决序列号冲突
  async resolveSequenceConflict(homeownerRecord, operations) {
    console.log('开始解决序列号冲突');
    
    try {
      // 重新获取最新的数据库状态
      const freshResult = await this.databaseManager.cloudDb
        .collection('drawing')
        .doc(homeownerRecord._id)
        .get();
      
      if (!freshResult.data) {
        console.error('无法获取最新数据库状态');
        return;
      }
      
      const latestData = freshResult.data;
      const latestSequence = latestData.sequence || 0;
      
      // 调整本地序列号，确保所有操作都使用新的序列号
      operations.forEach((op, index) => {
        const newSequence = latestSequence + index + 1;
        console.log(`调整操作序列号: ${op.sequence} -> ${newSequence}`);
        
        // 更新序列号
        op.sequence = newSequence;
        
        // 更新操作映射
        this.pendingOperations.delete(op.sequence); // 删除旧序列号
        this.pendingOperations.set(newSequence, op); // 添加新序列号
      });
      
      // 更新本地序列号
      this.operationSequence = latestSequence + operations.length;
      
      // 将操作重新放回缓冲区，稍后重试
      this.operationBuffer.unshift(...operations);
      
      // 如果存在数据库中的绘画路径，同步到本地
      if (latestData.drawingPaths && Array.isArray(latestData.drawingPaths)) {
        console.log('同步数据库中的绘画路径到本地');
        this.gameState.drawingPaths = [...latestData.drawingPaths];
        
        // 触发界面重绘
        if (this.eventHandler.uiManager) {
          this.eventHandler.uiManager.drawGameUI(this.gameState);
        }
      }
      
      console.log(`序列号冲突解决完成，新序列号范围: ${latestSequence + 1} - ${this.operationSequence}`);
      
    } catch (error) {
      console.error('解决序列号冲突失败:', error);
      
      // 解决失败，将操作重新放回缓冲区
      this.operationBuffer.unshift(...operations);
    }
  }

  // 验证操作完整性
  validateOperation(operation) {
    if (!operation || typeof operation !== 'object') {
      return { valid: false, reason: '操作对象无效' };
    }
    
    if (!operation.sequence || typeof operation.sequence !== 'number') {
      return { valid: false, reason: '操作序列号无效' };
    }
    
    if (!operation.operationType || typeof operation.operationType !== 'string') {
      return { valid: false, reason: '操作类型无效' };
    }
    
    if (!operation.timestamp || typeof operation.timestamp !== 'number') {
      return { valid: false, reason: '操作时间戳无效' };
    }
    
    // 对于绘制操作，验证路径数据
    if (operation.operationType.includes('draw') && operation.trace) {
      if (!Array.isArray(operation.trace) || operation.trace.length === 0) {
        return { valid: false, reason: '绘制操作的路径数据无效' };
      }
      
      // 验证路径点
      for (const point of operation.trace) {
        if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
          return { valid: false, reason: '路径点坐标无效' };
        }
      }
    }
    
    return { valid: true };
  }

  // 协作者角色：开始监听房主操作
  async startMonitoringHomeownerOperations() {
    if (this.isMonitoring) {
      return;
    }
    
    try {
      console.log(`开始监听房间 ${this.roomId} 的房主操作`);
      
      this.watchInstance = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: 'homeowner'
        })
        .watch({
          onChange: (snapshot) => {
            this.handleHomeownerOperationChange(snapshot);
          },
          onError: (error) => {
            console.error('监听房主操作出错:', error);
            
            // 出错时，使用轮询作为备选方案
            setTimeout(() => {
              this.startPollingHomeownerOperations();
            }, 1000);
          }
        });
      
      this.isMonitoring = true;
      console.log('房主操作监听已启动');
    } catch (error) {
      console.error('启动房主操作监听失败:', error);
      
      // 使用轮询作为备选方案
      this.startPollingHomeownerOperations();
    }
  }

  // 备选方案：轮询房主操作
  startPollingHomeownerOperations() {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    console.log('使用轮询方案监听房主操作');
    
    // 每500ms检查一次
    const pollingInterval = setInterval(async () => {
      try {
        const result = await this.databaseManager.cloudDb
          .collection('drawing')
          .where({
            roomId: this.roomId,
            role: 'homeowner'
          })
          .get();
        
        if (result.data.length > 0) {
          const homeownerData = result.data[0];
          const currentSequence = homeownerData.sequence || 0;
          
          // 如果有新操作
          if (currentSequence > this.lastSyncedSequence) {
            this.handleHomeownerData(homeownerData);
          }
        }
      } catch (error) {
        console.error('轮询房主操作出错:', error);
      }
    }, 500);
    
    // 保存轮询ID，以便停止
    this.pollingInterval = pollingInterval;
  }

  // 处理房主操作变化
  handleHomeownerOperationChange(snapshot) {
    try {
      if (snapshot.type === 'update' && snapshot.updated && snapshot.updated.length > 0) {
        const homeownerData = snapshot.updated[0];
        this.handleHomeownerData(homeownerData);
      } else if (snapshot.docs && snapshot.docs.length > 0) {
        const homeownerData = snapshot.docs[0];
        this.handleHomeownerData(homeownerData);
      }
    } catch (error) {
      console.error('处理房主操作变化失败:', error);
    }
  }

  // 处理房主数据更新
  handleHomeownerData(homeownerData) {
    try {
      const currentSequence = homeownerData.sequence || 0;
      
      console.log(`收到房主操作更新，序列号: ${currentSequence}, 上次同步序列号: ${this.lastSyncedSequence}`);
      
      // 首先检查operationType，特别是exit操作
      if (homeownerData.operationType) {
        this.handleOperationType(homeownerData);
        
        // 如果是exit操作，直接返回，不进行其他同步操作
        if (homeownerData.operationType === 'exit') {
          return;
        }
      }
      
      // 处理绘画路径变化
      if (homeownerData.drawingPaths && Array.isArray(homeownerData.drawingPaths)) {
        const newPaths = homeownerData.drawingPaths;
        const currentPaths = this.gameState.drawingPaths || [];
        
        // 解决冲突：合并路径，优先保留最新的操作
        const mergedPaths = this.resolvePathConflicts(currentPaths, newPaths, 'homeowner');
        
        // 如果路径数量差异很大，执行完整重绘
        if (Math.abs(newPaths.length - currentPaths.length) > 5) {
          console.log(`路径数量差异较大，执行完整重绘: ${currentPaths.length} -> ${newPaths.length}`);
          
          // 更新本地绘画路径
          this.gameState.drawingPaths = [...mergedPaths];
          
          // 完整重绘画布
          this.redrawEntireCanvas(mergedPaths);
          
          // 触发重绘界面
          if (this.eventHandler.uiManager) {
            this.eventHandler.uiManager.drawGameUI(this.gameState);
          }
          
          // 回调通知
          if (this.onTeammateOperationApplied) {
            this.onTeammateOperationApplied(homeownerData);
          }
        } 
        // 增量更新
        else if (newPaths.length !== currentPaths.length) {
          console.log(`检测到绘画路径变化，执行增量更新: ${currentPaths.length} -> ${newPaths.length}`);
          
          // 找出新增的路径
          let startIndex = currentPaths.length;
          
          // 如果新路径数量少于当前路径，可能是重置操作，需要完全替换
          if (newPaths.length < currentPaths.length) {
            startIndex = 0;
          }
          
          // 应用新路径
          for (let i = startIndex; i < newPaths.length; i++) {
            const newPath = newPaths[i];
            
            // 模拟绘制新路径（重放房主的操作）
            this.simulateDrawingOperation(newPath);
          }
          
          // 更新本地绘画路径
          this.gameState.drawingPaths = [...mergedPaths];
          
          // 触发重绘界面
          if (this.eventHandler.uiManager) {
            this.eventHandler.uiManager.drawGameUI(this.gameState);
          }
          
          // 回调通知
          if (this.onTeammateOperationApplied) {
            this.onTeammateOperationApplied(homeownerData);
          }
        }
      }
      
      // 处理颜色和画笔大小变化
      if (homeownerData.color || homeownerData.lineWidth) {
        this.handleDrawingSettingsChange(homeownerData);
      }
      
      // 更新同步序列号
      this.lastSyncedSequence = Math.max(this.lastSyncedSequence, currentSequence);
      
    } catch (error) {
      console.error('处理房主数据失败:', error);
    }
  }

  // 处理绘画设置变化
  handleDrawingSettingsChange(homeownerData) {
    if (!homeownerData.color && !homeownerData.lineWidth) {
      return;
    }
    
    console.log('处理绘画设置变化', {
      color: homeownerData.color,
      lineWidth: homeownerData.lineWidth
    });
    
    // 更新本地游戏状态
    if (homeownerData.color) {
      this.gameState.currentColor = homeownerData.color;
      this.gameState.isEraser = homeownerData.color === '#FFFFFF';
    }
    
    if (homeownerData.lineWidth) {
      this.gameState.brushSize = homeownerData.lineWidth;
    }
  }

  // 处理操作类型
  handleOperationType(homeownerData) {
    const operationType = homeownerData.operationType;
    
    console.log(`处理房主操作类型: ${operationType}`);
    
    switch (operationType) {
      case 'clear':
        // 清空操作
        if (this.gameState.drawingPaths.length > 0) {
          this.gameState.clear();
          
          // 触发重绘界面
          if (this.eventHandler.uiManager) {
            this.eventHandler.uiManager.drawGameUI(this.gameState);
          }
        }
        break;
        
      case 'undo':
        // 撤销操作已在绘画路径变化中处理
        break;
        
      case 'exit':
        // 房主退出操作 - 伙伴侧处理
        console.log('检测到房主退出操作，触发伙伴退出流程');
        if (this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.team) {
          this.eventHandler.touchHandlers.team.handleHomeownerExit();
        }
        break;
        
      default:
        // 绘制操作已在绘画路径变化中处理
        break;
    }
  }

  // 模拟绘制操作（协作者重放房主的操作）
  simulateDrawingOperation(path) {
    if (!path || !path.points || path.points.length === 0) {
      return;
    }
    
    console.log(`模拟绘制操作，路径点数: ${path.points.length}`);
    
    try {
      // 获取绘画区域位置
      const { getAreaPositions } = require('./config.js');
      const positions = getAreaPositions();
      const drawingAreaY = positions.drawingAreaY;
      
      // 在协作者的画布上重现房主的操作
      const ctx = this.eventHandler.ctx;
      
      // 清除路径区域并重绘
      // 这里只重绘新增路径，不干扰已有内容
      
      ctx.save();
      
      // 设置绘制样式
      ctx.strokeStyle = path.color || '#000000';
      ctx.lineWidth = path.size || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = path.color === '#FFFFFF' ? 'destination-out' : 'source-over';
      
      // 绘制路径
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      
      ctx.stroke();
      
      ctx.restore();
      
      // 通知回调
      if (this.onDrawingOperationReceived) {
        this.onDrawingOperationReceived(path);
      }
      
    } catch (error) {
      console.error('模拟绘制操作失败:', error);
    }
  }

  // 完整重绘画布（协作者根据房主数据重绘整个画布）
  redrawEntireCanvas(drawingPaths) {
    if (!drawingPaths || !Array.isArray(drawingPaths) || drawingPaths.length === 0) {
      console.log('没有绘画路径，无需重绘');
      return;
    }
    
    console.log(`完整重绘画布，路径数量: ${drawingPaths.length}`);
    
    try {
      // 获取绘画区域位置
      const { getAreaPositions } = require('./config.js');
      const positions = getAreaPositions();
      const drawingAreaY = positions.drawingAreaY;
      
      // 清除整个绘画区域
      const ctx = this.eventHandler.ctx;
      ctx.clearRect(12, drawingAreaY, config.screenWidth - 24, config.drawingAreaHeight);
      
      // 重新绘制网格背景
      ctx.strokeStyle = '#F8F9FA';
      ctx.lineWidth = 1;
      
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(12, Math.round(drawingAreaY + i * (config.drawingAreaHeight / 4)));
        ctx.lineTo(config.screenWidth - 12, Math.round(drawingAreaY + i * (config.drawingAreaHeight / 4)));
        ctx.stroke();
      }
      
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.round(12 + i * ((config.screenWidth - 24) / 4)), drawingAreaY);
        ctx.lineTo(Math.round(12 + i * ((config.screenWidth - 24) / 4)), drawingAreaY + config.drawingAreaHeight);
        ctx.stroke();
      }
      
      // 重绘所有路径
      drawingPaths.forEach(path => {
        if (!path || !path.points || path.points.length === 0) {
          return;
        }
        
        ctx.save();
        
        // 设置绘制样式
        ctx.strokeStyle = path.color || '#000000';
        ctx.lineWidth = path.size || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = path.color === '#FFFFFF' ? 'destination-out' : 'source-over';
        
        // 绘制路径
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        
        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        
        ctx.stroke();
        
        ctx.restore();
      });
      
      console.log('画布完整重绘完成');
    } catch (error) {
      console.error('完整重绘画布失败:', error);
    }
  }

  // 停止协作会话
  async stop() {
    console.log('停止协作会话');
    
    // 处理剩余的批处理操作
    if (this.operationBuffer.length > 0) {
      await this.flushOperationBatch();
    }
    
    // 停止监听
    if (this.watchInstance && this.watchInstance.close) {
      await this.watchInstance.close();
      this.watchInstance = null;
    }
    
    // 停止轮询
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    // 清除批处理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // 重置状态
    this.isInitialized = false;
    this.isMonitoring = false;
    
    console.log('协作会话已停止');
  }

  // 获取网络延迟估计
  estimateNetworkLatency() {
    if (this.latencyBuffer.length < 3) {
      return this.networkLatency; // 返回默认值
    }
    
    // 计算最近的延迟平均值
    const recentLatencies = this.latencyBuffer.slice(-5);
    const sum = recentLatencies.reduce((a, b) => a + b, 0);
    return sum / recentLatencies.length;
  }

  // 应用网络延迟补偿
  applyNetworkCompensation(operation) {
    const estimatedLatency = this.estimateNetworkLatency();
    
    // 为操作添加时间戳，考虑网络延迟
    return {
      ...operation,
      serverTimestamp: operation.timestamp + estimatedLatency
    };
  }

  // 智能批处理：根据操作类型和频率调整批处理策略
  smartBatchOperation(operation) {
    // 添加到缓冲区
    this.operationBuffer.push(operation);
    
    // 根据操作类型调整批处理策略
    let dynamicBatchSize = this.batchSize;
    let dynamicBatchInterval = this.batchInterval;
    
    if (operation.operationType === 'draw_move') {
      // 绘制移动操作：更频繁的批处理
      dynamicBatchSize = 2;
      dynamicBatchInterval = 200;
    } else if (operation.operationType === 'clear') {
      // 清空操作：立即执行
      this.flushOperationBatch();
      return;
    } else if (operation.operationType === 'undo') {
      // 撤销操作：较小批处理
      dynamicBatchSize = 1;
      dynamicBatchInterval = 100;
    }
    
    // 检查是否需要立即处理批处理
    if (this.operationBuffer.length >= dynamicBatchSize) {
      this.flushOperationBatch();
    } else if (!this.batchTimer) {
      // 设置动态批处理定时器
      this.batchTimer = setTimeout(() => {
        this.flushOperationBatch();
      }, dynamicBatchInterval);
    }
  }

  // 优化绘画路径传输：压缩路径点数据
  optimizePathTransmission(path) {
    if (!path || !Array.isArray(path) || path.length < 3) {
      return path;
    }
    
    const optimizedPath = [path[0]]; // 保留起始点
    
    // 使用简化的Douglas-Peucker算法简化路径
    const tolerance = 2; // 容差值
    let lastPoint = path[0];
    
    for (let i = 1; i < path.length - 1; i++) {
      const currentPoint = path[i];
      const nextPoint = path[i + 1];
      
      // 计算当前点到线段的距离
      const distance = this.pointToLineDistance(currentPoint, lastPoint, nextPoint);
      
      // 如果距离大于容差，保留该点
      if (distance > tolerance) {
        optimizedPath.push(currentPoint);
        lastPoint = currentPoint;
      }
    }
    
    // 保留最后一个点
    optimizedPath.push(path[path.length - 1]);
    
    console.log(`路径优化: ${path.length} 点 -> ${optimizedPath.length} 点`);
    return optimizedPath;
  }

  // 计算点到线段的距离
  pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  // 动态调整网络延迟估计
  updateLatencyEstimation(actualLatency) {
    if (!actualLatency || actualLatency < 0) {
      return;
    }
    
    // 添加到延迟缓冲区
    this.latencyBuffer.push(actualLatency);
    
    // 保持缓冲区大小在合理范围
    if (this.latencyBuffer.length > 10) {
      this.latencyBuffer.shift();
    }
    
    // 更新网络延迟估计
    this.networkLatency = this.estimateNetworkLatency();
    
    console.log(`网络延迟估计更新: ${this.networkLatency}ms`);
  }

  // 基于网络质量自适应调整同步策略
  adaptiveSyncStrategy() {
    const latency = this.estimateNetworkLatency();
    
    // 根据网络延迟调整批处理策略
    if (latency > 500) {
      // 高延迟网络：减少批处理频率，增加批处理大小
      this.batchSize = 10;
      this.batchInterval = 1000;
      console.log('检测到高延迟网络，调整为保守同步策略');
    } else if (latency > 200) {
      // 中等延迟网络：适中的批处理策略
      this.batchSize = 5;
      this.batchInterval = 500;
      console.log('检测到中等延迟网络，调整为标准同步策略');
    } else {
      // 低延迟网络：更快的批处理策略
      this.batchSize = 3;
      this.batchInterval = 200;
      console.log('检测到低延迟网络，调整为积极同步策略');
    }
  }

  // 测量网络往返时间（RTT）
  async measureNetworkRTT() {
    if (!this.isInitialized) {
      return this.networkLatency; // 返回默认值
    }
    
    try {
      const startTime = Date.now();
      
      // 执行简单的数据库查询
      await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: this.userRole
        })
        .limit(1)
        .get();
      
      const endTime = Date.now();
      const rtt = endTime - startTime;
      
      // 更新延迟估计
      this.updateLatencyEstimation(rtt / 2); // RTT的一半是单向延迟
      
      return rtt / 2;
    } catch (error) {
      console.error('测量网络RTT失败:', error);
      return this.networkLatency;
    }
  }

  // 定期网络质量检测
  startNetworkQualityMonitoring() {
    // 每30秒检测一次网络质量
    this.networkQualityTimer = setInterval(async () => {
      await this.measureNetworkRTT();
      this.adaptiveSyncStrategy();
    }, 30000);
    
    // 立即执行一次检测
    this.measureNetworkRTT().then(() => {
      this.adaptiveSyncStrategy();
    });
  }

  // 房主角色：开始监听协作者操作
  async startMonitoringTeamworkerOperations() {
    if (this.isMonitoring) {
      return;
    }
    
    try {
      console.log(`开始监听房间 ${this.roomId} 的协作者操作`);
      
      this.teamworkerWatchInstance = await this.databaseManager.cloudDb
        .collection('drawing')
        .where({
          roomId: this.roomId,
          role: 'teamworker'
        })
        .watch({
          onChange: (snapshot) => {
            this.handleTeamworkerOperationChange(snapshot);
          },
          onError: (error) => {
            console.error('监听协作者操作出错:', error);
            
            // 出错时，使用轮询作为备选方案
            setTimeout(() => {
              this.startPollingTeamworkerOperations();
            }, 1000);
          }
        });
      
      this.isMonitoring = true;
      console.log('协作者操作监听已启动');
    } catch (error) {
      console.error('启动协作者操作监听失败:', error);
      
      // 使用轮询作为备选方案
      this.startPollingTeamworkerOperations();
    }
  }

  // 备选方案：轮询协作者操作
  startPollingTeamworkerOperations() {
    if (this.isMonitoring) {
      return;
    }
    
    this.isMonitoring = true;
    console.log('使用轮询方案监听协作者操作');
    
    // 每500ms检查一次
    const teamworkerPollingInterval = setInterval(async () => {
      try {
        const result = await this.databaseManager.cloudDb
          .collection('drawing')
          .where({
            roomId: this.roomId,
            role: 'teamworker'
          })
          .get();
        
        if (result.data.length > 0) {
          const teamworkerData = result.data[0];
          const currentSequence = teamworkerData.sequence || 0;
          
          // 如果有新操作
          if (currentSequence > this.lastSyncedSequence) {
            this.handleTeamworkerData(teamworkerData);
          }
        }
      } catch (error) {
        console.error('轮询协作者操作出错:', error);
      }
    }, 500);
    
    // 保存轮询ID，以便停止
    this.teamworkerPollingInterval = teamworkerPollingInterval;
  }

  // 处理协作者操作变化
  handleTeamworkerOperationChange(snapshot) {
    try {
      if (snapshot.type === 'update' && snapshot.updated && snapshot.updated.length > 0) {
        const teamworkerData = snapshot.updated[0];
        this.handleTeamworkerData(teamworkerData);
      } else if (snapshot.docs && snapshot.docs.length > 0) {
        const teamworkerData = snapshot.docs[0];
        this.handleTeamworkerData(teamworkerData);
      }
    } catch (error) {
      console.error('处理协作者操作变化失败:', error);
    }
  }

  // 处理协作者数据更新
  handleTeamworkerData(teamworkerData) {
    try {
      const currentSequence = teamworkerData.sequence || 0;
      
      console.log(`收到协作者操作更新，序列号: ${currentSequence}, 上次同步序列号: ${this.lastSyncedSequence}`);
      
      // 处理绘画路径变化
      if (teamworkerData.drawingPaths && Array.isArray(teamworkerData.drawingPaths)) {
        const newPaths = teamworkerData.drawingPaths;
        const currentPaths = this.gameState.drawingPaths || [];
        
        // 解决冲突：合并路径，优先保留最新的操作
        const mergedPaths = this.resolvePathConflicts(currentPaths, newPaths, 'teamworker');
        
        // 如果路径数量差异很大，执行完整重绘
        if (Math.abs(newPaths.length - currentPaths.length) > 5) {
          console.log(`路径数量差异较大，执行完整重绘: ${currentPaths.length} -> ${newPaths.length}`);
          
          // 更新本地绘画路径
          this.gameState.drawingPaths = [...mergedPaths];
          
          // 完整重绘画布
          this.redrawEntireCanvas(mergedPaths);
          
          // 触发重绘界面
          if (this.eventHandler.uiManager) {
            this.eventHandler.uiManager.drawGameUI(this.gameState);
          }
          
          // 回调通知
          if (this.onTeammateOperationApplied) {
            this.onTeammateOperationApplied(teamworkerData);
          }
        } 
        // 增量更新
        else if (newPaths.length !== currentPaths.length) {
          console.log(`检测到绘画路径变化，执行增量更新: ${currentPaths.length} -> ${newPaths.length}`);
          
          // 找出新增的路径
          let startIndex = currentPaths.length;
          
          // 如果新路径数量少于当前路径，可能是重置操作，需要完全替换
          if (newPaths.length < currentPaths.length) {
            startIndex = 0;
          }
          
          // 应用新路径
          for (let i = startIndex; i < newPaths.length; i++) {
            const newPath = newPaths[i];
            
            // 模拟绘制新路径（重放协作者的操作）
            this.simulateDrawingOperation(newPath);
          }
          
          // 更新本地绘画路径
          this.gameState.drawingPaths = [...mergedPaths];
          
          // 触发重绘界面
          if (this.eventHandler.uiManager) {
            this.eventHandler.uiManager.drawGameUI(this.gameState);
          }
          
          // 回调通知
          if (this.onTeammateOperationApplied) {
            this.onTeammateOperationApplied(teamworkerData);
          }
        }
      }
      
      // 处理其他操作类型（如清空）
      if (teamworkerData.operationType) {
        this.handleTeamworkerOperationType(teamworkerData);
      }
      
      // 处理颜色和画笔大小变化
      if (teamworkerData.color || teamworkerData.lineWidth) {
        this.handleDrawingSettingsChange(teamworkerData);
      }
      
      // 更新同步序列号
      this.lastSyncedSequence = Math.max(this.lastSyncedSequence, currentSequence);
      
    } catch (error) {
      console.error('处理协作者数据失败:', error);
    }
  }

  // 解决路径冲突：合并房主和协作者的绘画路径
  resolvePathConflicts(currentPaths, newPaths, sourceRole) {
    try {
      console.log(`解决路径冲突，源角色: ${sourceRole}`);
      
      // 如果当前没有路径，直接返回新路径
      if (!currentPaths || currentPaths.length === 0) {
        return [...newPaths];
      }
      
      // 如果没有新路径，保持当前路径不变
      if (!newPaths || newPaths.length === 0) {
        return [...currentPaths];
      }
      
      // 获取当前时间戳
      const now = Date.now();
      
      // 创建路径映射，以便快速查找
      const pathMap = new Map();
      
      // 添加当前路径到映射
      currentPaths.forEach((path, index) => {
        // 为每个路径创建唯一标识（基于颜色、大小和时间戳）
        const pathId = this.generatePathId(path);
        pathMap.set(pathId, {
          path: path,
          index: index,
          source: 'current',
          timestamp: path.timestamp || now
        });
      });
      
      // 检查新路径，添加或更新映射
      newPaths.forEach((path, index) => {
        const pathId = this.generatePathId(path);
        const newPathTimestamp = path.timestamp || now;
        
        if (pathMap.has(pathId)) {
          // 路径已存在，比较时间戳
          const existingPath = pathMap.get(pathId);
          
          // 如果新路径的时间戳更新，则替换
          if (newPathTimestamp > existingPath.timestamp) {
            pathMap.set(pathId, {
              path: path,
              index: index,
              source: sourceRole,
              timestamp: newPathTimestamp
            });
          }
        } else {
          // 新路径，添加到映射
          pathMap.set(pathId, {
            path: path,
            index: index,
            source: sourceRole,
            timestamp: newPathTimestamp
          });
        }
      });
      
      // 将映射转换回路径数组，按时间戳排序
      const mergedPaths = Array.from(pathMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(item => item.path);
      
      console.log(`路径冲突解决完成，合并了 ${mergedPaths.length} 条路径`);
      
      return mergedPaths;
    } catch (error) {
      console.error('解决路径冲突失败:', error);
      // 出错时返回新路径，确保数据不丢失
      return [...newPaths];
    }
  }

  // 生成路径唯一标识
  generatePathId(path) {
    if (!path || !path.points || path.points.length === 0) {
      return 'empty-path';
    }
    
    // 使用路径的第一点坐标、颜色和大小生成唯一标识
    const firstPoint = path.points[0];
    const color = path.color || '#000000';
    const size = path.size || 2;
    
    // 生成简单的哈希
    return `${firstPoint.x}_${firstPoint.y}_${color}_${size}`;
  }

  // 处理协作者操作类型
  handleTeamworkerOperationType(teamworkerData) {
    const operationType = teamworkerData.operationType;
    
    console.log(`处理协作者操作类型: ${operationType}`);
    
    switch (operationType) {
      case 'clear':
        // 清空操作
        if (this.gameState.drawingPaths.length > 0) {
          this.gameState.clear();
          
          // 触发重绘界面
          if (this.eventHandler.uiManager) {
            this.eventHandler.uiManager.drawGameUI(this.gameState);
          }
        }
        break;
        
      case 'undo':
        // 撤销操作已在绘画路径变化中处理
        break;
        
      default:
        // 绘制操作已在绘画路径变化中处理
        break;
    }
  }

  // 停止网络质量监测
  stopNetworkQualityMonitoring() {
    if (this.networkQualityTimer) {
      clearInterval(this.networkQualityTimer);
      this.networkQualityTimer = null;
    }
  }

  // 重写stop方法，确保停止网络监测
  async stop() {
    console.log('停止协作会话');
    
    // 停止网络质量监测
    this.stopNetworkQualityMonitoring();
    
    // 处理剩余的批处理操作
    if (this.operationBuffer.length > 0) {
      await this.flushOperationBatch();
    }
    
    // 停止房主操作监听
    if (this.watchInstance && this.watchInstance.close) {
      await this.watchInstance.close();
      this.watchInstance = null;
    }
    
    // 停止协作者操作监听
    if (this.teamworkerWatchInstance && this.teamworkerWatchInstance.close) {
      await this.teamworkerWatchInstance.close();
      this.teamworkerWatchInstance = null;
    }
    
    // 停止轮询
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    if (this.teamworkerPollingInterval) {
      clearInterval(this.teamworkerPollingInterval);
      this.teamworkerPollingInterval = null;
    }
    
    // 清除批处理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    // 重置状态
    this.isInitialized = false;
    this.isMonitoring = false;
    
    console.log('协作会话已停止');
  }
}

module.exports = CollaborationManager;
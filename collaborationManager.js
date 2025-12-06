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
      } else {
        // 协作者监听房主数据变化
        await this.setupHomeownerWatcher();
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
      this.handleHomeownerOperationType(homeownerData.operationType);
      return;
    }
    
    // 处理其他操作...
  }

  // 处理协作者数据变化（房主侧）
  handleTeamworkerData(teamworkerData) {
    console.log('处理协作者数据:', teamworkerData);
    
    // 优先检查operationType，特别是exit操作
    if (teamworkerData.operationType) {
      this.handleTeamworkerOperationType(teamworkerData.operationType);
      return;
    }
    
    // 处理其他操作...
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
          this.handleHomeownerData(result.data[0]);
        }
      } catch (error) {
        console.error('轮询房主数据失败:', error);
      }
    }, 3000);
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
          this.handleTeamworkerData(result.data[0]);
        }
      } catch (error) {
        console.error('轮询协作者数据失败:', error);
      }
    }, 3000);
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
  async recordOperation(trace) {
    if (!this.isInitialized || this.userRole !== 'homeowner') {
      return false;
    }
    
    try {
      const success = await this.databaseManager.updateDrawingData(
        this.roomId,
        'homeowner',
        {
          trace: trace,
          lastUpdated: new Date()
        }
      );
      
      return success;
    } catch (error) {
      console.error('记录房主操作失败:', error);
      return false;
    }
  }

  // 记录操作（协作者使用）
  async recordTeamworkerOperation(trace) {
    if (!this.isInitialized || this.userRole !== 'teamworker') {
      return false;
    }
    
    try {
      const success = await this.databaseManager.updateDrawingData(
        this.roomId,
        'teamworker',
        {
          trace: trace,
          lastUpdated: new Date()
        }
      );
      
      return success;
    } catch (error) {
      console.error('记录协作者操作失败:', error);
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
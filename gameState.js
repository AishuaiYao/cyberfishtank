const { config } = require('./config.js');

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentColor = '#000000';
    this.brushSize = 5;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.isEraser = false;
    this.score = 0;
    this.drawingPaths = [];
    this.currentPath = null;

    // 新增：缩放状态管理
    this.zoomState = {
      isZooming: false,                    // 是否正在缩放
      zoomScale: 1.0,                      // 当前缩放比例
      zoomCenterX: 0,                      // 缩放中心点X坐标
      zoomCenterY: 0,                      // 缩放中心点Y坐标
      initialDistance: 0,                  // 初始双指距离
      initialScale: 1.0,                   // 初始缩放比例
      zoomTimer: null,                     // 缩放计时器
      zoomStartTime: 0,                    // 缩放开始时间
      zoomThreshold: 200                   // 缩放触发阈值（毫秒）
    };



    // 优化：分离评分状态
    this.scoringState = {
      isScoring: false,
      isRequesting: false, // 新增：标记是否正在请求AI
      lastScoreTime: 0,    // 新增：上次评分时间
      scoreQueue: [],      // 新增：评分队列，用于防抖

      // 协同模式特有状态
      collaborativeMode: false, // 是否处于协同模式
      collaborationCheckTime: 0, // 协同操作检查时间
      pendingCollaborationOps: 0, // 待处理的协同操作数量
      collaborationScoreLock: false // 协同评分锁定（防止同时评分）
    };

    this.scaledFishImage = null; // 新增：存储缩放后的鱼图像

    // 新增：基于角色的操作历史栈
    this.homeownerHistory = []; // 房主操作历史栈
    this.teamworkerHistory = []; // 协作者操作历史栈
  }

  startNewPath(x, y) {
    this.currentPath = {
      color: this.isEraser ? '#FFFFFF' : this.currentColor,
      size: this.brushSize,
      points: [{x, y}]
    };
  }

  addPointToPath(x, y) {
    if (this.currentPath) {
      this.currentPath.points.push({x, y});
    }
  }

  completePath() {
    if (this.currentPath) {
      this.drawingPaths.push(this.currentPath);
      this.currentPath = null;
      return true;
    }
    return false;
  }

  undo() {
    if (this.drawingPaths.length > 0) {
      this.drawingPaths.pop();
      return true;
    }
    return false;
  }

  clear() {
    this.drawingPaths = [];
    this.score = 0;
    this.scaledFishImage = null; // 清空时也清除缩放图
    this.isFlipped = false; // 清空时重置翻转状态
  }

  toggleEraser() {
    this.isEraser = !this.isEraser;
    return this.isEraser;
  }

  // 修改：翻转画布 - 改为一次性操作，翻转所有路径坐标
  flipCanvas() {
    if (this.drawingPaths.length === 0) {
      return false;
    }

    // 一次性翻转所有路径的x坐标
    this.drawingPaths.forEach(path => {
      if (path.points && path.points.length > 0) {
        path.points.forEach(point => {
          // 水平翻转：x = 屏幕宽度 - x
          point.x = config.screenWidth - point.x;
        });
      }
    });

    console.log(`画布已翻转，共翻转了${this.drawingPaths.length}条路径`);
    return true;
  }

  setColor(color) {
    this.currentColor = color;
    this.isEraser = false;
  }

  setBrushSize(size) {
    this.brushSize = Math.max(1, Math.min(20, size));
  }

  // 优化：改进评分状态管理
  startScoring() {
    this.scoringState.isScoring = true;
    this.scoringState.isRequesting = true;
    this.scoringState.lastScoreTime = Date.now();
  }

  finishScoring(score) {
    this.score = Math.round(score);
    this.scoringState.isScoring = false;
    this.scoringState.isRequesting = false;
  }

  cancelScoring() {
    this.scoringState.isScoring = false;
    this.scoringState.isRequesting = false;
  }

  // 新增：检查是否可以开始评分（防抖）
  canStartScoring() {
    const now = Date.now();
    const timeSinceLastScore = now - this.scoringState.lastScoreTime;
    return !this.scoringState.isRequesting && timeSinceLastScore > 2000; // 2秒防抖
  }

  // 新增：获取评分状态（兼容旧代码）
  get isScoring() {
    return this.scoringState.isScoring;
  }

  // 新增：添加操作到角色历史记录
  addOperationToRoleHistory(role, operation) {
    if (!role || !operation) {
      console.error('添加操作历史失败：角色或操作为空');
      return false;
    }

    // 确保操作有唯一ID和角色标识
    const operationWithMeta = {
      ...operation,
      id: operation.id || Date.now() + Math.random(), // 添加唯一ID
      timestamp: operation.timestamp || Date.now(),
      role: role
    };

    // 根据角色添加到对应的历史栈
    if (role === 'homeowner') {
      this.homeownerHistory.push(operationWithMeta);
      console.log(`房主操作已添加到历史栈，当前操作数: ${this.homeownerHistory.length}`);
      return true;
    } else if (role === 'teamworker') {
      this.teamworkerHistory.push(operationWithMeta);
      console.log(`协作者操作已添加到历史栈，当前操作数: ${this.teamworkerHistory.length}`);
      return true;
    }

    console.error('未知的角色类型:', role);
    return false;
  }

  // 新增：获取指定角色的操作数量
  getOperationCountByRole(role) {
    if (role === 'homeowner') {
      return this.homeownerHistory.length;
    } else if (role === 'teamworker') {
      return this.teamworkerHistory.length;
    }
    return 0;
  }

  // 新增：基于角色的撤销操作
  undoByRole(role) {
    if (!role) {
      console.error('撤销操作失败：角色为空');
      return false;
    }

    let operationToUndo = null;

    // 根据角色获取最后操作
    if (role === 'homeowner' && this.homeownerHistory.length > 0) {
      operationToUndo = this.homeownerHistory.pop();
    } else if (role === 'teamworker' && this.teamworkerHistory.length > 0) {
      operationToUndo = this.teamworkerHistory.pop();
    } else {
      console.warn(`${role}没有可撤销的操作`);
      return false;
    }

    if (!operationToUndo) {
      console.error('获取要撤销的操作失败');
      return false;
    }

    // 从全局drawingPaths中移除对应的操作
    const operationIndex = this.drawingPaths.findIndex(path =>
      path.id === operationToUndo.id ||
      (path.points === operationToUndo.points &&
       path.color === operationToUndo.color &&
       path.size === operationToUndo.size)
    );

    if (operationIndex !== -1) {
      this.drawingPaths.splice(operationIndex, 1);
      console.log(`${role}撤销操作成功，从全局路径中移除索引${operationIndex}的操作`);
      return true;
    } else {
      // 如果在全局路径中找不到，尝试通过位置匹配
      console.warn(`在全局路径中未找到匹配的操作，尝试通过位置匹配撤销`);
      // 从后往前遍历，找到同类型的最后一个操作
      for (let i = this.drawingPaths.length - 1; i >= 0; i--) {
        const path = this.drawingPaths[i];
        if ((path.isEraser === operationToUndo.isEraser) &&
            (path.color === operationToUndo.color)) {
          this.drawingPaths.splice(i, 1);
          console.log(`${role}通过位置匹配撤销操作成功，移除索引${i}的操作`);
          return true;
        }
      }

      console.error(`${role}撤销操作失败：无法在全局路径中找到匹配的操作`);
      return false;
    }
  }

  // 新增：获取角色最后操作
  getLastOperationByRole(role) {
    if (role === 'homeowner' && this.homeownerHistory.length > 0) {
      return this.homeownerHistory[this.homeownerHistory.length - 1];
    } else if (role === 'teamworker' && this.teamworkerHistory.length > 0) {
      return this.teamworkerHistory[this.teamworkerHistory.length - 1];
    }
    return null;
  }

  // 新增：协同模式评分状态管理

  // 设置协同模式
  setCollaborativeMode(enabled) {
    this.scoringState.collaborativeMode = enabled;
    if (enabled) {
      console.log('进入协同模式，评分状态已调整');
      // 重置协同相关状态
      this.scoringState.collaborationCheckTime = Date.now();
      this.scoringState.pendingCollaborationOps = 0;
      this.scoringState.collaborationScoreLock = false;
    } else {
      console.log('退出协同模式');
    }
  }

  // 检查协同模式评分条件
  canStartCollaborativeScoring() {
    if (!this.scoringState.collaborativeMode) {
      return this.canStartScoring(); // 非协同模式使用标准检查
    }

    const now = Date.now();

    // 检查协同评分锁定
    if (this.scoringState.collaborationScoreLock) {
      console.log('协同评分被锁定，等待解锁');
      return false;
    }

    // 检查是否有待处理的协同操作
    if (this.scoringState.pendingCollaborationOps > 0) {
      console.log(`有${this.scoringState.pendingCollaborationOps}个协同操作待处理，延迟评分`);
      return false;
    }

    // 检查协同操作时间间隔
    const timeSinceLastCheck = now - this.scoringState.collaborationCheckTime;
    if (timeSinceLastCheck < 1500) { // 1.5秒协同操作间隔
      console.log('协同操作间隔太短，延迟评分');
      return false;
    }

    // 检查标准评分条件
    return this.canStartScoring();
  }

  // 记录协同操作开始
  recordCollaborationOperationStart() {
    if (this.scoringState.collaborativeMode) {
      this.scoringState.pendingCollaborationOps++;
      this.scoringState.collaborationCheckTime = Date.now();
      console.log(`协同操作开始，待处理操作数: ${this.scoringState.pendingCollaborationOps}`);
    }
  }

  // 记录协同操作完成
  recordCollaborationOperationComplete() {
    if (this.scoringState.collaborativeMode && this.scoringState.pendingCollaborationOps > 0) {
      this.scoringState.pendingCollaborationOps--;
      console.log(`协同操作完成，待处理操作数: ${this.scoringState.pendingCollaborationOps}`);
    }
  }

  // 锁定协同评分
  lockCollaborationScoring() {
    if (this.scoringState.collaborativeMode) {
      this.scoringState.collaborationScoreLock = true;
      console.log('协同评分已锁定');
    }
  }

  // 解锁协同评分
  unlockCollaborationScoring() {
    if (this.scoringState.collaborativeMode) {
      this.scoringState.collaborationScoreLock = false;
      console.log('协同评分已解锁');
    }
  }

  // 协同模式下的评分开始
  startCollaborativeScoring() {
    if (this.scoringState.collaborativeMode) {
      this.lockCollaborationScoring();
    }
    this.startScoring();
  }

  // 协同模式下的评分完成
  finishCollaborativeScoring(score) {
    this.finishScoring(score);
    if (this.scoringState.collaborativeMode) {
      this.unlockCollaborationScoring();
    }
  }

  // 协同模式下的评分取消
  cancelCollaborativeScoring() {
    this.cancelScoring();
    if (this.scoringState.collaborativeMode) {
      this.unlockCollaborationScoring();
    }
  }

  // 新增：缩放相关方法
  
  // 开始缩放（双指触摸开始）
  startZooming(touch1X, touch1Y, touch2X, touch2Y) {
    const zoomState = this.zoomState;
    
    // 清除之前的计时器
    if (zoomState.zoomTimer) {
      clearTimeout(zoomState.zoomTimer);
      zoomState.zoomTimer = null;
    }
    
    // 计算双指中心点
    zoomState.zoomCenterX = (touch1X + touch2X) / 2;
    zoomState.zoomCenterY = (touch1Y + touch2Y) / 2;
    
    // 计算初始距离（确保不小于最小距离）
    const distance = Math.sqrt(
      Math.pow(touch2X - touch1X, 2) + Math.pow(touch2Y - touch1Y, 2)
    );
    zoomState.initialDistance = Math.max(10, distance); // 最小距离10像素
    
    zoomState.initialScale = zoomState.zoomScale;
    zoomState.zoomStartTime = Date.now();
    
    // 设置缩放计时器（200ms后开始缩放）
    zoomState.zoomTimer = setTimeout(() => {
      zoomState.isZooming = true;
      console.log(`缩放模式已激活，当前缩放比例: ${zoomState.zoomScale.toFixed(2)}`);
      
      // 缩放激活后立即重绘画布
      if (typeof wx !== 'undefined' && wx.requestAnimationFrame) {
        wx.requestAnimationFrame(() => {
          // 触发界面重绘
          if (this.onZoomStateChange) {
            this.onZoomStateChange();
          }
        });
      }
    }, zoomState.zoomThreshold);
  }

  // 更新缩放（双指移动）
  updateZooming(touch1X, touch1Y, touch2X, touch2Y) {
    const zoomState = this.zoomState;
    
    if (!zoomState.isZooming) return;
    
    // 计算当前距离
    const currentDistance = Math.sqrt(
      Math.pow(touch2X - touch1X, 2) + Math.pow(touch2Y - touch1Y, 2)
    );
    
    // 防止除零错误
    if (zoomState.initialDistance < 10) return;
    
    // 更新缩放中心点
    zoomState.zoomCenterX = (touch1X + touch2X) / 2;
    zoomState.zoomCenterY = (touch1Y + touch2Y) / 2;
    
    // 计算缩放比例（严格限制在1.0到3.0之间）
    const scaleChange = currentDistance / zoomState.initialDistance;
    let newScale = zoomState.initialScale * scaleChange;
    
    // 确保缩放比例在有效范围内
    newScale = Math.max(1.0, Math.min(3.0, newScale));
    
    // 只有当缩放比例变化超过阈值时才更新，避免频繁重绘
    if (Math.abs(newScale - zoomState.zoomScale) > 0.05) {
      zoomState.zoomScale = newScale;
    }
  }

  // 结束缩放
  finishZooming() {
    const zoomState = this.zoomState;
    
    // 清除计时器
    if (zoomState.zoomTimer) {
      clearTimeout(zoomState.zoomTimer);
      zoomState.zoomTimer = null;
    }
    
    zoomState.isZooming = false;
    console.log(`缩放结束，最终缩放比例: ${zoomState.zoomScale.toFixed(2)}`);
  }

  // 重置缩放状态
  resetZoom() {
    const zoomState = this.zoomState;
    
    // 清除计时器
    if (zoomState.zoomTimer) {
      clearTimeout(zoomState.zoomTimer);
      zoomState.zoomTimer = null;
    }
    
    zoomState.isZooming = false;
    zoomState.zoomScale = 1.0;
    zoomState.zoomCenterX = 0;
    zoomState.zoomCenterY = 0;
    zoomState.initialDistance = 0;
    zoomState.initialScale = 1.0;
  }

  // 检查是否在缩放状态下
  isInZoomMode() {
    return this.zoomState.isZooming || this.zoomState.zoomScale !== 1.0;
  }
}

module.exports = GameState;
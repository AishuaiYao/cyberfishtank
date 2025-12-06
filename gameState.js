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



    // 优化：分离评分状态
    this.scoringState = {
      isScoring: false,
      isRequesting: false, // 新增：标记是否正在请求AI
      lastScoreTime: 0,    // 新增：上次评分时间
      scoreQueue: []       // 新增：评分队列，用于防抖
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
}

module.exports = GameState;

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
  }

  toggleEraser() {
    this.isEraser = !this.isEraser;
    return this.isEraser;
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
}

module.exports = GameState;
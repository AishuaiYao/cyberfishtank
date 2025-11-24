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

    // 新增：翻转状态
    this.isFlipped = false;

    // 修复：缩放绘制状态
    this.zoomState = {
      isZoomMode: false,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      lastDistance: 0,
      isPinching: false,
      pinchCenterX: 0,
      pinchCenterY: 0,
      isPanning: false, // 新增：平移状态
      lastPanX: 0,      // 新增：上次平移X
      lastPanY: 0       // 新增：上次平移Y
    };

    // 优化：分离评分状态
    this.scoringState = {
      isScoring: false,
      isRequesting: false,
      lastScoreTime: 0,
      scoreQueue: []
    };

    this.scaledFishImage = null;
  }

  startNewPath(x, y) {
    this.currentPath = {
      color: this.isEraser ? '#FFFFFF' : this.currentColor,
      size: this.brushSize,
      points: [{x, y}],
      // 新增：记录路径的缩放状态
      zoomState: this.isZoomMode() ? {...this.zoomState} : null
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
    this.scaledFishImage = null;
    this.isFlipped = false;
    // 新增：清空时重置缩放状态
    this.resetZoomState();
  }

  toggleEraser() {
    this.isEraser = !this.isEraser;
    return this.isEraser;
  }

  // 新增：翻转画布
  flipCanvas() {
    this.isFlipped = !this.isFlipped;
    return this.isFlipped;
  }

  // 新增：缩放状态管理方法
  isZoomMode() {
    return this.zoomState.isZoomMode && this.zoomState.scale > 1.0;
  }

  enableZoomMode() {
    this.zoomState.isZoomMode = true;
  }

  disableZoomMode() {
    this.zoomState.isZoomMode = false;
    this.resetZoomState();
  }

  resetZoomState() {
    this.zoomState = {
      isZoomMode: false,
      scale: 1.0,
      offsetX: 0,
      offsetY: 0,
      lastDistance: 0,
      isPinching: false,
      pinchCenterX: 0,
      pinchCenterY: 0,
      isPanning: false,
      lastPanX: 0,
      lastPanY: 0
    };
  }

  updateZoomState(scale, offsetX, offsetY) {
    this.zoomState.scale = Math.max(config.zoomDrawing.minScale,
      Math.min(config.zoomDrawing.maxScale, scale));
    this.zoomState.offsetX = offsetX;
    this.zoomState.offsetY = offsetY;
  }

  startPinch(x1, y1, x2, y2) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    this.zoomState.isPinching = true;
    this.zoomState.pinchCenterX = centerX;
    this.zoomState.pinchCenterY = centerY;
    this.zoomState.lastDistance = distance;
  }

  updatePinch(x1, y1, x2, y2) {
    if (!this.zoomState.isPinching) return;

    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const scaleChange = distance / this.zoomState.lastDistance;

    const newScale = this.zoomState.scale * scaleChange;
    const constrainedScale = Math.max(config.zoomDrawing.minScale,
      Math.min(config.zoomDrawing.maxScale, newScale));

    // 计算缩放中心在画布中的位置
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;

    // 修复：更新偏移量以保持缩放中心
    const scaleRatio = constrainedScale / this.zoomState.scale;
    this.zoomState.offsetX = centerX - (centerX - this.zoomState.offsetX) * scaleRatio;
    this.zoomState.offsetY = centerY - (centerY - this.zoomState.offsetY) * scaleRatio;

    this.zoomState.scale = constrainedScale;
    this.zoomState.lastDistance = distance;
  }

  endPinch() {
    this.zoomState.isPinching = false;
    this.zoomState.lastDistance = 0;
  }

  pan(deltaX, deltaY) {
    if (this.isZoomMode()) {
      this.zoomState.offsetX += deltaX;
      this.zoomState.offsetY += deltaY;

      // 修复：限制平移范围，防止画布移出视图
      const maxOffsetX = (this.zoomState.scale - 1) * (config.screenWidth - 24) / 2;
      const maxOffsetY = (this.zoomState.scale - 1) * config.drawingAreaHeight / 2;

      this.zoomState.offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, this.zoomState.offsetX));
      this.zoomState.offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, this.zoomState.offsetY));
    }
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
    return !this.scoringState.isRequesting && timeSinceLastScore > 2000;
  }

  // 新增：获取评分状态（兼容旧代码）
  get isScoring() {
    return this.scoringState.isScoring;
  }
}

module.exports = GameState;
const { config } = require('./config.js');

class GameState {
  constructor(game) {
    this.game = game;
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

    // 缩放状态管理
    this.zoomState = {
      isZooming: false,
      zoomScale: 1.0,
      zoomCenterX: 0,
      zoomCenterY: 0,
      initialDistance: 0,
      initialScale: 1.0,
      zoomTimer: null,
      zoomStartTime: 0
    };

    // 评分状态
    this.scoringState = {
      isScoring: false,
      isRequesting: false,
      lastScoreTime: 0,
      scoreQueue: []
    };

    // 存储缩放后的鱼图像
    this.scaledFishImage = null;

    // 翻转状态
    this.isFlipped = false;

    // 分享图片缓存
    this.shareImagePath = '';
    this.shareTitle = '来玩画小鱼游戏吧！';
  }

  startNewPath(x, y) {
    this.currentPath = {
      color: this.isEraser ? '#FFFFFF' : this.currentColor,
      size: this.brushSize,
      points: [{ x, y }]
    };
  }

  addPointToPath(x, y) {
    if (this.currentPath) {
      this.currentPath.points.push({ x, y });
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
    this.shareImagePath = '';
    this.shareTitle = '来玩画小鱼游戏吧！';
  }

  toggleEraser() {
    this.isEraser = !this.isEraser;
    return this.isEraser;
  }

  flipCanvas() {
    if (this.drawingPaths.length === 0) {
      return false;
    }

    this.drawingPaths.forEach(path => {
      if (path.points && path.points.length > 0) {
        path.points.forEach(point => {
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

  canStartScoring() {
    const now = Date.now();
    const timeSinceLastScore = now - this.scoringState.lastScoreTime;
    return !this.scoringState.isRequesting && timeSinceLastScore > 2000;
  }

  get isScoring() {
    return this.scoringState.isScoring;
  }

  // === 缩放相关方法 ===

  startZooming(touch1X, touch1Y, touch2X, touch2Y) {
    const zoomState = this.zoomState;

    if (zoomState.zoomTimer) {
      clearTimeout(zoomState.zoomTimer);
      zoomState.zoomTimer = null;
    }

    zoomState.zoomCenterX = (touch1X + touch2X) / 2;
    zoomState.zoomCenterY = (touch1Y + touch2Y) / 2;

    const distance = Math.sqrt(
      Math.pow(touch2X - touch1X, 2) + Math.pow(touch2Y - touch1Y, 2)
    );
    zoomState.initialDistance = Math.max(10, distance);

    zoomState.initialScale = zoomState.zoomScale;
    zoomState.zoomStartTime = Date.now();

    zoomState.zoomTimer = setTimeout(() => {
      zoomState.isZooming = true;
      console.log(`缩放模式已激活，当前缩放比例: ${zoomState.zoomScale.toFixed(2)}`);
    }, 50);
  }

  updateZooming(touch1X, touch1Y, touch2X, touch2Y) {
    const zoomState = this.zoomState;
    if (!zoomState.isZooming) return;

    const currentDistance = Math.sqrt(
      Math.pow(touch2X - touch1X, 2) + Math.pow(touch2Y - touch1Y, 2)
    );

    if (zoomState.initialDistance < 10) return;

    zoomState.zoomCenterX = (touch1X + touch2X) / 2;
    zoomState.zoomCenterY = (touch1Y + touch2Y) / 2;

    const scaleRatio = currentDistance / zoomState.initialDistance;
    const incrementalFactor = 1 + (scaleRatio - 1) * 0.3;

    let newScale = zoomState.zoomScale * incrementalFactor;
    newScale = Math.max(1.0, Math.min(3.0, newScale));

    if (Math.abs(newScale - zoomState.zoomScale) > 0.01) {
      zoomState.zoomScale = newScale;
      zoomState.initialDistance = currentDistance;
    }
  }

  finishZooming() {
    const zoomState = this.zoomState;

    if (zoomState.zoomTimer) {
      clearTimeout(zoomState.zoomTimer);
      zoomState.zoomTimer = null;
    }

    zoomState.isZooming = false;
    console.log(`缩放结束，最终缩放比例: ${zoomState.zoomScale.toFixed(2)}`);
  }

  resetZoom() {
    const zoomState = this.zoomState;

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

  isInZoomMode() {
    return this.zoomState.isZooming || this.zoomState.zoomScale !== 1.0;
  }
}

module.exports = GameState;

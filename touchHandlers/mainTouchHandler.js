const { config, getAreaPositions } = require('../config.js');

class MainTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.positions = getAreaPositions();
    this.lastDrawTime = 0;
    this.scoringTimer = null;

    // 新增：多点触控状态
    this.touches = new Map();
    this.isPinching = false;
  }

  // 处理主界面触摸开始
  handleTouchStart(x, y, identifier = 0) {
    // 记录触摸点
    this.touches.set(identifier, { x, y });

    // 检查是否进入缩放模式（双指触摸）
    if (this.touches.size >= 2 && !this.eventHandler.gameState.zoomState.isPinching) {
      this.startPinchGesture();
      return;
    }

    // 单指触摸：绘画或点击按钮
    if (this.isInDrawingArea(x, y) && this.touches.size === 1) {
      // 如果在缩放模式下，转换为平移操作
      if (this.eventHandler.gameState.isZoomMode()) {
        this.eventHandler.gameState.zoomState.isPanning = true;
        this.eventHandler.gameState.zoomState.lastPanX = x;
        this.eventHandler.gameState.zoomState.lastPanY = y;
      } else {
        this.cancelPendingScoring();
        this.startDrawing(x, y);
      }
    } else {
      this.handleFunctionAreaClick(x, y);
    }
  }

  // 处理主界面触摸移动
  handleTouchMove(x, y, identifier = 0) {
    // 更新触摸点位置
    if (this.touches.has(identifier)) {
      this.touches.set(identifier, { x, y });
    }

    // 处理双指缩放
    if (this.touches.size >= 2) {
      this.handlePinchGesture();
      return;
    }

    // 单指移动：绘画或平移
    const gameState = this.eventHandler.gameState;

    if (gameState.isDrawing && this.touches.size === 1) {
      if (this.isInDrawingArea(x, y)) {
        // 修复：在缩放模式下也要能够绘画
        if (gameState.isZoomMode()) {
          // 在缩放模式下，如果已经开始绘画，就继续绘画
          this.continueDrawing(x, y);
          this.lastDrawTime = Date.now();
          this.cancelPendingScoring();
        } else {
          this.continueDrawing(x, y);
          this.lastDrawTime = Date.now();
          this.cancelPendingScoring();
        }
      }
    } else if (gameState.isZoomMode() &&
               gameState.zoomState.isPanning) {
      // 处理平移
      this.handlePanGesture(x, y);
    }
  }

  // 处理主界面触摸结束
  handleTouchEnd(x, y, identifier = 0) {
    // 移除触摸点
    this.touches.delete(identifier);

    // 结束捏合手势
    if (this.touches.size < 2) {
      this.eventHandler.gameState.endPinch();
      this.isPinching = false;
    }

    // 结束平移
    if (this.eventHandler.gameState.zoomState.isPanning) {
      this.eventHandler.gameState.zoomState.isPanning = false;
    }

    // 结束绘画
    if (this.eventHandler.gameState.isDrawing && this.touches.size === 0) {
      this.finishDrawing();
      this.scheduleSmartScoring();
    }
  }

  // 新增：开始捏合手势
  startPinchGesture() {
    const touchArray = Array.from(this.touches.values());
    if (touchArray.length < 2) return;

    const [touch1, touch2] = touchArray;
    this.eventHandler.gameState.startPinch(
      touch1.x, touch1.y,
      touch2.x, touch2.y
    );
    this.isPinching = true;

    // 启用缩放模式
    this.eventHandler.gameState.enableZoomMode();
  }

  // 新增：处理捏合手势
  handlePinchGesture() {
    const touchArray = Array.from(this.touches.values());
    if (touchArray.length < 2) return;

    const [touch1, touch2] = touchArray;
    this.eventHandler.gameState.updatePinch(
      touch1.x, touch1.y,
      touch2.x, touch2.y
    );

    // 强制重绘UI
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
  }

  // 新增：处理平移手势
  handlePanGesture(x, y) {
    const zoomState = this.eventHandler.gameState.zoomState;
    const deltaX = x - zoomState.lastPanX;
    const deltaY = y - zoomState.lastPanY;

    this.eventHandler.gameState.pan(deltaX, deltaY);

    zoomState.lastPanX = x;
    zoomState.lastPanY = y;

    // 强制重绘UI
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
  }

  // 优化：取消待处理的评分
  cancelPendingScoring() {
    if (this.scoringTimer) {
      clearTimeout(this.scoringTimer);
      this.scoringTimer = null;
    }

    this.eventHandler.aiService.cancelCurrentRequest();
  }

  // 优化：安排智能评分
  scheduleSmartScoring() {
    this.cancelPendingScoring();

    this.scoringTimer = setTimeout(() => {
      this.triggerAIScoring();
    }, 400);
  }

  // 优化：触发AI评分
  async triggerAIScoring() {
    const gameState = this.eventHandler.gameState;

    if (gameState.isDrawing || gameState.drawingPaths.length === 0) {
      return;
    }

    await this.eventHandler.aiService.triggerSmartScoring(
      this.eventHandler.canvas,
      gameState,
      () => {
        this.eventHandler.uiManager.drawGameUI(gameState);
      }
    );
  }

  // 处理功能区点击
  handleFunctionAreaClick(x, y) {
    if (this.handleColorButtonClick(x, y)) return;
    if (this.handleBrushSizeClick(x, y)) return;
    if (this.handleToolButtonClick(x, y)) return;
    if (this.handleJumpButtonClick(x, y)) return;
  }

  // 颜色按钮点击
  handleColorButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const colorButtonsY = functionAreaY + 10;
    const totalWidth = config.colorButtonSize * 7 + 18 * 6;
    const startX = (config.screenWidth - totalWidth) / 2;

    for (let i = 0; i < 7; i++) {
      const buttonX = startX + i * (config.colorButtonSize + 18);
      const buttonY = colorButtonsY;

      if (x >= buttonX && x <= buttonX + config.colorButtonSize &&
          y >= buttonY && y <= buttonY + config.colorButtonSize) {

        this.eventHandler.gameState.setColor(config.colors[i]);
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
        return true;
      }
    }
    return false;
  }

  // 画笔大小点击
  handleBrushSizeClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const sizeControlY = functionAreaY + config.partHeight - 5;
    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;

    if (y >= sizeControlY - 15 && y <= sizeControlY + 15 &&
        x >= sliderX - 10 && x <= sliderX + sliderWidth + 10) {

      const progress = Math.max(0, Math.min(1, (x - sliderX) / sliderWidth));
      const newSize = Math.round(progress * 19) + 1;
      this.eventHandler.gameState.setBrushSize(newSize);
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }
    return false;
  }

  // 工具按钮点击
  handleToolButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const toolsY = functionAreaY + config.partHeight * 2 - 40;
    const toolWidth = (config.screenWidth - 50) / 4;

    for (let i = 0; i < 4; i++) {
      const buttonX = 30 + i * toolWidth;
      const buttonWidth = toolWidth - 10;

      if (x >= buttonX && x <= buttonX + buttonWidth &&
          y >= toolsY && y <= toolsY + config.buttonHeight) {

        this.handleToolAction(i);
        return true;
      }
    }
    return false;
  }

  // 工具操作
  handleToolAction(toolIndex) {
    const gameState = this.eventHandler.gameState;

    switch (toolIndex) {
      case 0: // 橡皮
        gameState.toggleEraser();
        break;
      case 1: // 撤销
        gameState.undo();
        break;
      case 2: // 清空
        gameState.clear();
        this.cancelPendingScoring();
        break;
      case 3: // 翻转
        this.handleFlipAction();
        break;
    }
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 处理翻转操作
  handleFlipAction() {
    const gameState = this.eventHandler.gameState;

    if (gameState.drawingPaths.length === 0) {
      wx.showToast({
        title: '请先画一些内容',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    const isFlipped = gameState.flipCanvas();
    this.redrawAllPathsFlipped();
  }

  // 重新绘制所有路径（翻转后）
  redrawAllPathsFlipped() {
    const gameState = this.eventHandler.gameState;
    const ctx = this.eventHandler.canvas.getContext('2d');
    const drawingAreaY = this.positions.drawingAreaY;

    ctx.clearRect(12, drawingAreaY, config.screenWidth - 24, config.drawingAreaHeight);

    if (gameState.isFlipped) {
      ctx.save();
      ctx.translate(config.screenWidth, 0);
      ctx.scale(-1, 1);
    }

    gameState.drawingPaths.forEach(path => {
      if (path.points.length > 0) {
        ctx.beginPath();

        const startPoint = gameState.isFlipped ?
          { x: config.screenWidth - path.points[0].x, y: path.points[0].y } :
          path.points[0];

        ctx.moveTo(startPoint.x, startPoint.y);

        for (let i = 1; i < path.points.length; i++) {
          const point = gameState.isFlipped ?
            { x: config.screenWidth - path.points[i].x, y: path.points[i].y } :
            path.points[i];

          ctx.lineTo(point.x, point.y);
        }

        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    });

    if (gameState.isFlipped) {
      ctx.restore();
    }
  }

  // 跳转按钮点击
  handleJumpButtonClick(x, y) {
    const jumpAreaY = this.positions.jumpAreaY;
    const jumpButtonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < 3; i++) {
      const buttonX = 30 + i * jumpButtonWidth;
      const buttonWidth = jumpButtonWidth - 10;

      if (x >= buttonX && x <= buttonX + buttonWidth &&
          y >= jumpAreaY + 13 && y <= jumpAreaY + 13 + config.buttonHeight) {

        this.handleJumpAction(i);
        return true;
      }
    }
    return false;
  }

  // 跳转操作
  handleJumpAction(buttonIndex) {
    switch (buttonIndex) {
      case 0: // 鱼缸
        this.eventHandler.handleFishTank();
        break;
      case 1: // 让它游起来！
        this.eventHandler.handleMakeItSwim();
        break;
      case 2: // 排行榜
        this.eventHandler.handleRanking();
        break;
    }
  }

  // 绘画功能
  isInDrawingArea(x, y) {
    const drawingAreaY = this.positions.drawingAreaY;
    return y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight &&
           x >= 12 && x <= config.screenWidth - 12;
  }

  startDrawing(x, y) {
    const gameState = this.eventHandler.gameState;
    gameState.isDrawing = true;

    // 应用缩放和翻转变换到起始坐标
    const transformedPoint = this.applyTransformations(x, y, gameState);
    gameState.lastX = transformedPoint.x;
    gameState.lastY = transformedPoint.y;
    gameState.startNewPath(transformedPoint.x, transformedPoint.y);

    console.log('开始绘画，原始坐标:', x, y, '变换后坐标:', transformedPoint);
  }

  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;

    // 应用缩放和翻转变换到坐标
    const transformedPoint = this.applyTransformations(x, y, gameState);

    ctx.beginPath();
    ctx.moveTo(gameState.lastX, gameState.lastY);
    ctx.lineTo(transformedPoint.x, transformedPoint.y);
    ctx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    gameState.addPointToPath(transformedPoint.x, transformedPoint.y);
    gameState.lastX = transformedPoint.x;
    gameState.lastY = transformedPoint.y;
  }

  // 修复：应用缩放和翻转变换
  applyTransformations(x, y, gameState) {
    let transformedX = x;
    let transformedY = y;

    // 应用缩放变换 - 修复逻辑
    if (gameState.isZoomMode()) {
      const zoom = gameState.zoomState;
      // 正确的逆变换：将屏幕坐标转换回画布坐标
      transformedX = (x - zoom.offsetX) / zoom.scale;
      transformedY = (y - zoom.offsetY) / zoom.scale;
    }

    // 应用翻转变换
    if (gameState.isFlipped) {
      transformedX = config.screenWidth - transformedX;
    }

    return { x: transformedX, y: transformedY };
  }

  async finishDrawing() {
    const gameState = this.eventHandler.gameState;
    if (gameState.completePath()) {
      console.log('绘画完成，将在空闲时触发AI评分');
    }
    gameState.isDrawing = false;

    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 新增：清理资源
  cleanup() {
    this.cancelPendingScoring();
    this.touches.clear();
  }
}

module.exports = MainTouchHandler;
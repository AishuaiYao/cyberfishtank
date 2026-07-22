const { config, getAreaPositions } = require('../config.js');

class MainTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.positions = getAreaPositions();
    this.lastDrawTime = 0;
    this.scoringTimer = null;

    // 调色板处理器
    this.paletteHandler = null;

    // 双指缩放相关
    this.touches = [];
    this.isTwoFingerTouch = false;
    this.zoomActive = false;
    this.singleTouchTimer = null;
    this.touchMode = 'none';
  }

  // 处理主界面触摸开始
  handleTouchStart(x, y, touches = null) {
    if (this.isInDrawingArea(x, y)) {
      if (touches && touches.length > 0) {
        this.touches = touches.map(touch => ({
          x: touch.clientX,
          y: touch.clientY,
          id: touch.identifier || Date.now() + Math.random()
        }));
      } else {
        const newTouch = { x, y, id: Date.now() + Math.random() };
        this.touches.push(newTouch);
      }

      if (this.touches.length === 1) {
        this.enterSingleTouchMode(x, y);
      } else if (this.touches.length === 2) {
        this.enterTwoFingerMode();
      } else if (this.touches.length > 2) {
        this.resetTouchState();
      }
    } else {
      this.handleFunctionAreaClick(x, y);
    }
  }

  enterSingleTouchMode(x, y) {
    if (this.singleTouchTimer) {
      clearTimeout(this.singleTouchTimer);
    }

    this.singleTouchTimer = setTimeout(() => {
      if (this.touches.length === 1 && this.touchMode === 'none') {
        this.touchMode = 'single';
        this.cancelPendingScoring();
        this.startDrawing(x, y);
        console.log('单指绘画模式激活');
      }
    }, 150);
  }

  enterTwoFingerMode() {
    if (this.singleTouchTimer) {
      clearTimeout(this.singleTouchTimer);
      this.singleTouchTimer = null;
    }

    this.touchMode = 'two_finger';
    this.isTwoFingerTouch = true;

    this.handleTwoFingerStart(this.touches[0], this.touches[1]);
    console.log('双指模式激活，等待缩放计时器');
  }

  handleTwoFingerStart(touch1, touch2) {
    const gameState = this.eventHandler.gameState;

    if (gameState.zoomState.zoomTimer) {
      clearTimeout(gameState.zoomState.zoomTimer);
      gameState.zoomState.zoomTimer = null;
    }
    gameState.zoomState.isZooming = false;

    gameState.startZooming(touch1.x, touch1.y, touch2.x, touch2.y);

    console.log(`双指缩放检测已启动，从${gameState.zoomState.zoomScale.toFixed(1)}x继续缩放`);
  }

  resetTouchState() {
    this.touches = [];
    this.isTwoFingerTouch = false;
    this.touchMode = 'none';

    if (this.singleTouchTimer) {
      clearTimeout(this.singleTouchTimer);
      this.singleTouchTimer = null;
    }

    const gameState = this.eventHandler.gameState;
    if (gameState.zoomState.zoomTimer) {
      clearTimeout(gameState.zoomState.zoomTimer);
      gameState.zoomState.zoomTimer = null;
    }
    gameState.zoomState.isZooming = false;
  }

  // 处理触摸移动
  handleTouchMove(x, y, touches = null) {
    const gameState = this.eventHandler.gameState;

    if (touches && touches.length > 0) {
      this.touches = touches.map(touch => ({
        x: touch.clientX,
        y: touch.clientY,
        id: touch.identifier || Date.now() + Math.random()
      }));
    } else {
      this.updateTouchPositionSimple(x, y);
    }

    if (this.touchMode === 'two_finger' && this.touches.length >= 2) {
      this.handleZoomMove();
      return;
    }

    if (this.touchMode === 'single' && gameState.isDrawing) {
      if (this.isInDrawingArea(x, y)) {
        this.continueDrawing(x, y);
        this.lastDrawTime = Date.now();
        this.cancelPendingScoring();
      }
    }
  }

  updateTouchPositionSimple(x, y) {
    if (this.touches.length === 0) return;

    if (this.touches.length === 1) {
      this.touches[0] = { x, y, id: this.touches[0].id };
      return;
    }

    const distance1 = Math.sqrt(Math.pow(x - this.touches[0].x, 2) + Math.pow(y - this.touches[0].y, 2));
    const distance2 = Math.sqrt(Math.pow(x - this.touches[1].x, 2) + Math.pow(y - this.touches[1].y, 2));

    if (distance1 < 10 && distance2 < 10) {
      this.touches[0] = { x, y, id: this.touches[0].id };
      this.touches[1] = { x, y, id: this.touches[1].id };
    } else {
      if (distance1 < distance2) {
        this.touches[0] = { x, y, id: this.touches[0].id };
      } else {
        this.touches[1] = { x, y, id: this.touches[1].id };
      }
    }
  }

  handleZoomMove() {
    if (this.touches.length < 2) return;

    const gameState = this.eventHandler.gameState;
    const touch1 = this.touches[0];
    const touch2 = this.touches[1];

    if (!gameState.zoomState.isZooming) {
      const currentDistance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2)
      );

      if (gameState.zoomState.initialDistance > 0 &&
          Math.abs(currentDistance - gameState.zoomState.initialDistance) > 15) {
        if (gameState.zoomState.zoomTimer) {
          clearTimeout(gameState.zoomState.zoomTimer);
          gameState.zoomState.zoomTimer = null;
        }
        gameState.zoomState.isZooming = true;
        console.log('缩放模式立即激活（检测到明显移动）');
      }
    }

    gameState.updateZooming(touch1.x, touch1.y, touch2.x, touch2.y);
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 处理触摸结束
  handleTouchEnd(x, y) {
    const gameState = this.eventHandler.gameState;

    this.removeTouchSimple(x, y);

    if (this.touches.length === 0) {
      if (this.touchMode === 'two_finger') {
        this.handleZoomEnd();
      } else if (this.touchMode === 'single' && gameState.isDrawing) {
        this.finishDrawing();
        this.scheduleSmartScoring();
      }
      this.resetTouchState();
    } else if (this.touches.length === 1 && this.touchMode === 'two_finger') {
      this.handleZoomEnd();
      this.touchMode = 'single';
      this.isTwoFingerTouch = false;
    }
  }

  removeTouchSimple(x, y) {
    if (this.touches.length === 0) return;

    if (this.touches.length === 1) {
      this.touches = [];
      return;
    }

    let distance1 = Math.sqrt(Math.pow(x - this.touches[0].x, 2) + Math.pow(y - this.touches[0].y, 2));
    let distance2 = Math.sqrt(Math.pow(x - this.touches[1].x, 2) + Math.pow(y - this.touches[1].y, 2));

    if (distance1 < distance2) {
      this.touches.splice(0, 1);
    } else {
      this.touches.splice(1, 1);
    }
  }

  handleZoomEnd() {
    const gameState = this.eventHandler.gameState;
    gameState.finishZooming();
    this.eventHandler.uiManager.drawGameUI(gameState);
    console.log('缩放模式结束');
  }

  // 取消待处理的评分
  cancelPendingScoring() {
    if (this.scoringTimer) {
      clearTimeout(this.scoringTimer);
      this.scoringTimer = null;
    }
    this.eventHandler.aiService.cancelCurrentRequest();
  }

  // 安排智能评分
  scheduleSmartScoring() {
    this.cancelPendingScoring();

    this.scoringTimer = setTimeout(() => {
      this.triggerAIScoring();
    }, 400);
  }

  // 触发AI评分
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
    if (this.paletteHandler && this.paletteHandler.isVisible) {
      if (this.paletteHandler.handlePaletteTouch(x, y)) return;
    }

    if (this.handleChallengeBtnClick(x, y)) return;
    if (this.handleZoomResetClick(x, y)) return;
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

        if (i === 6) {
          console.log('调色板按钮被点击');
          this.showPaletteInterface();
          return true;
        }

        this.eventHandler.gameState.setColor(config.colors[i]);
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
        return true;
      }
    }
    return false;
  }

  // 显示调色板界面
  showPaletteInterface() {
    if (!this.paletteHandler) {
      const PaletteHandler = require('./paletteHandler.js');
      this.paletteHandler = new PaletteHandler(this.eventHandler);
    }
    this.paletteHandler.showPaletteInterface();
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

  // 闯关按钮点击
  handleChallengeBtnClick(x, y) {
    const renderer = this.eventHandler.uiManager.interfaceRenderer;
    const bounds = renderer.getChallengeBtnBounds();
    if (!bounds) return false;

    if (x >= bounds.x && x <= bounds.x + bounds.w &&
        y >= bounds.y && y <= bounds.y + bounds.h) {
      console.log('闯关按钮被点击');
      this.eventHandler.handleChallenge();
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

  // 处理翻转操作
  async handleFlipAction() {
    const gameState = this.eventHandler.gameState;

    if (gameState.drawingPaths.length === 0) {
      const Utils = require('../utils.js');
      Utils.showError('请先画一些内容');
      return;
    }

    const success = gameState.flipCanvas();
    if (success) {
      this.eventHandler.uiManager.drawGameUI(gameState);
    }
  }

  // 处理清空操作
  async handleClearAction() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空画布吗？此操作不可撤销',
      confirmText: '确定',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          const gameState = this.eventHandler.gameState;
          gameState.clear();
          this.cancelPendingScoring();
          this.eventHandler.uiManager.drawGameUI(gameState);
        }
      }
    });
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
  async handleJumpAction(buttonIndex) {
    switch (buttonIndex) {
      case 0: // 鱼缸
        {
          const gameState = this.eventHandler.gameState;
          const zoomState = gameState.zoomState;
          if (zoomState.isZooming || zoomState.zoomScale !== 1.0) {
            gameState.resetZoom();
            this.eventHandler.uiManager.drawGameUI(gameState);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          this.eventHandler.handleFishTank();
        }
        break;
      case 1: // 加入鱼缸
        {
          const gameStateForSwim = this.eventHandler.gameState;
          const zoomStateForSwim = gameStateForSwim.zoomState;
          if (zoomStateForSwim.isZooming || zoomStateForSwim.zoomScale !== 1.0) {
            gameStateForSwim.resetZoom();
            this.eventHandler.uiManager.drawGameUI(gameStateForSwim);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          this.eventHandler.handleAddToTank();
        }
        break;
      case 2: // 分享
        this.eventHandler.handleShare();
        break;
    }
  }

  // 重置缩放按钮点击
  handleZoomResetClick(x, y) {
    const gameState = this.eventHandler.gameState;
    const zoomState = gameState.zoomState;

    if (!zoomState.isZooming && zoomState.zoomScale === 1.0) return false;

    const drawingAreaY = this.positions.drawingAreaY;
    const resetButtonX = 60;
    const indicatorY = drawingAreaY - 25;

    if (x >= resetButtonX - 40 && x <= resetButtonX + 40 &&
        y >= indicatorY - 10 && y <= indicatorY + 10) {

      console.log('重置缩放按钮被点击');
      gameState.resetZoom();
      this.eventHandler.uiManager.drawGameUI(gameState);
      return true;
    }

    return false;
  }

  // 绘画功能
  isInDrawingArea(x, y) {
    const drawingAreaY = this.positions.drawingAreaY;
    return y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight &&
           x >= 12 && x <= config.screenWidth - 12;
  }

  startDrawing(x, y) {
    const gameState = this.eventHandler.gameState;
    const zoomState = gameState.zoomState;
    gameState.isDrawing = true;

    gameState.lastX = x;
    gameState.lastY = y;

    let storedX = x;
    let storedY = y;

    if (zoomState.isZooming || zoomState.zoomScale !== 1.0) {
      storedX = (x - zoomState.zoomCenterX) / zoomState.zoomScale + zoomState.zoomCenterX;
      storedY = (y - zoomState.zoomCenterY) / zoomState.zoomScale + zoomState.zoomCenterY;
    }

    gameState.startNewPath(storedX, storedY);
  }

  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;
    const zoomState = gameState.zoomState;

    const currentX = x;
    const currentY = y;

    ctx.save();

    const drawingAreaY = this.positions.drawingAreaY;
    const padding = 2;
    ctx.beginPath();
    ctx.rect(12 + padding, drawingAreaY + padding,
             config.screenWidth - 24 - padding * 2,
             config.drawingAreaHeight - padding * 2);
    ctx.clip();

    ctx.beginPath();
    ctx.moveTo(gameState.lastX, gameState.lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    let storedX = currentX;
    let storedY = currentY;

    if (zoomState.isZooming || zoomState.zoomScale !== 1.0) {
      storedX = (currentX - zoomState.zoomCenterX) / zoomState.zoomScale + zoomState.zoomCenterX;
      storedY = (currentY - zoomState.zoomCenterY) / zoomState.zoomScale + zoomState.zoomCenterY;
    }

    gameState.addPointToPath(storedX, storedY);
    gameState.lastX = currentX;
    gameState.lastY = currentY;

    ctx.restore();
  }

  // 完成绘画
  async finishDrawing() {
    const gameState = this.eventHandler.gameState;
    if (gameState.completePath()) {
      console.log('绘画完成，将在空闲时触发AI评分');
    }
    gameState.isDrawing = false;
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 工具操作
  async handleToolAction(toolIndex) {
    const gameState = this.eventHandler.gameState;

    switch (toolIndex) {
      case 0: // 橡皮
        gameState.toggleEraser();
        break;
      case 1: // 撤销
        if (gameState.isEraser) {
          gameState.isEraser = false;
        }
        await this.handleUndoAction();
        break;
      case 2: // 清空
        await this.handleClearAction();
        break;
      case 3: // 翻转
        this.handleFlipAction();
        break;
    }
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 处理撤销操作
  async handleUndoAction() {
    const gameState = this.eventHandler.gameState;
    const success = gameState.undo();
    if (success) {
      this.eventHandler.uiManager.drawGameUI(gameState);
    }
  }

  // 清理资源
  cleanup() {
    this.cancelPendingScoring();

    if (this.paletteHandler) {
      this.paletteHandler.cleanup();
    }
  }
}

module.exports = MainTouchHandler;

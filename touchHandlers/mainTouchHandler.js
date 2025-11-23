const { config, getAreaPositions } = require('../config.js');

class MainTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.positions = getAreaPositions();
    this.lastDrawTime = 0;
    this.scoringTimer = null;
  }

  // 处理主界面触摸开始
  handleTouchStart(x, y) {
    // 只在开始绘画时取消可能的评分请求
    if (this.isInDrawingArea(x, y)) {
      this.cancelPendingScoring();
      this.startDrawing(x, y);
    } else {
      this.handleFunctionAreaClick(x, y);
    }
  }

  // 处理主界面触摸移动
  handleTouchMove(x, y) {
    if (!this.eventHandler.gameState.isDrawing) return;
    
    if (this.isInDrawingArea(x, y)) {
      this.continueDrawing(x, y);
      this.lastDrawTime = Date.now();
      
      // 优化：只在绘画移动时取消评分
      this.cancelPendingScoring();
    }
  }

  // 处理主界面触摸结束
  handleTouchEnd(x, y) {
    if (this.eventHandler.gameState.isDrawing) {
      this.finishDrawing();
      
      // 优化：延迟触发智能评分
      this.scheduleSmartScoring();
    }
  }

  // 优化：取消待处理的评分
  cancelPendingScoring() {
    if (this.scoringTimer) {
      clearTimeout(this.scoringTimer);
      this.scoringTimer = null;
    }
    
    // 取消当前的AI请求
    this.eventHandler.aiService.cancelCurrentRequest();
  }

  // 优化：安排智能评分
  scheduleSmartScoring() {
    this.cancelPendingScoring();
    
    this.scoringTimer = setTimeout(() => {
      this.triggerAIScoring();
    }, 400); // 400ms后触发评分
  }

  // 优化：触发AI评分
  async triggerAIScoring() {
    const gameState = this.eventHandler.gameState;
    
    // 检查是否满足评分条件
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

  // 颜色按钮点击 - 修改：不取消评分
  handleColorButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const colorButtonsY = functionAreaY + 20;
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

  // 画笔大小点击 - 修改：不取消评分
  handleBrushSizeClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const sizeControlY = functionAreaY + config.partHeight + 15;
    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;

    if (y >= sizeControlY - 20 && y <= sizeControlY + 20 &&
        x >= sliderX && x <= sliderX + sliderWidth) {

      const newSize = Math.round(((x - sliderX) / sliderWidth) * 20);
      this.eventHandler.gameState.setBrushSize(newSize);
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }
    return false;
  }

  // 工具按钮点击
  handleToolButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const toolsY = functionAreaY + config.partHeight * 2 + 15;
    const toolWidth = (config.screenWidth - 50) / 4;

    for (let i = 0; i < 4; i++) {
      const buttonX = 20 + i * toolWidth;

      if (x >= buttonX && x <= buttonX + toolWidth - 10 &&
          y >= toolsY && y <= toolsY + config.buttonHeight) {

        this.handleToolAction(i);
        return true;
      }
    }
    return false;
  }

  // 工具操作 - 修改：只有清空操作才取消评分
  handleToolAction(toolIndex) {
    const gameState = this.eventHandler.gameState;
    
    switch (toolIndex) {
      case 0: // 橡皮 - 不取消评分
        gameState.toggleEraser();
        break;
      case 1: // 撤销 - 不取消评分
        gameState.undo();
        break;
      case 2: // 清空 - 需要取消评分，因为内容完全变了
        gameState.clear();
        this.cancelPendingScoring();
        break;
      case 3: // 翻转 - 不取消评分
        wx.showToast({ title: '翻转功能开发中', icon: 'none' });
        break;
    }
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 跳转按钮点击 - 修改：不取消评分
  handleJumpButtonClick(x, y) {
    const jumpAreaY = this.positions.jumpAreaY;
    const jumpButtonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < 3; i++) {
      const buttonX = 20 + i * jumpButtonWidth;

      if (x >= buttonX && x <= buttonX + jumpButtonWidth - 10 &&
          y >= jumpAreaY + 13 && y <= jumpAreaY + 13 + config.buttonHeight) {

        this.handleJumpAction(i);
        return true;
      }
    }
    return false;
  }

  // 跳转操作 - 修改：不取消评分
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
    gameState.lastX = x;
    gameState.lastY = y;
    gameState.startNewPath(x, y);
  }

  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;
    
    ctx.beginPath();
    ctx.moveTo(gameState.lastX, gameState.lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    gameState.addPointToPath(x, y);
    gameState.lastX = x;
    gameState.lastY = y;
  }

  async finishDrawing() {
    const gameState = this.eventHandler.gameState;
    if (gameState.completePath()) {
      console.log('绘画完成，将在空闲时触发AI评分');
    }
    gameState.isDrawing = false;
    
    // 立即更新UI
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 新增：清理资源
  cleanup() {
    this.cancelPendingScoring();
  }
}

module.exports = MainTouchHandler;
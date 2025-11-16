const { config, getAreaPositions } = require('./config.js');
const AIService = require('./aiService.js');

class EventHandler {
  constructor(canvas, ctx, gameState, uiManager) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.positions = getAreaPositions();
    this.aiService = new AIService();
    
    this.bindEvents();
  }

  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
  }

  handleTouchStart(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (this.isInDrawingArea(x, y)) {
      this.startDrawing(x, y);
    } else {
      this.handleFunctionAreaClick(x, y);
    }
  }

  handleTouchMove(e) {
    if (!this.gameState.isDrawing) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (this.isInDrawingArea(x, y)) {
      this.continueDrawing(x, y);
    }
  }

  handleTouchEnd(e) {
    if (this.gameState.isDrawing) {
      this.finishDrawing();
    }
  }

  handleTouchCancel(e) {
    this.gameState.isDrawing = false;
  }

  isInDrawingArea(x, y) {
    const drawingAreaY = this.positions.drawingAreaY;
    return y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight &&
           x >= 12 && x <= config.screenWidth - 12;
  }

  startDrawing(x, y) {
    this.gameState.isDrawing = true;
    this.gameState.lastX = x;
    this.gameState.lastY = y;
    this.gameState.startNewPath(x, y);
  }

  continueDrawing(x, y) {
    const ctx = this.canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(this.gameState.lastX, this.gameState.lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = this.gameState.isEraser ? '#FFFFFF' : this.gameState.currentColor;
    ctx.lineWidth = this.gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    this.gameState.addPointToPath(x, y);
    this.gameState.lastX = x;
    this.gameState.lastY = y;
  }

  async finishDrawing() {
    if (this.gameState.completePath()) {
      await this.aiService.getAIScore(this.canvas, this.gameState, () => {
        this.uiManager.drawGameUI(this.gameState);
      });
    }
    this.gameState.isDrawing = false;
  }

  handleFunctionAreaClick(x, y) {
    if (this.handleColorButtonClick(x, y)) return;
    if (this.handleBrushSizeClick(x, y)) return;
    if (this.handleToolButtonClick(x, y)) return;
    if (this.handleJumpButtonClick(x, y)) return;
  }

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

        this.gameState.setColor(config.colors[i]);
        this.uiManager.drawGameUI(this.gameState);
        return true;
      }
    }
    return false;
  }

  handleBrushSizeClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const sizeControlY = functionAreaY + config.partHeight + 15;
    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;

    if (y >= sizeControlY - 20 && y <= sizeControlY + 20 &&
        x >= sliderX && x <= sliderX + sliderWidth) {

      const newSize = Math.round(((x - sliderX) / sliderWidth) * 20);
      this.gameState.setBrushSize(newSize);
      this.uiManager.drawGameUI(this.gameState);
      return true;
    }
    return false;
  }

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

  handleToolAction(toolIndex) {
    switch (toolIndex) {
      case 0: // 橡皮
        this.gameState.toggleEraser();
        break;
      case 1: // 撤销
        this.gameState.undo();
        break;
      case 2: // 清空
        this.gameState.clear();
        break;
      case 3: // 翻转
        wx.showToast({ title: '翻转功能开发中', icon: 'none' });
        break;
    }
    this.uiManager.drawGameUI(this.gameState);
  }

  handleJumpButtonClick(x, y) {
    const jumpAreaY = this.positions.jumpAreaY;
    const jumpButtonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < 3; i++) {
      const buttonX = 20 + i * jumpButtonWidth;

      if (x >= buttonX && x <= buttonX + jumpButtonWidth - 10 &&
          y >= jumpAreaY + 13 && y <= jumpAreaY + 13 + config.buttonHeight) {

        const jumpButtons = ['鱼缸', '让它游起来！', '排行榜'];
        wx.showToast({ title: `功能「${jumpButtons[i]}」开发中`, icon: 'none' });
        return true;
      }
    }
    return false;
  }
}

module.exports = EventHandler;
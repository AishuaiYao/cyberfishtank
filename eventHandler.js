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
    
    // 新增：游泳界面状态
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;

    this.bindEvents();
  }

  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
  }

  handleTouchStart(e) {
    // 如果游泳界面可见，优先处理游泳界面的点击
    if (this.isSwimInterfaceVisible) {
      this.handleSwimInterfaceTouch(e);
      return;
    }

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

        this.handleJumpAction(i);
        return true;
      }
    }
    return false;
  }

  handleJumpAction(buttonIndex) {
    switch (buttonIndex) {
      case 0: // 鱼缸
        wx.showToast({ title: '鱼缸功能开发中', icon: 'none' });
        break;
      case 1: // 让它游起来！
        this.handleMakeItSwim();
        break;
      case 2: // 排行榜
        wx.showToast({ title: '排行榜功能开发中', icon: 'none' });
        break;
    }
  }

  async handleMakeItSwim() {
    // 检查AI评分
    if (this.gameState.score < 60) {
      wx.showToast({
        title: 'AI评分小于60，这鱼画的太抽象',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查是否有绘制内容
    if (this.gameState.drawingPaths.length === 0) {
      wx.showToast({
        title: '请先画一条鱼',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    // 新增：立即显示游泳界面
    this.showSwimInterface();
    
    // 原有的处理逻辑
    try {
      wx.showLoading({ title: '处理中...', mask: true });

      // 计算最小外接矩形
      const boundingBox = this.calculateBoundingBox();
      console.log('最小外接矩形:', boundingBox);

      if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) {
        throw new Error('无法计算有效的外接矩形');
      }

      // 裁剪子图
      const subImage = await this.cropSubImage(boundingBox);
      console.log('裁剪子图尺寸:', subImage.width, subImage.height);

      // 缩放图像
      const scaledImage = await this.scaleImage(subImage);
      console.log('缩放图尺寸:', scaledImage.width, scaledImage.height);

      wx.hideLoading();
      wx.showToast({
        title: '处理完成！',
        icon: 'success',
        duration: 1500
      });

      // 更新游泳界面数据并重绘
      this.gameState.scaledFishImage = scaledImage;
      this.swimInterfaceData = {
        fishImage: scaledImage,
        score: this.gameState.score
      };
      
      // 重绘游泳界面以显示处理后的鱼
      this.uiManager.drawGameUI(this.gameState);

    } catch (error) {
      wx.hideLoading();
      console.error('处理失败:', error);
      wx.showToast({
        title: '处理失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  }

  // 新增：显示游泳界面
  showSwimInterface() {
    this.isSwimInterfaceVisible = true;
    
    // 立即设置界面数据并重绘
    this.swimInterfaceData = {
      fishImage: this.gameState.scaledFishImage,
      score: this.gameState.score
    };
    
    // 立即重绘UI以显示游泳界面
    this.uiManager.drawGameUI(this.gameState);
    
    console.log('游泳界面已显示');
  }

  // 新增：隐藏游泳界面
  hideSwimInterface() {
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;
    
    // 重绘UI以返回主界面
    this.uiManager.drawGameUI(this.gameState);
    
    console.log('游泳界面已隐藏');
  }

  // 新增：处理游泳界面的触摸事件
  handleSwimInterfaceTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    // 检查是否点击了返回按钮区域（左上角：20,40 宽50高30）
    if (x >= 20 && x <= 70 && // 20 + 50 = 70
        y >= 40 && y <= 70) { // 40 + 30 = 70
      this.hideSwimInterface();
      return;
    }
    
    // 这里可以添加其他游泳界面的交互逻辑
    console.log('游泳界面点击位置:', x, y);
  }

  calculateBoundingBox() {
    if (this.gameState.drawingPaths.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // 遍历所有路径点，找到边界
    this.gameState.drawingPaths.forEach(path => {
      path.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    // 添加一些边距
    const margin = 5;
    const width = Math.max(0, maxX - minX + margin * 2);
    const height = Math.max(0, maxY - minY + margin * 2);

    return {
      x: Math.max(0, minX - margin),
      y: Math.max(0, minY - margin),
      width: Math.min(width, this.canvas.width - (minX - margin)),
      height: Math.min(height, this.canvas.height - (minY - margin))
    };
  }

  cropSubImage(boundingBox) {
    return new Promise((resolve, reject) => {
      try {
        const ctx = this.canvas.getContext('2d');
        const imageData = ctx.getImageData(
          boundingBox.x,
          boundingBox.y,
          boundingBox.width,
          boundingBox.height
        );

        // 创建临时canvas来保存子图
        const tempCanvas = wx.createCanvas();
        tempCanvas.width = boundingBox.width;
        tempCanvas.height = boundingBox.height;

        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        resolve({
          canvas: tempCanvas,
          width: boundingBox.width,
          height: boundingBox.height
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  scaleImage(subImage) {
    return new Promise((resolve, reject) => {
      try {
        const { width, height } = subImage;
        const targetSize = 50;

        // 确定长边
        const isWidthLonger = width >= height;
        const scale = isWidthLonger ? targetSize / width : targetSize / height;

        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);

        // 创建缩放后的canvas
        const scaledCanvas = wx.createCanvas();
        scaledCanvas.width = scaledWidth;
        scaledCanvas.height = scaledHeight;

        const scaledCtx = scaledCanvas.getContext('2d');
        scaledCtx.drawImage(
          subImage.canvas,
          0, 0, width, height,
          0, 0, scaledWidth, scaledHeight
        );

        resolve({
          canvas: scaledCanvas,
          width: scaledWidth,
          height: scaledHeight,
          scale: scale
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = EventHandler;
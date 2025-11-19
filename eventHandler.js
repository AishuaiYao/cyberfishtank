const { config, getAreaPositions } = require('./config.js');
const AIService = require('./aiService.js');
const DatabaseManager = require('./databaseManager.js');
const { Fish, FishTank } = require('./fishManager.js');

class EventHandler {
  constructor(canvas, ctx, gameState, uiManager) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.positions = getAreaPositions();
    this.aiService = new AIService();
    this.databaseManager = new DatabaseManager();

    // 界面状态
    this.isSwimInterfaceVisible = false;
    this.isRankingInterfaceVisible = false;
    this.isFishDetailVisible = false;
    this.isDialogVisible = false;

    // 数据状态
    this.swimInterfaceData = null;
    this.rankingData = null;
    this.selectedFishData = null;
    this.dialogData = null;
    this.fishNameInput = '';

    // 动画相关
    this.fishTank = null;
    this.animationId = null;
    this.lastAnimationTime = 0;

    // 加载状态
    this.isLoadingRanking = false;
    this.isLoadingDatabaseFishes = false;
    this.databaseFishes = [];

    this.bindEvents();
  }

  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
  }

  // 触摸事件处理
  handleTouchStart(e) {
    if (this.isRankingInterfaceVisible) {
      this.handleRankingInterfaceTouch(e);
      return;
    }

    if (this.isFishDetailVisible) {
      this.handleFishDetailTouch(e);
      return;
    }

    if (this.isDialogVisible) {
      this.handleDialogTouch(e);
      return;
    }

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

  // 绘画功能
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

  // 功能区点击处理
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
        this.handleFishTank();
        break;
      case 1: // 让它游起来！
        this.handleMakeItSwim();
        break;
      case 2: // 排行榜
        this.handleRanking();
        break;
    }
  }

  // 鱼缸功能
  async handleFishTank() {
    await this.showFishTankInterface();
  }

  async showFishTankInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = { mode: 'fishTank' };

    if (!this.fishTank) {
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    const currentUserFish = this.fishTank.fishes.filter(fish =>
      !this.databaseFishes.includes(fish)
    );
    this.fishTank.fishes = currentUserFish;

    await this.loadAndShowDatabaseFishes();

    this.startAnimationLoop();
    console.log('鱼缸界面已显示，包含数据库鱼和用户鱼');
  }

  // 排行榜功能
  async handleRanking() {
    await this.showRankingInterface();
  }

  async showRankingInterface() {
    this.isRankingInterfaceVisible = true;
    this.isLoadingRanking = true;
    this.uiManager.drawGameUI(this.gameState);

    try {
      console.log('加载排行榜数据...');
      const rankingFishes = await this.getRankingDataWithImages();

      this.rankingData = {
        fishes: rankingFishes,
        lastUpdate: new Date()
      };

      console.log(`排行榜数据加载完成，共 ${rankingFishes.length} 条数据`);

    } catch (error) {
      console.error('加载排行榜数据失败:', error);
      this.rankingData = { fishes: [], lastUpdate: new Date() };
    } finally {
      this.isLoadingRanking = false;
      this.uiManager.drawGameUI(this.gameState);
    }
  }

  hideRankingInterface() {
    this.isRankingInterfaceVisible = false;
    this.rankingData = null;
    this.uiManager.drawGameUI(this.gameState);
  }

  // 游泳功能
  async handleMakeItSwim() {
    if (this.gameState.score < 60) {
      wx.showToast({ title: 'AI评分小于60，这鱼画的太抽象', icon: 'none', duration: 2000 });
      return;
    }

    if (this.gameState.drawingPaths.length === 0) {
      wx.showToast({ title: '请先画一条鱼', icon: 'none', duration: 1500 });
      return;
    }

    try {
      wx.showLoading({ title: '处理中...', mask: true });

      const boundingBox = this.calculateBoundingBox();
      if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) {
        throw new Error('无法计算有效的外接矩形');
      }

      const subImage = await this.cropSubImage(boundingBox);
      const scaledImage = await this.scaleImage(subImage);

      wx.hideLoading();

      this.gameState.scaledFishImage = scaledImage;
      this.showNameInputDialog(scaledImage);

    } catch (error) {
      wx.hideLoading();
      console.error('处理失败:', error);
      wx.showToast({ title: '处理失败，请重试', icon: 'none', duration: 2000 });
    }
  }

  // 工具方法
  calculateBoundingBox() {
    if (this.gameState.drawingPaths.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    this.gameState.drawingPaths.forEach(path => {
      path.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

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
          boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height
        );

        const tempCanvas = wx.createCanvas();
        tempCanvas.width = boundingBox.width;
        tempCanvas.height = boundingBox.height;

        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        resolve({ canvas: tempCanvas, width: boundingBox.width, height: boundingBox.height });
      } catch (error) {
        reject(error);
      }
    });
  }

  scaleImage(subImage) {
    return new Promise((resolve, reject) => {
      try {
        const { width, height } = subImage;
        const targetSize = 80;
        const isWidthLonger = width >= height;
        const scale = isWidthLonger ? targetSize / width : targetSize / height;

        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);

        const scaledCanvas = wx.createCanvas();
        scaledCanvas.width = scaledWidth;
        scaledCanvas.height = scaledHeight;

        const scaledCtx = scaledCanvas.getContext('2d');
        scaledCtx.drawImage(subImage.canvas, 0, 0, width, height, 0, 0, scaledWidth, scaledHeight);

        resolve({ canvas: scaledCanvas, width: scaledWidth, height: scaledHeight, scale: scale });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 数据库相关方法
  async getRankingDataWithImages() {
    const rankingData = await this.databaseManager.getRankingData(20);
    const rankingFishes = [];

    for (const fishData of rankingData) {
      try {
        const fishImage = await this.base64ToCanvas(fishData.base64);
        rankingFishes.push({
          fishData: fishData,
          fishImage: fishImage
        });
      } catch (error) {
        console.warn('创建排行榜鱼图像失败:', error);
      }
    }

    console.log(`成功创建 ${rankingFishes.length} 条排行榜鱼的图像`);
    return rankingFishes;
  }

  async loadAndShowDatabaseFishes() {
    if (this.isLoadingDatabaseFishes) {
      console.log('正在加载数据库鱼数据，请稍候...');
      return;
    }

    this.isLoadingDatabaseFishes = true;

    try {
      console.log('开始加载数据库中的鱼...');
      wx.showLoading({ title: '加载鱼缸中...', mask: true });

      const databaseFishes = await this.databaseManager.getRandomFishesFromDatabase(20);

      if (databaseFishes.length === 0) {
        console.log('没有从数据库获取到鱼数据');
        wx.hideLoading();
        this.isLoadingDatabaseFishes = false;
        return;
      }

      console.log(`开始创建 ${databaseFishes.length} 条数据库鱼...`);

      const fishCreationPromises = databaseFishes.map(fishData =>
        this.createFishFromDatabaseData(fishData)
      );

      const createdFishes = await Promise.all(fishCreationPromises);
      const validFishes = createdFishes.filter(fish => fish !== null);

      console.log(`成功创建 ${validFishes.length} 条数据库鱼`);

      validFishes.forEach(fish => {
        this.fishTank.addFish(fish);
      });

      this.databaseFishes = validFishes;

      wx.hideLoading();

      if (validFishes.length > 0) {
        wx.showToast({
          title: `已加载 ${validFishes.length} 条鱼`,
          icon: 'success',
          duration: 1500
        });
      }

    } catch (error) {
      console.error('加载数据库鱼数据失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载鱼缸数据失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.isLoadingDatabaseFishes = false;
    }
  }

  async createFishFromDatabaseData(fishData) {
    try {
      if (!fishData.base64) {
        console.warn('鱼数据没有base64字段，跳过创建');
        return null;
      }

      console.log(`为鱼 "${fishData.fishName || fishData.fishid || '未命名'}" 创建图像...`);

      const fishImage = await this.base64ToCanvas(fishData.base64);

      const fish = new Fish(
        fishImage.canvas,
        Math.random() * (config.screenWidth - fishImage.width),
        Math.random() * (config.screenHeight - fishImage.height),
        Math.random() < 0.5 ? -1 : 1,
        fishData.fishName || fishData.fishid || `数据库鱼_${Date.now()}`,
        fishData
      );

      console.log(`成功创建鱼: ${fish.name}`);
      return fish;
    } catch (error) {
      console.error('从数据库数据创建鱼对象失败:', error);
      return null;
    }
  }

  base64ToCanvas(base64Data) {
    return new Promise((resolve, reject) => {
      try {
        const image = wx.createImage();

        image.onload = () => {
          const canvas = wx.createCanvas();
          canvas.width = image.width;
          canvas.height = image.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);

          resolve({
            canvas: canvas,
            width: image.width,
            height: image.height
          });
        };

        image.onerror = (error) => {
          reject(new Error('图片加载失败: ' + error));
        };

        const base64WithPrefix = `data:image/png;base64,${base64Data}`;
        image.src = base64WithPrefix;

      } catch (error) {
        reject(error);
      }
    });
  }

  canvasToBase64(canvas) {
    return new Promise((resolve, reject) => {
      try {
        const base64 = canvas.toDataURL();
        const pureBase64 = base64.split(',')[1];
        resolve(pureBase64);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 动画控制
  startAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = (timestamp) => {
      if (!this.lastAnimationTime) this.lastAnimationTime = timestamp;
      const deltaTime = timestamp - this.lastAnimationTime;

      this.updateAnimation(deltaTime);
      this.uiManager.drawGameUI(this.gameState);

      this.lastAnimationTime = timestamp;
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  updateAnimation(deltaTime) {
    if (this.isSwimInterfaceVisible && this.fishTank) {
      this.fishTank.update(deltaTime);
    }
  }

  stopAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.lastAnimationTime = 0;
  }

  // 界面切换
  hideSwimInterface() {
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;
    this.stopAnimationLoop();
    this.uiManager.drawGameUI(this.gameState);
    console.log('公共鱼缸界面已隐藏');
  }

  // 对话框功能
  showNameInputDialog(scaledImage) {
    this.isDialogVisible = true;
    this.dialogData = { scaledImage: scaledImage };
    this.fishNameInput = `小鱼${Math.floor(Math.random() * 1000)}`;
    this.uiManager.drawGameUI(this.gameState);
    this.showKeyboardInput();
  }

  showKeyboardInput() {
    wx.showKeyboard({
      defaultValue: this.fishNameInput,
      maxLength: 20,
      multiple: false,
      confirmHold: false,
      confirmType: 'done',
      success: (res) => {
        console.log('键盘显示成功');
      },
      fail: (err) => {
        console.error('键盘显示失败:', err);
        this.confirmFishName();
      }
    });

    wx.onKeyboardInput((res) => {
      this.fishNameInput = res.value;
      this.uiManager.drawGameUI(this.gameState);
    });

    wx.onKeyboardConfirm((res) => {
      this.fishNameInput = res.value;
      this.confirmFishName();
    });

    wx.onKeyboardComplete((res) => {
      if (this.fishNameInput) {
        this.confirmFishName();
      } else {
        this.hideNameInputDialog();
      }
    });
  }

  hideNameInputDialog() {
    this.isDialogVisible = false;
    this.dialogData = null;
    this.fishNameInput = '';

    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();
    wx.hideKeyboard();

    this.uiManager.drawGameUI(this.gameState);
  }

  async confirmFishName() {
    if (!this.dialogData || !this.dialogData.scaledImage) {
      if (!this.gameState.scaledFishImage) {
        wx.showToast({ title: '处理失败，请重试', icon: 'none', duration: 2000 });
        this.hideNameInputDialog();
        return;
      }
    }

    const scaledImage = this.dialogData ? this.dialogData.scaledImage : this.gameState.scaledFishImage;

    if (!this.fishNameInput || !this.fishNameInput.trim()) {
      wx.showToast({ title: '请输入鱼的名字', icon: 'none', duration: 1500 });
      return;
    }

    const finalName = this.fishNameInput.trim();
    this.hideNameInputDialog();

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const base64Data = await this.canvasToBase64(scaledImage.canvas);
      const fishData = {
        uid: 12345,
        createdAt: new Date(),
        fishName: finalName,
        score: 0,
        star: 0,
        unstar: 0,
        base64: base64Data,
        imageWidth: scaledImage.width,
        imageHeight: scaledImage.height,
        createTimestamp: Date.now(),
        userInfo: this.getUserInfo()
      };

      const insertSuccess = await this.databaseManager.insertFishToDatabase(fishData);
      wx.hideLoading();

      if (insertSuccess) {
        wx.showToast({ title: `${finalName} 加入鱼缸！`, icon: 'success', duration: 1500 });
      } else {
        wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
    }

    if (!this.fishTank) {
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    const fish = new Fish(
      scaledImage.canvas,
      Math.random() * (config.screenWidth - scaledImage.width),
      Math.random() * (config.screenHeight - scaledImage.height),
      Math.random() < 0.5 ? -1 : 1,
      finalName
    );
    this.fishTank.addFish(fish);

    await this.showSwimInterface();
  }

  async showSwimInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = { mode: 'fishTank' };
    await this.loadAndShowDatabaseFishes();
    this.startAnimationLoop();
    console.log('公共鱼缸界面已显示，包含数据库鱼和用户鱼');
  }

  // 鱼详情功能
  showFishDetail(fish) {
    this.isFishDetailVisible = true;
    this.selectedFishData = {
      fish: fish,
      fishData: fish.fishData
    };
    this.uiManager.drawGameUI(this.gameState);
  }

  hideFishDetail() {
    this.isFishDetailVisible = false;
    this.selectedFishData = null;
    this.uiManager.drawGameUI(this.gameState);
  }

  async handleLikeAction() {
    if (!this.selectedFishData) return;

    const fishData = this.selectedFishData.fishData;
    if (!fishData._id) {
      console.warn('鱼数据没有ID，无法更新');
      return;
    }

    const newStarCount = (fishData.star || 0) + 1;
    const newScore = newStarCount - (fishData.unstar || 0);

    fishData.star = newStarCount;
    fishData.score = newScore;

    const updateSuccess = await this.databaseManager.updateFishScore(
      fishData._id,
      newScore,
      newStarCount,
      fishData.unstar || 0
    );

    if (updateSuccess) {
      console.log('点赞成功');
    } else {
      console.warn('点赞失败，但已更新本地数据');
    }

    this.uiManager.drawGameUI(this.gameState);
  }

  async handleDislikeAction() {
    if (!this.selectedFishData) return;

    const fishData = this.selectedFishData.fishData;
    if (!fishData._id) {
      console.warn('鱼数据没有ID，无法更新');
      return;
    }

    const newUnstarCount = (fishData.unstar || 0) + 1;
    const newScore = (fishData.star || 0) - newUnstarCount;

    fishData.unstar = newUnstarCount;
    fishData.score = newScore;

    const updateSuccess = await this.databaseManager.updateFishScore(
      fishData._id,
      newScore,
      fishData.star || 0,
      newUnstarCount
    );

    if (updateSuccess) {
      console.log('点踩成功');
    } else {
      console.warn('点踩失败，但已更新本地数据');
    }

    this.uiManager.drawGameUI(this.gameState);
  }

  // 触摸事件处理
  handleRankingInterfaceTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
      this.hideRankingInterface();
      return;
    }

    const refreshButtonX = config.screenWidth - 70;
    const refreshButtonY = 40;
    const refreshButtonWidth = 50;
    const refreshButtonHeight = 30;

    if (x >= refreshButtonX && x <= refreshButtonX + refreshButtonWidth &&
        y >= refreshButtonY && y <= refreshButtonY + refreshButtonHeight) {
      this.showRankingInterface();
      return;
    }

    if (this.rankingData && this.rankingData.fishes.length > 0) {
      const cardWidth = (config.screenWidth - 60) / 2;
      const cardHeight = 120;
      const startY = 150;

      for (let i = 0; i < this.rankingData.fishes.length; i++) {
        const fish = this.rankingData.fishes[i];
        const row = Math.floor(i / 2);
        const col = i % 2;

        const cardX = 20 + col * (cardWidth + 20);
        const cardY = startY + row * (cardHeight + 15);

        if (x >= cardX && x <= cardX + cardWidth &&
            y >= cardY && y <= cardY + cardHeight) {
          console.log('点击了排行榜中的鱼:', fish.fishName);
          break;
        }
      }
    }
  }

  handleSwimInterfaceTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
      this.hideSwimInterface();
      return;
    }

    if (this.fishTank) {
      for (const fish of this.fishTank.fishes) {
        const fishLeft = fish.x;
        const fishRight = fish.x + fish.width;
        const fishTop = fish.y;
        const fishBottom = fish.y + fish.height;

        if (x >= fishLeft && x <= fishRight &&
            y >= fishTop && y <= fishBottom) {
          console.log('点击了鱼:', fish.name);
          this.showFishDetail(fish);
          return;
        }
      }
    }

    console.log('公共鱼缸界面点击位置:', x, y);
  }

  handleFishDetailTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (!this.selectedFishData) return;

    const detailWidth = config.screenWidth - 60;
    const detailHeight = 380;
    const detailX = 30;
    const detailY = (config.screenHeight - detailHeight) / 2;

    const closeButtonSize = 30;
    const closeButtonX = detailX + detailWidth - closeButtonSize - 15;
    const closeButtonY = detailY + 10;

    if (x >= closeButtonX && x <= closeButtonX + closeButtonSize &&
        y >= closeButtonY && y <= closeButtonY + closeButtonSize) {
      this.hideFishDetail();
      return;
    }

    const fishImage = this.selectedFishData.fish.image;
    const maxImageWidth = detailWidth - 10;
    const maxImageHeight = 180;

    let imageWidth = fishImage.width;
    let imageHeight = fishImage.height;

    if (imageWidth > maxImageWidth) {
      const scale = maxImageWidth / imageWidth;
      imageWidth = maxImageWidth;
      imageHeight = imageHeight * scale;
    }

    if (imageHeight > maxImageHeight) {
      const scale = maxImageHeight / imageHeight;
      imageHeight = maxImageHeight;
      imageWidth = imageWidth * scale;
    }

    const imageX = detailX + (detailWidth - imageWidth) / 2;
    const imageY = detailY + 50;
    const textStartY = imageY + imageHeight + 20;

    const buttonWidth = (detailWidth - 60) / 2;
    const buttonY = textStartY + 75;
    const buttonHeight = 36;

    const likeButtonX = detailX + 20;
    const likeButtonY = buttonY;

    if (x >= likeButtonX && x <= likeButtonX + buttonWidth &&
        y >= likeButtonY && y <= likeButtonY + buttonHeight) {
      this.handleLikeAction();
      return;
    }

    const dislikeButtonX = detailX + buttonWidth + 40;
    const dislikeButtonY = buttonY;

    if (x >= dislikeButtonX && x <= dislikeButtonX + buttonWidth &&
        y >= dislikeButtonY && y <= dislikeButtonY + buttonHeight) {
      this.handleDislikeAction();
      return;
    }

    if (x >= detailX && x <= detailX + detailWidth &&
        y >= detailY && y <= detailY + detailHeight) {
      return;
    }

    this.hideFishDetail();
  }

  handleDialogTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    const confirmButtonX = dialogX + 20;
    const confirmButtonY = dialogY + dialogHeight - 60;
    const confirmButtonWidth = dialogWidth - 40;
    const confirmButtonHeight = 40;

    if (x >= confirmButtonX && x <= confirmButtonX + confirmButtonWidth &&
        y >= confirmButtonY && y <= confirmButtonY + confirmButtonHeight) {
      this.confirmFishName();
      return;
    }

    const cancelButtonX = dialogX + 20;
    const cancelButtonY = dialogY + dialogHeight - 110;
    const cancelButtonWidth = dialogWidth - 40;
    const cancelButtonHeight = 40;

    if (x >= cancelButtonX && x <= cancelButtonX + cancelButtonWidth &&
        y >= cancelButtonY && y <= cancelButtonY + cancelButtonHeight) {
      this.hideNameInputDialog();
      return;
    }

    const inputBoxX = dialogX + 20;
    const inputBoxY = dialogY + 70;
    const inputBoxWidth = dialogWidth - 40;
    const inputBoxHeight = 40;

    if (x >= inputBoxX && x <= inputBoxX + inputBoxWidth &&
        y >= inputBoxY && y <= inputBoxY + inputBoxHeight) {
      this.showKeyboardInput();
      return;
    }
  }

  // 工具方法
  getUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      return {
        nickName: userInfo.nickName || '匿名用户',
        avatarUrl: userInfo.avatarUrl || ''
      };
    } catch (error) {
      return {
        nickName: '匿名用户',
        avatarUrl: ''
      };
    }
  }
}

module.exports = EventHandler;
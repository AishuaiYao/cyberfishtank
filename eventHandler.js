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

    // 新增：云数据库状态
    this.cloudDb = null;
    this.isCloudDbInitialized = false;
    this.initCloudDatabase();

    // 新增：游泳界面状态
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;

    // 新增：排行榜界面状态
    this.isRankingInterfaceVisible = false;
    this.rankingData = null;
    this.isLoadingRanking = false;

    // 新增：鱼缸实例和动画相关
    this.fishTank = null;
    this.animationId = null;
    this.lastAnimationTime = 0;

    // 新增：对话框状态
    this.isDialogVisible = false;
    this.dialogData = null;
    this.fishNameInput = '';

    // 新增：数据库鱼数据缓存
    this.databaseFishes = [];
    this.isLoadingDatabaseFishes = false;

    // 新增：鱼详情界面状态
    this.isFishDetailVisible = false;
    this.selectedFishData = null;

    this.bindEvents();
  }

  // 新增：初始化云数据库（使用微信原生云开发）
  initCloudDatabase() {
    try {
      // 检查是否支持云开发
      if (!wx.cloud) {
        console.warn('当前环境不支持云开发');
        return;
      }

      // 初始化云开发
      wx.cloud.init({
        env: 'cloudservice-0g27c8ul6804ce3d', // 替换为你的云环境ID
        traceUser: true
      });

      // 获取数据库引用
      this.cloudDb = wx.cloud.database();
      this.isCloudDbInitialized = true;
      console.log('云数据库初始化成功');

      // 测试数据库连接
      this.testDatabaseConnection();
    } catch (error) {
      console.error('云数据库初始化失败:', error);
      this.isCloudDbInitialized = false;
    }
  }

  // 新增：测试数据库连接
  async testDatabaseConnection() {
    if (!this.isCloudDbInitialized) return;

    try {
      // 尝试读取一条数据来测试连接
      const result = await this.cloudDb.collection('fishes').limit(1).get();
      console.log('数据库连接测试成功');
    } catch (error) {
      console.warn('数据库连接测试失败，集合可能不存在:', error);
      // 这里可以添加创建集合的逻辑，或者只是记录警告
    }
  }

  // 修改：从数据库随机获取鱼数据，包含完整信息
  async getRandomFishesFromDatabase(count = 20) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法获取数据');
      return [];
    }

    try {
      console.log('开始从数据库获取随机鱼数据...');

      // 首先获取总数量
      const countResult = await this.cloudDb.collection('fishes').count();
      const totalCount = countResult.total;

      console.log(`数据库中共有 ${totalCount} 条鱼数据`);

      if (totalCount === 0) {
        console.log('数据库中没有鱼数据');
        return [];
      }

      // 如果总数小于需要的数量，直接获取所有
      const actualCount = Math.min(count, totalCount);

      // 随机跳过一些记录来模拟随机获取
      const skipCount = totalCount > actualCount ?
        Math.floor(Math.random() * (totalCount - actualCount)) : 0;

      console.log(`随机跳过 ${skipCount} 条记录，获取 ${actualCount} 条鱼数据`);

      // 获取随机鱼数据，包含所有需要的字段
      const result = await this.cloudDb.collection('fishes')
        .skip(skipCount)
        .limit(actualCount)
        .field({
          fishName: true,
          createdAt: true,
          score: true,
          star: true,
          unstar: true,
          base64: true,
          fishid: true,
          _id: true
        })
        .get();

      console.log(`成功获取 ${result.data.length} 条鱼数据`);

      // 过滤掉没有base64数据的记录
      const validFishes = result.data.filter(fish =>
        fish.base64 && fish.base64.length > 0
      );

      console.log(`其中 ${validFishes.length} 条有有效的base64数据`);

      return validFishes;
    } catch (error) {
      console.error('从数据库获取鱼数据失败:', error);
      return [];
    }
  }

  // 新增：获取排行榜数据
async getRankingData(limit = 20) {
  if (!this.isCloudDbInitialized || !this.cloudDb) {
    console.warn('云数据库未初始化，无法获取排行榜数据');
    return [];
  }

  try {
    console.log('开始获取排行榜数据...');

    // 按score字段降序排列，获取前limit条数据
    const result = await this.cloudDb.collection('fishes')
      .orderBy('score', 'desc')
      .limit(limit)
      .field({
        fishName: true,
        createdAt: true,
        score: true,
        star: true,
        unstar: true,
        base64: true,
        fishid: true,
        _id: true
      })
      .get();

    console.log(`成功获取 ${result.data.length} 条排行榜数据`);

    // 过滤掉没有base64数据的记录
    const validRankingData = result.data.filter(fish =>
      fish.base64 && fish.base64.length > 0
    );

    console.log(`其中 ${validRankingData.length} 条有有效的base64数据`);

    // 为每条鱼数据创建图像
    const rankingFishes = [];
    for (const fishData of validRankingData) {
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
  } catch (error) {
    console.error('获取排行榜数据失败:', error);
    return [];
  }
}

// 修改：显示排行榜界面
async showRankingInterface() {
  this.isRankingInterfaceVisible = true;
  this.isLoadingRanking = true;

  // 重绘UI显示加载状态
  this.uiManager.drawGameUI(this.gameState);

  try {
    console.log('加载排行榜数据...');

    // 获取排行榜数据（包含图像）
    const rankingFishes = await this.getRankingData(20);

    this.rankingData = {
      fishes: rankingFishes,
      lastUpdate: new Date()
    };

    console.log(`排行榜数据加载完成，共 ${rankingFishes.length} 条数据`);

  } catch (error) {
    console.error('加载排行榜数据失败:', error);
    this.rankingData = {
      fishes: [],
      lastUpdate: new Date()
    };
  } finally {
    this.isLoadingRanking = false;
    // 重绘UI显示排行榜
    this.uiManager.drawGameUI(this.gameState);
  }
}

  // 新增：隐藏排行榜界面
  hideRankingInterface() {
    this.isRankingInterfaceVisible = false;
    this.rankingData = null;
    this.uiManager.drawGameUI(this.gameState);
  }

  // 新增：处理排行榜界面的触摸事件
  handleRankingInterfaceTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 检查是否点击了返回按钮区域（左上角：20,40 宽50高30）
    if (x >= 20 && x <= 70 && // 20 + 50 = 70
        y >= 40 && y <= 70) { // 40 + 30 = 70
      this.hideRankingInterface();
      return;
    }

    // 检查是否点击了刷新按钮区域（右上角）
    const refreshButtonX = config.screenWidth - 70;
    const refreshButtonY = 40;
    const refreshButtonWidth = 50;
    const refreshButtonHeight = 30;

    if (x >= refreshButtonX && x <= refreshButtonX + refreshButtonWidth &&
        y >= refreshButtonY && y <= refreshButtonY + refreshButtonHeight) {
      this.showRankingInterface(); // 重新加载数据
      return;
    }

    // 检查是否点击了鱼卡片
    if (this.rankingData && this.rankingData.fishes.length > 0) {
      const cardWidth = (config.screenWidth - 60) / 2; // 两列布局
      const cardHeight = 120;
      const startY = 150; // 标题下方开始位置

      for (let i = 0; i < this.rankingData.fishes.length; i++) {
        const fish = this.rankingData.fishes[i];
        const row = Math.floor(i / 2);
        const col = i % 2;

        const cardX = 20 + col * (cardWidth + 20);
        const cardY = startY + row * (cardHeight + 15);

        if (x >= cardX && x <= cardX + cardWidth &&
            y >= cardY && y <= cardY + cardHeight) {
          console.log('点击了排行榜中的鱼:', fish.fishName);
          // 这里可以添加点击卡片后的操作，比如显示详情
          break;
        }
      }
    }
  }

  // 修改：处理跳转按钮点击
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

  // 新增：处理排行榜按钮点击
  async handleRanking() {
    await this.showRankingInterface();
  }

  // 修改：处理触摸开始事件 - 添加排行榜界面处理
  handleTouchStart(e) {
    // 如果排行榜界面可见，优先处理排行榜界面的点击
    if (this.isRankingInterfaceVisible) {
      this.handleRankingInterfaceTouch(e);
      return;
    }

    // 如果鱼详情界面可见，优先处理详情界面的点击
    if (this.isFishDetailVisible) {
      this.handleFishDetailTouch(e);
      return;
    }

    // 如果对话框可见，优先处理对话框的点击
    if (this.isDialogVisible) {
      this.handleDialogTouch(e);
      return;
    }

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

  // 其他现有方法保持不变...
  // [这里保留所有其他现有方法，包括base64ToCanvas, createFishFromDatabaseData, loadAndShowDatabaseFishes等]

  // 修改：将base64数据转换为canvas图像
  base64ToCanvas(base64Data) {
    return new Promise((resolve, reject) => {
      try {
        // 创建Image对象
        const image = wx.createImage();

        image.onload = () => {
          // 创建canvas来绘制图像
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

        // 添加base64前缀
        const base64WithPrefix = `data:image/png;base64,${base64Data}`;
        image.src = base64WithPrefix;

      } catch (error) {
        reject(error);
      }
    });
  }

  // 修改：从数据库鱼数据创建鱼对象，保存完整数据
  async createFishFromDatabaseData(fishData) {
    try {
      if (!fishData.base64) {
        console.warn('鱼数据没有base64字段，跳过创建');
        return null;
      }

      console.log(`为鱼 "${fishData.fishName || fishData.fishid || '未命名'}" 创建图像...`);

      // 将base64转换为canvas图像
      const fishImage = await this.base64ToCanvas(fishData.base64);

      // 创建鱼对象，保存完整的数据库数据
      const fish = new Fish(
        fishImage.canvas,
        Math.random() * (config.screenWidth - fishImage.width),
        Math.random() * (config.screenHeight - fishImage.height),
        Math.random() < 0.5 ? -1 : 1,
        fishData.fishName || fishData.fishid || `数据库鱼_${Date.now()}`,
        fishData // 保存完整的数据库数据
      );

      console.log(`成功创建鱼: ${fish.name}`);
      return fish;
    } catch (error) {
      console.error('从数据库数据创建鱼对象失败:', error);
      return null;
    }
  }

  // 修改：加载并显示数据库中的鱼
  async loadAndShowDatabaseFishes() {
    if (this.isLoadingDatabaseFishes) {
      console.log('正在加载数据库鱼数据，请稍候...');
      return;
    }

    this.isLoadingDatabaseFishes = true;

    try {
      console.log('开始加载数据库中的鱼...');

      // 显示加载提示
      wx.showLoading({ title: '加载鱼缸中...', mask: true });

      // 从数据库获取随机鱼数据
      const databaseFishes = await this.getRandomFishesFromDatabase(20);

      if (databaseFishes.length === 0) {
        console.log('没有从数据库获取到鱼数据');
        wx.hideLoading();
        this.isLoadingDatabaseFishes = false;
        return;
      }

      console.log(`开始创建 ${databaseFishes.length} 条数据库鱼...`);

      // 批量创建鱼对象
      const fishCreationPromises = databaseFishes.map(fishData =>
        this.createFishFromDatabaseData(fishData)
      );

      const createdFishes = await Promise.all(fishCreationPromises);

      // 过滤掉创建失败的对象
      const validFishes = createdFishes.filter(fish => fish !== null);

      console.log(`成功创建 ${validFishes.length} 条数据库鱼`);

      // 添加到鱼缸
      validFishes.forEach(fish => {
        this.fishTank.addFish(fish);
      });

      // 缓存数据库鱼数据
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

  // 新增：更新鱼的评分
  async updateFishScore(fishId, newScore, starCount, unstarCount) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法更新数据');
      return false;
    }

    try {
      console.log(`更新鱼 ${fishId} 的评分: score=${newScore}, star=${starCount}, unstar=${unstarCount}`);

      const result = await this.cloudDb.collection('fishes').doc(fishId).update({
        data: {
          score: newScore,
          star: starCount,
          unstar: unstarCount,
          updateTime: new Date()
        }
      });

      console.log('鱼评分更新成功:', result);
      return true;
    } catch (error) {
      console.error('更新鱼评分失败:', error);
      return false;
    }
  }

  // 新增：显示鱼详情界面
  showFishDetail(fish) {
    this.isFishDetailVisible = true;
    this.selectedFishData = {
      fish: fish,
      fishData: fish.fishData // 数据库中的完整数据
    };

    // 重绘UI以显示详情界面
    this.uiManager.drawGameUI(this.gameState);
  }

  // 新增：隐藏鱼详情界面
  hideFishDetail() {
    this.isFishDetailVisible = false;
    this.selectedFishData = null;
    this.uiManager.drawGameUI(this.gameState);
  }

  // 新增：处理鱼详情界面的触摸事件
  handleFishDetailTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (!this.selectedFishData) return;

    const detailWidth = config.screenWidth - 60; // 与UI中保持一致
    const detailHeight = 380; // 与UI中保持一致
    const detailX = 30;
    const detailY = (config.screenHeight - detailHeight) / 2;

    // 检查关闭按钮点击（右上角X）
    const closeButtonSize = 30;
    const closeButtonX = detailX + detailWidth - closeButtonSize - 15; // 调整位置
    const closeButtonY = detailY + 10;

    if (x >= closeButtonX && x <= closeButtonX + closeButtonSize &&
        y >= closeButtonY && y <= closeButtonY + closeButtonSize) {
      this.hideFishDetail();
      return;
    }

    // 计算文本起始位置（与UI中保持一致）
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

    // 检查点赞按钮点击
    const buttonWidth = (detailWidth - 60) / 2;
    const buttonY = textStartY + 75; // 与UI中保持一致
    const buttonHeight = 36; // 与UI中保持一致

    const likeButtonX = detailX + 20;
    const likeButtonY = buttonY;

    if (x >= likeButtonX && x <= likeButtonX + buttonWidth &&
        y >= likeButtonY && y <= likeButtonY + buttonHeight) {
      this.handleLikeAction();
      return;
    }

    // 检查点踩按钮点击
    const dislikeButtonX = detailX + buttonWidth + 40;
    const dislikeButtonY = buttonY;

    if (x >= dislikeButtonX && x <= dislikeButtonX + buttonWidth &&
        y >= dislikeButtonY && y <= dislikeButtonY + buttonHeight) {
      this.handleDislikeAction();
      return;
    }

    // 如果点击了对话框其他区域，不执行任何操作（保持对话框打开）
    if (x >= detailX && x <= detailX + detailWidth &&
        y >= detailY && y <= detailY + detailHeight) {
      return;
    }

    // 点击对话框外部区域，关闭对话框
    this.hideFishDetail();
  }

  // 修改：处理点赞动作 - 移除提示弹窗
  async handleLikeAction() {
    if (!this.selectedFishData) return;

    const fishData = this.selectedFishData.fishData;
    if (!fishData._id) {
      console.warn('鱼数据没有ID，无法更新');
      return;
    }

    // 更新本地数据
    const newStarCount = (fishData.star || 0) + 1;
    const newScore = newStarCount - (fishData.unstar || 0);

    fishData.star = newStarCount;
    fishData.score = newScore;

    // 更新数据库
    const updateSuccess = await this.updateFishScore(
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

    // 重绘UI以更新显示
    this.uiManager.drawGameUI(this.gameState);
  }

  // 修改：处理点踩动作 - 移除提示弹窗
  async handleDislikeAction() {
    if (!this.selectedFishData) return;

    const fishData = this.selectedFishData.fishData;
    if (!fishData._id) {
      console.warn('鱼数据没有ID，无法更新');
      return;
    }

    // 更新本地数据
    const newUnstarCount = (fishData.unstar || 0) + 1;
    const newScore = (fishData.star || 0) - newUnstarCount;

    fishData.unstar = newUnstarCount;
    fishData.score = newScore;

    // 更新数据库
    const updateSuccess = await this.updateFishScore(
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

    // 重绘UI以更新显示
    this.uiManager.drawGameUI(this.gameState);
  }

  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
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

  // 修改：处理鱼缸功能 - 现在会加载数据库中的鱼
  async handleFishTank() {
    // 显示鱼缸界面
    await this.showFishTankInterface();
  }

  // 修改：显示鱼缸界面 - 现在会加载数据库中的鱼
  async showFishTankInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = {
      mode: 'fishTank'
    };

    // 确保鱼缸实例存在
    if (!this.fishTank) {
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 清空现有鱼（除了当前用户画的鱼）
    const currentUserFish = this.fishTank.fishes.filter(fish =>
      !this.databaseFishes.includes(fish)
    );
    this.fishTank.fishes = currentUserFish;

    // 加载数据库中的鱼
    await this.loadAndShowDatabaseFishes();

    this.startAnimationLoop();
    console.log('鱼缸界面已显示，包含数据库鱼和用户鱼');
  }

  // 修改：处理游泳界面的触摸事件 - 增加点击鱼的检测
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

    // 新增：检查是否点击了鱼
    if (this.fishTank) {
      for (const fish of this.fishTank.fishes) {
        // 简单的矩形碰撞检测
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

      // 保存缩放后的图像到游戏状态
      this.gameState.scaledFishImage = scaledImage;

      // 新增：显示命名对话框
      this.showNameInputDialog(scaledImage);

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

  // 新增：显示命名对话框
  showNameInputDialog(scaledImage) {
    this.isDialogVisible = true;
    this.dialogData = {
      scaledImage: scaledImage
    };
    // 设置默认名字
    this.fishNameInput = `小鱼${Math.floor(Math.random() * 1000)}`;

    // 重绘UI以显示对话框
    this.uiManager.drawGameUI(this.gameState);

    // 使用微信小游戏的输入框API
    this.showKeyboardInput();
  }

  // 新增：显示键盘输入
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
        // 如果键盘显示失败，使用默认名字
        this.confirmFishName();
      }
    });

    // 监听键盘输入事件
    wx.onKeyboardInput((res) => {
      this.fishNameInput = res.value;
      // 实时更新UI显示
      this.uiManager.drawGameUI(this.gameState);
    });

    // 监听键盘确认事件
    wx.onKeyboardConfirm((res) => {
      this.fishNameInput = res.value;
      this.confirmFishName();
    });

    // 监听键盘关闭事件
    wx.onKeyboardComplete((res) => {
      // 如果用户直接关闭键盘，使用当前输入的值
      if (this.fishNameInput) {
        this.confirmFishName();
      } else {
        this.hideNameInputDialog();
      }
    });
  }

  // 新增：隐藏命名对话框
  hideNameInputDialog() {
    this.isDialogVisible = false;
    this.dialogData = null;
    this.fishNameInput = '';

    // 移除键盘监听
    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();

    // 隐藏键盘
    wx.hideKeyboard();

    // 重绘UI以隐藏对话框
    this.uiManager.drawGameUI(this.gameState);
  }

  // 新增：处理对话框触摸事件
  handleDialogTouch(e) {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 检查确认按钮点击
    const confirmButtonX = dialogX + 20;
    const confirmButtonY = dialogY + dialogHeight - 60;
    const confirmButtonWidth = dialogWidth - 40;
    const confirmButtonHeight = 40;

    if (x >= confirmButtonX && x <= confirmButtonX + confirmButtonWidth &&
        y >= confirmButtonY && y <= confirmButtonY + confirmButtonHeight) {
      this.confirmFishName();
      return;
    }

    // 检查取消按钮点击
    const cancelButtonX = dialogX + 20;
    const cancelButtonY = dialogY + dialogHeight - 110;
    const cancelButtonWidth = dialogWidth - 40;
    const cancelButtonHeight = 40;

    if (x >= cancelButtonX && x <= cancelButtonX + cancelButtonWidth &&
        y >= cancelButtonY && y <= cancelButtonY + cancelButtonHeight) {
      this.hideNameInputDialog();
      return;
    }

    // 点击输入框区域也触发键盘
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

  // 修改：确认鱼名字 - 现在会同时显示数据库鱼和用户鱼
  async confirmFishName() {
    // 修复：检查 dialogData 是否存在
    if (!this.dialogData || !this.dialogData.scaledImage) {
      console.error('对话框数据异常，使用游戏状态中的图像');
      // 如果对话框数据异常，尝试使用游戏状态中的图像
      if (!this.gameState.scaledFishImage) {
        wx.showToast({
          title: '处理失败，请重试',
          icon: 'none',
          duration: 2000
        });
        this.hideNameInputDialog();
        return;
      }
    }

    const scaledImage = this.dialogData ? this.dialogData.scaledImage : this.gameState.scaledFishImage;

    if (!this.fishNameInput || !this.fishNameInput.trim()) {
      wx.showToast({
        title: '请输入鱼的名字',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    const finalName = this.fishNameInput.trim();

    // 隐藏对话框
    this.hideNameInputDialog();

    // 新增：向数据库插入鱼数据
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const insertSuccess = await this.insertFishToDatabase(finalName, scaledImage);
      wx.hideLoading();

      if (insertSuccess) {
        wx.showToast({
          title: `${finalName} 加入鱼缸！`,
          icon: 'success',
          duration: 1500
        });
      } else {
        wx.showToast({
          title: `${finalName} 加入鱼缸！(本地)`,
          icon: 'success',
          duration: 1500
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: `${finalName} 加入鱼缸！(本地)`,
        icon: 'success',
        duration: 1500
      });
    }

    // 创建鱼缸并添加鱼
    if (!this.fishTank) {
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 添加用户画的鱼到鱼缸
    const fish = new Fish(
      scaledImage.canvas,
      Math.random() * (config.screenWidth - scaledImage.width),
      Math.random() * (config.screenHeight - scaledImage.height),
      Math.random() < 0.5 ? -1 : 1,
      finalName // 传递鱼名字
    );
    this.fishTank.addFish(fish);

    // 显示游泳界面（现在统一为公共鱼缸）
    this.showSwimInterface();
  }

  // 修改：显示游泳界面 - 现在会加载数据库中的鱼
  async showSwimInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = {
      mode: 'fishTank' // 统一使用鱼缸模式
    };

    // 加载数据库中的鱼
    await this.loadAndShowDatabaseFishes();

    // 启动动画循环
    this.startAnimationLoop();

    console.log('公共鱼缸界面已显示，包含数据库鱼和用户鱼');
  }

  // 新增：启动动画循环
  startAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = (timestamp) => {
      if (!this.lastAnimationTime) this.lastAnimationTime = timestamp;
      const deltaTime = timestamp - this.lastAnimationTime;

      // 更新动画状态
      this.updateAnimation(deltaTime);

      // 重绘UI
      this.uiManager.drawGameUI(this.gameState);

      this.lastAnimationTime = timestamp;
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  // 新增：更新动画
  updateAnimation(deltaTime) {
    if (this.isSwimInterfaceVisible && this.fishTank) {
      this.fishTank.update(deltaTime);
    }
  }

  // 新增：停止动画循环
  stopAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.lastAnimationTime = 0;
  }

  // 新增：隐藏游泳界面
  hideSwimInterface() {
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;
    this.stopAnimationLoop();

    // 重绘UI以返回主界面
    this.uiManager.drawGameUI(this.gameState);

    console.log('公共鱼缸界面已隐藏');
  }

  // 向数据库插入鱼数据（原有方法保持不变）
  async insertFishToDatabase(fishName, scaledImage) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，跳过数据插入');
      return false;
    }

    try {
      // 获取当前时间
      const now = new Date();

      // 新增：将鱼的图片转换为base64
      let base64Data = '';
      try {
        base64Data = await this.canvasToBase64(scaledImage.canvas);
        console.log('Base64数据生成成功，长度:', base64Data.length);
      } catch (base64Error) {
        console.warn('Base64转换失败，使用空字符串:', base64Error);
        base64Data = '';
      }

      // 准备插入的数据
      const fishData = {
        uid: 12345, // int 默认的
        createdAt: now, // 日期对象，云开发会自动处理
        fishName: fishName, // varchar 鱼的名字
        score: 0, // int 当前评分
        star: 0, // int 默认
        unstar: 0, // int 默认
        base64: base64Data, // 新增：鱼的base64图片数据
        // 添加一些额外信息
        imageWidth: scaledImage ? scaledImage.width : 0,
        imageHeight: scaledImage ? scaledImage.height : 0,
        createTimestamp: Date.now(), // 时间戳
        // 添加用户信息（如果有）
        userInfo: this.getUserInfo()
      };

      console.log('准备插入鱼数据:', {
        ...fishData,
        base64: `base64数据长度: ${base64Data.length}`
      });

      // 使用微信云开发数据库API
      const result = await this.cloudDb.collection('fishes').add({
        data: fishData
      });

      console.log('鱼数据插入成功:', result);
      return true;
    } catch (error) {
      console.error('数据库插入失败:', error);

      // 如果是集合不存在的错误，尝试创建集合
      if (error.errCode === -502005) {
        console.log('检测到集合不存在，尝试使用备用方案...');
        return await this.insertWithBackupMethod(fishName, scaledImage);
      }

      return false;
    }
  }

  // 将canvas转换为base64（原有方法保持不变）
  canvasToBase64(canvas) {
    return new Promise((resolve, reject) => {
      try {
        // 微信小游戏环境使用toDataURL
        const base64 = canvas.toDataURL();
        // 移除data:image/png;base64,前缀，只保留纯base64数据
        const pureBase64 = base64.split(',')[1];
        resolve(pureBase64);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 备用插入方法（原有方法保持不变）
  async insertWithBackupMethod(fishName, scaledImage) {
    try {
      // 新增：将鱼的图片转换为base64
      let base64Data = '';
      try {
        base64Data = await this.canvasToBase64(scaledImage.canvas);
        console.log('备用方案Base64数据生成成功，长度:', base64Data.length);
      } catch (base64Error) {
        console.warn('备用方案Base64转换失败:', base64Error);
        base64Data = '';
      }

      // 使用更简单的数据结构，避免字段类型问题
      const simpleFishData = {
        uid: 12345,
        fish_name: fishName,
        score: 0,
        star_count: 0,
        unstar_count: 0,
        base64: base64Data, // 新增：鱼的base64图片数据
        create_time: new Date(),
        timestamp: Date.now()
      };

      console.log('使用备用方案插入数据:', {
        ...simpleFishData,
        base64: `base64数据长度: ${base64Data.length}`
      });

      const result = await this.cloudDb.collection('fishes').add({
        data: simpleFishData
      });

      console.log('备用方案插入成功:', result);
      return true;
    } catch (backupError) {
      console.error('备用方案也失败了:', backupError);
      return false;
    }
  }

  // 获取用户信息（原有方法保持不变）
  getUserInfo() {
    try {
      // 尝试获取用户信息
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
        const targetSize = 80; // 稍微增大目标尺寸

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

// 修改：鱼类定义，添加数据库数据属性
class Fish {
  constructor(image, x, y, direction = 1, name = '未命名', fishData = null) {
    this.image = image;
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.name = name; // 鱼名字
    this.fishData = fishData; // 新增：保存完整的数据库数据
    this.phase = Math.random() * Math.PI * 2;
    this.amplitude = 8; // 减小振幅
    this.speed = 0.5 + Math.random() * 1; // 随机速度
    this.vx = this.speed * this.direction;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.width = image.width;
    this.height = image.height;
    this.peduncle = 0.4;
    this.tailEnd = Math.floor(this.width * this.peduncle);
    this.time = 0;

    // 游动区域边界（矩形框内）
    this.tankPadding = 20; // 距离边界的padding

    // 创建透明背景的鱼图像
    this.transparentImage = this.createTransparentFishImage(image);
  }

  // 新增：创建透明背景的鱼图像
  createTransparentFishImage(originalImage) {
    const tempCanvas = wx.createCanvas();
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');

    // 绘制原始图像
    tempCtx.drawImage(originalImage, 0, 0);

    // 获取图像数据
    const imageData = tempCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    // 将白色和接近白色的像素设为透明
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 如果是白色或接近白色的背景，设为透明
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // 设置alpha为0（完全透明）
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    return tempCanvas;
  }

  update(deltaTime) {
    this.time += deltaTime / 1000; // 转换为秒

    // 更新位置
    this.x += this.vx;
    this.y += this.vy;

    // 边界检查 - 限制在矩形框内
    const minX = this.tankPadding;
    const maxX = this.canvasWidth - this.width - this.tankPadding;
    const minY = this.tankPadding + 150; // 考虑到标题区域
    const maxY = this.canvasHeight - this.height - this.tankPadding;

    if (this.x <= minX) {
      this.x = minX;
      this.direction = 1;
      this.vx = Math.abs(this.vx);
    } else if (this.x >= maxX) {
      this.x = maxX;
      this.direction = -1;
      this.vx = -Math.abs(this.vx);
    }

    if (this.y <= minY) {
      this.y = minY;
      this.vy = Math.abs(this.vy) * 0.5;
    } else if (this.y >= maxY) {
      this.y = maxY;
      this.vy = -Math.abs(this.vy) * 0.5;
    }

    // 添加随机运动
    if (Math.random() < 0.02) {
      this.vy += (Math.random() - 0.5) * 0.3;
    }

    // 限制速度
    this.vx = Math.max(-2, Math.min(2, this.vx));
    this.vy = Math.max(-1, Math.min(1, this.vy));
  }

  setCanvasSize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  draw(ctx) {
    const swimY = this.y + Math.sin(this.time * 2 + this.phase) * this.amplitude;
    this.drawWigglingFish(ctx, this.x, swimY, this.direction, this.time);
  }

  drawWigglingFish(ctx, x, y, direction, time) {
    const w = this.width;
    const h = this.height;

    if (direction === 1) {
      // 向右游动 - 使用透明背景的图像
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < w; i++) {
        let isTail = i < this.tailEnd;
        let t = isTail ? (this.tailEnd - i - 1) / (this.tailEnd - 1) : 0;
        let wiggle = isTail ? Math.sin(time * 5 + this.phase + t * 3) * t * 8 : 0;

        ctx.save();
        ctx.translate(i, wiggle);
        // 使用透明背景的图像
        ctx.drawImage(this.transparentImage, i, 0, 1, h, 0, 0, 1, h);
        ctx.restore();
      }
      ctx.restore();
    } else {
      // 向左游动 - 水平翻转，使用透明背景的图像
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      for (let i = 0; i < w; i++) {
        let isTail = i < this.tailEnd;
        let t = isTail ? (this.tailEnd - i - 1) / (this.tailEnd - 1) : 0;
        let wiggle = isTail ? Math.sin(time * 5 + this.phase + t * 3) * t * 8 : 0;

        ctx.save();
        ctx.translate(i, wiggle);
        // 使用透明背景的图像
        ctx.drawImage(this.transparentImage, i, 0, 1, h, 0, 0, 1, h);
        ctx.restore();
      }
      ctx.restore();
    }
  }
}

// 鱼缸类（保持不变）
class FishTank {
  constructor(ctx, width, height) {
    this.fishes = [];
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.tankPadding = 20; // 矩形框内边距
  }

  addFish(fish) {
    fish.setCanvasSize(this.width, this.height);
    this.fishes.push(fish);
  }

  update(deltaTime) {
    this.fishes.forEach(fish => {
      fish.update(deltaTime);
    });
  }

  draw() {
    const ctx = this.ctx;

    // 只绘制鱼缸区域，不要覆盖整个屏幕
    const tankX = this.tankPadding;
    const tankY = this.tankPadding + 130; // 考虑到标题区域
    const tankWidth = this.width - this.tankPadding * 2;
    const tankHeight = this.height - this.tankPadding - 150;

    // 只清除鱼缸区域，而不是整个屏幕
    ctx.clearRect(tankX, tankY, tankWidth, tankHeight);

    // 绘制鱼缸区域背景（白色）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(tankX, tankY, tankWidth, tankHeight);

    // 绘制矩形框 - 限制鱼游动的空间
    ctx.strokeStyle = '#E5E5EA';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]); // 虚线样式
    ctx.strokeRect(tankX, tankY, tankWidth, tankHeight);
    ctx.setLineDash([]); // 重置为实线

    // 绘制所有鱼
    this.fishes.forEach(fish => {
      fish.draw(ctx);
    });
  }

  startAnimation() {
    // 鱼缸的动画由EventHandler统一管理
  }
}

module.exports = EventHandler;
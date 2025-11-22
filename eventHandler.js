// eventHandler.js - 修复触摸事件处理
const { config, getAreaPositions } = require('./config.js');
const AIService = require('./aiService.js');
const DatabaseManager = require('./databaseManager.js');

// 导入各个模块
const MainTouchHandler = require('./touchHandlers/mainTouchHandler.js');
const RankingTouchHandler = require('./touchHandlers/rankingTouchHandler.js');
const FishDetailTouchHandler = require('./touchHandlers/fishDetailTouchHandler.js');
const DialogTouchHandler = require('./touchHandlers/dialogTouchHandler.js');
const SwimTouchHandler = require('./touchHandlers/swimTouchHandler.js');
const FishProcessor = require('./fishManager/fishProcessor.js');
const FishAnimator = require('./fishManager/fishAnimator.js');
const FishDataManager = require('./fishManager/fishDataManager.js');

const { Fish, FishTank } = require('./fishCore.js');

class EventHandler {
  constructor(canvas, ctx, gameState, uiManager) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.positions = getAreaPositions();
    this.aiService = new AIService();
    this.databaseManager = new DatabaseManager();

    // 初始化各个模块
    this.touchHandlers = {
      main: new MainTouchHandler(this),
      ranking: new RankingTouchHandler(this),
      fishDetail: new FishDetailTouchHandler(this),
      dialog: new DialogTouchHandler(this),
      swim: new SwimTouchHandler(this)
    };

    this.fishManager = {
      processor: new FishProcessor(this),
      animator: new FishAnimator(this),
      data: new FishDataManager(this)
    };

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
    this.databaseFishes = [];

    // 加载状态
    this.isLoadingRanking = false;
    this.isLoadingDatabaseFishes = false;

    // 新增：记录已添加的用户鱼名称，防止重复添加
    this.addedUserFishNames = new Set();

    this.bindEvents();
  }

  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
  }

  // 修复：分别处理不同的触摸事件
  handleTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    console.log('触摸开始:', x, y, '界面状态:', {
      ranking: this.isRankingInterfaceVisible,
      fishDetail: this.isFishDetailVisible,
      dialog: this.isDialogVisible,
      swim: this.isSwimInterfaceVisible
    });

    // 根据当前界面状态路由到对应的触摸处理器
    if (this.isRankingInterfaceVisible) {
      console.log('路由到排行榜处理器');
      this.touchHandlers.ranking.handleTouchStart(x, y);
      // 立即处理触摸，因为返回按钮需要响应点击
      this.touchHandlers.ranking.handleTouch(x, y);
    } else if (this.isFishDetailVisible) {
      this.touchHandlers.fishDetail.handleTouch(x, y);
    } else if (this.isDialogVisible) {
      this.touchHandlers.dialog.handleTouch(x, y);
    } else if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouch(x, y);
    } else {
      // 主界面
      this.touchHandlers.main.handleTouchStart(x, y);
    }
  }

  handleTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 根据界面状态路由
    if (this.isRankingInterfaceVisible) {
      this.touchHandlers.ranking.handleTouchMove(x, y);
    } else if (this.isFishDetailVisible) {
      // 鱼详情界面不需要处理移动
    } else if (this.isDialogVisible) {
      // 对话框界面不需要处理移动
    } else if (this.isSwimInterfaceVisible) {
      // 游泳界面不需要处理移动
    } else {
      // 主界面
      this.touchHandlers.main.handleTouchMove(x, y);
    }
  }

  handleTouchEnd(e) {
    console.log('触摸结束');

    // 触摸结束事件
    if (this.isRankingInterfaceVisible) {
      this.touchHandlers.ranking.handleTouchEnd();
    } else if (this.isFishDetailVisible) {
      // 鱼详情界面不需要处理触摸结束
    } else if (this.isDialogVisible) {
      // 对话框界面不需要处理触摸结束
    } else if (this.isSwimInterfaceVisible) {
      // 游泳界面不需要处理触摸结束
    } else {
      // 主界面
      this.touchHandlers.main.finishDrawing();
    }
  }

  handleTouchCancel(e) {
    this.gameState.isDrawing = false;
    if (this.isRankingInterfaceVisible) {
      this.touchHandlers.ranking.handleTouchEnd();
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
      const { FishTank } = require('./fishCore.js');
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 清空当前鱼缸，但保留用户鱼（通过名称校验防止重复）
    const currentUserFish = this.fishTank.fishes.filter(fish =>
      this.addedUserFishNames.has(fish.name)
    );
    this.fishTank.fishes = currentUserFish;

    await this.fishManager.data.loadAndShowDatabaseFishes();

    this.fishManager.animator.startAnimationLoop();
    console.log('鱼缸界面已显示，包含数据库鱼和用户鱼');
  }

  hideSwimInterface() {
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;
    this.fishManager.animator.stopAnimationLoop();
    this.uiManager.drawGameUI(this.gameState);
    console.log('公共鱼缸界面已隐藏');
  }

  // 排行榜功能
  async handleRanking() {
    await this.showRankingInterface();
  }

  async showRankingInterface() {
    this.isRankingInterfaceVisible = true;
    this.isLoadingRanking = true;

    // 重置滚动位置
    this.touchHandlers.ranking.resetScroll();

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
    // 重置滚动位置
    this.touchHandlers.ranking.resetScroll();
    this.uiManager.drawGameUI(this.gameState);
    console.log('排行榜界面已隐藏');
  }


// 在 eventHandler.js 中的 handleMakeItSwim 方法
async handleMakeItSwim() {
  if (this.gameState.score < 60) {
    wx.showToast({ title: 'AI评分小于60，这鱼画的太抽象', icon: 'none', duration: 2000 });
    return;
  }

  if (this.gameState.drawingPaths.length === 0) {
    wx.showToast({ title: '请先画一条鱼', icon: 'none', duration: 1500 });
    return;
  }

  // 确保 positions 已初始化
  if (!this.positions) {
    this.positions = getAreaPositions();
  }

  try {
    await this.fishManager.processor.processFishImage();
  } catch (error) {
    console.error('处理鱼图像失败:', error);
    wx.showToast({ title: '处理失败，请重试', icon: 'none', duration: 2000 });
  }
}
  // 获取排行榜数据（带图片）- 修改：按照最终评分（点赞-点踩）由大到小排序
  async getRankingDataWithImages() {
    const rankingData = await this.databaseManager.getRankingData(20);
    const rankingFishes = [];

    for (const fishData of rankingData) {
      try {
        const fishImage = await this.fishManager.data.base64ToCanvas(fishData.base64);
        rankingFishes.push({
          fishData: fishData,
          fishImage: fishImage
        });
      } catch (error) {
        console.warn('创建排行榜鱼图像失败:', error);
      }
    }

    // 修改：按照最终评分（点赞数-点踩数）由大到小排序
    rankingFishes.sort((a, b) => {
      // 计算最终评分：点赞数 - 点踩数
      const finalScoreA = (a.fishData.star || 0) - (a.fishData.unstar || 0);
      const finalScoreB = (b.fishData.star || 0) - (b.fishData.unstar || 0);
      return finalScoreB - finalScoreA; // 降序排列
    });

    console.log(`成功创建 ${rankingFishes.length} 条排行榜鱼的图像，已按最终评分（点赞-点踩）降序排列`);
    return rankingFishes;
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

  // 检查鱼名是否重复
  async checkFishNameExists(fishName) {
    if (!this.databaseManager.isCloudDbInitialized || !this.databaseManager.cloudDb) {
      console.warn('云数据库未初始化，跳过名称检查');
      return false;
    }

    try {
      const result = await this.databaseManager.cloudDb.collection('fishes')
        .where({
          fishName: fishName
        })
        .get();

      return result.data.length > 0;
    } catch (error) {
      console.error('检查鱼名失败:', error);
      return false;
    }
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

    // 检查名称是否已存在
    wx.showLoading({ title: '检查名称...', mask: true });

    try {
      const nameExists = await this.checkFishNameExists(finalName);
      wx.hideLoading();

      if (nameExists) {
        wx.showToast({
          title: `名称"${finalName}"已存在，请换一个`,
          icon: 'none',
          duration: 2000
        });
        return; // 名称重复，不继续后续逻辑
      }
    } catch (error) {
      wx.hideLoading();
      console.warn('名称检查失败，继续保存流程:', error);
      // 检查失败时继续流程，不阻止用户
    }

    // 名称可用，继续保存流程
    this.hideNameInputDialog();
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const base64Data = await this.fishManager.data.canvasToBase64(scaledImage.canvas);
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

    // 修复：检查鱼缸中是否已存在同名鱼，避免重复添加
    if (!this.fishTank) {
      const { Fish, FishTank } = require('./fishCore.js');
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 新增：检查鱼缸中是否已存在同名鱼
    const existingFish = this.findFishByName(finalName);
    if (existingFish) {
      console.log(`鱼 "${finalName}" 已存在于鱼缸中，跳过重复添加`);
      wx.showToast({
        title: `${finalName} 已在鱼缸中`,
        icon: 'none',
        duration: 1500
      });
    } else {
      // 只有不存在时才添加新鱼
      const { Fish } = require('./fishCore.js');
      const fish = new Fish(
        scaledImage.canvas,
        Math.random() * (config.screenWidth - scaledImage.width),
        Math.random() * (config.screenHeight - scaledImage.height),
        Math.random() < 0.5 ? -1 : 1,
        finalName
      );
      this.fishTank.addFish(fish);

      // 记录已添加的鱼名称
      this.addedUserFishNames.add(finalName);
      console.log(`成功添加新鱼: ${finalName}`);
    }

    await this.showSwimInterface();
  }

  // 新增：根据名称查找鱼缸中是否已存在同名鱼
  findFishByName(fishName) {
    if (!this.fishTank || !this.fishTank.fishes || this.fishTank.fishes.length === 0) {
      return null;
    }

    return this.fishTank.fishes.find(fish =>
      fish.name === fishName
    );
  }

  // 新增：检查鱼缸中是否已存在鱼的通用方法
  isFishAlreadyInTank(fishName, fishImage = null) {
    // 首先检查名称
    if (this.findFishByName(fishName)) {
      return true;
    }

    // 如果有图像数据，可以进一步检查图像相似性（可选）
    if (fishImage) {
      // 这里可以添加图像相似性检查逻辑
      // 暂时只做名称检查
    }

    return false;
  }

  // 新增：在进入鱼缸界面时校验所有鱼的名称，移除重复的鱼
  validateFishNamesInTank() {
    if (!this.fishTank || !this.fishTank.fishes || this.fishTank.fishes.length === 0) {
      return;
    }

    const uniqueNames = new Set();
    const fishesToRemove = [];

    // 找出重复名称的鱼
    for (const fish of this.fishTank.fishes) {
      if (uniqueNames.has(fish.name)) {
        fishesToRemove.push(fish);
        console.log(`检测到重复名称的鱼: ${fish.name}，将被移除`);
      } else {
        uniqueNames.add(fish.name);
      }
    }

    // 移除重复的鱼
    if (fishesToRemove.length > 0) {
      this.fishTank.fishes = this.fishTank.fishes.filter(fish =>
        !fishesToRemove.includes(fish)
      );
      console.log(`已移除 ${fishesToRemove.length} 条重复名称的鱼`);
    }
  }

  async showSwimInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = { mode: 'fishTank' };

    // 新增：在显示鱼缸界面时校验所有鱼的名称
    this.validateFishNamesInTank();

    await this.fishManager.data.loadAndShowDatabaseFishes();
    this.fishManager.animator.startAnimationLoop();
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
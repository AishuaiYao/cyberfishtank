// eventHandler.js - 彻底修复重复添加鱼和数据库鱼显示问题
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

    // 动画相关 - 统一管理鱼缸
    this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    this.databaseFishes = [];
    this.userFishes = []; // 专门存储用户鱼

    // 加载状态
    this.isLoadingRanking = false;
    this.isLoadingDatabaseFishes = false;

    // 防止重复提交的标志
    this.isProcessingFishSubmission = false;
    this.currentUserFishName = null;

    // 鱼缸初始化标志
    this.isFishTankInitialized = false;

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

  // 鱼缸功能 - 修复重复初始化和只显示本次绘制鱼的问题
  async handleFishTank() {
    await this.showFishTankInterface();
  }

  async showFishTankInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = { mode: 'fishTank' };

    console.log('显示鱼缸界面，当前状态:', {
      userFishes: this.userFishes.length,
      databaseFishes: this.databaseFishes.length,
      isInitialized: this.isFishTankInitialized
    });

    // 如果鱼缸未初始化，先初始化
    if (!this.isFishTankInitialized) {
      this.initializeFishTank();
      this.isFishTankInitialized = true;
    } else {
      // 如果已经初始化，确保所有鱼都在鱼缸中
      this.syncFishTank();
    }

    // 加载数据库鱼（如果还没有加载过或需要重新加载）
    if (this.databaseFishes.length === 0) {
      console.log('数据库鱼为空，开始加载数据库鱼...');
      await this.fishManager.data.loadAndShowDatabaseFishes();
    } else {
      console.log(`已有 ${this.databaseFishes.length} 条数据库鱼，跳过重新加载`);
    }

    this.fishManager.animator.startAnimationLoop();
    console.log('鱼缸界面已显示，用户鱼数量:', this.userFishes.length, '数据库鱼数量:', this.databaseFishes.length, '鱼缸总鱼数:', this.fishTank.fishes.length);
  }

  // 修复：统一初始化鱼缸 - 不要清空现有鱼
  initializeFishTank() {
    console.log('初始化鱼缸...');

    // 清空鱼缸，然后重新添加所有鱼
    this.fishTank.fishes = [];

    // 添加用户鱼
    this.userFishes.forEach((fish, index) => {
      console.log(`添加用户鱼 ${index + 1}: ${fish.name}`);
      this.fishTank.addFish(fish);
    });

    // 添加数据库鱼
    this.databaseFishes.forEach((fish, index) => {
      console.log(`添加数据库鱼 ${index + 1}: ${fish.name}`);
      this.fishTank.addFish(fish);
    });

    console.log('鱼缸初始化完成，总鱼数:', this.fishTank.fishes.length);
  }

  // 新增：同步鱼缸状态，确保所有鱼都在鱼缸中
  syncFishTank() {
    console.log('同步鱼缸状态...');

    // 获取当前鱼缸中的所有鱼
    const currentTankFishes = [...this.fishTank.fishes];

    // 检查用户鱼是否都在鱼缸中
    this.userFishes.forEach(userFish => {
      const existsInTank = currentTankFishes.some(tankFish =>
        tankFish.name === userFish.name &&
        tankFish.fishData === userFish.fishData
      );

      if (!existsInTank) {
        console.log(`添加缺失的用户鱼: ${userFish.name}`);
        this.fishTank.addFish(userFish);
      }
    });

    // 检查数据库鱼是否都在鱼缸中
    this.databaseFishes.forEach(dbFish => {
      const existsInTank = currentTankFishes.some(tankFish =>
        tankFish.name === dbFish.name &&
        tankFish.fishData?._id === dbFish.fishData?._id
      );

      if (!existsInTank) {
        console.log(`添加缺失的数据库鱼: ${dbFish.name}`);
        this.fishTank.addFish(dbFish);
      }
    });

    console.log('鱼缸同步完成，当前鱼数:', this.fishTank.fishes.length);
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

  // 游泳功能 - 修复重复调用
  async handleMakeItSwim() {
    // 防止重复点击
    if (this.isProcessingFishSubmission) {
      console.log('正在处理鱼提交，请稍候...');
      return;
    }

    if (this.gameState.score < 60) {
      wx.showToast({ title: 'AI评分小于60，这鱼画的太抽象', icon: 'none', duration: 2000 });
      return;
    }

    if (this.gameState.drawingPaths.length === 0) {
      wx.showToast({ title: '请先画一条鱼', icon: 'none', duration: 1500 });
      return;
    }

    this.isProcessingFishSubmission = true;

    try {
      await this.fishManager.processor.processFishImage();
    } catch (error) {
      console.error('处理鱼图像失败:', error);
      this.isProcessingFishSubmission = false;
    }
  }

  // 获取排行榜数据（带图片）
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

    console.log(`成功创建 ${rankingFishes.length} 条排行榜鱼的图像`);
    return rankingFishes;
  }

  // 对话框功能
  showNameInputDialog(scaledImage) {
    // 重置处理状态
    this.isProcessingFishSubmission = false;
    this.currentUserFishName = null;

    this.isDialogVisible = true;
    this.dialogData = { scaledImage: scaledImage };
    this.fishNameInput = `小鱼${Math.floor(Math.random() * 1000)}`;
    this.uiManager.drawGameUI(this.gameState);
    this.showKeyboardInput();
  }

  showKeyboardInput() {
    // 先清理之前的事件监听器
    this.cleanupKeyboardListeners();

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
        // 键盘显示失败时直接使用当前输入
        this.confirmFishName();
      }
    });

    // 绑定新的事件监听器
    this.keyboardInputCallback = (res) => {
      this.fishNameInput = res.value;
      this.uiManager.drawGameUI(this.gameState);
    };

    this.keyboardConfirmCallback = (res) => {
      this.fishNameInput = res.value;
      this.confirmFishName();
    };

    this.keyboardCompleteCallback = (res) => {
      if (this.fishNameInput) {
        this.confirmFishName();
      } else {
        this.hideNameInputDialog();
      }
    };

    wx.onKeyboardInput(this.keyboardInputCallback);
    wx.onKeyboardConfirm(this.keyboardConfirmCallback);
    wx.onKeyboardComplete(this.keyboardCompleteCallback);
  }

  // 清理键盘事件监听器
  cleanupKeyboardListeners() {
    if (this.keyboardInputCallback) {
      wx.offKeyboardInput(this.keyboardInputCallback);
      this.keyboardInputCallback = null;
    }
    if (this.keyboardConfirmCallback) {
      wx.offKeyboardConfirm(this.keyboardConfirmCallback);
      this.keyboardConfirmCallback = null;
    }
    if (this.keyboardCompleteCallback) {
      wx.offKeyboardComplete(this.keyboardCompleteCallback);
      this.keyboardCompleteCallback = null;
    }
  }

  hideNameInputDialog() {
    this.isDialogVisible = false;
    this.dialogData = null;
    this.fishNameInput = '';

    this.cleanupKeyboardListeners();
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

  // 确认鱼名 - 修复鱼添加逻辑
  async confirmFishName() {
    // 防止重复提交
    if (this.isProcessingFishSubmission) {
      console.log('正在处理鱼提交，请勿重复操作');
      return;
    }

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

    // 检查是否正在处理同一条鱼
    if (this.currentUserFishName === finalName) {
      console.log('正在处理同一条鱼，跳过重复提交');
      return;
    }

    // 检查是否已经存在同名的用户鱼
    const existingFish = this.userFishes.find(fish => fish.name === finalName);
    if (existingFish) {
      wx.showToast({
        title: `名称"${finalName}"已存在`,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 设置处理状态
    this.isProcessingFishSubmission = true;
    this.currentUserFishName = finalName;

    // 检查名称是否已存在（数据库）
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
        // 重置处理状态
        this.isProcessingFishSubmission = false;
        this.currentUserFishName = null;
        return;
      }
    } catch (error) {
      wx.hideLoading();
      console.warn('名称检查失败，继续保存流程:', error);
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
        score: this.gameState.score || 0,
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

      // 添加到本地鱼缸
      await this.addFishToLocalTank(scaledImage, finalName, fishData);

    } catch (error) {
      wx.hideLoading();
      console.error('保存鱼数据失败:', error);
      wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });

      // 即使保存失败，也添加到本地鱼缸
      await this.addFishToLocalTank(scaledImage, finalName, null);
    } finally {
      // 重置处理状态
      this.isProcessingFishSubmission = false;
      this.currentUserFishName = null;
    }
  }

  // 修复：添加到本地鱼缸的逻辑
  async addFishToLocalTank(scaledImage, fishName, fishData = null) {
    // 再次检查是否已经存在同名的用户鱼
    const existingFish = this.userFishes.find(fish => fish.name === fishName);
    if (existingFish) {
      console.log(`鱼 "${fishName}" 已经存在，跳过添加`);
      await this.showSwimInterface();
      return;
    }

    // 创建鱼对象
    const fish = new Fish(
      scaledImage.canvas,
      Math.random() * (config.screenWidth - scaledImage.width),
      Math.random() * (config.screenHeight - scaledImage.height),
      Math.random() < 0.5 ? -1 : 1,
      fishName,
      fishData
    );

    // 添加到用户鱼列表
    this.userFishes.push(fish);

    console.log(`成功添加鱼 "${fishName}" 到用户鱼列表，当前用户鱼数量: ${this.userFishes.length}`);

    // 如果鱼缸已经初始化，直接添加到鱼缸
    if (this.isFishTankInitialized) {
      this.fishTank.addFish(fish);
      console.log(`直接添加到鱼缸，当前鱼缸鱼数: ${this.fishTank.fishes.length}`);
    }

    // 显示游泳界面 - 这里会确保数据库鱼也被加载
    await this.showSwimInterface();
  }

  // 修复：showSwimInterface 方法，确保数据库鱼正确加载
  async showSwimInterface() {
    this.isSwimInterfaceVisible = true;
    this.swimInterfaceData = { mode: 'fishTank' };

    console.log('显示游泳界面，当前状态:', {
      userFishes: this.userFishes.length,
      databaseFishes: this.databaseFishes.length,
      tankFishes: this.fishTank.fishes.length,
      isInitialized: this.isFishTankInitialized
    });

    // 确保鱼缸已初始化
    if (!this.isFishTankInitialized) {
      this.initializeFishTank();
      this.isFishTankInitialized = true;
    } else {
      // 同步鱼缸状态，确保所有鱼都在
      this.syncFishTank();
    }

    // 关键修复：确保数据库鱼被加载
    if (this.databaseFishes.length === 0) {
      console.log('数据库鱼为空，开始加载数据库鱼...');
      await this.fishManager.data.loadAndShowDatabaseFishes();
    } else {
      console.log(`已有 ${this.databaseFishes.length} 条数据库鱼，跳过重新加载`);
    }

    this.fishManager.animator.startAnimationLoop();
    console.log('公共鱼缸界面已显示，总鱼数:', this.fishTank.fishes.length);
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
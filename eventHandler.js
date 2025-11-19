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
      const { FishTank } = require('./fishManager.js');
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 清空当前鱼缸，只保留用户鱼
    const currentUserFish = this.fishTank.fishes.filter(fish =>
      !this.databaseFishes.includes(fish)
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

    await this.fishManager.processor.processFishImage();
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

    if (!this.fishTank) {
      const { Fish, FishTank } = require('./fishManager.js');
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    const { Fish } = require('./fishManager.js');
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
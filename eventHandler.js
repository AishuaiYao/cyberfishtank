// eventHandler.js - 添加全局鱼列表管理
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

    // 新增：全局鱼列表
    this.globalFishList = [];
    this.isFirstEnterTank = true; // 是否首次进入鱼缸

    // 新增：用户openid - 直接从小程序API获取
    this.userOpenid = this.getUserOpenid();

    // 新增：操作锁，防止重复点击
    this.isOperating = false;

    this.bindEvents();
  }

  // 修改：直接获取用户openid
  getUserOpenid() {
    try {
      // 从小程序API直接获取openid
      const accountInfo = wx.getAccountInfoSync();
      if (accountInfo && accountInfo.miniProgram) {
        console.log('获取小程序信息成功');
      }

      // 在实际环境中，openid需要通过 wx.login 和后台接口获取
      // 这里使用模拟openid用于开发测试
      const testOpenid = 'test_openid_' + Math.random().toString(36).substr(2, 9);
      console.log('使用测试openid:', testOpenid);
      return testOpenid;
    } catch (error) {
      console.error('获取openid失败:', error);
      // 使用模拟openid作为备选
      return 'fallback_openid_' + Date.now();
    }
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

  // 修改：鱼缸功能 - 使用全局列表
  async handleFishTank() {
    await this.enterFishTank(); // 不传参数，只是进入鱼缸
  }

  // 修改：让它游起来处理
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
      await this.fishManager.processor.processFishImage();
    } catch (error) {
      console.error('处理鱼图像失败:', error);
      wx.showToast({ title: '处理失败，请重试', icon: 'none', duration: 2000 });
    }
  }

// 修改：进入鱼缸的统一方法
async enterFishTank(newFishName = null) {
  this.isSwimInterfaceVisible = true;
  this.swimInterfaceData = { mode: 'fishTank' };

  if (!this.fishTank) {
    const { FishTank } = require('./fishCore.js');
    this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
  }

  // 清空当前鱼缸显示
  this.fishTank.fishes = [];
  this.addedUserFishNames.clear();

  // 首次进入：从数据库加载并初始化全局列表
  if (this.isFirstEnterTank) {
    await this.loadInitialFishes();
    this.isFirstEnterTank = false;
  }

  // 如果有指定新鱼（从"让它游起来"来的），确保它在列表中
  if (newFishName) {
    await this.ensureFishInList(newFishName);
  }

  // 从全局列表创建鱼对象并显示
  await this.createFishesFromGlobalList();

  this.fishManager.animator.startAnimationLoop();

  // 修改这里：进入鱼缸时显示鱼的数量
  const fishCount = this.globalFishList.length;
  wx.showToast({
    title: `鱼缸中有${fishCount}条鱼`,
    icon: 'success',
    duration: 2000
  });

  console.log('进入鱼缸，当前鱼数量:', fishCount);
}

  // 新增：首次加载初始鱼数据
  async loadInitialFishes() {
    try {
      console.log('首次加载初始鱼数据...');
      const databaseFishes = await this.databaseManager.getRandomFishesFromDatabase(20);
      this.globalFishList = databaseFishes;
      console.log('初始鱼数据加载完成，数量:', this.globalFishList.length);
    } catch (error) {
      console.error('加载初始鱼数据失败:', error);
      this.globalFishList = [];
    }
  }

  // 新增：确保指定鱼在全局列表中
  async ensureFishInList(fishName) {
    // 检查是否已在列表中
    const existingFish = this.globalFishList.find(fish =>
      fish.fishName === fishName
    );

    if (!existingFish) {
      // 从数据库查询这条鱼并加入列表
      const fishData = await this.fishManager.data.getFishByName(fishName);
      if (fishData) {
        this.globalFishList.unshift(fishData); // 新鱼放在前面
        console.log('新鱼加入全局列表:', fishName);
      }
    }
  }

  // 新增：从全局列表创建鱼对象
  async createFishesFromGlobalList() {
    if (this.globalFishList.length === 0) return;

    console.log('从全局列表创建鱼对象，数量:', this.globalFishList.length);

    const fishCreationPromises = this.globalFishList.map(fishData =>
      this.fishManager.data.createFishFromDatabaseData(fishData)
    );

    const createdFishes = await Promise.all(fishCreationPromises);
    const validFishes = createdFishes.filter(fish => fish !== null);

    // 添加到鱼缸显示
    validFishes.forEach(fish => {
      this.fishTank.addFish(fish);
      this.addedUserFishNames.add(fish.name);
    });

    console.log('成功创建鱼对象:', validFishes.length);
  }

// 修改：刷新鱼缸数据
async refreshFishTank() {
  console.log('手动刷新鱼缸数据...');
  wx.showLoading({ title: '刷新中...', mask: true });

  try {
    // 重新从数据库随机加载
    const newFishes = await this.databaseManager.getRandomFishesFromDatabase(20);
    this.globalFishList = newFishes;

    // 清空并重新创建鱼对象
    this.fishTank.fishes = [];
    this.addedUserFishNames.clear();
    await this.createFishesFromGlobalList();

    // 修改这里：刷新完成后显示鱼的数量
    wx.showToast({
      title: `刷新完成，${newFishes.length}条鱼`,
      icon: 'success',
      duration: 1500
    });
  } catch (error) {
    console.error('刷新鱼缸失败:', error);
    wx.showToast({ title: '刷新失败', icon: 'none', duration: 1500 });
  } finally {
    wx.hideLoading();
  }
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

  // 获取排行榜数据（带图片）- 修改：按照最终评分（点赞-点踩）由大到小排序
  async getRankingDataWithImages() {
    const rankingData = await this.databaseManager.getRankingData(100);
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
      this.confirmFishName();  // 只在这里调用确认方法
    });

    // 修复：删除 onKeyboardComplete 中的重复调用
    wx.onKeyboardComplete((res) => {
      // 只隐藏键盘，不重复调用 confirmFishName
      console.log('键盘输入完成，隐藏对话框');
      this.hideNameInputDialog();
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
        createdAt: new Date(),
        fishName: finalName,
        score: 0,
        star: 0,
        unstar: 0,
        base64: base64Data,
        createTimestamp: Date.now(),
      };

      const insertSuccess = await this.databaseManager.insertFishToDatabase(fishData);
      wx.hideLoading();

      if (insertSuccess) {
        wx.showToast({ title: `${finalName} 加入鱼缸！`, icon: 'success', duration: 1500 });

        // 修改：进入鱼缸并确保新鱼显示
        await this.enterFishTank(finalName);
      } else {
        wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
        // 本地模式下还是使用原有逻辑
        const { Fish } = require('./fishCore.js');
        const fish = new Fish(
          scaledImage.canvas,
          Math.random() * (config.screenWidth - scaledImage.width),
          Math.random() * (config.screenHeight - scaledImage.height),
          Math.random() < 0.5 ? -1 : 1,
          finalName
        );
        this.fishTank.addFish(fish);
        this.addedUserFishNames.add(finalName);
        await this.enterFishTank();
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
      // 错误处理同上
      const { Fish } = require('./fishCore.js');
      const fish = new Fish(
        scaledImage.canvas,
        Math.random() * (config.screenWidth - scaledImage.width),
        Math.random() * (config.screenHeight - scaledImage.height),
        Math.random() < 0.5 ? -1 : 1,
        finalName
      );
      this.fishTank.addFish(fish);
      this.addedUserFishNames.add(finalName);
      await this.enterFishTank();
    }
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

  // 鱼详情功能 - 修改：增加用户交互状态检查
  async showFishDetail(fish) {
    this.isFishDetailVisible = true;
    this.selectedFishData = {
      fish: fish,
      fishData: fish.fishData,
      userInteraction: null // 新增：用户交互状态
    };

    // 新增：加载用户交互状态
    await this.loadUserInteraction(fish.fishData.fishName);

    this.uiManager.drawGameUI(this.gameState);
  }

  // 新增：加载用户交互状态
  async loadUserInteraction(fishName) {
    if (!this.userOpenid) {
      console.warn('用户openid未获取，无法加载交互状态');
      return;
    }

    try {
      const interaction = await this.databaseManager.getUserInteraction(fishName);
      if (interaction) {
        this.selectedFishData.userInteraction = interaction;
        console.log(`用户对鱼 ${fishName} 的交互状态:`, interaction.action);
      }
    } catch (error) {
      console.error('加载用户交互状态失败:', error);
    }
  }

  hideFishDetail() {
    this.isFishDetailVisible = false;
    this.selectedFishData = null;
    this.uiManager.drawGameUI(this.gameState);
  }

  // 修改：点赞操作 - 按照新逻辑实现
  async handleLikeAction() {
    if (this.isOperating) return;
    this.isOperating = true;

    try {
      if (!this.selectedFishData) return;

      const fishData = this.selectedFishData.fishData;
      if (!fishData._id) {
        console.warn('鱼数据没有ID，无法更新');
        return;
      }

      const userInteraction = this.selectedFishData.userInteraction;
      const currentAction = userInteraction ? userInteraction.action : null;

      // 如果当前已经是点赞状态，则取消点赞
      if (currentAction === 'star') {
        await this.cancelLikeAction(fishData, userInteraction);
      } else if (currentAction === 'unstar') {
        // 如果当前是点踩状态，不允许切换操作
        wx.showToast({ title: '请先取消点踩', icon: 'none', duration: 1500 });
        return;
      } else {
        // 无交互状态，进行点赞操作
        await this.performLikeAction(fishData);
      }

      // 重新加载用户交互状态
      await this.loadUserInteraction(fishData.fishName);
      this.uiManager.drawGameUI(this.gameState);

    } finally {
      this.isOperating = false;
    }
  }

  // 修改：点踩操作 - 按照新逻辑实现
  async handleDislikeAction() {
    if (this.isOperating) return;
    this.isOperating = true;

    try {
      if (!this.selectedFishData) return;

      const fishData = this.selectedFishData.fishData;
      if (!fishData._id) {
        console.warn('鱼数据没有ID，无法更新');
        return;
      }

      const userInteraction = this.selectedFishData.userInteraction;
      const currentAction = userInteraction ? userInteraction.action : null;

      // 如果当前已经是点踩状态，则取消点踩
      if (currentAction === 'unstar') {
        await this.cancelDislikeAction(fishData, userInteraction);
      } else if (currentAction === 'star') {
        // 如果当前是点赞状态，不允许切换操作
        wx.showToast({ title: '请先取消点赞', icon: 'none', duration: 1500 });
        return;
      } else {
        // 无交互状态，进行点踩操作
        await this.performDislikeAction(fishData);
      }

      // 重新加载用户交互状态
      await this.loadUserInteraction(fishData.fishName);
      this.uiManager.drawGameUI(this.gameState);

    } finally {
      this.isOperating = false;
    }
  }

  // 新增：执行点赞操作（无交互状态时）
  async performLikeAction(fishData) {
    const newStarCount = (fishData.star || 0) + 1;
    const newUnstarCount = fishData.unstar || 0;
    const newScore = newStarCount - newUnstarCount;

    fishData.star = newStarCount;
    fishData.unstar = newUnstarCount;
    fishData.score = newScore;

    // 插入新的交互记录
    let interactionSuccess = false;
    if (this.userOpenid) {
      interactionSuccess = await this.databaseManager.insertUserInteraction(
        fishData.fishName,
        'star'
      );
    }

    const updateSuccess = await this.databaseManager.updateFishScore(
      fishData._id,
      newScore,
      newStarCount,
      newUnstarCount
    );

//    if (updateSuccess && interactionSuccess) {
//      console.log('点赞操作成功');
//      wx.showToast({ title: '点赞成功', icon: 'success', duration: 1000 });
//    } else {
//      console.warn('点赞操作失败，但已更新本地数据');
//      wx.showToast({ title: '操作失败', icon: 'none', duration: 1000 });
//    }
  }

  // 新增：执行点踩操作（无交互状态时）
  async performDislikeAction(fishData) {
    const newUnstarCount = (fishData.unstar || 0) + 1;
    const newStarCount = fishData.star || 0;
    const newScore = newStarCount - newUnstarCount;

    fishData.star = newStarCount;
    fishData.unstar = newUnstarCount;
    fishData.score = newScore;

    // 插入新的交互记录
    let interactionSuccess = false;
    if (this.userOpenid) {
      interactionSuccess = await this.databaseManager.insertUserInteraction(
        fishData.fishName,
        'unstar'
      );
    }

    const updateSuccess = await this.databaseManager.updateFishScore(
      fishData._id,
      newScore,
      newStarCount,
      newUnstarCount
    );

//    if (updateSuccess && interactionSuccess) {
//      console.log('点踩操作成功');
//      wx.showToast({ title: '点踩成功', icon: 'success', duration: 1000 });
//    } else {
//      console.warn('点踩操作失败，但已更新本地数据');
//      wx.showToast({ title: '操作失败', icon: 'none', duration: 1000 });
//    }
  }

  // 修改：取消点赞操作
  async cancelLikeAction(fishData, userInteraction) {
    const newStarCount = Math.max(0, (fishData.star || 0) - 1);
    const newUnstarCount = fishData.unstar || 0;
    const newScore = newStarCount - newUnstarCount;

    fishData.star = newStarCount;
    fishData.unstar = newUnstarCount;
    fishData.score = newScore;

    // 删除交互记录
    let interactionSuccess = false;
    if (userInteraction && userInteraction._id) {
      interactionSuccess = await this.databaseManager.deleteUserInteraction(
        userInteraction._id
      );
    }

    const updateSuccess = await this.databaseManager.updateFishScore(
      fishData._id,
      newScore,
      newStarCount,
      newUnstarCount
    );

    if (updateSuccess) {
      // 无论交互记录删除是否成功，都更新本地状态
      this.selectedFishData.userInteraction = null;

//      if (interactionSuccess) {
//        console.log('取消点赞成功');
//        wx.showToast({ title: '已取消点赞', icon: 'success', duration: 1000 });
//      } else {
//        console.log('取消点赞成功（本地状态已更新）');
//        wx.showToast({ title: '已取消点赞', icon: 'success', duration: 1000 });
//      }
    } else {
      console.warn('取消点赞失败');
      wx.showToast({ title: '操作失败', icon: 'none', duration: 1000 });
    }
  }

  // 修改：取消点踩操作
  async cancelDislikeAction(fishData, userInteraction) {
    const newUnstarCount = Math.max(0, (fishData.unstar || 0) - 1);
    const newStarCount = fishData.star || 0;
    const newScore = newStarCount - newUnstarCount;

    fishData.star = newStarCount;
    fishData.unstar = newUnstarCount;
    fishData.score = newScore;

    // 删除交互记录
    let interactionSuccess = false;
    if (userInteraction && userInteraction._id) {
      interactionSuccess = await this.databaseManager.deleteUserInteraction(
        userInteraction._id
      );
    }

    const updateSuccess = await this.databaseManager.updateFishScore(
      fishData._id,
      newScore,
      newStarCount,
      newUnstarCount
    );

    if (updateSuccess) {
      // 无论交互记录删除是否成功，都更新本地状态
      this.selectedFishData.userInteraction = null;

//      if (interactionSuccess) {
//        console.log('取消点踩成功');
//        wx.showToast({ title: '已取消点踩', icon: 'success', duration: 1000 });
//      } else {
//        console.log('取消点踩成功（本地状态已更新）');
//        wx.showToast({ title: '已取消点踩', icon: 'success', duration: 1000 });
//      }
    } else {
      console.warn('取消点踩失败');
      wx.showToast({ title: '操作失败', icon: 'none', duration: 1000 });
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
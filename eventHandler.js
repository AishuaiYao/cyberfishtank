// eventHandler.js - 精简版：纯本地存储，无云依赖
const { config, getAreaPositions } = require('./config.js');
const AIService = require('./aiService.js');
const Utils = require('./utils.js');

const MainTouchHandler = require('./touchHandlers/mainTouchHandler.js');
const SwimTouchHandler = require('./touchHandlers/swimTouchHandler.js');
const FishProcessor = require('./fishManager/fishProcessor.js');
const FishAnimator = require('./fishManager/fishAnimator.js');
const FishDataManager = require('./fishManager/fishDataManager.js');

const { Fish, FishTank } = require('./fishCore.js');
const { PlatformerGame } = require('./platformer/platformer.js');

class EventHandler {
  constructor(canvas, ctx, gameState, uiManager, game) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.game = game;
    this.positions = require('./config.js').getAreaPositions();
    this.aiService = new AIService();

    // 触摸处理器（精简：只保留主界面和鱼缸）
    this.touchHandlers = {
      main: new MainTouchHandler(this),
      swim: new SwimTouchHandler(this)
    };

    // 鱼管理器
    this.fishManager = {
      processor: new FishProcessor(this),
      animator: new FishAnimator(this),
      data: new FishDataManager(this)
    };

    // 界面状态（精简）
    this.isSwimInterfaceVisible = false;
    this.isPlatformerMode = false;
    this.platformer = null;

    // 选鱼界面状态
    this.showFishSelect = false;
    this.selectedFishIndex = -1;

    // 积分榜状态
    this.showLeaderboard = false;
    this.platformerScores = [];    // 闯关历史积分

    // 鱼缸数据
    this.fishTank = null;
    this.myFishesList = [];        // 本地存储的鱼列表

    // 已添加的鱼名称（防重复）
    this.addedFishNames = new Set();

    // 操作防抖
    this.isOperating = false;
    this.lastInteractionTime = 0;
    this.interactionCooldown = 500;

    // 当前正在处理的鱼图像（命名后存到本地）
    this.pendingFishImage = null;

    this.bindEvents();
    this.loadLocalFishes();
    this.loadPlatformerScores();
    console.log('EventHandler 初始化完成（本地模式）');
  }

  // === 本地存储：加载鱼列表 ===
  loadLocalFishes() {
    try {
      const data = wx.getStorageSync(config.storagePrefix + 'fishes');
      this.myFishesList = data ? JSON.parse(data) : [];
      console.log(`从本地加载了 ${this.myFishesList.length} 条鱼`);
    } catch (e) {
      console.warn('加载本地鱼数据失败:', e);
      this.myFishesList = [];
    }
  }

  // === 本地存储：保存鱼列表 ===
  saveLocalFishes() {
    try {
      wx.setStorageSync(config.storagePrefix + 'fishes', JSON.stringify(this.myFishesList));
      console.log(`保存了 ${this.myFishesList.length} 条鱼到本地`);
    } catch (e) {
      console.error('保存本地鱼数据失败:', e);
    }
  }

  // === 本地存储：添加一条鱼 ===
  addLocalFish(fishData) {
    this.myFishesList.unshift(fishData);
    // 最多保存 50 条
    if (this.myFishesList.length > 50) {
      this.myFishesList = this.myFishesList.slice(0, 50);
    }
    this.saveLocalFishes();
  }

  // === 本地存储：删除一条鱼 ===
  deleteLocalFish(fishName) {
    this.myFishesList = this.myFishesList.filter(f => f.fishName !== fishName);
    this.addedFishNames.delete(fishName);
    this.saveLocalFishes();
  }

  // === 闯关积分榜存储 ===
  loadPlatformerScores() {
    try {
      const data = wx.getStorageSync(config.storagePrefix + 'p_scores');
      this.platformerScores = data ? JSON.parse(data) : [];
      console.log(`加载了 ${this.platformerScores.length} 条闯关记录`);
    } catch (e) {
      console.warn('加载闯关积分失败:', e);
      this.platformerScores = [];
    }
  }

  savePlatformerScore(result) {
    this.platformerScores.unshift({
      fishName: result.fishName || '未知小鱼',
      score: result.score || 0,
      coins: result.coins || 0,
      levelIndex: result.levelIndex || 0,
      state: result.state || 'unknown',
      timestamp: Date.now()
    });
    // 最多 50 条
    if (this.platformerScores.length > 50) {
      this.platformerScores = this.platformerScores.slice(0, 50);
    }
    try {
      wx.setStorageSync(config.storagePrefix + 'p_scores', JSON.stringify(this.platformerScores));
      console.log('闯关积分已保存');
    } catch (e) {
      console.error('保存闯关积分失败:', e);
    }
  }

  // ===== 触摸事件绑定 =====
  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
  }

  handleTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;

    const touches = e.touches;

    // 闯关模式：路由到平台跳跃游戏（传递所有触摸点 + 真实 touchId）
    if (this.isPlatformerMode && this.platformer) {
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        this.platformer.handleTouchStart(t.clientX, t.clientY, t.identifier);
      }
      return;
    }

    const x = touches[0].clientX;
    const y = touches[0].clientY;

    // 积分榜界面
    if (this.showLeaderboard) {
      this.handleLeaderboardTap(x, y);
      return;
    }

    // 选鱼界面
    if (this.showFishSelect) {
      this.handleFishSelectTap(x, y);
      return;
    }

    if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouchStart(x, y);
    } else if (this.touchHandlers.main.paletteHandler && this.touchHandlers.main.paletteHandler.isVisible) {
      this.touchHandlers.main.paletteHandler.handlePaletteTouch(x, y);
    } else {
      this.touchHandlers.main.handleTouchStart(x, y, touches);
    }
  }

  handleTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;

    const touches = e.touches;

    // 闯关模式：传递所有触摸点 + 真实 touchId
    if (this.isPlatformerMode && this.platformer) {
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        this.platformer.handleTouchMove(t.clientX, t.clientY, t.identifier);
      }
      return;
    }

    const x = touches[0].clientX;
    const y = touches[0].clientY;

    // 选鱼/积分榜界面：忽略 move
    if (this.showLeaderboard || this.showFishSelect) return;

    if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouchMove(x, y);
    } else {
      this.touchHandlers.main.handleTouchMove(x, y, touches);
    }
  }

  handleTouchEnd(e) {
    const changedTouches = e.changedTouches;
    if (!changedTouches || changedTouches.length === 0) return;

    // 闯关模式：传递所有抬起的触摸点 + 真实 touchId
    if (this.isPlatformerMode && this.platformer) {
      for (let i = 0; i < changedTouches.length; i++) {
        const t = changedTouches[i];
        this.platformer.handleTouchEnd(t.clientX, t.clientY, t.identifier);
      }
      return;
    }

    const touch = changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 选鱼/积分榜界面：忽略 end
    if (this.showLeaderboard || this.showFishSelect) return;

    if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouchEnd(x, y);
    } else {
      this.touchHandlers.main.handleTouchEnd(x, y);
    }
  }

  handleTouchCancel(e) {
    // 闯关模式
    if (this.isPlatformerMode && this.platformer) {
      return;
    }
    const gameState = this.gameState;
    if (this.touchHandlers.main) {
      this.touchHandlers.main.resetTouchState();
    }
    gameState.isDrawing = false;
  }

  // ===== 鱼缸功能 =====
  async handleFishTank() {
    await this.enterFishTank();
  }

  async enterFishTank() {
    this.isSwimInterfaceVisible = true;

    if (!this.fishTank) {
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 清空当前
    this.fishTank.fishes = [];
    this.addedFishNames.clear();

    // 从本地数据创建鱼对象
    if (this.myFishesList.length > 0) {
      const fishCreationPromises = this.myFishesList.map(fishData =>
        this.fishManager.data.createFishFromLocalData(fishData)
      );

      const createdFishes = await Promise.all(fishCreationPromises);
      const validFishes = createdFishes.filter(fish => fish !== null);

      validFishes.forEach(fish => {
        this.fishTank.addFish(fish);
        this.addedFishNames.add(fish.name);
      });

      console.log(`鱼缸加载了 ${validFishes.length} 条本地鱼`);
    }

    this.fishManager.animator.startAnimationLoop();

    const fishCount = this.fishTank.fishes.length;
    wx.showToast({
      title: fishCount > 0 ? `加载了 ${fishCount} 条鱼` : '鱼缸空空，快去画鱼吧',
      icon: fishCount > 0 ? 'success' : 'none',
      duration: 1500
    });
  }

  getCurrentTankFishCount() {
    return this.fishTank ? this.fishTank.fishes.length : 0;
  }

  hideSwimInterface() {
    this.isSwimInterfaceVisible = false;
    this.fishManager.animator.stopAnimationLoop();
    this.uiManager.drawGameUI(this.gameState);
    console.log('鱼缸界面已隐藏');
  }

  // ===== 闯关功能 =====
  handleChallenge() {
    if (this.isPlatformerMode) return;

    // 有已保存的小鱼 → 展示选鱼界面
    const hasDrawing = this.gameState.drawingPaths.length > 0;
    const hasSavedFish = this.myFishesList.length > 0;

    if (hasDrawing && !hasSavedFish) {
      // 只有画好的鱼，没有存鱼：直接用当前绘画开始
      this.startPlatformerDirect();
    } else if (hasSavedFish) {
      // 有存鱼：打开选鱼界面（可选存鱼或当前绘画）
      this.openFishSelectScreen();
    } else {
      // 既没有画也没有存鱼
      Utils.showError('请先画一条鱼再闯关！');
    }
  }

  // 直接用当前绘画开始闯关
  startPlatformerDirect() {
    const fishCanvas = this.createFishImage();
    this.launchPlatformer(fishCanvas, '手绘小鱼');
  }

  // ===== 选鱼界面 =====
  async openFishSelectScreen() {
    this.showFishSelect = true;
    this.selectedFishIndex = -1;

    wx.showLoading({ title: '加载小鱼...', mask: true });

    // 异步生成所有小鱼的预览图（缩小版，48px 宽）
    const fishPreviews = [];
    for (const fish of this.myFishesList) {
      try {
        const preview = await this._generateFishPreview(fish.base64);
        fishPreviews.push(preview);
      } catch (e) {
        console.warn('预览图生成失败, 降级显示:', fish.fishName, e);
        fishPreviews.push(null);
      }
    }

    wx.hideLoading();

    // 渲染选鱼界面
    const renderer = this.uiManager.interfaceRenderer;
    const hasDrawing = this.gameState.drawingPaths.length > 0;
    renderer.drawFishSelectScreen(this.myFishesList, this.selectedFishIndex, hasDrawing, fishPreviews);
  }

  // 从 base64 生成小鱼缩略预览图
  _generateFishPreview(base64Data) {
    return new Promise((resolve, reject) => {
      try {
        const image = wx.createImage();
        image.onload = () => {
          const TARGET_W = 48;
          const scale = TARGET_W / image.width;
          const targetH = Math.round(image.height * scale);

          const canvas = wx.createCanvas();
          canvas.width = TARGET_W;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, TARGET_W, targetH);

          resolve({ canvas: canvas, width: TARGET_W, height: targetH });
        };
        image.onerror = (err) => reject(err);
        image.src = 'data:image/png;base64,' + base64Data;
      } catch (e) {
        reject(e);
      }
    });
  }

  handleFishSelectTap(x, y) {
    const renderer = this.uiManager.interfaceRenderer;
    const hasDrawing = this.gameState.drawingPaths.length > 0;

    // 检查是否点击了返回按钮
    if (renderer.fishSelectBackBounds && this._pointInRect(x, y, renderer.fishSelectBackBounds)) {
      this.showFishSelect = false;
      this.uiManager.drawGameUI(this.gameState);
      return;
    }

    // 检查是否选中了某条小鱼卡片
    if (renderer.fishSelectCardBounds && renderer.fishSelectCardBounds.length > 0) {
      for (let i = 0; i < renderer.fishSelectCardBounds.length; i++) {
        const b = renderer.fishSelectCardBounds[i];
        if (this._pointInRect(x, y, b)) {
          // base64 → canvas → 开始游戏
          this.selectFishForPlatformer(i);
          return;
        }
      }
    }

    // 检查是否点击"使用当前绘画"按钮
    if (hasDrawing && renderer.fishSelectDrawBtnBounds &&
        this._pointInRect(x, y, renderer.fishSelectDrawBtnBounds)) {
      this.showFishSelect = false;
      this.startPlatformerDirect();
      return;
    }
  }

  _pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  // 选中保存的小鱼开始闯关
  selectFishForPlatformer(index) {
    if (index < 0 || index >= this.myFishesList.length) return;
    const fish = this.myFishesList[index];
    this.showFishSelect = false;
    this.selectedFishIndex = index;

    wx.showLoading({ title: '加载小鱼...', mask: true });
    this.fishManager.data.base64ToCanvas(fish.base64)
      .then(result => {
        wx.hideLoading();
        // 缩放到合理大小用于游戏内显示
        const fishCanvas = this._scaleFishCanvas(result.canvas);
        this.launchPlatformer(fishCanvas, fish.fishName || '小鱼');
      })
      .catch(err => {
        wx.hideLoading();
        console.error('加载小鱼图片失败:', err);
        Utils.showError('加载失败，请重试');
        this.uiManager.drawGameUI(this.gameState);
      });
  }

  // 缩放鱼图片到游戏内合适大小
  _scaleFishCanvas(srcCanvas) {
    // 目标大小与 createFishImage 一致
    const TARGET_W = 48;
    const TARGET_H = 40;
    const offCanvas = wx.createCanvas();
    offCanvas.width = TARGET_W;
    offCanvas.height = TARGET_H;
    const ctx = offCanvas.getContext('2d');
    ctx.clearRect(0, 0, TARGET_W, TARGET_H);

    const scale = Math.min(TARGET_W / srcCanvas.width, TARGET_H / srcCanvas.height);
    const w = srcCanvas.width * scale;
    const h = srcCanvas.height * scale;
    ctx.drawImage(srcCanvas, (TARGET_W - w) / 2, (TARGET_H - h) / 2, w, h);
    return offCanvas;
  }

  // 启动闯关游戏
  launchPlatformer(fishCanvas, fishName) {
    this.isPlatformerMode = true;
    this.platformer = new PlatformerGame(
      this.canvas, this.ctx, config,
      fishCanvas,
      (result) => this.exitPlatformer(result),
      { fishName: fishName }
    );
    this.platformer.init();
    console.log(`闯关模式已启动 (${fishName})`);
  }

  // 从 drawingPaths 生成小鱼图像（用于平台跳跃游戏的主角）
  createFishImage() {
    const positions = this.positions || getAreaPositions();
    const drawingAreaY = positions.drawingAreaY;
    const drawingWidth = config.screenWidth - 24;
    const drawingHeight = config.drawingAreaHeight;

    // 目标角色大小（物理像素），不要太大避免性能问题
    const TARGET_W = 48;
    const TARGET_H = 40;
    const scaleX = TARGET_W / drawingWidth;
    const scaleY = TARGET_H / drawingHeight;
    const scale = Math.min(scaleX, scaleY);

    // 离屏 Canvas，合理的小尺寸
    const offCanvas = wx.createCanvas();
    offCanvas.width = TARGET_W;
    offCanvas.height = TARGET_H;
    const ctx = offCanvas.getContext('2d');

    // 透明背景（不再使用白色背景）
    ctx.clearRect(0, 0, TARGET_W, TARGET_H);

    // 计算笔迹边界
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const paths = this.gameState.drawingPaths;
    for (let p = 0; p < paths.length; p++) {
      for (const pt of paths[p].points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    if (!isFinite(minX)) { minX = 12; minY = drawingAreaY; maxX = 12 + 50; maxY = drawingAreaY + 50; }
    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    const offsetX = (TARGET_W - contentW * scale) / 2;
    const offsetY = (TARGET_H - contentH * scale) / 2;

    // 绘制所有笔迹，缩放到目标尺寸并居中
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p];
      if (path.points.length < 2) continue;
      ctx.save();
      ctx.beginPath();
      const first = path.points[0];
      ctx.moveTo(
        (first.x - minX) * scale + offsetX,
        (first.y - minY) * scale + offsetY
      );
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(
          (path.points[i].x - minX) * scale + offsetX,
          (path.points[i].y - minY) * scale + offsetY
        );
      }
      ctx.strokeStyle = path.color;
      ctx.lineWidth = Math.max(1.5, path.size * scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    return offCanvas;
  }

  // 退出闯关模式（接收局内结果）
  exitPlatformer(result) {
    // 保存积分
    if (result && result.score !== undefined) {
      this.savePlatformerScore(result);
    }

    if (this.platformer) {
      this.platformer.destroy();
      this.platformer = null;
    }
    this.isPlatformerMode = false;

    // 清除 Canvas 残留并重绘主界面
    this.ctx.clearRect(0, 0, config.screenWidth, config.screenHeight);
    this.uiManager.drawGameUI(this.gameState);
    console.log('闯关模式已退出');
  }

  // ===== 积分榜 =====
  showScoreboard() {
    this.showLeaderboard = true;
    const renderer = this.uiManager.interfaceRenderer;
    renderer.drawLeaderboard(this.platformerScores);
  }

  handleLeaderboardTap(x, y) {
    const renderer = this.uiManager.interfaceRenderer;
    // 点击返回按钮
    if (renderer.leaderboardBackBounds && this._pointInRect(x, y, renderer.leaderboardBackBounds)) {
      this.showLeaderboard = false;
      this.uiManager.drawGameUI(this.gameState);
      return;
    }
    // 点击任意其他位置也关闭
    this.showLeaderboard = false;
    this.uiManager.drawGameUI(this.gameState);
  }

  // ===== "加入鱼缸" 功能（带广告）=====
  async handleAddToTank() {
    if (this.gameState.scoringState.isRequesting) {
      Utils.showError('AI评分中，请稍候');
      return;
    }

    if (this.gameState.drawingPaths.length === 0) {
      Utils.showError('请先画一条鱼');
      return;
    }

    // 展示插屏广告
    await this.showInterstitialAd();

    // 评分太低也允许加入（用户画的就是雏形）
    try {
      await this.fishManager.processor.processFishImage();
    } catch (error) {
      Utils.handleError(error, '处理鱼图像失败');
      Utils.showError('处理失败，请重试', 2000);
    }
  }

  // ===== 命名对话框（使用原生键盘）=====
  showNameInputDialog(fishImage) {
    this.pendingFishImage = fishImage;

    // 使用微信原生键盘输入
    wx.showModal({
      title: '给你的鱼起个名字',
      editable: true,
      placeholderText: '输入名字...',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const name = res.content.trim();
          this.saveFishToLocalWithName(name);
        } else {
          // 取消或空名字：用默认名字
          const defaultName = `鱼_${Date.now().toString(36)}`;
          this.saveFishToLocalWithName(defaultName);
        }
      },
      fail: () => {
        // 失败也用默认名字
        const defaultName = `鱼_${Date.now().toString(36)}`;
        this.saveFishToLocalWithName(defaultName);
      }
    });
  }

  // === 保存鱼到本地 ===
  async saveFishToLocalWithName(name) {
    if (!this.pendingFishImage) return;

    try {
      wx.showLoading({ title: '保存中...', mask: true });

      // 将图像转 base64
      const base64 = await this.fishManager.data.canvasToBase64(this.pendingFishImage.canvas);
      const imageWidth = this.pendingFishImage.logicalWidth || this.pendingFishImage.width;
      const imageHeight = this.pendingFishImage.logicalHeight || this.pendingFishImage.height;

      const fishData = {
        fishName: name,
        base64: base64,
        width: imageWidth,
        height: imageHeight,
        score: this.gameState.score,
        createdAt: Date.now()
      };

      this.addLocalFish(fishData);
      this.pendingFishImage = null;

      wx.hideLoading();
      wx.showToast({
        title: `"${name}" 已加入鱼缸！`,
        icon: 'success',
        duration: 2000
      });

      // 自动进入鱼缸
      await this.enterFishTank();

    } catch (error) {
      wx.hideLoading();
      Utils.handleError(error, '保存鱼失败');
      Utils.showError('保存失败，请重试');
    }
  }

  // ===== 分享功能（带广告）=====
  async handleShare() {
    if (this.gameState.drawingPaths.length === 0) {
      Utils.showError('请先画一条鱼再分享');
      return;
    }

    // 展示插屏广告
    await this.showInterstitialAd();

    // 直接用 drawingPaths 数据渲染分享图（不依赖主 Canvas 截图）
    const positions = getAreaPositions();
    let shareUrl = '';
    try {
      shareUrl = await this.renderShareImage(positions);
      console.log('分享图片生成成功:', shareUrl);
    } catch (err) {
      console.error('生成分享图片失败:', err);
    }

    this.gameState.shareImagePath = shareUrl;
    this.gameState.shareTitle = shareUrl ? '来看看我画的鱼！' : '来玩画小鱼游戏吧！';

    wx.shareAppMessage({
      title: this.gameState.shareTitle,
      imageUrl: shareUrl
    });

    wx.showToast({
      title: '点击右上角分享',
      icon: 'none',
      duration: 2000
    });
  }

  // ===== 渲染分享图：直接根据 drawingPaths 画作 + 品牌栏 =====
  renderShareImage(positions) {
    return new Promise((resolve, reject) => {
      try {
        const pr = config.pixelRatio;
        const drawingAreaY = positions.drawingAreaY;
        const drawingWidth = config.screenWidth - 24;
        const drawingHeight = config.drawingAreaHeight;
        const brandBarHeight = Math.round(56 * pr);

        const cardW = Math.round(drawingWidth * pr);
        const cardH = Math.round(drawingHeight * pr) + brandBarHeight;

        // 离屏 Canvas（微信小游戏里 wx.createCanvas 第二+次调用创建离屏画布）
        const offCanvas = wx.createCanvas();
        offCanvas.width = cardW;
        offCanvas.height = cardH;
        const ctx = offCanvas.getContext('2d');

        // 1. 白色背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cardW, Math.round(drawingHeight * pr));

        // 2. 裁剪区域
        const pad = Math.round(2 * pr);
        ctx.save();
        ctx.beginPath();
        ctx.rect(Math.round(12 * pr) + pad, pad, cardW - Math.round(24 * pr) - pad * 2, Math.round(drawingHeight * pr) - pad * 2);
        ctx.clip();

        // 3. 重绘所有笔迹（坐标从逻辑像素映射到 Canvas 物理像素）
        const paths = this.gameState.drawingPaths;
        for (let p = 0; p < paths.length; p++) {
          const path = paths[p];
          if (path.points.length < 1) continue;
          ctx.save();
          ctx.beginPath();
          const first = path.points[0];
          ctx.moveTo(
            (first.x - 12) * pr,
            (first.y - drawingAreaY) * pr
          );
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(
              (path.points[i].x - 12) * pr,
              (path.points[i].y - drawingAreaY) * pr
            );
          }
          ctx.strokeStyle = path.color;
          ctx.lineWidth = path.size * pr;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();

        // 4. 品牌栏背景
        const barY = Math.round(drawingHeight * pr);
        const grad = ctx.createLinearGradient(0, barY, 0, cardH);
        grad.addColorStop(0, '#1a1a2e');
        grad.addColorStop(1, '#16213e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, barY, cardW, brandBarHeight);

        // 5. 分割线
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = Math.round(2 * pr);
        ctx.beginPath();
        ctx.moveTo(0, barY);
        ctx.lineTo(cardW, barY);
        ctx.stroke();

        // 6. 文字
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(16 * pr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐟 赛博鱼缸', cardW / 2, barY + brandBarHeight * 0.38);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `${Math.round(11 * pr)}px sans-serif`;
        ctx.fillText('来画属于你的小鱼吧', cardW / 2, barY + brandBarHeight * 0.7);

        // 7. 扫描线装饰
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
        ctx.lineWidth = Math.round(1 * pr);
        for (let i = 0; i < 3; i++) {
          const ly = cardH - Math.round((6 + i * 4) * pr);
          ctx.beginPath();
          ctx.moveTo(0, ly);
          ctx.lineTo(cardW, ly);
          ctx.stroke();
        }

        // 8. 导出并保存到用户目录（temp 路径在小游戏分享时可能不可靠）
        offCanvas.toTempFilePath({
          x: 0, y: 0,
          width: cardW, height: cardH,
          destWidth: cardW, destHeight: cardH,
          success: (tempRes) => {
            try {
              const fs = wx.getFileSystemManager();
              const savePath = `${wx.env.USER_DATA_PATH}/share_${Date.now()}.png`;
              fs.saveFileSync(tempRes.tempFilePath, savePath);
              resolve(savePath);
            } catch (e) {
              console.warn('保存到用户目录失败，回退到临时路径:', e);
              resolve(tempRes.tempFilePath);
            }
          },
          fail: (err) => reject(err)
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  // ===== 广告工具方法 =====
  async showInterstitialAd() {
    const game = this.gameState.game;
    if (!game || !game.interstitialAd) return;

    try {
      await game.interstitialAd.show();
      console.log('插屏广告展示成功');
    } catch (err) {
      console.log('插屏广告跳过（间隔限制或展示失败）:', err.errCode || err.message);
    }
  }

  // ===== 鱼缸中点击鱼：查看详情 =====
  showFishDetailFromTank(fish) {
    if (!fish || !fish.fishData) return;

    const fishData = fish.fishData;
    const createTime = fishData.createdAt
      ? new Date(fishData.createdAt).toLocaleString()
      : '未知时间';

    wx.showModal({
      title: `🐟 ${fish.name}`,
      content: `评分: ${fishData.score || '未评分'}\n创建时间: ${createTime}`,
      confirmText: '删除',
      cancelText: '关闭',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          // 删除这条鱼
          wx.showModal({
            title: '确认删除',
            content: `确定要删除"${fish.name}"吗？`,
            confirmText: '删除',
            confirmColor: '#FF3B30',
            success: (res2) => {
              if (res2.confirm) {
                this.deleteLocalFish(fish.name);
                // 从鱼缸中移除
                if (this.fishTank) {
                  this.fishTank.fishes = this.fishTank.fishes.filter(f => f.name !== fish.name);
                }
                wx.showToast({ title: '已删除', icon: 'success' });
              }
            }
          });
        }
      }
    });
  }
}

module.exports = EventHandler;

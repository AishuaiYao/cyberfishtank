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
    const x = touches[0].clientX;
    const y = touches[0].clientY;

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
    const x = touches[0].clientX;
    const y = touches[0].clientY;

    if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouchMove(x, y);
    } else {
      this.touchHandlers.main.handleTouchMove(x, y, touches);
    }
  }

  handleTouchEnd(e) {
    const changedTouches = e.changedTouches;
    if (!changedTouches || changedTouches.length === 0) return;

    const touch = changedTouches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouchEnd(x, y);
    } else {
      this.touchHandlers.main.handleTouchEnd(x, y);
    }
  }

  handleTouchCancel(e) {
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
    wx.showModal({
      title: '🚀 闯关模式',
      content: '闯关模式正在开发中，敬请期待！\n\n联系作者一起探讨：\ncyberfishtank@163.com',
      showCancel: false,
      confirmText: '好的',
      success: () => {}
    });
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

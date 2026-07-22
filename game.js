const { config } = require('./config.js');
const GameState = require('./gameState.js');
const UIManager = require('./uiManager.js');
const EventHandler = require('./eventHandler.js');

class Game {
  constructor() {
    this.init();
  }

  async init() {
    console.log('游戏初始化开始...');

    // 创建插屏广告实例
    let interstitialAd = null;
    
    if (wx.createInterstitialAd) {
      try {
        interstitialAd = wx.createInterstitialAd({
          adUnitId: config.adUnitId || 'adunit-d232b056449b55c6'
        });
        console.log('插屏广告实例创建成功');
      } catch (error) {
        console.error('创建插屏广告实例失败:', error);
        interstitialAd = null;
      }
    } else {
      console.warn('当前环境不支持插屏广告');
      interstitialAd = null;
    }

    // 保存广告实例
    this.interstitialAd = interstitialAd;

    const systemInfo = wx.getSystemInfoSync();
    const pixelRatio = systemInfo.pixelRatio || 1;

    console.log('设备信息:', {
      screenWidth: systemInfo.screenWidth,
      screenHeight: systemInfo.screenHeight,
      pixelRatio: pixelRatio,
      windowWidth: systemInfo.windowWidth,
      windowHeight: systemInfo.windowHeight
    });

    const canvas = wx.createCanvas();
    const ctx = canvas.getContext('2d');

    // 根据设备像素比调整Canvas尺寸
    canvas.width = config.screenWidth * pixelRatio;
    canvas.height = config.screenHeight * pixelRatio;

    // 缩放Canvas以匹配逻辑像素
    ctx.scale(pixelRatio, pixelRatio);

    // Canvas渲染优化
    this.optimizeCanvasRendering(ctx, pixelRatio);

    this.gameState = new GameState(this);
    this.uiManager = new UIManager(ctx, pixelRatio);
    this.eventHandler = new EventHandler(canvas, ctx, this.gameState, this.uiManager, this);

    // 建立双向引用
    this.uiManager.setEventHandler(this.eventHandler);

    this.uiManager.drawGameUI(this.gameState);

    console.log('游戏初始化完成，像素比:', pixelRatio);

    // 展示开屏广告
    if (interstitialAd) {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await interstitialAd.show();
        console.log('插屏广告展示成功');
      } catch (err) {
        if (err.errCode === 2002) {
          console.log('插屏广告时间间隔限制，跳过');
        }
      }
    }

    // 初始化分享功能
    this.initShare();
  }

  // 初始化分享功能
  initShare() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    wx.onShareAppMessage(() => {
      const imageUrl = this.gameState && this.gameState.shareImagePath || '';
      const title = this.gameState && this.gameState.shareTitle || '来玩画小鱼游戏吧！';
      return {
        title: title,
        imageUrl: imageUrl
      };
    });

    wx.onShareTimeline(() => {
      return {
        title: '来看看我画的小鱼！'
      };
    });

    console.log('分享功能初始化完成');
  }

  // Canvas渲染优化
  optimizeCanvasRendering(ctx, pixelRatio) {
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'high';
    ctx.textRendering = 'geometricPrecision';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    console.log('Canvas渲染优化已启用，像素比:', pixelRatio);
  }
}

console.log('微信小游戏启动中...');
new Game();
console.log('微信小游戏启动完成！');

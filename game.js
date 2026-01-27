const { config } = require('./config.js');
const GameState = require('./gameState.js');
const UIManager = require('./uiManager.js');
const EventHandler = require('./eventHandler.js');

// 导入数据库一致性测试脚本
//const DatabaseConsistencyTest = require('./testDatabaseConsistency.js');

class Game {
  constructor() {
    this.init();
  }

  async init() {
    console.log('游戏初始化开始...');

    // 创建插屏广告实例，提前初始化
    let interstitialAd = null;
    
    // 创建插屏广告实例
    if (wx.createInterstitialAd) {
      console.log('环境支持插屏广告，准备创建实例');
      try {
        interstitialAd = wx.createInterstitialAd({
          adUnitId: 'adunit-d232b056449b55c6'
        });
        console.log('插屏广告实例创建成功');
      } catch (error) {
        console.error('创建插屏广告实例失败:', error);
        console.error('错误类型:', typeof error);
        console.error('错误信息:', error.message);
        interstitialAd = null;
      }
    } else {
      console.warn('当前环境不支持插屏广告');
      interstitialAd = null;
    }

    // 小游戏云开发初始化
    if (wx.cloud) {
      wx.cloud.init();
      console.log('小游戏云开发初始化成功');
    }

    // 保存广告实例到Game类的实例中
    this.interstitialAd = interstitialAd;
    console.log('广告实例已保存到Game类:', this.interstitialAd ? '存在' : '不存在');

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

    // 新增：优化Canvas绘制质量
    this.optimizeCanvasRendering(ctx, pixelRatio);

    this.gameState = new GameState(this);
    this.uiManager = new UIManager(ctx, pixelRatio);
    this.eventHandler = new EventHandler(canvas, ctx, this.gameState, this.uiManager, this);

    // 关键：建立双向引用
    this.uiManager.setEventHandler(this.eventHandler);

    // 等待用户openid初始化完成
    try {
      console.log('等待用户openid初始化...');
      // 给一点时间让openid初始化完成
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('用户openid初始化状态:', this.eventHandler.userOpenid ? '成功' : '失败');
    } catch (error) {
      console.warn('用户openid初始化等待过程中出现异常:', error);
    }

    this.uiManager.drawGameUI(this.gameState);

    // 执行数据库一致性测试
    console.log('开始执行数据库一致性测试...');
//    const dbTest = new DatabaseConsistencyTest();
//    dbTest.runConsistencyTest().catch(error => {
//      console.error('数据库一致性测试执行失败:', error);
//    });

    console.log('游戏初始化完成，像素比:', pixelRatio);

    // 在游戏初始化完成后展示广告
    if (interstitialAd) {
      console.log('准备展示插屏广告，广告实例存在');
      try {
        // 等待一小段时间确保广告组件完全初始化
        await new Promise(resolve => setTimeout(resolve, 500));
        await interstitialAd.show();
        console.log('插屏广告展示成功');
      } catch (err) {
        console.error('插屏广告显示失败:', err);
        console.error('错误类型:', typeof err);
        console.error('错误信息:', err.message);
        console.error('错误堆栈:', err.stack);
        
        // 处理微信小程序广告限制错误
        if (err.errCode === 2002) {
          console.log('微信小程序插屏广告时间间隔限制，跳过广告展示');
        }
        
        // 广告显示失败不影响游戏继续运行
      }
    } else {
      console.log('没有可用的插屏广告实例');
    }

    // 初始化分享功能
    this.initShare();
  }

  // 初始化分享功能
  initShare() {
    // 显示右上角转发按钮
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // 监听转发事件 - 转发给朋友
    wx.onShareAppMessage(() => {
      return {
        title: '来玩画小鱼游戏吧！',
        path: 'game/game'
      };
    });

    // 监听分享到朋友圈事件
    wx.onShareTimeline(() => {
      return {
        title: '来看看我画的小鱼！'
      };
    });

    console.log('分享功能初始化完成');
  }

  // 新增：优化Canvas渲染质量
  optimizeCanvasRendering(ctx, pixelRatio) {
    // 设置高质量图像渲染
    ctx.imageSmoothingEnabled = false; // 关闭图像平滑以获得更锐利的图像
    ctx.imageSmoothingQuality = 'high';

    // 设置文本渲染优化
    ctx.textRendering = 'geometricPrecision';

    // 设置清晰的线条渲染
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 设置高质量阴影效果
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
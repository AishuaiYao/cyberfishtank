const { config } = require('./config.js');
const GameState = require('./gameState.js');
const UIManager = require('./uiManager.js');
const EventHandler = require('./eventHandler.js');

class Game {
  constructor() {
    this.init();
  }

  init() {
    console.log('游戏初始化开始...');

    // 小游戏云开发初始化
    if (wx.cloud) {
      wx.cloud.init();
      console.log('小游戏云开发初始化成功');
    }

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

    this.gameState = new GameState();
    this.uiManager = new UIManager(ctx, pixelRatio);
    this.eventHandler = new EventHandler(canvas, ctx, this.gameState, this.uiManager);

    // 关键：建立双向引用
    this.uiManager.setEventHandler(this.eventHandler);

    this.uiManager.drawGameUI(this.gameState);

    console.log('游戏初始化完成，像素比:', pixelRatio);
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
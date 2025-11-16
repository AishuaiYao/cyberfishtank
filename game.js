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

    const canvas = wx.createCanvas();
    const ctx = canvas.getContext('2d');

    canvas.width = config.screenWidth;
    canvas.height = config.screenHeight;

    this.gameState = new GameState();
    this.uiManager = new UIManager(ctx);
    this.eventHandler = new EventHandler(canvas, ctx, this.gameState, this.uiManager);

    // 关键：建立双向引用
    this.uiManager.setEventHandler(this.eventHandler);

    this.uiManager.drawGameUI(this.gameState);

    console.log('游戏初始化完成');
  }
}

console.log('微信小游戏启动中...');
new Game();
console.log('微信小游戏启动完成！');
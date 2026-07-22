// uiManager.js - 简化版：只管理 Canvas 绘制，弹窗/输入使用微信原生API

const { config, getAreaPositions } = require('./config.js');
const InterfaceRenderer = require('./interfaceRenderer.js');
const Utils = require('./utils.js');

class UIManager {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    this.eventHandler = null;
    this.interfaceRenderer = new InterfaceRenderer(ctx, pixelRatio);
    this.optimizeRendering();
  }

  optimizeRendering() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  setEventHandler(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // === 绘制鱼缸界面 ===
  drawFishTankInterface() {
    const ctx = this.ctx;

    // 绘制鱼缸内容（背景、水草、气泡、鱼粮、鱼）
    if (this.eventHandler && this.eventHandler.fishTank) {
      this.eventHandler.fishTank.draw();
    } else {
      ctx.fillStyle = '#E6F7FF';
      ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('鱼缸空空如也，快去画一条鱼吧！', Math.round(config.screenWidth / 2), Math.round(config.screenHeight / 2));
      ctx.textAlign = 'left';
    }

    // 顶部按钮
    const buttonY = 50;
    const buttonHeight = 30;

    // 返回按钮
    Utils.drawModernButton(ctx, 20, buttonY, 50, buttonHeight, '返回', false, true);

    // 底部提示
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    const fishCount = this.eventHandler ? this.eventHandler.getCurrentTankFishCount() : 0;
    ctx.fillText(
      fishCount > 0 ? `鱼缸里有 ${fishCount} 条鱼，双击投鱼粮` : '快去画鱼吧！',
      Math.round(config.screenWidth / 2),
      config.screenHeight - 30
    );
    ctx.textAlign = 'left';
  }

  // === 绘制完整游戏UI ===
  drawGameUI(gameState) {
    const positions = getAreaPositions();

    // 优先检查特殊界面状态
    if (this.eventHandler) {
      // 调色板界面
      if (this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.main &&
        this.eventHandler.touchHandlers.main.paletteHandler &&
        this.eventHandler.touchHandlers.main.paletteHandler.isVisible) {
        return;
      }

      // 鱼缸界面
      if (this.eventHandler.isSwimInterfaceVisible) {
        this.drawFishTankInterface();
        return;
      }
    }

    // 绘制主游戏界面
    this.interfaceRenderer.drawBackground();
    this.interfaceRenderer.drawMainTitle();
    this.interfaceRenderer.drawFunctionArea(gameState, positions);
    this.interfaceRenderer.drawIndicatorArea(positions);
    this.interfaceRenderer.drawDrawingArea(gameState, positions);
    this.interfaceRenderer.drawScoreArea(gameState, positions);
    this.interfaceRenderer.drawJumpArea(positions);
    this.interfaceRenderer.drawChallengeSection();
    this.interfaceRenderer.drawLeaderboardButton();
  }
}

module.exports = UIManager;

// touchHandlers/rankingTouchHandler.js - 排行榜触摸处理
const { config } = require('../config.js');

class RankingTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.touchStartY = 0;
    this.currentScrollY = 0;
    this.maxScrollY = 0;
    this.isScrolling = false;
    this.lastTouchY = 0;
  }

  // 处理排行榜界面触摸
  handleTouch(x, y) {
    console.log('排行榜触摸:', x, y);

    // 返回按钮 - 修复边界判断
    const backButtonX = 20;
    const backButtonY = 40;
    const backButtonWidth = 50;
    const backButtonHeight = 30;

    if (x >= backButtonX && x <= backButtonX + backButtonWidth &&
        y >= backButtonY && y <= backButtonY + backButtonHeight) {
      console.log('点击返回按钮');
      this.eventHandler.hideRankingInterface();
      return;
    }

    // 刷新按钮
    const refreshButtonX = config.screenWidth - 70;
    const refreshButtonY = 40;
    const refreshButtonWidth = 50;
    const refreshButtonHeight = 30;

    if (x >= refreshButtonX && x <= refreshButtonX + refreshButtonWidth &&
        y >= refreshButtonY && y <= refreshButtonY + refreshButtonHeight) {
      console.log('点击刷新按钮');
      this.eventHandler.showRankingInterface();
      return;
    }

    // 处理卡片点击
    this.handleCardClick(x, y);
  }

  // 处理卡片点击
  handleCardClick(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 200;
    const startY = 100 - this.currentScrollY; // 调整起始位置

    for (let i = 0; i < this.eventHandler.rankingData.fishes.length; i++) {
      const fish = this.eventHandler.rankingData.fishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 检查点击是否在卡片范围内
      if (x >= cardX && x <= cardX + cardWidth &&
          y >= cardY && y <= cardY + cardHeight) {
        console.log('点击了排行榜中的鱼:', fish.fishData.fishName);
        // 这里可以添加点击卡片后的处理逻辑，比如查看详情
        break;
      }
    }
  }

  // 触摸开始
  handleTouchStart(x, y) {
    this.touchStartY = y;
    this.lastTouchY = y;
    this.isScrolling = false;
  }

  // 触摸移动
  handleTouchMove(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return;
    }

    // 计算最大滚动距离
    this.calculateMaxScroll();

    // 如果内容可以滚动，则处理滑动
    if (this.maxScrollY > 0) {
      const deltaY = this.lastTouchY - y;

      // 只有垂直移动距离足够大才认为是滑动
      if (Math.abs(deltaY) > 5) {
        this.isScrolling = true;

        // 更新滚动位置
        this.currentScrollY = Math.max(0, Math.min(this.maxScrollY, this.currentScrollY + deltaY));
        this.lastTouchY = y;

        // 强制重绘UI
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      }
    }
  }

  // 触摸结束
  handleTouchEnd() {
    this.isScrolling = false;
  }

  // 计算最大滚动距离
  calculateMaxScroll() {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      this.maxScrollY = 0;
      return;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 200;
    const startY = 100; // 调整起始位置
    const rowCount = Math.ceil(this.eventHandler.rankingData.fishes.length / 2);
    const totalContentHeight = startY + rowCount * (cardHeight + 15) + 20;

    this.maxScrollY = Math.max(0, totalContentHeight - config.screenHeight);
  }

  // 获取当前滚动位置
  getScrollOffset() {
    return this.currentScrollY;
  }

  // 重置滚动位置
  resetScroll() {
    this.currentScrollY = 0;
    this.touchStartY = 0;
    this.lastTouchY = 0;
    this.isScrolling = false;
    this.maxScrollY = 0;
  }

  // 获取最大滚动距离
  getMaxScrollY() {
    return this.maxScrollY;
  }
}

module.exports = RankingTouchHandler;
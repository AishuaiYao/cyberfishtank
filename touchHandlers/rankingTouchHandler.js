// touchHandlers/rankingTouchHandler.js - 排行榜触摸处理
const { config } = require('../config.js');

class RankingTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 处理排行榜界面触摸
  handleTouch(x, y) {
    // 返回按钮
    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
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
      this.eventHandler.showRankingInterface();
      return;
    }

    // 排行榜卡片点击
    if (this.eventHandler.rankingData && this.eventHandler.rankingData.fishes.length > 0) {
      const cardWidth = (config.screenWidth - 60) / 2;
      const cardHeight = 200;
      const startY = 150;

      for (let i = 0; i < this.eventHandler.rankingData.fishes.length; i++) {
        const fish = this.eventHandler.rankingData.fishes[i];
        const row = Math.floor(i / 2);
        const col = i % 2;

        const cardX = 20 + col * (cardWidth + 20);
        const cardY = startY + row * (cardHeight + 15);

        if (x >= cardX && x <= cardX + cardWidth &&
            y >= cardY && y <= cardY + cardHeight) {
          console.log('点击了排行榜中的鱼:', fish.fishData.fishName);
          break;
        }
      }
    }
  }
}

module.exports = RankingTouchHandler;
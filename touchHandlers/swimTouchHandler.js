// touchHandlers/swimTouchHandler.js - 游泳界面触摸处理
class SwimTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 处理游泳界面触摸
  handleTouch(x, y) {
    // 返回按钮
    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
      this.eventHandler.hideSwimInterface();
      return;
    }

    // 鱼点击
    if (this.eventHandler.fishTank) {
      for (const fish of this.eventHandler.fishTank.fishes) {
        const fishLeft = fish.x;
        const fishRight = fish.x + fish.width;
        const fishTop = fish.y;
        const fishBottom = fish.y + fish.height;

        if (x >= fishLeft && x <= fishRight &&
            y >= fishTop && y <= fishBottom) {
          console.log('点击了鱼:', fish.name);
          this.eventHandler.showFishDetail(fish);
          return;
        }
      }
    }

    console.log('公共鱼缸界面点击位置:', x, y);
  }
}

module.exports = SwimTouchHandler;
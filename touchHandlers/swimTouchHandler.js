// touchHandlers/swimTouchHandler.js - 鱼缸界面触摸处理（精简版）
class SwimTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.lastTapTime = 0;
    this.tapCount = 0;
    this.tapTimeout = null;
    this.lastTouchEvent = null;

    // 定期清除lastTouchEvent
    setInterval(() => {
      this.lastTouchEvent = null;
    }, 500);
  }

  // 处理触摸移动（鱼缸中只需处理滑动，无需选择器）
  handleTouchMove(x, y) {
    // 鱼缸中无特殊移动处理，保留接口兼容
  }

  // 处理鱼缸界面触摸
  handleTouch(x, y) {
    // 防止重复处理
    const touchKey = `${Math.round(x)}_${Math.round(y)}`;
    if (this.lastTouchEvent === touchKey) {
      return;
    }
    this.lastTouchEvent = touchKey;

    // 返回按钮
    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
      this.eventHandler.hideSwimInterface();
      return;
    }

    // 检测双击（投喂鱼粮）
    this.handleDoubleTap(x, y);

    // 鱼点击 → 查看详情
    if (this.eventHandler.fishTank) {
      for (const fish of this.eventHandler.fishTank.fishes) {
        const fishLeft = fish.x;
        const fishRight = fish.x + fish.width;
        const fishTop = fish.y;
        const fishBottom = fish.y + fish.height;

        if (x >= fishLeft && x <= fishRight &&
            y >= fishTop && y <= fishBottom) {
          console.log('点击了鱼:', fish.name);
          this.eventHandler.showFishDetailFromTank(fish);
          return;
        }
      }
    }
  }

  // 处理触摸开始（兼容接口）
  handleTouchStart(x, y) {
    this.handleTouch(x, y);
  }

  // 处理触摸结束（兼容接口）
  handleTouchEnd(x, y) {
    this.handleTouch(x, y);
  }

  // 双击检测
  handleDoubleTap(x, y) {
    const currentTime = Date.now();
    const tapInterval = currentTime - this.lastTapTime;

    if (tapInterval < 300 && tapInterval > 0) {
      this.tapCount++;
      if (this.tapCount === 2) {
        this.spawnFishFood(x, y);
        this.tapCount = 0;
        if (this.tapTimeout) {
          clearTimeout(this.tapTimeout);
        }
      }
    } else {
      this.tapCount = 1;
    }

    this.lastTapTime = currentTime;

    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout);
    }
    this.tapTimeout = setTimeout(() => {
      this.tapCount = 0;
    }, 300);
  }

  // 生成鱼粮
  spawnFishFood(x, y) {
    if (this.eventHandler.fishTank) {
      this.eventHandler.fishTank.spawnFishFood(x, y, 10);
      console.log(`在位置 (${x}, ${y}) 生成鱼粮`);
    }
  }
}

module.exports = SwimTouchHandler;

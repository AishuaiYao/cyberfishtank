// touchHandlers/swimTouchHandler.js - 游泳界面触摸处理
class SwimTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.lastTapTime = 0;
    this.tapCount = 0;
    this.tapTimeout = null;
  }

  // 修改：处理游泳界面触摸（在触摸结束时调用）
  handleTouch(x, y) {
    // 返回按钮
    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
      if (this.eventHandler.isOtherFishTankVisible) {
        // 串门界面：隐藏他人鱼缸
        this.eventHandler.hideOtherFishTank();
      } else {
        // 游泳界面：隐藏游泳界面
        this.eventHandler.hideSwimInterface();
      }
      return;
    }

//    // 修改：刷新按钮 (在返回按钮旁边)
//    if (x >= 80 && x <= 130 && y >= 40 && y <= 70) {
//      this.eventHandler.refreshFishTank();
//      return;
//    }
//
//    // 新增：鱼缸切换按钮（在屏幕中央）
//    const switchButtonWidth = 120;
//    const switchButtonX = (this.eventHandler.canvas.width / this.eventHandler.uiManager.pixelRatio - switchButtonWidth) / 2;
//
//    if (x >= switchButtonX && x <= switchButtonX + switchButtonWidth &&
//        y >= 40 && y <= 70) {
//      this.eventHandler.switchTankMode();
//      return;
//    }
// 鱼缸切换按钮（现在在第二个位置）
const switchButtonWidth = 120;
const switchButtonX = 80;
if (x >= switchButtonX && x <= switchButtonX + switchButtonWidth && y >= 40 && y <= 70) {
  this.eventHandler.switchTankMode();
  return;
}

// 刷新按钮（现在在第三个位置）
const refreshButtonX = switchButtonX + switchButtonWidth + 10;
if (x >= refreshButtonX && x <= refreshButtonX + 50 && y >= 40 && y <= 70) {
  this.eventHandler.refreshFishTank();
  return;
}



    // 检测双击
    this.handleDoubleTap(x, y);

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

    console.log('鱼缸界面点击位置:', x, y);
  }

  // 处理双击事件
  handleDoubleTap(x, y) {
    const currentTime = Date.now();
    const tapInterval = currentTime - this.lastTapTime;

    if (tapInterval < 300 && tapInterval > 0) {
      // 双击检测成功
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

    // 设置超时重置点击计数
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

//      // 显示提示
//      wx.showToast({
//        title: '投放了鱼粮',
//        icon: 'success',
//        duration: 1000
//      });
    }
  }
}

module.exports = SwimTouchHandler;
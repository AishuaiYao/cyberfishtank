// fishManager/fishAnimator.js - 鱼动画控制
class FishAnimator {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.animationId = null;
    this.lastAnimationTime = 0;
  }

  // 开始动画循环
  startAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    const animate = (timestamp) => {
      if (!this.lastAnimationTime) this.lastAnimationTime = timestamp;
      const deltaTime = timestamp - this.lastAnimationTime;

      this.updateAnimation(deltaTime);
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);

      this.lastAnimationTime = timestamp;
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  // 更新动画
  updateAnimation(deltaTime) {
    if (this.eventHandler.fishTank &&
        (this.eventHandler.isSwimInterfaceVisible || this.eventHandler.isOtherFishTankVisible)) {
      this.eventHandler.fishTank.update(deltaTime);
    }
  }

  // 停止动画循环
  stopAnimationLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.lastAnimationTime = 0;
  }
}

module.exports = FishAnimator;
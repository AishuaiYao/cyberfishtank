// touchHandlers/fishDetailTouchHandler.js - 鱼详情触摸处理
const { config } = require('../config.js');

class FishDetailTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    // 新增：防止快速连续点击
    this.lastButtonClickTime = 0;
    this.buttonClickCooldown = 1000; // 1秒冷却时间
  }

  // 处理鱼详情界面触摸
  handleTouch(x, y) {
    if (!this.eventHandler.selectedFishData) return;

    const detailWidth = config.screenWidth - 60;
    const detailHeight = 380;
    const detailX = 30;
    const detailY = (config.screenHeight - detailHeight) / 2;

    // 关闭按钮
    const closeButtonSize = 30;
    const closeButtonX = detailX + detailWidth - closeButtonSize - 15;
    const closeButtonY = detailY + 10;

    if (x >= closeButtonX && x <= closeButtonX + closeButtonSize &&
        y >= closeButtonY && y <= closeButtonY + closeButtonSize) {
      this.eventHandler.hideFishDetail();
      return;
    }

    // 点赞按钮
    const buttonWidth = (detailWidth - 60) / 2;
    const buttonY = this.calculateButtonY();
    const buttonHeight = 36;

    const likeButtonX = detailX + 20;
    const likeButtonY = buttonY;

    // 点踩按钮
    const dislikeButtonX = detailX + buttonWidth + 40;
    const dislikeButtonY = buttonY;

    // 新增：防止快速连续点击
    const now = Date.now();
    if (now - this.lastButtonClickTime < this.buttonClickCooldown) {
      console.log('按钮点击过于频繁，跳过');
      return;
    }

    if (x >= likeButtonX && x <= likeButtonX + buttonWidth &&
        y >= likeButtonY && y <= likeButtonY + buttonHeight) {
      console.log('点击鱼详情点赞按钮');
      this.lastButtonClickTime = now;
      this.eventHandler.handleLikeAction();
      return;
    }

    if (x >= dislikeButtonX && x <= dislikeButtonX + buttonWidth &&
        y >= dislikeButtonY && y <= dislikeButtonY + buttonHeight) {
      console.log('点击鱼详情点踩按钮');
      this.lastButtonClickTime = now;
      this.eventHandler.handleDislikeAction();
      return;
    }

    // 点击详情卡片外部
    if (!(x >= detailX && x <= detailX + detailWidth &&
          y >= detailY && y <= detailY + detailHeight)) {
      this.eventHandler.hideFishDetail();
    }
  }

  // 计算按钮Y坐标
  calculateButtonY() {
    const fishImage = this.eventHandler.selectedFishData.fish.image;
    const detailWidth = config.screenWidth - 60;
    const maxImageWidth = detailWidth - 10;
    const maxImageHeight = 180;

    let imageWidth = fishImage.width;
    let imageHeight = fishImage.height;

    if (imageWidth > maxImageWidth) {
      const scale = maxImageWidth / imageWidth;
      imageWidth = maxImageWidth;
      imageHeight = imageHeight * scale;
    }

    if (imageHeight > maxImageHeight) {
      const scale = maxImageHeight / imageHeight;
      imageHeight = maxImageHeight;
      imageWidth = imageWidth * scale;
    }

    const imageY = (config.screenHeight - 380) / 2 + 50;
    const textStartY = imageY + imageHeight + 20;
    return textStartY + 75;
  }
}

module.exports = FishDetailTouchHandler;
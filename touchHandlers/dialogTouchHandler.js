// touchHandlers/dialogTouchHandler.js - 对话框触摸处理
const { config } = require('../config.js');

class DialogTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 处理对话框触摸
  handleTouch(x, y) {
    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 确认按钮
    const confirmButtonX = dialogX + 20;
    const confirmButtonY = dialogY + dialogHeight - 60;
    const confirmButtonWidth = dialogWidth - 40;
    const confirmButtonHeight = 40;

    if (x >= confirmButtonX && x <= confirmButtonX + confirmButtonWidth &&
        y >= confirmButtonY && y <= confirmButtonY + confirmButtonHeight) {
      this.eventHandler.confirmFishName();
      return;
    }

    // 取消按钮
    const cancelButtonX = dialogX + 20;
    const cancelButtonY = dialogY + dialogHeight - 110;
    const cancelButtonWidth = dialogWidth - 40;
    const cancelButtonHeight = 40;

    if (x >= cancelButtonX && x <= cancelButtonX + cancelButtonWidth &&
        y >= cancelButtonY && y <= cancelButtonY + cancelButtonHeight) {
      this.eventHandler.hideNameInputDialog();
      return;
    }

    // 输入框
    const inputBoxX = dialogX + 20;
    const inputBoxY = dialogY + 70;
    const inputBoxWidth = dialogWidth - 40;
    const inputBoxHeight = 40;

    if (x >= inputBoxX && x <= inputBoxX + inputBoxWidth &&
        y >= inputBoxY && y <= inputBoxY + inputBoxHeight) {
      this.eventHandler.showKeyboardInput();
      return;
    }
  }
}

module.exports = DialogTouchHandler;
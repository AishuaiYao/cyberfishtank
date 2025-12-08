// touchHandlers/searchDialogTouchHandler.js - 搜索对话框触摸处理
const { config } = require('../config.js');

class SearchDialogTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 处理搜索对话框触摸
  handleTouch(x, y) {
    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2 - 100;

    // 搜索按钮
    const searchButtonX = dialogX + 20;
    const searchButtonY = dialogY + dialogHeight - 60;
    const searchButtonWidth = dialogWidth - 40;
    const searchButtonHeight = 40;

    if (x >= searchButtonX && x <= searchButtonX + searchButtonWidth &&
        y >= searchButtonY && y <= searchButtonY + searchButtonHeight) {
      this.eventHandler.performSearch();
      return;
    }

    // 取消按钮
    const cancelButtonX = dialogX + 20;
    const cancelButtonY = dialogY + dialogHeight - 110;
    const cancelButtonWidth = dialogWidth - 40;
    const cancelButtonHeight = 40;

    if (x >= cancelButtonX && x <= cancelButtonX + cancelButtonWidth &&
        y >= cancelButtonY && y <= cancelButtonY + cancelButtonHeight) {
      this.eventHandler.hideSearchDialog();
      return;
    }

    // 输入框
    const inputBoxX = dialogX + 20;
    const inputBoxY = dialogY + 70;
    const inputBoxWidth = dialogWidth - 40;
    const inputBoxHeight = 40;

    if (x >= inputBoxX && x <= inputBoxX + inputBoxWidth &&
        y >= inputBoxY && y <= inputBoxY + inputBoxHeight) {
      this.eventHandler.showSearchKeyboardInput();
      return;
    }
  }
}

module.exports = SearchDialogTouchHandler;
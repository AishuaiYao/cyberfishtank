// esp32TouchHandler.js - ESP32界面触摸处理
const { config } = require('../config.js');

class ESP32TouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }
  
  // 处理触摸开始
  handleTouchStart(x, y) {
    // 暂时不处理
  }
  
  // 处理触摸移动
  handleTouchMove(x, y) {
    // 暂时不处理
  }
  
  // 处理触摸结束
  handleTouchEnd(x, y) {
    const esp32Manager = this.eventHandler.esp32Manager;
    const esp32Renderer = this.eventHandler.uiManager.esp32InterfaceRenderer;
    
    if (!esp32Manager || !esp32Renderer) {
      return false;
    }
    
    // 检测返回按钮点击
    if (esp32Renderer.isBackButtonClicked(x, y)) {
      console.log('ESP32界面返回按钮被点击');
      this.eventHandler.hideESP32Interface();
      return true;
    }
    
    // 检测连接按钮点击
    if (esp32Renderer.isConnectButtonClicked(x, y, esp32Manager)) {
      console.log('ESP32连接按钮被点击');
      if (esp32Manager.connected) {
        esp32Manager.disconnect();
      } else {
        esp32Manager.connect();
      }
      return true;
    }
    
    // 检测拍照按钮点击
    if (esp32Renderer.isCaptureButtonClicked(x, y, esp32Manager)) {
      console.log('ESP32拍照按钮被点击');
      esp32Manager.captureImage();
      return true;
    }
    
    return false;
  }
  
  // 处理长按
  handleLongPress(x, y) {
    // 暂时不处理
  }
}

module.exports = ESP32TouchHandler;

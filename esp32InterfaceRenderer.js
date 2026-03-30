// esp32InterfaceRenderer.js - ESP32界面绘制逻辑
const { config } = require('./config.js');
const Utils = require('./utils.js');

class ESP32InterfaceRenderer {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
  }
  
  // 绘制ESP32主界面
  drawESP32Interface(esp32Manager) {
    const ctx = this.ctx;
    
    // 绘制背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);
    
    // 绘制标题
    this.drawTitle();
    
    // 绘制连接状态
    this.drawConnectionStatus(esp32Manager);
    
    // 绘制连接按钮
    this.drawConnectButton(esp32Manager);
    
    // 绘制拍照按钮
    this.drawCaptureButton(esp32Manager);
    
    // 绘制进度条（如果正在采集）
    if (esp32Manager.capturing) {
      this.drawProgressBar(esp32Manager);
    }
    
    // 绘制图像预览
    if (esp32Manager.imageData) {
      this.drawImagePreview(esp32Manager);
    }
    
    // 绘制本地图片统计
    this.drawImageStats(esp32Manager);
    
    // 绘制使用提示
    this.drawTips(esp32Manager);
    
    // 绘制调试日志
    this.drawLogPanel(esp32Manager);
    
    // 绘制返回按钮
    this.drawBackButton();
  }
  
  // 绘制标题
  drawTitle() {
    const ctx = this.ctx;
    
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 20px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ESP32 摄像头', config.screenWidth / 2, 50);
    ctx.textAlign = 'left';
  }
  
  // 绘制连接状态
  drawConnectionStatus(esp32Manager) {
    const ctx = this.ctx;
    const y = 80;
    
    // 状态条背景
    const statusBarWidth = config.screenWidth - 40;
    const statusBarHeight = 40;
    const statusBarX = 20;
    
    ctx.fillStyle = esp32Manager.connected ? '#E8F5E9' : '#FFEBEE';
    Utils.drawRoundedRect(ctx, statusBarX, y, statusBarWidth, statusBarHeight, 8, true, false);
    
    // 状态文字
    ctx.fillStyle = esp32Manager.connected ? '#4CAF50' : '#F44336';
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      esp32Manager.connected ? '✓ 已连接 ESP32' : '✗ 未连接',
      config.screenWidth / 2,
      y + 26
    );
    ctx.textAlign = 'left';
  }
  
  // 绘制连接按钮
  drawConnectButton(esp32Manager) {
    const ctx = this.ctx;
    const y = 140;
    const buttonWidth = config.screenWidth - 40;
    const buttonHeight = 50;
    const buttonX = 20;
    
    const buttonText = esp32Manager.connected ? '断开连接' : '连接 ESP32';
    const isPrimary = !esp32Manager.connected;
    
    Utils.drawModernButton(
      ctx,
      buttonX,
      y,
      buttonWidth,
      buttonHeight,
      buttonText,
      false,
      isPrimary
    );
  }
  
  // 绘制拍照按钮
  drawCaptureButton(esp32Manager) {
    const ctx = this.ctx;
    const y = 210;
    const buttonWidth = config.screenWidth - 40;
    const buttonHeight = 50;
    const buttonX = 20;
    
    const isDisabled = !esp32Manager.connected || esp32Manager.capturing;
    const buttonText = esp32Manager.capturing ? `采集中 ${esp32Manager.progress}%` : '📷 拍照';
    
    // 禁用状态用灰色
    if (isDisabled) {
      ctx.fillStyle = '#E5E5EA';
      Utils.drawRoundedRect(ctx, buttonX, y, buttonWidth, buttonHeight, 8, true, false);
      
      ctx.fillStyle = '#8E8E93';
      ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(buttonText, config.screenWidth / 2, y + 32);
      ctx.textAlign = 'left';
    } else {
      Utils.drawModernButton(
        ctx,
        buttonX,
        y,
        buttonWidth,
        buttonHeight,
        buttonText,
        false,
        true
      );
    }
  }
  
  // 绘制进度条
  drawProgressBar(esp32Manager) {
    const ctx = this.ctx;
    const y = 270;
    const barWidth = config.screenWidth - 40;
    const barHeight = 8;
    const barX = 20;
    
    // 进度条背景
    ctx.fillStyle = '#E5E5EA';
    Utils.drawRoundedRect(ctx, barX, y, barWidth, barHeight, 4, true, false);
    
    // 进度填充
    const progressWidth = (esp32Manager.progress / 100) * barWidth;
    ctx.fillStyle = config.primaryColor;
    Utils.drawRoundedRect(ctx, barX, y, progressWidth, barHeight, 4, true, false);
  }
  
  // 绘制图像预览
  drawImagePreview(esp32Manager) {
    const ctx = this.ctx;
    const y = 290;
    const previewWidth = config.screenWidth - 40;
    const previewHeight = 120;
    const previewX = 20;
    
    // 预览区域标题
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('当前拍摄', previewX, y);
    
    // 预览区域背景
    ctx.fillStyle = '#F8F9FA';
    Utils.drawRoundedRect(ctx, previewX, y + 10, previewWidth, previewHeight, 8, true, false);
    
    // 绘制图像
    ctx.drawImage(esp32Manager.imageData, previewX + 10, y + 20, previewWidth - 20, previewHeight - 20);
  }
  
  // 绘制本地图片统计
  drawImageStats(esp32Manager) {
    const ctx = this.ctx;
    const y = esp32Manager.imageData ? 440 : 290;
    const statsWidth = config.screenWidth - 40;
    const statsHeight = 40;
    const statsX = 20;
    
    const imageCount = esp32Manager.getLocalImageCount();
    
    // 统计条背景
    ctx.fillStyle = '#F8F9FA';
    Utils.drawRoundedRect(ctx, statsX, y, statsWidth, statsHeight, 8, true, false);
    
    // 统计文字
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`本地已保存 ${imageCount} 张图片`, config.screenWidth / 2, y + 26);
    ctx.textAlign = 'left';
  }
  
  // 绘制使用提示
  drawTips(esp32Manager) {
    const ctx = this.ctx;
    const y = esp32Manager.imageData ? 500 : 350;
    const tipsWidth = config.screenWidth - 40;
    const tipsX = 20;
    
    const tips = [
      '使用说明：',
      '1. 手机WiFi切换至ESP32热点',
      '2. 点击"连接 ESP32"测试通信',
      '3. 连接后点击"拍照"采集图像',
      '4. 图片自动保存到本地'
    ];
    
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    
    tips.forEach((tip, index) => {
      ctx.fillText(tip, tipsX, y + index * 20);
    });
  }
  
  // 绘制调试日志
  drawLogPanel(esp32Manager) {
    const ctx = this.ctx;
    const y = esp32Manager.imageData ? 620 : 470;
    const panelWidth = config.screenWidth - 40;
    const panelHeight = 80;
    const panelX = 20;
    
    // 日志面板标题
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`调试日志 (${esp32Manager.logMsgs.length})`, panelX, y);
    
    // 日志面板背景
    ctx.fillStyle = '#F8F9FA';
    Utils.drawRoundedRect(ctx, panelX, y + 10, panelWidth, panelHeight, 8, true, false);
    
    // 日志内容
    ctx.fillStyle = '#666666';
    ctx.font = '10px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    
    const visibleLogs = esp32Manager.logMsgs.slice(0, 5);
    visibleLogs.forEach((log, index) => {
      const truncatedLog = log.length > 50 ? log.substring(0, 50) + '...' : log;
      ctx.fillText(truncatedLog, panelX + 10, y + 30 + index * 14);
    });
  }
  
  // 绘制返回按钮
  drawBackButton() {
    const ctx = this.ctx;
    
    Utils.drawModernButton(
      ctx,
      20,
      config.screenHeight - 60,
      80,
      40,
      '← 返回',
      false,
      false
    );
  }
  
  // 检测连接按钮点击
  isConnectButtonClicked(x, y, esp32Manager) {
    const buttonY = 140;
    const buttonWidth = config.screenWidth - 40;
    const buttonHeight = 50;
    const buttonX = 20;
    
    return x >= buttonX && x <= buttonX + buttonWidth &&
           y >= buttonY && y <= buttonY + buttonHeight;
  }
  
  // 检测拍照按钮点击
  isCaptureButtonClicked(x, y, esp32Manager) {
    const buttonY = 210;
    const buttonWidth = config.screenWidth - 40;
    const buttonHeight = 50;
    const buttonX = 20;
    
    return x >= buttonX && x <= buttonX + buttonWidth &&
           y >= buttonY && y <= buttonY + buttonHeight;
  }
  
  // 检测返回按钮点击
  isBackButtonClicked(x, y) {
    const buttonX = 20;
    const buttonY = config.screenHeight - 60;
    const buttonWidth = 80;
    const buttonHeight = 40;
    
    return x >= buttonX && x <= buttonX + buttonWidth &&
           y >= buttonY && y <= buttonY + buttonHeight;
  }
}

module.exports = ESP32InterfaceRenderer;

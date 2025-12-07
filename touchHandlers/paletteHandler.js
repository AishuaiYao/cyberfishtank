// 调色板界面处理器
const { config, getAreaPositions } = require('../config.js');

class PaletteHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.isVisible = false;
    this.paletteColors = this.generatePaletteColors();
    this.selectedColor = null;
    this.positions = getAreaPositions();
  }

  // 生成调色板颜色数组
  generatePaletteColors() {
    // 生成丰富的调色板颜色，包括基本色、中间色和渐变色
    const colors = [];
    
    // 基本颜色
    const baseColors = [
      '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA', '#5856D6', // 原色
      '#8E8E93', '#C7C7CC', '#EFEFF4', '#000000', '#1D1D1F', '#FFFFFF'  // 中性色
    ];
    
    // 红色系
    for (let i = 0; i <= 100; i += 20) {
      const brightness = 100 - i;
      colors.push(`hsl(0, ${100}%, ${brightness}%)`);
    }
    
    // 橙色系
    for (let i = 0; i <= 100; i += 20) {
      const brightness = 100 - i;
      colors.push(`hsl(30, ${100}%, ${brightness}%)`);
    }
    
    // 黄色系
    for (let i = 0; i <= 100; i += 20) {
      const brightness = 100 - i;
      colors.push(`hsl(60, ${100}%, ${brightness}%)`);
    }
    
    // 绿色系
    for (let i = 0; i <= 100; i += 20) {
      const brightness = 100 - i;
      colors.push(`hsl(120, ${100}%, ${brightness}%)`);
    }
    
    // 蓝色系
    for (let i = 0; i <= 100; i += 20) {
      const brightness = 100 - i;
      colors.push(`hsl(240, ${100}%, ${brightness}%)`);
    }
    
    // 紫色系
    for (let i = 0; i <= 100; i += 20) {
      const brightness = 100 - i;
      colors.push(`hsl(270, ${100}%, ${brightness}%)`);
    }
    
    // 添加基本颜色
    colors.push(...baseColors);
    
    return [...new Set(colors)]; // 去重
  }

  // 显示调色板界面
  showPaletteInterface() {
    console.log('显示调色板界面');
    this.isVisible = true;
    this.selectedColor = null;
    
    // 重新绘制界面
    this.drawPaletteInterface();
  }

  // 隐藏调色板界面
  hidePaletteInterface() {
    console.log('隐藏调色板界面');
    this.isVisible = false;
    
    // 重新绘制主界面
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
  }

  // 绘制调色板界面
  drawPaletteInterface() {
    if (!this.isVisible) return;

    const ctx = this.eventHandler.canvas.getContext('2d');
    
    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);
    
    // 绘制调色板面板
    const panelWidth = config.screenWidth - 60;
    const panelHeight = 300;
    const panelX = 30;
    const panelY = (config.screenHeight - panelHeight) / 2;
    
    // 面板背景
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
    
    ctx.beginPath();
    // 使用兼容WeChat环境的圆角矩形绘制方法
    this.drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    
    // 面板边框
    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
    ctx.stroke();
    
    // 标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('选择颜色', panelX + panelWidth / 2, panelY + 30);
    
    // 绘制颜色网格
    const colorSize = 24;
    const colorsPerRow = Math.floor((panelWidth - 40) / (colorSize + 8));
    const startX = panelX + 20;
    const startY = panelY + 60;
    
    for (let i = 0; i < this.paletteColors.length; i++) {
      const row = Math.floor(i / colorsPerRow);
      const col = i % colorsPerRow;
      const x = startX + col * (colorSize + 8);
      const y = startY + row * (colorSize + 8);
      
      // 绘制颜色方块
      ctx.fillStyle = this.paletteColors[i];
      ctx.beginPath();
      this.drawRoundedRect(ctx, x, y, colorSize, colorSize, 4);
      ctx.fill();
      
      // 边框
      ctx.strokeStyle = this.paletteColors[i] === this.selectedColor ? config.primaryColor : '#E5E5EA';
      ctx.lineWidth = this.paletteColors[i] === this.selectedColor ? 2 : 1;
      ctx.beginPath();
      this.drawRoundedRect(ctx, x, y, colorSize, colorSize, 4);
      ctx.stroke();
    }
    
    // 当前选中颜色预览
    if (this.selectedColor) {
      const previewSize = 40;
      const previewX = panelX + panelWidth - previewSize - 20;
      const previewY = panelY + panelHeight - previewSize - 60;
      
      // 预览背景
      ctx.fillStyle = this.selectedColor;
      ctx.beginPath();
      this.drawRoundedRect(ctx, previewX, previewY, previewSize, previewSize, 6);
      ctx.fill();
      
      ctx.strokeStyle = config.primaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.drawRoundedRect(ctx, previewX, previewY, previewSize, previewSize, 6);
      ctx.stroke();
      
      // 预览文本
      ctx.fillStyle = config.textColor;
      ctx.font = '12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('当前选择:', panelX + 20, previewY + 20);
    }
    
    // 按钮区域
    const buttonWidth = 100;
    const buttonHeight = 36;
    const buttonY = panelY + panelHeight - 40;
    
    // 取消按钮
    const cancelX = panelX + (panelWidth - buttonWidth * 2 - 20) / 2;
    ctx.fillStyle = '#8E8E93';
    ctx.beginPath();
    this.drawRoundedRect(ctx, cancelX, buttonY, buttonWidth, buttonHeight, 6);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('取消', cancelX + buttonWidth / 2, buttonY + buttonHeight / 2 + 5);
    
    // 确定按钮
    const confirmX = cancelX + buttonWidth + 20;
    ctx.fillStyle = this.selectedColor ? config.primaryColor : '#C7C7CC';
    ctx.beginPath();
    this.drawRoundedRect(ctx, confirmX, buttonY, buttonWidth, buttonHeight, 6);
    ctx.fill();
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('确定', confirmX + buttonWidth / 2, buttonY + buttonHeight / 2 + 5);
    
    ctx.textAlign = 'left';
  }

  // 处理调色板界面触摸
  handlePaletteTouch(x, y) {
    if (!this.isVisible) return false;
    
    const panelWidth = config.screenWidth - 60;
    const panelHeight = 300;
    const panelX = 30;
    const panelY = (config.screenHeight - panelHeight) / 2;
    
    // 检查是否点击在面板外部（关闭面板）
    if (x < panelX || x > panelX + panelWidth || y < panelY || y > panelY + panelHeight) {
      this.hidePaletteInterface();
      return true;
    }
    
    // 检查颜色选择
    const colorSize = 24;
    const colorsPerRow = Math.floor((panelWidth - 40) / (colorSize + 8));
    const startX = panelX + 20;
    const startY = panelY + 60;
    
    for (let i = 0; i < this.paletteColors.length; i++) {
      const row = Math.floor(i / colorsPerRow);
      const col = i % colorsPerRow;
      const colorX = startX + col * (colorSize + 8);
      const colorY = startY + row * (colorSize + 8);
      
      if (x >= colorX && x <= colorX + colorSize && y >= colorY && y <= colorY + colorSize) {
        this.selectedColor = this.paletteColors[i];
        this.drawPaletteInterface();
        return true;
      }
    }
    
    // 检查按钮点击
    const buttonWidth = 100;
    const buttonHeight = 36;
    const buttonY = panelY + panelHeight - 40;
    const cancelX = panelX + (panelWidth - buttonWidth * 2 - 20) / 2;
    const confirmX = cancelX + buttonWidth + 20;
    
    // 取消按钮
    if (x >= cancelX && x <= cancelX + buttonWidth && y >= buttonY && y <= buttonY + buttonHeight) {
      this.hidePaletteInterface();
      return true;
    }
    
    // 确定按钮
    if (x >= confirmX && x <= confirmX + buttonWidth && y >= buttonY && y <= buttonY + buttonHeight) {
      if (this.selectedColor) {
        // 设置选中颜色
        this.eventHandler.gameState.setColor(this.selectedColor);
        console.log('选择颜色:', this.selectedColor);
      }
      this.hidePaletteInterface();
      return true;
    }
    
    return true; // 阻止事件冒泡
  }

  // 绘制圆角矩形（兼容WeChat环境）
  drawRoundedRect(ctx, x, y, width, height, radius) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  // 清理资源
  cleanup() {
    this.isVisible = false;
    this.selectedColor = null;
  }
}

module.exports = PaletteHandler;
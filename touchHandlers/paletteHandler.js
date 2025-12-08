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

  // 生成调色板颜色数组 - 真正的多彩色系
  generatePaletteColors() {
    const colors = [];

    // 基础颜色 - 彩虹色系
    const rainbowColors = [
      // 红色系
      '#FF0000', '#FF3333', '#FF6666', '#FF9999', '#FFCCCC',
      // 橙色系
      '#FF8000', '#FF9933', '#FFB366', '#FFCC99', '#FFE5CC',
      // 黄色系
      '#FFFF00', '#FFFF33', '#FFFF66', '#FFFF99', '#FFFFCC',
      // 绿色系
      '#00FF00', '#33FF33', '#66FF66', '#99FF99', '#CCFFCC',
      // 青色系
      '#00FFFF', '#33FFFF', '#66FFFF', '#99FFFF', '#CCFFFF',
      // 蓝色系
      '#0000FF', '#3333FF', '#6666FF', '#9999FF', '#CCCCFF',
      // 紫色系
      '#8000FF', '#9933FF', '#B366FF', '#CC99FF', '#E5CCFF',
      // 品红色系
      '#FF00FF', '#FF33FF', '#FF66FF', '#FF99FF', '#FFCCFF'
    ];

    // 专业颜色 - 饱和度/亮度变化
    const professionalColors = [
      // 高饱和度鲜艳色
      '#FF3B30', '#FF9500', '#FFCC00', '#4CD964', '#5AC8FA',
      '#5856D6', '#E91E63', '#9C27B0', '#00BCD4', '#26C6DA',

      // 中等饱和度
      '#FF6B6B', '#FFB74D', '#FFEB3B', '#66BB6A', '#42A5F5',
      '#7E57C2', '#F48FB1', '#BA68C8', '#4FC3F7', '#4DD0E1',

      // 低饱和度柔和色
      '#FFCDD2', '#FFE0B2', '#FFF9C4', '#C8E6C9', '#B3E5FC',
      '#C5CAE9', '#F8BBD0', '#E1BEE7', '#B3E5FC', '#B2EBF2'
    ];

    // 灰度色系
    const grayscaleColors = [
      '#000000', '#1A1A1A', '#333333', '#4D4D4D', '#666666',
      '#808080', '#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6',
      '#FFFFFF'
    ];

    // 自然色系
    const naturalColors = [
      // 肤色
      '#FFDBAC', '#F1C27D', '#E0AC69', '#C68642', '#8D5524',
      // 植物色
      '#8BC34A', '#689F38', '#558B2F', '#33691E', '#1B5E20',
      // 大地色
      '#795548', '#6D4C41', '#5D4037', '#4E342E', '#3E2723',
      // 天空/水色
      '#03A9F4', '#0288D1', '#0277BD', '#01579B', '#004D40'
    ];

    // 金属色系
    const metallicColors = [
      // 金色
      '#FFD700', '#FFDF00', '#FFEC8B', '#FFFACD',
      // 银色
      '#C0C0C0', '#D3D3D3', '#E8E8E8', '#F5F5F5',
      // 青铜色
      '#B87333', '#CD7F32', '#E6BE8A', '#F0D9B5',
      // 铜色
      '#B87333', '#D2691E', '#CD853F', '#DEB887',
      // 铂金色
      '#E5E4E2', '#F1F0E6'  // 新增两个颜色，使总数为9的倍数
    ];

    // 组合所有颜色
    colors.push(...rainbowColors, ...professionalColors, ...grayscaleColors, ...naturalColors, ...metallicColors);

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

    // 绘制调色板面板 - 增大高度以适应更多颜色
    const panelWidth = config.screenWidth - 60;
    const panelHeight = Math.min(config.screenHeight - 80, 599.5); // 增大高度到599.5px（增加10%）
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
    const colorsPerRow = 9; // 确保每行显示9个色块
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
    const panelHeight = Math.min(config.screenHeight - 80, 599.5); // 增大高度到599.5px（增加10%）
    const panelX = 30;
    const panelY = (config.screenHeight - panelHeight) / 2;
    
    // 检查是否点击在面板外部（关闭面板）
    if (x < panelX || x > panelX + panelWidth || y < panelY || y > panelY + panelHeight) {
      this.hidePaletteInterface();
      return true;
    }
    
    // 检查颜色选择
    const colorSize = 24;
    const colorsPerRow = 9; // 确保每行显示9个色块
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
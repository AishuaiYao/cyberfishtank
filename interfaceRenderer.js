// interfaceRenderer.js - 界面绘制逻辑
const Utils = require('./utils.js');
const { config, getAreaPositions } = require('./config.js');

class InterfaceRenderer {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    this.optimizeRendering();

    // 提示语轮换
    this.tips = ['鱼头请朝右', '双指长按然后外拉缩放'];
    this.currentTipIndex = 0;
    this.lastTipChangeTime = Date.now();
    this.tipChangeInterval = 5000;

    // 闯关按钮边界（供触摸检测使用）
    this.challengeBtnBounds = null;
  }

  optimizeRendering() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'high';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // 绘制背景
  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);
  }

  // 绘制功能区
  drawFunctionArea(gameState, positions) {
    const startY = positions.functionAreaY;
    const ctx = this.ctx;

    // 颜色选择
    Utils.drawCard(ctx, 15, startY, config.screenWidth - 30, config.partHeight - 20);
    this.drawColorButtons(startY + 10, gameState);

    // 画笔大小调节
    Utils.drawCard(ctx, 15, startY + config.partHeight - 15, config.screenWidth - 30, config.partHeight - 40);
    this.drawBrushSizeControl(startY + config.partHeight + 15, gameState);

    // 工具按钮
    Utils.drawCard(ctx, 15, startY + config.partHeight * 2 - 50, config.screenWidth - 30, config.partHeight - 10);
    this.drawToolButtons(startY + config.partHeight * 2 - 40, gameState);
  }

  // 绘制颜色按钮
  drawColorButtons(startY, gameState) {
    const ctx = this.ctx;
    const totalWidth = config.colorButtonSize * 7 + 18 * 6;
    const startX = (config.screenWidth - totalWidth) / 2;

    for (let i = 0; i < 7; i++) {
      const x = Math.round(startX + i * (config.colorButtonSize + 18));
      const isSelected = config.colors[i] === gameState.currentColor && !gameState.isEraser;

      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      // 调色板按钮（最后一个按钮）
      if (i === 6) {
        this.drawPaletteButton(ctx, x, startY, config.colorButtonSize, isSelected);
      } else {
        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize / 2, startY + config.colorButtonSize / 2,
          config.colorButtonSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = config.colors[i];
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.strokeStyle = config.colors[i] === '#FFFFFF' ? config.borderColor : 'transparent';
        ctx.lineWidth = config.colors[i] === '#FFFFFF' ? 1 : 0;
        ctx.stroke();
      }

      // 选中状态
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize / 2, startY + config.colorButtonSize / 2,
          config.colorButtonSize / 2 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = config.primaryColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize / 2, startY + config.colorButtonSize / 2,
          config.colorButtonSize / 2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // 绘制调色板按钮
  drawPaletteButton(ctx, x, y, size, isSelected) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const radius = size / 2;

    ctx.fillStyle = '#007AFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    const sectorColors = [
      '#FF3B30', '#FF9500', '#FFCC00', '#4CD964',
      '#5AC8FA', '#5856D6', '#E91E63', '#00BCD4'
    ];
    const sectorCount = sectorColors.length;
    const sectorAngle = (Math.PI * 2) / sectorCount;

    for (let i = 0; i < sectorCount; i++) {
      const startAngle = i * sectorAngle - Math.PI / 6;
      const endAngle = (i + 1) * sectorAngle - Math.PI / 6;

      ctx.fillStyle = sectorColors[i];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius * 0.85, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 绘制画笔大小控制
  drawBrushSizeControl(startY, gameState) {
    const ctx = this.ctx;
    const adjustedY = startY - 10;

    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('画笔大小:', 25, adjustedY);

    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;
    const progressWidth = (gameState.brushSize / 20) * sliderWidth;

    // 滑动条轨道
    ctx.fillStyle = '#E5E5EA';
    Utils.drawRoundedRect(ctx, sliderX, adjustedY - 6, sliderWidth, 3, 1.5, true, false);

    // 进度填充
    ctx.fillStyle = config.primaryColor;
    Utils.drawRoundedRect(ctx, sliderX, adjustedY - 6, progressWidth, 3, 1.5, true, false);

    // 滑动块
    const sliderPos = sliderX + progressWidth;
    ctx.shadowColor = 'rgba(0,122,255,0.15)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = config.primaryColor;
    ctx.beginPath();
    ctx.arc(sliderPos, adjustedY - 6, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sliderPos, adjustedY - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${gameState.brushSize}px`, config.screenWidth - 25, adjustedY);
    ctx.textAlign = 'left';
  }

  // 绘制工具按钮
  drawToolButtons(startY, gameState) {
    const toolButtons = [
      { name: '橡皮', icon: '◻' },
      { name: '撤销', icon: '↶' },
      { name: '清空', icon: '×' },
      { name: '翻转', icon: '⇄' }
    ];
    const toolWidth = (config.screenWidth - 50) / 4;

    for (let i = 0; i < toolButtons.length; i++) {
      const x = 30 + i * toolWidth;
      let isActive = false;

      if (i === 0 && gameState.isEraser) {
        isActive = true;
      }

      Utils.drawModernButton(this.ctx, x, startY, toolWidth - 10, config.buttonHeight,
        `${toolButtons[i].icon} ${toolButtons[i].name}`,
        isActive, false);
    }
  }

  // 绘制指示区
  drawIndicatorArea(positions) {
    const startY = positions.indicatorAreaY;
    const ctx = this.ctx;

    Utils.drawCard(ctx, 15, startY - 45, config.screenWidth - 30, config.indicatorHeight - 40);

    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎨画一条鱼吧!', config.screenWidth / 2, startY - 25);

    const currentTime = Date.now();
    if (currentTime - this.lastTipChangeTime >= this.tipChangeInterval) {
      this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
      this.lastTipChangeTime = currentTime;
    }

    ctx.fillStyle = config.lightTextColor;
    ctx.font = '14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(this.tips[this.currentTipIndex], config.screenWidth / 2, startY - 5);
    ctx.textAlign = 'left';
  }

  // 绘制绘画区
  drawDrawingArea(gameState, positions) {
    const startY = positions.drawingAreaY;
    const ctx = this.ctx;

    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#FFFFFF';
    Utils.drawRoundedRect(ctx, 12, startY, config.screenWidth - 24, config.drawingAreaHeight, config.borderRadius, true, false);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, 12, startY, config.screenWidth - 24, config.drawingAreaHeight, config.borderRadius, false, true);

    this.redrawAllPaths(gameState, startY);
    this.drawZoomIndicator(gameState, startY);
  }

  redrawAllPaths(gameState, drawingAreaY) {
    const ctx = this.ctx;
    const zoomState = gameState.zoomState;

    ctx.save();

    const padding = 2;
    ctx.beginPath();
    ctx.rect(12 + padding, drawingAreaY + padding,
      config.screenWidth - 24 - padding * 2,
      config.drawingAreaHeight - padding * 2);
    ctx.clip();

    if (zoomState.isZooming || zoomState.zoomScale !== 1.0) {
      this.applyZoomTransform(ctx, zoomState, drawingAreaY);
    }

    if (gameState.isFlipped) {
      ctx.translate(config.screenWidth, 0);
      ctx.scale(-1, 1);
    }

    gameState.drawingPaths.forEach(path => {
      if (path.points.length > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);

        for (let i = 1; i < path.points.length; i++) {
          ctx.lineTo(path.points[i].x, path.points[i].y);
        }

        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }
    });

    ctx.restore();
  }

  applyZoomTransform(ctx, zoomState, drawingAreaY) {
    const { zoomScale, zoomCenterX, zoomCenterY } = zoomState;
    ctx.translate(zoomCenterX, zoomCenterY);
    ctx.scale(zoomScale, zoomScale);
    ctx.translate(-zoomCenterX, -zoomCenterY);
  }

  drawZoomIndicator(gameState, drawingAreaY) {
    const ctx = this.ctx;
    const zoomState = gameState.zoomState;

    if (!zoomState.isZooming && zoomState.zoomScale === 1.0) return;

    const indicatorX = config.screenWidth - 60;
    const resetButtonX = 60;
    const indicatorY = drawingAreaY - 25;

    // 放大倍数
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    Utils.drawRoundedRect(ctx, indicatorX - 40, indicatorY - 10, 80, 20, 10, true, false);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${zoomState.zoomScale.toFixed(1)}x`, indicatorX, indicatorY);

    // 重置按钮
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    Utils.drawRoundedRect(ctx, resetButtonX - 40, indicatorY - 10, 80, 20, 10, true, false);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('重置', resetButtonX, indicatorY);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 绘制得分区
  drawScoreArea(gameState, positions) {
    const startY = positions.scoreAreaY;
    const ctx = this.ctx;

    Utils.drawCard(ctx, 15, startY, config.screenWidth - 30, config.scoreHeight - 10);

    ctx.textAlign = 'center';

    let scoreText = `AI评分：${gameState.score}`;
    let scoreColor = config.textColor;

    if (gameState.isScoring) {
      scoreText = 'AI评分中...';
      scoreColor = config.primaryColor;
    } else if (gameState.score > 0) {
      if (gameState.score >= 80) scoreColor = '#4CD964';
      else if (gameState.score >= 60) scoreColor = '#FFCC00';
      else scoreColor = '#FF3B30';
    }

    ctx.fillStyle = scoreColor;
    ctx.font = gameState.isScoring
      ? 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif'
      : 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(scoreText, config.screenWidth / 2, startY + 35);

    ctx.textAlign = 'left';
  }

  // 绘制跳转区：鱼缸 | 让它游起来！ | 分享
  drawJumpArea(positions) {
    const startY = positions.jumpAreaY;
    const ctx = this.ctx;

    Utils.drawCard(ctx, 15, startY, config.screenWidth - 30, config.jumpHeight - 20);

    const jumpButtons = ['🐠 鱼缸', '🚀 加入鱼缸', '📤 分享'];
    const buttonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < jumpButtons.length; i++) {
      const x = 30 + i * buttonWidth;
      const isPrimary = i === 1; // "加入鱼缸" 高亮

      Utils.drawModernButton(ctx, x, startY + 13, buttonWidth - 10, config.buttonHeight,
        jumpButtons[i], false, isPrimary);
    }
  }

  // 绘制主界面标题
  drawMainTitle() {
    const ctx = this.ctx;
    const title = '赛博鱼缸-共绘奇鱼';
    const x = 30;
    const y = 60;

    ctx.font = 'italic bold 18px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = config.textColor;
    ctx.textAlign = 'left';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillText(title, x, y);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // 绘制闯关区：闯关按钮 + 作者邮箱
  drawChallengeSection() {
    const ctx = this.ctx;
    const margin = 15;
    const btnWidth = config.screenWidth - margin * 2;
    const btnHeight = 42;
    const btnX = margin;
        // 紧跟跳转区末尾，固定间距 18px
    const positions = getAreaPositions();
    const btnY = positions.jumpAreaY + config.jumpHeight ;

    // 闯关按钮卡片底色
    Utils.drawCard(ctx, btnX, btnY, btnWidth, btnHeight);

    // 按钮渐变背景（橙红色渐变）
    const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    gradient.addColorStop(0, '#FF6B35');
    gradient.addColorStop(1, '#FF4500');
    ctx.fillStyle = gradient;
    Utils.drawRoundedRect(ctx, btnX + 1, btnY + 1, btnWidth - 2, btnHeight - 2, config.borderRadius, true, false);

    // 按钮文字 + 火焰图标
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥 闯关 🔥', btnX + btnWidth / 2, btnY + btnHeight / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // 邮箱小字
    const emailY = btnY + btnHeight + 16;
    ctx.fillStyle = '#8E8E93';
    ctx.font = '12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('联系作者：cyberfishtank@163.com', config.screenWidth / 2, emailY);
    ctx.textAlign = 'left';

    // 存储按钮边界供触碰检测使用
    this.challengeBtnBounds = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
  }

  // 获取闯关按钮边界
  getChallengeBtnBounds() {
    return this.challengeBtnBounds || null;
  }
}

module.exports = InterfaceRenderer;

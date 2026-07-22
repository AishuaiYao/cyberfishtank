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

    // 存储按钮边界供触碰检测使用
    this.challengeBtnBounds = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
  }

  // 获取闯关按钮边界
  getChallengeBtnBounds() {
    return this.challengeBtnBounds || null;
  }

  // ======================== 积分榜按钮 + 联系作者 ========================
  drawLeaderboardButton() {
    const ctx = this.ctx;
    const margin = 15;
    const btnWidth = config.screenWidth - margin * 2;
    const btnHeight = 32;
    const positions = getAreaPositions();
    const btnY = positions.jumpAreaY + config.jumpHeight + 42 + 18;

    // 存储按钮边界
    this.leaderboardBtnBounds = { x: margin, y: btnY, w: btnWidth, h: btnHeight };

    // 按钮底色卡片
    Utils.drawCard(ctx, margin, btnY, btnWidth, btnHeight);

    // 按钮背景
    const gradient = ctx.createLinearGradient(margin, btnY, margin, btnY + btnHeight);
    gradient.addColorStop(0, '#7B68EE');
    gradient.addColorStop(1, '#6A5ACD');
    ctx.fillStyle = gradient;
    Utils.drawRoundedRect(ctx, margin + 1, btnY + 1, btnWidth - 2, btnHeight - 2, 8, true, false);

    // 文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 闯关积分榜', margin + btnWidth / 2, btnY + btnHeight / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // 联系作者（积分榜下方）
    const emailY = btnY + btnHeight + 16;
    ctx.fillStyle = '#8E8E93';
    ctx.font = '12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('联系作者：cyberfishtank@163.com', config.screenWidth / 2, emailY);
    ctx.textAlign = 'left';
  }

  getLeaderboardBtnBounds() {
    return this.leaderboardBtnBounds || null;
  }

  // ======================== 选鱼界面 ========================
  drawFishSelectScreen(fishList, selectedIndex, hasDrawing) {
    const ctx = this.ctx;
    const sw = config.screenWidth;
    const sh = config.screenHeight;

    // 重置触摸信息
    this.fishSelectCardBounds = [];
    this.fishSelectBackBounds = null;
    this.fishSelectDrawBtnBounds = null;

    // 半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, sw, sh);

    // 标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐟 选择出战的小鱼', sw / 2, 52);
    ctx.textAlign = 'left';

    // 子标题
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('点击小鱼即可出战！', sw / 2, 76);
    ctx.textAlign = 'left';

    // 大鱼卡片网格
    const cardW = (sw - 48) / 3;   // 3 列
    const cardH = 130;
    const startY = 95;
    const maxCards = Math.min(fishList.length, 12); // 最多 4 行（12 条）

    for (let i = 0; i < maxCards; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = 14 + col * (cardW + 10);
      const cy = startY + row * (cardH + 10);
      const fish = fishList[i];
      const isSelected = (i === selectedIndex);

      // 卡片背景
      Utils.drawCard(ctx, cx, cy, cardW, cardH);
      if (isSelected) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        Utils.drawRoundedRect(ctx, cx, cy, cardW, cardH, 10, false, true);
        ctx.lineWidth = 1;
      }

      // 预览图区域（渐变背景）
      const previewSize = Math.min(cardW - 20, 64);
      const previewX = cx + (cardW - previewSize) / 2;
      const previewY = cy + 8;
      const previewGrad = ctx.createLinearGradient(previewX, previewY, previewX, previewY + previewSize);
      previewGrad.addColorStop(0, '#1a1a2e');
      previewGrad.addColorStop(1, '#16213e');
      ctx.fillStyle = previewGrad;
      Utils.drawRoundedRect(ctx, previewX, previewY, previewSize, previewSize, 8, true, false);

      // 绘制鱼名字前导字母
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (fish.fishName || '?')[0];
      ctx.fillText(initial, previewX + previewSize / 2, previewY + previewSize / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      // 鱼名（单行截断）
      const nameY = cy + previewSize + 18;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px -apple-system, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      const displayName = (fish.fishName || '小鱼').length > 6
        ? (fish.fishName || '小鱼').slice(0, 5) + '…'
        : (fish.fishName || '小鱼');
      ctx.fillText(displayName, cx + cardW / 2, nameY);
      ctx.textAlign = 'left';

      // 评分
      const scoreY = nameY + 18;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      const starCount = Math.min(5, Math.ceil((fish.score || 0) / 20));
      const stars = '⭐'.repeat(starCount) + '☆'.repeat(5 - starCount);
      ctx.fillText(stars, cx + cardW / 2, scoreY);
      ctx.textAlign = 'left';

      // 存储触摸区域
      this.fishSelectCardBounds.push({ x: cx, y: cy, w: cardW, h: cardH, index: i });
    }

    // 底部按钮区
    let bottomY = startY + Math.ceil(maxCards / 3) * (cardH + 10) + 20;

    // "使用当前绘画"按钮（如果有绘画）
    if (hasDrawing) {
      const btnW = sw - 60;
      const btnH = 44;
      const btnX = 30;
      bottomY = Math.max(bottomY, sh - 120);

      this.fishSelectDrawBtnBounds = { x: btnX, y: bottomY, w: btnW, h: btnH };

      const grad = ctx.createLinearGradient(btnX, bottomY, btnX, bottomY + btnH);
      grad.addColorStop(0, '#FF6B35');
      grad.addColorStop(1, '#FF4500');
      ctx.fillStyle = grad;
      Utils.drawRoundedRect(ctx, btnX, bottomY, btnW, btnH, 10, true, false);

      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎨 使用当前绘画出战', btnX + btnW / 2, bottomY + btnH / 2);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      bottomY += btnH + 14;
    }

    // 返回按钮
    bottomY = Math.min(bottomY, sh - 52);
    const backW = sw - 60;
    const backH = 42;
    const backX = 30;
    this.fishSelectBackBounds = { x: backX, y: bottomY, w: backW, h: backH };

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    Utils.drawRoundedRect(ctx, backX, bottomY, backW, backH, 10, true, false);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, backX, bottomY, backW, backH, 10, false, true);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', backX + backW / 2, bottomY + backH / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  // ======================== 积分榜 ========================
  drawLeaderboard(scores) {
    const ctx = this.ctx;
    const sw = config.screenWidth;
    const sh = config.screenHeight;

    // 重置触摸信息
    this.leaderboardBackBounds = null;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, sw, sh);

    // 标题
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 闯关积分榜', sw / 2, 48);
    ctx.textAlign = 'left';

    if (scores.length === 0) {
      // 空状态
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('还没有闯关记录', sw / 2, sh / 2 - 10);
      ctx.fillText('快去用你的小鱼冒险吧！', sw / 2, sh / 2 + 16);
      ctx.textAlign = 'left';
    } else {
      // 排序：分数降序
      const sorted = [...scores].sort((a, b) => b.score - a.score);

      // 表头
      const headerY = 75;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 13px sans-serif';
      const colX_name = 58;
      const colX_score = sw - 140;
      const colX_coins = sw - 82;
      ctx.fillText('排名', 16, headerY);
      ctx.fillText('小鱼', colX_name, headerY);
      ctx.fillText('分数', colX_score, headerY);
      ctx.fillText('金币', colX_coins, headerY);

      // 分隔线
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, headerY + 8);
      ctx.lineTo(sw - 16, headerY + 8);
      ctx.stroke();

      // 列表行
      const rowH = 42;
      const maxRows = Math.min(sorted.length, Math.floor((sh - 140) / rowH));
      for (let i = 0; i < maxRows; i++) {
        const row = sorted[i];
        const ry = headerY + 18 + i * rowH;
        const isTop3 = i < 3;

        // 行背景（斑马纹）
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(10, ry - 2, sw - 20, rowH - 4);
        }

        // 排名
        const rankText = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`;
        ctx.fillStyle = isTop3 ? '#FFD700' : 'rgba(255,255,255,0.55)';
        ctx.font = isTop3 ? '16px sans-serif' : '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rankText, 28, ry + rowH / 2 + 4);

        // 鱼名
        const displayName = (row.fishName || '未知').length > 8
          ? row.fishName.slice(0, 7) + '…'
          : row.fishName;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(displayName, colX_name, ry + rowH / 2 + 4);

        // 分数
        ctx.fillStyle = isTop3 ? '#FFD700' : '#FFFFFF';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${row.score}`, colX_score + 30, ry + rowH / 2 + 4);

        // 金币
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🪙${row.coins}`, colX_coins + 20, ry + rowH / 2 + 4);

        ctx.textAlign = 'left';
      }

      // 总记录数提示
      if (sorted.length > maxRows) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`... 共 ${sorted.length} 条记录，仅展示前 ${maxRows} 条`, sw / 2, headerY + 18 + maxRows * rowH + 10);
        ctx.textAlign = 'left';
      }
    }

    // 返回按钮（固定在底部）
    const backW = sw - 60;
    const backH = 42;
    const backX = 30;
    const backY = sh - backH - 20;
    this.leaderboardBackBounds = { x: backX, y: backY, w: backW, h: backH };

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    Utils.drawRoundedRect(ctx, backX, backY, backW, backH, 10, true, false);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, backX, backY, backW, backH, 10, false, true);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('关闭', backX + backW / 2, backY + backH / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
}

module.exports = InterfaceRenderer;

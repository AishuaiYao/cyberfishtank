// interfaceRenderer.js - 界面绘制逻辑
const Utils = require('./utils.js');
const { config } = require('./config.js');

class InterfaceRenderer {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    this.optimizeRendering();
  }

  // 优化渲染设置
  optimizeRendering() {
    const ctx = this.ctx;

    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'high';
    ctx.textRendering = 'geometricPrecision';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    console.log('界面渲染器优化完成，像素比:', this.pixelRatio);
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
    Utils.drawCard(ctx, 15, startY + config.partHeight -15 , config.screenWidth - 30, config.partHeight - 40);
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

      ctx.beginPath();
      ctx.arc(x + config.colorButtonSize/2, startY + config.colorButtonSize/2,
              config.colorButtonSize/2, 0, Math.PI * 2);
      ctx.fillStyle = config.colors[i];
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.strokeStyle = config.colors[i] === '#FFFFFF' ? config.borderColor : 'transparent';
      ctx.lineWidth = config.colors[i] === '#FFFFFF' ? 1 : 0;
      ctx.stroke();

      // 选中状态
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize/2, startY + config.colorButtonSize/2,
                config.colorButtonSize/2 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = config.primaryColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize/2, startY + config.colorButtonSize/2,
                config.colorButtonSize/2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
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

    // 大小显示
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${gameState.brushSize}px`, config.screenWidth - 25, adjustedY);
    ctx.textAlign = 'left';
  }

  // 绘制工具按钮 - 修改：添加缩放模式指示
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
      } else if (i === 3 && gameState.isFlipped) {
        isActive = true;
      }

      Utils.drawModernButton(this.ctx, x, startY, toolWidth - 10, config.buttonHeight,
                            `${toolButtons[i].icon} ${toolButtons[i].name}`,
                            isActive, false);
    }

    // 新增：绘制缩放模式指示器
    if (gameState.isZoomMode()) {
      this.drawZoomIndicator(startY, gameState);
    }
  }

  // 新增：绘制缩放模式指示器
  drawZoomIndicator(startY, gameState) {
    const ctx = this.ctx;
    const zoomState = gameState.zoomState;

    const indicatorX = config.screenWidth - 120;
    const indicatorY = startY - 25;

    // 绘制缩放指示器背景
    ctx.fillStyle = 'rgba(0, 122, 255, 0.1)';
    Utils.drawRoundedRect(ctx, indicatorX, indicatorY, 100, 20, 10, true, false);

    // 绘制边框
    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, indicatorX, indicatorY, 100, 20, 10, false, true);

    // 绘制缩放文本
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`缩放: ${zoomState.scale.toFixed(1)}x`, indicatorX + 50, indicatorY + 10);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 绘制指示区 - 修改：添加缩放提示
drawIndicatorArea(positions) {
  const startY = positions.indicatorAreaY;
  const ctx = this.ctx;

  Utils.drawCard(ctx, 15, startY - 45, config.screenWidth - 30, config.indicatorHeight - 40);

  ctx.fillStyle = config.textColor;
  ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';

  ctx.fillStyle = config.textColor;
  ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('🎨画一条鱼吧!', config.screenWidth / 2, startY - 25);

  ctx.fillStyle = config.lightTextColor;
  ctx.font = '14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';

  // 修复：移除对 gameState 的引用，使用固定提示文本
  const hintText = '双指缩放画布·鱼头请朝右';
  ctx.fillText(hintText, config.screenWidth / 2, startY - 5);

  ctx.textAlign = 'left';
}

  // 绘制绘画区 - 修改：支持缩放绘制
  drawDrawingArea(gameState, positions) {
    const startY = positions.drawingAreaY;
    const ctx = this.ctx;

    // 绘画区域卡片
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

    // 网格背景
    ctx.strokeStyle = '#F8F9FA';
    ctx.lineWidth = 1;

    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(12, Math.round(startY + i * (config.drawingAreaHeight / 4)));
      ctx.lineTo(config.screenWidth - 12, Math.round(startY + i * (config.drawingAreaHeight / 4)));
      ctx.stroke();
    }

    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.round(12 + i * ((config.screenWidth - 24) / 4)), startY);
      ctx.lineTo(Math.round(12 + i * ((config.screenWidth - 24) / 4)), startY + config.drawingAreaHeight);
      ctx.stroke();
    }

    // 绘制路径 - 支持缩放状态
    this.redrawAllPaths(gameState, startY);

    // 新增：绘制缩放视图框
    if (gameState && gameState.isZoomMode()) {
      this.drawZoomViewport(gameState, startY);
    }
  }

  // 重新绘制所有路径 - 修改：支持缩放和翻转
  redrawAllPaths(gameState, drawingAreaY) {
    const ctx = this.ctx;

    // 保存当前状态
    ctx.save();

    // 应用翻转变换
    if (gameState.isFlipped) {
      ctx.translate(config.screenWidth, 0);
      ctx.scale(-1, 1);
    }

    // 应用缩放变换
    if (gameState.isZoomMode()) {
      const zoom = gameState.zoomState;
      ctx.translate(zoom.offsetX, zoom.offsetY);
      ctx.scale(zoom.scale, zoom.scale);
    }

    // 绘制所有路径
    gameState.drawingPaths.forEach(path => {
      if (path.points.length > 0) {
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
      }
    });

    // 恢复状态
    ctx.restore();
  }

  // 新增：绘制缩放视图框
  drawZoomViewport(gameState, drawingAreaY) {
    const ctx = this.ctx;
    const zoom = gameState.zoomState;

    // 计算视图框在画布中的位置和大小
    const viewportX = 12;
    const viewportY = drawingAreaY;
    const viewportWidth = config.screenWidth - 24;
    const viewportHeight = config.drawingAreaHeight;

    // 绘制视图框边框
    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
    ctx.setLineDash([]);

    // 绘制缩放区域指示
    const scale = 1 / zoom.scale;
    const indicatorWidth = viewportWidth * scale;
    const indicatorHeight = viewportHeight * scale;
    const indicatorX = viewportX - zoom.offsetX * scale;
    const indicatorY = viewportY - zoom.offsetY * scale;

    ctx.fillStyle = 'rgba(0, 122, 255, 0.1)';
    ctx.fillRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);

    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(indicatorX, indicatorY, indicatorWidth, indicatorHeight);
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

    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillText('', config.screenWidth / 2 - 50, startY + 22);

    ctx.fillStyle = scoreColor;
    ctx.font = gameState.isScoring ? 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif' : 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(scoreText, config.screenWidth / 2, startY + 35);

    ctx.textAlign = 'left';
  }

  // 绘制跳转区
  drawJumpArea(positions) {
    const startY = positions.jumpAreaY;
    const ctx = this.ctx;

    Utils.drawCard(ctx, 15, startY, config.screenWidth - 30, config.jumpHeight - 20);

    const jumpButtons = ['🐠 鱼缸', '🚀 让它游起来！', '🏆 排行榜'];
    const buttonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < jumpButtons.length; i++) {
      const x = 30 + i * buttonWidth;
      const isPrimary = i === 1;

      Utils.drawModernButton(ctx, x, startY + 13, buttonWidth - 10, config.buttonHeight,
                            jumpButtons[i], false, isPrimary);
    }
  }
}

module.exports = InterfaceRenderer;
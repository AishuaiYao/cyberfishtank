// interfaceRenderer.js - 界面绘制逻辑
const Utils = require('./utils.js');
const { config } = require('./config.js');

class InterfaceRenderer {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    // 初始化时优化渲染设置
    this.optimizeRendering();
  }

  // 新增：优化渲染设置
  optimizeRendering() {
    const ctx = this.ctx;

    // 设置高质量图像渲染
    ctx.imageSmoothingEnabled = false; // 关闭图像平滑以获得更锐利的图像
    ctx.imageSmoothingQuality = 'high';

    // 设置文本渲染优化
    ctx.textRendering = 'geometricPrecision';

    // 设置清晰的线条渲染
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    console.log('界面渲染器优化完成，像素比:', this.pixelRatio);
  }

  // 绘制背景
  drawBackground() {
    const ctx = this.ctx;

    // 使用纯色背景避免渐变模糊
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);
  }

  // 绘制功能区
  drawFunctionArea(gameState, positions) {
    const startY = positions.functionAreaY;
    const ctx = this.ctx;

    // 颜色选择 - 使用更清晰的阴影
    Utils.drawCard(ctx, 15, startY, config.screenWidth - 30, config.partHeight - 20);
    this.drawColorButtons(startY + 10, gameState);

    // 在颜色区域上方绘制组队按钮
    this.drawTeamButton(startY - config.team.buttonSize - config.team.buttonMargin);

    // 画笔大小调节
    Utils.drawCard(ctx, 15, startY + config.partHeight -15 , config.screenWidth - 30, config.partHeight - 40);
    this.drawBrushSizeControl(startY + config.partHeight + 15, gameState);

    // 工具按钮
    Utils.drawCard(ctx, 15, startY + config.partHeight * 2 - 50, config.screenWidth - 30, config.partHeight - 10);
    this.drawToolButtons(startY + config.partHeight * 2 - 40, gameState);
  }

  // 绘制组队按钮
  drawTeamButton(y) {
    const ctx = this.ctx;
    const buttonSize = config.team.buttonSize;
    const x = config.team.buttonMargin; // 改为左上角位置
    
    // 确保坐标为整数
    const buttonX = Math.round(x);
    const buttonY = Math.round(y);
    
    // 绘制按钮背景
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    
    ctx.beginPath();
    ctx.arc(buttonX + buttonSize/2, buttonY + buttonSize/2, buttonSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    
    // 绘制按钮边框
    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(buttonX + buttonSize/2, buttonY + buttonSize/2, buttonSize/2, 0, Math.PI * 2);
    ctx.stroke();
    
    // 绘制图标
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.team.buttonIcon, buttonX + buttonSize/2, buttonY + buttonSize/2);
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 绘制颜色按钮
  drawColorButtons(startY, gameState) {
    const ctx = this.ctx;
    const totalWidth = config.colorButtonSize * 7 + 18 * 6;
    const startX = (config.screenWidth - totalWidth) / 2;

    for (let i = 0; i < 7; i++) {
      const x = Math.round(startX + i * (config.colorButtonSize + 18));
      const isSelected = config.colors[i] === gameState.currentColor && !gameState.isEraser;

      // 使用更清晰的阴影
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

      // 选中状态 - 使用更清晰的边框
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize/2, startY + config.colorButtonSize/2,
                config.colorButtonSize/2 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = config.primaryColor;
        ctx.lineWidth = 2; // 减少线宽提高清晰度
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

  // 上移10像素
  const adjustedY = startY - 10;

  // 保存当前文本基线设置
  const originalTextBaseline = ctx.textBaseline;

  // 使用调整后的Y坐标
  ctx.fillStyle = config.textColor;
  ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
  
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic'; // 确保使用标准基线
  ctx.fillText('画笔大小:', 25, adjustedY);
  
  // 重置文本基线
  ctx.textBaseline = originalTextBaseline;

  const sliderX = 100;
  const sliderWidth = config.screenWidth - 140;
  const progressWidth = (gameState.brushSize / 20) * sliderWidth;

  // 滑动条轨道 - 使用调整后的Y坐标
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
  ctx.textBaseline = 'alphabetic'; // 确保使用标准基线
  ctx.fillText(`${gameState.brushSize}px`, config.screenWidth - 25, adjustedY);
  
  // 重置文本对齐和基线
  ctx.textAlign = 'left';
  ctx.textBaseline = originalTextBaseline;
}

  // 绘制工具按钮 - 修改：翻转按钮显示状态
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

      // 设置激活状态
      if (i === 0 && gameState.isEraser) {
        isActive = true;
      } else if (i === 3 && gameState.isFlipped) {
        // 新增：翻转按钮激活状态
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

    // 使用更清晰的字体
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';

    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('🎨画一条鱼吧!', config.screenWidth / 2, startY - 25);

    ctx.fillStyle = config.lightTextColor;
    ctx.font = '14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('鱼头请朝右', config.screenWidth / 2, startY - 5);

    ctx.textAlign = 'left';
  }

  // 绘制绘画区 - 修改：支持翻转状态显示
  drawDrawingArea(gameState, positions) {
    const startY = positions.drawingAreaY;
    const ctx = this.ctx;

    // 绘画区域卡片 - 使用更清晰的阴影
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

    // 网格背景 - 使用更清晰的线条
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

    // 绘制路径
    this.redrawAllPaths(gameState, startY);
  }

  // 重新绘制所有路径 - 修改：支持翻转状态
  redrawAllPaths(gameState, drawingAreaY) {
    const ctx = this.ctx;

    // 如果处于翻转状态，应用翻转变换
    if (gameState.isFlipped) {
      ctx.save();
      ctx.translate(config.screenWidth, 0);
      ctx.scale(-1, 1);
    }

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

    if (gameState.isFlipped) {
      ctx.restore();
    }
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
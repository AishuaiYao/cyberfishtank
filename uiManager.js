const { config, getAreaPositions } = require('./config.js');

class UIManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.eventHandler = null; // 新增：用于访问事件处理器
  }

  // 设置事件处理器引用
  setEventHandler(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 绘制圆角矩形
  drawRoundedRect(x, y, width, height, radius, fill, stroke) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // 绘制卡片
  drawCard(x, y, width, height, radius = config.borderRadius) {
    const ctx = this.ctx;

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = config.shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#FFFFFF';
    this.drawRoundedRect(x, y, width, height, radius, true, false);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    this.drawRoundedRect(x, y, width, height, radius, false, true);
  }

  // 绘制现代按钮
  drawModernButton(x, y, width, height, text, isActive = false, isPrimary = false) {
    const ctx = this.ctx;

    ctx.fillStyle = isActive ? config.primaryColor :
                    isPrimary ? config.primaryColor : '#FFFFFF';
    this.drawRoundedRect(x, y, width, height, config.borderRadius, true, false);

    ctx.strokeStyle = isActive ? config.primaryColor : config.borderColor;
    ctx.lineWidth = isActive ? 0 : 1;
    this.drawRoundedRect(x, y, width, height, config.borderRadius, false, true);

    ctx.fillStyle = isActive ? '#FFFFFF' :
                    isPrimary ? '#FFFFFF' : config.textColor;
    ctx.font = '15px -apple-system, "PingFang SC", "Helvetica Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 绘制背景
  drawBackground() {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, config.screenWidth, config.screenHeight);
    gradient.addColorStop(0, '#F8F9FA');
    gradient.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);
  }

  // 绘制功能区
  drawFunctionArea(gameState) {
    const positions = getAreaPositions();
    const startY = positions.functionAreaY;

    // 颜色选择
    this.drawCard(15, startY, config.screenWidth - 30, config.partHeight - 10);
    this.drawColorButtons(startY + 20, gameState);

    // 画笔大小调节
    this.drawCard(15, startY + config.partHeight, config.screenWidth - 30, config.partHeight - 10);
    this.drawBrushSizeControl(startY + config.partHeight + 25, gameState);

    // 工具按钮
    this.drawCard(15, startY + config.partHeight * 2, config.screenWidth - 30, config.partHeight - 10);
    this.drawToolButtons(startY + config.partHeight * 2 + 15, gameState);
  }

  // 绘制颜色按钮
  drawColorButtons(startY, gameState) {
    const ctx = this.ctx;
    const totalWidth = config.colorButtonSize * 7 + 18 * 6;
    const startX = (config.screenWidth - totalWidth) / 2;

    for (let i = 0; i < 7; i++) {
      const x = startX + i * (config.colorButtonSize + 18);
      const isSelected = config.colors[i] === gameState.currentColor && !gameState.isEraser;

      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

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
                config.colorButtonSize/2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = config.primaryColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + config.colorButtonSize/2, startY + config.colorButtonSize/2,
                config.colorButtonSize/2 - 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  // 绘制画笔大小控制
  drawBrushSizeControl(startY, gameState) {
    const ctx = this.ctx;

    ctx.fillStyle = config.textColor;
    ctx.font = '16px -apple-system, "PingFang SC"';
    ctx.fillText('画笔大小:', 25, startY);

    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;
    const progressWidth = (gameState.brushSize / 20) * sliderWidth;

    // 滑动条轨道
    ctx.fillStyle = '#E5E5EA';
    this.drawRoundedRect(sliderX, startY - 6, sliderWidth, 4, 2, true, false);

    // 进度填充
    const gradient = ctx.createLinearGradient(sliderX, 0, sliderX + progressWidth, 0);
    gradient.addColorStop(0, config.primaryColor);
    gradient.addColorStop(1, config.secondaryColor);
    ctx.fillStyle = gradient;
    this.drawRoundedRect(sliderX, startY - 6, progressWidth, 4, 2, true, false);

    // 滑动块
    const sliderPos = sliderX + progressWidth;
    ctx.shadowColor = 'rgba(0,122,255,0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = config.primaryColor;
    ctx.beginPath();
    ctx.arc(sliderPos, startY - 6, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sliderPos, startY - 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // 大小显示
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system';
    ctx.textAlign = 'right';
    ctx.fillText(`${gameState.brushSize}px`, config.screenWidth - 25, startY);
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
      const x = 20 + i * toolWidth;
      const isActive = (i === 0 && gameState.isEraser);

      this.drawModernButton(x, startY, toolWidth - 10, config.buttonHeight,
                          `${toolButtons[i].icon} ${toolButtons[i].name}`,
                          isActive, false);
    }
  }

  // 绘制指示区
  drawIndicatorArea() {
    const positions = getAreaPositions();
    const startY = positions.indicatorAreaY;

    this.drawCard(15, startY, config.screenWidth - 30, config.indicatorHeight - 10);

    const ctx = this.ctx;
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC"';
    ctx.textAlign = 'center';

    ctx.fillStyle = config.primaryColor;
    ctx.font = '24px Arial';
    ctx.fillText('🎨', config.screenWidth / 2, startY + 28);

    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system';
    ctx.fillText('画一条鱼吧!', config.screenWidth / 2, startY + 55);

    ctx.fillStyle = config.lightTextColor;
    ctx.font = '15px -apple-system';
    ctx.fillText('鱼头请朝右', config.screenWidth / 2, startY + 78);

    ctx.textAlign = 'left';
  }

  // 绘制绘画区
  drawDrawingArea(gameState) {
    const positions = getAreaPositions();
    const startY = positions.drawingAreaY;

    // 绘画区域卡片
    this.ctx.shadowColor = 'rgba(0,0,0,0.08)';
    this.ctx.shadowBlur = 12;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 4;

    this.ctx.fillStyle = '#FFFFFF';
    this.drawRoundedRect(12, startY, config.screenWidth - 24, config.drawingAreaHeight, config.borderRadius, true, false);

    this.ctx.shadowColor = 'transparent';
    this.ctx.strokeStyle = config.borderColor;
    this.ctx.lineWidth = 1;
    this.drawRoundedRect(12, startY, config.screenWidth - 24, config.drawingAreaHeight, config.borderRadius, false, true);

    // 网格背景
    this.ctx.strokeStyle = '#F8F9FA';
    this.ctx.lineWidth = 0.8;

    for (let i = 1; i < 4; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(12, startY + i * (config.drawingAreaHeight / 4));
      this.ctx.lineTo(config.screenWidth - 12, startY + i * (config.drawingAreaHeight / 4));
      this.ctx.stroke();
    }

    for (let i = 1; i < 4; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(12 + i * ((config.screenWidth - 24) / 4), startY);
      this.ctx.lineTo(12 + i * ((config.screenWidth - 24) / 4), startY + config.drawingAreaHeight);
      this.ctx.stroke();
    }

    // 绘制路径
    this.redrawAllPaths(gameState, startY);
  }

  // 重新绘制所有路径
  redrawAllPaths(gameState, drawingAreaY) {
    const ctx = this.ctx;

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
  }

  // 绘制得分区
  drawScoreArea(gameState) {
    const positions = getAreaPositions();
    const startY = positions.scoreAreaY;

    this.drawCard(15, startY, config.screenWidth - 30, config.scoreHeight - 10);

    const ctx = this.ctx;
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
    ctx.font = '20px Arial';
    ctx.fillText('⭐', config.screenWidth / 2 - 50, startY + 22);

    ctx.fillStyle = scoreColor;
    ctx.font = gameState.isScoring ? '16px -apple-system' : 'bold 18px -apple-system';
    ctx.fillText(scoreText, config.screenWidth / 2, startY + 35);

    ctx.textAlign = 'left';
  }

  // 绘制跳转区
  drawJumpArea() {
    const positions = getAreaPositions();
    const startY = positions.jumpAreaY;

    this.drawCard(15, startY, config.screenWidth - 30, config.jumpHeight - 10);

    const jumpButtons = ['🐠 鱼缸', '🚀 让它游起来！', '🏆 排行榜'];
    const buttonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < jumpButtons.length; i++) {
      const x = 20 + i * buttonWidth;
      const isPrimary = i === 1;

      this.drawModernButton(x, startY + 13, buttonWidth - 10, config.buttonHeight,
                          jumpButtons[i], false, isPrimary);
    }
  }

// 绘制游泳界面
drawSwimInterface(gameState, swimInterfaceData) {
  const ctx = this.ctx;

  // 修改：将水蓝色背景改为白色背景
  ctx.fillStyle = '#FFFFFF'; // 改为白色
  ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

  // 绘制返回按钮（左上角）
  // 修改：将返回按钮颜色改为蓝色（isPrimary参数改为true）
  this.drawModernButton(
    20, // 左上角x坐标
    40, // 左上角y坐标
    50, // 宽度
    30, // 高度
    '返回',
    false,
    true // 改为true，使按钮显示为蓝色
  );
}
  // 绘制完整UI
  drawGameUI(gameState) {
    // 新增：检查是否显示游泳界面
    if (this.eventHandler && this.eventHandler.isSwimInterfaceVisible) {
      this.drawSwimInterface(gameState, this.eventHandler.swimInterfaceData);
      return;
    }
    
    this.drawBackground();
    this.drawFunctionArea(gameState);
    this.drawIndicatorArea();
    this.drawDrawingArea(gameState);
    this.drawScoreArea(gameState);
    this.drawJumpArea();
  }
}

module.exports = UIManager;
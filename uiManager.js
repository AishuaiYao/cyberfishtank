const { config, getAreaPositions } = require('./config.js');

class UIManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.eventHandler = null;
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
    ctx.fillText('', config.screenWidth / 2 - 50, startY + 22);

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

  // 绘制游泳界面（现在统一为公共鱼缸）
  drawSwimInterface(gameState, swimInterfaceData) {
    const ctx = this.ctx;

    // 统一使用鱼缸模式
    this.drawFishTankInterface(swimInterfaceData);
  }

  // 绘制鱼缸界面
  drawFishTankInterface(swimInterfaceData) {
    const ctx = this.ctx;

    // 纯白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 先绘制返回按钮（必须在鱼绘制之前）
    this.drawModernButton(
      20, // 左上角x坐标
      40, // 左上角y坐标
      50, // 宽度
      30, // 高度
      '返回',
      false,
      true // 蓝色按钮
    );

    // 绘制标题 - 改为"公共鱼缸"
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 20px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText('赛博鱼缸', config.screenWidth / 2, 100);

    // 绘制鱼的数量
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '16px -apple-system';
    const fishCount = this.eventHandler.fishTank ? this.eventHandler.fishTank.fishes.length : 0;
    ctx.fillText(`共有 ${fishCount} 条鱼`, config.screenWidth / 2, 130);
    ctx.textAlign = 'left';

    // 绘制鱼缸内容
    if (this.eventHandler.fishTank) {
      this.eventHandler.fishTank.draw();
    } else {
      // 如果没有鱼缸，显示提示
      ctx.fillStyle = config.lightTextColor;
      ctx.font = '16px -apple-system';
      ctx.textAlign = 'center';
      ctx.fillText('鱼缸空空如也，快去画一条鱼吧！', config.screenWidth / 2, config.screenHeight / 2);
      ctx.textAlign = 'left';
    }
  }

  // 修改：绘制排行榜界面 - 支持滚动
  drawRankingInterface() {
    const ctx = this.ctx;

    // 纯白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制返回按钮
    this.drawModernButton(
      20, // 左上角x坐标
      40, // 左上角y坐标
      50, // 宽度
      30, // 高度
      '返回',
      false,
      true // 蓝色按钮
    );

    // 绘制刷新按钮
    this.drawModernButton(
      config.screenWidth - 70, // 右上角x坐标
      40, // y坐标
      50, // 宽度
      30, // 高度
      '刷新',
      false,
      false // 白色按钮
    );

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 20px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', config.screenWidth / 2, 100);

    // 绘制副标题
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '16px -apple-system';
    ctx.fillText(`Top ${config.rankingLimit} - 按评分从高到低排列`, config.screenWidth / 2, 130);
    ctx.textAlign = 'left';

    // 检查是否正在加载
    if (this.eventHandler.isLoadingRanking) {
      ctx.fillStyle = config.lightTextColor;
      ctx.font = '16px -apple-system';
      ctx.textAlign = 'center';
      ctx.fillText('加载中...', config.screenWidth / 2, config.screenHeight / 2);
      ctx.textAlign = 'left';
      return;
    }

    // 检查是否有排行榜数据
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      ctx.fillStyle = config.lightTextColor;
      ctx.font = '16px -apple-system';
      ctx.textAlign = 'center';
      ctx.fillText('暂无排行榜数据', config.screenWidth / 2, config.screenHeight / 2);
      ctx.textAlign = 'left';
      return;
    }

    // 绘制滚动区域背景（可选）
    ctx.fillStyle = '#F8F9FA';
    ctx.fillRect(0, config.rankingCard.scrollView.top, config.screenWidth, config.rankingCard.scrollView.height);

    // 绘制排行榜卡片 - 支持滚动
    this.drawRankingCards();

    // 绘制滚动指示器（如果有内容需要滚动）
    this.drawScrollIndicator();
  }

  // 修改：绘制排行榜卡片 - 支持滚动
  drawRankingCards() {
    const ctx = this.ctx;
    const rankingFishes = this.eventHandler.rankingData.fishes;
    const scrollTop = this.eventHandler.rankingScrollTop;

    const cardWidth = (config.screenWidth - 60) / 2; // 两列布局
    const cardHeight = 200; // 增加高度以容纳更多内容
    const startY = config.rankingCard.scrollView.top - scrollTop; // 考虑滚动偏移

    for (let i = 0; i < rankingFishes.length; i++) {
      const { fishData, fishImage } = rankingFishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 检查卡片是否在可见区域内（性能优化）
      const isCardVisible = cardY + cardHeight >= 0 && cardY <= config.screenHeight;

      if (isCardVisible) {
        // 绘制卡片背景 - 与鱼详情相同的卡片样式
        this.drawRankingCard(cardX, cardY, cardWidth, cardHeight, fishData, fishImage, i + 1);
      }
    }
  }

  // 修改：绘制滚动指示器
  drawScrollIndicator() {
    const ctx = this.ctx;
    const scrollTop = this.eventHandler.rankingScrollTop;
    const totalItems = this.eventHandler.rankingData.fishes.length;

    // 计算总内容高度
    const cardHeight = 200;
    const cardMargin = 15;
    const rows = Math.ceil(totalItems / 2);
    const totalContentHeight = rows * (cardHeight + cardMargin);

    // 如果内容高度小于滚动区域高度，不需要滚动指示器
    if (totalContentHeight <= config.rankingCard.scrollView.height) {
      return;
    }

    // 计算滚动指示器参数
    const indicatorWidth = 6;
    const indicatorRightMargin = 10;
    const indicatorTop = config.rankingCard.scrollView.top + 10;
    const indicatorHeight = config.rankingCard.scrollView.height - 20;

    // 计算滚动比例
    const maxScroll = Math.max(0, totalContentHeight - config.rankingCard.scrollView.height);
    const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;

    // 计算滑块位置和高度
    const visibleRatio = config.rankingCard.scrollView.height / totalContentHeight;
    const sliderHeight = Math.max(30, indicatorHeight * visibleRatio);
    const sliderY = indicatorTop + (indicatorHeight - sliderHeight) * scrollRatio;

    // 绘制滚动条轨道
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(
      config.screenWidth - indicatorRightMargin - indicatorWidth,
      indicatorTop,
      indicatorWidth,
      indicatorHeight
    );

    // 绘制滚动条滑块
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(
      config.screenWidth - indicatorRightMargin - indicatorWidth,
      sliderY,
      indicatorWidth,
      sliderHeight
    );
  }

  // 修改：绘制单个排行榜卡片 - 复制鱼详情对话框的样式
  drawRankingCard(x, y, width, height, fishData, fishImage, rank) {
    const ctx = this.ctx;

    // 绘制卡片背景 - 与鱼详情相同的阴影效果
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    this.drawCard(x, y, width, height);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制排名徽章
    this.drawRankBadge(x + 10, y + 10, rank);

    // 绘制鱼图片 - 与鱼详情相同的缩放逻辑
    const maxImageWidth = width - 20; // 左右各10像素边距
    const maxImageHeight = 80; // 限制图片高度

    let imageWidth = fishImage.width;
    let imageHeight = fishImage.height;

    if (imageWidth > maxImageWidth) {
      const scale = maxImageWidth / imageWidth;
      imageWidth = maxImageWidth;
      imageHeight = imageHeight * scale;
    }

    if (imageHeight > maxImageHeight) {
      const scale = maxImageHeight / imageHeight;
      imageHeight = maxImageHeight;
      imageWidth = imageWidth * scale;
    }

    const imageX = x + (width - imageWidth) / 2;
    const imageY = y + 40;

    ctx.drawImage(fishImage.canvas, imageX, imageY, imageWidth, imageHeight);

    // 计算文本起始位置
    const textStartY = imageY + imageHeight + 15;

    // 绘制鱼名字 - 与鱼详情相同的样式
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 16px -apple-system';
    ctx.textAlign = 'center';
    let fishName = fishData.fishName || '未命名';
    // 截断过长的名字
    if (fishName.length > 8) {
      fishName = fishName.substring(0, 8) + '...';
    }
    ctx.fillText(fishName, x + width / 2, textStartY);

    // 绘制创作时间 - 与鱼详情相同的样式
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '12px -apple-system';
    let createTime = '未知时间';
    if (fishData.createdAt) {
      const date = new Date(fishData.createdAt);
      createTime = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    ctx.fillText(createTime, x + width / 2, textStartY + 20);

    // 绘制评分 - 与鱼详情相同的样式
    ctx.fillStyle = this.getScoreColor(fishData.score || 0);
    ctx.font = 'bold 14px -apple-system';
    const score = fishData.score || 0;
    ctx.fillText(`评分: ${score}`, x + width / 2, textStartY + 40);

    // 绘制点赞和点踩信息 - 与鱼详情相同的样式但更紧凑
    const infoStartY = textStartY + 60;

    // 点赞信息
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '12px -apple-system';
    ctx.textAlign = 'left';
    ctx.fillText(`👍 ${fishData.star || 0}`, x + 15, infoStartY);

    // 点踩信息
    ctx.textAlign = 'right';
    ctx.fillText(`👎 ${fishData.unstar || 0}`, x + width - 15, infoStartY);

    ctx.textAlign = 'left';
  }

  // 新增：绘制排名徽章
  drawRankBadge(x, y, rank) {
    const ctx = this.ctx;

    // 前3名使用特殊颜色
    let badgeColor;
    if (rank === 1) {
      badgeColor = '#FFD700'; // 金色
    } else if (rank === 2) {
      badgeColor = '#C0C0C0'; // 银色
    } else if (rank === 3) {
      badgeColor = '#CD7F32'; // 铜色
    } else {
      badgeColor = config.primaryColor; // 蓝色
    }

    // 绘制徽章背景
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(x + 15, y + 15, 15, 0, Math.PI * 2);
    ctx.fill();

    // 绘制排名数字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px -apple-system';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank.toString(), x + 15, y + 15);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 新增：根据评分获取颜色 - 与鱼详情保持一致
  getScoreColor(score) {
    if (score >= 80) return '#4CD964'; // 绿色
    if (score >= 60) return '#FFCC00'; // 黄色
    if (score >= 40) return '#FF9500'; // 橙色
    return '#FF3B30'; // 红色
  }

  // 修改：绘制鱼详情界面 - 优化显示效果
  drawFishDetailInterface() {
    const ctx = this.ctx;
    const fishData = this.eventHandler.selectedFishData.fishData;

    // 修改：先绘制鱼缸背景，再添加半透明遮罩
    this.drawFishTankInterface(this.eventHandler.swimInterfaceData);

    // 修改：使用更浅的半透明遮罩，让鱼缸背景可见
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    const detailWidth = config.screenWidth - 60; // 稍微加宽对话框
    const detailHeight = 380; // 调整高度
    const detailX = 30;
    const detailY = (config.screenHeight - detailHeight) / 2;

    // 绘制详情卡片 - 添加阴影效果
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    this.drawCard(detailX, detailY, detailWidth, detailHeight);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制关闭按钮（右上角X）
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('×', detailX + detailWidth - 25, detailY + 30);

    // 修改：绘制鱼图片 - 等比例缩放到距离边界5像素
    const fishImage = this.eventHandler.selectedFishData.fish.image;
    const maxImageWidth = detailWidth - 10; // 左右各5像素 = 10像素
    const maxImageHeight = 180; // 限制最大高度

    // 计算等比例缩放尺寸
    let imageWidth = fishImage.width;
    let imageHeight = fishImage.height;

    if (imageWidth > maxImageWidth) {
      const scale = maxImageWidth / imageWidth;
      imageWidth = maxImageWidth;
      imageHeight = imageHeight * scale;
    }

    if (imageHeight > maxImageHeight) {
      const scale = maxImageHeight / imageHeight;
      imageHeight = maxImageHeight;
      imageWidth = imageWidth * scale;
    }

    const imageX = detailX + (detailWidth - imageWidth) / 2;
    const imageY = detailY + 50;

    ctx.drawImage(fishImage, imageX, imageY, imageWidth, imageHeight);

    // 修改：调整文本位置，使其更紧凑
    const textStartY = imageY + imageHeight + 20;

    // 绘制鱼名字
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText(fishData.fishName || '未命名', detailX + detailWidth / 2, textStartY);

    // 绘制创作时间
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '14px -apple-system';
    let createTime = '未知时间';
    if (fishData.createdAt) {
      const date = new Date(fishData.createdAt);
      createTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    ctx.fillText(`创作时间: ${createTime}`, detailX + detailWidth / 2, textStartY + 25);

    // 修改：绘制评分 - 调整位置使其更紧凑
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system';
    const score = fishData.score || 0;
    ctx.fillText(`评分: ${score}`, detailX + detailWidth / 2, textStartY + 50);

    // 修改：绘制点赞和点踩按钮 - 调整位置使其紧挨着评分
    const buttonWidth = (detailWidth - 60) / 2;
    const buttonY = textStartY + 75; // 紧挨着评分下方

    // 点赞按钮
    this.drawModernButton(
      detailX + 20,
      buttonY,
      buttonWidth,
      36, // 稍微减小按钮高度
      `👍 ${fishData.star || 0}`,
      false,
      false
    );

    // 点踩按钮
    this.drawModernButton(
      detailX + buttonWidth + 40,
      buttonY,
      buttonWidth,
      36, // 稍微减小按钮高度
      `👎 ${fishData.unstar || 0}`,
      false,
      false
    );

    ctx.textAlign = 'left';
  }

  // 绘制命名对话框
  drawNameInputDialog(eventHandler) {
    const ctx = this.ctx;

    // 关键修复：先清除整个画布并绘制背景
    this.drawBackground();

    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制对话框卡片
    this.drawCard(dialogX, dialogY, dialogWidth, dialogHeight);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText('给你的鱼起个名字', dialogX + dialogWidth / 2, dialogY + 40);

    // 绘制输入框背景
    ctx.fillStyle = '#F8F9FA';
    this.drawRoundedRect(dialogX + 20, dialogY + 70, dialogWidth - 40, 40, 8, true, false);
    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    this.drawRoundedRect(dialogX + 20, dialogY + 70, dialogWidth - 40, 40, 8, false, true);

    // 绘制输入文本
    ctx.fillStyle = config.textColor;
    ctx.font = '16px -apple-system';
    ctx.textAlign = 'left';
    const text = eventHandler.fishNameInput || '';

    // 文本过长时截断显示
    let displayText = text;
    const maxTextWidth = dialogWidth - 60;
    const textWidth = ctx.measureText(text).width;
    if (textWidth > maxTextWidth) {
      // 计算可以显示的字符数
      let visibleChars = text.length;
      while (visibleChars > 0 && ctx.measureText(text.substring(0, visibleChars) + '...').width > maxTextWidth) {
        visibleChars--;
      }
      displayText = text.substring(0, visibleChars) + '...';
    }

    ctx.fillText(displayText, dialogX + 30, dialogY + 95);

    // 绘制光标（如果文本为空）
    if (!text) {
      ctx.fillStyle = config.primaryColor;
      ctx.fillRect(dialogX + 30, dialogY + 80, 2, 20);
    }

    // 绘制取消按钮
    this.drawModernButton(
      dialogX + 20,
      dialogY + dialogHeight - 110,
      dialogWidth - 40,
      40,
      '取消',
      false,
      false
    );

    // 绘制确认按钮
    this.drawModernButton(
      dialogX + 20,
      dialogY + dialogHeight - 60,
      dialogWidth - 40,
      40,
      '确认',
      false,
      true
    );

    ctx.textAlign = 'left';
  }

  // 绘制完整UI
  drawGameUI(gameState) {
    // 新增：检查是否显示排行榜界面
    if (this.eventHandler && this.eventHandler.isRankingInterfaceVisible) {
      this.drawRankingInterface();
      return;
    }

    // 新增：检查是否显示鱼详情界面
    if (this.eventHandler && this.eventHandler.isFishDetailVisible) {
      this.drawFishDetailInterface();
      return;
    }

    // 新增：检查是否显示命名对话框
    if (this.eventHandler && this.eventHandler.isDialogVisible) {
      this.drawNameInputDialog(this.eventHandler);
      return;
    }

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
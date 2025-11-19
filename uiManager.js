// uiManager.js - 优化后的UI管理器
const { config, getAreaPositions } = require('./config.js');
const InterfaceRenderer = require('./interfaceRenderer.js');
const Utils = require('./utils.js');

class UIManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.eventHandler = null;
    this.interfaceRenderer = new InterfaceRenderer(ctx);
  }

  // 设置事件处理器引用
  setEventHandler(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 绘制鱼缸界面
  drawFishTankInterface() {
    const ctx = this.ctx;

    // 纯白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制返回按钮
    Utils.drawModernButton(ctx, 20, 40, 50, 30, '返回', false, true);

    // 绘制标题
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
      ctx.fillStyle = config.lightTextColor;
      ctx.font = '16px -apple-system';
      ctx.textAlign = 'center';
      ctx.fillText('鱼缸空空如也，快去画一条鱼吧！', config.screenWidth / 2, config.screenHeight / 2);
      ctx.textAlign = 'left';
    }
  }

  // 绘制排行榜界面
  drawRankingInterface() {
    const ctx = this.ctx;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制返回按钮
    Utils.drawModernButton(ctx, 20, 40, 50, 30, '返回', false, true);

    // 绘制刷新按钮
    Utils.drawModernButton(ctx, config.screenWidth - 70, 40, 50, 30, '刷新', false, false);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 20px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', config.screenWidth / 2, 100);

    // 绘制副标题
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '16px -apple-system';
    ctx.fillText('按评分从高到低排列', config.screenWidth / 2, 130);
    ctx.textAlign = 'left';

    // 检查加载状态
    if (this.eventHandler.isLoadingRanking) {
      this.drawLoadingMessage('加载中...');
      return;
    }

    // 检查数据
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      this.drawLoadingMessage('暂无排行榜数据');
      return;
    }

    // 绘制排行榜卡片
    this.drawRankingCards();
  }

  // 绘制加载消息
  drawLoadingMessage(message) {
    const ctx = this.ctx;
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '16px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText(message, config.screenWidth / 2, config.screenHeight / 2);
    ctx.textAlign = 'left';
  }

  // 绘制排行榜卡片
  drawRankingCards() {
    const ctx = this.ctx;
    const rankingFishes = this.eventHandler.rankingData.fishes;

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 200;
    const startY = 150;

    for (let i = 0; i < rankingFishes.length; i++) {
      const { fishData, fishImage } = rankingFishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      this.drawRankingCard(cardX, cardY, cardWidth, cardHeight, fishData, fishImage, i + 1);
    }
  }

  // 绘制单个排行榜卡片
  drawRankingCard(x, y, width, height, fishData, fishImage, rank) {
    const ctx = this.ctx;

    // 绘制卡片背景
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    Utils.drawCard(ctx, x, y, width, height);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制排名徽章
    this.drawRankBadge(x + 10, y + 10, rank);

    // 绘制鱼图片
    const maxImageWidth = width - 20;
    const maxImageHeight = 80;

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

    // 绘制文本信息
    const textStartY = imageY + imageHeight + 15;

    // 鱼名字
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 16px -apple-system';
    ctx.textAlign = 'center';
    let fishName = Utils.truncateText(fishData.fishName || '未命名', 8);
    ctx.fillText(fishName, x + width / 2, textStartY);

    // 创作时间
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '12px -apple-system';
    const createTime = Utils.formatTime(fishData.createdAt);
    ctx.fillText(createTime, x + width / 2, textStartY + 20);

    // 评分
    ctx.fillStyle = Utils.getScoreColor(fishData.score || 0);
    ctx.font = 'bold 14px -apple-system';
    const score = fishData.score || 0;
    ctx.fillText(`评分: ${score}`, x + width / 2, textStartY + 40);

    // 点赞和点踩信息
    const infoStartY = textStartY + 60;

    ctx.fillStyle = config.lightTextColor;
    ctx.font = '12px -apple-system';
    ctx.textAlign = 'left';
    ctx.fillText(`👍 ${fishData.star || 0}`, x + 15, infoStartY);

    ctx.textAlign = 'right';
    ctx.fillText(`👎 ${fishData.unstar || 0}`, x + width - 15, infoStartY);

    ctx.textAlign = 'left';
  }

  // 绘制排名徽章
  drawRankBadge(x, y, rank) {
    const ctx = this.ctx;

    // 前3名使用特殊颜色
    let badgeColor;
    if (rank === 1) {
      badgeColor = '#FFD700';
    } else if (rank === 2) {
      badgeColor = '#C0C0C0';
    } else if (rank === 3) {
      badgeColor = '#CD7F32';
    } else {
      badgeColor = config.primaryColor;
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

  // 绘制鱼详情界面
  drawFishDetailInterface() {
    const ctx = this.ctx;
    const fishData = this.eventHandler.selectedFishData.fishData;

    // 先绘制鱼缸背景，再添加半透明遮罩
    this.drawFishTankInterface();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    const detailWidth = config.screenWidth - 60;
    const detailHeight = 380;
    const detailX = 30;
    const detailY = (config.screenHeight - detailHeight) / 2;

    // 绘制详情卡片
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    Utils.drawCard(ctx, detailX, detailY, detailWidth, detailHeight);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制关闭按钮
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('×', detailX + detailWidth - 25, detailY + 30);

    // 绘制鱼图片
    const fishImage = this.eventHandler.selectedFishData.fish.image;
    const maxImageWidth = detailWidth - 10;
    const maxImageHeight = 180;

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

    // 绘制文本信息
    const textStartY = imageY + imageHeight + 20;

    // 鱼名字
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText(fishData.fishName || '未命名', detailX + detailWidth / 2, textStartY);

    // 创作时间
    ctx.fillStyle = config.lightTextColor;
    ctx.font = '14px -apple-system';
    let createTime = '未知时间';
    if (fishData.createdAt) {
      const date = new Date(fishData.createdAt);
      createTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    ctx.fillText(`创作时间: ${createTime}`, detailX + detailWidth / 2, textStartY + 25);

    // 评分
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system';
    const score = fishData.score || 0;
    ctx.fillText(`评分: ${score}`, detailX + detailWidth / 2, textStartY + 50);

    // 绘制点赞和点踩按钮
    const buttonWidth = (detailWidth - 60) / 2;
    const buttonY = textStartY + 75;

    // 点赞按钮
    Utils.drawModernButton(
      ctx,
      detailX + 20,
      buttonY,
      buttonWidth,
      36,
      `👍 ${fishData.star || 0}`,
      false,
      false
    );

    // 点踩按钮
    Utils.drawModernButton(
      ctx,
      detailX + buttonWidth + 40,
      buttonY,
      buttonWidth,
      36,
      `👎 ${fishData.unstar || 0}`,
      false,
      false
    );

    ctx.textAlign = 'left';
  }

  // 绘制命名对话框
  drawNameInputDialog() {
    const ctx = this.ctx;
    const eventHandler = this.eventHandler;

    // 清除画布并绘制背景
    this.interfaceRenderer.drawBackground();

    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制对话框卡片
    Utils.drawCard(ctx, dialogX, dialogY, dialogWidth, dialogHeight);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system';
    ctx.textAlign = 'center';
    ctx.fillText('给你的鱼起个名字', dialogX + dialogWidth / 2, dialogY + 40);

    // 绘制输入框背景
    ctx.fillStyle = '#F8F9FA';
    Utils.drawRoundedRect(ctx, dialogX + 20, dialogY + 70, dialogWidth - 40, 40, 8, true, false);
    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, dialogX + 20, dialogY + 70, dialogWidth - 40, 40, 8, false, true);

    // 绘制输入文本
    ctx.fillStyle = config.textColor;
    ctx.font = '16px -apple-system';
    ctx.textAlign = 'left';
    const text = eventHandler.fishNameInput || '';

    // 文本过长时截断显示
    let displayText = Utils.truncateText(text, 20);
    ctx.fillText(displayText, dialogX + 30, dialogY + 95);

    // 绘制光标（如果文本为空）
    if (!text) {
      ctx.fillStyle = config.primaryColor;
      ctx.fillRect(dialogX + 30, dialogY + 80, 2, 20);
    }

    // 绘制取消按钮
    Utils.drawModernButton(
      ctx,
      dialogX + 20,
      dialogY + dialogHeight - 110,
      dialogWidth - 40,
      40,
      '取消',
      false,
      false
    );

    // 绘制确认按钮
    Utils.drawModernButton(
      ctx,
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
    const positions = getAreaPositions();

    // 检查特殊界面状态
    if (this.eventHandler) {
      if (this.eventHandler.isRankingInterfaceVisible) {
        this.drawRankingInterface();
        return;
      }

      if (this.eventHandler.isFishDetailVisible) {
        this.drawFishDetailInterface();
        return;
      }

      if (this.eventHandler.isDialogVisible) {
        this.drawNameInputDialog();
        return;
      }

      if (this.eventHandler.isSwimInterfaceVisible) {
        this.drawFishTankInterface();
        return;
      }
    }

    // 绘制主游戏界面
    this.interfaceRenderer.drawBackground();
    this.interfaceRenderer.drawFunctionArea(gameState, positions);
    this.interfaceRenderer.drawIndicatorArea(positions);
    this.interfaceRenderer.drawDrawingArea(gameState, positions);
    this.interfaceRenderer.drawScoreArea(gameState, positions);
    this.interfaceRenderer.drawJumpArea(positions);
  }
}

module.exports = UIManager;
// uiManager.js - 优化后的UI管理器
const { config, getAreaPositions } = require('./config.js');
const InterfaceRenderer = require('./interfaceRenderer.js');
const Utils = require('./utils.js');

class UIManager {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    this.eventHandler = null;
    this.interfaceRenderer = new InterfaceRenderer(ctx, pixelRatio);
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

    console.log('UI管理器渲染优化完成，像素比:', this.pixelRatio);
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
    ctx.font = 'bold 20px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('赛博鱼缸', Math.round(config.screenWidth / 2), 100);

    // 绘制鱼的数量
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    const fishCount = this.eventHandler.fishTank ? this.eventHandler.fishTank.fishes.length : 0;
    ctx.fillText(`共有 ${fishCount} 条鱼`, Math.round(config.screenWidth / 2), 130);
    ctx.textAlign = 'left';

    // 绘制鱼缸内容
    if (this.eventHandler.fishTank) {
      this.eventHandler.fishTank.draw();
    } else {
      ctx.fillStyle = config.lightTextColor;
      ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('鱼缸空空如也，快去画一条鱼吧！', Math.round(config.screenWidth / 2), Math.round(config.screenHeight / 2));
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

    // 绘制标题 - 上移50像素
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 20px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', Math.round(config.screenWidth / 2), 50);

    // 绘制副标题 - 上移50像素
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('按评分从高到低排列', Math.round(config.screenWidth / 2), 80);

    // 如果有滚动，显示滚动提示 - 上移50像素
    const scrollOffset = this.eventHandler.touchHandlers.ranking.getScrollOffset();
    const maxScrollY = this.eventHandler.touchHandlers.ranking.getMaxScrollY();

    if (maxScrollY > 0) {
      ctx.fillStyle = config.primaryColor;
      ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      if (scrollOffset === 0) {
        ctx.fillText('↓ 向下滑动查看更多 ↓', Math.round(config.screenWidth / 2), 100);
      } else if (scrollOffset >= maxScrollY) {
        ctx.fillText('↑ 向上滑动返回顶部 ↑', Math.round(config.screenWidth / 2), 100);
      } else {
        ctx.fillText('↑ 可上下滑动查看 ↑', Math.round(config.screenWidth / 2), 100);
      }
    }

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

    // 绘制排行榜卡片（带滚动效果）
    this.drawRankingCards();
  }

  // 绘制加载消息
  drawLoadingMessage(message) {
    const ctx = this.ctx;
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, Math.round(config.screenWidth / 2), Math.round(config.screenHeight / 2));
    ctx.textAlign = 'left';
  }

  // 绘制排行榜卡片（更新版）
  drawRankingCards() {
    const ctx = this.ctx;
    const rankingFishes = this.eventHandler.rankingData.fishes;
    const scrollOffset = this.eventHandler.touchHandlers.ranking.getScrollOffset();

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 200;
    const startY = 100 - scrollOffset;

    // 设置裁剪区域，防止卡片绘制到界面外
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 100, config.screenWidth, config.screenHeight - 100);
    ctx.clip();

    for (let i = 0; i < rankingFishes.length; i++) {
      const { fishData, fishImage } = rankingFishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 只绘制在可见区域内的卡片
      if (cardY + cardHeight > 100 && cardY < config.screenHeight) {
        this.drawRankingCard(cardX, cardY, cardWidth, cardHeight, fishData, fishImage, i + 1);
      }
    }

    ctx.restore();

    // 绘制滚动条指示器（如果有滚动）
    if (scrollOffset > 0) {
      this.drawScrollIndicator(scrollOffset);
    }
  }

  // 绘制滚动条指示器
  drawScrollIndicator(scrollOffset) {
    const ctx = this.ctx;
    const maxScrollY = this.eventHandler.touchHandlers.ranking.getMaxScrollY();

    if (maxScrollY <= 0) return;

    const indicatorWidth = 4;
    const indicatorRight = config.screenWidth - 10;
    const indicatorTop = 100;
    const indicatorHeight = config.screenHeight - 100 - 20;

    // 计算滑块位置和大小
    const scrollRatio = scrollOffset / maxScrollY;
    const sliderHeight = Math.max(30, indicatorHeight * 0.2);
    const sliderY = indicatorTop + (indicatorHeight - sliderHeight) * scrollRatio;

    // 绘制轨道
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    Utils.drawRoundedRect(ctx, indicatorRight - indicatorWidth, indicatorTop, indicatorWidth, indicatorHeight, 2, true, false);

    // 绘制滑块
    ctx.fillStyle = 'rgba(0, 122, 255, 0.7)';
    Utils.drawRoundedRect(ctx, indicatorRight - indicatorWidth, sliderY, indicatorWidth, sliderHeight, 2, true, false);
  }

  // 绘制单个排行榜卡片
  drawRankingCard(x, y, width, height, fishData, fishImage, rank) {
    const ctx = this.ctx;

    // 确保坐标为整数
    x = Math.round(x);
    y = Math.round(y);
    width = Math.round(width);
    height = Math.round(height);

    // 绘制卡片背景 - 使用更清晰的阴影
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    Utils.drawCard(ctx, x, y, width, height);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制排名徽章
    this.drawRankBadge(x + 10, y + 10, rank);

    // 绘制鱼图片 - 确保高质量渲染
    ctx.imageSmoothingEnabled = false; // 关闭图像平滑以获得更锐利的图像

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

    const imageX = Math.round(x + (width - imageWidth) / 2);
    const imageY = Math.round(y + 40);

    ctx.drawImage(fishImage.canvas, imageX, imageY, imageWidth, imageHeight);

    // 绘制文本信息
    const textStartY = Math.round(imageY + imageHeight + 15);

    // 鱼名字 - 使用更清晰的字体
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    let fishName = Utils.truncateText(fishData.fishName || '未命名', 8);
    ctx.fillText(fishName, Math.round(x + width / 2), textStartY);

    // 创作时间
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    const createTime = Utils.formatTime(fishData.createdAt);
    ctx.fillText(createTime, Math.round(x + width / 2), textStartY + 20);

    // 评分
    ctx.fillStyle = Utils.getScoreColor(fishData.score || 0);
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    const score = fishData.score || 0;
    ctx.fillText(`评分: ${score}`, Math.round(x + width / 2), textStartY + 40);

    // 点赞和点踩信息
    const infoStartY = textStartY + 60;

    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`👍 ${fishData.star || 0}`, Math.round(x + 15), infoStartY);

    ctx.textAlign = 'right';
    ctx.fillText(`👎 ${fishData.unstar || 0}`, Math.round(x + width - 15), infoStartY);

    ctx.textAlign = 'left';
  }

  // 绘制排名徽章
  drawRankBadge(x, y, rank) {
    const ctx = this.ctx;

    // 确保坐标为整数
    x = Math.round(x);
    y = Math.round(y);

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
    ctx.arc(x + 15, y + 15, 14, 0, Math.PI * 2);
    ctx.fill();

    // 绘制排名数字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    const detailWidth = config.screenWidth - 60;
    const detailHeight = 380;
    const detailX = 30;
    const detailY = (config.screenHeight - detailHeight) / 2;

    // 绘制详情卡片
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    Utils.drawCard(ctx, detailX, detailY, detailWidth, detailHeight);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制关闭按钮
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 24px Arial, sans-serif';
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

    const imageX = Math.round(detailX + (detailWidth - imageWidth) / 2);
    const imageY = Math.round(detailY + 50);

    ctx.drawImage(fishImage, imageX, imageY, imageWidth, imageHeight);

    // 绘制文本信息
    const textStartY = Math.round(imageY + imageHeight + 20);

    // 鱼名字
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fishData.fishName || '未命名', detailX + detailWidth / 2, textStartY);

    // 创作时间
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    let createTime = '未知时间';
    if (fishData.createdAt) {
      const date = new Date(fishData.createdAt);
      createTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    ctx.fillText(`创作时间: ${createTime}`, detailX + detailWidth / 2, textStartY + 25);

    // 评分
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制对话框卡片
    Utils.drawCard(ctx, dialogX, dialogY, dialogWidth, dialogHeight);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
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
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
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
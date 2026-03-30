

const { config, getAreaPositions } = require('./config.js');
const InterfaceRenderer = require('./interfaceRenderer.js');
const TeamInterfaceRenderer = require('./teamInterfaceRenderer.js');
const ESP32InterfaceRenderer = require('./esp32InterfaceRenderer.js'); // 新增：ESP32界面渲染器
const Utils = require('./utils.js');

class UIManager {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
    this.eventHandler = null;
    this.interfaceRenderer = new InterfaceRenderer(ctx, pixelRatio);
    this.teamInterfaceRenderer = new TeamInterfaceRenderer(ctx, pixelRatio);
    this.esp32InterfaceRenderer = new ESP32InterfaceRenderer(ctx, pixelRatio); // 新增：ESP32界面渲染器

    // 新增：加载动画相关变量
    this.loadingSpinnerAngle = 0;

    // 初始化时优化渲染设置
    this.optimizeRendering();

    // 新增：渲染性能优化
    this.lastCardsRenderTime = 0;
    this.renderFrameInterval = 1000 / 60; // 目标60fps
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
  }

  // 设置事件处理器引用
  setEventHandler(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 修改：绘制鱼缸界面 - 使用类似iPhone闹钟时间选择器风格的鱼缸选择器
  drawFishTankInterface() {
    const ctx = this.ctx;

    // 背景颜色已经在FishTank.draw()中绘制为水蓝色
    // 这里只需要绘制UI元素

    // 绘制鱼缸内容（背景、气泡、鱼粮、鱼）
    if (this.eventHandler.fishTank) {
      this.eventHandler.fishTank.draw();
    } else {
      ctx.fillStyle = '#87CEEB'; // 水蓝色背景
      ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('鱼缸空空如也，快去画一条鱼吧！', Math.round(config.screenWidth / 2), Math.round(config.screenHeight / 2));
      ctx.textAlign = 'left';
    }

    // 对齐到排行榜界面的按钮高度和间距
    const buttonHeight = 30;
    const buttonY = 50; // 与排行榜界面按钮对齐
    const buttonSpacing = 5; // 与排行榜界面间距一致

    // 绘制返回按钮
    Utils.drawModernButton(ctx, 20, buttonY, 50, buttonHeight, '返回', false, true);

    // 绘制鱼缸选择器（类似iPhone闹钟时间选择器风格）
    this.drawTankSelector(buttonY);

    // 绘制刷新按钮（移到鱼缸选择器旁边，使用返回按钮风格）
    const selectorWidth = 100; // 鱼缸选择器宽度
    const refreshButtonX = 80 + selectorWidth + buttonSpacing; // 放在选择器右侧，使用相同间距
    Utils.drawModernButton(ctx, refreshButtonX, buttonY, 50, buttonHeight, '刷新', false, true);

    // 修改这里：根据鱼缸模式显示不同的提示文字
    ctx.fillStyle = '#374151'; // 深蓝色
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';

    const fishCount = this.eventHandler.getCurrentTankFishCount();

    if (this.eventHandler.currentTankMode === 'public') {
      if (fishCount === 0) {
        ctx.fillText('赛博鱼缸：随机加载20条鱼', Math.round(config.screenWidth / 2), config.screenHeight - 30);
      } else {
        ctx.fillText(`赛博鱼缸：随机加载20条鱼，双击屏幕投放鱼粮`, Math.round(config.screenWidth / 2), config.screenHeight - 30);
      }
    } else if (this.eventHandler.currentTankMode === 'best') {
      if (fishCount === 0) {
        ctx.fillText('最佳鱼缸：加载了top20', Math.round(config.screenWidth / 2), config.screenHeight - 30);
      } else {
        ctx.fillText(`最佳鱼缸：加载了top20，双击屏幕投放鱼粮`, Math.round(config.screenWidth / 2), config.screenHeight - 30);
      }
    } else if (this.eventHandler.currentTankMode === 'worst') {
      if (fishCount === 0) {
        ctx.fillText('最丑鱼缸：加载了top20', Math.round(config.screenWidth / 2), config.screenHeight - 30);
      } else {
        ctx.fillText(`最丑鱼缸：加载了top20，双击屏幕投放鱼粮`, Math.round(config.screenWidth / 2), config.screenHeight - 30);
      }
    } else if (this.eventHandler.currentTankMode === 'latest') {
      if (fishCount === 0) {
        ctx.fillText('最新鱼缸：加载了top20', Math.round(config.screenWidth / 2), config.screenHeight - 30);
      } else {
        ctx.fillText(`最新鱼缸：加载了top20，双击屏幕投放鱼粮`, Math.round(config.screenWidth / 2), config.screenHeight - 30);
      }
    } else if (this.eventHandler.currentTankMode === 'my') {
      if (fishCount === 0) {
        ctx.fillText('你还没有鱼，快去画一条吧！', Math.round(config.screenWidth / 2), config.screenHeight - 30);
      } else {
        ctx.fillText(`我的鱼缸：随机加载20条鱼，双击屏幕投放鱼粮`, Math.round(config.screenWidth / 2), config.screenHeight - 30);
      }
    } else {
      ctx.fillText('双击屏幕投放鱼粮', Math.round(config.screenWidth / 2), config.screenHeight - 30);
    }

    ctx.textAlign = 'left';
  }

  // 修改：绘制排行榜界面
  drawRankingInterface() {
    const ctx = this.ctx;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制四个按钮：返回、最佳榜、最丑榜、最新榜
    const buttonSpacing = 5; // 统一使用5像素间距
    const buttonHeight = 30;

    // 返回按钮（宽度50）
    Utils.drawModernButton(ctx, 20, 50, 50, buttonHeight, '返回', false, true);

    // 最佳榜按钮（宽度65）
    const bestButtonX = 20 + 50 + buttonSpacing;
    const isBestRankActive = this.eventHandler.rankingSortType === 'best';
    Utils.drawModernButton(ctx, bestButtonX, 50, 65, buttonHeight, '最佳榜', isBestRankActive, false);

    // 最丑榜按钮（宽度65）
    const worstButtonX = bestButtonX + 65 + buttonSpacing;
    const isWorstRankActive = this.eventHandler.rankingSortType === 'worst';
    Utils.drawModernButton(ctx, worstButtonX, 50, 65, buttonHeight, '最丑榜', isWorstRankActive, false);

    // 最新榜按钮（宽度65）
    const latestButtonX = worstButtonX + 65 + buttonSpacing;
    const isLatestRankActive = this.eventHandler.rankingSortType === 'latest';
    Utils.drawModernButton(ctx, latestButtonX, 50, 65, buttonHeight, '最新榜', isLatestRankActive, false);

    // 检查加载状态
    if (this.eventHandler.isLoadingRanking) {
      this.drawLoadingMessage('等会儿哈，马上！');
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

  // 绘制类似iPhone闹钟时间选择器风格的鱼缸选择器
  drawTankSelector(buttonY) {
    const buttonHeight = 30; // 直接在方法内部定义
    const ctx = this.ctx;

    // 初始化选择器状态（如果不存在）
    if (!this.eventHandler.tankSelectorState) {
      // 调整选项顺序：赛博鱼缸放在第三个位置
      const items = [
        { id: 'best', name: '最佳鱼缸' },
        { id: 'worst', name: '最丑鱼缸' },
        { id: 'public', name: '赛博鱼缸' },
        { id: 'latest', name: '最新鱼缸' },
        { id: 'my', name: '我的鱼缸' }
      ];

      // 设置默认选中赛博鱼缸（索引2）
      const defaultSelectedIndex = 2;

      this.eventHandler.tankSelectorState = {
        isOpen: false,
        selectedIndex: defaultSelectedIndex,
        startScrollY: null,
        items: items
      };
    }

    // 进一步减小选择器宽度和高度，使整体更紧凑
    const selectorWidth = 100; // 减小宽度
    const selectorHeight = 160; // 减小高度
    const selectorX = 80; // 紧跟在返回按钮后面
    const selectorY = buttonY;

    // 保存选择器边界到事件处理器，用于点击检测
    this.eventHandler.tankSelectorBounds = {
      x: selectorX,
      y: selectorY,
      width: selectorWidth,
      collapsedHeight: buttonHeight, // 收起状态的高度
      expandedHeight: selectorHeight // 展开状态的高度
    };

    // 如果选择器展开，绘制半透明遮罩
    if (this.eventHandler.tankSelectorState.isOpen) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // 减小遮罩透明度
      ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

      // 绘制选择器背景卡片 - 使用更现代的样式
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; // 减小阴影
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;

      // 使用更柔和的背景色渐变，去掉纯蓝色
      const bgGradient = ctx.createLinearGradient(selectorX, selectorY, selectorX, selectorY + selectorHeight);
      bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      bgGradient.addColorStop(1, 'rgba(248, 248, 250, 0.98)');

      ctx.fillStyle = bgGradient;
      Utils.drawRoundedRect(ctx, selectorX, selectorY, selectorWidth, selectorHeight, 8, true, false); // 减小圆角

      // 添加内部边框
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)'; // 更淡的边框
      ctx.lineWidth = 0.5;
      Utils.drawRoundedRect(ctx, selectorX, selectorY, selectorWidth, selectorHeight, 8, false, true);

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // 进一步减小选项高度，使布局更紧凑
      const itemHeight = 32; // 减小选项高度

      // 初始化滚动偏移量（如果不存在）
      if (this.eventHandler.tankSelectorState.scrollOffset === undefined) {
        this.eventHandler.tankSelectorState.scrollOffset = 0;
      }

      // 绘制选中项高亮（中间位置）- 使用更淡的背景色
      const highlightY = selectorY + selectorHeight / 2 - itemHeight / 2;
      ctx.fillStyle = 'rgba(0, 122, 255, 0.08)'; // 更淡的蓝色背景
      Utils.drawRoundedRect(ctx, selectorX + 4, highlightY, selectorWidth - 8, itemHeight, 4, true, false); // 减小边距和圆角

      // 添加选中项边框
      ctx.strokeStyle = 'rgba(0, 122, 255, 0.15)'; // 更淡的边框
      ctx.lineWidth = 0.5;
      Utils.drawRoundedRect(ctx, selectorX + 4, highlightY, selectorWidth - 8, itemHeight, 4, false, true);

      // 绘制选项文本
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 计算可见区域的高度
      const visibleAreaHeight = selectorHeight;
      const centerOffset = this.eventHandler.tankSelectorState.scrollOffset;

      // 绘制所有选项，但只显示可见部分
      for (let i = 0; i < this.eventHandler.tankSelectorState.items.length; i++) {
        const item = this.eventHandler.tankSelectorState.items[i];

        // 计算每个选项相对于中心的位置
        const offsetFromCenter = (i - this.eventHandler.tankSelectorState.selectedIndex) * itemHeight + centerOffset;
        const itemY = selectorY + selectorHeight / 2 - itemHeight / 2 + offsetFromCenter;

        // 只渲染可见范围内的选项，确保不超出边界
        if (itemY > selectorY - itemHeight/2 && itemY < selectorY + selectorHeight - itemHeight/2) {
          const isSelected = i === this.eventHandler.tankSelectorState.selectedIndex;

          // 根据与中心距离调整文字颜色和透明度，确保滑动时文字可见
          const distanceFromCenter = Math.abs(offsetFromCenter);
          let opacity = 1.0;

          if (distanceFromCenter > itemHeight) {
            opacity = Math.max(0.6, 1 - (distanceFromCenter - itemHeight) / (visibleAreaHeight / 2));
          }

          // 选项名称 - 使用更小的字体和更柔和的颜色
          ctx.font = isSelected ? '600 12px -apple-system, "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif' :
                                 '500 12px -apple-system, "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif';

          if (isSelected) {
            ctx.fillStyle = '#007AFF'; // 选中项使用蓝色
          } else {
            ctx.fillStyle = `rgba(29, 29, 31, ${opacity})`; // 非选中项使用带透明度的深色
          }

          // 添加文字阴影，提高可读性
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 0.5;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0.5;

          // 确保文字不会超出边界 - 减小内边距
          const textPadding = 6;
          const maxTextWidth = selectorWidth - textPadding * 2;
          let displayText = item.name;

          // 如果文字太长，进行截断
          if (ctx.measureText(item.name).width > maxTextWidth) {
            let truncatedText = item.name;
            while (ctx.measureText(truncatedText + '...').width > maxTextWidth && truncatedText.length > 0) {
              truncatedText = truncatedText.slice(0, -1);
            }
            displayText = truncatedText + '...';
          }

          ctx.fillText(displayText, selectorX + selectorWidth / 2, itemY + itemHeight / 2);

          // 重置阴影
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      }

      // 绘制顶部和底部渐变边缘 - 更现代的效果，进一步减小渐变区域
      const fadeHeight = 15; // 进一步减小渐变区域高度

      const topGradient = ctx.createLinearGradient(0, selectorY, 0, selectorY + fadeHeight);
      topGradient.addColorStop(0, 'rgba(248, 248, 250, 0.9)');
      topGradient.addColorStop(1, 'rgba(248, 248, 250, 0)');
      ctx.fillStyle = topGradient;
      ctx.fillRect(selectorX, selectorY, selectorWidth, fadeHeight);

      const bottomGradient = ctx.createLinearGradient(0, selectorY + selectorHeight - fadeHeight, 0, selectorY + selectorHeight);
      bottomGradient.addColorStop(0, 'rgba(248, 248, 250, 0)');
      bottomGradient.addColorStop(1, 'rgba(248, 248, 250, 0.9)');
      ctx.fillStyle = bottomGradient;
      ctx.fillRect(selectorX, selectorY + selectorHeight - fadeHeight, selectorWidth, fadeHeight);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    } else {
      // 绘制收起状态的按钮
      const selectedItem = this.eventHandler.tankSelectorState.items[this.eventHandler.tankSelectorState.selectedIndex];

      // 优化按钮背景颜色 - 使用与返回按钮相同的渐变风格
      const buttonGradient = ctx.createLinearGradient(selectorX, selectorY, selectorX, selectorY + buttonHeight);
      buttonGradient.addColorStop(0, '#F8F9FA'); // 浅灰色渐变
      buttonGradient.addColorStop(1, '#F2F2F7'); // 稍深一点的灰色

      ctx.fillStyle = buttonGradient;
      ctx.strokeStyle = '#E5E5EA';
      ctx.lineWidth = 0.5;
      Utils.drawRoundedRect(ctx, selectorX, selectorY, selectorWidth, buttonHeight, 6, true, false);
      Utils.drawRoundedRect(ctx, selectorX, selectorY, selectorWidth, buttonHeight, 6, false, true);

      // 绘制当前选中的文本 - 使用更小的字体并确保居中对齐
      ctx.fillStyle = '#1D1D1F';
      ctx.font = '500 12px -apple-system, "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif'; // 减小字体

      // 确保文本居中显示
      ctx.textAlign = 'center'; // 改为居中对齐
      ctx.textBaseline = 'middle';

      // 计算文本显示位置，考虑下拉箭头的宽度
      const arrowWidth = 15;
      const maxTextWidth = selectorWidth - arrowWidth - 10;
      let displayText = selectedItem.name;

      // 如果文字太长，进行截断
      if (ctx.measureText(selectedItem.name).width > maxTextWidth) {
        let truncatedText = selectedItem.name;
        while (ctx.measureText(truncatedText + '...').width > maxTextWidth && truncatedText.length > 0) {
          truncatedText = truncatedText.slice(0, -1);
        }
        displayText = truncatedText + '...';
      }

      ctx.fillText(displayText, selectorX + (selectorWidth - arrowWidth) / 2, selectorY + buttonHeight / 2);

      // 绘制下拉箭头 - 使用更小的图标并确保居中对齐
      ctx.fillStyle = '#8E8E93';
      ctx.font = '8px -apple-system, "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif'; // 减小字体
      ctx.textAlign = 'center'; // 居中对齐
      ctx.fillText('▼', selectorX + selectorWidth - arrowWidth / 2, selectorY + buttonHeight / 2);

      // 添加微小的分隔线
      ctx.strokeStyle = '#E5E5EA';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(selectorX + selectorWidth - arrowWidth - 3, selectorY + 6); // 调整位置
      ctx.lineTo(selectorX + selectorWidth - arrowWidth - 3, selectorY + buttonHeight - 6); // 调整位置
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

// 绘制组队界面
  drawTeamInterface() {
    const ctx = this.ctx;

    // 绘制主游戏界面作为背景
    const gameState = this.eventHandler ? this.eventHandler.gameState : null;
    const positions = getAreaPositions();

    this.interfaceRenderer.drawBackground();
    this.drawMainTitle();
    this.interfaceRenderer.drawFunctionArea(gameState, positions);
    this.interfaceRenderer.drawIndicatorArea(positions);
    this.interfaceRenderer.drawDrawingArea(gameState, positions);
    this.interfaceRenderer.drawScoreArea(gameState, positions);
    this.interfaceRenderer.drawJumpArea(positions);

    // 确保teamInterfaceRenderer能够访问到事件处理器的输入数据
    if (this.eventHandler && this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.team) {
      const currentTeamState = this.eventHandler.touchHandlers.team.currentTeamState;

      // 将输入数据设置到teamInterfaceRenderer中
      this.teamInterfaceRenderer.setTeamInput(this.eventHandler.touchHandlers.team.teamInput);
      this.teamInterfaceRenderer.setSearchRoomInput(this.eventHandler.touchHandlers.team.searchRoomInput);

      switch (currentTeamState) {
        case 'main':
          this.teamInterfaceRenderer.drawTeamInterface();
          break;
        case 'createRoom':
          this.teamInterfaceRenderer.drawCreateRoomInterface();
          break;
        case 'searchRoom':
          this.teamInterfaceRenderer.drawSearchRoomInterface();
          break;
        default:
          this.teamInterfaceRenderer.drawTeamInterface();
      }
    } else {
      // 默认绘制主组队界面
      this.teamInterfaceRenderer.drawTeamInterface();
    }
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

  // 新增：绘制旋转加载动画
  drawLoadingSpinner(x, y, size = 20) {
    const ctx = this.ctx;

    // 更新旋转角度
    this.loadingSpinnerAngle = (this.loadingSpinnerAngle - 0.1) % (Math.PI * 2);

    ctx.save();

    // 移动到中心点
    ctx.translate(x, y);

    // 旋转
    ctx.rotate(this.loadingSpinnerAngle);

    // 绘制旋转的圆弧
    ctx.strokeStyle = config.primaryColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // 绘制3/4圆弧
    ctx.beginPath();
    ctx.arc(0, 0, size/2, 0, Math.PI * 1.5);
    ctx.stroke();

    // 绘制旋转的端点
    ctx.fillStyle = config.primaryColor;
    ctx.beginPath();
    ctx.arc(size/2, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 新增：专业级预加载动画集合
  drawProfessionalLoadingAnimation(x, y, size = 24) {
    const ctx = this.ctx;
    const now = Date.now();
    const animationTime = (now % 2000) / 2000; // 2秒循环

    // 方法1：渐变脉冲圆环
    this.drawPulseRingLoading(ctx, x, y, size, animationTime);

    // 方法2：波浪进度条（备用）
    // this.drawWaveProgressLoading(ctx, x, y, size, animationTime);

    // 方法3：3D旋转球体（备用）
    // this.draw3DSphereLoading(ctx, x, y, size, animationTime);
  }

  // 渐变脉冲圆环加载动画
  drawPulseRingLoading(ctx, x, y, size, animationTime) {
    ctx.save();
    ctx.translate(x, y);

    // 主圆环 - 渐变脉冲效果
    const pulseIntensity = Math.abs(Math.sin(animationTime * Math.PI * 2));
    const ringWidth = 3 + pulseIntensity * 1.5;

    // 创建渐变
    const gradient = ctx.createRadialGradient(0, 0, size/2 - ringWidth/2, 0, 0, size/2);
    gradient.addColorStop(0, config.primaryColor);
    gradient.addColorStop(0.7, '#5AC8FA');
    gradient.addColorStop(1, '#FFFFFF');

    // 绘制外圆环
    ctx.strokeStyle = gradient;
    ctx.lineWidth = ringWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, size/2, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制旋转的球体
    const ballAngle = animationTime * Math.PI * 2;
    const ballSize = 4 + pulseIntensity * 1;
    const ballX = Math.cos(ballAngle) * size/2;
    const ballY = Math.sin(ballAngle) * size/2;

    // 球体渐变
    const ballGradient = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, ballSize);
    ballGradient.addColorStop(0, '#FFFFFF');
    ballGradient.addColorStop(1, config.primaryColor);

    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballSize, 0, Math.PI * 2);
    ctx.fill();

    // 添加光晕效果
    ctx.shadowColor = config.primaryColor;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.restore();
  }

  // 波浪进度条加载动画
  drawWaveProgressLoading(ctx, x, y, size, animationTime) {
    ctx.save();
    ctx.translate(x, y);

    const waveHeight = size / 3;
    const waveCount = 4;
    const waveLength = size / waveCount;

    // 绘制波浪背景
    ctx.fillStyle = '#E5E5EA';
    ctx.fillRect(-size/2, -waveHeight/2, size, waveHeight);

    // 绘制波浪进度
    ctx.fillStyle = config.primaryColor;

    for (let i = 0; i < waveCount; i++) {
      const waveX = -size/2 + i * waveLength;
      const wavePhase = (animationTime + i * 0.25) * Math.PI * 2;
      const waveAmplitude = Math.sin(wavePhase) * waveHeight/2;

      ctx.beginPath();
      ctx.moveTo(waveX, -waveHeight/2);
      ctx.lineTo(waveX, waveAmplitude);
      ctx.lineTo(waveX + waveLength, waveAmplitude);
      ctx.lineTo(waveX + waveLength, -waveHeight/2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 3D旋转球体加载动画
  draw3DSphereLoading(ctx, x, y, size, animationTime) {
    ctx.save();
    ctx.translate(x, y);

    // 球体旋转角度
    const rotationX = animationTime * Math.PI * 2;
    const rotationY = animationTime * Math.PI * 1.5;

    // 绘制球体
    const sphereGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size/2);
    sphereGradient.addColorStop(0, '#FFFFFF');
    sphereGradient.addColorStop(0.5, config.primaryColor);
    sphereGradient.addColorStop(1, '#0055CC');

    ctx.fillStyle = sphereGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size/2, 0, Math.PI * 2);
    ctx.fill();

    // 添加高光效果
    const highlightSize = size/4;
    const highlightX = Math.cos(rotationX) * size/4;
    const highlightY = Math.sin(rotationY) * size/4;

    const highlightGradient = ctx.createRadialGradient(
      highlightX, highlightY, 0,
      highlightX, highlightY, highlightSize
    );
    highlightGradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    highlightGradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(highlightX, highlightY, highlightSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 智能预加载提示（带进度指示）
  drawSmartPreloadHint(x, y, progress = 0) {
    const ctx = this.ctx;

    // 背景容器
    const containerWidth = 120;
    const containerHeight = 40;

    ctx.save();
    ctx.translate(x, y);

    // 绘制背景 - 兼容性处理：使用普通矩形+圆角路径
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.globalAlpha = 0.8;

    // 手动绘制圆角矩形（兼容性更好）
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(-containerWidth/2 + radius, -containerHeight/2);
    ctx.lineTo(containerWidth/2 - radius, -containerHeight/2);
    ctx.arcTo(containerWidth/2, -containerHeight/2, containerWidth/2, -containerHeight/2 + radius, radius);
    ctx.lineTo(containerWidth/2, containerHeight/2 - radius);
    ctx.arcTo(containerWidth/2, containerHeight/2, containerWidth/2 - radius, containerHeight/2, radius);
    ctx.lineTo(-containerWidth/2 + radius, containerHeight/2);
    ctx.arcTo(-containerWidth/2, containerHeight/2, -containerWidth/2, containerHeight/2 - radius, radius);
    ctx.lineTo(-containerWidth/2, -containerHeight/2 + radius);
    ctx.arcTo(-containerWidth/2, -containerHeight/2, -containerWidth/2 + radius, -containerHeight/2, radius);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // 绘制进度条背景
    const progressBarWidth = 80;
    const progressBarHeight = 4;
    const progressBarX = -progressBarWidth/2;
    const progressBarY = 5;

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);

    // 绘制进度条
    const progressWidth = progressBarWidth * Math.min(progress, 1);
    const progressGradient = ctx.createLinearGradient(
      progressBarX, progressBarY,
      progressBarX + progressWidth, progressBarY
    );
    progressGradient.addColorStop(0, '#4CD964');
    progressGradient.addColorStop(1, '#007AFF');

    ctx.fillStyle = progressGradient;
    ctx.fillRect(progressBarX, progressBarY, progressWidth, progressBarHeight);

    // 绘制文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = progress < 1 ? '加载中...' : '加载完成';
    ctx.fillText(text, 0, -5);

    // 绘制进度百分比
    const percentage = Math.round(progress * 100);
    ctx.font = '11px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`${percentage}%`, 0, 15);

    ctx.restore();
  }

  // 绘制排行榜卡片（更新版）- 虚拟滚动优化
  drawRankingCards() {
    const ctx = this.ctx;
    const rankingFishes = this.eventHandler.rankingData.fishes;
    const scrollOffset = this.eventHandler.touchHandlers.ranking.getScrollOffset();

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 220;
    const rowHeight = cardHeight + 15;
    const startY = 110 - scrollOffset; // 下移10像素，与返回按钮位置保持一致

    // 设置裁剪区域，防止卡片绘制到界面外
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 110, config.screenWidth, config.screenHeight - 110);
    ctx.clip();

    // 虚拟滚动优化：只渲染可见区域的卡片
    const visibleStartRow = Math.max(0, Math.floor(scrollOffset / rowHeight));
    const visibleEndRow = Math.min(
      Math.ceil((rankingFishes.length - 1) / 2),
      visibleStartRow + Math.ceil((config.screenHeight - 100) / rowHeight) + 1
    );

    const visibleStartIndex = Math.max(0, visibleStartRow * 2);
    const visibleEndIndex = Math.min(rankingFishes.length, visibleEndRow * 2 + 2);

    // 只渲染可见卡片
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const fishItem = rankingFishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * rowHeight;

      // 确保卡片在可见区域内
      if (cardY + cardHeight > 100 && cardY < config.screenHeight) {
        this.drawRankingCard(cardX, cardY, cardWidth, cardHeight, fishItem, i + 1);
      }
    }

    ctx.restore();

    // 绘制滚动条指示器（如果有滚动）
    if (scrollOffset > 0) {
      this.drawScrollIndicator(scrollOffset);
    }

    // 检查是否正在加载更多数据
    if (this.eventHandler.rankingIncrementalData &&
        this.eventHandler.rankingIncrementalData[this.eventHandler.rankingSortType] &&
        this.eventHandler.rankingIncrementalData[this.eventHandler.rankingSortType].isLoading) {

      // 在底部绘制专业级加载动画
      const spinnerY = config.screenHeight - 50;
      this.drawProfessionalLoadingAnimation(Math.round(config.screenWidth / 2), spinnerY, 28);

      // 可选：添加智能预加载提示
      // this.drawSmartPreloadHint(Math.round(config.screenWidth / 2), spinnerY - 30, 0.5);
    }
  }

  // 高性能版本：排行榜卡片增量渲染优化
  drawRankingCardsOnly() {
    const ctx = this.ctx;

    // 安全检查
    if (!this.eventHandler.rankingData || !this.eventHandler.rankingData.fishes) {
      return;
    }

    // 使用时间间隔控制渲染频率
    const now = Date.now();
    if (now - this.lastCardsRenderTime < this.renderFrameInterval) {
      return;
    }
    this.lastCardsRenderTime = now;

    const rankingFishes = this.eventHandler.rankingData.fishes;
    const scrollOffset = this.eventHandler.touchHandlers.ranking.getScrollOffset();

    // 性能优化：缓存计算值
    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 220;
    const rowHeight = cardHeight + 15;
    const startY = 110 - scrollOffset; // 下移10像素，与返回按钮位置保持一致
    const visibleAreaHeight = config.screenHeight - 110; // 调整可见区域高度，与下移的起始位置保持一致

    // 清除整个底部区域到屏幕底部，避免残影
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 110, config.screenWidth, config.screenHeight - 110);

    // 设置裁剪区域，扩展到屏幕底部
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 110, config.screenWidth, config.screenHeight - 110);
    ctx.clip();

    // 虚拟滚动优化：只渲染可见区域的卡片
    const visibleStartRow = Math.max(0, Math.floor(scrollOffset / rowHeight));
    const visibleRows = Math.ceil(visibleAreaHeight / rowHeight) + 2; // +2作为缓冲
    const visibleEndRow = Math.min(
      Math.ceil((rankingFishes.length - 1) / 2),
      visibleStartRow + visibleRows
    );

    const visibleStartIndex = Math.max(0, visibleStartRow * 2);
    const visibleEndIndex = Math.min(rankingFishes.length, visibleEndRow * 2 + 2);

    // 性能优化：批量绘制，减少循环次数
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const fishItem = rankingFishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * rowHeight;

      // 确保卡片在可见区域内
      if (cardY + cardHeight > 100 && cardY < config.screenHeight) {
        this.drawRankingCard(cardX, cardY, cardWidth, cardHeight, fishItem, i + 1);
      }
    }

    ctx.restore();

    // 绘制滚动条指示器（如果有滚动）
    if (scrollOffset > 0) {
      this.drawScrollIndicator(scrollOffset);
    }

    // 检查是否正在加载更多数据
    if (this.eventHandler.rankingIncrementalData &&
        this.eventHandler.rankingIncrementalData[this.eventHandler.rankingSortType] &&
        this.eventHandler.rankingIncrementalData[this.eventHandler.rankingSortType].isLoading) {

      // 在底部绘制专业级加载动画
      const spinnerY = config.screenHeight - 50;
      this.drawProfessionalLoadingAnimation(Math.round(config.screenWidth / 2), spinnerY, 28);

      // 可选：添加智能预加载提示
      // this.drawSmartPreloadHint(Math.round(config.screenWidth / 2), spinnerY - 30, 0.5);
    }
  }

  // 绘制滚动条指示器
  drawScrollIndicator(scrollOffset) {
    const ctx = this.ctx;
    const maxScrollY = this.eventHandler.touchHandlers.ranking.getMaxScrollY();

    if (maxScrollY <= 0) return;

    const indicatorWidth = 4;
    const indicatorRight = config.screenWidth - 10;
    const indicatorTop = 110; // 下移10像素，与卡片区域对齐
    const indicatorHeight = (config.screenHeight - 110) - 40; // 调整高度，确保在裁剪区域内

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

  // 新增：通用的交互按钮绘制函数 - 优化：使用图标模式提高点击体验
  drawInteractionButton(ctx, x, y, width, height, text, isActive, isPrimary = false) {
    // 使用图标模式，只显示图标不显示背景，提高视觉识别度
    Utils.drawModernButton(
      ctx,
      x,
      y,
      width,
      height,
      text,
      isActive,
      isPrimary,
      false,
      true // 设置为图标模式，提高点击体验
    );
  }

  // 绘制单个排行榜卡片 - 修改：添加点赞点踩按钮
  drawRankingCard(x, y, width, height, fishItem, rank) {
    const ctx = this.ctx;
    const fishData = fishItem.fishData;

    // 使用最终交互状态（优先本地缓存）
    const finalInteraction = this.eventHandler.getFinalInteractionState(
      fishData.fishName,
      fishItem.userInteraction
    );

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
    ctx.imageSmoothingEnabled = false;

    const maxImageWidth = width - 10;
    const maxImageHeight = 100;

    let imageWidth = fishItem.fishImage.width;
    let imageHeight = fishItem.fishImage.height;

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
    const imageY = Math.round(y + 20);

    ctx.drawImage(fishItem.fishImage.canvas, imageX, imageY, imageWidth, imageHeight);

    // 绘制文本信息
    const textStartY = Math.round(imageY + imageHeight + 15);

    // 鱼名字
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

    // 最终评分（点赞-点踩）- 使用即时更新的本地数据
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';

    // 使用从comment集合获取的score字段
    let finalScore = fishData.score || 0;

    ctx.fillText(`评分: ${finalScore}`, Math.round(x + width / 2), textStartY + 40);

    // 绘制点赞点踩按钮区域 - 传入最终交互状态
    this.drawRankingCardButtons(ctx, x, y, width, height, fishData, finalInteraction);
  }

  // 修改后的 drawRankingCardButtons 方法：兼容新旧用户交互状态数据结构
  drawRankingCardButtons(ctx, x, y, width, height, fishData, finalInteraction) {
    const buttonAreaY = y + height - 35;
    const buttonHeight = 25;

    // 检查最终交互状态 - 兼容action字段和liked/disliked字段
    const hasInteracted = !!finalInteraction;

    // 兼容两种数据结构
    let isLiked = false;
    let isDisliked = false;

    if (hasInteracted) {
      // 新数据结构使用liked/disliked字段
      if (finalInteraction.liked !== undefined || finalInteraction.disliked !== undefined) {
        isLiked = finalInteraction.liked === true;
        isDisliked = finalInteraction.disliked === true;
      }
      // 旧数据结构使用action字段
      else if (finalInteraction.action) {
        isLiked = finalInteraction.action === 'star';
        isDisliked = finalInteraction.action === 'unstar';
      }
    }

    // 点赞按钮（左侧） - 与触摸处理保持一致
    const likeButtonX = x + 10; // 与触摸区域对齐
    const likeButtonWidth = 50;
    const likeButtonText = '👍';

    // 点踩按钮（右侧） - 与触摸处理保持一致
    const dislikeButtonX = x + width - 60; // 与触摸区域对齐
    const dislikeButtonWidth = 50;
    const dislikeButtonText = '👎';

    // 绘制点赞按钮
    this.drawInteractionButton(ctx, likeButtonX, buttonAreaY, likeButtonWidth, buttonHeight, likeButtonText, isLiked, false);
    // 绘制点踩按钮
    this.drawInteractionButton(ctx, dislikeButtonX, buttonAreaY, dislikeButtonWidth, buttonHeight, dislikeButtonText, isDisliked, false);
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

  // 修改：绘制鱼详情界面 - 使用最终交互状态，新增删除按钮
  drawFishDetailInterface() {
    const ctx = this.ctx;
    const fishData = this.eventHandler.selectedFishData.fishData;

    // 使用最终交互状态（优先本地缓存）
    const finalInteraction = this.eventHandler.getFinalInteractionState(
      fishData.fishName,
      this.eventHandler.selectedFishData.userInteraction
    );

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

    // 评分 - 使用即时更新的本地数据，兼容新旧数据结构
    ctx.fillStyle = config.primaryColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';

    // 使用从comment集合获取的score字段
    let score = fishData.score || 0;

    ctx.fillText(`评分: ${score}`, detailX + detailWidth / 2, textStartY + 50);

    // 绘制点赞和点踩按钮 - 使用最终交互状态
    const buttonWidth = (detailWidth - 60) / 2;
    const buttonY = textStartY + 75;

    // 检查最终交互状态 - 兼容action字段和liked/disliked字段
    const hasInteracted = !!finalInteraction;

    // 兼容两种数据结构
    let isLiked = false;
    let isDisliked = false;

    if (hasInteracted) {
      // 新数据结构使用liked/disliked字段
      if (finalInteraction.liked !== undefined || finalInteraction.disliked !== undefined) {
        isLiked = finalInteraction.liked === true;
        isDisliked = finalInteraction.disliked === true;
      }
      // 旧数据结构使用action字段
      else if (finalInteraction.action) {
        isLiked = finalInteraction.action === 'star';
        isDisliked = finalInteraction.action === 'unstar';
      }
    }

    // 点赞按钮
    const likeButtonText = `👍`;
    this.drawInteractionButton(
      ctx,
      detailX + 20,
      buttonY,
      buttonWidth,
      36,
      likeButtonText,
      isLiked,
      false
    );

    // 点踩按钮
    const dislikeButtonText = `👎`;
    this.drawInteractionButton(
      ctx,
      detailX + buttonWidth + 40,
      buttonY,
      buttonWidth,
      36,
      dislikeButtonText,
      isDisliked,
      false
    );

    // 新增：串门按钮（非我的鱼缸模式下显示）
    if (!this.eventHandler.isMyFish()) {
      const visitButtonWidth = 80;
      const visitButtonHeight = 36;
      const visitButtonX = detailX + (detailWidth - visitButtonWidth) / 2;
      const visitButtonY = buttonY + 50;

      Utils.drawModernButton(
        ctx,
        visitButtonX,
        visitButtonY,
        visitButtonWidth,
        visitButtonHeight,
        '🚪串门',
        false,
        false,
        false
      );

      // 串门按钮提示文字
      ctx.fillStyle = config.lightTextColor;
      ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('去主人家的鱼缸看看', detailX + detailWidth / 2, visitButtonY + 50);
    } else {
      // 显示操作提示（我的鱼缸模式）
      ctx.fillStyle = config.lightTextColor;
      ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';

      if (hasInteracted) {
        const actionText = isLiked ? '已点赞' : isDisliked ? '已点踩' : '已投票';
        ctx.fillText(`您${actionText}，点击可取消`, detailX + detailWidth / 2, buttonY + 50);
      } else {
        ctx.fillText('点击按钮表达您的态度', detailX + detailWidth / 2, buttonY + 50);
      }
    }

    // 新增：删除按钮（只在"我的鱼缸"模式下显示）
    if (this.eventHandler.isMyFish()) {
      const deleteButtonWidth = 80;
      const deleteButtonHeight = 36;
      const deleteButtonX = detailX + (detailWidth - deleteButtonWidth) / 2;
      const deleteButtonY = buttonY + 100;

      Utils.drawModernButton(
        ctx,
        deleteButtonX,
        deleteButtonY,
        deleteButtonWidth,
        deleteButtonHeight,
        '🗑️删除',
        false,
        false,
        false
      );

      // 删除按钮提示文字
      ctx.fillStyle = config.lightTextColor;
      ctx.font = 'bold 12px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('删除后将无法恢复', detailX + detailWidth / 2, deleteButtonY + 50);
    }

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
    const dialogY = (config.screenHeight - dialogHeight) / 2 - 100; // 向上移动100像素

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

  // 绘制搜索对话框
  drawSearchDialog() {
    const ctx = this.ctx;
    const eventHandler = this.eventHandler;

    // 清除画布并绘制背景
    this.interfaceRenderer.drawBackground();

    const dialogWidth = config.screenWidth - 80;
    const dialogHeight = 220;
    const dialogX = 40;
    const dialogY = (config.screenHeight - dialogHeight) / 2 - 100; // 向上移动100像素

    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 绘制对话框卡片
    Utils.drawCard(ctx, dialogX, dialogY, dialogWidth, dialogHeight);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('搜索小鱼', dialogX + dialogWidth / 2, dialogY + 40);

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
    const text = eventHandler.fishSearchInput || '';

    // 文本过长时截断显示
    let displayText = Utils.truncateText(text, 20);
    ctx.fillText(displayText, dialogX + 30, dialogY + 95);

    // 绘制光标（如果文本为空）
    if (!text) {
      ctx.fillStyle = config.primaryColor;
      ctx.fillRect(dialogX + 30, dialogY + 80, 2, 20);
    }

    // 绘制提示文字
    if (!text) {
      ctx.fillStyle = '#8E8E93'; // 浅灰色提示文字
      ctx.font = '16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.fillText('请输入小鱼名称', dialogX + 30, dialogY + 95);
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

    // 绘制搜索按钮
    Utils.drawModernButton(
      ctx,
      dialogX + 20,
      dialogY + dialogHeight - 60,
      dialogWidth - 40,
      40,
      '搜索',
      false,
      true
    );

    ctx.textAlign = 'left';
  }

// 绘制主界面底部标题 - 现代黑体斜体
drawMainTitle() {
  const ctx = this.ctx;

  // 现代黑体字体栈，优先使用系统黑体
  const title = '赛博鱼缸-共绘奇鱼';
  const x = 110; // 调整位置，与搜索按钮保持合适间距
  const y = 50;

  // 保存当前文本基线设置
  const originalTextBaseline = ctx.textBaseline;

  // 方案1：使用斜体黑体
  ctx.font = 'italic bold 18px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans CN", "Noto Sans CJK", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = config.textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 添加轻微文字阴影，增强立体感
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillText(title, x, y);

  // 重置阴影和文本基线
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.textBaseline = originalTextBaseline;
}

  // 绘制他人鱼缸界面（串门界面）
  drawOtherFishTankInterface() {
    const ctx = this.ctx;

    // 绘制鱼缸背景
    if (this.eventHandler.fishTank) {
      this.eventHandler.fishTank.draw();
    } else {
      ctx.fillStyle = '#87CEEB'; // 水蓝色背景
      ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);
    }

    // 对齐到排行榜界面的按钮高度
    const buttonY = 50; // 与排行榜界面按钮对齐

    // 绘制返回按钮
    Utils.drawModernButton(ctx, 20, buttonY, 50, 30, '返回', false, true);

    // 绘制串门标题
    ctx.fillStyle = '#374151'; // 深蓝色
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';

    if (this.eventHandler.otherFishTankData && this.eventHandler.otherFishTankData.originalFishName) {
      ctx.fillText(`正在参观 ${this.eventHandler.otherFishTankData.originalFishName} 主人的鱼缸`,
                   Math.round(config.screenWidth / 2), 70);
    } else {
      ctx.fillText('正在参观他人的鱼缸', Math.round(config.screenWidth / 2), 70);
    }

    // 绘制提示文字
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('双击屏幕投放鱼粮', Math.round(config.screenWidth / 2), config.screenHeight - 30);

    ctx.textAlign = 'left';
  }

  // 新增：绘制ESP32界面
  drawESP32Interface() {
    if (this.eventHandler.esp32Manager) {
      this.esp32InterfaceRenderer.drawESP32Interface(this.eventHandler.esp32Manager);
    }
  }

  // 绘制完整UI
  drawGameUI(gameState) {
    const positions = getAreaPositions();

    // 检查特殊界面状态
    if (this.eventHandler) {
      // 首先检查调色板界面是否可见
      if (this.eventHandler.touchHandlers && this.eventHandler.touchHandlers.main &&
          this.eventHandler.touchHandlers.main.paletteHandler &&
          this.eventHandler.touchHandlers.main.paletteHandler.isVisible) {
        // 调色板界面由调色板处理器自行绘制，不在此处绘制
        return;
      }

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

      if (this.eventHandler.isSearchDialogVisible) {
        this.drawSearchDialog();
        return;
      }

      if (this.eventHandler.isSwimInterfaceVisible) {
        this.drawFishTankInterface();
        return;
      }

      if (this.eventHandler.isTeamInterfaceVisible) {
        this.drawTeamInterface();
        return;
      }

      if (this.eventHandler.isCollaborativePaintingVisible) {
        this.drawCollaborativePaintingInterface(gameState);
        return;
      }

      if (this.eventHandler.isOtherFishTankVisible) {
        this.drawOtherFishTankInterface();
        return;
      }

      if (this.eventHandler.isESP32InterfaceVisible) {
        this.drawESP32Interface();
        return;
      }
    }

    // 绘制主游戏界面
    this.interfaceRenderer.drawBackground();
    this.drawMainTitle();
    this.interfaceRenderer.drawFunctionArea(gameState, positions);
    this.interfaceRenderer.drawIndicatorArea(positions);
    this.interfaceRenderer.drawDrawingArea(gameState, positions);
    this.interfaceRenderer.drawScoreArea(gameState, positions);
    this.interfaceRenderer.drawJumpArea(positions);
    
    // 新增：绘制ESP32按钮
    this.interfaceRenderer.drawESP32Button(positions);
  }

  // 绘制共同绘画界面
  drawCollaborativePaintingInterface(gameState) {
    const positions = getAreaPositions();

    // 绘制背景（不绘制主标题，避免显示"赛博鱼缸DrawAFish"）
    this.interfaceRenderer.drawBackground();

    // 绘制功能区，但隐藏共同绘画按钮
    this.drawCollaborativeFunctionArea(gameState, positions);

    // 绘制其他区域
    this.interfaceRenderer.drawIndicatorArea(positions);
    this.interfaceRenderer.drawDrawingArea(gameState, positions);
    this.interfaceRenderer.drawScoreArea(gameState, positions);

    // 判断是否为房主，房主显示"让它游起来"按钮，伙伴不显示
    const isRoomOwner = this.eventHandler.touchHandlers.team?.roomNumber === this.eventHandler.touchHandlers.team?.teamInput;

    if (isRoomOwner) {
      // 房主侧：显示"让它游起来"按钮
      this.drawCollaborativePaintingJumpArea(positions);
    }
    // 伙伴侧：不显示任何按钮

    // 绘制左上角返回按钮和房间号
    this.drawBackButton();
    this.drawRoomNumberHeader();

    // 只在队友未加入时显示等待伙伴提示（仅房主侧显示）
    const isTeammateJoined = this.eventHandler.touchHandlers.team?.isTeammateJoined || false;

    console.log('房间状态检查:', {
      isTeammateJoined,
      isRoomOwner,
      roomNumber: this.eventHandler.touchHandlers.team?.roomNumber,
      teamInput: this.eventHandler.touchHandlers.team?.teamInput
    });

    // 如果是房主且队友未加入，才显示等待提示
    if (!isTeammateJoined && isRoomOwner) {
      this.drawWaitingPartnerMessage();
    }
  }

  // 修改跳转区域绘制，只保留"让它游起来"按钮
  drawCollaborativePaintingJumpArea(positions) {
    const ctx = this.ctx;
    const jumpAreaY = positions.jumpAreaY;

    // 使用与主界面相同的按钮绘制方式
    const jumpButtons = ['🚀 让它游起来！'];
    const buttonWidth = (config.screenWidth - 50) / 3; // 使用与主界面相同的宽度计算
    const buttonX = (config.screenWidth - buttonWidth) / 2; // 居中显示
    const isPrimary = true; // 主按钮样式

    // 使用Utils.drawModernButton绘制按钮，与主界面保持一致
    Utils.drawModernButton(ctx, buttonX, jumpAreaY + 13, buttonWidth - 10, config.buttonHeight,
                          jumpButtons[0], false, isPrimary);
  }

  // 绘制房间号头部（放在返回键旁边对齐）
  drawRoomNumberHeader() {
    const ctx = this.ctx;

    // 获取房间号
    const roomNumber = this.eventHandler.touchHandlers.team?.roomNumber || '00000000';

    // 绘制房间号（放在返回键旁边对齐）
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 放在返回按钮右侧，垂直居中
    const roomNumberX = 80; // 返回按钮宽度50 + 间距30
    const roomNumberY = 55; // 返回按钮垂直居中位置

    ctx.fillText(`房间号: ${roomNumber}`, roomNumberX, roomNumberY);
  }

  // 绘制左上角返回按钮
  drawBackButton() {
    const ctx = this.ctx;

    // 绘制返回按钮（与其他界面保持一致）
    Utils.drawModernButton(ctx, 20, 40, 50, 30, '返回', false, true);
  }

  // 绘制等待伙伴进入的提示
  drawWaitingPartnerMessage() {
    const ctx = this.ctx;

    // 获取队友加入状态
    const isTeammateJoined = this.eventHandler.touchHandlers.team?.isTeammateJoined || false;

    // 如果队友已经加入，则不显示等待提示
    if (isTeammateJoined) {
      console.log('队友已加入，隐藏等待伙伴提示');
      return;
    }

    // 绘制半透明提示框
    const messageBoxWidth = 280;
    const messageBoxHeight = 80;
    const messageBoxX = (config.screenWidth - messageBoxWidth) / 2;
    const messageBoxY = config.screenHeight / 2 - 100;

    // 背景框
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    Utils.drawRoundedRect(ctx, messageBoxX, messageBoxY, messageBoxWidth, messageBoxHeight, 10, true, false);

    // 显示等待伙伴加入的提示
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillText('等待伙伴加入...', messageBoxX + messageBoxWidth / 2, messageBoxY + messageBoxHeight / 2 - 10);

    // 房间号提示
    const roomNumber = this.eventHandler.touchHandlers.team?.roomNumber || '00000000';
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(`房间号: ${roomNumber}`, messageBoxX + messageBoxWidth / 2, messageBoxY + messageBoxHeight / 2 + 15);

    // 绘制加载动画
    const loadingX = messageBoxX + messageBoxWidth / 2;
    const loadingY = messageBoxY + messageBoxHeight / 2 + 40;
    const loadingRadius = 8;
    const time = Date.now() / 1000;

    ctx.fillStyle = '#4CD964';
    ctx.beginPath();
    ctx.arc(loadingX, loadingY, loadingRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(loadingX + Math.cos(time * 5) * (loadingRadius - 2),
              loadingY + Math.sin(time * 5) * (loadingRadius - 2),
              2, 0, Math.PI * 2);
    ctx.fill();

    // 重置文本对齐
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 绘制共同绘画界面的功能区（隐藏共同绘画按钮）
  drawCollaborativeFunctionArea(gameState, positions) {
    const startY = positions.functionAreaY;
    const ctx = this.ctx;

    // 颜色选择 - 使用更清晰的阴影
    Utils.drawCard(ctx, 15, startY, config.screenWidth - 30, config.partHeight - 20);
    this.interfaceRenderer.drawColorButtons(startY + 10, gameState);

    // 不绘制共同绘画按钮

    // 画笔大小调节 - 使用与主界面一致的位置计算
    Utils.drawCard(ctx, 15, startY + config.partHeight -15 , config.screenWidth - 30, config.partHeight - 40);
    // 使用与主界面相同的Y坐标计算，确保画笔大小显示位置一致
    this.interfaceRenderer.drawBrushSizeControl(startY + config.partHeight + 15, gameState);

    // 工具按钮
    Utils.drawCard(ctx, 15, startY + config.partHeight * 2 - 50, config.screenWidth - 30, config.partHeight - 10);
    this.interfaceRenderer.drawToolButtons(startY + config.partHeight * 2 - 40, gameState);
  }
}

module.exports = UIManager;
// touchHandlers/rankingTouchHandler.js - 排行榜触摸处理
const { config } = require('../config.js');

class RankingTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.touchStartY = 0;
    this.touchStartX = 0; // 新增：记录触摸开始X坐标
    this.currentScrollY = 0;
    this.maxScrollY = 0;
    this.isScrolling = false;
    this.lastTouchY = 0;
    // 新增：防止快速连续点击
    this.lastButtonClickTime = 0;
    this.buttonClickCooldown = 250; // 1秒冷却时间
    // 新增：节流控制
    this.lastDrawTime = 0;
    this.drawThrottle = 0; // 完全移除节流，极致响应速度

    // 重构：完全重写滑动优化
    this.rafId = null;
    this.isDrawing = false;
    this.pendingScrollUpdate = false;
    this.scrollBuffer = 0; // 滚动位置缓冲区

    // 性能监控
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.lastDeltaY = 0;
    this.velocity = 0;
    this.inertiaAnimationId = null;
    this.isInertiaScrolling = false;

    // 新增：惯性滑动相关变量
    this.lastMoveTime = 0;
    this.lastDeltaYHistory = []; // 用于计算平均速度
    this.deltaYHistorySize = 5; // 记录最近的5次滑动
    // 优化惯性参数，平衡流畅度和性能
    this.friction = 0.96; // 优化摩擦力，平衡滑行距离
    this.minVelocityThreshold = 0.05; // 优化停止阈值
    this.bounceFactor = 0.6; // 优化回弹效果
    this.bounceVelocity = 0; // 回弹速度
    this.isBouncing = false; // 是否正在回弹
    this.velocityMultiplier = 25.0; // 优化速度放大倍数

    // 新增：基于总距离和总耗时的惯性速度计算
    this.touchStartTime = 0; // 触摸开始时间
    this.touchStartScrollY = 0; // 触摸开始时的滚动位置

    // 新增：惯性动画时间步长控制
    this.lastInertiaTime = 0;
    this.inertiaTimeStep = 16; // 目标60fps

    // 新增：加载动画帧ID
    this.loadingAnimationId = null;

    // 新增：弹性滚动相关参数
    this.elasticDistance = 100; // 最大弹性距离100像素
    this.elasticStiffness = 0.3; // 弹性刚度系数
    this.isElasticScrolling = false; // 是否处于弹性滚动状态
    this.elasticAnimationId = null; // 弹性动画ID

    // 新增：渲染性能优化
    this.lastRenderTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;
  }

  // 处理排行榜界面触摸
  handleTouch(x, y) {
    // 返回按钮 - 修复边界判断
    const backButtonX = 20;
    const backButtonY = 50;
    const backButtonWidth = 50;
    const backButtonHeight = 30;

    if (x >= backButtonX && x <= backButtonX + backButtonWidth &&
        y >= backButtonY && y <= backButtonY + backButtonHeight) {
      this.eventHandler.hideRankingInterface();
      return;
    }

    // 处理排序按钮点击
    if (this.handleSortButtonsClick(x, y)) {
      return;
    }

    // 处理卡片点击和点赞点踩按钮
    if (this.handleCardButtonsClick(x, y)) {
      return;
    }

    // 处理卡片主体点击（查看详情）
    this.handleCardClick(x, y);
  }

  // 处理排序按钮点击
  handleSortButtonsClick(x, y) {
    // 防止快速连续点击
    if (!this.eventHandler.canPerformInteraction()) {
      return false;
    }

    const buttonSpacing = 5; // 统一使用5像素间距
    const buttonHeight = 30;

    // 最佳榜按钮坐标（宽度65）
    const bestButtonX = 20 + 50 + buttonSpacing;
    if (x >= bestButtonX && x <= bestButtonX + 65 &&
        y >= 50 && y <= 50 + buttonHeight) {
      this.eventHandler.setRankingSortType('best');
      return true;
    }

    // 最丑榜按钮坐标（宽度65）
    const worstButtonX = bestButtonX + 65 + buttonSpacing;
    if (x >= worstButtonX && x <= worstButtonX + 65 &&
        y >= 50 && y <= 50 + buttonHeight) {
      this.eventHandler.setRankingSortType('worst');
      return true;
    }

    // 最新榜按钮坐标（宽度65）
    const latestButtonX = worstButtonX + 65 + buttonSpacing;
    if (x >= latestButtonX && x <= latestButtonX + 65 &&
        y >= 50 && y <= 50 + buttonHeight) {
      this.eventHandler.setRankingSortType('latest');
      return true;
    }

    return false;
  }

  // 处理卡片上的点赞点踩按钮点击
  handleCardButtonsClick(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return false;
    }

    // 新增：防止快速连续点击 - 使用事件处理器的统一检查
    if (!this.eventHandler.canPerformInteraction()) {
      return false;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 220;
    const startY = 100 - this.currentScrollY;

    for (let i = 0; i < this.eventHandler.rankingData.fishes.length; i++) {
      const fishItem = this.eventHandler.rankingData.fishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 检查是否在卡片范围内
      if (x >= cardX && x <= cardX + cardWidth &&
          y >= cardY && y <= cardY + cardHeight) {

        // 计算按钮区域 - 确保与UI渲染一致
        const buttonAreaY = cardY + cardHeight - 35; // 底部按钮区域

        // 点赞按钮区域（左侧） - 增大触摸区域优化点击灵敏度
        const likeButtonX = cardX + 10; // 扩大触摸区域
        const likeButtonWidth = 50; // 增大触摸宽度

        // 点踩按钮区域（右侧） - 增大触摸区域优化点击灵敏度
        const dislikeButtonX = cardX + cardWidth - 60; // 扩大触摸区域
        const dislikeButtonWidth = 50; // 增大触摸宽度

        const buttonHeight = 30; // 增大触摸高度

        // 检查点赞按钮点击
        if (x >= likeButtonX && x <= likeButtonX + likeButtonWidth &&
            y >= buttonAreaY && y <= buttonAreaY + buttonHeight) {
          this.eventHandler.handleRankingLikeAction(fishItem);
          return true;
        }

        // 检查点踩按钮点击
        if (x >= dislikeButtonX && x <= dislikeButtonX + dislikeButtonWidth &&
            y >= buttonAreaY && y <= buttonAreaY + buttonHeight) {
          this.eventHandler.handleRankingDislikeAction(fishItem);
          return true;
        }

        break; // 已经找到对应的卡片，不需要继续循环
      }
    }

    return false;
  }

  // 处理卡片主体点击（查看详情）
  handleCardClick(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 220;
    const startY = 100 - this.currentScrollY;

    for (let i = 0; i < this.eventHandler.rankingData.fishes.length; i++) {
      const fishItem = this.eventHandler.rankingData.fishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 检查点击是否在卡片主体范围内（排除底部按钮区域）
      if (x >= cardX && x <= cardX + cardWidth &&
          y >= cardY && y <= cardY + cardHeight - 40) {
        break;
      }
    }
  }

  // 触摸开始
  handleTouchStart(x, y) {
    // 停止当前惯性滑动和弹性动画
    this.stopInertiaScrolling();
    this.stopElasticAnimation();

    this.touchStartY = y;
    this.touchStartX = x; // 记录触摸开始X坐标
    this.lastTouchY = y;
    this.isScrolling = false;
    // 重置节流计时器，允许立即响应
    this.lastDrawTime = 0;

    // 重置惯性滑动相关变量
    this.lastMoveTime = Date.now();
    this.lastDeltaYHistory = [];
    this.velocity = 0;
    this.bounceVelocity = 0;
    this.isBouncing = false;
    this.isElasticScrolling = false;

    // 新增：记录触摸开始的时间和滚动位置
    this.touchStartTime = Date.now();
    this.touchStartScrollY = this.currentScrollY;
  }

  // 触摸移动 - 优化渲染性能
  handleTouchMove(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return;
    }

    // 计算最大滚动距离
    this.calculateMaxScroll();

    // 如果内容可以滚动，则处理滑动
    if (this.maxScrollY > 0) {
      const currentTime = Date.now();
      // 修正：正确的deltaY计算，手指向上滑动时内容向下滚动
      const deltaY = this.lastTouchY - y;

      // 优化：只有在移动距离超过10像素时才认为是滚动，提高按钮点击灵敏度
      if (Math.abs(deltaY) > 10) {
        this.isScrolling = true;

        // 更新滚动位置，添加弹性边界
        const prevScrollY = this.currentScrollY;

        // 新增：弹性滚动计算
        let newScrollY = this.currentScrollY + deltaY;

        // 检查是否超出边界，应用弹性效果
        if (newScrollY < 0) {
          // 超出顶部边界，应用弹性阻力
          const overscroll = -newScrollY;
          const resistance = this.calculateElasticResistance(overscroll);
          newScrollY = this.currentScrollY + deltaY * resistance;
        } else if (newScrollY > this.maxScrollY) {
          // 超出底部边界，应用弹性阻力
          const overscroll = newScrollY - this.maxScrollY;
          const resistance = this.calculateElasticResistance(overscroll);
          newScrollY = this.currentScrollY + deltaY * resistance;
        }

        this.currentScrollY = newScrollY;
        this.lastTouchY = y;

        // 记录滑动速度信息
        const timeDelta = currentTime - this.lastMoveTime;

        // 关键修复：确保时间间隔足够大，避免速度计算过小
        if (timeDelta > 8) {
          const currentVelocity = deltaY / timeDelta;

          // 保存到历史记录
          this.lastDeltaYHistory.push({
            velocity: currentVelocity,
            time: currentTime
          });

          // 保持历史记录大小
          if (this.lastDeltaYHistory.length > this.deltaYHistorySize) {
            this.lastDeltaYHistory.shift();
          }

          this.lastMoveTime = currentTime;
        }

        // 高性能渲染优化：使用时间间隔控制渲染频率
        const now = Date.now();
        if (now - this.lastRenderTime >= this.frameInterval) {
          this.scheduleRender();
          this.lastRenderTime = now;
        }

        // 新增：检查是否滚动到底部，触发增量加载
        this.checkLoadMore();
      }
    }
  }

  // 新增：计算弹性阻力
  calculateElasticResistance(overscroll) {
    if (overscroll <= 0) return 1.0;

    // 使用平方根函数创建非线性阻力，越拉阻力越大
    const normalizedOverscroll = Math.min(overscroll / this.elasticDistance, 1.0);
    const resistance = 1.0 - Math.sqrt(normalizedOverscroll) * 0.7;

    return Math.max(resistance, 0.3); // 最小阻力为0.3
  }

  // 新增：检查是否需要加载更多数据
  checkLoadMore() {
    // 添加安全检查
    if (!this.eventHandler) {
      return;
    }

    // 确保 rankingIncrementalData 和 cyber 数据存在
    if (!this.eventHandler.rankingIncrementalData || !this.eventHandler.rankingIncrementalData[this.eventHandler.rankingSortType]) {
      return;
    }

    const incrementalData = this.eventHandler.rankingIncrementalData[this.eventHandler.rankingSortType];

    if (!this.eventHandler.rankingData || incrementalData.isLoading) {
      return;
    }

    // 获取当前排行榜中的最后一条鱼的排名（当前缓存中的最后排名）
    const currentLastRank = incrementalData.cachedData.length > 0 ?
      incrementalData.cachedData.length :
      this.eventHandler.rankingData.fishes.length;

    // 计算当前可见的最后一条鱼的排名
    const cardHeight = 220;
    const rowHeight = cardHeight + 15;
    const startY = 110; // 下移10像素，与返回按钮位置保持一致
    const visibleHeight = config.screenHeight - startY;
    const visibleRows = Math.ceil(visibleHeight / rowHeight);
    const visibleFishCount = Math.ceil((this.currentScrollY + visibleHeight) / rowHeight) * 2; // 2列

    // 当前可见的最后一条鱼的排名（最小为1）
    const currentVisibleLastRank = Math.max(1, Math.min(visibleFishCount, currentLastRank));

    // 计算当前看到的最后一个小鱼排名距离系统缓存里记录的最后一个小鱼排名的差距
    const rankDistance = currentLastRank - currentVisibleLastRank;
    const preloadThreshold = 20; // 当距离小于20个排名时触发预加载

    // 新增：如果当前缓存没有更多数据，也跳过预加载
    if (!incrementalData.hasMore) {
      return;
    }

    if (rankDistance <= preloadThreshold && incrementalData.hasMore && !incrementalData.isLoading) {
      console.log(`当前排名距离: ${rankDistance}（阈值: ${preloadThreshold}），当前可见排名: ${currentVisibleLastRank}，缓存最后排名: ${currentLastRank}，触发异步预加载`);
      console.log(`预加载详情: 当前页=${incrementalData.currentPage}, hasMore=${incrementalData.hasMore}, isLoading=${incrementalData.isLoading}`);

      // 确保 loadNextRankingPage 方法存在
      if (typeof this.eventHandler.loadNextRankingPage === 'function') {
        this.eventHandler.loadNextRankingPage();
      }
    }
  }

  // 新增：高性能渲染调度
  scheduleRender() {
    // 完全移除节流，确保每次移动都能触发渲染
    this.lastDrawTime = Date.now();

    // 关键修复：只有当没有正在执行的渲染任务时才创建新任务
    if (!this.rafId) {
      // 使用requestAnimationFrame进行流畅渲染
      if (typeof requestAnimationFrame !== 'undefined') {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          this.performRender();
        });
      } else {
        // 兼容性处理
        this.performRender();
      }
    }
  }

  // 新增：高性能渲染执行
  performRender() {
    // 性能监控
    const now = Date.now();
    if (now - this.lastFrameTime > 1000) {
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
    this.frameCount++;

    // 修复：确保调用正确的渲染方法
    if (this.eventHandler.uiManager.drawRankingCardsOnly) {
      this.eventHandler.uiManager.drawRankingCardsOnly();
    } else if (this.eventHandler.uiManager.drawRankingInterface) {
      // 回退到完整排行榜界面渲染
      this.eventHandler.uiManager.drawRankingInterface();
    }

    // 在每次渲染时也检查加载条件，以便在惯性滚动到底部时触发加载
    this.checkLoadMore();

    // 新增：如果正在加载中，持续触发重绘以播放加载动画
    const currentMode = this.eventHandler.currentRankingMode;
    if (this.eventHandler.rankingIncrementalData &&
        this.eventHandler.rankingIncrementalData[currentMode] &&
        this.eventHandler.rankingIncrementalData[currentMode].isLoading) {
      // 取消之前的动画帧请求
      if (this.loadingAnimationId) {
        cancelAnimationFrame(this.loadingAnimationId);
      }

      // 设置新的动画帧请求
      this.loadingAnimationId = requestAnimationFrame(() => {
        this.performRender();
      });
    }
  }

  // 触摸结束 - 添加弹性回弹
  handleTouchEnd(x, y) {
    this.isScrolling = false;

    // 添加标志，避免重复处理按钮点击
    const isButtonClick = this.isButtonClick(x, y);

    if (isButtonClick) {
      return; // 如果点击了按钮，不执行滚动逻辑
    }

    // 检查是否需要弹性回弹
    if (this.currentScrollY < 0 || this.currentScrollY > this.maxScrollY) {
      this.startElasticAnimation();
    } else {
      // 正常惯性滑动逻辑
      this.calculateVelocityByTotalDistance();

      // 启动惯性滑动
      this.startInertiaScrolling();
    }

    // 只有在滚动结束时才检查是否需要加载更多数据
    this.checkLoadMore();
  }

  // 检查是否点击了按钮（不执行操作，只返回结果）
  isButtonClick(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return false;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 220;
    const startY = 100 - this.currentScrollY;

    for (let i = 0; i < this.eventHandler.rankingData.fishes.length; i++) {
      const fishItem = this.eventHandler.rankingData.fishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 检查是否在卡片范围内
      if (x >= cardX && x <= cardX + cardWidth &&
          y >= cardY && y <= cardY + cardHeight) {

        // 计算按钮区域
        const buttonAreaY = cardY + cardHeight - 35;
        const likeButtonX = cardX + 15;
        const likeButtonWidth = 40;
        const dislikeButtonX = cardX + cardWidth - 55;
        const dislikeButtonWidth = 40;
        const buttonHeight = 25;

        // 检查点赞按钮点击
        if (x >= likeButtonX && x <= likeButtonX + likeButtonWidth &&
            y >= buttonAreaY && y <= buttonAreaY + buttonHeight) {
          return true;
        }

        // 检查点踩按钮点击
        if (x >= dislikeButtonX && x <= dislikeButtonX + dislikeButtonWidth &&
            y >= buttonAreaY && y <= buttonAreaY + buttonHeight) {
          return true;
        }
      }
    }

    return false;
  }

  // 计算最大滚动距离
  calculateMaxScroll() {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      this.maxScrollY = 0;
      return;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 220;
    const startY = 110; // 下移10像素，与返回按钮位置保持一致
    const rowCount = Math.ceil(this.eventHandler.rankingData.fishes.length / 2);
    const totalContentHeight = startY + rowCount * (cardHeight + 15) + 20;

    this.maxScrollY = Math.max(0, totalContentHeight - config.screenHeight);
  }

  // 获取当前滚动位置
  getScrollOffset() {
    return this.currentScrollY;
  }

  // 重置滚动位置
  resetScroll() {
    this.currentScrollY = 0;
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.lastTouchY = 0;
    this.isScrolling = false;
    this.maxScrollY = 0;
    this.lastButtonClickTime = 0; // 重置按钮点击时间

    // 新增：停止惯性滑动和弹性动画
    this.stopInertiaScrolling();
    this.stopElasticAnimation();

    // 新增：清理加载动画
    if (this.loadingAnimationId) {
      cancelAnimationFrame(this.loadingAnimationId);
      this.loadingAnimationId = null;
    }
  }

  // 新增：基于总距离和总耗时的更科学速度计算
  calculateVelocityByTotalDistance() {
    const touchEndTime = Date.now();
    const totalTime = touchEndTime - this.touchStartTime;
    const totalDistance = this.currentScrollY - this.touchStartScrollY;

    // 计算平均速度：总距离 ÷ 总耗时
    if (totalTime > 0) {
      const averageVelocity = totalDistance / totalTime;

      // 放大速度值，使惯性滑动更明显
      this.velocity = averageVelocity * this.velocityMultiplier;
    } else {
      this.velocity = 0;
    }
  }

  // 获取最大滚动距离
  getMaxScrollY() {
    return this.maxScrollY;
  }

  // 新增：启动惯性滑动
  startInertiaScrolling() {
    // 关键修复：在停止之前先保存速度值
    const savedVelocity = this.velocity;

    // 如果速度太小，不启动惯性滑动
    if (Math.abs(savedVelocity) < this.minVelocityThreshold) {
      return;
    }

    // 停止任何现有的惯性滑动动画
    this.stopInertiaScrolling();

    // 恢复保存的速度值
    this.velocity = savedVelocity;

    // 设置状态
    this.isInertiaScrolling = true;
    this.bounceVelocity = 0;
    this.isBouncing = false;
    this.lastInertiaTime = Date.now();

    // 开始动画
    this.inertiaAnimationId = requestAnimationFrame(() => {
      this.performInertiaScroll();
    });
  }

  // 新增：执行惯性滑动动画 - 使用固定时间步长
  performInertiaScroll() {
    if (!this.isInertiaScrolling) {
      return;
    }

    const currentTime = Date.now();
    const deltaTime = Math.min(currentTime - this.lastInertiaTime, 50); // 限制最大时间间隔

    // 如果不在回弹状态，应用摩擦力
    if (!this.isBouncing) {
      // 基于时间步长的速度衰减
      this.velocity *= Math.pow(this.friction, deltaTime / 16);

      // 基于时间步长的位置更新
      this.currentScrollY += this.velocity * (deltaTime / 16);

      // 边界检查
      if (this.currentScrollY < 0) {
        this.currentScrollY = 0;
        this.isBouncing = true;
        this.bounceVelocity = this.velocity * this.bounceFactor;
      } else if (this.currentScrollY > this.maxScrollY) {
        this.currentScrollY = this.maxScrollY;
        this.isBouncing = true;
        this.bounceVelocity = this.velocity * this.bounceFactor;
      }
    } else {
      // 回弹状态 - 基于时间步长
      this.currentScrollY += this.bounceVelocity * (deltaTime / 16);
      this.bounceVelocity *= Math.pow(this.friction, deltaTime / 16);

      // 回弹边界检查
      if (this.currentScrollY < 0) {
        this.currentScrollY = 0;
        if (Math.abs(this.bounceVelocity) < this.minVelocityThreshold) {
          this.bounceVelocity = 0;
        }
      } else if (this.currentScrollY > this.maxScrollY) {
        this.currentScrollY = this.maxScrollY;
        if (Math.abs(this.bounceVelocity) < this.minVelocityThreshold) {
          this.bounceVelocity = 0;
        }
      }
    }

    // 检查是否停止惯性滑动
    if ((!this.isBouncing && Math.abs(this.velocity) < this.minVelocityThreshold) ||
        (this.isBouncing && Math.abs(this.bounceVelocity) < this.minVelocityThreshold)) {
      this.stopInertiaScrolling();
      return;
    }

    // 使用时间间隔控制渲染频率
    if (currentTime - this.lastRenderTime >= this.frameInterval) {
      // 关键修复：惯性滑动期间绕过所有节流控制，直接渲染
      if (this.eventHandler.uiManager.drawRankingCardsOnly) {
        this.eventHandler.uiManager.drawRankingCardsOnly();
      } else if (this.eventHandler.uiManager.drawRankingInterface) {
        this.eventHandler.uiManager.drawRankingInterface();
      }
      this.lastRenderTime = currentTime;
    }

    // 检查是否需要加载更多数据
    this.checkLoadMore();

    // 更新时间戳
    this.lastInertiaTime = currentTime;

    // 继续下一帧动画
    this.inertiaAnimationId = requestAnimationFrame(() => {
      this.performInertiaScroll();
    });
  }

  // 新增：停止惯性滑动
  stopInertiaScrolling() {
    if (this.inertiaAnimationId) {
      cancelAnimationFrame(this.inertiaAnimationId);
      this.inertiaAnimationId = null;
    }

    this.isInertiaScrolling = false;
    this.isBouncing = false;
    this.velocity = 0;
    this.bounceVelocity = 0;
  }

  // 新增：启动弹性回弹动画
  startElasticAnimation() {
    // 停止任何现有的动画
    this.stopInertiaScrolling();
    this.stopElasticAnimation();

    this.isElasticScrolling = true;

    this.elasticAnimationId = requestAnimationFrame(() => {
      this.performElasticAnimation();
    });
  }

  // 新增：执行弹性回弹动画
  performElasticAnimation() {
    if (!this.isElasticScrolling) {
      return;
    }

    const targetPosition = this.getTargetScrollPosition();
    const distance = targetPosition - this.currentScrollY;

    // 如果距离很小，直接跳到目标位置
    if (Math.abs(distance) < 0.5) {
      this.currentScrollY = targetPosition;
      this.stopElasticAnimation();
      this.scheduleRender(); // 触发一次最终渲染
      return;
    }

    // 使用弹性公式计算新位置
    this.currentScrollY += distance * this.elasticStiffness;

    // 渲染更新
    this.scheduleRender();

    // 继续动画
    this.elasticAnimationId = requestAnimationFrame(() => {
      this.performElasticAnimation();
    });
  }

  // 新增：获取弹性回弹的目标位置
  getTargetScrollPosition() {
    if (this.currentScrollY < 0) {
      return 0; // 回弹到顶部
    } else if (this.currentScrollY > this.maxScrollY) {
      return this.maxScrollY; // 回弹到底部
    }
    return this.currentScrollY; // 不需要回弹
  }

  // 新增：停止弹性动画
  stopElasticAnimation() {
    if (this.elasticAnimationId) {
      cancelAnimationFrame(this.elasticAnimationId);
      this.elasticAnimationId = null;
    }

    this.isElasticScrolling = false;
  }
}

module.exports = RankingTouchHandler;
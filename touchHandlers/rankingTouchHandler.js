// touchHandlers/rankingTouchHandler.js - 排行榜触摸处理
const { config } = require('../config.js');

class RankingTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.touchStartY = 0;
    this.currentScrollY = 0;
    this.maxScrollY = 0;
    this.isScrolling = false;
    this.lastTouchY = 0;
    // 新增：防止快速连续点击
    this.lastButtonClickTime = 0;
    this.buttonClickCooldown = 250; // 1秒冷却时间
    // 新增：节流控制
    this.lastDrawTime = 0;
    this.drawThrottle = 8; // 约120fps，更流畅的滚动体验
    
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
    this.friction = 0.985; // 摩擦系数，控制减速速率（增大使滑动更持久）
    this.minVelocityThreshold = 0.005; // 最小速度阈值，低于此值停止惯性滑动（减小使滑动更持久）
    this.bounceFactor = 0.5; // 边界回弹系数
    this.bounceVelocity = 0; // 回弹速度
    this.isBouncing = false; // 是否正在回弹
    this.velocityMultiplier = 2.0; // 速度放大系数，使惯性更明显

    // 新增：加载动画帧ID
    this.loadingAnimationId = null;
  }

  // 处理排行榜界面触摸
  handleTouch(x, y) {
    console.log('排行榜触摸:', x, y);

    // 返回按钮 - 修复边界判断
    const backButtonX = 20;
    const backButtonY = 40;
    const backButtonWidth = 50;
    const backButtonHeight = 30;

    if (x >= backButtonX && x <= backButtonX + backButtonWidth &&
        y >= backButtonY && y <= backButtonY + backButtonHeight) {
      console.log('点击返回按钮');
      this.eventHandler.hideRankingInterface();
      return;
    }

    // 排行榜切换按钮（现在在第二个位置）
    const switchButtonWidth = 120;
    const switchButtonX = 80;
    if (x >= switchButtonX && x <= switchButtonX + switchButtonWidth && y >= 40 && y <= 70) {
      this.eventHandler.switchRankingMode();
      return;
    }

    // 刷新按钮（现在在第三个位置）
    const refreshButtonX = switchButtonX + switchButtonWidth + 10;
    if (x >= refreshButtonX && x <= refreshButtonX + 50 && y >= 40 && y <= 70) {
      this.eventHandler.showRankingInterface();
      return;
    }

    // 处理卡片点击和点赞点踩按钮
    if (this.handleCardButtonsClick(x, y)) {
      return;
    }

    // 处理卡片主体点击（查看详情）
    this.handleCardClick(x, y);
  }

  // 处理卡片上的点赞点踩按钮点击
  handleCardButtonsClick(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return false;
    }

    // 新增：防止快速连续点击 - 使用事件处理器的统一检查
    if (!this.eventHandler.canPerformInteraction()) {
      console.log('操作过于频繁，跳过');
      return false;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 200;
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
        const buttonAreaY = cardY + cardHeight - 35; // 底部按钮区域

        // 点赞按钮区域（左侧）
        const likeButtonX = cardX + 15;
        const likeButtonWidth = 40;

        // 点踩按钮区域（右侧）
        const dislikeButtonX = cardX + cardWidth - 55;
        const dislikeButtonWidth = 40;

        const buttonHeight = 25;

        // 检查点赞按钮点击
        if (x >= likeButtonX && x <= likeButtonX + likeButtonWidth &&
            y >= buttonAreaY && y <= buttonAreaY + buttonHeight) {
          console.log('点击排行榜卡片点赞按钮:', fishItem.fishData.fishName);
          this.eventHandler.handleRankingLikeAction(fishItem);
          return true;
        }

        // 检查点踩按钮点击
        if (x >= dislikeButtonX && x <= dislikeButtonX + dislikeButtonWidth &&
            y >= buttonAreaY && y <= buttonAreaY + buttonHeight) {
          console.log('点击排行榜卡片点踩按钮:', fishItem.fishData.fishName);
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
    const cardHeight = 200;
    const startY = 100 - this.currentScrollY;

    for (let i = 0; i < this.eventHandler.rankingData.fishes.length; i++) {
      const fishItem = this.eventHandler.rankingData.fishes[i];
      const row = Math.floor(i / 2);
      const col = i % 2;

      const cardX = 20 + col * (cardWidth + 20);
      const cardY = startY + row * (cardHeight + 15);

      // 检查点击是否在卡片主体范围内（排除底部按钮区域）
      if (x >= cardX && x <= cardX + cardWidth &&
          y >= cardY && y <= cardY + cardHeight - 40) { // 减去按钮区域高度
        console.log('点击了排行榜中的鱼:', fishItem.fishData.fishName);
        // 这里可以添加点击卡片后的处理逻辑，比如查看详情
        // 暂时不实现详情跳转，因为排行榜卡片已经显示了完整信息
        break;
      }
    }
  }

  // 触摸开始
  handleTouchStart(x, y) {
    // 停止当前惯性滑动
    this.stopInertiaScrolling();
    
    this.touchStartY = y;
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
  }

  // 触摸移动 - 重构：完全重写滑动逻辑
  handleTouchMove(x, y) {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      return;
    }

    // 计算最大滚动距离
    this.calculateMaxScroll();

    // 如果内容可以滚动，则处理滑动
    if (this.maxScrollY > 0) {
      const currentTime = Date.now();
      const deltaY = this.lastTouchY - y;

      // 立即更新滚动位置（即使移动距离很小）
      if (Math.abs(deltaY) > 0) {
        this.isScrolling = true;

        // 更新滚动位置
        this.currentScrollY = Math.max(0, Math.min(this.maxScrollY, this.currentScrollY + deltaY));
        this.lastTouchY = y;

        // 记录滑动速度信息
        const timeDelta = currentTime - this.lastMoveTime;
        if (timeDelta > 0) {
          // 计算当前速度，使用像素差值/时间间隔
          // 限制最大时间间隔，避免长时间不滑动后突然滑动导致速度计算不准
          const clampedTimeDelta = Math.min(timeDelta, 50); // 最大50ms间隔
          const currentVelocity = deltaY / clampedTimeDelta * 16; // 归一化到60fps
          
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

        // 高性能渲染优化：立即更新滚动位置，异步渲染
        this.scheduleRender();

        // 新增：检查是否滚动到底部，触发增量加载
        this.checkLoadMore();
      }
    }
  }

  // 新增：检查是否需要加载更多数据
  checkLoadMore() {
    // 添加安全检查
    if (!this.eventHandler || !this.eventHandler.currentRankingMode) {
      console.log('排行榜相关数据未初始化，跳过加载检查');
      return;
    }
    
    const currentMode = this.eventHandler.currentRankingMode;
    
    // 确保 rankingIncrementalData 和当前模式的数据存在
    if (!this.eventHandler.rankingIncrementalData || !this.eventHandler.rankingIncrementalData[currentMode]) {
      console.log(`增量数据未初始化，当前模式: ${currentMode}`);
      return;
    }
    
    const incrementalData = this.eventHandler.rankingIncrementalData[currentMode];

    if (!this.eventHandler.rankingData || incrementalData.isLoading) {
      console.log('跳过加载检查: rankingData存在?', !!this.eventHandler.rankingData, '正在加载?', incrementalData.isLoading);
      return;
    }

    // 计算距离底部的距离
    const distanceFromBottom = this.maxScrollY - this.currentScrollY;
    const threshold = 300; // 距离底部300像素时触发加载，提前触发

    // console.log(`检查加载条件: 距离底部=${distanceFromBottom}, 阈值=${threshold}, 有更多数据=${incrementalData.hasMore}`);

    if (distanceFromBottom <= threshold && incrementalData.hasMore && !incrementalData.isLoading) {
      console.log('滚动到底部附近，触发增量加载');
      
      // 确保 loadNextRankingPage 方法存在
      if (typeof this.eventHandler.loadNextRankingPage === 'function') {
        this.eventHandler.loadNextRankingPage();
      } else {
        console.error('loadNextRankingPage 方法未定义');
      }
    }
  }

  // 新增：高性能渲染调度
  scheduleRender() {
    const now = Date.now();

    // 节流控制：减少重绘频率
    if (now - this.lastDrawTime >= this.drawThrottle) {
      this.lastDrawTime = now;

      // 取消之前的渲染任务
      if (this.rafId) {
        if (typeof cancelAnimationFrame !== 'undefined') {
          cancelAnimationFrame(this.rafId);
        }
        this.rafId = null;
      }

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
      const fps = Math.round(this.frameCount * 1000 / (now - this.lastFrameTime));
      console.log(`渲染帧率: ${fps}fps`);
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
    this.frameCount++;

    // 增量渲染优化：只重绘卡片区域
    if (this.eventHandler.uiManager.drawRankingCardsOnly) {
      this.eventHandler.uiManager.drawRankingCardsOnly();
    } else {
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
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

  // 触摸结束
  handleTouchEnd() {
    this.isScrolling = false;

    // 计算惯性滑动速度
    this.calculateInertiaVelocity();

    // 在触摸结束时也检查是否需要加载更多数据
    // 这可以处理用户快速滑动到底部的情况
    this.checkLoadMore();

    // 启动惯性滑动
    this.startInertiaScrolling();
  }

  // 计算最大滚动距离
  calculateMaxScroll() {
    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      this.maxScrollY = 0;
      return;
    }

    const cardWidth = (config.screenWidth - 60) / 2;
    const cardHeight = 200;
    const startY = 100;
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
    this.lastTouchY = 0;
    this.isScrolling = false;
    this.maxScrollY = 0;
    this.lastButtonClickTime = 0; // 重置按钮点击时间

    // 新增：停止惯性滑动
    this.stopInertiaScrolling();

    // 新增：清理加载动画
    if (this.loadingAnimationId) {
      cancelAnimationFrame(this.loadingAnimationId);
      this.loadingAnimationId = null;
    }
  }

  // 获取最大滚动距离
  getMaxScrollY() {
    return this.maxScrollY;
  }

  // 新增：计算惯性滑动速度
  calculateInertiaVelocity() {
    // 如果没有足够的历史数据，不启动惯性滑动
    if (this.lastDeltaYHistory.length < 2) {
      this.velocity = 0;
      return;
    }

    // 计算最近几次滑动的加权平均速度
    // 给最近的数据更高的权重
    let totalVelocity = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < this.lastDeltaYHistory.length; i++) {
      const data = this.lastDeltaYHistory[i];
      // 权重从1开始，越近的数据权重越高
      const weight = i + 1;
      totalVelocity += data.velocity * weight;
      totalWeight += weight;
    }

    if (totalWeight > 0) {
      this.velocity = totalVelocity / totalWeight;
      // 放大速度值，使惯性滑动更明显
      this.velocity *= this.velocityMultiplier;
      // console.log(`计算得到惯性速度: ${this.velocity}`);
    } else {
      this.velocity = 0;
    }
  }

  // 新增：启动惯性滑动
  startInertiaScrolling() {
    // 如果速度太小，不启动惯性滑动
    if (Math.abs(this.velocity) < this.minVelocityThreshold) {
      console.log(`速度太小 (${this.velocity})，不启动惯性滑动`);
      return;
    }

    // 停止任何现有的惯性滑动动画
    this.stopInertiaScrolling();
    
    // 设置状态
    this.isInertiaScrolling = true;
    this.bounceVelocity = 0;
    this.isBouncing = false;
    
    // console.log(`启动惯性滑动，初始速度: ${this.velocity}`);
    
    // 开始动画
    this.inertiaAnimationId = requestAnimationFrame(() => {
      this.performInertiaScroll();
    });
  }

  // 新增：执行惯性滑动动画
  performInertiaScroll() {
    if (!this.isInertiaScrolling) {
      return;
    }

    const prevScrollY = this.currentScrollY;
    
    // 如果不在回弹状态，应用摩擦力
    if (!this.isBouncing) {
      this.velocity *= this.friction;
      
      // 更新滚动位置
      this.currentScrollY += this.velocity;
      
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
      // 回弹状态
      this.currentScrollY += this.bounceVelocity;
      this.bounceVelocity *= this.friction;
      
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

    // 立即重绘UI - 不使用节流，确保惯性滑动流畅
    this.performRender();
    
    // 检查是否需要加载更多数据
    if (prevScrollY !== this.currentScrollY) {
      this.checkLoadMore();
    }

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
    
    console.log('惯性滑动已停止');
  }
}

module.exports = RankingTouchHandler;
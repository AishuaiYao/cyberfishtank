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
    // 大幅优化惯性参数，让滑动效果非常明显
    this.friction = 0.95; // 减小摩擦力，让惯性滑行更远
    this.minVelocityThreshold = 0.01; // 进一步降低停止阈值，让更慢的速度也能惯性滑动
    this.bounceFactor = 0.5; // 降低回弹效果，避免能量损失
    this.bounceVelocity = 0; // 回弹速度
    this.isBouncing = false; // 是否正在回弹
    this.velocityMultiplier = 20.0; // 大幅放大速度，让惯性非常强烈

    // 新增：基于总距离和总耗时的惯性速度计算
    this.touchStartTime = 0; // 触摸开始时间
    this.touchStartScrollY = 0; // 触摸开始时的滚动位置

    // 新增：基于总距离和总耗时的惯性速度计算
    this.touchStartTime = 0; // 触摸开始时间
    this.touchStartScrollY = 0; // 触摸开始时的滚动位置

    // 调试信息
    this.debugInfo = "未开始";
    this.debugVelocity = 0;
    this.debugFrameCount = 0;

    // 新增：加载动画帧ID
    this.loadingAnimationId = null;

    // 新增：弹性滚动相关参数
    this.elasticDistance = 100; // 最大弹性距离100像素
    this.elasticStiffness = 0.3; // 弹性刚度系数
    this.isElasticScrolling = false; // 是否处于弹性滚动状态
    this.elasticAnimationId = null; // 弹性动画ID
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
    // 停止当前惯性滑动和弹性动画
    this.stopInertiaScrolling();
    this.stopElasticAnimation();

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
    this.isElasticScrolling = false;

    // 新增：记录触摸开始的时间和滚动位置
    this.touchStartTime = Date.now();
    this.touchStartScrollY = this.currentScrollY;

    console.log('触摸开始，重置惯性参数');
  }

  // 触摸移动 - 重构：完全重写滑动逻辑，添加弹性效果
  handleTouchMove(x, y) {
    const moveStartTime = Date.now();

    if (!this.eventHandler.rankingData || this.eventHandler.rankingData.fishes.length === 0) {
      console.log(`触摸移动 - 数据为空: ${Date.now() - moveStartTime}ms`);
      return;
    }

    // 计算最大滚动距离
    this.calculateMaxScroll();

    // 如果内容可以滚动，则处理滑动
    if (this.maxScrollY > 0) {
      const currentTime = Date.now();
      // 修正：正确的deltaY计算，手指向上滑动时内容向下滚动
      const deltaY = this.lastTouchY - y;

      // 立即更新滚动位置（即使移动距离很小）
      if (Math.abs(deltaY) > 0) {
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
        if (timeDelta > 8) { // 至少8ms间隔，避免过于频繁的计算
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

          // 调试：打印速度信息
          console.log(`速度计算: deltaY=${deltaY.toFixed(2)}, timeDelta=${timeDelta}ms, velocity=${currentVelocity.toFixed(4)}`);
        }

        // 高性能渲染优化：立即更新滚动位置，异步渲染
        const renderStartTime = Date.now();
        this.scheduleRender();
        const renderEndTime = Date.now();

        // 新增：详细性能调试信息
        console.log(`触摸移动性能分析:
          总耗时: ${renderEndTime - moveStartTime}ms
          滚动更新: ${renderStartTime - moveStartTime}ms
          渲染调度: ${renderEndTime - renderStartTime}ms
          滚动位置: ${prevScrollY} -> ${this.currentScrollY}
          最大滚动: ${this.maxScrollY}
          数据条数: ${this.eventHandler.rankingData.fishes.length}
        `);

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

    // 完全移除节流，确保每次移动都能触发渲染
    this.lastDrawTime = now;

    // 关键修复：只有当没有正在执行的渲染任务时才创建新任务
    // 避免频繁取消动画帧导致渲染中断
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
    } else {
      // 已经有渲染任务在执行，不需要重复调度
      console.log('已有渲染任务在执行，跳过重复调度');
    }
  }

  // 新增：高性能渲染执行
  performRender() {
    const renderStartTime = Date.now();

    // 性能监控
    const now = Date.now();
    if (now - this.lastFrameTime > 1000) {
      const fps = Math.round(this.frameCount * 1000 / (now - this.lastFrameTime));
      console.log(`渲染帧率: ${fps}fps`);
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
    this.frameCount++;

    // 修复：确保调用正确的渲染方法
    const renderMethodStart = Date.now();
    if (this.eventHandler.uiManager.drawRankingCardsOnly) {
      console.log('使用 drawRankingCardsOnly 方法渲染');
      this.eventHandler.uiManager.drawRankingCardsOnly();
    } else if (this.eventHandler.uiManager.drawRankingInterface) {
      console.log('使用 drawRankingInterface 方法渲染');
      // 回退到完整排行榜界面渲染
      this.eventHandler.uiManager.drawRankingInterface();
    } else {
      console.error('排行榜渲染方法未找到！');
    }
    const renderMethodEnd = Date.now();

    // 在每次渲染时也检查加载条件，以便在惯性滚动到底部时触发加载
    const checkLoadStart = Date.now();
    this.checkLoadMore();
    const checkLoadEnd = Date.now();

    // 新增：详细渲染性能信息
    console.log(`渲染性能分析:
      总耗时: ${Date.now() - renderStartTime}ms
      渲染方法调用: ${renderMethodEnd - renderMethodStart}ms
      加载检查: ${checkLoadEnd - checkLoadStart}ms
      当前滚动位置: ${this.currentScrollY}
      可见卡片数: ${Math.ceil(this.eventHandler.rankingData.fishes.length / 2)}
    `);

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
  handleTouchEnd() {
    this.isScrolling = false;

    // 检查是否需要弹性回弹
    if (this.currentScrollY < 0 || this.currentScrollY > this.maxScrollY) {
      console.log('触发弹性回弹');
      this.startElasticAnimation();
    } else {
      // 正常惯性滑动逻辑
      this.calculateVelocityByTotalDistance();

      // 调试：打印最终速度信息
      console.log(`触摸结束 - 最终速度: ${this.velocity.toFixed(4)}, 阈值: ${this.minVelocityThreshold}`);

      // 启动惯性滑动
      this.startInertiaScrolling();
    }

    // 在触摸结束时也检查是否需要加载更多数据
    this.checkLoadMore();
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

      console.log(`基于总距离的速度计算:
        总耗时: ${totalTime}ms
        总距离: ${totalDistance.toFixed(2)}
        平均速度: ${averageVelocity.toFixed(4)}
        放大后速度: ${this.velocity.toFixed(4)}
        是否启动惯性: ${Math.abs(this.velocity) >= this.minVelocityThreshold ? '是' : '否'}
      `);
    } else {
      this.velocity = 0;
      console.log('触摸时间过短，速度设为0');
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
      console.log(`历史数据不足: ${this.lastDeltaYHistory.length} 条记录`);
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

      // 添加详细调试信息
      console.log(`惯性速度计算:
        原始平均速度: ${(totalVelocity / totalWeight).toFixed(4)}
        放大后速度: ${this.velocity.toFixed(4)}
        历史记录数: ${this.lastDeltaYHistory.length}
        是否启动惯性: ${Math.abs(this.velocity) >= this.minVelocityThreshold ? '是' : '否'}
      `);
    } else {
      this.velocity = 0;
      console.log('总权重为0，速度设为0');
    }
  }

  // 新增：启动惯性滑动
  startInertiaScrolling() {
    // 关键修复：在停止之前先保存速度值
    const savedVelocity = this.velocity;

    // 如果速度太小，不启动惯性滑动
    if (Math.abs(savedVelocity) < this.minVelocityThreshold) {
      console.log(`速度太小 (${savedVelocity.toFixed(4)})，不启动惯性滑动`);
      this.debugInfo = `速度太小: ${savedVelocity.toFixed(4)}`;
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

    // 调试信息
    this.debugInfo = `惯性启动: 速度=${this.velocity.toFixed(3)}`;
    console.log(`启动惯性滑动，初始速度: ${this.velocity.toFixed(4)}`);

    // 开始动画
    this.inertiaAnimationId = requestAnimationFrame(() => {
      this.performInertiaScroll();
    });
  }

  // 新增：执行惯性滑动动画
  performInertiaScroll() {
    const inertiaStartTime = Date.now();

    if (!this.isInertiaScrolling) {
      return;
    }

    this.debugFrameCount++;
    const prevScrollY = this.currentScrollY;

    // 实时更新调试信息
    this.debugInfo = `惯性中: 速度=${this.velocity.toFixed(3)}, 帧数=${this.debugFrameCount}`;

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
        console.log('到达顶部，开始回弹');
      } else if (this.currentScrollY > this.maxScrollY) {
        this.currentScrollY = this.maxScrollY;
        this.isBouncing = true;
        this.bounceVelocity = this.velocity * this.bounceFactor;
        console.log('到达底部，开始回弹');
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
      console.log('惯性滑动自然停止');
      this.stopInertiaScrolling();
      return;
    }

    // 关键修复：惯性滑动期间绕过所有节流控制，直接渲染
    const renderStartTime = Date.now();
    // 修复：确保调用正确的渲染方法
    if (this.eventHandler.uiManager.drawRankingCardsOnly) {
      this.eventHandler.uiManager.drawRankingCardsOnly();
    } else if (this.eventHandler.uiManager.drawRankingInterface) {
      // 回退到完整排行榜界面渲染
      this.eventHandler.uiManager.drawRankingInterface();
    } else {
      console.error('排行榜渲染方法未找到！');
    }
    const renderEndTime = Date.now();

    // 检查是否需要加载更多数据
    const checkLoadStart = Date.now();
    if (prevScrollY !== this.currentScrollY) {
      this.checkLoadMore();
    }
    const checkLoadEnd = Date.now();

    // 详细惯性滑动性能信息
    console.log(`惯性滑动性能分析 - 第${this.debugFrameCount}帧:
      总耗时: ${Date.now() - inertiaStartTime}ms
      渲染耗时: ${renderEndTime - renderStartTime}ms
      加载检查: ${checkLoadEnd - checkLoadStart}ms
      当前速度: ${this.velocity.toFixed(4)}
      回弹速度: ${this.bounceVelocity.toFixed(4)}
      滚动位置: ${prevScrollY} -> ${this.currentScrollY}
      是否回弹: ${this.isBouncing}
      摩擦力: ${this.friction}
    `);

    // 如果正在加载，请求动画帧以更新加载动画
    const currentMode = this.eventHandler.currentRankingMode;
    if (this.eventHandler.rankingIncrementalData &&
        this.eventHandler.rankingIncrementalData[currentMode] &&
        this.eventHandler.rankingIncrementalData[currentMode].isLoading) {
      // 已经在动画循环中，不需要再次请求
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

  // 新增：启动弹性回弹动画
  startElasticAnimation() {
    // 停止任何现有的动画
    this.stopInertiaScrolling();
    this.stopElasticAnimation();

    this.isElasticScrolling = true;

    console.log(`启动弹性回弹动画，当前位置: ${this.currentScrollY}, 目标位置: ${this.getTargetScrollPosition()}`);

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
    console.log('弹性动画已停止');
  }
}

module.exports = RankingTouchHandler;
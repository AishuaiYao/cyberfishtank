// eventHandler.js - 修复我的鱼缸查询逻辑
const { config } = require('./config.js');
const AIService = require('./aiService.js');
const DatabaseManager = require('./databaseManager.js');
const Utils = require('./utils.js');

// 导入各个模块
const MainTouchHandler = require('./touchHandlers/mainTouchHandler.js');
const RankingTouchHandler = require('./touchHandlers/rankingTouchHandler.js');
const FishDetailTouchHandler = require('./touchHandlers/fishDetailTouchHandler.js');
const DialogTouchHandler = require('./touchHandlers/dialogTouchHandler.js');
const SearchDialogTouchHandler = require('./touchHandlers/searchDialogTouchHandler.js'); // 新增：搜索对话框触摸处理器
const SwimTouchHandler = require('./touchHandlers/swimTouchHandler.js');
const TeamTouchHandler = require('./touchHandlers/teamTouchHandler.js'); // 新增：组队触摸处理器
const FishProcessor = require('./fishManager/fishProcessor.js');
const FishAnimator = require('./fishManager/fishAnimator.js');
const FishDataManager = require('./fishManager/fishDataManager.js');

const { FishTank } = require('./fishCore.js');

class EventHandler {
  constructor(canvas, ctx, gameState, uiManager) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.positions = require('./config.js').getAreaPositions();
    this.aiService = new AIService();
    this.databaseManager = new DatabaseManager();

    // 初始化各个模块
    this.touchHandlers = {
      main: new MainTouchHandler(this),
      ranking: new RankingTouchHandler(this),
      fishDetail: new FishDetailTouchHandler(this),
      dialog: new DialogTouchHandler(this),
      searchDialog: new SearchDialogTouchHandler(this), // 新增：搜索对话框触摸处理器
      swim: new SwimTouchHandler(this),
      team: new TeamTouchHandler(this) // 新增：组队触摸处理器
    };

    this.fishManager = {
      processor: new FishProcessor(this),
      animator: new FishAnimator(this),
      data: new FishDataManager(this)
    };

    // 界面状态
    this.isSwimInterfaceVisible = false;
    this.isRankingInterfaceVisible = false;
    this.isFishDetailVisible = false;
    this.isDialogVisible = false;
    this.isSearchDialogVisible = false; // 新增：搜索对话框状态
    this.isTeamInterfaceVisible = false; // 新增：组队界面状态
    this.isCollaborativePaintingVisible = false; // 新增：共同绘画界面状态
    this.isOtherFishTankVisible = false; // 新增：串门界面状态

    // 数据状态
    this.swimInterfaceData = null;
    this.rankingData = null;
    this.selectedFishData = null;
    this.dialogData = null;
    this.fishNameInput = '';
    this.fishSearchInput = ''; // 新增：搜索输入内容
    this.teamInterfaceData = null; // 新增：组队界面数据
    this.otherFishTankData = null; // 新增：串门界面数据

    // 动画相关
    this.fishTank = null;
    this.databaseFishes = [];

    // 加载状态
    this.isLoadingRanking = false;
    this.isLoadingDatabaseFishes = false;

    // 新增：记录已添加的用户鱼名称，防止重复添加
    this.addedUserFishNames = new Set();

    // 新增：全局鱼列表
    this.globalFishList = [];
    this.isFirstEnterTank = true; // 是否首次进入鱼缸

    // 修改：在构造函数中初始化时获取openid
    this.userOpenid = null; // 初始为null，在init中获取

    // 新增：操作锁，防止重复点击
    this.isOperating = false;
    // 新增：防止快速连续点击的计时器
    this.lastInteractionTime = 0;
    this.interactionCooldown = 1000; // 1秒冷却时间

    // 新增：我的鱼缸相关
    this.myFishTankList = []; // 用户自己的鱼列表

    // 新增：特殊鱼缸列表
    this.bestFishesList = []; // 最佳鱼列表（评分最高的20条鱼）
    this.worstFishesList = []; // 最丑鱼列表（评分最低的20条鱼）
    this.latestFishesList = []; // 最新鱼列表（最新加入的20条鱼）
    this.currentTankMode = 'public'; // 'public' 或 'my'



    // 新增：排行榜增量加载数据
    this.rankingIncrementalData = {
      cyber: {
        isLoading: false,
        hasMore: true,
        currentPage: 0,
        pageSize: 20,
        cachedData: [] // 缓存已加载的数据
      }
    };

    // 新增：排行榜排序类型状态
    this.rankingSortType = 'best'; // 默认显示最佳榜（点赞最多）
    this.rankingSortTypes = {
      best: 'best',    // 点赞最多
      worst: 'worst',  // 点踩最多
      latest: 'latest' // 创作时间最新
    };

    // 新增：本地交互状态缓存 - 用于即时UI更新
    this.localInteractionCache = new Map(); // key: fishName, value: {action, timestamp, originalState}

    // 新增：全局用户交互状态缓存 - 存储用户的所有交互记录
    this.userInteractionCache = new Map(); // key: fishName, value: {action, liked, disliked, timestamp}
    this.isUserInteractionCacheLoaded = false; // 标记是否已加载

    // 新增：三个独立的排行榜缓存Map - 存储每个榜单的小鱼数据
    this.rankingCache = {
      best: new Map(),    // key: fishName, value: fishCardData (最佳榜)
      worst: new Map(),   // key: fishName, value: fishCardData (最丑榜)
      latest: new Map()    // key: fishName, value: fishCardData (最新榜)
    };

    // 新增：每个排行榜的分页信息
    this.rankingPages = {
      best: { currentPage: 0, hasMore: true },
      worst: { currentPage: 0, hasMore: true },
      latest: { currentPage: 0, hasMore: true }
    };

    // 新增：缓存版本控制
    this.cacheVersion = 1;

    // 移除临时score对象，直接使用fishCardData.score

    this.bindEvents();
    this.initUserOpenid(); // 新增：初始化时获取用户openid
  }

  // 新增：检查当前选中的鱼是否是用户自己的鱼
  isMyFish() {
    if (!this.selectedFishData || !this.selectedFishData.fishData) {
      return false;
    }

    // 只有在"我的鱼缸"模式下才显示删除按钮
    if (this.currentTankMode !== 'my') {
      return false;
    }

    // 检查鱼的_openid是否与当前用户openid匹配
    const fishData = this.selectedFishData.fishData;
    return fishData._openid === this.userOpenid;
  }

  // 新增：处理删除操作
  async handleDeleteAction() {
    if (!this.canPerformInteraction()) {
      console.log('操作过于频繁，跳过删除操作');
      return;
    }

    this.startInteraction();

    try {
      if (!this.selectedFishData) {
        console.warn('没有选中的鱼数据');
        return;
      }

      const fishData = this.selectedFishData.fishData;
      const fishName = fishData.fishName;

      // 确认删除
      wx.showModal({
        title: '确认删除',
        content: `确定要删除"${fishName}"吗？删除后将无法恢复。`,
        confirmText: '删除',
        confirmColor: '#FF3B30',
        cancelText: '取消',
        success: async (res) => {
          if (res.confirm) {
            await this.performDeleteAction(fishData);
          } else {
            this.endInteraction();
          }
        },
        fail: () => {
          this.endInteraction();
        }
      });

    } catch (error) {
      Utils.handleError(error, '删除操作失败');
      Utils.showError('操作失败，请重试');
      this.endInteraction();
    }
  }

  // 新增：执行删除操作
  async performDeleteAction(fishData) {
    wx.showLoading({ title: '删除中...', mask: true });

    try {
      // 1. 从数据库中删除鱼数据
      const deleteFishSuccess = await this.deleteFishFromDatabase(fishData._id);

      if (deleteFishSuccess) {
        // 2. 从interaction集合中删除相关的交互记录
        const deleteInteractionSuccess = await this.deleteFishInteractions(fishData.fishName);

        // 3. 从comment集合中删除评论数据
        console.log(`开始删除鱼 ${fishData.fishName} 的评论数据...`);
        const deleteCommentSuccess = await this.deleteFishComment(fishData.fishName);
        console.log(`删除鱼 ${fishData.fishName} 的评论数据结果: ${deleteCommentSuccess ? '成功' : '失败'}`);

        if (deleteInteractionSuccess && deleteCommentSuccess) {
          console.log(`成功删除鱼 ${fishData.fishName} 及所有相关数据`);
        } else {
          console.warn(`鱼 ${fishData.fishName} 删除成功，但清理相关数据时出现问题: interaction=${deleteInteractionSuccess}, comment=${deleteCommentSuccess}`);
        }

        // 4. 从本地列表中移除
        this.removeFishFromLocalLists(fishData.fishName);

        // 5. 从鱼缸显示中移除
        this.removeFishFromTank(fishData.fishName);

        wx.hideLoading();
        Utils.showSuccess('删除成功');

        // 6. 关闭详情界面
        this.hideFishDetail();

        // 7. 刷新鱼缸显示
        await this.refreshFishTank();
      } else {
      wx.hideLoading();
      Utils.showError('删除失败');
      }
    } catch (error) {
      wx.hideLoading();
      Utils.handleError(error, '删除鱼失败');
      Utils.showError('删除失败，请重试');
    } finally {
      this.endInteraction();
    }
  }

  // 新增：从数据库删除鱼
  async deleteFishFromDatabase(fishId) {
    if (!Utils.checkDatabaseInitialization(this.databaseManager, '删除鱼数据')) return false;

    try {
      console.log(`删除鱼数据，ID: ${fishId}`);
      await this.databaseManager.cloudDb.collection('fishes')
        .doc(fishId)
        .remove();

      console.log('鱼数据删除成功');
      return true;
    } catch (error) {
      return Utils.handleDatabaseError(error, '删除鱼数据', false);
    }
  }

  // 从interaction集合中删除相关交互记录
  async deleteFishInteractions(fishName) {
    if (!Utils.checkDatabaseInitialization(this.databaseManager, '删除交互记录')) return false;

    try {
      console.log(`删除鱼 ${fishName} 的所有交互记录`);

      // 调用云函数删除所有用户的交互记录
      const result = await wx.cloud.callFunction({
        name: 'deleteFishInteractions',
        data: { fishName: fishName }
      });

      if (result.result && result.result.success) {
        console.log(`云函数调用成功: ${result.result.message}`);
        return true;
      } else {
        console.error('云函数调用失败:', result.result?.error || result.result?.message);
        return false;
      }
    } catch (error) {
      console.error('删除交互记录失败:', error);
      return false;
    }
  }

  // 新增：从comment集合中删除鱼的评论数据
  async deleteFishComment(fishName) {
    if (!Utils.checkDatabaseInitialization(this.databaseManager, '删除鱼的评论数据')) return false;

    try {
      return await this.databaseManager.deleteFishComment(fishName);
    } catch (error) {
      console.error('删除鱼的评论数据失败:', error);
      return false;
    }
  }

  // 新增：从本地列表中移除鱼
  removeFishFromLocalLists(fishName) {
    // 从我的鱼缸列表中移除
    this.myFishTankList = this.myFishTankList.filter(fish =>
      fish.fishName !== fishName
    );

    // 从全局鱼列表中移除（如果存在）
    this.globalFishList = this.globalFishList.filter(fish =>
      fish.fishName !== fishName
    );

    // 从已添加名称缓存中移除
    this.addedUserFishNames.delete(fishName);

    console.log(`从本地列表中移除鱼: ${fishName}`);
  }

  // 新增：从鱼缸显示中移除鱼
  removeFishFromTank(fishName) {
    if (this.fishTank) {
      const initialCount = this.fishTank.fishes.length;
      this.fishTank.fishes = this.fishTank.fishes.filter(fish =>
        fish.name !== fishName
      );
      const removedCount = initialCount - this.fishTank.fishes.length;

      if (removedCount > 0) {
        console.log(`从鱼缸显示中移除 ${removedCount} 条名为 "${fishName}" 的鱼`);
      }
    }
  }

  // 新增：初始化用户openid
  async initUserOpenid() {
    try {
      console.log('开始初始化用户openid...');
      this.userOpenid = await this.fetchOpenidFromCloud();
      console.log('用户openid初始化成功:', this.userOpenid);
    } catch (error) {
      Utils.handleError(error, '用户openid初始化失败');
      this.userOpenid = null;
    }
  }

  // 修改：获取真实用户openid的方法 - 使用缓存
  async getRealUserOpenid() {
    // 如果已经有缓存的openid，直接返回
    if (this.userOpenid) return this.userOpenid;

    // 否则重新获取
    try {
      console.log('重新获取用户openid...');
      this.userOpenid = await this.fetchOpenidFromCloud();
      return this.userOpenid;
    } catch (error) {
      Utils.handleError(error, '重新获取用户openid失败');
      throw error;
    }
  }

  // 新增：从云端获取openid的核心方法
  async fetchOpenidFromCloud() {
    return new Promise((resolve, reject) => {
      if (!wx.cloud) {
        reject(new Error('云开发未初始化'));
        return;
      }

      console.log('开始调用getOpenid云函数...');

      wx.cloud.callFunction({
        name: 'getOpenid',
        success: (res) => {
          console.log('云函数返回完整结果:', res);
          const openid = res.result.openid;

          if (openid && !openid.startsWith('test_')) {
            console.log('获取到真实openid:', openid);
            resolve(openid);
          } else {
            Utils.handleError('获取到测试openid或无效openid');
            reject(new Error('获取到测试openid'));
          }
        },
        fail: (err) => {
          Utils.handleError(err, '调用云函数失败');
          reject(err);
        }
      });
    });
  }

  // 新增：检查是否可以执行交互操作（防重复点击）
  canPerformInteraction() {
    const now = Date.now();
    const timeSinceLastInteraction = now - this.lastInteractionTime;

    if (this.isOperating) {
      console.log('操作进行中，请等待');
      return false;
    }

    if (timeSinceLastInteraction < this.interactionCooldown) {
      console.log('操作过于频繁，请稍后再试');
      return false;
    }

    return true;
  }

  // 新增：标记交互开始
  startInteraction() {
    this.isOperating = true;
    this.lastInteractionTime = Date.now();
  }

  // 新增：标记交互结束
  endInteraction() {
    this.isOperating = false;
  }

  // 新增：获取本地交互状态
  getLocalInteractionState(fishName) {
    return this.localInteractionCache.get(fishName);
  }

  // 优化：通用的点赞/点踩操作 - 处理重复操作
  async performInteractionAction(fishData, action, originalState, isRanking = false) {
    const fishName = fishData.fishName;
    const isStar = action === 'star';
    const sortType = isRanking ? this.rankingSortType : null;

    // 1. 验证用户信息
    if (!this.userOpenid) {
      Utils.showError('用户信息未准备好');
      return;
    }

    // 2. 检查是否已存在交互记录，处理三种状态
    const existingInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);

    if (existingInteraction) {
      // 状态二：点击相同操作（取消）
      if (existingInteraction.action === action) {
        console.log(`检测到已存在相同交互记录，执行取消操作`);
        await this.cancelInteractionAction(fishData, existingInteraction, originalState, isRanking);
        return;
      } else {
        // 状态三：点击不同操作（跨类型切换）
        console.log(`检测到跨类型切换操作：从${existingInteraction.action}切换到${action}`);
        await this.switchInteractionAction(fishData, existingInteraction.action, action, originalState, isRanking);
        return;
      }
    }

    // 3. 立即更新本地状态
    this.updateLocalFishData(fishData, action, 'increment');

    // 设置本地缓存状态
    this.setLocalInteractionState(fishName, action, originalState);

    // 4. score已在updateLocalFishData中更新，不需要额外操作

    // 5. 立即更新UI
    this.immediatelyUpdateUI();

    // 6. 异步执行数据库操作
    try {
      // 插入新的交互记录
      const interactionSuccess = await this.databaseManager.insertUserInteraction(
        fishName, action, this.userOpenid
      );

      if (interactionSuccess) {
        console.log(`${isRanking ? '排行榜' : ''}${isStar ? '点赞' : '点踩'}操作成功`);

        // 更新交互状态
        await this.updateInteractionState(fishName, action, isRanking);

        // 异步更新comment集合的score（状态一：无历史操作 → 点赞/点踩：变化量+1/-1）
        const scoreChange = action === 'star' ? 1 : -1;
        this.updateCommentScoreAsync(fishName, action, sortType, scoreChange);
      } else {
        // 插入失败，回滚状态
        this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
        // score已在updateLocalFishData中回滚，不需要额外操作
        Utils.showError('操作失败，请重试', 1500);
      }
    } catch (error) {
      console.error('数据库操作失败:', error);
      this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
      // score已在updateLocalFishData中回滚，不需要额外操作
      Utils.showError('网络错误，操作失败');
    } finally {
      this.clearLocalInteractionState(fishName);
    }
  }

  // 优化：通用的取消点赞/点踩操作
  async cancelInteractionAction(fishData, userInteraction, originalState, isRanking = false) {
    const fishName = fishData.fishName;
    const isStar = userInteraction && userInteraction.action === 'star';
    const sortType = isRanking ? this.rankingSortType : null;

    // 1. 验证交互记录
    if (!userInteraction) {
      Utils.showError('无效的交互记录');
      return;
    }

    // 2. 如果userInteraction没有_id，尝试重新查询数据库获取完整的交互记录
    let interactionToDelete = userInteraction;
    if (!userInteraction._id && this.userOpenid) {
      const dbInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
      if (dbInteraction && dbInteraction._id) {
        interactionToDelete = dbInteraction;
        console.log('从数据库重新获取到完整交互记录:', dbInteraction);
      }
    }

    if (!interactionToDelete._id) {
      Utils.showError('无法找到要删除的交互记录');
      return;
    }

    // 3. 立即更新本地状态
    this.updateLocalFishData(fishData, userInteraction.action, 'decrement');

    // 4. score已在updateLocalFishData中回滚，不需要额外操作

    // 设置本地缓存状态为取消状态
    this.setLocalInteractionState(fishName, null, originalState);

    // 5. 立即更新UI
    this.immediatelyUpdateUI();

    // 6. 异步执行数据库操作
    try {
      // 删除交互记录
      const interactionSuccess = await this.databaseManager.deleteUserInteraction(interactionToDelete._id);

      if (interactionSuccess) {
        console.log(`取消${isRanking ? '排行榜' : ''}${isStar ? '点赞' : '点踩'}成功`);

        // 清除交互状态
        this.clearInteractionState(fishName, isRanking);

        // 异步更新comment集合的score（状态二：取消点赞/点踩：变化量-1/+1）
        const scoreChange = userInteraction.action === 'star' ? -1 : 1;
        this.updateCommentScoreAsync(fishName, userInteraction.action, sortType, scoreChange);
      } else {
        // 删除失败，回滚状态
        this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
        // score已在updateLocalFishData中回滚，不需要额外操作
        Utils.showError('操作失败', 1000);
      }
    } catch (error) {
      console.error('数据库操作失败:', error);
      this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
      this.updateFishScore(fishName, userInteraction.action, sortType, 'increment');
      Utils.showError('网络错误，操作失败');
    } finally {
      this.clearLocalInteractionState(fishName);
    }
  }

  // 新增：切换交互操作（先删除原记录，再插入新记录）
  async switchInteractionAction(fishData, currentAction, newAction, originalState, isRanking = false) {
    const fishName = fishData.fishName;
    const isStar = newAction === 'star';
    const sortType = isRanking ? this.rankingSortType : null;

    // 1. 验证用户信息
    if (!this.userOpenid) {
      Utils.showError('用户信息未准备好');
      return;
    }

    // 2. 检查当前交互记录
    const existingInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);

    if (!existingInteraction || existingInteraction.action !== currentAction) {
      Utils.showError('无法找到要切换的交互记录');
      return;
    }

    // 3. 立即更新本地状态
    // 先减少当前操作的值
    this.updateLocalFishData(fishData, currentAction, 'decrement');
    // 再增加新操作的值
    this.updateLocalFishData(fishData, newAction, 'increment');

    // 设置本地缓存状态
    this.setLocalInteractionState(fishName, newAction, originalState);

    // 4. 立即更新UI
    this.immediatelyUpdateUI();

    // 5. 异步执行数据库操作
    try {
      // 先删除原记录
      const deleteSuccess = await this.databaseManager.deleteUserInteraction(existingInteraction._id);

      if (!deleteSuccess) {
        throw new Error('删除原记录失败');
      }

      // 再插入新记录
      const insertSuccess = await this.databaseManager.insertUserInteraction(
        fishName, newAction, this.userOpenid
      );

      if (insertSuccess) {
        console.log(`${isRanking ? '排行榜' : ''}切换操作成功：${currentAction} -> ${newAction}`);

        // 更新交互状态
        await this.updateInteractionState(fishName, newAction, isRanking);

        // 异步更新comment集合的score（状态三：跨类型切换，变化量+2/-2）
        const scoreChange = newAction === 'star' ? 2 : -2;
        this.updateCommentScoreAsync(fishName, newAction, sortType, scoreChange);
      } else {
        throw new Error('插入新记录失败');
      }
    } catch (error) {
      console.error('切换操作失败:', error);
      // 回滚状态
      this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
      Utils.showError('切换操作失败，请重试');
    } finally {
      this.clearLocalInteractionState(fishName);
    }
  }

  // 新增：设置本地交互状态 - 兼容新旧数据结构
  setLocalInteractionState(fishName, action, originalState = null) {
    const state = {
      timestamp: Date.now(),
      originalState: originalState // 保存原始状态用于回滚
    };

    // 兼容action字段和liked/disliked字段
    if (action === null) {
      // 取消操作状态
      state.liked = false;
      state.disliked = false;
      state.action = null;
    } else if (action === 'star') {
      // 点赞状态
      state.liked = true;
      state.disliked = false;
      state.action = action;
    } else if (action === 'unstar') {
      // 点踩状态
      state.liked = false;
      state.disliked = true;
      state.action = action;
    }

    this.localInteractionCache.set(fishName, state);
  }

  // 新增：清除本地交互状态
  clearLocalInteractionState(fishName) {
    this.localInteractionCache.delete(fishName);
  }

  // 更新本地鱼数据状态
  updateLocalFishData(fishData, action, operation) {
    const isStar = action === 'star';
    const change = operation === 'increment' ? 1 : -1;

    // 直接更新score
    const currentScore = fishData.score || 0;
    const newScore = isStar ? currentScore + change : currentScore - change;
    fishData.score = newScore;

    // 保存原始score（如果还没有保存）
    if (fishData.originalScore === undefined) {
      fishData.originalScore = currentScore;
    }

    // 标记为已修改
    fishData.scoreChanged = 1;

    // 如果是排行榜中的鱼，同时更新缓存中的fishCardData
    const cache = this.rankingCache[this.rankingSortType];
    if (cache && cache.has(fishData.fishName)) {
      const fishCardData = cache.get(fishData.fishName);
      fishCardData.score = newScore;
      fishCardData.scoreChanged = 1;
      if (fishCardData.originalScore === undefined) {
        fishCardData.originalScore = currentScore;
      }
      cache.set(fishData.fishName, fishCardData);
    }
  }

  // 新增：更新交互状态 - 兼容新旧数据结构
  async updateInteractionState(fishName, action, isRanking) {
    if (isRanking && this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        // 重新查询数据库获取完整的交互记录（包含_id）
        const dbInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
        if (dbInteraction) {
          // 兼容处理数据库返回的交互记录
          if (dbInteraction.action) {
            // 如果有action字段，基于它设置liked/disliked
            dbInteraction.liked = dbInteraction.action === 'star';
            dbInteraction.disliked = dbInteraction.action === 'unstar';
          }

          // 更新全局用户交互缓存
          this.updateUserInteractionCache(fishName, dbInteraction);

          // 同时更新所有排行榜缓存中的交互状态
          this.updateInteractionStateInAllRankings(fishName, dbInteraction);

          fishItem.userInteraction = dbInteraction;
          console.log('设置排行榜交互状态（包含_id）:', dbInteraction);
        } else {
          // 如果没有找到记录，创建一个包含基本信息的对象
          const interaction = {
            fishName: fishName,
            _openid: this.userOpenid
          };

          // 兼容处理action字段和liked/disliked字段
          if (action === 'star') {
            interaction.liked = true;
            interaction.disliked = false;
            interaction.action = action;
          } else if (action === 'unstar') {
            interaction.liked = false;
            interaction.disliked = true;
            interaction.action = action;
          }

          // 更新全局用户交互缓存
          this.updateUserInteractionCache(fishName, interaction);

          // 同时更新所有排行榜缓存中的交互状态
          this.updateInteractionStateInAllRankings(fishName, interaction);

          fishItem.userInteraction = interaction;
        }
      }
    } else if (!isRanking) {
      await this.loadUserInteraction(fishName);
    }
  }

  // 新增：清除交互状态
  clearInteractionState(fishName, isRanking) {
    if (isRanking && this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        fishItem.userInteraction = null;
      }
    } else if (!isRanking && this.selectedFishData) {
      this.selectedFishData.userInteraction = null;
    }

    // 同时更新全局用户交互缓存
    this.updateUserInteractionCache(fishName, null);

    // 同时更新所有排行榜缓存中的交互状态
    this.updateInteractionStateInAllRankings(fishName, null);
  }

  // 新增：统一回滚交互状态
  rollbackInteractionState(fishData, originalState, isRanking, fishName) {
    if (isRanking) {
      this.rollbackRankingState({ fishData }, originalState);
    } else {
      this.rollbackDetailState(originalState);
      if (!isRanking) {
        this.loadUserInteraction(fishName);
      }
    }
  }

  // 更新本地鱼数据状态
  updateLocalFishData(fishData, action, operation) {
    const isStar = action === 'star';
    const change = operation === 'increment' ? 1 : -1;

    // 直接更新score
    const currentScore = fishData.score || 0;
    const newScore = isStar ? currentScore + change : currentScore - change;
    fishData.score = newScore;

    // 保存原始score（如果还没有保存）
    if (fishData.originalScore === undefined) {
      fishData.originalScore = currentScore;
    }

    // 标记为已修改
    fishData.scoreChanged = 1;

    // 如果是排行榜中的鱼，同时更新缓存中的fishCardData
    const cache = this.rankingCache[this.rankingSortType];
    if (cache && cache.has(fishData.fishName)) {
      const fishCardData = cache.get(fishData.fishName);
      fishCardData.score = newScore;
      fishCardData.scoreChanged = 1;
      if (fishCardData.originalScore === undefined) {
        fishCardData.originalScore = currentScore;
      }
      cache.set(fishData.fishName, fishCardData);
    }
  }

  // 新增：更新交互状态 - 兼容新旧数据结构
  async updateInteractionState(fishName, action, isRanking) {
    if (isRanking && this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        // 重新查询数据库获取完整的交互记录（包含_id）
        const dbInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
        if (dbInteraction) {
          // 兼容处理数据库返回的交互记录
          if (dbInteraction.action) {
            // 如果有action字段，基于它设置liked/disliked
            dbInteraction.liked = dbInteraction.action === 'star';
            dbInteraction.disliked = dbInteraction.action === 'unstar';
          }

          // 更新全局用户交互缓存
          this.updateUserInteractionCache(fishName, dbInteraction);

          // 同时更新所有排行榜缓存中的交互状态
          this.updateInteractionStateInAllRankings(fishName, dbInteraction);

          fishItem.userInteraction = dbInteraction;
          console.log('设置排行榜交互状态（包含_id）:', dbInteraction);
        } else {
          // 如果没有找到记录，创建一个包含基本信息的对象
          const interaction = {
            fishName: fishName,
            _openid: this.userOpenid
          };

          // 兼容处理action字段和liked/disliked字段
          if (action === 'star') {
            interaction.liked = true;
            interaction.disliked = false;
            interaction.action = action;
          } else if (action === 'unstar') {
            interaction.liked = false;
            interaction.disliked = true;
            interaction.action = action;
          }

          // 更新全局用户交互缓存
          this.updateUserInteractionCache(fishName, interaction);

          // 同时更新所有排行榜缓存中的交互状态
          this.updateInteractionStateInAllRankings(fishName, interaction);

          fishItem.userInteraction = interaction;
        }
      }
    } else if (!isRanking) {
      await this.loadUserInteraction(fishName);
    }
  }

  // 新增：清除交互状态
  clearInteractionState(fishName, isRanking) {
    if (isRanking && this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        fishItem.userInteraction = null;
      }
    } else if (!isRanking && this.selectedFishData) {
      this.selectedFishData.userInteraction = null;
    }

    // 同时更新全局用户交互缓存
    this.updateUserInteractionCache(fishName, null);

    // 同时更新所有排行榜缓存中的交互状态
    this.updateInteractionStateInAllRankings(fishName, null);
  }

  // 新增：统一回滚交互状态
  rollbackInteractionState(fishData, originalState, isRanking, fishName) {
    if (isRanking) {
      this.rollbackRankingState({ fishData }, originalState);
    } else {
      this.rollbackDetailState(originalState);
      if (!isRanking) {
        this.loadUserInteraction(fishName);
      }
    }
  }

  // 新增：获取最终的交互状态（优先本地缓存）
  getFinalInteractionState(fishName, userInteraction) {
    // 优先检查临时交互状态（正在进行的操作）
    const localState = this.getLocalInteractionState(fishName);
    if (localState) {
      return localState;
    }

    // 然后检查全局用户交互缓存
    if (this.userInteractionCache && this.userInteractionCache.has(fishName)) {
      return this.userInteractionCache.get(fishName);
    }

    // 最后使用传入的用户交互状态
    return userInteraction;
  }

  // 新增：一次性加载用户的所有交互记录
  async loadAllUserInteractions() {
    if (!this.userOpenid) {
      console.warn('用户openid未初始化，无法加载交互记录');
      return;
    }

    // 如果已经加载过，不再重复加载
    if (this.isUserInteractionCacheLoaded) {
      console.log('用户交互缓存已加载，跳过');
      return;
    }

    try {
      console.log('开始加载用户的所有交互记录...');
      this.userInteractionCache = await this.databaseManager.getAllUserInteractions(this.userOpenid);
      this.isUserInteractionCacheLoaded = true;
      console.log(`成功加载 ${this.userInteractionCache.size} 条用户交互记录`);
    } catch (error) {
      Utils.handleError(error, '加载用户所有交互记录失败');
      this.userInteractionCache = new Map();
      this.isUserInteractionCacheLoaded = false;
    }
  }

  // 新增：从本地缓存设置排行榜小鱼的交互状态和临时score
  setRankingFishesInteractionsFromCache(rankingFishes, sortType) {
    if (!sortType) {
      sortType = this.rankingSortType;
    }

    if (!this.userInteractionCache || this.userInteractionCache.size === 0) {
      // 如果缓存为空，为所有鱼设置默认状态
      rankingFishes.forEach(fishItem => {
        fishItem.userInteraction = { liked: false, disliked: false, action: null };
        // 初始化临时score为0
        // 不再需要初始化临时score，直接使用fishCardData.score
      });
      return;
    }

    rankingFishes.forEach(fishItem => {
      const fishName = fishItem.fishData.fishName;

      // 从全局缓存中获取交互状态
      if (this.userInteractionCache.has(fishName)) {
        fishItem.userInteraction = this.userInteractionCache.get(fishName);
      } else {
        // 如果缓存中没有，设置默认状态
        fishItem.userInteraction = { liked: false, disliked: false, action: null };
      }

      // 初始化临时score（如果还没有的话）
      // 不再需要初始化临时score，直接使用fishCardData.score
    });

    console.log(`为 ${rankingFishes.length} 条小鱼设置了交互状态和临时score`);
  }

  // 移除initTempScore方法，不再需要初始化临时score
  // 直接使用fishCardData中的score值

  // 新增：更新全局用户交互缓存
  updateUserInteractionCache(fishName, interaction) {
    if (!this.userInteractionCache) {
      this.userInteractionCache = new Map();
    }

    if (interaction) {
      // 更新缓存
      this.userInteractionCache.set(fishName, {
        action: interaction.action,
        liked: interaction.liked || false,
        disliked: interaction.disliked || false,
        timestamp: interaction.createTimestamp || interaction.timestamp || Date.now(),
        _id: interaction._id
      });
    } else {
      // 如果interaction为空，删除缓存记录
      this.userInteractionCache.delete(fishName);
    }
  }

  // 新增：更新所有排行榜缓存中的交互状态
  updateInteractionStateInAllRankings(fishName, interaction) {
    // 更新三个排行榜缓存中的交互状态
    ['best', 'worst', 'latest'].forEach(sortType => {
      const cache = this.rankingCache[sortType];
      if (cache.has(fishName)) {
        const fishCardData = cache.get(fishName);
        fishCardData.userInteraction = interaction;
        fishCardData.lastUpdateTime = Date.now();
        cache.set(fishName, fishCardData);
      }
    });
  }

  // 更新fishCardData中的score值
  updateFishScore(fishName, action, sortType, operation = 'increment') {
    if (!sortType) return;

    // 获取对应的缓存
    const cache = this.rankingCache[sortType];
    if (!cache || !cache.has(fishName)) return;

    // 获取fishCardData
    const fishCardData = cache.get(fishName);

    // 获取当前score
    const currentScore = fishCardData.score || 0;

    // 保存原始score（如果还没有保存）
    if (fishCardData.originalScore === undefined) {
      fishCardData.originalScore = currentScore;
    }

    // 根据操作更新score
    const change = operation === 'increment' ? 1 : -1;
    const newScore = action === 'star' ? currentScore + change : currentScore - change;

    // 直接更新score并标记为已修改
    fishCardData.score = newScore;
    fishCardData.scoreChanged = 1;

    // 更新缓存
    cache.set(fishName, fishCardData);

    // 同步更新排行榜UI中的fishData.score
    if (this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        fishItem.fishData.score = newScore;
      }
    }

    console.log(`更新fishCardData score: ${fishName} ${action === 'star' ? '点赞' : '点踩'} ${operation === 'increment' ? '+' : '-'}1, ${currentScore} → ${newScore}`);
  }

  // 新增：回滚临时score对象
  // 回滚fishCardData中的score值
  rollbackFishScore(fishName, action, sortType, operation = 'increment') {
    if (!sortType) return;

    // 获取对应的缓存
    const cache = this.rankingCache[sortType];
    if (!cache || !cache.has(fishName)) return;

    // 获取fishCardData
    const fishCardData = cache.get(fishName);

    // 获取当前score
    const currentScore = fishCardData.score || 0;

    // 根据操作回滚score
    const change = operation === 'increment' ? 1 : -1;
    const newScore = action === 'star' ? currentScore - change : currentScore + change;

    // 直接更新score
    fishCardData.score = newScore;

    // 更新缓存
    cache.set(fishName, fishCardData);

    // 同步更新排行榜UI中的fishData.score
    if (this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        fishItem.fishData.score = newScore;
      }
    }

    console.log(`回滚fishCardData score: ${fishName} ${action === 'star' ? '点赞' : '点踩'} ${operation === 'increment' ? '+' : '-'}1, ${currentScore} → ${newScore}`);
  }

  // 异步更新comment集合的score
  updateCommentScoreAsync(fishName, action, sortType, scoreChange = 1) {
    // 异步执行，不阻塞主流程
    setTimeout(async () => {
      try {
        console.log(`异步更新comment集合score: ${fishName}, ${action}, 变化量: ${scoreChange}`);

        // 调用云函数更新comment集合的score
        const result = await wx.cloud.callFunction({
          name: 'updateCommentScore',
          data: {
            fishName: fishName,
            action: action, // 'star' or 'unstar'
            openid: this.userOpenid,
            scoreChange: scoreChange // 传递正确的变化量
          }
        });

        if (result.result && result.result.success) {
          console.log(`云函数更新comment score成功: ${fishName}, 新score: ${result.result.newScore}`);

          // 更新成功后，重置scoreChanged标志
          const cache = this.rankingCache[sortType];
          if (cache && cache.has(fishName)) {
            const fishCardData = cache.get(fishName);
            fishCardData.scoreChanged = 0;
            cache.set(fishName, fishCardData);
          }
        } else {
          console.warn(`云函数更新comment score失败: ${result.result?.error || '未知错误'}`);
        }
      } catch (error) {
        console.error('异步更新comment score失败:', error);
      }
    }, 100); // 延迟100ms执行，确保UI更新完成
  }

  // 批量处理所有scoreChanged=1的鱼
  async batchUpdateChangedScores() {
    // 遍历所有排行榜类型
    for (const sortType of ['best', 'worst', 'latest']) {
      const cache = this.rankingCache[sortType];
      if (!cache) continue;

      // 找出所有scoreChanged=1的鱼
      const changedFishes = Array.from(cache.entries())
        .filter(([fishName, fishCardData]) => fishCardData.scoreChanged === 1);

      // 如果没有需要更新的鱼，跳过
      if (changedFishes.length === 0) continue;

      console.log(`开始批量更新${sortType}排行榜中的${changedFishes.length}条鱼的score`);

      // 逐条更新
      for (const [fishName, fishCardData] of changedFishes) {
        try {
          // 根据score变化确定action
          const originalScore = fishCardData.originalScore || 0;
          const action = fishCardData.score > originalScore ? 'star' : 'unstar';

          // 调用云函数更新
          const result = await wx.cloud.callFunction({
            name: 'updateCommentScore',
            data: {
              fishName: fishName,
              action: action,
              openid: this.userOpenid
            }
          });

          if (result.result && result.result.success) {
            // 更新成功，重置标志
            fishCardData.scoreChanged = 0;
            cache.set(fishName, fishCardData);
            console.log(`批量更新成功: ${fishName}, 新score: ${result.result.newScore}`);
          } else {
            console.warn(`批量更新失败: ${fishName}, 错误: ${result.result?.error || '未知错误'}`);
          }
        } catch (error) {
          console.error(`批量更新异常: ${fishName}`, error);
        }
      }
    }
  }

  // 新增：立即更新UI状态
  immediatelyUpdateUI() {
    if (this.isRankingInterfaceVisible || this.isFishDetailVisible) {
      this.uiManager.drawGameUI(this.gameState);
    }
  }

  bindEvents() {
    wx.onTouchStart((e) => this.handleTouchStart(e));
    wx.onTouchMove((e) => this.handleTouchMove(e));
    wx.onTouchEnd((e) => this.handleTouchEnd(e));
    wx.onTouchCancel((e) => this.handleTouchCancel(e));
  }

  // 修复：分别处理不同的触摸事件
  handleTouchStart(e) {
    if (!e.touches || e.touches.length === 0) return;

    // 支持多触点：传递所有触摸点信息
    const touches = e.touches;
    const x = touches[0].clientX;
    const y = touches[0].clientY;

    console.log('触摸开始:', x, y, '界面状态:', {
      ranking: this.isRankingInterfaceVisible,
      fishDetail: this.isFishDetailVisible,
      dialog: this.isDialogVisible,
      swim: this.isSwimInterfaceVisible,
      team: this.isTeamInterfaceVisible,
      collaborativePainting: this.isCollaborativePaintingVisible,
      otherFishTank: this.isOtherFishTankVisible
    });

    // 根据当前界面状态路由到对应的触摸处理器
    if (this.isRankingInterfaceVisible) {
      console.log('路由到排行榜处理器');
      this.touchHandlers.ranking.handleTouchStart(x, y);
      // ❌ 修复：移除错误的handleTouch调用，避免触摸事件冲突
      // 只在触摸结束时检测点击，而不是触摸开始时
    } else if (this.isFishDetailVisible) {
      this.touchHandlers.fishDetail.handleTouch(x, y);
    } else if (this.isDialogVisible) {
      this.touchHandlers.dialog.handleTouch(x, y);
    } else if (this.isSearchDialogVisible) {
      this.touchHandlers.searchDialog.handleTouch(x, y);
    } else if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouch(x, y);
    } else if (this.isTeamInterfaceVisible || this.isCollaborativePaintingVisible) {
      console.log('路由到组队处理器');
      this.touchHandlers.team.handleTeamTouch(x, y);
    } else if (this.isOtherFishTankVisible) {
      console.log('路由到游泳处理器处理串门界面');
      this.touchHandlers.swim.handleTouch(x, y);
    } else if (this.touchHandlers.main.paletteHandler && this.touchHandlers.main.paletteHandler.isVisible) {
      console.log('路由到调色板处理器');
      // 调色板界面优先处理触摸事件
      this.touchHandlers.main.paletteHandler.handlePaletteTouch(x, y);
    } else {
      // 主界面：传递所有触摸点信息以支持双指操作
      this.touchHandlers.main.handleTouchStart(x, y, touches);
    }
  }

  handleTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;

    // 支持多触点：传递所有触摸点信息
    const touches = e.touches;
    const x = touches[0].clientX;
    const y = touches[0].clientY;

    // 根据界面状态路由
    if (this.isRankingInterfaceVisible) {
      this.touchHandlers.ranking.handleTouchMove(x, y);
    } else if (this.isFishDetailVisible) {
      // 鱼详情界面不需要处理移动
    } else if (this.isDialogVisible) {
      // 对话框界面不需要处理移动
    } else if (this.isSwimInterfaceVisible) {
      // 游泳界面需要处理移动（用于选择器滑动）
      this.touchHandlers.swim.handleTouchMove(x, y);
    } else if (this.isTeamInterfaceVisible || this.isCollaborativePaintingVisible) {
      // 组队界面和共同绘画界面需要处理移动（传递给组队处理器）
      this.touchHandlers.team.handleTouchMove(x, y);
    } else {
      // 主界面：传递所有触摸点信息以支持双指操作
      this.touchHandlers.main.handleTouchMove(x, y, touches);
    }
  }

  handleTouchEnd(e) {
//    console.log('触摸结束');

    // 触摸结束事件 - 修复：处理排行榜按钮点击
    if (this.isRankingInterfaceVisible) {
      // 获取触摸结束位置
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const x = touch.clientX;
        const y = touch.clientY;

        // 只有在没有滚动的情况下才处理按钮点击
        if (!this.touchHandlers.ranking.isScrolling) {
          this.touchHandlers.ranking.handleTouch(x, y);
        }
      }

      this.touchHandlers.ranking.handleTouchEnd();
    } else if (this.isFishDetailVisible) {
      // 鱼详情界面不需要处理结束
    } else if (this.isDialogVisible) {
      // 对话框界面不需要处理结束
    } else if (this.isSwimInterfaceVisible || this.isOtherFishTankVisible) {
      // 游泳界面和串门界面 - 在触摸结束时也处理按钮点击
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const x = touch.clientX;
        const y = touch.clientY;
        this.touchHandlers.swim.handleTouch(x, y);
        this.touchHandlers.swim.handleTouchEnd(x, y);
      }
    } else if (this.isTeamInterfaceVisible || this.isCollaborativePaintingVisible) {
      // 组队界面和共同绘画界面需要处理结束（传递给组队处理器）
      this.touchHandlers.team.handleTouchEnd();
    } else {
      // 主界面
      this.touchHandlers.main.handleTouchEnd();
    }
  }

  handleTouchCancel(e) {
    const gameState = this.gameState;
    
    // 重置所有触摸状态
    if (this.touchHandlers.main) {
      this.touchHandlers.main.resetTouchState();
    }
    
    // 结束绘画
    gameState.isDrawing = false;
    
    // 原有排行榜处理逻辑
    if (this.isRankingInterfaceVisible) {
      if (e && e.changedTouches && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        this.touchHandlers.ranking.handleTouchEnd(touch.clientX, touch.clientY);
      } else {
        this.touchHandlers.ranking.handleTouchEnd();
      }
    }
  }

  // 修改：鱼缸功能 - 使用全局列表
  async handleFishTank() {
    await this.enterFishTank(); // 不传参数，只是进入鱼缸
  }

  // 修改：让它游起来处理
  async handleMakeItSwim() {
    // 优化：检查是否正在评分
    if (this.gameState.scoringState.isRequesting) {
      Utils.showError('AI评分中，请稍候');
      return;
    }

    if (this.gameState.score < 60) {
      Utils.showError('AI评分小于60，这鱼画的太抽象', 2000);
      return;
    }

    if (this.gameState.drawingPaths.length === 0) {
      Utils.showError('请先画一条鱼');
      return;
    }

    try {
      await this.fishManager.processor.processFishImage();
    } catch (error) {
      Utils.handleError(error, '处理鱼图像失败');
      Utils.showError('处理失败，请重试', 2000);
    }
  }

// 修改 enterFishTank 方法，支持所有鱼缸模式
async enterFishTank(newFishName = null, mode = 'public') {
  this.isSwimInterfaceVisible = true;
  this.swimInterfaceData = { mode: mode };
  this.currentTankMode = mode;

  if (!this.fishTank) {
    this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
  }

  // 清空当前鱼缸显示
  this.fishTank.fishes = [];
  this.addedUserFishNames.clear();

  if (mode === 'public') {
    // 公共鱼缸逻辑保持不变
    if (this.isFirstEnterTank) {
      await this.loadInitialFishes();
      this.isFirstEnterTank = false;
    }

    if (newFishName) {
      await this.ensureFishInList(newFishName);
    }

    await this.createFishesFromGlobalList();
  } else if (mode === 'best') {
    // 最佳鱼缸：加载评分最高的20条鱼
    await this.loadBestFishes();
    await this.createFishesFromBestList();
  } else if (mode === 'worst') {
    // 最丑鱼缸：加载评分最低的20条鱼
    await this.loadWorstFishes();
    await this.createFishesFromWorstList();
  } else if (mode === 'latest') {
    // 最新鱼缸：加载最新加入的20条鱼
    await this.loadLatestFishes();
    await this.createFishesFromLatestList();
  } else if (mode === 'my') {
    // 我的鱼缸逻辑：使用随机模式，让每次进入都看到不同的鱼
    await this.loadMyFishes(true); // true 表示随机模式
  }

  this.fishManager.animator.startAnimationLoop();

  // 修改这里：进入鱼缸时显示对应的加载说明
  let fishCount, message, tankName;

  switch (mode) {
    case 'public':
      fishCount = this.globalFishList.length;
      tankName = '赛博鱼缸';
      message = '随机20条鱼';
      break;
    case 'best':
      fishCount = this.bestFishesList ? this.bestFishesList.length : 0;
      tankName = '最佳鱼缸';
      message = 'top20评分最高';
      break;
    case 'worst':
      fishCount = this.worstFishesList ? this.worstFishesList.length : 0;
      tankName = '最丑鱼缸';
      message = 'top20评分最低';
      break;
    case 'latest':
      fishCount = this.latestFishesList ? this.latestFishesList.length : 0;
      tankName = '最新鱼缸';
      message = 'top20最新';
      break;
    case 'my':
      fishCount = this.myFishTankList.length;
      tankName = '我的鱼缸';
      message = '随机20条鱼';
      break;
    default:
      fishCount = 0;
      tankName = '未知鱼缸';
      message = '未知模式';
  }

  wx.showToast({
    title: message,
    icon: 'success',
    duration: 2000
  });

  console.log(`进入${tankName}，当前鱼数量:`, fishCount);
}

// 修改 loadMyFishes 方法，添加随机模式参数
async loadMyFishes(randomMode = false) {
  try {
    console.log('加载我的鱼数据...', randomMode ? '(随机模式)' : '(时间倒序模式)');

    if (!Utils.checkDatabaseInitialization(this.databaseManager, '加载我的鱼数据')) {
      this.myFishTankList = [];
      return;
    }

    // 使用缓存的openid
    if (!this.userOpenid) {
      Utils.handleWarning('', '用户openid未初始化，无法加载我的鱼数据');
      this.myFishTankList = [];
      Utils.showError('用户信息未准备好', 2000);
      return;
    }

    console.log('使用缓存的openid:', this.userOpenid);

    // 关键修复：彻底清空鱼缸和名称缓存
    if (this.fishTank) {
      this.fishTank.fishes = [];
    }
    this.addedUserFishNames.clear();
    console.log('已清空鱼缸显示和名称缓存');

    // 修改：根据模式选择查询方式
    if (randomMode) {
      // 随机模式：使用新的随机查询方法
      console.log('使用随机查询模式');
      this.myFishTankList = await this.databaseManager.getRandomFishesByUserOpenid(this.userOpenid, 20);
    } else {
      // 时间倒序模式：原有逻辑
      console.log('使用时间倒序查询模式');
      this.myFishTankList = await this.databaseManager.getFishesByUserOpenid(this.userOpenid, 20);
    }

    console.log('我的鱼数据加载完成，数量:', this.myFishTankList.length);

    if (this.myFishTankList.length === 0) {
      wx.showToast({
        title: '你还没有鱼，快去画一条吧！',
        icon: 'none',
        duration: 2000
      });
    } else {
      // 调试信息
      console.log('我的鱼列表详情:');
      this.myFishTankList.forEach((fish, index) => {
        console.log(`我的鱼 ${index + 1}: ${fish.fishName} (openid: ${fish._openid})`);
      });
    }

    // 从我的鱼列表创建鱼对象并显示
    await this.createFishesFromMyList();

    } catch (error) {
    Utils.handleError(error, '加载我的鱼数据失败');
    this.myFishTankList = [];
  }
}

// 新增：加载最佳鱼数据（评分最高的20条鱼）
async loadBestFishes() {
  try {
    console.log('加载最佳鱼数据...');

    if (!Utils.checkDatabaseInitialization(this.databaseManager, '加载最佳鱼数据')) {
      this.bestFishesList = [];
      return;
    }

    this.bestFishesList = await this.databaseManager.getBestFishesFromDatabase(20);
    console.log('最佳鱼数据加载完成，数量:', this.bestFishesList.length);
  } catch (error) {
    Utils.handleError(error, '加载最佳鱼数据失败');
    this.bestFishesList = [];
  }
}

// 新增：加载最丑鱼数据（评分最低的20条鱼）
async loadWorstFishes() {
  try {
    console.log('加载最丑鱼数据...');

    if (!Utils.checkDatabaseInitialization(this.databaseManager, '加载最丑鱼数据')) {
      this.worstFishesList = [];
      return;
    }

    this.worstFishesList = await this.databaseManager.getWorstFishesFromDatabase(20);
    console.log('最丑鱼数据加载完成，数量:', this.worstFishesList.length);
  } catch (error) {
    Utils.handleError(error, '加载最丑鱼数据失败');
    this.worstFishesList = [];
  }
}

// 新增：加载最新鱼数据（最新加入的20条鱼）
async loadLatestFishes() {
  try {
    console.log('加载最新鱼数据...');

    if (!Utils.checkDatabaseInitialization(this.databaseManager, '加载最新鱼数据')) {
      this.latestFishesList = [];
      return;
    }

    this.latestFishesList = await this.databaseManager.getLatestFishesFromDatabase(20);
    console.log('最新鱼数据加载完成，数量:', this.latestFishesList.length);
  } catch (error) {
    Utils.handleError(error, '加载最新鱼数据失败');
    this.latestFishesList = [];
  }
}

  // 新增：通用的鱼列表创建函数 - 合并重复代码
  async _createFishesFromList(fishList, listType = 'global') {
    if (fishList.length === 0) return;

    console.log(`从${listType === 'my' ? '我的' : '全局'}列表创建鱼对象，数量:`, fishList.length);

    const fishCreationPromises = fishList.map(fishData =>
      this.fishManager.data.createFishFromDatabaseData(fishData)
    );

    const createdFishes = await Promise.all(fishCreationPromises);
    const validFishes = createdFishes.filter(fish => fish !== null);

    // 添加到鱼缸显示
    validFishes.forEach(fish => {
      this.fishTank.addFish(fish);
      this.addedUserFishNames.add(fish.name);
    });

    console.log(`成功创建${listType === 'my' ? '我的' : ''}鱼对象:`, validFishes.length);
  }

  // 从我的鱼列表创建鱼对象
  async createFishesFromMyList() {
    await this._createFishesFromList(this.myFishTankList, 'my');
  }

  // 新增：从最佳鱼列表创建鱼对象
  async createFishesFromBestList() {
    await this._createFishesFromList(this.bestFishesList, 'best');
  }

  // 新增：从最丑鱼列表创建鱼对象
  async createFishesFromWorstList() {
    await this._createFishesFromList(this.worstFishesList, 'worst');
  }

  // 新增：从最新鱼列表创建鱼对象
  async createFishesFromLatestList() {
    await this._createFishesFromList(this.latestFishesList, 'latest');
  }

  // 新增：统一模式切换函数
  async switchMode(modeType, newMode) {
    if (modeType === 'tank') {
      this.currentTankMode = newMode;
      await this.enterFishTank(null, newMode);
    }
  }

  // 新增：切换鱼缸模式
  async switchTankMode() {
    const newMode = this.currentTankMode === 'public' ? 'my' : 'public';
    await this.switchMode('tank', newMode);
  }

  // 新增：切换到指定鱼缸模式
  async switchToTankMode(mode) {
    await this.switchMode('tank', mode);
  }



  // 新增：获取切换按钮文本
  getSwitchButtonText() {
    return this.currentTankMode === 'public' ? '切换到我的鱼缸' : '切换到赛博鱼缸';
  }

  // 新增：获取当前鱼缸鱼的数量
  getCurrentTankFishCount() {
    if (this.currentTankMode === 'public') {
      return this.globalFishList.length;
    } else {
      return this.myFishTankList.length;
    }
  }



  // 首次加载初始鱼数据
  async loadInitialFishes() {
    try {
      console.log('首次加载初始鱼数据...');
      this.globalFishList = await this.databaseManager.getRandomFishesFromDatabase(20);
      console.log('初始鱼数据加载完成，数量:', this.globalFishList.length);
    } catch (error) {
      Utils.handleError(error, '加载初始鱼数据失败');
      this.globalFishList = [];
    }
  }

  // 确保指定鱼在全局列表中
  async ensureFishInList(fishName) {
    // 检查是否已在列表中
    const existingFish = this.globalFishList.find(fish =>
      fish.fishName === fishName
    );

    if (!existingFish) {
      // 从数据库查询这条鱼并加入列表
      const fishData = await this.fishManager.data.getFishByName(fishName);
      if (fishData) {
        this.globalFishList.unshift(fishData); // 新鱼放在前面
        console.log('新鱼加入全局列表:', fishName);
      }
    }
  }

  // 从全局列表创建鱼对象
  async createFishesFromGlobalList() {
    await this._createFishesFromList(this.globalFishList, 'global');
  }

// 修改 refreshFishTank 方法
async refreshFishTank() {
  console.log('手动刷新鱼缸数据...');
  console.log('当前模式:', this.currentTankMode);

  wx.showLoading({ title: '刷新中...', mask: true });

  try {
    // 清空鱼缸和缓存
    this.fishTank.fishes = [];
    this.addedUserFishNames.clear();

    switch (this.currentTankMode) {
      case 'public':
        // 赛博鱼缸：真随机刷新
        console.log('刷新赛博鱼缸：随机获取20条鱼');
        this.globalFishList = await this.databaseManager.getRandomFishesFromDatabase(20);
        await this.createFishesFromGlobalList();
        break;

      case 'best':
        // 最佳鱼缸：重新加载评分最高的鱼
        console.log('刷新最佳鱼缸：重新加载评分最高的鱼');
        await this.loadBestFishes();
        await this.createFishesFromBestList();
        break;

      case 'worst':
        // 最丑鱼缸：重新加载评分最低的鱼
        console.log('刷新最丑鱼缸：重新加载评分最低的鱼');
        await this.loadWorstFishes();
        await this.createFishesFromWorstList();
        break;

      case 'latest':
        // 最新鱼缸：重新加载最新的鱼
        console.log('刷新最新鱼缸：重新加载最新的鱼');
        await this.loadLatestFishes();
        await this.createFishesFromLatestList();
        break;

      case 'my':
        // 我的鱼缸：随机刷新
        console.log('刷新我的鱼缸：随机获取20条鱼');
        await this.loadMyFishes(true); // true 表示随机模式
        break;

      default:
        console.warn('未知的鱼缸模式:', this.currentTankMode);
        break;
    }

    // 显示刷新结果
    let fishCount = 0;
    switch (this.currentTankMode) {
      case 'public': fishCount = this.globalFishList.length; break;
      case 'best': fishCount = this.bestFishesList ? this.bestFishesList.length : 0; break;
      case 'worst': fishCount = this.worstFishesList ? this.worstFishesList.length : 0; break;
      case 'latest': fishCount = this.latestFishesList ? this.latestFishesList.length : 0; break;
      case 'my': fishCount = this.myFishTankList.length; break;
    }

    wx.showToast({
      title: `刷新完成，${fishCount}条鱼`,
      icon: 'success',
      duration: 1500
    });

    } catch (error) {
      Utils.handleError(error, '刷新鱼缸失败');
      Utils.showError('刷新失败');
    } finally {
    wx.hideLoading();
  }
}

  hideSwimInterface() {
    this.isSwimInterfaceVisible = false;
    this.swimInterfaceData = null;
    this.currentTankMode = 'public'; // 重置为公共鱼缸模式
    this.fishManager.animator.stopAnimationLoop();
    this.uiManager.drawGameUI(this.gameState);
    console.log('鱼缸界面已隐藏');
  }

  // 排行榜功能
  async handleRanking() {
    await this.showRankingInterface();
  }

  // 组队功能
  handleTeam() {
    this.isTeamInterfaceVisible = true;
    this.uiManager.drawGameUI(this.gameState);
    console.log('组队界面已显示');
  }

  // 隐藏组队界面
  hideTeamInterface() {
    this.isTeamInterfaceVisible = false;
    this.uiManager.drawGameUI(this.gameState);
    console.log('组队界面已隐藏');
  }

  // 显示搜索对话框
  handleSearch() {
    this.isSearchDialogVisible = true;
    this.fishSearchInput = ''; // 清空搜索输入
    this.uiManager.drawGameUI(this.gameState);
    console.log('搜索对话框已显示');
  }

  // 隐藏搜索对话框
  hideSearchDialog() {
    this.isSearchDialogVisible = false;
    this.fishSearchInput = ''; // 清空搜索输入

    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();
    wx.hideKeyboard();

    this.uiManager.drawGameUI(this.gameState);
    console.log('搜索对话框已隐藏');
  }

  // 执行搜索功能
  async performSearch() {
    if (!this.fishSearchInput || this.fishSearchInput.trim() === '') {
      Utils.showError('请输入要搜索的小鱼名称');
      return;
    }

    const searchName = this.fishSearchInput.trim();
    console.log(`搜索小鱼: ${searchName}`);

    try {
      wx.showLoading({ title: '搜索中...', mask: true });

      // 查询数据库中是否有匹配的鱼
      const result = await this.databaseManager.searchFishByName(searchName);

      wx.hideLoading();

      if (result && result.length > 0) {
        // 找到匹配的鱼，显示第一个结果
        const fishData = result[0];
        console.log(`找到小鱼: ${fishData.fishName}`);

        // 隐藏搜索对话框
        this.hideSearchDialog();

        // 复用小鱼详情页逻辑，显示搜索结果
        this.showFishDetail(fishData);
      } else {
        Utils.showError(`未找到名为"${searchName}"的小鱼`);
      }
    } catch (error) {
      wx.hideLoading();
      Utils.handleError(error, '搜索小鱼失败');
      Utils.showError('搜索失败，请重试');
    }
  }

  // 显示小鱼详情（复用现有逻辑）
  showFishDetail(fishData) {
    // 加载鱼的图片
    this.loadFishImage(fishData).then(() => {
      this.selectedFishData = {
        fish: fishData,
        fishImage: fishData.image,
        fishData: fishData,
        userInteraction: null // 初始化用户交互状态
      };

      // 获取用户对这条鱼的交互记录
      this.getUserInteractionForFish(fishData.fishName).then(userInteraction => {
        // 更新用户交互状态
        this.selectedFishData.userInteraction = userInteraction;

        this.isFishDetailVisible = true;
        this.uiManager.drawGameUI(this.gameState);
        console.log('小鱼详情页已显示');
      }).catch(error => {
        // 即使获取交互记录失败，也显示详情页
        console.warn('获取用户交互记录失败:', error);
        this.isFishDetailVisible = true;
        this.uiManager.drawGameUI(this.gameState);
        console.log('小鱼详情页已显示（无交互记录）');
      });
    }).catch(error => {
      Utils.handleError(error, '加载小鱼图片失败');
      Utils.showError('加载小鱼图片失败');
    });
  }

  // 获取用户对鱼的交互记录
  async getUserInteractionForFish(fishName) {
    if (!this.userOpenid) {
      console.warn('用户openid未初始化，无法获取交互记录');
      return null;
    }

    try {
      const userInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
      return userInteraction;
    } catch (error) {
      console.error('获取用户交互记录失败:', error);
      return null;
    }
  }

  // 加载小鱼图片（复用现有逻辑）
  async loadFishImage(fishData) {
    return new Promise((resolve, reject) => {
      if (fishData.image) {
        // 如果图片已存在，直接返回
        resolve();
        return;
      }

      // 检查图片数据是否存在
      const imageData = fishData.base64 || fishData.base64Data || fishData.imageData || fishData.imageSrc;
      if (!imageData) {
        console.error('图片数据不存在:', fishData);
        console.log('可用的字段:', Object.keys(fishData));
        reject(new Error('图片数据不存在'));
        return;
      }

      // 创建图片对象
      const image = wx.createImage();
      image.onload = () => {
        fishData.image = image;
        resolve();
      };
      image.onerror = (error) => {
        console.error('图片加载失败:', error);
        console.log('尝试加载的图片数据类型:', typeof imageData);
        console.log('图片数据前50个字符:', imageData.substring(0, 50));
        reject(error);
      };
      // 确保图片数据格式正确
      if (typeof imageData === 'string' && imageData.trim() !== '') {
        // 如果是base64数据，确保有正确的前缀
        if (!imageData.startsWith('data:image/') && !imageData.startsWith('http')) {
          image.src = `data:image/png;base64,${imageData}`;
        } else {
          image.src = imageData;
        }
      } else {
        console.error('无效的图片数据格式:', imageData);
        reject(new Error('无效的图片数据格式'));
        return;
      }
    });
  }

  // 在eventHandler.js的showRankingInterface方法中确保正确调用：
  async showRankingInterface() {
    this.isRankingInterfaceVisible = true;
    this.isLoadingRanking = true;

    // 重置滚动位置
    this.touchHandlers.ranking.resetScroll();

    // 重置增量加载状态
    if (this.rankingIncrementalData && this.rankingIncrementalData.cyber) {
      this.rankingIncrementalData.cyber.isLoading = false;
      this.rankingIncrementalData.cyber.hasMore = true;
      this.rankingIncrementalData.cyber.currentPage = 0;
      this.rankingIncrementalData.cyber.cachedData = []; // 清空缓存数据
    }

    this.uiManager.drawGameUI(this.gameState);

    try {
      console.log('加载排行榜初始数据...');

      // 一次性加载用户的所有交互记录（新逻辑）
      await this.loadAllUserInteractions();

      // 使用支持缓存的方法加载第一页数据
      const result = await this.databaseManager.getRankingDataPageWithCache(
        0,
        this.rankingIncrementalData.cyber.pageSize,
        this.rankingSortType,
        this.rankingCache,
        this.rankingPages,
        this.userInteractionCache
      );

      // 更新增量加载状态
      this.rankingIncrementalData.cyber.hasMore = result.hasMore;

      // 更新缓存的分页信息
      this.rankingPages[this.rankingSortType].currentPage = 0;
      this.rankingPages[this.rankingSortType].hasMore = result.hasMore;

      // 为每条鱼创建图像对象
      const rankingFishesWithImages = [];
      for (const fishCardData of result.data) {
        try {
          // 如果还没有图像对象，创建一个
          if (!fishCardData.fishImage) {
            fishCardData.fishImage = await this.fishManager.data.base64ToCanvas(fishCardData.base64);
            fishCardData.imageLoadStatus = 'loaded';
          }

          rankingFishesWithImages.push({
            fishData: {
              _id: fishCardData._id, // 添加_id字段
              fishName: fishCardData.fishName,
              base64: fishCardData.base64,
              createdAt: fishCardData.createdAt,
              createTimestamp: fishCardData.createTimestamp,
              score: fishCardData.score
            },
            fishImage: fishCardData.fishImage,
            // 添加用户交互状态
            userInteraction: fishCardData.userInteraction
          });
        } catch (error) {
          console.warn('创建排行榜鱼图像失败:', error);
          fishCardData.imageLoadStatus = 'failed';
        }
      }

      // 存入增量加载的缓存数据（保持兼容性）
      this.rankingIncrementalData.cyber.cachedData = result.data.map(item => ({
        fishName: item.fishName,
        base64: item.base64,
        createdAt: item.createdAt,
        createTimestamp: item.createTimestamp,
        score: item.score
      }));

      this.rankingData = {
        fishes: rankingFishesWithImages,
        lastUpdate: new Date(),
        mode: 'cyber'
      };

      console.log(`排行榜初始数据加载完成，模式: cyber, 共 ${rankingFishesWithImages.length} 条数据`);

    } catch (error) {
      Utils.handleError(error, '加载排行榜数据失败');
      this.rankingData = { fishes: [], lastUpdate: new Date(), mode: 'cyber' };
    } finally {
      this.isLoadingRanking = false;
      this.uiManager.drawGameUI(this.gameState);
    }
  }

  // 删除评分重新计算逻辑，统一使用comment集合的score值

  // 新增：从comment集合加载单条鱼的评分数据（详情页使用）
  async loadFishScoreFromComment(fishData) {
    if (!fishData || !fishData.fishName) {
      return;
    }

    console.log(`从comment集合加载鱼 ${fishData.fishName} 的评分数据...`);

    try {
      // 从comment集合获取评分数据（与排行榜逻辑对齐）
      const scoreData = await this.databaseManager.getFishScoreFromComment(fishData.fishName);
      const { score, starCount, unstarCount } = scoreData;

      // 直接更新fishCardData.score
      fishData.score = score;
      fishData.starCount = starCount;
      fishData.unstarCount = unstarCount;

      console.log(`鱼 ${fishData.fishName} 评分加载完成: ${score} (star: ${starCount}, unstar: ${unstarCount})`);
    } catch (error) {
      Utils.handleError(error, `从comment集合加载鱼 ${fishData.fishName} 的评分失败`);
    }
  }



  // 修改：为排行榜鱼数据加载用户交互状态 - 现在使用本地缓存
  async loadRankingFishesUserInteractions(rankingFishes) {
    if (!rankingFishes || rankingFishes.length === 0) {
      return;
    }

    console.log('开始从本地缓存加载排行榜鱼的用户交互状态...');

    // 确保用户交互缓存已加载
    if (!this.isUserInteractionCacheLoaded) {
      console.log('用户交互缓存未加载，先加载所有交互记录');
      await this.loadAllUserInteractions();
    }

      // 从本地缓存设置交互状态和临时score
    this.setRankingFishesInteractionsFromCache(rankingFishes, this.rankingSortType);
  }

  // 新增：加载下一页排行榜数据
  async loadNextRankingPage() {
    // 安全检查
    if (!this.rankingIncrementalData || !this.rankingIncrementalData.cyber) {
      console.error('增量数据未初始化，无法加载更多数据');
      return;
    }

    const incrementalData = this.rankingIncrementalData.cyber;

    if (incrementalData.isLoading || !incrementalData.hasMore) {
      console.log('正在加载或没有更多数据，跳过增量加载');
      return;
    }

    console.log(`开始加载更多排行榜数据，当前页: ${incrementalData.currentPage + 1}, 总数据量: ${incrementalData.cachedData.length}`);

    incrementalData.isLoading = true;
    incrementalData.currentPage++;

    try {
      let nextPageResult;

      // 检查是否在从缓存加载模式
      if (this.loadFromCacheMode && incrementalData.cachedFishNames) {
        // 从缓存加载下一页数据
        const startIndex = incrementalData.currentPage * incrementalData.pageSize;
        const endIndex = Math.min(startIndex + incrementalData.pageSize, incrementalData.cachedFishNames.length);
        const nextCachedFishNames = incrementalData.cachedFishNames.slice(startIndex, endIndex);

        console.log(`从缓存加载数据，索引范围: ${startIndex}-${endIndex}, 条数: ${nextCachedFishNames.length}`);

        // 创建缓存结果对象
        const cachedData = [];
        for (const fishName of nextCachedFishNames) {
          const fishCardData = this.rankingCache[this.rankingSortType].get(fishName);
          if (fishCardData) {
            cachedData.push(fishCardData);
          }
        }

        nextPageResult = {
          data: cachedData,
          hasMore: endIndex < incrementalData.cachedFishNames.length,
          fromCache: true
        };

        // 如果缓存已用完，切换回数据库加载模式
        if (!nextPageResult.hasMore) {
          this.loadFromCacheMode = false;
          console.log('缓存数据已全部加载，切换回数据库加载模式');
        }
      } else {
        // 从数据库加载下一页数据
        nextPageResult = await this.databaseManager.getRankingDataPageWithCache(
          incrementalData.currentPage,
          incrementalData.pageSize,
          this.rankingSortType,
          this.rankingCache,
          this.rankingPages,
          this.userInteractionCache
        );
      }

      // 更新是否有更多数据的标志
      incrementalData.hasMore = nextPageResult.hasMore;

      // 更新分页信息
      this.rankingPages[this.rankingSortType].currentPage = incrementalData.currentPage;
      this.rankingPages[this.rankingSortType].hasMore = nextPageResult.hasMore;

      if (nextPageResult.data.length === 0) {
        console.log('没有更多数据可以加载');
        incrementalData.hasMore = false;
        return;
      }

      // 将新数据添加到缓存（保持兼容性）
      incrementalData.cachedData = [...incrementalData.cachedData, ...nextPageResult.data];

      // 为新加载的鱼数据创建图像
      const newFishes = [];

      for (const fishCardData of nextPageResult.data) {
        try {
          // 如果还没有图像对象，创建一个
          if (!fishCardData.fishImage) {
            fishCardData.fishImage = await this.fishManager.data.base64ToCanvas(fishCardData.base64);
            fishCardData.imageLoadStatus = 'loaded';
          }

          const fishItem = {
            fishData: {
              _id: fishCardData._id, // 添加_id字段
              fishName: fishCardData.fishName,
              base64: fishCardData.base64,
              createdAt: fishCardData.createdAt,
              createTimestamp: fishCardData.createTimestamp,
              score: fishCardData.score
            },
            fishImage: fishCardData.fishImage,
            // 添加用户交互状态
            userInteraction: fishCardData.userInteraction
          };

          newFishes.push(fishItem);
        } catch (error) {
          console.warn('创建排行榜鱼图像失败:', error);
          fishCardData.imageLoadStatus = 'failed';
        }
      }

      // 将新加载的鱼添加到现有数据中
      if (!this.rankingData) {
        this.rankingData = { fishes: [], lastUpdate: new Date(), mode: 'cyber' };
      }
      this.rankingData.fishes = this.rankingData.fishes.concat(newFishes);

      console.log(`成功加载 ${newFishes.length} 条新的排行榜数据，当前总数: ${this.rankingData.fishes.length}`);
      console.log(`增量加载状态: hasMore=${incrementalData.hasMore}, currentPage=${incrementalData.currentPage}`);

      // 为新加载的小鱼设置临时score
      this.setRankingFishesInteractionsFromCache(newFishes, this.rankingSortType);

      // 重新计算最大滚动距离
      this.touchHandlers.ranking.calculateMaxScroll();

      // 更新UI
      this.uiManager.drawGameUI(this.gameState);

    } catch (error) {
      Utils.handleError(error, '加载更多排行榜数据失败');
    } finally {
      incrementalData.isLoading = false;
    }
  }

  // 修改：统一处理排行榜交互操作
  async handleRankingInteraction(fishItem, action) {
    if (!this.canPerformInteraction()) {
      console.log('操作过于频繁，跳过操作');
      return;
    }

    this.startInteraction();

    try {
      const fishData = fishItem.fishData;
      if (!fishData._id) {
        console.warn('鱼数据没有ID，无法更新');
        return;
      }

      const userInteraction = fishItem.userInteraction;
      const currentAction = userInteraction ? userInteraction.action : null;

      // 保存原始状态用于回滚 - 兼容新旧数据结构
      const originalState = {
        userInteraction: userInteraction ? {...userInteraction} : null
      };

      // 保存原始状态
      originalState.originalStarCount = fishData.starCount || 0;
      originalState.originalUnstarCount = fishData.unstarCount || 0;
      originalState.originalScore = fishData.score || 0;

      // 统一处理逻辑
      if (currentAction === action) {
        // 取消操作
        await this.cancelRankingInteraction(fishItem, userInteraction, originalState);
      } else if (currentAction && currentAction !== action) {
        // 如果当前是相反操作状态，直接切换操作（先删除原记录，再插入新记录）
        await this.switchInteractionAction(fishData, currentAction, action, originalState, true);
        return;
      } else {
        // 执行操作
        await this.performRankingInteraction(fishItem, action, originalState);
      }

    } catch (error) {
      Utils.handleError(error, `排行榜${action === 'star' ? '点赞' : '点踩'}操作失败`);
      Utils.showError('操作失败，请重试');
    } finally {
      this.endInteraction();
    }
  }

  // 修改：处理排行榜点赞操作 - 使用缓存的openid
  async handleRankingLikeAction(fishItem) {
    await this.handleRankingInteraction(fishItem, 'star');
  }

  // 修改：处理排行榜点踩操作 - 使用缓存的openid
  async handleRankingDislikeAction(fishItem) {
    await this.handleRankingInteraction(fishItem, 'unstar');
  }

  // 修改：执行排行榜交互操作
  async performRankingInteraction(fishItem, action, originalState) {
    await this.performInteractionAction(fishItem.fishData, action, originalState, true);
  }

  // 修改：取消排行榜交互操作
  async cancelRankingInteraction(fishItem, userInteraction, originalState) {
    await this.cancelInteractionAction(fishItem.fishData, userInteraction, originalState, true);
    // 在排行榜情况下，需要清除userInteraction
    fishItem.userInteraction = null;
  }

  // 修改：执行排行榜点赞操作 - 使用缓存的openid
  async performRankingLikeAction(fishItem, originalState) {
    await this.performRankingInteraction(fishItem, 'star', originalState);
  }

  // 修改：执行排行榜点踩操作 - 使用缓存的openid
  async performRankingDislikeAction(fishItem, originalState) {
    await this.performRankingInteraction(fishItem, 'unstar', originalState);
  }

  // 修改：取消排行榜点赞操作 - 使用缓存的openid
  async cancelRankingLikeAction(fishItem, userInteraction, originalState) {
    await this.cancelRankingInteraction(fishItem, userInteraction, originalState);
  }

  // 修改：取消排行榜点踩操作 - 使用缓存的openid
  async cancelRankingDislikeAction(fishItem, userInteraction, originalState) {
    await this.cancelRankingInteraction(fishItem, userInteraction, originalState);
  }

  // 新增：回滚排行榜状态
  rollbackRankingState(fishItem, originalState) {
    const fishData = fishItem.fishData;

    // 统一使用临时字段
    fishData.starCount = originalState.originalStarCount || 0;
    fishData.unstarCount = originalState.originalUnstarCount || 0;
    fishData.score = originalState.originalScore || 0;

    fishItem.userInteraction = originalState.userInteraction;

    // 立即更新UI
    this.immediatelyUpdateUI();
  }

  // 修改：为单个排行榜鱼加载用户交互状态 - 使用缓存的openid
  async loadUserInteractionForRankingFish(fishItem) {
    try {
      if (!this.userOpenid) {
        return;
      }

      const interaction = await this.databaseManager.getUserInteraction(fishItem.fishData.fishName, this.userOpenid);
      fishItem.userInteraction = interaction;
    } catch (error) {
      Utils.handleError(error, '加载排行榜鱼用户交互状态失败');
      fishItem.userInteraction = null;
    }
  }

  hideRankingInterface() {
    this.isRankingInterfaceVisible = false;
    this.rankingData = null;
    // 清除所有排行榜相关的本地缓存
    this.localInteractionCache.clear();

    // 清除临时score对象
    // 不再需要清理tempScores

    // 注意：不清除全局用户交互缓存，保留供下次使用
    // this.userInteractionCache.clear();
    // 重置滚动位置
    this.touchHandlers.ranking.resetScroll();
    this.uiManager.drawGameUI(this.gameState);
    console.log('排行榜界面已隐藏');
  }

  // 设置排行榜排序类型
  setRankingSortType(sortType) {
    if (!this.rankingSortTypes[sortType]) {
      console.warn('无效的排序类型:', sortType);
      return;
    }

    if (this.rankingSortType === sortType) {
      console.log('排序类型未改变:', sortType);
      return;
    }

    const oldSortType = this.rankingSortType;
    this.rankingSortType = sortType;
    console.log('排行榜排序类型已设置为:', sortType);

    // 清除旧榜单的临时score，避免数据混乱
    // 不再需要清理tempScores

    // 重新加载排行榜数据
    if (this.isRankingInterfaceVisible) {
      this.loadRankingWithCache(oldSortType, sortType);
    }
  }

  // 新增：利用缓存加载排行榜数据
  async loadRankingWithCache(oldSortType, newSortType) {
    wx.showLoading({ title: '切换榜单...', mask: true });

    try {
      // 检查新榜单的缓存情况
      const newCache = this.rankingCache[newSortType];
      const newPageInfo = this.rankingPages[newSortType];

      let rankingFishesWithImages = [];

      if (newCache.size > 0) {
        // 从缓存获取数据
        console.log(`从${newSortType}榜缓存获取数据，缓存大小: ${newCache.size}`);

        // 获取所有缓存数据的fishName，按顺序排列
        const cachedFishNames = Array.from(newCache.keys());
        const pageSize = this.rankingIncrementalData.cyber.pageSize;

        // 初始只加载第一页数据，与初次加载逻辑保持一致
        const initialFishNames = cachedFishNames.slice(0, pageSize);
        console.log(`准备初始加载第一页 ${initialFishNames.length} 条缓存数据`);

        // 创建初始显示数据
        for (const fishName of initialFishNames) {
          const fishCardData = newCache.get(fishName);
          if (fishCardData) {
            // 创建图像对象（如果还没有）
            if (!fishCardData.fishImage) {
              try {
                fishCardData.fishImage = await this.fishManager.data.base64ToCanvas(fishCardData.base64);
                fishCardData.imageLoadStatus = 'loaded';
              } catch (error) {
                console.warn('创建排行榜鱼图像失败:', error);
                fishCardData.imageLoadStatus = 'failed';
              }
            }

            rankingFishesWithImages.push({
              fishData: {
                fishName: fishCardData.fishName,
                base64: fishCardData.base64,
                createdAt: fishCardData.createdAt,
                createTimestamp: fishCardData.createTimestamp,
                score: fishCardData.score
              },
              fishImage: fishCardData.fishImage,
              userInteraction: fishCardData.userInteraction
            });
          }
        }

        // 更新排行榜数据 - 初始只包含第一页数据
        this.rankingData = {
          fishes: rankingFishesWithImages,
          lastUpdate: new Date(),
          mode: newSortType
        };

        // 重置增量加载状态，以便正确处理缓存数据的后续加载
        this.rankingIncrementalData.cyber.currentPage = 0;
        this.rankingIncrementalData.cyber.hasMore = cachedFishNames.length > pageSize;

        // 创建一个特殊的缓存数据结构，用于处理从缓存中加载更多数据
        this.rankingIncrementalData.cyber.cachedFishNames = cachedFishNames;
        this.rankingIncrementalData.cyber.cachedData = rankingFishesWithImages.map(item => ({
          fishName: item.fishData.fishName,
          base64: item.fishData.base64,
          createdAt: item.fishData.createdAt,
          createTimestamp: item.fishData.createTimestamp,
          score: item.fishData.score
        }));

        // 如果缓存中的数据多于第一页，修改loadNextRankingPage方法以支持从缓存加载
        if (cachedFishNames.length > pageSize) {
          this.loadFromCacheMode = true;
          console.log(`缓存中有更多数据 (${cachedFishNames.length - pageSize} 条)，启用从缓存加载模式`);
        }

        console.log(`已加载第一页 ${rankingFishesWithImages.length} 条缓存数据，总缓存: ${cachedFishNames.length}, 是否有更多: ${this.rankingIncrementalData.cyber.hasMore}`);

        // 清除新榜单的临时score，重新初始化
        // 不再需要初始化tempScores
        this.setRankingFishesInteractionsFromCache(rankingFishesWithImages, newSortType);

      } else {
        // 缓存为空，重新从数据库加载
        console.log(`${newSortType}榜缓存为空，从数据库加载`);
        this.rankingData = null;
        await this.showRankingInterface();
      }

      // 重置滚动位置
      this.touchHandlers.ranking.resetScroll();

      // 更新UI
      this.uiManager.drawGameUI(this.gameState);

    } catch (error) {
      Utils.handleError(error, '切换榜单失败');
    } finally {
      wx.hideLoading();
    }
  }

  // 获取排行榜数据（带图片）- 根据排序类型获取数据
  async getRankingDataWithImages() {
    const rankingData = await this.databaseManager.getRankingData(100, this.rankingSortType);
    const rankingFishes = [];

    for (const fishData of rankingData) {
      try {
        const fishImage = await this.fishManager.data.base64ToCanvas(fishData.base64);
        rankingFishes.push({
          fishData: fishData,
          fishImage: fishImage
        });
      } catch (error) {
        console.warn('创建排行榜鱼图像失败:', error);
      }
    }

    // 根据排序类型显示不同的日志信息
    let sortTypeText = '';
    switch (this.rankingSortType) {
      case 'best':
        sortTypeText = '点赞最多（最佳榜）';
        break;
      case 'worst':
        sortTypeText = '评分最低（最丑榜）';
        break;
      case 'latest':
      default:
        sortTypeText = '创作时间最新（最新榜）';
        break;
    }

    console.log(`成功创建 ${rankingFishes.length} 条排行榜鱼的图像，排序类型: ${sortTypeText}`);
    return rankingFishes;
  }





  // 对话框功能
  showNameInputDialog(scaledImage) {
    this.isDialogVisible = true;
    this.dialogData = { scaledImage: scaledImage };
    this.fishNameInput = `小鱼${Math.floor(Math.random() * 1000)}`;
    this.uiManager.drawGameUI(this.gameState);
    this.showKeyboardInput();
  }

  showKeyboardInput() {
    wx.showKeyboard({
      defaultValue: this.fishNameInput,
      maxLength: 20,
      multiple: false,
      confirmHold: false,
      confirmType: 'done',
      success: () => console.log('键盘显示成功'),
      fail: (err) => {
        Utils.handleError(err, '键盘显示失败');
        this.confirmFishName();
      }
    });

    wx.onKeyboardInput((res) => {
      this.fishNameInput = res.value;
      this.uiManager.drawGameUI(this.gameState);
    });

    wx.onKeyboardConfirm((res) => {
      this.fishNameInput = res.value;
      this.confirmFishName();  // 只在这里调用确认方法
    });

    // 修复：删除 onKeyboardComplete 中的重复调用
    wx.onKeyboardComplete(() => {
      // 只隐藏键盘，不重复调用 confirmFishName
      console.log('键盘输入完成，隐藏对话框');
      this.hideNameInputDialog();
    });
  }

  hideNameInputDialog() {
    this.isDialogVisible = false;
    this.dialogData = null;
    this.fishNameInput = '';

    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();
    wx.hideKeyboard();

    this.uiManager.drawGameUI(this.gameState);
  }

  // 显示搜索键盘输入
  showSearchKeyboardInput() {
    // 先取消旧的键盘监听器，避免重复绑定
    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();

    wx.showKeyboard({
      defaultValue: this.fishSearchInput,
      maxLength: 20,
      multiple: false,
      confirmHold: false,
      confirmType: 'search',
      success: () => console.log('搜索键盘显示成功'),
      fail: (err) => {
        Utils.handleError(err, '搜索键盘显示失败');
        this.performSearch();
      }
    });

    wx.onKeyboardInput((res) => {
      this.fishSearchInput = res.value;
      this.uiManager.drawGameUI(this.gameState);
    });

    wx.onKeyboardConfirm((res) => {
      this.fishSearchInput = res.value;
      this.performSearch();  // 在这里调用搜索方法
    });

    wx.onKeyboardComplete(() => {
      console.log('搜索键盘输入完成');
      this.hideSearchDialog();
    });
  }

  // 检查鱼名是否重复
  async checkFishNameExists(fishName) {
    if (!this.databaseManager.isCloudDbInitialized || !this.databaseManager.cloudDb) {
      console.warn('云数据库未初始化，跳过名称检查');
      return false;
    }

    try {
      const result = await this.databaseManager.cloudDb.collection('fishes')
        .where({
          fishName: fishName
        })
        .get();

      return result.data.length > 0;
    } catch (error) {
      console.error('检查鱼名失败:', error);
      return false;
    }
  }

  async confirmFishName() {
    if (!this.dialogData || !this.dialogData.scaledImage) {
      if (!this.gameState.scaledFishImage) {
        Utils.showError('处理失败，请重试', 2000);
        this.hideNameInputDialog();
        return;
      }
    }

    const scaledImage = this.dialogData ? this.dialogData.scaledImage : this.gameState.scaledFishImage;

    if (!this.fishNameInput || !this.fishNameInput.trim()) {
      Utils.showError('请输入鱼的名字');
      return;
    }

    const finalName = this.fishNameInput.trim();

    // 检查名称是否已存在
    wx.showLoading({ title: '检查名称...', mask: true });

    try {
      const nameExists = await this.checkFishNameExists(finalName);
      wx.hideLoading();

      if (nameExists) {
        Utils.showError(`名称"${finalName}"已存在，请换一个`, 2000);
        return; // 名称重复，不继续后续逻辑
      }
    } catch (error) {
      wx.hideLoading();
      Utils.handleWarning(error, '名称检查失败，继续保存流程');
      // 检查失败时继续流程，不阻止用户
    }

    // 新增：文本内容安全校验
    wx.showLoading({ title: '安全检查中...', mask: true });

    try {
      const safetyResult = await this.checkFishNameSafety(finalName);
      wx.hideLoading();

      if (!safetyResult.isSafe) {
        Utils.showError(`名称"${finalName}"包含不合规内容，请换一个`, 2000);
        return; // 内容不合规，不继续后续逻辑
      }
      console.log('文本安全校验通过:', finalName);
    } catch (error) {
      wx.hideLoading();
      Utils.handleWarning(error, '文本安全校验失败，继续保存流程');
      // 校验失败时继续流程，不阻止用户
    }

    // 名称可用且安全，继续保存流程
    this.hideNameInputDialog();
    wx.showLoading({ title: '保存中...', mask: true });

    try {
      const base64Data = await this.fishManager.data.canvasToBase64(scaledImage.canvas);
      const fishData = {
        createdAt: new Date(),
        fishName: finalName,
        base64: base64Data,
        createTimestamp: Date.now(),
      };

      const insertSuccess = await this.databaseManager.insertFishToDatabase(fishData, true);
      wx.hideLoading();

      if (insertSuccess) {
        Utils.showSuccess(`${finalName} 加入鱼缸！`);

        // 修改：进入鱼缸并确保新鱼显示
        await this.enterFishTank(finalName);
      } else {
        wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
        // 本地模式下还是使用原有逻辑
        // 注意：Fish类内部会处理缩放，所以这里使用原始图像
        const { Fish } = require('./fishCore.js');
        const fish = new Fish(
          scaledImage.canvas,
          Math.random() * (config.screenWidth - 80), // 使用缩放后的宽度（80像素）
          Math.random() * (config.screenHeight - 100), // 预估高度，Fish类内部会处理
          Math.random() < 0.5 ? -1 : 1,
          finalName
        );
        this.fishTank.addFish(fish);
        this.addedUserFishNames.add(finalName);
        await this.enterFishTank();
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
      // 错误处理同上
      const { Fish } = require('./fishCore.js');
      const fish = new Fish(
        scaledImage.canvas,
        Math.random() * (config.screenWidth - 80), // 使用缩放后的宽度（80像素）
        Math.random() * (config.screenHeight - 100), // 预估高度，Fish类内部会处理
        Math.random() < 0.5 ? -1 : 1,
        finalName
      );
      this.fishTank.addFish(fish);
      this.addedUserFishNames.add(finalName);
      await this.enterFishTank();
    }
  }

  // 根据名称查找鱼缸中是否已存在同名鱼
  findFishByName(fishName) {
    if (!this.fishTank || !this.fishTank.fishes || this.fishTank.fishes.length === 0) {
      return null;
    }

    return this.fishTank.fishes.find(fish =>
      fish.name === fishName
    );
  }

  // 检查鱼缸中是否已存在鱼的通用方法
  isFishAlreadyInTank(fishName, fishImage = null) {
    // 首先检查名称
    if (this.findFishByName(fishName)) {
      return true;
    }

    // 如果有图像数据，可以进一步检查图像相似性（可选）
    if (fishImage) {
      // 这里可以添加图像相似性检查逻辑
      // 暂时只做名称检查
    }

    return false;
  }

  // 在进入鱼缸界面时校验所有鱼的名称，移除重复的鱼
  validateFishNamesInTank() {
    if (!this.fishTank || !this.fishTank.fishes || this.fishTank.fishes.length === 0) {
      return;
    }

    const uniqueNames = new Set();
    const fishesToRemove = [];

    // 找出重复名称的鱼
    for (const fish of this.fishTank.fishes) {
      if (uniqueNames.has(fish.name)) {
        fishesToRemove.push(fish);
        console.log(`检测到重复名称的鱼: ${fish.name}，将被移除`);
      } else {
        uniqueNames.add(fish.name);
      }
    }

    // 移除重复的鱼
    if (fishesToRemove.length > 0) {
      this.fishTank.fishes = this.fishTank.fishes.filter(fish =>
        !fishesToRemove.includes(fish)
      );
      console.log(`已移除 ${fishesToRemove.length} 条重复名称的鱼`);
    }
  }

  // 鱼详情功能 - 修改：增加用户交互状态检查
  async showFishDetailFromTank(fish) {
    this.isFishDetailVisible = true;
    this.selectedFishData = {
      fish: fish,
      fishData: fish.fishData,
      userInteraction: null // 新增：用户交互状态
    };

    // 清除该鱼的本地缓存状态，确保显示最新状态
    if (fish.fishData && fish.fishData.fishName) {
      this.clearLocalInteractionState(fish.fishData.fishName);
    }

    // 修改：从comment集合获取鱼的评分数据（与排行榜逻辑对齐）
    await this.loadFishScoreFromComment(fish.fishData);

    // 新增：加载用户交互状态
    await this.loadUserInteraction(fish.fishData.fishName);

    this.uiManager.drawGameUI(this.gameState);
  }

  // 修改：加载用户交互状态 - 使用缓存的openid
  async loadUserInteraction(fishName) {
    try {
      if (!this.userOpenid) {
        console.warn('用户openid未初始化，无法加载交互状态');
        return;
      }

      const interaction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
      if (interaction) {
        // 兼容处理数据库返回的交互记录
        if (interaction.action) {
          // 如果有action字段，基于它设置liked/disliked
          interaction.liked = interaction.action === 'star';
          interaction.disliked = interaction.action === 'unstar';
        }

        this.selectedFishData.userInteraction = interaction;
        console.log(`用户对鱼 ${fishName} 的交互状态:`, interaction.action);
      } else {
        // 确保在未找到交互记录时清除用户交互状态
        this.selectedFishData.userInteraction = null;
      }
    } catch (error) {
      Utils.handleError(error, '加载用户交互状态失败');
      // 出错时也要清除用户交互状态
      this.selectedFishData.userInteraction = null;
    }
  }

  hideFishDetail() {
    this.isFishDetailVisible = false;

    // 清除相关鱼的本地缓存状态
    if (this.selectedFishData && this.selectedFishData.fishData) {
      this.clearLocalInteractionState(this.selectedFishData.fishData.fishName);
    }

    this.selectedFishData = null;
    this.uiManager.drawGameUI(this.gameState);
  }

  // 新增：通用的交互操作处理函数
  async _handleInteraction(actionType) {
    if (!this.canPerformInteraction()) {
      console.log(`操作过于频繁，跳过${actionType === 'star' ? '点赞' : '点踩'}操作`);
      return;
    }

    this.startInteraction();

    try {
      if (!this.selectedFishData) return;

      const fishData = this.selectedFishData.fishData;
      if (!fishData._id) {
        console.warn('鱼数据没有ID，无法更新');
        return;
      }

      const userInteraction = this.selectedFishData.userInteraction;
      const currentAction = userInteraction ? userInteraction.action : null;

      // 保存原始状态用于回滚 - 兼容新旧数据结构
      const originalState = {
        userInteraction: userInteraction ? {...userInteraction} : null
      };

      // 保存原始状态
      originalState.originalStarCount = fishData.starCount || 0;
      originalState.originalUnstarCount = fishData.unstarCount || 0;
      originalState.originalScore = fishData.score || 0;

      const oppositeAction = actionType === 'star' ? 'unstar' : 'star';

      // 如果当前已经是相同操作状态，则取消操作
      if (currentAction === actionType) {
        await this.cancelInteractionAction(fishData, userInteraction, originalState, false);
        // 在详情页面情况下，需要清除userInteraction
        if (this.selectedFishData) {
          this.selectedFishData.userInteraction = null;
        }
      } else if (currentAction === oppositeAction) {
      // 如果当前是相反操作状态，直接切换操作（先删除原记录，再插入新记录）
      await this.switchInteractionAction(fishData, currentAction, actionType, originalState, false);
      return;
      } else {
        // 无交互状态，进行新操作
        await this.performInteractionAction(fishData, actionType, originalState, false);
      }

    } catch (error) {
      Utils.handleError(error, `${actionType === 'star' ? '点赞' : '点踩'}操作失败`);
      Utils.showError('操作失败，请重试');
    } finally {
      this.endInteraction();
    }
  }

  // 修改：点赞操作 - 使用缓存的openid
  async handleLikeAction() {
    await this._handleInteraction('star');
  }

  // 修改：点踩操作 - 使用缓存的openid
  async handleDislikeAction() {
    await this._handleInteraction('unstar');
  }

  // 新增：串门操作
  async handleVisitAction() {
    if (!this.selectedFishData) return;

    try {
      // 获取鱼的创作者信息
      const fishData = this.selectedFishData.fishData;
      const creatorOpenId = fishData._openid;

      if (!creatorOpenId) {
        console.log('无法获取创作者信息，无法串门');
        return;
      }

      // 生成随机鱼数据
      const randomFishes = await this.generateRandomFishesForVisit(20, creatorOpenId);

      // 设置串门界面数据
      this.otherFishTankData = {
        creatorOpenId: creatorOpenId,
        fishes: randomFishes,
        originalFishName: fishData.fishName
      };

      // 显示串门界面
      this.showOtherFishTank();

    } catch (error) {
      console.error('串门操作失败:', error);
      Utils.handleError(error, '串门');
    }
  }

  // 新增：生成随机鱼数据用于串门
  async generateRandomFishesForVisit(count, creatorOpenId) {
    try {
      console.log(`开始为创作者 ${creatorOpenId} 生成 ${count} 条随机鱼数据`);

      // 调用数据库管理器获取随机鱼数据
      const randomFishes = await this.databaseManager.getRandomFishesByUserOpenid(creatorOpenId, count);

      console.log(`成功生成 ${randomFishes.length} 条随机鱼数据`);
      return randomFishes;

    } catch (error) {
      Utils.handleError(error, '生成随机鱼数据');
      // 如果获取失败，返回空数组
      return [];
    }
  }

  // 新增：串门操作
  async handleVisitAction() {
    if (!this.selectedFishData) return;

    try {
      // 获取鱼的创作者信息
      const fishData = this.selectedFishData.fishData;
      const creatorOpenId = fishData._openid;

      if (!creatorOpenId) {
        console.log('无法获取创作者信息，无法串门');
        return;
      }

      // 生成随机鱼数据
      const randomFishes = await this.generateRandomFishesForVisit(20, creatorOpenId);

      // 设置串门界面数据
      this.otherFishTankData = {
        creatorOpenId: creatorOpenId,
        fishes: randomFishes,
        originalFishName: fishData.fishName
      };

      // 显示串门界面
      this.showOtherFishTank();

    } catch (error) {
      console.error('串门操作失败:', error);
      Utils.handleError(error, '串门');
    }
  }

  // 新增：显示他人鱼缸界面
  showOtherFishTank() {
    this.isOtherFishTankVisible = true;
    this.isFishDetailVisible = false; // 隐藏详情页

    // 初始化fishTank（如果尚未初始化）
    if (!this.fishTank) {
      this.fishTank = new FishTank(this.ctx, config.screenWidth, config.screenHeight);
    }

    // 清空当前鱼缸显示
    this.fishTank.fishes = [];
    this.fishTank.fishFoods = []; // 清空鱼粮
    this.fishTank.bubbles = []; // 清空气泡
    this.addedUserFishNames.clear();

    // 创建随机鱼对象并显示
    this.createFishesForVisit();

    // 启动动画
    this.fishManager.animator.startAnimationLoop();

    // 更新UI
    this.uiManager.drawGameUI(this.gameState);

    console.log('进入他人鱼缸界面');
  }

  // 新增：为串门创建鱼对象
  async createFishesForVisit() {
    if (!this.otherFishTankData || !this.otherFishTankData.fishes || this.otherFishTankData.fishes.length === 0) {
      console.log('没有串门鱼数据');
      return;
    }

    try {
      const fishCreationPromises = this.otherFishTankData.fishes.map(fishData =>
        this.fishManager.data.createFishFromDatabaseData(fishData)
      );

      const createdFishes = await Promise.all(fishCreationPromises);
      const validFishes = createdFishes.filter(fish => fish !== null);

      // 添加到鱼缸显示（串门模式下允许同名鱼）
      validFishes.forEach(fish => {
        this.fishTank.addFish(fish, true); // 允许重复
        this.addedUserFishNames.add(fish.name);
      });
      
      console.log(`成功创建 ${validFishes.length} 条串门鱼对象`);
      
    } catch (error) {
      Utils.handleError(error, '创建串门鱼对象');
    }
  }

  // 新增：隐藏他人鱼缸界面
  hideOtherFishTank() {
    this.isOtherFishTankVisible = false;
    this.otherFishTankData = null;
    
    // 停止动画
    this.fishManager.animator.stopAnimationLoop();
    
    // 更新UI
    this.uiManager.drawGameUI(this.gameState);
    
    console.log('退出他人鱼缸界面');
  }

  // 修改：执行点赞操作 - 使用缓存的openid
  async performLikeAction(fishData, originalState) {
    await this.performInteractionAction(fishData, 'star', originalState, false);
  }

  // 修改：执行点踩操作 - 使用缓存的openid
  async performDislikeAction(fishData, originalState) {
    await this.performInteractionAction(fishData, 'unstar', originalState, false);
  }

  // 修改：取消点赞操作 - 使用缓存的openid
  async cancelLikeAction(fishData, userInteraction, originalState) {
    await this.cancelInteractionAction(fishData, userInteraction, originalState, false);
    // 在详情页面情况下，需要清除userInteraction
    if (this.selectedFishData) {
      this.selectedFishData.userInteraction = null;
    }
  }

  // 修改：取消点踩操作 - 使用缓存的openid
  async cancelDislikeAction(fishData, userInteraction, originalState) {
    await this.cancelInteractionAction(fishData, userInteraction, originalState, false);
    // 在详情页面情况下，需要清除userInteraction
    if (this.selectedFishData) {
      this.selectedFishData.userInteraction = null;
    }
  }

  // 新增：回滚详情状态
  rollbackDetailState(originalState) {
    if (!this.selectedFishData) return;

    const fishData = this.selectedFishData.fishData;

    // 统一使用临时字段
    fishData.starCount = originalState.originalStarCount || 0;
    fishData.unstarCount = originalState.originalUnstarCount || 0;
    fishData.score = originalState.originalScore || 0;
    
    this.selectedFishData.userInteraction = originalState.userInteraction;

    // 立即更新UI
    this.immediatelyUpdateUI();
  }

  // 工具方法
  getUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {};
      return {
        nickName: userInfo.nickName || '匿名用户',
        avatarUrl: userInfo.avatarUrl || ''
      };
    } catch (error) {
      return {
        nickName: '匿名用户',
        avatarUrl: ''
      };
    }
  }

  // 新增：文本内容安全校验方法
  async checkFishNameSafety(fishName) {
    if (!fishName || fishName.trim().length === 0) {
      return {
        isSafe: false,
        error: '鱼名不能为空'
      };
    }

    // 获取用户openid
    let userOpenid;
    try {
      userOpenid = await this.getRealUserOpenid();
    } catch (error) {
      console.warn('获取用户openid失败，使用默认值进行安全校验:', error);
      // 如果获取openid失败，返回安全通过（避免因openid问题阻止用户操作）
      return {
        isSafe: true,
        message: '用户信息获取失败，跳过安全校验'
      };
    }

    try {
      console.log('开始调用文本安全校验云函数...');
      
      const result = await wx.cloud.callFunction({
        name: 'msgSecCheck',
        data: {
          content: fishName,
          openid: userOpenid
        }
      });

      console.log('文本安全校验云函数返回:', result);

      if (result.result.success) {
        return {
          isSafe: result.result.isSafe,
          suggest: result.result.suggest,
          label: result.result.label,
          message: result.result.message
        };
      } else {
        // 云函数调用失败，返回安全通过（避免因服务异常阻止用户操作）
        console.warn('文本安全校验服务异常，跳过校验:', result.result.error);
        return {
          isSafe: true,
          error: result.result.error,
          message: '安全校验服务异常，跳过校验'
        };
      }

    } catch (error) {
      console.error('调用文本安全校验云函数失败:', error);
      // 网络错误或其它异常，返回安全通过（避免因网络问题阻止用户操作）
      return {
        isSafe: true,
        error: error.message || '网络异常',
        message: '安全校验网络异常，跳过校验'
      };
    }
  }

  // 新增：文本内容安全校验方法
  async checkFishNameSafety(fishName) {
    if (!fishName || fishName.trim().length === 0) {
      return {
        isSafe: false,
        error: '鱼名不能为空'
      };
    }

    // 获取用户openid
    let userOpenid;
    try {
      userOpenid = await this.getRealUserOpenid();
    } catch (error) {
      console.warn('获取用户openid失败，使用默认值进行安全校验:', error);
      // 如果获取openid失败，返回安全通过（避免因openid问题阻止用户操作）
      return {
        isSafe: true,
        message: '用户信息获取失败，跳过安全校验'
      };
    }

    try {
      console.log('开始调用文本安全校验云函数...');
      
      const result = await wx.cloud.callFunction({
        name: 'msgSecCheck',
        data: {
          content: fishName,
          openid: userOpenid
        }
      });

      console.log('文本安全校验云函数返回:', result);

      if (result.result.success) {
        return {
          isSafe: result.result.isSafe,
          suggest: result.result.suggest,
          label: result.result.label,
          message: result.result.message
        };
      } else {
        // 云函数调用失败，返回安全通过（避免因服务异常阻止用户操作）
        console.warn('文本安全校验服务异常，跳过校验:', result.result.error);
        return {
          isSafe: true,
          error: result.result.error,
          message: '安全校验服务异常，跳过校验'
        };
      }

    } catch (error) {
      console.error('调用文本安全校验云函数失败:', error);
      // 网络错误或其它异常，返回安全通过（避免因网络问题阻止用户操作）
      return {
        isSafe: true,
        error: error.message || '网络异常',
        message: '安全校验网络异常，跳过校验'
      };
    }
  }

  // 新增：文本内容安全校验方法
  async checkFishNameSafety(fishName) {
    if (!fishName || fishName.trim().length === 0) {
      return {
        isSafe: false,
        error: '鱼名不能为空'
      };
    }

    // 获取用户openid
    let userOpenid;
    try {
      userOpenid = await this.getRealUserOpenid();
    } catch (error) {
      console.warn('获取用户openid失败，使用默认值进行安全校验:', error);
      // 如果获取openid失败，返回安全通过（避免因openid问题阻止用户操作）
      return {
        isSafe: true,
        message: '用户信息获取失败，跳过安全校验'
      };
    }

    try {
      console.log('开始调用文本安全校验云函数...');
      
      const result = await wx.cloud.callFunction({
        name: 'msgSecCheck',
        data: {
          content: fishName,
          openid: userOpenid
        }
      });

      console.log('文本安全校验云函数返回:', result);

      if (result.result.success) {
        return {
          isSafe: result.result.isSafe,
          suggest: result.result.suggest,
          label: result.result.label,
          message: result.result.message
        };
      } else {
        // 云函数调用失败，返回安全通过（避免因服务异常阻止用户操作）
        console.warn('文本安全校验服务异常，跳过校验:', result.result.error);
        return {
          isSafe: true,
          error: result.result.error,
          message: '安全校验服务异常，跳过校验'
        };
      }

    } catch (error) {
      console.error('调用文本安全校验云函数失败:', error);
      // 网络错误或其它异常，返回安全通过（避免因网络问题阻止用户操作）
      return {
        isSafe: true,
        error: error.message || '网络异常',
        message: '安全校验网络异常，跳过校验'
      };
    }
  }
}

module.exports = EventHandler;
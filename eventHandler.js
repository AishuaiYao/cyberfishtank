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
    this.isTeamInterfaceVisible = false; // 新增：组队界面状态
    this.isTeamInterfaceVisible = false; // 新增：组队界面状态
    this.isCollaborativePaintingVisible = false; // 新增：共同绘画界面状态
    this.isCollaborativePaintingVisible = false; // 新增：共同绘画界面状态

    // 数据状态
    this.swimInterfaceData = null;
    this.rankingData = null;
    this.selectedFishData = null;
    this.dialogData = null;
    this.fishNameInput = '';
    this.teamInterfaceData = null; // 新增：组队界面数据
    this.teamInterfaceData = null; // 新增：组队界面数据

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

        if (deleteInteractionSuccess) {
          console.log(`成功删除鱼 ${fishData.fishName} 及相关交互记录`);
        } else {
          console.warn(`鱼 ${fishData.fishName} 删除成功，但清理交互记录时出现问题`);
        }

        // 3. 从本地列表中移除
        this.removeFishFromLocalLists(fishData.fishName);

        // 4. 从鱼缸显示中移除
        this.removeFishFromTank(fishData.fishName);

        wx.hideLoading();
        Utils.showSuccess('删除成功');

        // 5. 关闭详情界面
        this.hideFishDetail();

        // 6. 刷新鱼缸显示
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

    // 1. 验证用户信息
    if (!this.userOpenid) {
      Utils.showError('用户信息未准备好');
      return;
    }

    // 2. 检查是否已存在相同交互记录
    const existingInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
    
    if (existingInteraction) {
      // 如果已存在记录，执行取消操作而不是重复插入
      console.log(`检测到已存在交互记录，执行取消操作`);
      await this.cancelInteractionAction(fishData, existingInteraction, originalState, isRanking);
      return;
    }

    // 3. 立即更新本地状态
    this.updateLocalFishData(fishData, action, 'increment');
    
    // 设置本地缓存状态
    this.setLocalInteractionState(fishName, action, originalState);

    // 4. 立即更新UI
    this.immediatelyUpdateUI();

    // 5. 异步执行数据库操作
    try {
      // 插入新的交互记录
      const interactionSuccess = await this.databaseManager.insertUserInteraction(
        fishName, action, this.userOpenid
      );

      if (interactionSuccess) {
        console.log(`${isRanking ? '排行榜' : ''}${isStar ? '点赞' : '点踩'}操作成功`);
        
        // 更新交互状态
        await this.updateInteractionState(fishName, action, isRanking);
      } else {
        // 插入失败，回滚状态
        this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
        Utils.showError('操作失败，请重试', 1500);
      }
    } catch (error) {
      console.error('数据库操作失败:', error);
      this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
      Utils.showError('网络错误，操作失败');
    } finally {
      this.clearLocalInteractionState(fishName);
    }
  }

  // 优化：通用的取消点赞/点踩操作
  async cancelInteractionAction(fishData, userInteraction, originalState, isRanking = false) {
    const fishName = fishData.fishName;
    const isStar = userInteraction && userInteraction.action === 'star';

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
    
    // 设置本地缓存状态为取消状态
    this.setLocalInteractionState(fishName, null, originalState);

    // 4. 立即更新UI
    this.immediatelyUpdateUI();

    // 5. 异步执行数据库操作
    try {
      // 删除交互记录
      const interactionSuccess = await this.databaseManager.deleteUserInteraction(interactionToDelete._id);

      if (interactionSuccess) {
        console.log(`取消${isRanking ? '排行榜' : ''}${isStar ? '点赞' : '点踩'}成功`);
        
        // 清除交互状态
        this.clearInteractionState(fishName, isRanking);
      } else {
        // 删除失败，回滚状态
        this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
        Utils.showError('操作失败', 1000);
      }
    } catch (error) {
      console.error('数据库操作失败:', error);
      this.rollbackInteractionState(fishData, originalState, isRanking, fishName);
      Utils.showError('网络错误，操作失败');
    } finally {
      this.clearLocalInteractionState(fishName);
    }
  }

  // 新增：切换交互操作（先删除原记录，再插入新记录）
  async switchInteractionAction(fishData, currentAction, newAction, originalState, isRanking = false) {
    const fishName = fishData.fishName;
    const isStar = newAction === 'star';

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

  // 新增：设置本地交互状态
  setLocalInteractionState(fishName, action, originalState = null) {
    this.localInteractionCache.set(fishName, {
      action,
      timestamp: Date.now(),
      originalState: originalState // 保存原始状态用于回滚
    });
  }

  // 新增：清除本地交互状态
  clearLocalInteractionState(fishName) {
    this.localInteractionCache.delete(fishName);
  }

  // 新增：更新本地鱼数据状态
  updateLocalFishData(fishData, action, operation) {
    const isStar = action === 'star';
    const change = operation === 'increment' ? 1 : -1;

    // 兼容新旧数据结构
    if ('star' in fishData && 'unstar' in fishData) {
      // 旧数据结构：有评分字段
      if (isStar) {
        fishData.star = Math.max(0, (fishData.star || 0) + change);
      } else {
        fishData.unstar = Math.max(0, (fishData.unstar || 0) + change);
      }
      fishData.score = (fishData.star || 0) - (fishData.unstar || 0);
    } else {
      // 新数据结构：使用临时字段
      if (isStar) {
        fishData.tempStar = Math.max(0, (fishData.tempStar || 0) + change);
      } else {
        fishData.tempUnstar = Math.max(0, (fishData.tempUnstar || 0) + change);
      }
      fishData.tempScore = (fishData.tempStar || 0) - (fishData.tempUnstar || 0);
    }
  }

  // 新增：更新交互状态
  async updateInteractionState(fishName, action, isRanking) {
    if (isRanking && this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        // 重新查询数据库获取完整的交互记录（包含_id）
        const dbInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
        if (dbInteraction) {
          fishItem.userInteraction = dbInteraction;
          console.log('设置排行榜交互状态（包含_id）:', dbInteraction);
        } else {
          // 如果没有找到记录，创建一个包含基本信息的对象
          fishItem.userInteraction = {
            fishName: fishName,
            action: action,
            _openid: this.userOpenid
          };
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

  // 新增：更新本地鱼数据状态
  updateLocalFishData(fishData, action, operation) {
    const isStar = action === 'star';
    const change = operation === 'increment' ? 1 : -1;

    // 兼容新旧数据结构
    if ('star' in fishData && 'unstar' in fishData) {
      // 旧数据结构：有评分字段
      if (isStar) {
        fishData.star = Math.max(0, (fishData.star || 0) + change);
      } else {
        fishData.unstar = Math.max(0, (fishData.unstar || 0) + change);
      }
      fishData.score = (fishData.star || 0) - (fishData.unstar || 0);
    } else {
      // 新数据结构：使用临时字段
      if (isStar) {
        fishData.tempStar = Math.max(0, (fishData.tempStar || 0) + change);
      } else {
        fishData.tempUnstar = Math.max(0, (fishData.tempUnstar || 0) + change);
      }
      fishData.tempScore = (fishData.tempStar || 0) - (fishData.tempUnstar || 0);
    }
  }

  // 新增：更新交互状态
  async updateInteractionState(fishName, action, isRanking) {
    if (isRanking && this.rankingData && this.rankingData.fishes) {
      const fishItem = this.rankingData.fishes.find(item =>
        item.fishData.fishName === fishName
      );
      if (fishItem) {
        // 重新查询数据库获取完整的交互记录（包含_id）
        const dbInteraction = await this.databaseManager.getUserInteraction(fishName, this.userOpenid);
        if (dbInteraction) {
          fishItem.userInteraction = dbInteraction;
          console.log('设置排行榜交互状态（包含_id）:', dbInteraction);
        } else {
          // 如果没有找到记录，创建一个包含基本信息的对象
          fishItem.userInteraction = {
            fishName: fishName,
            action: action,
            _openid: this.userOpenid
          };
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
    const localState = this.getLocalInteractionState(fishName);
    return localState || userInteraction;
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

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    console.log('触摸开始:', x, y, '界面状态:', {
      ranking: this.isRankingInterfaceVisible,
      fishDetail: this.isFishDetailVisible,
      dialog: this.isDialogVisible,
      swim: this.isSwimInterfaceVisible,
      team: this.isTeamInterfaceVisible,
      collaborativePainting: this.isCollaborativePaintingVisible
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
    } else if (this.isSwimInterfaceVisible) {
      this.touchHandlers.swim.handleTouch(x, y);
    } else if (this.isTeamInterfaceVisible || this.isCollaborativePaintingVisible) {
      console.log('路由到组队处理器');
      this.touchHandlers.team.handleTeamTouch(x, y);
    } else {
      // 主界面
      this.touchHandlers.main.handleTouchStart(x, y);
    }
  }

  handleTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    // 根据界面状态路由
    if (this.isRankingInterfaceVisible) {
      this.touchHandlers.ranking.handleTouchMove(x, y);
    } else if (this.isFishDetailVisible) {
      // 鱼详情界面不需要处理移动
    } else if (this.isDialogVisible) {
      // 对话框界面不需要处理移动
    } else if (this.isSwimInterfaceVisible) {
      // 游泳界面不需要处理移动
    } else if (this.isTeamInterfaceVisible || this.isCollaborativePaintingVisible) {
      // 组队界面和共同绘画界面需要处理移动（传递给组队处理器）
      this.touchHandlers.team.handleTouchMove(x, y);
    } else {
      // 主界面
      this.touchHandlers.main.handleTouchMove(x, y);
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
    } else if (this.isSwimInterfaceVisible) {
      // 游泳界面不需要处理结束
    } else if (this.isTeamInterfaceVisible || this.isCollaborativePaintingVisible) {
      // 组队界面和共同绘画界面需要处理结束（传递给组队处理器）
      this.touchHandlers.team.handleTouchEnd();
    } else {
      // 主界面
      this.touchHandlers.main.handleTouchEnd();
    }
  }

  handleTouchCancel(e) {
    this.gameState.isDrawing = false;
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

// 修改 enterFishTank 方法，让首次进入也使用随机模式
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
  } else {
    // 我的鱼缸逻辑：使用随机模式，让每次进入都看到不同的鱼
    await this.loadMyFishes(true); // true 表示随机模式
  }

  this.fishManager.animator.startAnimationLoop();

  // 修改这里：进入鱼缸时显示鱼的数量和模式
  const fishCount = mode === 'public' ? this.globalFishList.length : this.myFishTankList.length;
  const tankName = mode === 'public' ? '赛博鱼缸' : '我的鱼缸';
  wx.showToast({
    title: `${tankName}中有${fishCount}条鱼`,
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
    if (this.currentTankMode === 'public') {
      // 公共鱼缸逻辑：使用赛博鱼缸的随机逻辑
      const newFishes = await this.databaseManager.getRandomFishesFromDatabase(20);
      this.globalFishList = newFishes;

      // 清空并重新创建鱼对象
      this.fishTank.fishes = [];
      this.addedUserFishNames.clear();
      await this.createFishesFromGlobalList();

      wx.showToast({
        title: `刷新完成，${newFishes.length}条鱼`,
        icon: 'success',
        duration: 1500
      });
    } else {
      // 我的鱼缸逻辑：使用新的随机查询（限制在当前用户的鱼中）
      console.log('刷新我的鱼缸，使用随机查询...');
      await this.loadMyFishes(true); // true 表示随机模式

      wx.showToast({
        title: `刷新完成，${this.myFishTankList.length}条鱼`,
        icon: 'success',
        duration: 1500
      });
    }
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
      let initialRankingFishes;

      // 初始只加载第一页数据
      // 赛博排行榜：第一页数据
      const result = await this.databaseManager.getRankingDataPage(0, this.rankingIncrementalData.cyber.pageSize);
      initialRankingFishes = result.data;
      this.rankingIncrementalData.cyber.hasMore = result.hasMore;

      // 存入缓存
      this.rankingIncrementalData.cyber.cachedData = [...initialRankingFishes];

      // 为每条鱼创建图像对象
      const rankingFishesWithImages = [];
      for (const fishData of initialRankingFishes) {
        try {
          const fishImage = await this.fishManager.data.base64ToCanvas(fishData.base64);
          rankingFishesWithImages.push({
            fishData: fishData,
            fishImage: fishImage
          });
        } catch (error) {
          console.warn('创建排行榜鱼图像失败:', error);
        }
      }

      // 计算每条鱼的评分（从interaction集合中实时计算）
      await this.calculateFishesScores(rankingFishesWithImages);

      // 加载用户交互状态
      await this.loadRankingFishesUserInteractions(rankingFishesWithImages);

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

  // 新增：计算多条鱼的评分
  async calculateFishesScores(fishesWithImages) {
    if (!fishesWithImages || fishesWithImages.length === 0) {
      return;
    }

    console.log('开始计算鱼的评分...');

    try {
      // 提取所有鱼的名称
      const fishNames = fishesWithImages.map(item => item.fishData.fishName);

      // 批量计算评分
      const scoresMap = await this.databaseManager.calculateMultipleFishesScores(fishNames);

      // 更新每条鱼的评分数据
      fishesWithImages.forEach(item => {
        const fishName = item.fishData.fishName;
        if (scoresMap[fishName]) {
          const { score, starCount, unstarCount } = scoresMap[fishName];

          // 兼容新旧数据结构：如果鱼数据有评分字段则更新，否则使用临时字段
          if ('score' in item.fishData) {
            item.fishData.score = score;
            item.fishData.star = starCount;
            item.fishData.unstar = unstarCount;
          } else {
            // 使用临时字段存储评分数据
            item.fishData.tempScore = score;
            item.fishData.tempStar = starCount;
            item.fishData.tempUnstar = unstarCount;
          }

          console.log(`鱼 ${fishName} 评分更新: ${score} (star: ${starCount}, unstar: ${unstarCount})`);
        }
      });

      console.log('鱼的评分计算完成');
    } catch (error) {
      Utils.handleError(error, '计算鱼的评分失败');
    }
  }

  // 新增：计算单条鱼的评分
  async calculateSingleFishScore(fishData) {
    if (!fishData || !fishData.fishName) {
      return;
    }

    console.log(`开始计算鱼 ${fishData.fishName} 的评分...`);

    try {
      // 计算评分
      const scoreData = await this.databaseManager.calculateFishScore(fishData.fishName);
      const { score, starCount, unstarCount } = scoreData;

      // 兼容新旧数据结构：如果鱼数据有评分字段则更新，否则使用临时字段
      if ('score' in fishData) {
        fishData.score = score;
        fishData.star = starCount;
        fishData.unstar = unstarCount;
      } else {
        // 使用临时字段存储评分数据
        fishData.tempScore = score;
        fishData.tempStar = starCount;
        fishData.tempUnstar = unstarCount;
      }

      console.log(`鱼 ${fishData.fishName} 评分更新: ${score} (star: ${starCount}, unstar: ${unstarCount})`);
    } catch (error) {
      Utils.handleError(error, `计算鱼 ${fishData.fishName} 的评分失败`);
    }
  }

  // 修改：为排行榜鱼数据加载用户交互状态 - 使用缓存的openid
  async loadRankingFishesUserInteractions(rankingFishes) {
    if (!rankingFishes || rankingFishes.length === 0) {
      return;
    }

    console.log('开始加载排行榜鱼的用户交互状态...');

    // 使用缓存的openid
    if (!this.userOpenid) {
      console.warn('用户openid未初始化，无法加载交互状态');
      return;
    }

    console.log('使用缓存的openid加载交互状态:', this.userOpenid);

    // 批量查询用户交互状态
    const interactionPromises = rankingFishes.map(async (fishItem) => {
      try {
        fishItem.userInteraction = await this.databaseManager.getUserInteraction(
          fishItem.fishData.fishName,
          this.userOpenid
        );
      } catch (error) {
        Utils.handleWarning(error, `加载鱼 ${fishItem.fishData.fishName} 的交互状态失败`);
        fishItem.userInteraction = null;
      }
    });

    await Promise.all(interactionPromises);
    console.log('排行榜鱼用户交互状态加载完成');
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

    console.log(`开始加载更多排行榜数据，当前页: ${incrementalData.currentPage + 1}`);

    incrementalData.isLoading = true;
    incrementalData.currentPage++;

    try {
      // 优化：加载后续20条小鱼数据
      const nextPageResult = await this.databaseManager.getRankingDataPage(
        incrementalData.currentPage,
        20 // 固定加载20条小鱼
      );

      // 更新是否有更多数据的标志
      incrementalData.hasMore = nextPageResult.hasMore;

      if (nextPageResult.data.length === 0) {
        console.log('没有更多数据可以加载');
        incrementalData.hasMore = false;
        return;
      }

      // 将新数据添加到缓存
      incrementalData.cachedData = [...incrementalData.cachedData, ...nextPageResult.data];

      // 为新加载的鱼数据创建图像
      const newFishes = [];

      for (const fishData of nextPageResult.data) {
        try {
          const fishImage = await this.fishManager.data.base64ToCanvas(fishData.base64);
          const fishItem = {
            fishData: fishData,
            fishImage: fishImage
          };

          newFishes.push(fishItem);
        } catch (error) {
          console.warn('创建排行榜鱼图像失败:', error);
        }
      }

      // 计算新加载鱼的评分
      await this.calculateFishesScores(newFishes);

      // 加载用户交互状态
      for (const fishItem of newFishes) {
        if (this.userOpenid) {
          try {
            fishItem.userInteraction = await this.databaseManager.getUserInteraction(
              fishItem.fishData.fishName,
              this.userOpenid
            );
          } catch (error) {
            Utils.handleWarning(error, `加载鱼 ${fishItem.fishData.fishName} 的交互状态失败`);
            fishItem.userInteraction = null;
          }
        }
      }

      // 将新加载的鱼添加到现有数据中
      this.rankingData.fishes = this.rankingData.fishes.concat(newFishes);

      console.log(`成功加载 ${newFishes.length} 条新的排行榜数据，当前总数: ${this.rankingData.fishes.length}`);

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

      // 兼容新旧数据结构
      if ('star' in fishData && 'unstar' in fishData) {
        // 旧数据结构：有评分字段
        originalState.starCount = fishData.star || 0;
        originalState.unstarCount = fishData.unstar || 0;
        originalState.score = fishData.score || 0;
      } else {
        // 新数据结构：没有评分字段，使用临时字段
        originalState.tempStarCount = fishData.tempStar || 0;
        originalState.tempUnstarCount = fishData.tempUnstar || 0;
        originalState.tempScore = fishData.tempScore || 0;
      }

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

    // 回滚数据状态 - 兼容新旧数据结构
    if ('star' in fishData && 'unstar' in fishData) {
      // 旧数据结构：有评分字段
      fishData.star = originalState.starCount;
      fishData.unstar = originalState.unstarCount;
      fishData.score = originalState.score;
    } else {
      // 新数据结构：使用临时字段
      fishData.tempStar = originalState.tempStarCount || 0;
      fishData.tempUnstar = originalState.tempUnstarCount || 0;
      fishData.tempScore = originalState.tempScore || 0;
    }

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

    this.rankingSortType = sortType;
    console.log('排行榜排序类型已设置为:', sortType);

    // 重新加载排行榜数据
    if (this.isRankingInterfaceVisible) {
      // 重置排行榜数据并重新加载界面
      this.rankingData = null;
      this.showRankingInterface();
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
        sortTypeText = '点踩最多（最丑榜）';
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

      const insertSuccess = await this.databaseManager.insertFishToDatabase(fishData);
      wx.hideLoading();

      if (insertSuccess) {
        Utils.showSuccess(`${finalName} 加入鱼缸！`);

        // 修改：进入鱼缸并确保新鱼显示
        await this.enterFishTank(finalName);
      } else {
        wx.showToast({ title: `${finalName} 加入鱼缸！(本地)`, icon: 'success', duration: 1500 });
        // 本地模式下还是使用原有逻辑
        const { Fish } = require('./fishCore.js');
        const fish = new Fish(
          scaledImage.canvas,
          Math.random() * (config.screenWidth - scaledImage.width),
          Math.random() * (config.screenHeight - scaledImage.height),
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
        Math.random() * (config.screenWidth - scaledImage.width),
        Math.random() * (config.screenHeight - scaledImage.height),
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
  async showFishDetail(fish) {
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

    // 新增：计算鱼的评分（从interaction集合中实时计算）
    await this.calculateSingleFishScore(fish.fishData);

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
      
      // 兼容新旧数据结构
      if ('star' in fishData && 'unstar' in fishData) {
        // 旧数据结构：有评分字段
        originalState.starCount = fishData.star || 0;
        originalState.unstarCount = fishData.unstar || 0;
        originalState.score = fishData.score || 0;
      } else {
        // 新数据结构：没有评分字段，使用临时字段
        originalState.tempStarCount = fishData.tempStar || 0;
        originalState.tempUnstarCount = fishData.tempUnstar || 0;
        originalState.tempScore = fishData.tempScore || 0;
      }

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

    // 回滚数据状态 - 兼容新旧数据结构
    if ('star' in fishData && 'unstar' in fishData) {
      // 旧数据结构：有评分字段
      fishData.star = originalState.starCount;
      fishData.unstar = originalState.unstarCount;
      fishData.score = originalState.score;
    } else {
      // 新数据结构：使用临时字段
      fishData.tempStar = originalState.tempStarCount || 0;
      fishData.tempUnstar = originalState.tempUnstarCount || 0;
      fishData.tempScore = originalState.tempScore || 0;
    }
    
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
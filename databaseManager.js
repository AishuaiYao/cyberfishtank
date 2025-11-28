const Utils = require('./utils.js');

class DatabaseManager {
  constructor() {
    this.cloudDb = null;
    this.isCloudDbInitialized = false;
    this.initCloudDatabase();
  }

  // 初始化云数据库
  initCloudDatabase() {
    try {
      if (!wx.cloud) {
        console.warn('当前环境不支持云开发');
        return;
      }

      wx.cloud.init({
        env: 'cloudservice-0g27c8ul6804ce3d',
        traceUser: true
      });

      this.cloudDb = wx.cloud.database();
      this.isCloudDbInitialized = true;
      console.log('云数据库初始化成功');

      this.testDatabaseConnection();
    } catch (error) {
      console.error('云数据库初始化失败:', error);
      this.isCloudDbInitialized = false;
    }
  }

  // 测试数据库连接
  async testDatabaseConnection() {
    if (!this.isCloudDbInitialized) return;

    try {
      await this.cloudDb.collection('fishes').limit(1).get();
      console.log('数据库连接测试成功');
    } catch (error) {
      Utils.handleWarning(error, '数据库连接测试失败，集合可能不存在');
    }
  }

  // 新增：通用的数据库操作函数，减少重复代码
  async _executeDatabaseOperation(operationName, operation, defaultReturn) {
    if (!Utils.checkDatabaseInitialization(this, operationName)) {
      return defaultReturn;
    }

    try {
      return await operation();
    } catch (error) {
      return Utils.handleDatabaseError(error, operationName, defaultReturn);
    }
  }

  // 新增：通用的数据库操作函数，减少重复代码
  async _executeDatabaseOperation(operationName, operation, defaultReturn) {
    if (!Utils.checkDatabaseInitialization(this, operationName)) {
      return defaultReturn;
    }

    try {
      return await operation();
    } catch (error) {
      return Utils.handleDatabaseError(error, operationName, defaultReturn);
    }
  }

  // 修改：按用户_openid查询鱼数据 - 现在接收openid参数
  async getFishesByUserOpenid(openid, limit = 20) {
    return this._executeDatabaseOperation('按用户查询鱼数据', async () => {
      if (!openid) {
        Utils.handleWarning('', 'openid为空，无法查询用户鱼数据');
        return [];
      }

      console.log(`查询用户 ${openid} 的鱼数据，限制: ${limit} 条`);

      // 关键：显式指定_openid条件
      const result = await this.cloudDb.collection('fishes')
        .where({
          _openid: openid  // 显式指定_openid条件
        })
        .orderBy('createTimestamp', 'desc') // 按创建时间倒序
        .limit(limit)
        .get();

      console.log(`找到用户 ${openid} 的 ${result.data.length} 条鱼`);
      return result.data;
    }, []);
  }

  // 修改：获取用户交互记录 - 现在接收openid参数
  async getUserInteraction(fishName, userOpenid) {
    return this._executeDatabaseOperation('获取用户交互记录', async () => {
      if (!userOpenid) {
        Utils.handleWarning('', '用户openid为空，无法获取交互记录');
        return null;
      }

      const result = await this.cloudDb.collection('interaction')
        .where({
          fishName: fishName,
          _openid: userOpenid  // 必须显式指定_openid条件
        })
        .get();

      if (result.data.length > 0) {
        console.log(`找到用户对鱼 ${fishName} 的交互记录:`, result.data[0].action);
        return result.data[0];
      } else {
        console.log(`用户对鱼 ${fishName} 暂无交互记录`);
        return null;
      }
    }, null);
  }

  // 修改：插入用户交互记录 - 现在接收openid参数
  async insertUserInteraction(fishName, action, userOpenid) {
    return this._executeDatabaseOperation('插入交互记录', async () => {
      if (!userOpenid) {
        Utils.handleWarning('', '用户openid为空，无法插入交互记录');
        return false;
      }

      const interactionData = {
        fishName: fishName,
        action: action,
        createdAt: new Date(),
        createTimestamp: Date.now()
        // 不需要包含 openid 字段，系统会自动添加 _openid
      };

      console.log('准备插入交互记录:', interactionData);

      await this.cloudDb.collection('interaction').add({
        data: interactionData
      });

      console.log('交互记录插入成功');
      return true;
    }, false);
  }

  // 新增：更新用户交互记录
  async updateUserInteraction(interactionId, newAction) {
    return this._executeDatabaseOperation('更新交互记录', async () => {
      await this.cloudDb.collection('interaction').doc(interactionId).update({
        data: {
          action: newAction,
          updateTime: new Date()
        }
      });

      console.log('交互记录更新成功');
      return true;
    }, false);
  }

  // 新增：删除用户交互记录
  async deleteUserInteraction(interactionId) {
    if (!Utils.checkDatabaseInitialization(this, '删除交互记录')) return false;

    try {
      await this.cloudDb.collection('interaction').doc(interactionId).remove();
      console.log('交互记录删除成功');
      return true;
    } catch (error) {
      return Utils.handleDatabaseError(error, '删除交互记录', false);
    }
  }

  async getRandomFishesFromDatabase(count = 20) {
    if (!Utils.checkDatabaseInitialization(this, '获取随机鱼数据')) return [];

    try {
      // 优先使用方法1：数据库真随机
      const result = await this.cloudDb.collection('fishes')
        .aggregate()
        .sample({ size: count })
        .end();

      console.log(`使用数据库真随机获取了 ${result.list.length} 条鱼数据`);
      return result.list;

    } catch (error) {
      Utils.handleWarning(error, '数据库真随机不支持，使用备选方案');
      return await this.getRandomFishesFallback(count);
    }
  }

  async getRandomFishesFallback(count = 20) {
    if (!Utils.checkDatabaseInitialization(this, '获取随机鱼数据(备选方案)')) return [];

    try {
      // 方法2：获取所有数据后随机选择
      const result = await this.cloudDb.collection('fishes')
        .limit(1000) // 限制最大获取数量
        .get();

      console.log(`备选方案获取了 ${result.data.length} 条鱼数据`);

      // 随机选择指定数量的鱼
      const selectedFishes = Utils.shuffleArray(result.data).slice(0, count);

      console.log(`备选方案随机选择了 ${selectedFishes.length} 条鱼`);
      return selectedFishes;
    } catch (error) {
      return Utils.handleDatabaseError(error, '备选方案获取鱼数据', []);
    }
  }

  async getRankingData(limit = 100) {
    if (!Utils.checkDatabaseInitialization(this, '获取排行榜数据')) return [];

    try {
      console.log(`开始获取排行榜数据，目标: ${limit} 条`);

      let allData = [];
      let skip = 0;
      const batchSize = 20; // 每次获取20条

      while (allData.length < limit) {
        const result = await this.cloudDb.collection('fishes')
          .orderBy('createTimestamp', 'desc')
          .skip(skip)
          .limit(batchSize)
          .get();

        if (result.data.length === 0) break; // 没有更多数据了

        allData = allData.concat(result.data);
        skip += batchSize;

        console.log(`已获取 ${allData.length} 条数据`);
      }

      // 限制最终数量并过滤有效数据
      const finalData = allData.slice(0, limit);
      const validRankingData = finalData.filter(fish => fish.base64 && fish.base64.length > 0);

      console.log(`最终获取 ${validRankingData.length} 条有效排行榜数据`);
      return validRankingData;
    } catch (error) {
      return Utils.handleDatabaseError(error, '获取排行榜数据', []);
    }
  }

  // 新增：分页获取排行榜数据
  async getRankingDataPage(page = 0, pageSize = 20) {
    if (!Utils.checkDatabaseInitialization(this, '获取排行榜分页数据')) return [];

    try {
      console.log(`获取排行榜第${page+1}页，每页${pageSize}条`);

      const result = await this.cloudDb.collection('fishes')
        .orderBy('createTimestamp', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      // 过滤有效数据
      const validRankingData = result.data.filter(fish => fish.base64 && fish.base64.length > 0);

      console.log(`第${page+1}页获取了 ${validRankingData.length} 条有效数据`);

      return {
        data: validRankingData,
        hasMore: result.data.length === pageSize // 如果返回的数据量等于请求量，说明可能还有更多
      };
    } catch (error) {
      return Utils.handleDatabaseError(error, '获取排行榜分页数据', { data: [], hasMore: false });
    }
  }

  // 新增：获取本周排行榜数据
  async getWeeklyRankingData(limit = 100, startOfWeek) {
    if (!Utils.checkDatabaseInitialization(this, '获取本周排行榜数据')) return [];

    try {
      console.log(`开始获取本周排行榜数据，目标: ${limit} 条，起始时间: ${startOfWeek}`);

      let allData = [];
      let skip = 0;
      const batchSize = 20;

      while (allData.length < limit) {
        const result = await this.cloudDb.collection('fishes')
          .where({
            // 筛选本周创建的鱼
            createdAt: this.cloudDb.command.gte(startOfWeek)
          })
          .orderBy('createTimestamp', 'desc')
          .skip(skip)
          .limit(batchSize)
          .get();

        if (result.data.length === 0) break; // 没有更多数据了

        allData = allData.concat(result.data);
        skip += batchSize;

        console.log(`已获取 ${allData.length} 条本周数据`);
      }

      // 限制最终数量并过滤有效数据
      const finalData = allData.slice(0, limit);
      const validRankingData = finalData.filter(fish => fish.base64 && fish.base64.length > 0);

      console.log(`最终获取 ${validRankingData.length} 条有效本周排行榜数据`);
      return validRankingData;
    } catch (error) {
      return Utils.handleDatabaseError(error, '获取本周排行榜数据', []);
    }
  }

  // 新增：分页获取本周排行榜数据
  async getWeeklyRankingDataPage(page = 0, pageSize = 20, startOfWeek) {
    if (!Utils.checkDatabaseInitialization(this, '获取本周排行榜分页数据')) return { data: [], hasMore: false };

    try {
      console.log(`获取本周排行榜第${page+1}页，每页${pageSize}条，起始时间: ${startOfWeek}`);

      const result = await this.cloudDb.collection('fishes')
        .where({
          // 筛选本周创建的鱼
          createdAt: this.cloudDb.command.gte(startOfWeek)
        })
        .orderBy('createTimestamp', 'desc')
        .skip(page * pageSize)
        .limit(pageSize)
        .get();

      // 过滤有效数据
      const validRankingData = result.data.filter(fish => fish.base64 && fish.base64.length > 0);

      console.log(`本周排行榜第${page+1}页获取了 ${validRankingData.length} 条有效数据`);

      return {
        data: validRankingData,
        hasMore: result.data.length === pageSize // 如果返回的数据量等于请求量，说明可能还有更多
      };
    } catch (error) {
      return Utils.handleDatabaseError(error, '获取本周排行榜分页数据', { data: [], hasMore: false });
    }
  }

  // 向数据库插入鱼数据
  async insertFishToDatabase(fishData) {
    if (!Utils.checkDatabaseInitialization(this, '插入鱼数据')) return false;

    try {
      console.log('准备插入鱼数据:', {
        ...fishData,
        base64: `base64数据长度: ${fishData.base64.length}`
      });

      await this.cloudDb.collection('fishes').add({
        data: fishData
      });

      console.log('鱼数据插入成功');
      return true;
    } catch (error) {
      if (error.errCode === -502005) {
        console.log('检测到集合不存在，尝试使用备用方案...');
        return await this.insertWithBackupMethod(fishData);
      }
      return Utils.handleDatabaseError(error, '数据库插入', false);
    }
  }

  // 备用插入方法
  async insertWithBackupMethod(fishData) {
    try {
      const simpleFishData = {
        fish_name: fishData.fishName,
        base64: fishData.base64,
        create_time: new Date(),
        timestamp: Date.now()
      };

      console.log('使用备用方案插入数据:', {
        ...simpleFishData,
        base64: `base64数据长度: ${fishData.base64.length}`
      });

      const result = await this.cloudDb.collection('fishes').add({
        data: simpleFishData
      });

      console.log('备用方案插入成功:', result);
      return true;
    } catch (backupError) {
      console.error('备用方案也失败了:', backupError);
      return false;
    }
  }

  // 更新鱼的评分（兼容旧数据，新创建的鱼不包含这些字段）
  async updateFishScore(fishId, newScore, starCount, unstarCount) {
    if (!Utils.checkDatabaseInitialization(this, '更新鱼评分')) return false;

    try {
      console.log(`更新鱼 ${fishId} 的评分: score=${newScore}, star=${starCount}, unstar=${unstarCount}`);

      // 构建更新数据对象，只包含需要的字段
      const updateData = {
        updateTime: new Date()
      };

      // 先获取当前鱼的数据，检查是否包含评分字段
      const fishDoc = await this.cloudDb.collection('fishes').doc(fishId).get();
      if (fishDoc.data) {
        // 只有当鱼数据包含这些字段时才更新
        if ('score' in fishDoc.data) {
          updateData.score = newScore;
        }
        if ('star' in fishDoc.data) {
          updateData.star = starCount;
        }
        if ('unstar' in fishDoc.data) {
          updateData.unstar = unstarCount;
        }
      }

      await this.cloudDb.collection('fishes').doc(fishId).update({
        data: updateData
      });

      console.log('鱼评分更新成功');
      return true;
    } catch (error) {
      return Utils.handleDatabaseError(error, '更新鱼评分', false);
    }
  }

  // 新增：批量获取用户交互记录
  async getUserInteractionsBatch(fishNames, userOpenid) {
    if (!this.isCloudDbInitialized || !this.cloudDb || !fishNames || fishNames.length === 0) {
      console.warn('云数据库未初始化或鱼名列表为空，无法批量获取交互记录');
      return {};
    }

    if (!userOpenid) {
      console.warn('用户openid为空，无法批量获取交互记录');
      return {};
    }

    try {
      // 使用IN查询批量获取交互记录
      const result = await this.cloudDb.collection('interaction')
        .where({
          fishName: this.cloudDb.command.in(fishNames),
          _openid: userOpenid  // 显式指定_openid条件
        })
        .get();

      // 转换为以鱼名为键的对象，方便查找
      const interactionsMap = {};
      result.data.forEach(interaction => {
        interactionsMap[interaction.fishName] = interaction;
      });

      console.log(`批量获取了 ${Object.keys(interactionsMap).length} 条交互记录`);
      return interactionsMap;
    } catch (error) {
      console.error('批量获取用户交互记录失败:', error);
      return {};
    }
  }

  // 新增：在我的鱼缸中随机获取用户的鱼（参考赛博鱼缸逻辑）
  async getRandomFishesByUserOpenid(openid, count = 20) {
    if (!Utils.checkDatabaseInitialization(this, '随机查询用户鱼数据')) return [];
    if (!openid) {
      Utils.handleWarning('', 'openid为空，无法随机查询用户鱼数据');
      return [];
    }

    console.log(`随机查询用户 ${openid} 的 ${count} 条鱼数据`);

    try {
      // 方法1：使用数据库的aggregate + sample实现真随机（参考赛博鱼缸）
      const result = await this.cloudDb.collection('fishes')
        .aggregate()
        .match({
          _openid: openid  // 关键：添加_openid限制，只查询当前用户的鱼
        })
        .sample({ size: count })
        .end();

      console.log(`使用数据库真随机获取了用户 ${openid} 的 ${result.list.length} 条鱼`);
      return result.list;
    } catch (aggregateError) {
      Utils.handleWarning(aggregateError, '数据库aggregate随机不支持，使用备选方案');
      return await this.getRandomFishesByUserFallback(openid, count);
    }
  }

// 新增：我的鱼缸随机备选方案
async getRandomFishesByUserFallback(openid, count = 20) {
  try {
    console.log(`使用备选方案随机查询用户 ${openid} 的 ${count} 条鱼数据`);

    // 先获取用户的所有鱼
    const allUserFishes = await this.cloudDb.collection('fishes')
      .where({
        _openid: openid  // 关键：只查询当前用户的鱼
      })
      .get();

    console.log(`用户 ${openid} 共有 ${allUserFishes.data.length} 条鱼`);

    if (allUserFishes.data.length === 0) return [];

    // 如果用户鱼的数量少于请求数量，返回所有鱼
    if (allUserFishes.data.length <= count) return allUserFishes.data;

    // 使用通用的洗牌算法随机选择指定数量的鱼
    const selectedFishes = Utils.shuffleArray([...allUserFishes.data]).slice(0, count);

    console.log(`随机选择了用户 ${openid} 的 ${selectedFishes.length} 条鱼`);
    return selectedFishes;
  } catch (error) {
    return Utils.handleDatabaseError(error, '备选方案随机查询用户鱼数据', []);
  }
}
}

module.exports = DatabaseManager;
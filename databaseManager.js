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
      const result = await this.cloudDb.collection('fishes').limit(1).get();
      console.log('数据库连接测试成功');
    } catch (error) {
      console.warn('数据库连接测试失败，集合可能不存在:', error);
    }
  }

  // 新增：按用户_openid查询鱼数据
  async getFishesByUserOpenid(openid, limit = 20) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法按用户查询鱼数据');
      return [];
    }

    if (!openid) {
      console.warn('openid为空，无法查询用户鱼数据');
      return [];
    }

    try {
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
    } catch (error) {
      console.error('按用户查询鱼数据失败:', error);
      return [];
    }
  }

  // 新增：随机获取用户鱼数据
  async getRandomFishesByUserOpenid(openid, count = 20) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法按用户查询随机鱼数据');
      return [];
    }

    if (!openid) {
      console.warn('openid为空，无法随机查询用户鱼数据');
      return [];
    }

    try {
      console.log(`随机查询用户 ${openid} 的 ${count} 条鱼数据`);

      // 先获取用户的所有鱼
      const allUserFishes = await this.cloudDb.collection('fishes')
        .where({
          _openid: openid  // 显式指定_openid条件
        })
        .get();

      console.log(`用户 ${openid} 共有 ${allUserFishes.data.length} 条鱼`);

      if (allUserFishes.data.length === 0) {
        return [];
      }

      // 如果用户鱼的数量少于请求数量，返回所有鱼
      if (allUserFishes.data.length <= count) {
        return allUserFishes.data;
      }

      // 随机选择指定数量的鱼
      const shuffled = [...allUserFishes.data].sort(() => 0.5 - Math.random());
      const selectedFishes = shuffled.slice(0, count);

      console.log(`随机选择了 ${selectedFishes.length} 条用户的鱼`);
      return selectedFishes;
    } catch (error) {
      console.error('随机查询用户鱼数据失败:', error);
      return [];
    }
  }

  // 新增：获取用户对某条鱼的交互记录
  async getUserInteraction(fishName) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法获取交互记录');
      return null;
    }

    try {
      const result = await this.cloudDb.collection('interaction')
        .where({
          fishName: fishName
          // 系统会自动添加 _openid 查询条件
        })
        .get();

      if (result.data.length > 0) {
        console.log(`找到用户对鱼 ${fishName} 的交互记录:`, result.data[0].action);
        return result.data[0];
      } else {
        console.log(`用户对鱼 ${fishName} 暂无交互记录`);
        return null;
      }
    } catch (error) {
      console.error('获取用户交互记录失败:', error);
      return null;
    }
  }

  // 新增：插入用户交互记录
  async insertUserInteraction(fishName, action) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法插入交互记录');
      return false;
    }

    try {
      const interactionData = {
        fishName: fishName,
        action: action,
        createdAt: new Date(),
        createTimestamp: Date.now()
        // 不需要包含 openid 字段，系统会自动添加 _openid
      };

      console.log('准备插入交互记录:', interactionData);

      const result = await this.cloudDb.collection('interaction').add({
        data: interactionData
      });

      console.log('交互记录插入成功:', result);
      return true;
    } catch (error) {
      console.error('插入交互记录失败:', error);
      return false;
    }
  }

  // 新增：更新用户交互记录
  async updateUserInteraction(interactionId, newAction) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法更新交互记录');
      return false;
    }

    try {
      const result = await this.cloudDb.collection('interaction').doc(interactionId).update({
        data: {
          action: newAction,
          updateTime: new Date()
        }
      });

      console.log('交互记录更新成功:', result);
      return true;
    } catch (error) {
      console.error('更新交互记录失败:', error);
      return false;
    }
  }

  // 新增：删除用户交互记录
  async deleteUserInteraction(interactionId) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法删除交互记录');
      return false;
    }

    try {
      const result = await this.cloudDb.collection('interaction').doc(interactionId).remove();
      console.log('交互记录删除成功:', result);
      return true;
    } catch (error) {
      console.error('删除交互记录失败:', error);
      return false;
    }
  }

  async getRandomFishesFromDatabase(count = 20) {
    if (!this.isCloudDbInitialized) return [];

    try {
      // 优先使用方法1：数据库真随机
      const result = await this.cloudDb.collection('fishes')
        .aggregate()
        .sample({ size: count })
        .end();

      console.log(`使用数据库真随机获取了 ${result.list.length} 条鱼数据`);
      return result.list;

    } catch (error) {
      console.warn('数据库真随机不支持，需要备选方案:', error);

      // 只有方法1失败时才需要方法2
      return await this.getRandomFishesFallback(count);
    }
  }

  async getRandomFishesFallback(count = 20) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法获取随机鱼数据');
      return [];
    }

    try {
      // 方法2：获取所有数据后随机选择
      const result = await this.cloudDb.collection('fishes')
        .limit(1000) // 限制最大获取数量
        .get();

      console.log(`备选方案获取了 ${result.data.length} 条鱼数据`);

      // 随机选择指定数量的鱼
      const shuffled = result.data.sort(() => 0.5 - Math.random());
      const selectedFishes = shuffled.slice(0, count);

      console.log(`备选方案随机选择了 ${selectedFishes.length} 条鱼`);
      return selectedFishes;
    } catch (error) {
      console.error('备选方案获取鱼数据失败:', error);
      return [];
    }
  }

  async getRankingData(limit = 100) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法获取排行榜数据');
      return [];
    }

    try {
      console.log(`开始获取排行榜数据，目标: ${limit} 条`);

      let allData = [];
      let skip = 0;
      const batchSize = 20; // 每次获取20条

      while (allData.length < limit) {
        const result = await this.cloudDb.collection('fishes')
          .orderBy('score', 'desc')
          .skip(skip)
          .limit(batchSize)
          .get();

        if (result.data.length === 0) {
          break; // 没有更多数据了
        }

        allData = allData.concat(result.data);
        skip += batchSize;

        console.log(`已获取 ${allData.length} 条数据`);
      }

      // 限制最终数量
      const finalData = allData.slice(0, limit);
      console.log(`最终获取 ${finalData.length} 条排行榜数据`);

      const validRankingData = finalData.filter(fish =>
        fish.base64 && fish.base64.length > 0
      );

      console.log(`有效数据: ${validRankingData.length} 条`);
      return validRankingData;
    } catch (error) {
      console.error('获取排行榜数据失败:', error);
      return [];
    }
  }

  // 新增：获取本周排行榜数据
  async getWeeklyRankingData(limit = 100, startOfWeek) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法获取本周排行榜数据');
      return [];
    }

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
          .orderBy('score', 'desc')
          .skip(skip)
          .limit(batchSize)
          .get();

        if (result.data.length === 0) {
          break; // 没有更多数据了
        }

        allData = allData.concat(result.data);
        skip += batchSize;

        console.log(`已获取 ${allData.length} 条本周数据`);
      }

      // 限制最终数量
      const finalData = allData.slice(0, limit);
      console.log(`最终获取 ${finalData.length} 条本周排行榜数据`);

      const validRankingData = finalData.filter(fish =>
        fish.base64 && fish.base64.length > 0
      );

      console.log(`有效本周数据: ${validRankingData.length} 条`);
      return validRankingData;
    } catch (error) {
      console.error('获取本周排行榜数据失败:', error);

      // 备选方案：如果时间筛选失败，返回空数组
      return [];
    }
  }

  // 向数据库插入鱼数据
  async insertFishToDatabase(fishData) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，跳过数据插入');
      return false;
    }

    try {
      console.log('准备插入鱼数据:', {
        ...fishData,
        base64: `base64数据长度: ${fishData.base64.length}`
      });

      const result = await this.cloudDb.collection('fishes').add({
        data: fishData
      });

      console.log('鱼数据插入成功:', result);
      return true;
    } catch (error) {
      console.error('数据库插入失败:', error);

      if (error.errCode === -502005) {
        console.log('检测到集合不存在，尝试使用备用方案...');
        return await this.insertWithBackupMethod(fishData);
      }

      return false;
    }
  }

  // 备用插入方法
  async insertWithBackupMethod(fishData) {
    try {
      const simpleFishData = {
        fish_name: fishData.fishName,
        score: 0,
        star_count: 0,
        unstar_count: 0,
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

  // 更新鱼的评分
  async updateFishScore(fishId, newScore, starCount, unstarCount) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法更新数据');
      return false;
    }

    try {
      console.log(`更新鱼 ${fishId} 的评分: score=${newScore}, star=${starCount}, unstar=${unstarCount}`);

      const result = await this.cloudDb.collection('fishes').doc(fishId).update({
        data: {
          score: newScore,
          star: starCount,
          unstar: unstarCount,
          updateTime: new Date()
        }
      });

      console.log('鱼评分更新成功:', result);
      return true;
    } catch (error) {
      console.error('更新鱼评分失败:', error);
      return false;
    }
  }

  // 新增：批量获取用户交互记录
  async getUserInteractionsBatch(fishNames) {
    if (!this.isCloudDbInitialized || !this.cloudDb || !fishNames || fishNames.length === 0) {
      console.warn('云数据库未初始化或鱼名列表为空，无法批量获取交互记录');
      return {};
    }

    try {
      // 使用IN查询批量获取交互记录
      const result = await this.cloudDb.collection('interaction')
        .where({
          fishName: this.cloudDb.command.in(fishNames)
          // 系统会自动添加 _openid 查询条件
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
}

module.exports = DatabaseManager;
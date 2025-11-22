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

  // 从数据库随机获取鱼数据
  async getRandomFishesFromDatabase(count = 20) {
    if (!this.isCloudDbInitialized || !this.cloudDb) {
      console.warn('云数据库未初始化，无法获取数据');
      return [];
    }

    try {
      console.log('开始从数据库获取随机鱼数据...');

      const countResult = await this.cloudDb.collection('fishes').count();
      const totalCount = countResult.total;

      console.log(`数据库中共有 ${totalCount} 条鱼数据`);

      if (totalCount === 0) {
        console.log('数据库中没有鱼数据');
        return [];
      }

      const actualCount = Math.min(count, totalCount);
      const skipCount = totalCount > actualCount ?
        Math.floor(Math.random() * (totalCount - actualCount)) : 0;

      console.log(`随机跳过 ${skipCount} 条记录，获取 ${actualCount} 条鱼数据`);

      const result = await this.cloudDb.collection('fishes')
        .skip(skipCount)
        .limit(actualCount)
        .field({
          fishName: true,
          createdAt: true,
          score: true,
          star: true,
          unstar: true,
          base64: true,
          fishid: true,
          _id: true
        })
        .get();

      console.log(`成功获取 ${result.data.length} 条鱼数据`);

      const validFishes = result.data.filter(fish =>
        fish.base64 && fish.base64.length > 0
      );

      console.log(`其中 ${validFishes.length} 条有有效的base64数据`);

      return validFishes;
    } catch (error) {
      console.error('从数据库获取鱼数据失败:', error);
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
        uid: 12345,
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
}

module.exports = DatabaseManager;
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
        const interaction = result.data[0];
        console.log(`找到用户对鱼 ${fishName} 的交互记录:`, interaction.action);
        
        // 兼容处理：确保同时包含action字段和liked/disliked字段
        if (interaction.action) {
          // 如果有action字段，基于它设置liked/disliked
          interaction.liked = interaction.action === 'star';
          interaction.disliked = interaction.action === 'unstar';
        } else if (interaction.liked !== undefined || interaction.disliked !== undefined) {
          // 如果有liked/disliked字段，基于它们设置action
          if (interaction.liked) {
            interaction.action = 'star';
          } else if (interaction.disliked) {
            interaction.action = 'unstar';
          }
        }
        
        return interaction;
      } else {
        console.log(`用户对鱼 ${fishName} 暂无交互记录`);
        return null;
      }
    }, null);
  }

  // 优化：插入用户交互记录 - 先检查是否已存在
  async insertUserInteraction(fishName, action, userOpenid) {
    return this._executeDatabaseOperation('插入交互记录', async () => {
      if (!userOpenid) {
        Utils.handleWarning('', '用户openid为空，无法插入交互记录');
        return false;
      }

      // 1. 先检查是否已存在相同交互记录
      const existingInteraction = await this.getUserInteraction(fishName, userOpenid);

      if (existingInteraction) {
        console.log(`用户已存在对鱼 ${fishName} 的交互记录，无需重复插入`);
        return false; // 返回false表示不需要插入新记录
      }

      // 2. 插入新记录 - 兼容处理：同时包含action字段和liked/disliked字段
      const interactionData = {
        fishName: fishName,
        action: action,
        createdAt: new Date(),
        createTimestamp: Date.now()
      };
      
      // 添加liked/disliked字段以确保兼容性
      if (action === 'star') {
        interactionData.liked = true;
        interactionData.disliked = false;
      } else if (action === 'unstar') {
        interactionData.liked = false;
        interactionData.disliked = true;
      }

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

  async getRankingData(limit = 100, sortType = 'latest') {
    if (!Utils.checkDatabaseInitialization(this, '获取排行榜数据')) return [];

    try {
      console.log(`开始获取排行榜数据，目标: ${limit} 条，排序类型: ${sortType}`);

      let allData = [];
      let skip = 0;
      const batchSize = 20; // 每次获取20条

      while (allData.length < limit) {
        let query = this.cloudDb.collection('fishes');

        // 根据排序类型设置不同的排序字段
        switch (sortType) {
          case 'best': // 从comment集合读取score，按从大到小排序（最佳榜）
            // 先获取所有有评论的鱼，按score降序排列
            const commentResult = await this.cloudDb.collection('comment')
              .orderBy('score', 'desc')
              .limit(limit)
              .get();
            
            // 提取鱼名列表
            const fishNames = commentResult.data.map(comment => comment.fishName);
            
            // 根据鱼名查询对应的鱼数据
            if (fishNames.length > 0) {
              const fishResult = await this.cloudDb.collection('fishes')
                .where({
                  fishName: this.cloudDb.command.in(fishNames)
                })
                .get();
              
              // 按照comment中的score排序鱼数据
              const fishMap = {};
              fishResult.data.forEach(fish => {
                fishMap[fish.fishName] = fish;
              });
              
              const sortedFishes = [];
              commentResult.data.forEach(comment => {
                if (fishMap[comment.fishName]) {
                  sortedFishes.push({
                    ...fishMap[comment.fishName],
                    score: comment.score // 使用comment集合中的score
                  });
                }
              });
              
              allData = sortedFishes;
            }
            break;
            
          case 'worst': // 从comment集合读取score，按从小到大排序（最丑榜）
            // 先获取所有有评论的鱼，按score升序排列
            const worstCommentResult = await this.cloudDb.collection('comment')
              .orderBy('score', 'asc')
              .limit(limit)
              .get();
            
            // 提取鱼名列表
            const worstFishNames = worstCommentResult.data.map(comment => comment.fishName);
            
            // 根据鱼名查询对应的鱼数据
            if (worstFishNames.length > 0) {
              const worstFishResult = await this.cloudDb.collection('fishes')
                .where({
                  fishName: this.cloudDb.command.in(worstFishNames)
                })
                .get();
              
              // 按照comment中的score排序鱼数据
              const worstFishMap = {};
              worstFishResult.data.forEach(fish => {
                worstFishMap[fish.fishName] = fish;
              });
              
              const sortedWorstFishes = [];
              worstCommentResult.data.forEach(comment => {
                if (worstFishMap[comment.fishName]) {
                  sortedWorstFishes.push({
                    ...worstFishMap[comment.fishName],
                    score: comment.score // 使用comment集合中的score
                  });
                }
              });
              
              allData = sortedWorstFishes;
            }
            break;
            
          case 'latest': // 创作时间最新（最新榜）
          default:
            query = query.orderBy('createTimestamp', 'desc');
            const latestResult = await query
              .skip(skip)
              .limit(batchSize)
              .get();
            if (latestResult.data.length === 0) break;
            allData = allData.concat(latestResult.data);
            skip += batchSize;
            break;
        }

        if (sortType === 'best' && allData.length > 0) {
          break; // 最佳榜已经通过一次性查询获取了所有数据
        }

        console.log(`已获取 ${allData.length} 条数据`);
        
        if (allData.length >= limit) break;
      }

      // 限制最终数量并过滤有效数据
      const finalData = allData.slice(0, limit);
      const validRankingData = finalData.filter(fish => fish.base64 && fish.base64.length > 0);

      console.log(`最终获取 ${validRankingData.length} 条有效排行榜数据，排序类型: ${sortType}`);
      return validRankingData;
    } catch (error) {
      return Utils.handleDatabaseError(error, '获取排行榜数据', []);
    }
  }

  // 修改：分页获取排行榜数据，支持从comment集合读取score
  async getRankingDataPage(page = 0, pageSize = 20, sortType = 'latest') {
    if (!Utils.checkDatabaseInitialization(this, '获取排行榜分页数据')) return { data: [], hasMore: false };

    try {
      console.log(`获取排行榜第${page+1}页，每页${pageSize}条，排序类型: ${sortType}`);

      let result;
      
      // 根据排序类型使用不同的查询逻辑
      if (sortType === 'best' || sortType === 'worst') {
        // 最佳榜或最丑榜：从comment集合读取score
        const order = sortType === 'best' ? 'desc' : 'asc';
        const orderText = sortType === 'best' ? '从大到小' : '从小到大';
        
        console.log(`从comment集合按score ${orderText}排序获取数据`);
        
        const commentResult = await this.cloudDb.collection('comment')
          .orderBy('score', order)
          .skip(page * pageSize)
          .limit(pageSize)
          .get();
        
        // 提取鱼名列表
        const fishNames = commentResult.data.map(comment => comment.fishName);
        
        if (fishNames.length === 0) {
          return { data: [], hasMore: false };
        }
        
        // 根据鱼名查询对应的鱼数据
        const fishResult = await this.cloudDb.collection('fishes')
          .where({
            fishName: this.cloudDb.command.in(fishNames)
          })
          .get();
        
        // 按照comment中的score排序鱼数据
        const fishMap = {};
        fishResult.data.forEach(fish => {
          fishMap[fish.fishName] = fish;
        });
        
        const sortedFishes = [];
        commentResult.data.forEach(comment => {
          if (fishMap[comment.fishName]) {
            sortedFishes.push({
              ...fishMap[comment.fishName],
              score: comment.score // 使用comment集合中的score
            });
          }
        });
        
        result = { data: sortedFishes };
      } else {
        // 其他排序类型：使用原有逻辑
        let query = this.cloudDb.collection('fishes');
        
        switch (sortType) {
          case 'latest': // 创作时间最新（最新榜）
          default:
            query = query.orderBy('createTimestamp', 'desc');
            break;
        }
        
        result = await query
          .skip(page * pageSize)
          .limit(pageSize)
          .get();
      }

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

  // 新增：插入房间绘画数据
  async insertDrawingData(drawingData) {
    if (!Utils.checkDatabaseInitialization(this, '插入房间绘画数据')) return false;

    try {
      console.log('准备插入房间绘画数据:', drawingData);

      await this.cloudDb.collection('drawing').add({
        data: drawingData
      });

      console.log('房间绘画数据插入成功');
      return true;
    } catch (error) {
      return Utils.handleDatabaseError(error, '插入房间绘画数据', false);
    }
  }

  // 新增：为房间创建初始绘画数据（房主和协作者记录）
  async createInitialDrawingData(roomId, homeownerOpenid) {
    if (!Utils.checkDatabaseInitialization(this, '创建房间初始绘画数据')) return false;

    try {
      // 创建房主绘画数据
      const homeownerData = {
        roomId: roomId,
        role: "homeowner",
        uid: homeownerOpenid,
        operationType: "",
        trace: [],
        color: "#ff0000",
        lineWidth: 3,
        createdAt: new Date()
      };

      // 创建协作者绘画数据
      const teamworkerData = {
        roomId: roomId,
        role: "teamworker",
        uid: "", // 初始化为空，将来是协作者的_openid
        operationType: "",
        trace: [],
        color: "#ff0000",
        lineWidth: 3,
        createdAt: new Date()
      };

      // 批量插入两条记录
      await this.cloudDb.collection('drawing').add({
        data: homeownerData
      });

      await this.cloudDb.collection('drawing').add({
        data: teamworkerData
      });

      console.log(`房间 ${roomId} 的初始绘画数据创建成功`);
      return true;
    } catch (error) {
      return Utils.handleDatabaseError(error, '创建房间初始绘画数据', false);
    }
  }

  // 新增：监听房间协作者数据变化
  async watchTeamworkerData(roomId, callback) {
    if (!Utils.checkDatabaseInitialization(this, '监听协作者数据')) return null;

    try {
      console.log(`开始监听房间 ${roomId} 的协作者数据变化`);
      
      // 使用数据库的watch功能监听指定房间的teamworker数据变化
      const watch = this.cloudDb.collection('drawing').where({
        roomId: roomId,
        role: 'teamworker'
      }).watch({
        onChange: (snapshot) => {
          console.log('监听到协作者数据变化:', snapshot, 'type:', snapshot.type);
          
          // 处理不同类型的变更
          if (snapshot.type === 'update' && snapshot.updated && snapshot.updated.length > 0) {
            // 检查uid字段是否从空变为非空（表示有队友加入）
            const updatedDoc = snapshot.updated[0];
            console.log('更新文档检查:', updatedDoc);
            if (updatedDoc && updatedDoc.uid && updatedDoc.uid !== '') {
              console.log(`队友已加入房间 ${roomId}: ${updatedDoc.uid}`);
              callback(true, updatedDoc.uid);
            }
          } else if (snapshot.type === 'init') {
            // 初始化时检查当前状态
            console.log('监听初始化完成，检查当前协作者状态');
            this.checkCurrentTeamworkerStatus(roomId, callback);
          } else if (!snapshot.type || snapshot.type === '') {
            // 微信云开发可能type为空或undefined，检查docs中的最新数据
            console.log('处理无类型变化，检查docs数据:', snapshot.docs);
            if (snapshot.docs && snapshot.docs.length > 0) {
              const latestDoc = snapshot.docs[0];
              if (latestDoc.uid && latestDoc.uid !== '') {
                console.log(`队友已加入房间 ${roomId}: ${latestDoc.uid}`);
                callback(true, latestDoc.uid);
              }
            }
          } else if (snapshot.docChanges && snapshot.docChanges.length > 0) {
            // 处理文档变化事件（可能type为undefined的情况）
            console.log('处理文档变化事件:', snapshot.docChanges);
            const change = snapshot.docChanges[0];
            if (change.dataType === 'update' && change.doc) {
              const updatedDoc = change.doc;
              if (updatedDoc.uid && updatedDoc.uid !== '') {
                console.log(`队友已加入房间 ${roomId}: ${updatedDoc.uid}`);
                callback(true, updatedDoc.uid);
              }
            }
          }
        },
        onError: (error) => {
          console.error('监听协作者数据出错:', error);
          callback(false, null, error);
        }
      });

      console.log('协作者数据监听已启动');
      return watch;
    } catch (error) {
      console.error('启动协作者数据监听失败:', error);
      callback(false, null, error);
      return null;
    }
  }

  // 新增：检查当前协作者状态
  async checkCurrentTeamworkerStatus(roomId, callback) {
    try {
      const result = await this.cloudDb.collection('drawing')
        .where({
          roomId: roomId,
          role: 'teamworker'
        })
        .get();

      if (result.data.length > 0) {
        const teamworkerData = result.data[0];
        if (teamworkerData.uid && teamworkerData.uid !== '') {
          console.log(`当前协作者状态: 已加入房间 ${roomId}: ${teamworkerData.uid}`);
          callback(true, teamworkerData.uid);
        } else {
          console.log(`当前协作者状态: 未加入房间 ${roomId}`);
        }
      }
    } catch (error) {
      console.error('检查当前协作者状态失败:', error);
    }
  }

  // 新增：停止监听协作者数据变化
  async stopWatchingTeamworkerData(watchInstance) {
    if (watchInstance && watchInstance.close) {
      try {
        await watchInstance.close();
        console.log('协作者数据监听已停止');
      } catch (error) {
        console.error('停止协作者数据监听失败:', error);
      }
    }
  }

  // 新增：检查协作者是否已加入房间
  async checkTeamworkerJoined(roomId) {
    if (!Utils.checkDatabaseInitialization(this, '检查协作者状态')) return false;

    try {
      const result = await this.cloudDb.collection('drawing')
        .where({
          roomId: roomId,
          role: 'teamworker'
        })
        .get();

      if (result.data.length > 0) {
        const teamworkerData = result.data[0];
        const isJoined = teamworkerData.uid && teamworkerData.uid !== '';
        console.log(`房间 ${roomId} 协作者状态: ${isJoined ? '已加入' : '未加入'}`);
        return isJoined;
      }
      
      return false;
    } catch (error) {
      console.error('检查协作者状态失败:', error);
      return false;
    }
  }

  // 新增：更新房间绘画数据（用于实时同步）- 使用云函数
  async updateDrawingData(roomId, role, updateData) {
    if (!Utils.checkDatabaseInitialization(this, '更新房间绘画数据')) return false;

    try {
      // 先尝试直接更新（对于房主操作）
      if (role === 'homeowner') {
        // 先查询对应的记录
        const result = await this.cloudDb.collection('drawing')
          .where({
            roomId: roomId,
            role: role
          })
          .get();

        if (result.data.length === 0) {
          console.warn(`未找到房间 ${roomId} 角色 ${role} 的绘画数据`);
          return false;
        }

        // 更新记录
        const updateResult = await this.cloudDb.collection('drawing')
          .doc(result.data[0]._id)
          .update({
            data: {
              ...updateData,
              lastUpdated: new Date()
            }
          });

        if (updateResult.stats.updated > 0) {
          console.log(`房间 ${roomId} 角色 ${role} 绘画数据更新成功`);
          return true;
        } else {
          console.warn(`房间 ${roomId} 角色 ${role} 绘画数据更新失败`);
          return false;
        }
      } else {
        // 对于协作者操作，使用云函数更新
        console.log(`使用云函数更新协作者数据: 房间${roomId}, 角色${role}`);
        
        // 调用云函数更新绘画数据
        const cloudFunctionResult = await wx.cloud.callFunction({
          name: 'updateDrawingData',
          data: {
            roomId: roomId,
            role: role,
            operationType: updateData.operationType || 'draw',
            trace: updateData.trace,
            color: updateData.color,
            lineWidth: updateData.lineWidth
          }
        });
        
        if (cloudFunctionResult.result && cloudFunctionResult.result.success) {
          console.log(`云函数更新绘画数据成功`);
          return true;
        } else {
          console.error(`云函数更新绘画数据失败:`, cloudFunctionResult.result);
          return false;
        }
      }
    } catch (error) {
      console.error('更新房间绘画数据失败:', error);
      return false;
    }
  }

  // 新增：获取房间绘画数据（用于同步）
  async getDrawingData(roomId, role) {
    if (!Utils.checkDatabaseInitialization(this, '获取房间绘画数据')) return null;

    try {
      const result = await this.cloudDb.collection('drawing')
        .where({
          roomId: roomId,
          role: role
        })
        .get();

      if (result.data.length > 0) {
        console.log(`获取到房间 ${roomId} 角色 ${role} 的绘画数据`);
        return result.data[0];
      } else {
        console.warn(`未找到房间 ${roomId} 角色 ${role} 的绘画数据`);
        return null;
      }
    } catch (error) {
      console.error('获取房间绘画数据失败:', error);
      return null;
    }
  }

  // 新增：删除房间所有相关数据
  async deleteRoomData(roomId) {
    if (!Utils.checkDatabaseInitialization(this, '删除房间数据')) return false;

    try {
      console.log(`开始删除房间 ${roomId} 的所有相关数据`);

      // 查询所有与该房间相关的数据
      const result = await this.cloudDb.collection('drawing')
        .where({
          roomId: roomId
        })
        .get();

      if (result.data.length === 0) {
        console.warn(`未找到房间 ${roomId} 的相关数据`);
        return true; // 没有数据也算删除成功
      }

      // 删除所有相关数据
      const deletePromises = result.data.map(async (doc) => {
        return await this.cloudDb.collection('drawing').doc(doc._id).remove();
      });

      await Promise.all(deletePromises);

      console.log(`成功删除房间 ${roomId} 的 ${result.data.length} 条相关数据`);
      return true;
    } catch (error) {
      console.error('删除房间数据失败:', error);
      return false;
    }
  }

  // 新增：查询用户对指定鱼的点赞/点踩状态
  async getUserInteractionStatus(fishNames, openid) {
    if (!Utils.checkDatabaseInitialization(this, '查询用户交互状态')) return {};
    
    if (!fishNames || fishNames.length === 0 || !openid) {
      console.log('无效的查询参数，跳过用户交互状态查询');
      return {};
    }

    try {
      console.log(`查询用户 ${openid} 对 ${fishNames.length} 条鱼的交互状态`);

      const result = await this.cloudDb.collection('interaction')
        .where({
          fishName: this.cloudDb.command.in(fishNames),
          _openid: openid
        })
        .get();

      // 构建鱼名到交互状态的映射 - 兼容action字段和liked/disliked字段
      const interactionMap = {};
      result.data.forEach(interaction => {
        // 兼容处理：确保同时包含action字段和liked/disliked字段
        let liked = false;
        let disliked = false;
        
        if (interaction.action) {
          // 如果有action字段，基于它设置liked/disliked
          liked = interaction.action === 'star';
          disliked = interaction.action === 'unstar';
        } else if (interaction.liked !== undefined || interaction.disliked !== undefined) {
          // 如果有liked/disliked字段，直接使用
          liked = interaction.liked || false;
          disliked = interaction.disliked || false;
        }
        
        interactionMap[interaction.fishName] = {
          liked: liked,
          disliked: disliked,
          action: interaction.action || (liked ? 'star' : (disliked ? 'unstar' : null))
        };
      });

      console.log(`成功查询到 ${result.data.length} 条交互记录`);
      return interactionMap;
    } catch (error) {
      return Utils.handleDatabaseError(error, '查询用户交互状态', {});
    }
  }
}

module.exports = DatabaseManager;
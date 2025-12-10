// testDatabaseConsistency.js - 数据库一致性测试脚本
// 此脚本用于测试comment集合和fishes集合的fishName字段一致性

const DatabaseManager = require('./databaseManager.js');

class DatabaseConsistencyTest {
  constructor() {
    this.dbManager = new DatabaseManager();
  }

  // 执行一致性测试
  async runConsistencyTest() {
    console.log('=== 数据库一致性测试开始 ===');
    
    // 等待数据库初始化完成
    await this.waitForDatabaseInit();
    
    try {
      // 获取两个集合的fishName列表
      const commentFishNames = await this.getFishNamesFromComments();
      const fishesFishNames = await this.getFishNamesFromFishes();
      
      // 进行数据比对
      this.compareFishNames(commentFishNames, fishesFishNames);
      
    } catch (error) {
      console.error('测试执行失败:', error);
    }
    
    console.log('=== 数据库一致性测试结束 ===');
  }

  // 等待数据库初始化完成
  async waitForDatabaseInit() {
    let retryCount = 0;
    const maxRetries = 10;
    
    while (!this.dbManager.isCloudDbInitialized && retryCount < maxRetries) {
      console.log(`等待数据库初始化... (${retryCount + 1}/${maxRetries})`);
      await this.sleep(500);
      retryCount++;
    }
    
    if (!this.dbManager.isCloudDbInitialized) {
      throw new Error('数据库初始化超时');
    }
    
    console.log('数据库初始化完成，开始测试');
  }

  // 从comment集合获取所有fishName
  async getFishNamesFromComments() {
    console.log('正在读取comment集合...');
    
    try {
      // 使用分页查询获取所有文档
      const MAX_LIMIT = 20; // 改为每批20条，确保分批查询正常工作
      const countResult = await this.dbManager.cloudDb.collection('comment').count();
      const total = countResult.total;
      console.log(`comment集合总记录数: ${total}`);
      
      // 计算需要分多少次查询
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      const allData = [];
      
      // 分批次获取数据
      for (let i = 0; i < batchTimes; i++) {
        console.log(`正在获取comment集合第${i+1}/${batchTimes}批次数据...`);
        const skip = i * MAX_LIMIT;
        const result = await this.dbManager.cloudDb.collection('comment')
          .skip(skip)
          .limit(MAX_LIMIT)
          .get();
        
        allData.push(...result.data);
        console.log(`已获取comment集合第${i+1}批次数据，本批${result.data.length}条，当前总计: ${allData.length}条`);
      }
      
      // 提取fishName，并过滤掉空值
      const fishNames = allData
        .map(item => item.fishName)
        .filter(name => name && name.trim() !== ''); // 过滤空值和空字符串
      
      // 去重
      const uniqueFishNames = [...new Set(fishNames)];
      
      console.log(`comment集合中共获取 ${allData.length} 条评论，包含 ${uniqueFishNames.length} 个不同的fishName`);
      
      // 打印前5个fishName作为调试信息
      if (uniqueFishNames.length > 0) {
        console.log('comment集合前5个fishName示例:', uniqueFishNames.slice(0, 5));
      }
      
      return uniqueFishNames;
    } catch (error) {
      console.error('读取comment集合失败:', error);
      return [];
    }
  }

  // 从fishes集合获取所有fishName
  async getFishNamesFromFishes() {
    console.log('正在读取fishes集合...');
    
    try {
      // 使用分页查询获取所有文档
      const MAX_LIMIT = 20; // 改为每批20条，确保分批查询正常工作
      const countResult = await this.dbManager.cloudDb.collection('fishes').count();
      const total = countResult.total;
      console.log(`fishes集合总记录数: ${total}`);
      
      // 计算需要分多少次查询
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      const allData = [];
      
      // 分批次获取数据
      for (let i = 0; i < batchTimes; i++) {
        console.log(`正在获取fishes集合第${i+1}/${batchTimes}批次数据...`);
        const skip = i * MAX_LIMIT;
        const result = await this.dbManager.cloudDb.collection('fishes')
          .skip(skip)
          .limit(MAX_LIMIT)
          .get();
        
        allData.push(...result.data);
        console.log(`已获取fishes集合第${i+1}批次数据，本批${result.data.length}条，当前总计: ${allData.length}条`);
      }
      
      // 提取fishName，并过滤掉空值
      const fishNames = allData
        .map(item => item.fishName)
        .filter(name => name && name.trim() !== ''); // 过滤空值和空字符串
      
      // 去重
      const uniqueFishNames = [...new Set(fishNames)];
      
      console.log(`fishes集合中共获取 ${allData.length} 条鱼数据，包含 ${uniqueFishNames.length} 个不同的fishName`);
      
      // 打印前5个fishName作为调试信息
      if (uniqueFishNames.length > 0) {
        console.log('fishes集合前5个fishName示例:', uniqueFishNames.slice(0, 5));
      }
      
      return uniqueFishNames;
    } catch (error) {
      console.error('读取fishes集合失败:', error);
      return [];
    }
  }

  // 比对两个fishName列表
  compareFishNames(commentFishNames, fishesFishNames) {
    console.log('\n=== 数据比对结果 ===');
    
    // 创建Set便于操作
    const commentSet = new Set(commentFishNames);
    const fishesSet = new Set(fishesFishNames);
    
    // 计算交集
    const intersection = commentFishNames.filter(name => fishesSet.has(name));
    console.log('\n【交集】两个集合中都存在的fishName:');
    console.log(`总数: ${intersection.length}`);
    if (intersection.length > 0) {
      console.log(intersection.join(', '));
    }
    
    // 计算差集：comment有而fishes没有
    const commentOnly = commentFishNames.filter(name => !fishesSet.has(name));
    console.log('\n【差集1】comment集合有而fishes集合没有的fishName:');
    console.log(`总数: ${commentOnly.length}`);
    if (commentOnly.length > 0) {
      console.log(commentOnly.join(', '));
    }
    
    // 计算差集：fishes有而comment没有
    const fishesOnly = fishesFishNames.filter(name => !commentSet.has(name));
    console.log('\n【差集2】fishes集合有而comment集合没有的fishName:');
    console.log(`总数: ${fishesOnly.length}`);
    if (fishesOnly.length > 0) {
      console.log(fishesOnly.join(', '));
    }
    
    // 生成总结报告
    console.log('\n【总结报告】');
    console.log(`comment集合: ${commentFishNames.length} 个不同fishName`);
    console.log(`fishes集合: ${fishesFishNames.length} 个不同fishName`);
    console.log(`交集数量: ${intersection.length}`);
    console.log(`不一致数量: ${commentOnly.length + fishesOnly.length}`);
    
    if (commentOnly.length > 0) {
      console.warn(`⚠️ 警告: 存在 ${commentOnly.length} 个fishName在comment集合中但没有对应的鱼数据`);
    }
    
    if (fishesOnly.length > 0) {
      console.log(`ℹ️ 信息: 有 ${fishesOnly.length} 个fishName在fishes集合中但没有任何评论`);
    }
  }

  // 简单的延时函数
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出测试类
module.exports = DatabaseConsistencyTest;
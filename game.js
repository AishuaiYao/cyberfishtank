// 游戏主逻辑
class Game {
    constructor() {
      this.userScore = 0;
      this.rankingList = [];
      console.log('游戏初始化完成');
    }
  
    // 保存用户得分
    saveUserScore(score, fishData) {
      this.userScore = score;
      const userRecord = {
        score: score,
        fishData: fishData,
        timestamp: Date.now()
      };
      
      // 获取现有排行榜
      try {
        const existingList = wx.getStorageSync('rankingList') || [];
        existingList.push(userRecord);
        
        // 按分数排序
        existingList.sort((a, b) => b.score - a.score);
        
        // 只保留前10名
        this.rankingList = existingList.slice(0, 10);
        wx.setStorageSync('rankingList', this.rankingList);
        console.log('用户得分已保存:', score);
      } catch (error) {
        console.error('保存得分失败:', error);
      }
    }
  
    // 获取排行榜
    getRankingList() {
      try {
        this.rankingList = wx.getStorageSync('rankingList') || [];
        console.log('排行榜数据加载成功，共', this.rankingList.length, '条记录');
        return this.rankingList;
      } catch (error) {
        console.error('获取排行榜失败:', error);
        return [];
      }
    }
  }
  
  // 创建游戏实例
  const game = new Game();
  
  // 导出给其他页面使用
  module.exports = game;
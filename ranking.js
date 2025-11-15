// ranking.js - 排行榜功能
const Ranking = {
    canvas: null,
    ctx: null,
    rankings: [],
    
    init() {
      console.log('排行榜模块初始化');
      this.canvas = wx.createCanvas();
      this.ctx = this.canvas.getContext('2d');
      
      // 模拟排行榜数据
      this.rankings = [
        { name: '玩家1', score: 95 },
        { name: '玩家2', score: 88 },
        { name: '玩家3', score: 76 },
        { name: '玩家4', score: 65 },
        { name: '玩家5', score: 54 }
      ];
    },
    
    show() {
      console.log('显示排行榜');
      
      // 设置画布尺寸
      const systemInfo = wx.getSystemInfoSync();
      this.canvas.width = systemInfo.windowWidth;
      this.canvas.height = systemInfo.windowHeight;
      
      this.render();
      
      // 添加返回按钮
      this.addBackButton();
    },
    
    render() {
      // 清空画布
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // 绘制背景
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // 绘制标题
      this.ctx.fillStyle = '#000000';
      this.ctx.font = 'bold 24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('排行榜', this.canvas.width / 2, 60);
      
      // 绘制排行榜列表
      const startY = 100;
      const rowHeight = 40;
      
      for (let i = 0; i < this.rankings.length; i++) {
        const ranking = this.rankings[i];
        const y = startY + i * rowHeight;
        
        // 绘制背景
        if (i % 2 === 0) {
          this.ctx.fillStyle = '#F5F5F5';
          this.ctx.fillRect(0, y, this.canvas.width, rowHeight);
        }
        
        // 绘制排名
        this.ctx.fillStyle = '#000000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${i + 1}.`, 20, y + rowHeight / 2 + 5);
        
        // 绘制玩家名称
        this.ctx.fillText(ranking.name, 60, y + rowHeight / 2 + 5);
        
        // 绘制分数
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`${ranking.score}分`, this.canvas.width - 20, y + rowHeight / 2 + 5);
      }
      
      // 绘制返回按钮
      this.drawBackButton();
    },
    
    addBackButton() {
      // 触摸事件处理在Game模块中统一处理
    },
    
    drawBackButton() {
      const buttonWidth = 80;
      const buttonHeight = 25;
      const x = 20;
      const y = 30;
      
      // 按钮背景
      this.ctx.fillStyle = '#4CAF50';
      this.ctx.fillRect(x, y, buttonWidth, buttonHeight);
      
      // 按钮边框
      this.ctx.strokeStyle = '#388E3C';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, buttonWidth, buttonHeight);
      
      // 按钮文字
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('返回首页', x + buttonWidth / 2, y + buttonHeight / 2);
    },
    
    isBackButtonClicked(x, y) {
      const buttonWidth = 80;
      const buttonHeight = 25;
      const buttonX = 20;
      const buttonY = 30;
      
      return x >= buttonX && x <= buttonX + buttonWidth && 
             y >= buttonY && y <= buttonY + buttonHeight;
    }
  };
  
  module.exports = Ranking;
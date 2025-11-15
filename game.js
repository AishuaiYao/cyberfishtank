// game.js - 主游戏逻辑
const Game = {
    canvas: null,
    ctx: null,
    currentScreen: 'home',
    screenWidth: 0,
    screenHeight: 0,
    
    init() {
      console.log('游戏初始化开始');
      
      // 获取系统信息
      const systemInfo = wx.getSystemInfoSync();
      this.screenWidth = systemInfo.windowWidth;
      this.screenHeight = systemInfo.windowHeight;
      
      // 创建画布
      this.canvas = wx.createCanvas();
      this.ctx = this.canvas.getContext('2d');
      
      // 设置画布尺寸
      this.canvas.width = this.screenWidth;
      this.canvas.height = this.screenHeight;
      
      console.log(`屏幕尺寸: ${this.screenWidth}x${this.screenHeight}`);
      
      // 初始化各个模块
      Paint.init(this.canvas, this.ctx);
      FishTank.init();
      Ranking.init();
      
      // 绘制首页
      this.renderHome();
      
      console.log('游戏初始化完成');
    },
    
    renderHome() {
      console.log('渲染首页');
      this.currentScreen = 'home';
      
      // 清空画布
      this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
      
      // 绘制功能区
      this.drawFunctionArea();
      
      // 绘制指示区
      this.drawInstructionArea();
      
      // 绘制绘画区
      this.drawPaintArea();
      
      // 绘制跳转区
      this.drawNavigationArea();
    },
    
    drawFunctionArea() {
      const startY = 30; // 避开通知栏
      const partHeight = 30;
      
      // Part 1: 颜色选择圆圈
      const colors = ['#000000', '#FF0000', '#00FF00', '#800080', '#FFFF00', '#FFA500', '#FFFFFF'];
      const circleDiameter = 20;
      const totalWidth = (colors.length - 1) * 40; // 圆圈间距
      const startX = (this.screenWidth - totalWidth) / 2;
      
      for (let i = 0; i < colors.length; i++) {
        const x = startX + i * 40;
        const y = startY + partHeight / 2;
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, circleDiameter / 2, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        if (colors[i] !== '#FFFFFF') {
          this.ctx.fillStyle = colors[i];
          this.ctx.fill();
        }
      }
      
      // Part 2: 画笔大小控制
      const sizeTextY = startY + partHeight + partHeight / 2;
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '16px Arial';
      this.ctx.fillText('Size:', 20, sizeTextY);
      
      // Part 3: 功能按钮
      const buttonY = startY + partHeight * 2 + partHeight / 2;
      const buttons = ['Eraser', 'Undo', 'Clear', 'Flip'];
      const buttonWidth = 50;
      const buttonHeight = 25;
      const spacing = (this.screenWidth - buttons.length * buttonWidth) / (buttons.length + 1);
      
      for (let i = 0; i < buttons.length; i++) {
        const x = spacing + i * (buttonWidth + spacing);
        this.drawButton(x, buttonY, buttonWidth, buttonHeight, buttons[i]);
      }
    },
    
    drawInstructionArea() {
      const startY = 120; // 功能区高度90 + 顶部30
      
      this.ctx.fillStyle = '#000000';
      this.ctx.font = 'bold 20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('画一条鱼吧!', this.screenWidth / 2, startY + 20);
      this.ctx.fillText('鱼头请朝右', this.screenWidth / 2, startY + 60);
      this.ctx.textAlign = 'left';
    },
    
    drawPaintArea() {
      const startY = 210; // 指示区高度90 + 上面区域
      const height = 180;
      const margin = 20;
      
      this.ctx.strokeStyle = '#CCCCCC';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(margin, startY, this.screenWidth - 2 * margin, height);
      
      // 初始化绘画区域
      Paint.setPaintArea(margin, startY, this.screenWidth - 2 * margin, height);
    },
    
    drawNavigationArea() {
      const startY = 400; // 绘画区高度180 + 上面区域
      const buttonWidth = 80;
      const buttonHeight = 25;
      const spacing = 20;
      
      const totalWidth = buttonWidth * 3 + spacing * 2;
      const startX = (this.screenWidth - totalWidth) / 2;
      
      this.drawButton(startX, startY, buttonWidth, buttonHeight, '鱼缸');
      this.drawButton(startX + buttonWidth + spacing, startY, buttonWidth, buttonHeight, '让它游起来！');
      this.drawButton(startX + (buttonWidth + spacing) * 2, startY, buttonWidth, buttonHeight, '排行榜');
    },
    
    drawButton(x, y, width, height, text) {
      // 按钮背景
      this.ctx.fillStyle = '#4CAF50';
      this.ctx.fillRect(x, y, width, height);
      
      // 按钮边框
      this.ctx.strokeStyle = '#388E3C';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, width, height);
      
      // 按钮文字
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(text, x + width / 2, y + height / 2);
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'alphabetic';
    },
    
    handleTouchStart(x, y) {
      console.log(`触摸开始: (${x}, ${y})`);
      
      if (this.currentScreen === 'home') {
        // 检查是否点击了功能按钮
        if (this.checkButtonClick(x, y)) {
          return;
        }
        
        // 传递到绘画模块
        Paint.handleTouchStart(x, y);
      }
    },
    
    handleTouchMove(x, y) {
      if (this.currentScreen === 'home') {
        Paint.handleTouchMove(x, y);
      }
    },
    
    handleTouchEnd(x, y) {
      if (this.currentScreen === 'home') {
        Paint.handleTouchEnd(x, y);
      }
    },
    
    checkButtonClick(x, y) {
      const buttonHeight = 25;
      const navigationY = 400;
      
      // 检查跳转区按钮
      if (y >= navigationY && y <= navigationY + buttonHeight) {
        const buttonWidth = 80;
        const spacing = 20;
        const totalWidth = buttonWidth * 3 + spacing * 2;
        const startX = (this.screenWidth - totalWidth) / 2;
        
        if (x >= startX && x <= startX + buttonWidth) {
          console.log('点击了鱼缸按钮');
          // 鱼缸功能暂不处理
          return true;
        }
        
        if (x >= startX + buttonWidth + spacing && x <= startX + buttonWidth * 2 + spacing) {
          console.log('点击了让它游起来按钮');
          this.handleMakeItSwim();
          return true;
        }
        
        if (x >= startX + (buttonWidth + spacing) * 2 && x <= startX + (buttonWidth + spacing) * 2 + buttonWidth) {
          console.log('点击了排行榜按钮');
          this.showRanking();
          return true;
        }
      }
      
      return false;
    },
    
    async handleMakeItSwim() {
      console.log('开始处理让它游起来逻辑');
      
      try {
        // 获取用户画的鱼图片
        const fishImageData = Paint.getFishImage();
        if (!fishImageData) {
          console.log('没有检测到鱼图像');
          wx.showToast({
            title: '请先画一条鱼',
            icon: 'none'
          });
          return;
        }
        
        // 转换为base64
        const base64Image = await Utils.imageToBase64(fishImageData);
        if (!base64Image) {
          console.error('图片转换失败');
          return;
        }
        
        console.log('开始调用大模型API评分');
        
        // 调用大模型API获取评分
        const scoreText = await API.callQWenVLModel(base64Image);
        const score = parseFloat(scoreText);
        
        console.log(`获得评分: ${score}`);
        
        if (score > 60) {
          console.log('评分大于60分，允许放入鱼缸');
          // 放入鱼缸并显示游动效果
          FishTank.showWithFish(fishImageData);
          this.currentScreen = 'fishTank';
        } else {
          console.log('评分小于60分，只能查看排行榜');
          wx.showToast({
            title: `评分${score}分，不足60分`,
            icon: 'none'
          });
          this.showRanking();
        }
        
      } catch (error) {
        console.error('处理失败:', error);
        wx.showToast({
          title: '处理失败，请重试',
          icon: 'none'
        });
      }
    },
    
    showRanking() {
      console.log('显示排行榜');
      this.currentScreen = 'ranking';
      Ranking.show();
    },
    
    backToHome() {
      console.log('返回首页');
      this.renderHome();
    }
  };
  
  // 导出游戏实例
  module.exports = Game;
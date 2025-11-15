// fishTank.js - 鱼缸和游动功能
const FISH_CONFIG = {
    width: 80,
    height: 48,
    speed: 2,
    amplitude: 24,
    peduncle: 0.4
  };
  
  class Fish {
    constructor(image, x, y, direction = 1) {
      this.image = image;
      this.x = x;
      this.y = y;
      this.direction = direction;
      this.phase = Math.random() * Math.PI * 2;
      this.amplitude = FISH_CONFIG.amplitude;
      this.speed = FISH_CONFIG.speed;
      this.vx = this.speed * this.direction * 0.1;
      this.vy = (Math.random() - 0.5) * 0.5;
      this.width = FISH_CONFIG.width;
      this.height = FISH_CONFIG.height;
      this.peduncle = FISH_CONFIG.peduncle;
      this.tailEnd = Math.floor(this.width * this.peduncle);
    }
  
    update(canvasWidth, canvasHeight) {
      this.x += this.vx;
      this.y += this.vy;
  
      if (this.x <= 0) {
        this.x = 0;
        this.direction = 1;
        this.vx = Math.abs(this.vx);
      } else if (this.x >= canvasWidth - this.width) {
        this.x = canvasWidth - this.width;
        this.direction = -1;
        this.vx = -Math.abs(this.vx);
      }
  
      if (this.y <= 0) {
        this.y = 0;
        this.vy = Math.abs(this.vy) * 0.5;
      } else if (this.y >= canvasHeight - this.height) {
        this.y = canvasHeight - this.height;
        this.vy = -Math.abs(this.vy) * 0.5;
      }
  
      this.vx *= 0.85;
      this.vy *= 0.85;
  
      if (Math.abs(this.vx) < 0.1) {
        this.vx = this.speed * this.direction * 0.1;
      }
    }
  
    draw(ctx, time) {
      const swimY = this.y + Math.sin(time + this.phase) * this.amplitude;
      this.drawWigglingFish(ctx, this.x, swimY, this.direction, time);
    }
  
    drawWigglingFish(ctx, x, y, direction, time) {
      const w = this.width;
      const h = this.height;
  
      for (let i = 0; i < w; i++) {
        let isTail, t, wiggle, drawCol, drawX;
        
        if (direction === 1) {
          isTail = i < this.tailEnd;
          t = isTail ? (this.tailEnd - i - 1) / (this.tailEnd - 1) : 0;
          wiggle = isTail ? Math.sin(time * 3 + this.phase + t * 2) * t * 12 : 0;
          drawCol = i;
          drawX = x + i + wiggle;
        } else {
          isTail = i >= w - this.tailEnd;
          t = isTail ? (i - (w - this.tailEnd)) / (this.tailEnd - 1) : 0;
          wiggle = isTail ? Math.sin(time * 3 + this.phase + t * 2) * t * 12 : 0;
          drawCol = w - i - 1;
          drawX = x + i - wiggle;
        }
  
        ctx.save();
        ctx.translate(drawX, y);
        ctx.drawImage(this.image, drawCol, 0, 2, h, 0, 0, 2, h);
        ctx.restore();
      }
    }
  }
  
  const FishTank = {
    fishes: [],
    canvas: null,
    ctx: null,
    fishImage: null,
    animationId: null,
    userFishImage: null,
    
    init() {
      console.log('鱼缸模块初始化');
      this.canvas = wx.createCanvas();
      this.ctx = this.canvas.getContext('2d');
    },
    
    showWithFish(fishImageData) {
      console.log('显示鱼缸和用户画的鱼');
      
      // 设置画布尺寸
      const systemInfo = wx.getSystemInfoSync();
      this.canvas.width = systemInfo.windowWidth;
      this.canvas.height = systemInfo.windowHeight;
      
      // 保存用户画的鱼
      this.userFishImage = this.createImageFromData(fishImageData);
      
      // 创建鱼实例
      this.createUserFish();
      
      // 开始动画
      this.startAnimation();
      
      // 添加返回按钮
      this.addBackButton();
    },
    
    createImageFromData(imageData) {
      // 创建临时画布来转换ImageData为Image
      const tempCanvas = wx.createCanvas();
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      tempCtx.putImageData(imageData, 0, 0);
      
      return tempCanvas;
    },
    
    createUserFish() {
      if (!this.userFishImage) return;
      
      const maxX = Math.max(0, this.canvas.width - FISH_CONFIG.width);
      const maxY = Math.max(0, this.canvas.height - FISH_CONFIG.height);
      const x = Math.floor(Math.random() * maxX);
      const y = Math.floor(Math.random() * maxY);
      const direction = Math.random() < 0.5 ? -1 : 1;
  
      const fish = new Fish(this.userFishImage, x, y, direction);
      this.fishes.push(fish);
      
      console.log('创建用户鱼实例');
    },
    
    startAnimation() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      
      const animate = (timestamp) => {
        this.update();
        this.render();
        this.animationId = requestAnimationFrame(animate);
      };
      
      this.animationId = requestAnimationFrame(animate);
      console.log('开始鱼缸动画');
    },
    
    update() {
      const time = Date.now() / 500;
      this.fishes.forEach(fish => {
        fish.update(this.canvas.width, this.canvas.height);
      });
    },
    
    render() {
      // 清空画布
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // 绘制鱼缸背景
      this.ctx.fillStyle = '#87CEEB';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // 绘制鱼
      const time = Date.now() / 500;
      this.fishes.forEach(fish => {
        fish.draw(this.ctx, time);
      });
      
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
    },
    
    cleanup() {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      this.fishes = [];
      this.userFishImage = null;
      
      console.log('鱼缸清理完成');
    }
  };
  
  module.exports = FishTank;
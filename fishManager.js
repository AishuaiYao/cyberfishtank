const { config } = require('./config.js');

// 鱼类定义
class Fish {
  constructor(image, x, y, direction = 1, name = '未命名', fishData = null) {
    this.image = image;
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.name = name;
    this.fishData = fishData;
    this.phase = Math.random() * Math.PI * 2;
    this.amplitude = 8;
    this.speed = 0.5 + Math.random() * 1;
    this.vx = this.speed * this.direction;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.width = image.width;
    this.height = image.height;
    this.peduncle = 0.4;
    this.tailEnd = Math.floor(this.width * this.peduncle);
    this.time = 0;
    this.tankPadding = 20;

    this.transparentImage = this.createTransparentFishImage(image);
  }

  // 创建透明背景的鱼图像
  createTransparentFishImage(originalImage) {
    const tempCanvas = wx.createCanvas();
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(originalImage, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    return tempCanvas;
  }

  update(deltaTime) {
    this.time += deltaTime / 1000;

    this.x += this.vx;
    this.y += this.vy;

    const minX = this.tankPadding;
    const maxX = this.canvasWidth - this.width - this.tankPadding;
    const minY = this.tankPadding + 150;
    const maxY = this.canvasHeight - this.height - this.tankPadding;

    if (this.x <= minX) {
      this.x = minX;
      this.direction = 1;
      this.vx = Math.abs(this.vx);
    } else if (this.x >= maxX) {
      this.x = maxX;
      this.direction = -1;
      this.vx = -Math.abs(this.vx);
    }

    if (this.y <= minY) {
      this.y = minY;
      this.vy = Math.abs(this.vy) * 0.5;
    } else if (this.y >= maxY) {
      this.y = maxY;
      this.vy = -Math.abs(this.vy) * 0.5;
    }

    if (Math.random() < 0.02) {
      this.vy += (Math.random() - 0.5) * 0.3;
    }

    this.vx = Math.max(-2, Math.min(2, this.vx));
    this.vy = Math.max(-1, Math.min(1, this.vy));
  }

  setCanvasSize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  draw(ctx) {
    const swimY = this.y + Math.sin(this.time * 2 + this.phase) * this.amplitude;
    this.drawWigglingFish(ctx, this.x, swimY, this.direction, this.time);
  }

  drawWigglingFish(ctx, x, y, direction, time) {
    const w = this.width;
    const h = this.height;

    if (direction === 1) {
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < w; i++) {
        let isTail = i < this.tailEnd;
        let t = isTail ? (this.tailEnd - i - 1) / (this.tailEnd - 1) : 0;
        let wiggle = isTail ? Math.sin(time * 5 + this.phase + t * 3) * t * 8 : 0;

        ctx.save();
        ctx.translate(i, wiggle);
        ctx.drawImage(this.transparentImage, i, 0, 1, h, 0, 0, 1, h);
        ctx.restore();
      }
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      for (let i = 0; i < w; i++) {
        let isTail = i < this.tailEnd;
        let t = isTail ? (this.tailEnd - i - 1) / (this.tailEnd - 1) : 0;
        let wiggle = isTail ? Math.sin(time * 5 + this.phase + t * 3) * t * 8 : 0;

        ctx.save();
        ctx.translate(i, wiggle);
        ctx.drawImage(this.transparentImage, i, 0, 1, h, 0, 0, 1, h);
        ctx.restore();
      }
      ctx.restore();
    }
  }
}

// 鱼缸类
class FishTank {
  constructor(ctx, width, height) {
    this.fishes = [];
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.tankPadding = 20;
  }

  addFish(fish) {
    fish.setCanvasSize(this.width, this.height);
    this.fishes.push(fish);
  }

  update(deltaTime) {
    this.fishes.forEach(fish => {
      fish.update(deltaTime);
    });
  }

  draw() {
    const ctx = this.ctx;

    const tankX = this.tankPadding;
    const tankY = this.tankPadding + 130;
    const tankWidth = this.width - this.tankPadding * 2;
    const tankHeight = this.height - this.tankPadding - 150;

    ctx.clearRect(tankX, tankY, tankWidth, tankHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(tankX, tankY, tankWidth, tankHeight);

    ctx.strokeStyle = '#E5E5EA';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(tankX, tankY, tankWidth, tankHeight);
    ctx.setLineDash([]);

    this.fishes.forEach(fish => {
      fish.draw(ctx);
    });
  }

  startAnimation() {
    // 鱼缸的动画由EventHandler统一管理
  }
}

module.exports = {
  Fish,
  FishTank
};
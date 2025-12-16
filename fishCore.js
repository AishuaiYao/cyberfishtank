
const { config } = require('./config.js');

// 气泡类
class Bubble {
  constructor(x, y, size = 1) {
    this.x = x;
    this.y = y;
    this.size = size; // 1: 小, 2: 中, 3: 大
    this.speed = 0.5 + Math.random() * 0.5; // 上升速度
    this.amplitude = 10 + Math.random() * 20; // 左右摆动幅度
    this.phase = Math.random() * Math.PI * 2; // 相位
    this.alpha = 0.3 + Math.random() * 0.4; // 透明度
    this.wiggleSpeed = 0.5 + Math.random() * 1; // 摆动速度
    this.maxY = 90; // 顶部边界
  }

  update(deltaTime) {
    // 上升
    this.y -= this.speed * (deltaTime / 16);

    // 左右摆动
    this.x += Math.sin(this.phase) * 0.2;
    this.phase += this.wiggleSpeed * (deltaTime / 1000);

    // 检查是否超出顶部边界
    if (this.y <= this.maxY) {
      return true; // 需要移除
    }

    return false; // 不需要移除
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    // 根据大小设置半径
    let radius;
    switch(this.size) {
      case 1: // 小气泡
        radius = 2;
        break;
      case 2: // 中气泡
        radius = 4;
        break;
      case 3: // 大气泡
        radius = 6;
        break;
      default:
        radius = 3;
    }

  // 修改这里：使用纯白色，完全不透明
  ctx.fillStyle = '#FFFFFF'; // 纯白色
  ctx.beginPath();
  ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // 修改这里：添加白色边框增强效果
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 修改这里：更亮的高光
  ctx.fillStyle = '#FFFFFF'; // 纯白色高光
  ctx.beginPath();
  ctx.arc(this.x - radius * 0.2, this.y - radius * 0.2, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  }
}

// 水草类
class Seaweed {
  constructor(x, height = 120) {
    this.x = x;
    this.y = config.screenHeight; // 从底部开始
    this.height = height;
    this.width = 15 + Math.random() * 10; // 水草宽度
    this.segments = []; // 水草分段
    this.phase = Math.random() * Math.PI * 2; // 随机相位
    this.swingSpeed = 0.5 + Math.random() * 0.5; // 摆动速度
    this.swingAmplitude = 5 + Math.random() * 8; // 摆动幅度
    
    // 水草颜色（绿色系）
    this.colors = [
      '#2E8B57', // 海绿色
      '#3CB371', // 中海绿色
      '#20B2AA', // 浅海绿色
      '#32CD32', // 酸橙绿
      '#228B22'  // 森林绿
    ];
    this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    
    this.initSegments();
  }

  // 初始化水草分段
  initSegments() {
    const segmentCount = 8 + Math.floor(Math.random() * 6); // 8-13个分段
    const segmentHeight = this.height / segmentCount;
    
    for (let i = 0; i < segmentCount; i++) {
      this.segments.push({
        width: this.width * (1 - i * 0.08), // 越往上越细
        height: segmentHeight,
        baseWidth: this.width * (1 - i * 0.08)
      });
    }
  }

  update(deltaTime) {
    // 水草缓慢摆动
    this.phase += this.swingSpeed * (deltaTime / 1000);
  }

  draw(ctx) {
    ctx.save();
    
    // 水草从底部向上绘制
    let currentY = this.y;
    
    this.segments.forEach((segment, index) => {
      const progress = index / this.segments.length;
      const swing = Math.sin(this.phase + progress * 2) * this.swingAmplitude * progress;
      
      // 设置水草颜色，越往上颜色越浅
      const colorAlpha = 0.6 + progress * 0.4;
      ctx.fillStyle = this.color;
      ctx.globalAlpha = colorAlpha;
      
      // 绘制水草分段（叶子形状）
      ctx.beginPath();
      ctx.moveTo(this.x + swing - segment.width / 2, currentY);
      ctx.quadraticCurveTo(
        this.x + swing - segment.width / 3, 
        currentY - segment.height / 2,
        this.x + swing, 
        currentY - segment.height
      );
      ctx.quadraticCurveTo(
        this.x + swing + segment.width / 3, 
        currentY - segment.height / 2,
        this.x + swing + segment.width / 2, 
        currentY
      );
      ctx.closePath();
      ctx.fill();
      
      // 添加叶脉
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x + swing, currentY);
      ctx.quadraticCurveTo(
        this.x + swing, 
        currentY - segment.height / 2,
        this.x + swing, 
        currentY - segment.height
      );
      ctx.stroke();
      
      currentY -= segment.height;
    });
    
    ctx.restore();
  }
}

// 鱼粮类
class FishFood {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 4;
    this.color = '#8C8C8C'; // 改为土灰色
    this.speed = 0.5;
    this.isEaten = false;
    this.alpha = 1;
    this.fadeSpeed = 0.02;
    this.maxY = 90; // 顶部边界
  }

  update(deltaTime) {
    if (this.isEaten) {
      this.alpha -= this.fadeSpeed;
      if (this.alpha <= 0) {
        return true; // 需要移除
      }
    } else {
      // 缓慢下落
      this.y += this.speed * (deltaTime / 16);

      // 检查是否超出屏幕底部或顶部边界
      if (this.y > this.canvasHeight + 10 || this.y < this.maxY) {
        return true; // 需要移除
      }
    }
    return false; // 不需要移除
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 添加一点高光效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(this.x - 1, this.y - 1, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  setCanvasSize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  // 检查是否被鱼吃到
  checkCollision(fish) {
    if (this.isEaten) return false;

    const fishCenterX = fish.x + fish.width / 2;
    const fishCenterY = fish.y + fish.height / 2;

    const distance = Math.sqrt(
      Math.pow(fishCenterX - this.x, 2) +
      Math.pow(fishCenterY - this.y, 2)
    );

    return distance < (fish.width / 2 + this.radius);
  }
}

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
    this.speed = 0.8 + Math.random() * 1.2; // 提高基础速度
    this.vx = this.speed * this.direction;
    this.vy = (Math.random() - 0.5) * 0.5;
    
    // 先保存原始图像尺寸，用于后续缩放
    const originalWidth = image.width || 80;
    const originalHeight = image.height || 80;
    
    // 在鱼缸场景中缩放图像到宽度为80像素
    const scaledImage = this.scaleImageForTank(image);
    this.width = scaledImage.width;
    this.height = scaledImage.height;
    
    this.peduncle = 0.4;
    this.tailEnd = Math.floor(this.width * this.peduncle);
    this.time = 0;
    this.tankPadding = 20;
    this.maxY = 90; // 顶部边界 - 距离顶端90像素

    // 鱼粮相关属性
    this.targetFood = null;
    this.isEating = false;
    this.eatCooldown = 0;
    this.hunger = Math.random() * 100; // 饥饿度
    this.maxHunger = 100;
    this.foodDetectionRange = 400; // 增加检测范围

    // 使用缩放后的图像创建透明图像
    this.transparentImage = this.createTransparentFishImage(scaledImage.canvas);
  }

  // 缩放图像到宽度为80像素（高度等比例缩放）
  scaleImageForTank(originalImage) {
    // 如果传入的是canvas对象，需要获取其尺寸
    let imageWidth, imageHeight;
    if (originalImage.width !== undefined) {
      // 如果是canvas对象
      imageWidth = originalImage.width;
      imageHeight = originalImage.height;
      const canvas = originalImage;
      
      // 计算缩放比例
      const targetWidth = 80;
      const scale = targetWidth / imageWidth;
      const scaledHeight = Math.round(imageHeight * scale);
      
      // 创建缩放后的canvas
      const scaledCanvas = wx.createCanvas();
      scaledCanvas.width = targetWidth;
      scaledCanvas.height = scaledHeight;
      
      const scaledCtx = scaledCanvas.getContext('2d');
      scaledCtx.drawImage(canvas, 0, 0, targetWidth, scaledHeight);
      
      return {
        canvas: scaledCanvas,
        width: targetWidth,
        height: scaledHeight
      };
    } else {
      // 如果是其他类型的图像对象，假设它有width和height属性
      imageWidth = originalImage.width || 80;
      imageHeight = originalImage.height || 80;
      
      // 计算缩放比例
      const targetWidth = 80;
      const scale = targetWidth / imageWidth;
      const scaledHeight = Math.round(imageHeight * scale);
      
      // 创建缩放后的canvas
      const scaledCanvas = wx.createCanvas();
      scaledCanvas.width = targetWidth;
      scaledCanvas.height = scaledHeight;
      
      const scaledCtx = scaledCanvas.getContext('2d');
      scaledCtx.drawImage(originalImage, 0, 0, targetWidth, scaledHeight);
      
      return {
        canvas: scaledCanvas,
        width: targetWidth,
        height: scaledHeight
      };
    }
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

      if (r === 255 && g === 255 && b === 255) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    return tempCanvas;
  }

  update(deltaTime, fishFoods = []) {
    this.time += deltaTime / 1000;
    this.hunger += 0.1 * (deltaTime / 16); // 缓慢增加饥饿度

    // 冷却时间更新
    if (this.eatCooldown > 0) {
      this.eatCooldown -= deltaTime;
    }

    // 寻找鱼粮逻辑
    if (!this.isEating && this.eatCooldown <= 0) {
      this.findFood(fishFoods);
    }

    // 如果有目标鱼粮，朝目标移动
    if (this.targetFood && !this.targetFood.isEaten) {
      this.moveToFood();
    } else {
      // 正常游动
      this.normalSwim();
    }

    // 边界检查 - 修改为新的边界逻辑
    this.checkBoundaries();

    // 随机行为
    if (Math.random() < 0.02 && !this.targetFood) {
      this.vy += (Math.random() - 0.5) * 0.3;
    }

    this.vx = Math.max(-3, Math.min(3, this.vx)); // 提高速度限制
    this.vy = Math.max(-1.5, Math.min(1.5, this.vy)); // 提高速度限制
  }

  // 寻找最近的鱼粮
  findFood(fishFoods) {
    let closestFood = null;
    let closestDistance = Infinity;

    for (const food of fishFoods) {
      if (food.isEaten) continue;

      const distance = Math.sqrt(
        Math.pow(this.x + this.width / 2 - food.x, 2) +
        Math.pow(this.y + this.height / 2 - food.y, 2)
      );

      // 增加检测范围到400像素，让鱼更容易发现鱼粮
      if (distance < closestDistance && distance < this.foodDetectionRange) {
        closestDistance = distance;
        closestFood = food;
      }
    }

    this.targetFood = closestFood;
  }

  // 朝鱼粮移动
  moveToFood() {
    if (!this.targetFood) return;

    const targetX = this.targetFood.x;
    const targetY = this.targetFood.y;
    const fishCenterX = this.x + this.width / 2;
    const fishCenterY = this.y + this.height / 2;

    // 计算方向
    const dx = targetX - fishCenterX;
    const dy = targetY - fishCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 8) { // 减小到达距离，让鱼更容易吃到
      this.isEating = true;
      return;
    }

    // 归一化方向向量
    const dirX = dx / distance;
    const dirY = dy / distance;

    // 根据饥饿度调整速度（越饿越快），提高速度系数
    const hungerFactor = 1.2 + (this.hunger / this.maxHunger) * 1.0; // 提高饥饿影响

    this.vx = dirX * this.speed * hungerFactor;
    this.vy = dirY * this.speed * hungerFactor;

    // 更新方向
    this.direction = this.vx >= 0 ? 1 : -1;

    this.x += this.vx;
    this.y += this.vy;
  }

  // 正常游动
  normalSwim() {
    this.x += this.vx;
    this.y += this.vy;

    // 随机摆动
    const swimY = Math.sin(this.time * 2 + this.phase) * this.amplitude;
    this.y += swimY * 0.1;
  }

  // 检查边界 - 修改为新的边界逻辑
  checkBoundaries() {
    const minX = 0;
    const maxX = this.canvasWidth - this.width - 0;
    const minY = this.maxY; // 距离顶端90像素
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
  }

  // 吃鱼粮
  eatFood() {
    if (this.targetFood && !this.targetFood.isEaten) {
      this.targetFood.isEaten = true;
      this.hunger = Math.max(0, this.hunger - 30); // 减少饥饿度
      this.isEating = false;
      this.targetFood = null;
      this.eatCooldown = 800; // 稍微减少冷却时间

      // 吃食后随机游动
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 1;

      return true;
    }
    return false;
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
    this.fishFoods = []; // 鱼粮数组
    this.bubbles = []; // 气泡数组
    this.seaweeds = []; // 水草数组
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.tankPadding = 20;
    this.lastFoodSpawnTime = 0;
    this.lastBubbleSpawnTime = 0;
    this.maxY = 90; // 顶部边界
    
    // 初始化水草
    this.initSeaweeds();
  }

  // 初始化水草
  initSeaweeds() {
    // 在鱼缸底部生成几簇水草
    const seaweedCount = 5 + Math.floor(Math.random() * 4); // 5-8簇水草
    
    for (let i = 0; i < seaweedCount; i++) {
      const x = 20 + Math.random() * (this.width - 40); // 避免在边缘生成
      const height = 80 + Math.random() * 80; // 高度80-160像素
      const seaweed = new Seaweed(x, height);
      this.seaweeds.push(seaweed);
    }
    
    console.log(`生成了 ${this.seaweeds.length} 簇水草`);
  }

  addFish(fish, allowDuplicate = false) {
    // 检查名称重复（可根据参数允许重复）
    if (!allowDuplicate) {
      const existingFishByName = this.fishes.find(f => f.name === fish.name);
      if (existingFishByName) {
        console.warn(`鱼名称 "${fish.name}" 已存在，跳过添加`);
        return false;
      }
    }

    fish.setCanvasSize(this.width, this.height);
    this.fishes.push(fish);
    return true;
  }





  // 生成鱼粮
  spawnFishFood(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 40; // 随机散布
      const offsetY = (Math.random() - 0.5) * 40;
      const food = new FishFood(x + offsetX, y + offsetY);
      food.setCanvasSize(this.width, this.height);
      this.fishFoods.push(food);
    }
    console.log(`生成了 ${count} 个鱼粮`);
  }

spawnBubbles() {
  const currentTime = Date.now();
  // 修改这里：每5秒生成一次气泡，每次生成5个
  if (currentTime - this.lastBubbleSpawnTime > 5000) {
    // 修改这里：生成5个气泡
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * this.width;
      const y = this.height - 10; // 从底部生成
      const size = 1 + Math.floor(Math.random() * 3); // 随机大小
      const bubble = new Bubble(x, y, size);
      this.bubbles.push(bubble);
    }

    this.lastBubbleSpawnTime = currentTime;
    console.log('生成5个气泡');
  }
}


  update(deltaTime) {
    // 生成气泡
    this.spawnBubbles();

    // 更新气泡
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      const shouldRemove = bubble.update(deltaTime);
      if (shouldRemove) {
        this.bubbles.splice(i, 1);
      }
    }

    // 更新水草
    this.seaweeds.forEach(seaweed => {
      seaweed.update(deltaTime);
    });

    // 更新鱼
    this.fishes.forEach(fish => {
      fish.update(deltaTime, this.fishFoods);
    });

    // 更新鱼粮并检查碰撞
    for (let i = this.fishFoods.length - 1; i >= 0; i--) {
      const food = this.fishFoods[i];

      // 更新鱼粮位置
      const shouldRemove = food.update(deltaTime);

      // 检查每条鱼是否吃到这个鱼粮
      if (!food.isEaten) {
        for (const fish of this.fishes) {
          if (food.checkCollision(fish)) {
            fish.eatFood();
            break; // 一个鱼粮只能被一条鱼吃
          }
        }
      }

      // 移除需要删除的鱼粮
      if (shouldRemove) {
        this.fishFoods.splice(i, 1);
      }
    }
  }

  draw() {
    const ctx = this.ctx;

    // 绘制水蓝色背景 - 覆盖整个屏幕
    ctx.fillStyle = '#E6F7FF'; // 水蓝色
    ctx.fillRect(0, 0, this.width, this.height);

    // 先绘制水草（在最底层）
    this.seaweeds.forEach(seaweed => {
      seaweed.draw(ctx);
    });

    // 再绘制气泡
    this.bubbles.forEach(bubble => {
      bubble.draw(ctx);
    });

    // 再绘制鱼粮
    this.fishFoods.forEach(food => {
      food.draw(ctx);
    });

    // 最后绘制鱼（鱼在最上面）
    this.fishes.forEach(fish => {
      fish.draw(ctx);
    });
  }


}

module.exports = {
  Fish,
  FishTank,
  FishFood,
  Bubble,
  Seaweed
};
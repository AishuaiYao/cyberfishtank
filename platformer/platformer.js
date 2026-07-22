// platformer/platformer.js
// 闯关游戏 —— 马里奥风格的平台跳跃，主角为用户绘制的鱼
const { LEVELS, TILE_AIR, TILE_GROUND, TILE_PLATFORM, TILE_BRICK, TILE_QUESTION, generateTileMap } = require('./levelData');

// ======================== 常量 ========================
const TILE_SIZE = 40;
const GRAVITY = 1400;            // 像素/秒²
const JUMP_VELOCITY = -500;      // 初始起跳速度
const MOVE_SPEED = 240;          // 水平移动速度
const MAX_FALL_SPEED = 750;      // 最大下落速度
const COIN_BOUNCE = -220;        // 顶砖块时金币弹出速度
const PLAYER_W = 88;
const PLAYER_H = 72;
const INVINCIBLE_TIME = 1.5;     // 受伤后无敌时间（秒）
const DEATH_PAUSE = 1.0;         // 死亡暂停时间
const LEVEL_COMPLETE_PAUSE = 2.0;// 过关庆祝时间

// ======================== 粒子 ========================
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.maxLife = life;
    this.size = size || 3;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += GRAVITY * 0.5 * dt;
    this.life -= dt;
  }
  draw(ctx, cam) {
    if (this.life <= 0) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cam.x - this.size / 2, this.y - cam.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
  get dead() { return this.life <= 0; }
}

// ======================== 敌人 ========================
class Enemy {
  constructor(spec, tileSize) {
    const ts = tileSize;
    this.x = spec.x * ts + ts / 2;
    this.y = spec.y * ts;
    this.type = spec.type;
    this.speed = spec.speed * 75; // 像素/秒
    this.patrolLeft = (spec.x - spec.patrol) * ts;
    this.patrolRight = (spec.x + spec.patrol) * ts;
    this.vx = this.speed;
    this.vy = 0;
    this.w = 30; this.h = 24;
    this.alive = true;
    this.animTimer = Math.random() * Math.PI * 2;
    this.tileSize = ts;
    // 水母：上下浮动相位
    this.floatBaseY = this.y;
    this.floatPhase = Math.random() * Math.PI * 2;
    this.onGround = false;
  }

  update(dt, tiles, levelH) {
    if (!this.alive) return;
    this.animTimer += dt;

    // 水平巡逻
    this.vx = this.speed * (this.vx > 0 ? 1 : -1);
    this.x += this.vx * dt;
    if (this.x <= this.patrolLeft)  { this.x = this.patrolLeft;  this.vx = Math.abs(this.speed); }
    if (this.x >= this.patrolRight) { this.x = this.patrolRight; this.vx = -Math.abs(this.speed); }

    // 横向碰撞
    const tileL = Math.floor((this.x - this.w / 2) / this.tileSize);
    const tileR = Math.floor((this.x + this.w / 2 - 1) / this.tileSize);
    const tileTop = Math.floor(this.y / this.tileSize);
    const tileBot = Math.floor((this.y + this.h - 1) / this.tileSize);
    if (this.vx > 0 && tileR >= 0 && tileR < tiles[0].length && tileTop >= 0 && tileBot < tiles.length) {
      for (let ty = tileTop; ty <= tileBot; ty++) {
        if (tiles[ty] && tiles[ty][tileR] !== TILE_AIR) { this.x = tileR * this.tileSize - this.w / 2; this.vx = -Math.abs(this.speed); break; }
      }
    }
    if (this.vx < 0 && tileL >= 0 && tileL < tiles[0].length && tileTop >= 0 && tileBot < tiles.length) {
      for (let ty = tileTop; ty <= tileBot; ty++) {
        if (tiles[ty] && tiles[ty][tileL] !== TILE_AIR) { this.x = (tileL + 1) * this.tileSize + this.w / 2; this.vx = Math.abs(this.speed); break; }
      }
    }

    // 重力
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    this.y += this.vy * dt;
    this.onGround = false;

    // 纵向碰撞
    const newTileTop = Math.floor(this.y / this.tileSize);
    const newTileBot = Math.floor((this.y + this.h - 1) / this.tileSize);
    const midL = Math.floor((this.x - this.w / 2 + 2) / this.tileSize);
    const midR = Math.floor((this.x + this.w / 2 - 2) / this.tileSize);
    if (this.vy > 0 && newTileBot < tiles.length) {
      for (let tx = midL; tx <= midR; tx++) {
        if (tx >= 0 && tx < tiles[0].length && tiles[newTileBot] && tiles[newTileBot][tx] !== TILE_AIR) {
          this.y = newTileBot * this.tileSize - this.h;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    }
    if (this.y > levelH * this.tileSize + 100) this.alive = false;
  }

  draw(ctx, cam) {
    if (!this.alive) return;
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    const cx = sx + this.w / 2;
    const cy = sy + this.h / 2;

    ctx.save();
    if (this.type === 'crab') {
      // 螃蟹：橙色椭圆身体 + 钳子
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2, this.w / 2, this.h / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 眼睛
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(cx - 6, cy - 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(cx - 6, cy - 6, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6, cy - 6, 2.5, 0, Math.PI * 2); ctx.fill();
      // 钳子
      ctx.strokeStyle = '#FF6B35'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const claw = Math.sin(this.animTimer * 4) * 3;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy - 3); ctx.lineTo(cx - 16, cy - 10 + claw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 8, cy - 3); ctx.lineTo(cx + 16, cy - 10 - claw); ctx.stroke();
    } else if (this.type === 'jelly') {
      // 水母：半透明伞状 + 触须
      const bob = Math.sin(this.animTimer * 3) * 4;
      ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, this.w / 2, this.h / 3, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 4 + bob, this.w / 2, this.h / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 触须
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)'; ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 5, cy + this.h / 3 + bob);
        ctx.quadraticCurveTo(cx + i * 7 + Math.sin(this.animTimer * 5 + i) * 4, cy + this.h / 2 + bob + 4,
          cx + i * 3 + Math.cos(this.animTimer * 5 + i) * 4, cy + this.h / 2 + bob + 14);
        ctx.stroke();
      }
    } else if (this.type === 'puffer') {
      // 河豚：会膨胀的圆刺鱼
      const puff = 1 + Math.abs(Math.sin(this.animTimer * 2)) * 0.35;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w / 2 * puff, this.h / 2 * puff, 0, 0, Math.PI * 2);
      ctx.fill();
      // 刺
      ctx.strokeStyle = '#CC9900'; ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        const sx2 = cx + Math.cos(a) * this.w / 2 * puff;
        const sy2 = cy + Math.sin(a) * this.h / 2 * puff;
        ctx.beginPath();
        ctx.moveTo(sx2, sy2);
        ctx.lineTo(sx2 + Math.cos(a) * 8 * puff, sy2 + Math.sin(a) * 8 * puff);
        ctx.stroke();
      }
      // 眼睛
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(cx - 6, cy - 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy - 5, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx - 6, cy - 5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 4, cy - 5, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// ======================== 主游戏类 ========================
class PlatformerGame {
  /**
   * @param {Object} canvas      - 主 Canvas
   * @param {CanvasRenderingContext2D} ctx - 已缩放到逻辑像素的 2D 上下文
   * @param {Object} config      - { screenWidth, screenHeight, pixelRatio }
   * @param {Object} playerImgCanvas - 用户画的鱼的离屏 Canvas
   * @param {Function} onExit    - 退出回调
   */
  constructor(canvas, ctx, gameConfig, playerImgCanvas, onExit, options = {}) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.playerImgCanvas = playerImgCanvas;
    this.onExit = onExit;
    this._fishName = options.fishName || '未知小鱼';

    // 画布是竖屏（game.json portrait），实际宽 < 高
    // 平台跳跃是横屏玩法，通过旋转矩阵实现
    // 物理画布：screenWidth=375, screenHeight=667（竖）
    // 逻辑坐标：screenWidth=667, screenHeight=375（横）
    this._pr = gameConfig.pixelRatio;
    this._portraitW = gameConfig.screenWidth;   // 375
    this._portraitH = gameConfig.screenHeight;  // 667

    // 平台跳跃使用横屏坐标：宽 = 高，高 = 宽（互换）
    this.config = {
      screenWidth: gameConfig.screenHeight,   // 667（横屏宽）
      screenHeight: gameConfig.screenWidth,   // 375（横屏高）
      pixelRatio: this._pr,
    };

    this.levelIndex = 0;
    this.lives = 3;
    this.score = 0;
    this.coinCount = 0;
    this.state = 'playing';    // 'playing' | 'dying' | 'complete' | 'gameover' | 'allClear' | 'paused'

    // 玩家
    this.player = {
      x: 0, y: 0, vx: 0, vy: 0,
      w: PLAYER_W, h: PLAYER_H,
      facingRight: true,
      onGround: false,
      invincibleTimer: 0,
      jumpCount: 0,        // 当前已跳跃次数（二连跳）
    };
    this.maxJumps = 2;     // 最大跳跃次数（2 = 二连跳）

    // 镜头
    this.camera = { x: 0, y: 0 };
    // 世界
    this.tiles = [];
    this.levelW = 0;
    this.levelH = 0;

    this.enemies = [];
    this.coins = [];         // { x, y, collected, animTimer }
    this.questionBlocks = [];// { x, y, hit }
    this.particles = [];
    this.finishX = 0;
    this.finishY = 0;

    // 输入
    this.input = { left: false, right: false, jump: false, jumpConsumed: false };
    this.activeTouches = {}; // id → { x, y }
    this._lastMoveDir = 0;   // 缓存最近移动方向（-1左 0无 1右），跳跃惯性用

    // 时间
    this.lastTime = 0;
    this.animTime = 0;
    this.totalTime = 0;

    // 状态计时
    this.stateTimer = 0;

    // 新手引导
    this.showTutorial = false;
    this.tutorialTimer = 0;

    // 已激活
    this.isRunning = false;
  }

  // ======================== 初始化 & 关卡加载 ========================
  init() {
    this.lives = 3;
    this.score = 0;
    this.coinCount = 0;
    this.levelIndex = 0;
    this.loadLevel(0);
    this.isRunning = true;
    this.lastTime = Date.now();
    this.gameLoop();
  }

  loadLevel(index) {
    const spec = LEVELS[index];
    this.levelW = spec.width;
    this.levelH = spec.height;
    this.tiles = generateTileMap(spec);
    const ts = TILE_SIZE;

    // 玩家出生点
    this.player.x = spec.playerStart.x * ts + ts / 2;
    this.player.y = spec.playerStart.y * ts;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.invincibleTimer = 0;
    this.player.jumpCount = 0;
    this.player.facingRight = true;

    // 终点
    this.finishX = spec.finish.x * ts + ts / 2;
    this.finishY = spec.finish.y * ts;

    // 敌人
    this.enemies = spec.enemies.map(e => new Enemy(e, ts));

    // 金币
    this.coins = spec.coins.map(c => ({
      x: c.x * ts + ts / 2,
      y: c.y * ts + ts / 2,
      collected: false,
      animTimer: Math.random() * Math.PI * 2,
      vy: 0,
      life: 0,
    }));

    // 问号砖块
    this.questionBlocks = spec.questions.map(q => ({
      x: q.x * ts, y: q.y * ts,
      hit: false,
    }));

    this.particles = [];
    this.state = 'playing';
    this.stateTimer = 0;
    this.showTutorial = true;       // 每关开始显示教学
    this.tutorialTimer = 0;
    this.camera.x = 0;
    this.camera.y = Math.max(0, spec.height * ts - this.config.screenHeight);
  }

  // ======================== 主循环 ========================
  gameLoop() {
    if (!this.isRunning) return;
    const now = Date.now();
    if (this.lastTime === 0) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    if (dt <= 0) dt = 0.016;
    if (dt > 0.05) dt = 0.05;  // 防止跳帧
    this.lastTime = now;
    this.animTime += dt;
    this.totalTime += dt;

    this.update(dt);
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  // ======================== 更新逻辑 ========================
  update(dt) {
    if (this.state === 'dying') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          this.state = 'gameover';
          this.stateTimer = 3.0;
        } else {
          this.loadLevel(this.levelIndex);
        }
      }
      return;
    }
    if (this.state === 'complete') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.levelIndex++;
        if (this.levelIndex >= LEVELS.length) {
          this.state = 'allClear';
          this.stateTimer = 5.0;
        } else {
          this.loadLevel(this.levelIndex);
        }
      }
      return;
    }
    if (this.state === 'gameover' || this.state === 'allClear') {
      this.stateTimer -= dt;
      return;
    }

    // ---- 输入处理 ----
    // 教学模式下暂停游戏，等待用户点击任意位置关闭
    if (this.showTutorial) {
      this.tutorialTimer += dt;
      return;
    }

    if (this.input.left) {
      this.player.vx = -MOVE_SPEED;
      this.player.facingRight = false;
      this._lastMoveDir = -1;
    } else if (this.input.right) {
      this.player.vx = MOVE_SPEED;
      this.player.facingRight = true;
      this._lastMoveDir = 1;
    } else {
      this.player.vx *= 0.85; // 摩擦
      if (Math.abs(this.player.vx) < 10) {
        this.player.vx = 0;
        this._lastMoveDir = 0;
      }
    }

    // 跳跃（支持二连跳）
    // 落地时重置跳跃计数
    if (this.player.onGround) {
      this.player.jumpCount = 0;
      this.input.jumpConsumed = false;
    }
    if (this.input.jump && !this.input.jumpConsumed && this.player.jumpCount < this.maxJumps) {
      this.player.vy = JUMP_VELOCITY;
      this.player.onGround = false;
      this.player.jumpCount++;
      this.input.jumpConsumed = true;
      // 跳跃惯性：如果当前没按方向键，保留最近的前进动量
      if (!this.input.left && !this.input.right && this._lastMoveDir !== 0 && Math.abs(this.player.vx) < MOVE_SPEED * 0.3) {
        this.player.vx = MOVE_SPEED * 0.7 * this._lastMoveDir;
      }
      // 二连跳特效粒子
      if (this.player.jumpCount === 2) {
        this.spawnParticles(this.player.x, this.player.y + this.player.h, '#64C8FF', 6);
      }
    }
    if (!this.input.jump) this.input.jumpConsumed = false;

    // 无敌计时
    if (this.player.invincibleTimer > 0) this.player.invincibleTimer -= dt;

    // ---- 物理：水平 ----
    this.player.vy += GRAVITY * dt;
    if (this.player.vy > MAX_FALL_SPEED) this.player.vy = MAX_FALL_SPEED;
    this.player.x += this.player.vx * dt;
    this.resolveHorizontalCollision();
    this.clampPlayerX();

    // ---- 物理：垂直 ----
    this.player.y += this.player.vy * dt;
    this.player.onGround = false;
    this.resolveVerticalCollision();

    // ---- 摔死 ----
    if (this.player.y > this.levelH * TILE_SIZE + 60) {
      this.killPlayer();
    }

    // ---- 镜头跟随 ----
    const targetCamX = this.player.x - this.config.screenWidth * 0.35;
    this.camera.x += (targetCamX - this.camera.x) * 5 * dt;
    this.camera.x = Math.max(0, Math.min(this.camera.x, this.levelW * TILE_SIZE - this.config.screenWidth));
    this.camera.y = Math.max(0, this.levelH * TILE_SIZE - this.config.screenHeight);

    // ---- 敌人更新 ----
    for (const enemy of this.enemies) {
      enemy.update(dt, this.tiles, this.levelH);
    }

    // ---- 敌人碰撞 ----
    this.checkEnemyCollision();

    // ---- 金币收集 ----
    this.checkCoinCollection();

    // ---- 终点 ----
    this.checkFinish();

    // ---- 粒子更新 ----
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => !p.dead);

    // ---- 金币弹跳动画 ----
    for (const c of this.coins) {
      if (!c.collected) { c.animTimer += dt; continue; }
      c.vy += GRAVITY * 0.8 * dt;
      c.y += c.vy * dt;
      c.life -= dt;
    }
    this.coins = this.coins.filter(c => !c.collected || c.life > 0);
  }

  // ---- 水平碰撞 ----
  resolveHorizontalCollision() {
    const p = this.player;
    const ts = TILE_SIZE;
    const left = Math.floor((p.x - p.w / 2) / ts);
    const right = Math.floor((p.x + p.w / 2 - 1) / ts);
    const top = Math.floor(p.y / ts);
    const bottom = Math.floor((p.y + p.h - 1) / ts);

    if (p.vx > 0 && right >= 0 && right < this.levelW) {
      for (let ty = top; ty <= bottom; ty++) {
        if (ty < 0 || ty >= this.levelH) continue;
        if (this.tiles[ty][right] !== TILE_AIR) {
          p.x = right * ts - p.w / 2;
          p.vx = 0;
          return;
        }
      }
    }
    if (p.vx < 0 && left >= 0 && left < this.levelW) {
      for (let ty = top; ty <= bottom; ty++) {
        if (ty < 0 || ty >= this.levelH) continue;
        if (this.tiles[ty][left] !== TILE_AIR) {
          p.x = (left + 1) * ts + p.w / 2;
          p.vx = 0;
          return;
        }
      }
    }
  }

  // ---- 垂直碰撞 ----
  resolveVerticalCollision() {
    const p = this.player;
    const ts = TILE_SIZE;
    const left = Math.floor((p.x - p.w / 2 + 2) / ts);
    const right = Math.floor((p.x + p.w / 2 - 2) / ts);
    const top = Math.floor(p.y / ts);
    const bottom = Math.floor((p.y + p.h - 1) / ts);

    // 下落 (脚踩)
    if (p.vy >= 0 && bottom >= 0 && bottom < this.levelH) {
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= this.levelW) continue;
        if (this.tiles[bottom][tx] !== TILE_AIR) {
          p.y = bottom * ts - p.h;
          p.vy = 0;
          p.onGround = true;
          return;
        }
      }
    }
    // 上升 (头顶)
    if (p.vy < 0 && top >= 0 && top < this.levelH) {
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= this.levelW) continue;
        const tile = this.tiles[top][tx];
        if (tile !== TILE_AIR) {
          if (tile === TILE_QUESTION && !this.questionBlocks.find(q => q.x === tx * ts && q.y === top * ts && !q.hit)) {
            // 问号砖块还没被顶过
            const qb = this.questionBlocks.find(q => q.x === tx * ts && q.y === top * ts && !q.hit);
            if (qb) {
              qb.hit = true;
              this.coinCount++;
              this.score += 100;
              this.spawnParticles(tx * ts + ts / 2, top * ts, '#FFD700', 8);
              // 弹出金币动画
              this.coins.push({
                x: tx * ts + ts / 2, y: top * ts - 10,
                collected: true, animTimer: 0, vy: COIN_BOUNCE, life: 0.8,
              });
            }
          }
          p.y = (top + 1) * ts;
          p.vy = 0;
          return;
        }
      }
    }
  }

  clampPlayerX() {
    if (this.player.x < this.player.w / 2) this.player.x = this.player.w / 2;
    if (this.player.x > this.levelW * TILE_SIZE - this.player.w / 2)
      this.player.x = this.levelW * TILE_SIZE - this.player.w / 2;
  }

  // ---- 敌人碰撞 ----
  checkEnemyCollision() {
    if (this.player.invincibleTimer > 0) return;
    const p = this.player;
    const pcx = p.x + p.w / 2;  // 玩家中心 x
    const pcy = p.y + p.h / 2;  // 玩家中心 y
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const e = enemy;
      const ecx = e.x + e.w / 2;  // 敌人中心 x
      const ecy = e.y + e.h / 2;  // 敌人中心 y
      // AABB 中心检测
      if (Math.abs(pcx - ecx) < (p.w + e.w) / 2 &&
          Math.abs(pcy - ecy) < (p.h + e.h) / 2) {
        // 从上方踩到敌人
        if (p.vy > 0 && pcy < ecy) {
          enemy.alive = false;
          p.vy = JUMP_VELOCITY * 0.65;
          this.score += 200;
          this.spawnParticles(e.x, e.y, '#FF6B35', 10);
        } else {
          this.killPlayer();
        }
      }
    }
  }

  killPlayer() {
    if (this.player.invincibleTimer > 0) return;
    this.player.invincibleTimer = 0.5;
    this.state = 'dying';
    this.stateTimer = DEATH_PAUSE;
    this.player.vy = JUMP_VELOCITY * 0.5;
    this.spawnParticles(this.player.x, this.player.y, '#FFFFFF', 12);
  }

  // ---- 金币收集 ----
  checkCoinCollection() {
    const p = this.player;
    const pcx = p.x + p.w / 2;  // 玩家中心 x
    const pcy = p.y + p.h / 2;  // 玩家中心 y
    for (const c of this.coins) {
      if (c.collected) continue;
      // 使用玩家中心 vs 金币中心的 AABB 检测
      // 增大检测范围，让金币更容易吃到
      const coinR = 12;
      if (Math.abs(pcx - c.x) < (p.w / 2 + coinR) && Math.abs(pcy - c.y) < (p.h / 2 + coinR)) {
        c.collected = true;
        c.vy = COIN_BOUNCE;
        c.life = 0.6;
        this.coinCount++;
        this.score += 50;
        this.spawnParticles(c.x, c.y, '#FFD700', 5);
      }
    }
  }

  // ---- 终点检测 ----
  checkFinish() {
    if (Math.abs(this.player.x - this.finishX) < 30 &&
        this.player.y + this.player.h >= this.finishY &&
        this.player.y <= this.finishY + TILE_SIZE) {
      this.state = 'complete';
      this.stateTimer = LEVEL_COMPLETE_PAUSE;
      this.score += 500;
      this.spawnParticles(this.finishX, this.finishY, '#00FF88', 20);
    }
  }

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 200;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 100,
        color, 0.4 + Math.random() * 0.5, 2 + Math.random() * 4
      ));
    }
  }

  // ======================== 触控（横版） ========================
  // 触控区域：
  //   左 1/3 → 跳跃（左手）
  //   中 1/3 → 后退/左移（右手）
  //   右 1/3 → 前进/右移（右手）
  // 只在下半屏幕生效（上半用于观察）
  handleTouchStart(x, y) {
    // 竖屏物理坐标 → 横屏逻辑坐标
    const lx = this._portraitH - y;
    const ly = x;

    // 教学模式下点击任意位置关闭教学
    if (this.showTutorial) {
      this.showTutorial = false;
      return;
    }

    // 如果处于结束状态，点按任意位置退出
    if (this.state === 'gameover' || this.state === 'allClear') {
      if (this.stateTimer <= 0) this.exitGame();
      return;
    }

    // 左上角返回按钮区域
    if (lx < 85 && ly < 52) {
      this.exitGame();
      return;
    }

    // 上半屏幕不响应
    if (ly < this.config.screenHeight * 0.35) return;

    // 距离检测：匹配绘制按钮位置
    this._hitTest(lx, ly);
  }

  handleTouchMove(x, y) {
    const lx = this._portraitH - y;
    const ly = x;

    if (ly < this.config.screenHeight * 0.35) {
      this.input.left = false;
      this.input.right = false;
      this.input.jump = false;
      return;
    }
    this._hitTest(lx, ly);
  }

  // 距离检测：方向键和跳跃键独立判断，互不干扰
  _hitTest(lx, ly) {
    const L = this.getButtonLayout();
    const { btnY, btnR, backCX, fwdCX, jumpCX } = L;
    const sw = this.config.screenWidth;

    // ---- 方向键（左半屏）----
    if (lx < sw * 0.45) {
      const distBack = Math.hypot(lx - backCX, ly - btnY);
      const distFwd  = Math.hypot(lx - fwdCX, ly - btnY);
      if (distBack < distFwd) {
        this.input.left  = true;
        this.input.right = false;
      } else {
        this.input.left  = false;
        this.input.right = true;
      }
      this._lastMoveTouch = true;
    } else {
      // 离开了方向键区域，不清空方向状态（由 handleTouchEnd 统一清）
    }

    // ---- 跳跃键（右半屏）独立判断，不干扰方向键 ----
    if (lx > sw * 0.55) {
      const distJump = Math.hypot(lx - jumpCX, ly - btnY);
      this.input.jump = (distJump < btnR + 20);
    }
  }

  handleTouchEnd(x, y) {
    this.input.left = false;
    this.input.right = false;
    this.input.jump = false;
    this.input.jumpConsumed = false;
  }

  // ======================== 渲染 ========================
  render() {
    const ctx = this.ctx;
    const sw = this.config.screenWidth;
    const sh = this.config.screenHeight;
    const cam = this.camera;
    const ts = TILE_SIZE;

    // 旋转矩阵：竖屏画布 → 横屏坐标
    // 画布物理 375×667 (竖)，逻辑坐标 667×375 (横)
    ctx.save();
    ctx.translate(0, this._portraitH);  // (0, 667)
    ctx.rotate(-Math.PI / 2);            // -90°

    // 0. 彻底清除画布，防频闪
    ctx.clearRect(0, 0, sw, sh);

    // 1. 海底背景
    const bgGrad = ctx.createLinearGradient(0, 0, 0, sh);
    bgGrad.addColorStop(0, '#0a1628');
    bgGrad.addColorStop(0.5, '#0f2847');
    bgGrad.addColorStop(1, '#163a5c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, sw, sh);

    // 背景气泡
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let i = 0; i < 20; i++) {
      const bx = (i * 173 + 67) % sw;
      const by = ((this.totalTime * 20 + i * 97) % (sh + 40)) - 20;
      const br = 4 + (i % 6);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // 远处光柱
    ctx.fillStyle = 'rgba(100, 200, 255, 0.03)';
    for (let i = 0; i < 5; i++) {
      const lx = (i * 190 + 40) - cam.x * 0.2;
      ctx.fillRect(lx % (sw + 200) - 100, 0, 60 + i * 20, sh);
    }

    // 2. 瓦片
    const startCol = Math.max(0, Math.floor(cam.x / ts) - 1);
    const endCol = Math.min(this.levelW, Math.ceil((cam.x + sw) / ts) + 1);
    const startRow = Math.max(0, Math.floor(cam.y / ts) - 1);
    const endRow = Math.min(this.levelH, Math.ceil((cam.y + sh) / ts) + 1);

    for (let ty = startRow; ty < endRow; ty++) {
      for (let tx = startCol; tx < endCol; tx++) {
        const tile = this.tiles[ty][tx];
        if (tile === TILE_AIR) continue;
        const sx = tx * ts - cam.x;
        const sy = ty * ts - cam.y;
        this.drawTile(ctx, sx, sy, tile, ty, tx);
      }
    }

    // 问号砖块（未被顶过的）
    for (const qb of this.questionBlocks) {
      if (qb.hit) continue;
      const sx = qb.x - cam.x;
      const sy = qb.y - cam.y;
      this.drawTile(ctx, sx, sy, TILE_QUESTION, Math.floor(qb.y / ts), Math.floor(qb.x / ts));
    }

    // 3. 终点旗帜
    this.drawFinish(ctx, cam);

    // 4. 金币
    for (const c of this.coins) {
      const sx = c.x - cam.x;
      const sy = c.y - cam.y;
      if (sx < -20 || sx > sw + 20 || sy < -20 || sy > sh + 20) continue;
      const spin = Math.cos(c.animTimer * 5);
      const scaleX = Math.abs(spin);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scaleX, 1);
      // 光晕
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      // 金币主体
      const coinGrad = ctx.createLinearGradient(-8, -8, 8, 8);
      coinGrad.addColorStop(0, '#FFE55C');
      coinGrad.addColorStop(0.5, '#FFD700');
      coinGrad.addColorStop(1, '#DAA520');
      ctx.fillStyle = coinGrad;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#B8860B';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
      // $ 符号
      if (scaleX > 0.3) {
        ctx.fillStyle = '#B8860B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    }

    // 5. 敌人
    for (const enemy of this.enemies) {
      enemy.draw(ctx, cam);
    }

    // 6. 玩家（鱼）
    this.drawPlayer(ctx, cam);

    // 7. 粒子
    for (const p of this.particles) {
      p.draw(ctx, cam);
    }

    // 8. UI 覆盖层
    this.drawUI(ctx);

    // 9. 触控提示
    this.drawControls(ctx);

    // 10. 新手引导
    if (this.showTutorial) this.drawTutorial(ctx);

    // 11. 结束画面
    if (this.state === 'gameover') this.drawGameOver(ctx);
    if (this.state === 'allClear') this.drawAllClear(ctx);

    ctx.restore();  // 恢复旋转矩阵
  }

  // ---- 绘制单个瓦片 ----
  drawTile(ctx, x, y, type, row, col) {
    const s = TILE_SIZE;
    if (type === TILE_GROUND) {
      // 石头/海底地面
      const isTop = row === this.levelH - 2;
      if (isTop) {
        // 表面层：珊瑚/海草色
        ctx.fillStyle = '#3D7A6E';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#4A9E8E';
        ctx.fillRect(x, y, s, 6);
        // 纹理
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x + 4, y + 10, 12, 2);
        ctx.fillRect(x + 22, y + 16, 8, 2);
      } else {
        // 深层：深色岩石
        ctx.fillStyle = '#4A5A6A';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = '#3D4D5D';
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
        ctx.fillStyle = '#526476';
        ctx.fillRect(x + 6, y + 8, 8, 6);
      }
    } else if (type === TILE_PLATFORM) {
      // 浮空平台：石板
      ctx.fillStyle = '#8B9DAF';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#9DB0C2';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      ctx.fillStyle = '#7A8C9E';
      ctx.fillRect(x + 2, y, s - 4, 4);
      // 纹理线
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, s - 4, s - 4);
    } else if (type === TILE_QUESTION) {
      // 问号砖块
      const bounce = Math.sin(this.animTime * 3 + col * 0.5) * 1;
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(x, y + bounce, s, s - bounce);
      ctx.fillStyle = '#FFC107';
      ctx.fillRect(x + 1, y + 1 + bounce, s - 2, s - 2 - bounce);
      ctx.strokeStyle = '#C79100';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2 + bounce, s - 4, s - 4 - bounce);
      // 问号
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + s / 2, y + s / 2 + bounce);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  // ---- 终点旗帜 ----
  drawFinish(ctx, cam) {
    const fx = this.finishX - cam.x;
    const fy = this.finishY - cam.y;
    // 旗杆
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(fx - 2, fy - TILE_SIZE * 2, 4, TILE_SIZE * 2);
    ctx.fillStyle = '#AAAAAA';
    ctx.fillRect(fx - 3, fy - TILE_SIZE * 2, 6, 4);
    // 旗帜
    const flagWave = Math.sin(this.animTime * 4) * 3;
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.moveTo(fx + 2, fy - TILE_SIZE * 2 + 4);
    ctx.lineTo(fx + 22 + flagWave, fy - TILE_SIZE * 2 + 16);
    ctx.lineTo(fx + 2, fy - TILE_SIZE * 2 + 28);
    ctx.closePath();
    ctx.fill();
    // ⭐
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', fx + 10 + flagWave * 0.5, fy - TILE_SIZE * 2 + 18);
    ctx.textAlign = 'left';
  }

  // ---- 玩家鱼 ----
  drawPlayer(ctx, cam) {
    const p = this.player;
    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) return;

    const sx = Math.round(p.x - cam.x);
    const sy = Math.round(p.y - cam.y);
    const cx = sx + p.w / 2, cy = sy + p.h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    if (!p.facingRight) ctx.scale(-1, 1);

    if (this.playerImgCanvas) {
      // 使用用户画的鱼
      const bob = Math.sin(this.animTime * 6) * 1.5;
      const tilt = p.onGround ? 0 : p.vy * 0.02;
      ctx.rotate(tilt);
      ctx.drawImage(this.playerImgCanvas, -p.w / 2, -p.h / 2 + bob, p.w, p.h);

      // 气泡（偶尔吐出）
      if (Math.random() < 0.03) {
        const bx = cx + p.w / 2 - 4;
        const by = cy - p.h / 2 + 4 + Math.sin(this.animTime * 6) * 1.5;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(bx - cx, by - cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // 默认鱼形
      this.drawDefaultFish(ctx, p.w, p.h);
    }

    ctx.restore();

    // 无敌状态的光环
    if (p.invincibleTimer > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, p.w / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---- 默认鱼（没有用户画的鱼时） ----
  drawDefaultFish(ctx, w, h) {
    const bob = Math.sin(this.animTime * 6) * 1.5;
    const tilt = this.player.onGround ? 0 : this.player.vy * 0.02;
    ctx.rotate(tilt);

    // 身体
    const bodyGrad = ctx.createLinearGradient(-w / 2, -h / 2, -w / 2, h / 2);
    bodyGrad.addColorStop(0, '#FF6B6B');
    bodyGrad.addColorStop(0.5, '#FF4444');
    bodyGrad.addColorStop(1, '#CC3333');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, bob, w / 2 - 2, h / 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 4, bob);
    ctx.lineTo(-w / 2 - 8, bob - h / 3);
    ctx.lineTo(-w / 2 - 4, bob);
    ctx.lineTo(-w / 2 - 8, bob + h / 3);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(w / 4, bob - 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w / 4 + 1.5, bob - 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // 鳍
    ctx.fillStyle = 'rgba(255,100,100,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, bob + h / 5);
    ctx.quadraticCurveTo(4, bob + h / 2.5, -4, bob + h / 2.2);
    ctx.fill();
  }

  // ---- UI（横版布局）----
  drawUI(ctx) {
    const sw = this.config.screenWidth;
    const padX = 50;    // 左右内边距（积分内收）

    // 顶栏
    const topBarH = 38;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
    ctx.fillRect(0, 0, sw, topBarH);

    const textY = topBarH / 2 + 5;
    const fontSize = 13;

    // 返回
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('返回', padX, textY);

    // 手绘爱心（避免 emoji 在某些手机上显示为方块）
    this.drawHearts(ctx, padX + 40, textY - 7, this.lives);

    // 关卡名（居中）
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(LEVELS[this.levelIndex].name, sw / 2, textY);

    // 金币 + 分数（右侧，留内边距）
    ctx.textAlign = 'right';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(`${this.coinCount}  ${this.score}分`, sw - padX, textY);

    ctx.textAlign = 'left';
  }

  // 手绘爱心（红心，带高光）
  drawHearts(ctx, startX, cy, count) {
    for (let i = 0; i < count; i++) {
      const cx = startX + i * 22;
      ctx.save();
      // 红心绘制
      ctx.fillStyle = '#FF3B5C';
      ctx.beginPath();
      const r = 4.5;
      ctx.moveTo(cx, cy + r * 1.4);
      ctx.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r, cy - r * 1.5, cx, cy - r);
      ctx.bezierCurveTo(cx + r, cy - r * 1.5, cx + r * 1.6, cy - r * 0.2, cx, cy + r * 1.4);
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(cx - 1.5, cy - r * 0.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---- 按钮布局（绘制和触控共用此计算）----
  getButtonLayout() {
    const sh = this.config.screenHeight;
    const sw = this.config.screenWidth;
    const btnR = 30;
    const barH = 64;
    const btnY = sh - barH / 2;
    const marginX = 100;         // 跳跃键内收
    const leftGap = 12;
    const backCX = marginX + btnR;
    const fwdCX  = backCX + btnR * 2 + leftGap;
    const jumpCX = sw - marginX - btnR;
    return { sh, sw, btnR, barH, btnY, marginX, leftGap, backCX, fwdCX, jumpCX };
  }

  // ---- 触控按钮（左手左下=前进后退，右手右下=跳跃）----
  drawControls(ctx) {
    const L = this.getButtonLayout();
    const { sh, sw, btnR, barH, btnY, backCX, fwdCX, jumpCX } = L;

    // 半透明底栏
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, sh - barH, sw, barH);

    // ============ 左手：前进/后退（左下角，紧挨） ============

    // -- 后退键 ◀ --
    const backActive = this.input.left;
    ctx.save();
    ctx.fillStyle = backActive ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(backCX, btnY, btnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // ◀ 三角
    ctx.fillStyle = backActive ? '#FFFFFF' : 'rgba(255,255,255,0.50)';
    ctx.beginPath();
    ctx.moveTo(backCX - 8, btnY);
    ctx.lineTo(backCX + 12, btnY - 12);
    ctx.lineTo(backCX + 12, btnY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // -- 前进键 ▶ --
    const fwdActive = this.input.right;
    ctx.save();
    ctx.fillStyle = fwdActive ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(fwdCX, btnY, btnR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // ▶ 三角
    ctx.fillStyle = fwdActive ? '#FFFFFF' : 'rgba(255,255,255,0.50)';
    ctx.beginPath();
    ctx.moveTo(fwdCX + 8, btnY);
    ctx.lineTo(fwdCX - 12, btnY - 12);
    ctx.lineTo(fwdCX - 12, btnY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ============ 右手：跳跃（右下角） ============
    const jumpActive = this.input.jump;
    ctx.save();
    ctx.fillStyle = jumpActive ? 'rgba(100, 200, 255, 0.40)' : 'rgba(100, 200, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(jumpCX, btnY, btnR + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.42)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // ▲ 三角
    ctx.fillStyle = jumpActive ? '#64C8FF' : 'rgba(200, 230, 255, 0.65)';
    ctx.beginPath();
    ctx.moveTo(jumpCX, btnY - 14);
    ctx.lineTo(jumpCX - 14, btnY + 8);
    ctx.lineTo(jumpCX + 14, btnY + 8);
    ctx.closePath();
    ctx.fill();
    // 二连跳小字
    const jumpsLeft = this.maxJumps - (this.player.jumpCount || 0);
    const dots = this.player.onGround ? '⬆⬆' : (jumpsLeft >= 2 ? '⬆⬆' : '⬆');
    ctx.fillStyle = 'rgba(200,230,255,0.50)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dots, jumpCX, btnY + btnR + 14);
    ctx.restore();
  }

  // ---- 新手引导（横版紧凑布局）----
  drawTutorial(ctx) {
    const sw = this.config.screenWidth;
    const sh = this.config.screenHeight;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, sw, sh);

    // 标题
    const titleY = sh * 0.12;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${LEVELS[this.levelIndex].name}`, sw / 2, titleY);

    // 操作说明：横排三栏（窄高型）
    const boxW = (sw - 50) / 3;
    const boxH = 64;
    const boxY = titleY + 14;
    const instr = [
      { icon: '⬆', label: '跳跃', sub: '左手', special: true },
      { icon: '◀', label: '后退', sub: '右手左侧' },
      { icon: '▶', label: '前进', sub: '右手右侧' },
    ];
    const boxColors = ['rgba(100,200,255,0.15)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)'];

    for (let i = 0; i < 3; i++) {
      const bx = 16 + i * (boxW + 9);
      ctx.fillStyle = boxColors[i];
      const r = 10;
      ctx.beginPath();
      ctx.moveTo(bx + r, boxY);
      ctx.lineTo(bx + boxW - r, boxY);
      ctx.arcTo(bx + boxW, boxY, bx + boxW, boxY + r, r);
      ctx.lineTo(bx + boxW, boxY + boxH - r);
      ctx.arcTo(bx + boxW, boxY + boxH, bx + boxW - r, boxY + boxH, r);
      ctx.lineTo(bx + r, boxY + boxH);
      ctx.arcTo(bx, boxY + boxH, bx, boxY + boxH - r, r);
      ctx.lineTo(bx, boxY + r);
      ctx.arcTo(bx, boxY, bx + r, boxY, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = instr[i].special ? 'rgba(100,200,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // 图标
      ctx.fillStyle = instr[i].special ? '#64C8FF' : '#FFFFFF';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(instr[i].icon, bx + boxW / 2, boxY + 26);
      // 标签
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(instr[i].label, bx + boxW / 2, boxY + 44);
      // 副标题
      ctx.fillStyle = 'rgba(255,255,255,0.50)';
      ctx.font = '9px sans-serif';
      ctx.fillText(instr[i].sub, bx + boxW / 2, boxY + 57);
    }

    // 玩法提示（精简到一行关键词）
    const tipY = boxY + boxH + 16;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⭐ 收金币  🦶 踩敌人  ⬆ 二连跳  🚩 到旗帜  ❤️ 3条命', sw / 2, tipY);

    // 小鱼预览 + 点击提示
    const previewY = tipY + 22;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sw / 2, previewY + 14, 22, 0, Math.PI * 2);
    ctx.clip();
    if (this.playerImgCanvas) {
      ctx.drawImage(this.playerImgCanvas, sw / 2 - 22, previewY - 8, 44, 44);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sw / 2, previewY + 14, 22.5, 0, Math.PI * 2);
    ctx.stroke();

    // 点击开始
    const alpha = 0.5 + Math.sin(this.tutorialTimer * 3) * 0.35;
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('👆 点击开始冒险！', sw / 2, previewY + 54);

    ctx.textAlign = 'left';
  }
  drawGameOver(ctx) {
    const sw = this.config.screenWidth;
    const sh = this.config.screenHeight;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, sw, sh);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', sw / 2, sh / 2 - 30);

    ctx.font = '14px sans-serif';
    ctx.fillText(`最终: ${this.score}分  |  金币: ${this.coinCount}`, sw / 2, sh / 2 + 6);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('点击屏幕返回', sw / 2, sh / 2 + 40);

    ctx.textAlign = 'left';
  }

  drawAllClear(ctx) {
    const sw = this.config.screenWidth;
    const sh = this.config.screenHeight;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, sw, sh);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎉 恭喜通关！', sw / 2, sh / 2 - 35);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px sans-serif';
    ctx.fillText(`总分: ${this.score}  |  金币: ${this.coinCount}`, sw / 2, sh / 2 + 2);

    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('你的小鱼是最棒的冒险家！', sw / 2, sh / 2 + 28);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.fillText('点击屏幕返回', sw / 2, sh / 2 + 52);
    ctx.textAlign = 'left';
  }

  // ======================== 退出 ========================
  exitGame() {
    this.isRunning = false;
    if (this.onExit) this.onExit({
      score: this.score,
      coins: this.coinCount,
      levelIndex: this.levelIndex,
      state: this.state,
      fishName: this._fishName
    });
  }

  destroy() {
    this.isRunning = false;
    this.input.left = false;
    this.input.right = false;
    this.input.jump = false;
    // 画布保持竖屏，不需重置尺寸；旋转矩阵由 render() 中 restore() 清理
  }
}

module.exports = { PlatformerGame };

// platformer/platformer.js
// 闯关游戏 —— 马里奥风格的平台跳跃，主角为用户绘制的鱼
const { generateLevelSpec, TILE_AIR, TILE_GROUND, TILE_PLATFORM, TILE_BRICK, TILE_QUESTION, generateTileMap } = require('./levelData');

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

// ======================== 子弹 ========================
class Bullet {
  constructor(x, y, vx) {
    this.x = x; this.y = y;
    this.vx = vx;
    this.vy = 0;
    this.w = 14; this.h = 8;
    this.alive = true;
    this.life = 1.5;       // 最大飞行时间（秒）
    this.trail = [];        // 拖尾粒子位置
  }
  update(dt, tiles, levelW, levelH, ts) {
    this.x += this.vx * dt;
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    // 拖尾记录
    this.trail.push({ x: this.x, y: this.y, life: 0.15 });
    if (this.trail.length > 8) this.trail.shift();
    for (const t of this.trail) t.life -= dt;
    this.trail = this.trail.filter(t => t.life > 0);
    // 撞墙——返回砖块击碎信息给调用方
    this.hitBrick = null;
    const tileX = this.vx > 0
      ? Math.floor((this.x + this.w / 2) / ts)
      : Math.floor((this.x - this.w / 2) / ts);
    const tileY = Math.floor(this.y / ts);
    if (tileY >= 0 && tileY < levelH && tileX >= 0 && tileX < levelW) {
      const t = tiles[tileY][tileX];
      if (t !== 0) {
        this.alive = false;
        if (t === 3) {  // TILE_BRICK
          tiles[tileY][tileX] = 0;  // 砖块被打碎
          this.hitBrick = { tx: tileX, ty: tileY };
        }
      }
    } else {
      this.alive = false;
    }
  }
  draw(ctx, cam) {
    if (!this.alive) return;
    const sx = this.x - cam.x;
    const sy = this.y - cam.y;
    // 拖尾
    for (const t of this.trail) {
      const alpha = t.life / 0.15;
      ctx.fillStyle = `rgba(100, 200, 255, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(t.x - cam.x, t.y - cam.y, 3 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    // 子弹主体（发光圆球）
    ctx.save();
    // 外发光
    ctx.fillStyle = 'rgba(100, 200, 255, 0.3)';
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    // 主体
    const grad = ctx.createRadialGradient(sx - 1, sy - 1, 1, sx, sy, 6);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.4, '#64C8FF');
    grad.addColorStop(1, 'rgba(30, 100, 200, 0.6)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
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
    this.w = 64; this.h = 64;
    this.alive = true;
    this.animTimer = Math.random() * Math.PI * 2;
    this.tileSize = ts;
    // 水母：上下浮动相位
    this.floatBaseY = this.y;
    this.floatPhase = Math.random() * Math.PI * 2;
    this.onGround = false;
    this.chasing = false;  // 是否正在追玩家
    // 飞行小怪：不受重力，自由飞行
    this.flying = (spec.type === 'octo' || spec.type === 'shark');
    this.detectRange = 500;   // 飞行小怪检测范围更大
  }

  update(dt, tiles, levelH, player) {
    if (!this.alive) return;
    this.animTimer += dt;

    // 飞行小怪：不受重力，自由飞行追玩家
    if (this.flying) {
      this._updateFlying(dt, tiles, levelH, player);
      return;
    }

    // 水平巡逻 —— 默认在巡逻范围内来回走
    // 但当玩家在画面内时，主动追玩家
    let moveDir = 0;
    if (player) {
      const dx = (player.x + player.w / 2) - (this.x + this.w / 2);
      const dy = (player.y + player.h / 2) - (this.y + this.h / 2);
      const dist = Math.hypot(dx, dy);
      // 检测范围：400 像素（约 10 格，覆盖大半个屏幕），高度差放宽到 200px
      if (dist < 400 && Math.abs(dy) < 200) {
        moveDir = dx > 0 ? 1 : -1;
        this.vx = moveDir * this.speed * 1.4;   // 追击速度 ×1.4
        this.chasing = true;
      } else {
        // 退回巡逻模式
        moveDir = this.vx > 0 ? 1 : -1;
        this.vx = moveDir * this.speed;
        this.chasing = false;
      }
    } else {
      moveDir = this.vx > 0 ? 1 : -1;
      this.vx = moveDir * this.speed;
      this.chasing = false;
    }

    this.x += this.vx * dt;
    // 追击模式下不受巡逻范围限制，能真正追到玩家身边
    if (!this.chasing) {
      if (this.x <= this.patrolLeft)  { this.x = this.patrolLeft;  this.vx = Math.abs(this.speed); }
      if (this.x >= this.patrolRight) { this.x = this.patrolRight; this.vx = -Math.abs(this.speed); }
    } else {
      // 追击模式下也防止跑出关卡边界
      if (this.x < this.w / 2) { this.x = this.w / 2; this.vx = Math.abs(this.speed) * 1.4; }
      if (this.x > tiles[0].length * this.tileSize - this.w / 2) {
        this.x = tiles[0].length * this.tileSize - this.w / 2;
        this.vx = -Math.abs(this.speed) * 1.4;
      }
    }

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

  // 飞行小怪专用更新逻辑
  _updateFlying(dt, tiles, levelH, player) {
    if (player) {
      const dx = (player.x + player.w / 2) - (this.x + this.w / 2);
      const dy = (player.y + player.h / 2) - (this.y + this.h / 2);
      const dist = Math.hypot(dx, dy);
      // 飞行小怪检测范围 500，追击时直接朝玩家方向飞行
      if (dist < this.detectRange) {
        // 归一化方向向量 × 速度
        const sp = this.speed * 1.2;   // 飞行追击速度
        if (dist > 1) {
          this.vx = (dx / dist) * sp;
          this.vy = (dy / dist) * sp;
        }
        this.chasing = true;
      } else {
        // 巡逻：在出生高度附近上下浮动 + 左右巡逻
        this.vx = (this.vx > 0 ? 1 : -1) * this.speed * 0.6;
        this.vy = Math.sin(this.animTimer * 2) * 30;   // 轻微上下浮动
        this.chasing = false;
      }
    } else {
      this.vx = (this.vx > 0 ? 1 : -1) * this.speed * 0.6;
      this.vy = Math.sin(this.animTimer * 2) * 30;
      this.chasing = false;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 巡逻模式下受水平范围限制
    if (!this.chasing) {
      if (this.x <= this.patrolLeft)  { this.x = this.patrolLeft;  this.vx = Math.abs(this.speed); }
      if (this.x >= this.patrolRight) { this.x = this.patrolRight; this.vx = -Math.abs(this.speed); }
    } else {
      // 追击时也不出关卡边界
      if (this.x < this.w / 2) this.x = this.w / 2;
      if (this.x > tiles[0].length * this.tileSize - this.w / 2)
        this.x = tiles[0].length * this.tileSize - this.w / 2;
    }
    // 防止飞出顶部或底部
    if (this.y < 20) this.y = 20;
    if (this.y > levelH * this.tileSize - this.h - 20)
      this.y = levelH * this.tileSize - this.h - 20;

    // 飞行碰撞：撞墙时反弹
    const tileL = Math.floor((this.x - this.w / 2) / this.tileSize);
    const tileR = Math.floor((this.x + this.w / 2 - 1) / this.tileSize);
    const tileTop = Math.floor(this.y / this.tileSize);
    const tileBot = Math.floor((this.y + this.h - 1) / this.tileSize);
    if (this.vx > 0 && tileR >= 0 && tileR < tiles[0].length) {
      for (let ty = tileTop; ty <= tileBot; ty++) {
        if (tiles[ty] && tiles[ty][tileR] !== TILE_AIR) {
          this.x = tileR * this.tileSize - this.w / 2;
          this.vx = -Math.abs(this.vx);
          break;
        }
      }
    }
    if (this.vx < 0 && tileL >= 0 && tileL < tiles[0].length) {
      for (let ty = tileTop; ty <= tileBot; ty++) {
        if (tiles[ty] && tiles[ty][tileL] !== TILE_AIR) {
          this.x = (tileL + 1) * this.tileSize + this.w / 2;
          this.vx = Math.abs(this.vx);
          break;
        }
      }
    }
    // 上下也检测撞墙
    if (this.vy < 0 && tileTop >= 0 && tileTop < tiles.length) {
      const midL = Math.floor((this.x - this.w / 2 + 4) / this.tileSize);
      const midR = Math.floor((this.x + this.w / 2 - 4) / this.tileSize);
      for (let tx = midL; tx <= midR; tx++) {
        if (tiles[tileTop] && tiles[tileTop][tx] !== TILE_AIR) {
          this.y = (tileTop + 1) * this.tileSize;
          this.vy = Math.abs(this.vy);
          break;
        }
      }
    }
    if (this.vy > 0 && tileBot >= 0 && tileBot < tiles.length) {
      const midL = Math.floor((this.x - this.w / 2 + 4) / this.tileSize);
      const midR = Math.floor((this.x + this.w / 2 - 4) / this.tileSize);
      for (let tx = midL; tx <= midR; tx++) {
        if (tiles[tileBot] && tiles[tileBot][tx] !== TILE_AIR) {
          this.y = tileBot * this.tileSize - this.h;
          this.vy = -Math.abs(this.vy);
          break;
        }
      }
    }
    this.onGround = false;
    if (this.y > levelH * this.tileSize + 100) this.alive = false;
  }

  draw(ctx, cam) {
    if (!this.alive) return;
    const sx = Math.round(this.x - cam.x);
    const sy = Math.round(this.y - cam.y);
    const cx = sx + this.w / 2;
    const cy = sy + this.h / 2;
    const t = this.animTimer;

    // ===== 通用辅助函数 =====
    // 可爱大眼睛（带双层高光 + 眨眼）
    const drawCuteEye = (ex, ey, r, blinkFactor = 1) => {
      const blink = blinkFactor;
      // 眼眶阴影
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(ex + 1, ey + 1.5, r, r * blink, 0, 0, Math.PI * 2); ctx.fill();
      // 眼白
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.ellipse(ex, ey, r, r * blink, 0, 0, Math.PI * 2); ctx.fill();
      if (blink > 0.3) {
        // 大黑眼珠
        ctx.fillStyle = '#1A1A3E';
        ctx.beginPath(); ctx.arc(ex + 0.5, ey + 1, r * 0.65, 0, Math.PI * 2); ctx.fill();
        // 主高光（大）
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(ex - r * 0.3, ey - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
        // 副高光（小亮点）
        ctx.beginPath(); ctx.arc(ex + r * 0.35, ey + r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
      }
    };
    // 腮红（渐变）
    const drawBlush = (bx, by) => {
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, 4);
      bg.addColorStop(0, 'rgba(255, 120, 160, 0.6)');
      bg.addColorStop(1, 'rgba(255, 120, 160, 0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
    };
    // 阴影（脚下椭圆）
    const drawShadow = (sw, sh) => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(cx, sy + this.h - 2, sw, sh, 0, 0, Math.PI * 2); ctx.fill();
    };
    // 微笑（通用）
    const drawSmile = (mx, my, mr, color = '#1A1A3E') => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0.2, Math.PI - 0.2); ctx.stroke();
    };

    ctx.save();

    if (this.type === 'shark') {
      // 🦈 鲨鱼：Q版胖鲨鱼 + 蓝灰多层渐变 + 摆尾 + 友好表情
      const wag = Math.sin(t * 4) * 0.12;
      const bob = Math.sin(t * 3) * 2;
      drawShadow(this.w / 2.5, 4);

      // 尾鳍（大三角 + 摆动 + 渐变）
      const tailY = cy + Math.sin(t * 6) * 5;
      const tg = ctx.createLinearGradient(cx - this.w / 2, cy, cx - this.w / 2 - 12, tailY);
      tg.addColorStop(0, '#4070A0');
      tg.addColorStop(1, '#2A5078');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(cx - this.w / 2 + 5, cy + bob);
      ctx.quadraticCurveTo(cx - this.w / 2 - 8, tailY - 12 + bob, cx - this.w / 2 - 12, tailY - 8 + bob);
      ctx.lineTo(cx - this.w / 2 - 6, tailY + bob);
      ctx.quadraticCurveTo(cx - this.w / 2 - 8, tailY + 12 + bob, cx - this.w / 2 - 12, tailY + 8 + bob);
      ctx.fill();

      // 身体（胖椭圆 + 多层渐变）
      const sg = ctx.createLinearGradient(cx, cy - this.h / 2 + bob, cx, cy + this.h / 2 + bob);
      sg.addColorStop(0, '#8DB5D0');
      sg.addColorStop(0.4, '#5A85A8');
      sg.addColorStop(0.7, '#4070A0');
      sg.addColorStop(1, '#2A5078');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(cx, cy + bob, this.w / 2, this.h / 2.3, wag, 0, Math.PI * 2);
      ctx.fill();

      // 腹部浅色
      const fg = ctx.createLinearGradient(cx, cy + bob, cx, cy + this.h / 3 + bob);
      fg.addColorStop(0, 'rgba(200, 225, 240, 0.5)');
      fg.addColorStop(1, 'rgba(220, 235, 245, 0.9)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 6 + bob, this.w / 2.6, this.h / 5, wag, 0, Math.PI * 2);
      ctx.fill();

      // 背鳍
      ctx.fillStyle = '#3A6595';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - this.h / 2.5 + bob);
      ctx.quadraticCurveTo(cx, cy - this.h / 2 - 12 + bob, cx + 8, cy - this.h / 2.5 + bob);
      ctx.fill();

      // 胸鳍
      ctx.fillStyle = '#4070A0';
      ctx.beginPath();
      ctx.moveTo(cx, cy + 4 + bob);
      ctx.quadraticCurveTo(cx - 4, cy + 16 + bob, cx + 12, cy + 10 + bob);
      ctx.fill();

      // 友好大眼睛
      drawCuteEye(cx + 7, cy - 4 + bob, 5.5);
      drawBlush(cx + 13, cy + 3 + bob);

      // 微笑 + 小尖牙
      ctx.strokeStyle = '#1A3050'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + this.w / 3, cy + 4 + bob, 5, Math.PI + 0.3, -0.3);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(cx + this.w / 3, cy + 8 + bob);
      ctx.lineTo(cx + this.w / 3 + 2.5, cy + 12 + bob);
      ctx.lineTo(cx + this.w / 3 - 2.5, cy + 12 + bob);
      ctx.fill();

    } else if (this.type === 'octo') {
      // 🐙 八爪鱼：圆头 + 8条触手 + 多层渐变 + 触手末端吸盘
      const float = Math.sin(t * 2) * 4;
      const breathe = 1 + Math.sin(t * 3) * 0.06;
      drawShadow(this.w / 3, 3);

      // 8 条触手
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI - Math.PI;
        const baseX = cx + Math.cos(ang) * this.w / 3;
        const baseY = cy + this.h / 6 + float;
        const wave = Math.sin(t * 4 + i * 0.8) * 5;
        const len = 16 + (i % 2) * 4;
        const endX = baseX + wave * 0.5;
        const endY = baseY + len;
        // 触手主体
        ctx.strokeStyle = '#FF7030'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(baseX + wave, baseY + len * 0.5, endX, endY);
        ctx.stroke();
        // 触手亮线
        ctx.strokeStyle = 'rgba(255, 180, 100, 0.5)'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY + 2);
        ctx.quadraticCurveTo(baseX + wave, baseY + len * 0.5, endX, endY);
        ctx.stroke();
        // 吸盘
        ctx.fillStyle = '#D04010';
        ctx.beginPath(); ctx.arc(endX, endY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FF9060';
        ctx.beginPath(); ctx.arc(endX - 0.5, endY - 0.5, 1, 0, Math.PI * 2); ctx.fill();
      }

      // 头部（多层渐变）
      const og = ctx.createRadialGradient(cx - 5, cy - 6 + float, 2, cx, cy + float, this.w / 2.2);
      og.addColorStop(0, '#FFB088');
      og.addColorStop(0.5, '#FF8040');
      og.addColorStop(0.8, '#E85020');
      og.addColorStop(1, '#C03000');
      ctx.fillStyle = og;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 4 + float, this.w / 2.2 * breathe, this.h / 3 * breathe, 0, 0, Math.PI * 2);
      ctx.fill();

      // 头部高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx - 5, cy - 8 + float, 6, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // 大眼睛
      drawCuteEye(cx - 7, cy - 6 + float, 5);
      drawCuteEye(cx + 7, cy - 6 + float, 5);
      drawBlush(cx - 12, cy + float);
      drawBlush(cx + 12, cy + float);

      // 微笑
      drawSmile(cx, cy + 2 + float, 3.5, '#A02000');

    } else if (this.type === 'puffer') {
      // 🐡 河豚：圆胖金黄 + 三层渐变 + 圆点刺 + 超大水汪汪眼
      const puff = 1 + Math.abs(Math.sin(t * 1.5)) * 0.12;
      const breathe = Math.sin(t * 3) * 0.04;
      drawShadow(this.w / 2.5, 4);

      // 身体
      const pg = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy + 2, this.w / 2 * puff);
      pg.addColorStop(0, '#FFF0A0');
      pg.addColorStop(0.3, '#FFE040');
      pg.addColorStop(0.7, '#FFC000');
      pg.addColorStop(1, '#D08800');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w / 2 * puff, this.h / 2 * puff * (1 + breathe), 0, 0, Math.PI * 2);
      ctx.fill();

      // 顶部高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx - 6, cy - 10, 8, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // 小圆点刺
      ctx.fillStyle = '#CC8800';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        for (let r = 0.55; r <= 0.92; r += 0.18) {
          const dx = cx + Math.cos(a) * this.w / 2 * puff * r;
          const dy = cy + Math.sin(a) * this.h / 2 * puff * (1 + breathe) * r;
          ctx.beginPath();
          ctx.arc(dx, dy, 1.8 * (1 - r * 0.3), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 侧鳍
      const finWag = Math.sin(t * 7) * 4;
      ctx.fillStyle = '#CC8800';
      ctx.beginPath();
      ctx.moveTo(cx - this.w / 2 + 4, cy);
      ctx.quadraticCurveTo(cx - this.w / 2 - 4, cy - 6 + finWag, cx - this.w / 2 - 8, cy + 2);
      ctx.quadraticCurveTo(cx - this.w / 2 - 4, cy + 6, cx - this.w / 2 + 4, cy + 2);
      ctx.fill();

      // 超大水汪汪眼睛
      drawCuteEye(cx - 8, cy - 3, 7);
      drawCuteEye(cx + 6, cy - 3, 7);

      // 鼓腮帮
      ctx.fillStyle = 'rgba(255, 180, 80, 0.4)';
      ctx.beginPath(); ctx.arc(cx - 12, cy + 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 12, cy + 6, 5, 0, Math.PI * 2); ctx.fill();
      drawBlush(cx - 14, cy + 4);
      drawBlush(cx + 14, cy + 4);

      // 嘟嘴
      ctx.fillStyle = '#CC6600';
      ctx.beginPath(); ctx.ellipse(cx - 1, cy + 7, 2.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();

    } else if (this.type === 'seaurchin') {
      // 🦔 海胆：圆球 + 满身尖刺 + 紫色渐变 + 小眼睛
      const breathe = 1 + Math.sin(t * 3) * 0.05;
      const rot = t * 0.3;
      drawShadow(this.w / 3, 3);

      // 尖刺（密集放射）
      const spikeCount = 24;
      for (let i = 0; i < spikeCount; i++) {
        const a = (i / spikeCount) * Math.PI * 2 + rot;
        const lenBase = 12 + (i % 3) * 3;
        const pulse = Math.sin(t * 2 + i * 0.5) * 2;
        const len = lenBase + pulse;
        const rIn = this.w / 2.5 * breathe;
        const rOut = rIn + len;
        const x1 = cx + Math.cos(a) * rIn;
        const y1 = cy + Math.sin(a) * rIn * 0.95;
        const x2 = cx + Math.cos(a) * rOut;
        const y2 = cy + Math.sin(a) * rOut * 0.95;
        const sg = ctx.createLinearGradient(x1, y1, x2, y2);
        sg.addColorStop(0, '#7A3A9A');
        sg.addColorStop(1, '#5A2A7A');
        ctx.strokeStyle = sg; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // 刺尖小亮点
        ctx.fillStyle = '#C080E0';
        ctx.beginPath(); ctx.arc(x2, y2, 1, 0, Math.PI * 2); ctx.fill();
      }

      // 身体（圆球 + 多层渐变）
      const bg = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, this.w / 2.5 * breathe);
      bg.addColorStop(0, '#B070D0');
      bg.addColorStop(0.5, '#8A40B0');
      bg.addColorStop(1, '#5A2070');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(cx, cy, this.w / 2.5 * breathe, this.h / 2.5 * breathe, 0, 0, Math.PI * 2);
      ctx.fill();

      // 高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx - 4, cy - 6, 6, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // 小眼睛
      const eyeBlink = Math.sin(t * 0.8) > 0.9 ? 0.1 : 1;
      drawCuteEye(cx - 5, cy - 1, 4, eyeBlink);
      drawCuteEye(cx + 5, cy - 1, 4, eyeBlink);

      drawBlush(cx - 9, cy + 3);
      drawBlush(cx + 9, cy + 3);

      // 小嘴巴
      ctx.fillStyle = '#4A1060';
      ctx.beginPath(); ctx.arc(cx, cy + 5, 1.8, 0, Math.PI * 2); ctx.fill();

    } else if (this.type === 'lobster') {
      // 🦞 龙虾：红色渐变 + 大钳子 + 多节身体 + 触须 + 尾扇
      const bounce = Math.sin(t * 5) * 2;
      const wag = Math.sin(t * 3) * 0.06;
      drawShadow(this.w / 2.5, 4);

      // 尾扇
      const tailWag = Math.sin(t * 4) * 4;
      ctx.fillStyle = '#C03020';
      ctx.beginPath();
      ctx.moveTo(cx - this.w / 2 + 8, cy + bounce);
      ctx.lineTo(cx - this.w / 2 - 6, cy - 10 + bounce + tailWag);
      ctx.lineTo(cx - this.w / 2 - 10, cy - 2 + bounce + tailWag);
      ctx.lineTo(cx - this.w / 2 - 10, cy + 6 + bounce - tailWag);
      ctx.lineTo(cx - this.w / 2 - 6, cy + 12 + bounce - tailWag);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8A2010'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - this.w / 2 + 8, cy + bounce);
      ctx.lineTo(cx - this.w / 2 - 8, cy - 6 + bounce + tailWag);
      ctx.moveTo(cx - this.w / 2 + 8, cy + bounce);
      ctx.lineTo(cx - this.w / 2 - 8, cy + 8 + bounce - tailWag);
      ctx.stroke();

      // 身体（多节）
      const bg = ctx.createLinearGradient(cx, cy - this.h / 2, cx, cy + this.h / 2);
      bg.addColorStop(0, '#FF6040');
      bg.addColorStop(0.4, '#E03020');
      bg.addColorStop(0.8, '#B02010');
      bg.addColorStop(1, '#8A1008');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(cx, cy + bounce, this.w / 2.5, this.h / 2.5, wag, 0, Math.PI * 2);
      ctx.fill();
      // 分节线
      ctx.strokeStyle = 'rgba(80, 10, 0, 0.4)'; ctx.lineWidth = 1.5;
      for (let i = 1; i <= 2; i++) {
        const segX = cx - this.w / 6 + i * this.w / 7;
        ctx.beginPath();
        ctx.moveTo(segX, cy - this.h / 3 + bounce);
        ctx.quadraticCurveTo(segX + 2, cy + bounce, segX, cy + this.h / 3 + bounce);
        ctx.stroke();
      }

      // 身体高光
      ctx.fillStyle = 'rgba(255, 200, 180, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy - 6 + bounce, 7, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // 大钳子
      const clawSwing = Math.sin(t * 4) * 3;
      for (const side of [-1, 1]) {
        const clx = cx + side * (this.w / 2 + 6);
        const cly = cy + 4 + bounce + clawSwing * side;
        // 钳臂
        ctx.strokeStyle = '#C03020'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + side * (this.w / 3), cy + bounce);
        ctx.quadraticCurveTo(cx + side * (this.w / 2.5), cy - 4 + bounce, clx, cly);
        ctx.stroke();
        // 钳子主体
        const clg = ctx.createRadialGradient(clx - 2, cly - 2, 1, clx, cly, 10);
        clg.addColorStop(0, '#FF7050');
        clg.addColorStop(0.6, '#E03020');
        clg.addColorStop(1, '#A01808');
        ctx.fillStyle = clg;
        ctx.beginPath();
        ctx.ellipse(clx, cly, 10, 8, side * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // 钳子开口
        ctx.fillStyle = '#5A0808';
        ctx.beginPath();
        ctx.moveTo(clx + side * 2, cly - 6);
        ctx.lineTo(clx + side * 8, cly - 2);
        ctx.lineTo(clx + side * 8, cly + 2);
        ctx.lineTo(clx + side * 2, cly + 6);
        ctx.closePath();
        ctx.fill();
        // 锯齿
        ctx.fillStyle = '#FFFFFF';
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(clx + side * (3 + j * 2), cly - 2 + j * 2, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 触须
      ctx.strokeStyle = '#C03020'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const wave1 = Math.sin(t * 3 + side) * 4;
        const wave2 = Math.sin(t * 3 + side + 1) * 6;
        ctx.beginPath();
        ctx.moveTo(cx + side * 4, cy - this.h / 3 + bounce);
        ctx.quadraticCurveTo(cx + side * 8 + wave1, cy - this.h / 2 + bounce, cx + side * 12 + wave2, cy - this.h / 2 - 8 + bounce);
        ctx.stroke();
      }

      // 眼睛
      const eyeY = cy - this.h / 3 - 2 + bounce;
      ctx.strokeStyle = '#C03020'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 4, cy - this.h / 3 + bounce); ctx.lineTo(cx - 4, eyeY - 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 4, cy - this.h / 3 + bounce); ctx.lineTo(cx + 4, eyeY - 3); ctx.stroke();
      drawCuteEye(cx - 4, eyeY, 4);
      drawCuteEye(cx + 4, eyeY, 4);

      drawBlush(cx - 10, cy + 2 + bounce);
      drawBlush(cx + 10, cy + 2 + bounce);

      // 微笑
      drawSmile(cx, cy + 4 + bounce, 3.5, '#5A0808');
    }
    ctx.restore();

    // 追击状态：头顶闪烁红色感叹号
    if (this.chasing) {
      const blink = Math.floor(this.animTimer * 6) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#FF3B5C';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', cx, sy - 10);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }
    }
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
    this.onExit = onExit;
    this._fishName = options.fishName || '未知小鱼';

    // 预处理：将鱼图缩放到 PLAYER_W × PLAYER_H，避免 drawPlayer 中实时拉伸导致锯齿/重影
    this.playerImgCanvas = this._preScalePlayerImage(playerImgCanvas);

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
    this.state = 'playing';    // 'playing' | 'dying' | 'complete' | 'gameover' | 'paused'

    // 玩家
    this.player = {
      x: 0, y: 0, vx: 0, vy: 0,
      w: PLAYER_W, h: PLAYER_H,
      facingRight: true,
      onGround: false,
      invincibleTimer: 0,
      jumpCount: 0,        // 当前已跳跃次数（三连跳）
    };
    this.maxJumps = 3;     // 最大跳跃次数（3 = 三连跳）

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
    this.bullets = [];       // 子弹数组
    this.finishX = 0;
    this.finishY = 0;
    this.ammo = 0;          // 弹药数量（顶问号 +3 发）
    this.shields = 0;        // 保护圈数量（顶问号获得，可叠加，碰怪消耗）
    this.fireCooldown = 0;   // 射击冷却计时

    // 输入
    this.input = { left: false, right: false, jump: false, jumpConsumed: false, fire: false, fireConsumed: false };
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
    this.ammo = 0;       // 新游戏清零弹药
    this.shields = 0;    // 新游戏清零保护圈
    this.loadLevel(0);
    this.isRunning = true;
    this.lastTime = Date.now();
    this.gameLoop();
  }

  loadLevel(index) {
    const spec = generateLevelSpec(index);
    this.levelW = spec.width;
    this.levelH = spec.height;
    this.levelName = spec.name;   // 保存关卡名供 UI 显示
    this.theme = spec.theme || null;   // 保存主题对象供背景渲染使用
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

    // 敌人（过滤掉距离出生点太近的，保证出生点安全）
    const startX = spec.playerStart.x;
    this.enemies = spec.enemies
      .filter(e => Math.abs(e.x - startX) >= 10)   // 至少离出生点 10 格
      .map(e => new Enemy(e, ts));

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
      reward: q.reward || 'ammo',   // 'ammo' 加子弹 / 'life' 加命
    }));

    // ---- 随机生成额外内容（基于关卡索引提高难度）----
    this._generateRandomContent(spec, index);

    this.particles = [];
    this.bullets = [];
    // 注意：ammo 和 shields 不在这里清零，跨关继承（仅 init 新游戏时重置）
    this.fireCooldown = 0;
    this.state = 'playing';
    this.stateTimer = 0;
    this.showTutorial = true;       // 每关开始显示教学
    this.tutorialTimer = 0;
    this.camera.x = 0;
    this.camera.y = Math.max(0, spec.height * ts - this.config.screenHeight);
  }

  // ======================== 随机内容生成 ========================
  // 根据关卡难度，在原有静态数据基础上随机补充敌人种类/数量和砖块障碍
  _generateRandomContent(spec, levelIndex) {
    const ts = TILE_SIZE;
    const W = spec.width, H = spec.height;
    const enemyTypes = ['shark', 'octo', 'puffer', 'seaurchin', 'lobster'];
    // 每关随机敌人数量：(3 + 关卡数 × 2) × 3
    const extraEnemyCount = (3 + levelIndex * 2) * 3;   // 小怪数量
    // 随机砖块数量：基础 4 + 关卡数 × 2
    const brickCount = 4 + levelIndex * 2;
    // 随机平台数量：基础 5 + 关卡数 * 2
    const platformCount = 5 + levelIndex * 2;
    // 随机问号砖块数量：基础 2 + 关卡数
    const questionCount = 2 + levelIndex;
    const used = new Set();   // 记录已占用 tile（"x,y"）

    // 标记已有内容的 tile 为已占用
    const markUsed = (x, y) => used.add(x + ',' + y);
    const isUsed = (x, y) => used.has(x + ',' + y);
    for (const [a, b] of spec.ground) for (let x = a; x < b; x++) { markUsed(x, H - 1); markUsed(x, H - 2); }
    for (const p of spec.platforms) for (let i = 0; i < p.w; i++) markUsed(p.x + i, p.y);
    for (const q of spec.questions) markUsed(q.x, q.y);
    for (const c of spec.coins) markUsed(c.x, c.y);
    for (const e of spec.enemies) markUsed(e.x, e.y);
    markUsed(spec.playerStart.x, spec.playerStart.y);
    markUsed(spec.finish.x, spec.finish.y);
    // 玩家附近 8 格内不生成任何内容（出生点安全区）
    for (let dx = -8; dx <= 8; dx++) {
      for (let dy = -3; dy <= 3; dy++) markUsed(spec.playerStart.x + dx, spec.playerStart.y + dy);
    }

    // 找出所有"地面正上方"且为空气的 tile（row H-3，用于放敌人）
    const groundTops = [];
    for (const [a, b] of spec.ground) {
      for (let x = a + 2; x < b - 1; x++) {   // 边缘留空，避免堵路
        if (!isUsed(x, H - 3)) groundTops.push({ x, y: H - 3 });
      }
    }

    // 1. 随机补充敌人（飞行小怪放空中，地面小怪放地面）
    const flyingTypes = ['octo', 'shark'];
    const isFlyingType = (t) => flyingTypes.indexOf(t) >= 0;

    for (let i = 0; i < extraEnemyCount; i++) {
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      if (isFlyingType(type)) {
        // 飞行小怪：在空中随机生成（row 4~9）
        for (let attempt = 0; attempt < 10; attempt++) {
          const x = 6 + Math.floor(Math.random() * (W - 12));
          const y = 4 + Math.floor(Math.random() * 6);   // row 4~9 空中
          if (isUsed(x, y)) continue;
          this.enemies.push(new Enemy({
            type, x, y,
            patrol: 3 + Math.floor(Math.random() * 4),
            speed: 0.6 + levelIndex * 0.2 + Math.random() * 0.4,
          }, ts));
          markUsed(x, y);
          break;
        }
      } else {
        // 地面小怪
        if (groundTops.length === 0) continue;
        const idx = Math.floor(Math.random() * groundTops.length);
        const pos = groundTops.splice(idx, 1)[0];
        this.enemies.push(new Enemy({
          type,
          x: pos.x,
          y: pos.y,
          patrol: 2 + Math.floor(Math.random() * 4),
          speed: 0.8 + levelIndex * 0.3 + Math.random() * 0.8,
        }, ts));
        markUsed(pos.x, pos.y);
      }
    }

    // 1.5. 随机生成问号砖块（位置和数量随机，奖励类型也随机）
    // 问号放在 row 10~11，玩家跳起来能顶到（row 11 是最佳位置）
    let qPlaced = 0, qAttempts = 0;
    while (qPlaced < questionCount && qAttempts < questionCount * 12) {
      qAttempts++;
      const x = 5 + Math.floor(Math.random() * (W - 10));
      const y = 10 + Math.floor(Math.random() * 2);   // row 10-11
      if (isUsed(x, y)) continue;
      // 上方必须为空气（玩家能跳上去顶到）
      if (isUsed(x, y - 1)) continue;
      // 下方必须有地面或平台支撑（问号不能悬空太离谱）
      // 检查下方 1~3 格内是否有地面/平台
      let hasSupport = false;
      for (let dy = 1; dy <= 3; dy++) {
        if (y + dy >= H) break;
        const t = this.tiles[y + dy][x];
        if (t !== TILE_AIR) { hasSupport = true; break; }
      }
      if (!hasSupport) continue;
      // 左右 1 格内不重复放问号
      if (isUsed(x - 1, y) && this.tiles[y][x - 1] === 4) continue;
      if (isUsed(x + 1, y) && this.tiles[y][x + 1] === 4) continue;

      // 随机奖励类型：50% 子弹，25% 加命，25% 保护圈
      const rr = Math.random();
      const reward = rr < 0.5 ? 'ammo' : (rr < 0.75 ? 'life' : 'shield');
      this.tiles[y][x] = 4;   // TILE_QUESTION
      this.questionBlocks.push({
        x: x * ts, y: y * ts,
        hit: false,
        reward,
      });
      markUsed(x, y);
      qPlaced++;
    }

    // 2. 随机补充平台（灰色格子）
    // 平台放在 row 9~12，宽度 2~5 格，玩家能跳上去
    let platPlaced = 0, platAttempts = 0;
    while (platPlaced < platformCount && platAttempts < platformCount * 15) {
      platAttempts++;
      const pw = 2 + Math.floor(Math.random() * 4);  // 宽度 2~5
      const px = 5 + Math.floor(Math.random() * (W - pw - 10));
      const py = 9 + Math.floor(Math.random() * 4);   // row 9~12
      // 检查整段平台位置是否都被占用
      let conflict = false;
      for (let i = 0; i < pw; i++) {
        if (isUsed(px + i, py)) { conflict = true; break; }
        // 上方 1 格也必须为空气（玩家能站上去）
        if (isUsed(px + i, py - 1)) { conflict = true; break; }
      }
      if (conflict) continue;
      // 平台下方也得有地面支撑感：避免悬空太高（row 9 以下需要能跳到）
      // 检查左右是否有其他平台太近（避免连成一片）
      if (isUsed(px - 1, py) || isUsed(px + pw, py)) continue;
      // 放置平台
      for (let i = 0; i < pw; i++) {
        this.tiles[py][px + i] = 2;   // TILE_PLATFORM
        markUsed(px + i, py);
      }
      platPlaced++;
    }

    // 3. 随机补充砖块障碍
    // 砖块放在 row 10~12 的空气中（玩家跳跃路径上，作为障碍）
    let placed = 0, attempts = 0;
    while (placed < brickCount && attempts < brickCount * 12) {
      attempts++;
      const x = 4 + Math.floor(Math.random() * (W - 8));
      const y = 10 + Math.floor(Math.random() * 3);   // row 10-12
      if (isUsed(x, y)) continue;
      // 上下方也得是空气，避免砖块挤压玩家
      if (isUsed(x, y - 1)) continue;
      if (isUsed(x, y + 1)) continue;
      // 横向避免连续砖块墙堵死路：检查左右 2 格内是否已有砖块
      let blocked = false;
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0) continue;
        if (this.tiles[y][x + dx] === 3) { blocked = true; break; }
      }
      if (blocked) continue;

      this.tiles[y][x] = 3;   // TILE_BRICK
      markUsed(x, y);
      placed++;
    }

    // 4. 随机生成金币堆（矩形/弧形/斜线三种形状）
    // 每关固定 100 个金币，随机分布在各种形状的金币堆中
    const TARGET_COINS = 100;
    let totalCoins = 0, ccAttempts = 0;
    while (totalCoins < TARGET_COINS && ccAttempts < 200) {
      ccAttempts++;
      // 随机位置（避开出生点 10 格内）
      const baseX = 10 + Math.floor(Math.random() * (W - 20));
      const baseY = 7 + Math.floor(Math.random() * 7);   // row 7~13
      // 形状随机：0=矩形, 1=弧形, 2=斜线
      const shape = Math.floor(Math.random() * 3);
      const coins = [];
      if (shape === 0) {
        // 矩形：宽 3~5，高 2~3
        const rw = 3 + Math.floor(Math.random() * 3);
        const rh = 2 + Math.floor(Math.random() * 2);
        for (let dx = 0; dx < rw; dx++) {
          for (let dy = 0; dy < rh; dy++) {
            coins.push({ x: baseX + dx, y: baseY + dy });
          }
        }
      } else if (shape === 1) {
        // 弧形：半圆弧，半径 3~4
        const radius = 3 + Math.floor(Math.random() * 2);
        for (let dx = -radius; dx <= radius; dx++) {
          const dy = -Math.round(Math.sqrt(Math.max(0, radius * radius - dx * dx)));
          coins.push({ x: baseX + dx + radius, y: baseY - dy + radius });
        }
      } else {
        // 斜线：对角线，长度 4~6
        const len = 4 + Math.floor(Math.random() * 3);
        const dir = Math.random() < 0.5 ? 1 : -1;   // 右上或右下
        for (let i = 0; i < len; i++) {
          coins.push({ x: baseX + i, y: baseY + i * dir });
        }
      }

      // 检查所有位置是否可用（空气且未占用）
      let valid = true;
      for (const c of coins) {
        if (c.x < 0 || c.x >= W || c.y < 0 || c.y >= H) { valid = false; break; }
        if (isUsed(c.x, c.y)) { valid = false; break; }
        // 金币不能在地面或平台内部
        if (this.tiles[c.y][c.x] !== TILE_AIR) { valid = false; break; }
      }
      if (!valid) continue;

      // 放置金币堆
      let placedThisCluster = 0;
      for (const c of coins) {
        if (totalCoins >= TARGET_COINS) break;   // 达到 100 个就停
        this.coins.push({
          x: c.x * ts + ts / 2,
          y: c.y * ts + ts / 2,
          collected: false,
          animTimer: Math.random() * Math.PI * 2,
          vy: 0,
          life: 0,
        });
        markUsed(c.x, c.y);
        totalCoins++;
        placedThisCluster++;
      }
    }
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
        // 无限关卡：永远进入下一关
        this.loadLevel(this.levelIndex);
      }
      return;
    }
    if (this.state === 'gameover') {
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

    // 跳跃（最大 3 连跳）
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
      // 空中跳跃特效粒子
      if (this.player.jumpCount > 1) {
        this.spawnParticles(this.player.x, this.player.y + this.player.h, '#64C8FF', 6);
      }
    }
    if (!this.input.jump) this.input.jumpConsumed = false;

    // 射击
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.ammo > 0 && this.input.fire && !this.input.fireConsumed && this.fireCooldown <= 0) {
      const dir = this.player.facingRight ? 1 : -1;
      this.bullets.push(new Bullet(
        this.player.x + dir * (this.player.w / 2 + 6),
        this.player.y + this.player.h / 2,   // 从鱼身中部射出
        dir * 450
      ));
      this.ammo--;              // 消耗一发子弹
      this.fireCooldown = 0.35;   // 射击冷却 0.35 秒
      this.input.fireConsumed = true;
    }
    if (!this.input.fire) this.input.fireConsumed = false;

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
      enemy.update(dt, this.tiles, this.levelH, this.player);
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

    // ---- 子弹更新 ----
    for (const b of this.bullets) {
      b.update(dt, this.tiles, this.levelW, this.levelH, TILE_SIZE);
      if (b.hitBrick) {
        this.spawnParticles(
          b.hitBrick.tx * TILE_SIZE + TILE_SIZE / 2,
          b.hitBrick.ty * TILE_SIZE + TILE_SIZE / 2,
          '#B5651D', 10
        );
      }
    }
    this.bullets = this.bullets.filter(b => b.alive);

    // ---- 子弹 vs 敌人 ----
    // 子弹水平飞行，但敌人可能比子弹射出位置低很多
    // 因此垂直命中判定范围扩大，让子弹能稳定打中地面上的敌人
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const ecx = enemy.x + enemy.w / 2;
        const ecy = enemy.y + enemy.h / 2;
        // 垂直判定范围：子弹高度 + 玩家身高（约 72px），保证子弹能命中地面敌人
        const hitH = b.h + PLAYER_H * 1.5;   // 子弹垂直命中范围扩大，对准地面敌人
        if (Math.abs(b.x - ecx) < (b.w + enemy.w) / 2 &&
            Math.abs(b.y - ecy) < (hitH + enemy.h) / 2) {
          enemy.alive = false;
          b.alive = false;
          this.score += 150;
          this.spawnParticles(enemy.x, enemy.y, '#64C8FF', 8);
          break;
        }
      }
    }

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
    // 上升 (头顶) — 两遍扫描：先处理问号砖块，再处理普通碰撞
    if (p.vy < 0 && top >= 0 && top < this.levelH) {
      // 第一遍：扫描所有列，优先处理问号砖块
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= this.levelW) continue;
        if (this.tiles[top][tx] === TILE_QUESTION) {
          const qb = this.questionBlocks.find(q => q.x === tx * ts && q.y === top * ts && !q.hit);
          if (qb) {
            qb.hit = true;
            this.score += 100;
            if (qb.reward === 'life') {
              // 加 1 条命（无上限）
              this.lives++;
              this.spawnParticles(tx * ts + ts / 2, top * ts, '#FF3B5C', 16);
              // 弹出爱心动画（复用金币弹出，改色）
              this.coins.push({
                x: tx * ts + ts / 2, y: top * ts - 10,
                collected: true, animTimer: 0, vy: COIN_BOUNCE, life: 0.8, isHeart: true,
              });
            } else if (qb.reward === 'shield') {
              // 加 1 个保护圈（可叠加）
              this.shields++;
              this.spawnParticles(tx * ts + ts / 2, top * ts, '#00E8FF', 16);
              // 弹出护盾图标动画
              this.coins.push({
                x: tx * ts + ts / 2, y: top * ts - 10,
                collected: true, animTimer: 0, vy: COIN_BOUNCE, life: 0.8, isShield: true,
              });
            } else {
              // 加 3 发子弹
              this.ammo += 3;
              this.spawnParticles(tx * ts + ts / 2, top * ts, '#FFD700', 12);
              this.coins.push({
                x: tx * ts + ts / 2, y: top * ts - 10,
                collected: true, animTimer: 0, vy: COIN_BOUNCE, life: 0.8,
              });
            }
            this.tiles[top][tx] = TILE_AIR;  // 顶完后变空气
          }
        }
      }
      // 第二遍：检查该行剩余阻挡（问号已变空气，平台等仍在）
      for (let tx = left; tx <= right; tx++) {
        if (tx < 0 || tx >= this.levelW) continue;
        if (this.tiles[top][tx] !== TILE_AIR) {
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
          // 有保护圈：消耗一个保护圈，击退玩家，不死
          if (this.shields > 0) {
            this.shields--;
            this.player.invincibleTimer = 1.5;
            // 击退玩家
            const knockDir = pcx < ecx ? -1 : 1;
            this.player.vx = knockDir * MOVE_SPEED * 1.2;
            this.player.vy = JUMP_VELOCITY * 0.5;
            this.spawnParticles(this.player.x, this.player.y, '#00E8FF', 16);
          } else {
            this.killPlayer();
          }
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
  //   左半屏 → 后退/前进（左手，两个按钮紧挨）
  //   右半屏 → 跳跃（右手）+ 上方开火键
  // 只在下半屏幕生效（上半用于观察）
  // 多指触控：activeTouches 跟踪所有按下的手指，抬手时只移除对应的手指，
  // 然后基于剩余手指重新评估输入状态，避免多指操作时误清除跳跃。
  handleTouchStart(x, y, touchId) {
    // 竖屏物理坐标 → 横屏逻辑坐标
    const lx = this._portraitH - y;
    const ly = x;
    const id = touchId != null ? touchId : (Date.now() + Math.random());

    // 教学模式下点击任意位置关闭教学
    if (this.showTutorial) {
      this.showTutorial = false;
      return;
    }

    // 如果处于结束状态，点按任意位置退出
    if (this.state === 'gameover') {
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

    // 记录触摸点并重新评估所有手指的输入
    this.activeTouches[id] = { x: lx, y: ly };
    this._evalInputs();
  }

  handleTouchMove(x, y, touchId) {
    const lx = this._portraitH - y;
    const ly = x;
    const id = touchId != null ? touchId : (Date.now() + Math.random());

    if (ly < this.config.screenHeight * 0.35) {
      // 手指滑到上半屏幕：移除该触摸点
      delete this.activeTouches[id];
      this._evalInputs();
      return;
    }

    // 更新触摸点位置并重新评估
    if (this.activeTouches[id]) {
      this.activeTouches[id] = { x: lx, y: ly };
    } else {
      this.activeTouches[id] = { x: lx, y: ly };
    }
    this._evalInputs();
  }

  handleTouchEnd(x, y, touchId) {
    const id = touchId != null ? touchId : (Date.now() + Math.random());
    delete this.activeTouches[id];
    this._evalInputs();
  }

  // 输入状态复位（用于 touchCancel 等异常情况）
  _resetInputs() {
    this.input.left = false;
    this.input.right = false;
    this.input.jump = false;
    this.input.jumpConsumed = false;
    this.input.fire = false;
    this.input.fireConsumed = false;
    this.activeTouches = {};
  }

  // 基于所有活跃触摸点重新评估方向键和跳跃键
  _evalInputs() {
    const activeIds = Object.keys(this.activeTouches);
    if (activeIds.length === 0) {
      this._resetInputs();
      return;
    }

    const L = this.getButtonLayout();
    const { btnY, btnR, backCX, fwdCX, jumpCX } = L;
    const sw = this.config.screenWidth;
    const enlargeR = btnR + 24; // 稍微放大判定半径，提升手感

    // 方向键：只要有任意活跃手指在左半屏，取最近的那根
    let leftActive = false, rightActive = false;
    let bestMoveDist = Infinity;
    for (const id of activeIds) {
      const t = this.activeTouches[id];
      if (t.x < sw * 0.45) {
        const dBack = Math.hypot(t.x - backCX, t.y - btnY);
        const dFwd  = Math.hypot(t.x - fwdCX, t.y - btnY);
        if (dBack < dFwd && dBack < bestMoveDist) {
          bestMoveDist = dBack;
          leftActive = true; rightActive = false;
        } else if (dFwd < dBack && dFwd < bestMoveDist) {
          bestMoveDist = dFwd;
          leftActive = false; rightActive = true;
        }
      }
    }
    this.input.left = leftActive;
    this.input.right = rightActive;
    if (leftActive || rightActive) this._lastMoveTouch = true;

    // 跳跃键：只要有任意活跃手指在右半屏且在判定范围内
    let jumpActive = false;
    for (const id of activeIds) {
      const t = this.activeTouches[id];
      if (t.x > sw * 0.55) {
        const distJump = Math.hypot(t.x - jumpCX, t.y - btnY);
        if (distJump < enlargeR) {
          jumpActive = true;
          break;
        }
      }
    }
    this.input.jump = jumpActive;

    // 开火键：跳跃键上方独立区域
    let fireActive = false;
    const L2 = this.getButtonLayout();
    for (const id of activeIds) {
      const t = this.activeTouches[id];
      if (t.x > sw * 0.55) {
        const distFire = Math.hypot(t.x - L2.fireCX, t.y - L2.fireCY);
        if (distFire < enlargeR) {
          fireActive = true;
          break;
        }
      }
    }
    this.input.fire = fireActive;
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

    // 1. 海底背景 —— 根据关卡主题渲染
    this.drawThemedBackground(ctx, sw, sh, cam);

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

    // 问号砖块（未被顶过的）——统一金色外观，奖励随机
    for (const qb of this.questionBlocks) {
      if (qb.hit) continue;
      const sx = qb.x - cam.x;
      const sy = qb.y - cam.y;
      const bounce = Math.sin(this.animTime * 3 + (qb.x / ts) * 0.5) * 1;
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(sx, sy + bounce, ts, ts - bounce);
      ctx.fillStyle = '#FFC107';
      ctx.fillRect(sx + 1, sy + 1 + bounce, ts - 2, ts - 2 - bounce);
      ctx.strokeStyle = '#C79100';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 2, sy + 2 + bounce, ts - 4, ts - 4 - bounce);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.round(ts * 0.45)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', sx + ts / 2, sy + ts / 2 + bounce);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
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
      if (c.isHeart) {
        // 爱心（加命奖励弹出动画）
        ctx.fillStyle = 'rgba(255, 59, 92, 0.3)';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        const r = 8;
        ctx.fillStyle = '#FF3B5C';
        ctx.beginPath();
        ctx.moveTo(0, r * 1.4);
        ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r, -r * 1.5, 0, -r);
        ctx.bezierCurveTo(r, -r * 1.5, r * 1.6, -r * 0.2, 0, r * 1.4);
        ctx.fill();
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(-2.5, -r * 0.6, 2, 0, Math.PI * 2); ctx.fill();
      } else if (c.isShield) {
        // 护盾图标（保护圈奖励弹出动画）
        ctx.fillStyle = 'rgba(0, 232, 255, 0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
        // 六边形护盾
        const sr = 8;
        ctx.fillStyle = '#00E8FF';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const px = Math.cos(a) * sr;
          const py = Math.sin(a) * sr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(-2.5, -3, 2.5, 0, Math.PI * 2); ctx.fill();
        // 中心亮点
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
      } else {
        // 金币
        ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        const coinGrad = ctx.createLinearGradient(-8, -8, 8, 8);
        coinGrad.addColorStop(0, '#FFE55C');
        coinGrad.addColorStop(0.5, '#FFD700');
        coinGrad.addColorStop(1, '#DAA520');
        ctx.fillStyle = coinGrad;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
        if (scaleX > 0.3) {
          ctx.fillStyle = '#B8860B';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0.5);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
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

    // 7.5. 子弹
    for (const b of this.bullets) {
      b.draw(ctx, cam);
    }

    // 8. UI 覆盖层
    this.drawUI(ctx);

    // 9. 触控提示
    this.drawControls(ctx);

    // 9.5. 开火键
    this.drawFireButton(ctx);

    // 10. 新手引导
    if (this.showTutorial) this.drawTutorial(ctx);

    // 11. 结束画面
    if (this.state === 'gameover') this.drawGameOver(ctx);

    ctx.restore();  // 恢复旋转矩阵
  }

  // ---- 主题背景渲染 ----
  drawThemedBackground(ctx, sw, sh, cam) {
    const theme = this.theme;
    if (!theme || !theme.bgStops) {
      // 兜底：原固定背景
      const bgGrad = ctx.createLinearGradient(0, 0, 0, sh);
      bgGrad.addColorStop(0, '#0a1628');
      bgGrad.addColorStop(0.5, '#0f2847');
      bgGrad.addColorStop(1, '#163a5c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, sw, sh);
      return;
    }

    // 1a. 多段渐变背景
    const bgGrad = ctx.createLinearGradient(0, 0, 0, sh);
    for (const stop of theme.bgStops) {
      bgGrad.addColorStop(stop.pos, stop.color);
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, sw, sh);

    // 1b. 主题装饰
    const decoType = theme.decoType;
    const decoColor = theme.decoColor || 'rgba(100,200,255,0.05)';
    const t = this.totalTime;

    if (decoType === 'sunrays') {
      // 浅滩：阳光光柱（从顶部斜射，缓慢移动）
      for (let i = 0; i < 6; i++) {
        const baseX = (i * 180 + 40) - cam.x * 0.15;
        const lx = ((baseX % (sw + 300)) + (sw + 300)) % (sw + 300) - 150;
        const w = 50 + i * 15;
        const sway = Math.sin(t * 0.5 + i) * 20;
        const grad = ctx.createLinearGradient(lx + sway, 0, lx + sway + w, sh);
        grad.addColorStop(0, decoColor);
        grad.addColorStop(0.7, decoColor.replace(/[\d.]+\)/, '0.03)'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(lx + sway, 0);
        ctx.lineTo(lx + sway + w, 0);
        ctx.lineTo(lx + sway + w + 80, sh);
        ctx.lineTo(lx + sway - 30, sh);
        ctx.closePath();
        ctx.fill();
      }
      // 浅滩额外：海底沙地起伏
      ctx.fillStyle = 'rgba(80, 120, 100, 0.15)';
      ctx.beginPath();
      ctx.moveTo(0, sh);
      for (let x = 0; x <= sw; x += 20) {
        const y = sh - 30 - Math.sin((x + cam.x * 0.3) * 0.02) * 15 - Math.sin((x + cam.x * 0.3) * 0.05) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(sw, sh);
      ctx.closePath();
      ctx.fill();

    } else if (decoType === 'seaweed') {
      // 珊瑚暗礁：背景海草飘动 + 远处珊瑚剪影
      ctx.fillStyle = decoColor;
      for (let i = 0; i < 8; i++) {
        const baseX = (i * 120 + 30) - cam.x * 0.2;
        const x = ((baseX % (sw + 200)) + (sw + 200)) % (sw + 200) - 100;
        const h = 80 + (i % 3) * 40;
        const sway = Math.sin(t * 1.2 + i * 0.7) * 12;
        ctx.strokeStyle = decoColor;
        ctx.lineWidth = 6 + (i % 2) * 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, sh);
        ctx.quadraticCurveTo(x + sway * 0.5, sh - h * 0.5, x + sway, sh - h);
        ctx.stroke();
      }
      // 远处珊瑚剪影
      ctx.fillStyle = 'rgba(60, 30, 50, 0.25)';
      for (let i = 0; i < 5; i++) {
        const cx = (i * 200 + 50) - cam.x * 0.1;
        const x = ((cx % (sw + 300)) + (sw + 300)) % (sw + 300) - 150;
        ctx.beginPath();
        ctx.moveTo(x, sh);
        ctx.lineTo(x + 20, sh - 50);
        ctx.lineTo(x + 40, sh - 30);
        ctx.lineTo(x + 60, sh - 60);
        ctx.lineTo(x + 80, sh - 20);
        ctx.lineTo(x + 90, sh);
        ctx.closePath();
        ctx.fill();
      }

    } else if (decoType === 'glowdots') {
      // 深渊迷宫：深海发光生物点（缓慢闪烁漂移）
      for (let i = 0; i < 30; i++) {
        const seed = i * 137;
        const bx = ((seed + cam.x * 0.1) % sw + sw) % sw;
        const by = ((seed * 1.7 + t * 8) % (sh + 100));
        const phase = (t * 0.8 + i * 0.5) % (Math.PI * 2);
        const flicker = 0.3 + Math.abs(Math.sin(phase)) * 0.7;
        const r = 1.5 + (i % 3);
        ctx.fillStyle = decoColor.replace(/[\d.]+\)/, (flicker * 0.25).toFixed(2) + ')');
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
        // 光晕
        ctx.fillStyle = decoColor.replace(/[\d.]+\)/, (flicker * 0.08).toFixed(2) + ')');
        ctx.beginPath();
        ctx.arc(bx, by, r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (decoType === 'embers') {
      // 深海火山：上升火星 + 底部岩浆红光
      // 底部红光
      const lavaGrad = ctx.createLinearGradient(0, sh - 80, 0, sh);
      lavaGrad.addColorStop(0, 'rgba(255, 60, 0, 0)');
      lavaGrad.addColorStop(1, 'rgba(255, 80, 0, 0.25)');
      ctx.fillStyle = lavaGrad;
      ctx.fillRect(0, sh - 80, sw, 80);
      // 上升火星
      for (let i = 0; i < 40; i++) {
        const seed = i * 211;
        const speed = 30 + (i % 5) * 15;
        const bx = ((seed + cam.x * 0.2) % sw + sw) % sw;
        const by = sh - ((t * speed + seed * 3) % (sh + 50));
        const r = 1 + (i % 3);
        const flicker = 0.4 + Math.abs(Math.sin(t * 3 + i)) * 0.6;
        ctx.fillStyle = decoColor.replace(/[\d.]+\)/, (flicker * 0.3).toFixed(2) + ')');
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (decoType === 'crystals') {
      // 荧光海穴：发光晶体（多边形 + 脉冲光晕）
      for (let i = 0; i < 12; i++) {
        const seed = i * 173;
        const cx = ((seed + cam.x * 0.15) % (sw + 200) + (sw + 200)) % (sw + 200) - 100;
        const cy = sh - 40 - (i % 4) * 50 - (seed % 30);
        const pulse = 0.5 + Math.abs(Math.sin(t * 1.5 + i * 0.8)) * 0.5;
        const size = 8 + (i % 3) * 4;
        // 光晕
        ctx.fillStyle = decoColor.replace(/[\d.]+\)/, (pulse * 0.15).toFixed(2) + ')');
        ctx.beginPath();
        ctx.arc(cx, cy, size * 3, 0, Math.PI * 2);
        ctx.fill();
        // 晶体（菱形）
        ctx.fillStyle = decoColor.replace(/[\d.]+\)/, (0.3 + pulse * 0.3).toFixed(2) + ')');
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size * 0.6, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size * 0.6, cy);
        ctx.closePath();
        ctx.fill();
        // 高光
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (pulse * 0.4).toFixed(2) + ')';
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size * 0.2, cy - size * 0.3);
        ctx.lineTo(cx - size * 0.1, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 1c. 背景气泡（所有主题通用，颜色取自主题）
    const bubbleColor = theme.bubbleColor || 'rgba(255,255,255,0.06)';
    ctx.fillStyle = bubbleColor;
    for (let i = 0; i < 20; i++) {
      const bx = (i * 173 + 67) % sw;
      const by = ((t * 20 + i * 97) % (sh + 40)) - 20;
      const br = 4 + (i % 6);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 绘制单个瓦片 ----
  drawTile(ctx, x, y, type, row, col) {
    const s = TILE_SIZE;
    const th = this.theme || {};
    if (type === TILE_GROUND) {
      // 石头/海底地面 —— 颜色随主题变化
      const isTop = row === this.levelH - 2;
      if (isTop) {
        // 表面层
        ctx.fillStyle = th.groundTop || '#3D7A6E';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = th.groundTopLight || '#4A9E8E';
        ctx.fillRect(x, y, s, 6);
        // 纹理
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x + 4, y + 10, 12, 2);
        ctx.fillRect(x + 22, y + 16, 8, 2);
      } else {
        // 深层：深色岩石
        ctx.fillStyle = th.groundDeep || '#4A5A6A';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = th.groundDeepDark || '#3D4D5D';
        ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
        ctx.fillStyle = th.groundDeepMid || '#526476';
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
    } else if (type === TILE_BRICK) {
      // 砖块障碍（可被子弹打碎）
      ctx.fillStyle = '#B5651D';
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#C97A2E';
      ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
      // 砖缝纹理
      ctx.strokeStyle = 'rgba(60, 30, 0, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s, y + s / 2);
      ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s / 2);
      ctx.moveTo(x + s / 4, y + s / 2); ctx.lineTo(x + s / 4, y + s);
      ctx.moveTo(x + s * 3 / 4, y + s / 2); ctx.lineTo(x + s * 3 / 4, y + s);
      ctx.stroke();
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

  // ---- 玩家鱼图片预处理：缩放 + 清理白边光晕 ----
  _preScalePlayerImage(srcCanvas) {
    if (!srcCanvas) return null;
    const TARGET_W = PLAYER_W;  // 88
    const TARGET_H = PLAYER_H;  // 72

    const offCanvas = wx.createCanvas();
    offCanvas.width = TARGET_W;
    offCanvas.height = TARGET_H;
    const ctx = offCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, TARGET_W, TARGET_H);
    // 等比缩放居中
    const scale = Math.min(TARGET_W / srcCanvas.width, TARGET_H / srcCanvas.height);
    const w = srcCanvas.width * scale;
    const h = srcCanvas.height * scale;
    ctx.drawImage(srcCanvas, (TARGET_W - w) / 2, (TARGET_H - h) / 2, w, h);

    // 关键：清理笔触抗锯齿边缘的浅灰光晕（白底转透明时残留的近白像素）
    // 原来的 createTransparentImage 只把纯白 (255,255,255) 设为透明，
    // 但 230,230,230 这类像素在深色背景上会形成一圈"重影光晕"
    try {
      const imageData = ctx.getImageData(0, 0, TARGET_W, TARGET_H);
      const data = imageData.data;
      // 阈值：RGB 都大于 220 的像素视为背景，设为透明
      // 太低会误伤浅色笔触，220 在深色鱼线/彩色笔触下安全
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (r > 220 && g > 220 && b > 220) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      // getImageData 在某些小游戏 Canvas 上可能不可用，忽略即可
    }
    return offCanvas;
  }

  // ---- 玩家鱼 ----
  drawPlayer(ctx, cam) {
    const p = this.player;
    if (p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 10) % 2 === 0) return;

    // 不使用 Math.round，避免镜头平滑移动时的像素跳跃抖动
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    const cx = sx + p.w / 2, cy = sy + p.h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    if (!p.facingRight) ctx.scale(-1, 1);

    if (this.playerImgCanvas) {
      // 使用用户画的鱼（已预处理到 88×72 并清理白边光晕，直接原生绘制）
      const bob = Math.sin(this.animTime * 6) * 1.5;
      // 空中轻微倾斜：vy 范围 -500~750，乘 0.0005 得 ±15°~22° 的柔和摆头
      const tilt = p.onGround ? 0 : p.vy * 0.0005;
      ctx.rotate(tilt);
      ctx.drawImage(this.playerImgCanvas, -p.w / 2, -p.h / 2 + bob);

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

    // 保护圈光环（有 shields 时显示蓝色旋转环）
    if (this.shields > 0) {
      const rot = this.animTime * 2;
      const ringR = p.w / 2 + 10;
      // 外层光晕
      ctx.fillStyle = 'rgba(0, 232, 255, 0.10)';
      ctx.beginPath(); ctx.arc(cx, cy, ringR + 4, 0, Math.PI * 2); ctx.fill();
      // 主光环
      ctx.strokeStyle = 'rgba(0, 232, 255, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
      // 旋转的小亮点（数量 = shields，最多显示3个）
      const dotCount = Math.min(this.shields, 3);
      for (let i = 0; i < dotCount; i++) {
        const a = rot + (i / dotCount) * Math.PI * 2;
        const dx = cx + Math.cos(a) * ringR;
        const dy = cy + Math.sin(a) * ringR;
        ctx.fillStyle = '#00E8FF';
        ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(dx - 1, dy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      }
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
    ctx.fillText(this.levelName, sw / 2, textY);

    // 金币 + 分数（右侧，留内边距）
    ctx.textAlign = 'right';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(`${this.coinCount}  ${this.score}分`, sw - padX, textY);

    // 弹药数（左爱心右侧，仅当有弹药时显示）
    if (this.ammo > 0) {
      ctx.fillStyle = '#FF8C42';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('🔫x' + this.ammo, padX + 40 + this.lives * 22 + 8, textY);
    }

    // 保护圈数量（弹药右侧，仅当有保护圈时显示）
    if (this.shields > 0) {
      const shieldX = padX + 40 + this.lives * 22 + 8 + (this.ammo > 0 ? 60 : 0);
      // 画一个小护盾图标
      const sx = shieldX;
      const sy = textY - 4;
      ctx.fillStyle = '#00E8FF';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx + 6, sy - 2);
      ctx.lineTo(sx + 6, sy + 3);
      ctx.lineTo(sx, sy + 7);
      ctx.lineTo(sx - 6, sy + 3);
      ctx.lineTo(sx - 6, sy - 2);
      ctx.closePath();
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy - 3);
      ctx.lineTo(sx, sy - 5);
      ctx.lineTo(sx + 1, sy + 2);
      ctx.lineTo(sx - 3, sy + 1);
      ctx.closePath();
      ctx.fill();
      // 数量文字
      ctx.fillStyle = '#00E8FF';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('x' + this.shields, sx + 12, textY);
    }


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
    const fireCX = jumpCX;
    const fireCY = btnY - 80;    // 开火键在跳跃键上方 80px
    return { sh, sw, btnR, barH, btnY, marginX, leftGap, backCX, fwdCX, jumpCX, fireCX, fireCY };
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
    // 跳跃次数提示
    const jumpsLeft = this.maxJumps - (this.player.jumpCount || 0);
    const dots = '⬆'.repeat(Math.max(1, jumpsLeft));
    ctx.fillStyle = 'rgba(200,230,255,0.50)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dots, jumpCX, btnY + btnR + 14);
    ctx.restore();
  }

  // ---- 开火键（跳跃键上方）----
  drawFireButton(ctx) {
    if (this.ammo <= 0) return;   // 没弹药不显示
    const L = this.getButtonLayout();
    const { fireCX, fireCY, btnR } = L;
    const fireActive = this.input.fire;

    ctx.save();
    const r = btnR - 2;
    // 外圈
    ctx.fillStyle = fireActive ? 'rgba(255, 100, 60, 0.40)' : 'rgba(255, 100, 60, 0.12)';
    ctx.beginPath();
    ctx.arc(fireCX, fireCY, r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 100, 60, 0.40)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 子弹图标
    ctx.fillStyle = fireActive ? '#FF8C42' : 'rgba(255, 140, 66, 0.60)';
    ctx.beginPath();
    ctx.arc(fireCX, fireCY, 8, 0, Math.PI * 2);
    ctx.fill();
    // 小火花
    ctx.fillStyle = fireActive ? '#FFE0C0' : 'rgba(255, 224, 192, 0.55)';
    ctx.beginPath();
    ctx.arc(fireCX - 3, fireCY - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    // 弹药数
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('x' + this.ammo, fireCX, fireCY + r + 12);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
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
    ctx.fillText(this.levelName, sw / 2, titleY);

    // 操作说明：横排三栏（窄高型）
    const boxW = (sw - 50) / 3;
    const boxH = 64;
    const boxY = titleY + 14;
    const instr = [
      { icon: '⬆', label: '三连跳', sub: '右手', special: true },
      { icon: '◀', label: '后退', sub: '左手左侧' },
      { icon: '▶', label: '前进', sub: '左手右侧' },
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
    ctx.fillText('⭐ 收金币  🦶 踩敌人  ⬆ 三连跳  ❓顶问号获道具  🛡️保护圈碰怪不死  🚩 到旗帜', sw / 2, tipY);

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

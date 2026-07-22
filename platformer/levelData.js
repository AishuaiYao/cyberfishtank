// platformer/levelData.js
// 闯关游戏 - 三关地下城/海底主题关卡数据

const TILE_AIR = 0;
const TILE_GROUND = 1;
const TILE_PLATFORM = 2;
const TILE_BRICK = 3;
const TILE_QUESTION = 4;

const LEVELS = [
  // ===== 第 1 关：浅滩初探 =====
  {
    name: '浅滩初探',
    width: 80,        // 瓦片列数
    height: 16,       // 瓦片行数
    tileSize: 40,     // 每瓦片 40 逻辑像素
    // 背景色（从上到下渐变）
    background: { top: '#0a1628', bottom: '#1a4a6e' },
    // 地面段：[开始列, 结束列) —— 全覆盖，无坑
    ground: [[0, 80]],
    // 悬空平台：{x:左列, y:行号(0=最顶), w:宽度(列数)}
    platforms: [
      { x: 12, y: 12, w: 4 },
      { x: 25, y: 10, w: 3 },
      { x: 35, y: 11, w: 5 },
      { x: 48, y: 9, w: 4 },
      { x: 60, y: 11, w: 4 },
      { x: 70, y: 10, w: 3 },
    ],
    questions: [
      { x: 28, y: 10 },   // 问号砖块（顶出金币）
      { x: 50, y: 9 },
    ],
    playerStart: { x: 3, y: 14 },
    finish: { x: 77, y: 14 },
    enemies: [
      { type: 'crab', x: 18, y: 14, patrol: 3, speed: 1.0 },
      { type: 'crab', x: 55, y: 14, patrol: 4, speed: 1.2 },
    ],
    coins: [
      { x: 13, y: 11 }, { x: 14, y: 11 },
      { x: 26, y: 9 },
      { x: 36, y: 10 }, { x: 37, y: 10 }, { x: 38, y: 10 },
      { x: 49, y: 8 },
      { x: 71, y: 9 },
    ],
  },

  // ===== 第 2 关：珊瑚暗礁 =====
  {
    name: '珊瑚暗礁',
    width: 100,
    height: 16,
    tileSize: 40,
    background: { top: '#0a2040', bottom: '#1a5a7e' },
    // 地面出现间隔（2 个 3 格缺口）
    ground: [[0, 28], [31, 48], [51, 75], [78, 100]],
    platforms: [
      { x: 10, y: 12, w: 4 },
      { x: 22, y: 10, w: 3 },
      { x: 33, y: 8, w: 3 },   // 缺口上方平台
      { x: 42, y: 11, w: 3 },
      { x: 53, y: 10, w: 4 },   // 缺口上方平台
      { x: 64, y: 8, w: 5 },
      { x: 82, y: 11, w: 4 },
      { x: 92, y: 9, w: 3 },
    ],
    questions: [
      { x: 25, y: 10 },
      { x: 56, y: 10 },
      { x: 67, y: 8 },
    ],
    playerStart: { x: 3, y: 14 },
    finish: { x: 97, y: 14 },
    enemies: [
      { type: 'crab',    x: 14, y: 14, patrol: 4, speed: 1.5 },
      { type: 'jelly',   x: 40, y: 12, patrol: 3, speed: 1.0 },
      { type: 'crab',    x: 65, y: 14, patrol: 5, speed: 1.8 },
      { type: 'jelly',   x: 85, y: 14, patrol: 4, speed: 1.3 },
    ],
    coins: [
      { x: 11, y: 11 },
      { x: 23, y: 9 }, { x: 24, y: 9 },
      { x: 34, y: 7 },
      { x: 43, y: 10 },
      { x: 54, y: 9 }, { x: 55, y: 9 },
      { x: 66, y: 7 },
      { x: 83, y: 10 }, { x: 84, y: 10 },
      { x: 93, y: 8 },
    ],
  },

  // ===== 第 3 关：深渊迷宫 =====
  {
    name: '深渊迷宫',
    width: 120,
    height: 16,
    tileSize: 40,
    background: { top: '#050d1a', bottom: '#0a3050' },
    // 多处地面断裂，需要精确跳跃
    ground: [[0, 20], [24, 34], [38, 50], [54, 64], [69, 82], [86, 100], [104, 120]],
    platforms: [
      { x: 8,  y: 12, w: 4 },
      { x: 18, y: 10, w: 3 },
      { x: 28, y: 8,  w: 3 },
      { x: 42, y: 10, w: 3 },
      { x: 56, y: 8,  w: 4 },
      { x: 72, y: 10, w: 4 },
      { x: 88, y: 9,  w: 3 },
      { x: 96, y: 11, w: 5 },
      { x: 108, y: 9, w: 4 },
      { x: 115, y: 10, w: 3 },
    ],
    questions: [
      { x: 20, y: 10 },
      { x: 30, y: 8 },
      { x: 58, y: 8 },
      { x: 90, y: 9 },
      { x: 110, y: 9 },
    ],
    playerStart: { x: 3, y: 14 },
    finish: { x: 117, y: 14 },
    enemies: [
      { type: 'crab',  x: 12, y: 14, patrol: 4, speed: 2.0 },
      { type: 'jelly', x: 30, y: 14, patrol: 3, speed: 1.5 },
      { type: 'crab',  x: 46, y: 14, patrol: 5, speed: 2.2 },
      { type: 'puffer',x: 62, y: 14, patrol: 5, speed: 2.5 },
      { type: 'jelly', x: 78, y: 14, patrol: 4, speed: 1.8 },
      { type: 'crab',  x: 95, y: 14, patrol: 4, speed: 2.0 },
    ],
    coins: [
      { x: 9,  y: 11 },
      { x: 19, y: 9 },  { x: 20, y: 9 },
      { x: 29, y: 7 },
      { x: 43, y: 9 },
      { x: 57, y: 7 },  { x: 58, y: 7 },  { x: 59, y: 7 },
      { x: 73, y: 9 },
      { x: 89, y: 8 },
      { x: 97, y: 10 }, { x: 98, y: 10 },
      { x: 109, y: 8 },
      { x: 116, y: 9 },
    ],
  },
];

// 生成满瓦片格子（供碰撞检测用）
function generateTileMap(spec) {
  const { width, height, ground, platforms, questions } = spec;
  const map = [];
  for (let y = 0; y < height; y++) {
    map[y] = new Array(width).fill(TILE_AIR);
  }

  // 地面（倒数第 1 行 + 倒数第 2 行）
  for (const [start, end] of ground) {
    for (let x = start; x < end; x++) {
      map[height - 1][x] = TILE_GROUND;
      map[height - 2][x] = TILE_GROUND;
    }
  }

  // 浮空平台
  for (const { x, y, w } of platforms) {
    for (let i = 0; i < w; i++) {
      map[y][x + i] = TILE_PLATFORM;
    }
  }

  // 问号砖块
  for (const { x, y } of questions) {
    map[y][x] = TILE_QUESTION;
  }

  return map;
}

module.exports = { LEVELS, TILE_AIR, TILE_GROUND, TILE_PLATFORM, TILE_BRICK, TILE_QUESTION, generateTileMap };

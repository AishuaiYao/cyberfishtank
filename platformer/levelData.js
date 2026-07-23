// platformer/levelData.js
// 闯关游戏 - 无限关卡，每关动态生成

const TILE_AIR = 0;
const TILE_GROUND = 1;
const TILE_PLATFORM = 2;
const TILE_BRICK = 3;
const TILE_QUESTION = 4;

// 关卡主题（循环使用）
const THEMES = [
  { name: '浅滩初探', bgTop: '#0a1628', bgBottom: '#1a4a6e' },
  { name: '珊瑚暗礁', bgTop: '#0a2040', bgBottom: '#1a5a7e' },
  { name: '深渊迷宫', bgTop: '#050d1a', bgBottom: '#0a3050' },
  { name: '深海火山', bgTop: '#1a0a0a', bgBottom: '#3a1010' },
  { name: '荧光海穴', bgTop: '#0a0a2a', bgBottom: '#1a1a4e' },
];

// 根据关卡索引生成关卡 spec
// 难度随关卡递增：更长、更多缺口、更多敌人
function generateLevelSpec(index) {
  const theme = THEMES[index % THEMES.length];
  const levelNum = index + 1;
  // 宽度：120 + 关卡数 * 8，上限 280
  const width = 500;   // 固定 500 格长度
  const height = 16;

  // 生成地面段：随关卡递增缺口数量和宽度
  const ground = [];
  const gapCount = Math.min(12, 1 + Math.floor(index / 2));   // 缺口数 1~12
  const gapWidth = Math.min(5, 2 + Math.floor(index / 3));    // 缺口宽 2~5
  let pos = 0;
  const segLen = Math.floor((width - gapCount * gapWidth) / (gapCount + 1));
  for (let i = 0; i <= gapCount; i++) {
    const end = Math.min(width, pos + segLen);
    ground.push([pos, end]);
    pos = end + gapWidth;
    if (pos >= width) break;
  }
  // 确保最后一段覆盖到终点
  if (ground.length > 0) {
    const last = ground[ground.length - 1];
    if (last[1] < width - 5) ground.push([last[1] + gapWidth, width]);
  }

  // 生成缺口上方踏脚平台
  const platforms = [];
  for (let i = 0; i < ground.length - 1; i++) {
    const gapStart = ground[i][1];
    const gapEnd = ground[i + 1][0];
    if (gapEnd > gapStart) {
      platforms.push({ x: gapStart, y: 10, w: gapEnd - gapStart + 1 });
    }
  }

  return {
    name: `第${levelNum}关 · ${theme.name}`,
    width, height, tileSize: 40,
    background: { top: theme.bgTop, bottom: theme.bgBottom },
    ground,
    platforms,
    questions: [],   // 随机生成
    playerStart: { x: 3, y: 14 },
    finish: { x: width - 3, y: 14 },
    enemies: [],     // 随机生成
    coins: [],       // 随机生成（固定 100 个）
    levelIndex: index,   // 传递关卡索引用于难度计算
  };
}

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

module.exports = { THEMES, generateLevelSpec, TILE_AIR, TILE_GROUND, TILE_PLATFORM, TILE_BRICK, TILE_QUESTION, generateTileMap };

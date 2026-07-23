// platformer/levelData.js
// 闯关游戏 - 无限关卡，每关动态生成

const TILE_AIR = 0;
const TILE_GROUND = 1;
const TILE_PLATFORM = 2;
const TILE_BRICK = 3;
const TILE_QUESTION = 4;

// 关卡主题（循环使用）
// 每个主题含：名称、多段背景渐变、远景装饰类型、装饰配色
const THEMES = [
  {
    name: '浅滩初探',
    // 浅滩：明亮蓝绿色，阳光透射
    bgStops: [
      { pos: 0, color: '#1a5a7e' },
      { pos: 0.45, color: '#0f3a5a' },
      { pos: 1, color: '#0a2030' },
    ],
    decoType: 'sunrays',      // 阳光光柱
    decoColor: 'rgba(180, 220, 255, 0.10)',
    bubbleColor: 'rgba(200, 230, 255, 0.10)',
    groundTop: '#3D7A6E', groundTopLight: '#4A9E8E', groundDeep: '#4A5A6A', groundDeepDark: '#3D4D5D', groundDeepMid: '#526476',
  },
  {
    name: '珊瑚暗礁',
    // 珊瑚礁：暖橙色偏粉，有海藻飘动
    bgStops: [
      { pos: 0, color: '#2a1a3a' },
      { pos: 0.5, color: '#3a2050' },
      { pos: 1, color: '#1a0a2a' },
    ],
    decoType: 'seaweed',      // 海草摆动
    decoColor: 'rgba(120, 200, 140, 0.18)',
    bubbleColor: 'rgba(255, 180, 200, 0.10)',
    groundTop: '#7A4A3D', groundTopLight: '#9E6A5A', groundDeep: '#5A4A5A', groundDeepDark: '#4D3D4D', groundDeepMid: '#645A64',
  },
  {
    name: '深渊迷宫',
    // 深渊：极暗蓝黑，仅有微光
    bgStops: [
      { pos: 0, color: '#020812' },
      { pos: 0.5, color: '#050d1a' },
      { pos: 1, color: '#000408' },
    ],
    decoType: 'glowdots',     // 深海发光生物点
    decoColor: 'rgba(80, 160, 220, 0.25)',
    bubbleColor: 'rgba(100, 150, 200, 0.08)',
    groundTop: '#2A3A4A', groundTopLight: '#3A5A6E', groundDeep: '#2A2A3A', groundDeepDark: '#1D1D2D', groundDeepMid: '#363646',
  },
  {
    name: '深海火山',
    // 火山：暗红黑，岩浆热气
    bgStops: [
      { pos: 0, color: '#2a0505' },
      { pos: 0.5, color: '#3a0a0a' },
      { pos: 1, color: '#1a0202' },
    ],
    decoType: 'embers',       // 上升火星
    decoColor: 'rgba(255, 120, 40, 0.30)',
    bubbleColor: 'rgba(255, 100, 50, 0.12)',
    groundTop: '#5A2A1A', groundTopLight: '#7A3A2A', groundDeep: '#4A2020', groundDeepDark: '#3D1010', groundDeepMid: '#563030',
  },
  {
    name: '荧光海穴',
    // 荧光穴：紫蓝霓虹，发光晶体
    bgStops: [
      { pos: 0, color: '#1a0a3a' },
      { pos: 0.5, color: '#2a1a5a' },
      { pos: 1, color: '#0a0520' },
    ],
    decoType: 'crystals',     // 荧光晶体
    decoColor: 'rgba(180, 100, 255, 0.22)',
    bubbleColor: 'rgba(200, 160, 255, 0.12)',
    groundTop: '#3A2A5A', groundTopLight: '#5A4A7E', groundDeep: '#3A2A4A', groundDeepDark: '#2D1D3D', groundDeepMid: '#463656',
  },
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
    background: {
      bgStops: theme.bgStops,
      decoType: theme.decoType,
      decoColor: theme.decoColor,
      bubbleColor: theme.bubbleColor,
    },
    theme,
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

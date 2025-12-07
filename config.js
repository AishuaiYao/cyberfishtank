// 游戏配置管理
const systemInfo = wx.getSystemInfoSync();
const screenWidth = systemInfo.screenWidth;
const screenHeight = systemInfo.screenHeight;
const pixelRatio = systemInfo.pixelRatio || 1;

const config = {
  screenWidth,
  screenHeight,
  pixelRatio, // 新增像素比配置
  topMargin: 90,
  partHeight: 70,
  indicatorHeight: 90,
  drawingAreaHeight: 240,
  scoreHeight: 60,
  jumpHeight: 90,
  buttonWidth: 85,
  buttonHeight: 44,
  colorButtonSize: 34,
  colors: ['#000000', '#FF3B30', '#4CD964', '#5856D6', '#FFCC00', '#FF9500', '#007AFF'], // 将白色改为蓝色，作为调色板按钮的默认颜色
  colorNames: ['黑色', '红色', '绿色', '紫色', '黄色', '橙色', '调色板'],
  borderRadius: 12,
  shadowBlur: 8,
  primaryColor: '#007AFF',
  secondaryColor: '#5AC8FA',
  backgroundColor: '#F8F9FA',
  textColor: '#1D1D1F',
  lightTextColor: '#8E8E93',
  borderColor: '#E5E5EA',

  // 新增：排行榜配置
  rankingCard: {
    width: 0, // 动态计算
    height: 200, // 增加高度以容纳更多内容
    margin: 20,
    image: {
      maxWidth: 0, // 动态计算
      maxHeight: 80
    }
  },

  // 新增：组队配置
  team: {
    buttonSize: 36, // 组队按钮大小
    buttonMargin: 15, // 按钮间距
    buttonIcon: '👥', // 组队按钮图标
    teamInterface: {
      width: 280,
      height: 200,
      borderRadius: 12,
      buttonWidth: 100,
      buttonHeight: 40
    }
  }
};

// 计算各区域位置
function getAreaPositions() {
  const functionAreaY = config.topMargin;
  const indicatorAreaY = functionAreaY + config.partHeight * 3 - 10; // 修复：功能区有3行，每行高度为partHeight
  const drawingAreaY = indicatorAreaY + config.indicatorHeight -80;
  const scoreAreaY = drawingAreaY + config.drawingAreaHeight + 10;
  const jumpAreaY = scoreAreaY + config.scoreHeight;

  return {
    functionAreaY,
    indicatorAreaY,
    drawingAreaY,
    scoreAreaY,
    jumpAreaY
  };
}

// 新增：计算排行榜卡片尺寸
function calculateRankingCardSize() {
  const cardWidth = (config.screenWidth - 60) / 2;
  config.rankingCard.width = cardWidth;
  config.rankingCard.image.maxWidth = cardWidth - 20;
}

// 初始化计算
calculateRankingCardSize();

module.exports = {
  config,
  getAreaPositions
};
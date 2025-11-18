// 游戏配置管理
const screenWidth = wx.getSystemInfoSync().screenWidth;
const screenHeight = wx.getSystemInfoSync().screenHeight;

const config = {
  screenWidth,
  screenHeight,
  topMargin: 90,
  partHeight: 70,
  indicatorHeight: 90,
  drawingAreaHeight: 240,
  scoreHeight: 60,
  jumpHeight: 90,
  buttonWidth: 85,
  buttonHeight: 44,
  colorButtonSize: 34,
  colors: ['#000000', '#FF3B30', '#4CD964', '#5856D6', '#FFCC00', '#FF9500', '#FFFFFF'],
  colorNames: ['黑色', '红色', '绿色', '紫色', '黄色', '橙色', '白色'],
  borderRadius: 12,
  shadowBlur: 8,
  primaryColor: '#007AFF',
  secondaryColor: '#5AC8FA',
  backgroundColor: '#F8F9FA',
  textColor: '#1D1D1F',
  lightTextColor: '#8E8E93',
  borderColor: '#E5E5EA',

  // 修改：排行榜配置 - 添加滚动相关配置
  rankingCard: {
    width: 0, // 动态计算
    height: 200, // 增加高度以容纳更多内容
    margin: 20,
    image: {
      maxWidth: 0, // 动态计算
      maxHeight: 80
    },
    scrollView: {
      height: 0, // 动态计算
      top: 150 // 标题下方开始位置
    }
  },

  // 新增：排行榜显示限制
  rankingLimit: 100 // 只显示top100的作品
};

// 计算各区域位置
function getAreaPositions() {
  const functionAreaY = config.topMargin;
  const indicatorAreaY = functionAreaY + config.partHeight * 3;
  const drawingAreaY = indicatorAreaY + config.indicatorHeight;
  const scoreAreaY = drawingAreaY + config.drawingAreaHeight;
  const jumpAreaY = scoreAreaY + config.scoreHeight;

  return {
    functionAreaY,
    indicatorAreaY,
    drawingAreaY,
    scoreAreaY,
    jumpAreaY
  };
}

// 修改：计算排行榜卡片尺寸和滚动区域
function calculateRankingCardSize() {
  const cardWidth = (config.screenWidth - 60) / 2;
  config.rankingCard.width = cardWidth;
  config.rankingCard.image.maxWidth = cardWidth - 20;

  // 计算滚动区域高度（屏幕高度减去标题区域）
  config.rankingCard.scrollView.height = config.screenHeight - config.rankingCard.scrollView.top - 20;
}

// 初始化计算
calculateRankingCardSize();

module.exports = {
  config,
  getAreaPositions
};
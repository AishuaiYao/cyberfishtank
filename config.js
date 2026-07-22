// 游戏配置管理
const systemInfo = wx.getSystemInfoSync();
const screenWidth = systemInfo.screenWidth;
const screenHeight = systemInfo.screenHeight;
const pixelRatio = systemInfo.pixelRatio || 1;

const config = {
  screenWidth,
  screenHeight,
  pixelRatio,
  topMargin: 80,
  partHeight: 70,
  indicatorHeight: 90,
  drawingAreaHeight: 240,
  scoreHeight: 60,
  jumpHeight: 90,
  buttonWidth: 85,
  buttonHeight: 44,
  colorButtonSize: 34,
  colors: ['#000000', '#FF3B30', '#4CD964', '#5856D6', '#FFCC00', '#FF9500', '#007AFF'],
  colorNames: ['黑色', '红色', '绿色', '紫色', '黄色', '橙色', '调色板'],
  borderRadius: 12,
  shadowBlur: 8,
  primaryColor: '#007AFF',
  secondaryColor: '#5AC8FA',
  backgroundColor: '#F8F9FA',
  textColor: '#1D1D1F',
  lightTextColor: '#8E8E93',
  borderColor: '#E5E5EA',

  // 广告单元ID
  adUnitId: 'adunit-d232b056449b55c6',

  // 本地存储key前缀
  storagePrefix: 'cyberfishtank_'
};

// 计算各区域位置
function getAreaPositions() {
  const functionAreaY = config.topMargin;
  const indicatorAreaY = functionAreaY + config.partHeight * 3 - 10;
  const drawingAreaY = indicatorAreaY + config.indicatorHeight - 80;
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

module.exports = {
  config,
  getAreaPositions
};
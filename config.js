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
  borderColor: '#E5E5EA'
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

module.exports = {
  config,
  getAreaPositions
};
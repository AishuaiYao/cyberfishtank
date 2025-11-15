// 游戏主程序
const screenWidth = wx.getSystemInfoSync().screenWidth;
const screenHeight = wx.getSystemInfoSync().screenHeight;

// 游戏配置
const config = {
  topMargin: 80, // 顶部边距
  partHeight: 60, // 功能区每个部分高度
  indicatorHeight: 80, // 指示区高度
  drawingAreaHeight: 220, // 绘画区高度
  scoreHeight: 50, // 得分区高度
  jumpHeight: 60, // 跳转区高度
  buttonWidth: 80, // 按钮宽度
  buttonHeight: 40, // 按钮高度
  colorButtonSize: 30, // 颜色按钮大小
  colors: ['#000000', '#FF0000', '#00FF00', '#800080', '#FFFF00', '#FFA500', '#FFFFFF'], // 颜色数组
  colorNames: ['黑色', '红色', '绿色', '紫色', '黄色', '橙色', '白色'] // 颜色名称
};

// 游戏状态
let gameState = {
  currentColor: '#000000',
  brushSize: 5,
  isDrawing: false,
  lastX: 0,
  lastY: 0,
  isEraser: false,
  score: 0,
  drawingPaths: [], // 存储所有绘制路径
  currentPath: null // 当前绘制路径
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

// 初始化游戏
function init() {
  console.log('游戏初始化开始...');
  console.log('屏幕尺寸:', screenWidth, 'x', screenHeight);
  
  // 创建画布
  const canvas = wx.createCanvas();
  const ctx = canvas.getContext('2d');
  
  // 设置画布尺寸
  canvas.width = screenWidth;
  canvas.height = screenHeight;
  
  console.log('画布创建成功，尺寸:', canvas.width, 'x', canvas.height);
  
  // 绘制游戏界面
  drawGameUI(ctx);
  
  // 绑定触摸事件
  bindTouchEvents(canvas, ctx);
  
  console.log('游戏初始化完成');
}

// 绘制游戏界面
function drawGameUI(ctx) {
  console.log('开始绘制游戏界面...');
  
  // 清空画布
  ctx.clearRect(0, 0, screenWidth, screenHeight);
  
  // 绘制白色背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, screenWidth, screenHeight);
  
  const positions = getAreaPositions();
  
  // 绘制功能区
  drawFunctionArea(ctx, positions.functionAreaY);
  
  // 绘制指示区
  drawIndicatorArea(ctx, positions.indicatorAreaY);
  
  // 绘制绘画区
  drawDrawingArea(ctx, positions.drawingAreaY);
  
  // 绘制得分区
  drawScoreArea(ctx, positions.scoreAreaY);
  
  // 绘制跳转区
  drawJumpArea(ctx, positions.jumpAreaY);
  
  console.log('游戏界面绘制完成');
}

// 绘制功能区
function drawFunctionArea(ctx, startY) {
  // Part 1: 颜色选择
  const colorButtonsY = startY + 15;
  const totalWidth = config.colorButtonSize * 7 + 20 * 6;
  const startX = (screenWidth - totalWidth) / 2;
  
  for (let i = 0; i < 7; i++) {
    const x = startX + i * (config.colorButtonSize + 20);
    
    // 绘制颜色圆圈
    ctx.beginPath();
    ctx.arc(x + config.colorButtonSize/2, colorButtonsY + config.colorButtonSize/2, 
            config.colorButtonSize/2, 0, Math.PI * 2);
    
    // 填充颜色
    ctx.fillStyle = config.colors[i];
    ctx.fill();
    
    // 黑色描边
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // 如果是当前选中的颜色，添加外圈标识
    if (config.colors[i] === gameState.currentColor && !gameState.isEraser) {
      ctx.beginPath();
      ctx.arc(x + config.colorButtonSize/2, colorButtonsY + config.colorButtonSize/2, 
              config.colorButtonSize/2 + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#007AFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  
  // Part 2: 画笔大小调节
  const sizeControlY = startY + config.partHeight + 20;
  ctx.fillStyle = '#000000';
  ctx.font = '16px Arial';
  ctx.fillText('Size:', 20, sizeControlY);
  
  // 绘制滑动条背景
  const sliderX = 80;
  const sliderWidth = screenWidth - 120;
  ctx.fillStyle = '#E0E0E0';
  ctx.fillRect(sliderX, sizeControlY - 8, sliderWidth, 4);
  
  // 绘制滑动块
  const sliderPos = sliderX + (gameState.brushSize / 20) * sliderWidth;
  ctx.fillStyle = '#007AFF';
  ctx.beginPath();
  ctx.arc(sliderPos, sizeControlY - 6, 10, 0, Math.PI * 2);
  ctx.fill();
  
  // 显示当前画笔大小
  ctx.fillStyle = '#000000';
  ctx.fillText(gameState.brushSize.toString(), sliderWidth + 90, sizeControlY);
  
  // Part 3: 工具按钮
  const toolsY = startY + config.partHeight * 2 + 10;
  const toolButtons = ['Eraser', 'Undo', 'Clear', 'Flip'];
  const toolWidth = (screenWidth - 40) / 4;
  
  for (let i = 0; i < toolButtons.length; i++) {
    const x = 20 + i * toolWidth;
    
    // 绘制按钮背景
    ctx.fillStyle = gameState.isEraser && i === 0 ? '#007AFF' : '#F0F0F0';
    ctx.fillRect(x, toolsY, toolWidth - 10, config.buttonHeight);
    
    // 绘制按钮边框
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, toolsY, toolWidth - 10, config.buttonHeight);
    
    // 绘制按钮文字
    ctx.fillStyle = gameState.isEraser && i === 0 ? '#FFFFFF' : '#000000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(toolButtons[i], x + (toolWidth - 10) / 2, toolsY + 25);
  }
  
  ctx.textAlign = 'left';
}

// 绘制指示区
function drawIndicatorArea(ctx, startY) {
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  
  ctx.fillText('画一条鱼吧!', screenWidth / 2, startY + 25);
  ctx.fillText('鱼头请朝右', screenWidth / 2, startY + 55);
  
  ctx.textAlign = 'left';
}

// 绘制绘画区
function drawDrawingArea(ctx, startY) {
  // 绘制绘画区域边框
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, startY, screenWidth - 20, config.drawingAreaHeight);
  
  // 绘制背景网格
  ctx.strokeStyle = '#F0F0F0';
  ctx.lineWidth = 0.5;
  
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(10, startY + i * (config.drawingAreaHeight / 4));
    ctx.lineTo(screenWidth - 10, startY + i * (config.drawingAreaHeight / 4));
    ctx.stroke();
  }
  
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(10 + i * ((screenWidth - 20) / 4), startY);
    ctx.lineTo(10 + i * ((screenWidth - 20) / 4), startY + config.drawingAreaHeight);
    ctx.stroke();
  }
  
  // 重新绘制所有保存的路径
  redrawAllPaths(ctx, startY);
}

// 重新绘制所有保存的路径
function redrawAllPaths(ctx, drawingAreaY) {
  gameState.drawingPaths.forEach(path => {
    if (path.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  });
}

// 绘制得分区
function drawScoreArea(ctx, startY) {
  ctx.fillStyle = '#000000';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`AI评分：${gameState.score}`, screenWidth / 2, startY + 30);
  ctx.textAlign = 'left';
}

// 绘制跳转区
function drawJumpArea(ctx, startY) {
  const jumpButtons = ['鱼缸', '让它游起来！', '排行榜'];
  const buttonWidth = (screenWidth - 40) / 3;
  
  for (let i = 0; i < jumpButtons.length; i++) {
    const x = 20 + i * buttonWidth;
    
    ctx.fillStyle = '#F0F0F0';
    ctx.fillRect(x, startY, buttonWidth - 10, config.buttonHeight);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, startY, buttonWidth - 10, config.buttonHeight);
    
    ctx.fillStyle = '#000000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(jumpButtons[i], x + (buttonWidth - 10) / 2, startY + 25);
  }
  
  ctx.textAlign = 'left';
}

// 绑定触摸事件 - 修复版本
function bindTouchEvents(canvas, ctx) {
  console.log('绑定触摸事件...');
  
  const positions = getAreaPositions();
  const drawingAreaY = positions.drawingAreaY;
  
  // 使用 wx.onTouchStart 而不是 canvas.addEventListener
  wx.onTouchStart((e) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    console.log('触摸开始:', x, y);
    
    // 检查是否在绘画区域内
    if (y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight && 
        x >= 10 && x <= screenWidth - 10) {
      
      gameState.isDrawing = true;
      gameState.lastX = x;
      gameState.lastY = y;
      
      // 开始新的路径
      gameState.currentPath = {
        color: gameState.isEraser ? '#FFFFFF' : gameState.currentColor,
        size: gameState.brushSize,
        points: [{x: x, y: y}]
      };
      
      console.log('开始绘制，位置:', x, y);
    } else {
      // 检查功能区点击
      checkFunctionAreaClick(x, y, ctx);
    }
  });
  
  wx.onTouchMove((e) => {
    if (!gameState.isDrawing) return;
    
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    
    // 确保在绘画区域内
    if (y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight && 
        x >= 10 && x <= screenWidth - 10) {
      
      // 绘制线条
      const currentCtx = canvas.getContext('2d');
      currentCtx.beginPath();
      currentCtx.moveTo(gameState.lastX, gameState.lastY);
      currentCtx.lineTo(x, y);
      currentCtx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
      currentCtx.lineWidth = gameState.brushSize;
      currentCtx.lineCap = 'round';
      currentCtx.lineJoin = 'round';
      currentCtx.stroke();
      
      // 保存到当前路径
      if (gameState.currentPath) {
        gameState.currentPath.points.push({x: x, y: y});
      }
      
      gameState.lastX = x;
      gameState.lastY = y;
    }
  });
  
  wx.onTouchEnd((e) => {
    console.log('触摸结束');
    
    if (gameState.isDrawing && gameState.currentPath) {
      // 保存当前路径
      gameState.drawingPaths.push(gameState.currentPath);
      gameState.currentPath = null;
      
      // 模拟AI评分
      gameState.score = Math.floor(Math.random() * 100);
      console.log('绘制完成，AI评分:', gameState.score);
      
      // 更新UI
      drawGameUI(ctx);
    }
    
    gameState.isDrawing = false;
  });
  
  wx.onTouchCancel((e) => {
    console.log('触摸取消');
    gameState.isDrawing = false;
  });
}

// 检查功能区点击
function checkFunctionAreaClick(x, y, ctx) {
  console.log('检查功能区点击，位置:', x, y);
  
  const positions = getAreaPositions();
  const functionAreaY = positions.functionAreaY;
  
  // Part 1: 颜色选择
  const colorButtonsY = functionAreaY + 15;
  const totalWidth = config.colorButtonSize * 7 + 20 * 6;
  const startX = (screenWidth - totalWidth) / 2;
  
  for (let i = 0; i < 7; i++) {
    const buttonX = startX + i * (config.colorButtonSize + 20);
    const buttonY = colorButtonsY;
    
    if (x >= buttonX && x <= buttonX + config.colorButtonSize &&
        y >= buttonY && y <= buttonY + config.colorButtonSize) {
      
      gameState.currentColor = config.colors[i];
      gameState.isEraser = false;
      console.log('选择颜色:', config.colorNames[i]);
      drawGameUI(ctx);
      return;
    }
  }
  
  // Part 2: 画笔大小调节
  const sizeControlY = functionAreaY + config.partHeight + 10;
  const sliderX = 80;
  const sliderWidth = screenWidth - 120;
  
  if (y >= sizeControlY - 15 && y <= sizeControlY + 15 &&
      x >= sliderX && x <= sliderX + sliderWidth) {
    
    const newSize = Math.round(((x - sliderX) / sliderWidth) * 20);
    gameState.brushSize = Math.max(1, Math.min(20, newSize));
    console.log('调整画笔大小:', gameState.brushSize);
    drawGameUI(ctx);
    return;
  }
  
  // Part 3: 工具按钮
  const toolsY = functionAreaY + config.partHeight * 2 + 10;
  const toolButtons = ['Eraser', 'Undo', 'Clear', 'Flip'];
  const toolWidth = (screenWidth - 40) / 4;
  
  for (let i = 0; i < toolButtons.length; i++) {
    const buttonX = 20 + i * toolWidth;
    const buttonY = toolsY;
    
    if (x >= buttonX && x <= buttonX + toolWidth - 10 &&
        y >= buttonY && y <= buttonY + config.buttonHeight) {
      
      handleToolButtonClick(toolButtons[i], ctx);
      return;
    }
  }
  
  // 跳转区按钮
  const jumpAreaY = positions.jumpAreaY;
  const jumpButtons = ['鱼缸', '让它游起来！', '排行榜'];
  const jumpButtonWidth = (screenWidth - 40) / 3;
  
  for (let i = 0; i < jumpButtons.length; i++) {
    const buttonX = 20 + i * jumpButtonWidth;
    const buttonY = jumpAreaY;
    
    if (x >= buttonX && x <= buttonX + jumpButtonWidth - 10 &&
        y >= buttonY && y <= buttonY + config.buttonHeight) {
      
      console.log('点击按钮:', jumpButtons[i]);
      wx.showToast({
        title: `功能「${jumpButtons[i]}」开发中`,
        icon: 'none'
      });
      return;
    }
  }
}

// 处理工具按钮点击
function handleToolButtonClick(tool, ctx) {
  console.log('使用工具:', tool);
  
  switch (tool) {
    case 'Eraser':
      gameState.isEraser = !gameState.isEraser;
      console.log('橡皮擦状态:', gameState.isEraser ? '开启' : '关闭');
      break;
      
    case 'Undo':
      if (gameState.drawingPaths.length > 0) {
        gameState.drawingPaths.pop();
        console.log('撤销一步，剩余路径数:', gameState.drawingPaths.length);
      } else {
        console.log('没有可撤销的步骤');
      }
      break;
      
    case 'Clear':
      gameState.drawingPaths = [];
      gameState.score = 0;
      console.log('清空画布');
      break;
      
    case 'Flip':
      console.log('翻转功能开发中');
      wx.showToast({
        title: '翻转功能开发中',
        icon: 'none'
      });
      break;
  }
  
  drawGameUI(ctx);
}

// 启动游戏
console.log('微信小游戏启动中...');
init();

console.log('微信小游戏启动完成！');
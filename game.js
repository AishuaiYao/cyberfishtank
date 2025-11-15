// 游戏主程序
const screenWidth = wx.getSystemInfoSync().screenWidth;
const screenHeight = wx.getSystemInfoSync().screenHeight;

// 游戏配置 - 增强UI设计
const config = {
  topMargin: 80,
  partHeight: 70, // 增加高度以容纳更好的视觉效果
  indicatorHeight: 90,
  drawingAreaHeight: 240,
  scoreHeight: 60,
  jumpHeight: 70,
  buttonWidth: 85,
  buttonHeight: 44,
  colorButtonSize: 34,
  colors: ['#000000', '#FF3B30', '#4CD964', '#5856D6', '#FFCC00', '#FF9500', '#FFFFFF'],
  colorNames: ['黑色', '红色', '绿色', '紫色', '黄色', '橙色', '白色'],
  // 新增UI配置
  borderRadius: 12,
  shadowBlur: 8,
  primaryColor: '#007AFF',
  secondaryColor: '#5AC8FA',
  backgroundColor: '#F8F9FA',
  textColor: '#1D1D1F',
  lightTextColor: '#8E8E93',
  borderColor: '#E5E5EA'
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
  drawingPaths: [],
  currentPath: null,
  isScoring: false
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

// 绘制圆角矩形 - 新增函数
function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }
}

// 绘制带阴影的卡片 - 新增函数
function drawCard(ctx, x, y, width, height, radius = config.borderRadius) {
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = config.shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, x, y, width, height, radius, true, false);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 边框
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, x, y, width, height, radius, false, true);
}

// 绘制现代按钮 - 新增函数
function drawModernButton(ctx, x, y, width, height, text, isActive = false, isPrimary = false) {
  // 背景
  ctx.fillStyle = isActive ? config.primaryColor :
                  isPrimary ? config.primaryColor : '#FFFFFF';
  drawRoundedRect(ctx, x, y, width, height, config.borderRadius, true, false);

  // 边框
  ctx.strokeStyle = isActive ? config.primaryColor : config.borderColor;
  ctx.lineWidth = isActive ? 0 : 1;
  drawRoundedRect(ctx, x, y, width, height, config.borderRadius, false, true);

  // 文字
  ctx.fillStyle = isActive ? '#FFFFFF' :
                  isPrimary ? '#FFFFFF' : config.textColor;
  ctx.font = '15px -apple-system, "PingFang SC", "Helvetica Neue"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + height / 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// 初始化游戏
function init() {
  console.log('游戏初始化开始...');
  console.log('屏幕尺寸:', screenWidth, 'x', screenHeight);

  const canvas = wx.createCanvas();
  const ctx = canvas.getContext('2d');

  canvas.width = screenWidth;
  canvas.height = screenHeight;

  console.log('画布创建成功，尺寸:', canvas.width, 'x', canvas.height);

  drawGameUI(ctx);
  bindTouchEvents(canvas, ctx);

  console.log('游戏初始化完成');
}

// 绘制游戏界面
function drawGameUI(ctx) {
  console.log('开始绘制游戏界面...');

  // 渐变背景
  const gradient = ctx.createLinearGradient(0, 0, screenWidth, screenHeight);
  gradient.addColorStop(0, '#F8F9FA');
  gradient.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, screenWidth, screenHeight);

  const positions = getAreaPositions();

  drawFunctionArea(ctx, positions.functionAreaY);
  drawIndicatorArea(ctx, positions.indicatorAreaY);
  drawDrawingArea(ctx, positions.drawingAreaY);
  drawScoreArea(ctx, positions.scoreAreaY);
  drawJumpArea(ctx, positions.jumpAreaY);

  console.log('游戏界面绘制完成');
}

// 绘制功能区
function drawFunctionArea(ctx, startY) {
  // Part 1: 颜色选择 - 卡片式设计
  drawCard(ctx, 15, startY, screenWidth - 30, config.partHeight - 10);

  const colorButtonsY = startY + 20;
  const totalWidth = config.colorButtonSize * 7 + 18 * 6;
  const startX = (screenWidth - totalWidth) / 2;

  for (let i = 0; i < 7; i++) {
    const x = startX + i * (config.colorButtonSize + 18);

    // 颜色圆圈带阴影
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(x + config.colorButtonSize/2, colorButtonsY + config.colorButtonSize/2,
            config.colorButtonSize/2, 0, Math.PI * 2);
    ctx.fillStyle = config.colors[i];
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 边框
    ctx.strokeStyle = config.colors[i] === '#FFFFFF' ? config.borderColor : 'transparent';
    ctx.lineWidth = config.colors[i] === '#FFFFFF' ? 1 : 0;
    ctx.stroke();

    // 选中状态指示器
    if (config.colors[i] === gameState.currentColor && !gameState.isEraser) {
      ctx.beginPath();
      ctx.arc(x + config.colorButtonSize/2, colorButtonsY + config.colorButtonSize/2,
              config.colorButtonSize/2 + 4, 0, Math.PI * 2);
      ctx.strokeStyle = config.primaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 内圈高亮
      ctx.beginPath();
      ctx.arc(x + config.colorButtonSize/2, colorButtonsY + config.colorButtonSize/2,
              config.colorButtonSize/2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Part 2: 画笔大小调节 - 卡片式设计
  drawCard(ctx, 15, startY + config.partHeight, screenWidth - 30, config.partHeight - 10);

  const sizeControlY = startY + config.partHeight + 25;

  ctx.fillStyle = config.textColor;
  ctx.font = '16px -apple-system, "PingFang SC"';
  ctx.fillText('画笔大小:', 25, sizeControlY);

  // 现代滑动条
  const sliderX = 100;
  const sliderWidth = screenWidth - 140;

  // 滑动条轨道
  ctx.fillStyle = '#E5E5EA';
  drawRoundedRect(ctx, sliderX, sizeControlY - 6, sliderWidth, 4, 2, true, false);

  // 进度填充
  const progressWidth = (gameState.brushSize / 20) * sliderWidth;
  const gradient = ctx.createLinearGradient(sliderX, 0, sliderX + progressWidth, 0);
  gradient.addColorStop(0, config.primaryColor);
  gradient.addColorStop(1, config.secondaryColor);
  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, sliderX, sizeControlY - 6, progressWidth, 4, 2, true, false);

  // 滑动块
  const sliderPos = sliderX + progressWidth;
  ctx.shadowColor = 'rgba(0,122,255,0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = config.primaryColor;
  ctx.beginPath();
  ctx.arc(sliderPos, sizeControlY - 6, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // 内圈
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(sliderPos, sizeControlY - 6, 4, 0, Math.PI * 2);
  ctx.fill();

  // 大小显示
  ctx.fillStyle = config.primaryColor;
  ctx.font = 'bold 16px -apple-system';
  ctx.textAlign = 'right';
  ctx.fillText(`${gameState.brushSize}px`, screenWidth - 25, sizeControlY);
  ctx.textAlign = 'left';

  // Part 3: 工具按钮 - 现代按钮组
  drawCard(ctx, 15, startY + config.partHeight * 2, screenWidth - 30, config.partHeight - 10);

  const toolsY = startY + config.partHeight * 2 + 15;
  const toolButtons = [
    { name: '橡皮', icon: '◻' },
    { name: '撤销', icon: '↶' },
    { name: '清空', icon: '×' },
    { name: '翻转', icon: '⇄' }
  ];
  const toolWidth = (screenWidth - 50) / 4;

  for (let i = 0; i < toolButtons.length; i++) {
    const x = 20 + i * toolWidth;
    const isActive = (i === 0 && gameState.isEraser);

    drawModernButton(ctx, x, toolsY, toolWidth - 10, config.buttonHeight,
                    `${toolButtons[i].icon} ${toolButtons[i].name}`,
                    isActive, false);
  }
}

// 绘制指示区
function drawIndicatorArea(ctx, startY) {
  drawCard(ctx, 15, startY, screenWidth - 30, config.indicatorHeight - 10);

  ctx.fillStyle = config.textColor;
  ctx.font = 'bold 18px -apple-system, "PingFang SC"';
  ctx.textAlign = 'center';

  // 图标装饰
  ctx.fillStyle = config.primaryColor;
  ctx.font = '24px Arial';
  ctx.fillText('🎨', screenWidth / 2, startY + 28);

  ctx.fillStyle = config.textColor;
  ctx.font = 'bold 18px -apple-system';
  ctx.fillText('画一条鱼吧!', screenWidth / 2, startY + 55);

  ctx.fillStyle = config.lightTextColor;
  ctx.font = '15px -apple-system';
  ctx.fillText('鱼头请朝右', screenWidth / 2, startY + 78);

  ctx.textAlign = 'left';
}

// 绘制绘画区
function drawDrawingArea(ctx, startY) {
  // 现代卡片式绘画区域
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, 12, startY, screenWidth - 24, config.drawingAreaHeight, config.borderRadius, true, false);

  ctx.shadowColor = 'transparent';

  // 边框
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 12, startY, screenWidth - 24, config.drawingAreaHeight, config.borderRadius, false, true);

  // 精致网格背景
  ctx.strokeStyle = '#F8F9FA';
  ctx.lineWidth = 0.8;

  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(12, startY + i * (config.drawingAreaHeight / 4));
    ctx.lineTo(screenWidth - 12, startY + i * (config.drawingAreaHeight / 4));
    ctx.stroke();
  }

  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(12 + i * ((screenWidth - 24) / 4), startY);
    ctx.lineTo(12 + i * ((screenWidth - 24) / 4), startY + config.drawingAreaHeight);
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
  drawCard(ctx, 15, startY, screenWidth - 30, config.scoreHeight - 10);

  ctx.fillStyle = config.textColor;
  ctx.font = '16px -apple-system, "PingFang SC"';
  ctx.textAlign = 'center';

  let scoreText = `AI评分：${gameState.score}`;
  let scoreColor = config.textColor;

  if (gameState.isScoring) {
    scoreText = 'AI评分中...';
    scoreColor = config.primaryColor;
  } else if (gameState.score > 0) {
    // 根据分数显示不同颜色
    if (gameState.score >= 80) scoreColor = '#4CD964';
    else if (gameState.score >= 60) scoreColor = '#FFCC00';
    else scoreColor = '#FF3B30';
  }

  // 分数图标
  ctx.fillStyle = config.primaryColor;
  ctx.font = '20px Arial';
  ctx.fillText('⭐', screenWidth / 2 - 50, startY + 22);

  ctx.fillStyle = scoreColor;
  ctx.font = gameState.isScoring ? '16px -apple-system' : 'bold 18px -apple-system';
  ctx.fillText(scoreText, screenWidth / 2, startY + 35);

  ctx.textAlign = 'left';
}

// 绘制跳转区
function drawJumpArea(ctx, startY) {
  drawCard(ctx, 15, startY, screenWidth - 30, config.jumpHeight - 10);

  const jumpButtons = ['🐠 鱼缸', '🚀 让它游起来！', '🏆 排行榜'];
  const buttonWidth = (screenWidth - 50) / 3;

  for (let i = 0; i < jumpButtons.length; i++) {
    const x = 20 + i * buttonWidth;
    const isPrimary = i === 1; // 中间按钮为主要操作

    drawModernButton(ctx, x, startY + 13, buttonWidth - 10, config.buttonHeight,
                    jumpButtons[i], false, isPrimary);
  }
}

// 调用阿里云通义千问VL模型API进行评分
function callQWenVLModel(base64Image) {
  return new Promise((resolve, reject) => {
    console.log('开始调用大模型API进行评分...');

    wx.request({
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-943f95da67d04893b70c02be400e2935'
      },
      data: {
        model: "qwen3-vl-plus",
        messages: [
          {
            "role": "user",
            "content": [
              {
                "type": "image_url",
                "image_url": {"url": `data:image/png;base64,${base64Image}`}
              },
              {"type": "text", "text": "判断这个图上画的像不像一条鱼，在0到100范围内打分，精确到小数点后两位，直接返回给我得分就行"}
            ]
          }
        ]
      },
      success: (res) => {
        console.log('大模型API调用成功');
        if (res.data && res.data.choices && res.data.choices[0]) {
          const content = res.data.choices[0].message.content;
          console.log('大模型返回内容:', content);

          const scoreMatch = content.match(/(\d+\.?\d*)/);
          if (scoreMatch) {
            const score = parseFloat(scoreMatch[0]);
            console.log('提取到的分数:', score);
            resolve(score);
          } else {
            console.warn('无法从返回内容中提取分数，使用默认评分');
            resolve(Math.floor(Math.random() * 100));
          }
        } else {
          console.warn('API返回数据格式错误，使用默认评分');
          resolve(Math.floor(Math.random() * 100));
        }
      },
      fail: (error) => {
        console.error('大模型API调用失败:', error);
        reject(error);
      }
    });
  });
}

// 异步获取AI评分
async function getAIScore(canvas, ctx) {
  if (gameState.isScoring) {
    console.log('正在评分中，跳过本次请求');
    return;
  }

  try {
    gameState.isScoring = true;
    console.log('开始AI评分流程...');

    drawGameUI(ctx);

    const base64Data = canvas.toDataURL().split(',')[1];
    console.log('获取画布数据成功，数据长度:', base64Data.length);

    const score = await callQWenVLModel(base64Data);

    gameState.score = Math.round(score);
    console.log('AI评分完成，最终得分:', gameState.score);

  } catch (error) {
    console.error('AI评分失败:', error);
    gameState.score = Math.floor(Math.random() * 100);
    console.log('使用随机分数作为fallback:', gameState.score);
  } finally {
    gameState.isScoring = false;
    drawGameUI(ctx);
    console.log('AI评分流程结束');
  }
}

// 绑定触摸事件
function bindTouchEvents(canvas, ctx) {
  console.log('绑定触摸事件...');

  const positions = getAreaPositions();
  const drawingAreaY = positions.drawingAreaY;

  wx.onTouchStart((e) => {
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    console.log('触摸开始:', x, y);

    if (y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight &&
        x >= 12 && x <= screenWidth - 12) {

      gameState.isDrawing = true;
      gameState.lastX = x;
      gameState.lastY = y;

      gameState.currentPath = {
        color: gameState.isEraser ? '#FFFFFF' : gameState.currentColor,
        size: gameState.brushSize,
        points: [{x: x, y: y}]
      };

      console.log('开始绘制，位置:', x, y);
    } else {
      checkFunctionAreaClick(x, y, ctx);
    }
  });

  wx.onTouchMove((e) => {
    if (!gameState.isDrawing) return;

    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;

    if (y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight &&
        x >= 12 && x <= screenWidth - 12) {

      const currentCtx = canvas.getContext('2d');
      currentCtx.beginPath();
      currentCtx.moveTo(gameState.lastX, gameState.lastY);
      currentCtx.lineTo(x, y);
      currentCtx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
      currentCtx.lineWidth = gameState.brushSize;
      currentCtx.lineCap = 'round';
      currentCtx.lineJoin = 'round';
      currentCtx.stroke();

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
      gameState.drawingPaths.push(gameState.currentPath);
      gameState.currentPath = null;

      console.log('绘制完成，开始异步AI评分');

      getAIScore(canvas, ctx).catch(error => {
        console.error('异步评分异常:', error);
      });
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
  const colorButtonsY = functionAreaY + 20;
  const totalWidth = config.colorButtonSize * 7 + 18 * 6;
  const startX = (screenWidth - totalWidth) / 2;

  for (let i = 0; i < 7; i++) {
    const buttonX = startX + i * (config.colorButtonSize + 18);
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
  const sizeControlY = functionAreaY + config.partHeight + 15;
  const sliderX = 100;
  const sliderWidth = screenWidth - 140;

  if (y >= sizeControlY - 20 && y <= sizeControlY + 20 &&
      x >= sliderX && x <= sliderX + sliderWidth) {

    const newSize = Math.round(((x - sliderX) / sliderWidth) * 20);
    gameState.brushSize = Math.max(1, Math.min(20, newSize));
    console.log('调整画笔大小:', gameState.brushSize);
    drawGameUI(ctx);
    return;
  }

  // Part 3: 工具按钮
  const toolsY = functionAreaY + config.partHeight * 2 + 15;
  const toolWidth = (screenWidth - 50) / 4;

  for (let i = 0; i < 4; i++) {
    const buttonX = 20 + i * toolWidth;

    if (x >= buttonX && x <= buttonX + toolWidth - 10 &&
        y >= toolsY && y <= toolsY + config.buttonHeight) {

      const tools = ['Eraser', 'Undo', 'Clear', 'Flip'];
      handleToolButtonClick(tools[i], ctx);
      return;
    }
  }

  // 跳转区按钮
  const jumpAreaY = positions.jumpAreaY;
  const jumpButtonWidth = (screenWidth - 50) / 3;

  for (let i = 0; i < 3; i++) {
    const buttonX = 20 + i * jumpButtonWidth;

    if (x >= buttonX && x <= buttonX + jumpButtonWidth - 10 &&
        y >= jumpAreaY + 13 && y <= jumpAreaY + 13 + config.buttonHeight) {

      const jumpButtons = ['鱼缸', '让它游起来！', '排行榜'];
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
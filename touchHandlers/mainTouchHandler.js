const { config, getAreaPositions } = require('../config.js');

class MainTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.positions = getAreaPositions();
    this.lastDrawTime = 0;
    this.scoringTimer = null;
    
    // 协作绘画相关
    this.isCollaborativeMode = false;
    this.collaborationManager = null;
    this.lastOperationRecorded = 0;
  }

  // 处理主界面触摸开始
  handleTouchStart(x, y) {
    // 只在开始绘画时取消可能的评分请求
    if (this.isInDrawingArea(x, y)) {
      this.cancelPendingScoring();
      this.startDrawing(x, y);
    } else {
      this.handleFunctionAreaClick(x, y);
    }
  }

  // 处理主界面触摸移动
  handleTouchMove(x, y) {
    if (!this.eventHandler.gameState.isDrawing) return;

    if (this.isInDrawingArea(x, y)) {
      this.continueDrawing(x, y);
      this.lastDrawTime = Date.now();

      // 优化：只在绘画移动时取消评分
      this.cancelPendingScoring();
    }
  }

  // 处理主界面触摸结束
  handleTouchEnd(x, y) {
    if (this.eventHandler.gameState.isDrawing) {
      this.finishDrawing();

      // 优化：延迟触发智能评分
      this.scheduleSmartScoring();
    }
  }

  // 优化：取消待处理的评分
  cancelPendingScoring() {
    if (this.scoringTimer) {
      clearTimeout(this.scoringTimer);
      this.scoringTimer = null;
    }

    // 取消当前的AI请求
    this.eventHandler.aiService.cancelCurrentRequest();
  }

  // 优化：安排智能评分
  scheduleSmartScoring() {
    this.cancelPendingScoring();

    this.scoringTimer = setTimeout(() => {
      this.triggerAIScoring();
    }, 400); // 400ms后触发评分
  }

  // 优化：触发AI评分
  async triggerAIScoring() {
    const gameState = this.eventHandler.gameState;

    // 检查是否满足评分条件
    if (gameState.isDrawing || gameState.drawingPaths.length === 0) {
      return;
    }

    await this.eventHandler.aiService.triggerSmartScoring(
      this.eventHandler.canvas,
      gameState,
      () => {
        this.eventHandler.uiManager.drawGameUI(gameState);
      }
    );
  }

  // 处理功能区点击
  handleFunctionAreaClick(x, y) {
    if (this.handleColorButtonClick(x, y)) return;
    if (this.handleBrushSizeClick(x, y)) return;
    if (this.handleToolButtonClick(x, y)) return;
    if (this.handleJumpButtonClick(x, y)) return;
    if (this.handleTeamButtonClick(x, y)) return;
  }

  // 颜色按钮点击 - 修改：不取消评分
  handleColorButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const colorButtonsY = functionAreaY + 10; // 调整为与UI一致
    const totalWidth = config.colorButtonSize * 7 + 18 * 6;
    const startX = (config.screenWidth - totalWidth) / 2;

    for (let i = 0; i < 7; i++) {
      const buttonX = startX + i * (config.colorButtonSize + 18);
      const buttonY = colorButtonsY;

      if (x >= buttonX && x <= buttonX + config.colorButtonSize &&
          y >= buttonY && y <= buttonY + config.colorButtonSize) {

        this.eventHandler.gameState.setColor(config.colors[i]);
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
        return true;
      }
    }
    return false;
  }

  // 画笔大小点击 - 修改：不取消评分
  handleBrushSizeClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    // 调整为与UI一致的位置
    const sizeControlY = functionAreaY + config.partHeight - 5;
    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;

    // 扩大触摸区域，便于操作
    if (y >= sizeControlY - 15 && y <= sizeControlY + 15 &&
        x >= sliderX - 10 && x <= sliderX + sliderWidth + 10) {

      const progress = Math.max(0, Math.min(1, (x - sliderX) / sliderWidth));
      const newSize = Math.round(progress * 19) + 1; // 1-20范围
      this.eventHandler.gameState.setBrushSize(newSize);
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }
    return false;
  }

  // 工具按钮点击 - 修复：调整触摸区域与UI一致
  handleToolButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    // 调整为与UI一致的位置
    const toolsY = functionAreaY + config.partHeight * 2 - 40;
    const toolWidth = (config.screenWidth - 50) / 4;

    for (let i = 0; i < 4; i++) {
      const buttonX = 30 + i * toolWidth;
      const buttonWidth = toolWidth - 10;

      // 调整触摸区域与UI按钮完全一致
      if (x >= buttonX && x <= buttonX + buttonWidth &&
          y >= toolsY && y <= toolsY + config.buttonHeight) {

        this.handleToolAction(i);
        return true;
      }
    }
    return false;
  }

  // 工具操作 - 修改：实现翻转功能
  handleToolAction(toolIndex) {
    const gameState = this.eventHandler.gameState;

    switch (toolIndex) {
      case 0: // 橡皮 - 不取消评分
        gameState.toggleEraser();
        break;
      case 1: // 撤销 - 不取消评分
        gameState.undo();
        break;
      case 2: // 清空 - 需要取消评分，因为内容完全变了
        gameState.clear();
        this.cancelPendingScoring();
        break;
      case 3: // 翻转 - 实现翻转功能
        this.handleFlipAction();
        break;
    }
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 新增：处理翻转操作
  handleFlipAction() {
    const gameState = this.eventHandler.gameState;

      if (gameState.drawingPaths.length === 0) {
        const Utils = require('../utils.js');
        Utils.showError('请先画一些内容');
        return;
      }

    // 执行翻转
    const isFlipped = gameState.flipCanvas();

    // 重新绘制所有路径（翻转后）
    this.redrawAllPathsFlipped();

  }

  // 新增：重新绘制所有路径（翻转后）
  redrawAllPathsFlipped() {
    const gameState = this.eventHandler.gameState;
    const ctx = this.eventHandler.canvas.getContext('2d');
    const drawingAreaY = this.positions.drawingAreaY;

    // 清除绘画区域
    ctx.clearRect(12, drawingAreaY, config.screenWidth - 24, config.drawingAreaHeight);

    // 如果处于翻转状态，应用翻转变换
    if (gameState.isFlipped) {
      ctx.save();
      ctx.translate(config.screenWidth, 0);
      ctx.scale(-1, 1);
    }

    // 重新绘制所有路径
    gameState.drawingPaths.forEach(path => {
      if (path.points.length > 0) {
        ctx.beginPath();

        // 应用翻转变换到坐标
        const startPoint = gameState.isFlipped ?
          { x: config.screenWidth - path.points[0].x, y: path.points[0].y } :
          path.points[0];

        ctx.moveTo(startPoint.x, startPoint.y);

        for (let i = 1; i < path.points.length; i++) {
          const point = gameState.isFlipped ?
            { x: config.screenWidth - path.points[i].x, y: path.points[i].y } :
            path.points[i];

          ctx.lineTo(point.x, point.y);
        }

        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    });

    if (gameState.isFlipped) {
      ctx.restore();
    }
  }

  // 跳转按钮点击 - 修复：调整触摸区域与UI一致
  handleJumpButtonClick(x, y) {
    const jumpAreaY = this.positions.jumpAreaY;
    const jumpButtonWidth = (config.screenWidth - 50) / 3;

    for (let i = 0; i < 3; i++) {
      const buttonX = 30 + i * jumpButtonWidth;
      const buttonWidth = jumpButtonWidth - 10;

      // 调整触摸区域与UI按钮完全一致
      if (x >= buttonX && x <= buttonX + buttonWidth &&
          y >= jumpAreaY + 13 && y <= jumpAreaY + 13 + config.buttonHeight) {

        this.handleJumpAction(i);
        return true;
      }
    }
    return false;
  }

  // 跳转操作 - 修改：不取消评分
  handleJumpAction(buttonIndex) {
    switch (buttonIndex) {
      case 0: // 鱼缸
        this.eventHandler.handleFishTank();
        break;
      case 1: // 让它游起来！
        this.eventHandler.handleMakeItSwim();
        break;
      case 2: // 排行榜
        this.eventHandler.handleRanking();
        break;
    }
  }

  // 组队按钮点击
  handleTeamButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const buttonSize = config.team.buttonSize;
    const buttonMargin = config.team.buttonMargin;
    const buttonY = functionAreaY - buttonSize - buttonMargin;
    
    // 组队按钮位置（左上角）
    const buttonX = buttonMargin;
    
    // 检查是否点击了组队按钮
    if (x >= buttonX && x <= buttonX + buttonSize &&
        y >= buttonY && y <= buttonY + buttonSize) {
      
      console.log('组队按钮被点击');
      
      // 显示组队界面
      if (this.eventHandler.handleTeam) {
        this.eventHandler.handleTeam();
      }
      
      return true;
    }
    
    return false;
  }

  // 绘画功能
  isInDrawingArea(x, y) {
    const drawingAreaY = this.positions.drawingAreaY;
    return y >= drawingAreaY && y <= drawingAreaY + config.drawingAreaHeight &&
           x >= 12 && x <= config.screenWidth - 12;
  }

  startDrawing(x, y) {
    const gameState = this.eventHandler.gameState;
    gameState.isDrawing = true;

    // 应用翻转变换到起始坐标
    const startX = gameState.isFlipped ? config.screenWidth - x : x;
    const startY = y;

    gameState.lastX = startX;
    gameState.lastY = startY;
    gameState.startNewPath(startX, startY);
  }

  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;

    // 应用翻转变换到坐标
    const currentX = gameState.isFlipped ? config.screenWidth - x : x;
    const currentY = y;

    ctx.beginPath();
    ctx.moveTo(gameState.lastX, gameState.lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    gameState.addPointToPath(currentX, currentY);
    gameState.lastX = currentX;
    gameState.lastY = currentY;
  }

  async finishDrawing() {
    const gameState = this.eventHandler.gameState;
    if (gameState.completePath()) {
      console.log('绘画完成，将在空闲时触发AI评分');
    }
    gameState.isDrawing = false;

    // 立即更新UI
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 新增：初始化协作模式
  initializeCollaboration(roomId, userRole) {
    console.log(`初始化协作模式，房间ID: ${roomId}, 角色: ${userRole}`);
    
    this.isCollaborativeMode = true;
    
    // 创建协作管理器实例
    const CollaborationManager = require('../collaborationManager.js');
    this.collaborationManager = new CollaborationManager(this.eventHandler);
    
    // 初始化协作会话
    this.collaborationManager.initialize(roomId, userRole)
      .then(success => {
        if (success) {
          console.log(`协作模式初始化成功，角色: ${userRole}`);
          
          // 设置操作回调
          this.collaborationManager.onDrawingOperationReceived = (path) => {
            console.log('收到房主绘画操作，模拟绘制');
          };
          
          this.collaborationManager.onTeammateOperationApplied = (data) => {
            console.log('协作者操作已应用到画布');
          };
        } else {
          console.error('协作模式初始化失败');
          this.isCollaborativeMode = false;
        }
      });
  }

  // 新增：停止协作模式
  stopCollaboration() {
    console.log('停止协作模式');
    
    if (this.collaborationManager) {
      this.collaborationManager.stop();
      this.collaborationManager = null;
    }
    
    this.isCollaborativeMode = false;
  }

  // 新增：记录协作操作（房主使用）
  async recordCollaborativeOperation(operationType, trace = null) {
    if (!this.isCollaborativeMode || !this.collaborationManager) {
      return false;
    }
    
    // 只有房主才能记录操作
    const teamHandler = this.eventHandler.touchHandlers.team;
    const isRoomOwner = teamHandler && teamHandler.roomNumber === teamHandler.teamInput;
    
    if (!isRoomOwner) {
      console.log('非房主角色，不记录协作操作');
      return false;
    }
    
    // 优化路径数据
    let optimizedTrace = trace;
    if (trace && Array.isArray(trace) && operationType.includes('draw')) {
      optimizedTrace = this.collaborationManager.optimizePathTransmission(trace);
    }
    
    const gameState = this.eventHandler.gameState;
    const success = await this.collaborationManager.recordOperation(
      operationType,
      optimizedTrace,
      gameState.isEraser ? '#FFFFFF' : gameState.currentColor,
      gameState.brushSize
    );
    
    if (success) {
      console.log(`协作操作已记录: ${operationType}`);
      this.lastOperationRecorded = Date.now();
    }
    
    return success;
  }

  // 修改：startDrawing 方法，添加协作操作记录
  startDrawing(x, y) {
    const gameState = this.eventHandler.gameState;
    gameState.isDrawing = true;

    // 应用翻转变换到起始坐标
    const startX = gameState.isFlipped ? config.screenWidth - x : x;
    const startY = y;

    gameState.lastX = startX;
    gameState.lastY = startY;
    gameState.startNewPath(startX, startY);
    
    // 协作模式：记录绘制开始（只在房主模式下）
    if (this.isCollaborativeMode && gameState.currentPath) {
      this.recordCollaborativeOperation('draw_start', [gameState.currentPath.points[0]]);
    }
  }

  // 修改：continueDrawing 方法，添加协作操作记录
  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;

    // 应用翻转变换到坐标
    const currentX = gameState.isFlipped ? config.screenWidth - x : x;
    const currentY = y;

    ctx.beginPath();
    ctx.moveTo(gameState.lastX, gameState.lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = gameState.isEraser ? '#FFFFFF' : gameState.currentColor;
    ctx.lineWidth = gameState.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    gameState.addPointToPath(currentX, currentY);
    gameState.lastX = currentX;
    gameState.lastY = currentY;
    
    // 协作模式：记录绘制移动（节流，避免记录过多点）
    if (this.isCollaborativeMode && gameState.currentPath && 
        Date.now() - this.lastOperationRecorded > 100) {
      this.recordCollaborativeOperation('draw_move', gameState.currentPath.points);
    }
  }

  // 修改：finishDrawing 方法，添加协作操作记录
  async finishDrawing() {
    const gameState = this.eventHandler.gameState;
    if (gameState.completePath()) {
      console.log('绘画完成，将在空闲时触发AI评分');
      
      // 协作模式：记录绘制完成
      if (this.isCollaborativeMode && gameState.drawingPaths.length > 0) {
        const lastPath = gameState.drawingPaths[gameState.drawingPaths.length - 1];
        await this.recordCollaborativeOperation('draw_complete', lastPath.points);
      }
    }
    gameState.isDrawing = false;

    // 立即更新UI
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 修改：工具操作 - 修改：实现翻转功能，添加协作操作记录
  handleToolAction(toolIndex) {
    const gameState = this.eventHandler.gameState;

    switch (toolIndex) {
      case 0: // 橡皮 - 不取消评分
        gameState.toggleEraser();
        // 协作模式：记录橡皮切换
        if (this.isCollaborativeMode) {
          this.recordCollaborativeOperation('eraser_toggle');
        }
        break;
      case 1: // 撤销 - 不取消评分
        gameState.undo();
        // 协作模式：记录撤销操作
        if (this.isCollaborativeMode) {
          this.recordCollaborativeOperation('undo');
        }
        break;
      case 2: // 清空 - 需要取消评分，因为内容完全变了
        gameState.clear();
        this.cancelPendingScoring();
        // 协作模式：记录清空操作
        if (this.isCollaborativeMode) {
          this.recordCollaborativeOperation('clear');
        }
        break;
      case 3: // 翻转 - 实现翻转功能
        this.handleFlipAction();
        // 协作模式：记录翻转操作
        if (this.isCollaborativeMode) {
          this.recordCollaborativeOperation('flip');
        }
        break;
    }
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 修改：颜色按钮点击 - 修改：不取消评分，添加协作操作记录
  handleColorButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const colorButtonsY = functionAreaY + 10; // 调整为与UI一致
    const totalWidth = config.colorButtonSize * 7 + 18 * 6;
    const startX = (config.screenWidth - totalWidth) / 2;

    for (let i = 0; i < 7; i++) {
      const buttonX = startX + i * (config.colorButtonSize + 18);
      const buttonY = colorButtonsY;

      if (x >= buttonX && x <= buttonX + config.colorButtonSize &&
          y >= buttonY && y <= buttonY + config.colorButtonSize) {

        const previousColor = this.eventHandler.gameState.currentColor;
        this.eventHandler.gameState.setColor(config.colors[i]);
        
        // 协作模式：记录颜色变更
        if (this.isCollaborativeMode && previousColor !== config.colors[i]) {
          this.recordCollaborativeOperation('color_change');
        }
        
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
        return true;
      }
    }
    return false;
  }

  // 修改：画笔大小点击 - 修改：不取消评分，添加协作操作记录
  handleBrushSizeClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    // 调整为与UI一致的位置
    const sizeControlY = functionAreaY + config.partHeight - 5;
    const sliderX = 100;
    const sliderWidth = config.screenWidth - 140;

    // 扩大触摸区域，便于操作
    if (y >= sizeControlY - 15 && y <= sizeControlY + 15 &&
        x >= sliderX - 10 && x <= sliderX + sliderWidth + 10) {

      const progress = Math.max(0, Math.min(1, (x - sliderX) / sliderWidth));
      const newSize = Math.round(progress * 19) + 1; // 1-20范围
      const previousSize = this.eventHandler.gameState.brushSize;
      
      this.eventHandler.gameState.setBrushSize(newSize);
      
      // 协作模式：记录画笔大小变更
      if (this.isCollaborativeMode && previousSize !== newSize) {
        this.recordCollaborativeOperation('brush_size_change');
      }
      
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }
    return false;
  }

  // 新增：清理资源
  cleanup() {
    this.cancelPendingScoring();
    this.stopCollaboration();
  }
}

module.exports = MainTouchHandler;
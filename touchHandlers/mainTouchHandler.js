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

    // 调色板处理器
    this.paletteHandler = null;

    // 新增：双指缩放相关（重新设计）
    this.touches = []; // 存储当前触摸点
    this.isTwoFingerTouch = false; // 是否双指触摸
    this.zoomActive = false; // 缩放是否激活
    this.singleTouchTimer = null; // 单指触摸计时器
    this.touchMode = 'none'; // 触摸模式：'none', 'single', 'two_finger'
  }

  // 处理主界面触摸开始（重新设计）
  handleTouchStart(x, y) {
    if (this.isInDrawingArea(x, y)) {
      // 添加当前触摸点
      const newTouch = {x, y, id: Date.now() + Math.random()}; // 唯一ID
      this.touches.push(newTouch);
      
      // 根据触摸点数量切换模式
      if (this.touches.length === 1) {
        // 第一个触摸点：进入单指预备状态
        this.enterSingleTouchMode(x, y);
      } else if (this.touches.length === 2) {
        // 第二个触摸点：立即进入双指模式
        this.enterTwoFingerMode();
      } else if (this.touches.length > 2) {
        // 超过两指：重置状态
        this.resetTouchState();
      }
    } else {
      // 非绘画区域的触摸
      this.handleFunctionAreaClick(x, y);
    }
  }

  // 新增：进入单指触摸模式
  enterSingleTouchMode(x, y) {
    // 清除之前的计时器
    if (this.singleTouchTimer) {
      clearTimeout(this.singleTouchTimer);
    }
    
    // 设置200ms后开始绘画（避免误触）
    this.singleTouchTimer = setTimeout(() => {
      if (this.touches.length === 1 && this.touchMode === 'none') {
        this.touchMode = 'single';
        this.cancelPendingScoring();
        this.startDrawing(x, y);
        console.log('单指绘画模式激活');
      }
    }, 200);
  }

  // 新增：进入双指触摸模式
  enterTwoFingerMode() {
    // 清除单指计时器
    if (this.singleTouchTimer) {
      clearTimeout(this.singleTouchTimer);
      this.singleTouchTimer = null;
    }
    
    // 立即切换到双指模式
    this.touchMode = 'two_finger';
    this.isTwoFingerTouch = true;
    
    // 开始缩放检测
    this.handleTwoFingerStart(this.touches[0], this.touches[1]);
    console.log('双指模式激活，等待缩放计时器');
  }

  // 新增：处理双指触摸开始（重新设计）
  handleTwoFingerStart(touch1, touch2) {
    const gameState = this.eventHandler.gameState;
    
    // 只重置缩放激活状态，保持当前缩放比例
    if (gameState.zoomState.zoomTimer) {
      clearTimeout(gameState.zoomState.zoomTimer);
      gameState.zoomState.zoomTimer = null;
    }
    gameState.zoomState.isZooming = false;
    
    // 开始缩放检测（保持200ms延迟），从当前缩放比例继续
    gameState.startZooming(touch1.x, touch1.y, touch2.x, touch2.y);
    
    console.log(`双指缩放检测已启动，从${gameState.zoomState.zoomScale.toFixed(1)}x继续缩放`);
  }

  // 新增：重置触摸状态
  resetTouchState() {
    this.touches = [];
    this.isTwoFingerTouch = false;
    this.touchMode = 'none';
    
    if (this.singleTouchTimer) {
      clearTimeout(this.singleTouchTimer);
      this.singleTouchTimer = null;
    }
    
    // 只重置缩放激活状态，保持当前缩放比例
    const gameState = this.eventHandler.gameState;
    if (gameState.zoomState.zoomTimer) {
      clearTimeout(gameState.zoomState.zoomTimer);
      gameState.zoomState.zoomTimer = null;
    }
    gameState.zoomState.isZooming = false;
  }

  // 处理主界面触摸移动（重新设计）
  handleTouchMove(x, y) {
    const gameState = this.eventHandler.gameState;
    
    // 更新触摸点位置（简化逻辑）
    this.updateTouchPositionSimple(x, y);
    
    // 双指缩放模式处理
    if (this.touchMode === 'two_finger' && this.touches.length >= 2) {
      // 处理双指缩放
      this.handleZoomMove();
      return; // 缩放模式中不进行绘画
    }
    
    // 单指绘画模式处理
    if (this.touchMode === 'single' && gameState.isDrawing) {
      if (this.isInDrawingArea(x, y)) {
        this.continueDrawing(x, y);
        this.lastDrawTime = Date.now();
        this.cancelPendingScoring();
      }
    }
  }

  // 新增：简化版触摸点更新逻辑
  updateTouchPositionSimple(x, y) {
    if (this.touches.length === 0) return;
    
    // 如果只有1个触摸点，直接更新
    if (this.touches.length === 1) {
      this.touches[0] = {x, y, id: this.touches[0].id};
      return;
    }
    
    // 如果有2个触摸点，找到距离最近的一个更新
    let minDistance1 = Math.sqrt(Math.pow(x - this.touches[0].x, 2) + Math.pow(y - this.touches[0].y, 2));
    let minDistance2 = Math.sqrt(Math.pow(x - this.touches[1].x, 2) + Math.pow(y - this.touches[1].y, 2));
    
    // 更新距离更近的触摸点
    if (minDistance1 < minDistance2) {
      this.touches[0] = {x, y, id: this.touches[0].id};
    } else {
      this.touches[1] = {x, y, id: this.touches[1].id};
    }
  }

  // 新增：更新触摸点位置（优化灵敏度）
  updateTouchPosition(x, y) {
    // 找到距离最近的触摸点并更新位置（大幅降低阈值提高灵敏度）
    let minDistance = Infinity;
    let closestTouch = null;
    
    for (let i = 0; i < this.touches.length; i++) {
      const touch = this.touches[i];
      const distance = Math.sqrt(Math.pow(x - touch.x, 2) + Math.pow(y - touch.y, 2));
      
      if (distance < minDistance) {
        minDistance = distance;
        closestTouch = i;
      }
    }
    
    // 大幅降低匹配阈值，提高灵敏度（从30降低到10像素）
    if (closestTouch !== null && minDistance < 10) {
      this.touches[closestTouch] = {x, y, timestamp: Date.now()};
      
      // 立即更新缩放状态（提高响应速度）
      if (this.touches.length >= 2 && this.isTwoFingerTouch) {
        this.handleZoomMove();
      }
    }
  }

  // 新增：处理缩放移动
  handleZoomMove() {
    if (this.touches.length < 2) return;
    
    const gameState = this.eventHandler.gameState;
    const touch1 = this.touches[0];
    const touch2 = this.touches[1];
    
    // 如果缩放模式还没激活，但双指已经移动，检查是否需要立即激活
    if (!gameState.zoomState.isZooming) {
      const currentDistance = Math.sqrt(
        Math.pow(touch2.x - touch1.x, 2) + Math.pow(touch2.y - touch1.y, 2)
      );
      
      // 如果双指距离明显变化，立即激活缩放（提高响应性）
      if (gameState.zoomState.initialDistance > 0 && 
          Math.abs(currentDistance - gameState.zoomState.initialDistance) > 15) {
        // 清除计时器，立即激活缩放
        if (gameState.zoomState.zoomTimer) {
          clearTimeout(gameState.zoomState.zoomTimer);
          gameState.zoomState.zoomTimer = null;
        }
        gameState.zoomState.isZooming = true;
        console.log('缩放模式立即激活（检测到明显移动）');
      }
    }
    
    // 更新缩放状态
    gameState.updateZooming(touch1.x, touch1.y, touch2.x, touch2.y);
    
    // 强制重绘界面以显示缩放效果
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 处理主界面触摸结束（重新设计）
  handleTouchEnd(x, y) {
    const gameState = this.eventHandler.gameState;
    
    // 移除对应的触摸点
    this.removeTouchSimple(x, y);
    
    // 根据剩余触摸点数量更新模式
    if (this.touches.length === 0) {
      // 所有触摸点都移除了
      if (this.touchMode === 'two_finger') {
        this.handleZoomEnd();
      } else if (this.touchMode === 'single' && gameState.isDrawing) {
        this.finishDrawing();
        this.scheduleSmartScoring();
      }
      this.resetTouchState();
    } else if (this.touches.length === 1 && this.touchMode === 'two_finger') {
      // 双指变单指：结束缩放模式
      this.handleZoomEnd();
      this.touchMode = 'single';
      this.isTwoFingerTouch = false;
    }
  }

  // 新增：简化版触摸点移除逻辑
  removeTouchSimple(x, y) {
    if (this.touches.length === 0) return;
    
    // 如果只有1个触摸点，直接移除
    if (this.touches.length === 1) {
      this.touches = [];
      return;
    }
    
    // 如果有2个触摸点，找到距离最近的一个移除
    let distance1 = Math.sqrt(Math.pow(x - this.touches[0].x, 2) + Math.pow(y - this.touches[0].y, 2));
    let distance2 = Math.sqrt(Math.pow(x - this.touches[1].x, 2) + Math.pow(y - this.touches[1].y, 2));
    
    if (distance1 < distance2) {
      this.touches.splice(0, 1);
    } else {
      this.touches.splice(1, 1);
    }
  }

  // 新增：移除触摸点（优化灵敏度）
  removeTouch(x, y) {
    // 找到距离最近的触摸点并移除（大幅降低阈值）
    let minDistance = Infinity;
    let closestTouch = null;
    
    for (let i = 0; i < this.touches.length; i++) {
      const touch = this.touches[i];
      const distance = Math.sqrt(Math.pow(x - touch.x, 2) + Math.pow(y - touch.y, 2));
      
      if (distance < minDistance) {
        minDistance = distance;
        closestTouch = i;
      }
    }
    
    // 大幅降低匹配阈值，提高灵敏度（从50降低到15像素）
    if (closestTouch !== null && minDistance < 15) {
      this.touches.splice(closestTouch, 1);
    }
  }

  // 新增：处理缩放结束
  handleZoomEnd() {
    const gameState = this.eventHandler.gameState;
    
    // 结束缩放
    gameState.finishZooming();
    
    // 重绘界面显示最终缩放状态
    this.eventHandler.uiManager.drawGameUI(gameState);
    
    console.log('缩放模式结束');
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

  // 优化：安排智能评分（协同模式优化）
  scheduleSmartScoring() {
    this.cancelPendingScoring();

    // 协同模式：延长延迟时间，避免频繁取消
    const delay = this.isCollaborativeMode ? 1000 : 400;

    this.scoringTimer = setTimeout(() => {
      this.triggerAIScoring();
    }, delay);
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
    // 首先检查是否在调色板界面中
    if (this.paletteHandler && this.paletteHandler.isVisible) {
      if (this.paletteHandler.handlePaletteTouch(x, y)) return;
    }

    if (this.handleColorButtonClick(x, y)) return;
    if (this.handleBrushSizeClick(x, y)) return;
    if (this.handleToolButtonClick(x, y)) return;
    if (this.handleJumpButtonClick(x, y)) return;
    if (this.handleTeamButtonClick(x, y)) return;
    if (this.handleSearchButtonClick(x, y)) return;
  }

  // 颜色按钮点击 - 修改：调色板按钮特殊处理
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

        // 如果是调色板按钮（最后一个按钮），弹出调色板界面
        if (i === 6) {
          console.log('调色板按钮被点击');
          this.showPaletteInterface();
          return true;
        }

        // 普通颜色按钮
        this.eventHandler.gameState.setColor(config.colors[i]);
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
        return true;
      }
    }
    return false;
  }

  // 显示调色板界面
  showPaletteInterface() {
    if (!this.paletteHandler) {
      const PaletteHandler = require('./paletteHandler.js');
      this.paletteHandler = new PaletteHandler(this.eventHandler);
    }

    this.paletteHandler.showPaletteInterface();
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

  // 修改：处理翻转操作 - 改为一次性操作，支持协作同步
  async handleFlipAction() {
    const gameState = this.eventHandler.gameState;

    if (gameState.drawingPaths.length === 0) {
      const Utils = require('../utils.js');
      Utils.showError('请先画一些内容');
      return;
    }

    // 执行一次性翻转
    const success = gameState.flipCanvas();

    if (success) {
      // 协作模式：记录翻转操作
      if (this.isCollaborativeMode && this.collaborationManager) {
        const role = this.getCurrentUserRole();
        console.log(`${role} 执行翻转操作，将同步到对方画布`);

        // 翻转操作不需要轨迹，但需要记录操作类型
        await this.recordCollaborativeOperation('flip');
      }

      // 重新绘制整个界面（包括翻转后的路径）
      this.eventHandler.uiManager.drawGameUI(gameState);
    }
  }

  // 新增：处理清空操作 - 支持协作同步
  async handleClearAction() {
    const gameState = this.eventHandler.gameState;

    // 执行清空操作
    gameState.clear();
    this.cancelPendingScoring();

    // 协作模式：记录清空操作
    if (this.isCollaborativeMode && this.collaborationManager) {
      const role = this.getCurrentUserRole();
      console.log(`${role} 执行清空操作，将同步到对方画布`);

      // 清空操作不需要轨迹，但需要记录操作类型
      await this.recordCollaborativeOperation('clear');
    }

    // 重新绘制整个界面（显示清空后的画布）
    this.eventHandler.uiManager.drawGameUI(gameState);
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

  // 搜索按钮点击
  handleSearchButtonClick(x, y) {
    const functionAreaY = this.positions.functionAreaY;
    const buttonSize = config.team.buttonSize;
    const buttonMargin = config.team.buttonMargin;
    const buttonY = functionAreaY - buttonSize - buttonMargin;

    // 搜索按钮位置（组队按钮右侧）
    const buttonX = buttonMargin + buttonSize + 10;

    // 检查是否点击了搜索按钮
    if (x >= buttonX && x <= buttonX + buttonSize &&
        y >= buttonY && y <= buttonY + buttonSize) {

      console.log('搜索按钮被点击');

      // 显示搜索对话框
      if (this.eventHandler.handleSearch) {
        this.eventHandler.handleSearch();
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

    // 直接使用原始坐标（不再应用动态翻转）
    gameState.lastX = x;
    gameState.lastY = y;
    gameState.startNewPath(x, y);
  }

  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;

    // 直接使用原始坐标（不再应用动态翻转）
    const currentX = x;
    const currentY = y;

    // 对所有绘制操作添加裁剪区域限制，确保不会超出边界
    ctx.save();

    // 设置裁剪区域为绘画区域内部（固定边距，与笔刷大小无关）
    const drawingAreaY = this.positions.drawingAreaY;
    const padding = 2; // 固定边距，确保不会擦到边框
    ctx.beginPath();
    ctx.rect(12 + padding, drawingAreaY + padding,
             config.screenWidth - 24 - padding * 2,
             config.drawingAreaHeight - padding * 2);
    ctx.clip();

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

    // 恢复画布状态
    ctx.restore();
  }

  // 新增：初始化协作模式
  initializeCollaboration(roomId, userRole) {
    console.log(`初始化协作模式，房间ID: ${roomId}, 角色: ${userRole}`);

    this.isCollaborativeMode = true;

    // 设置游戏状态的协同模式
    this.eventHandler.gameState.setCollaborativeMode(true);

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
          this.eventHandler.gameState.setCollaborativeMode(false);
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

  // 新增：记录协作操作（房主和协作者都可以使用）
  async recordCollaborativeOperation(operationType, trace = null) {
    if (!this.isCollaborativeMode || !this.collaborationManager) {
      return false;
    }

    // 使用统一方法确定用户角色
    const role = this.getCurrentUserRole();

    // 根据角色调用不同的记录方法
    let success = false;
    const gameState = this.eventHandler.gameState;

    // 确定实际操作类型、颜色和线宽
    let actualOperationType = operationType;
    let color = gameState.currentColor;
    let lineWidth = gameState.brushSize;

    // 修复：撤销操作优先级最高，不受橡皮状态影响
    if (operationType === 'undo') {
      actualOperationType = 'undo';
      // 撤销操作不需要颜色和线宽
    }
    // 如果是橡皮擦操作，设置相应参数
    else if (gameState.isEraser || operationType === 'erase') {
      actualOperationType = 'erase';
      color = '#FFFFFF';
    }

    // 优化路径数据
    let optimizedTrace = trace;
    if (trace && Array.isArray(trace)) {
      optimizedTrace = this.collaborationManager.optimizePathTransmission(trace);
    }

    if (role === 'homeowner') {
      // 房主使用recordOperation方法
      success = await this.collaborationManager.recordOperation(
        actualOperationType,
        optimizedTrace,
        color,
        lineWidth
      );

      if (success) {
        console.log(`房主协作操作已记录: ${actualOperationType}, 颜色: ${color}, 线宽: ${lineWidth}`);
      }
    } else if (role === 'teamworker') {
      // 协作者使用recordTeamworkerOperation方法
      success = await this.collaborationManager.recordTeamworkerOperation(
        actualOperationType,
        optimizedTrace,
        color,
        lineWidth
      );

      if (success) {
        console.log(`协作者协作操作已记录: ${actualOperationType}, 颜色: ${color}, 线宽: ${lineWidth}`);
      }
    }

    if (success) {
      this.lastOperationRecorded = Date.now();
    }

    return success;
  }

  // 修改：startDrawing 方法，移除协作操作记录
  startDrawing(x, y) {
    const gameState = this.eventHandler.gameState;
    gameState.isDrawing = true;

    // 直接使用原始坐标（不再应用动态翻转）
    gameState.lastX = x;
    gameState.lastY = y;
    gameState.startNewPath(x, y);
  }

  // 修改：continueDrawing 方法，移除协作操作记录
  continueDrawing(x, y) {
    const ctx = this.eventHandler.canvas.getContext('2d');
    const gameState = this.eventHandler.gameState;

    // 直接使用原始坐标（不再应用动态翻转）
    const currentX = x;
    const currentY = y;

    // 对所有绘制操作添加裁剪区域限制，确保不会超出边界
    ctx.save();

    // 设置裁剪区域为绘画区域内部（固定边距，与笔刷大小无关）
    const drawingAreaY = this.positions.drawingAreaY;
    const padding = 2; // 固定边距，确保不会擦到边框
    ctx.beginPath();
    ctx.rect(12 + padding, drawingAreaY + padding,
             config.screenWidth - 24 - padding * 2,
             config.drawingAreaHeight - padding * 2);
    ctx.clip();

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

    // 恢复画布状态
    ctx.restore();
  }

  // 修改：finishDrawing 方法，修复版：确保操作正确记录到角色历史
  async finishDrawing() {
    const gameState = this.eventHandler.gameState;
    if (gameState.completePath()) {
      console.log('绘画完成，将在空闲时触发AI评分');

      // 协作模式：记录绘制完成（房主和协作者都记录）
      if (this.isCollaborativeMode && gameState.drawingPaths.length > 0) {
        const lastPath = gameState.drawingPaths[gameState.drawingPaths.length - 1];
        const operationType = gameState.isEraser ? 'erase' : 'draw';

        // 确定当前用户角色（使用统一方法）
        const role = this.getCurrentUserRole();

        console.log(`${role} 完成绘画操作，操作类型: ${operationType}`);

        // 创建新的操作对象，包含所有必要信息
        const operation = {
          ...lastPath,
          id: Date.now() + Math.random(), // 添加唯一ID
          timestamp: Date.now(),
          role: role,
          operationType: operationType,
          isEraser: gameState.isEraser || operationType === 'erase'
        };

        // 更新绘图路径中的最后一项，确保包含角色信息
        gameState.drawingPaths[gameState.drawingPaths.length - 1] = operation;

        // 添加到本地角色历史记录（确保操作被正确记录）
        const success = gameState.addOperationToRoleHistory(role, operation);
        if (success) {
          console.log(`${role} 绘画操作已添加到本地历史，当前操作数: ${gameState.getOperationCountByRole(role)}`);
        } else {
          console.error(`${role} 绘画操作添加失败`);
        }

        // 记录协作操作
        await this.recordCollaborativeOperation(operationType, lastPath.points);
      }
    }
    gameState.isDrawing = false;

    // 立即更新UI
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 修改：工具操作 - 改进版：支持基于角色的准确撤销，橡皮和撤销互斥
  async handleToolAction(toolIndex) {
    const gameState = this.eventHandler.gameState;

    switch (toolIndex) {
      case 0: // 橡皮 - 不取消评分，与撤销互斥
        // 如果之前是撤销状态，不需要特殊处理，因为撤销是瞬时操作
        gameState.toggleEraser();
        break;
      case 1: // 撤销 - 不取消评分，与橡皮互斥
        // 如果橡皮处于激活状态，先取消橡皮状态
        if (gameState.isEraser) {
          gameState.isEraser = false;
          console.log('撤销操作前取消橡皮状态');
        }
        await this.handleUndoAction();
        break;
      case 2: // 清空 - 需要取消评分，因为内容完全变了
        await this.handleClearAction();
        break;
      case 3: // 翻转 - 实现翻转功能
        this.handleFlipAction();
        break;
    }
    this.eventHandler.uiManager.drawGameUI(gameState);
  }

  // 新增：获取当前用户角色（统一方法）
  getCurrentUserRole() {
    if (!this.isCollaborativeMode) {
      return null; // 非协作模式无角色
    }

    // 获取当前用户角色
    const teamHandler = this.eventHandler.touchHandlers.team;
    if (teamHandler && teamHandler.roomNumber) {
      // 判断是否为房主
      const isRoomOwner = teamHandler.roomNumber === teamHandler.teamInput;
      return isRoomOwner ? 'homeowner' : 'teamworker';
    }

    console.warn('无法确定用户角色，默认为teamworker');
    return 'teamworker'; // 默认值
  }

  // 新增：处理撤销操作（支持基于角色的准确撤销）
  async handleUndoAction() {
    const gameState = this.eventHandler.gameState;

    if (this.isCollaborativeMode) {
      // 协作模式：基于角色进行准确撤销
      const role = this.getCurrentUserRole();

      console.log(`${role} 执行撤销操作，当前绘图路径数: ${gameState.drawingPaths.length}`);

      // 执行基于角色的撤销
      const success = gameState.undoByRole(role);

    if (success) {
      console.log(`撤销后绘图路径数: ${gameState.drawingPaths.length}`);

      // 修复：直接使用完整重绘，避免使用destination-out导致的短暂显示异常
      this.redrawCanvasAfterUndo();

      // 记录协作撤销操作（传递角色信息）
      await this.recordCollaborativeOperation('undo', null);

      console.log(`${role} 撤销操作成功，UI已更新`);
    } else {
      console.warn(`${role} 撤销操作失败：没有可撤销的操作`);

      // 提示用户没有可撤销的操作
      const Utils = require('../utils.js');
      Utils.showError(`${role === 'homeowner' ? '房主' : '协作者'}没有可撤销的操作`);
    }
    } else {
      // 单机模式：使用标准撤销
      const success = gameState.undo();
      if (success) {
        // 重绘画布
        this.redrawCanvasAfterUndo();
      }
    }
  }

  // 新增：撤销操作后直接擦除操作（不重绘整个画布）
  eraseOperationAfterUndo(role) {
    const gameState = this.eventHandler.gameState;

    // 获取要撤销的操作（角色的最后一个操作）
    let operationToUndo = null;
    if (role === 'homeowner' && gameState.homeownerHistory.length > 0) {
      operationToUndo = gameState.homeownerHistory[gameState.homeownerHistory.length - 1];
    } else if (role === 'teamworker' && gameState.teamworkerHistory.length > 0) {
      operationToUndo = gameState.teamworkerHistory[gameState.teamworkerHistory.length - 1];
    }

    if (!operationToUndo) {
      console.warn(`${role}没有可撤销的操作`);
      return;
    }

    const ctx = this.eventHandler.canvas.getContext('2d');
    const config = require('../config.js').config;

    console.log(`直接在画布上擦除${role}的操作: ID=${operationToUndo.id || '无ID'}, 颜色=${operationToUndo.color}`);

    // 保存当前绘图状态
    ctx.save();

    // 如果处于翻转状态，应用翻转变换
    if (gameState.isFlipped) {
      ctx.save();
      ctx.translate(config.screenWidth, 0);
      ctx.scale(-1, 1);
    }

    // 设置擦除参数
    ctx.globalCompositeOperation = 'destination-out'; // 设置合成模式为擦除
    ctx.lineWidth = operationToUndo.size * 2; // 稍微增大线宽确保完全覆盖
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 如果操作是橡皮擦，使用白色擦除
    if (operationToUndo.isEraser || operationToUndo.color === '#FFFFFF') {
      ctx.globalCompositeOperation = 'destination-over'; // 在下方绘制
      ctx.strokeStyle = '#FFFFFF';
    }

    // 开始擦除路径
    ctx.beginPath();

    // 应用翻转变换到坐标
    const startPoint = gameState.isFlipped ?
      { x: config.screenWidth - operationToUndo.points[0].x, y: operationToUndo.points[0].y } :
      operationToUndo.points[0];

    ctx.moveTo(startPoint.x, startPoint.y);

    for (let i = 1; i < operationToUndo.points.length; i++) {
      const point = gameState.isFlipped ?
        { x: config.screenWidth - operationToUndo.points[i].x, y: operationToUndo.points[i].y } :
        operationToUndo.points[i];

      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();

    // 恢复翻转状态
    if (gameState.isFlipped) {
      ctx.restore();
    }

    // 恢复绘图状态
    ctx.restore();

    console.log(`已完成在画布上擦除${role}的操作`);
  }

  // 新增：撤销操作后重绘画布（统一方案）
  redrawCanvasAfterUndo() {
    const gameState = this.eventHandler.gameState;
    const ctx = this.eventHandler.canvas.getContext('2d');
    const config = require('../config.js').config;
    const positions = require('../config.js').getAreaPositions();

    console.log(`撤销后重绘画布，当前路径数: ${gameState.drawingPaths.length}`);

    // 修复：统一使用UIManager重绘整个UI，确保背景和所有元素都正确显示
    // 这样可以避免直接操作画布导致的显示不一致问题
    if (this.eventHandler.uiManager) {
      this.eventHandler.uiManager.drawGameUI(gameState);
      console.log('使用UIManager重绘画布完成');
      return;
    }

    // 备用方案：直接重绘画布（仅在UIManager不可用时使用）
    console.warn('UIManager不可用，使用备用重绘方案');
    const drawingAreaY = positions.drawingAreaY;

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
      if (path.points && path.points.length > 0) {
        // 对所有路径添加裁剪区域限制，确保不会超出边界
        ctx.save();

        // 设置裁剪区域为绘画区域内部（固定边距，与笔刷大小无关）
        const drawingAreaY = positions.drawingAreaY;
        const padding = 2; // 固定边距，确保不会擦到边框
        ctx.beginPath();
        ctx.rect(12 + padding, drawingAreaY + padding,
                 config.screenWidth - 24 - padding * 2,
                 config.drawingAreaHeight - padding * 2);
        ctx.clip();

        // 修复：确保绘制状态一致，避免加黑加粗问题
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

        // 修复：确保使用正确的样式，避免加黑加粗
        ctx.strokeStyle = path.color;
        ctx.lineWidth = path.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // 修复：重置合成模式，确保不会使用destination-out
        ctx.globalCompositeOperation = 'source-over';
        ctx.stroke();

        // 恢复画布状态
        ctx.restore();

        // 调试输出：显示绘制的路径信息
        if (path.role) {
          console.log(`重绘${path.role}的路径，颜色: ${path.color}, 点数: ${path.points.length}, 操作ID: ${path.id || '无ID'}`);
        }
      }
    });

    if (gameState.isFlipped) {
      ctx.restore();
    }

    console.log('撤销操作后画布已重绘（备用方案）');
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

      this.eventHandler.gameState.setBrushSize(newSize);

      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }
    return false;
  }

  // 新增：清理资源
  cleanup() {
    this.cancelPendingScoring();
    this.stopCollaboration();

    // 清理调色板处理器
    if (this.paletteHandler) {
      this.paletteHandler.cleanup();
    }
  }
}

module.exports = MainTouchHandler;
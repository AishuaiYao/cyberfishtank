// teamTouchHandler.js - 组队触摸事件处理
const { config } = require('../config.js');

class TeamTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    
    // 当前界面状态
    this.currentTeamState = 'main'; // 'main', 'createRoom', 'searchRoom', 'collaborativePainting'
    
    // 房间号（Unix时间戳后8位）
    this.roomNumber = null;
  }

  // 处理主界面触摸事件
  handleTeamTouch(x, y) {
    console.log('组队界面触摸:', x, y, '当前状态:', this.currentTeamState);

    // 根据当前状态路由到不同的处理逻辑
    switch (this.currentTeamState) {
      case 'main':
        return this.handleMainInterfaceTouch(x, y);
      case 'createRoom':
        return this.handleCreateRoomInterfaceTouch(x, y);
      case 'searchRoom':
        return this.handleSearchRoomInterfaceTouch(x, y);
      case 'collaborativePainting':
        return this.handleCollaborativePaintingTouch(x, y);
      default:
        return this.handleMainInterfaceTouch(x, y);
    }
  }

  // 处理主界面触摸
  handleMainInterfaceTouch(x, y) {
    const teamWidth = config.team.teamInterface.width;
    const teamHeight = config.team.teamInterface.height;
    const teamX = (config.screenWidth - teamWidth) / 2;
    const teamY = (config.screenHeight - teamHeight) / 2;

    // 按钮参数
    const buttonWidth = config.team.teamInterface.buttonWidth;
    const buttonHeight = config.team.teamInterface.buttonHeight;
    const buttonY = teamY + teamHeight - buttonHeight - 40;
    const buttonSpacing = 20;
    const totalButtonWidth = buttonWidth * 2 + buttonSpacing;
    const startX = teamX + (teamWidth - totalButtonWidth) / 2;

    // 建立房间按钮区域
    const createRoomButton = {
      x: startX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };

    // 搜索房间按钮区域
    const searchRoomButton = {
      x: startX + buttonWidth + buttonSpacing,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };

    // 检查点击位置
    if (this.isPointInRect(x, y, createRoomButton)) {
      console.log('点击建立房间按钮');
      this.handleCreateRoomAction();
      return true;
    }

    if (this.isPointInRect(x, y, searchRoomButton)) {
      console.log('点击搜索房间按钮');
      this.handleSearchRoomAction();
      return true;
    }

    // 检查是否点击了背景区域（关闭界面）
    const teamInterfaceRect = {
      x: teamX,
      y: teamY,
      width: teamWidth,
      height: teamHeight
    };

    if (!this.isPointInRect(x, y, teamInterfaceRect)) {
      console.log('点击背景区域，关闭组队界面');
      this.eventHandler.hideTeamInterface();
      return true;
    }

    return false;
  }

  // 处理建立房间界面触摸
  handleCreateRoomInterfaceTouch(x, y) {
    const dialogWidth = 280;
    const dialogHeight = 180;
    const dialogX = (config.screenWidth - dialogWidth) / 2;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 取消按钮区域
    const cancelButton = {
      x: dialogX + 60,
      y: dialogY + dialogHeight - 50,
      width: dialogWidth - 120,
      height: 36
    };

    // 检查点击位置
    if (this.isPointInRect(x, y, cancelButton)) {
      console.log('点击取消按钮，返回主界面');
      this.currentTeamState = 'main';
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }

    // 检查是否点击了背景区域（关闭界面）
    const dialogRect = {
      x: dialogX,
      y: dialogY,
      width: dialogWidth,
      height: dialogHeight
    };

    if (!this.isPointInRect(x, y, dialogRect)) {
      console.log('点击背景区域，关闭组队界面');
      this.eventHandler.hideTeamInterface();
      return true;
    }

    return false;
  }

  // 处理搜索房间界面触摸
  handleSearchRoomInterfaceTouch(x, y) {
    const dialogWidth = 280;
    const dialogHeight = 180;
    const dialogX = (config.screenWidth - dialogWidth) / 2;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 取消按钮区域
    const cancelButton = {
      x: dialogX + 60,
      y: dialogY + dialogHeight - 50,
      width: dialogWidth - 120,
      height: 36
    };

    // 检查点击位置
    if (this.isPointInRect(x, y, cancelButton)) {
      console.log('点击取消按钮，返回主界面');
      this.currentTeamState = 'main';
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }

    // 检查是否点击了背景区域（关闭界面）
    const dialogRect = {
      x: dialogX,
      y: dialogY,
      width: dialogWidth,
      height: dialogHeight
    };

    if (!this.isPointInRect(x, y, dialogRect)) {
      console.log('点击背景区域，关闭组队界面');
      this.eventHandler.hideTeamInterface();
      return true;
    }

    return false;
  }

  // 建立房间操作
  async handleCreateRoomAction() {
    console.log('开始建立房间...');
    
    // 生成房间号（Unix时间戳后8位）
    this.roomNumber = this.generateRoomNumber();
    console.log('生成房间号:', this.roomNumber);
    
    // 切换到共同绘画界面
    this.currentTeamState = 'collaborativePainting';
    this.eventHandler.isCollaborativePaintingVisible = true;
    this.eventHandler.isTeamInterfaceVisible = false; // 关闭组队界面
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
    
    wx.showToast({
      title: `房间 ${this.roomNumber} 创建成功`,
      icon: 'success',
      duration: 2000
    });
  }

  // 处理共同绘画界面触摸
  handleCollaborativePaintingTouch(x, y) {
    console.log('共同绘画界面触摸:', x, y);
    
    // 检查是否点击了"让它游起来"按钮
    const buttonArea = this.getCollaborativePaintingButtonArea();
    if (this.isPointInRect(x, y, buttonArea)) {
      console.log('点击"让它游起来"按钮');
      this.handleMakeItSwimInRoom();
      return true;
    }
    
    // 检查是否点击了返回按钮（顶部区域）
    const topArea = {
      x: 0,
      y: 0,
      width: config.screenWidth,
      height: 80
    };
    
    if (this.isPointInRect(x, y, topArea)) {
      console.log('点击顶部区域，返回组队主界面');
      this.exitCollaborativePainting();
      return true;
    }
    
    // 其他触摸事件交给主触摸处理器处理（绘画功能）
    if (this.eventHandler.touchHandlers.main) {
      return this.eventHandler.touchHandlers.main.handleTouchStart(x, y);
    }
    
    return false;
  }

  // 生成房间号（Unix时间戳后8位）
  generateRoomNumber() {
    const timestamp = Date.now().toString();
    return timestamp.slice(-8);
  }

  // 获取共同绘画界面按钮区域
  getCollaborativePaintingButtonArea() {
    const buttonWidth = 120;
    const buttonHeight = 44;
    const buttonX = (config.screenWidth - buttonWidth) / 2;
    const buttonY = config.screenHeight - 80;
    
    return {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
  }

  // 处理房间内的"让它游起来"
  async handleMakeItSwimInRoom() {
    console.log('房间内处理"让它游起来"');
    
    // 调用主界面的让它游起来逻辑
    await this.eventHandler.handleMakeItSwim();
  }

  // 退出共同绘画界面
  exitCollaborativePainting() {
    this.currentTeamState = 'main';
    this.eventHandler.isCollaborativePaintingVisible = false;
    this.eventHandler.isTeamInterfaceVisible = true; // 重新显示组队界面
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
  }

  // 搜索房间操作
  async handleSearchRoomAction() {
    console.log('开始搜索房间...');
    
    // 切换到搜索房间界面
    this.currentTeamState = 'searchRoom';
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);

    // 模拟搜索房间过程
    setTimeout(() => {
      console.log('搜索房间完成');
      wx.showToast({
        title: '未找到可用房间',
        icon: 'none',
        duration: 2000
      });
      
      // 返回主界面
      this.eventHandler.hideTeamInterface();
    }, 2000);
  }

  // 检查点是否在矩形内
  isPointInRect(x, y, rect) {
    return x >= rect.x && 
           x <= rect.x + rect.width && 
           y >= rect.y && 
           y <= rect.y + rect.height;
  }

  // 重置状态
  resetState() {
    this.currentTeamState = 'main';
    this.roomNumber = null;
    this.eventHandler.isCollaborativePaintingVisible = false;
  }
}

module.exports = TeamTouchHandler;
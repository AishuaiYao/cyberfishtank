// teamTouchHandler.js - 组队触摸事件处理
const { config } = require('../config.js');

class TeamTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    
    // 当前界面状态
    this.currentTeamState = 'main'; // 'main', 'createRoom', 'searchRoom', 'collaborativePainting'
    
    // 房间号（Unix时间戳后8位）
    this.roomNumber = null;
    
    // 搜索房间输入框内容
    this.searchRoomInput = '';
    
    // 团队界面输入框内容
    this.teamInput = '';
    
    // 房间数据初始化状态
    this.isRoomDataInitialized = false;
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

    // 输入框区域（调整位置避免与按钮重叠）
    const inputBox = {
      x: teamX + 30,
      y: teamY + 70,
      width: teamWidth - 60,
      height: 40
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

    // 检查是否点击了输入框区域
    if (this.isPointInRect(x, y, inputBox)) {
      console.log('点击输入框，弹出键盘');
      this.showKeyboard();
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
    const dialogWidth = 320;
    const dialogHeight = 220;
    const dialogX = (config.screenWidth - dialogWidth) / 2;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 输入框区域
    const inputBox = {
      x: dialogX + 30,
      y: dialogY + 90,
      width: dialogWidth - 60,
      height: 40
    };

    // 搜索按钮区域
    const searchButton = {
      x: dialogX + 30,
      y: dialogY + dialogHeight - 90,
      width: dialogWidth - 60,
      height: 36
    };

    // 取消按钮区域
    const cancelButton = {
      x: dialogX + 30,
      y: dialogY + dialogHeight - 50,
      width: dialogWidth - 60,
      height: 36
    };

    // 检查点击位置
    if (this.isPointInRect(x, y, searchButton)) {
      console.log('点击搜索按钮，搜索房间:', this.searchRoomInput);
      this.handleSearchRoomAction();
      return true;
    }

    if (this.isPointInRect(x, y, cancelButton)) {
      console.log('点击取消按钮，返回主界面');
      this.currentTeamState = 'main';
      this.searchRoomInput = ''; // 清空输入框
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      return true;
    }

    // 检查是否点击了输入框区域
    if (this.isPointInRect(x, y, inputBox)) {
      console.log('点击输入框，弹出键盘');
      this.showKeyboard();
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

    // 如果没有输入房间号，自动生成一个随机房间号
    if (!this.teamInput) {
      this.teamInput = this.generateRoomNumber();
      console.log('自动生成房间号:', this.teamInput);
    }

    // 直接使用用户输入的房间号（无需验证格式）
    this.roomNumber = this.teamInput;
    console.log('使用房间号:', this.roomNumber);

    // 重置房间数据初始化状态
    this.isRoomDataInitialized = false;

    // 切换到共同绘画界面（不先插入数据）
    this.currentTeamState = 'collaborativePainting';
    this.eventHandler.isCollaborativePaintingVisible = true;
    this.eventHandler.isTeamInterfaceVisible = false; // 关闭组队界面
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);

    wx.showToast({
      title: '房间创建成功',
      icon: 'success',
      duration: 1500
    });

    // 延迟插入数据，确保UI已更新
    setTimeout(async () => {
      // 获取用户openid
      let userOpenid;
      try {
        userOpenid = await this.eventHandler.getRealUserOpenid();
        if (!userOpenid) {
          throw new Error('无法获取用户openid');
        }
      } catch (error) {
        console.error('获取用户openid失败:', error);
        wx.showToast({
          title: '初始化房间失败',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      // 向drawing集合插入两条数据
      try {
        const success = await this.eventHandler.databaseManager.createInitialDrawingData(this.roomNumber, userOpenid);
        if (!success) {
          throw new Error('创建房间绘画数据失败');
        }
        console.log('房间绘画数据创建成功');
        // 标记房间数据已初始化
        this.isRoomDataInitialized = true;
        // 数据插入完成后，重新绘制界面以显示等待状态更新
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
      } catch (error) {
        console.error('创建房间绘画数据失败:', error);
        wx.showToast({
          title: '初始化房间失败',
          icon: 'none',
          duration: 1500
        });
      }
    }, 500); // 延迟500ms确保UI已完全更新
  }

  // 处理共同绘画界面触摸
  handleCollaborativePaintingTouch(x, y) {
    console.log('共同绘画界面触摸:', x, y);

    // 检查是否点击了左上角返回按钮
    const backButtonArea = {
      x: 20,
      y: 40,
      width: 50,
      height: 30
    };

    if (this.isPointInRect(x, y, backButtonArea)) {
      console.log('点击返回按钮，返回组队主界面');
      this.exitCollaborativePainting();
      return true;
    }

    // 检查是否点击了"让它游起来"按钮
    const buttonArea = this.getCollaborativePaintingButtonArea();
    if (this.isPointInRect(x, y, buttonArea)) {
      console.log('点击"让它游起来"按钮');
      this.handleMakeItSwimInRoom();
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
    const positions = require('../config.js').getAreaPositions();
    const { config } = require('../config.js');
    const jumpAreaY = positions.jumpAreaY;
    const buttonWidth = (config.screenWidth - 50) / 3; // 与UI绘制保持一致
    const buttonX = (config.screenWidth - buttonWidth) / 2; // 居中显示
    
    return {
      x: buttonX,
      y: jumpAreaY + 13, // 与UI绘制保持一致
      width: buttonWidth - 10, // 与UI绘制保持一致
      height: config.buttonHeight // 使用配置中的按钮高度
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
    this.eventHandler.isTeamInterfaceVisible = false; // 直接返回到主界面，不显示组队界面
    this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
  }

  // 显示团队界面输入对话框（模拟键盘输入）
  showTeamInputDialog() {
    wx.showModal({
      title: '',
      content: '',
      editable: true,
      placeholderText: '请输入8位房间号',
      success: (res) => {
        if (res.confirm) {
          // 直接使用用户输入的内容
          const roomNumber = res.content.trim();
          if (roomNumber) {
            this.teamInput = roomNumber;
            console.log('团队界面输入的房间号:', roomNumber);
            // 重新绘制界面以显示输入内容
            this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
          }
        }
      }
    });
  }

  // 显示搜索房间输入对话框（模拟键盘输入）
  showInputDialog() {
    wx.showModal({
      title: '',
      content: '',
      editable: true,
      placeholderText: '请输入8位房间号',
      success: (res) => {
        if (res.confirm) {
          // 直接使用用户输入的内容
          const roomNumber = res.content.trim();
          if (roomNumber) {
            this.searchRoomInput = roomNumber;
            console.log('搜索房间输入的房间号:', roomNumber);
            // 重新绘制界面以显示输入内容
            this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
          }
        }
      }
    });
  }

  // 验证房间号格式
  validateRoomNumber(roomNumber) {
    if (!roomNumber || roomNumber.length !== 8) {
      return false;
    }
    // 检查是否为纯数字
    return /^\d{8}$/.test(roomNumber);
  }

  // 搜索房间操作
  async handleSearchRoomAction() {
    console.log('开始搜索房间...');

    // 检查是否输入了房间号
    if (!this.searchRoomInput) {
      return;
    }

    // 直接使用用户输入的房间号（无需验证格式）

    // 模拟搜索房间过程
    wx.showLoading({
      title: '搜索房间中...',
    });

    setTimeout(() => {
      wx.hideLoading();

      // 模拟房间存在性检查
      const roomExists = this.checkRoomExists(this.searchRoomInput);

      if (roomExists) {
        console.log('找到房间，进入房间:', this.searchRoomInput);
        this.roomNumber = this.searchRoomInput;

        // 切换到共同绘画界面
        this.currentTeamState = 'collaborativePainting';
        this.eventHandler.isCollaborativePaintingVisible = true;
        this.eventHandler.isTeamInterfaceVisible = false;
        this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);

        wx.showToast({
          title: '成功进入房间',
          icon: 'success',
          duration: 1500
        });
      } else {
        console.log('房间不存在:', this.searchRoomInput);
        wx.showToast({
          title: '没有这个房间',
          icon: 'none',
          duration: 2000
        });
      }
    }, 1500);
  }

  // 检查房间是否存在（模拟实现）
  checkRoomExists(roomNumber) {
    // 这里应该是真实的房间存在性检查逻辑
    // 目前模拟实现：随机决定房间是否存在（50%概率存在）
    // 实际项目中应该调用云函数检查房间状态
    return Math.random() > 0.5;
  }

  // 检查点是否在矩形内
  isPointInRect(x, y, rect) {
    return x >= rect.x &&
           x <= rect.x + rect.width &&
           y >= rect.y &&
           y <= rect.y + rect.height;
  }

  // 显示键盘（主界面输入框）
  showKeyboard() {
    console.log('显示键盘');
    const currentInput = this.teamInput || '';

    // 使用微信小程序的键盘控制API
    wx.showKeyboard({
      defaultValue: currentInput,
      maxLength: 8,
      multiple: false,
      confirmHold: false,
      confirmType: 'done'
    });

    // 先移除之前的监听器，避免重复绑定
    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();

    // 监听键盘确认事件
    wx.onKeyboardConfirm((res) => {
      console.log('键盘确认，输入内容:', res.value);
      this.teamInput = res.value;

      // 重新绘制界面
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);

      // 隐藏键盘
      wx.hideKeyboard();
    });

    // 监听键盘输入事件
    wx.onKeyboardInput((res) => {
      console.log('键盘输入:', res.value);
      this.teamInput = res.value;

      // 实时更新界面显示
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
    });

    // 监听键盘完成事件
    wx.onKeyboardComplete((res) => {
      console.log('键盘完成');
      wx.hideKeyboard();
    });
  }

  // 显示搜索房间键盘
  showSearchRoomKeyboard() {
    console.log('显示搜索房间键盘');
    const currentInput = this.searchRoomInput || '';

    // 使用微信小程序的键盘控制API
    wx.showKeyboard({
      defaultValue: currentInput,
      maxLength: 8,
      multiple: false,
      confirmHold: false,
      confirmType: 'done'
    });

    // 先移除之前的监听器，避免重复绑定
    wx.offKeyboardInput();
    wx.offKeyboardConfirm();
    wx.offKeyboardComplete();

    // 监听键盘确认事件
    wx.onKeyboardConfirm((res) => {
      console.log('键盘确认，输入内容:', res.value);
      this.searchRoomInput = res.value;

      // 重新绘制界面
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);

      // 隐藏键盘
      wx.hideKeyboard();
    });

    // 监听键盘输入事件
    wx.onKeyboardInput((res) => {
      console.log('键盘输入:', res.value);
      this.searchRoomInput = res.value;

      // 实时更新界面显示
      this.eventHandler.uiManager.drawGameUI(this.eventHandler.gameState);
    });

    // 监听键盘完成事件
    wx.onKeyboardComplete((res) => {
      console.log('键盘完成');
      wx.hideKeyboard();
    });
  }

  // 重置状态
  resetState() {
    this.currentTeamState = 'main';
    this.roomNumber = null;
    this.eventHandler.isCollaborativePaintingVisible = false;
  }
}

module.exports = TeamTouchHandler;
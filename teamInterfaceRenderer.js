// teamInterfaceRenderer.js - 组队界面绘制逻辑
const Utils = require('./utils.js');
const { config } = require('./config.js');

class TeamInterfaceRenderer {
  constructor(ctx, pixelRatio = 1) {
    this.ctx = ctx;
    this.pixelRatio = pixelRatio;
  }

  // 获取搜索房间输入内容
  getSearchRoomInput() {
    // 这里需要从事件处理器中获取输入内容
    // 在实际项目中，应该通过事件处理器传递输入内容
    if (typeof window !== 'undefined' && window.eventHandler) {
      return window.eventHandler.touchHandlers.team?.searchRoomInput || '';
    }
    return '';
  }

  // 获取团队界面输入内容
  getTeamInput() {
    // 这里需要从事件处理器中获取输入内容
    // 在实际项目中，应该通过事件处理器传递输入内容
    if (typeof window !== 'undefined' && window.eventHandler) {
      return window.eventHandler.touchHandlers.team?.teamInput || '';
    }
    return '';
  }

  // 绘制组队界面
  drawTeamInterface() {
    const ctx = this.ctx;
    
    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 计算组队界面位置（居中）
    const teamWidth = config.team.teamInterface.width;
    const teamHeight = config.team.teamInterface.height;
    const teamX = (config.screenWidth - teamWidth) / 2;
    const teamY = (config.screenHeight - teamHeight) / 2;

    // 绘制组队界面卡片
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    Utils.drawCard(ctx, teamX, teamY, teamWidth, teamHeight, config.team.teamInterface.borderRadius);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 20px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('共同绘画', teamX + teamWidth / 2, teamY + 50);

    // 绘制输入框背景（调整位置，避免与按钮重叠）
    const inputBoxY = teamY + 70;
    ctx.fillStyle = '#F8F9FA';
    Utils.drawRoundedRect(ctx, teamX + 30, inputBoxY, teamWidth - 60, 45, 8, true, false);
    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, teamX + 30, inputBoxY, teamWidth - 60, 45, 8, false, true);

    // 绘制按钮
    const buttonWidth = config.team.teamInterface.buttonWidth;
    const buttonHeight = config.team.teamInterface.buttonHeight;
    const buttonY = teamY + teamHeight - buttonHeight - 30;
    const buttonSpacing = 20;
    const totalButtonWidth = buttonWidth * 2 + buttonSpacing;
    const startX = teamX + (teamWidth - totalButtonWidth) / 2;

    // 建立房间按钮
    Utils.drawModernButton(ctx, startX, buttonY, buttonWidth, buttonHeight, '建立房间', false, true);

    // 搜索房间按钮
    Utils.drawModernButton(ctx, startX + buttonWidth + buttonSpacing, buttonY, buttonWidth, buttonHeight, '搜索房间', false, false);

    // 绘制输入文本
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    
    // 获取输入的房间号
    const teamInput = this.getTeamInput();
    const displayText = teamInput || '点击输入房间号';
    const textColor = teamInput ? config.textColor : config.lightTextColor;
    
    ctx.fillStyle = textColor;
    ctx.fillText(displayText, teamX + 40, inputBoxY + 25);

    ctx.textAlign = 'left';
  }

  // 绘制建立房间界面
  drawCreateRoomInterface() {
    const ctx = this.ctx;
    
    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 计算界面位置（居中）
    const dialogWidth = 280;
    const dialogHeight = 180;
    const dialogX = (config.screenWidth - dialogWidth) / 2;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 绘制对话框卡片
    Utils.drawCard(ctx, dialogX, dialogY, dialogWidth, dialogHeight, 12);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('建立房间', dialogX + dialogWidth / 2, dialogY + 40);

    // 绘制提示文字
    ctx.fillStyle = config.lightTextColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('房间创建中...', dialogX + dialogWidth / 2, dialogY + 80);

    // 绘制取消按钮
    Utils.drawModernButton(ctx, dialogX + 60, dialogY + dialogHeight - 50, dialogWidth - 120, 36, '取消', false, false);

    ctx.textAlign = 'left';
  }

  // 绘制搜索房间界面
  drawSearchRoomInterface() {
    const ctx = this.ctx;
    
    // 绘制半透明背景遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, config.screenWidth, config.screenHeight);

    // 计算界面位置（居中）
    const dialogWidth = 320;
    const dialogHeight = 220;
    const dialogX = (config.screenWidth - dialogWidth) / 2;
    const dialogY = (config.screenHeight - dialogHeight) / 2;

    // 绘制对话框卡片
    Utils.drawCard(ctx, dialogX, dialogY, dialogWidth, dialogHeight, 12);

    // 绘制标题
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 18px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('搜索房间', dialogX + dialogWidth / 2, dialogY + 40);

    // 绘制输入框标签
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('房间号:', dialogX + 30, dialogY + 75);

    // 绘制输入框背景
    ctx.fillStyle = '#F8F9FA';
    Utils.drawRoundedRect(ctx, dialogX + 30, dialogY + 90, dialogWidth - 60, 40, 8, true, false);
    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    Utils.drawRoundedRect(ctx, dialogX + 30, dialogY + 90, dialogWidth - 60, 40, 8, false, true);

    // 绘制输入文本
    ctx.fillStyle = config.textColor;
    ctx.font = 'bold 16px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    
    // 获取输入的房间号
    const searchRoomInput = this.getSearchRoomInput();
    const displayText = searchRoomInput || '点击输入房间号';
    const textColor = searchRoomInput ? config.textColor : config.lightTextColor;
    
    ctx.fillStyle = textColor;
    ctx.fillText(displayText, dialogX + 40, dialogY + 115);

    // 绘制搜索按钮
    Utils.drawModernButton(ctx, dialogX + 30, dialogY + dialogHeight - 90, dialogWidth - 60, 36, '搜索房间', false, true);

    // 绘制取消按钮
    Utils.drawModernButton(ctx, dialogX + 30, dialogY + dialogHeight - 50, dialogWidth - 60, 36, '取消', false, false);

    ctx.textAlign = 'left';
  }
}

module.exports = TeamInterfaceRenderer;
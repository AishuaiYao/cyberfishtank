
// utils.js - 公共工具方法
class Utils {
  // 绘制圆角矩形 - 优化绘制质量
  static drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
    // 确保坐标为整数，避免亚像素渲染模糊
    x = Math.round(x);
    y = Math.round(y);
    width = Math.round(width);
    height = Math.round(height);
    radius = Math.round(radius);

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

  static drawModernButton(ctx, x, y, width, height, text, isActive = false, isPrimary = false, isDisabled = false, isIconOnly = false) {
    const { config } = require('./config.js');

    // 确保坐标为整数
    x = Math.round(x);
    y = Math.round(y);
    width = Math.round(width);
    height = Math.round(height);

    // 如果是图标按钮且不处于激活状态，不绘制背景和边框
    if (isIconOnly && !isActive && !isDisabled) {
      // 只绘制文本/图标，没有背景和边框
      ctx.fillStyle = isDisabled ? '#C7C7CC' : config.primaryColor;
      // 修改这里：将刷新按钮的图标字体大小从16px改为24px
      ctx.font = 'bold 24px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textX = Math.round(x + width / 2);
      const textY = Math.round(y + height / 2);

      ctx.fillText(text, textX, textY);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      return;
    }

    // 原有逻辑保持不变
    let fillColor, textColor, borderColor;

    if (isDisabled) {
      fillColor = '#F8F9FA';
      textColor = '#C7C7CC';
      borderColor = '#E5E5EA';
    } else if (isActive) {
      fillColor = config.primaryColor;
      textColor = '#FFFFFF';
      borderColor = config.primaryColor;
    } else if (isPrimary) {
      fillColor = config.primaryColor;
      textColor = '#FFFFFF';
      borderColor = config.primaryColor;
    } else {
      fillColor = '#FFFFFF';
      textColor = config.textColor;
      borderColor = config.borderColor;
    }

    ctx.fillStyle = fillColor;
    this.drawRoundedRect(ctx, x, y, width, height, config.borderRadius, true, false);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isActive ? 0 : 1;
    this.drawRoundedRect(ctx, x, y, width, height, config.borderRadius, false, true);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = Math.round(x + width / 2);
    const textY = Math.round(y + height / 2);

    ctx.fillText(text, textX, textY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // 绘制卡片 - 优化阴影效果
  static drawCard(ctx, x, y, width, height, radius = 12) {
    const { config } = require('./config.js');

    // 确保坐标为整数
    x = Math.round(x);
    y = Math.round(y);
    width = Math.round(width);
    height = Math.round(height);

    // 使用更清晰的阴影
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#FFFFFF';
    this.drawRoundedRect(ctx, x, y, width, height, radius, true, false);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.strokeStyle = config.borderColor;
    ctx.lineWidth = 1;
    this.drawRoundedRect(ctx, x, y, width, height, radius, false, true);
  }

  // 根据评分获取颜色
  static getScoreColor(score) {
    if (score >= 80) return '#4CD964';
    if (score >= 60) return '#FFCC00';
    if (score >= 40) return '#FF9500';
    return '#FF3B30';
  }

  // 格式化时间
  static formatTime(date) {
    if (!date) return '未知时间';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  // 截断文本
  static truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // 通用洗牌算法
  static shuffleArray(array) {
    const shuffled = [...array];
    // Fisher-Yates洗牌算法
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 通用Toast消息函数
  static showToast(title, icon = 'none', duration = 1500) {
    wx.showToast({
      title: title,
      icon: icon,
      duration: duration
    });
  }

  // 显示成功消息
  static showSuccess(title, duration = 1500) {
    this.showToast(title, 'success', duration);
  }

  // 显示错误消息
  static showError(title, duration = 1500) {
    this.showToast(title, 'none', duration);
  }

  // 通用日志处理函数 - 减少重复的日志代码
  static _logMessage(type, message, context = '') {
    const logFunctions = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      log: console.log
    };
    
    const logFunction = logFunctions[type] || console.log;
    
    if (context) {
      logFunction(`${context}:`, message);
    } else {
      logFunction(message);
    }
  }

  // 通用错误处理函数 - 减少重复的错误处理代码
  static handleError(error, context = '') {
    this._logMessage('error', error, context ? `${context}失败` : '操作失败');
  }

  // 通用警告处理函数
  static handleWarning(warning, context = '') {
    this._logMessage('warn', warning, context);
  }

  // 数据库操作的通用错误处理 - 减少重复的错误检查和处理
  static handleDatabaseError(error, operation, returnOnError = null) {
    this.handleError(error, operation);
    return returnOnError;
  }

  // 数据库初始化检查 - 减少重复的初始化检查代码
  static checkDatabaseInitialization(dbManager, operation) {
    if (!dbManager.isCloudDbInitialized || !dbManager.cloudDb) {
      this.handleWarning('云数据库未初始化', `${operation}`);
      return false;
    }
    return true;
  }
}

module.exports = Utils;
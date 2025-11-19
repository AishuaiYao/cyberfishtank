// utils.js - 公共工具方法
class Utils {
  // 绘制圆角矩形
  static drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
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

    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // 绘制现代按钮
  static drawModernButton(ctx, x, y, width, height, text, isActive = false, isPrimary = false) {
    const { config } = require('./config.js');
    
    ctx.fillStyle = isActive ? config.primaryColor :
                    isPrimary ? config.primaryColor : '#FFFFFF';
    this.drawRoundedRect(ctx, x, y, width, height, config.borderRadius, true, false);

    ctx.strokeStyle = isActive ? config.primaryColor : config.borderColor;
    ctx.lineWidth = isActive ? 0 : 1;
    this.drawRoundedRect(ctx, x, y, width, height, config.borderRadius, false, true);

    ctx.fillStyle = isActive ? '#FFFFFF' :
                    isPrimary ? '#FFFFFF' : config.textColor;
    ctx.font = '15px -apple-system, "PingFang SC", "Helvetica Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);
    ctx.textAlign = 'left';
  }

  // 绘制卡片
  static drawCard(ctx, x, y, width, height, radius = 12) {
    const { config } = require('./config.js');

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = config.shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

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
}

module.exports = Utils;
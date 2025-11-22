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

  // 绘制现代按钮 - 优化文本渲染
  static drawModernButton(ctx, x, y, width, height, text, isActive = false, isPrimary = false) {
    const { config } = require('./config.js');

    // 确保坐标为整数
    x = Math.round(x);
    y = Math.round(y);
    width = Math.round(width);
    height = Math.round(height);

    ctx.fillStyle = isActive ? config.primaryColor :
                    isPrimary ? config.primaryColor : '#FFFFFF';
    this.drawRoundedRect(ctx, x, y, width, height, config.borderRadius, true, false);

    ctx.strokeStyle = isActive ? config.primaryColor : config.borderColor;
    ctx.lineWidth = isActive ? 0 : 1;
    this.drawRoundedRect(ctx, x, y, width, height, config.borderRadius, false, true);

    // 优化文本渲染
    ctx.fillStyle = isActive ? '#FFFFFF' :
                    isPrimary ? '#FFFFFF' : config.textColor;
    ctx.font = 'bold 14px -apple-system, "PingFang SC", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 确保文本位置为整数
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
}

module.exports = Utils;
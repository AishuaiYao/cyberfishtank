// fishManager/fishProcessor.js - 鱼图像处理
class FishProcessor {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 处理鱼图像
  async processFishImage() {
    try {
      wx.showLoading({ title: '处理中...', mask: true });

      const boundingBox = this.calculateBoundingBox();
      if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) {
        throw new Error('无法计算有效的外接矩形');
      }

      const subImage = await this.cropSubImage(boundingBox);
      const scaledImage = await this.scaleImage(subImage);

      wx.hideLoading();

      this.eventHandler.gameState.scaledFishImage = scaledImage;
      this.eventHandler.showNameInputDialog(scaledImage);

    } catch (error) {
      wx.hideLoading();
      console.error('处理失败:', error);
      wx.showToast({ title: '处理失败，请重试', icon: 'none', duration: 2000 });
    }
  }

  // 计算外接矩形
  calculateBoundingBox() {
    const gameState = this.eventHandler.gameState;
    if (gameState.drawingPaths.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    gameState.drawingPaths.forEach(path => {
      path.points.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      });
    });

    const margin = 5;
    const width = Math.max(0, maxX - minX + margin * 2);
    const height = Math.max(0, maxY - minY + margin * 2);

    return {
      x: Math.max(0, minX - margin),
      y: Math.max(0, minY - margin),
      width: Math.min(width, this.eventHandler.canvas.width - (minX - margin)),
      height: Math.min(height, this.eventHandler.canvas.height - (minY - margin))
    };
  }

  // 裁剪子图像
  cropSubImage(boundingBox) {
    return new Promise((resolve, reject) => {
      try {
        const ctx = this.eventHandler.canvas.getContext('2d');
        const imageData = ctx.getImageData(
          boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height
        );

        const tempCanvas = wx.createCanvas();
        tempCanvas.width = boundingBox.width;
        tempCanvas.height = boundingBox.height;

        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        resolve({ canvas: tempCanvas, width: boundingBox.width, height: boundingBox.height });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 缩放图像
  scaleImage(subImage) {
    return new Promise((resolve, reject) => {
      try {
        const { width, height } = subImage;
        const targetSize = 80;
        const isWidthLonger = width >= height;
        const scale = isWidthLonger ? targetSize / width : targetSize / height;

        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);

        const scaledCanvas = wx.createCanvas();
        scaledCanvas.width = scaledWidth;
        scaledCanvas.height = scaledHeight;

        const scaledCtx = scaledCanvas.getContext('2d');
        scaledCtx.drawImage(subImage.canvas, 0, 0, width, height, 0, 0, scaledWidth, scaledHeight);

        resolve({ canvas: scaledCanvas, width: scaledWidth, height: scaledHeight, scale: scale });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = FishProcessor;
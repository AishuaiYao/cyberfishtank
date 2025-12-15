const { config } = require('../config.js');

// fishManager/fishProcessor.js - 修复边界计算，排除边框区域，添加翻转支持
class FishProcessor {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.pixelRatio = this.getPixelRatio();
  }

  // 获取像素比
  getPixelRatio() {
    const systemInfo = wx.getSystemInfoSync();
    return systemInfo.pixelRatio || 1;
  }

  async processFishImage() {
    try {
      wx.showLoading({ title: '处理中...', mask: true });

      // 使用修复后的边界计算，排除边框区域
      const boundingBox = this.calculateScaledBoundingBox();
      if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) {
        throw new Error('无法计算有效的外接矩形');
      }

      console.log('计算出的边界框:', boundingBox);

      const subImage = await this.cropWithCorrectScaling(boundingBox);

      // 修改：由于翻转是瞬时操作，路径坐标已经修改，直接使用裁剪的图像
      const finalImage = subImage;

      const scaledImage = await this.scaleImageWithOriginalLogic(finalImage);

      wx.hideLoading();

      this.eventHandler.gameState.scaledFishImage = scaledImage;
      this.eventHandler.showNameInputDialog(scaledImage);

    } catch (error) {
      wx.hideLoading();
      const Utils = require('../utils.js');
      Utils.handleError(error, '处理失败');
      Utils.showError('处理失败，请重试', 2000);
    }
  }

  // 新增：翻转图像
  async flipImage(subImage) {
    return new Promise((resolve, reject) => {
      try {
        const flippedCanvas = wx.createCanvas();
        flippedCanvas.width = subImage.width;
        flippedCanvas.height = subImage.height;

        const flippedCtx = flippedCanvas.getContext('2d');

        // 应用水平翻转
        flippedCtx.translate(subImage.width, 0);
        flippedCtx.scale(-1, 1);

        // 绘制翻转后的图像
        flippedCtx.drawImage(subImage.canvas, 0, 0);

        resolve({
          canvas: flippedCanvas,
          width: subImage.width,
          height: subImage.height,
          logicalWidth: subImage.logicalWidth,
          logicalHeight: subImage.logicalHeight
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 修复：边界计算时排除绘制区域的边框
  calculateScaledBoundingBox() {
    const gameState = this.eventHandler.gameState;
    if (gameState.drawingPaths.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // 步骤1: 遍历路径点（这些是逻辑像素坐标）
    gameState.drawingPaths.forEach(path => {
      path.points.forEach(point => {
        // 如果画布被翻转，需要转换坐标
        const actualX = gameState.isFlipped ? config.screenWidth - point.x : point.x;
        minX = Math.min(minX, actualX);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, actualX);
        maxY = Math.max(maxY, point.y);
      });
    });

    console.log('原始边界(逻辑像素):', { minX, minY, maxX, maxY });

    // 修复1: 考虑线条宽度（逻辑像素）
    const maxLineWidth = Math.max(...gameState.drawingPaths.map(p => p.size));
    const lineMargin = maxLineWidth / 2;

    // 修复2: 增加边距，同时排除边框区域
    const margin = 10 + lineMargin;

    // 绘制区域的实际边界（排除边框）
    const drawingAreaLeft = 12;    // 左边框位置
    const drawingAreaTop = this.getDrawingAreaTop(); // 绘制区域顶部位置
    const drawingAreaRight = config.screenWidth - 12;  // 右边框位置
    const drawingAreaBottom = drawingAreaTop + config.drawingAreaHeight; // 底部边框位置

    // 计算逻辑像素边界，确保在绘制区域内
    const logicalX = Math.max(drawingAreaLeft, Math.round(minX - margin));
    const logicalY = Math.max(drawingAreaTop, Math.round(minY - margin));
    const logicalWidth = Math.round(Math.max(0, Math.min(maxX + margin, drawingAreaRight) - logicalX));
    const logicalHeight = Math.round(Math.max(0, Math.min(maxY + margin, drawingAreaBottom) - logicalY));

    console.log('逻辑像素边界:', { logicalX, logicalY, logicalWidth, logicalHeight });

    // 修复3: 转换为物理像素（因为Canvas是物理像素尺寸）
    const physicalX = Math.round(logicalX * this.pixelRatio);
    const physicalY = Math.round(logicalY * this.pixelRatio);
    const physicalWidth = Math.round(logicalWidth * this.pixelRatio);
    const physicalHeight = Math.round(logicalHeight * this.pixelRatio);

    console.log('物理像素边界:', { physicalX, physicalY, physicalWidth, physicalHeight });

    // 修复4: 确保在Canvas物理尺寸范围内
    const canvasPhysicalWidth = this.eventHandler.canvas.width;
    const canvasPhysicalHeight = this.eventHandler.canvas.height;

    const finalPhysicalX = Math.min(physicalX, canvasPhysicalWidth - 1);
    const finalPhysicalY = Math.min(physicalY, canvasPhysicalHeight - 1);
    const finalPhysicalWidth = Math.min(physicalWidth, canvasPhysicalWidth - finalPhysicalX);
    const finalPhysicalHeight = Math.min(physicalHeight, canvasPhysicalHeight - finalPhysicalY);

    if (finalPhysicalWidth <= 0 || finalPhysicalHeight <= 0) {
      console.warn('无效的边界框尺寸');
      return null;
    }

    // 返回物理像素边界（用于Canvas操作）
    return {
      x: finalPhysicalX,
      y: finalPhysicalY,
      width: finalPhysicalWidth,
      height: finalPhysicalHeight,
      logicalX: logicalX,
      logicalY: logicalY,
      logicalWidth: logicalWidth,
      logicalHeight: logicalHeight
    };
  }

  // 新增：获取绘制区域顶部位置
  getDrawingAreaTop() {
    const { getAreaPositions } = require('../config.js');
    const positions = getAreaPositions();
    return positions.drawingAreaY;
  }

  // 修复：使用正确的缩放进行裁剪
  cropWithCorrectScaling(boundingBox) {
    return new Promise((resolve, reject) => {
      try {
        const tempCanvas = wx.createCanvas();
        // 使用物理像素尺寸
        tempCanvas.width = boundingBox.width;
        tempCanvas.height = boundingBox.height;

        const tempCtx = tempCanvas.getContext('2d');

        // 设置高质量渲染和抗锯齿
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';

        console.log('裁剪参数:', {
          srcX: boundingBox.x,
          srcY: boundingBox.y,
          srcWidth: boundingBox.width,
          srcHeight: boundingBox.height,
          destWidth: tempCanvas.width,
          destHeight: tempCanvas.height
        });

        // 从原Canvas的物理像素区域裁剪
        tempCtx.drawImage(
          this.eventHandler.canvas,
          boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height,
          0, 0, boundingBox.width, boundingBox.height
        );

        resolve({
          canvas: tempCanvas,
          width: boundingBox.width,
          height: boundingBox.height,
          logicalWidth: boundingBox.logicalWidth,
          logicalHeight: boundingBox.logicalHeight
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // 改进的缩放逻辑 - 多步缩放减少锯齿
  scaleImageWithOriginalLogic(subImage) {
    return new Promise((resolve, reject) => {
      try {
        const { width, height } = subImage;
        const targetSize = 80;

        console.log('缩放前尺寸:', { width, height });

        // 判断宽高哪个更长
        const isWidthLonger = width >= height;

        // 按最长边计算缩放比例
        const scale = isWidthLonger ? targetSize / width : targetSize / height;

        // 计算缩放后的尺寸
        const scaledWidth = Math.round(width * scale);
        const scaledHeight = Math.round(height * scale);

        console.log('缩放参数:', {
          isWidthLonger,
          scale,
          scaledWidth,
          scaledHeight,
          targetSize
        });

        // 多步缩放减少锯齿
        let currentCanvas = subImage.canvas;
        let currentWidth = width;
        let currentHeight = height;

        // 如果缩放比例小于0.5，则分多步缩放
        const maxStepScale = 0.7; // 每次最多缩放70%
        if (scale < maxStepScale) {
          const steps = Math.ceil(Math.log(scale) / Math.log(maxStepScale));
          
          for (let i = 0; i < steps - 1; i++) {
            const stepScale = Math.min(maxStepScale, Math.pow(scale, (i + 1) / steps));
            const stepWidth = Math.round(width * stepScale);
            const stepHeight = Math.round(height * stepScale);
            
            const stepCanvas = wx.createCanvas();
            stepCanvas.width = stepWidth;
            stepCanvas.height = stepHeight;
            
            const stepCtx = stepCanvas.getContext('2d');
            stepCtx.imageSmoothingEnabled = true;
            stepCtx.imageSmoothingQuality = 'high';
            
            stepCtx.drawImage(
              currentCanvas,
              0, 0, currentWidth, currentHeight,
              0, 0, stepWidth, stepHeight
            );
            
            currentCanvas = stepCanvas;
            currentWidth = stepWidth;
            currentHeight = stepHeight;
          }
        }

        // 最后一步缩放到目标尺寸
        const finalCanvas = wx.createCanvas();
        finalCanvas.width = scaledWidth;
        finalCanvas.height = scaledHeight;

        const finalCtx = finalCanvas.getContext('2d');
        finalCtx.imageSmoothingEnabled = true;
        finalCtx.imageSmoothingQuality = 'high';

        // 应用边缘羽化
        finalCtx.filter = 'blur(0.3px)';

        finalCtx.drawImage(
          currentCanvas,
          0, 0, currentWidth, currentHeight,
          0, 0, scaledWidth, scaledHeight
        );

        console.log('缩放完成:', {
          original: { width, height },
          scaled: { width: scaledWidth, height: scaledHeight }
        });

        resolve({
          canvas: finalCanvas,
          width: scaledWidth,
          height: scaledHeight,
          scale: scale
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = FishProcessor;
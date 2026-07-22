// fishManager/fishDataManager.js - 精简版：纯本地数据处理
const { Fish } = require('../fishCore.js');

class FishDataManager {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 从本地存储数据创建鱼对象（新方法，替代 createFishFromDatabaseData）
  async createFishFromLocalData(fishData) {
    try {
      if (!fishData.base64) {
        console.warn('鱼数据没有base64字段，跳过创建');
        return null;
      }

      const fishName = fishData.fishName || `本地鱼_${Date.now()}`;
      console.log(`为鱼 "${fishName}" 创建图像...`);

      // Check if already in tank
      if (this.eventHandler.addedFishNames && this.eventHandler.addedFishNames.has(fishName)) {
        console.log(`鱼 "${fishName}" 已存在于鱼缸中，跳过创建`);
        return null;
      }

      const fishImage = await this.base64ToCanvas(fishData.base64);

      const fish = new Fish(
        fishImage.canvas,
        Math.random() * (this.eventHandler.canvas.width - fishImage.width),
        Math.random() * (this.eventHandler.canvas.height - fishImage.height),
        Math.random() < 0.5 ? -1 : 1,
        fishName,
        fishData
      );

      console.log(`成功创建本地鱼: ${fish.name}`);
      return fish;
    } catch (error) {
      console.error('从本地数据创建鱼对象失败:', error);
      return null;
    }
  }

  // base64转canvas
  base64ToCanvas(base64Data) {
    return new Promise((resolve, reject) => {
      try {
        const image = wx.createImage();

        image.onload = () => {
          const canvas = wx.createCanvas();
          canvas.width = image.width;
          canvas.height = image.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);

          resolve({
            canvas: canvas,
            width: image.width,
            height: image.height
          });
        };

        image.onerror = (error) => {
          reject(new Error('图片加载失败: ' + error));
        };

        const base64WithPrefix = `data:image/png;base64,${base64Data}`;
        image.src = base64WithPrefix;

      } catch (error) {
        reject(error);
      }
    });
  }

  // canvas转base64（添加透明背景处理）
  canvasToBase64(canvas) {
    return new Promise((resolve, reject) => {
      try {
        const processedCanvas = this.createTransparentImage(canvas);
        const base64 = processedCanvas.toDataURL();
        const pureBase64 = base64.split(',')[1];
        resolve(pureBase64);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 创建透明背景的图像
  createTransparentImage(originalCanvas) {
    const tempCanvas = wx.createCanvas();
    tempCanvas.width = originalCanvas.width;
    tempCanvas.height = originalCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(originalCanvas, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 将白色及接近白色的像素设为透明，避免抗锯齿边缘在深色背景上形成光晕
      if (r > 220 && g > 220 && b > 220) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    return tempCanvas;
  }
}

module.exports = FishDataManager;

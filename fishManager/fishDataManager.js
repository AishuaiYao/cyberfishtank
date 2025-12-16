// fishManager/fishDataManager.js - 修复 Fish 类导入问题
const { Fish } = require('../fishCore.js');

class FishDataManager {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
  }

  // 从数据库数据创建鱼对象
  async createFishFromDatabaseData(fishData) {
    try {
      if (!fishData.base64) {
        console.warn('鱼数据没有base64字段，跳过创建');
        return null;
      }

      console.log(`为鱼 "${fishData.fishName || fishData.fishid || '未命名'}" 创建图像...`);

      const fishImage = await this.base64ToCanvas(fishData.base64);

      // 检查鱼缸中是否已存在同名鱼（串门模式下允许重复）
      const fishName = fishData.fishName || fishData.fishid || `数据库鱼_${Date.now()}`;
      // 在串门模式下不检查重复，因为串门是独立的鱼缸
      // if (this.eventHandler.isFishAlreadyInTank(fishName)) {
      //   console.log(`鱼 "${fishName}" 已存在于鱼缸中，跳过创建`);
      //   return null;
      // }

      // 使用导入的 Fish 类
      // 注意：Fish类内部会处理缩放，所以这里直接传入canvas对象
      const fish = new Fish(
        fishImage.canvas,
        Math.random() * (this.eventHandler.canvas.width - 80), // 使用缩放后的宽度
        Math.random() * (this.eventHandler.canvas.height - fishImage.height), // 高度会在Fish类中缩放
        Math.random() < 0.5 ? -1 : 1,
        fishName,
        fishData
      );

      console.log(`成功创建鱼: ${fish.name}`);
      return fish;
    } catch (error) {
      console.error('从数据库数据创建鱼对象失败:', error);
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
        // 先处理透明背景，再转base64
        const processedCanvas = this.createTransparentImage(canvas);
        const base64 = processedCanvas.toDataURL();
        const pureBase64 = base64.split(',')[1];
        resolve(pureBase64);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 创建透明背景的图像（从Fish类移动到这里）
  createTransparentImage(originalCanvas) {
    const tempCanvas = wx.createCanvas();
    tempCanvas.width = originalCanvas.width;
    tempCanvas.height = originalCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');

    // 复制原图像
    tempCtx.drawImage(originalCanvas, 0, 0);

    // 获取像素数据并处理透明度
    const imageData = tempCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 将纯白色像素设为透明
      if (r === 255 && g === 255 && b === 255) {
        data[i + 3] = 0;
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    return tempCanvas;
  }

  // 修改：不再需要此方法，由eventHandler统一管理
  async loadAndShowDatabaseFishes(targetFishName = null) {
    console.warn('此方法已弃用，请使用eventHandler的全局鱼列表管理');
    return [];
  }

  // 新增：根据鱼名查询特定鱼
  async getFishByName(fishName) {
    if (!this.eventHandler.databaseManager.isCloudDbInitialized ||
        !this.eventHandler.databaseManager.cloudDb) {
      console.warn('云数据库未初始化，无法查询特定鱼');
      return null;
    }

    try {
      console.log(`查询鱼: ${fishName}`);
      const result = await this.eventHandler.databaseManager.cloudDb.collection('fishes')
        .where({
          fishName: fishName
        })
        .get();

      if (result.data.length > 0) {
        console.log(`找到鱼 "${fishName}"`);
        return result.data[0];
      } else {
        console.log(`未找到鱼 "${fishName}"`);
        return null;
      }
    } catch (error) {
      console.error(`查询鱼 "${fishName}" 失败:`, error);
      return null;
    }
  }
}

module.exports = FishDataManager;
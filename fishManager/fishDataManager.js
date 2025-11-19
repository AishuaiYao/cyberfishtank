// fishManager/fishDataManager.js - 修复 Fish 类导入问题
const { Fish } = require('../fishManager.js');

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

      // 使用导入的 Fish 类
      const fish = new Fish(
        fishImage.canvas,
        Math.random() * (this.eventHandler.canvas.width - fishImage.width),
        Math.random() * (this.eventHandler.canvas.height - fishImage.height),
        Math.random() < 0.5 ? -1 : 1,
        fishData.fishName || fishData.fishid || `数据库鱼_${Date.now()}`,
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

  // canvas转base64
  canvasToBase64(canvas) {
    return new Promise((resolve, reject) => {
      try {
        const base64 = canvas.toDataURL();
        const pureBase64 = base64.split(',')[1];
        resolve(pureBase64);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 加载并显示数据库中的鱼
  async loadAndShowDatabaseFishes() {
    if (this.eventHandler.isLoadingDatabaseFishes) {
      console.log('正在加载数据库鱼数据，请稍候...');
      return;
    }

    this.eventHandler.isLoadingDatabaseFishes = true;

    try {
      console.log('开始加载数据库中的鱼...');
      wx.showLoading({ title: '加载鱼缸中...', mask: true });

      const databaseFishes = await this.eventHandler.databaseManager.getRandomFishesFromDatabase(20);

      if (databaseFishes.length === 0) {
        console.log('没有从数据库获取到鱼数据');
        wx.hideLoading();
        this.eventHandler.isLoadingDatabaseFishes = false;
        return;
      }

      console.log(`开始创建 ${databaseFishes.length} 条数据库鱼...`);

      const fishCreationPromises = databaseFishes.map(fishData =>
        this.createFishFromDatabaseData(fishData)
      );

      const createdFishes = await Promise.all(fishCreationPromises);
      const validFishes = createdFishes.filter(fish => fish !== null);

      console.log(`成功创建 ${validFishes.length} 条数据库鱼`);

      validFishes.forEach(fish => {
        this.eventHandler.fishTank.addFish(fish);
      });

      this.eventHandler.databaseFishes = validFishes;

      wx.hideLoading();

      if (validFishes.length > 0) {
        wx.showToast({
          title: `已加载 ${validFishes.length} 条鱼`,
          icon: 'success',
          duration: 1500
        });
      }

    } catch (error) {
      console.error('加载数据库鱼数据失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '加载鱼缸数据失败',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.eventHandler.isLoadingDatabaseFishes = false;
    }
  }
}

module.exports = FishDataManager;
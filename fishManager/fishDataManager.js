// fishManager/fishDataManager.js - 修复数据库鱼重复加载和显示问题
const { Fish } = require('../fishCore.js');

class FishDataManager {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.currentLoadingSession = null;
    this.loadedFishIds = new Set(); // 记录已加载的鱼ID
  }

  // 从数据库数据创建鱼对象
  async createFishFromDatabaseData(fishData) {
    try {
      if (!fishData.base64) {
        console.warn('鱼数据没有base64字段，跳过创建');
        return null;
      }

      // 检查是否已经加载过这条鱼
      const fishId = fishData._id || fishData.fishid;
      if (fishId && this.loadedFishIds.has(fishId)) {
        console.log(`鱼 "${fishData.fishName}" (ID: ${fishId}) 已经加载过，跳过`);
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

      // 记录已加载的鱼ID
      if (fishId) {
        this.loadedFishIds.add(fishId);
      }

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

  // 加载并显示数据库中的鱼 - 修复重复加载和添加到鱼缸的问题
  async loadAndShowDatabaseFishes() {
    // 防止重复加载
    if (this.eventHandler.isLoadingDatabaseFishes) {
      console.log('正在加载数据库鱼数据，请稍候...');
      return;
    }

    // 使用会话ID来跟踪当前加载
    const currentSession = Date.now();
    this.currentLoadingSession = currentSession;

    this.eventHandler.isLoadingDatabaseFishes = true;

    try {
      console.log('开始加载数据库中的鱼...');
      wx.showLoading({ title: '加载鱼缸中...', mask: true });

      const databaseFishes = await this.eventHandler.databaseManager.getRandomFishesFromDatabase(20);

      // 检查是否仍然是当前会话
      if (this.currentLoadingSession !== currentSession) {
        console.log('加载会话已过期，跳过处理');
        return;
      }

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

      // 再次检查会话
      if (this.currentLoadingSession !== currentSession) {
        console.log('加载会话已过期，跳过添加鱼');
        return;
      }

      const validFishes = createdFishes.filter(fish => fish !== null);

      console.log(`成功创建 ${validFishes.length} 条数据库鱼`);

      // 关键修复：确保数据库鱼被正确添加到鱼缸
      let addedCount = 0;
      validFishes.forEach(fish => {
        // 检查是否已经存在（双重检查）
        const existingFish = this.eventHandler.databaseFishes.find(
          existing => existing.name === fish.name && existing.fishData?._id === fish.fishData?._id
        );

        if (!existingFish) {
          this.eventHandler.databaseFishes.push(fish);
          console.log(`添加数据库鱼到列表: ${fish.name}`);

          // 关键修复：无论鱼缸是否初始化，都添加到鱼缸
          // 这样确保在 showSwimInterface 中能正确显示所有鱼
          this.eventHandler.fishTank.addFish(fish);
          console.log(`添加数据库鱼到鱼缸: ${fish.name}`);
          addedCount++;
        } else {
          console.log(`数据库鱼 "${fish.name}" 已存在，跳过添加`);
        }
      });

      wx.hideLoading();

      if (addedCount > 0) {
        wx.showToast({
          title: `已加载 ${addedCount} 条鱼`,
          icon: 'success',
          duration: 1500
        });
        console.log(`成功添加 ${addedCount} 条数据库鱼到鱼缸`);
      } else {
        console.log('没有新的数据库鱼需要加载');
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

  // 清空已加载的鱼ID（在需要重新加载时调用）
  clearLoadedFishIds() {
    this.loadedFishIds.clear();
    console.log('已清空加载的鱼ID记录，下次将重新加载所有数据库鱼');
  }

  // 新增：强制重新加载数据库鱼
  async forceReloadDatabaseFishes() {
    console.log('强制重新加载数据库鱼...');
    this.clearLoadedFishIds();
    this.eventHandler.databaseFishes = []; // 清空现有数据库鱼列表

    // 如果鱼缸已初始化，从鱼缸中移除所有数据库鱼
    if (this.eventHandler.isFishTankInitialized) {
      this.eventHandler.fishTank.fishes = this.eventHandler.fishTank.fishes.filter(
        fish => !this.eventHandler.databaseFishes.includes(fish)
      );
    }

    await this.loadAndShowDatabaseFishes();
  }
}

module.exports = FishDataManager;
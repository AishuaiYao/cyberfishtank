// utils.js - 工具函数
const Utils = {
    // 将图像数据转换为base64
    imageToBase64(imageData) {
      return new Promise((resolve, reject) => {
        try {
          console.log('开始转换图像为base64');
          
          // 创建临时画布
          const tempCanvas = wx.createCanvas();
          const tempCtx = tempCanvas.getContext('2d');
          
          // 设置画布尺寸
          tempCanvas.width = imageData.width;
          tempCanvas.height = imageData.height;
          
          // 绘制图像
          tempCtx.putImageData(imageData, 0, 0);
          
          // 转换为base64
          wx.canvasToTempFilePath({
            canvas: tempCanvas,
            success: (res) => {
              const fs = wx.getFileSystemManager();
              try {
                const fileData = fs.readFileSync(res.tempFilePath, 'base64');
                console.log('图像转换base64成功');
                resolve(fileData);
              } catch (error) {
                console.error('读取文件失败:', error);
                reject(error);
              }
            },
            fail: (error) => {
              console.error('canvas转换失败:', error);
              reject(error);
            }
          });
        } catch (error) {
          console.error('图像转换失败:', error);
          reject(error);
        }
      });
    },
    
    // 裁剪图像到最小外接矩形
    cropToBoundingBox(imageData) {
      console.log('开始裁剪图像到最小外接矩形');
      
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      
      // 查找非白色像素的边界
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          
          // 如果不是透明或白色像素
          if (a > 0 && (r < 250 || g < 250 || b < 250)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      
      // 如果没有找到有效像素，返回原图
      if (minX > maxX || minY > maxY) {
        console.log('未找到有效图像区域，返回原图');
        return imageData;
      }
      
      // 计算裁剪区域
      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;
      
      console.log(`裁剪区域: (${minX}, ${minY}, ${cropWidth}, ${cropHeight})`);
      
      // 创建新的ImageData
      const croppedData = new ImageData(cropWidth, cropHeight);
      
      for (let y = 0; y < cropHeight; y++) {
        for (let x = 0; x < cropWidth; x++) {
          const srcIndex = ((minY + y) * width + (minX + x)) * 4;
          const destIndex = (y * cropWidth + x) * 4;
          
          croppedData.data[destIndex] = data[srcIndex];
          croppedData.data[destIndex + 1] = data[srcIndex + 1];
          croppedData.data[destIndex + 2] = data[srcIndex + 2];
          croppedData.data[destIndex + 3] = data[srcIndex + 3];
        }
      }
      
      return croppedData;
    },
    
    // 缩放图像
    scaleImage(imageData, targetWidth, targetHeight) {
      console.log(`缩放图像: ${imageData.width}x${imageData.height} -> ${targetWidth}x${targetHeight}`);
      
      // 创建临时画布
      const tempCanvas = wx.createCanvas();
      const tempCtx = tempCanvas.getContext('2d');
      
      // 设置原始尺寸
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      tempCtx.putImageData(imageData, 0, 0);
      
      // 创建目标画布
      const destCanvas = wx.createCanvas();
      const destCtx = destCanvas.getContext('2d');
      destCanvas.width = targetWidth;
      destCanvas.height = targetHeight;
      
      // 缩放绘制
      destCtx.drawImage(tempCanvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);
      
      // 获取缩放后的图像数据
      const scaledData = destCtx.getImageData(0, 0, targetWidth, targetHeight);
      
      return scaledData;
    }
  };
  
  module.exports = Utils;
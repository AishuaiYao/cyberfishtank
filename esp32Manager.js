// esp32Manager.js - ESP32 TCP连接和图像接收管理
const Utils = require('./utils.js');

class ESP32Manager {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    
    // ESP32连接配置
    this.esp32IP = '192.168.4.1';
    this.esp32Port = 5000;
    
    // 连接状态
    this.connected = false;
    this.capturing = false;
    this.socket = null;
    
    // 图像接收缓冲
    this.receiveBuffer = null;
    this.expectedLength = 0;
    this.receiveOffset = 0;
    this.chunkCount = 0;
    
    // 图像数据
    this.imageData = null;
    this.progress = 0;
    
    // 日志
    this.logMsgs = [];
    this.maxLogMsgs = 30;
  }
  
  // 日志记录
  log(msg) {
    const time = new Date().toLocaleTimeString();
    console.log(`[ESP32] ${time} ${msg}`);
    this.logMsgs.unshift(`${time} | ${msg}`);
    if (this.logMsgs.length > this.maxLogMsgs) {
      this.logMsgs.pop();
    }
  }
  
  // 连接ESP32
  connect() {
    if (this.connected) {
      this.log('主动断开连接');
      this.disconnect();
      return;
    }
    
    this.log(`>>> 开始连接 ${this.esp32IP}:${this.esp32Port}`);
    
    const socket = wx.createTCPSocket();
    if (!socket) {
      this.log('!!! createTCPSocket 失败');
      Utils.showError('TCP创建失败');
      return;
    }
    this.socket = socket;
    this.log('TCPSocket 创建成功');
    
    socket.onConnect(() => {
      this.log('<<< TCP连接成功');
      this.connected = true;
      this.triggerUIUpdate();
      Utils.showSuccess('连接成功');
    });
    
    socket.onMessage((res) => {
      const bytes = new Uint8Array(res.message);
      this.log(`<<< 收到数据包: ${bytes.length} 字节`);
      this.onReceiveData(res.message);
    });
    
    socket.onClose(() => {
      this.log('<<< 连接已关闭');
      this.connected = false;
      this.capturing = false;
      this.socket = null;
      this.triggerUIUpdate();
    });
    
    socket.onError((err) => {
      this.log(`!!! 连接错误: ${JSON.stringify(err)}`);
      this.connected = false;
      this.capturing = false;
      this.socket = null;
      this.triggerUIUpdate();
      Utils.showError('连接失败');
    });
    
    this.log('>>> 发起TCP连接请求...');
    socket.connect({
      address: this.esp32IP,
      port: this.esp32Port
    });
  }
  
  // 断开连接
  disconnect() {
    if (this.socket) {
      this.log('关闭Socket');
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.capturing = false;
    this.triggerUIUpdate();
  }
  
  // 拍照
  captureImage() {
    this.log(`>>> captureImage 调用, connected=${this.connected}, capturing=${this.capturing}`);
    
    if (!this.connected) {
      this.log('!!! 未连接ESP32，无法拍照');
      Utils.showError('请先连接ESP32');
      return;
    }
    
    if (this.capturing) {
      this.log('!!! 正在采集中，请等待');
      return;
    }
    
    this.capturing = true;
    this.progress = 0;
    this.receiveBuffer = null;
    this.receiveOffset = 0;
    this.expectedLength = 0;
    this.chunkCount = 0;
    this.triggerUIUpdate();
    
    const cmd = 'CAPTURE\n';
    this.log(`>>> 发送CAPTURE命令, ${cmd.length} 字节`);
    
    const buffer = new ArrayBuffer(cmd.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < cmd.length; i++) {
      view[i] = cmd.charCodeAt(i);
    }
    
    try {
      this.socket.write(buffer);
      this.log('>>> CAPTURE命令已发出');
    } catch (e) {
      this.log(`!!! 发送命令异常: ${JSON.stringify(e)}`);
      this.capturing = false;
      this.triggerUIUpdate();
    }
  }
  
  // 接收TCP数据
  onReceiveData(data) {
    const bytes = new Uint8Array(data);
    let offset = 0;
    
    // 读取帧头（4字节大端长度）
    if (!this.receiveBuffer) {
      this.log('    解析帧头...');
      if (bytes.length < 4) {
        this.log(`!!! 数据包不足4字节，当前: ${bytes.length} 字节`);
        return;
      }
      
      this.expectedLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
      offset = 4;
      
      this.log(`    帧头: 预期图像=${this.expectedLength} 字节`);
      
      if (this.expectedLength !== 160 * 120) {
        this.log(`!!! 警告: 大小${this.expectedLength}与预期19200不一致`);
      }
      
      this.receiveBuffer = new Uint8Array(this.expectedLength);
      this.receiveOffset = 0;
      this.chunkCount = 0;
    }
    
    // 写入数据到缓冲区
    const remaining = bytes.length - offset;
    const toWrite = Math.min(remaining, this.expectedLength - this.receiveOffset);
    this.receiveBuffer.set(bytes.subarray(offset, offset + toWrite), this.receiveOffset);
    this.receiveOffset += toWrite;
    this.chunkCount++;
    
    if (this.chunkCount <= 3 || this.chunkCount % 20 === 0) {
      this.log(`    第${this.chunkCount}包: +${toWrite}B, 累计${this.receiveOffset}/${this.expectedLength}`);
    }
    
    this.progress = Math.floor((this.receiveOffset / this.expectedLength) * 100);
    this.triggerUIUpdate();
    
    // 接收完成
    if (this.receiveOffset >= this.expectedLength) {
      this.log(`<<< 图像接收完成! 共${this.chunkCount}包, ${this.receiveOffset}字节`);
      this.processImage(this.receiveBuffer);
      this.receiveBuffer = null;
      this.receiveOffset = 0;
      this.chunkCount = 0;
      this.capturing = false;
      this.progress = 0;
      this.triggerUIUpdate();
    }
  }
  
  // 灰度图转PNG
  processImage(grayData) {
    this.log(`>>> 处理图像, 长度=${grayData.length}`);
    const width = 160;
    const height = 120;
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < grayData.length; i++) {
      rgbaData[i * 4] = grayData[i];
      rgbaData[i * 4 + 1] = grayData[i];
      rgbaData[i * 4 + 2] = grayData[i];
      rgbaData[i * 4 + 3] = 255;
    }
    
    const canvas = wx.createOffscreenCanvas({ type: '2d', width, height });
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);
    imgData.data.set(rgbaData);
    ctx.putImageData(imgData, 0, 0);
    
    this.log('>>> Canvas绘制完成, 导出临时文件');
    wx.canvasToTempFilePath({
      canvas,
      success: (res) => {
        this.log(`<<< 导出成功: ${res.tempFilePath}`);
        this.imageData = res.tempFilePath;
        this.saveImageToLocal(res.tempFilePath);
        this.triggerUIUpdate();
      },
      fail: (err) => {
        this.log(`!!! 导出失败: ${JSON.stringify(err)}`);
        Utils.showError('图像处理失败');
      }
    });
  }
  
  // 保存到本地
  saveImageToLocal(tempFilePath) {
    this.log(`>>> 保存图片: ${tempFilePath}`);
    wx.saveFile({
      tempFilePath,
      success: (res) => {
        this.log(`<<< 保存成功: ${res.savedFilePath}`);
        
        // 保存到本地存储
        let images = wx.getStorageSync('esp32Images') || [];
        images.unshift({
          path: res.savedFilePath,
          time: new Date().toLocaleString()
        });
        wx.setStorageSync('esp32Images', images);
        
        this.log(`本地图片总数: ${images.length}`);
        Utils.showSuccess('已保存');
        this.triggerUIUpdate();
      },
      fail: (err) => {
        this.log(`!!! 保存失败: ${JSON.stringify(err)}`);
        Utils.showError('保存失败');
      }
    });
  }
  
  // 获取本地保存的图片数量
  getLocalImageCount() {
    const images = wx.getStorageSync('esp32Images') || [];
    return images.length;
  }
  
  // 触发UI更新
  triggerUIUpdate() {
    if (this.eventHandler && this.eventHandler.uiManager) {
      const gameState = this.eventHandler.gameState;
      if (gameState && this.eventHandler.uiManager.drawGameUI) {
        this.eventHandler.uiManager.drawGameUI(gameState);
      }
    }
  }
  
  // 重置状态
  reset() {
    this.disconnect();
    this.imageData = null;
    this.progress = 0;
    this.logMsgs = [];
  }
}

module.exports = ESP32Manager;

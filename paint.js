// paint.js - 绘画功能
const Paint = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentColor: '#000000',
    currentSize: 5,
    isEraser: false,
    paintArea: { x: 0, y: 0, width: 0, height: 0 },
    paths: [],
    currentPath: null,
    
    init(canvas, ctx) {
      console.log('绘画模块初始化');
      this.canvas = canvas;
      this.ctx = ctx;
    },
    
    setPaintArea(x, y, width, height) {
      this.paintArea = { x, y, width, height };
      console.log(`设置绘画区域: (${x}, ${y}, ${width}, ${height})`);
    },
    
    handleTouchStart(x, y) {
      // 检查是否在绘画区域内
      if (!this.isInPaintArea(x, y)) {
        return;
      }
      
      this.isDrawing = true;
      this.currentPath = {
        points: [{ x, y }],
        color: this.isEraser ? '#FFFFFF' : this.currentColor,
        size: this.currentSize,
        isEraser: this.isEraser
      };
      
      console.log(`开始绘画: (${x}, ${y})`);
    },
    
    handleTouchMove(x, y) {
      if (!this.isDrawing || !this.currentPath) return;
      
      // 检查是否在绘画区域内
      if (!this.isInPaintArea(x, y)) {
        this.handleTouchEnd(x, y);
        return;
      }
      
      this.currentPath.points.push({ x, y });
      this.drawCurrentPath();
      
      console.log(`继续绘画: (${x}, ${y})`);
    },
    
    handleTouchEnd(x, y) {
      if (!this.isDrawing) return;
      
      this.isDrawing = false;
      
      if (this.currentPath && this.currentPath.points.length > 1) {
        this.paths.push(this.currentPath);
      }
      
      this.currentPath = null;
      console.log('结束绘画');
    },
    
    isInPaintArea(x, y) {
      return x >= this.paintArea.x && 
             x <= this.paintArea.x + this.paintArea.width && 
             y >= this.paintArea.y && 
             y <= this.paintArea.y + this.paintArea.height;
    },
    
    drawCurrentPath() {
      if (!this.currentPath || this.currentPath.points.length < 2) return;
      
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentPath.points[0].x, this.currentPath.points[0].y);
      
      for (let i = 1; i < this.currentPath.points.length; i++) {
        this.ctx.lineTo(this.currentPath.points[i].x, this.currentPath.points[i].y);
      }
      
      this.ctx.strokeStyle = this.currentPath.color;
      this.ctx.lineWidth = this.currentPath.size;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();
    },
    
    redrawAll() {
      // 清空绘画区域
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillRect(this.paintArea.x, this.paintArea.y, this.paintArea.width, this.paintArea.height);
      
      // 重绘边框
      this.ctx.strokeStyle = '#CCCCCC';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(this.paintArea.x, this.paintArea.y, this.paintArea.width, this.paintArea.height);
      
      // 重绘所有路径
      for (const path of this.paths) {
        if (path.points.length < 2) continue;
        
        this.ctx.beginPath();
        this.ctx.moveTo(path.points[0].x, path.points[0].y);
        
        for (let i = 1; i < path.points.length; i++) {
          this.ctx.lineTo(path.points[i].x, path.points[i].y);
        }
        
        this.ctx.strokeStyle = path.color;
        this.ctx.lineWidth = path.size;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
      }
    },
    
    getFishImage() {
      console.log('获取鱼图像');
      
      // 这里应该实现图像裁剪和缩放逻辑
      // 简化版本：返回整个绘画区域的图像数据
      
      try {
        const imageData = this.ctx.getImageData(
          this.paintArea.x, 
          this.paintArea.y, 
          this.paintArea.width, 
          this.paintArea.height
        );
        
        console.log('成功获取图像数据');
        return imageData;
      } catch (error) {
        console.error('获取图像数据失败:', error);
        return null;
      }
    },
    
    // 工具方法
    setColor(color) {
      this.currentColor = color;
      this.isEraser = false;
      console.log(`设置颜色: ${color}`);
    },
    
    setSize(size) {
      this.currentSize = size;
      console.log(`设置画笔大小: ${size}`);
    },
    
    setEraser() {
      this.isEraser = true;
      console.log('切换到橡皮擦模式');
    },
    
    undo() {
      if (this.paths.length > 0) {
        this.paths.pop();
        this.redrawAll();
        console.log('撤销上一步操作');
      }
    },
    
    clear() {
      this.paths = [];
      this.redrawAll();
      console.log('清空画布');
    },
    
    flip() {
      // 翻转画作逻辑
      console.log('翻转画作');
      // 这里应该实现画作翻转功能
    }
  };
  
  module.exports = Paint;
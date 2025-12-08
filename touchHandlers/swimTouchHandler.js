// touchHandlers/swimTouchHandler.js - 游泳界面触摸处理
class SwimTouchHandler {
  constructor(eventHandler) {
    this.eventHandler = eventHandler;
    this.lastTapTime = 0;
    this.tapCount = 0;
    this.tapTimeout = null;
    this.lastTouchEvent = null; // 记录上次的触摸事件，防止重复处理
    this.justOpenedSelector = false; // 标记选择器是否刚刚打开
    
    // 设置一个定时器，定期清除lastTouchEvent，防止影响真实的连续点击
    setInterval(() => {
      this.lastTouchEvent = null;
    }, 500); // 500毫秒后清除
  }

  // 处理触摸移动
  handleTouchMove(x, y) {
    // 只在选择器展开时处理滑动
    if (this.eventHandler.tankSelectorState && this.eventHandler.tankSelectorState.isOpen) {
      // 检查是否点击了选择器区域
      if (this.eventHandler.tankSelectorBounds) {
        const { x: selectorX, y: selectorY, width: selectorWidth } = this.eventHandler.tankSelectorBounds;
        
        if (x >= selectorX && x <= selectorX + selectorWidth && y >= selectorY) {
          // 开始跟踪滑动，记录起始位置
          if (this.eventHandler.tankSelectorState.startScrollY === null) {
            this.eventHandler.tankSelectorState.startScrollY = y;
            this.eventHandler.tankSelectorState.startScrollOffset = this.eventHandler.tankSelectorState.scrollOffset || 0;
            // 记录上一次的位置，用于计算速度
            this.eventHandler.tankSelectorState.lastY = y;
            this.eventHandler.tankSelectorState.velocity = 0;
          } else {
            // 计算当前速度
            const currentY = y;
            const deltaY = currentY - (this.eventHandler.tankSelectorState.lastY || currentY);
            
            // 更新速度，添加阻尼
            this.eventHandler.tankSelectorState.velocity = 
              (this.eventHandler.tankSelectorState.velocity || 0) * 0.7 + deltaY * 0.3;
            
            // 计算滚动距离
            const scrollDistance = currentY - this.eventHandler.tankSelectorState.startScrollY;
            const itemHeight = 36; // 更新为新的选项高度
            const pixelsPerItem = itemHeight * 1.5; // 显著增加每个项目所需的像素数，降低敏感度
            
            // 限制最大滚动速度
            const maxScrollSpeed = itemHeight * 0.5;
            const limitedScrollDistance = Math.max(-maxScrollSpeed, 
                                                   Math.min(maxScrollSpeed, 
                                                          this.eventHandler.tankSelectorState.velocity));
            
            // 更新滚动偏移，使用限制后的速度
            const newScrollOffset = (this.eventHandler.tankSelectorState.scrollOffset || 0) + limitedScrollDistance;
            this.eventHandler.tankSelectorState.scrollOffset = newScrollOffset;
            
            // 计算应该选中的索引（根据滚动偏移）
            const itemsToScroll = Math.round(newScrollOffset / pixelsPerItem);
            let newIndex = this.eventHandler.tankSelectorState.selectedIndex - itemsToScroll;
            
            // 限制索引在有效范围内
            newIndex = Math.max(0, Math.min(this.eventHandler.tankSelectorState.items.length - 1, newIndex));
            
            // 更新选中索引
            if (newIndex !== this.eventHandler.tankSelectorState.selectedIndex) {
              this.eventHandler.tankSelectorState.selectedIndex = newIndex;
              // 重置滚动偏移，避免累积偏移
              this.eventHandler.tankSelectorState.scrollOffset = 0;
              this.eventHandler.tankSelectorState.startScrollY = currentY;
            }
            
            // 更新上一次的位置
            this.eventHandler.tankSelectorState.lastY = currentY;
          }
        }
      }
    }
  }

  // 修改：处理游泳界面触摸（在触摸结束时调用）
  handleTouch(x, y) {
    // 防止重复处理相同的触摸事件
    const touchKey = `${Math.round(x)}_${Math.round(y)}`;
    if (this.lastTouchEvent === touchKey) {
      return;
    }
    this.lastTouchEvent = touchKey;
    
    // 首先检查选择器是否展开，如果是，则优先处理选择器的关闭逻辑
    if (this.eventHandler.tankSelectorState && this.eventHandler.tankSelectorState.isOpen) {
      // 检查是否点击了选择器区域（包括展开的列表区域）
      if (this.eventHandler.tankSelectorBounds) {
        const { x: selectorX, y: selectorY, width: selectorWidth, expandedHeight } = this.eventHandler.tankSelectorBounds;
        
        // 如果点击在选择器区域内，不关闭选择器，只处理选项选择
        if (x >= selectorX && x <= selectorX + selectorWidth &&
            y >= selectorY && y <= selectorY + expandedHeight) {
          
          // 如果选择器是刚刚打开的，不处理选项选择
          if (this.justOpenedSelector) {
            this.justOpenedSelector = false;
            return;
          }
          
          // 只有在没有滑动的情况下才处理选项选择
          if (!this.eventHandler.tankSelectorState.startScrollY) {
            // 点击了选择器区域，检查是否点击了某个选项
            this.handleTankSelectorSelection(x, y, selectorX, selectorY, selectorWidth);
          }
          return;
        }
      }
      
      // 如果点击在选择器区域外，关闭选择器（不受滑动状态影响）
      this.eventHandler.tankSelectorState.isOpen = false;
      return;
    }

    // 返回按钮
    if (x >= 20 && x <= 70 && y >= 40 && y <= 70) {
      if (this.eventHandler.isOtherFishTankVisible) {
        // 串门界面：隐藏他人鱼缸
        this.eventHandler.hideOtherFishTank();
      } else {
        // 游泳界面：隐藏游泳界面
        this.eventHandler.hideSwimInterface();
      }
      return;
    }

    // 检查鱼缸选择器的点击（仅在选择器未展开时）
    if (this.eventHandler.tankSelectorBounds && (!this.eventHandler.tankSelectorState || !this.eventHandler.tankSelectorState.isOpen)) {
      const { x: selectorX, y: selectorY, width: selectorWidth, collapsedHeight } = this.eventHandler.tankSelectorBounds;
      
      console.log(`[触摸事件] 检查收起状态选择器点击: 边界=(${selectorX},${selectorY},${selectorWidth},${collapsedHeight}), 点击坐标=(${x},${y})`);
      
      if (x >= selectorX && x <= selectorX + selectorWidth &&
          y >= selectorY && y <= selectorY + collapsedHeight) {
        console.log('[触摸事件] 点击了收起状态的选择器，展开选择器');
        // 收起状态，点击后展开选择器
        if (!this.eventHandler.tankSelectorState) {
          // 初始化选择器状态，使用与UI管理器相同的选项顺序和默认选择
          const items = [
            { id: 'best', name: '最佳鱼缸' },
            { id: 'worst', name: '最丑鱼缸' },
            { id: 'public', name: '赛博鱼缸' },
            { id: 'latest', name: '最新鱼缸' },
            { id: 'my', name: '我的鱼缸' }
          ];
          
          this.eventHandler.tankSelectorState = {
            isOpen: false,
            selectedIndex: 2, // 默认选中赛博鱼缸（索引2）
            startScrollY: null,
            items: items
          };
        }
        this.eventHandler.tankSelectorState.isOpen = true;
        this.justOpenedSelector = true; // 标记选择器刚刚打开
        return;
      }
    }

    // 刷新按钮（现在在鱼缸选择器旁边）
    const selectorWidth = 100; // 鱼缸选择器宽度
    const buttonSpacing = 5; // 按钮间距
    const refreshButtonX = 80 + selectorWidth + buttonSpacing; // 放在选择器右侧，使用相同间距
    if (x >= refreshButtonX && x <= refreshButtonX + 50 && y >= 40 && y <= 70) {
      this.eventHandler.refreshFishTank();
      return;
    }



    // 检测双击
    this.handleDoubleTap(x, y);

    // 鱼点击
    if (this.eventHandler.fishTank) {
      for (const fish of this.eventHandler.fishTank.fishes) {
        const fishLeft = fish.x;
        const fishRight = fish.x + fish.width;
        const fishTop = fish.y;
        const fishBottom = fish.y + fish.height;

        if (x >= fishLeft && x <= fishRight &&
            y >= fishTop && y <= fishBottom) {
          console.log('点击了鱼:', fish.name);
          this.eventHandler.showFishDetailFromTank(fish);
          return;
        }
      }
    }

    console.log('鱼缸界面点击位置:', x, y);
  }

  // 处理双击事件
  handleDoubleTap(x, y) {
    const currentTime = Date.now();
    const tapInterval = currentTime - this.lastTapTime;

    if (tapInterval < 300 && tapInterval > 0) {
      // 双击检测成功
      this.tapCount++;
      if (this.tapCount === 2) {
        this.spawnFishFood(x, y);
        this.tapCount = 0;
        if (this.tapTimeout) {
          clearTimeout(this.tapTimeout);
        }
      }
    } else {
      this.tapCount = 1;
    }

    this.lastTapTime = currentTime;

    // 设置超时重置点击计数
    if (this.tapTimeout) {
      clearTimeout(this.tapTimeout);
    }
    this.tapTimeout = setTimeout(() => {
      this.tapCount = 0;
    }, 300);
  }

  // 处理选择器选项选择
  handleTankSelectorSelection(x, y, selectorX, selectorY, selectorWidth) {
    const itemHeight = 50; // 选项高度
    const selectorCenterY = selectorY + 60 / 2; // 60是选择器总高度
    
    // 计算点击位置相对于中心的位置
    const relativeY = y - selectorCenterY;
    
    // 计算应该选中的索引（考虑当前的滚动偏移）
    let clickedIndex = Math.round(relativeY / itemHeight) + this.eventHandler.tankSelectorState.selectedIndex;
    
    // 确保索引在有效范围内
    clickedIndex = Math.max(0, Math.min(clickedIndex, this.eventHandler.tankSelectorState.items.length - 1));
    
    // 切换到选中的模式
    this.eventHandler.tankSelectorState.selectedIndex = clickedIndex;
    const selectedItem = this.eventHandler.tankSelectorState.items[clickedIndex];
    this.eventHandler.switchToTankMode(selectedItem.id);
    
    // 关闭选择器并重置状态
    this.eventHandler.tankSelectorState.isOpen = false;
    this.eventHandler.tankSelectorState.scrollOffset = 0;
    this.eventHandler.tankSelectorState.startScrollY = null;
    this.eventHandler.tankSelectorState.startScrollOffset = null;
  }

  // 处理选择器的拖动滚动
  handleTankSelectorScroll(x, y, isScrolling) {
    if (!this.eventHandler.tankSelectorState || !this.eventHandler.tankSelectorState.isOpen) return;
    
    if (isScrolling && this.eventHandler.tankSelectorState.startScrollY !== null) {
      // 正在滚动
      const scrollDistance = y - this.eventHandler.tankSelectorState.startScrollY;
      const itemHeight = 50; // 更新为新的选项高度
      
      // 计算应该滚动到的项目索引
      const itemsToScroll = Math.round(scrollDistance / itemHeight);
      const newIndex = Math.max(0, Math.min(this.eventHandler.tankSelectorState.items.length - 1, 
                                           this.eventHandler.tankSelectorState.selectedIndex + itemsToScroll));
      
      // 更新选中项
      if (newIndex !== this.eventHandler.tankSelectorState.selectedIndex) {
        this.eventHandler.tankSelectorState.selectedIndex = newIndex;
      }
    }
  }

  // 结束滑动处理
  handleTouchEnd(x, y) {
    if (this.eventHandler.tankSelectorState && 
        this.eventHandler.tankSelectorState.isOpen && 
        this.eventHandler.tankSelectorState.startScrollY !== null) {
      
      // 启动惯性滚动效果
      if (this.eventHandler.tankSelectorState.velocity && Math.abs(this.eventHandler.tankSelectorState.velocity) > 0.5) {
        this.startInertialScroll();
      } else {
        // 没有速度，直接切换模式
        const selectedItem = this.eventHandler.tankSelectorState.items[this.eventHandler.tankSelectorState.selectedIndex];
        this.eventHandler.switchToTankMode(selectedItem.id);
        
        // 注意：不要在这里自动关闭选择器，让用户决定何时关闭
        // 这样可以确保用户在滑动后，选择器仍然保持打开状态
      }
      
      // 重置滑动状态
      this.eventHandler.tankSelectorState.startScrollY = null;
      this.eventHandler.tankSelectorState.startScrollOffset = null;
      this.eventHandler.tankSelectorState.scrollOffset = 0; // 重置滚动偏移
      this.eventHandler.tankSelectorState.lastY = null;
      this.eventHandler.tankSelectorState.velocity = null;
    }
  }
  
  // 启动惯性滚动效果
  startInertialScroll() {
    if (!this.eventHandler.tankSelectorState || !this.eventHandler.tankSelectorState.isOpen) return;
    
    // 创建惯性滚动动画
    let velocity = this.eventHandler.tankSelectorState.velocity || 0;
    const friction = 0.95; // 摩擦系数
    const minVelocity = 0.5; // 最小速度阈值
    
    const animate = () => {
      if (!this.eventHandler.tankSelectorState || !this.eventHandler.tankSelectorState.isOpen) return;
      
      // 应用摩擦力
      velocity *= friction;
      
      // 如果速度太小，停止动画
      if (Math.abs(velocity) < minVelocity) {
        // 滚动结束，切换到当前选中的模式
        const selectedItem = this.eventHandler.tankSelectorState.items[this.eventHandler.tankSelectorState.selectedIndex];
        this.eventHandler.switchToTankMode(selectedItem.id);
        
        // 注意：不要在这里关闭选择器，让用户决定何时关闭
        // 这样可以避免惯性滚动结束后选择器意外关闭
        return;
      }
      
      // 计算滚动距离
      const itemHeight = 36; // 选项高度
      const pixelsPerItem = itemHeight * 1.5; // 每个项目需要的像素数
      
      // 更新滚动偏移
      const newScrollOffset = (this.eventHandler.tankSelectorState.scrollOffset || 0) + velocity;
      this.eventHandler.tankSelectorState.scrollOffset = newScrollOffset;
      
      // 计算应该选中的索引
      const itemsToScroll = Math.round(newScrollOffset / pixelsPerItem);
      let newIndex = this.eventHandler.tankSelectorState.selectedIndex - itemsToScroll;
      
      // 限制索引在有效范围内
      newIndex = Math.max(0, Math.min(this.eventHandler.tankSelectorState.items.length - 1, newIndex));
      
      // 更新选中索引
      if (newIndex !== this.eventHandler.tankSelectorState.selectedIndex) {
        this.eventHandler.tankSelectorState.selectedIndex = newIndex;
        // 重置滚动偏移，避免累积偏移
        this.eventHandler.tankSelectorState.scrollOffset = 0;
      }
      
      // 更新当前速度
      this.eventHandler.tankSelectorState.velocity = velocity;
      
      // 继续动画
      requestAnimationFrame(animate);
    };
    
    // 开始动画
    requestAnimationFrame(animate);
  }

  // 生成鱼粮
  spawnFishFood(x, y) {
    if (this.eventHandler.fishTank) {
      this.eventHandler.fishTank.spawnFishFood(x, y, 10);
      console.log(`在位置 (${x}, ${y}) 生成鱼粮`);

//      // 显示提示
//      wx.showToast({
//        title: '投放了鱼粮',
//        icon: 'success',
//        duration: 1000
//      });
    }
  }
}

module.exports = SwimTouchHandler;
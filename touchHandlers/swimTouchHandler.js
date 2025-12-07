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
          } else {
            // 计算滚动距离并更新滚动偏移
            const scrollDistance = y - this.eventHandler.tankSelectorState.startScrollY;
            const itemHeight = 45;
            const pixelsPerItem = itemHeight * 0.6; // 降低滚动敏感度
            
            // 更新滚动偏移
            const newScrollOffset = this.eventHandler.tankSelectorState.startScrollOffset + scrollDistance;
            this.eventHandler.tankSelectorState.scrollOffset = newScrollOffset;
            
            // 计算应该选中的索引（根据滚动偏移）
            const itemsToScroll = Math.round(newScrollOffset / pixelsPerItem);
            let newIndex = this.eventHandler.tankSelectorState.selectedIndex - itemsToScroll;
            
            // 限制索引在有效范围内
            newIndex = Math.max(0, Math.min(this.eventHandler.tankSelectorState.items.length - 1, newIndex));
            
            // 更新选中索引
            if (newIndex !== this.eventHandler.tankSelectorState.selectedIndex) {
              this.eventHandler.tankSelectorState.selectedIndex = newIndex;
            }
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
      
      // 点击了选择器外部，关闭选择器
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
          this.eventHandler.tankSelectorState = { isOpen: false };
        }
        this.eventHandler.tankSelectorState.isOpen = true;
        this.justOpenedSelector = true; // 标记选择器刚刚打开
        return;
      }
    }

    // 刷新按钮（现在在最右边）
    const refreshButtonX = this.eventHandler.canvas.width / this.eventHandler.uiManager.pixelRatio - 70;
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
          this.eventHandler.showFishDetail(fish);
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
    const itemHeight = 45; // 选项高度
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
      const itemHeight = 45; // 更新为新的选项高度
      
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
      
      // 如果有滑动，根据最终位置切换模式
      const selectedItem = this.eventHandler.tankSelectorState.items[this.eventHandler.tankSelectorState.selectedIndex];
      this.eventHandler.switchToTankMode(selectedItem.id);
      
      // 重置滑动状态
      this.eventHandler.tankSelectorState.startScrollY = null;
      this.eventHandler.tankSelectorState.startScrollOffset = null;
      this.eventHandler.tankSelectorState.scrollOffset = 0; // 重置滚动偏移
    }
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

class AIService {
  constructor() {
    this.currentRequest = null; // 新增：当前请求的引用
    this.requestTimeout = 10000; // 10秒超时
  }

  async getAIScore(canvas, gameState, updateUI) {
    // 优化：检查是否正在请求，避免重复请求
    if (gameState.scoringState.isRequesting) {
      console.log('AI评分正在进行中，跳过重复请求');
      return;
    }

    // 优化：添加防抖检查
    if (!gameState.canStartScoring()) {
      console.log('评分请求过于频繁，跳过');
      return;
    }

    // 优化：如果路径太少，不进行评分
    if (gameState.drawingPaths.length === 0) {
      console.log('没有绘画路径，跳过评分');
      return;
    }

    try {
      gameState.startScoring();
      updateUI();

      const base64Data = canvas.toDataURL().split(',')[1];
      
      // 优化：使用可取消的Promise
      const score = await this.callQWenVLModelWithCancel(base64Data, gameState);
      
      // 优化：检查是否在评分过程中用户继续绘画了
      if (!gameState.scoringState.isRequesting) {
        console.log('评分已被取消，忽略结果');
        return;
      }

      gameState.finishScoring(score);
      
    } catch (error) {
      console.error('AI评分失败:', error);
      
      // 优化：只在确实失败时设置随机分数
      if (gameState.scoringState.isRequesting) {
        const randomScore = Math.floor(Math.random() * 100);
        gameState.finishScoring(randomScore);
      }
    } finally {
      // 确保UI更新
      updateUI();
    }
  }

  // 优化：添加可取消的API调用
  callQWenVLModelWithCancel(base64Image, gameState) {
    return new Promise((resolve, reject) => {
      // 清除之前的请求
      if (this.currentRequest) {
        this.currentRequest.abort();
      }

      const requestTask = wx.request({
        url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-ad3c50fe6e16438a8fac5e8b2d7b3829'
        },
        data: {
          model: "qwen3-vl-plus",
          messages: [
            {
              "role": "user",
              "content": [
                {
                  "type": "image_url",
                  "image_url": {"url": `data:image/png;base64,${base64Image}`}
                },
                {"type": "text", "text": "判断这个图上画的像不像一条鱼，判定严格一点，在0到100范围内打分，精确到小数点后两位，直接返回给我得分就行"}
              ]
            }
          ]
        },
        success: (res) => {
          this.currentRequest = null;
          
          // 检查请求是否已被取消
          if (!gameState.scoringState.isRequesting) {
            reject(new Error('请求已被取消'));
            return;
          }

          if (res.data?.choices?.[0]) {
            const content = res.data.choices[0].message.content;
            const scoreMatch = content.match(/(\d+\.?\d*)/);
            console.log('AI评分', scoreMatch ? scoreMatch[0] : '无匹配结果');
            resolve(scoreMatch ? parseFloat(scoreMatch[0]) : Math.floor(Math.random() * 100));
          } else {
            resolve(Math.floor(Math.random() * 100));
          }
        },
        fail: (err) => {
          this.currentRequest = null;

        if (err.errMsg && err.errMsg.includes('abort')) {
          console.log('AI评分取消（用户继续绘画）');
          resolve(null); // 静默完成，不报错
        } else {
          console.warn('AI评分请求失败:', err);
          reject(err);
        }
        }
      });

      this.currentRequest = requestTask;

      // 设置超时
      setTimeout(() => {
        if (this.currentRequest === requestTask) {
          requestTask.abort();
          reject(new Error('请求超时'));
        }
      }, this.requestTimeout);
    });
  }

  // 新增：取消当前评分请求
  cancelCurrentRequest() {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
      console.log('已取消AI评分请求');
    }
  }

  // 新增：智能评分触发（在合适的时机调用）
  async triggerSmartScoring(canvas, gameState, updateUI) {
    // 如果用户正在绘画，取消之前的请求
    if (gameState.isDrawing) {
      this.cancelCurrentRequest();
      gameState.cancelScoring();
      return;
    }

    // 检查是否有足够的绘画内容
    const totalPoints = gameState.drawingPaths.reduce((sum, path) => sum + path.points.length, 0);
    if (totalPoints < 10) {
      console.log('绘画内容太少，不触发评分');
      return;
    }

    // 延迟触发评分，给用户继续绘画的时间
    setTimeout(async () => {
      // 再次检查用户是否在延迟期间开始了新的绘画
      if (!gameState.isDrawing && gameState.canStartScoring()) {
        await this.getAIScore(canvas, gameState, updateUI);
      }
    }, 400); // 1.5秒延迟
  }
}

module.exports = AIService;
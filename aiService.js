
class AIService {
  constructor() {
    this.currentRequest = null;
    this.requestTimeout = 10000;
    this.llmConfig = null;
  }

  // 获取本地配置（不再从云存储下载）
  fetchLLMConfig() {
    if (this.llmConfig) {
      return this.llmConfig;
    }

    // 使用本地默认配置
    // 如需自定义，开发者可直接修改此处的配置
    this.llmConfig = {
      url: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o',
      prompt: '请为这幅画评分，满分100分，只返回一个数字。',
      Authorization: 'Bearer YOUR_API_KEY'
    };

    // 尝试从本地存储加载自定义配置
    try {
      const savedConfig = wx.getStorageSync('llmConfig');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.url && parsed.Authorization) {
          this.llmConfig = parsed;
          console.log('从本地存储加载了LLM配置');
        }
      }
    } catch (e) {
      console.warn('加载本地LLM配置失败，使用默认配置:', e);
    }

    return this.llmConfig;
  }

  async getAIScore(canvas, gameState, updateUI) {
    if (gameState.scoringState.isRequesting) {
      console.log('AI评分正在进行中，跳过重复请求');
      return;
    }

    if (!gameState.canStartScoring()) {
      console.log('评分请求过于频繁，跳过');
      return;
    }

    if (gameState.drawingPaths.length === 0) {
      console.log('没有绘画路径，跳过评分');
      return;
    }

    try {
      gameState.startScoring();
      updateUI();

      const base64Data = canvas.toDataURL().split(',')[1];

      const score = await this.callQWenVLModelWithCancel(base64Data, gameState);

      if (!gameState.scoringState.isRequesting) {
        console.log('评分已被取消，忽略结果');
        return;
      }

      gameState.finishScoring(score);

    } catch (error) {
      console.error('AI评分失败:', error);

      if (gameState.scoringState.isRequesting) {
        const randomScore = Math.floor(Math.random() * 100);
        gameState.finishScoring(randomScore);
      }
    } finally {
      updateUI();
    }
  }

  async callQWenVLModelWithCancel(base64Image, gameState) {
    const config = this.fetchLLMConfig();

    return new Promise((resolve, reject) => {
      if (this.currentRequest) {
        this.currentRequest.abort();
      }

      const requestTask = wx.request({
        url: config.url,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': config.Authorization
        },
        data: {
          model: config.model,
          messages: [
            {
              "role": "user",
              "content": [
                {
                  "type": "image_url",
                  "image_url": {"url": `data:image/png;base64,${base64Image}`}
                },
                {"type": "text", "text": config.prompt}
              ]
            }
          ]
        },
        success: (res) => {
          this.currentRequest = null;

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
            resolve(null);
          } else {
            console.warn('AI评分请求失败:', err);
            reject(err);
          }
        }
      });

      this.currentRequest = requestTask;

      setTimeout(() => {
        if (this.currentRequest === requestTask) {
          requestTask.abort();
          reject(new Error('请求超时'));
        }
      }, this.requestTimeout);
    });
  }

  cancelCurrentRequest() {
    if (this.currentRequest) {
      this.currentRequest.abort();
      this.currentRequest = null;
      console.log('已取消AI评分请求');
    }
  }

  async triggerSmartScoring(canvas, gameState, updateUI) {
    if (gameState.isDrawing) {
      this.cancelCurrentRequest();
      gameState.cancelScoring();
      return;
    }

    const totalPoints = gameState.drawingPaths.reduce((sum, path) => sum + path.points.length, 0);
    if (totalPoints < 10) {
      console.log('绘画内容太少，不触发评分');
      return;
    }

    setTimeout(async () => {
      if (!gameState.isDrawing && gameState.canStartScoring()) {
        await this.getAIScore(canvas, gameState, updateUI);
      }
    }, 400);
  }
}

module.exports = AIService;

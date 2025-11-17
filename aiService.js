class AIService {
    async getAIScore(canvas, gameState, updateUI) {
      if (gameState.isScoring) return;

      try {
        gameState.startScoring();
        updateUI();

        const base64Data = canvas.toDataURL().split(',')[1];
        const score = await this.callQWenVLModel(base64Data);

        gameState.finishScoring(score);
      } catch (error) {
        console.error('AI评分失败:', error);
        gameState.finishScoring(Math.floor(Math.random() * 100));
      } finally {
        updateUI();
      }
    }

    callQWenVLModel(base64Image) {
      return new Promise((resolve, reject) => {
        wx.request({
          url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-943f95da67d04893b70c02be400e2935'
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
                  {"type": "text", "text": "判断这个图上画的像不像一条鱼，在0到100范围内打分，精确到小数点后两位，直接返回给我得分就行"}
                ]
              }
            ]
          },
          success: (res) => {
            if (res.data?.choices?.[0]) {
              const content = res.data.choices[0].message.content;
              const scoreMatch = content.match(/(\d+\.?\d*)/);
              console.log('AI评分', scoreMatch[0]);
              resolve(scoreMatch ? parseFloat(scoreMatch[0]) : Math.floor(Math.random() * 100));
            } else {
              resolve(Math.floor(Math.random() * 100));
            }
          },
          fail: reject
        });
      });
    }
  }

  module.exports = AIService;
// api.js - API调用功能
const API = {
    // 调用阿里云通义千问VL模型API
    callQWenVLModel(base64Image) {
      return new Promise((resolve, reject) => {
        console.log('开始调用大模型API');
        
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
            console.log('API调用成功:', res);
            
            if (res.data && res.data.choices && res.data.choices[0]) {
              const score = res.data.choices[0].message.content;
              console.log(`模型评分结果: ${score}`);
              resolve(score);
            } else {
              console.error('API返回数据格式错误');
              reject(new Error('API返回数据格式错误'));
            }
          },
          fail: (error) => {
            console.error('API调用失败:', error);
            reject(error);
          }
        });
      });
    }
  };
  
  module.exports = API;
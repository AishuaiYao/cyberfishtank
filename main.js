// main.js - 主入口文件
const Game = require('./game.js');
const FishTank = require('./fishTank.js');
const Ranking = require('./ranking.js');

// 游戏主循环
wx.onTouchStart((e) => {
  const touch = e.touches[0];
  Game.handleTouchStart(touch.x, touch.y);
});

wx.onTouchMove((e) => {
  const touch = e.touches[0];
  Game.handleTouchMove(touch.x, touch.y);
});

wx.onTouchEnd((e) => {
  const touch = e.touches[0];
  Game.handleTouchEnd(touch.x, touch.y);
});

// 初始化游戏
Game.init();
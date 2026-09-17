# 猫猫开局 · Catroom

**飞行棋 + 斗地主，手机优先的朋友联机小客厅。**

填写昵称，随机分配一只猫咪，可手动换选；创建六位房间号，或者通过房间号/邀请链接加入朋友。没有注册、充值、公开房间列表或广告。

版本：`0.3.0`，2026-09-17。

部署目标：Cloudflare Workers + Static Assets + Durable Objects。手机端优先，首版只包含飞行棋和斗地主。

> 当前仓库由 ChatGPT 协助整理并提交。Cloudflare 公网和真机仍需实际部署后验收。

## 功能

- 昵称 + 房间号进入
- 预设猫咪头像
- 实时聊天与弹幕
- 飞行棋 2–4 人
- 斗地主固定 3 人
- 断线重连
- Workers + Durable Objects 房间架构
- 手机端牌桌与棋盘界面

## Cloudflare 部署

```sh
npm install
npx wrangler login
npm test
npm run check:deploy
npm run deploy
```

主要配置在 `wrangler.jsonc`，正式入口为 `src/worker.js`。

## 规则修改位置

- 飞行棋：`src/games/flying.js`
- 斗地主牌型：`src/games/cards.js`
- 斗地主流程：`src/games/doudizhu.js`
- 房间与聊天：`src/server/room.js`
- 手机前端：`public/app.js`、`public/style.css`

## 状态

本地规则、房间与联机测试已通过；Cloudflare 公网、Durable Object 休眠恢复、实际手机网络仍需上线验收。

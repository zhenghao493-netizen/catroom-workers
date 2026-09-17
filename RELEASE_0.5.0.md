# 猫猫开局 0.5.0：获确认的三主题飞行棋联机版

## 实际变更

- 保留原大厅、斗地主、昵称/房间号、猫头像和房间聊天。新飞行棋页面为 `/flight/?room=六位房间号`。
- 晴空、夜航、奶油沿用已确认的独立试玩版；所有棋盘节点、合法走法、落点、撞机与动画引用同一份 `public/flight/engine.js`。
- 骰子由 Worker 生成；前端只发送棋子编号。前端仅用服务器返回的 `plans` 做高亮和落点预览。选中后需再次确认，等待服务器期间不会重复提交。
- 旧规则的正在进行中棋局暂停，原数据不按新坐标重解释；房主明确结束旧局后重新准备。房间、聊天、玩家、胜场保留。
- 前端源压缩包只在构建阶段还原。线上请求不解压、不抓 GitHub 棋盘图片。

## 部署

保留原 Worker `catroom-games`、ROOMS 绑定和 v1 SQLite migration。Cloudflare Git 部署命令仍是 `npx wrangler deploy`；Wrangler 的 build hook 自动执行 `node scripts/build.mjs`，先测试再发布 dist 静态文件。`/api/health` 与 `/release.json` 均显示 0.5.0。

## 检验范围

`node --test release-tests/*.test.mjs`：55 项通过，包括原 35 项规则测试、15 项房间/同步测试、5 项客户端消息时序测试。规则测试包含 33408 组组合、576 个撞机场景与 100 局自动对局。

`python release-tests/browser-render.py`：390px 手机尺寸下 30 项通过，实际运行生产 UI 模块和控制器；网络使用内存传输替身。验证逐格动画、跳格/飞行/反弹、合法高亮、确认、三主题、聊天转义、旧版提示。运行结果不会作为 Cloudflare 公网或手机真机验收。

房间测试使用 Durable Object 存储/WebSocket 替身，不是远程生产房间。公网部署完成仍应进行朋友间开房、异网加入和断线恢复验收。

## 回退注意

升级采用新飞行棋 ruleset `flight-lab-1`，没有新增 Durable Object 类/namespace。不要直接用旧规则重新解释新棋局的进度编号。

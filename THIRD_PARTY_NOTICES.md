# 第三方代码、图片与许可说明

## 斗地主规则模块

`src/games/cards.js` 的牌型分组、规则类别和连续点数判断部分，改编自：

- 仓库：<https://github.com/liukaijv/poker-ddz>
- 原文件：`src/card_rules.ts`
- 检查到的原文件 Git blob：`cea909f0bbcbd3950c5f60ef51ed8c21075cb764`
- 原作者版权声明：Copyright (c) 2018 noop
- 许可：MIT，全文保存在 `vendor/poker-ddz.LICENSE`。

本版不是把上游整款游戏搬入网页。采用整数牌号并重构了规则接口，修正组点数排名、四带两对排名和带牌判断，增加比较、提示牌组合生成、测试以及明确的带牌约定。发牌、叫分、回合、房间、Worker、移动端界面等是本项目独立实现。

筛选过 `17fun/17fei`，但检查到的根目录未列出明确许可证，同时其服务器框架也不同；未复制该仓库的游戏代码或美术素材。

## 飞行棋棋盘模板

飞行棋棋盘视觉坐标与棋盘底图基于：

- 仓库：<https://github.com/netmanfisher/chinese-ludo>
- 项目：Chinese Ludo / 中国飞行棋
- 许可：MIT，全文保存在 `vendor/chinese-ludo.LICENSE`。

本项目仅复用其棋盘底图与坐标布局；朋友房、联机同步、掷骰/移动裁定、断线恢复和规则状态仍由本项目的 Cloudflare Durable Objects 后端负责。可移动棋子高亮和当前阵营提示为本项目适配。棋盘图片通过 Worker 代理并缓存上游公开资源。

## 预设头像

本版包含 `public/avatars/maodie-photo.png`，来源与固定提交见 `public/avatars/SOURCES.md`。六个头像编号共用同一张本地照片，由界面样式做不同卡片化展示；其余头像为项目内的备用猫咪 SVG。

**该第三方照片的授权链未核实；本项目 MIT 许可证不授予该照片的使用权。** 目前用于朋友间原型。若公开宣传、商业化或扩大分发，应先核实授权或更换为权利明确的素材。

## 工具和字体

Wrangler 是开发/部署依赖，遵循其自身许可。界面使用设备自带字体，没有捆绑字体文件或外部字体 CDN。

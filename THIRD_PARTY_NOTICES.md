# 第三方代码、图片与许可说明

## 斗地主规则模块

`src/games/cards.js` 的牌型分组、规则类别和连续点数判断部分，改编自：

- 仓库：<https://github.com/liukaijv/poker-ddz>
- 原文件：`src/card_rules.ts`
- 原文件 Git blob：`cea909f0bbcbd3950c5f60ef51ed8c21075cb764`
- 原作者版权声明：Copyright (c) 2018 noop
- 许可：MIT，全文保存在 `vendor/poker-ddz.LICENSE`。

本项目未直接嵌入该上游整款游戏。发牌、叫分、回合、朋友房、Workers/Durable Objects、飞行棋和移动端界面均按本项目结构实现。

## 预设头像

本版包含 `public/avatars/maodie-photo.png`，来源与固定提交见 `public/avatars/SOURCES.md`。三个耄耋选项共用同一张本地照片，由界面样式做不同卡片化展示；其余头像为项目内的备用猫咪 SVG。

**该第三方照片的授权链未核实；本项目 MIT 许可证不授予该照片的使用权。** 目前用于朋友间原型。若公开宣传、商业化或扩大分发，应先核实授权或更换为权利明确的素材。

运行时不依赖第三方图片 CDN；头像由本项目的 Workers Static Assets 提供。

## 工具和字体

Wrangler 是开发/部署依赖，遵循其自身许可。界面使用设备自带字体，没有捆绑字体文件或外部字体 CDN。

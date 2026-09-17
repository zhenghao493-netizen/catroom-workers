# 第三方代码、图片与许可说明

## 当前飞行棋（0.5.0）

使用本项目独立 Flight 引擎与矢量棋盘。飞机图标来自 https://github.com/tabler/tabler-icons ，原路径 `icons/filled/plane.svg`，核查的 Git blob 为 `d991c65ed78c05d5f443f1daad4c9dc92ed762b1`。Copyright (c) 2020-2026 Paweł Kuna，MIT 全文保存在 `vendor/tabler.LICENSE`，构建时复制到 `/flight/LICENSE.Tabler.txt`。运行时不使用外部图标 CDN。

0.4 曾使用 `netmanfisher/chinese-ludo` 棋盘图片和坐标（MIT，旧许可保留在 `vendor/chinese-ludo.LICENSE`）；0.5 当前飞行棋不再加载其图片或使用其规则。

## 斗地主

`src/games/cards.js` 改编自 https://github.com/liukaijv/poker-ddz 的 `src/card_rules.ts`，核查 blob `cea909f0bbcbd3950c5f60ef51ed8c21075cb764`。Copyright (c) 2018 noop，MIT 全文保存在 `vendor/poker-ddz.LICENSE`。0.5 不修改现有斗地主服务端规则。

## 预设头像

`public/avatars/maodie-photo.png` 来源与固定提交见 `public/avatars/SOURCES.md`。六个头像编号共用同一张本地照片，由界面做配色区分。

**该第三方照片的授权链未核实；本项目 MIT 许可证不授予该照片使用权。** 用于朋友间原型；公开宣传、商业化或扩大分发前应核实授权或更换权利明确素材。

## 工具和字体

Wrangler 遵循其自身许可。页面使用系统字体，不上传字体文件，也不依赖字体 CDN。测试替身和场景注入仅用于本地测试脚本，不存在于生产 Worker 路由中。

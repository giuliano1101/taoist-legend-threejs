# 项目介绍与传播素材

当前材料是私有准备稿，不代表已经开源或上线。发布时先完成公开前清单，再按实际授权与功能调整。

## 项目信息

- 中文名称：道士林正英传奇。
- 英文工作名：Taoist Legend。
- 类型：第三人称灵异武侠动作原型。
- 技术：Three.js 0.180.0、Spark 2.4.0、Gaussian Splatting、Web Audio、HTML/CSS。
- 运行：桌面浏览器，本地 HTTP，Node.js 22+。
- 当前状态：私有开发归档，公开准备中。

## 一句话

一个让你在红灯古巷中御火挥剑、迎战破土邪祟的 Three.js 动作游戏。

## 短介绍

《道士林正英传奇》将实时角色与高斯点云古巷结合：越肩瞄准、火球、四式月牙剑气、连续怪物波次，再用体积雾、位置哭声与港漫界面营造灵异武侠氛围。所有游戏运行资源在本地加载，无需在线 AI 服务。

## 长介绍

项目从空地里的角色控制试验开始，逐步加入原骨架动画、点云环境导航、相机避障、战斗判定和连续波次。画面重点是烘焙古巷与实时人物的融合：雾根据点云深度衰减，法术照亮人物和周围空气；声音随护士的距离与状态变化。界面从生图概念稿拆成可复用图标、面板和横幅，再由真实 HTML 控件承载动态信息。这是一个可以本地游玩的 Web3D 原型，也记录了角色、扫描环境与程序化特效共同工作时的实际取舍。

## English short description

A local Three.js action prototype set in a misty Gaussian-splat alley, featuring over-the-shoulder combat, fireballs, crescent sword combos, emerging enemies and spatial horror audio.

## GitHub About 描述

Three.js + Gaussian splatting 的本地第三人称道士动作游戏：越肩战斗、体积雾火、月牙剑气与怪物波次。

建议 Topics：`threejs`、`webgl`、`gaussian-splatting`、`javascript`、`action-game`、`procedural-animation`、`web-audio`。

## 视频内容提纲

1. 先展示最终古巷与战斗。
2. 说明最早只有一个角色和空地，为什么要补骨骼与动画。
3. 展示点云、导航和碰撞各自负责什么。
4. 用侧身走路、雾硬边、翘脚等问题解释迭代过程。
5. 展示相机、火焰、月牙和护士破土的细节。
6. 用生图原型与真实 HUD 解释“素材如何接进代码”。
7. 以声音、加载流程和本地启动结束。

## 图片

| 文件 | 身份与用途 |
| --- | --- |
| `media/repository-hero.webp` | ImageGen 生成的 3:1 横幅，用于 README；不是实机 |
| `media/social-preview.jpg` | 同一横幅的压缩分享版，用于介绍文稿；GitHub 社交预览需另在设置上传 |
| `media/gameplay.webp` | 实际开发游戏画面 |
| `media/fireball.webp` | 实际火焰与瞄准画面 |
| `media/sword-qi.webp` | 实际月牙剑气画面 |
| `media/pause.webp` | 实际统一菜单画面 |

画面含第三方游戏素材，公开用途与底层素材一并审核。无官方演员或电影合作背书。不使用“全部原创资产”“商业 3A 已完成”“所有手机流畅”等未经验证的说法。

# 素材身份与公开状态

根目录 MIT 许可只涵盖项目自编代码与文档。第三方代码、字体、模型、点云、录音及媒体不因位于本仓库而被重新授权。当前私有存档包含运行必需素材；**尚不能直接把完整资产包当作 MIT 素材公开再分发**。

| 路径 / 素材 | 来源与作用 | 许可或公开处理 |
| --- | --- | --- |
| `dist/vendor/three*.js` 及相关加载器、工具、Pass | Three.js 0.180.0 | MIT；保留本地许可 |
| `dist/vendor/libs/fflate.module.js` | fflate，FBX 解压 | MIT；见 `LICENSES/fflate-MIT.txt` |
| `dist/vendor/spark/` | Spark 2.4.0、SPZ 相关实现 | 按随附 MIT/SPZ 许可保留署名 |
| `dist/fonts/kongjing-serif.woff2` | Noto Serif SC 的界面子集 | SIL OFL 1.1；见随附 OFL |
| `dist/assets/taoist-source/skin.fbx` 与五张 PNG | 用户提供的道士角色、原剑与材质 | 原始资产的公开再分发授权未提供；公开前取得许可或替换 |
| `dist/assets/enemy/nurse.glb` | 用户提供的护士模型，Blender 转换并嵌入贴图 | 原模型公开再分发授权未提供；公开前取得许可或替换 |
| `dist/assets/corridor.spz` | 用户提供的约 200 万点古巷 | 原始环境公开再分发授权未提供；公开前取得许可或替换 |
| `dist/assets/corridor-navigation.json` | 由该环境分析产生的导航数据 | 可能依赖环境权益；公开候选导出一并排除 |
| `dist/assets/locomotion-reference.json` | Three.js Xbot / Mixamo 动作提取的关节方向 | 非项目从零动作；公开再分发条件需确认，候选导出排除 |
| `dist/assets/audio/zombie-*.ogg` | mvVoiceActing 的女性低吼、战斗声与哭声，经裁切混音 | 来源记录 CC0 1.0；保留出处与编辑说明 |
| `dist/assets/audio/fog-alley-night.ogg` | 项目原创程序合成《雾巷·夜行》 | 项目制作；生成脚本在 `tools/compose_horror_bgm.py` |
| `dist/assets/audio/hero-*.ogg` | 用户视频人声分离后，参考音色经本地 Qwen3-TTS 合成 | 原片及声音参考并非自有录制；公开前明确授权或换自有音色 |
| `dist/assets/cover/` | 内置 ImageGen 生成的港漫游戏封面 | 包含致敬性人物/名称表达；公开前审核人物、名称与参考素材 |
| `dist/assets/ui/*.png` | 内置 ImageGen 生成的图标、暗漆面板与古铜横幅 | 项目生成视觉，不自动纳入代码 MIT；保留制作说明，公开前确认媒体授权方案 |
| `docs/media/repository-hero.webp`、`social-preview.jpg` | 本次 ImageGen 制作的虚构年轻道士宣传图 | 宣传插画，不是实机；不暗示演员背书。公开前与项目品牌一起审核 |
| `docs/media/gameplay.webp` 等 | 本项目真实运行截图 | 包含上述游戏素材；公开前与底层素材一并确认 |
| `tools/game.ico` | 从游戏封面人物裁切制作 | 与封面相同的公开前审核要求 |

`docs/runtime-manifest.json` 记录当前运行文件的大小和 SHA-256，不含绝对路径。FBX 中的绝对磁盘路径与作者元数据已在归档副本清理；网格、骨骼数组与动画未因此重新绑定。

## 护士录音出处

- mvVoiceActing: [Female Zombie](https://freesound.org/people/mvVoiceActing/sounds/238644/)。
- mvVoiceActing: [rpg - zombie girl battle sounds.wav](https://freesound.org/people/mvVoiceActing/sounds/347349/)。
- mvVoiceActing: [Girl Crying](https://freesound.org/people/mvVoiceActing/sounds/218184/)。
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。项目下载来源记录标注该许可；编辑操作见 `dist/assets/audio/NURSE-VOICE-CREDITS.txt`。

## 没有随仓库上传的内容

早期角色、未使用动画源、GLB 已嵌入的重复贴图、旧封面、原始电影、参考人声与伴奏、AI 模型权重、缓存、浏览器配置、开发聊天、本机路径版文稿、备份 ZIP 和重复发布树。它们不是运行此版本所需文件。

公开候选导出采取保守策略：默认排除全部游戏 `dist/assets/`、宣传媒体与图标，保留代码、文档和第三方库；不会擅自认定任何权利已经取得。完整开源可玩版还需要补齐可再分发的替代资源。

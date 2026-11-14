# 从私有归档到公开项目

**当前状态：私有。此清单与导出工具都不会自动改变 GitHub 可见性。**

代码与文档的 MIT 许可已准备，完整可玩素材的公开授权尚未完成。不能将“仓库文案已完成”等同于“全部素材已经可以开源”。

## 权利与身份

- [ ] 取得道士、护士模型与贴图的公开再分发许可，或替换为可再分发资产。
- [ ] 确认古巷 SPZ 与衍生导航数据的公开许可，或替换。
- [ ] 确认 Xbot / Mixamo 方向参考的发布条件，或换自有/明确许可动作。
- [ ] 对参考声音取得适用授权，或换自有录音/授权音色并重新合成。
- [ ] 审核名称、封面与人物表达，确认是否保留致敬名称或采用新品牌。
- [ ] 为项目生成美术明确媒体许可；保留第三方字体、代码和 CC0 录音的署名。
- [ ] 审核宣传截图，它们包含底层模型与场景。

## 代码、隐私和历史

- [ ] 运行 `npm run check`、`npm test`，复查所有将公开文件。
- [ ] 检查 FBX/GLB 元数据、图片 metadata、账号、密钥、邮件、订单、聊天与机器路径。
- [ ] 检查完整 Git 历史、分支、tag、Release、Artifacts、Wiki、Issue、Actions 日志与附件。
- [ ] 若要移除受限资源，确认它们也不留在旧提交。**只删除当前版本文件，再把此仓库设为 public，仍会暴露历史资产。**
- [ ] 未完成资源授权时，使用 `npm run export:public` 生成源码候选；在新仓库或经明确批准的干净历史发布，不能靠当前树的删除代替历史处理。

## 可运行性与文案

- [ ] 若公开完整游戏，验证替代资源、路径、碰撞、动画与声音正常，更新 manifest。
- [ ] 将 README 状态改为实际发布状态，不保留“私有准备”或虚假开源表述。
- [ ] 补充所选公开路线的下载/资源安装说明，更新版本、截图和变更日志。
- [ ] 在干净环境检查 npm 启动、静态服务、暂停重置、技能与加载失败。
- [ ] 按需要设置 GitHub 社交预览图、Topics、私密漏洞报告和 Issue 表单。

## 最终公开动作

- [ ] 由仓库所有者明确发出公开指令。
- [ ] 根据已完成的权利与历史审核，选择完整发布或干净源码发布。
- [ ] 最后才改变可见性，复查 GitHub 显示的 Public/Private 状态。

可参考 [GitHub 仓库许可说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) 与 [仓库可见性说明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility)。本次归档不执行这些公开动作。

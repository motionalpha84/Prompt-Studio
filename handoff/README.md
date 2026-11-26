# 词序 1.0.0 前端交付 · 流萤

双击 `index.html` 即可离线预览。这个包包含本项目 `src/` 正式 React 界面、`core/` 当前逻辑和 `demo/` 浏览器 API 适配器。演示使用少量真实词条样例。

## 浏览器演示

- 左侧栏提供词库、方案、历史和设置导航。词库可在 Danbooru / Gelbooru 两站之间切换；标签可搜英文名或中文释义，并查看真实分类和说明。
- 样例沿用 0.3.0 交付的草稿、片段及 hair_past_waist 差异场景，并包含真实释义/来源 `danbooru/get`、`gelbooru/shoebox` 和真实待考证条目 `danbooru/smlie`。`smlie` 保留空释义、`kind=缺口` 与核查来源，点击标签可查看“待考证”和证据。数据版本字段为 `1.0.0`；样例字段与桌面 API 对齐：`name`、`translation`、`translation_kind`、`translation_source`、`category`、`type`、`count`、`aliases`、`note`、`favorite`、`uses`、`custom`。
- 主题、字号、草稿及演示词库变更保存在当前浏览器 `localStorage` 的 `cixu-frontend-demo-v3` 键。清除此键后刷新可恢复内嵌样例。
- 浏览器演示将无法实现的托盘、置顶、全局快捷键和系统数据目录操作标为桌面版功能；它使用浏览器本地存储、文件选择/下载和剪贴板权限。
- 所有字体已内联进单文件 `index.html`，离线打开无需服务器。可编辑字体文件位于 `src/fonts/`，对应 SIL Open Font License 1.1 文本随包提供：`Outfit-OFL.txt` 与 `JetBrainsMono-OFL.txt`。

## 目录与构建

- `src/`：完整正式界面，包括 `Fireflies.jsx`、词库面板、设置、共享 UI、样式和字体。
- `core/`：当前 `seed.mjs`、`prompt.mjs`、`csv.mjs`、`store.mjs`；独立包的 SQLite 工作区高度校验允许 72–2000 px，与界面拖动范围一致。
- `demo/fixture.json`：小型真实双站演示词库、初始草稿和片段。
- `demo/browser.js`：实现 `window.cixu.call(method,args)`，保存数据到当前浏览器，不启动本地服务。
- `build.mjs`：将 React、Lucide、字体和样例内联为离线 `index.html`。

如需重新生成：

```sh
npm install
npm run build
```

根项目也可运行 `node scripts/handoff.mjs`，从当前 `src/` 与 `core/` 同步独立包、构建预览并生成 `词序-前端交付-1.0.0.zip`。历史 zip 不会被包含在新版包里。

正式 EXE、桌面入口和系统能力由桌面宿主提供；本包验证的是独立浏览器预览。

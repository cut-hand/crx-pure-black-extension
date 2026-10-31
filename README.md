# 纯黑浏览 · Pure Black

让网页拥有你喜欢的底色。适用于桌面版 Chrome 和 Edge 的 Manifest V3 扩展，当前版本 **1.8.2**。

![背景调色盘](docs/screenshots/02-color-palette.jpg)

## 功能

- 一键使用纯黑、炭黑、石墨、午夜蓝、松林绿或暖墨背景。
- 支持取色器、十六进制色值和明暗滑块。
- 按区域背景调整文字对比度，为失去分隔的卡片补上细轮廓线。
- 支持网站开关，并自动保存本机设置。
- `Alt+Shift+D` 切换全局配色，搭配与 Logo 一致的太阳、月亮动画。
- 尽量保留照片、视频和彩色内容，对部分小型深色图标改善可见性。
- 适配网易云音乐用背景 PNG 绘制的内容栏、用户面板、榜单和歌曲表格，保留封面、轮播图与按钮图标。
- 保留 YouTube 播放器及嵌入视频的遮罩、控制条和字幕配色，避免半透明图层被改成黑色遮挡。
- 忽略播放器内部更新和普通计数文字的无效重扫，隐藏页面暂停自动扫描，回到前台后补上配色。

## 安装

1. 下载 [1.8.2 安装包](https://github.com/cut-hand/crx-pure-black-extension/releases/download/v1.8.2/Pure-Black-1.8.2.zip) 并解压，或下载本仓库源码。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启“开发者模式”。
3. 点击“加载解压缩的扩展程序”，选择直接包含 `manifest.json` 的文件夹。
4. 刷新已经打开的网页，在工具栏固定“纯黑浏览”图标。

修改源码后，在扩展管理页点击“重新加载”并刷新网页。如果快捷键冲突，可点击扩展弹窗中的快捷键入口重新设置。

## 1.8.2 更新

- 修复嵌入式 YouTube 视频被黑色遮罩挡住的问题，保留播放器画面、控件和字幕。
- 补齐网易云音乐内容栏、用户面板、榜单和表格，以及 Chrome 开发者文档语言、外观菜单的配色。
- 减少播放器和普通计数文字更新触发的重扫；后台页面暂停扫描，回到前台后恢复。
- 弹窗收窄至 330px，移除冗余标题与说明，快捷键与 Logo 对齐，并显示浏览器实际绑定。

已有用户解压覆盖原目录后，重新加载扩展并刷新网页即可；设置沿用，不新增权限。

## 隐私与权限

无需扩展账号，不使用广告、统计服务或远程执行代码。配色和用户主动设置的网站开关保存在 `chrome.storage.local`；网页样式判断在浏览器本机完成，不向开发者上传网页内容或浏览记录。

权限用途：`storage` 保存本机设置；`activeTab` 在用户打开弹窗时识别当前网站并预览配色；HTTP/HTTPS 内容脚本用于在普通网页中应用颜色。

完整说明见 [隐私政策](PRIVACY.md)。

## 开发与验证

扩展本身无需安装依赖或构建。测试需要 Node.js 与桌面版 Chrome：

```sh
npm install
npm test
npm run test:music
npm run test:language
npm run test:netease
npm run test:video
npm run test:performance
npm run test:youdao
npm run test:whats-new
```

`npm run test:language` 验证语言、外观菜单的 Shadow DOM 配色与关闭恢复，加上 `-- --live` 可检查真实 Chrome 开发者文档。

测试默认使用本机 Chrome。可设置 `BROWSER_CHANNEL` 选择其他 Playwright 支持的浏览器通道。`npm run test:netease` 使用离线页面验证网易云面板、iframe 导航、颜色切换及关闭恢复；加上 `-- --live` 可检查网易云真实首页的 HTML/CSS（屏蔽页面脚本以稳定验证，需联网）。

`npm run test:video` 在跨域 iframe、隐私增强嵌入和 YouTube 播放页面中播放本地生成的视频流，对比扩展开关前后的画面像素，检查透明遮罩、控制条、动态图层和自选背景；加上 `-- --live` 检查 Chrome 开发者文档中的真实 YouTube 播放器。`npm run test:performance` 在大 DOM 页面上统计样式读取和属性移除次数，并检查播放器更新、文字变化、隐藏/恢复、样式表变更和关闭恢复。

`npm test` 使用真实浏览器渲染与按键、模拟扩展 API，覆盖配色预览、存储、明暗滑块、文字对比度、图标、区域轮廓、背景渐变、关闭恢复、快速切换与动画安全策略兼容性。有道翻译、音乐理论网站和 Chrome“新变化”内容页测试需要网络连接；“新变化”检查依赖桌面版 Chrome。测试不替代在浏览器中实际加载扩展后的检查。

## 目录

| 位置 | 内容 |
| --- | --- |
| `manifest.json`、`*.js`、`*.css`、`popup.html` | 可直接加载的扩展源码 |
| `icons/` | 原创月亮图标及开启、关闭两套工具栏 PNG |
| `scripts/package-extension.py` | 生成仅包含扩展运行文件的 ZIP |
| `CHROMEWEBSTORE.md` | 商店文案、权限理由和发布状态 |
| `qa/` | 浏览器回归测试 |
| `docs/screenshots/` | 商店展示图，1280×800 JPEG |
| `docs/CHANGELOG.zh-CN.md` | 版本记录与详细说明 |
| `downloads/` | 可解压安装的发布包 |

## 使用边界

特殊网页样式可能需要单独适配，可通过网站开关恢复原样。Chrome 内置界面和扩展商店等受保护页面无法修改；“新变化”内嵌的普通 HTTPS 网页内容可应用配色。暂不处理通用 Shadow DOM、canvas 内部画面以及图片中的文字。大型动态网页会产生额外样式计算开销。

本扩展调整网页配色，不修改浏览器标签栏或显示器 HDR 设置。最终黑位由显示器面板和硬件设置决定。

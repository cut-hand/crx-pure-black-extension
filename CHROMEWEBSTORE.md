# Chrome Web Store — 纯黑浏览 · Pure Black

> Last Updated: 2026-10-31 · Version: 1.8.2

## Store Listing

**Extension Name**：纯黑浏览 · Pure Black

**Short Description**：自定义网页背景色与黑色程度，提供一键预设、文字对比度适配和网站开关。

**Detailed Description**

纯黑浏览让网页使用你喜欢的背景色，并调整文字对比度，保留照片、视频和彩色内容。

一键选择纯黑、炭黑、石墨、午夜蓝、松林绿或暖墨，也可使用取色器、十六进制色值和黑色程度滑块调节。配色和网站开关自动保存在本机。

在不同网站单独启用或暂停配色。需要切换时，点击工具栏图标，或使用 Alt+Shift+D；Mac 上显示对应的 ⌥⇧D。弹窗显示浏览器实际绑定的快捷键，也可点击进入快捷键设置。

开启和关闭时显示太阳、月亮切换动画。尽量保留图片、视频和有色按钮，为部分小型深色图标改善可见性。

本次更新修复部分嵌入视频黑屏，补齐网易云音乐和 Chrome 开发者文档菜单的暗黑配色，减少动态页面的无效处理，并精简弹窗布局。

使用方法：安装后打开普通网页，点击扩展图标启用页面配色，选择背景颜色。遇到不兼容的网站，可使用网站开关恢复原样。浏览器内置页面和扩展商店等受保护页面无法修改；特殊网页也可能需要单独适配。

无需注册扩展账号，不含广告或统计服务。网页配色在本机处理，不向开发者上传网页内容、浏览记录或设置。

支持与反馈：https://github.com/cut-hand/crx-pure-black-extension/issues

**Category**：Productivity（更新时沿用现有分类，无需为本次修复更改）

**Single Purpose**：允许用户自选普通网页的背景颜色，并调整文字对比度和按网站启用状态。

**Primary Language**：简体中文

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
| --- | --- | --- | --- |
| Store Icon | 128×128 PNG | Ready | icons/awake-128.png |
| Screenshot 1 | 1280×800 JPEG | Ready | docs/screenshots/01-pure-black.jpg |
| Screenshot 2 | 1280×800 JPEG | Ready | docs/screenshots/02-color-palette.jpg |
| Screenshot 3 | 1280×800 JPEG | Ready | docs/screenshots/03-light-palette.jpg |
| Small Promo Tile | 440×280 PNG | Ready, optional | docs/screenshots/promo-440x280.png |
| Marquee Promo Tile | 1400×560 PNG | Ready, optional | docs/screenshots/marquee-1400x560.png |

截图使用示例阅读页展示当前版本的实际配色和弹窗，分别为纯黑、松林绿和浅灰自选色；示例页不包含第三方品牌素材。旧版 03-sun-moon.jpg 保留作历史素材，不放入 1.8.2 商店更新文件夹。

## Permissions Justification

权限与上一版本相同，无新增权限。

| Permission | Type | Justification |
| --- | --- | --- |
| storage | permissions | Saves the user's background color, global enable state, and per-site enable preferences locally so the chosen appearance persists between browser sessions. |
| activeTab | permissions | When the user opens the extension popup, identifies the active site's hostname and sends the selected appearance to that tab for immediate preview. It does not record browsing history. |
| http://*/* and https://*/* | content_scripts.matches | Applies the user's chosen background and readable text colors automatically on ordinary websites and their frames. This requires inspecting displayed element styles locally. Site switches and Chrome site-access settings let the user limit where it runs. No page content is transmitted. |

**Remote Code**：No. All executable code is bundled in the extension package. No remotely hosted JavaScript, eval, analytics SDKs, or external code loading.

## Privacy & Data Use

**Does the extension collect user data?** No data is collected by or transmitted to the developer or third parties. Local processing and local preference storage are described below and in PRIVACY.md.

读取网页元素、显示样式、当前网站主机名，以及浏览器允许读取的部分已加载小图标像素，仅在本机用于配色和图标可见性。用户主动配置的网站主机名、开关和配色保存在 chrome.storage.local，不记录访问时间、历史列表或网页正文。

不收集或传输身份信息、健康信息、财务信息、认证信息、个人通信、位置、浏览历史、用户活动或网页内容。无广告、统计和远程同步。

- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for purposes unrelated to the extension's core functionality.
- [x] Data is NOT used for creditworthiness or lending purposes.

## Privacy Policy

**Privacy Policy URL**：https://github.com/cut-hand/crx-pure-black-extension/blob/main/PRIVACY.md

政策正文保持不变，本次未改变数据处理方式。已检查公共仓库中该文件存在。

## Distribution / Developer Info

本次更新现有商店条目，保留已有可见性、地区、发布者名称和联系邮箱；仓库未提供这些后台字段的已核实值，不在此编造或覆盖。现有商店条目 ID 和在线版本尚未从后台核实。

**Support URL**：https://github.com/cut-hand/crx-pure-black-extension/issues

**Homepage URL**：https://github.com/cut-hand/crx-pure-black-extension

## Version History

| Version | Date | Changes | Chrome Web Store status |
| --- | --- | --- | --- |
| 1.8.2 | 2026-10-31 | 视频黑屏修复、网易云与菜单配色、扫描优化、330px 精简弹窗 | Draft — 未上传或提交审核 |

GitHub Release 状态与商店审核状态相互独立。商店已上传版本如高于或等于 1.8.2，需先选择更高版本号并重新打包；不能重复上传相同版本。

## Review Notes

保留照片和视频；YouTube 嵌入文档不做配色，播放页保留播放器子树。通用 Shadow DOM、canvas 内部画面和图片内文字不在通用处理范围；开发者文档两个已知菜单通过组件的公开颜色变量适配。复杂动态页面仍可能产生样式计算开销，不承诺所有网站零卡顿。

本文件记录发布资料，不随扩展运行 ZIP 分发。ZIP 仅包含 manifest.json、运行脚本、样式、popup.html 与图标。

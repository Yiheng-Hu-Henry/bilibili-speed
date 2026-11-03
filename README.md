# B 站倍速 · Bilibili Speed Control

把 B 站播放器的倍速上限从 **2.0×** 放宽到 **0.25×–16×**，任意档位可调。
Chrome / Edge 的 Manifest V3 扩展。

---

## 功能

| 入口 | 操作 |
| --- | --- |
| 弹出面板 | 0.25–16 滑块连续调速；1×–8× 预设一键切换；输入框填精确值（如 3.75） |
| 悬浮球 | 单击开关；滚轮每格 0.25×（按住 Shift 每格 0.05×）；双击回到 3×；可拖动并记忆位置，全屏可见 |
| 快捷键 | `Alt + 3` 开关 · `Alt + ↑ / ↓` 调速 · `Alt + 0` 复位 3× |

另外可关闭悬浮球、保持音调不变（加速时人声不尖）。所有改动即时生效，无需刷新页面。

## 安装

1. 下载 `bilibili-speed.zip` 并解压，得到 `bilibili-speed` 文件夹（不要删、改、移）
2. 地址栏打开 `chrome://extensions`（Edge 为 `edge://extensions`）
3. 打开右上角「开发者模式」
4. 点「加载已解压的扩展程序」，选中上述文件夹
5. 刷新已打开的 B 站页面

图文步骤见 [B站倍速-安装使用说明.docx](./B站倍速-安装使用说明.docx)。

## 实现要点

B 站播放器通过 `video.playbackRate` 控制速度，但每次切集、切清晰度、点播放器倍速都会把它重写回合法区间。扩展注入页面的 **MAIN world**，覆写 `HTMLMediaElement.prototype.playbackRate` 的 setter，使播放器写入的值统一落到配置档位；再加 500 ms 轮询与 `play` / `ratechange` / `loadedmetadata` 事件兜底，防止被冲掉。

配置经 `chrome.storage.local` 存储，通过页面属性与自定义事件在隔离世界和主世界之间双向同步，因此改设置不需要刷新。

```
bilibili-speed/
├── manifest.json
├── icons/            # 16 / 32 / 48 / 128
├── popup/            # 设置面板
└── src/
    ├── bridge.js     # 隔离世界：读写配置、转发指令
    └── main.js       # 主世界：接管 playbackRate、渲染悬浮球
```

## 说明

- 仅调整本地播放速度，不读取、不上传账号信息，不点赞、不发弹幕
- 无网络请求，逻辑全部在本地运行
- 安装时提示「读取和更改 bilibili.com 上的数据」是同类扩展的通用权限提示
- 卸载：扩展管理页「移除」，再删除文件夹

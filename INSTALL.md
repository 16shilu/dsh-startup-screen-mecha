# 安装说明

图文说明：[PDF](docs/install-guide.zh-CN.pdf) · [Word](docs/install-guide.zh-CN.docx)。安装文件请从 [Releases](https://github.com/16shilu/dsh-startup-screen-mecha/releases/latest) 下载。

## Windows 官方 DSH 桌面版

1. 先打开 DSH 并进入一次工作区。在“应用 → 管理 dsh 命令…”中安装桌面版自带命令。
2. 新开终端运行 `dsh --version` 确认命令可用。新版桌面端不可用 npm 全局版 dsh 代替其内置命令。
3. 从系统托盘完全退出 DSH。在 TGZ 所在文件夹打开 PowerShell，执行：

```powershell
dsh plugin --profile desktop add ".\dsh-startup-screen-1.4.0-mecha.3.tgz"
```

4. 重开 DSH，在“设置 → 启动动画”启用、保存，再点“立即预览”。

分享 ZIP 需要完整解压；TGZ 不需要解压。安装同名插件会更新当前 profile 内的 `dsh-startup-screen`。

## 网页版

仅适用于已经能正常运行 `dsh web` 的环境。在 TGZ 所在目录执行：

```bash
dsh plugin --profile web add ./dsh-startup-screen-1.4.0-mecha.3.tgz
```

完成后重启 `dsh web`。桌面与网页 profile 分别安装。

## 排错与卸载

- 命令找不到：回到桌面版的命令管理面板安装 / 修复，再新开终端。
- 不能修改 desktop：核对命令来源，使用 Desktop 注册的命令。
- profile 未初始化：先打开并进入一次 DSH 工作区，再完全退出。
- 没有动画：核对启用状态与播放模式；窗口仅隐藏时不会重新启动页面。
- 图标不动：系统“减少动态效果”启用时会回退静态图。
- 无声音：先点击 / 按键解锁，再检查语音与音效开关及音量。

先完全退出桌面端，再卸载：

```bash
dsh plugin --profile desktop remove dsh-startup-screen
```

[官方桌面说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md) · [官方 CLI 说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md)。

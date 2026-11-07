# 桌面端适配与验证范围

用户安装步骤见 [INSTALL.md](INSTALL.md) 及 [PDF](docs/install-guide.zh-CN.pdf) / [Word](docs/install-guide.zh-CN.docx)。

官方桌面版由 Electron 管理 `desktop` profile。先运行桌面版初始化 profile，再完全退出，使用桌面应用注册的 `dsh` 命令安装插件。窗口关闭可能只是隐藏；需要从托盘退出。

动画的 Host 半侧通过 `webServer` 注册素材、配置和运行时路由并注入首屏。客户端自举覆盖“资源路由存在、但首屏注入没有生效”的情形；它依然需要 Host 的素材路由。不能将“Host 缺失时不抛异常”当作该环境一定能够播放动画。

Windows 标题栏适配在播放时临时调整标题栏探针，并在完成、跳过、重播清理时还原。宿主的内部实现发生变化时可能需要相应适配。

自动验证覆盖 Host 路由与配置、客户端设置、自举、布局、媒体播放及清理；尚未在其他电脑的真实 DSH 桌面环境完成实装测试。发布不等于兼容所有 DSH 版本或第三方桌面壳。

参考：[官方 Desktop 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md)。

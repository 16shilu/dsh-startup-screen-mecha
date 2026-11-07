图标动画查找与当前来源

检查日期：2026-11-06。只读游戏安装数据，未启动游戏或修改游戏文件。

本机目录：<游戏安装目录>/Game/MechaBreak/MechaBREAK_Data。

- 检查直接可见的视频、GIF、动画和 Logo 文件名；没有确认独立的本体图标动画文件。
- 使用 UnityPy 1.25.4 读取 resources.assets、globalgamemanagers.assets、globalgamemanagers、sharedassets0.assets 的对象目录。常驻资源中没有确认游戏图标 VideoClip；resources.assets 中唯一的 AnimationClip 名为 StrackTraceEntry，与图标无关。
- globalgamemanagers.assets 包含 UILoginLogoCell（MonoScript，Path ID 13142），表明有专用登录 Logo 组件；组件名不能单独证明其引用的动画内容。
- bundles 目录包含 59,934 个 .assetBundle。跨 16 个分片抽样的文件均为 SeasunC 自定义封装，不能按标准 UnityFS 直接读取。没有完成其全部内容解析，不能断言游戏内没有图标动画。

当前接入的动图来自[解限机官方 GIPHY 的 Logo Loading 发布页](https://giphy.com/stickers/MechaBREAK-eic-mecha-break-mechabreak-jlUkYjMqoT9iK87w2B)。发布账号自述为 Mecha BREAK 官方账号并链接游戏官网。原文件为 240×203 透明 GIF，51 帧，循环约 6 秒；视觉为三角外框轻微错位及中央晶体旋转。

该官方发布文件按原字节打包为 lib/assets/mecha-emblem-animated.gif，没有重绘、重新生成帧或改速。它不是本次从本机 SeasunC 分包提取的文件。页面离线读取随包素材，不依赖 GIPHY 在线服务。

用户提供的 triangle_icon_extracted.png 与 解限机 logo-CN.png 也按原字节保留。中文 Logo 用于页首和开场；静态图标用于减少动态效果及加载失败时的回退。全部文件哈希见 MECHA-ASSET-SOURCES.json。

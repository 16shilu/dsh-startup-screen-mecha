解限机原始音频映射 · 1.4.0-mecha.3

所有默认音频取自用户本机《解限机》安装目录的 Wwise 音频包，解码为原始采样率、原声道的 16-bit PCM WAV。没有用 TTS 模仿游戏播报，也没有生成替代按键音。

| 用途 | 文件 | 游戏事件 |
| --- | --- | --- |
| 点击、阶段提示 | mecha-ui-click.wav | Play_UI_Common_Click_S |
| 确认按钮 | mecha-ui-confirm.wav | Play_UI_Common_Confirm |
| 按钮悬停 | mecha-ui-hover.wav | Play_UI_Common_Hover_S |
| 转场 | mecha-ui-transition.wav | Play_UI_MainScreen_Transition |
| 启动 | mecha-ui-start.wav | Play_UI_MainScreen_Operation_Start_0317 |
| 系统就绪 | mecha-ui-ready.wav | Play_UI_MainScreen_Common_Confirm_0317 |
| 方晶粒子填充 | mecha-voice-particles.wav | Play_Vox_Launch_Animation_Chord_System_01 |
| 驾驶员同步率稳定 | mecha-voice-sync.wav | 同一启动录音，连续第二段 |
| 意识投影系统启动完成 | mecha-voice-system.wav | 同一启动录音，连续第三段 |
| 欢迎回来 | mecha-voice-welcome.wav | Play_Vox_MainScreen_Welcome_Back |

完整启动录音保存在 mecha-voice-startup.wav（约 5.015 秒），可独立试听。三段切点为第 61,740 和 138,474 个采样帧，即 1.40 和 3.14 秒；切点位于句间静音。三段 PCM 按顺序拼接与完整录音完全相同，没有删减采样。

默认配置：voiceSource=asset、sfx=audio、voiceCue=false、voiceLead=0。前两次人工确认没有对应的游戏播报，只播放原始确认音效。动画速度只调整视觉等待，不改变原声播放速度。素材缺失时保持静音，继续启动；TTS 和合成音效需在设置中手动选择。

浏览器首次点击或按键后解锁声音。跳过、重播与结束会停止音源。HTTP 模式通过 WebAudio 解码；直接打开 file:// 预览时使用原生音频元素。语音与界面音效音量分别控制。

素材事件、原始 WEM 编号、包内偏移和 SHA-256 见 [MECHA-ASSET-SOURCES.json](docs/MECHA-ASSET-SOURCES.json)。提取使用 [wwiser](https://github.com/bnnm/wwiser) 与 [vgmstream](https://github.com/vgmstream/vgmstream)。游戏素材权利归各自权利人，不适用代码的 MIT 许可。

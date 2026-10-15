# README preview recordings / README 动图录制说明

Recorded from the live [KiwiCue deployment](https://kiwicue.nz) on 16 October 2026 (Pacific/Auckland). The deployed interface can differ from a checked-out feature branch. The five assistants were also checked against `origin/main` at `849e20b`.

于新西兰时间 2026 年 10 月 16 日录制自 [KiwiCue 线上站点](https://kiwicue.nz)。线上界面可能与本地功能分支不同；五位助手的信息也已对照 `origin/main` 的 `849e20b` 核实。

## What the GIFs show / 录制范围

- `ai-bot.gif`: opening the assistant, choosing all five characters, animated orbs, matching colour themes, typing a question and switching the voice-input language. The text is entered without sending a question.
- `demo.gif`: real event discovery, event details, saving as a guest, finding the saved event and switching the interface language.
- Both GIFs include an overlaid mouse pointer that follows actual Playwright mouse movements. Clicks have a coloured halo. Character animation is sampled from the running page.

- `ai-bot.gif`：打开助手、切换全部五位角色、动态球体、主题配色、输入问题和切换语音输入语言；问题仅输入，不发送。
- `demo.gif`：真实活动浏览、详情、访客收藏、收藏页和界面语言切换。
- 两张 GIF 都带有跟随真实 Playwright 鼠标移动的指针，点击时显示彩色光圈；角色动画逐帧采样自实际页面。

## API limitation at capture time / 录制时的接口限制

The live `POST /api/ask` returned HTTP 503 during the attempted question recording. The AI preview therefore covers the working interface interactions. It does not include a successful generated reply or recommendation sequence. No model responses or recommendation results were fabricated.

尝试录制提问时，线上 `POST /api/ask` 返回 HTTP 503。因此当前 AI 动图展示可用的界面交互，不包含成功的生成回复或推荐过程；未伪造模型回复或推荐结果。

## Re-recording / 重新录制

Run the commands in the README from the repository root. The scripts require the project's Playwright dependency, a Playwright Chromium installation and Python with Pillow (`python -m pip install Pillow` if needed).

在仓库根目录运行 README 中的命令。需要项目已有的 Playwright、Playwright 的 Chromium，以及安装了 Pillow 的 Python（缺少时运行 `python -m pip install Pillow`）。

Use `--with-reply` only when the AI service is available. It sends one real question through the normal public flow and records its result. It consumes the configured quota and model budget. The default capture sends no AI requests and uses a fresh guest browser context, with no account credentials.

AI 服务恢复后，可使用 `--with-reply` 发送一次真实问题并录制结果；请求遵循正常公开流程，消耗配置的次数和模型预算。默认录制不发送 AI 请求，使用全新的访客浏览器上下文，不包含账号凭据。

Temporary PNG frames and manifests stay in `output/playwright/`. Only the finished GIFs, still images and these recording notes are intended for Git. GIFs are silent; voice controls are visible, but audio playback needs the live site.

PNG 临时帧及清单保存在 `output/playwright/`，只把成品 GIF、静态截图和录制说明加入 Git。GIF 无音轨；动图可展示语音控件，实际语音播放请在线体验。

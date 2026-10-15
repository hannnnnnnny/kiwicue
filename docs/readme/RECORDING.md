# README preview recordings / README 动图录制说明

Recorded from the live [KiwiCue deployment](https://kiwicue.nz) on 16 October 2026 (Pacific/Auckland).

于新西兰时间 2026 年 10 月 16 日录制自 [KiwiCue 线上站点](https://kiwicue.nz)。

## Jev activity matching / Jev 活动匹配

The main `ai-bot.gif` records one real guest request: **“Markets this weekend”**. The bot understands the market and weekend conditions, searches the covered listings, and displays five matching activity cards ranked with Jev. The recorded cards fall on 17–18 October in Auckland local time and have positive relevance scores. Their prices remain labelled unknown where the source has no verified price.

主图 `ai-bot.gif` 实录一次真实访客提问：**“Markets this weekend”**。Bot 理解“市集”和“本周末”的条件，查询已覆盖的来源，再显示经 Jev 排序的五张匹配活动卡片。返回活动的奥克兰本地日期均为 10 月 17–18 日，匹配分数为正；来源没有核实票价时，卡片保留“价格未知”说明。

In this recording, the first visible card was observed about **4.3 seconds** after submission. This is one browser observation during screenshot capture, not a benchmark or a latency guarantee. The GIF preserves the recorded waiting time. Its loop opens on the completed result list so the README thumbnail shows the feature, then plays the question and response sequence. No results are injected or mocked.

本次录制中，提交问题约 **4.3 秒**后观察到第一张活动卡片。这是截图录制时的一次浏览器观测，不是性能基准或延迟保证。GIF 保留录制时的实际等待时间；循环从已完成的结果列表开始，让 README 缩略图直接展示功能，再播放提问和返回结果的过程。没有注入或模拟推荐结果。

DeepSeek handles the conversation and calls search; Jev evaluates outing preferences and candidate relevance. The application applies the conditions against its actual listings. [Response evidence](./ai-bot-evidence.json) records the submitted question, returned filters, cards, scores and observed timings. The earlier character-only preview was recorded while the Supabase project was paused; the project was resumed before this replacement capture.

DeepSeek 负责对话并调用搜索；Jev 判断出行偏好、评估候选活动相关性；应用用条件筛选实际活动数据。[响应证据](./ai-bot-evidence.json)记录了提交的问题、返回条件、活动卡片、分数及观测时间。上一版角色展示录制时 Supabase 项目处于暂停状态；本次替换录制前已恢复项目。

## Other preview / 其他预览

`demo.gif` retains the separate walkthrough of event details, guest saves, the saved-events page and the Chinese language switch. Both GIFs include a visible pointer following actual mouse movement and a click halo. GIFs are silent.

`demo.gif` 保留独立的活动详情、访客收藏、收藏页和中文切换演示。两张 GIF 都有跟随实际鼠标移动的可见指针，以及点击光圈。GIF 无音轨。

## Re-recording / 重新录制

Run from the repository root with the project's Playwright dependency, Playwright Chromium and Python with Pillow (`python -m pip install Pillow` if needed):

在仓库根目录运行，需使用项目已有的 Playwright、Playwright Chromium，以及安装了 Pillow 的 Python（缺少时运行 `python -m pip install Pillow`）：

```bash
npx playwright install chromium
node scripts/capture-readme-demo.mjs
python scripts/encode-readme-demo.py ai
```

This sends one real question and consumes the configured quota and model budget. It uses a fresh guest session. A read-only clone of the live response stream supplies evidence without changing the response delivered to the UI. Capture fails on API errors, missing or nonmatching cards, relaxed conditions, absent positive relevance scores, or tool-protocol text in the reply.

这会提交一次真实问题，消耗正常次数额度和模型预算，并使用全新的访客会话。脚本只读取真实响应流的副本以保留证据，不改变界面接收到的响应。接口报错、卡片缺失或不匹配、条件放宽、没有正向相关性分数，或回复中出现工具协议文本时，录制会失败。

To also regenerate the general walkthrough, add `--product` to the capture command and run `python scripts/encode-readme-demo.py demo`. Temporary PNG frames and manifests stay in the ignored `output/playwright/` directory. The published outputs are the finished AI GIF, results screenshot and response evidence.

如需重录普通活动流程，在录制命令后添加 `--product`，再运行 `python scripts/encode-readme-demo.py demo`。临时 PNG 帧和清单保存在 Git 忽略的 `output/playwright/`；发布内容为 AI 动图、结果截图和响应证据。

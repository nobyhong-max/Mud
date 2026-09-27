# Mac 本机 Agent 一键任务（Task 1）

在 **jerryMac** 的 Cursor 里：New Agent → 把下面整段贴进去发送即可。

---

你在住宅网 Mac 上执行乐古娱乐 Task 1。云端机房 IP 会被 Cloudflare 403，必须在本机浏览器完成。

## 目标
站点：https://lokgujd2t.com（打不开就试 lokgu.com / lokguwin.com 跳转后的登录域）

用户已可登录。三家非皇冠厅：**樂古體育、FB體育、利记體育**。

1. 登录（若需新号可自注册；账号可写到 `/cursor/stores/self/internal/lokgu-account.md`，密码不要发到聊天）。
2. 分别进入三家厅 → **足球 → 今日**。
3. 对比赛程与抽样赔率（5–10 场）：是否同源。
   - 相同 → 结论：可去重，只保留一路源。
   - 不同 → 用间隔 1–120 秒（建议 30s）试抓几轮「足球·今日」，证明定时抓取可行。
4. 更新 `/cursor/stores/self/docs/sports-sources-comparison.md`（写清实盘结论）。
5. 截图放到 `/cursor/stores/self/media/`，回传绝对路径。

若 `/cursor/stores/self` 在本机不存在，写入 Cursor 该 Project 的 Context/Agent Store 对应目录，并回报实际路径。

完成后用中文短结：同/不同、证据、是否已去重或已测定时抓取。

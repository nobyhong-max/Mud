# jerryMac 本机执行（Task 1）

在 Mac Cursor Agent 对话中粘贴发送即可（住宅网，避免 Cloudflare 机房拦截）。

---

打开 https://lokgujd2t.com（或 lokgu.com / lokguwin.com 跳转登录）。

对比三家厅「足球 → 今日」是否同源：
1. 樂古體育
2. FB體育
3. 利记體育
（排除皇冠）

相同 → 结论可去重只留一路。
不同 → 运行：

```bash
cd /path/to/legu-yule
python3 scripts/sports-scrape/fetch_football_today.py --interval 30 --rounds 3 --out ./samples/live
```

把结论写入 Cursor Project Context：
`/cursor/stores/self/docs/sports-sources-comparison.md`
截图：`/cursor/stores/self/media/`
账号仅写：`/cursor/stores/self/internal/lokgu-account.md`

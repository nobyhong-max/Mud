---
cursor:
  subagentId: "bc-3ad735c6-5db0-5614-8301-19ab7d99b2c9"
---

# sports-scrape（待命脚手架）

平台登录与体育厅 API 尚未从 Cloud VM 打通，本目录提供 **可配置间隔抓取** 的本地测试脚手架，供恢复访问后验证「足球·今日」定时拉取。

## 运行

```bash
cd /cursor/stores/self/internal/sports-scrape
python3 fetch_football_today.py --interval 30 --rounds 3 --out ./samples
```

环境变量（可选）：

| 变量 | 含义 | 默认 |
|------|------|------|
| `LOKGU_BASE_URL` | 平台基址 | `https://lokgujd2t.com` |
| `LOKGU_COOKIE` | 登录后 Cookie | （空则仅探测连通性） |
| `LOKGU_SOURCES` | 逗号分隔源名 | `乐古体育,利记体育` |
| `LOKGU_INTERVAL` | 秒（1–120） | `30` |

## 说明

- 间隔限制在 **1–120 秒**，默认 30s，测试请保持礼貌。
- 当前无真实体育 API 路径时，脚本会记录 HTTP 状态与响应摘要，便于对照是否仍被 Cloudflare 拦截。
- 接入真实接口后：把 `SOURCE_ENDPOINTS` 换成各厅「足球·今日」JSON/HTML 端点即可做同源对比。

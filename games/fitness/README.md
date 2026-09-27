# 燃动闯关

手机网页健身小游戏：**跟练 + 点按计次**，含闯关、今日挑战、连击加分与 localStorage 进度（得分 / 估算千卡 / 连续打卡 / 关卡解锁）。

## 本地试玩

在项目根目录或本目录启动静态服务（需 HTTPS 才能测 devicemotion；本地 HTTP 点按即可）：

```bash
cd games/fitness
python3 -m http.server 8766
```

浏览器打开 <http://localhost:8766>（手机与电脑同一局域网时可改用局域网 IP）。

## 操作

| 场景 | 操作 |
|------|------|
| 主页 | 选关卡或「今日挑战」 |
| 跟练 | **点按**中央大按钮计次；开合跳可 **上滑** 计次 |
| 平板支撑 | 约每 2 秒点按一次，节奏越稳连击越高 |
| 组间 | 休息倒计时，可「跳过休息」 |
| 可选 | 支持 `devicemotion` 的设备 **摇一摇** 可额外计次（无权限时不影响点按） |

## 目录

- `index.html` — 单页结构
- `css/style.css` — 移动端样式
- `js/game.js` — 关卡、计时、计次、进度

## 仓库

[nobyhong-max/Mud](https://github.com/nobyhong-max/Mud) · `games/fitness/`

与 `games/saolei`、`games/hub`、`games/zombie-cannon` 并列，不修改斗地主根目录页面。

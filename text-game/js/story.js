/** @typedef {{ sanity?: number, stamina?: number, charm?: number }} StatDelta */
/** @typedef {{ text: string, next: string, effects?: StatDelta, requires?: Partial<Record<'sanity'|'stamina'|'charm', number>> }} Choice */
/** @typedef {{ id: string, body: string[], choices?: Choice[], ending?: { id: string, title: string, score: number } }} Scene */

/** @type {Record<string, Scene>} */
export const SCENES = {
  start: {
    id: "start",
    body: [
      "23:07，雨点砸在玻璃幕墙上，像有人用指甲敲你的工位隔板。",
      "显示器右下角：<span class=\"highlight\">末班 404 路 · 23:27 · 公司门口站</span>。",
      "Leader 在群里又 @ 全员：「明早 demo，今晚谁把 PPT 再润一版？」",
      "你的背包里：半瓶凉掉的美式、一张皱巴巴的公交卡、还有今天没拆的快递。",
    ],
    choices: [
      { text: "关电脑，现在就走——末班车不等人", next: "leave_now" },
      { text: "再改两页 PPT，赌一把能赶上", next: "stay_late", effects: { sanity: -5 } },
      { text: "先去茶水间泡杯热的，缓一缓", next: "pantry", effects: { stamina: 5 } },
    ],
  },

  stay_late: {
    id: "stay_late",
    body: [
      "你多坐了十五分钟。PPT 的第 7 页终于不再像犯罪现场。",
      "抬头的瞬间，整层楼的灯灭了一半——只剩应急灯惨白地亮着。",
      "手机推送：404 路因道路积水，<span class=\"highlight\">预计延误 8 分钟</span>。",
    ],
    choices: [
      { text: "抓起包冲向电梯", next: "elevator", effects: { stamina: -10 } },
      { text: "走消防楼梯（七层，当健身了）", next: "stairs", effects: { stamina: -5 } },
    ],
  },

  leave_now: {
    id: "leave_now",
    body: [
      "你合上电脑，走廊安静得能听见自己的心跳。",
      "电梯口贴着一张手写条：「今晚 23:00 起 2 号梯检修，请走 1 号梯。」",
      "1 号梯的按钮灯闪了一下，像眨眼。",
    ],
    choices: [
      { text: "进 1 号梯", next: "elevator" },
      { text: "走楼梯", next: "stairs" },
      { text: "给还在工位的同事发消息：一起走？", next: "ask_coworker", effects: { charm: 5 } },
    ],
  },

  pantry: {
    id: "pantry",
    body: [
      "茶水间的微波炉显示 404，不知道是没电还是坏掉。",
      "你找到最后一包饼干，生产日期……看不清了。",
      "窗外闪电划过，映出对面楼有人影在窗口挥手——你确定那层是空置的。",
    ],
    choices: [
      { text: "吃掉饼干，出发", next: "leave_now", effects: { stamina: 10, sanity: -5 } },
      { text: "把饼干留给可能更饿的人，直接走", next: "leave_now", effects: { charm: 10 } },
    ],
  },

  ask_coworker: {
    id: "ask_coworker",
    body: [
      "阿杰秒回：「我在 B 区，刚把 demo 环境修好了。一起？」",
      "你们约在 1 楼大厅汇合。他塞给你一把折叠伞：「外面风大。」",
      "大厅电子屏滚动着：<span class=\"highlight\">404 路 · 即将进站</span>。",
    ],
    choices: [
      { text: "和阿杰一起冲向站台", next: "bus_with_friend", effects: { charm: 5, stamina: -5 } },
      { text: "让他先走，你去还前台借的充电器", next: "charger_quest", effects: { charm: -5 } },
    ],
  },

  elevator: {
    id: "elevator",
    body: [
      "电梯门合上，楼层显示从 7 跳到 5，又跳到 3——中间没有 4。",
      "广播里传来温柔的女声：「本次行程不经过您选择的楼层，请保持冷静。」",
      "镜子里，你的领带系得比刚才整齐。你明明没系领带。",
    ],
    choices: [
      { text: "按紧急呼叫", next: "elevator_help", effects: { sanity: -10 } },
      { text: "闭眼数到十，等门开", next: "lobby_weird", effects: { sanity: 5 } },
      { text: "从 3 楼爬消防梯下去", next: "stairs", effects: { stamina: -15 } },
    ],
  },

  elevator_help: {
    id: "elevator_help",
    body: [
      "对讲机里先是电流声，然后有人用很熟的语气说：「别慌，我下来接你。」",
      "像是……你自己。",
      "门叮一声打开，外面是 1 楼大厅，雨声灌进来，一切正常得过分。",
    ],
    choices: [{ text: "冲进雨里，往站台跑", next: "rain_run", effects: { stamina: -10, sanity: -5 } }],
  },

  lobby_weird: {
    id: "lobby_weird",
    body: [
      "门开在大厅。保安老李在打盹，收音机放着老歌。",
      "你经过前台时，访客登记本上有一行字，笔迹像你的：「404，已上车。」",
      "你还没出门。",
    ],
    choices: [
      { text: "当作没看见，出门等公交", next: "bus_stop" },
      { text: "问老李刚才有没有奇怪的人", next: "ask_guard", effects: { charm: 5 } },
    ],
  },

  ask_guard: {
    id: "ask_guard",
    body: [
      "老李揉揉眼：「奇怪？你们加班的都挺奇怪。」",
      "他递来一张干毛巾：「404 司机我熟，你招招手他就停。」",
      "你出门时，雨小了一档，像有人把难度调低了。",
    ],
    choices: [{ text: "到站台招手", next: "bus_stop", effects: { charm: 5 } }],
  },

  stairs: {
    id: "stairs",
    body: [
      "楼梯间有消毒水味，声控灯一层层亮下去。",
      "在 2 楼转角，地上有张公交卡——不是你的那张，但余额显示 404 元。",
      "下面传来公交车进站的提示音，很远，又很近。",
    ],
    choices: [
      { text: "捡起卡，继续跑", next: "bus_stop", effects: { sanity: -5 } },
      { text: "不碰，直接冲出门", next: "rain_run" },
      { text: "把卡交给大厅保安", next: "ask_guard", effects: { charm: 10, stamina: -5 } },
    ],
  },

  charger_quest: {
    id: "charger_quest",
    body: [
      "你跑回工位，前台小妹还在：「充电器？哦，那个啊……」",
      "她指了指你的包：「你不是已经挂在外面了吗？」",
      "你低头——充电线确实扣在拉链上。时间 23:24。",
    ],
    choices: [
      { text: "道歉开溜，全力冲刺", next: "rain_run", effects: { stamina: -20, charm: -5 } },
    ],
  },

  rain_run: {
    id: "rain_run",
    body: [
      "雨打脸生疼。路口红灯长亮，像故意和你作对。",
      "远处，404 路的头灯穿过水雾，像两只琥珀色的眼睛。",
      "你摸到口袋里的公交卡——余额刚好够一趟。",
    ],
    choices: [
      { text: "闯红灯冲过去（体力消耗大）", next: "bus_chase", effects: { stamina: -15, sanity: -5 } },
      { text: "等绿灯，稳稳走过去", next: "bus_stop", effects: { sanity: 5 } },
      {
        text: "大声喊司机等等（需要人缘）",
        next: "bus_with_friend",
        requires: { charm: 15 },
        effects: { charm: 5 },
      },
    ],
  },

  bus_stop: {
    id: "bus_stop",
    body: [
      "站牌下只有你和一张被雨打湿的海报：「404 路，通往你想回去的地方。」",
      "公交车滑行到站，车门打开，司机没回头：「上车吧，还有位置。」",
      "车厢里暖气混着雨味，像旧书页。",
    ],
    choices: [
      { text: "刷卡上车", next: "on_bus" },
      { text: "先看一眼车牌——真的是 404 吗？", next: "check_plate", effects: { sanity: -5 } },
    ],
  },

  check_plate: {
    id: "check_plate",
    body: [
      "车牌在雨里模糊又清晰：<span class=\"highlight\">沪A·40400</span>。",
      "司机叹气：「看够了吗？不上车的人，通常会走回家。」",
      "你想起访客登记本上的那行字，脊背一凉。",
    ],
    choices: [
      { text: "上车", next: "on_bus" },
      {
        text: "不上，步行回家（需要体力）",
        next: "walk_home",
        requires: { stamina: 25 },
      },
    ],
  },

  bus_chase: {
    id: "bus_chase",
    body: [
      "你扑上车门时，司机踩了脚刹车：「年轻人，慢点。」",
      "车厢里只有后排坐着一个穿工牌的人——像今天的你，也像明天的你。",
      "车开动了，窗外的雨变成细线，城市灯牌逐个亮起 404。",
    ],
    choices: [{ text: "找座位坐下", next: "on_bus" }],
  },

  bus_with_friend: {
    id: "bus_with_friend",
    body: [
      "阿杰在车门边拉你一把：「赶上了！」",
      "你们并排坐，他分享耳机里一首很吵的歌，你却觉得安心。",
      "404 路拐上高架，雨在窗上画地图。",
    ],
    choices: [{ text: "聊到哪一站？", next: "on_bus_friend" }],
  },

  on_bus: {
    id: "on_bus",
    body: [
      "你选了靠窗的位置。每一站名都熟悉，又有一个字对不上。",
      "广播：「下一站，<span class=\"highlight\">家·版本 1.0</span>。」",
      "你摸口袋，手机有 12 条未读——全是自己发给自己的草稿。",
    ],
    choices: [
      { text: "在这一站下车", next: "ending_home", effects: { sanity: 5 } },
      { text: "再坐一站，看看「版本 2.0」", next: "ending_loop", effects: { sanity: -15 } },
      {
        text: "和司机说：我想回「真正那一站」",
        next: "ending_true",
        requires: { sanity: 40 },
      },
    ],
  },

  on_bus_friend: {
    id: "on_bus_friend",
    body: [
      "阿杰在「家·版本 1.0」站跟你挥手：「明天 demo 见，别迟到。」",
      "你独自坐到终点，司机递来一张票根：「这张给你同事留了座，你的在下一班。」",
      "你愣住——下一班显示的时间，是今晚 23:27。",
    ],
    choices: [
      { text: "明白过来：你已经在车上了", next: "ending_friend" },
      { text: "要求下车核对", next: "ending_home" },
    ],
  },

  walk_home: {
    id: "walk_home",
    body: [
      "你走了四十分钟，鞋里灌满水，但星星出来了。",
      "路过公司门口，404 路正好再次进站——空车，司机对你点头。",
      "你到家倒头就睡，梦见 PPT 自己改好了。",
    ],
    choices: [{ text: "……", next: "ending_walk" }],
  },

  ending_home: {
    id: "ending_home",
    body: [],
    ending: { id: "home", title: "结局：家·版本 1.0", score: 100 },
  },
  ending_loop: {
    id: "ending_loop",
    body: [],
    ending: { id: "loop", title: "结局：无限末班车", score: 60 },
  },
  ending_true: {
    id: "ending_true",
    body: [],
    ending: { id: "true", title: "结局：404 已找到", score: 150 },
  },
  ending_friend: {
    id: "ending_friend",
    body: [],
    ending: { id: "friend", title: "结局：给同事留座", score: 120 },
  },
  ending_walk: {
    id: "ending_walk",
    body: [],
    ending: { id: "walk", title: "结局：湿鞋胜利", score: 90 },
  },
  ending_collapse: {
    id: "ending_collapse",
    body: [],
    ending: { id: "collapse", title: "结局：倒在楼梯间", score: 30 },
  },
};

export const ENDING_COPY = {
  home: [
    "门牌还是老样子。猫在脚边蹭过，像什么都没发生过。",
    "你把公交卡放进抽屉——余额变成 <span class=\"highlight\">∞</span>。",
    "手机最后一条推送：Leader 说 demo 延期了。你笑出声，然后真的去睡了。",
  ],
  loop: [
    "「家·版本 2.0」站台上，站着另一个你，正在等 404。",
    "司机回头，脸是马赛克：「乘客，你已经在路上了。」",
    "你醒来还在工位，显示器显示 23:07。末班车还有 20 分钟。",
    "<span class=\"dim\">（提示：再试一次，在到站前和司机对话。）</span>",
  ],
  true: [
    "司机第一次正眼看你：「那一站，要你自己报站名。」",
    "你深吸气，说出小区那个拗口的老名字。",
    "车停了。雨停了。楼道的灯坏的那一盏，今晚偏偏亮了。",
    "你得分拉满——因为你在雨夜里，还记得「家」怎么写。",
  ],
  friend: [
    "你回到家，阿杰发来消息：「刚才那班车好怪，像只有半辆。」",
    "你回复：「但我赶上了。」",
    "窗外 404 路空车驶过，像替谁完成了一次接力。",
  ],
  walk: [
    "第二天你迟到五分钟，Leader 皱眉。",
    "你把湿鞋晒在工位下，小声说：「至少我没把 PPT 留到梦里。」",
    "阿杰给你带了热豆浆。人间值得。",
  ],
  collapse: [
    "声控灯灭了。你坐在台阶上，听见远处 404 的喇叭，越来越远。",
    "保安找到你时，你说：「下一班……我一定……」",
    "<span class=\"dim\">（体力归零。试试茶水间补给或别硬闯红灯。）</span>",
  ],
};

export const INITIAL_STATS = { sanity: 70, stamina: 60, charm: 50 };
export const SAVE_KEY = "bus404-save-v1";
export const ENDINGS_KEY = "bus404-endings-v1";

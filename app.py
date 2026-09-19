"""
微乐斗地主本地记牌与出牌参考 · Streamlit 入口。
仅学习模拟：不读内存、不挂钩进程、不抓游戏窗口、不自动点击。
"""

from __future__ import annotations

import json

import streamlit as st

from weile_ddz.cards import DECK, RANK_LABELS, SUITS, cards_by_ids, format_cards
from weile_ddz.rules import beats, classify, is_valid_play
from weile_ddz.scorer import recommend
from weile_ddz.state import Bucket, CardState, Role, load_example
from weile_ddz.stats import remaining_rows, threat_summary
from weile_ddz.vision import VisionNotConnected, ingest_detections, recognize_image

DISCLAIMER = """
**仅供个人编程学习与本地模拟。** 微乐用户协议禁止外部辅助 / 记牌器 / 自动化。
不要在真实对局里使用，不要把游戏画面实时注入本工具。用于实战有封号风险，也不公平。
下面的评分是规则加权参考，**不是真实胜率**。
"""


def _state() -> CardState:
    if "game" not in st.session_state:
        st.session_state.game = CardState()
        st.session_state.pick_mode = Bucket.IN_HAND.value
        st.session_state.message = ""
    return st.session_state.game


def _note(text: str) -> None:
    st.session_state.message = text


def render_board(state: CardState) -> None:
    mode = st.session_state.pick_mode
    st.caption("点牌记入手牌 / 已出 / 未知。点点数可快速收下该点下一张未知牌。")
    header = st.columns([1, 1, 1, 1, 1, 1.2])
    header[0].markdown("**点**")
    for i, (_, symbol, name, _) in enumerate(SUITS):
        header[i + 1].markdown(f"**{symbol}{name[0]}**")
    header[5].markdown("**我/出/?**")

    for rank in RANK_LABELS:
        cols = st.columns([1, 1, 1, 1, 1, 1.2])
        if cols[0].button(rank, key=f"rank-{rank}", use_container_width=True):
            value = next(card.value for card in DECK if card.rank == rank)
            if mode == Bucket.UNKNOWN.value:
                pool = [
                    card
                    for card in DECK
                    if card.value == value and state.bucket[card.id] != Bucket.UNKNOWN.value
                ]
                if pool:
                    state.set_card(pool[0].id, Bucket.UNKNOWN)
                    _note(f"把 {pool[0].display()} 改回未知")
                    st.rerun()
            else:
                unknown = [card for card in state.get_remaining_unknown() if card.value == value]
                if unknown:
                    state.set_card(unknown[0].id, Bucket(mode))
                    _note(f"记下 {unknown[0].display()}")
                    st.rerun()
        row_cards = [card for card in DECK if card.rank == rank]
        for i, card in enumerate(row_cards):
            bucket = state.bucket[card.id]
            mark = {"in_hand": "手", "seen": "出", "unknown": "?"}.get(bucket, "?")
            if cols[i + 1].button(f"{card.symbol}{card.label} {mark}", key=card.id, use_container_width=True):
                state.set_card(card.id, Bucket(mode))
                _note(f"{card.display()} → {mode}")
                st.rerun()
        mine = sum(1 for card in row_cards if state.bucket[card.id] == Bucket.IN_HAND.value)
        seen = sum(1 for card in row_cards if state.bucket[card.id] == Bucket.SEEN.value)
        unk = sum(1 for card in row_cards if state.bucket[card.id] == Bucket.UNKNOWN.value)
        cols[5].write(f"{mine}/{seen}/{unk}")

    jokers = [card for card in DECK if card.is_joker]
    jcols = st.columns([1, 1, 1, 1, 1, 1.2])
    jcols[0].markdown("**王**")
    for i, card in enumerate(jokers):
        bucket = state.bucket[card.id]
        mark = {"in_hand": "手", "seen": "出", "unknown": "?"}.get(bucket, "?")
        if jcols[i + 1].button(f"{card.label} {mark}", key=card.id, use_container_width=True):
            state.set_card(card.id, Bucket(mode))
            _note(f"{card.label} → {mode}")
            st.rerun()
    jmine = sum(1 for card in jokers if state.bucket[card.id] == Bucket.IN_HAND.value)
    jseen = sum(1 for card in jokers if state.bucket[card.id] == Bucket.SEEN.value)
    junk = sum(1 for card in jokers if state.bucket[card.id] == Bucket.UNKNOWN.value)
    jcols[5].write(f"{jmine}/{jseen}/{junk}")


def main() -> None:
    st.set_page_config(page_title="微乐斗地主本地记牌（学习用）", layout="wide")
    state = _state()

    st.title("微乐斗地主 · 本地记牌与出牌参考")
    st.warning(DISCLAIMER)

    left, mid, right = st.columns([1.05, 1.55, 1.15])

    with left:
        st.subheader("对局")
        state.role = st.selectbox(
            "我的身份",
            [Role.FARMER.value, Role.LANDLORD.value],
            format_func=lambda x: "农民（17 张）" if x == Role.FARMER.value else "地主（20 张）",
            index=0 if state.role == Role.FARMER.value else 1,
        )
        state.call_score = st.select_slider("叫分（只改倍数，不改牌型）", options=[1, 2, 3], value=state.call_score)
        d1, d2 = st.columns(2)
        state.my_double = d1.checkbox("我加倍", value=state.my_double)
        state.opp_double = d2.checkbox("对方加倍", value=state.opp_double)
        st.caption(f"当前展示倍数：×{state.multiplier()}（不影响推荐）")

        st.subheader("点选模式")
        st.session_state.pick_mode = st.radio(
            "把点到的牌记到",
            [Bucket.IN_HAND.value, Bucket.SEEN.value, Bucket.UNKNOWN.value],
            format_func=lambda x: {"in_hand": "我的手牌", "seen": "已经打出", "unknown": "改回未知"}[x],
            horizontal=True,
        )

        c1, c2, c3 = st.columns(3)
        if c1.button("载入示例", use_container_width=True):
            st.session_state.game = load_example()
            _note("已载入示例中盘（上家对 5）")
            st.rerun()
        if c2.button("撤销", use_container_width=True):
            undone = state.undo()
            _note("没有可撤销" if undone is None else f"已撤销：{undone}")
            st.rerun()
        if c3.button("整局重置", use_container_width=True):
            state.reset()
            _note("已重置")
            st.rerun()

        counts = state.counts()
        st.metric("记牌闭合", f"{counts['in_hand']}+{counts['seen']}+{counts['unknown']}=54")
        st.write(
            f"手牌 **{counts['in_hand']}** / 开局 {state.expected_hand()}　"
            f"已出 **{counts['seen']}**　未知 **{counts['unknown']}**"
        )
        if st.session_state.message:
            st.info(st.session_state.message)

        st.subheader("上家刚出的牌")
        if state.last_play_ids:
            last_cards = cards_by_ids(state.last_play_ids)
            ok, play, msg = is_valid_play(last_cards)
            who = "我" if state.last_player == "me" else "上家"
            st.write(f"{who}：{format_cards(last_cards)}")
            if state.last_player == "me":
                st.caption("上一手是我出的。推荐按领出，等你手动记下别人是否压牌。")
            else:
                st.caption(msg if ok else f"上家牌不合法：{msg}")
        else:
            st.caption("空着表示轮到领出。")

        picked = st.multiselect(
            "指定上家出的牌（不能选手牌）",
            options=[card.id for card in DECK if state.bucket[card.id] != Bucket.IN_HAND.value],
            format_func=lambda cid: next(card.display() for card in DECK if card.id == cid),
        )
        b1, b2 = st.columns(2)
        if b1.button("设为上家牌", use_container_width=True) and picked:
            state.set_last_play(picked)
            _note("已记录上家牌")
            st.rerun()
        if b2.button("清空上家牌", use_container_width=True):
            state.clear_last_play()
            _note("上家牌已清空，按领出推荐")
            st.rerun()

        st.subheader("从手牌打出（仅本机记账）")
        hand_pick = st.multiselect(
            "选择我要出的牌",
            options=[card.id for card in state.my_hand()],
            format_func=lambda cid: next(card.display() for card in DECK if card.id == cid),
            key="hand_pick",
        )
        if st.button("确认从手牌打出"):
            if not hand_pick:
                _note("还没选手牌")
            else:
                ok, play, msg = is_valid_play(cards_by_ids(hand_pick))
                last = classify(cards_by_ids(state.last_play_ids)) if state.last_play_ids else None
                if not ok or play is None:
                    _note(msg)
                elif last and not beats(play, last):
                    _note(f"{msg}，但压不住上家")
                else:
                    state.play_from_hand(hand_pick)
                    _note(f"已打出 {msg}")
                    st.rerun()

    with mid:
        st.subheader("54 张记牌盘")
        render_board(state)
        st.subheader("剩余未知统计")
        threat = threat_summary(state)
        st.write(
            f"外面大约还剩：**2 × {threat['unknown_2']}**　"
            f"**A × {threat['unknown_A']}**　"
            f"**王 × {threat['unknown_jokers']}**　"
            f"可能成炸点数 ≥3 未知：**{threat['bomb_potential_ranks']}**"
        )
        st.caption(str(threat["note"]))
        rows = remaining_rows(state)
        st.dataframe(
            {
                "点": [row.label for row in rows],
                "我": [row.in_hand for row in rows],
                "已出": [row.seen for row in rows],
                "未知": [row.unknown for row in rows],
                "一家≥1（估）": [f"{round(row.p_at_least_1 * 100)}%" for row in rows],
                "一家成对（估）": [f"{round(row.p_pair * 100)}%" for row in rows],
                "一家炸弹（估）": [f"{round(row.p_bomb * 100)}%" if row.value <= 15 else "—" for row in rows],
            },
            hide_index=True,
            use_container_width=True,
        )

    with right:
        st.subheader("出牌参考（规则评分）")
        st.caption("只输出前 3 个推荐和 0–100 分。信息不全，不能当真实胜率。")
        last, top, _following = recommend(state)
        if last:
            st.write(f"要压：{last.text()}")
        else:
            st.write("当前按**领出**评估")
        if not top:
            st.info("没有可出组合。跟牌时可以过——本工具不会替你点游戏。")
        for i, item in enumerate(top, start=1):
            with st.container(border=True):
                st.markdown(f"**{i}. {item.play.text()}**　{item.score} 分 · 优先级 {item.priority}")
                for reason in item.reasons:
                    st.write(f"- {reason}")
                if st.button("按此从手牌打出", key=f"rec-{i}"):
                    try:
                        state.play_from_hand([card.id for card in item.play.cards])
                        _note(f"已按推荐打出 {item.play.text()}")
                    except ValueError as exc:
                        _note(str(exc))
                    st.rerun()

        st.divider()
        st.subheader("YOLO 预留")
        st.caption("不抓屏、不连游戏。可导入 detections JSON；图片识别未接入。")
        uploaded = st.file_uploader("导入识别 JSON", type=["json"])
        if uploaded is not None:
            try:
                payload = json.loads(uploaded.getvalue().decode("utf-8"))
                result = ingest_detections(state, payload)
                st.success(result["message"])
            except Exception as exc:  # noqa: BLE001
                st.error(str(exc))
        if st.button("尝试识别图片（应提示未接入）"):
            try:
                recognize_image(b"")
            except VisionNotConnected as exc:
                st.warning(str(exc))


if __name__ == "__main__":
    main()

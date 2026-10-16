import { useEffect, useRef } from "react";
import { careerById } from "../content/hunter/careers";
import { rankLabel } from "../content/hunter/power";
import { worldOf } from "../content/worlds";
import { cliffhanger, formatLikes, parseComments } from "../content/manhwa";
import { FOCUSES, focusOf, type Focus } from "../content/shared/focus";
import { titleById } from "../content/titles";
import { STAT_LABEL } from "../engine/game";
import type { Life, LogEntry, StatKey } from "../engine/types";
import { displayName, money } from "../engine/util";

export type TabId = "career" | "people" | "power" | "activities" | "soul";

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "career", emoji: "💼", label: "อาชีพ" },
  { id: "people", emoji: "❤️", label: "คน" },
  { id: "power", emoji: "⚔️", label: "พลัง" },
  { id: "activities", emoji: "🎯", label: "ทำ" },
  { id: "soul", emoji: "👻", label: "วิญญาณ" },
];

const VISIBLE_STATS: StatKey[] = ["health", "happiness", "smarts", "looks"];
const STAT_EMOJI: Record<StatKey, string> = { health: "❤️", happiness: "😊", smarts: "🧠", looks: "✨", luck: "🍀" };

export function StatBar({ k, value }: { k: StatKey; value: number }) {
  const tone = value < 25 ? "low" : value < 50 ? "mid" : "high";
  return (
    <div className="stat">
      <span className="stat-label">
        {STAT_EMOJI[k]} {STAT_LABEL[k]}
      </span>
      <div className="bar">
        <div className={`fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="stat-val">{value}</span>
    </div>
  );
}

function groupByAge(log: LogEntry[]) {
  const groups: { age: number; entries: LogEntry[] }[] = [];
  for (const e of log) {
    const g = groups[groups.length - 1];
    if (g && g.age === e.age) g.entries.push(e);
    else groups.push({ age: e.age, entries: [e] });
  }
  return groups;
}

export function LogLine({ e }: { e: LogEntry }) {
  if (e.kind === "system")
    return (
      <div className="sys-window inline">
        <div className="sys-head">ระบบ</div>
        <p>{e.text}</p>
      </div>
    );
  if (e.kind === "chapter") return <div className="chapter-head">{e.text}</div>;
  if (e.kind === "arc")
    return (
      <div className="arc-head">
        <span>{e.text}</span>
      </div>
    );
  if (e.kind === "comments") return <Comments items={parseComments(e)} />;
  return <p className={`log-line ${e.kind}`}>{e.text}</p>;
}

export function Comments({ items }: { items: { user: string; text: string; likes: number }[] }) {
  return (
    <div className="comments">
      <div className="comments-head">💬 ความคิดเห็นจากผู้อ่าน</div>
      {items.map((c, i) => (
        <div className="comment" key={i}>
          <span className="c-user">{c.user}</span>
          <span className="c-text">{c.text}</span>
          <span className="c-likes">♥ {formatLikes(c.likes)}</span>
        </div>
      ))}
    </div>
  );
}

export function MainScreen({
  life,
  busy,
  onAgeUp,
  onAutoRead,
  onFocus,
  onTab,
}: {
  life: Life;
  busy: boolean;
  onAgeUp: () => void;
  onAutoRead: () => void;
  onFocus: (f: Focus | undefined) => void;
  onTab: (t: TabId) => void;
}) {
  const focus = focusOf(life);
  const title = titleById(life.flags.title as string | undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const teaser = cliffhanger(life);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [life.log.length]);

  const job = life.job ? careerById(life.job.careerId) : undefined;
  const murim = life.worldId === "murim";
  const subtitle = job
    ? job.titles[life.job!.level - 1]
    : life.education.stage === "university"
      ? "นักศึกษา"
      : life.age >= 18
        ? murim ? "ผู้ไร้สังกัด" : life.worldId === "court" ? (life.wealth === "poor" ? "สามัญชน" : "ขุนนางไร้ตำแหน่ง") : "ว่างงาน"
        : murim ? "เด็กในหมู่บ้าน" : life.worldId === "court" ? (life.flags.academy ? "นักเรียนสถาบันจักรวรรดิ" : life.wealth === "poor" ? "เด็กสามัญชน" : `${life.gender === "f" ? "คุณหนู" : "คุณชาย"}น้อย`) : "นักเรียน";

  return (
    <div className="main">
      <header className="top">
        <div className="who" style={{ flex: 1, minWidth: 0 }}>
          <div className="name">
            {displayName(life)}
          </div>
          {title && <div className="title-tag">「{title.name}」</div>}
          <div className="sub">
            {subtitle} · {money(life, life.money)}
            {life.debt > 0 && <span className="debt"> · หนี้ {money(life, life.debt)}</span>}
          </div>
        </div>
        {life.power && (
          <div className={`rank-badge rank r${life.power.rank} ${life.worldId}`} title={worldOf(life.worldId).labels.rank}>
            {rankLabel(life, life.power.rank)}
          </div>
        )}
        <div className="age-badge">
          <span className="age-num">{life.age}</span>
          <span className="age-unit">ปี</span>
        </div>
      </header>

      <section className="stats">
        {VISIBLE_STATS.map((k) => (
          <StatBar key={k} k={k} value={life.stats[k]} />
        ))}
      </section>

      <div className="log" ref={logRef}>
        {groupByAge(life.log).map((g) => (
          <div className="log-group" key={g.age}>
            <div className="log-age">อายุ {g.age} ปี</div>
            {g.entries.map((e, i) => <LogLine e={e} key={i} />)}
          </div>
        ))}
        {teaser && <p className="cliffhanger">{teaser}</p>}
      </div>

      <footer className="bottom">
        <div className="focus-row" role="radiogroup" aria-label="เป้าหมายปีนี้">
          {FOCUSES.map((f) => (
            <button
              key={f.id}
              className={`focus-chip ${focus === f.id ? "on" : ""}`}
              title={`${f.name} — ${f.desc}`}
              aria-pressed={focus === f.id}
              onClick={() => onFocus(focus === f.id ? undefined : f.id)}
            >
              {f.emoji}
              <span className="focus-name">{f.name}</span>
            </button>
          ))}
        </div>
        <div className="age-row">
          <button className="age-btn" onClick={onAgeUp} disabled={life.queue.length > 0 || busy}>
            ＋ อายุ 1 ปี
          </button>
          <button className="read-btn" onClick={onAutoRead} disabled={life.queue.length > 0 || busy} title="เล่นปีที่ไม่มีอะไรสำคัญให้อัตโนมัติ แล้วหยุดเมื่อถึงฉากสำคัญ">
            ⏩ อ่านรวดเดียว
          </button>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className="tab" onClick={() => onTab(t.id)}>
              <span className="tab-emoji">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}

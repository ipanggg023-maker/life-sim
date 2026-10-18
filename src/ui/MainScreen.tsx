import { memo, useEffect, useRef, useState } from "react";
import { careerById } from "../content/hunter/careers";
import { rankLabel } from "../content/hunter/power";
import { worldOf } from "../content/worlds";
import { cliffhanger, formatLikes, parseComments } from "../content/manhwa";
import { titleById } from "../content/titles";
import { secretQuestStatus } from "../content/shared/systemQuest";
import { hasPhone } from "../content/phone";
import { STAT_LABEL } from "../engine/game";
import type { Life, LogEntry, StatKey } from "../engine/types";
import { displayName, loc, money } from "../engine/util";

export type TabId = "career" | "people" | "power" | "activities" | "phone" | "soul";

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "career", emoji: "💼", label: "อาชีพ" },
  { id: "people", emoji: "❤️", label: "คน" },
  { id: "power", emoji: "⚔️", label: "พลัง" },
  { id: "activities", emoji: "🎯", label: "ทำ" },
  { id: "phone", emoji: "📱", label: "มือถือ" },
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

const LOG_PAGE = 20;

/** กลุ่มบันทึกของปีหนึ่ง — ปีที่ผ่านไปแล้วไม่ต้องวาดใหม่ */
const LogGroup = memo(
  function LogGroup({ age, entries }: { age: number; entries: LogEntry[] }) {
    return (
      <div className="log-group">
        <div className="log-age">อายุ {age} ปี</div>
        {entries.map((e, i) => (
          <LogLine e={e} key={i} />
        ))}
      </div>
    );
  },
  (a, b) => a.age === b.age && a.entries.length === b.entries.length && a.entries[a.entries.length - 1] === b.entries[b.entries.length - 1],
);

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

// ซ่อน/แสดงความคิดเห็นผู้อ่านทั้งเกม (จำไว้ในเครื่อง)
function toggleComments() {
  const off = document.body.classList.toggle("no-comments");
  try { localStorage.setItem("ls.noComments", off ? "1" : ""); } catch { /* ไม่มี storage */ }
}
try { if (localStorage.getItem("ls.noComments")) document.body.classList.add("no-comments"); } catch { /* ไม่มี storage */ }

export function Comments({ items }: { items: { user: string; text: string; likes: number }[] }) {
  return (
    <div className="comments">
      <button className="comments-head" onClick={toggleComments}>
        <span className="ch-on">💬 ความคิดเห็นจากผู้อ่าน · แตะเพื่อซ่อน</span>
        <span className="ch-off">💬 ซ่อนความคิดเห็นอยู่ · แตะเพื่อแสดง</span>
      </button>
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
  onAgeUp,
  onTab,
}: {
  life: Life;
  onAgeUp: () => void;
  onTab: (t: TabId) => void;
}) {
  const title = titleById(life.flags.title as string | undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const teaser = cliffhanger(life);
  const quest = secretQuestStatus(life);
  // แสดงเฉพาะช่วงหลังของบันทึก — ชีวิตยาวๆ มีเป็นพันบรรทัด วาดทั้งหมดทุกครั้งทำให้แลค
  const [showYears, setShowYears] = useState(LOG_PAGE);
  const groups = groupByAge(life.log);
  const hidden = Math.max(0, groups.length - showYears);
  useEffect(() => setShowYears(LOG_PAGE), [life.id]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [life.log.length]);

  const job = life.job ? careerById(life.job.careerId) : undefined;
  const murim = life.worldId === "murim";
  const subtitle = job
    ? job.titles[life.job!.level - 1]
    : life.education.stage === "university"
      ? "นักศึกษา"
      : life.age < 3
        ? "ทารก"
        : life.age < 6 && !murim && life.worldId !== "court"
          ? "เด็กเล็ก"
      : life.age >= 18
        ? murim ? "ผู้ไร้สังกัด" : life.worldId === "court" ? (life.wealth === "poor" ? "สามัญชน" : "ขุนนางไร้ตำแหน่ง") : "ว่างงาน"
        : murim ? "เด็กในหมู่บ้าน" : life.worldId === "court" ? (life.flags.academy ? (life.flags.acaRank ? `นักเรียนสถาบัน ปี ${Math.min(5, life.age - 12)} · อันดับ ${life.flags.acaRank}` : "นักเรียนสถาบันจักรวรรดิ") : life.wealth === "poor" ? "เด็กสามัญชน" : `${life.gender === "f" ? "คุณหนู" : "คุณชาย"}น้อย`) : "นักเรียน";

  return (
    <div className="main">
      <header className="top">
        <div className="who" style={{ flex: 1, minWidth: 0 }}>
          <div className="name">
            {displayName(life)} <span className={`gender-tag ${life.gender}`}>{life.gender === "m" ? "♂" : "♀"}</span>
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

      {quest && (
        <div className="quest-strip">
          <b>[ภารกิจลับ]</b> {quest.text} · {quest.progress} · เหลือ {quest.left} ปี
        </div>
      )}

      <div className="log" ref={logRef}>
        {hidden > 0 && (
          <button className="btn small ghost log-more" onClick={() => setShowYears(showYears + LOG_PAGE)}>
            📜 ดูบันทึกก่อนหน้า ({hidden} ปี)
          </button>
        )}
        {groups.slice(hidden).map((g) => (
          <LogGroup key={g.age} age={g.age} entries={g.entries} />
        ))}
        {teaser && <p className="cliffhanger">{loc(life, teaser)}</p>}
      </div>

      <footer className="bottom">
        <button className="age-btn" onClick={onAgeUp} disabled={life.queue.length > 0}>
          ＋ อายุ 1 ปี
        </button>
        <nav className="tabs">
          {TABS.filter((t) => t.id !== "phone" || hasPhone(life)).map((t) => (
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

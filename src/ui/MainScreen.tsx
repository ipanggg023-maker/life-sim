import { memo, useEffect, useRef, useState } from "react";
import { careerById } from "../content/hunter/careers";
import { rankLabel } from "../content/hunter/power";
import { isRealistic, worldOf } from "../content/worlds";
import { cliffhanger, formatLikes, parseComments } from "../content/manhwa";
import { titleById } from "../content/titles";
import { secretQuestStatus } from "../content/shared/systemQuest";
import { hasPhone } from "../content/phone";
import { STAT_LABEL } from "../engine/game";
import type { Life, LogEntry, StatKey } from "../engine/types";
import type { YearReport } from "../engine/report";
import { worldSummary } from "../content/murim/life/world";
import { regionOf } from "../content/murim/life/region";
import { currentPlan, plansFor, setPlan } from "../content/murim/life/plan";
import { goalLine } from "../content/murim/life/goals";
import { disabilities, openInjuries } from "../engine/body";
import { displayName, loc, money } from "../engine/util";

export type TabId = "career" | "people" | "power" | "jianghu" | "activities" | "phone" | "soul";

const TABS: { id: TabId; emoji: string; label: string }[] = [
  { id: "career", emoji: "💼", label: "อาชีพ" },
  { id: "people", emoji: "❤️", label: "คน" },
  { id: "power", emoji: "⚔️", label: "พลัง" },
  { id: "jianghu", emoji: "🏯", label: "ยุทธภพ" },
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

/** สภาพบ้านเมืองตอนนี้ (ยุค · ราคาข้าว · วิกฤต) */
function WorldStrip({ life }: { life: Life }) {
  const w = worldSummary(life);
  return (
    <div className={`world-strip ${w.crisis ? "crisis" : ""}`} title={w.desc}>
      📍 {regionOf(life).name} · 🏮 {w.era} · ข้าว ×{w.price.toFixed(2)}
      {w.crisis && <b> · ⚠️ {w.crisis}</b>}
    </div>
  );
}

/** สรุปผลของปีที่เพิ่งผ่านไป */
function ReportCard({ report }: { report: YearReport }) {
  return (
    <div className="report-card">
      <div className="report-head">สรุป{report.to - report.from > 1 ? ` ${report.to - report.from} ปี (อายุ ${report.from}–${report.to})` : "ปีที่ผ่านมา"}</div>
      <div className="report-lines">
        {report.lines.map((x, i) => (
          <span key={i} className={`report-chip ${x.tone}`}>
            {x.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/** ความเสี่ยงที่รู้ได้ก่อนข้ามเวลา */
function skipRisks(life: Life): string[] {
  const r: string[] = [];
  if (life.stats.health < 35) r.push("สุขภาพย่ำแย่ — อาจตายระหว่างนี้");
  if (life.money < 0 || life.debt > Math.max(0, life.money)) r.push("เงินติดลบ/หนี้มาก");
  const w = worldSummary(life);
  if (w.crisis) r.push(`บ้านเมืองกำลังเผชิญ${w.crisis}`);
  if (life.age >= 60) r.push("อายุมากแล้ว");
  if (life.people.some((p) => p.alive && (p.relation === "father" || p.relation === "mother") && p.age >= 70)) r.push("พ่อแม่ชราภาพ");
  return r;
}

/** แผนหลักของปี + ข้ามเวลา */
function PlanBar({ life, onAgeUp }: { life: Life; onAgeUp: (years?: number) => void }) {
  const list = plansFor(life);
  const cur = currentPlan(life);
  const [, force] = useState(0);
  if (life.age < 3) return null;
  return (
    <div className="plan-bar">
      <label className="plan-pick">
        <span className="plan-label">แผนปีนี้</span>
        <select
          value={cur?.id ?? ""}
          onChange={(e) => {
            setPlan(life, e.target.value || undefined);
            force((n) => n + 1);
          }}
        >
          <option value="">🌾 ใช้ชีวิตตามปกติ</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="btn small ghost"
        disabled={life.queue.length > 0}
        onClick={() => {
          const r = skipRisks(life);
          if (r.length && !window.confirm(`ข้าม 3 ปี? ความเสี่ยงที่รู้ตอนนี้:\n• ${r.join("\n• ")}\n\n(จะหยุดทันทีถ้ามีเรื่องสำคัญให้ตัดสินใจ)`)) return;
          onAgeUp(3);
        }}
      >
        ⏩ 3 ปี
      </button>
      {cur && (
        <div className="plan-hint">
          ✅ {cur.pros} · ❌ {cur.cons}
        </div>
      )}
    </div>
  );
}

export function MainScreen({
  life,
  onAgeUp,
  onTab,
}: {
  life: Life;
  onAgeUp: (years?: number) => void;
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
          {murim ? (
            <>
              {life.flags.m17Epithet && <div className="title-tag">【{String(life.flags.m17Epithet)}】</div>}
              {life.power && <div className="sub">กำลังภายใน {Math.floor(Number(life.flags.mwQi ?? 0))} ปี</div>}
              {(!!life.flags.wanted || Number(life.flags.jailUntil ?? -1) > life.age || Number(life.flags.mourningUntil ?? -1) > life.age) && (
                <div>
                  {!!life.flags.wanted && <span className="status-chip">📜 ถูกประกาศจับ</span>}
                  {Number(life.flags.jailUntil ?? -1) > life.age && <span className="status-chip">⛓️ ติดคุก อีก {Number(life.flags.jailUntil) - life.age} ปี</span>}
                  {Number(life.flags.mourningUntil ?? -1) > life.age && <span className="status-chip calm">🕯️ ไว้ทุกข์</span>}
                </div>
              )}
            </>
          ) : (
            title && <div className="title-tag">「{title.name}」</div>
          )}
          {murim && (disabilities(life).length > 0 || openInjuries(life).length > 0) && (
            <div className="injury-row">
              {disabilities(life).map((d) => (
                <span className="injury-chip" key={d}>
                  {d}
                </span>
              ))}
              {openInjuries(life).length > 0 && <span className="injury-chip">🤕 แผลยังไม่หาย {openInjuries(life).length}</span>}
            </div>
          )}
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

      {murim && <WorldStrip life={life} />}
      {murim && goalLine(life) && <div className="goal-strip">🎯 {goalLine(life)}</div>}

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
        {!murim && teaser && <p className="cliffhanger">{loc(life, teaser)}</p>}
        {life.report && life.report.to === life.age && life.report.lines.length > 0 && <ReportCard report={life.report} />}
      </div>

      <footer className="bottom">
        {murim && life.alive && <PlanBar life={life} onAgeUp={onAgeUp} />}
        <button className="age-btn" onClick={() => onAgeUp(1)} disabled={life.queue.length > 0}>
          ＋ อายุ 1 ปี
        </button>
        <nav className="tabs">
          {TABS.filter((t) => (t.id !== "phone" || hasPhone(life)) && (t.id !== "jianghu" || life.worldId === "murim")).map((t) => (
            <button key={t.id} className="tab" onClick={() => onTab(t.id)}>
              <span className="tab-emoji">{t.id === "soul" && isRealistic(life.worldId) ? "📜" : t.emoji}</span>
              <span>{isRealistic(life.worldId) ? (t.id === "soul" ? "บันทึก" : t.id === "power" ? "วิชา" : t.label) : t.label}</span>
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}

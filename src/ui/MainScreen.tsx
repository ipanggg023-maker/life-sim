import { createContext, memo, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { goalInfo } from "../content/murim/life/goals";
import { Icon, noEmoji, type IconName } from "./Icon";
import { disabilities, openInjuries } from "../engine/body";
import { displayName, loc, money, shortName } from "../engine/util";
import { courtOf } from "../content/murim/world/court";
import { COURT_RANKS } from "../content/murim/world/palaceSchemes";

export type TabId = "career" | "people" | "power" | "jianghu" | "activities" | "phone" | "soul";

const TABS: { id: TabId; label: string }[] = [
  { id: "career", label: "อาชีพ" },
  { id: "people", label: "ผู้คน" },
  { id: "power", label: "พลัง" },
  { id: "jianghu", label: "ยุทธภพ" },
  { id: "activities", label: "ทำ" },
  { id: "phone", label: "มือถือ" },
  { id: "soul", label: "วิญญาณ" },
];

const VISIBLE_STATS: StatKey[] = ["health", "happiness", "smarts", "looks"];

export function StatBar({ k, value }: { k: StatKey; value: number }) {
  const tone = value < 25 ? "low" : value < 50 ? "mid" : "high";
  return (
    <div className={`stat stat-${k}`}>
      <Icon name={k as IconName} size={17} className="stat-icon" />
      <span className="stat-label">{STAT_LABEL[k]}</span>
      <div className="bar">
        <div className={`fill ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="stat-val">{value}</span>
    </div>
  );
}

const LOG_PAGE = 20;

/** ชื่อคนในบันทึกแตะได้ — เปิดดูคนนั้นในแท็บคน */
type Names = { re?: RegExp; ids: Map<string, string>; open?: (id: string) => void };
const NameCtx = createContext<Names>({ ids: new Map() });
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function namesOf(life: Life, open?: (id: string) => void): Names {
  const ids = new Map<string, string>();
  // คนที่ยังมีชีวิตก่อน · ชื่อสั้นต้องยาวพอไม่ให้ไปชนคำธรรมดา
  for (const p of [...life.people].sort((a, b) => Number(b.alive) - Number(a.alive)))
    for (const n of [p.name, shortName(p)]) if (n && n.length >= 3 && !ids.has(n)) ids.set(n, p.id);
  if (!ids.size || !open) return { ids };
  return { ids, open, re: new RegExp(`(${[...ids.keys()].sort((a, b) => b.length - a.length).map(esc).join("|")})`) };
}
function Linked({ text }: { text: string }) {
  const n = useContext(NameCtx);
  if (!n.re || !n.open) return <>{text}</>;
  const parts = text.split(n.re);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((s, i) =>
        i % 2 ? (
          <button key={i} className="name-link" onClick={() => n.open!(n.ids.get(s)!)}>
            {s}
          </button>
        ) : (
          s
        ),
      )}
    </>
  );
}

/** ตัวกรองบันทึก (EXPANSION §15): ตามประเภท หรือเฉพาะเรื่องของคนหนึ่ง */
type LogFilter = "all" | "key" | "fight" | "people" | "news";
const FILTERS: { id: LogFilter; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "key", label: "สำคัญ" },
  { id: "fight", label: "ต่อสู้" },
  { id: "people", label: "ผู้คน" },
  { id: "news", label: "ข่าว" },
];
const FIGHT = /ดวล|ต่อสู้|ปะทะ|บาดเจ็บ|ฆ่า|สังหาร|กระบี่|ดาบ|ฝ่ามือ|โจร|ศัตรู|ลอบ/;
const NEWS = /ข่าว|ลือ|ประกาศ|ทำเนียบ|ยุค|ราชสำนัก|สงคราม/;
function keep(e: LogEntry, f: LogFilter, n: Names, whoNames: string[]): boolean {
  if (whoNames.length) return whoNames.some((x) => e.text.includes(x));
  if (f === "all") return true;
  if (f === "key") return e.kind === "milestone" || e.kind === "chapter" || e.kind === "arc";
  if (e.kind === "chapter" || e.kind === "arc" || e.kind === "comments") return false;
  if (f === "fight") return FIGHT.test(e.text);
  if (f === "news") return NEWS.test(e.text);
  return !!n.re && n.re.test(e.text);
}

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
  if (e.kind === "chapter") return <div className="chapter-head"><span>{noEmoji(e.text)}</span></div>;
  if (e.kind === "arc")
    return (
      <div className="arc-head">
        <span>{noEmoji(e.text)}</span>
      </div>
    );
  if (e.kind === "comments") return <Comments items={parseComments(e)} />;
  return (
    <p className={`log-line ${e.kind}`}>
      <Linked text={noEmoji(e.text)} />
    </p>
  );
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
        <span className="ch-on">ความคิดเห็นจากผู้อ่าน · แตะเพื่อซ่อน</span>
        <span className="ch-off">ซ่อนความคิดเห็นอยู่ · แตะเพื่อแสดง</span>
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

/** สภาพบ้านเมือง (ถิ่น · ยุค · ราคาข้าว · วิกฤต) และเป้าหมายชีวิต — แถบเดียวคั่นด้วยเส้น */
function WorldStrip({ life }: { life: Life }) {
  const w = worldSummary(life);
  const g = goalInfo(life);
  return (
    <div className="meta-strip">
      <div className={`meta-line ${w.crisis ? "crisis" : ""}`} title={w.desc}>
        <Icon name="pin" size={14} />
        <span>
          {regionOf(life).name} · {w.era} · ข้าว ×{w.price.toFixed(2)}
          {w.crisis && <b> · {noEmoji(w.crisis)}</b>}
        </span>
      </div>
      {g && (
        <div className="meta-line goal">
          <Icon name="flag" size={14} className="seal-ink" />
          <span>
            <b>{g.name}</b>
            <span className="goal-steps" aria-label={`ผ่านแล้ว ${g.step} จาก ${g.total} ขั้น`}>
              {Array.from({ length: g.total }, (_, i) => (
                <i key={i} className={i < g.step ? "on" : ""} />
              ))}
            </span>
            {g.next && <span className="muted">ถัดไป {g.next}</span>}
            {g.side.length > 0 && <span className="muted"> · รอง {g.side.join(", ")}</span>}
          </span>
        </div>
      )}
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

/** แผนหลักของปี */
function PlanBar({ life }: { life: Life }) {
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
          <option value="">ใช้ชีวิตตามปกติ</option>
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {noEmoji(p.name)}
            </option>
          ))}
        </select>
      </label>
      {cur && (
        <div className="plan-hint">
          ได้ {cur.pros} · เสีย {cur.cons}
        </div>
      )}
    </div>
  );
}

export function MainScreen({
  life,
  onAgeUp,
  onTab,
  who = null,
  setWho,
  onPerson,
}: {
  life: Life;
  onAgeUp: (years?: number) => void;
  onTab: (t: TabId) => void;
  who?: string | null;
  setWho?: (id: string | null) => void;
  onPerson?: (id: string) => void;
}) {
  const title = titleById(life.flags.title as string | undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const teaser = cliffhanger(life);
  const quest = secretQuestStatus(life);
  // แสดงเฉพาะช่วงหลังของบันทึก — ชีวิตยาวๆ มีเป็นพันบรรทัด วาดทั้งหมดทุกครั้งทำให้แลค
  const [showYears, setShowYears] = useState(LOG_PAGE);
  const [filter, setFilter] = useState<LogFilter>("all");
  const peopleKey = life.people.map((p) => p.id + p.name).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const names = useMemo(() => namesOf(life, onPerson), [peopleKey, onPerson ? 1 : 0]);
  const whoP = who ? life.people.find((p) => p.id === who) : undefined;
  const whoNames = whoP ? [whoP.name, shortName(whoP)].filter((x) => x.length >= 2) : [];
  const shown = filter === "all" && !whoNames.length ? life.log : life.log.filter((e) => keep(e, filter, names, whoNames));
  const groups = groupByAge(shown);
  const hidden = Math.max(0, groups.length - showYears);
  useEffect(() => setShowYears(LOG_PAGE), [life.id, filter, who]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [life.log.length]);

  const job = life.job ? careerById(life.job.careerId) : undefined;
  const murim = life.worldId === "murim";
  const rank = murim ? Number(life.flags.courtRank ?? 0) : 0;
  const subtitle = murim && life.flags.emperorSelf && life.mw
    ? `ฮ่องเต้แห่ง${courtOf(life).dynasty}`
    : murim && rank >= 4
    ? COURT_RANKS[rank]
    : job
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
            {displayName(life)}
            {murim && life.flags.courtesyName && <span className="courtesy"> · {String(life.flags.courtesyName)}</span>}{" "}
            <span className={`gender-tag ${life.gender}`}>{life.gender === "m" ? "♂" : "♀"}</span>
          </div>
          {murim ? (
            <>
              {life.flags.m17Epithet && <div className="title-tag">【{String(life.flags.m17Epithet)}】</div>}
              {life.power && <div className="sub">กำลังภายใน {Math.floor(Number(life.flags.mwQi ?? 0))} ปี</div>}
              {(!!life.flags.wanted || Number(life.flags.jailUntil ?? -1) > life.age || Number(life.flags.mourningUntil ?? -1) > life.age) && (
                <div>
                  {!!life.flags.wanted && <span className="status-chip">ถูกประกาศจับ</span>}
                  {Number(life.flags.jailUntil ?? -1) > life.age && <span className="status-chip">ติดคุก อีก {Number(life.flags.jailUntil) - life.age} ปี</span>}
                  {Number(life.flags.mourningUntil ?? -1) > life.age && <span className="status-chip calm">ไว้ทุกข์</span>}
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
              {openInjuries(life).length > 0 && <span className="injury-chip">แผลยังไม่หาย {openInjuries(life).length}</span>}
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
      {murim && !!life.flags.legacySave && <div className="legacy-strip">เซฟจากเวอร์ชันเก่า — เล่นต่อได้จนจบชีวิตนี้ ระบบใหม่บางอย่างเริ่มนับจากตอนนี้ รุ่นถัดไปจะได้ครบทุกระบบ</div>}

      {quest && (
        <div className="quest-strip">
          <b>[ภารกิจลับ]</b> {quest.text} · {quest.progress} · เหลือ {quest.left} ปี
        </div>
      )}

      {murim && (
        <div className="log-filters">
          {whoP ? (
            <button className="chip on" onClick={() => setWho?.(null)}>
              เรื่องของ{shortName(whoP)} ✕
            </button>
          ) : (
            FILTERS.map((f) => (
              <button key={f.id} className={`chip ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))
          )}
        </div>
      )}
      <NameCtx.Provider value={names}>
      <div className="log" ref={logRef}>
        {groups.length === 0 && <p className="muted small">ยังไม่มีบันทึกในหมวดนี้</p>}
        {hidden > 0 && (
          <button className="btn small ghost log-more" onClick={() => setShowYears(showYears + LOG_PAGE)}>
            ดูบันทึกก่อนหน้า ({hidden} ปี)
          </button>
        )}
        {groups.slice(hidden).map((g) => (
          <LogGroup key={g.age} age={g.age} entries={g.entries} />
        ))}
        {!murim && teaser && <p className="cliffhanger">{loc(life, teaser)}</p>}
        {life.report && life.report.to === life.age && life.report.lines.length > 0 && <ReportCard report={life.report} />}
      </div>
      </NameCtx.Provider>

      <footer className="bottom">
        {murim && life.alive && <PlanBar life={life} />}
        <button className="age-btn" onClick={() => onAgeUp(1)} disabled={life.queue.length > 0}>
          อายุ +1 ปี
        </button>
        <nav className="tabs">
          {TABS.filter((t) => (t.id !== "phone" || hasPhone(life)) && (t.id !== "jianghu" || life.worldId === "murim")).map((t) => (
            <button key={t.id} className="tab" onClick={() => onTab(t.id)}>
              <Icon name={t.id} size={22} className="tab-icon" />
              <span>{isRealistic(life.worldId) ? (t.id === "soul" ? "บันทึก" : t.id === "power" ? "วิชา" : t.label) : t.label}</span>
            </button>
          ))}
        </nav>
      </footer>
    </div>
  );
}

import { RARITY_LABEL, talentById } from "../../content/talents";
import { canEnterGate, dailyQuest, enterGate, gatesLeft, train } from "../../content/hunter/events/gates";
import { RANKS, classById, combatPower, skillsOf, expToNext, fightOdds, guildById, guildsFor, rankLabel, survivalOdds, type Guild } from "../../content/hunter/power";
import { breakLevel } from "../../content/murim/events";
import { SECLUSION_YEARS, canSeclude, isSecluded, startSeclusion } from "../../content/shared/fate";
import { TITLES, titlesOf } from "../../content/titles";
import { TOP_FLOOR, floorCap, floorOf, tierOfFloor } from "../../content/tower/climb";
import { sponsorOf } from "../../content/sponsors";
import { PASSIVES, passivesOf } from "../../content/passives";
import { STUDENTS, acaYear, houseOf, inAcademy } from "../../content/court/academy";
import { SKILL_TYPE, skillEffectText } from "../../content/skills";
import { skillReady } from "../../content/shared/skillUse";
import { worldOf } from "../../content/worlds";
import type { Life, WorldId } from "../../engine/types";
import { displayName, hasTalent, loc } from "../../engine/util";
import type { Act } from "../App";
import { SystemWindow } from "./SystemWindow";
import { TowerTeamCard } from "./TowerTeamCard";

/** คำเรียกในแท็บพลังของแต่ละโลก */
const UI: Record<
  WorldId,
  {
    style: string;
    noGuild: string;
    done: string;
    boss: string;
    needJob: string;
    unit: string;
    enter: string;
    trainEmoji: string;
    join: string;
    joined: (g: Guild) => string;
    left: (g: Guild) => string;
    slot: string;
    before: (from: number, to: number) => string;
    none: string;
    waiting: string;
  }
> = {
  hunter: {
    style: "สายอาชีพ",
    noGuild: "อิสระ",
    done: "Gate ที่เคลียร์",
    boss: "บอส",
    needJob: "ต้องลงทะเบียนเป็น Hunter ที่แท็บ 💼 อาชีพก่อน",
    unit: "Gate แรงก์ ",
    enter: "เข้า",
    trainEmoji: "🏋️",
    join: "สมัคร",
    joined: (g) => `คุณเข้าร่วม${g.name}`,
    left: (g) => `คุณออกจาก${g.name}`,
    slot: "ตื่นพลัง",
    before: (f, t) => `ยังไม่ถึงวัยตื่นพลัง (โดยทั่วไป ${f}–${t} ปี)`,
    none: "ไม่พบการตื่นพลัง — คุณเป็นคนธรรมดา (…หรือเปล่า?)",
    waiting: "รอการตื่นพลัง…",
  },
  murim: {
    style: "วิชา",
    noGuild: "ไร้สังกัด",
    done: "ภารกิจสำเร็จ",
    boss: "ล้มยอดฝีมือ",
    needJob: "ต้องเป็นศิษย์สำนัก จอมยุทธ์พเนจร หรือนักฆ่ารับจ้างก่อน (แท็บ 💼 อาชีพ)",
    unit: "ภารกิจระดับ",
    enter: "รับ",
    trainEmoji: "🧘",
    join: "ฝากตัว",
    joined: (g) => `คุณคุกเข่าคารวะ และได้เป็นศิษย์แห่ง${g.name}`,
    left: (g) => `คุณคืนป้ายศิษย์แล้วลงเขาจาก${g.name}`,
    slot: "รากฐานตื่น",
    before: (f, t) => `ยังไม่ถึงวัยคัดเลือกศิษย์ (${f}–${t} ปี)`,
    none: "เส้นชีพจรอุดตัน — คุณเป็นคนธรรมดา (…หรือเปล่า?)",
    waiting: "รอวันคัดเลือกศิษย์…",
  },
  court: {
    style: "สายเวท",
    noGuild: "ไร้สังกัด",
    done: "ภารกิจสำเร็จ",
    boss: "ล้มศัตรูคนสำคัญ",
    needJob: "ต้องเป็นอัศวิน จอมเวทราชสำนัก หรือนักผจญภัยก่อน (แท็บ 💼 อาชีพ)",
    unit: "ภารกิจระดับ",
    enter: "รับ",
    trainEmoji: "📖",
    join: "เข้าสังกัด",
    joined: (g) => `คุณสาบานตนเข้าสังกัด${g.name}`,
    left: (g) => `คุณคืนตราประจำ${g.name}`,
    slot: "พลังเวทตื่น",
    before: () => "ยังไม่ถึงพิธีตรวจพลังเวท (อายุ 10 ปี)",
    none: "ไร้มานา — คุณเป็นคนธรรมดา (…หรือเปล่า?)",
    waiting: "รอพิธีตรวจพลังเวท…",
  },
  ordinary: {
    style: "เส้นทาง",
    noGuild: "อิสระ",
    done: "ภารกิจที่สำเร็จ",
    boss: "ชนะคู่แข่ง",
    needJob: "ต้องทำอาชีพตามเส้นทางของระบบที่แท็บ 💼 อาชีพก่อน",
    unit: "ภารกิจระดับ ",
    enter: "รับ",
    trainEmoji: "🏋️",
    join: "เซ็นสัญญา",
    joined: (g) => `คุณเซ็นสัญญากับ${g.name}`,
    left: (g) => `คุณยกเลิกสัญญากับ${g.name}`,
    slot: "ได้ระบบ",
    before: () => "คุณยังเป็นคนธรรมดา… ตอนนี้",
    none: "ระบบไม่เคยมาหาคุณ — คุณสู้ชีวิตด้วยตัวเองมาตลอด",
    waiting: "คุณยังเป็นคนธรรมดา… ตอนนี้",
  },
  apocalypse: {
    style: "เส้นทาง",
    noGuild: "ไม่มีกลุ่ม",
    done: "ฉากที่ผ่าน",
    boss: "ตัวคุมฉาก",
    needJob: "ต้องเป็นผู้รอดชีวิตภาคสนามที่แท็บ 💼 อาชีพก่อน",
    unit: "ฉากภารกิจระดับ ",
    enter: "เข้าฉาก",
    trainEmoji: "🏋️",
    join: "เข้าร่วม",
    joined: (g) => `คุณเข้าร่วม${g.name}`,
    left: (g) => `คุณออกจาก${g.name}`,
    slot: "ระบบมาถึง",
    before: () => "โลกยังปกติดี… ตอนนี้",
    none: "คุณเป็นคนธรรมดาในโลกที่พังแล้ว",
    waiting: "โลกยังปกติดี… ตอนนี้",
  },
  tower: {
    style: "ตำแหน่ง",
    noGuild: "ไม่มีทีม",
    done: "บททดสอบที่ผ่าน",
    boss: "ผู้คุมชั้น",
    needJob: "ต้องลงทะเบียนเป็นผู้ท้าชิงหอคอยที่แท็บ 💼 อาชีพก่อน",
    unit: "บททดสอบระดับ ",
    enter: "ท้าทาย",
    trainEmoji: "🏋️",
    join: "เข้าร่วม",
    joined: (g) => `คุณเข้าร่วม${g.name}`,
    left: (g) => `คุณออกจาก${g.name}`,
    slot: "เข้าหอคอย",
    before: (f, t) => `ยังไม่ได้รับคำเชิญจากหอคอย (ส่วนใหญ่ได้ตอนอายุ ${f}–${t} ปี)`,
    none: "หอคอยไม่เปิดประตูให้คุณ — คุณเป็นคนธรรมดา (…หรือเปล่า?)",
    waiting: "รอคำเชิญจากหอคอย…",
  },
};

export function PowerTab({ life, act }: { life: Life; act: Act }) {
  const p = life.power;
  const ui = UI[life.worldId ?? "hunter"];
  return (
    <div className="tab-content">
      {p ? <StatusWindow life={life} act={act} /> : life.sys ? <SystemWindow life={life} act={act} /> : <Dormant life={life} />}

      {life.worldId === "court" && life.flags.role && <NovelCard life={life} />}
      {life.worldId === "court" && life.flags.academy && <AcademyCard life={life} />}
      {life.worldId === "tower" && <TowerTeamCard life={life} />}

      <TitlesCard life={life} act={act} />
      <PassivesCard life={life} />

      <div className="section-title">พรสวรรค์</div>
      <div className="talent-row">
        {life.talents.map((t, i) => {
          const info = talentById(t.id)!;
          if (!t.revealed)
            return (
              <div className="talent hidden" key={i}>
                <div className="t-rarity">???</div>
                <div className="t-name">ช่องลับ</div>
                <div className="t-desc">จะเปิดเมื่อ{ui.slot} เฉียดตาย หรืออายุ 21</div>
              </div>
            );
          return (
            <div className={`talent ${info.rarity}`} key={i}>
              <div className="t-rarity">{RARITY_LABEL[info.rarity]}</div>
              <div className="t-name">{info.name}</div>
              <div className="t-desc">{info.desc}</div>
            </div>
          );
        })}
      </div>

      <div className="section-title">สิ่งของพิเศษ</div>
      <ul className="items">
        {life.flags.amulet && <li>🪬 พระเครื่องของยาย (อุ่นอยู่ตลอด)</li>}
        {life.flags.ghostBox && <li>🪙 เหรียญโบราณสลักอักษรประหลาด</li>}
        {life.flags.oldBook && <li>📕 หนังสือปกหนังที่อ่านไม่ออก</li>}
        {life.flags.ringMaster && <li>💍 แหวนหยกดำที่มีวิญญาณปรมาจารย์</li>}
        {p?.items.map((it, i) => <li key={i}>🎒 {it}</li>)}
        {!life.flags.amulet && !life.flags.ghostBox && !life.flags.oldBook && !life.flags.ringMaster && !p?.items.length && (
          <li className="muted">ยังไม่มี</li>
        )}
      </ul>
    </div>
  );
}

/** ฉายาที่ปลดล็อกแล้ว — ใส่ได้ทีละอัน */
function TitlesCard({ life, act }: { life: Life; act: Act }) {
  const owned = titlesOf(life);
  const current = life.flags.title;
  return (
    <>
      <div className="section-title">ฉายา ({owned.length}/{TITLES.length})</div>
      {owned.length === 0 ? (
        <p className="muted small">ยังไม่มีฉายา — ได้จากเหตุการณ์สำคัญ เช่น รอดจาก Red Gate, ชำระแค้น, หักกิโยติน</p>
      ) : (
        <div className="chips">
          {owned.map((t) => (
            <button
              key={t.id}
              className={`chip title-chip ${current === t.id ? "on" : ""}`}
              title={t.desc}
              onClick={() =>
                act((l) => {
                  l.flags.title = t.id;
                  return { text: `ใส่ฉายา「${t.name}」(${t.desc})` };
                })
              }
            >
              {t.name}
              <span className="chip-sub"> · {t.desc}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** ราชสำนัก: บทบาทในนิยายและ Death Flag */
function NovelCard({ life }: { life: Life }) {
  const role = String(life.flags.role);
  const broken = Number(life.flags.dfBroken ?? 0);
  const followed = Number(life.flags.dfFollowed ?? 0);
  return (
    <div className="sys-window">
      <div className="sys-head">นิยาย "ดอกกุหลาบแห่งจักรวรรดิ"</div>
      <p>
        บทบาทของคุณ: <b>{role === "villain" ? "ตัวร้าย" : role === "lead" ? "ตัวเอก" : "ตัวประกอบ"}</b>
      </p>
      {role === "villain" && (
        <>
          <p>
            Death Flag ที่หักแล้ว: <b>{broken}</b>/3 · ทำตามบท: {followed}
          </p>
          <p className="muted small">
            {life.flags.fateDefied
              ? "คุณรอดพ้นวันประหารแล้ว — ต่อจากนี้คือเรื่องราวที่นิยายไม่เคยเขียน"
              : life.flags.exiled
                ? "คุณหนีพ้นเมืองหลวงแล้ว บทนิยายตามคุณไม่ทัน"
                : "หักให้ได้อย่างน้อย 2 จาก 3 ก่อนอายุ 20 — วันที่นิยายบอกว่าคุณจะถูกประหาร"}
          </p>
        </>
      )}
      {role === "extra" && <p className="muted small">{life.flags.extraSurvived ? "คุณรอดจากบทที่ 3 แล้ว" : "บทที่ 3 (อายุ 17): เทศกาลดอกไม้ที่ตัวประกอบทั้งเมืองตาย"}</p>}
      {role === "lead" && <p className="muted small">{life.flags.saint ? "คุณได้รับตำแหน่งผู้สมัครนักบุญแล้ว" : "ในนิยาย ตัวเอกตื่นพลังศักดิ์สิทธิ์ตอนอายุ 15"}</p>}
    </div>
  );
}

function Dormant({ life }: { life: Life }) {
  const w = worldOf(life.worldId);
  const ui = UI[life.worldId ?? "hunter"];
  const [from, to] = w.awakenAge;
  const awakenAge = Number(life.flags.awakenAge ?? to);
  return (
    <div className="sys-window">
      <div className="sys-head">ระบบ · สถานะ</div>
      <p>
        {w.labels.rank}: <b>—</b>
      </p>
      <p className="muted">
        {life.age < from ? ui.before(from, to) : life.flags.awakenDone || life.age > awakenAge ? (life.flags.refusedTower ? "คุณปฏิเสธคำเชิญ — เลือกใช้ชีวิตบนโลก" : ui.none) : ui.waiting}
        {Number(life.flags.glitch ?? 0) > 0 && " · พบสัญญาณผิดปกติ " + life.flags.glitch + " ครั้ง"}
      </p>
    </div>
  );
}

function StatusWindow({ life, act }: { life: Life; act: Act }) {
  const w = worldOf(life.worldId);
  const ui = UI[life.worldId ?? "hunter"];
  const murim = life.worldId === "murim";
  const p = life.power!;
  const cls = classById(p.hunterClass);
  const guild = guildById(p.guild);
  const canQuest = w.questJobs.includes(life.job?.careerId ?? "");
  const need = expToNext(p.level);
  const left = gatesLeft(life);
  const gateRanks = Array.from({ length: Math.min(p.rank + 2, RANKS.length) }, (_, i) => i);

  return (
    <>
      <div className="sys-window">
        <div className="sys-head">ระบบ · สถานะ</div>
        <div className="status-grid">
          <span>ชื่อ</span>
          <b>{displayName(life)}</b>
          <span>{w.labels.rank}</span>
          <b className={`rank r${p.rank}`}>{rankLabel(life, p.rank)}</b>
          <span>{ui.style}</span>
          <b>
            {cls.emoji} {cls.name}
          </b>
          <span>เลเวล</span>
          <b>
            Lv.{p.level}
            {murim && p.rank < 8 && <span className="muted small"> (ทะลวงขั้นได้ที่ Lv.{breakLevel(p.rank)})</span>}
          </b>
          <span>พลังต่อสู้</span>
          <b>{combatPower(life)}</b>
          <span>{w.labels.guild}</span>
          <b>{guild ? loc(life, guild.name) : ui.noGuild}</b>
          <span>{ui.done}</span>
          <b>
            {p.gates} ({ui.boss} {p.bossKills})
          </b>
          {life.worldId === "apocalypse" && (
            <>
              <span>ฉากภารกิจหลัก</span>
              <b>
                {Number(life.flags.mainScenario ?? 0) >= 8 ? "จบแล้ว ☀️" : `#${Number(life.flags.mainScenario ?? 0)} / 8`}
              </b>
              <span>ผู้สนับสนุน</span>
              <b>{sponsorOf(life) ? `✨ ${sponsorOf(life)!.name} (${sponsorOf(life)!.desc})` : "ยังไม่มี"}</b>
            </>
          )}
          {life.worldId === "tower" && (
            <>
              <span>ชั้นปัจจุบัน</span>
              <b>
                ชั้นที่ {floorOf(life)} / {TOP_FLOOR}
                {life.flags.towerTop ? " 👑" : ""}
              </b>
              <span>ผู้สนับสนุน</span>
              <b>{sponsorOf(life) ? `✨ ${sponsorOf(life)!.name} (${sponsorOf(life)!.desc})` : "ยังไม่มี"}</b>
            </>
          )}
        </div>
        <div className="exp">
          <div className="bar">
            <div className="fill sys-fill" style={{ width: `${(p.exp / need) * 100}%` }} />
          </div>
          <span className="small">
            EXP {p.exp}/{need}
          </span>
        </div>
        <SkillList life={life} />
      </div>

      <div className="section-title">
        {w.labels.raid} · เหลือ {Math.max(0, left)} ครั้งในปีนี้
      </div>
      {!canQuest && <p className="muted small">{ui.needJob}</p>}
      {gateRanks.map((r) => {
        const blocked = canEnterGate(life, r);
        return (
          <div className="job" key={r}>
            <div className="job-main">
              <div className="job-name">
                {w.emoji} {ui.unit}
                <span className={`rank r${r}`}>{rankLabel(life, r)}</span>
              </div>
              <div className="job-sub">
                {life.worldId === "tower" && <>{climbHint(life, r)} · </>}
                ชนะ {Math.round(fightOdds(life, r) * 100)}% ·{" "}
                <span className={survivalOdds(life, r) < 0.8 ? "danger-text" : ""}>รอด {Math.round(survivalOdds(life, r) * 100)}%</span>
              </div>
            </div>
            <button className="btn small" disabled={!!blocked} title={blocked} onClick={() => act((l) => enterGate(l, r))}>
              {ui.enter}
            </button>
          </div>
        );
      })}

      <div className="row">
        <button className="btn" disabled={life.doneThisYear.includes("train")} onClick={() => act(train)}>
          {ui.trainEmoji} {w.labels.train}
        </button>
        <button
          className="btn"
          disabled={!!canSeclude(life)}
          title={canSeclude(life)}
          onClick={() => act((l) => startSeclusion(l))}
        >
          {isSecluded(life) ? `⛩️ ปิดด่านอยู่ (ถึงอายุ ${life.flags.secludeUntil})` : `⛩️ ปิดด่าน ${SECLUSION_YEARS} ปี`}
        </button>
        {(hasTalent(life, "system_user") || life.worldId === "ordinary") && (
          <button className="btn sys-btn" disabled={life.doneThisYear.includes("daily")} onClick={() => act(dailyQuest)}>
            📋 ภารกิจรายวัน
          </button>
        )}
      </div>

      <div className="section-title">{w.labels.guild}</div>
      {guild ? (
        <div className="job">
          <div className="job-main">
            <div className="job-name">{loc(life, guild.name)}</div>
            <div className="job-sub">{guild.desc}</div>
          </div>
          <button
            className="btn small ghost"
            onClick={() =>
              act((l) => {
                l.power!.guild = undefined;
                if (l.job?.careerId === "disciple") l.job = undefined;
                return { text: ui.left(guild) };
              })
            }
          >
            ออก
          </button>
        </div>
      ) : (
        guildsFor(life).map((g) => {
          const locked = g.minRank > p.rank;
          return (
            <div className={`job ${locked ? "locked" : ""}`} key={g.id}>
              <div className="job-main">
                <div className="job-name">{loc(life, g.name)}</div>
                <div className="job-sub">{locked ? `🔒 ${w.labels.rank} ${rankLabel(life, g.minRank)}+` : loc(life, g.desc)}</div>
              </div>
              <button
                className="btn small"
                disabled={locked || (life.worldId === "hunter" && !canQuest)}
                onClick={() =>
                  act((l) => {
                    l.power!.guild = g.id;
                    // ยุทธภพ: เข้าสำนัก = เป็นศิษย์สำนัก
                    if (murim) l.job = { careerId: "disciple", level: 1, performance: 50, years: 0 };
                    return { text: ui.joined(g), kind: "good" };
                  })
                }
              >
                {ui.join}
              </button>
            </div>
          );
        })
      )}
    </>
  );
}

/** สกิลทั้งหมด: กดเพื่อดูว่าทำอะไรได้ + สกิลที่ยังล็อกอยู่ */
function SkillList({ life }: { life: Life }) {
  const p = life.power!;
  const locked = classById(p.hunterClass).skills.filter(([, n]) => !p.skills.includes(n));
  return (
    <div className="skill-list">
      {skillsOf(life).map((s) => (
        <details className="skill-card" key={s.name}>
          <summary>
            <span className="skill-name">
              {SKILL_TYPE[s.type].emoji} {s.name}
            </span>
            <span className="skill-meta">
              {SKILL_TYPE[s.type].name} · ชำนาญ Lv.{s.mastery}
              {!skillReady(life, s.name) && " · ใช้แล้วปีนี้"}
            </span>
          </summary>
          <p className="small">{s.desc}</p>
          <p className="small muted">{skillEffectText(s)}</p>
        </details>
      ))}
      {locked.map(([lv, n]) => (
        <div className="skill-card locked" key={n}>
          <span className="skill-name">🔒 {n}</span>
          <span className="skill-meta">ปลดล็อกที่ Lv.{lv}</span>
        </div>
      ))}
    </div>
  );
}

/** บททดสอบระดับนี้พาขึ้นชั้นใหม่ได้ไหม */
function climbHint(life: Life, r: number) {
  const f = floorOf(life);
  if (r < tierOfFloor(f + 1) || f >= floorCap(r)) return "ฝึกซ้อม (ไม่ขึ้นชั้น)";
  return `ปีนได้ถึงชั้น ${floorCap(r)}`;
}

/** สถาบันจักรวรรดิ: ปี หอ อันดับ */
function AcademyCard({ life }: { life: Life }) {
  const f = life.flags;
  const h = houseOf(life);
  const status = f.acaGrad ? (f.acaTop ? "จบการศึกษาอันดับหนึ่ง 🎓" : "จบการศึกษาแล้ว 🎓") : f.acaExpelled ? "ถูกให้ออก" : inAcademy(life) ? `กำลังเรียนปี ${acaYear(life)}` : "รอเข้าเรียน";
  return (
    <div className="card">
      <div className="card-title">🏛️ สถาบันจักรวรรดิ</div>
      <p>
        {status}
        {h ? ` · ${h.emoji} ${h.name}` : ""}
        {f.scholarship ? " · นักเรียนทุน" : ""}
      </p>
      {f.acaRank && (
        <p className="small muted">
          อันดับล่าสุด {String(f.acaRank)} / {STUDENTS} · ดีที่สุด {String(f.acaBest ?? f.acaRank)}
          {f.houseCup ? " · 🏆 ถ้วยประจำหอ" : ""}
        </p>
      )}
    </div>
  );
}

/** สกิลติดตัว: ที่ได้แล้ว + วิธีปลดล็อกที่เหลือ */
function PassivesCard({ life }: { life: Life }) {
  const owned = passivesOf(life);
  const ids = owned.map((p) => p.id);
  return (
    <>
      <div className="section-title">
        สกิลติดตัว ({owned.length}/{PASSIVES.length})
      </div>
      <div className="skill-list">
        {owned.map((p) => (
          <div className="skill-card" key={p.id}>
            <span className="skill-name">
              {p.emoji} {p.name}
            </span>
            <p className="small muted">{p.desc}</p>
          </div>
        ))}
        {PASSIVES.filter((p) => !ids.includes(p.id)).map((p) => (
          <div className="skill-card locked" key={p.id}>
            <span className="skill-name">🔒 {p.name}</span>
            <span className="skill-meta">{p.how}</span>
          </div>
        ))}
      </div>
    </>
  );
}

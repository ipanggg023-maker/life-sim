// แท็บยุทธภพ (MURIM_PLAN §10): สถานการณ์ใต้หล้า · ทำเนียบและสำนักของคุณ · สงครามสามแคว้น · ที่อยู่ · สถานะทางกฎหมาย
import { ERA } from "../../content/murim/life/world";
import { regionOf } from "../../content/murim/life/region";
import { heatOf, jailed, mourning } from "../../content/murim/life/law";
import type { Life } from "../../engine/types";
import type { Act } from "../App";
import { MurimCard } from "./MurimCard";
import { legendsOf, myYoungPlace, youngList } from "../../content/murim/world/jianghu";
import { REGIONS } from "../../content/murim/life/region";
import { REL_LABEL, TRUTH_LABEL, fameNewsOf, rumorsOf } from "../../content/murim/life/rumors";
import { runEvent } from "../../engine/game";
import { WorldCard } from "./PowerTab";
import { TEMPER, courtOf, palaceAccess } from "../../content/murim/world/court";
import { COURT_RANKS, HEAT_LABEL, courtRank, schemeHeat } from "../../content/murim/world/palaceSchemes";
import { PRESSURE_LABEL, ROLE_NAME, castOf, palaceOf, palaceRoleOf, patronOf, princeById, princesOf, support } from "../../content/murim/world/palace";

export function JianghuTab({ life, act }: { life: Life; act: Act }) {
  const r = regionOf(life);
  const w = life.mw;
  const kingdoms = w?.kingdoms ?? [];
  const heat = heatOf(life);
  return (
    <div className="tab-content">
      <div className="card">
        <div className="card-title">ที่อยู่และยุคสมัย</div>
        <p className="small">
          📍 {r.name} — {r.desc}
        </p>
        {w && (
          <p className="small">
            🏮 {ERA[w.era].name} — {ERA[w.era].desc}
          </p>
        )}
        {life.flags.exiled && <p className="small danger-text">ถูกเนรเทศ ห้ามกลับบ้านเกิด</p>}
        <p className="muted small">ย้ายถิ่นได้ที่แท็บ 🎯 ทำ → ยุทธภพ</p>
      </div>
      {kingdoms.length > 0 && (
        <div className="card">
          <div className="card-title">สงครามสามแคว้น</div>
          {kingdoms.map((k) => (
            <div className="faction-row" key={k.id}>
              <span className="faction-name">
                {k.name} <span className="muted small">· {k.lord}{life.flags.lord === k.id ? " · นายของคุณ" : ""}</span>
              </span>
              <div className="bar small-bar">
                <div className={`fill ${life.flags.lord === k.id ? "high" : "mid"}`} style={{ width: `${k.power}%` }} />
              </div>
            </div>
          ))}
          {life.flags.lord ? (
            <p className="small">
              ตำแหน่ง: {life.flags.warRole === "strategist" ? "เสนาธิการ" : life.flags.warRole === "general" ? "แม่ทัพ" : life.flags.warRole === "officer" ? "นายทหาร" : "พลทหาร"} · ผลงาน {Number(life.flags.warRank ?? 0)}
            </p>
          ) : (
            <p className="muted small">คุณยังไม่ได้รับใช้แคว้นใด</p>
          )}
        </div>
      )}
      <RumorCard life={life} act={act} />
      <WorldCard life={life} />
      {w && w.era !== "war" && <CourtCard life={life} />}
      <MurimCard life={life} act={act} />
      <div className="card m17-card">
        <div className="card-title">🐉 ทำเนียบมังกรหนุ่ม (อายุไม่เกิน 30)</div>
        <p className="small muted">{myYoungPlace(life) ? `คุณอยู่อันดับ ${myYoungPlace(life)}` : life.age > 30 ? "คุณพ้นวัยมังกรหนุ่มแล้ว" : "ยังไม่ติดทำเนียบ — ฝีมือต้องสูงกว่าคนรุ่นเดียวกันทั้งแผ่นดิน"}</p>
        <ol className="m17-rank">
          {youngList(life).map((y, i) => (
            <li key={i}>
              <span className="m17-place">{i + 1}</span>
              <span className="m17-name">【{y.e}】{y.n}</span>
              <span className="m17-age small muted">{y.a} ปี</span>
            </li>
          ))}
        </ol>
      </div>
      {legendsOf(life).length > 0 && (
        <div className="card m17-card">
          <div className="card-title">🏛️ ตำนานคนรุ่นก่อน</div>
          {legendsOf(life).slice().reverse().map((g, i) => (
            <p className="small" key={i}>
              ปี {g.year} · {g.e ? `【${g.e}】` : ""}{g.n} — {g.deed}
            </p>
          ))}
        </div>
      )}
      {(heat > 0 || jailed(life) || mourning(life)) && (
        <div className="card">
          <div className="card-title">สถานะ</div>
          {heat > 0 && (
            <p className={`small ${life.flags.wanted ? "danger-text" : ""}`}>
              {life.flags.wanted ? "📜 ถูกประกาศจับ — นักล่าค่าหัวกำลังตามหา" : "👀 ทางการเริ่มจับตามอง"} (ความร้อนแรง {Math.round(heat)}/100)
            </p>
          )}
          {jailed(life) && <p className="small danger-text">⛓️ ติดคุก พ้นโทษอายุ {Number(life.flags.jailUntil)} ปี</p>}
          {mourning(life) && <p className="small">🕯️ ไว้ทุกข์ถึงอายุ {Number(life.flags.mourningUntil)} ปี — ห้ามแต่งงานและงานรื่นเริง</p>}
        </div>
      )}
    </div>
  );
}

/** ข่าวลือที่ได้ยิน (แหล่ง · ความน่าเชื่อถือที่รับรู้ · ตรวจสอบแล้วหรือยัง) และข่าวเรื่องคุณที่กำลังแพร่ */
function RumorCard({ life, act }: { life: Life; act: Act }) {
  const rs = rumorsOf(life).filter((r) => !r.done).slice().reverse();
  const fs = fameNewsOf(life).filter((f) => !f.covered).slice().reverse();
  if (!rs.length && !fs.length) return null;
  const busy = life.queue.length > 0;
  return (
    <div className="card">
      <div className="card-title">🗞️ ข่าวลือ</div>
      {rs.length === 0 && <p className="muted small">ยังไม่ได้ยินข่าวอะไร — ลองไปฟังข่าวในโรงน้ำชา</p>}
      {rs.map((r) => (
        <div className="job" key={r.id}>
          <div className="job-main">
            <div className="job-name">{r.text}</div>
            <div className="job-sub">
              จาก{r.src} · ปี {r.heard} · {r.verified ? <b>ตรวจแล้ว: {TRUTH_LABEL[r.truth]}</b> : REL_LABEL[r.rel]}
            </div>
          </div>
          <div className="row">
            {!r.verified && (
              <button className="btn small" disabled={busy} onClick={() => act((l) => { runEvent(l, "rm.verify", { rid: r.id }); return { text: "" }; })}>
                ตรวจสอบ
              </button>
            )}
            <button className="btn small" disabled={busy} onClick={() => act((l) => { runEvent(l, "rm.act", { rid: r.id }); return { text: "" }; })}>
              ลงมือ
            </button>
          </div>
        </div>
      ))}
      {fs.length > 0 && <div className="section-title">ข่าวเรื่องคุณที่กำลังแพร่</div>}
      {fs.map((f) => (
        <p className={`small ${f.good ? "" : "danger-text"}`} key={f.id}>
          {f.good ? "📣" : "🩸"} {f.text} · ปี {f.year} · แพร่ไป {Math.min(REGIONS.length, f.reach + 1)}/{REGIONS.length} ภูมิภาค{f.distorted ? " (ถูกเติมแต่ง)" : ""}
        </p>
      ))}
    </div>
  );
}

/** ราชสำนักและวังหลัง: คนนอกเห็นแค่ข่าวทั่วไป · คนที่เข้าวังได้เห็นแรงหนุนและคนในวังที่รู้จัก (EXPANSION §8.5) */
function CourtCard({ life }: { life: Life }) {
  const c = courtOf(life);
  const p = palaceOf(life);
  const inside = palaceAccess(life);
  const role = palaceRoleOf(life);
  const princes = princesOf(life).slice().sort((a, b) => Number(b.named) - Number(a.named) || b.age - a.age);
  const max = Math.max(1, ...princes.map((x) => support(life, x)));
  const known = castOf(life).filter((n) => n.known);
  const patron = patronOf(life);
  const backed = life.flags.palaceBack ? princeById(life, life.flags.palaceBack) : undefined;
  const health = c.emperor.health >= 70 ? "แข็งแรง" : c.emperor.health >= 40 ? "ประชวรบ่อย" : "ประชวรหนัก";
  return (
    <div className="card">
      <div className="card-title">🏯 ราชสำนัก · {c.dynasty}</div>
      <p className="small">
        {c.emperor.name} · {TEMPER[c.emperor.temper]} · {c.emperor.age} พรรษา · {inside && role === "physician" ? `ชีพจร ${c.emperor.health}/100` : inside ? health : `ข่าวว่า${health}`}
        {c.regent ? ` · ผู้สำเร็จราชการ: ${c.regent}` : ""}
      </p>
      <p className="small">
        การสืบทอด: <b>{PRESSURE_LABEL(p.pressure)}</b>
        {inside && ` · ท้องพระคลัง ${p.treasury >= 60 ? "มั่งคั่ง" : p.treasury >= 30 ? "พอใช้" : "ร่อยหรอ"}`}
      </p>
      {princes.length === 0 && <p className="muted small">ยังไม่มีองค์ชาย</p>}
      {princes.map((x) => (
        <div className="faction-row" key={x.id}>
          <span className="faction-name">
            {x.named ? "★ " : ""}
            {x.name} <span className="muted small">· {x.age} พรรษา{backed?.id === x.id ? " · คุณหนุน" : ""}</span>
          </span>
          {inside ? (
            <div className="bar small-bar" aria-label={`แรงหนุน ${support(life, x)}`}>
              <div className={`fill ${backed?.id === x.id ? "high" : "mid"}`} style={{ width: `${Math.round((support(life, x) / max) * 100)}%` }} />
            </div>
          ) : (
            <span className="muted small">ไม่รู้ว่าใครหนุน</span>
          )}
        </div>
      ))}
      {inside ? (
        <>
          <p className="small">
            บทบาทของคุณ: {role ? ROLE_NAME[role] : "-"} · ตำแหน่ง: <b>{COURT_RANKS[courtRank(life)]}</b>
            {patron && ` · ผู้อุปถัมภ์: ${patron.name}`}
          </p>
          {schemeHeat(life) > 0 && <p className={`small ${schemeHeat(life) >= 30 ? "danger-text" : "muted"}`}>ร่องรอยของแผนที่ผ่านมา: {HEAT_LABEL(schemeHeat(life))}</p>}
          {known.length > 0 && <div className="section-title">คนในวังที่คุณรู้จัก</div>}
          {known.map((n) => (
            <p className="small" key={n.id}>
              <b>{n.name}</b> <span className="muted">({n.title})</span> —{" "}
              {n.backs === "emperor" ? "ภักดีต่อฮ่องเต้" : n.backs === "self" ? "หนุนตัวเอง" : `หนุน${princeById(life, n.backs)?.name ?? "?"}`}
              {n.you.trust >= 20 && " · ไว้ใจคุณ"}
              {n.you.debt >= 20 && " · ติดหนี้คุณ"}
              {n.you.grudge >= 20 && <span className="danger-text"> · แค้นคุณ</span>}
            </p>
          ))}
          <p className="muted small">กิจกรรมในวังอยู่ที่แท็บ 🎯 ทำ → ราชสำนัก</p>
        </>
      ) : (
        <p className="muted small">
          {life.flags.palaceWithdrawn ? "คุณถอนตัวจากการเมืองในวังแล้ว — ได้ยินแค่ข่าวลือ" : "คนนอกวังรู้แค่ข่าวลือ — เข้าวังได้ผ่านอาชีพขุนนาง องครักษ์หลวง หมอหลวง หรือเมื่อถูกเรียกตัว"}
        </p>
      )}
      {c.reigns.length > 0 && (
        <p className="muted small">
          รัชกาลก่อน: {c.reigns.slice(-3).map((r) => `${r.name} (${r.from}–${r.to}, ${r.how.split(" — ")[0]})`).join(" · ")}
        </p>
      )}
    </div>
  );
}

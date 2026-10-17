// M20 — การ์ดฐานของคุณ (โลกวันสิ้นโลก): ทรัพยากร · อาคาร · ชาวฐาน · นโยบาย · ออกสำรวจ/แลกเปลี่ยน
import {
  BUILDINGS,
  DOOR,
  LAW,
  RATION,
  RES_INFO,
  ROLE_INFO,
  build,
  buildsLeft,
  canBuild,
  defense,
  getBase,
  nextCost,
  setPolicy,
  siteById,
  tierName,
  type Res,
} from "../../content/apocalypse/base";
import { canExpedition, canTrade, startExpedition, startTrade } from "../../content/apocalypse/m20core";
import type { Life } from "../../engine/types";
import type { Act } from "../App";

export function BaseCard({ life, act }: { life: Life; act: Act }) {
  const b = getBase(life);
  if (!b) {
    if (!life.flags.doomed) return null;
    return (
      <div className="sys-window base-card">
        <div className="sys-head">🏚️ ฐาน</div>
        <p className="muted small">{life.flags.rebuilt ? "โลกฟื้นแล้ว — คุณไม่เคยมีฐานของตัวเอง" : "ยังไม่มีฐาน — ผู้รอดชีวิตจะหันมาหาคุณเมื่อคุณพร้อมนำ (อายุ 14 ขึ้นไป)"}</p>
      </div>
    );
  }
  const s = siteById(b.site);
  const ruins = !life.flags.rebuilt;
  const lead = b.lead && ruins;
  const need = { food: Math.round(b.pop * [1.25, 1, 0.75][b.ration]), water: Math.round(b.pop * 0.9), med: Math.ceil(b.pop / 14), mat: 0 };
  return (
    <div className="sys-window base-card">
      <div className="sys-head">
        {b.town ? "🏘️" : s.emoji} {b.name} · {tierName(b)}
      </div>
      <p className="muted small">
        {s.name} · ตั้งเมื่ออายุ {b.founded} · {b.lead ? "👑 คุณเป็นผู้นำ" : "คุณไม่ได้เป็นผู้นำ (รอการเลือกตั้ง)"}
        {b.allies ? ` · 🤝 พันธมิตร ${b.allies}` : ""}
        {ruins && b.feud >= 35 ? ` · ☠️ แค้นแก๊งปล้น ${b.feud}` : ""}
      </p>

      <div className="base-res">
        {(Object.keys(RES_INFO) as Res[]).map((k) => (
          <div key={k} className={`base-res-item ${ruins && need[k] > b[k] ? "short" : ""}`} title={k === "mat" ? "ใช้สร้างอาคาร" : `ใช้ปีละ ~${need[k]}`}>
            <span>{RES_INFO[k].emoji}</span>
            <b>{b[k]}</b>
            <span className="small muted">{RES_INFO[k].name}</span>
          </div>
        ))}
        <div className="base-res-item">
          <span>👥</span>
          <b>{b.pop}</b>
          <span className="small muted">ประชากร</span>
        </div>
      </div>
      <div className="base-morale">
        <span className="small">ขวัญกำลังใจ {b.morale}</span>
        <div className="bar">
          <div className={`fill ${b.morale >= 60 ? "high" : b.morale >= 30 ? "mid" : "low"}`} style={{ width: `${b.morale}%` }} />
        </div>
        {ruins && <span className="small muted">🛡️ ป้องกัน {defense(b)}</span>}
      </div>

      <div className="section-title">อาคาร{lead ? ` · สร้างได้อีก ${Math.max(0, buildsLeft(life))} ครั้งปีนี้` : ""}</div>
      {BUILDINGS.map((info) => {
        const lv = b.b[info.id];
        const why = canBuild(life, info.id);
        return (
          <div className="job" key={info.id}>
            <div className="job-main">
              <div className="job-name">
                {info.emoji} {info.name} <span className="base-lv">Lv.{lv}</span>
              </div>
              <div className="job-sub">{lv ? info.effect(lv) : info.desc}</div>
            </div>
            {lead && lv < info.max && (
              <button className="btn small" disabled={!!why} title={why} onClick={() => act((l) => build(l, info.id))}>
                {lv ? "อัปเกรด" : "สร้าง"} 🧱{nextCost(b, info.id)}
              </button>
            )}
          </div>
        );
      })}

      {b.res.length > 0 && (
        <>
          <div className="section-title">ชาวฐานคนสำคัญ</div>
          <div className="chips">
            {b.res.map((r) => (
              <span key={r.id} className="chip" title={`${ROLE_INFO[r.role].desc} · ความภักดี ${r.loy}`}>
                {ROLE_INFO[r.role].emoji} {r.n}
                <span className="chip-sub">
                  {" "}
                  · {ROLE_INFO[r.role].name}
                  {r.tag === "lover" ? " 💕" : r.tag === "rival" ? " ⚔️" : ""}
                </span>
              </span>
            ))}
          </div>
        </>
      )}

      {lead && (
        <>
          <div className="section-title">นโยบาย</div>
          <Policy label="🍚 ปันส่วน" opts={RATION} cur={b.ration} pick={(v) => act((l) => setPolicy(l, "ration", v))} />
          <Policy label="🚪 ผู้ลี้ภัย" opts={DOOR} cur={b.door} pick={(v) => act((l) => setPolicy(l, "door", v))} />
          <Policy label="⚖️ บทลงโทษ" opts={LAW} cur={b.law} pick={(v) => act((l) => setPolicy(l, "law", v))} />
          <div className="row">
            <button className="btn" disabled={!canExpedition(life)} onClick={() => act((l) => startExpedition(l))}>
              🎒 ออกสำรวจ
            </button>
            <button className="btn" disabled={!canTrade(life)} onClick={() => act((l) => startTrade(l))}>
              🚚 แลกของกับฐานอื่น
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Policy({ label, opts, cur, pick }: { label: string; opts: string[]; cur: number; pick: (v: number) => void }) {
  return (
    <div className="base-policy">
      <span className="small">{label}</span>
      <div className="chips">
        {opts.map((o, i) => (
          <button key={o} className={`chip ${cur === i ? "on" : ""}`} onClick={() => cur !== i && pick(i)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

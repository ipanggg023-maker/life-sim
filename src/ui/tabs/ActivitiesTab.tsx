import { BABY_AGE, activitiesFor, activityLocked, activityNotes, doActivity, timeBudget, timeLeft } from "../../engine/activities";
import type { Life } from "../../engine/types";
import { loc, money } from "../../engine/util";
import type { Act } from "../App";
import { noEmoji } from "../Icon";
import { Fold } from "../Fold";
import { placeHidden, placeName, placeOf } from "../../content/murim/life/place";
import { useState } from "react";
import { GOALS, GROUP_HINTS, MAX_GOALS, goalDone, goalsOf, setGoal, suggestionsOf } from "../../content/fantasy/ease";
import { hintSeen, hintsOn, markHint } from "../settings";

const ROLE_GROUPS = new Set(["ทรัพย์สิน", "ราชสำนัก", "วังหลัง", "ชีวิตในวัง"]);

export function ActivitiesTab({ life, act }: { life: Life; act: Act }) {
  if (life.age < BABY_AGE)
    return (
      <div className="tab-content">
        <div className="card">
          <p>คุณยังเป็นเด็กเล็ก — กิน นอน ร้องไห้ และมองโลกด้วยตาโตๆ</p>
          <p className="muted small">พ่อแม่ดูแลทุกอย่างให้ กด +1 ปี เพื่อเติบโต (ทำกิจกรรมเองได้ตั้งแต่ {BABY_AGE} ขวบ)</p>
        </div>
      </div>
    );
  // ของที่ยังซื้อไม่ได้และงานของตำแหน่งที่คุณไม่ได้เป็น ไม่ต้องขึ้นเป็นปุ่มล็อก
  const list = activitiesFor(life).filter((a) => life.age >= a.minAge - 2 && (!ROLE_GROUPS.has(a.group ?? "") || !a.available || a.available(life)));
  const place = placeOf(life);
  // หมวดของสถานที่ขึ้นก่อน
  const groups = [...new Set(list.map((a) => a.group ?? ""))].sort((a, b) => Number(b === place?.group) - Number(a === place?.group));
  const hidden = place ? placeHidden(life) : 0;
  const left = timeLeft(life);
  return (
    <div className="tab-content">
      {left !== undefined && <TimeBar left={left} max={timeBudget.fn?.(life) ?? left} />}
      {life.worldId === "fantasy" && life.age >= 6 && (
        <label className="auto-decide small">
          <input type="checkbox" checked={!!life.flags.ftAutoDecide} onChange={() => act((l) => { l.flags.ftAutoDecide = !l.flags.ftAutoDecide; })} />
          ให้นิสัยตัดสินเรื่องหลักของปีแทน (เล่นเร็ว)
        </label>
      )}
      {life.worldId === "fantasy" && life.age >= 6 && <FtPlan life={life} act={act} />}
      {place && (
        <div className="card place-card">
          <b>ตอนนี้คุณอยู่: {place.name}</b>
          <div className="small muted">{place.note}{hidden > 0 ? ` · ทำจากที่นี่ไม่ได้อีก ${hidden} อย่าง` : ""}</div>
        </div>
      )}
      {groups.map((g) => {
        const items = list.filter((a) => (a.group ?? "") === g).sort((a, b) => Number(!!activityLocked(life, a)) - Number(!!activityLocked(life, b)));
        const grid = (
          <div className="grid">
            {items.map((a) => {
              const locked = activityLocked(life, a);
              const odds = a.odds?.(life);
              return (
                <button key={a.id} className="activity" disabled={!!locked} onClick={() => act((l) => doActivity(l, a.id))}>
                  <span className="act-name">{noEmoji(loc(life, placeName(life, a)))}</span>
                  <span className="act-desc">
                    {noEmoji(locked ?? loc(life, a.desc))}
                    {!locked && a.cost && life.age >= 18 ? ` · ${money(life, a.cost)}` : ""}
                    {!locked && odds !== undefined ? ` · ${Math.round(odds * 100)}%` : ""}
                    {!locked && left !== undefined && (a.time ?? 1) > 1 ? ` · ใช้เวลา ${a.time}` : ""}
                  </span>
                  {activityNotes.map((f) => f(life, a)).filter(Boolean).map((n) => <span className="act-note" key={n}>{n}</span>)}
                </button>
              );
            })}
          </div>
        );
        return g ? (
          <Fold always kind="section" key={g} id={`act-${g}`} title={g}>
            {life.worldId === "fantasy" && <GroupHint group={g} />}
            {grid}
          </Fold>
        ) : (
          <div key="all">{grid}</div>
        );
      })}
    </div>
  );
}

/** เวลาที่เหลือในปีนี้ — เต็ม = ยังว่าง · จาง = ใช้ไปแล้ว */
export function TimeBar({ left, max }: { left: number; max: number }) {
  return (
    <div className="time-bar">
      <span>เวลาปีนี้</span>
      <span className="time-dots" aria-label={`เหลือ ${left} จาก ${max} ส่วน`}>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={i < left ? "on" : ""}></span>
        ))}
      </span>
      <span className="muted small">{left > 0 ? `เหลือ ${left}/${max}` : "หมดแล้ว — กด +1 ปี"}</span>
    </div>
  );
}

/** แฟนตาซี: สิ่งที่น่าทำปีนี้ และเป้าหมายชีวิต */
function FtPlan({ life, act }: { life: Life; act: Act }) {
  const [pick, setPick] = useState(false);
  const sug = suggestionsOf(life);
  const goals = goalsOf(life);
  return (
    <>
      {sug.length > 0 && (
        <div className="card">
          <div className="card-title">น่าทำปีนี้</div>
          <div className="grid">
            {sug.map((x) => (
              <button key={x.id} className="activity" onClick={() => act((l) => doActivity(l, x.id))}>
                <span className="act-name">{x.name}</span>
                <span className="act-desc">{x.why}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <Fold kind="section" id="ft-goals" title={<>เป้าหมายชีวิต <span className="fold-count">{goals.length}/{MAX_GOALS}</span></>}>
        {goals.map((g) => (
          <div key={g.id}>
            <p className="small"><b>{g.name}</b>{goalDone(life, g.id) ? " · สำเร็จแล้ว" : ` · ${Math.round(g.progress(life) * 100)}%`}</p>
            <div className="bar"><div className="bar-fill" style={{ width: `${Math.round(g.progress(life) * 100)}%` }} /></div>
            {!goalDone(life, g.id) && <p className="small muted">ก้าวต่อไป: {g.next(life)}</p>}
          </div>
        ))}
        {goals.length === 0 && <p className="small muted">ตั้งเป้าหมายได้สูงสุด {MAX_GOALS} อย่าง เกมจะแนะนำสิ่งที่ช่วยให้ไปถึง และฉลองเมื่อทำสำเร็จ</p>}
        <button className="btn small" onClick={() => setPick(!pick)}>{pick ? "เสร็จแล้ว" : "เลือกเป้าหมาย"}</button>
        {pick && (
          <div className="row">
            {GOALS.map((g) => {
              const on = goals.some((x) => x.id === g.id);
              return <button key={g.id} className={`chip ${on ? "on" : ""}`} disabled={!on && goals.length >= MAX_GOALS} onClick={() => act((l) => setGoal(l, g.id, !on))}>{g.name}</button>;
            })}
          </div>
        )}
      </Fold>
    </>
  );
}

/** คำแนะนำครั้งแรกของแต่ละหมวด (ปิดได้ในตั้งค่า) */
function GroupHint({ group }: { group: string }) {
  const [, force] = useState(0);
  const text = GROUP_HINTS[group];
  if (!text || !hintsOn() || hintSeen(group)) return null;
  return (
    <p className="small hint">
      {text} <button className="link-btn" onClick={() => { markHint(group); force((n) => n + 1); }}>เข้าใจแล้ว</button>
    </p>
  );
}

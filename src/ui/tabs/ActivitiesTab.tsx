import { BABY_AGE, activitiesFor, activityLocked, doActivity, timeBudget, timeLeft } from "../../engine/activities";
import type { Life } from "../../engine/types";
import { loc, money } from "../../engine/util";
import type { Act } from "../App";
import { noEmoji } from "../Icon";
import { Fold } from "../Fold";

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
  const list = activitiesFor(life).filter((a) => life.age >= a.minAge - 2);
  const groups = [...new Set(list.map((a) => a.group ?? ""))];
  const left = timeLeft(life);
  return (
    <div className="tab-content">
      {left !== undefined && <TimeBar left={left} max={timeBudget.fn?.(life) ?? left} />}
      {groups.map((g) => {
        const items = list.filter((a) => (a.group ?? "") === g).sort((a, b) => Number(!!activityLocked(life, a)) - Number(!!activityLocked(life, b)));
        const grid = (
          <div className="grid">
            {items.map((a) => {
              const locked = activityLocked(life, a);
              const odds = a.odds?.(life);
              return (
                <button key={a.id} className="activity" disabled={!!locked} onClick={() => act((l) => doActivity(l, a.id))}>
                  <span className="act-name">{noEmoji(loc(life, a.name))}</span>
                  <span className="act-desc">
                    {noEmoji(locked ?? loc(life, a.desc))}
                    {!locked && a.cost && life.age >= 18 ? ` · ${money(life, a.cost)}` : ""}
                    {!locked && odds !== undefined ? ` · ${Math.round(odds * 100)}%` : ""}
                    {!locked && left !== undefined && (a.time ?? 1) > 1 ? ` · ใช้เวลา ${a.time}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        );
        return g ? (
          <Fold always kind="section" key={g} id={`act-${g}`} title={g}>
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

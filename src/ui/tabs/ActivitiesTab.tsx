import { BABY_AGE, activitiesFor, activityLocked, doActivity } from "../../engine/activities";
import type { Life } from "../../engine/types";
import { loc, money } from "../../engine/util";
import type { Act } from "../App";

export function ActivitiesTab({ life, act }: { life: Life; act: Act }) {
  if (life.age < BABY_AGE)
    return (
      <div className="tab-content">
        <div className="card">
          <p>👶 คุณยังเป็นเด็กเล็ก — กิน นอน ร้องไห้ และมองโลกด้วยตาโตๆ</p>
          <p className="muted small">พ่อแม่ดูแลทุกอย่างให้ กด +1 ปี เพื่อเติบโต (ทำกิจกรรมเองได้ตั้งแต่ {BABY_AGE} ขวบ)</p>
        </div>
      </div>
    );
  return (
    <div className="tab-content grid">
      {activitiesFor(life).filter((a) => life.age >= a.minAge - 2).map((a) => {
        const locked = activityLocked(life, a);
        const odds = a.odds?.(life);
        return (
          <button key={a.id} className="activity" disabled={!!locked} onClick={() => act((l) => doActivity(l, a.id))}>
            <span className="act-emoji">{a.emoji}</span>
            <span className="act-name">{loc(life, a.name)}</span>
            <span className="act-desc">
              {locked ?? loc(life, a.desc)}
              {!locked && a.cost && life.age >= 18 ? ` · ${money(life, a.cost)}` : ""}
              {!locked && odds !== undefined ? ` · ${Math.round(odds * 100)}%` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

import { ACTIVITIES, activityLocked, doActivity } from "../../engine/activities";
import type { Life } from "../../engine/types";
import { formatMoney } from "../../engine/util";
import type { Act } from "../App";

export function ActivitiesTab({ life, act }: { life: Life; act: Act }) {
  return (
    <div className="tab-content grid">
      {ACTIVITIES.filter((a) => life.age >= a.minAge - 2).map((a) => {
        const locked = activityLocked(life, a);
        const odds = a.odds?.(life);
        return (
          <button key={a.id} className="activity" disabled={!!locked} onClick={() => act((l) => doActivity(l, a.id))}>
            <span className="act-emoji">{a.emoji}</span>
            <span className="act-name">{a.name}</span>
            <span className="act-desc">
              {locked ?? a.desc}
              {!locked && a.cost && life.age >= 18 ? ` · ${formatMoney(a.cost)}` : ""}
              {!locked && odds !== undefined ? ` · ${Math.round(odds * 100)}%` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// M21: ส่วนเสริมของหน้าต่างระบบ — วิวัฒนาการ ร้านค้าระบบ ดวงตาประเมินค่า ภารกิจรายวันที่สอง สกิลพิเศษ
import { EVOLUTIONS, appraiseLeft, evoOf, openShop, shopOpen, slotOf, startAppraise, sysDaily2 } from "../../content/ordinary/m21sys";
import type { Life } from "../../engine/types";
import type { Act } from "../App";

export function SystemExtras({ life, act }: { life: Life; act: Act }) {
  const evo = evoOf(life);
  const slot = slotOf(life);
  return (
    <>
      <div className="section-title">วิวัฒนาการของระบบ ({evo}/3)</div>
      <div className="skill-list">
        {EVOLUTIONS.map((e, i) => (
          <p className={`small${evo > i ? "" : " muted"}`} key={e.lv}>
            {evo > i ? e.emoji : "🔒"} <b>Lv.{e.lv} {e.name}</b> — {e.desc}
          </p>
        ))}
        {slot && (
          <p className="small">
            {slot.emoji} สกิลพิเศษ: <b>{slot.name}</b> — {slot.desc}
          </p>
        )}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sys-btn" disabled={!shopOpen(life)} onClick={() => act((l) => void openShop(l))}>
          🛒 ร้านค้าระบบ
        </button>
        {evo >= 1 && (
          <button className="btn sys-btn" disabled={!appraiseLeft(life) || !!life.queue.length} onClick={() => act((l) => void startAppraise(l))}>
            👁️ ประเมินค่า
          </button>
        )}
        {evo >= 2 && (
          <button className="btn sys-btn" disabled={life.doneThisYear.includes("daily2")} onClick={() => act(sysDaily2)}>
            📋 ภารกิจรายวัน #2
          </button>
        )}
      </div>
    </>
  );
}

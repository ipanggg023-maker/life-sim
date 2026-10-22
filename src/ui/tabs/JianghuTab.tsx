// แท็บยุทธภพ (MURIM_PLAN §10): สถานการณ์ใต้หล้า · ทำเนียบและสำนักของคุณ · สงครามสามแคว้น · ที่อยู่ · สถานะทางกฎหมาย
import { ERA } from "../../content/murim/life/world";
import { regionOf } from "../../content/murim/life/region";
import { heatOf, jailed, mourning } from "../../content/murim/life/law";
import type { Life } from "../../engine/types";
import type { Act } from "../App";
import { MurimCard } from "./MurimCard";
import { legendsOf, myYoungPlace, youngList } from "../../content/murim/world/jianghu";
import { WorldCard } from "./PowerTab";

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
      <WorldCard life={life} />
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

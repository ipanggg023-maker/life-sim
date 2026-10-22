// M17 — การ์ดยุทธภพ: ทำเนียบยอดฝีมือ · มาตรธรรมะ/มาร · สมุดบุญคุณ/ความแค้น · สำนักของตัวเอง
import { useState } from "react";
import {
  RANK_SIZE, SECT_COST, alignLabel, alignment, canFound, foundSect, ledger, masterLabel, masters, myPlace, mySect, sectNameOptions,
} from "../../content/murim/m17core";
import type { Life } from "../../engine/types";
import { SECT_BUILDINGS, SECT_BUSINESS, buildSect, hasBuilding, openSectBusiness, sectMorale } from "../../content/murim/world/jianghu";
import { money } from "../../engine/util";
import type { Act } from "../App";

export function MurimCard({ life, act }: { life: Life; act: Act }) {
  return (
    <>
      <RankingBoard life={life} />
      <AlignmentMeter life={life} />
      <Ledger life={life} />
      <SectPanel life={life} act={act} />
    </>
  );
}

function RankingBoard({ life }: { life: Life }) {
  const list = masters(life);
  const me = myPlace(life);
  const news = String(life.flags.m17NewsShown ?? "").split("|").filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="card m17-card">
      <div className="card-title">📜 ทำเนียบยอดฝีมือ</div>
      <p className="small muted">
        {me ? `คุณอยู่อันดับ ${me} จาก ${RANK_SIZE}` : life.flags.m17Best ? `เคยติดอันดับ ${life.flags.m17Best} — ตอนนี้หลุดทำเนียบ` : "ยังไม่ติดทำเนียบ — ทำเนียบสิบยอดฝีมือใต้หล้าเป็นของผู้ที่ถึงขั้นจุดสูงสุดขึ้นไป"}
      </p>
      <ol className="m17-rank">
        {list.map((m, i) => (
          <li key={m.id} className={m.me ? "me" : ""}>
            <span className="m17-place">{i + 1}</span>
            <span className="m17-name">{m.me ? `【${m.e}】คุณ` : masterLabel(m)}</span>
            <span className="m17-age small muted">{m.a} ปี</span>
          </li>
        ))}
      </ol>
      {news.length > 0 && <p className="small muted">ข่าวล่าสุด: {news.join(" · ")}</p>}
    </div>
  );
}

function AlignmentMeter({ life }: { life: Life }) {
  const v = alignment(life);
  // −100 (มาร) ซ้าย … +100 (ธรรมะ) ขวา
  const pos = (v + 100) / 2;
  return (
    <div className="card m17-card">
      <div className="card-title">☯️ มาตรธรรมะ / มาร</div>
      <div className="m17-align">
        <span className="small">มาร</span>
        <div className="m17-align-bar">
          <div className="m17-align-mark" style={{ left: `${pos}%` }} />
        </div>
        <span className="small">ธรรมะ</span>
      </div>
      <p className="small">
        <b>{alignLabel(v)}</b> ({v > 0 ? "+" : ""}
        {v}){" "}
        <span className="muted">
          {v <= -40 ? "· พันธมิตรยุทธจักรออกล่าคุณ ลัทธิมารเปิดประตูรอ" : v >= 40 ? "· ฝ่ายธรรมะไว้วางใจ ประตูพันธมิตรยุทธจักรเปิดให้" : "· ทั้งสองฝ่ายยังจับตาดูว่าคุณจะเลือกทางไหน"}
        </span>
      </p>
    </div>
  );
}

function Ledger({ life }: { life: Life }) {
  const list = ledger(life);
  const open = list.filter((e) => !e.d);
  const done = list.filter((e) => e.d);
  return (
    <div className="card m17-card">
      <div className="card-title">📖 สมุดบุญคุณ / ความแค้น</div>
      {!list.length && <p className="small muted">ยังว่างเปล่า — ทุกคนที่คุณช่วยหรือทำร้าย จะถูกจดไว้ที่นี่ และสักวันจะกลับมา</p>}
      <ul className="m17-ledger">
        {open.map((e) => (
          <li key={e.id} className={e.k === "f" ? "favor" : "grudge"}>
            <span>{e.k === "f" ? "📗" : "📕"}</span>
            <span>
              <b>{e.n}</b> — {e.w} <span className="muted small">(อายุ {e.a})</span>
            </span>
          </li>
        ))}
        {done.map((e) => (
          <li key={e.id} className="done">
            <span>✔️</span>
            <span className="small muted">
              {e.n}: {e.d}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectPanel({ life, act }: { life: Life; act: Act }) {
  const s = mySect(life);
  const [name, setName] = useState("");
  if (s) {
    return (
      <div className="card m17-card">
        <div className="card-title">🏯 {s.n}</div>
        <div className="status-grid">
          <span>ก่อตั้งเมื่อ</span>
          <b>อายุ {s.y} ({life.age - s.y} ปีก่อน)</b>
          <span>ศิษย์</span>
          <b>{s.d} คน</b>
          <span>ศิษย์เอก/ทายาท</span>
          <b>{s.h ?? "ยังไม่มี"}</b>
          <span>คู่อริ</span>
          <b>
            {s.rv} <span className="small muted">(กำลัง {s.rr})</span>
          </b>
        </div>
        <div className="m17-sect-rep">
          <span className="small">ชื่อเสียงสำนัก</span>
          <div className="bar">
            <div className="fill high" style={{ width: `${s.r}%` }} />
          </div>
          <span className="small">{s.r}</span>
        </div>
        <div className="m17-sect-rep">
          <span className="small">ขวัญศิษย์</span>
          <div className="bar">
            <div className={`fill ${sectMorale(s) >= 60 ? "high" : sectMorale(s) >= 35 ? "mid" : "low"}`} style={{ width: `${sectMorale(s)}%` }} />
          </div>
          <span className="small">{sectMorale(s)}</span>
        </div>
        <div className="section-title">อาคาร</div>
        {SECT_BUILDINGS.map((b) => {
          const owned = hasBuilding(s, b.id);
          return (
            <div className="job" key={b.id}>
              <div className="job-main">
                <div className="job-name">{owned ? "✅ " : ""}{b.name}</div>
                <div className="job-sub">{b.desc}</div>
              </div>
              {!owned && (
                <button className="btn small" disabled={life.money < b.cost * 1000} onClick={() => act((l) => buildSect(l, b.id))}>
                  สร้าง {b.cost} ตำลึง
                </button>
              )}
            </div>
          );
        })}
        <div className="section-title">กิจการของสำนัก</div>
        {SECT_BUSINESS.map((b) => {
          const owned = !!s.biz?.includes(b.id);
          return (
            <div className="job" key={b.id}>
              <div className="job-main">
                <div className="job-name">{owned ? "✅ " : ""}{b.name}</div>
                <div className="job-sub">{b.desc} · รายได้ราว {b.income} ตำลึง/ปี</div>
              </div>
              {!owned && (
                <button className="btn small" disabled={life.money < b.cost * 1000} onClick={() => act((l) => openSectBusiness(l, b.id))}>
                  เปิด {b.cost} ตำลึง
                </button>
              )}
            </div>
          );
        })}
        <p className="small muted">ค่าดูแลอาคารและเลี้ยงศิษย์หักจากเงินทุกปี · ขวัญต่ำ ศิษย์จะหนี</p>
      </div>
    );
  }
  const blocked = canFound(life);
  if (blocked && (life.power?.rank ?? 0) < 4) return null;
  const placeholder = sectNameOptions({ ...life, rng: life.rng })[0];
  return (
    <div className="card m17-card">
      <div className="card-title">🏯 ก่อตั้งสำนักของตัวเอง</div>
      <p className="small muted">{blocked ?? `ค่าก่อสร้าง ${money(life, SECT_COST)} — ตั้งชื่อสำนักที่จะอยู่ไปอีกร้อยปี`}</p>
      {!blocked && (
        <div className="row">
          <input className="m17-input" maxLength={30} placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn small primary"
            onClick={() =>
              act((l) => {
                if (canFound(l)) return;
                return { text: foundSect(l, name || placeholder), kind: "milestone" };
              })
            }
          >
            ก่อตั้ง
          </button>
        </div>
      )}
    </div>
  );
}

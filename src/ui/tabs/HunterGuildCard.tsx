// M16 — โลก Hunter: ตลาดคอร์มอนสเตอร์ + กิลด์ของตัวเอง
import { useState } from "react";
import {
  CORE_TIERS,
  FOUND_COST,
  MARKET_NEWS,
  canFound,
  canRecruit,
  coresOf,
  corePrice,
  disbandGuild,
  foundGuild,
  guildLv,
  guildRanking,
  guildRep,
  holdingValue,
  marketIndex,
  myGuild,
  recruit,
  recruitCost,
  roster,
  rosterCap,
  sellAllCores,
  sellCores,
  totalCores,
} from "../../content/hunter/m16";
import { rankName } from "../../content/hunter/power";
import type { Life } from "../../engine/types";
import { money } from "../../engine/util";
import type { Act } from "../App";

export function HunterGuildCard({ life, act }: { life: Life; act: Act }) {
  return (
    <>
      <CoreMarket life={life} act={act} />
      {life.power && <OwnGuild life={life} act={act} />}
    </>
  );
}

function CoreMarket({ life, act }: { life: Life; act: Act }) {
  const idx = marketIndex(life);
  const news = MARKET_NEWS[String(life.flags.coreNews ?? "calm")] ?? MARKET_NEWS.calm;
  const busy = life.queue.length > 0;
  return (
    <>
      <div className="section-title">ตลาดคอร์มอนสเตอร์</div>
      <div className="m16-market">
        <div className="m16-index">
          <span>ดัชนีราคา</span>
          <b className={idx >= 120 ? "m16-up" : idx <= 80 ? "m16-down" : ""}>
            {idx} {idx >= 120 ? "▲" : idx <= 80 ? "▼" : "•"}
          </b>
          <span className="muted small">{news}</span>
        </div>
        {CORE_TIERS.map((t, i) => {
          const n = coresOf(life, i);
          return (
            <div className="job m16-tier" key={t.name}>
              <div className="job-main">
                <div className="job-name">
                  {t.emoji} {t.name} <span className="muted small">({t.ranks})</span>
                </div>
                <div className="job-sub">
                  มี {n} ก้อน · ราคา {money(life, corePrice(life, i))}/ก้อน
                </div>
              </div>
              <button className="btn small" disabled={!n || busy} onClick={() => act((l) => sellCores(l, i, 1))}>
                ขาย 1
              </button>
              <button className="btn small ghost" disabled={!n || busy} title="ได้ 1.5 เท่า แต่เสี่ยงโดนยึดและปรับ" onClick={() => act((l) => sellCores(l, i, n, true))}>
                🕶️ ตลาดมืด
              </button>
            </div>
          );
        })}
        <div className="row">
          <button className="btn" disabled={!totalCores(life) || busy} onClick={() => act(sellAllCores)}>
            💎 ขายทั้งหมด ({money(life, holdingValue(life))})
          </button>
        </div>
        <p className="muted small">บอสใน Gate ดรอปคอร์ให้เก็บไว้เอง — ปีที่มี Gate Break ราคาพุ่ง ปีที่คอร์ล้นตลาดราคาดิ่ง</p>
      </div>
    </>
  );
}

function OwnGuild({ life, act }: { life: Life; act: Act }) {
  const name = myGuild(life);
  const [draft, setDraft] = useState(`กิลด์${life.lastName}`);
  if (!name) {
    const why = canFound(life);
    return (
      <>
        <div className="section-title">ก่อตั้งกิลด์ของตัวเอง</div>
        <div className="m16-guild">
          <p className="muted small">
            แรงก์ B ขึ้นไป · Hunter · เงิน {money(life, FOUND_COST)} · ชื่อเสียง 15+
          </p>
          <div className="row">
            <input className="m16-input" value={draft} maxLength={24} onChange={(e) => setDraft(e.target.value)} placeholder="ชื่อกิลด์" />
            <button className="btn" disabled={!!why} title={why} onClick={() => act((l) => foundGuild(l, draft))}>
              🏰 ก่อตั้ง
            </button>
          </div>
          {why && <p className="muted small">🔒 {why}</p>}
        </div>
      </>
    );
  }
  const members = roster(life);
  const net = Number(life.flags.gNet ?? 0);
  const blocked = canRecruit(life);
  return (
    <>
      <div className="section-title">🏰 {name}</div>
      <div className="m16-guild">
        <div className="status-grid">
          <span>เลเวลกิลด์</span>
          <b>
            Lv.{guildLv(life)} {life.flags.gHall ? "· มีสำนักงานใหญ่" : ""}
          </b>
          <span>ชื่อเสียงกิลด์</span>
          <b>{guildRep(life)}/100</b>
          <span>อันดับในประเทศ</span>
          <b>#{guildRanking(life)}</b>
          <span>สมาชิก</span>
          <b>
            {members.length}/{rosterCap(life)}
          </b>
          <span>กำไรปีที่แล้ว</span>
          <b className={net < 0 ? "danger-text" : ""}>{money(life, net)}</b>
        </div>
        <div className="bar m16-rep">
          <div className="fill" style={{ width: `${guildRep(life)}%` }} />
        </div>
        <ul className="m16-roster">
          {members.map((m, i) => (
            <li key={i}>
              <span className={`rank r${m.r}`}>{rankName(m.r)}</span> {m.n} <span className="muted small">· {m.t}</span>
              <span className={`m16-loyal ${m.y < 30 ? "danger-text" : ""}`}>♥ {m.y}</span>
            </li>
          ))}
          {!members.length && <li className="muted">ยังไม่มีสมาชิก</li>}
        </ul>
        <div className="row">
          <button className="btn" disabled={!!blocked} title={blocked} onClick={() => act(recruit)}>
            📋 เปิดรับสมัคร ({money(life, recruitCost(life))})
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              if (window.confirm(`ยุบ「${name}」? สมาชิกทุกคนจะแยกย้าย`)) act(disbandGuild);
            }}
          >
            ยุบกิลด์
          </button>
        </div>
      </div>
    </>
  );
}

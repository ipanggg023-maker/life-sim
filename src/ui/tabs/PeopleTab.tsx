import { useState } from "react";
import { runEvent, argue, askMoney, breakUp, propose, spendTime, tryForBaby, confess, cutTies, giveGift } from "../../engine/game";
import type { Life, Person, Relation } from "../../engine/types";
import { relationLabel, shortName } from "../../engine/util";
import type { Act } from "../App";

const ORDER: Relation[] = ["spouse", "partner", "ally", "child", "father", "mother", "sibling", "friend", "rival"];

export function PeopleTab({ life, act }: { life: Life; act: Act }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = [...life.people].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || ORDER.indexOf(a.relation) - ORDER.indexOf(b.relation),
  );

  if (!list.length) return <p className="muted">คุณยังไม่รู้จักใครเลย</p>;

  return (
    <div className="tab-content">
      {list.map((p) => (
        <div className={`person ${p.alive ? "" : "dead"}`} key={p.id}>
          <button className="person-row" onClick={() => setOpen(open === p.id ? null : p.id)} disabled={!p.alive}>
            <div>
              <div className="person-name">
                {p.name} {p.alive ? "" : "🕯️"}
              </div>
              <div className="person-sub">
                {relationLabel(p)} · อายุ {p.age}
                {p.job ? ` · ${p.job}` : ""}
              </div>
            </div>
            {p.alive && (
              <div className="bond">
                <div className="bar">
                  <div className="fill bond-fill" style={{ width: `${p.bond}%` }} />
                </div>
              </div>
            )}
          </button>
          {open === p.id && p.alive && <PersonActions life={life} p={p} act={act} />}
        </div>
      ))}
    </div>
  );
}

function PersonActions({ life, p, act }: { life: Life; p: Person; act: Act }) {
  const isParent = p.relation === "father" || p.relation === "mother";
  if (life.age < 3)
    return (
      <div className="person-actions">
        <span className="muted small">👶 คุณยังพูดไม่ได้ — ได้แต่ยิ้มและจับนิ้ว{shortName(p)}ไว้แน่น</span>
      </div>
    );
  return (
    <div className="person-actions">
      {life.age >= 4 && (
      <button className="btn small" disabled={life.doneThisYear.includes(`talk:${p.id}`)} onClick={() => act((l) => { l.doneThisYear.push(`talk:${p.id}`); runEvent(l, "talk.menu", { pid: p.id }); })}>
        💬 คุย
      </button>
      )}
      <button className="btn small" disabled={life.doneThisYear.includes(`time:${p.id}`)} onClick={() => act((l) => spendTime(l, p))}>
        {life.age < 6 ? "เล่นด้วยกัน" : "ใช้เวลาด้วยกัน"}
      </button>
      {isParent && life.age >= 6 && (
        <button className="btn small" disabled={life.doneThisYear.includes(`ask:${p.id}`)} onClick={() => act((l) => askMoney(l, p))}>
          ขอเงิน
        </button>
      )}
      {p.relation === "partner" && life.age >= 18 && (
        <button className="btn small" disabled={life.doneThisYear.includes("propose")} onClick={() => act((l) => propose(l, p))}>
          💍 ขอแต่งงาน
        </button>
      )}
      {p.relation === "spouse" && (
        <button className="btn small" disabled={life.doneThisYear.includes("baby")} onClick={() => act((l) => tryForBaby(l, p))}>
          👶 มีลูก
        </button>
      )}
      {(p.relation === "partner" || p.relation === "spouse") && (
        <button className="btn small ghost" onClick={() => act((l) => breakUp(l, p))}>
          {p.relation === "spouse" ? "หย่า" : "เลิก"}
        </button>
      )}
      {life.age >= 6 && (
        <button className="btn small" disabled={life.doneThisYear.includes(`gift:${p.id}`)} onClick={() => act((l) => giveGift(l, p))}>
          🎁 ให้ของขวัญ
        </button>
      )}
      {["friend", "rival", "ally"].includes(p.relation) && life.age >= 15 && !life.people.some((x) => x.alive && (x.relation === "partner" || x.relation === "spouse")) && (
        <button className="btn small" disabled={life.doneThisYear.includes("confess")} onClick={() => act((l) => confess(l, p))}>
          💌 สารภาพรัก
        </button>
      )}
      {["friend", "rival", "ally"].includes(p.relation) && (
        <button className="btn small ghost" onClick={() => act((l) => cutTies(l, p))}>
          ตัดขาด
        </button>
      )}
      {life.age >= 6 && (
        <button className="btn small ghost" onClick={() => act((l) => argue(l, p))}>
          ทะเลาะ
        </button>
      )}
    </div>
  );
}

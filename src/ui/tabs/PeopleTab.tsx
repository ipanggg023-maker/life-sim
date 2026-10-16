import { useState } from "react";
import { argue, askMoney, breakUp, propose, spendTime, tryForBaby } from "../../engine/game";
import type { Life, Person, Relation } from "../../engine/types";
import { relationLabel } from "../../engine/util";
import type { Act } from "../App";

const ORDER: Relation[] = ["spouse", "partner", "child", "father", "mother", "sibling", "friend", "rival"];

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
  return (
    <div className="person-actions">
      <button className="btn small" disabled={life.doneThisYear.includes(`time:${p.id}`)} onClick={() => act((l) => spendTime(l, p))}>
        ใช้เวลาด้วยกัน
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
      <button className="btn small ghost" onClick={() => act((l) => argue(l, p))}>
        ทะเลาะ
      </button>
    </div>
  );
}

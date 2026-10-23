import { useEffect, useState } from "react";
import { runEvent, argue, askMoney, breakUp, propose, spendTime, tryForBaby, confess, cutTies, giveGift } from "../../engine/game";
import type { Life, Person, Relation } from "../../engine/types";
import { relationLabel, shortName } from "../../engine/util";
import type { Act } from "../App";
import { AXIS, goalOf, notableAxes, traitName, traitsOf, profileOf, relOf } from "../../engine/npc";
import { isRealistic } from "../../content/worlds";
import { lineageOf } from "../../content/murim/life/generations";
import { martialLabel } from "../../content/murim/life/npcMartial";

const ORDER: Relation[] = ["spouse", "partner", "ally", "child", "father", "mother", "sibling", "friend", "rival"];

export function PeopleTab({ life, act, focus = null, onShowLog }: { life: Life; act: Act; focus?: string | null; onShowLog?: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(focus);
  // แตะชื่อจากบันทึก → เลื่อนไปหาคนนั้น
  useEffect(() => {
    if (focus) document.getElementById(`person-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus]);
  const list = [...life.people].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || ORDER.indexOf(a.relation) - ORDER.indexOf(b.relation),
  );

  if (!list.length) return <p className="muted">คุณยังไม่รู้จักใครเลย</p>;

  return (
    <div className="tab-content">
      {life.worldId === "murim" && <LineageCard life={life} pick={(id) => { setOpen(id); document.getElementById(`person-${id}`)?.scrollIntoView({ block: "center" }); }} />}
      {list.map((p) => (
        <div className={`person ${p.alive ? "" : "dead"} ${focus === p.id ? "focused" : ""}`} key={p.id} id={`person-${p.id}`}>
          <button className="person-row" onClick={() => setOpen(open === p.id ? null : p.id)}>
            <div>
              <div className="person-name">
                {p.name} <Sex p={p} />{p.alive ? null : <span className="muted small"> · ล่วงลับ</span>}
              </div>
              <div className="person-sub">
                {relationLabel(p, life)} · อายุ {p.age}
                {p.job ? ` · ${p.job}` : ""}
                {p.tags?.some((t) => t.startsWith("away:")) ? " · ย้ายไปอยู่ไกล" : ""}
                {p.tags?.includes("life_rival") ? " · คู่ปรับตลอดชีวิต" : ""}
                {p.martial ? ` · ${martialLabel(life, p)}` : ""}
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
          {open === p.id && p.alive && isRealistic(life.worldId) && <PersonMind p={p} />}
          {open === p.id && !p.alive && <div className="person-mind small muted">จากไปแล้ว — เหลือไว้เพียงความทรงจำ</div>}
          {open === p.id && p.alive && p.tags?.some((t) => t.startsWith("away:")) && <div className="person-mind small muted">ย้ายไปตั้งตัวที่อื่นแล้ว — ติดต่อได้แค่จดหมาย รอวันเขากลับมา</div>}
          {open === p.id && p.alive && !p.tags?.some((t) => t.startsWith("away:")) && <PersonActions life={life} p={p} act={act} />}
          {open === p.id && onShowLog && life.worldId === "murim" && (
            <div className="person-actions">
              <button className="btn small ghost" onClick={() => onShowLog(p.id)}>
                ดูเรื่องของ{shortName(p)}ในบันทึก
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** ใจของคนนี้: บุคลิก เป้าหมาย ความรู้สึกเด่นๆ และเรื่องที่เขาจำได้ */
function PersonMind({ p }: { p: Person }) {
  const axes = notableAxes(p);
  const mem = (p.mem ?? []).filter((m) => m.known).slice(-3).reverse();
  const r = relOf(p);
  const pr = profileOf(p);
  // รู้จักตัวตนเชิงลึกของเขาเท่าที่สนิทพอ — ไม่ใช่เห็นทุกอย่างตั้งแต่แรก
  const family = ["father", "mother", "sibling", "spouse", "child"].includes(p.relation);
  const knowsHeart = family || r.trust >= 40 || r.love >= 60;
  const knowsLine = family || r.respect >= 45 || r.trust >= 55;
  return (
    <div className="person-mind">
      <div className="small muted">
        บุคลิก: {traitsOf(p).map(traitName).join(" · ")} · {goalOf(p)}
        {pr.sideGoals.length > 0 && knowsHeart && ` · และ${pr.sideGoals[0]}`}
      </div>
      {knowsHeart && (
        <div className="small muted">
          ให้ค่ากับ{pr.values.join(" และ ")} · {pr.fear}
          {knowsLine && pr.limit && ` · เส้นที่ไม่ข้าม: ${pr.limit}`}
        </div>
      )}
      {pr.secret?.known && <div className="small danger-text">ความลับ: เขา{pr.secret.text}</div>}
      {axes.length > 0 && (
        <div className="axis-row">
          {axes.map(({ axis, value }) => (
            <span key={axis} className={`axis-chip ${AXIS[axis].good ? "good" : "bad"}`}>
              {AXIS[axis].name} {value}
            </span>
          ))}
        </div>
      )}
      {mem.length > 0 && (
        <div className="small muted">
          จำได้ว่า: {mem.map((m) => `${m.text} (ตอนคุณอายุ ${m.age})`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function PersonActions({ life, p, act }: { life: Life; p: Person; act: Act }) {
  const isParent = p.relation === "father" || p.relation === "mother";
  if (life.age < 3)
    return (
      <div className="person-actions">
        <span className="muted small">คุณยังพูดไม่ได้ — ได้แต่ยิ้มและจับนิ้ว{shortName(p)}ไว้แน่น</span>
      </div>
    );
  return (
    <div className="person-actions">
      {life.age >= 4 && (
      <button className="btn small" disabled={life.doneThisYear.includes(`talk:${p.id}`)} onClick={() => act((l) => { l.doneThisYear.push(`talk:${p.id}`); runEvent(l, "talk.menu", { pid: p.id }); })}>
        คุย
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
          ขอแต่งงาน
        </button>
      )}
      {p.relation === "spouse" && (
        <button className="btn small" disabled={life.doneThisYear.includes("baby")} onClick={() => act((l) => tryForBaby(l, p))}>
          มีลูก
        </button>
      )}
      {(p.relation === "partner" || p.relation === "spouse") && (
        <button className="btn small ghost" onClick={() => act((l) => breakUp(l, p))}>
          {p.relation === "spouse" ? "หย่า" : "เลิก"}
        </button>
      )}
      {life.age >= 6 && (
        <button className="btn small" disabled={life.doneThisYear.includes(`gift:${p.id}`)} onClick={() => act((l) => giveGift(l, p))}>
          ให้ของขวัญ
        </button>
      )}
      {["friend", "rival", "ally"].includes(p.relation) && life.age >= 15 && !life.people.some((x) => x.alive && (x.relation === "partner" || x.relation === "spouse")) && (
        <button className="btn small" disabled={life.doneThisYear.includes("confess")} onClick={() => act((l) => confess(l, p))}>
          สารภาพรัก
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

/** ผังตระกูลและสายอาจารย์–ศิษย์ พร้อมสถานะชีวิต (EXPANSION §15) */
function LineageCard({ life, pick }: { life: Life; pick: (id: string) => void }) {
  const anc = lineageOf(life);
  const by = (f: (p: Person) => boolean) => life.people.filter(f);
  const parents = by((p) => p.relation === "father" || p.relation === "mother");
  const sibs = by((p) => p.relation === "sibling");
  const mates = by((p) => p.relation === "spouse" || p.relation === "partner");
  const kids = by((p) => p.relation === "child").sort((a, b) => b.age - a.age);
  const masters = by((p) => !!p.tags?.includes("master"));
  const pupils = by((p) => !!p.tags?.includes("disciple"));
  const Chip = ({ p }: { p: Person }) => (
    <button className={`kin-chip ${p.alive ? "" : "dead"}`} onClick={() => pick(p.id)}>
      
      {shortName(p)} <Sex p={p} />
      <small> {relationLabel(p, life)} · {p.age}</small>
    </button>
  );
  const Row = ({ label, list }: { label: string; list: Person[] }) =>
    list.length ? (
      <div className="kin-row">
        <span className="kin-label">{label}</span>
        <div className="kin-list">
          {list.map((p) => (
            <Chip p={p} key={p.id} />
          ))}
        </div>
      </div>
    ) : null;
  return (
    <details className="card lineage">
      <summary className="card-title">ผังตระกูล · สายอาจารย์–ศิษย์</summary>
      {anc.length > 0 && (
        <div className="kin-row">
          <span className="kin-label">รุ่นก่อน</span>
          <div className="kin-anc">
            {anc.map((a, i) => (
              <div className="small" key={i}>
                <b>{a.n}</b> ({a.y}){a.r ? ` · ขั้น${a.r}` : ""} — {a.cause}
                <span className="muted"> ↓ {a.how === "heir" ? "ทายาท" : "ศิษย์"}สืบต่อ</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <Row label="อาจารย์" list={masters} />
      <Row label="พ่อแม่" list={parents} />
      <div className="kin-row">
        <span className="kin-label">คุณ</span>
        <div className="kin-list">
          <span className="kin-chip me">{life.lastName}{life.firstName}<small> · {life.age}</small></span>
          {mates.map((p) => (
            <Chip p={p} key={p.id} />
          ))}
        </div>
      </div>
      <Row label="พี่น้อง" list={sibs} />
      <Row label="ลูก" list={kids} />
      <Row label="ศิษย์" list={pupils} />
    </details>
  );
}

/** เพศของ NPC (ผู้เล่นขอให้รู้ชัดทุกคน) — สัญลักษณ์ + ข้อความสำหรับโปรแกรมอ่านหน้าจอ */
function Sex({ p }: { p: Person }) {
  return (
    <span className={`gender-tag ${p.gender}`} aria-label={p.gender === "f" ? "หญิง" : "ชาย"} title={p.gender === "f" ? "หญิง" : "ชาย"}>
      {p.gender === "f" ? "♀" : "♂"}
    </span>
  );
}

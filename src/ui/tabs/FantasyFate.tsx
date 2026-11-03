// ส่วนแสดงผลของ "ทุกทางเลือกมีผล": นิสัย สมุดชะตา ข่าวลือ และความรู้สึกของแต่ละคน
import type { Life, Person } from "../../engine/types";
import { Fold } from "../Fold";
import { AXES, PERSONA, personaOf, traitWords, SHOWN } from "../../content/fantasy/persona";
import { seedsOf } from "../../content/fantasy/conseq";
import { heatWord, kingdomName, oldTales, talkIn } from "../../content/fantasy/rumors";
import { feelingWords, topMemories } from "../../content/fantasy/people2";
import { goalOf, traitName, traitsOf } from "../../engine/npc";
import { kingdomsOf } from "../../content/fantasy/state";

/** นิสัยของคุณในสายตาคนอื่น · แสดงเป็นแถบสองขั้ว */
export function PersonaCard({ life }: { life: Life }) {
  if (!life.ft || life.age < 6) return null;
  const p = personaOf(life);
  const words = traitWords(life);
  return (
    <Fold always kind="section" id="ft-persona" title={<>คนรอบตัวมองคุณว่า</>}>
      <p className="small">{words.length ? `เป็นคน${words.join(" · ")}` : "ยังไม่มีใครบอกได้ว่าคุณเป็นคนแบบไหน"}</p>
      {AXES.map((k) => (
        <div className="persona-row small" key={k}>
          <span className={p[k] <= -SHOWN ? "" : "muted"}>{PERSONA[k].neg}</span>
          <div className="persona-bar"><i style={{ left: `${(p[k] + 100) / 2}%` }} /></div>
          <span className={p[k] >= SHOWN ? "" : "muted"}>{PERSONA[k].pos}</span>
        </div>
      ))}
      <p className="small muted">นิสัยเปลี่ยนตามทุกทางเลือก ยิ่งโตยิ่งเปลี่ยนยาก · ทำตามนิสัยตัวเองสำเร็จง่ายขึ้นเล็กน้อย</p>
    </Fold>
  );
}

/** ความรู้สึกและความทรงจำของคนคนนี้ · เป็นคำ ไม่ใช่ตัวเลข */
export function FantasyMind({ p }: { p: Person }) {
  const words = feelingWords(p);
  const mems = topMemories(p);
  return (
    <div className="person-mind">
      <div className="small muted">{traitsOf(p).map(traitName).join(" · ")} · {goalOf(p)}</div>
      {words.length > 0 && <div className="small">ตอนนี้เขา{words.join(" · ")}</div>}
      {mems.length > 0 ? (
        <div className="small muted">จำได้ว่า: {mems.map((m) => `${m.text} (ตอนคุณอายุ ${m.age})`).join(" · ")}</div>
      ) : (
        <div className="small muted">ยังไม่มีเรื่องที่เขาจำเกี่ยวกับคุณเป็นพิเศษ</div>
      )}
    </div>
  );
}

/** สมุดชะตา: เมล็ดที่ปลูกไว้ และเรื่องที่กลับมาแล้ว */
export function FateLedger({ life }: { life: Life }) {
  if (!life.ft) return null;
  const seeds = [...seedsOf(life)].sort((a, b) => b.age - a.age);
  const waiting = seeds.filter((s) => s.done === undefined);
  const back = seeds.filter((s) => s.done !== undefined);
  return (
    <Fold always kind="section" id="ft-ledger" title={<>สมุดชะตา <span className="fold-count">{seeds.length}</span></>}>
      {seeds.length === 0 && <p className="small muted">ทางเลือกที่มีป้าย "จะถูกจดจำ" จะถูกเขียนไว้ที่นี่ และวันหนึ่งมันจะกลับมาหาคุณ</p>}
      {waiting.slice(0, 12).map((s) => <p className="small" key={`${s.id}${s.age}`}>อายุ {s.age} · คุณ{s.note} · <span className="muted">ยังไม่กลับมา</span></p>)}
      {back.slice(0, 10).map((s) => <p className="small muted" key={`${s.id}${s.age}`}>อายุ {s.age} · คุณ{s.note} · กลับมาแล้วตอนอายุ {s.done}</p>)}
    </Fold>
  );
}

/** ข่าวลือ: แต่ละแผ่นดินพูดถึงคุณว่าอย่างไร */
export function RumorFold({ life }: { life: Life }) {
  if (!life.ft) return null;
  const lands = kingdomsOf(life).map((k) => ({ k, talk: talkIn(life, k.id) })).filter((x) => x.talk.length);
  const old = oldTales(life).slice(0, 3);
  return (
    <Fold kind="section" id="ft-rumors" title={<>ผู้คนพูดถึงคุณ</>}>
      {lands.length === 0 && <p className="small muted">ยังไม่มีใครพูดถึงคุณนอกบ้าน</p>}
      {lands.map(({ k, talk }) => (
        <div key={k.id}>
          <p className="small"><b>{kingdomName(life, k.id)}</b></p>
          {talk.slice(0, 4).map((r) => <p className={`small ${r.tone > 0 ? "" : "danger-text"}`} key={r.text}>ว่าคุณ{r.text} · <span className="muted">{heatWord(r.heat)}</span></p>)}
        </div>
      ))}
      {old.length > 0 && <p className="small muted">เรื่องเล่าของคนรุ่นก่อน: {old.map((r) => `${r.who}${r.text}`).join(" · ")}</p>}
    </Fold>
  );
}

// ส่วนแสดงผลของ "ทุกทางเลือกมีผล": นิสัย สมุดชะตา ข่าวลือ และความรู้สึกของแต่ละคน
import type { Life, Person } from "../../engine/types";
import { Fold } from "../Fold";
import { AXES, PERSONA, personaOf, traitWords, SHOWN } from "../../content/fantasy/persona";
import { seedsOf } from "../../content/fantasy/conseq";
import { heatWord, kingdomName, oldTales, talkIn } from "../../content/fantasy/rumors";
import { feelingWords, topMemories } from "../../content/fantasy/people2";
import { goalOf, traitName, traitsOf } from "../../engine/npc";
import { dataOf, homeKingdom, kingdomsOf } from "../../content/fantasy/state";
import { powerParts } from "../../content/fantasy/power";
import { ASPECTS, VOWS, aspectsOf, vowOf } from "../../content/fantasy/powerplus";
import { TEMPERS, marksOf, regard, regardWord, rulerView, temperOf, viewWord } from "../../content/fantasy/worldmark";
import { bossOf, matesOf, workFactors } from "../../content/fantasy/worklife";

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

/** ที่ทำงาน: เจ้านาย เพื่อนร่วมงาน และสิ่งที่ทำให้ผลงานขึ้นลง */
export function WorkplaceCard({ life }: { life: Life }) {
  if (!life.ft || !life.job?.careerId.startsWith("ft_")) return null;
  const boss = bossOf(life);
  const mates = matesOf(life);
  const fx = workFactors(life);
  return (
    <div className="workplace small">
      {boss && <p>เจ้านาย: <b>{boss.name}</b>{feelingWords(boss)[0] ? ` · ${feelingWords(boss)[0]}` : ""}</p>}
      {mates.length > 0 && <p>เพื่อนร่วมงาน: {mates.map((m) => `${m.name}${feelingWords(m)[0] ? ` (${feelingWords(m)[0]})` : ""}`).join(" · ")}</p>}
      {fx.length > 0 ? (
        <p className="muted">ผลงานปีนี้: {fx.map((x) => `${x.label} ${x.value > 0 ? "+" : ""}${x.value}`).join(" · ")}</p>
      ) : (
        <p className="muted">ผลงานขึ้นกับเจ้านาย เพื่อนร่วมงาน นิสัยที่เหมาะกับงาน และชื่อเสียงของคุณ</p>
      )}
      <p className="muted">ผลงานถึง 60 จะได้ลุ้นชิงตำแหน่งกับเพื่อนร่วมงาน · เรื่องในที่ทำงานจะมาให้เลือกเป็นระยะ</p>
    </div>
  );
}

/** รอยเท้าของคุณ: สิ่งที่คุณเปลี่ยนแผ่นดิน · ผู้ครองแต่ละแผ่นดิน · ฝ่ายอำนาจ · บทบาทในสงคราม */
export function WorldMarkFolds({ life }: { life: Life }) {
  if (!life.ft) return null;
  const marks = [...marksOf(life)].reverse().slice(0, 12);
  const lands = kingdomsOf(life);
  const facs = dataOf(life).factions;
  const war = homeKingdom(life).war ? kingdomsOf(life).find((k) => k.id === homeKingdom(life).war) : undefined;
  const merit = Number(life.flags.ftWarMerit ?? 0);
  return (
    <>
      {war && (
        <Fold always kind="section" id="ft-war-role" title={<>สงครามกับ{war.name}</>}>
          <p className="small">บทบาทของคุณ: {merit >= 6 ? "คนที่ทั้งเมืองจะจดจำ" : merit >= 2 ? "ช่วยแผ่นดินอยู่ไม่น้อย" : merit <= -5 ? "มีคนเริ่มนับบัญชีคุณ" : merit < 0 ? "มีคนมองคุณด้วยสายตาแปลกๆ" : "ยังเป็นแค่คนธรรมดาในสงคราม"}</p>
          <p className="small muted">เมื่อสงครามจบ แผ่นดินจะตัดสินว่าคุณทำอะไรระหว่างนั้น</p>
        </Fold>
      )}
      <Fold kind="section" id="ft-marks" title={<>รอยเท้าของคุณบนแผ่นดิน <span className="fold-count">{marksOf(life).length}</span></>}>
        {marks.length === 0 && <p className="small muted">สิ่งที่คุณทำซึ่งเปลี่ยนแผ่นดินจะถูกจดไว้ที่นี่</p>}
        {marks.map((m, i) => <p className="small" key={i}>อายุ {m.age} · {m.text} · <span className="muted">{lands.find((k) => k.id === m.k)?.name}</span></p>)}
      </Fold>
      <Fold kind="section" id="ft-rulers" title={<>ผู้ครองแต่ละแผ่นดินมองคุณ</>}>
        {lands.map((k) => <p className="small" key={k.id}><b>{k.ruler}</b> แห่ง{k.name} · {TEMPERS[temperOf(k)].name} ({TEMPERS[temperOf(k)].desc}) · {viewWord(rulerView(life, k))}</p>)}
      </Fold>
      <Fold kind="section" id="ft-regard" title={<>ฝ่ายอำนาจมองคุณ</>}>
        {facs.map((x) => <p className="small" key={x.id}><b>{x.name}</b> · {regardWord(regard(life, x))}</p>)}
      </Fold>
    </>
  );
}

/** แท็บพลัง: พลังต่อสู้มาจากไหน · แง่มุมจากนิสัย · ปณิธาน · ท่าประจำตัว */
export function PowerSourceFolds({ life }: { life: Life }) {
  if (!life.ft) return null;
  const parts = powerParts(life).sort((a, b) => b[1] - a[1]);
  const on = aspectsOf(life);
  const v = vowOf(life);
  const f = life.ft;
  return (
    <>
      <Fold kind="section" id="ft-power-parts" title={<>พลังต่อสู้มาจาก</>}>
        {parts.map(([k, n]) => <p className={`small ${n < 0 ? "danger-text" : ""}`} key={k}>{k} · {n > 0 ? "+" : ""}{Math.round(n)}</p>)}
        {f.signature && <p className="small muted">ท่าประจำตัว "{f.signature.name}"{f.signature.tier >= 2 ? " · ขั้นตำนาน" : ""}</p>}
      </Fold>
      <Fold kind="section" id="ft-aspects" title={<>พลังจากนิสัย <span className="fold-count">{on.length}</span></>}>
        {ASPECTS.map((a) => { const has = on.includes(a); return <p className={`small ${has ? "" : "muted"}`} key={a.name}>{has ? <b>{a.name}</b> : a.name} · {PERSONA[a.axis][a.dir > 0 ? "pos" : "neg"]} · {a.desc}</p>; })}
        <p className="small muted">นิสัยที่เด่นมากพอจะปลุกพลังนั้นขึ้นมาเอง และหายไปถ้านิสัยเปลี่ยน</p>
      </Fold>
      <Fold kind="section" id="ft-vow" title={<>ปณิธาน</>}>
        {v ? <p className="small"><b>{v.name}</b> · ถือมาตั้งแต่อายุ {f.vow!.age} · {v.desc}</p> : <p className="small muted">ยังไม่ได้ตั้งปณิธาน · ตั้งได้ที่แท็บทำ</p>}
        {v && <p className="small muted">ทางเลือกที่ไป{PERSONA[v.axis][v.dir > 0 ? "neg" : "pos"]}อย่างชัดเจนจะทำลายปณิธานนี้ทันที</p>}
        {f.vowBroke && <p className="small danger-text">เคยผิด{VOWS.find((x) => x.id === f.vowBroke!.id)?.name}ตอนอายุ {f.vowBroke.age}</p>}
      </Fold>
    </>
  );
}

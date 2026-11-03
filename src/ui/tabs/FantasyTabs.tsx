// แท็บเฉพาะโลกแฟนตาซี: พลังของตัวละคร และสภาพโลก
import { RACES } from "../../content/fantasy/life";
import { BODY_RANKS, GUILD_RANKS, MAGIC_RANKS, canCast, combat, magicCap, needXp } from "../../content/fantasy/power";
import { ELEMENTS, manaLeft, manaMax, spellsOf } from "../../content/fantasy/magic";
import { schoolOf } from "../../content/fantasy/places";
import { classStanding, rivalOf } from "../../content/fantasy/schoollife";
import { shortName } from "../../engine/util";
import { FACTION_RANKS, myFaction, standingWord } from "../../content/fantasy/civic";
import { bondOf, moodWord, mountOf } from "../../content/fantasy/dragons";
import { MYSTERIES } from "../../content/fantasy/mysteries";
import { titleOf } from "../../content/fantasy/empire";
import { throneOf } from "../../content/fantasy/realm";
import { DOMAINS, REALMS } from "../../content/fantasy/realms";
import { GOODS, priceOf } from "../../content/fantasy/society";
import { LAWS, ROLES, dataOf, fl, homeKingdom, myRelic, standingOf, worldOfLife, type Good } from "../../content/fantasy/state";
import { talentById } from "../../content/talents";
import type { Life } from "../../engine/types";
import { Fold } from "../Fold";

const Bar = ({ label, value, need }: { label: string; value: number; need: number }) => (
  <div className="mini-bar">
    <span>{label}</span>
    <div className="bar">
      <div className="fill high" style={{ width: `${Math.min(100, (value / need) * 100)}%` }} />
    </div>
  </div>
);

export function FantasyPowerTab({ life }: { life: Life }) {
  const f = fl(life);
  const s = schoolOf(life);
  const relic = myRelic(life);
  const known = life.talents.filter((t) => t.revealed);
  const d = dataOf(life);
  const faction = myFaction(life);
  return (
    <div className="tab-content">
      <Fold always id="ft-power" title={<>ตัวคุณ</>}>
        <div className="status-grid">
          <span>เผ่า</span>
          <b>{RACES[f.race].name}</b>
          <span>พลังต่อสู้</span>
          <b>{combat(life)}</b>
          <span>สายกาย</span>
          <b>{BODY_RANKS[f.bodyRank]}</b>
          <span>สายเวท</span>
          <b>{MAGIC_RANKS[f.magicRank]}</b>
          <span>พรสวรรค์เวท</span>
          <b>{"★".repeat(f.potential) || "ไม่มี"}</b>
          <span>กิลด์</span>
          <b>{f.guild ? `ขั้น${GUILD_RANKS[f.guild]}` : "ยังไม่สมัคร"}</b>
        </div>
        <Bar label="ฝึกกาย" value={f.body} need={needXp(f.bodyRank)} />
        <Bar label="ฝึกเวท" value={f.magic} need={needXp(f.magicRank)} />
        <p className="small muted">{RACES[f.race].desc}</p>
        <p className="small muted">{canCast(life) ? `ร่ายเวทได้ เพดานตอนนี้: ${MAGIC_RANKS[magicCap(life)]}` : "ยังร่ายเวทไม่ได้ ซื้อคทาได้ที่แท็บทำ"}</p>
      </Fold>
      <Fold always kind="section" id="ft-gear" title={<>ของติดตัว</>}>
        <p className="small">{f.wand ? f.wand.name : "ไม่มีคทา"}{f.magicRank >= 3 ? " · ร่ายได้โดยไม่ต้องใช้คทา" : ""}</p>
        {relic && <p className="small"><b>{relic.name}</b> · {relic.power}</p>}
        {s && <p className="small">{f.graduated ? "ศิษย์เก่า" : "นักเรียน"}{s.name}{f.graduated ? "" : ` · ${classStanding(life)}`}{f.cups ? ` · แชมป์ ${f.cups} สมัย` : ""}</p>}
        {rivalOf(life)?.alive && <p className="small">คู่ปรับ: {shortName(rivalOf(life)!)} · พลัง {f.rivalPower}</p>}
        {throneOf(life) && <p className="small"><b>ผู้ครอง{throneOf(life)!.name}</b> · มั่นคง {throneOf(life)!.stability} · กำลังทัพ {throneOf(life)!.power}</p>}
        {f.consort && <p className="small">คู่ครองของผู้ครอง{d.kingdoms.find((k) => k.id === f.consort)?.name}</p>}
        {faction && <p className="small">{FACTION_RANKS[f.fRank]}แห่ง{faction.name}{f.fRank < 3 ? ` · ผลงาน ${f.fMerit ?? 0}` : ""}</p>}
        {f.foe && <p className="small">มีคนตามล่า: {d.factions.find((x) => x.id === f.foe)?.name}</p>}
        <p className="small">ชื่อเสียงใน{homeKingdom(life).name}: {standingWord(standingOf(life))} ({standingOf(life)})</p>
        {Number(life.flags.jailUntil ?? -1) > life.age && <p className="small">ติดคุกถึงอายุ {String(life.flags.jailUntil)} ปี</p>}
        {mountOf(life) && <p className="small">ขี่มังกร{mountOf(life)}</p>}
        {f.egg && <p className="small">ไข่มังกรธาตุ{ELEMENTS[f.egg.element].name} · ความอุ่น {f.egg.warmth}/4</p>}
        {f.whelp && <p className="small">ลูกมังกร{f.whelp.name} · อายุ {f.whelp.age} · ผูกพัน {f.whelp.bond} · พลัง {f.whelp.power}</p>}
        {f.dragonblood && <p className="small">เลือดมังกรไหลในตัวคุณ</p>}
        {(f.pacts ?? 0) > 0 && <p className="small">พันธสัญญาปีศาจ {f.pacts} ฉบับ · อายุขัยหายไป {(f.pacts ?? 0) * 10} ปี</p>}
        {f.demonHorn && <p className="small">เขาของเจ้าชายปีศาจ</p>}
        {(f.divine ?? 0) > 0 && <p className="small">ผ่านบททดสอบแห่งสวรรค์ {f.divine}/3</p>}
        {f.realmVisits && <p className="small">เคยไป: {(Object.keys(f.realmVisits) as (keyof typeof REALMS)[]).map((r) => REALMS[r].name).join(", ")}</p>}
      </Fold>
      <Fold always kind="section" id="ft-magic" title={<>เวทมนตร์ · ธาตุ{ELEMENTS[f.element ?? "fire"].name}</>}>
        <p className="small">มานาปีนี้ {manaLeft(life)}/{manaMax(life)} · บทสวด {f.chant ?? 0} · วงเวท {f.circle ?? 0} · อักษรรูน {f.rune ?? 0}</p>
        {spellsOf(life).length ? spellsOf(life).map((x) => <p className="small" key={x.id}>{x.name} · ธาตุ{ELEMENTS[x.element].name} ขั้น {x.tier}</p>) : <p className="small muted">ยังไม่รู้จักเวทบทไหน</p>}
      </Fold>
      {known.length > 0 && (
        <Fold kind="section" id="ft-talents" title={<>พรสวรรค์</>}>
          {known.map((t) => <p className="small" key={t.id}><b>{talentById(t.id)?.name}</b> · {talentById(t.id)?.desc}</p>)}
        </Fold>
      )}
      {f.deeds.length > 0 && (
        <Fold kind="section" id="ft-deeds" title={<>เรื่องที่ทำไว้</>}>
          {f.deeds.map((d, i) => <p className="small" key={i}>{d}</p>)}
        </Fold>
      )}
      {f.scars.length > 0 && (
        <Fold kind="section" id="ft-scars" title={<>แผลแห่งชะตา</>}>
          {f.scars.map((d, i) => <p className="small" key={i}>{d}</p>)}
        </Fold>
      )}
    </div>
  );
}

export function FantasyWorldTab({ life }: { life: Life }) {
  const w = worldOfLife(life);
  const d = dataOf(life);
  const f = fl(life);
  const here = homeKingdom(life);
  return (
    <div className="tab-content">
      <Fold always id="ft-here" title={<>ที่อยู่ของคุณ</>}>
        <p className="small">{here.name} · ปกครองโดย{here.ruler}</p>
        <p className="small muted">ปี {w.year}{here.war ? " · กำลังมีสงคราม" : ""}{here.plague ? " · มีโรคระบาด" : ""}{here.famine ? " · ทุพภิกขภัย" : ""}</p>
        {(here.laws ?? []).map((id) => <p className="small" key={id}><b>{LAWS[id].name}</b> · {LAWS[id].desc}</p>)}
        {(here.laws ?? []).length === 0 && <p className="small muted">ไม่มีกฎหมายพิเศษ</p>}
      </Fold>
      <Fold always id="ft-kingdoms" title={<>อาณาจักร</>}>
        {d.kingdoms.map((k) => (
          <p className="small" key={k.id}>{titleOf(d, k)}{k.overlord ? ` (เมืองขึ้นของ${d.kingdoms.find((x) => x.id === k.overlord)?.name})` : ""} · {k.ruler}{k.elective ? ` (ผู้นำสภา · เลือกตั้งครั้งหน้าปี ${k.nextElection ?? w.year})` : ""} · กำลัง {k.power} · เศรษฐกิจ {k.prosperity ?? 100}{k.war ? " · สงคราม" : ""}{k.famine ? " · ทุพภิกขภัย" : ""}{k.plague ? " · โรคระบาด" : ""}</p>
        ))}
      </Fold>
      <Fold id="ft-prices" title={<>ราคาสินค้า</>}>
        {d.kingdoms.map((k) => <p className="small" key={k.id}>{k.name} · {(Object.keys(GOODS) as Good[]).map((g) => `${GOODS[g].name} ${priceOf(k, g)}`).join(" · ")}</p>)}
      </Fold>
      <Fold id="ft-factions" title={<>ฝ่ายอำนาจ</>}>
        {d.factions.map((x) => <p className="small" key={x.id}><b>{x.name}</b> · {x.creed} · กำลัง {x.power} · ผู้นำ {x.leader || "ว่าง"}{x.feud ? ` · ศึกกับ${d.factions.find((o) => o.id === x.feud)?.name}` : ""}</p>)}
      </Fold>
      <Fold id="ft-notables" title={<>บุคคลสำคัญ</>}>
        {d.notables.slice().sort((a, b) => b.fame * 5 + b.power - a.fame * 5 - a.power).slice(0, 12).map((n) => <p className="small" key={n.id}>{n.name} · {ROLES[n.role]} · อายุ {n.age} · พลัง {n.power}</p>)}
      </Fold>
      <Fold always id="ft-dragon" title={<>มังกร ({d.dragons.filter((x) => x.alive).length})</>}>
        {d.dragons.map((x) => <p className="small" key={x.id}>{x.alive ? `${x.name} ${x.title} · ธาตุ${ELEMENTS[x.element].name} · อายุ ${x.age} · พลัง ${x.power} · ${moodWord(x.mood)}${bondOf(life, x) ? ` · ผูกพัน ${bondOf(life, x)}` : ""}` : `${x.name} ถูกสังหารโดย${x.slainBy ?? "กาลเวลา"}`}</p>)}
        {d.eggs.length > 0 && <p className="small muted">มีไข่มังกรรอฟักอยู่ {d.eggs.length} ฟอง</p>}
      </Fold>
      <Fold id="ft-beyond" title={<>ภพอื่นและเทพ</>}>
        {d.gates.filter((g) => g.until >= w.year).map((g, i) => <p className="small" key={i}>ประตูสู่{REALMS[g.realm].name}เปิดอยู่ที่{d.kingdoms.find((k) => k.id === g.kingdom)?.name} ถึงปี {g.until}</p>)}
        {d.gates.every((g) => g.until < w.year) && <p className="small muted">ตอนนี้ไม่มีประตูมิติเปิดอยู่</p>}
        {d.gods.map((g, i) => <p className="small" key={i}>เทพ{g.name} · เทพแห่ง{DOMAINS[g.domain as keyof typeof DOMAINS]} · ขึ้นสวรรค์ปี {g.year}</p>)}
      </Fold>
      <Fold id="ft-mysteries" title={<>ปริศนา</>}>
        {MYSTERIES.map((m) => { const st = d.mysteries?.[m.id]; const knows = f.mKnown?.includes(m.id); return <p className="small" key={m.id}>{knows || st?.solvedBy ? m.name : "ปริศนาที่ยังไม่มีใครรู้"}{st?.solvedBy ? ` · ไขแล้วโดย${st.solvedBy}` : knows ? ` · ขั้น ${st?.step ?? 0}/${m.steps.length}` : ""}</p>; })}
      </Fold>
      <Fold id="ft-relics" title={<>อาวุธตำนาน</>}>
        {d.relics.map((r) => (
          <p className="small" key={r.id}><b>{r.name}</b> · {r.power} · {r.holder === "player" ? "อยู่กับคุณ" : r.holder === "lost" ? "สูญหาย" : `ข่าวว่าอยู่กับ${r.holder}`}{r.history?.length ? ` · ผู้ถือในอดีต: ${r.history.slice(-3).join(", ")}` : ""}</p>
        ))}
      </Fold>
      {w.legends.length > 0 && (
        <Fold always id="ft-legends" title={<>ตำนาน</>}>
          {w.legends.slice().reverse().map((g, i) => <p className="small" key={i}>ปี {g.year} · {g.name} · {g.deed}</p>)}
        </Fold>
      )}
      <Fold id="ft-chronicle" title={<>พงศาวดาร</>}>
        {w.chronicle.slice(-20).reverse().map((c, i) => <p className="small" key={i}>ปี {c.year} · {c.text}</p>)}
      </Fold>
    </div>
  );
}

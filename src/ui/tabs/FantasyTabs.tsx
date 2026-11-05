import { CORRUPT_WORDS, CRAFT_NAME, CRAFT_RANKS, KILLS_TO_NAME, POTIONS, corruptionOf, craftRank, learnedOf, nextBreak, secluded, secludedUntil, standingLine, type Craft } from "../../content/fantasy/power2";
import { YEARS_PER_CAP } from "../../content/fantasy/power";
import { dangerLines } from "../../content/fantasy/danger";
import { lawLines } from "../../content/fantasy/underworld";
import { careerLines } from "../../content/fantasy/careers2";
import { moneyLines } from "../../content/fantasy/money2";
import { societyLines } from "../../content/fantasy/society2";
import { BESTIARY, timesMet } from "../../content/fantasy/bestiary";
import { PARENTING, familyRec, parentingOf, type Parenting } from "../../content/fantasy/family2";
import { prejudice, riteOf, riteState } from "../../content/fantasy/races";
import { raceLabel } from "../../content/fantasy/birth";
import { fitGender } from "../../engine/util";
// แท็บเฉพาะโลกแฟนตาซี: พลังของตัวละคร และสภาพโลก
import { RACES } from "../../content/fantasy/life";
import { BODY_RANKS, FOCUS, GUILD_RANKS, MAGIC_RANKS, bodyCap, canCast, combat, magicCap, needXp, trainFocus, type TrainFocus } from "../../content/fantasy/power";
import { LADDER, arenaRank, ladderOf, nextFoe } from "../../content/fantasy/arena";
import { useState } from "react";
import { AWAKEN_AGE, BLADE_ARTS, BODY_ARTS, MAGIC_ARTS, bladeArts, dual, seen, starsOff, starsOn, tierOf, type StarArt } from "../../content/fantasy/stars";
import { ELEMENTS, SPELLS, manaLeft, manaMax, spellsOf } from "../../content/fantasy/magic";
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
import { ASSETS, assetIncome } from "../../content/fantasy/careers";
import { CREDITOR_AT, DEBT_RATE, ESTATES, HOME_UPKEEP, PRISON_AT, nextYearGold, ownedEstates, upkeepOf } from "../../content/fantasy/economy";
import { GOLD } from "../../content/fantasy/kit";
import { mastered, retireAge, stepsFor } from "../../content/fantasy/careerpath";
import { CALLINGS, CALLING_AGE, TRADE_LESSONS, callingOf, callingProg, headStart, heirlooms, legacyHeir, upbringing } from "../../content/fantasy/family";
import { epithetOf, styleOf, techsOf } from "../../content/fantasy/styles";
import { KINDS, citiesOf, cityOf } from "../../content/fantasy/cities";
import { DUNGEONS, PETS } from "../../content/fantasy/hobbies";
import { sleeping } from "../../content/fantasy/talentEvo";
import { activeSagas, doneSagas } from "../../content/fantasy/sagas";
import { mArtsOf, mschoolOf } from "../../content/fantasy/mschools";
import { BEASTS, homeOf, omenOf } from "../../content/fantasy/world2";
import { RACE_LABEL, folkOf } from "../../content/fantasy/folk";
import { careerById } from "../../content/core/careers";
import { PARTY_MAX, partyLabel, partyOf } from "../../content/fantasy/bonds";
import { PowerSourceFolds, RumorFold, WorldMarkFolds } from "./FantasyFate";

const StarLine = ({ label, n, open }: { label: string; n: number; open: boolean }) => (
  <>
    <span>{label}</span>
    <b>{open ? <><span className="stars">{starsOn(n)}</span><span className="stars-off">{starsOff(n)}</span> <span className="muted small">{n} ดาว · {tierOf(n)}</span></> : <span className="muted">??? · รู้ตอนอายุ {AWAKEN_AGE} ขวบ</span>}</b>
  </>
);
const Arts = ({ arts, n }: { arts: StarArt[]; n: number }) => <>{arts.map((a) => <p className={`small ${n >= a.at ? "" : "muted"}`} key={a.name}>{n >= a.at ? <b>{a.name}</b> : a.name} · {a.at} ดาว · {a.desc}</p>)}</>;

const Bar = ({ label, value, need }: { label: string; value: number; need: number }) => (
  <div className="mini-bar">
    <span>{label}</span>
    <div className="bar">
      <div className="fill high" style={{ width: `${Math.min(100, (value / need) * 100)}%` }} />
    </div>
  </div>
);

/** แนวทางการฝึก และอันดับในสังเวียน */
/** เส้นทางแห่งพลัง: ทะลวงขั้นต่อไป สู้อะไรได้ ท่าที่รู้ ความมืด ยา ฝีมือช่าง */
function PowerPathFold({ life }: { life: Life }) {
  const f = fl(life);
  const dark = corruptionOf(life), pot = f.potions ?? {};
  const crafts = (Object.keys(CRAFT_NAME) as Craft[]).filter((k) => craftRank(life, k) > 0);
  return (
    <Fold always kind="section" id="ft-power-path" title={<>เส้นทางแห่งพลัง</>}>
      <p className="small"><b>{standingLine(life)}</b></p>
      <p className="small">สายกาย: {nextBreak(life, "body")}</p>
      {(canCast(life) || f.magicRank > 0) && <p className="small">สายเวท: {nextBreak(life, "magic")}</p>}
      {(f.trainYears ?? 0) > 0 && <p className="small muted">ฝึกต่อเนื่องมา {f.trainYears} ปี · ทุก {YEARS_PER_CAP} ปีเพดานขยับขึ้นหนึ่งขั้น</p>}
      {(learnedOf(life).length > 0 || f.myTech) && <p className="small">ท่าที่รู้: {[...(f.myTech ? [`「${f.myTech}」(ของคุณเอง)`] : []), ...learnedOf(life)].join(" · ")}</p>}
      {f.weapon && (f.weapon.kills ?? 0) > 0 && <p className="small muted">{f.weapon.name} ล้มศัตรูมาแล้ว {f.weapon.kills} ครั้ง{f.weapon.named ? "" : ` · ครบ ${KILLS_TO_NAME} ครั้งจะได้ชื่อ`}</p>}
      {dark > 0 && <p className="small" style={{ color: dark >= 50 ? "var(--bad)" : undefined }}>ความมืดในตัว {dark}{CORRUPT_WORDS(dark) ? ` · ${CORRUPT_WORDS(dark)}` : ""} · ชำระบาปได้ที่วิหาร</p>}
      {(pot.heal || pot.strength || pot.life) ? <p className="small">ยาที่พกอยู่: {(Object.keys(POTIONS) as (keyof typeof POTIONS)[]).filter((k) => pot[k]).map((k) => `${POTIONS[k].name} ${pot[k]}`).join(" · ")}</p> : null}
      {crafts.length > 0 && <p className="small">ฝีมือ: {crafts.map((k) => `${CRAFT_NAME[k]} ${CRAFT_RANKS[craftRank(life, k)]}`).join(" · ")}</p>}
      {secluded(life) && <p className="small">กำลังเก็บตัวฝึกบนเขาจนถึงอายุ {secludedUntil(life)}</p>}
    </Fold>
  );
}

function DangerFold({ life }: { life: Life }) {
  const lines = [...lawLines(life), ...dangerLines(life)];
  const met = BESTIARY.filter((b) => timesMet(life, b.name) > 0);
  if (!lines.length && !met.length) return null;
  return (
    <>
      {lines.length > 0 && (
        <Fold always kind="section" id="ft-danger" title={<>บาดแผล ภัย และกฎหมาย</>}>
          {lines.map((t) => <p className="small" key={t}>{t}</p>)}
        </Fold>
      )}
      {met.length > 0 && (
        <Fold kind="section" id="ft-bestiary" title={<>สมุดสัตว์อสูร · {met.length}/{BESTIARY.length}</>}>
          <p className="small muted">เจอแล้วจำจุดอ่อนได้ · เจอสามครั้งขึ้นไปรู้ทางของมัน</p>
          {met.map((b) => <p className="small" key={b.name}><b>{b.name}</b> · แพ้{b.weak} · อยู่ที่{b.home} · เจอ {timesMet(life, b.name)} ครั้ง{timesMet(life, b.name) >= 3 ? " · รู้ทาง" : ""}</p>)}
        </Fold>
      )}
    </>
  );
}

function TrainingFold({ life }: { life: Life }) {
  const [, force] = useState(0);
  const focus = trainFocus(life);
  const rank = arenaRank(life);
  const foe = nextFoe(life);
  const lad = ladderOf(life);
  return (
    <Fold always kind="section" id="ft-training" title={<>การฝึกและสังเวียน</>}>
      <div className="row">
        {(Object.keys(FOCUS) as TrainFocus[]).map((k) => (
          <button key={k} className={`chip ${focus === k ? "on" : ""}`} onClick={() => { life.flags.ftTrainFocus = k; force((n) => n + 1); }}>{FOCUS[k].name}</button>
        ))}
      </div>
      <p className="small muted">{FOCUS[focus].desc} · ใช้กับการฝึกดาบและฝึกเวททุกครั้ง</p>
      <p className="small">สังเวียนแห่ง{homeKingdom(life).name}: {rank ? (rank === 1 ? <b>คุณคือแชมป์</b> : <>อันดับ <b>{rank}</b> จาก {LADDER}</>) : "ยังไม่มีอันดับ"}{foe ? <> · คู่ต่อไป {foe.name} พลัง {foe.power} (คุณ {combat(life)})</> : null}</p>
      {lad.slice(0, 3).map((n, i) => <p className="small muted" key={n.id}>{i + 1}. {n.name} · อายุ {n.age} · พลัง {n.power}</p>)}
      <p className="small muted">ขึ้นสังเวียนได้ที่แท็บทำ · แพ้แค่บาดเจ็บ ไม่ตาย</p>
    </Fold>
  );
}

export function FantasyPowerTab({ life }: { life: Life }) {
  const f = fl(life);
  const s = schoolOf(life);
  const relic = myRelic(life);
  const known = life.talents.filter((t) => t.revealed);
  const d = dataOf(life);
  const faction = myFaction(life);
  return (
    <div className="tab-content">
      <Fold always id="ft-power" title={<>ตัวคุณ{epithetOf(life) ? <span className="muted small"> · {epithetOf(life)}</span> : null}</>}>
        <div className="status-grid">
          <span>เผ่า</span>
          <b>{raceLabel(life)}</b>
          <span>{riteOf(life).title}</span>
          <b>{riteState(life) === "passed" ? "ผ่านแล้ว" : riteState(life) === "failed" ? "ไม่ผ่าน" : riteState(life) === "skipped" ? "ไม่ได้เข้าร่วม" : `อายุ ${riteOf(life).age}`}</b>
          {prejudice(life) > 0 && <><span>คนในแผ่นดินนี้</span><b>{prejudice(life) >= 2 ? "ระแวงเผ่าของคุณมาก" : "ยังระแวงเผ่าของคุณ"}</b></>}
          <span>พลังต่อสู้</span>
          <b>{combat(life)}</b>
          <span>สายกาย</span>
          <b>{BODY_RANKS[f.bodyRank]}</b>
          <span>สายเวท</span>
          <b>{MAGIC_RANKS[f.magicRank]}</b>
          <StarLine label="ดาวกาย" n={f.bstars ?? 0} open={seen(life)} />
          <StarLine label="ดาวเวท" n={f.potential} open={seen(life)} />
          <span>สายอาวุธ</span>
          <b>{styleOf(life)?.name ?? (f.bodyRank >= 1 ? "ยังไม่เลือก" : "—")}</b>
          <span>กิลด์</span>
          <b>{f.guild ? `ขั้น${GUILD_RANKS[f.guild]}` : "ยังไม่สมัคร"}</b>
        </div>
        <Bar label="ฝึกกาย" value={f.body} need={needXp(f.bodyRank)} />
        <Bar label="ฝึกเวท" value={f.magic} need={needXp(f.magicRank)} />
        <p className="small muted">{RACES[f.race].desc}</p>
        {seen(life) && <p className="small muted">เพดานสายกาย: {BODY_RANKS[Math.max(bodyCap(life), f.bodyRank)]}{dual(life) ? " · ดาวสองสายสูง เดินทางดาบเวทได้" : ""}</p>}
        <p className="small muted">{canCast(life) ? `ร่ายเวทได้ เพดานตอนนี้: ${MAGIC_RANKS[magicCap(life)]}` : "ยังร่ายเวทไม่ได้ ซื้อคทาได้ที่แท็บทำ"}</p>
      </Fold>
      <PowerPathFold life={life} />
      <DangerFold life={life} />
      <TrainingFold life={life} />
      <PowerSourceFolds life={life} />
      {seen(life) && (
        <Fold kind="section" id="ft-star-arts" title={<>วิชาประจำดาว</>}>
          <p className="small muted">ได้เองเมื่อดาวถึง ไม่ต้องฝึก</p>
          <p className="small"><b>สายกาย</b></p>
          <Arts arts={BODY_ARTS} n={f.bstars ?? 0} />
          <p className="small"><b>สายเวท</b></p>
          <Arts arts={MAGIC_ARTS} n={f.potential} />
          {dual(life) && <p className="small"><b>ดาบเวท</b></p>}
          {dual(life) && BLADE_ARTS.map((a, i) => <p className={`small ${i < bladeArts(life).length ? "" : "muted"}`} key={a}>{i < bladeArts(life).length ? <b>{a}</b> : a} · สองสายถึงขั้น {i + 1}</p>)}
        </Fold>
      )}
      <Fold always kind="section" id="ft-gear" title={<>ของติดตัว</>}>
        <p className="small">{f.wand ? `${f.wand.name} · คุณภาพ ${f.wand.quality}` : "ไม่มีคทา"}{f.magicRank >= 3 ? " · ร่ายได้โดยไม่ต้องใช้คทา" : ""}</p>
        {f.weapon && <p className="small">{f.weapon.name} · คุณภาพ {f.weapon.quality}{f.weapon.enchant ? " · ลงอาคม" : ""}</p>}
        {f.armor && <p className="small">{f.armor.name} · คุณภาพ {f.armor.quality}</p>}
        <p className="small">บ้าน: {homeOf(life).name} · {homeOf(life).desc}</p>
        {(f.trophies ?? []).length > 0 && <p className="small">ถ้วยรางวัล: {f.trophies!.join(", ")}</p>}
        {f.pet && <p className="small">{PETS[f.pet.kind].name}ชื่อ{f.pet.name} · ผูกพัน {f.pet.bond} · {PETS[f.pet.kind].perk}{f.pet.bond < 30 ? " (ต้องดูแลมากกว่านี้จึงจะช่วย)" : ""}</p>}
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
      {styleOf(life) && (
        <Fold always kind="section" id="ft-style" title={<>{styleOf(life)!.name} · ท่าไม้ตาย</>}>
          {styleOf(life)!.techs.map((t, i) => <p className={`small ${i < techsOf(life).length ? "" : "muted"}`} key={t}>{i < techsOf(life).length ? <b>{t}</b> : `${t} · เปิดเมื่อเป็น${BODY_RANKS[i + 1]}`}</p>)}
          <p className="small muted">ใช้ท่าไม้ตายได้ปีละครั้งในการต่อสู้{life.flags.ftTechUsed === life.age ? " · ปีนี้ใช้ไปแล้ว" : ""}</p>
        </Fold>
      )}
      {mschoolOf(life) && (
        <Fold always kind="section" id="ft-mschool" title={<>{mschoolOf(life)!.name}</>}>
          <p className="small muted">{mschoolOf(life)!.desc}</p>
          {mschoolOf(life)!.arts.map((a, i) => <p className={`small ${i < mArtsOf(life).length ? "" : "muted"}`} key={a}>{i < mArtsOf(life).length ? <b>{a}</b> : `${a} · เปิดเมื่อเป็น${MAGIC_RANKS[i + 2]}`}</p>)}
        </Fold>
      )}
      {partyOf(life).length > 0 && (
        <Fold always kind="section" id="ft-party" title={<>ปาร์ตี้ · {partyOf(life).length}/{PARTY_MAX}</>}>
          {partyOf(life).map((p) => <p className="small" key={p.id}><b>{shortName(p)}</b> · {partyLabel(p)} · ผูกพัน {p.bond}</p>)}
          <p className="small muted">คนละ +4 พลังต่อสู้ · ชวนเพื่อนสนิทเข้าปาร์ตี้ได้ที่แท็บผู้คน</p>
        </Fold>
      )}
      {(activeSagas(life).length > 0 || doneSagas(life).length > 0) && (
        <Fold always kind="section" id="ft-sagas" title={<>มหากาพย์ตำนาน</>}>
          {activeSagas(life).map((s) => { const at = f.sagas?.[s.id] ?? 0; return <p className="small" key={s.id}><b>{s.name}</b> · บทที่ {at + 1}/{s.chapters.length} {s.chapters[at].title}</p>; })}
          {doneSagas(life).map((s) => <p className="small muted" key={s.id}>{s.name} · จบแล้ว</p>)}
          {activeSagas(life).length > 0 && <p className="small muted">ไปต่อได้ที่แท็บทำ · ตามรอยตำนาน</p>}
        </Fold>
      )}
      {Object.keys(f.dungeons ?? {}).length > 0 && (
        <Fold kind="section" id="ft-dungeons" title={<>ดันเจี้ยน</>}>
          {DUNGEONS.map((d) => { const n = f.dungeons?.[d.id] ?? 0; return <p className="small" key={d.id}>{d.name} · {n >= d.floors ? "พิชิตแล้ว" : `ผ่าน ${n}/${d.floors} ชั้น`}</p>; })}
        </Fold>
      )}
      <Fold always kind="section" id="ft-magic" title={<>เวทมนตร์ · ธาตุ{ELEMENTS[f.element ?? "fire"].name}</>}>
        <p className="small">มานาปีนี้ {manaLeft(life)}/{manaMax(life)} · บทสวด {f.chant ?? 0} · วงเวท {f.circle ?? 0} · อักษรรูน {f.rune ?? 0} · รู้เวท {spellsOf(life).length}/{SPELLS.length} บท</p>
        {spellsOf(life).length ? spellsOf(life).map((x) => <p className="small" key={x.id}>{x.name} · ธาตุ{ELEMENTS[x.element].name} ขั้น {x.tier}</p>) : <p className="small muted">ยังไม่รู้จักเวทบทไหน</p>}
      </Fold>
      {known.length > 0 && (
        <Fold kind="section" id="ft-talents" title={<>พรสวรรค์</>}>
          {known.map((t) => <p className="small" key={t.id}><b>{talentById(t.id)?.name}</b>{/_[ld]$/.test(t.id) ? <span className="muted"> · ร่างที่ตื่นแล้ว ({t.id.endsWith("_l") ? "ทางสว่าง" : "ทางมืด"})</span> : null} · {talentById(t.id)?.desc}</p>)}
          {sleeping(life).length > 0 && <p className="small muted">พรสวรรค์ {sleeping(life).map((t) => talentById(t.id)?.name).join(", ")} ยังตื่นสู่ร่างใหม่ได้ เมื่อทำสิ่งที่มันรอ หรือเมื่อชีวิตถึงจุดวิกฤต</p>}
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
      <Fold always id="ft-society" title={<>สังคม ชนชั้น และศรัทธา</>}>
        {societyLines(life).map((t) => <p className="small" key={t}>{t}</p>)}
      </Fold>
      <Fold always id="ft-here" title={<>ที่อยู่ของคุณ</>}>
        <p className="small"><b>{cityOf(life).name}</b> · {KINDS[cityOf(life).kind].name} · {KINDS[cityOf(life).kind].perk}</p>
        <p className="small muted">{cityOf(life).desc}</p>
        <p className="small">{here.name} · ปกครองโดย{here.ruler}</p>
        <p className="small muted">เทศกาลประจำเมือง: {cityOf(life).festival[0]} · ผู้คน: {folkOf(here.id).map(([r, n]) => `${RACE_LABEL[r]} ${n}%`).join(" · ")}</p>
        <p className="small muted">ปี {w.year}{here.war ? " · กำลังมีสงคราม" : ""}{here.plague ? " · มีโรคระบาด" : ""}{here.famine ? " · ทุพภิกขภัย" : ""}</p>
        {(here.laws ?? []).map((id) => <p className="small" key={id}><b>{LAWS[id].name}</b> · {LAWS[id].desc}</p>)}
        {(here.laws ?? []).length === 0 && <p className="small muted">ไม่มีกฎหมายพิเศษ</p>}
      </Fold>
      {omenOf(life) && <Fold always id="ft-omen" title={<>ลางแห่งยุค</>}><p className="small"><b>{omenOf(life)!.name}</b> · {omenOf(life)!.desc} · ถึงปี {omenOf(life)!.until}</p></Fold>}
      <WorldMarkFolds life={life} />
      <RumorFold life={life} />
      <Fold id="ft-beasts" title={<>สัตว์ในตำนาน</>}>
        {BEASTS.map((b) => { const by = (d as unknown as { beasts?: Record<string, string> }).beasts?.[b.id]; return <p className={`small ${by ? "muted" : ""}`} key={b.id}><b>{b.name}</b> · {by ? `ถูกล่าโดย${by}` : b.desc}</p>; })}
      </Fold>
      <Fold id="ft-cities" title={<>เมืองในแผ่นดินนี้</>}>
        {citiesOf(here).map((c) => <p className="small" key={c.id}><b>{c.name}</b>{c.id === cityOf(life).id ? " · คุณอยู่ที่นี่" : ""} · {KINDS[c.kind].name} · งานที่รุ่ง: {KINDS[c.kind].jobs.map((j) => careerById(j)?.name).filter(Boolean).join(", ")}</p>)}
        <p className="small muted">งานที่ตรงกับเมืองได้ค่าจ้างเพิ่ม 20% · ย้ายเมืองได้ที่แท็บทำ</p>
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

/** แท็บอาชีพของโลกแฟนตาซี: ของติดตัวที่ทำหรือซื้อ และทรัพย์สินที่ให้รายได้ทุกปี */
/** ครอบครัวและมรดก: ใครได้ของใหญ่ ลูกแต่ละคนได้เรียนอะไร งานของบั้นปลาย */
function LegacyFold({ life }: { life: Life }) {
  const [, force] = useState(0);
  const kids = life.people.filter((p) => p.alive && p.relation === "child");
  const grand = life.people.filter((p) => p.alive && p.relation === "grandchild");
  const style = parentingOf(life);
  const fam = life.fw ? familyRec(life) : undefined;
  const calling = callingOf(life);
  if (!kids.length && !calling && life.age < CALLING_AGE - 5) return null;
  const heir = legacyHeir(life), items = heirlooms(life);
  const c = calling ? CALLINGS[calling] : undefined;
  return (
    <Fold always id="ft-legacy" title={<>ครอบครัวและมรดก</>}>
      {kids.length > 0 && (
        <>
          <p className="small">ทายาทที่ได้ของใหญ่: <b>{heir ? shortName(heir) : "-"}</b>{life.flags.ftWill ? " · ตามพินัยกรรม" : " · ยังไม่มีพินัยกรรม จะตกกับลูกที่โตแล้วและใกล้ชิดที่สุด"}</p>
          <p className="small muted">{items.length ? `ส่งต่อ: ${items.join(" · ")}` : "ยังไม่มีของใหญ่ให้ส่งต่อ นอกจากเงินและชื่อตระกูล"}</p>
          {kids.map((k) => {
            const u = upbringing(k), hs = headStart(u);
            const parts = [u.body && `ดาบ ${u.body}`, u.magic && `เวท ${u.magic}`, u.mind && `หนังสือ ${u.mind}`, u.trade && `งาน ${u.trade}/${TRADE_LESSONS}`, u.school && "เข้าโรงเรียน"].filter(Boolean);
            return <p className="small" key={k.id}><b>{shortName(k)}</b> อายุ {k.age} · ผูกพัน {k.bond} · {parts.length ? `เรียนกับคุณ: ${parts.join(" · ")}` : "ยังไม่เคยสอน"}{hs.body + hs.magic > 0 ? ` · ถ้ารับช่วงต่อเริ่มด้วยแต้มฝึก +${hs.body + hs.magic}` : ""}</p>;
          })}
          {kids.some((k) => k.age < 18) && (
            <>
              <p className="small">วิธีเลี้ยงลูก</p>
              <div className="row">{(Object.keys(PARENTING) as Parenting[]).map((k) => <button key={k} className={`chip ${style === k ? "on" : ""}`} onClick={() => { life.flags.ftParenting = k; force((n) => n + 1); }}>{PARENTING[k].name}</button>)}</div>
              {style && <p className="small muted">{PARENTING[style].desc}</p>}
            </>
          )}
          {grand.length > 0 && <p className="small">หลาน {grand.length} คน: {grand.map((g) => `${shortName(g)} ${g.age} ปี`).join(" · ")}</p>}
          <p className="small muted">สอนลูกได้ที่แท็บผู้คน · ลูกที่ผูกพันเกิน 70 เริ่มชีวิตมีความสุขกว่า · เขียนพินัยกรรมได้ที่แท็บทำ ตั้งแต่อายุ 40</p>
        </>
      )}
      {fam && (fam.crest || fam.fame !== 0) && <p className="small">ตระกูล{life.lastName}{fam.crest ? ` · ตรา${fam.crest} · "${fam.motto}"` : ""} · ชื่อเสียงของตระกูล {fam.fame}</p>}
      {c ? (
        <p className="small">งานของบั้นปลาย: <b>{c.name}</b>{c.need ? ` · ${c.goal} (${Math.min(callingProg(life), c.need)}/${c.need})` : ` · ${c.desc}`}</p>
      ) : (
        <p className="small muted">อายุ {CALLING_AGE} จะได้เลือกงานของบั้นปลาย: สอนคนรุ่นใหม่ เขียนบันทึกชีวิต เดินทาง เฝ้าเมือง เป็นผู้เฒ่า สร้างงานชิ้นสุดท้าย ไถ่บาป หรือผจญภัยครั้งสุดท้าย</p>
      )}
    </Fold>
  );
}

export function FantasyCareerCard({ life }: { life: Life }) {
  const f = fl(life);
  const owned = Object.entries(ASSETS).filter(([k]) => Number(life.flags[k] ?? 0) > 0);
  const g = f.ledger;
  const next = nextYearGold(life);
  const debt = Math.ceil(life.debt / GOLD);
  const big = ownedEstates(life);
  const hu = HOME_UPKEEP[Number(life.flags.ftHome ?? 0)];
  const job = life.job, career = job ? careerById(job.careerId) : undefined;
  return (
    <>
    {job && career && (
      <Fold always id="ft-path" title={<>เส้นทางอาชีพ · {fitGender(career.titles[job.level - 1], life.gender)}</>}>
        <p className="small">{career.titles.map((t0, i) => { const t = fitGender(t0, life.gender); return i < job.level ? <b key={t}>{t}</b> : <span key={t} className="muted">{t}</span>; }).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, " → ", x] : [x]), [])}</p>
        {job.level < 5 ? (
          <>
            <p className="small muted">ขึ้นเป็น{fitGender(career.titles[job.level], life.gender)}ต้องมี:</p>
            {stepsFor(life, career, job.level + 1).map((s) => <p className="small" key={s.label}>{s.ok ? "✓" : "✗"} {s.label}</p>)}
            {job.level === 4 && <p className="small muted">ผ่านเงื่อนไขครบแล้ว สมาคมจะเรียกไปสอบเอง สอบตกรอสองปี</p>}
          </>
        ) : (
          <p className="small">{mastered(life, career.id) ? "คุณเป็นนายใหญ่ที่สอบผ่านของสมาคม" : "คุณอยู่ขั้นสูงสุดของอาชีพนี้"}{life.flags.ftLegacyDone ? " · ทิ้งตำนานไว้ให้อาชีพนี้แล้ว" : " · เป็นนายใหญ่สักพัก จะได้เลือกสิ่งที่ทิ้งไว้ให้อาชีพนี้"}</p>
        )}
        <p className="small muted">เกษียณตอนอายุ {retireAge(life)} · บำนาญ {job.level >= 5 ? (mastered(life, career.id) ? "50" : "40") : job.level >= 3 ? "25" : "10"}% ของค่าจ้าง</p>
      </Fold>
    )}
    {life.age >= 18 && (
      <Fold always id="ft-money2" title={<>การเงิน</>}>
        {moneyLines(life).map((t) => <p className="small" key={t}>{t}</p>)}
        <p className="small muted">ลงทุน ปล่อยกู้ ซื้อที่ดิน ทำบุญ และเลือกวิธีใช้ชีวิตได้ที่แท็บทำ หมวดเงิน</p>
      </Fold>
    )}
    {careerLines(life).length > 0 && (
      <Fold always id="ft-worklife2" title={<>ชีวิตการงาน</>}>
        {careerLines(life).map((t) => <p className="small" key={t}>{t}</p>)}
      </Fold>
    )}
    {g && (
      <Fold always id="ft-ledger" title={<>บัญชีปีนี้ · อายุ {g.age}</>}>
        <div className="status-grid">
          <span>ค่าจ้าง</span><b>+{g.pay}</b>
          {g.assets > 0 && <><span>ทรัพย์สินให้รายได้</span><b>+{g.assets}</b></>}
          <span>ค่าครองชีพ</span><b>−{g.living}</b>
          {g.upkeep > 0 && <><span>ค่าดูแลของใหญ่และบ้าน</span><b>−{g.upkeep}</b></>}
          {g.interest > 0 && <><span>ดอกเบี้ยหนี้</span><b>−{g.interest}</b></>}
          {g.net !== undefined && <><span>ทรัพย์สุทธิเปลี่ยนไปจากปีก่อน</span><b>{g.net >= 0 ? "+" : ""}{g.net}</b></>}
        </div>
        {debt > 0 && <p className="small">หนี้ {debt} เหรียญทอง · ดอกเบี้ยปีละ {Math.round(DEBT_RATE * 100)}%{debt >= CREDITOR_AT ? " · เจ้าหนี้อาจมาทวงปีหน้า" : ""}{debt >= PRISON_AT ? " · ถ้าไล่เจ้าหนี้อาจติดคุกลูกหนี้" : ""}</p>}
        {next !== undefined && next < 0 && <p className="small" style={{ color: "var(--bad)" }}>ถ้าปีหน้าไม่มีรายได้เพิ่ม เงินจะติดลบราว {-next} เหรียญทองและกลายเป็นหนี้</p>}
        <p className="small muted">หน่วยเป็นเหรียญทอง · เงินจากเรื่องราวและกิจกรรมรวมอยู่ในทรัพย์สุทธิ</p>
      </Fold>
    )}
    {(big.length > 0 || hu > 0) && (
      <Fold always id="ft-estates" title={<>ของใหญ่ที่เป็นของคุณ</>}>
        {big.map((id) => <p className="small" key={id}><b>{ESTATES[id].name}</b> · {ESTATES[id].perk} · ดูแลปีละ {ESTATES[id].upkeep}{f.estates?.[id] ? " · ค้างค่าดูแล ปีหน้าต้องขาย" : ""}</p>)}
        {hu > 0 && <p className="small"><b>{homeOf(life).name}</b> · ดูแลปีละ {hu}{Number(life.flags.ftHomeUnpaid ?? 0) > 0 ? " · ค้างค่าดูแล ปีหน้าต้องขาย" : ""}</p>}
        <p className="small muted">รวมค่าดูแลปีละ {upkeepOf(life)} เหรียญทอง · ซื้อเพิ่มได้ที่แท็บทำ · ซื้อของใหญ่</p>
      </Fold>
    )}
    <LegacyFold life={life} />
    {(f.weapon || f.armor || owned.length > 0) && (
    <Fold always id="ft-assets" title={<>ทรัพย์สินและของติดตัว</>}>
      {f.weapon && <p className="small"><b>{f.weapon.name}</b> · คุณภาพ {f.weapon.quality}{f.weapon.enchant ? " · ลงอาคมแล้ว" : ""}</p>}
      {f.armor && <p className="small"><b>{f.armor.name}</b> · คุณภาพ {f.armor.quality}</p>}
      {owned.map(([k, a]) => <p className="small" key={k}>{a.name} {Math.min(Number(life.flags[k]), a.max)}/{a.max} · ปีละ {Math.min(Number(life.flags[k]), a.max) * a.gold} เหรียญทอง</p>)}
      {owned.length > 0 && <p className="small muted">รายได้จากทรัพย์สินรวมปีละ {assetIncome(life)} เหรียญทอง</p>}
    </Fold>
    )}
    </>
  );
}

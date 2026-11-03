// แท็บเฉพาะโลกแฟนตาซี: พลังของตัวละคร และสภาพโลก
import { RACES } from "../../content/fantasy/life";
import { BODY_RANKS, GUILD_RANKS, MAGIC_RANKS, canCast, combat, magicCap, needXp } from "../../content/fantasy/power";
import { schoolOf } from "../../content/fantasy/places";
import { dataOf, fl, homeKingdom, myRelic, worldOfLife } from "../../content/fantasy/state";
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
        <p className="small">{f.wand ? f.wand.name : "ไม่มีคทา"}</p>
        {relic && <p className="small"><b>{relic.name}</b> · {relic.power}</p>}
        {s && <p className="small">{f.graduated ? "ศิษย์เก่า" : "นักเรียน"}{s.name}</p>}
        {life.flags.dragonRider && <p className="small">สหายของมังกร{dataOf(life).dragon.name}</p>}
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
  const here = homeKingdom(life);
  return (
    <div className="tab-content">
      <Fold always id="ft-here" title={<>ที่อยู่ของคุณ</>}>
        <p className="small">{here.name} · ปกครองโดย{here.ruler}</p>
        <p className="small muted">ปี {w.year}{here.war ? " · กำลังมีสงคราม" : ""}{here.plague ? " · มีโรคระบาด" : ""}</p>
      </Fold>
      <Fold always id="ft-kingdoms" title={<>อาณาจักร</>}>
        {d.kingdoms.map((k) => (
          <p className="small" key={k.id}>{k.name} · {k.ruler} · กำลัง {k.power}{k.war ? " · สงคราม" : ""}</p>
        ))}
      </Fold>
      <Fold always id="ft-dragon" title={<>มังกร</>}>
        <p className="small">{d.dragon.alive ? `${d.dragon.name} ${d.dragon.title} อายุ ${d.dragon.age} ปี` : `${d.dragon.name} ถูกสังหารโดย${d.dragon.slainBy}`}</p>
      </Fold>
      <Fold id="ft-relics" title={<>อาวุธตำนาน</>}>
        {d.relics.map((r) => (
          <p className="small" key={r.id}><b>{r.name}</b> · {r.power} · {r.holder === "player" ? "อยู่กับคุณ" : r.holder === "lost" ? "สูญหาย" : `ข่าวว่าอยู่กับ${r.holder}`}</p>
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

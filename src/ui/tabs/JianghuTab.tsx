// แท็บยุทธภพ (MURIM_PLAN §10): สถานการณ์ใต้หล้า · ทำเนียบและสำนักของคุณ · สงครามสามแคว้น · ที่อยู่ · สถานะทางกฎหมาย
import { ERA } from "../../content/murim/life/world";
import { regionOf } from "../../content/murim/life/region";
import { heatOf, jailed, mourning } from "../../content/murim/life/law";
import type { Life } from "../../engine/types";
import type { Act } from "../App";
import { MurimCard } from "./MurimCard";
import { legendsOf, myYoungPlace, youngList } from "../../content/murim/world/jianghu";
import { REGIONS } from "../../content/murim/life/region";
import { REL_LABEL, TRUTH_LABEL, fameNewsOf, rumorsOf } from "../../content/murim/life/rumors";
import { runEvent } from "../../engine/game";
import { WorldCard } from "./PowerTab";
import { TEMPER, courtOf, palaceAccess } from "../../content/murim/world/court";
import { COURT_RANKS, HEAT_LABEL, courtRank, schemeHeat } from "../../content/murim/world/palaceSchemes";
import { activeWar, mySide, sideNames, warsOf } from "../../content/murim/world/sectWar";
import { FAVOR_LABEL, viewCourt } from "../../content/murim/world/kingdomCourt";
import { crownHeir, royalKids } from "../../content/murim/world/emperor";
import { TRAIT_NAME, consortLabel, consortP, favourite, haremOf } from "../../content/murim/world/harem";
import { rulerHere } from "../../content/murim/world/regionKings";
import { edictLabel } from "../../content/murim/world/edicts";
import { lordFavor } from "../../content/murim/world/war";
import { PRESSURE_LABEL, ROLE_NAME, castOf, palaceOf, palaceRoleOf, patronOf, princeById, princesOf, support } from "../../content/murim/world/palace";
import { Fold } from "../Fold";

export function JianghuTab({ life, act }: { life: Life; act: Act }) {
  const r = regionOf(life);
  const w = life.mw;
  const heat = heatOf(life);
  return (
    <div className="tab-content">
      <Fold id="jianghu-0" title={<>ที่อยู่และยุคสมัย</>}>
        <p className="small">
          {r.name} — {r.desc}
        </p>
        {w && (
          <p className="small">
            {ERA[w.era].name} — {ERA[w.era].desc}
          </p>
        )}
        {w && <p className="small">ผู้ปกครองถิ่นนี้: {rulerHere(life)}</p>}
        {life.flags.exiled && <p className="small danger-text">ถูกเนรเทศ ห้ามกลับบ้านเกิด</p>}
        <p className="muted small">ย้ายถิ่นได้ที่แท็บ ทำ → ยุทธภพ</p>
      </Fold>
      <KingdomsCard life={life} />
      <RumorCard life={life} act={act} />
      <WorldCard life={life} />
      {w && w.era !== "war" && <WarCard life={life} />}
      {w && w.era !== "war" && <CourtCard life={life} />}
      <MurimCard life={life} act={act} />
      <Fold id="jianghu-1" className="m17-card" title={<>ทำเนียบมังกร (ยอดฝีมือหนุ่มสาว อายุไม่เกิน 30)</>}>
        <p className="small muted">{myYoungPlace(life) ? `คุณอยู่อันดับ ${myYoungPlace(life)} — ขึ้นสูงกว่านี้ได้ด้วยการท้าประลอง (แท็บทำ → ยุทธภพ) หรืองานประลองทุกสามปี` : life.age > 30 ? "คุณพ้นวัยทำเนียบมังกรแล้ว" : "ยังไม่ติดทำเนียบ — ฝีมือแซงท้ายตารางแล้วชื่อจะขึ้นเอง หรือท้าประลองคนท้ายตาราง"}</p>
        <ol className="m17-rank">
          {youngList(life).map((y, i) => (
            <li key={i}>
              <span className="m17-place">{i + 1}</span>
              <span className="m17-name">{y.me ? <b>คุณ 【{y.e}】</b> : <>【{y.e}】{y.n}</>} {y.g && <span className="muted small">{y.g === "f" ? "♀" : "♂"}</span>}</span>
              <span className="m17-age small muted">{y.a} ปี</span>
            </li>
          ))}
        </ol>
      </Fold>
      {legendsOf(life).length > 0 && (
        <Fold id="jianghu-2" className="m17-card" title={<>ตำนานคนรุ่นก่อน</>}>
          {legendsOf(life).slice().reverse().map((g, i) => (
            <p className="small" key={i}>
              ปี {g.year} · {g.e ? `【${g.e}】` : ""}{g.n} — {g.deed}
            </p>
          ))}
        </Fold>
      )}
      {(heat > 0 || jailed(life) || mourning(life)) && (
        <Fold id="jianghu-3" title={<>สถานะ</>}>
          {heat > 0 && (
            <p className={`small ${life.flags.wanted ? "danger-text" : ""}`}>
              {life.flags.wanted ? "ถูกประกาศจับ — นักล่าค่าหัวกำลังตามหา" : "ทางการเริ่มจับตามอง"} (ความร้อนแรง {Math.round(heat)}/100)
            </p>
          )}
          {jailed(life) && <p className="small danger-text">ติดคุก พ้นโทษอายุ {Number(life.flags.jailUntil)} ปี</p>}
          {mourning(life) && <p className="small">ไว้ทุกข์ถึงอายุ {Number(life.flags.mourningUntil)} ปี — ห้ามแต่งงานและงานรื่นเริง</p>}
        </Fold>
      )}
    </div>
  );
}

/** ข่าวลือที่ได้ยิน (แหล่ง · ความน่าเชื่อถือที่รับรู้ · ตรวจสอบแล้วหรือยัง) และข่าวเรื่องคุณที่กำลังแพร่ */
function RumorCard({ life, act }: { life: Life; act: Act }) {
  const rs = rumorsOf(life).filter((r) => !r.done).slice().reverse();
  const fs = fameNewsOf(life).filter((f) => !f.covered).slice().reverse();
  if (!rs.length && !fs.length) return null;
  const busy = life.queue.length > 0;
  return (
    <Fold id="jianghu-4" title={<>ข่าวลือ</>}>
      {rs.length === 0 && <p className="muted small">ยังไม่ได้ยินข่าวอะไร — ลองไปฟังข่าวในโรงน้ำชา</p>}
      {rs.map((r) => (
        <div className="job" key={r.id}>
          <div className="job-main">
            <div className="job-name">{r.text}</div>
            <div className="job-sub">
              จาก{r.src} · ปี {r.heard} · {r.verified ? <b>ตรวจแล้ว: {TRUTH_LABEL[r.truth]}</b> : REL_LABEL[r.rel]}
            </div>
          </div>
          <div className="row">
            {!r.verified && (
              <button className="btn small" disabled={busy} onClick={() => act((l) => { runEvent(l, "rm.verify", { rid: r.id }); return { text: "" }; })}>
                ตรวจสอบ
              </button>
            )}
            <button className="btn small" disabled={busy} onClick={() => act((l) => { runEvent(l, "rm.act", { rid: r.id }); return { text: "" }; })}>
              ลงมือ
            </button>
          </div>
        </div>
      ))}
      {fs.length > 0 && (
        <Fold kind="section" id="jianghu-fame" title={<>ข่าวเรื่องคุณที่กำลังแพร่ <span className="fold-count">{fs.length}</span></>}>
          {fs.map((f) => (
            <p className={`small ${f.good ? "" : "danger-text"}`} key={f.id}>
              {f.text} · ปี {f.year} · แพร่ไป {Math.min(REGIONS.length, f.reach + 1)}/{REGIONS.length} ภูมิภาค{f.distorted ? " (ถูกเติมแต่ง)" : ""}
            </p>
          ))}
        </Fold>
      )}
    </Fold>
  );
}

/** ราชสำนักและวังหลัง: คนนอกเห็นแค่ข่าวทั่วไป · คนที่เข้าวังได้เห็นแรงหนุนและคนในวังที่รู้จัก (EXPANSION §8.5) */
function CourtCard({ life }: { life: Life }) {
  if (life.flags.emperorSelf) return <ThroneCard life={life} />;
  const c = courtOf(life);
  const p = palaceOf(life);
  const inside = palaceAccess(life);
  const role = palaceRoleOf(life);
  const princes = princesOf(life).slice().sort((a, b) => Number(b.named) - Number(a.named) || b.age - a.age);
  const max = Math.max(1, ...princes.map((x) => support(life, x)));
  const known = castOf(life).filter((n) => n.known);
  const patron = patronOf(life);
  const backed = life.flags.palaceBack ? princeById(life, life.flags.palaceBack) : undefined;
  const health = c.emperor.health >= 70 ? "แข็งแรง" : c.emperor.health >= 40 ? "ประชวรบ่อย" : "ประชวรหนัก";
  return (
    <Fold id="jianghu-5" title={<>ราชสำนัก · {c.dynasty}</>}>
      <p className="small">
        {c.emperor.name} · {TEMPER[c.emperor.temper]} · {c.emperor.age} พรรษา · {inside && role === "physician" ? `ชีพจร ${c.emperor.health}/100` : inside ? health : `ข่าวว่า${health}`}
        {c.regent ? ` · ผู้สำเร็จราชการ: ${c.regent}` : ""}
      </p>
      <p className="small">
        การสืบทอด: <b>{PRESSURE_LABEL(p.pressure)}</b>
        {inside && ` · ท้องพระคลัง ${p.treasury >= 60 ? "มั่งคั่ง" : p.treasury >= 30 ? "พอใช้" : "ร่อยหรอ"}`}
      </p>
      <EdictLine life={life} />
      {princes.length === 0 && <p className="muted small">ยังไม่มีองค์ชาย</p>}
      {princes.map((x) => (
        <div className="faction-row" key={x.id}>
          <span className="faction-name">
            {x.named ? "★ " : ""}
            {x.name} <span className="muted small">· {x.age} พรรษา{backed?.id === x.id ? " · คุณหนุน" : ""}</span>
          </span>
          {inside ? (
            <div className="bar small-bar" aria-label={`แรงหนุน ${support(life, x)}`}>
              <div className={`fill ${backed?.id === x.id ? "high" : "mid"}`} style={{ width: `${Math.round((support(life, x) / max) * 100)}%` }} />
            </div>
          ) : (
            <span className="muted small">ไม่รู้ว่าใครหนุน</span>
          )}
        </div>
      ))}
      {inside ? (
        <>
          <p className="small">
            บทบาทของคุณ: {role ? ROLE_NAME[role] : "-"} · ตำแหน่ง: <b>{COURT_RANKS[courtRank(life)]}</b>
            {patron && ` · ผู้อุปถัมภ์: ${patron.name}`}
          </p>
          {schemeHeat(life) > 0 && <p className={`small ${schemeHeat(life) >= 30 ? "danger-text" : "muted"}`}>ร่องรอยของแผนที่ผ่านมา: {HEAT_LABEL(schemeHeat(life))}</p>}
          {known.length > 0 && (
            <Fold kind="section" id="jianghu-known" title={<>คนในวังที่คุณรู้จัก <span className="fold-count">{known.length}</span></>}>
              {known.map((n) => (
                <p className="small" key={n.id}>
                  <b>{n.name}</b> <span className="muted">({n.title})</span> —{" "}
                  {n.backs === "emperor" ? "ภักดีต่อฮ่องเต้" : n.backs === "self" ? "หนุนตัวเอง" : `หนุน${princeById(life, n.backs)?.name ?? "?"}`}
                  {n.you.trust >= 20 && " · ไว้ใจคุณ"}
                  {n.you.debt >= 20 && " · ติดหนี้คุณ"}
                  {n.you.grudge >= 20 && <span className="danger-text"> · แค้นคุณ</span>}
                </p>
              ))}
            </Fold>
          )}
          <p className="muted small">กิจกรรมในวังอยู่ที่แท็บ ทำ → ราชสำนัก</p>
        </>
      ) : (
        <p className="muted small">
          {life.flags.palaceWithdrawn ? "คุณถอนตัวจากการเมืองในวังแล้ว — ได้ยินแค่ข่าวลือ" : "คนนอกวังรู้แค่ข่าวลือ — เข้าวังได้ผ่านอาชีพขุนนาง องครักษ์หลวง หมอหลวง หรือเมื่อถูกเรียกตัว"}
        </p>
      )}
      {c.reigns.length > 0 && (
        <p className="muted small">
          รัชกาลก่อน: {c.reigns.slice(-3).map((r) => `${r.name} (${r.from}–${r.to}, ${r.how.split(" — ")[0]})`).join(" · ")}
        </p>
      )}
    </Fold>
  );
}

/** ราชโองการที่มีผลอยู่ตอนนี้ (ประกาศต่อสาธารณะ ทุกคนรู้) */
function EdictLine({ life }: { life: Life }) {
  const list = edictLabel(life);
  if (!list.length) return null;
  return <p className="small">ราชโองการที่มีผล: {list.map((e) => `${e.name}${e.until ? ` (ถึงปี ${e.until})` : ""}`).join(" · ")}</p>;
}

/** ราชสำนักเมื่อคุณคือฮ่องเต้: พระนาม ปีที่ครองราชย์ รัชทายาท ลูกๆ ความชอบธรรม คนในวังที่ภักดีหรือคิดคด */
function ThroneCard({ life }: { life: Life }) {
  const c = courtOf(life);
  const w = life.mw;
  const p = palaceOf(life);
  const heir = crownHeir(life);
  const kids = royalKids(life);
  const yr = life.birthYear + life.age;
  const bar = (v: number, good: boolean) => (
    <div className="bar small-bar" aria-label={String(v)}>
      <div className={`fill ${good ? (v >= 50 ? "high" : "mid") : v >= 60 ? "low" : "mid"}`} style={{ width: `${v}%` }} />
    </div>
  );
  const cast = castOf(life).filter((n) => n.role === "minister" || n.role === "eunuch" || n.role === "general").slice(0, 6);
  const family = life.people.filter((x) => x.alive && ["mother", "father", "sibling"].includes(x.relation));
  const harem = haremOf(life).slice().sort((a, b) => Number(a.cold) - Number(b.cold) || b.rank - a.rank);
  const fav = favourite(life);
  return (
    <Fold id="jianghu-6" title={<>ราชสำนักของคุณ · {c.dynasty}</>}>
      <p className="small">
        คุณคือ <b>{c.emperor.name}</b> · ครองราชย์ปีที่ {Math.max(1, yr - c.emperor.since + 1)} · ท้องพระคลัง{p.treasury >= 60 ? "มั่งคั่ง" : p.treasury >= 30 ? "พอใช้" : "ร่อยหรอ"}
      </p>
      {w && (
        <>
          <div className="faction-row">
            <span className="faction-name small">ความชอบธรรมของราชวงศ์</span>
            {bar(w.legitimacy, true)}
          </div>
          <div className="faction-row">
            <span className="faction-name small">ความไม่สงบในแผ่นดิน</span>
            {bar(w.unrest, false)}
          </div>
        </>
      )}
      <EdictLine life={life} />
      <p className="small">
        รัชทายาท: {heir ? <b>{heir.gender === "f" ? "องค์หญิง" : "องค์ชาย"}{heir.name} ({heir.age} ปี)</b> : <span className="danger-text">ยังไม่แต่งตั้ง</span>}
      </p>
      {kids.length > 0 && (
        <p className="small muted">
          ลูกของคุณ: {kids.map((k) => `${k.gender === "f" ? "องค์หญิง" : "องค์ชาย"}${k.name} (${k.age})`).join(" · ")}
        </p>
      )}
      {family.length > 0 && (
        <p className="small muted">
          ราชวงศ์: {family.map((f) => `${f.tags?.find((t) => t.startsWith("title:"))?.slice(6).split(" · ")[0] ?? ""}${f.name}`).join(" · ")}
        </p>
      )}
      {harem.length > 0 && (
        <Fold kind="section" id="jianghu-harem" title={<>วังหลัง <span className="fold-count">{harem.length}</span></>}>
          {harem.map((h) => {
            const p = consortP(life, h);
            const kidsN = life.people.filter((k) => k.alive && k.relation === "child" && k.tags?.includes(`parent:${h.pid}`)).length;
            return (
              <p className={`small${h.cold ? " muted" : ""}`} key={h.pid}>
                {fav?.pid === h.pid ? "★ " : ""}
                <b>{consortLabel(life, h)}</b> {p.gender === "m" ? "♂" : "♀"} <span className="muted">· {p.age} ปี · {TRAIT_NAME[h.trait]} · {h.clan}{kidsN ? ` · ลูก ${kidsN}` : ""}</span>
                {h.resent >= 50 && <span className="danger-text"> · ริษยาหนัก</span>}
              </p>
            );
          })}
        </Fold>
      )}
      {cast.length > 0 && (
        <Fold kind="section" id="jianghu-cast" title={<>คนในราชสำนัก <span className="fold-count">{cast.length}</span></>}>
          {cast.map((n) => (
            <p className="small" key={n.id}>
              <b>{n.name}</b> <span className="muted">({n.title})</span>
              {n.backs === "self" || n.amb >= 75 ? <span className="danger-text"> · ทะเยอทะยาน</span> : n.you.trust >= 20 ? " · ภักดีต่อคุณ" : ""}
              {n.you.grudge >= 20 && <span className="danger-text"> · แค้นคุณ</span>}
            </p>
          ))}
        </Fold>
      )}
      {c.reigns.length > 0 && <p className="muted small">รัชกาลก่อน: {c.reigns.slice(-3).map((r) => `${r.name} (${r.from}–${r.to}, ${r.how.split(" — ")[0]})`).join(" · ")}</p>}
    </Fold>
  );
}

/** สงครามสามแคว้น: ราชสำนักของแต่ละแคว้น (เจ้าแคว้น รัชทายาท ขุนพล เมืองหลวง ข่าวศึก) และตำแหน่งของคุณ */
function KingdomsCard({ life }: { life: Life }) {
  const ks = (life.mw?.kingdoms ?? []).map(viewCourt);
  if (!ks.length) return null;
  const role = life.flags.isLord ? "เจ้าแคว้น" : life.flags.warRole === "strategist" ? (life.flags.warChief ? "เสนาธิการใหญ่" : "เสนาธิการ") : life.flags.warRole === "general" ? (life.flags.warChief ? "แม่ทัพใหญ่" : "แม่ทัพ") : life.flags.warRole === "officer" ? "นายทหาร" : "พลทหาร";
  return (
    <Fold id="jianghu-7" title={<>สงครามสามแคว้น</>}>
      {ks.map((k) => {
        const mine = life.flags.lord === k.id;
        const last = k.news?.[k.news.length - 1];
        const fellTo = k.fellTo ? ks.find((x) => x.id === k.fellTo) : undefined;
        return (
          <div className="kingdom" key={k.id}>
            <div className={`faction-row${k.fallen ? " solo" : ""}`}>
              <span className="faction-name">
                {k.name} <span className="muted small">· เมืองหลวง{k.capital}{mine ? " · แคว้นของคุณ" : ""}</span>
              </span>
              {!k.fallen && (
                <div className="bar small-bar" aria-label={`กำลัง ${k.power}`}>
                  <div className={`fill ${mine ? "high" : "mid"}`} style={{ width: `${k.power}%` }} />
                </div>
              )}
            </div>
            {k.fallen ? (
              <p className="small danger-text">ล่มสลายปี {k.fallen}{fellTo ? ` — ถูก${fellTo.name}ผนวก` : ""}</p>
            ) : (
              <>
                <p className="small">
                  ฮ่องเต้แห่ง{k.name.replace("แคว้น", "")}: {life.flags.isLord === k.id ? "คุณ" : k.lord}{k.lordAge ? ` (${k.lordAge} ปี)` : ""} · <span className="muted">{k.trait}</span>
                </p>
                <p className="small muted">
                  {k.heir ? `รัชทายาท ${k.heir}${k.heirAge ? ` (${k.heirAge})` : ""} · ` : ""}เสนาธิการ {k.strategist} · แม่ทัพใหญ่ {k.general}
                </p>
              </>
            )}
            {last && <p className="small muted">ปี {last.y}: {last.t}</p>}
          </div>
        );
      })}
      {life.flags.lord ? (
        <p className="small">
          ตำแหน่งของคุณ: <b>{role}</b> · ผลงาน {Number(life.flags.warRank ?? 0)}
          {!life.flags.isLord && <> · เจ้าแคว้น<span className={lordFavor(life) < 25 ? "danger-text" : ""}>{FAVOR_LABEL(lordFavor(life))}</span></>}
        </p>
      ) : (
        <p className="muted small">คุณยังไม่ได้รับใช้แคว้นใด</p>
      )}
    </Fold>
  );
}

/** สงครามสำนัก: แนวรบ ฝั่งของคุณ ศพสะสม และสงครามที่ผ่านมา */
function WarCard({ life }: { life: Life }) {
  const war = activeWar(life);
  const past = warsOf(life).filter((x) => x.ended).slice(-3).reverse();
  if (!war && !past.length) return null;
  const side = mySide(life);
  const yr = life.birthYear + life.age;
  return (
    <Fold id="jianghu-8" title={<>สงครามสำนัก</>}>
      {war ? (
        <>
          <p className="small">
            <b>{sideNames(life, war, "a")}</b> ปะทะ <b>{sideNames(life, war, "b")}</b> · ปีที่ {yr - war.since + 1} · ศพ {war.deaths}
          </p>
          <p className="muted small">ต้นเหตุ: {war.cause}</p>
          <div className="faction-row">
            <span className="faction-name small">แนวรบ</span>
            <div className="bar small-bar" aria-label={`แนวรบ ${war.front}`}>
              <div className={`fill ${side === "a" ? "high" : side === "b" ? "low" : "mid"}`} style={{ width: `${Math.round((war.front + 100) / 2)}%` }} />
            </div>
          </div>
          <p className="small">
            {side ? `คุณอยู่ฝ่าย${sideNames(life, war, side)}` : life.flags.warSide === "none" ? "คุณวางตัวเป็นกลาง" : "คุณยังไม่ได้เลือกข้าง"}
            {life.flags.deserter ? " · ถูกตราหน้าว่าหนีทัพ" : ""}
          </p>
        </>
      ) : (
        <p className="muted small">ตอนนี้ยุทธภพสงบ</p>
      )}
      {past.map((x) => (
        <p className="muted small" key={x.id}>
          {x.since}–{x.ended}: {sideNames(life, x, "a")} ปะทะ {sideNames(life, x, "b")} — {x.result === "truce" ? "สงบศึก" : `${sideNames(life, x, x.result!)} ชนะ`}
        </p>
      ))}
    </Fold>
  );
}

import { useState } from "react";
import { COMBOS } from "../../content/murim/life/gifts";
import { talentById, talentFlavor } from "../../content/talents";
import { classById, guildById, guildsFor, rankLabel } from "../../content/core/power";
import { QI_NEED } from "../../content/murim/martial/arts";
import { SECLUSION_YEARS, canSeclude, isSecluded, startSeclusion } from "../../content/shared/fate";
import { TITLES, titlesOf } from "../../content/titles";
import { worldOf } from "../../content/worlds";
import { combatFactor } from "../../engine/body";
import { GRADE_NAME, TYPE_NAME, artInfo, artsOf, comprehension, masteryWord as artMastery, qiYears } from "../../content/murim/martial/arts";
import { TRAIN_MODES, trainArt } from "../../content/murim/martial/training";
import { STATUS_NAME, factions } from "../../content/murim/world/factions";
import { courtSummary } from "../../content/murim/world/court";
import type { Life } from "../../engine/types";
import { loc } from "../../engine/util";
import type { Act } from "../App";
import { Fold } from "../Fold";
import { artProject, createLocked, openCreate, setStyle, styleLine, styleLocked } from "../../content/murim/martial/creation";
import { STYLES, styleOf, type StyleId } from "../../content/murim/martial/arts";

/** ยุทธภพ: บันทึกวิชายุทธ์แบบในนิยาย — ไม่มีหน้าต่างระบบ เลเวล หรือตัวเลขพลัง */
function MartialRecord({ life }: { life: Life }) {
  const p = life.power;
  if (!p) {
    const w = worldOf(life.worldId);
    const [from, to] = w.awakenAge;
    return (
      <Fold always id="power-0" title={<>วิชายุทธ์</>}>
        <p className="muted">
          {life.age < from ? `ยังไม่ถึงวัยที่สำนักต่างๆ ลงเขามาคัดศิษย์ (${from}–${to} ปี)` : "เส้นชีพจรยังไม่ทะลวง — คุณยังไม่ได้ฝึกวิชาลมปราณ ใช้ชีวิตแบบคนธรรมดา"}
        </p>
        {Number(life.flags.mwBasics ?? 0) > 0 && <p className="small">ฝึกร่างกายพื้นฐานมาแล้ว {Number(life.flags.mwBasics)} ปี</p>}
      </Fold>
    );
  }
  const cls = classById(p.hunterClass);
  const guild = guildById(p.guild);
  const qiNeed = QI_NEED[p.rank] ?? 999;
  const progress = p.rank >= 8 ? 1 : Math.min(1, qiYears(life) / Math.max(1, qiNeed));
  const factor = combatFactor(life);
  return (
    <Fold always id="power-1" title={<>วิชายุทธ์</>}>
      <div className="status-grid">
        <span>ขั้นฝีมือ</span>
        <b className={`rank r${p.rank}`}>{rankLabel(life, p.rank)}</b>
        <span>สายวิชา</span>
        <b>
          {cls.name}
        </b>
        <span>สังกัด</span>
        <b>{guild ? loc(life, guild.name) : "ไร้สังกัด"}</b>
        <span>กำลังภายใน</span>
        <b>{qiYears(life).toFixed(1)} ปี</b>
        <span>ความเข้าใจ</span>
        <b>{comprehension(life)}</b>
      </div>
      <div className="exp">
        <div className="bar">
          <div className="fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="small muted">{p.rank < 8 && qiYears(life) < qiNeed ? `ต้องสะสมกำลังภายในให้ถึง ${qiNeed} ปี ก่อนทะลวงขั้นถัดไป · ` : ""}{p.rank >= 8 ? "ถึงจุดสูงสุดของวิชาแล้ว" : progress >= 1 ? "พร้อมทะลวงขั้นถัดไป" : progress >= 0.6 ? "ใกล้แตะขั้นถัดไป" : progress >= 0.3 ? "ฝึกมาได้ครึ่งทางของขั้นนี้" : "เพิ่งก้าวเข้าขั้นนี้"}</span>
      </div>
      {factor < 1 && <p className="small danger-text">บาดแผลและความพิการทำให้ฝีมือเหลือราว {Math.round(factor * 100)}% ของที่ควรเป็น</p>}
      <Fold always kind="section" id="power-s0" title={<>วิชาที่รู้</>}>
      {artsOf(life).length === 0 && <p className="muted small">ยังไม่มีคัมภีร์หรือวิชาที่ร่ำเรียนอย่างเป็นแบบแผน</p>}
      {artsOf(life).map((k) => {
        const a = artInfo(k);
        return (
          <details className="skill-card" key={k.id}>
            <summary>
              <span className="skill-name">{a.name}</span>
              <span className="skill-meta">
                {TYPE_NAME[a.type]} · {GRADE_NAME[a.grade]} · {artMastery(k.m)}
              </span>
            </summary>
            <p className="small">{a.desc}</p>
            <p className="small">{a.strong} · {a.weak}</p>
            <p className="small muted">ได้มาจาก: {k.src} ตอนอายุ {k.since}</p>
          </details>
        );
      })}</Fold>
    </Fold>
  );
}

/** แท็บวิชาของยุทธภพ: บันทึกวิชา · ฝึก/ปิดด่าน · สำนัก · งานยุทธภพ · ฉายา · พรสวรรค์ที่รู้ตัวแล้ว */
export function PowerTab({ life, act }: { life: Life; act: Act }) {
  const p = life.power;
  const known = life.talents.filter((t) => t.revealed);
  const hidden = life.talents.filter((t) => !t.revealed).length;
  const combos = COMBOS.filter((c) => life.flags[`combo:${c.id}`]);
  return (
    <div className="tab-content">
      <MartialRecord life={life} />
      {p && <MurimActions life={life} act={act} />}
      <TitlesCard life={life} act={act} />
      {known.length > 0 && (
        <>
          <Fold always kind="section" id="power-s3" title={<>พรสวรรค์แต่กำเนิด</>}>
          <div className="talent-row">
            {known.map((t, i) => {
              const info = talentById(t.id)!;
              const side = t.id.endsWith("_l") ? "ตื่นแล้ว · ทางสว่าง" : t.id.endsWith("_d") ? "ตื่นแล้ว · ทางมืด" : "";
              return (
                <div className={`talent ${info.world ? info.rarity : ""}`} key={i}>
                  <div className="t-name">{info.name}{side && <span className="muted small"> · {side}</span>}</div>
                  <div className="t-desc">{info.world ? info.desc : talentFlavor(info.desc)}</div>
                </div>
              );
            })}
          </div></Fold>
        </>
      )}
      {hidden > 0 && <p className="muted small">บางอย่างในตัวคุณยังหลับอยู่ — จะตื่นเมื่อถึงเวลาของมัน</p>}
      {combos.length > 0 && (
        <>
          <Fold kind="section" id="power-s4" title={<>พรสวรรค์ประสาน</>}>
          {combos.map((c) => (
            <p className="small" key={c.id}><b>{c.name}</b> <span className="muted">— {talentById(c.a)?.name} + {talentById(c.b)?.name}</span></p>
          ))}</Fold>
        </>
      )}
      {(p?.items.length ?? 0) > 0 && (
        <>
          <Fold kind="section" id="power-s5" title={<>ของติดตัว</>}>
          <ul className="items">
            {p!.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul></Fold>
        </>
      )}
    </div>
  );
}

/** สถานการณ์ใต้หล้า: สำนักต่างๆ และราชสำนัก */
export function WorldCard({ life }: { life: Life }) {
  const fs = factions(life);
  return (
    <Fold id="power-2" title={<>สถานการณ์ใต้หล้า</>}>
      <p className="small">{courtSummary(life)}</p>
      {fs.map((f) => (
        <div className="faction-row" key={f.id}>
          <span className="faction-name">
            {f.name} <span className="muted small">· {STATUS_NAME[f.status]} · ประมุข {f.leader}</span>
          </span>
          <div className="bar small-bar">
            <div className={`fill ${f.side === "demonic" ? "low" : f.side === "unorthodox" ? "mid" : "high"}`} style={{ width: `${f.power}%` }} />
          </div>
          <span className={`small ${f.rep >= 30 ? "good-text" : f.rep <= -30 ? "danger-text" : "muted"}`}>{f.rep >= 50 ? "มิตร" : f.rep >= 20 ? "เป็นมิตร" : f.rep <= -50 ? "ศัตรู" : f.rep <= -20 ? "ไม่ไว้ใจ" : "เฉยๆ"}</span>
        </div>
      ))}
    </Fold>
  );
}

/** ทางวิชา: เลือกว่าจะเก่งแบบไหน เปลี่ยนได้ทุก 5 ปี */
function StyleCard({ life, act }: { life: Life; act: Act }) {
  if (!life.power) return null;
  const locked = styleLocked(life);
  const cur = styleOf(life);
  return (
    <Fold always kind="section" id="power-style" title={<>ทางวิชา · {cur ? STYLES[cur].name : "ยังไม่ได้เลือก"}</>}>
      {styleLine(life) && <p className="small muted">{styleLine(life)}{locked ? ` · ${locked}` : ""}</p>}
      {(Object.keys(STYLES) as StyleId[]).filter((id) => id !== cur).map((id) => (
        <div className={`job ${locked ? "locked" : ""}`} key={id}>
          <div className="job-main">
            <div className="job-name">{STYLES[id].name}</div>
            <div className="job-sub">{STYLES[id].effect}</div>
          </div>
          <button className="btn small" disabled={!!locked} onClick={() => act((l) => setStyle(l, id))}>
            เลือก
          </button>
        </div>
      ))}
    </Fold>
  );
}

/** โครงการคิดค้นวิชาของตัวเอง */
function CreateCard({ life, act }: { life: Life; act: Act }) {
  if (!life.power) return null;
  if (life.flags.createdArt) return <p className="small muted">วิชาที่คุณคิดค้น: 「{String(life.flags.createdArt)}」</p>;
  const p = artProject(life);
  const locked = createLocked(life);
  return (
    <Fold always kind="section" id="power-create" title={<>คิดค้นวิชาของตัวเอง{p ? ` · ${p.name} ${p.done}/100` : ""}</>}>
      {p && (
        <div className="exp">
          <div className="bar">
            <div className="fill" style={{ width: `${p.done}%` }} />
          </div>
        </div>
      )}
      <p className="small muted">{locked ?? (p ? "ค้นคว้าปีละครั้ง เมื่อครบ 100 จะได้ตั้งชื่อวิชา" : "หลอมสิ่งที่เรียนมาเป็นวิชาที่ไม่มีใครเคยเห็น ใช้เวลาหลายปี")}</p>
      <button className="btn small" disabled={!!locked} onClick={() => act(openCreate)}>
        {p ? "ค้นคว้าต่อ" : "เริ่มคิดค้น"}
      </button>
    </Fold>
  );
}

/** เลือกวิชาและวิธีฝึก (ปีละครั้ง) */
function TrainPanel({ life, act }: { life: Life; act: Act }) {
  const arts = artsOf(life);
  const [art, setArt] = useState(String(life.flags.lastArt ?? arts[0]?.id ?? ""));
  if (!arts.length) return null;
  const done = life.doneThisYear.includes("mwTrain");
  const cur = arts.find((a) => a.id === art) ?? arts[0];
  return (
    <>
      <Fold always kind="section" id="power-s6" title={<>ฝึกวิชา {done ? "· ปีนี้ฝึกแล้ว" : "· ปีละครั้ง"}</>}>
      <label className="plan-pick">
        <span className="plan-label">วิชา</span>
        <select value={cur.id} onChange={(e) => setArt(e.target.value)}>
          {arts.map((k) => (
            <option key={k.id} value={k.id}>
              {artInfo(k).name} ({artMastery(k.m)})
            </option>
          ))}
        </select>
      </label>
      {TRAIN_MODES.map((m) => {
        const why = m.req?.(life, cur.id);
        return (
          <div className={`job ${why ? "locked" : ""}`} key={m.id}>
            <div className="job-main">
              <div className="job-name">{m.name}</div>
              <div className="job-sub">
                {m.pros} · {m.cons}
                {why && <span className="danger-text"> · {why}</span>}
              </div>
            </div>
            <button className="btn small" disabled={done || !!why} onClick={() => act((l) => { l.flags.lastArt = cur.id; trainArt(l, cur.id, m.id); })}>
              ฝึก
            </button>
          </div>
        );
      })}</Fold>
      <StyleCard life={life} act={act} />
      <CreateCard life={life} act={act} />
    </>
  );
}

/** ฝึก · ปิดด่าน · รับงานยุทธภพ · สำนัก (ยุทธภพ) */
function MurimActions({ life, act }: { life: Life; act: Act }) {
  const p = life.power!;
  const guild = guildById(p.guild);
  return (
    <>
      <div className="row">
        <button className="btn" disabled={!!canSeclude(life)} title={canSeclude(life)} onClick={() => act((l) => startSeclusion(l))}>
          {isSecluded(life) ? `ปิดด่านอยู่ (ถึงอายุ ${life.flags.secludeUntil})` : `ปิดด่าน ${SECLUSION_YEARS} ปี`}
        </button>
      </div>
      <TrainPanel life={life} act={act} />
      <Fold always kind="section" id="power-s7" title={<>สำนัก</>}>
      {guild ? (
        <div className="job">
          <div className="job-main">
            <div className="job-name">{loc(life, guild.name)}</div>
            <div className="job-sub">{guild.desc}</div>
          </div>
          <button className="btn small ghost" onClick={() => act((l) => { l.power!.guild = undefined; if (l.job?.careerId === "disciple") l.job = undefined; return { text: `คุณคืนป้ายศิษย์แล้วลงเขาจาก${guild.name}` }; })}>
            ออก
          </button>
        </div>
      ) : (
        guildsFor(life).map((g) => {
          const locked = g.minRank > p.rank;
          return (
            <div className={`job ${locked ? "locked" : ""}`} key={g.id}>
              <div className="job-main">
                <div className="job-name">{loc(life, g.name)}</div>
                <div className="job-sub">{locked ? `ต้องฝีมือขั้น${rankLabel(life, g.minRank)}ขึ้นไป` : loc(life, g.desc)}</div>
              </div>
              <button className="btn small" disabled={locked} onClick={() => act((l) => { l.power!.guild = g.id; l.job = { careerId: "disciple", level: 1, performance: 50, years: 0 }; return { text: `คุณคุกเข่าคารวะ และได้เป็นศิษย์แห่ง${g.name}`, kind: "good" }; })}>
                ฝากตัว
              </button>
            </div>
          );
        })
      )}</Fold>
    </>
  );
}

/** ฉายาที่ปลดล็อกแล้ว — ใส่ได้ทีละอัน */
function TitlesCard({ life, act }: { life: Life; act: Act }) {
  const owned = titlesOf(life);
  const current = life.flags.title;
  return (
    <>
      <Fold kind="section" id="power-s8" title={<>ฉายา ({owned.length}/{TITLES.length})</>}>
      {owned.length === 0 ? (
        <p className="muted small">ยังไม่มีฉายา — {life.worldId === "murim" ? "คนในยุทธภพจะตั้งให้เองเมื่อคุณทำเรื่องที่คนจดจำ" : "ได้จากเหตุการณ์สำคัญ เช่น รอดจาก Red Gate, ชำระแค้น, หักกิโยติน"}</p>
      ) : (
        <div className="chips">
          {owned.map((t) => (
            <button
              key={t.id}
              className={`chip title-chip ${current === t.id ? "on" : ""}`}
              title={t.desc}
              onClick={() =>
                act((l) => {
                  l.flags.title = t.id;
                  return { text: `ใส่ฉายา「${t.name}」(${t.desc})` };
                })
              }
            >
              {t.name}
              <span className="chip-sub"> · {t.desc}</span>
            </button>
          ))}
        </div>
      )}</Fold>
    </>
  );
}

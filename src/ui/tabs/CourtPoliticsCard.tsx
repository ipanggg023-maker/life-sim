// ราชสำนัก (M18): สามขั้วอำนาจ · ความนิยมในสังคม · ข่าวลือ · แผนการ
import { FACTIONS, FACTION_INFO, SCHEMES, SCHEME_MIN_AGE, dominant, fac, facLabel, pow, rumors, schemeReady, schemesDone, soc, socLabel, startScheme } from "../../content/court/politics";
import type { Life } from "../../engine/types";
import type { Act } from "../App";
import { Fold } from "../Fold";

export function CourtPoliticsCard({ life, act }: { life: Life; act: Act }) {
  if (!life.flags.pol) return null;
  const top = dominant(life);
  const list = rumors(life);
  const ready = schemeReady(life);
  return (
    <Fold always id="courtpolitics-0" className="court-pol" title={<>⚖️ การเมืองในราชสำนัก</>}>

      <div className="pol-balance" title="ดุลอำนาจ">
        {FACTIONS.map((f) => (
          <div key={f} className={`pol-seg pol-${f}`} style={{ width: `${pow(life, f)}%` }}>
            {FACTION_INFO[f].emoji} {pow(life, f)}%
          </div>
        ))}
      </div>
      <p className="small muted">
        ขั้วที่เป็นใหญ่: {FACTION_INFO[top].emoji} {FACTION_INFO[top].name}
      </p>

      {FACTIONS.map((f) => {
        const v = fac(life, f);
        return (
          <div className="pol-row" key={f}>
            <span>
              {FACTION_INFO[f].emoji} {FACTION_INFO[f].name}
            </span>
            <div className="pol-meter">
              <div className="pol-mid" />
              <div className={`pol-fill ${v >= 0 ? "pos" : "neg"}`} style={v >= 0 ? { left: "50%", width: `${v / 2}%` } : { right: "50%", width: `${-v / 2}%` }} />
            </div>
            <span className="small">
              {v > 0 ? "+" : ""}
              {v} · {facLabel(v)}
            </span>
          </div>
        );
      })}

      <div className="pol-row">
        <span>🌹 ความนิยมในสังคม</span>
        <div className="bar">
          <div className={`fill ${soc(life) >= 60 ? "high" : soc(life) >= 30 ? "mid" : "low"}`} style={{ width: `${soc(life)}%` }} />
        </div>
        <span className="small">
          {soc(life)} · {socLabel(soc(life))}
        </span>
      </div>

      <div className="section-title small">ข่าวลือที่ลอยอยู่ ({list.length})</div>
      {list.length ? (
        <ul className="pol-rumors">
          {[...list].reverse().map((r) => (
            <li key={r.key} className={r.you ? (r.good ? "good-text" : "bad-text") : "muted"}>
              {"🔥".repeat(Math.max(1, Math.min(5, r.heat)))} {r.text}
              {r.you ? "" : " (เรื่องของคนอื่น)"}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">วงน้ำชายังไม่มีอะไรพูดถึงคุณ… ในตอนนี้</p>
      )}

      <div className="section-title small">แผนการ (ปีละครั้ง · ทำไปแล้ว {schemesDone(life)})</div>
      {life.age < SCHEME_MIN_AGE ? (
        <p className="small muted">อายุ {SCHEME_MIN_AGE} ปีขึ้นไปจึงจะเริ่มวางแผนการได้</p>
      ) : (
        <div className="pol-schemes">
          {SCHEMES.map((s) => (
            <button key={s.id} className="btn small ghost" disabled={!ready} title={s.desc} onClick={() => act((l) => startScheme(l, s.id))}>
              {s.emoji} {s.name}
            </button>
          ))}
          {!ready && <p className="small muted">ปีนี้คุณวางแผนไปแล้ว (หรือยังมีเรื่องค้างอยู่)</p>}
        </div>
      )}
    </Fold>
  );
}

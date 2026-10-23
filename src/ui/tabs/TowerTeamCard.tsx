import { floorOf } from "../../content/tower/climb";
import { ROLES, bandRange, longBets, rivalGrudge, ruleFor, synergy, team, teamName, wagerStats } from "../../content/tower/m19sys";
import { SPONSORS } from "../../content/sponsors";
import type { Life } from "../../engine/types";
import { money, shortName } from "../../engine/util";
import { Fold } from "../Fold";

/** M19: กฎของช่วงชั้นถัดไป · ทีม · โต๊ะพนันของดวงดาว */
export function TowerTeamCard({ life }: { life: Life }) {
  if (!life.power) return null;
  const next = Math.min(100, floorOf(life) + 1);
  const rule = ruleFor(life, next);
  const [a, b] = bandRange(next);
  const members = team(life);
  const syn = Math.round(synergy(life) * 100);
  const w = wagerStats(life);
  const bets = longBets(life);
  const rival = SPONSORS.find((s) => s.id === life.flags.t19rival);
  return (
    <Fold always id="towerteam-0" className="t19-card" title={<>🗼 หอคอย: กฎ · ทีม · เดิมพัน</>}>

      <div className="t19-rule">
        <div className="t19-rule-head">
          {rule.emoji} ชั้น {a}–{b}:「{rule.name}」
        </div>
        <p className="small">{rule.effect}</p>
      </div>

      <div className="t19-sub">
        👥 ทีม{teamName(life) ? `「${teamName(life)}」` : " (ยังไม่ได้ตั้งชื่อ)"} · {members.length}/5 คน · ความเข้าขา {syn >= 0 ? "+" : ""}
        {syn}%
      </div>
      {members.length ? (
        <ul className="t19-roster">
          {members.map((x) => (
            <li key={x.p.id}>
              <span>
                {ROLES[x.m.role].emoji} {shortName(x.p)}
                {x.p.relation !== "ally" ? " 💕" : (x.m.love ?? 0) >= 1 ? " 💗" : ""}
              </span>
              <span className="small muted">
                {ROLES[x.m.role].name} · Lv.{x.m.lv} · ผูกพัน {x.p.bond}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">คุณยังปีนคนเดียว — เพื่อนร่วมทีมจะมาหาคุณในชั้นปลอดภัย</p>
      )}

      <div className="t19-sub">🎲 โต๊ะพนันของดวงดาว</div>
      <p className="small">
        เดิมพัน {w.n} ครั้ง · ชนะ {w.won} · แพ้ {w.lost} · สุทธิ {money(life, w.net)}
        {w.thrown ? ` · แกล้งแพ้ ${w.thrown}` : ""}
        {w.rigged ? ` · ล้มโต๊ะ ${w.rigged}` : ""}
      </p>
      {w.last && <p className="small muted">ล่าสุด — {w.last}</p>}
      {bets.map((x, i) => (
        <p className="small t19-bet" key={i}>
          ⏳ '{x.star}': ถึงชั้น {x.floor} ก่อนอายุ {x.by} · ลง {money(life, x.stake)} · จ่าย ×{x.pay}
        </p>
      ))}
      {rival && (
        <p className="small muted">
          ☄️ ดาวคู่แข่ง: {rival.name} · ความแค้น {rivalGrudge(life)}
        </p>
      )}
    </Fold>
  );
}

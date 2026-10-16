import { RARITY_LABEL, talentById } from "../../content/talents";
import { canEnterGate, dailyQuest, enterGate, gatesLeft, train } from "../../content/hunter/events/gates";
import {
  GUILDS,
  RANKS,
  classById,
  combatPower,
  expToNext,
  fightOdds,
  guildById,
  rankName,
  survivalOdds,
} from "../../content/hunter/power";
import type { Life } from "../../engine/types";
import { hasTalent } from "../../engine/util";
import type { Act } from "../App";

export function PowerTab({ life, act }: { life: Life; act: Act }) {
  const p = life.power;
  return (
    <div className="tab-content">
      {p ? <StatusWindow life={life} act={act} /> : <Dormant life={life} />}

      <div className="section-title">พรสวรรค์</div>
      <div className="talent-row">
        {life.talents.map((t, i) => {
          const info = talentById(t.id)!;
          if (!t.revealed)
            return (
              <div className="talent hidden" key={i}>
                <div className="t-rarity">???</div>
                <div className="t-name">ช่องลับ</div>
                <div className="t-desc">จะเปิดเมื่อตื่นพลัง เฉียดตาย หรืออายุ 21</div>
              </div>
            );
          return (
            <div className={`talent ${info.rarity}`} key={i}>
              <div className="t-rarity">{RARITY_LABEL[info.rarity]}</div>
              <div className="t-name">{info.name}</div>
              <div className="t-desc">{info.desc}</div>
            </div>
          );
        })}
      </div>

      <div className="section-title">สิ่งของพิเศษ</div>
      <ul className="items">
        {life.flags.amulet && <li>🪬 พระเครื่องของยาย (อุ่นอยู่ตลอด)</li>}
        {life.flags.ghostBox && <li>🪙 เหรียญโบราณสลักอักษรประหลาด</li>}
        {life.flags.oldBook && <li>📕 หนังสือปกหนังที่อ่านไม่ออก</li>}
        {p?.items.map((it, i) => <li key={i}>🎒 {it}</li>)}
        {!life.flags.amulet && !life.flags.ghostBox && !life.flags.oldBook && !p?.items.length && <li className="muted">ยังไม่มี</li>}
      </ul>
    </div>
  );
}

function Dormant({ life }: { life: Life }) {
  const awakenAge = Number(life.flags.awakenAge ?? 19);
  return (
    <div className="sys-window">
      <div className="sys-head">ระบบ · สถานะ</div>
      <p>
        แรงก์: <b>—</b>
      </p>
      <p className="muted">
        {life.age < 18
          ? "ยังไม่ถึงวัยตื่นพลัง (โดยทั่วไป 18–20 ปี)"
          : life.flags.awakenDone || life.age > awakenAge
            ? "ไม่พบการตื่นพลัง — คุณเป็นคนธรรมดา (…หรือเปล่า?)"
            : "รอการตื่นพลัง…"}
        {Number(life.flags.glitch ?? 0) > 0 && " · พบสัญญาณผิดปกติ " + life.flags.glitch + " ครั้ง"}
      </p>
    </div>
  );
}

function StatusWindow({ life, act }: { life: Life; act: Act }) {
  const p = life.power!;
  const cls = classById(p.hunterClass);
  const guild = guildById(p.guild);
  const isHunter = life.job?.careerId === "hunter";
  const need = expToNext(p.level);
  const left = gatesLeft(life);
  const gateRanks = Array.from({ length: Math.min(p.rank + 2, RANKS.length) }, (_, i) => i);

  return (
    <>
      <div className="sys-window">
        <div className="sys-head">ระบบ · สถานะ</div>
        <div className="status-grid">
          <span>ชื่อ</span>
          <b>
            {life.firstName} {life.lastName}
          </b>
          <span>แรงก์</span>
          <b className={`rank rank-${rankName(p.rank)}`}>{rankName(p.rank)}</b>
          <span>สายอาชีพ</span>
          <b>
            {cls.emoji} {cls.name}
          </b>
          <span>เลเวล</span>
          <b>Lv.{p.level}</b>
          <span>พลังต่อสู้</span>
          <b>{combatPower(life)}</b>
          <span>กิลด์</span>
          <b>{guild?.name ?? "อิสระ"}</b>
          <span>Gate ที่เคลียร์</span>
          <b>
            {p.gates} (บอส {p.bossKills})
          </b>
        </div>
        <div className="exp">
          <div className="bar">
            <div className="fill sys-fill" style={{ width: `${(p.exp / need) * 100}%` }} />
          </div>
          <span className="small">
            EXP {p.exp}/{need}
          </span>
        </div>
        <div className="skills">
          {p.skills.map((s) => (
            <span className="skill" key={s}>
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="section-title">
        บุก Gate · เหลือ {Math.max(0, left)} ครั้งในปีนี้
      </div>
      {!isHunter && <p className="muted small">ต้องลงทะเบียนเป็น Hunter ที่แท็บ 💼 อาชีพก่อน</p>}
      {gateRanks.map((r) => {
        const blocked = canEnterGate(life, r);
        return (
          <div className="job" key={r}>
            <div className="job-main">
              <div className="job-name">
                🌀 Gate แรงก์ <span className={`rank rank-${rankName(r)}`}>{rankName(r)}</span>
              </div>
              <div className="job-sub">
                ชนะบอส {Math.round(fightOdds(life, r) * 100)}% ·{" "}
                <span className={survivalOdds(life, r) < 0.8 ? "danger-text" : ""}>รอด {Math.round(survivalOdds(life, r) * 100)}%</span>
              </div>
            </div>
            <button className="btn small" disabled={!!blocked} title={blocked} onClick={() => act((l) => enterGate(l, r))}>
              เข้า
            </button>
          </div>
        );
      })}

      <div className="row">
        <button className="btn" disabled={life.doneThisYear.includes("train")} onClick={() => act(train)}>
          🏋️ ฝึกฝน
        </button>
        {hasTalent(life, "system_user") && (
          <button className="btn sys-btn" disabled={life.doneThisYear.includes("daily")} onClick={() => act(dailyQuest)}>
            📋 ภารกิจรายวัน
          </button>
        )}
      </div>

      <div className="section-title">กิลด์</div>
      {guild ? (
        <div className="job">
          <div className="job-main">
            <div className="job-name">{guild.name}</div>
            <div className="job-sub">{guild.desc}</div>
          </div>
          <button
            className="btn small ghost"
            onClick={() =>
              act((l) => {
                l.power!.guild = undefined;
                return { text: `คุณออกจาก${guild.name}` };
              })
            }
          >
            ออก
          </button>
        </div>
      ) : (
        GUILDS.map((g) => {
          const locked = g.minRank > p.rank;
          return (
            <div className={`job ${locked ? "locked" : ""}`} key={g.id}>
              <div className="job-main">
                <div className="job-name">{g.name}</div>
                <div className="job-sub">
                  {locked ? `🔒 แรงก์ ${rankName(g.minRank)}+` : g.desc}
                </div>
              </div>
              <button
                className="btn small"
                disabled={locked || !isHunter}
                onClick={() =>
                  act((l) => {
                    l.power!.guild = g.id;
                    return { text: `คุณเข้าร่วม${g.name}`, kind: "good" };
                  })
                }
              >
                สมัคร
              </button>
            </div>
          );
        })
      )}
    </>
  );
}

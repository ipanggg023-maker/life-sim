// หน้าต่างสถานะของ "ระบบชีวิต" (โลกธรรมดา): STR–LUK, แจกแต้ม, ฝึก, ภารกิจรายวัน, ภารกิจระบบ
import { SYS_INFO, SYS_STATS, effSys, sysSkillsOf } from "../../content/gameStats";
import { CHALLENGES_PER_YEAR, canChallenge, challengeLevel, challengesLeft, stageOf, startChallenge } from "../../content/ordinary/system";
import { SYS_CAP, allocate, sysDaily, sysExpToNext, trainSys, trainingsLeft } from "../../content/ordinary/sys";
import { skillsOf } from "../../content/hunter/power";
import { SKILL_TYPE, skillEffectText } from "../../content/skills";
import type { Life } from "../../engine/types";
import type { Act } from "../App";
import { SystemExtras } from "./SystemExtras";

export function SystemWindow({ life, act }: { life: Life; act: Act }) {
  const s = life.sys!;
  const need = sysExpToNext(s.level);
  const left = trainingsLeft(life);
  const blocked = canChallenge(life);
  return (
    <>
      <div className="sys-window">
        <div className="sys-head">ระบบชีวิต · หน้าต่างสถานะ</div>
        <p>
          Lv.<b>{s.level}</b> · แต้มที่แจกได้ <b>{s.points}</b>
        </p>
        <div className="exp">
          <div className="bar">
            <div className="fill sys-fill" style={{ width: `${(s.exp / need) * 100}%` }} />
          </div>
          <span className="small">
            EXP {s.exp}/{need}
          </span>
        </div>
        <div className="sys-stats">
          {SYS_STATS.map((k) => {
            const v = effSys(life, k);
            return (
              <div className="sys-stat" key={k} title={SYS_INFO[k].desc}>
                <span>
                  {SYS_INFO[k].emoji} <b>{SYS_INFO[k].label}</b>
                </span>
                <div className="bar">
                  <div className="fill sys-fill" style={{ width: `${Math.min(100, (v / SYS_CAP) * 100)}%` }} />
                </div>
                <b>{v}</b>
                <button className="btn small plus" disabled={s.points <= 0 || v >= SYS_CAP} onClick={() => act((l) => allocate(l, k))}>
                  +
                </button>
              </div>
            );
          })}
        </div>
        <p className="small muted">STR/STA → สุขภาพ · INT → สติปัญญา · CHA → รูปลักษณ์ · LUK → โชค — ค่าที่ฝึกเกินพื้นฐานช่วยทุกการเช็ก และใช้สมัครอาชีพเฉพาะทาง</p>
      </div>

      <div className="section-title">ฝึกตามเมนูระบบ · เหลือ {left} ครั้งในปีนี้</div>
      <div className="grid">
        {SYS_STATS.map((k) => (
          <button key={k} className="activity" disabled={left <= 0} onClick={() => act((l) => trainSys(l, k))}>
            <span className="act-emoji">{SYS_INFO[k].emoji}</span>
            <span className="act-name">
              ฝึก {SYS_INFO[k].label}
            </span>
            <span className="act-desc">{SYS_INFO[k].desc}</span>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sys-btn" disabled={life.doneThisYear.includes("daily")} onClick={() => act(sysDaily)}>
          📋 ภารกิจรายวัน
        </button>
        <button className="btn sys-btn" disabled={!!blocked} onClick={() => act((l) => void startChallenge(l))}>
          ⚡ ภารกิจระบบ ({challengesLeft(life)}/{CHALLENGES_PER_YEAR})
        </button>
      </div>
      <p className="small muted">
        {blocked ?? `ภารกิจตามอาชีพ: ${stageOf(life).names[challengeLevel(life)]} (ใช้ ${SYS_INFO[stageOf(life).main].label})`}
      </p>
      <SystemExtras life={life} act={act} />

      <div className="section-title">สกิลจากระบบ ({sysSkillsOf(life).length}/12)</div>
      <div className="skill-list">
        {skillsOf(life).map((sk) => (
          <details className="skill-card" key={sk.name}>
            <summary>
              <span className="skill-name">
                {SKILL_TYPE[sk.type].emoji} {sk.name}
              </span>
              <span className="skill-meta">ชำนาญ Lv.{sk.mastery}</span>
            </summary>
            <p className="small">{sk.desc}</p>
            <p className="small muted">{skillEffectText(sk)}</p>
          </details>
        ))}
        {!skillsOf(life).length && <p className="small muted">ฝึกค่าสถานะใดก็ได้ถึง 35 เพื่อปลดล็อกสกิลแรก (60 = สกิลขั้นสูง)</p>}
      </div>
    </>
  );
}

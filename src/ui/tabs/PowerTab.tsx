import { RARITY_LABEL, talentById } from "../../content/talents";
import { canEnterGate, dailyQuest, enterGate, gatesLeft, train } from "../../content/hunter/events/gates";
import { RANKS, classById, combatPower, expToNext, fightOdds, guildById, guildsFor, rankLabel, survivalOdds } from "../../content/hunter/power";
import { breakLevel } from "../../content/murim/events";
import { worldOf } from "../../content/worlds";
import type { Life } from "../../engine/types";
import { displayName, hasTalent } from "../../engine/util";
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
                <div className="t-desc">จะเปิดเมื่อ{life.worldId === "murim" ? "รากฐานตื่น" : "ตื่นพลัง"} เฉียดตาย หรืออายุ 21</div>
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
        {life.flags.ringMaster && <li>💍 แหวนหยกดำที่มีวิญญาณปรมาจารย์</li>}
        {p?.items.map((it, i) => <li key={i}>🎒 {it}</li>)}
        {!life.flags.amulet && !life.flags.ghostBox && !life.flags.oldBook && !life.flags.ringMaster && !p?.items.length && (
          <li className="muted">ยังไม่มี</li>
        )}
      </ul>
    </div>
  );
}

function Dormant({ life }: { life: Life }) {
  const w = worldOf(life.worldId);
  const murim = life.worldId === "murim";
  const [from, to] = w.awakenAge;
  const awakenAge = Number(life.flags.awakenAge ?? to);
  return (
    <div className="sys-window">
      <div className="sys-head">ระบบ · สถานะ</div>
      <p>
        {w.labels.rank}: <b>—</b>
      </p>
      <p className="muted">
        {life.age < from
          ? murim
            ? `ยังไม่ถึงวัยคัดเลือกศิษย์ (${from}–${to} ปี)`
            : `ยังไม่ถึงวัยตื่นพลัง (โดยทั่วไป ${from}–${to} ปี)`
          : life.flags.awakenDone || life.age > awakenAge
            ? murim
              ? "เส้นชีพจรอุดตัน — คุณเป็นคนธรรมดา (…หรือเปล่า?)"
              : "ไม่พบการตื่นพลัง — คุณเป็นคนธรรมดา (…หรือเปล่า?)"
            : murim
              ? "รอวันคัดเลือกศิษย์…"
              : "รอการตื่นพลัง…"}
        {Number(life.flags.glitch ?? 0) > 0 && " · พบสัญญาณผิดปกติ " + life.flags.glitch + " ครั้ง"}
      </p>
    </div>
  );
}

function StatusWindow({ life, act }: { life: Life; act: Act }) {
  const w = worldOf(life.worldId);
  const murim = life.worldId === "murim";
  const p = life.power!;
  const cls = classById(p.hunterClass);
  const guild = guildById(p.guild);
  const canQuest = w.questJobs.includes(life.job?.careerId ?? "");
  const need = expToNext(p.level);
  const left = gatesLeft(life);
  const gateRanks = Array.from({ length: Math.min(p.rank + 2, RANKS.length) }, (_, i) => i);

  return (
    <>
      <div className="sys-window">
        <div className="sys-head">ระบบ · สถานะ</div>
        <div className="status-grid">
          <span>ชื่อ</span>
          <b>{displayName(life)}</b>
          <span>{w.labels.rank}</span>
          <b className={`rank r${p.rank}`}>{rankLabel(life, p.rank)}</b>
          <span>{murim ? "วิชา" : "สายอาชีพ"}</span>
          <b>
            {cls.emoji} {cls.name}
          </b>
          <span>เลเวล</span>
          <b>
            Lv.{p.level}
            {murim && p.rank < 8 && <span className="muted small"> (ทะลวงขั้นได้ที่ Lv.{breakLevel(p.rank)})</span>}
          </b>
          <span>พลังต่อสู้</span>
          <b>{combatPower(life)}</b>
          <span>{w.labels.guild}</span>
          <b>{guild?.name ?? (murim ? "ไร้สังกัด" : "อิสระ")}</b>
          <span>{murim ? "ภารกิจสำเร็จ" : "Gate ที่เคลียร์"}</span>
          <b>
            {p.gates} ({murim ? "ล้มยอดฝีมือ" : "บอส"} {p.bossKills})
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
        {w.labels.raid} · เหลือ {Math.max(0, left)} ครั้งในปีนี้
      </div>
      {!canQuest && (
        <p className="muted small">
          {murim ? "ต้องเป็นศิษย์สำนัก จอมยุทธ์พเนจร หรือนักฆ่ารับจ้างก่อน (แท็บ 💼 อาชีพ)" : "ต้องลงทะเบียนเป็น Hunter ที่แท็บ 💼 อาชีพก่อน"}
        </p>
      )}
      {gateRanks.map((r) => {
        const blocked = canEnterGate(life, r);
        return (
          <div className="job" key={r}>
            <div className="job-main">
              <div className="job-name">
                {w.emoji} {murim ? "ภารกิจระดับ" : "Gate แรงก์ "}
                <span className={`rank r${r}`}>{rankLabel(life, r)}</span>
              </div>
              <div className="job-sub">
                ชนะ {Math.round(fightOdds(life, r) * 100)}% ·{" "}
                <span className={survivalOdds(life, r) < 0.8 ? "danger-text" : ""}>รอด {Math.round(survivalOdds(life, r) * 100)}%</span>
              </div>
            </div>
            <button className="btn small" disabled={!!blocked} title={blocked} onClick={() => act((l) => enterGate(l, r))}>
              {murim ? "รับ" : "เข้า"}
            </button>
          </div>
        );
      })}

      <div className="row">
        <button className="btn" disabled={life.doneThisYear.includes("train")} onClick={() => act(train)}>
          {murim ? "🧘" : "🏋️"} {w.labels.train}
        </button>
        {hasTalent(life, "system_user") && (
          <button className="btn sys-btn" disabled={life.doneThisYear.includes("daily")} onClick={() => act(dailyQuest)}>
            📋 ภารกิจรายวัน
          </button>
        )}
      </div>

      <div className="section-title">{w.labels.guild}</div>
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
                if (l.job?.careerId === "disciple") l.job = undefined;
                return { text: murim ? `คุณคืนป้ายศิษย์แล้วลงเขาจาก${guild.name}` : `คุณออกจาก${guild.name}` };
              })
            }
          >
            ออก
          </button>
        </div>
      ) : (
        guildsFor(life).map((g) => {
          const locked = g.minRank > p.rank;
          return (
            <div className={`job ${locked ? "locked" : ""}`} key={g.id}>
              <div className="job-main">
                <div className="job-name">{g.name}</div>
                <div className="job-sub">{locked ? `🔒 ${w.labels.rank} ${rankLabel(life, g.minRank)}+` : g.desc}</div>
              </div>
              <button
                className="btn small"
                disabled={locked || (!murim && !canQuest)}
                onClick={() =>
                  act((l) => {
                    l.power!.guild = g.id;
                    // ยุทธภพ: เข้าสำนัก = เป็นศิษย์สำนัก
                    if (murim) l.job = { careerId: "disciple", level: 1, performance: 50, years: 0 };
                    return { text: murim ? `คุณคุกเข่าคารวะ และได้เป็นศิษย์แห่ง${g.name}` : `คุณเข้าร่วม${g.name}`, kind: "good" };
                  })
                }
              >
                {murim ? "ฝากตัว" : "สมัคร"}
              </button>
            </div>
          );
        })
      )}
    </>
  );
}

import { useState } from "react";
import { ACHIEVEMENTS } from "../../content/achievements";
import { TALENTS, RARITY_LABEL, talentById } from "../../content/talents";
import { facultyById } from "../../content/hunter/careers";
import { rankName } from "../../content/hunter/power";
import { ageUp, resolveChoice, STAT_LABEL, type BirthOptions } from "../../engine/game";
import { visibleChoices } from "../../engine/events";
import { memoryOdds } from "../../engine/memory";
import type { Gender, Life, PastLife, Soul, Stats, Wealth } from "../../engine/types";
import { formatMoney } from "../../engine/util";
import { saveSnapshot, type Bundle } from "../../save";
import type { Act } from "../App";
import { SaveTransfer } from "../SaveTransfer";

export function SoulTab({
  life,
  soul,
  graveyard,
  dev,
  act,
  onNewLife,
  onImport,
}: {
  life: Life;
  soul: Soul;
  graveyard: PastLife[];
  dev: boolean;
  act: Act;
  onNewLife: (opts?: BirthOptions) => void;
  onImport: (b: Bundle) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const memories = life.memories ?? [];
  return (
    <div className="tab-content">
      <div className="sys-window">
        <div className="sys-head">บันทึกวิญญาณ</div>
        <p>
          ชาติที่ {graveyard.length + 1} · {life.firstName} {life.lastName} · ปี {life.birthYear}
        </p>
        <p>
          แต้มวิญญาณ: <b>{soul.points}</b> <span className="muted small">(สะสมทั้งหมด {soul.totalPoints})</span>
        </p>
        {(life.regressions ?? 0) > 0 && (
          <p>
            ย้อนเวลา {life.regressions} ครั้ง · ความเบี่ยงเบน {life.divergence ?? 0} · ความทรงจำยังตรง {Math.round(memoryOdds(life) * 100)}%
          </p>
        )}
        <p className="muted small">
          เตรียมไว้สำหรับชาติหน้า:{" "}
          {[
            soul.perks.blessing > 0 && "พรแห่งโชค",
            soul.perks.reroll > 0 && `สุ่มใหม่ ×${soul.perks.reroll}`,
            soul.perks.lockedTalent && `ผนึก「${talentById(soul.perks.lockedTalent)?.name}」`,
            soul.perks.clarity && "ความทรงจำแจ่มชัด",
          ]
            .filter(Boolean)
            .join(" · ") || "ยังไม่มี (ซื้อได้ที่หน้าจอหลังตาย)"}
        </p>
      </div>

      <div className="section-title">ความทรงจำจากชาติก่อน</div>
      {memories.length ? (
        <ul className="memories">
          {memories.map((m) => (
            <li key={m.key} className={m.key === "death" ? "danger-text" : ""}>
              {m.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">ยังไม่มี — ย้อนเวลาหลังตาย แล้วสิ่งที่คุณเห็นในชาตินี้จะกลายเป็นความทรงจำ</p>
      )}

      <div className="section-title">
        ความสำเร็จ {soul.achievements.length}/{ACHIEVEMENTS.length}
      </div>
      <div className="ach-grid">
        {ACHIEVEMENTS.map((a) => {
          const got = soul.achievements.includes(a.id);
          return (
            <div className={`ach ${got ? "got" : ""}`} key={a.id} title={a.desc}>
              <div className="ach-name">{got ? "🏆" : "🔒"} {a.name}</div>
              <div className="ach-desc">
                {a.desc} · +{a.points}
              </div>
            </div>
          );
        })}
      </div>

      {graveyard.length > 0 && (
        <>
          <div className="section-title">สุสาน</div>
          {graveyard.map((g, i) => (
            <div className="grave" key={g.id}>
              <div className="grave-name">
                ชาติที่ {graveyard.length - i}: {g.name} · {g.age} ปี
                {g.rank !== undefined && <span className={`rank rank-${rankName(g.rank)}`}> [{rankName(g.rank)}]</span>}
                {g.regressed && " ⏪"}
              </div>
              <div className="grave-sub">
                {g.cause} · {formatMoney(g.money)}
                {g.job ? ` · ${g.job}` : ""}
                {g.degree ? ` · ${facultyById(g.degree).name}` : ""}
                {g.points !== undefined ? ` · +${g.points} แต้ม` : ""}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="section-title">ย้ายเซฟไปอีกเครื่อง</div>
      <SaveTransfer life={life} soul={soul} graveyard={graveyard} onImport={onImport} />

      <div className="section-title">ตัวเลือก</div>
      {!confirm ? (
        <button className="btn ghost" onClick={() => setConfirm(true)}>
          ทิ้งชีวิตนี้แล้วเกิดใหม่
        </button>
      ) : (
        <div className="row">
          <button className="btn danger" onClick={() => onNewLife()}>
            ยืนยัน (ชีวิตนี้จะหายไป)
          </button>
          <button className="btn ghost" onClick={() => setConfirm(false)}>
            ยกเลิก
          </button>
        </div>
      )}

      {dev && <DevPanel act={act} onNewLife={onNewLife} />}
    </div>
  );
}

const STAT_KEYS: (keyof Stats)[] = ["health", "happiness", "smarts", "looks", "luck"];

/** Admin: สร้างตัวละครแบบ D&D และกรอเวลา */
function DevPanel({ act, onNewLife }: { act: Act; onNewLife: (opts?: BirthOptions) => void }) {
  const [gender, setGender] = useState<Gender>("m");
  const [firstName, setFirstName] = useState("");
  const [wealth, setWealth] = useState<Wealth>("middle");
  const [stats, setStats] = useState<Stats>({ health: 70, happiness: 70, smarts: 60, looks: 60, luck: 50 });
  const [talents, setTalents] = useState<string[]>([]);

  const skip = (years: number) =>
    act((l) => {
      for (let i = 0; i < years && l.alive; i++) {
        while (l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
        if (!l.alive) break;
        saveSnapshot(l);
        ageUp(l);
      }
      while (l.alive && l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
      return { text: `กรอเวลาไป ${years} ปี (เลือกตัวเลือกแรกอัตโนมัติ)` };
    });

  return (
    <div className="card dev">
      <div className="card-title">🛠️ Admin</div>
      <div className="row">
        <button className="btn small" onClick={() => skip(1)}>+1 ปี (auto)</button>
        <button className="btn small" onClick={() => skip(5)}>+5 ปี</button>
        <button className="btn small" onClick={() => skip(10)}>+10 ปี</button>
      </div>

      <div className="section-title">สร้างตัวละคร</div>
      <div className="row">
        <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="m">ชาย</option>
          <option value="f">หญิง</option>
        </select>
        <select value={wealth} onChange={(e) => setWealth(e.target.value as Wealth)}>
          <option value="poor">ยากจน</option>
          <option value="middle">ชนชั้นกลาง</option>
          <option value="rich">มีฐานะ</option>
          <option value="elite">มหาเศรษฐี</option>
        </select>
        <input placeholder="ชื่อ (ว่าง = สุ่ม)" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      {STAT_KEYS.map((k) => (
        <label className="slider" key={k}>
          <span>
            {STAT_LABEL[k]} {stats[k]}
          </span>
          <input type="range" min={0} max={100} value={stats[k]} onChange={(e) => setStats({ ...stats, [k]: Number(e.target.value) })} />
        </label>
      ))}
      <div className="chips">
        {TALENTS.map((t) => (
          <button
            key={t.id}
            className={`chip ${t.rarity} ${talents.includes(t.id) ? "on" : ""}`}
            onClick={() => setTalents(talents.includes(t.id) ? talents.filter((x) => x !== t.id) : [...talents, t.id])}
            title={`${RARITY_LABEL[t.rarity]} · ${t.desc}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <button
        className="btn primary"
        onClick={() => onNewLife({ gender, wealth, stats, talents, firstName: firstName.trim() || undefined })}
      >
        เกิดด้วยค่านี้
      </button>
    </div>
  );
}

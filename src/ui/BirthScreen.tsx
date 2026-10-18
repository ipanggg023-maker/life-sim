import { useEffect, useState } from "react";
import { RARITY_LABEL, talentById } from "../content/talents";
import { wealthLabel } from "../engine/game";
import { worldOf } from "../content/worlds";
import { countryOf } from "../content/countries";
import type { Life, StatKey } from "../engine/types";
import { displayName, firstPerson, people, relationLabel, shortName } from "../engine/util";
import { StatBar } from "./MainScreen";

const STATS: StatKey[] = ["health", "happiness", "smarts", "looks"];

export function BirthScreen({
  life,
  rerolls,
  onReroll,
  onStart,
}: {
  life: Life;
  rerolls: number;
  onReroll: () => void;
  onStart: () => void;
}) {
  const [step, setStep] = useState(0);
  const talents = life.talents;
  const total = 2 + talents.length; // ข้อมูลครอบครัว, สเตตัส, การ์ดพรสวรรค์ทีละใบ

  useEffect(() => {
    if (step >= total) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), step < 2 ? 500 : 750);
    return () => window.clearTimeout(id);
  }, [step, total]);

  const dad = firstPerson(life, "father");
  const mom = firstPerson(life, "mother");
  const sibs = people(life, "sibling");

  return (
    <div className="birth" onClick={() => setStep(total)}>
      <div className="sys-window">
        <div className="sys-head">ระบบ · สุ่มการเกิด</div>
        <p className="birth-name">
          {life.gender === "m" ? "♂" : "♀"} {displayName(life)} ("{life.nickname}")
        </p>
        <p className="muted">
          {worldOf(life.worldId).emoji} {worldOf(life.worldId).name}{life.country ? ` · ${countryOf(life.country).flag} ${countryOf(life.country).name}` : ""} · {wealthLabel(life.wealth, life.worldId)} · {worldOf(life.worldId).yearLabel} {life.birthYear}
          {life.devCreated && <span className="dev-tag"> · สร้างโดย Admin</span>}
        </p>
        {life.legacy && (
          <p className="small">
            {life.flags.descendant
              ? `🩸 ทายาทรุ่นที่ ${life.legacy.generation + 1} ของตระกูล${life.legacy.lastName} — ตระกูลที่คุณสร้างไว้ในชาติก่อน`
              : `🌏 ${life.birthYear - life.legacy.founderDeathYear} ปีหลังการตายของ${life.legacy.founderName} (คุณในชาติก่อน)`}
          </p>
        )}
      </div>

      {step >= 1 && (
        <div className="card fade-in">
          <div className="card-title">ครอบครัว</div>
          {dad && <p>พ่อ: {shortName(dad)} ({dad.job}) อายุ {dad.age}</p>}
          {mom && <p>แม่: {shortName(mom)} ({mom.job}) อายุ {mom.age}</p>}
          {sibs.length ? (
            sibs.map((s) => <p key={s.id}>{relationLabel(s, life)}: {shortName(s)} อายุ {s.age}</p>)
          ) : (
            <p>พี่น้อง: ลูกคนเดียว</p>
          )}
        </div>
      )}

      {step >= 2 && (
        <div className="card fade-in">
          <div className="card-title">ค่าพื้นฐาน</div>
          {STATS.map((k) => (
            <StatBar key={k} k={k} value={life.stats[k]} />
          ))}
        </div>
      )}

      <div className="talent-row">
        {talents.map((t, i) => {
          if (step < 3 + i) return null;
          const info = talentById(t.id)!;
          if (!t.revealed)
            return (
              <div className="talent hidden fade-in" key={i}>
                <div className="t-rarity">???</div>
                <div className="t-name">ช่องลับ</div>
                <div className="t-desc">จะเปิดเมื่อครบเงื่อนไข</div>
              </div>
            );
          return (
            <div className={`talent ${info.rarity} fade-in`} key={i}>
              <div className="t-rarity">{RARITY_LABEL[info.rarity]}</div>
              <div className="t-name">{info.name}</div>
              <div className="t-desc">{info.desc}</div>
            </div>
          );
        })}
      </div>

      {step >= total && (
        <>
          <button className="btn primary big fade-in" onClick={onStart}>
            เริ่มต้นชีวิต
          </button>
          {rerolls > 0 && (
            <button className="btn ghost fade-in" onClick={onReroll}>
              🎲 สุ่มเกิดใหม่ (เหลือ {rerolls} ครั้ง)
            </button>
          )}
        </>
      )}
    </div>
  );
}

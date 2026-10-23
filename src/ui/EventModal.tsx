import { useEffect, useState } from "react";
import { loc } from "../engine/util";
import { currentScene, labelOf, lockedChoices, visibleChoices, type Outcome } from "../engine/events";
import { choiceChance } from "../engine/game";
import type { Life } from "../engine/types";
import { isRealistic } from "../content/worlds";
import { Icon, noEmoji } from "./Icon";

/** พิมพ์ข้อความทีละตัว แตะเพื่อข้าม */
function useTypewriter(text: string, speed = 18) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = window.setInterval(() => {
      setN((x) => {
        if (x >= text.length) {
          window.clearInterval(id);
          return x;
        }
        return x + 2;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [text, speed]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) };
}

/** โอกาสแบบคร่าวๆ เมื่อตัวละครยังมีข้อมูลไม่พอ — ไม่โชว์ตัวเลขที่แม่นเกินจริง */
const vagueLabel = (p: number) => (p >= 0.7 ? "สูง" : p >= 0.4 ? "กลาง" : "ต่ำ");

export function EventModal({ life, onChoose }: { life: Life; onChoose: (index: number) => void }) {
  const q = life.queue[0];
  const scene = currentScene(q, life)!;
  const text = noEmoji(loc(life, scene.text(life, q.ctx)));
  const { shown, done, skip } = useTypewriter(text);
  // ตัวเลือกที่กดได้ก่อน แล้วตามด้วยตัวที่ยังขาดเงื่อนไข (ล็อกไว้พร้อมเหตุผล) ตามลำดับเดิม
  const choices = [...visibleChoices(life, q), ...lockedChoices(life, q)].sort((a, b) => a.index - b.index);

  return (
    <div className="overlay modal-overlay">
      <div className={`modal ${scene.system && !isRealistic(life.worldId) ? "sys-modal" : ""}`} onClick={skip}>
        <div className="modal-head">
          <span className="modal-age">อายุ {life.age} ปี</span>
          {scene.title && <h3>{noEmoji(scene.title)}</h3>}
        </div>
        <p className="modal-text">{shown}</p>
        <div className={`choices ${done ? "in" : ""}`}>
          {choices.map(({ c, index }) => {
            const pct = choiceChance(life, q, index);
            const survive = c.survival?.(life, q.ctx);
            const missing = c.req?.(life, q.ctx);
            const vague = c.unknown?.(life, q.ctx);
            return (
              <button
                key={index}
                className={`choice ${c.tone ?? ""} ${missing ? "locked" : ""}`}
                disabled={!done || !!missing}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onChoose(index);
                }}
              >
                <span className="choice-label">{noEmoji(loc(life, labelOf(c, life, q.ctx)))}</span>
                {missing && <span className="cons"><Icon name="lock" size={13} /> {missing}</span>}
                {survive !== undefined && survive < 0.95 && (
                  <span className="warn">[คำเตือน: อัตรารอดชีวิต {vague ? vagueLabel(survive) : `${Math.round(survive * 100)}%`}]</span>
                )}
                {pct !== undefined && <span className="pct">{vague ? `โอกาสสำเร็จ: ${vagueLabel(pct)} (ยังประเมินคู่ต่อสู้ไม่ได้)` : `สำเร็จ ${Math.round(pct * 100)}%`}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export interface Resolved {
  title?: string;
  prompt: string;
  choice: string;
  out: Outcome;
}

const TIER = { great: "สำเร็จงดงาม", ok: "สำเร็จ", fail: "พลาด", disaster: "พลาดหนัก" } as const;

export function OutcomeModal({ resolved, onNext }: { resolved: Resolved; onNext: () => void }) {
  return (
    <div className="overlay modal-overlay">
      <div className="modal">
        {resolved.title && <h3>{noEmoji(resolved.title)}</h3>}
        <p className="modal-prompt">{noEmoji(resolved.prompt)}</p>
        <p className="modal-choice">{noEmoji(resolved.choice)}</p>
        {resolved.out.roll && (
          <p className={`roll ${resolved.out.roll.ok ? "ok" : "fail"} ${resolved.out.roll.tier}`}>
            {TIER[resolved.out.roll.tier]} · โอกาส {Math.round(resolved.out.roll.p * 100)}%
          </p>
        )}
        <p className={`modal-outcome ${resolved.out.kind ?? ""}`}>{noEmoji(resolved.out.text)}</p>
        {resolved.out.effects && (resolved.out.effects.good.length > 0 || resolved.out.effects.bad.length > 0) && (
          <p className="effects">
            {resolved.out.effects.good.map((t) => (
              <span className="eff good" key={t}>
                {t}
              </span>
            ))}
            {resolved.out.effects.bad.map((t) => (
              <span className="eff bad" key={t}>
                {t}
              </span>
            ))}
          </p>
        )}
        <button className="btn primary" onClick={onNext}>
          ต่อไป
        </button>
      </div>
    </div>
  );
}

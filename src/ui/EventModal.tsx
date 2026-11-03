import { useEffect, useState, type CSSProperties } from "react";
import { loc } from "../engine/util";
import { currentScene, labelOf, lockedChoices, visibleChoices, type Outcome } from "../engine/events";
import { choiceChance, choiceFactors } from "../engine/game";
import type { Life } from "../engine/types";
import { isRealistic } from "../content/worlds";
import { Icon, noEmoji } from "./Icon";
import { FateScene } from "./Astral";

/** พิมพ์ข้อความทีละตัว แตะเพื่อข้าม */
function useTypewriter(text: string, instant: boolean, speed = 18) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (instant) { setN(text.length); return; }
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
  }, [text, speed, instant]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) };
}

const readInstant = () => { try { return !!localStorage.getItem("ls.instantText"); } catch { return false; } };

/** โอกาสแบบคร่าวๆ เมื่อตัวละครยังมีข้อมูลไม่พอ — ไม่โชว์ตัวเลขที่แม่นเกินจริง */
const vagueLabel = (p: number) => (p >= 0.7 ? "สูง" : p >= 0.4 ? "กลาง" : "ต่ำ");

export function EventModal({ life, onChoose }: { life: Life; onChoose: (index: number) => void }) {
  const q = life.queue[0];
  const scene = currentScene(q, life)!;
  const text = noEmoji(loc(life, scene.text(life, q.ctx)));
  const [instant, setInstant] = useState(readInstant);
  const { shown, done, skip } = useTypewriter(text, instant);
  // ตัวเลือกที่กดได้ก่อน แล้วตามด้วยตัวที่ยังขาดเงื่อนไข (ล็อกไว้พร้อมเหตุผล) ตามลำดับเดิม
  const choices = [...visibleChoices(life, q), ...lockedChoices(life, q)].sort((a, b) => a.index - b.index);
  const [factorsOf, setFactorsOf] = useState<number>();
  useEffect(() => setFactorsOf(undefined), [text]);
  // คีย์บอร์ด: 1-9 เลือกตัวเลือก · Enter หรือเว้นวรรคข้ามข้อความ
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.repeat || ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if ((ev.key === "Enter" || ev.key === " ") && !done) { ev.preventDefault(); skip(); return; }
      const c = choices[Number(ev.key) - 1];
      if (done && c && !c.c.req?.(life, q.ctx)) onChoose(c.index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="overlay modal-overlay">
      <div className={`modal ${scene.system && !isRealistic(life.worldId) ? "sys-modal" : ""}`} onClick={skip}>
        {life.worldId === "fantasy" && <FateScene id={q.eventId} />}
        <div className="modal-body">
          <div className="modal-head">
            <span className="modal-age">อายุ {life.age} ปี</span>
            {scene.title && <h3>{noEmoji(scene.title)}</h3>}
            <button
              className={`text-speed ${instant ? "on" : ""}`}
              aria-pressed={instant}
              onClick={(ev) => {
                ev.stopPropagation();
                const next = !instant;
                setInstant(next);
                try { localStorage.setItem("ls.instantText", next ? "1" : ""); } catch { /* ไม่มี storage */ }
              }}
            >
              ข้อความทันที
            </button>
          </div>
          <p className="modal-text">{shown}</p>
          <div className={`choices ${done ? "in" : ""}`}>
            {choices.map(({ c, index }, n) => {
              const pct = choiceChance(life, q, index);
              const survive = c.survival?.(life, q.ctx);
              const missing = c.req?.(life, q.ctx);
              const vague = c.unknown?.(life, q.ctx);
              return (
                <button
                  key={index}
                  className={`choice ${c.tone ?? ""} ${missing ? "locked" : ""}`}
                  style={{ "--i": n } as CSSProperties}
                  disabled={!done || !!missing}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onChoose(index);
                  }}
                >
                  <span className="choice-main">
                    <span className="choice-label">{noEmoji(loc(life, labelOf(c, life, q.ctx)))}</span>
                    {missing && <span className="cons"><Icon name="lock" size={13} /> {missing}</span>}
                    {survive !== undefined && survive < 0.95 && (
                      <span className="warn">โอกาสรอดชีวิต {vague ? vagueLabel(survive) : `${Math.round(survive * 100)}%`}</span>
                    )}
                    {factorsOf === index && (
                      <span className="odds-factors">
                        {choiceFactors(life, q, index)?.map((f, i) => (
                          <span key={f.label} className={i > 0 ? (f.delta > 0 ? "up" : "down") : ""}>
                            {f.label} <b>{i > 0 && f.delta > 0 ? "+" : ""}{Math.round(f.delta * 100)}%</b>
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {pct !== undefined && (
                    <span className="pct" title={vague ? "ยังประเมินคู่ต่อสู้ไม่ได้" : undefined}>
                      <b>{vague ? vagueLabel(pct) : `${Math.round(pct * 100)}%`}</b>
                      <small>{vague ? "ประเมินไม่ได้" : "สำเร็จ"}</small>
                      {!vague && !missing && (
                        <i
                          className="odds-info"
                          role="button"
                          aria-label="ดูว่าอะไรขยับโอกาสนี้"
                          aria-expanded={factorsOf === index}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setFactorsOf(factorsOf === index ? undefined : index);
                          }}
                        >
                          i
                        </i>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onNext(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext]);
  return (
    <div className="overlay modal-overlay">
      <div className="modal">
        <div className="modal-body">
          {resolved.title && <h3>{noEmoji(resolved.title)}</h3>}
          <p className="modal-prompt">{noEmoji(resolved.prompt)}</p>
          <p className="modal-choice"><span className="modal-choice-label">ทางที่เลือก</span>{noEmoji(resolved.choice)}</p>
          {resolved.out.roll && (
            <p className="roll-row">
              <span className={`roll ${resolved.out.roll.ok ? "ok" : "fail"} ${resolved.out.roll.tier}`}>{TIER[resolved.out.roll.tier]}</span>
              <span className="roll-odds">โอกาส {Math.round(resolved.out.roll.p * 100)}%</span>
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
    </div>
  );
}

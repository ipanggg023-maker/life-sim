import { useEffect, useState } from "react";
import { currentScene, labelOf, visibleChoices, type Outcome } from "../engine/events";
import { choiceChance } from "../engine/game";
import type { Life } from "../engine/types";

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

export function EventModal({ life, onChoose }: { life: Life; onChoose: (index: number) => void }) {
  const q = life.queue[0];
  const scene = currentScene(q, life)!;
  const text = scene.text(life, q.ctx);
  const { shown, done, skip } = useTypewriter(text);
  const choices = visibleChoices(life, q);

  return (
    <div className="overlay modal-overlay">
      <div className={`modal ${scene.system ? "sys-modal" : ""}`} onClick={skip}>
        <div className="modal-head">
          <span className="modal-age">อายุ {life.age} ปี</span>
          {scene.title && <h3>{scene.title}</h3>}
        </div>
        <p className="modal-text">{shown}</p>
        <div className={`choices ${done ? "in" : ""}`}>
          {choices.map(({ c, index }) => {
            const pct = choiceChance(life, q, index);
            const survive = c.survival?.(life, q.ctx);
            return (
              <button
                key={index}
                className={`choice ${c.tone ?? ""}`}
                disabled={!done}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onChoose(index);
                }}
              >
                <span>{labelOf(c, life, q.ctx)}</span>
                {survive !== undefined && survive < 0.95 && <span className="warn">[คำเตือน: อัตรารอดชีวิต {Math.round(survive * 100)}%]</span>}
                {pct !== undefined && <span className="pct">สำเร็จ {Math.round(pct * 100)}%</span>}
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

export function OutcomeModal({ resolved, onNext }: { resolved: Resolved; onNext: () => void }) {
  return (
    <div className="overlay modal-overlay">
      <div className="modal">
        {resolved.title && <h3>{resolved.title}</h3>}
        <p className="modal-prompt">{resolved.prompt}</p>
        <p className="modal-choice">➜ {resolved.choice}</p>
        <p className={`modal-outcome ${resolved.out.kind ?? ""}`}>{resolved.out.text}</p>
        <button className="btn primary" onClick={onNext}>
          ต่อไป
        </button>
      </div>
    </div>
  );
}

// M17 — รวม event ของระบบประจำยุทธภพ
import type { Choice, GameEvent } from "../../engine/events";
import type { Life } from "../../engine/types";
import { gainExp } from "../hunter/power";
import "./m17core";
import { M17_ALIGN } from "./m17align";
import { M17_LEDGER } from "./m17ledger";
import { M17_LIFE } from "./m17life";
import { M17_RANK } from "./m17rank";
import { M17_SECT } from "./m17sect";

/** ผ่านเรื่องราวในยุทธภพมาแล้ว ฝีมือย่อมงอกงาม — ทุกการตัดสินใจได้ประสบการณ์เล็กน้อย
 *  (กันไม่ให้ event ใหม่จำนวนมากเบียด event เดิมที่ให้ EXP จนเส้นทางสู่เซียนช้าลง) */
const lifeExp = (l: Life) => 60 + (l.power?.rank ?? 0) * 45;

function withExp(c: Choice): Choice {
  return {
    ...c,
    run: (l, ctx, ok) => {
      const out = c.run(l, ctx, ok);
      if (l.alive && l.power) gainExp(l, lifeExp(l));
      return out;
    },
  };
}

const withLifeExp = (e: GameEvent): GameEvent => ({
  ...e,
  choices: e.choices?.map(withExp),
  scenes: e.scenes && Object.fromEntries(Object.entries(e.scenes).map(([k, s]) => [k, { ...s, choices: s.choices.map(withExp) }])),
});

export const M17_EVENTS: GameEvent[] = [...M17_RANK, ...M17_ALIGN, ...M17_LEDGER, ...M17_SECT, ...M17_LIFE].map(withLifeExp);

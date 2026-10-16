import { ACTIVITIES } from "../../engine/activities";
import { chance, randInt } from "../../engine/rng";
import { addMoney, addStat } from "../../engine/util";
import { CAREERS } from "../hunter/careers";
import { RETAINER, guildById } from "../hunter/power";

// อาชีพทั่วไปของโลกยุคปัจจุบันใช้ร่วมกันก่อนวันสิ้นโลก (หลังโลกพัง รายได้เหลือ 30%)

CAREERS.push({
  id: "survivor",
  name: "ผู้รอดชีวิตภาคสนาม",
  emoji: "☄️",
  minAge: 8,
  world: "apocalypse",
  titles: ["ผู้รอดชีวิตหน้าใหม่", "นักล่าเสบียง", "หัวหน้าทีมสำรวจ", "ผู้นำฐาน", "ตำนานแห่งวันสิ้นโลก"],
  baseSalary: 0,
  key: "health",
  dc: 0,
  needsPower: true,
  // เหรียญจากระบบตามระดับ
  salary: (life) => {
    const p = life.power;
    if (!p) return 0;
    return RETAINER[p.rank] * 0.5 * (guildById(p.guild)?.pay ?? 1) * (1 + 0.25 * ((life.job?.level ?? 1) - 1));
  },
});

ACTIVITIES.push(
  {
    id: "a_stockpile",
    world: "apocalypse",
    emoji: "📦",
    name: "ตุนเสบียง",
    desc: "เผื่อวันที่โลกไม่เหมือนเดิม…",
    minAge: 14,
    cost: 30_000,
    available: (l) => !l.flags.doomed && Number(l.flags.stockpile ?? 0) < 3,
    run: (l) => {
      addMoney(l, -30_000);
      l.flags.stockpile = Number(l.flags.stockpile ?? 0) + 1;
      return { text: "คุณซื้ออาหารกระป๋อง น้ำ และไฟฉายมาเก็บไว้ใต้เตียง เพื่อนหัวเราะว่าคุณคิดมาก", kind: "normal" };
    },
  },
  {
    id: "a_scavenge",
    world: "apocalypse",
    emoji: "🎒",
    name: "ค้นซากเมือง",
    desc: "หาของมีค่า เสี่ยงบาดเจ็บ",
    minAge: 10,
    available: (l) => !!l.flags.doomed && !l.flags.rebuilt,
    run: (l) => {
      if (chance(l, 0.6 + l.stats.luck / 300)) {
        const m = randInt(l, 2, 8) * 10_000;
        addMoney(l, m);
        return { text: "คุณขุดเจออาหารกระป๋องและแบตเตอรี่ในซากร้านสะดวกซื้อ เอาไปแลกเหรียญได้", kind: "good" };
      }
      addStat(l, "health", -randInt(l, 5, 12));
      return { text: "พื้นตึกถล่มใต้เท้า คุณกลับฐานมาพร้อมแผลที่ขา", kind: "bad" };
    },
  },
);

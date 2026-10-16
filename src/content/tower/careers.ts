import { ACTIVITIES } from "../../engine/activities";
import { chance, randInt } from "../../engine/rng";
import { addFame, addMoney, addStat } from "../../engine/util";
import { CAREERS } from "../hunter/careers";
import { RETAINER, guildById } from "../hunter/power";

// ───────────────────────── อาชีพในโลกหอคอย ─────────────────────────
// อาชีพทั่วไปของโลกยุคปัจจุบัน (พนักงาน หมอ ครู …) ใช้ร่วมกับโลก Hunter อยู่แล้ว

CAREERS.push(
  {
    id: "climber",
    name: "ผู้ท้าชิงหอคอย",
    emoji: "🗼",
    minAge: 10,
    world: "tower",
    titles: ["ผู้ท้าชิงหน้าใหม่", "ผู้ท้าชิง", "ผู้ท้าชิงระดับสูง", "ผู้ท้าชิงแนวหน้า", "ตำนานแห่งหอคอย"],
    baseSalary: 0,
    key: "health",
    dc: 0,
    needsPower: true,
    // ค่าตอบแทนจากหอคอย + เงินจากสปอนเซอร์ภายนอก ตามระดับ
    salary: (life) => {
      const p = life.power;
      if (!p) return 0;
      return RETAINER[p.rank] * 0.6 * (guildById(p.guild)?.pay ?? 1) * (1 + 0.25 * ((life.job?.level ?? 1) - 1));
    },
  },
  {
    id: "tower_caster",
    name: "นักพากย์ถ่ายทอดสดหอคอย",
    emoji: "🎙️",
    minAge: 18,
    world: "tower",
    titles: ["ผู้ช่วยพากย์", "นักพากย์", "นักพากย์ชื่อดัง", "เสียงแห่งหอคอย", "ตำนานนักพากย์"],
    baseSalary: 260_000,
    key: "looks",
    dc: 50,
    salary: (l, b) => b * (1 + Math.max(0, l.fame) / 25),
  },
  {
    id: "tower_researcher",
    name: "นักวิจัยหอคอย",
    emoji: "🔬",
    minAge: 22,
    world: "tower",
    titles: ["ผู้ช่วยวิจัย", "นักวิจัย", "นักวิจัยอาวุโส", "หัวหน้าโครงการ", "ผู้อำนวยการสถาบันหอคอย"],
    baseSalary: 420_000,
    key: "smarts",
    dc: 62,
    anyDegree: true,
    mundaneOnly: true,
  },
);

ACTIVITIES.push(
  {
    id: "t_watch",
    world: "tower",
    emoji: "📺",
    name: "ดูถ่ายทอดสดหอคอย",
    desc: "ความสุข + อาจได้แรงบันดาลใจ",
    minAge: 6,
    run: (l) => {
      addStat(l, "happiness", randInt(l, 2, 5));
      if (!l.power && chance(l, 0.2)) {
        addStat(l, "luck", 1);
        return { text: "คุณดูผู้ท้าชิงหน้าใหม่ล้มผู้คุมชั้นได้ทั้งที่ทุกคนพนันว่าแพ้ — คืนนั้นคุณนอนไม่หลับ", kind: "good" };
      }
      return { text: "คุณนั่งดูการปีนหอคอยสดจนตีสาม เชียร์จนเสียงแหบ", kind: "good" };
    },
  },
  {
    id: "t_bet",
    world: "tower",
    emoji: "🎲",
    name: "พนันผลบททดสอบ",
    desc: "เสี่ยงได้เสี่ยงเสีย",
    minAge: 20,
    cost: 20_000,
    run: (l) => {
      if (chance(l, 0.25 + l.stats.luck / 400)) {
        addMoney(l, 60_000);
        return { text: "ม้ามืดที่คุณแทงผ่านชั้นได้จริง! ได้เงินสามเท่า", kind: "good" };
      }
      addMoney(l, -20_000);
      return { text: "ทีมที่คุณแทงตกรอบตั้งแต่ด่านแรก", kind: "bad" };
    },
  },
  {
    id: "t_fan",
    world: "tower",
    emoji: "📣",
    name: "ไลฟ์คุยกับแฟนๆ",
    desc: "ชื่อเสียง + (ผู้ท้าชิงเท่านั้น)",
    minAge: 12,
    available: (l) => !!l.power,
    run: (l) => {
      addFame(l, randInt(l, 1, 4));
      return { text: "คุณไลฟ์จากห้องพักชั้นปลอดภัย คนดูพร้อมกันหลายหมื่นคน", kind: "good" };
    },
  },
);

// Focus ประจำปี: เลือกว่าปีนี้ทุ่มให้อะไร — เกมทำกิจกรรม "ที่ปลอดภัย" ให้อัตโนมัติ
// ไม่ทำอะไรเสี่ยงตายแทนผู้เล่น: Gate/ภารกิจอัตโนมัติจะเลือกเฉพาะระดับที่อัตรารอดสูงมาก
import { doActivity } from "../../engine/activities";
import { studyHard, workHard, yearHooks } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp, log, money, people } from "../../engine/util";
import { canEnterGate, train } from "../hunter/events/gates";
import { RANKS, fightOdds, gateRewards, survivalOdds } from "../hunter/power";
import { worldOf } from "../worlds";

export type Focus = "power" | "money" | "love" | "study" | "secret" | "rest";

export const FOCUSES: { id: Focus; emoji: string; name: string; desc: string }[] = [
  { id: "power", emoji: "⚔️", name: "ฝึกพลัง", desc: "ฝึกและออกภารกิจที่ปลอดภัยให้อัตโนมัติ" },
  { id: "money", emoji: "💰", name: "หาเงิน", desc: "ทุ่มเททำงานและหารายได้เสริม" },
  { id: "love", emoji: "💕", name: "ความรัก", desc: "ใช้เวลากับคนสำคัญ หาคู่ถ้ายังโสด" },
  { id: "study", emoji: "📚", name: "เรียน", desc: "ตั้งใจเรียนและอ่านหนังสือ" },
  { id: "secret", emoji: "🕵️", name: "สืบความลับ", desc: "เหตุการณ์สำคัญและวาสนาเกิดบ่อยขึ้น" },
  { id: "rest", emoji: "😌", name: "พักผ่อน", desc: "ฟื้นฟูสุขภาพและความสุข" },
];

export const focusOf = (l: Life) => (l.flags.focus as Focus | undefined) ?? undefined;

const DATING: Record<string, string> = { hunter: "dating", murim: "m_matchmaker", court: "c_letter" };
const READ: Record<string, string> = { hunter: "read", murim: "m_read", court: "c_library" };

/** ภารกิจอัตโนมัติ: ไม่มีฉากให้เลือก แต่ทำเฉพาะระดับที่ปลอดภัยเท่านั้น */
function autoQuests(l: Life) {
  if (!l.power) return;
  let done = 0;
  let earned = 0;
  for (let i = 0; i < 3; i++) {
    let r = -1;
    for (let k = Math.min(l.power.rank + 1, RANKS.length - 1); k >= 0; k--) {
      if (!canEnterGate(l, k) && survivalOdds(l, k) >= 0.97 && fightOdds(l, k) >= 0.8) {
        r = k;
        break;
      }
    }
    if (r < 0) break;
    l.doneThisYear.push("gate");
    const before = l.money;
    gateRewards(l, r, 0.6, chance(l, fightOdds(l, r)));
    earned += l.money - before;
    done++;
  }
  if (done) log(l, `[Focus ⚔️] ออก${worldOf(l.worldId).labels.raid}ที่ปลอดภัย ${done} ครั้ง ได้ ${money(l, earned)}`, "good");
}

function applyFocus(l: Life) {
  const f = focusOf(l);
  if (!f || l.age < 6) return;
  switch (f) {
    case "power":
      if (l.power) {
        train(l);
        autoQuests(l);
      } else addStat(l, "health", randInt(l, 1, 3));
      break;
    case "money":
      if (l.job) workHard(l);
      if (l.age >= 15) addMoney(l, Math.round(randInt(l, 10, 30) * 1000 * (1 + l.stats.luck / 100)));
      break;
    case "love": {
      const loved = [...people(l, "spouse"), ...people(l, "partner")];
      for (const p of loved) p.bond = clamp(p.bond + randInt(l, 4, 8), 0, 100);
      for (const p of l.people) if (p.alive && ["father", "mother", "child", "sibling"].includes(p.relation)) p.bond = clamp(p.bond + 2, 0, 100);
      if (!loved.length && l.age >= 16) doActivity(l, DATING[l.worldId] ?? "dating");
      addStat(l, "happiness", 2);
      break;
    }
    case "study":
      if (l.education.stage !== "none" && l.education.stage !== "done") studyHard(l);
      else doActivity(l, READ[l.worldId] ?? "read");
      break;
    case "secret":
      if (chance(l, 0.3)) addStat(l, "luck", 1);
      break;
    case "rest":
      addStat(l, "health", randInt(l, 1, 3));
      addStat(l, "happiness", randInt(l, 2, 5));
      break;
  }
}

yearHooks.push(applyFocus);

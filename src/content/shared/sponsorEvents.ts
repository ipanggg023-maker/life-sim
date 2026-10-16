// ผู้สนับสนุน (ดวงดาว): ใช้ร่วมกันในโลกหอคอยและวันสิ้นโลก
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp } from "../hunter/power";
import { SPONSORS, sponsorOf } from "../sponsors";
import { worldOf } from "../worlds";

const meh = (text: string): Outcome => ({ text });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const foe = (l: Life, d = 0) => clamp((l.power?.rank ?? 0) + d, 0, 8);

/** ทำอาชีพออกภารกิจอยู่ */
const questing = (l: Life) => !!l.power && worldOf(l.worldId).questJobs.includes(l.job?.careerId ?? "");
/** ถึงจุดที่ดวงดาวเริ่มสนใจ: หอคอยชั้น 5 · วันสิ้นโลกผ่านฉากหลักแรก */
const noticed = (l: Life) =>
  (l.worldId === "tower" && Number(l.flags.floor ?? 0) >= 5) || (l.worldId === "apocalypse" && Number(l.flags.mainScenario ?? 0) >= 1);

function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

export const SPONSOR_EVENTS: GameEvent[] = [
  {
    id: "sponsor.first",
    minAge: 10,
    maxAge: 80,
    weight: 30,
    when: (l) => questing(l) && !l.flags.sponsor && noticed(l),
    title: "ดวงดาวจับตามอง",
    system: true,
    prepare: (l) => {
      const pool = [...SPONSORS];
      const pickN: string[] = [];
      for (let i = 0; i < 3; i++) pickN.push(pool.splice(randInt(l, 0, pool.length - 1), 1)[0].id);
      return { offer: pickN.join(",") };
    },
    text: () => "[ระบบ] ดวงดาวหลายดวงสนใจเส้นทางของคุณ — ผู้สนับสนุนต่อไปนี้ยื่นข้อเสนอ (เลือกได้หนึ่งเดียว)",
    choices: [
      ...SPONSORS.map((s) => ({
        label: `✨ ${s.name} — ชอบ${s.likes} (${s.desc})`,
        show: (_l: Life, c: Record<string, string | number | boolean>) => String(c.offer).split(",").includes(s.id),
        run: (l: Life): Outcome => {
          l.flags.sponsor = s.id;
          return { text: `[ระบบ] ดวงดาว '${s.name}' กลายเป็นผู้สนับสนุนของคุณ (${s.desc})`, kind: "system" };
        },
      })),
      { label: "ไม่รับใครทั้งนั้น", run: (l: Life) => { l.flags.sponsor = "none"; addFame(l, 2); return meh("[ระบบ] ดวงดาวทั้งหลายเงียบไป… บางดวงดูจะชอบคุณมากขึ้นด้วยซ้ำ"); } },
    ],
  },
  {
    id: "sponsor.gift",
    minAge: 10,
    maxAge: 90,
    maxTimes: 0,
    when: (l) => !!sponsorOf(l),
    weight: 7,
    system: true,
    text: (l) => {
      const s = sponsorOf(l)!;
      return pick(l, [
        `[ดวงดาว '${s.name}' ชอบการต่อสู้ครั้งล่าสุดของคุณ และส่งเหรียญมาให้]`,
        `[ดวงดาว '${s.name}' หัวเราะกับคำพูดของคุณ — ได้รับของขวัญ]`,
        `[ดวงดาว '${s.name}' ร้องไห้ให้ฉากเมื่อวาน และส่งเหรียญมาเยอะเกินจำเป็น]`,
      ]);
    },
    auto: (l) => {
      addMoney(l, randInt(l, 1, 5) * 100_000 * (1 + (l.power?.rank ?? 0) / 2));
      if (l.power) gainExp(l, 200);
      return "good";
    },
  },
  {
    id: "sponsor.demand",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    when: (l) => !!sponsorOf(l) && !!l.power,
    title: "คำขอของดวงดาว",
    system: true,
    text: (l) => `[ดวงดาว '${sponsorOf(l)!.name}' ต้องการให้คุณ${pick(l, ["ท้าดวลผู้ท้าชิงที่แข็งแกร่งที่สุดในชั้น", "ปีนต่อทั้งที่บาดเจ็บ", "ทิ้งเพื่อนร่วมทีมที่ถ่วงคุณ"])} — ถ้าทำ จะได้รางวัลพิเศษ]`,
    choices: [
      {
        label: "ทำตาม",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l, 1)),
        run: (l, _c, ok) => {
          if (ok) { luckyRankUp(l, `[ดวงดาว '${sponsorOf(l)!.name}' พอใจมาก] พลังถูกยกระดับ`); return { text: "ดวงดาวทั้งหอคอยส่งเสียงเชียร์ — คุณได้รางวัลที่ผู้ท้าชิงหลายคนรอทั้งชีวิต", kind: "milestone" }; }
          return bad(`คุณล้มเหลวต่อหน้าดวงดาวนับพัน${hurt(l, 10, 20, "บาดเจ็บขณะทำตามคำขอของดวงดาว")}`);
        },
      },
      {
        label: "ปฏิเสธ",
        run: (l) => {
          if (chance(l, 0.4)) { const s = sponsorOf(l)!; l.flags.sponsor = "none"; return bad(`[ดวงดาว '${s.name}' ผิดหวัง และถอนการสนับสนุน]`); }
          addFame(l, 2);
          return meh("[ดวงดาวเงียบไปพักหนึ่ง แล้วส่งข้อความสั้นๆ มาว่า 'น่าสนใจ']");
        },
      },
    ],
  },
];

// ภารกิจลับจากระบบ: ระบบสั่งงานแปลกๆ พร้อมเส้นตาย
// รับแล้วทำสำเร็จ = รางวัลใหญ่ · หมดเวลา = โดนลงโทษ · ปฏิเสธได้แต่ระบบจะจำไว้
import type { GameEvent } from "../../engine/events";
import { yearHooks } from "../../engine/game";
import { pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, log, money, people } from "../../engine/util";
import { gainExp, luckyRankUp } from "../hunter/power";
import { worldOf } from "../worlds";
import { nemesisOf } from "./nemesis";

interface SecretQuest {
  id: string;
  /** คำสั่งของระบบ (n = ค่าเป้าหมายที่สุ่มตอนรับภารกิจ) */
  text: (l: Life, n: number) => string;
  years: number;
  /** ภารกิจนี้เหมาะกับชีวิตตอนนี้ไหม */
  fits: (l: Life) => boolean;
  /** ค่าตั้งต้นตอนรับภารกิจ — ใช้วัดความคืบหน้า */
  start: (l: Life) => number;
  /** เป้าหมาย (สุ่มตอนรับ) */
  goal: (l: Life, start: number) => number;
  /** ค่าปัจจุบัน */
  now: (l: Life) => number;
}

const raid = (l: Life) => worldOf(l.worldId).labels.raid;
/** ภารกิจต่อสู้ให้เฉพาะคนที่ทำอาชีพออกภารกิจอยู่ (บุกได้เองจากแท็บพลัง) */
const questing = (l: Life) => !!l.power && worldOf(l.worldId).questJobs.includes(l.job?.careerId ?? "");

const QUESTS: SecretQuest[] = [
  {
    id: "raids",
    text: (l, n) => `ทำ${raid(l)}ให้สำเร็จจนครบ ${n} ครั้ง`,
    years: 3,
    fits: questing,
    start: (l) => l.power!.gates,
    goal: (l, s) => s + randInt(l, 2, 4),
    now: (l) => l.power?.gates ?? 0,
  },
  {
    id: "boss",
    text: () => "ปราบบอสให้ได้ 1 ตัว",
    years: 3,
    fits: questing,
    start: (l) => l.power!.bossKills,
    goal: (_l, s) => s + 1,
    now: (l) => l.power?.bossKills ?? 0,
  },
  {
    id: "money",
    text: (l, n) => `สะสมเงินให้ถึง ${money(l, n)}`,
    years: 3,
    fits: (l) => l.age >= 16,
    start: (l) => Math.max(0, l.money),
    goal: (_l, s) => Math.round((s * 1.3 + 150_000) / 10_000) * 10_000,
    now: (l) => l.money,
  },
  {
    id: "body",
    text: (_l, n) => `ทำให้ร่างกายแข็งแรงถึงระดับ ${n}`,
    years: 3,
    fits: (l) => l.stats.health < 85,
    start: (l) => l.stats.health,
    goal: (l, s) => Math.min(95, s + randInt(l, 5, 9)),
    now: (l) => l.stats.health,
  },
  {
    id: "mind",
    text: (_l, n) => `พัฒนาสติปัญญาให้ถึงระดับ ${n}`,
    years: 3,
    fits: (l) => l.stats.smarts < 88,
    start: (l) => l.stats.smarts,
    goal: (l, s) => Math.min(98, s + randInt(l, 4, 7)),
    now: (l) => l.stats.smarts,
  },
  {
    id: "bond",
    text: () => "ทำให้ใครสักคนผูกพันกับคุณจนถึงระดับ 90",
    years: 3,
    fits: (l) => l.people.some((p) => p.alive && p.bond < 90),
    start: () => 0,
    goal: () => 90,
    now: (l) => Math.max(0, ...l.people.filter((p) => p.alive).map((p) => p.bond)),
  },
  {
    id: "love",
    text: () => "หาคนรักให้ได้",
    years: 3,
    fits: (l) => l.age >= 16 && !people(l, "partner").length && !people(l, "spouse").length,
    start: () => 0,
    goal: () => 1,
    now: (l) => people(l, "partner").length + people(l, "spouse").length,
  },
  {
    id: "promote",
    text: () => "เลื่อนตำแหน่งในหน้าที่การงานให้ได้",
    years: 3,
    fits: (l) => !!l.job && l.job.level < 5,
    start: (l) => l.job!.level,
    goal: (_l, s) => s + 1,
    now: (l) => l.job?.level ?? 0,
  },
  {
    id: "nemesis",
    text: () => "เอาชนะคู่ปรับของคุณให้ได้",
    years: 4,
    fits: (l) => !!nemesisOf(l) && l.flags.nemesisStage !== "friend",
    start: (l) => Number(l.flags.nemScore ?? 0),
    goal: (_l, s) => s + 1,
    now: (l) => Number(l.flags.nemScore ?? 0),
  },
];

const questById = (id: unknown) => QUESTS.find((q) => q.id === id);
const active = (l: Life) => questById(l.flags.sqId);

/** รางวัลภารกิจ — ยิ่งยากยิ่งดี และมีลุ้นของใหญ่ */
function reward(l: Life) {
  const roll = randInt(l, 1, 100);
  if (l.power && roll <= 25) {
    luckyRankUp(l, "[ระบบ] รางวัลภารกิจลับ: พลังถูกยกระดับ");
    return;
  }
  if (l.power && roll <= 60) {
    gainExp(l, 1200 + l.power.level * 40);
    log(l, "[ระบบ] รางวัลภารกิจลับ: EXP ก้อนใหญ่", "system");
    return;
  }
  const stat = pick(l, ["health", "smarts", "looks", "luck"] as const);
  addStat(l, stat, randInt(l, 6, 10));
  const cash = Math.round(Math.max(100_000, l.money * 0.15) / 1000) * 1000;
  addMoney(l, cash);
  log(l, `[ระบบ] รางวัลภารกิจลับ: ค่าสถานะเพิ่มขึ้นถาวร และได้รับ ${money(l, cash)}`, "system");
}

/** บทลงโทษเมื่อหมดเวลา */
function punish(l: Life) {
  const roll = randInt(l, 1, 3);
  if (roll === 1) {
    addStat(l, "health", -randInt(l, 10, 18));
    log(l, "[ระบบ] ภารกิจล้มเหลว — บทลงโทษ: ความเจ็บปวดแล่นไปทั่วร่างสามวันสามคืน", "bad");
  } else if (roll === 2) {
    addStat(l, "happiness", -15);
    addStat(l, "luck", -4);
    log(l, "[ระบบ] ภารกิจล้มเหลว — บทลงโทษ: โชคของคุณถูกริบไปบางส่วน", "bad");
  } else {
    addMoney(l, -Math.round(Math.max(0, l.money) * 0.2));
    log(l, "[ระบบ] ภารกิจล้มเหลว — บทลงโทษ: ทรัพย์สินถูกยึด 20%", "bad");
  }
}

/** ตรวจภารกิจทุกปี (และหลังเลือกในฉาก — ดูปุ่มในแท็บพลังได้) */
export function checkSecretQuest(l: Life) {
  const q = active(l);
  if (!q || !l.alive) return;
  if (q.now(l) >= Number(l.flags.sqGoal)) {
    log(l, `[ระบบ] ภารกิจลับสำเร็จ: ${q.text(l, Number(l.flags.sqGoal))}`, "system");
    clearQuest(l);
    l.flags.sqDone = Number(l.flags.sqDone ?? 0) + 1;
    reward(l);
    return;
  }
  if (l.age >= Number(l.flags.sqDeadline)) {
    clearQuest(l);
    punish(l);
  }
}

function clearQuest(l: Life) {
  delete l.flags.sqId;
  delete l.flags.sqGoal;
  delete l.flags.sqDeadline;
  l.flags.sqLast = l.age;
}

/** สรุปภารกิจที่ทำอยู่ สำหรับแสดงผล */
export function secretQuestStatus(l: Life): { text: string; progress: string; left: number } | undefined {
  const q = active(l);
  if (!q) return;
  const goal = Number(l.flags.sqGoal);
  const now = q.now(l);
  const progress = q.id === "money" ? `${money(l, now)} / ${money(l, goal)}` : `${now} / ${goal}`;
  return { text: q.text(l, goal), progress, left: Number(l.flags.sqDeadline) - l.age };
}

yearHooks.push(checkSecretQuest);

export const SECRET_QUEST_EVENTS: GameEvent[] = [
  {
    id: "system.secret_quest",
    minAge: 12,
    maxAge: 70,
    maxTimes: 0,
    system: true,
    weight: (l) => (!active(l) && l.age - Number(l.flags.sqLast ?? 0) >= 3 && QUESTS.some((q) => q.fits(l)) ? (l.power ? 9 : 5) : 0),
    prepare: (l) => {
      const q = pick(l, QUESTS.filter((x) => x.fits(l)));
      const goal = q.goal(l, q.start(l));
      return { id: q.id, goal };
    },
    text: (l, c) => {
      const q = questById(c.id)!;
      return `[ภารกิจลับ] ${q.text(l, Number(c.goal))} ภายใน ${q.years} ปี\nรางวัล: ???\nบทลงโทษเมื่อล้มเหลว: มีอยู่จริง`;
    },
    choices: [
      {
        label: "ยอมรับภารกิจ",
        run: (l, c) => {
          const q = questById(c.id)!;
          l.flags.sqId = q.id;
          l.flags.sqGoal = Number(c.goal);
          l.flags.sqDeadline = l.age + q.years;
          return { text: `[ระบบ] รับภารกิจแล้ว — เหลือเวลา ${q.years} ปี`, kind: "system" };
        },
      },
      {
        label: "ปฏิเสธ",
        run: (l) => {
          l.flags.sqLast = l.age;
          return { text: "[ระบบ] …รับทราบ (หน้าต่างกระพริบเป็นสีแดงอยู่พักหนึ่งก่อนจะหายไป)", kind: "system" };
        },
      },
    ],
  },
];

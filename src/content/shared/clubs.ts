// M25 — ชมรมตั้งแต่ประถม: เข้าชมรม ซ้อมทุกปี ไต่ระดับ แข่งขัน + กิจกรรมวัยเด็ก (ทุกโลก ชื่อเปลี่ยนตามโทน)
import { ACTIVITIES } from "../../engine/activities";
import type { Choice, GameEvent, Outcome } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, StatKey } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, people, shortName } from "../../engine/util";
import { jailed, tone } from "./freedom";

type Kind = "sport" | "fight" | "art" | "mind";
interface Club {
  id: string;
  emoji: string;
  kind: Kind;
  /** ชื่อตามโทนโลก: [ปัจจุบัน, ซากเมือง, ยุทธภพ, ราชสำนัก] */
  names: [string, string, string, string];
  stat: StatKey;
  /** วิธีซ้อม 3 แบบ */
  drills: [string, string, string];
}

const CLUBS: Club[] = [
  { id: "football", emoji: "⚽", kind: "sport", names: ["ฟุตบอล", "ฟุตบอลลานฐาน", "เตะตะกร้อลูกหนัง", "ฟุตบอลของสถาบัน"], stat: "health", drills: ["วิ่งสปรินต์ขึ้นลงสนาม", "ฝึกเลี้ยงบอลหลบกรวย", "ซ้อมแผนกับทีม"] },
  { id: "basketball", emoji: "🏀", kind: "sport", names: ["บาสเกตบอล", "บาสห่วงยางรถ", "โยนห่วงไม้ไผ่", "บาสเกตบอลในโรงพลศึกษา"], stat: "health", drills: ["ชู้ตลูกโทษร้อยลูก", "ฝึกกระโดดและฟุตเวิร์ก", "เล่นเกมทีมสามต่อสาม"] },
  { id: "boxing", emoji: "🥊", kind: "fight", names: ["มวยไทย", "มวยเพื่อเอาตัวรอด", "มวยวัดเส้าหลิน", "ฟันดาบ"], stat: "health", drills: ["ต่อยกระสอบจนแขนล้า", "ฝึกหลบและป้องกัน", "ขึ้นสปาร์ริงกับรุ่นพี่"] },
  { id: "swim", emoji: "🏊", kind: "sport", names: ["ว่ายน้ำ", "ว่ายน้ำในอ่างเก็บน้ำ", "ว่ายน้ำในลำธาร", "ว่ายน้ำในทะเลสาบหลวง"], stat: "health", drills: ["ว่ายระยะไกลเพิ่มความอึด", "ฝึกท่ากลับตัว", "จับเวลาแข่งกับเพื่อน"] },
  { id: "athletics", emoji: "🏃", kind: "sport", names: ["กรีฑา", "วิ่งลาดตระเวน", "วิชาตัวเบาเบื้องต้น", "ขี่ม้า"], stat: "health", drills: ["วิ่งขึ้นเนิน", "ฝึกออกตัว", "วิ่งระยะไกลยามเช้า"] },
  { id: "music", emoji: "🎸", kind: "art", names: ["ดนตรี", "วงดนตรีรอบกองไฟ", "พิณและขลุ่ย", "วงออร์เคสตราของสถาบัน"], stat: "looks", drills: ["ซ้อมสเกลจนนิ้วล้า", "แกะเพลงที่ชอบ", "ซ้อมรวมวง"] },
  { id: "art", emoji: "🎨", kind: "art", names: ["ศิลปะ", "วาดกำแพงฐาน", "วาดภาพพู่กันจีน", "จิตรกรรม"], stat: "looks", drills: ["สเก็ตช์ทุกวัน", "ลองเทคนิคใหม่", "วาดงานใหญ่กับเพื่อน"] },
  { id: "drama", emoji: "🎭", kind: "art", names: ["การแสดง", "ละครให้เด็กในฐาน", "งิ้ว", "ละครเวที"], stat: "looks", drills: ["ท่องบทหน้ากระจก", "ฝึกออกเสียงและท่าทาง", "ซ้อมใหญ่ทั้งเรื่อง"] },
  { id: "chess", emoji: "♟️", kind: "mind", names: ["หมากรุก", "หมากรุกจากฝาขวด", "หมากล้อม", "หมากรุกของสถาบัน"], stat: "smarts", drills: ["ศึกษาเกมของปรมาจารย์", "เล่นเร็วสิบกระดาน", "ฝึกตาจบเกม"] },
  { id: "science", emoji: "🔬", kind: "mind", names: ["วิทยาศาสตร์และหุ่นยนต์", "ช่างซ่อมเครื่องจักร", "เล่นแร่ปรุงยา", "วิจัยเวทมนตร์"], stat: "smarts", drills: ["ทำการทดลองใหม่", "ประกอบโครงงาน", "อ่านตำราเกินหลักสูตร"] },
];

const clubById = (id: unknown) => CLUBS.find((c) => c.id === id);
const T = (l: Life) => ({ modern: 0, ruins: 1, murim: 2, court: 3 })[tone(l)];
const clubName = (l: Life, c: Club) => c.names[T(l)];
export const myClub = (l: Life) => clubById(l.flags.club);
export const clubLv = (l: Life) => Number(l.flags.clubLv ?? 0);
const xp = (l: Life) => Number(l.flags.clubXp ?? 0);

const RANKS: Record<Kind, string[]> = {
  sport: ["สมาชิกใหม่", "ตัวสำรอง", "ตัวจริง", "กัปตันทีม", "ตัวแทนภูมิภาค", "ทีมชาติเยาวชน"],
  fight: ["สมาชิกใหม่", "ขึ้นชกได้", "นักกีฬาประจำค่าย", "แชมป์รุ่น", "ตัวแทนภูมิภาค", "ทีมชาติเยาวชน"],
  art: ["สมาชิกใหม่", "ได้แสดงผลงาน", "ผลงานเด่นของชมรม", "ประธานชมรม", "รางวัลระดับภูมิภาค", "รางวัลระดับประเทศ"],
  mind: ["สมาชิกใหม่", "ตัวแทนห้อง", "ตัวแทนสถาบัน", "ประธานชมรม", "แชมป์ภูมิภาค", "แชมป์ประเทศ"],
};
export const clubRank = (l: Life) => { const c = myClub(l); return c ? RANKS[c.kind][clamp(clubLv(l), 0, 5)] : ""; };
const NEED = [3, 6, 10, 15, 21];

function gainClub(l: Life, n: number): string {
  const c = myClub(l);
  if (!c) return "";
  l.flags.clubXp = xp(l) + n;
  const lv = clubLv(l);
  if (lv < 5 && xp(l) >= NEED[lv]) {
    l.flags.clubLv = lv + 1;
    l.flags.clubBest = Math.max(Number(l.flags.clubBest ?? 0), lv + 1);
    return ` — เลื่อนเป็น「${RANKS[c.kind][lv + 1]}」!`;
  }
  return "";
}

const inSchoolAge = (l: Life) => l.age >= 6 && l.age <= 22;

// ───────────────────────── ปุ่มกิจกรรม ─────────────────────────

ACTIVITIES.push(
  {
    id: "club_join",
    emoji: "🏫",
    name: "ชมรม",
    desc: "เข้าหรือเปลี่ยนชมรม",
    minAge: 6,
    world: "all",
    available: (l) => !jailed(l) && (inSchoolAge(l) || l.age >= 23) && !myClub(l),
    run: (l) => { runEvent(l, "club.join"); return { text: "" }; },
  },
  {
    id: "club_practice",
    emoji: "🏅",
    name: "ซ้อมชมรม",
    desc: "ฝึกให้เก่งขึ้น",
    minAge: 6,
    world: "all",
    available: (l) => !jailed(l) && !!myClub(l),
    run: (l) => { runEvent(l, "club.practice"); return { text: "" }; },
  },
  {
    id: "kid_play",
    emoji: "🧒",
    name: "เล่นกับเพื่อน",
    desc: "ความสุข + เพื่อนใหม่",
    minAge: 4,
    world: "all",
    available: (l) => l.age <= 15,
    run: (l) => {
      addStat(l, "happiness", randInt(l, 3, 7));
      const games = { modern: ["เล่นซ่อนแอบ", "ปั่นจักรยานรอบหมู่บ้าน", "เตะบอลในซอย"], ruins: ["เล่นซ่อนแอบในซากรถ", "แข่งปีนกำแพงฐาน", "เก็บของเก่ามาแลกกัน"], murim: ["เล่นเป็นจอมยุทธ์ด้วยกิ่งไม้", "จับจิ้งหรีดมาชนกัน", "แข่งปีนต้นไม้"], court: ["เล่นเป็นอัศวินกับมังกร", "ซ่อนแอบในสวนวงกต", "ขี่ม้าไม้แข่งกัน"] }[tone(l)];
      if (chance(l, 0.3)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -1, 1), bond: 55 }); return { text: `คุณ${pick(l, games)}จนมืด — ได้เพื่อนใหม่ชื่อ${shortName(p)}`, kind: "good" }; }
      for (const p of people(l, "friend")) p.bond = Math.min(100, p.bond + 3);
      return { text: `คุณ${pick(l, games)}กับเพื่อนจนลืมเวลา`, kind: "good" };
    },
  },
  {
    id: "kid_chores",
    emoji: "🧹",
    name: "ช่วยงานบ้าน",
    desc: "พ่อแม่ชอบ ได้ค่าขนม",
    minAge: 5,
    world: "all",
    available: (l) => l.age <= 17,
    run: (l) => {
      for (const p of l.people) if (p.alive && (p.relation === "father" || p.relation === "mother")) p.bond = Math.min(100, p.bond + 5);
      addMoney(l, randInt(l, 1, 5) * 100);
      return { text: "คุณกวาดบ้าน ล้างจาน รดน้ำต้นไม้ — แม่แอบยิ้มแล้วให้ค่าขนมเพิ่ม", kind: "good" };
    },
  },
  {
    id: "kid_tutor",
    emoji: "✏️",
    name: "เรียนพิเศษ",
    desc: "สติปัญญา + เกรดดีขึ้น",
    minAge: 7,
    world: "all",
    available: (l) => l.age <= 18,
    run: (l) => {
      addStat(l, "smarts", randInt(l, 2, 4));
      addStat(l, "happiness", -2);
      if (l.education) l.education.grade = clamp(l.education.grade + randInt(l, 3, 8), 0, 100);
      return { text: tone(l) === "murim" ? "อาจารย์ประจำหมู่บ้านสอนอักษรเพิ่มให้ทุกเย็น" : tone(l) === "court" ? "ครูพิเศษสอนประวัติศาสตร์ราชวงศ์จนคุณจำได้ทุกชื่อ" : "คุณไปเรียนพิเศษหลังเลิกเรียน เหนื่อยแต่เกรดดีขึ้น", kind: "good" };
    },
  },
  {
    id: "kid_games",
    emoji: "🎮",
    name: "เล่นเกม/ดูการ์ตูน",
    desc: "ความสุข ++",
    minAge: 4,
    world: "all",
    available: (l) => l.age <= 17,
    run: (l) => {
      addStat(l, "happiness", randInt(l, 4, 8));
      if (chance(l, 0.2)) addStat(l, "health", -1);
      const t = { modern: "คุณเล่นเกมจนตีหนึ่ง แม่มาปิดไฟ", ruins: "คุณเล่นเกมบอยเก่าที่ถ่านใกล้หมดทั้งคืน", murim: "คุณแอบอ่านนิยายกำลังภายในใต้ผ้าห่ม", court: "คุณอ่านนิทานอัศวินจนเทียนหมดเล่ม" }[tone(l)];
      return { text: t, kind: "good" };
    },
  },
);

// ───────────────────────── ฉาก ─────────────────────────

const joinChoice = (c: Club): Choice => ({
  label: (l) => `${c.emoji} ${clubName(l, c)}`,
  run: (l) => {
    l.flags.club = c.id;
    l.flags.clubLv = 0;
    l.flags.clubXp = 0;
    l.flags.clubsJoined = Number(l.flags.clubsJoined ?? 0) + 1;
    if (chance(l, 0.5)) createPerson(l, "friend", { age: l.age + randInt(l, -1, 2), bond: 50, job: `เพื่อนชมรม${clubName(l, c)}` });
    return { text: `คุณเข้าชมรม${clubName(l, c)}${l.age >= 23 ? " (คลาสสำหรับผู้ใหญ่)" : ""} — ${pick(l, ["รุ่นพี่ยิ้มต้อนรับ", "โค้ชมองคุณตั้งแต่หัวจรดเท้า", "ทุกคนแนะนำตัวกันวุ่นวาย"])}`, kind: "good" };
  },
});

function practiceRun(i: number) {
  return (l: Life, _c: unknown, ok: boolean): Outcome => {
    const c = myClub(l)!;
    l.flags.clubPractice = Number(l.flags.clubPractice ?? 0) + 1;
    l.flags[`club_${c.id}`] = Number(l.flags[`club_${c.id}`] ?? 0) + 1;
    const physical = c.kind === "sport" || c.kind === "fight";
    if (i === 0) {
      // ซ้อมหนัก
      if (ok) { addStat(l, c.stat, randInt(l, 2, 4)); if (physical) addStat(l, "health", 2); return { text: `คุณ${c.drills[0]}จนหมดแรง ร่างกายจำได้แล้ว${gainClub(l, 3)}`, kind: "good" }; }
      if (physical && chance(l, 0.35)) { addStat(l, "health", -randInt(l, 4, 9)); return { text: `ซ้อมหนักเกินไป ${pick(l, ["ข้อเท้าพลิก", "กล้ามเนื้อฉีก", "หัวเข่าบวม"])} ต้องพักสองสัปดาห์${gainClub(l, 1)}`, kind: "bad" }; }
      return { text: `วันนี้ร่างกายไม่เป็นใจ แต่ก็ยังซ้อมจนจบ${gainClub(l, 1)}` };
    }
    if (i === 1) {
      // ซ้อมเทคนิค
      addStat(l, ok ? c.stat : "smarts", ok ? randInt(l, 1, 3) : 1);
      return ok ? { text: `คุณ${c.drills[1]} และเข้าใจอะไรบางอย่างที่โค้ชพูดมาตลอด${gainClub(l, 2)}`, kind: "good" } : { text: `คุณ${c.drills[1]}ซ้ำๆ แต่ยังไม่คลิก${gainClub(l, 1)}` };
    }
    // ซ้อมกับทีม
    addStat(l, "happiness", 3);
    for (const p of people(l, "friend")) if (p.job?.startsWith("เพื่อนชมรม")) p.bond = Math.min(100, p.bond + 6);
    if (chance(l, 0.25)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -1, 2), bond: 55, job: `เพื่อนชมรม${clubName(l, c)}` }); return { text: `คุณ${c.drills[2]} — ได้คู่หูใหม่ชื่อ${shortName(p)}${gainClub(l, 2)}`, kind: "good" }; }
    return { text: `คุณ${c.drills[2]} ทีมเข้าขากันขึ้นเรื่อยๆ${gainClub(l, ok ? 2 : 1)}`, kind: "good" };
  };
}

const drillOdds = (l: Life, base: number) => clamp(base + (l.stats[myClub(l)?.stat ?? "health"] - 50) / 120 + clubLv(l) * 0.03, 0.15, 0.95);

export const CLUB_EVENTS: GameEvent[] = [
  {
    id: "club.join",
    minAge: 0, maxAge: 200, manual: true, maxTimes: 0,
    title: "เลือกชมรม",
    text: (l) => (l.age >= 23 ? "ศูนย์กีฬาและศิลปะใกล้บ้านเปิดคลาสสำหรับผู้ใหญ่ — สนใจอะไรดี?" : "ใบสมัครชมรมวางเต็มโต๊ะในห้องเรียน เพื่อนๆ เลือกกันไปหมดแล้ว — คุณจะเข้าชมรมไหน?"),
    choices: [...CLUBS.map(joinChoice), { label: "ยังไม่เข้าตอนนี้", run: () => ({ text: "คุณเก็บใบสมัครใส่กระเป๋าไว้ก่อน" }) }],
  },
  {
    id: "club.practice",
    minAge: 0, maxAge: 200, manual: true, maxTimes: 0,
    title: "ซ้อม",
    text: (l) => { const c = myClub(l)!; return `ชมรม${clubName(l, c)} · ตำแหน่ง「${clubRank(l)}」— วันนี้จะซ้อมแบบไหน?`; },
    choices: [
      { label: (l) => `💪 ${myClub(l)!.drills[0]} (หนัก)`, odds: (l) => drillOdds(l, 0.5), run: practiceRun(0) },
      { label: (l) => `🎯 ${myClub(l)!.drills[1]} (เทคนิค)`, odds: (l) => drillOdds(l, 0.6), run: practiceRun(1) },
      { label: (l) => `🤝 ${myClub(l)!.drills[2]} (กับทีม)`, odds: (l) => drillOdds(l, 0.7), run: practiceRun(2) },
      { label: "🚪 ลาออกจากชมรม", run: (l) => { const c = myClub(l)!; delete l.flags.club; delete l.flags.clubLv; delete l.flags.clubXp; return { text: `คุณลาออกจากชมรม${clubName(l, c)} — จะกลับไปเลือกใหม่ก็ได้` }; } },
    ],
  },
  {
    id: "club.tourney",
    minAge: 6, maxAge: 40, weight: (l) => (myClub(l) && clubLv(l) >= 1 ? 22 : 0), maxTimes: 0,
    title: "การแข่งขัน",
    text: (l) => { const c = myClub(l)!; const lvl = ["ระหว่างห้อง", "ระหว่างโรงเรียน", "ระดับจังหวัด", "ระดับภูมิภาค", "ระดับประเทศ", "ระดับนานาชาติ"][clubLv(l)]; return `การแข่งขัน${clubName(l, c)}${lvl}มาถึง — คู่แข่งเตรียมตัวมาอย่างดี`; },
    choices: [
      {
        label: "เล่นเต็มที่ตามที่ซ้อมมา",
        odds: (l) => drillOdds(l, 0.45),
        run: (l, _c, ok) => {
          if (ok) {
            l.flags.clubWins = Number(l.flags.clubWins ?? 0) + 1;
            addStat(l, "happiness", 8);
            if (clubLv(l) >= 3) addFame(l, 2);
            if (clubLv(l) >= 4 && chance(l, 0.4)) { addMoney(l, 100_000); return { text: `🏆 ชนะเลิศ! มีแมวมองให้ทุนการศึกษา${gainClub(l, 3)}`, kind: "milestone" }; }
            return { text: `🏆 คุณชนะ! เพื่อนในชมรมโยนคุณขึ้นฟ้า${gainClub(l, 3)}`, kind: "good" };
          }
          addStat(l, "happiness", -4);
          return { text: `คุณแพ้อย่างสูสี โค้ชตบไหล่ \"ปีหน้าเอาใหม่\"${gainClub(l, 1)}`, kind: "bad" };
        },
      },
      {
        label: "ส่งบอล/บทเด่นให้เพื่อน เล่นเพื่อทีม",
        run: (l) => {
          for (const p of people(l, "friend")) if (p.job?.startsWith("เพื่อนชมรม")) p.bond = Math.min(100, p.bond + 10);
          addStat(l, "happiness", 4);
          return { text: `ทีมได้ที่สอง เพื่อนรักคุณมากขึ้น และโค้ชจดชื่อคุณไว้ในฐานะผู้นำ${gainClub(l, 2)}`, kind: "good" };
        },
      },
    ],
  },
  {
    id: "club.coach",
    minAge: 6, maxAge: 22, weight: (l) => (myClub(l) ? 6 : 0),
    title: "โค้ชคนใหม่",
    text: () => "ชมรมได้โค้ชคนใหม่ที่เข้มงวดสุดๆ — ซ้อมเช้าตีห้าทุกวัน",
    choices: [
      { label: "ซ้อมตามทุกวันไม่ขาด", run: (l) => ({ text: `สามเดือนต่อมาคุณกลายเป็นคนละคน${gainClub(l, 4)}`, kind: "good" }) },
      { label: "บ่นแต่ก็ไป", run: (l) => ({ text: `คุณไปบ้างไม่ไปบ้าง โค้ชยังจำชื่อคุณได้ (ในทางที่ไม่ดี)${gainClub(l, 1)}` }) },
    ],
  },
  {
    id: "club.rival",
    minAge: 8, maxAge: 22, weight: (l) => (myClub(l) && clubLv(l) >= 1 ? 6 : 0),
    title: "คู่ปรับต่างโรงเรียน",
    text: () => "เด็กจากโรงเรียนคู่แข่งเก่งพอๆ กับคุณ และพูดจาท้าทายทุกครั้งที่เจอ",
    choices: [
      { label: "ซ้อมหนักขึ้นเพื่อเอาชนะ", run: (l) => { createPerson(l, "rival", { age: l.age, bond: 20, job: "คู่ปรับต่างโรงเรียน" }); return { text: `คุณซ้อมหนักกว่าเดิมสองเท่า — มีคนให้ไล่ตามทำให้เก่งขึ้นเร็ว${gainClub(l, 3)}`, kind: "good" }; } },
      { label: "ชวนเป็นเพื่อน", run: (l) => { createPerson(l, "friend", { age: l.age, bond: 50, job: "เพื่อนต่างโรงเรียน" }); return { text: "เขางงไปพักหนึ่ง แล้วหัวเราะ — คู่แข่งที่ดีที่สุดคือเพื่อนที่ดีที่สุด", kind: "good" }; } },
    ],
  },
  {
    id: "club.injury",
    minAge: 8, maxAge: 30, weight: (l) => (myClub(l) && ["sport", "fight"].includes(myClub(l)!.kind) && clubLv(l) >= 2 ? 4 : 0),
    title: "บาดเจ็บก่อนแข่ง",
    text: () => "สองสัปดาห์ก่อนแข่งใหญ่ ข้อเท้าคุณบวมเป่ง หมอบอกให้พัก",
    choices: [
      { label: "พักตามหมอสั่ง", run: (l) => { addStat(l, "health", 3); return { text: "คุณพลาดการแข่ง แต่กลับมาแข็งแรงกว่าเดิม" }; } },
      { label: "ฝืนลงแข่ง", tone: "danger", check: { stat: "health", dc: 60 }, run: (l, _c, ok) => (ok ? { text: `คุณกัดฟันเล่นจนจบและชนะ! กลายเป็นตำนานของชมรม${gainClub(l, 4)}`, kind: "milestone" } : (addStat(l, "health", -15), { text: "อาการแย่ลง ต้องพักทั้งฤดูกาล", kind: "bad" })) },
    ],
  },
  {
    id: "club.scout",
    minAge: 13, maxAge: 22, weight: (l) => (myClub(l) && clubLv(l) >= 4 ? 10 : 0),
    title: "แมวมอง",
    text: (l) => `แมวมองจากทีมอาชีพ/สถาบันชั้นนำมาดูคุณเล่น${clubName(l, myClub(l)!)}`,
    choices: [
      { label: "ตอบรับ มุ่งสู่มืออาชีพ", run: (l) => { addMoney(l, 200_000); addFame(l, 4); l.flags.clubPro = true; return { text: "คุณได้สัญญาเยาวชนพร้อมเงินทุน — อนาคตในสายนี้เปิดกว้าง", kind: "milestone" }; } },
      { label: "ขอเรียนให้จบก่อน", run: (l) => { addStat(l, "smarts", 2); return { text: "แมวมองให้นามบัตรไว้ \"ประตูเปิดเสมอ\"" }; } },
    ],
  },
];

// ชมรมกีฬาให้สุขภาพทุกปี · ชมรมศิลปะให้ความสุข · ชมรมความคิดให้สติปัญญา (เล็กน้อย)
yearHooks.push((l) => {
  const c = myClub(l);
  if (!c || !l.alive) return;
  if (c.kind === "sport" || c.kind === "fight") addStat(l, "health", 1);
  else if (c.kind === "art") addStat(l, "happiness", 1);
  else if (chance(l, 0.5)) addStat(l, "smarts", 1);
  if (l.age === 23 && clubLv(l) >= 1 && !l.flags.clubAdultNote) {
    l.flags.clubAdultNote = true;
    log(l, `คุณจบการศึกษาแล้ว แต่ยังเล่น${clubName(l, c)}ต่อในคลาสผู้ใหญ่`, "normal");
  }
});

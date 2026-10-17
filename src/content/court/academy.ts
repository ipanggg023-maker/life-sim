// อะคาเดมี (M13): ช่วงวัยเรียนของโลกราชสำนัก — สถาบันจักรวรรดิ 5 ปี (อายุ 13–18)
// หอพัก · สอบจัดอันดับประจำปี (จาก 300 คน) · ตัวประกอบที่ควรตายในบทที่ 3 · พิธีจบการศึกษา
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, StatKey } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, people, shortName } from "../../engine/util";
import { fightOdds, gainExp, luckyRankUp, markTurn, rankLabel, survivalOdds } from "../hunter/power";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });
const sys = (text: string): Outcome => ({ text, kind: "system" });

export const STUDENTS = 300;
const role = (l: Life) => String(l.flags.role ?? "");
const hero = (l: Life) => (l.gender === "f" ? "ลิเซีย" : "ลิออน");
export const inAcademy = (l: Life) => !!l.flags.academy && !l.flags.acaGrad && !l.flags.acaExpelled && l.age >= 13 && l.age <= 18;
export const acaYear = (l: Life) => clamp(l.age - 12, 1, 5);
const rank = (l: Life) => l.power?.rank ?? -1;

// ───────────────────────── หอพัก ─────────────────────────

export const HOUSES = {
  lion: { name: "หอสิงโตทอง", emoji: "🦁", desc: "สายอัศวิน กล้าหาญ บ้าบิ่น", stat: "health" as StatKey },
  owl: { name: "หอนกฮูกเงิน", emoji: "🦉", desc: "สายจอมเวทและนักวิชาการ", stat: "smarts" as StatKey },
  rose: { name: "หอกุหลาบดำ", emoji: "🥀", desc: "ลูกหลานตระกูลใหญ่ เก่งเกมการเมือง", stat: "looks" as StatKey },
};
export type HouseId = keyof typeof HOUSES;
export const houseOf = (l: Life) => HOUSES[l.flags.acaHouse as HouseId] as (typeof HOUSES)[HouseId] | undefined;

/** แปลงคะแนนสอบเป็นอันดับ (ยิ่งสูงยิ่งยาก — ที่หนึ่งต้องโดดเด่นจริงๆ) */
function scoreToRank(score: number) {
  return clamp(Math.round(STUDENTS * Math.exp(-(score - 30) / 17)), 1, STUDENTS);
}

function examScore(l: Life, bonus: number) {
  const h = houseOf(l);
  const power = l.power ? rank(l) * 7 + l.power.level * 0.25 : 0;
  return l.stats.smarts * 0.6 + power + l.stats[h?.stat ?? "smarts"] * 0.15 + bonus + randInt(l, -10, 10);
}

function settleRank(l: Life, bonus: number): string {
  const before = Number(l.flags.acaRank ?? 0);
  const r = scoreToRank(examScore(l, bonus));
  l.flags.acaRank = r;
  l.flags.acaBest = Math.min(Number(l.flags.acaBest ?? STUDENTS), r);
  const diff = before ? (r < before ? ` (↑${before - r})` : r > before ? ` (↓${r - before})` : " (เท่าเดิม)") : "";
  if (r <= 10) addFame(l, r === 1 ? 8 : 4);
  if (r === 1) l.flags.acaTopYears = Number(l.flags.acaTopYears ?? 0) + 1;
  // นักเรียนทุนต้องรักษาอันดับ
  if (l.flags.scholarship && r > 200) {
    if (l.flags.acaWarned) {
      l.flags.acaExpelled = true;
      return `อันดับ ${r} / ${STUDENTS}${diff} — ทุนถูกตัด คุณต้องออกจากสถาบัน`;
    }
    l.flags.acaWarned = true;
    return `อันดับ ${r} / ${STUDENTS}${diff} — คำเตือน: ถ้าปีหน้ายังต่ำกว่า 200 ทุนจะถูกตัด`;
  }
  return `อันดับ ${r} / ${STUDENTS}${diff}${r === 1 ? " — ที่หนึ่งของทั้งชั้นปี!" : r <= 10 ? " — ติดสิบอันดับแรก ได้เข้าห้อง S" : ""}`;
}

const HOUSE_PICK: GameEvent = {
  id: "aca.house",
  minAge: 13,
  maxAge: 14,
  forced: true,
  when: (l) => inAcademy(l) && !l.flags.acaHouse,
  title: "พิธีคัดเลือกหอ",
  text: () => "ห้องโถงใหญ่ของสถาบันเต็มไปด้วยนักเรียนใหม่สามร้อยคน ลูกแก้วคัดเลือกส่องแสงสามสีตรงหน้าคุณ — มันจะฟังเสียงหัวใจของคุณ",
  choices: (Object.keys(HOUSES) as HouseId[]).map((id) => ({
    label: `${HOUSES[id].emoji} ${HOUSES[id].name} — ${HOUSES[id].desc}`,
    run: (l: Life): Outcome => {
      l.flags.acaHouse = id;
      addStat(l, HOUSES[id].stat, 2);
      return good(`ลูกแก้วเปล่งแสง — คุณเป็นนักเรียนแห่ง${HOUSES[id].name}`);
    },
  })),
};

const RANKING: GameEvent = {
  id: "aca.ranking",
  minAge: 14,
  maxAge: 18,
  forced: true,
  maxTimes: 0,
  when: (l) => inAcademy(l) && l.flags.acaExamAge !== l.age,
  title: "สอบจัดอันดับประจำปี",
  prepare: (l) => {
    l.flags.acaExamAge = l.age;
    return { y: acaYear(l) - 1 || 1 };
  },
  text: (l, c) => `สอบจัดอันดับปลายปีที่ ${c.y} — ผลจะประกาศบนกระดานกลางห้องโถงให้นักเรียนทั้ง ${STUDENTS} คนเห็น${l.flags.acaRank ? ` (ปีก่อนคุณได้อันดับ ${l.flags.acaRank})` : ""}`,
  choices: [
    {
      label: "ข้อเขียน: อ่านหนังสือทั้งเดือน",
      check: { stat: "smarts", dc: 55 },
      run: (l, _c, ok) => {
        addStat(l, "smarts", 1);
        return { text: `📜 ${ok ? "ปากกาไม่หยุดเขียนจนหมดเวลา" : "ข้อสุดท้ายคุณเขียนไม่ทัน"} — ${settleRank(l, ok ? 15 : 0)}`, kind: ok ? "good" : "normal" };
      },
    },
    {
      label: "สอบปฏิบัติ: ประลองเวท/ดาบต่อหน้ากรรมการ",
      show: (l) => !!l.power,
      odds: (l) => fightOdds(l, clamp(rank(l), 0, 8), 0.05),
      run: (l, _c, ok) => {
        if (ok) gainExp(l, 200);
        return { text: `⚔️ ${ok ? "กรรมการทั้งสามลุกขึ้นยืน" : "วงเวทของคุณแตกกลางการประลอง"} — ${settleRank(l, ok ? 20 : -5)}`, kind: ok ? "good" : "bad" };
      },
    },
    {
      label: "ใช้ความรู้จากโลกเก่า",
      tone: "special",
      show: (l) => !!l.flags.role,
      check: { stat: "smarts", dc: 45 },
      run: (l, _c, ok) => ({ text: `✨ ${ok ? "คุณตอบโจทย์ด้วยวิธีที่อาจารย์ไม่เคยเห็น" : "โลกนี้ใช้หลักการต่างจากโลกเก่า… บางข้อก็พลาด"} — ${settleRank(l, ok ? 25 : 0)}`, kind: ok ? "system" : "normal" }),
    },
    {
      label: "ซื้อข้อสอบจากรุ่นพี่",
      tone: "danger",
      check: { stat: "luck", dc: 55 },
      run: (l, _c, ok) => {
        addMoney(l, -50_000);
        if (ok) return { text: `🤫 ข้อสอบตรงทุกข้อ — ${settleRank(l, 30)}`, kind: "normal" };
        l.flags.acaRank = STUDENTS;
        addFame(l, -10);
        return bad("ถูกจับได้! ชื่อคุณอยู่ท้ายกระดาน และข่าวลือแพร่ไปทั่วสถาบัน");
      },
    },
  ],
};

const GRADUATION: GameEvent = {
  id: "aca.graduation",
  minAge: 18,
  maxAge: 18,
  forced: true,
  // คิวต่อจากสอบจัดอันดับของปีเดียวกัน (ถ้าถูกไล่ออกระหว่างสอบ จะหลุดจากคิวเอง)
  when: (l) => inAcademy(l) && l.age === 18,
  title: "พิธีจบการศึกษา",
  text: (l) => {
    const r = Number(l.flags.acaRank ?? STUDENTS);
    return r === 1
      ? "คุณยืนบนเวทีในฐานะ ผู้สำเร็จการศึกษาอันดับหนึ่ง — ตามธรรมเนียม ต้องกล่าวสุนทรพจน์ต่อหน้าจักรพรรดิ"
      : `พิธีจบการศึกษาของสถาบันจักรวรรดิ คุณจบด้วยอันดับ ${r} จาก ${STUDENTS} คน — หมวกปีกกว้างลอยขึ้นฟ้าพร้อมกันทั้งห้องโถง`;
  },
  choices: [
    {
      label: (l) => (Number(l.flags.acaRank) === 1 ? "กล่าวสุนทรพจน์จากใจ" : "โยนหมวกพร้อมเพื่อนๆ"),
      run: (l) => {
        l.flags.acaGrad = true;
        const r = Number(l.flags.acaRank ?? STUDENTS);
        l.education.highSchoolDone = true;
        if (r === 1) {
          l.flags.acaTop = true;
          addFame(l, 15);
          markTurn(l);
          return { text: "🎓 สุนทรพจน์ของคุณถูกจดบันทึกลงพงศาวดาร — ทุกสังกัดในจักรวรรดิยื่นข้อเสนอให้คุณ", kind: "milestone" };
        }
        if (r <= 10) { addFame(l, 6); return { text: "🎓 จบการศึกษาในสิบอันดับแรก — หอคอยเวทและกองอัศวินส่งจดหมายเชิญมาถึงบ้าน", kind: "milestone" }; }
        addStat(l, "happiness", 6);
        return { text: "🎓 คุณจบการศึกษาจากสถาบันจักรวรรดิ — ห้าปีที่ยาวนานที่สุดในชีวิตจบลงแล้ว", kind: "milestone" };
      },
    },
  ],
};

// ───────────────────────── ชีวิตในสถาบัน ─────────────────────────

const LIFE: GameEvent[] = [
  {
    id: "aca.chapter3",
    minAge: 14,
    maxAge: 16,
    weight: 30,
    when: (l) => inAcademy(l) && role(l) === "extra",
    title: "ตัวประกอบที่ควรตายในบทที่ 3",
    text: (l) => `วันนี้คือวันฝึกในดันเจี้ยนจำลอง — คุณจำได้ว่าในนิยาย นักเรียนชื่อ "${l.firstName}" ตายในฉากนี้ เพื่อให้${hero(l)}ได้ตื่นพลังจากความโกรธ ทั้งเรื่องมีชื่อคุณแค่บรรทัดเดียว`,
    choices: [
      {
        label: "ลาป่วย ไม่ไปฝึก",
        run: (l) => { l.flags.ch3Escaped = true; addStat(l, "happiness", -2); return sys(`คุณรอดจากบทที่ 3 — แต่${hero(l)}ไม่ได้ตื่นพลังตามเนื้อเรื่อง นิยายเริ่มเบี่ยงไปแล้ว`); },
      },
      {
        label: "ไป — แล้วใช้ความรู้จากนิยายเอาชนะกับดักก่อน",
        tone: "danger",
        odds: (l) => (l.power ? survivalOdds(l, clamp(rank(l) + 1, 0, 8)) : 0.45),
        survival: (l) => (l.power ? survivalOdds(l, clamp(rank(l) + 1, 0, 8)) : 0.45),
        run: (l, _c, ok) => {
          if (ok) {
            l.flags.ch3Escaped = true;
            addFame(l, 12);
            if (l.power) luckyRankUp(l, "คุณเอาชนะชะตาของตัวประกอบ");
            markTurn(l);
            return { text: `คุณปิดกับดักได้ก่อนมันทำงาน และช่วยทั้งกลุ่มไว้ — ${hero(l)}มองคุณด้วยสายตาที่ไม่มีในนิยาย "เธอเป็นใครกันแน่?"`, kind: "milestone" };
          }
          kill(l, "ตายในดันเจี้ยนจำลองตามเนื้อเรื่องของนิยาย");
          return bad("เนื้อเรื่องแข็งแกร่งกว่าที่คิด… บทที่ 3 เขียนไว้แบบนี้ตั้งแต่ต้น");
        },
      },
      {
        label: "ไป แต่อยู่ข้างตัวเอกตลอดเวลา",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { l.flags.ch3Escaped = true; return good("เมื่อกับดักทำงาน ตัวเอกดึงคุณออกมาทัน — กลายเป็นว่าคุณติดหนี้ชีวิตตัวเอกแทน"); }
          addStat(l, "health", -25);
          if (l.stats.health <= 0) { kill(l, "ตายในดันเจี้ยนจำลองตามเนื้อเรื่องของนิยาย"); return bad("บทที่ 3 ยังคงเป็นบทที่ 3…"); }
          return bad("คุณรอดมาได้ด้วยบาดแผลฉกรรจ์ — แต่ก็รอด");
        },
      },
    ],
  },
  {
    id: "aca.house_cup",
    minAge: 13,
    maxAge: 18,
    maxTimes: 2,
    when: (l) => inAcademy(l) && !!l.flags.acaHouse,
    title: "ถ้วยประจำหอ",
    text: (l) => `การแข่งขันชิงถ้วยประจำหอรอบชิงชนะเลิศ — ${houseOf(l)!.name}ต้องการคุณลงแข่งรายการสุดท้าย`,
    choices: [
      {
        label: "ลงแข่ง",
        check: { stat: "health", dc: 50, bonus: (l) => (l.power ? 0.1 : 0) },
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 5); addStat(l, "happiness", 8); l.flags.houseCup = true; return good(`${houseOf(l)!.name}คว้าถ้วย! เพื่อนร่วมหอโยนคุณขึ้นฟ้าสามรอบ`); }
          addStat(l, "happiness", -4);
          return bad("คุณพลาดในจังหวะสุดท้าย ถ้วยตกเป็นของหออื่น");
        },
      },
      { label: "เป็นกองเชียร์", run: (l) => { addStat(l, "happiness", 3); return meh("คุณเชียร์จนเสียงแหบ แม้หอจะแพ้ก็ตาม"); } },
    ],
  },
  {
    id: "aca.professor",
    minAge: 14,
    maxAge: 18,
    when: (l) => inAcademy(l) && Number(l.flags.acaRank ?? STUDENTS) <= 60,
    title: "ศิษย์ส่วนตัว",
    text: () => "อาจารย์เวทอาวุโสที่ไม่เคยรับศิษย์ส่วนตัวมาสามสิบปี เรียกคุณเข้าห้องทำงาน \"ข้าอ่านคำตอบข้อสุดท้ายของเจ้าแล้ว… มาเรียนกับข้าทุกเย็นวันพฤหัส\"",
    choices: [
      { label: "ตอบรับ", run: (l) => { l.flags.professorMentor = true; addStat(l, "smarts", 4); if (l.power) gainExp(l, 600); return good("ทุกเย็นวันพฤหัสกลายเป็นเวลาที่คุณรอคอยที่สุดของสัปดาห์"); } },
      { label: "ปฏิเสธอย่างสุภาพ", run: () => meh("อาจารย์พยักหน้าเบาๆ \"ประตูห้องนี้เปิดเสมอ\"") },
    ],
  },
  {
    id: "aca.secret_room",
    minAge: 13,
    maxAge: 18,
    weight: 5,
    when: inAcademy,
    title: "ห้องที่ไม่มีอยู่ในแผนผัง",
    text: () => "หลังชั้นหนังสือในหอสมุดชั้นสาม มีบันไดวนลงไปข้างล่าง — แผนผังสถาบันไม่มีห้องนี้",
    choices: [
      {
        label: "ลงไปดู",
        check: { stat: "luck", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { if (l.power) luckyRankUp(l, "คุณพบตำราของผู้ก่อตั้งสถาบัน"); else addStat(l, "smarts", 6); l.flags.secretLibrary = true; return { text: "ห้องนั้นคือห้องทำงานของผู้ก่อตั้งสถาบันเมื่อห้าร้อยปีก่อน — ตำราทุกเล่มยังอยู่ครบ", kind: "milestone" }; }
          addStat(l, "health", -8);
          return bad("บันไดผุพังกลางทาง คุณตกลงไปพร้อมฝุ่นห้าร้อยปี");
        },
      },
      { label: "จดจำไว้ก่อน", run: () => meh("คืนนั้นคุณฝันถึงบันไดวนที่ไม่มีที่สิ้นสุด") },
    ],
  },
  {
    id: "aca.hero_meet",
    minAge: 13,
    maxAge: 17,
    when: (l) => inAcademy(l) && !!l.flags.role && role(l) !== "lead",
    title: "ตัวเอกของเรื่อง",
    text: (l) => `${hero(l)} ตัวเอกของนิยาย นั่งลงโต๊ะเดียวกับคุณในโรงอาหารเพราะไม่มีที่ว่าง — ทุกสายตาในห้องหันมามอง`,
    choices: [
      {
        label: "ชวนคุยตามปกติ",
        run: (l) => {
          const p = createPerson(l, "friend", { gender: l.gender === "f" ? "f" : "m", age: l.age, bond: 50 });
          p.name = hero(l);
          return good(`${hero(l)}หัวเราะกับมุกของคุณจนสำลัก — ตัวเอกกับ${role(l) === "villain" ? "ตัวร้าย" : "ตัวประกอบ"}กลายเป็นเพื่อนกัน ซึ่งไม่มีในนิยาย`);
        },
      },
      { label: "ลุกหนีทันที", run: () => meh("ยิ่งห่างตัวเอก ยิ่งห่าง Death Flag — คุณคิดแบบนั้น") },
    ],
  },
  {
    id: "aca.duel_class",
    minAge: 14,
    maxAge: 18,
    maxTimes: 2,
    when: (l) => inAcademy(l) && !!l.power,
    title: "คาบประลอง",
    prepare: (l) => ({ r: clamp(rank(l) + randInt(l, 0, 1), 0, 8) }),
    text: (l, c) => `คาบประลองประจำสัปดาห์ คู่ของคุณคือบุตรชายดยุกที่มีวงเวท${rankLabel(l, Number(c.r))} ทั้งชั้นเดิมพันข้างเขา`,
    choices: [
      {
        label: "สู้เต็มที่",
        tone: "danger",
        odds: (l, c) => fightOdds(l, Number(c.r)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 5); gainExp(l, 250); return good("ทั้งลานประลองเงียบกริบ แล้วเสียงปรบมือก็ดังขึ้นจากอาจารย์ก่อนนักเรียน"); }
          addStat(l, "health", -randInt(l, 4, 10));
          return bad("คุณแพ้ — แต่บุตรชายดยุกยื่นมือมาดึงคุณลุก \"ไม่เลว\"");
        },
      },
      { label: "ยอมแพ้แต่แรก", run: (l) => { addFame(l, -2); return meh("ประหยัดแรงไว้สอบปลายปีดีกว่า"); } },
    ],
  },
  {
    id: "aca.festival",
    minAge: 13,
    maxAge: 18,
    when: inAcademy,
    text: (l) => pick(l, [
      "เทศกาลประจำปีของสถาบัน ห้องคุณเปิดร้านคาเฟ่ ทุกคนแต่งชุดพ่อบ้านและสาวใช้ ร้านขายหมดตั้งแต่บ่าย",
      "คืนเทศกาลดาวตก นักเรียนทั้งสถาบันขึ้นไปดูบนหอคอยนาฬิกา คุณนอนดูดาวจนรุ่งเช้า",
    ]),
    auto: (l) => { addStat(l, "happiness", 8); for (const p of people(l, "friend")) p.bond = clamp(p.bond + 5, 0, 100); return "good"; },
  },
  {
    id: "aca.ball",
    minAge: 17,
    maxAge: 18,
    when: (l) => inAcademy(l) && !people(l, "partner").length && !people(l, "spouse").length,
    title: "งานเต้นรำปลายภาค",
    text: () => "งานเต้นรำปลายภาคของนักเรียนปีสุดท้าย ทุกคนมีคู่แล้ว ยกเว้นคุณ — และใครคนหนึ่งที่ยืนอยู่ริมระเบียง",
    choices: [
      {
        label: "เดินไปขอเต้นรำ",
        check: { stat: "looks", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age, bond: 65 }); addStat(l, "happiness", 10); return { text: `💕 ${shortName(p)}รับมือคุณ เพลงสุดท้ายของคืนนั้นยาวกว่าทุกเพลง`, kind: "milestone" }; }
          return meh("อีกฝ่ายยิ้มขอโทษ — มีคนจองไว้แล้ว");
        },
      },
      { label: "ออกไปนั่งดูดาวคนเดียว", run: (l) => { addStat(l, "happiness", 2); return meh("ดาวคืนนั้นสวยกว่าที่คิด"); } },
    ],
  },
  {
    id: "aca.field_trip",
    minAge: 15,
    maxAge: 18,
    when: (l) => inAcademy(l) && !!l.power,
    title: "ทัศนศึกษาที่ชายแดน",
    text: () => "ทัศนศึกษาชายแดนทางเหนือ มอนสเตอร์ระดับสูงหลุดเข้ามาในค่าย อาจารย์ผู้คุมบาดเจ็บ — นักเรียนสามสิบคนมองมาที่คุณ",
    choices: [
      {
        label: "นำทุกคนต่อสู้",
        tone: "danger",
        odds: (l) => fightOdds(l, clamp(rank(l) + 1, 0, 8)),
        survival: (l) => survivalOdds(l, clamp(rank(l) + 1, 0, 8)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 10); gainExp(l, 600); return { text: "คุณนำนักเรียนสามสิบคนรอดกลับมาได้ครบ ข่าวไปถึงวังก่อนรถม้าจะถึงสถาบัน", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, clamp(rank(l) + 1, 0, 8)))) { kill(l, "สิ้นชีพระหว่างทัศนศึกษาที่ชายแดน"); return bad("คุณยืนขวางหน้าเพื่อนจนวินาทีสุดท้าย…"); }
          addStat(l, "health", -20);
          return bad("อัศวินชายแดนมาถึงทันเวลา คุณรอดมาพร้อมแผลเป็นที่แขน");
        },
      },
      { label: "พาทุกคนหนีเข้าป่า", check: { stat: "smarts", dc: 50 }, run: (_l, _c, ok) => (ok ? good("คุณหาทางลัดกลับค่ายทหารได้ ไม่มีใครบาดเจ็บ") : bad("ทุกคนหลงป่าสามวันกว่าจะมีคนมาพบ")) },
    ],
  },
  {
    id: "aca.expelled",
    minAge: 14,
    maxAge: 18,
    forced: true,
    when: (l) => !!l.flags.acaExpelled && !l.flags.acaExpelledSeen,
    text: () => "คุณเก็บของออกจากหอพักในวันฝนตก ไม่มีใครมาส่งที่ประตู",
    auto: (l) => { l.flags.acaExpelledSeen = true; addStat(l, "happiness", -15); log(l, "ชีวิตในสถาบันจักรวรรดิจบลงก่อนกำหนด", "bad"); return "bad"; },
  },
];

export const ACADEMY_EVENTS: GameEvent[] = [HOUSE_PICK, RANKING, GRADUATION, ...LIFE];

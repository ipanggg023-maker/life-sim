import { woundFrom } from "../../engine/body";
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, kinDeathHooks, openHiddenSlot } from "../../engine/game";
import { memoryOdds, observe, remembers, useMemory } from "../../engine/memory";
import { chance, pick, randInt } from "../../engine/rng";
import type { HunterClass, Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, people, shortName } from "../../engine/util";
import {
  CLASSES,
  awaken,
  classById,
  fightOdds,
  gainExp,
  guildById,
  guildsFor,
  offerClasses,
  rankLabel,
  luckyRankUp,
  rankUp,
  rollAwakening,
  settleNone,
  trackOf,
  survivalOdds,
} from "../hunter/power";
import { worldFacts } from "../hunter/worldFacts";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });
const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });

const rank = (l: Life) => l.power?.rank ?? -1;
const inSect = (l: Life) => l.job?.careerId === "disciple";
const RL = rankLabel;

function damage(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})` + woundFrom(l, d, cause);
}

const MURIM_STYLE_IDS: HunterClass[] = CLASSES.filter((c) => c.world === "murim").map((c) => c.id);

/** ตัวเลือกวิชาจาก ctx.offer */
function styleChoices(onPick: (l: Life, c: Ctx, id: HunterClass) => Outcome) {
  return MURIM_STYLE_IDS.map((id) => ({
    label: `${classById(id).emoji} ${classById(id).name} — ${classById(id).desc}`,
    tone: id === "m_demon" ? ("special" as const) : undefined,
    show: (_l: Life, c: Ctx) => String(c.offer ?? "").split(",").includes(id),
    run: (l: Life, c: Ctx) => onPick(l, c, id),
  }));
}

// ───────────────────────── คัดเลือกศิษย์ (เทียบเท่าวันตื่นพลัง) ─────────────────────────

function assess(l: Life, c: Ctx, bonus: number) {
  // ตื่นช้า: ในพิธียังไม่ตื่น แต่ชะตายังไม่จบ
  c.rank = trackOf(l) === "late" ? -1 : rollAwakening(l, bonus);
  const offer = offerClasses(l);
  c.offer = offer.join(",");
}

export const ASSESSMENT: GameEvent = {
  id: "murim.assessment",
  minAge: 10,
  maxAge: 16,
  forced: true,
  when: (l) => !l.power && !l.flags.awakenDone && !l.flags.notYet && l.age === Number(l.flags.ceremonyAge ?? l.flags.awakenAge ?? 12),
  title: "วันคัดเลือกศิษย์",
  text: () =>
    "ผู้อาวุโสจากหลายสำนักลงเขามาคัดศิษย์ที่ลานหน้าศาลเจ้าประจำหมู่บ้าน เด็กทุกคนต้องวางมือบน 'ศิลาวัดรากฐาน' ทีละคน… ถึงตาคุณแล้ว",
  choices: [
    {
      label: "สูดลมหายใจลึก ตั้งสมาธิแล้ววางมือ",
      check: { stat: "smarts", dc: 50 },
      run: (l, c, ok) => { assess(l, c, ok ? 1 : 0); return meh(ok ? "จิตใจคุณสงบนิ่งราวผิวน้ำ" : "มือคุณสั่นเล็กน้อย…", Number(c.rank) < 0 ? "none" : "sect"); },
    },
    {
      label: "กดมือลงสุดแรง!",
      check: { stat: "health", dc: 55 },
      run: (l, c, ok) => { assess(l, c, ok ? 1 : 0); return meh(ok ? "ลมปราณดิบในตัวคุณพลุ่งขึ้นตามแรงกด" : "ศิลาเย็นเฉียบ ไม่มีอะไรตอบสนอง…", Number(c.rank) < 0 ? "none" : "sect"); },
    },
    {
      label: "ใช้วิธีหายใจที่ขอทานแก่เคยสอน",
      tone: "special",
      show: (l) => !!l.flags.beggarMaster,
      run: (l, c) => { assess(l, c, 2); return sys("ลมหายใจของคุณไหลเวียนตามเส้นชีพจรแปลกประหลาด ผู้อาวุโสทุกคนหันขวับมามอง", Number(c.rank) < 0 ? "none" : "sect"); },
    },
  ],
  scenes: {
    none: {
      title: "รากฐานธรรมดา",
      text: () => "ศิลาวัดรากฐานไม่เปล่งแสงแม้แต่น้อย ผู้อาวุโสส่ายหน้าแล้วเรียกคนถัดไป \"เส้นชีพจรอุดตัน ฝึกยุทธ์ไม่ได้\"",
      choices: [
        { label: "ยอมรับชะตา ใช้ชีวิตแบบคนธรรมดา", run: (l) => { settleNone(l); addStat(l, "happiness", -8); return meh("คุณเดินกลับบ้านช้าๆ แม่ทำบะหมี่ให้กินทั้งที่ไม่ใช่วันเกิด"); } },
        { label: "สาบานว่าสักวันจะทะลวงเส้นชีพจรเอง", run: (l) => { settleNone(l); l.flags.stubborn = true; return meh("คุณกำหมัดแน่นจนเล็บจิกฝ่ามือ"); } },
      ],
    },
    sect: {
      title: "รากฐานยอดเยี่ยม",
      system: true,
      text: (l, c) => `ศิลาทดสอบเปล่งแสงจ้าจนผู้คนรอบลานต้องหรี่ตา ผู้อาวุโสประกาศเสียงดัง: "รากฐานขั้น${RL(l, Number(c.rank))}!" — ผู้อาวุโสจากหลายสำนักเดินเข้ามาหาคุณพร้อมกัน`,
      choices: [
        ...guildsFor({ worldId: "murim" })
          .filter((g) => g.id !== "alliance")
          .map((g) => ({
            label: `เข้า${g.name} — ${g.desc}`,
            tone: g.demonic ? ("danger" as const) : undefined,
            show: (_l: Life, c: Ctx) => g.minRank <= Number(c.rank),
            run: (_l: Life, c: Ctx): Outcome => {
              c.sect = g.id;
              if (g.demonic && !String(c.offer).includes("m_demon")) c.offer = `${c.offer},m_demon`;
              return sys(`คุณคุกเข่าคารวะผู้อาวุโสจาก${g.name}`, "style");
            },
          })),
        { label: "ไม่เข้าสำนักไหน จะฝึกฝนด้วยตัวเอง", run: (_l, c) => { c.sect = ""; return meh("ผู้อาวุโสทุกคนมองคุณอย่างประหลาดใจ", "style"); } },
      ],
    },
    style: {
      title: "เลือกวิชา",
      system: true,
      text: () => "อาจารย์วางคัมภีร์หลายเล่มลงตรงหน้า \"วิชามีหลายสาย แต่ชีวิตคนเรามีเวลาให้ฝึกจนถึงที่สุดได้เพียงสายเดียว — เลือกเถิด\"",
      choices: styleChoices((l, c, id) => {
        const r = Number(c.rank);
        awaken(l, r, id);
        const sect = guildById(String(c.sect || "") || undefined);
        if (sect) {
          l.power!.guild = sect.id;
          l.job = { careerId: "disciple", level: 1, performance: 50, years: 0 };
          if (sect.demonic) addFame(l, -15);
        }
        openHiddenSlot(l, "รากฐานตื่นขึ้น");
        return {
          text: `⛰️ คุณเริ่มเส้นทาง${classById(id).name}ด้วยรากฐานระดับ${RL(l, r)}${sect ? ` ในฐานะศิษย์นอกแห่ง${sect.name}` : " โดยไม่มีสำนัก"}`,
          kind: "milestone",
        };
      }),
    },
  },
};

// ───────────────────────── ทะลวงขั้น ─────────────────────────

const pills = ["ยาเม็ดทะลวงชีพจร", "ยาเม็ดเก้าหยาง"];
const pillIdx = (l: Life) => l.power?.items.findIndex((i) => pills.includes(i)) ?? -1;
const breakOdds = (l: Life, bonus = 0) =>
  rank(l) === 7
    ? clamp(0.05 + (l.stats.smarts - 50) / 500 + bonus * 0.5, 0.03, 0.4) // ทัณฑ์สวรรค์: ประตูสู่เซียนแคบมาก
    : clamp(0.66 - rank(l) * 0.06 + (l.stats.smarts - 50) / 200 + bonus, 0.08, 0.95);
/** เลเวลที่ต้องถึงก่อนทะลวงขั้นถัดไป — ขั้นสูงยิ่งไกล */
export const breakLevel = (r: number) => (r + 1) * 8 + r * r;
export { QI_NEED } from "./martial/arts";
import { QI_NEED } from "./martial/arts";
const breakSurvival = (l: Life) =>
  rank(l) === 7
    ? clamp(0.5 + (l.stats.health - 50) / 300, 0.3, 0.75) // ทัณฑ์สวรรค์ล้มเหลว = มักไม่รอด (กันลองซ้ำจนผ่าน)
    : clamp(0.92 - rank(l) * 0.04 + (l.stats.health - 50) / 200, 0.4, 0.99);

export const BREAKTHROUGH: GameEvent = {
  id: "murim.breakthrough",
  minAge: 10,
  maxAge: 200,
  forced: true,
  maxTimes: 0,
  // ยุทธภพไม่มีเลเวลให้เห็น — ทะลวงได้เมื่อกำลังภายในสะสมถึง (MURIM_PLAN §4)
  when: (l) => !!l.power && rank(l) < 8 && l.age >= Number(l.flags.btNext ?? 0) && Number(l.flags.mwQi ?? 0) >= QI_NEED[rank(l)],
  title: "ทะลวงขั้น",
  text: (l) =>
    rank(l) === 7
      ? `เมฆดำก่อตัวเหนือยอดเขา ฟ้าคำรามเรียกชื่อคุณ — ทัณฑ์สวรรค์มาถึงแล้ว หากผ่านได้จะก้าวสู่ขั้น${RL(l, 8)}`
      : `ลมปราณในตันเถียนของคุณเต็มจนล้น คอขวดของขั้น${RL(l, rank(l))}สั่นคลอน… ถึงเวลาทะลวงสู่ขั้น${RL(l, rank(l) + 1)}`,
  choices: [
    {
      label: "ปิดด่านแล้วฝืนทะลวง",
      tone: "danger",
      odds: (l) => breakOdds(l),
      survival: (l) => breakSurvival(l),
      run: (l, _c, ok) => {
        if (ok) { rankUp(l, rank(l) === 7 ? "ฝ่าทัณฑ์สวรรค์เก้าสายฟ้า" : "ทะลวงคอขวดสำเร็จ"); return { text: "ลมปราณหมุนวนครบรอบใหญ่ ร่างกายคุณเบาราวขนนก", kind: "milestone" }; }
        if (!chance(l, breakSurvival(l))) { kill(l, rank(l) === 7 ? "ถูกทัณฑ์สวรรค์ผ่าร่างแหลก" : "ธาตุไฟเข้าแทรกขณะทะลวงขั้น"); return bad("ลมปราณย้อนกลับพุ่งทะลวงเส้นชีพจรทุกเส้น…"); }
        l.power!.exp = 0;
        l.flags.btNext = l.age + 3; // บาดเจ็บภายใน ต้องพักฟื้นก่อนลองใหม่
        l.power!.level = Math.max(1, l.power!.level - 3);
        return bad("ธาตุไฟเข้าแทรก! คุณกระอักเลือดและพลังถดถอยไปหลายระดับ" + damage(l, 15, 30, "ธาตุไฟเข้าแทรก"));
      },
    },
    {
      label: (l) => `กลืน「${l.power?.items[pillIdx(l)] ?? ""}」ช่วยทะลวง`,
      tone: "special",
      show: (l) => pillIdx(l) >= 0,
      odds: (l) => breakOdds(l, 0.3),
      run: (l, _c, ok) => {
        const pill = l.power!.items.splice(pillIdx(l), 1)[0];
        if (ok) { rankUp(l, `ฤทธิ์ของ${pill}`); return { text: `${pill}ละลายเป็นกระแสอุ่นไหลเวียนทั่วร่าง คอขวดแตกออกอย่างง่ายดาย`, kind: "milestone" }; }
        return bad(`แม้มี${pill}ก็ยังไม่พอ — คุณถอนตัวออกจากการทะลวงทันเวลา`);
      },
    },
    { label: "ยังไม่พร้อม ขอสะสมลมปราณต่ออีกปี", run: (l) => { gainExp(l, 50); return meh("คุณข่มลมปราณไว้อย่างอดทน"); } },
  ],
};

// ───────────────────────── วัยเด็ก ─────────────────────────

const CHILD: GameEvent[] = [
  {
    id: "m.child.first_word",
    minAge: 1,
    maxAge: 2,
    weight: 20,
    prepare: (l) => ({ w: pick(l, ["แม่", "พ่อ", "ซาลาเปา", "กระบี่", "ไก่"]) }),
    text: (_l, c) => `คำแรกที่คุณพูดคือ "${c.w}"${c.w === "กระบี่" ? " …ปู่ตบเข่าฉาดหัวเราะลั่น" : ""}`,
    auto: (l) => { addStat(l, "happiness", 3); },
  },
  {
    id: "m.child.grandpa_tales",
    minAge: 3,
    maxAge: 8,
    weight: 15,
    text: () => "ปู่เล่าเรื่องจอมยุทธ์ที่เหาะข้ามแม่น้ำเหลืองด้วยใบไผ่ใบเดียว คุณฟังจนตาโตไม่ยอมนอน",
    auto: (l) => { l.flags.dreamHero = true; addStat(l, "happiness", 4); },
  },
  {
    id: "m.child.beggar",
    minAge: 5,
    maxAge: 11,
    weight: 6,
    title: "ขอทานแก่",
    text: () => "ขอทานแก่ผมเผ้ารุงรังนั่งพิงกำแพงหน้าบ้าน จ้องซาลาเปาในมือคุณไม่วางตา",
    choices: [
      { label: "แบ่งซาลาเปาให้ครึ่งหนึ่ง", run: (l) => { l.flags.beggarMaster = true; addStat(l, "health", 4); return sys("เขากินหมดในคำเดียว แล้วจิ้มนิ้วที่หน้าอกคุณสามจุด \"จำวิธีหายใจแบบนี้ไว้ เจ้าหนู\" — พริบตาเดียวเขาก็หายไป"); } },
      { label: "วิ่งหนี", run: () => meh("คุณได้ยินเสียงหัวเราะแหบๆ ตามหลัง") },
    ],
  },
  {
    id: "m.child.massacre",
    minAge: 6,
    maxAge: 11,
    weight: (l) => (l.wealth === "rich" || l.wealth === "elite" ? 6 : 2),
    title: "คืนนองเลือด",
    text: () => "กลางดึก ชายสวมหน้ากากเหล็กกับพวกบุกเข้าบ้าน ไฟลุกท่วมเรือน เสียงกรีดร้องของแม่ดังมาจากห้องโถง",
    choices: [
      {
        label: "ซ่อนใต้พื้นกระดานตามที่พ่อเคยสอน",
        run: (l) => {
          for (const p of l.people) if ((p.relation === "father" || p.relation === "mother") && p.alive) p.alive = false;
          l.flags.vendetta = "ชายหน้ากากเหล็ก";
          addStat(l, "happiness", -40);
          observe(l, "massacre", `อายุ ${l.age}: ชายหน้ากากเหล็กสังหารพ่อแม่ของคุณ`);
          return { text: "คุณกัดแขนตัวเองไม่ให้ร้องออกมา… เช้ามา เหลือเพียงคุณคนเดียว และรอยสักรูปแมงป่องบนข้อมือของฆาตกรที่ติดตาไม่ลืม", kind: "bad" };
        },
      },
      {
        label: "วิ่งออกไปหาแม่",
        check: { stat: "luck", dc: 60 },
        run: (l, _c, ok) => {
          const mom = l.people.find((p) => p.relation === "mother");
          for (const p of l.people) if (p.relation === "father") p.alive = false;
          l.flags.vendetta = "ชายหน้ากากเหล็ก";
          if (ok && mom) return bad("คุณลากแม่ที่บาดเจ็บหนีออกทางหลังบ้านได้ แต่พ่อไม่รอด");
          if (mom) mom.alive = false;
          addStat(l, "happiness", -40);
          return bad("ดาบเฉือนหลังคุณเป็นแผลยาว… คุณรอดมาได้เพราะพวกมันคิดว่าคุณตายแล้ว" + damage(l, 15, 25, "ถูกสังหารในคืนนองเลือด"));
        },
      },
    ],
  },
  {
    id: "m.child.scholar",
    minAge: 6,
    maxAge: 11,
    weight: 10,
    text: () => "ซิ่วไฉ่ชราประจำหมู่บ้านเปิดสอนอ่านเขียนตัวอักษรฟรีที่ศาลเจ้า",
    choices: [
      { label: "ไปเรียนทุกวัน", run: (l) => { addStat(l, "smarts", randInt(l, 3, 6)); return good("คุณคัดอักษรได้สวยที่สุดในหมู่บ้าน"); } },
      { label: "แอบไปจับปลาแทน", run: (l) => { addStat(l, "happiness", 4); addStat(l, "health", 2); return meh("ปลาตัวโตมาก แต่คุณอ่านหนังสือไม่ออก"); } },
    ],
  },
  {
    id: "m.child.bully",
    minAge: 7,
    maxAge: 13,
    weight: 8,
    prepare: (l) => { const p = createPerson(l, "rival", { gender: "m", age: l.age + 2, bond: 10 }); return { name: shortName(p) }; },
    text: (_l, c) => `${c.name}ลูกชายคหบดีกับลูกสมุนดักแกล้งคุณที่ท่าน้ำ ผลักคุณตกโคลน`,
    choices: [
      { label: "สู้กลับ", check: { stat: "health", dc: 55 }, run: (l, c, ok) => (ok ? (addStat(l, "happiness", 8), good(`คุณจับ${c.name}กดลงโคลนบ้าง ทั้งหมู่บ้านหัวเราะ`)) : bad("คุณโดนรุมจนตัวเปื้อนโคลนกลับบ้าน" + damage(l, 3, 8, "ถูกรังแก"))) },
      { label: "จำหน้าไว้", run: (l, c) => { l.flags.childRival = String(c.name); return meh("วันหนึ่ง… คุณจะทวงคืน"); } },
    ],
  },
];

// ───────────────────────── ชีวิตในสำนัก ─────────────────────────

const SECT: GameEvent[] = [
  {
    id: "m.sect.arrogant",
    minAge: 12,
    maxAge: 40,
    maxTimes: 2,
    weight: (l) => (inSect(l) ? 12 : 0),
    prepare: (l) => ({ r: clamp(rank(l) + randInt(l, -1, 1), 0, 7) }),
    text: (l, c) => `ศิษย์ในขั้น${RL(l, Number(c.r))}คนหนึ่งเหยียบชายเสื้อคุณกลางโรงอาหาร "ขยะจากหมู่บ้านบ้านนอกอย่างแกไม่มีสิทธิ์นั่งโต๊ะนี้"`,
    choices: [
      {
        label: "ตบหน้ามันต่อหน้าทุกคน",
        tone: "special",
        show: (l, c) => rank(l) > Number(c.r),
        run: (l) => { addFame(l, 6); addStat(l, "happiness", 12); if (l.job) l.job.performance = clamp(l.job.performance + 5, 0, 100); return good("เสียงฉาดดังก้องโรงอาหาร มันล้มคว่ำทั้งที่ยังไม่ทันเห็นมือคุณ ทั้งโรงอาหารเงียบกริบ"); },
      },
      {
        label: "ท้าประลองบนลานประลอง",
        tone: "danger",
        odds: (l, c) => fightOdds(l, Number(c.r)),
        run: (l, _c, ok) => (ok ? (addFame(l, 8), good("คุณชนะในสามกระบวนท่า มันต้องคุกเข่าขอโทษตามกฎสำนัก")) : bad("คุณแพ้… และถูกหัวเราะเยาะไปทั้งเดือน" + damage(l, 5, 12, "บาดเจ็บจากการประลอง"))),
      },
      { label: "อดทนไว้ก่อน สามปีนักปราชญ์แก้แค้นไม่สาย", run: (l) => { l.flags.grudge = true; return meh("คุณลุกไปนั่งโต๊ะอื่นเงียบๆ จดจำใบหน้านั้นไว้"); } },
    ],
  },
  {
    id: "m.sect.senior",
    minAge: 15,
    maxAge: 35,
    weight: (l) => (inSect(l) && !people(l, "partner").length && !people(l, "spouse").length ? 8 : 0),
    text: (l) => `ศิษย์${l.gender === "m" ? "พี่หญิง" : "พี่ชาย"}คนหนึ่งแอบเอายาสมุนไพรมาวางไว้ที่ประตูห้องคุณทุกครั้งที่คุณบาดเจ็บจากการฝึก`,
    choices: [
      {
        label: "ชวนไปชมจันทร์บนยอดเขา",
        check: { stat: "looks", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, 1, 4), bond: 75, job: "ศิษย์ร่วมสำนัก" }); return good(`ใต้แสงจันทร์ ${shortName(p)}ยอมรับว่าเฝ้ามองคุณมานาน`); }
          return meh("อีกฝ่ายหน้าแดงแล้ววิ่งหนีไป… ไม่แน่ใจว่าคือตอบรับหรือปฏิเสธ");
        },
      },
      { label: "ตั้งใจฝึกต่อ ความรักทำให้กระบี่ทื่อ", run: (l) => { gainExp(l, 80); return meh("คุณจมอยู่กับการฝึกจนไม่ทันสังเกตว่าของฝากหยุดมา"); } },
    ],
  },
  {
    id: "m.sect.library",
    minAge: 13,
    maxAge: 40,
    maxTimes: 2,
    weight: (l) => (inSect(l) ? 8 : 0),
    text: () => "คืนเดือนมืด คุณสังเกตว่าผู้เฝ้าหอคัมภีร์ต้องห้ามหลับอยู่ ประตูแง้มอยู่นิดเดียว",
    choices: [
      {
        label: "แอบเข้าไปอ่าน",
        check: { stat: "luck", dc: 55 },
        run: (l, _c, ok) => {
          if (ok) { gainExp(l, 300 + rank(l) * 100); return good("คุณจำเคล็ดลมปราณขั้นสูงได้ครึ่งเล่มก่อนไก่ขัน"); }
          if (l.job) l.job.performance = clamp(l.job.performance - 30, 0, 100);
          return bad("ผู้อาวุโสยืนรออยู่ข้างหลัง! คุณถูกลงโทษให้คุกเข่าหน้าหอสามวันสามคืน" + damage(l, 5, 12, "ถูกลงโทษ"));
        },
      },
      { label: "กลับห้องไปนอน", run: () => meh("กฎสำนักมีไว้ด้วยเหตุผล") },
    ],
  },
  {
    id: "m.sect.contest",
    minAge: 13,
    maxAge: 45,
    maxTimes: 0,
    weight: (l) => (inSect(l) ? 7 : 0),
    title: "ประลองประจำปีของสำนัก",
    text: () => "การประลองประจำปีของสำนักมาถึง ผู้ชนะจะได้เลื่อนขั้นศิษย์",
    choices: [
      {
        label: "ลงประลองเต็มที่",
        odds: (l) => fightOdds(l, rank(l), 0.05),
        run: (l, _c, ok) => {
          if (!ok) return bad("คุณตกรอบที่สอง" + damage(l, 3, 10, "บาดเจ็บจากการประลอง"));
          addFame(l, 4);
          if (l.job && l.job.level < 4) { l.job.level++; l.job.performance = 50; return { text: "คุณชนะเลิศ! ได้เลื่อนขั้นเป็นศิษย์ระดับสูงขึ้น", kind: "milestone" }; }
          return good("คุณชนะเลิศอีกปี ทั้งสำนักยอมรับในฝีมือ");
        },
      },
      { label: "ไม่ลง ซ่อนฝีมือไว้", run: (l) => { gainExp(l, 60); return meh("คุณนั่งดูอยู่ข้างเวที วิเคราะห์ท่าทุกคน"); } },
    ],
  },
  {
    id: "m.sect.leader",
    minAge: 40,
    maxAge: 90,
    weight: (l) => (inSect(l) && (l.job?.level ?? 0) >= 4 && rank(l) >= 5 ? 20 : 0),
    title: "เจ้าสำนักคนใหม่",
    text: (l) => `เจ้าสำนักคนเก่าละสังขาร ที่ประชุมผู้อาวุโสแห่ง${guildById(l.power?.guild)?.name ?? "สำนัก"}ลงมติเสนอชื่อคุณ`,
    choices: [
      { label: "รับตำแหน่ง", run: (l) => { if (l.job) l.job.level = 5; addFame(l, 25); return { text: "คุณสวมแหวนประจำตำแหน่งเจ้าสำนัก ศิษย์นับพันคุกเข่าพร้อมกัน", kind: "milestone" }; } },
      { label: "ปฏิเสธ ขอท่องยุทธภพต่อ", run: (l) => { addFame(l, 5); return meh("คุณวางแหวนคืนบนโต๊ะ แล้วเดินลงเขาไปพร้อมกระบี่เล่มเดียว"); } },
    ],
  },
];

// ───────────────────────── ยุทธภพ ─────────────────────────

const JIANGHU: GameEvent[] = [
  {
    id: "m.young_master",
    minAge: 14,
    maxAge: 50,
    maxTimes: 2,
    weight: (l) => (l.power ? 9 : 4),
    prepare: (l) => ({ r: clamp(randInt(l, 1, 4), 0, 7), clan: pick(l, ["มู่หรง", "หนานกง", "ตู้กู", "เซียว"]) }),
    text: (l, c) => `นายน้อยตระกูล${c.clan}ขั้น${RL(l, Number(c.r))}เตะโต๊ะเด็กขายบะหมี่ล้มกลางโรงเตี๊ยม "รู้ไหมว่าข้าเป็นใคร!"`,
    choices: [
      {
        label: "\"ไม่รู้ และไม่อยากรู้\" — แล้วสั่งสอนมัน",
        tone: "danger",
        show: (l) => !!l.power,
        odds: (l, c) => fightOdds(l, Number(c.r)),
        run: (l, c, ok) => {
          if (ok) { addFame(l, 10); addStat(l, "happiness", 10); return good(`นายน้อย${c.clan}กระเด็นทะลุหน้าต่างชั้นสอง ทั้งโรงเตี๊ยมเงียบ ก่อนจะโห่ร้องพร้อมกัน`); }
          return bad("คนคุ้มกันของมันรุมเข้ามา คุณถอยหนีพร้อมบาดแผล" + damage(l, 8, 18, "ถูกคนคุ้มกันตระกูลใหญ่รุมทำร้าย"));
        },
      },
      { label: "ช่วยเด็กเก็บของ แล้วรีบพาออกไป", run: (l) => { addStat(l, "happiness", 3); return meh("เด็กขายบะหมี่กระซิบขอบคุณ ส่วนนายน้อยหัวเราะเยาะตามหลัง"); } },
      { label: "ทำเป็นไม่เห็น", run: (l) => { addStat(l, "happiness", -4); return meh("บะหมี่ชามนั้นรสชาติขมกว่าปกติ"); } },
    ],
  },
  {
    id: "m.engagement",
    minAge: 15,
    maxAge: 25,
    weight: (l) => (l.wealth === "rich" || l.wealth === "elite" ? (rank(l) <= 1 ? 14 : 5) : 2),
    title: "ถอนหมั้น",
    prepare: (l) => ({ clan: pick(l, ["ไป๋", "ซ่ง", "หยาง", "เย่"]) }),
    text: (l, c) => `ตระกูล${c.clan}คู่หมั้นของคุณมาที่บ้านต่อหน้าแขกนับร้อย "ลูกสาว/ลูกชายของเราจะไม่แต่งกับคน${l.power ? `ขั้น${RL(l, rank(l))}` : "ไร้รากฐาน"} — เราขอถอนหมั้น"`,
    choices: [
      {
        label: "\"สามสิบปีฝั่งตะวันออก สามสิบปีฝั่งตะวันตก อย่ารังแกคนหนุ่มว่ายากจน!\"",
        tone: "special",
        run: (l, c) => { l.flags.engagementVow = String(c.clan); addFame(l, 3); gainExp(l, 100); return sys("คุณฉีกใบหมั้นต่อหน้าทุกคน — ประโยคนั้นกลายเป็นคำพูดติดปากของทั้งเมือง"); },
      },
      { label: "ยอมรับอย่างสงบ", run: (l) => { addStat(l, "happiness", -10); return meh("คุณคืนป้ายหยกหมั้นด้วยสองมือ"); } },
    ],
  },
  {
    id: "m.engagement_payback",
    minAge: 20,
    maxAge: 60,
    weight: (l) => (l.flags.engagementVow && rank(l) >= 4 ? 25 : 0),
    title: "ตบหน้าคืน",
    text: (l) => `ตระกูล${l.flags.engagementVow}ที่เคยถอนหมั้นคุณ ส่งเทียบเชิญมาพร้อมของขวัญล้นเกวียน — ตอนนี้พวกเขาอยากได้คุณเป็นลูกเขย/ลูกสะใภ้`,
    choices: [
      { label: "ส่งของขวัญคืนทั้งหมด พร้อมจดหมายสั้นๆ ว่า 'สามสิบปียังไม่ถึง'", tone: "special", run: (l) => { addFame(l, 15); addStat(l, "happiness", 20); return { text: "ทั้งยุทธภพเล่าลือเรื่องนี้ไปอีกสิบปี", kind: "milestone" }; } },
      { label: "ให้อภัย", run: (l) => { addFame(l, 5); addStat(l, "happiness", 5); return good("ใจกว้างดุจมหาสมุทร คนยกย่องคุณมากขึ้น"); } },
    ],
  },
  {
    id: "m.cliff",
    minAge: 14,
    maxAge: 50,
    maxTimes: 1,
    weight: (l) => (l.power ? 1.5 : 0.8),
    title: "พบวาสนา",
    text: () => "คุณถูกศัตรูไล่ล่าจนจนมุมที่ริมผา ด้านล่างคือหุบเหวมืดมิด หมอกหนาจนมองไม่เห็นก้นเหว",
    choices: [
      {
        label: "กระโดดลงไป",
        tone: "danger",
        survival: (l) => clamp(0.76 + (l.stats.luck - 50) / 120, 0.35, 0.97),
        odds: (l) => clamp(0.76 + (l.stats.luck - 50) / 120, 0.35, 0.97),
        run: (l, _c, ok) => {
          if (!ok) { kill(l, "ตกหน้าผาหุบเหวไร้ก้น"); return bad("ไม่มีถ้ำ ไม่มีผู้เฒ่า ไม่มีคัมภีร์… มีแต่หินแข็งด้านล่าง"); }
          if (!l.power && !chance(l, 0.35)) {
            addStat(l, "health", -10);
            return meh("กิ่งสนกลางผารับร่างคุณไว้ คุณรอดตายมาได้อย่างปาฏิหาริย์… แต่ไม่มีถ้ำหรือคัมภีร์อะไรทั้งนั้น");
          }
          if (!l.power) {
            const r = Math.max(0, rollAwakening(l, 2));
            awaken(l, r, pick(l, ["m_sword", "m_palm"] as HunterClass[]));
            return { text: `กิ่งสนกลางผารับร่างคุณไว้ ข้างๆ มีถ้ำที่โครงกระดูกนั่งสมาธิอยู่กับคัมภีร์ คุณฝึกตามคัมภีร์นั้นสามปี — เส้นชีพจรที่อุดตันทะลวงออก! (ขั้น${RL(l, r)})`, kind: "milestone" };
          }
          gainExp(l, 1500);
          l.power.items.push("ยาเม็ดเก้าหยาง");
          return { text: "คุณตกลงบนต้นสนกลางผา ข้างๆ มีถ้ำ ในถ้ำมีโครงกระดูกปรมาจารย์โบราณกับคัมภีร์ลมปราณ และยาเม็ดหนึ่งขวด — สามปีต่อมา คุณปีนกลับขึ้นไปด้วยพลังที่ต่างจากเดิมลิบลับ", kind: "milestone" };
        },
      },
      {
        label: "หันกลับไปสู้",
        tone: "danger",
        show: (l) => !!l.power,
        odds: (l) => fightOdds(l, rank(l) + 1),
        run: (l, _c, ok) => (ok ? good("คุณสู้แบบหลังพิงฝาจนศัตรูถอยหนีไปเอง") : bad("คุณพ่ายแพ้แต่หนีรอดมาได้" + damage(l, 15, 30, "ถูกไล่ล่าที่ริมผา"))),
      },
    ],
  },
  {
    id: "m.ring",
    minAge: 10,
    maxAge: 40,
    maxTimes: 1,
    weight: 1.2,
    title: "แหวนเก่า",
    text: () => "คุณซื้อแหวนหยกดำเก่าๆ จากแผงลอยราคาสามอีแปะ คืนนั้นมีเสียงชายชราดังขึ้นในหัว \"เจ้าหนู… ข้าหลับมาแปดร้อยปีแล้ว\"",
    choices: [
      {
        label: "ขอเป็นศิษย์",
        tone: "special",
        run: (l) => {
          l.flags.ringMaster = true;
          if (l.power) { gainExp(l, 800); return sys("วิญญาณปรมาจารย์ในแหวนหัวเราะ \"ดี! เริ่มจากแก้ท่าหายใจผิดๆ ของเจ้าก่อน\" — ลมปราณของคุณไหลเวียนดีขึ้นเท่าตัว"); }
          addStat(l, "health", 10); addStat(l, "smarts", 5);
          return sys("\"เส้นชีพจรเจ้าอุดตัน… ไม่เป็นไร ข้ามีวิธี\" ชายชราในแหวนเริ่มสอนวิธีเปิดเส้นชีพจรทีละเส้น");
        },
      },
      { label: "โยนแหวนทิ้งลงบ่อ", run: () => meh("คุณได้ยินเสียงด่าแช่งอยู่ในหัวจนแหวนจมหายไป") },
    ],
  },
  {
    id: "m.ring_awaken",
    minAge: 14,
    maxAge: 50,
    maxTimes: 1,
    weight: (l) => (l.flags.ringMaster && !l.power ? 30 : 0),
    text: () => "หลังฝึกตามที่ชายชราในแหวนสอนมาหลายปี เส้นชีพจรสุดท้ายของคุณก็ทะลวงออกในคืนพระจันทร์เต็มดวง",
    choices: styleChoicesForLate(),
  },
  {
    id: "m.poison",
    minAge: 14,
    maxAge: 80,
    maxTimes: 2,
    weight: 5,
    text: () => "ชาที่โรงเตี๊ยมมีกลิ่นอัลมอนด์จางๆ… ลิ้นคุณเริ่มชา",
    choices: [
      { label: "ใช้ลมปราณขับพิษ", show: (l) => !!l.power, odds: (l) => clamp(0.4 + rank(l) * 0.08, 0.1, 0.95), run: (l, _c, ok) => (ok ? good("คุณขับพิษออกทางปลายนิ้วเป็นหยดสีดำ แล้วหันไปมองเจ้าของร้านที่หน้าซีด") : bad("พิษแรงเกินกว่าลมปราณของคุณ" + damage(l, 20, 35, "ถูกวางยาพิษ"))) },
      { label: "ฝังเข็มถอนพิษตัวเอง", tone: "special", show: (l) => l.power?.hunterClass === "m_medic", run: () => good("สามเข็มสุดท้ายปักลงที่จุดซ่างหยาง พิษถูกล็อกไว้ที่ปลายนิ้ว") },
      { label: "อาเจียนออกแล้ววิ่งไปหาหมอ", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => (ok ? meh("หมอให้ยาแก้ทันเวลา") : bad("หมอมาช้าไปนิด" + damage(l, 25, 45, "ถูกวางยาพิษในโรงเตี๊ยม"))) },
    ],
  },
  {
    id: "m.bandits",
    minAge: 12,
    maxAge: 80,
    maxTimes: 2,
    weight: 6,
    text: () => "ระหว่างเดินทางข้ามเขา โจรภูเขาสิบกว่าคนกระโดดออกมาขวางทาง \"ภูเขานี้ข้าเป็นคนเปิด ต้นไม้นี้ข้าเป็นคนปลูก — วางเงินไว้!\"",
    choices: [
      { label: "ชักอาวุธ", show: (l) => !!l.power, odds: (l) => fightOdds(l, 1), run: (l, _c, ok) => (ok ? (addFame(l, 3), addMoney(l, 20_000), good("โจรทั้งหมดคุกเข่าขอชีวิต และยกเงินที่ปล้นมาให้คุณ")) : bad("โจรมากเกินไป คุณหนีมาได้" + damage(l, 8, 15, "ถูกโจรภูเขาทำร้าย"))) },
      { label: "วางเงินแล้วไป", run: (l) => { addMoney(l, -Math.min(Math.max(0, l.money), 10_000)); return meh("คุณเดินผ่านไปพร้อมกระเป๋าเงินที่เบาลง"); } },
      { label: "วิ่งหนี", check: { stat: "health", dc: 55 }, run: (l, _c, ok) => (ok ? meh("คุณวิ่งจนโจรเหนื่อยไปเอง") : bad("ลูกธนูปักน่อง" + damage(l, 8, 15, "ถูกโจรภูเขาฆ่า"))) },
    ],
  },
  {
    id: "m.tournament",
    minAge: 18,
    maxAge: 50,
    maxTimes: 3,
    weight: (l) => (l.power && rank(l) >= 2 ? 6 : 0),
    title: "ชุมนุมประลองยุทธ์",
    text: () => "งานชุมนุมประลองยุทธ์ใหญ่ทุกห้าปีจัดขึ้นที่ลั่วหยาง จอมยุทธ์ทั่วใต้หล้ามารวมตัว ผู้ชนะจะได้ชื่อลงทำเนียบยอดฝีมือ",
    choices: [
      {
        label: "ลงทะเบียนประลอง",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l) + 1, 0.05),
        survival: (l) => survivalOdds(l, rank(l) + 1, 0.15),
        run: (l, _c, ok) => {
          if (ok) {
            addFame(l, 25);
            gainExp(l, 1200);
            addMoney(l, 3_000_000);
            l.flags.champion = Number(l.flags.champion ?? 0) + 1;
            return { text: "🏆 คุณยืนอยู่บนเวทีคนสุดท้าย! ชื่อของคุณถูกสลักลงทำเนียบยอดฝีมือแห่งยุค", kind: "milestone" };
          }
          if (!chance(l, survivalOdds(l, rank(l) + 1, 0.15))) { kill(l, "เสียชีวิตบนเวทีชุมนุมประลองยุทธ์"); return bad("คู่ต่อสู้ไม่ยั้งมือ…"); }
          gainExp(l, 300);
          return bad("คุณตกรอบรองชนะเลิศ แต่ได้ประสบการณ์ล้ำค่า" + damage(l, 10, 25, "บาดเจ็บจากการประลอง"));
        },
      },
      { label: "ไปดูเฉยๆ", run: (l) => { gainExp(l, 150); return meh("คุณจดท่าเด็ดของยอดฝีมือทุกคนไว้ในใจ"); } },
    ],
  },
  {
    id: "m.revenge",
    minAge: 18,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (l.flags.vendetta && rank(l) >= 3 ? 20 : 0),
    title: "ชำระแค้น",
    text: () => "ในงานเลี้ยงของพันธมิตรยุทธจักร คุณเห็นรอยสักแมงป่องบนข้อมือของผู้อาวุโสที่ทุกคนนับถือ… ชายหน้ากากเหล็กในคืนนั้น",
    choices: [
      {
        label: "ประกาศความจริงแล้วท้าดวลต่อหน้าทุกคน",
        tone: "danger",
        odds: (l) => fightOdds(l, rank(l) + 1),
        survival: (l) => survivalOdds(l, rank(l) + 1),
        run: (l, _c, ok) => {
          if (ok) { l.flags.revenge = true; delete l.flags.vendetta; addFame(l, 30); addStat(l, "happiness", 30); return { text: "หน้ากากแห่งความดีงามของมันแตกสลายพร้อมร่าง วิญญาณพ่อแม่ได้ไปสู่สุคติเสียที", kind: "milestone" }; }
          if (!chance(l, survivalOdds(l, rank(l) + 1))) { kill(l, "พ่ายแพ้ต่อศัตรูคู่แค้นที่ฆ่าครอบครัว"); return bad("ฝ่ามือเดียวกับคืนนั้นฟาดลงที่อกคุณ…"); }
          return bad("คุณพ่ายแพ้ และมันกล่าวหาว่าคุณใส่ร้าย — ตอนนี้คุณกลายเป็นคนนอกกฎหมาย" + damage(l, 20, 35, "พ่ายแพ้ในการชำระแค้น"));
        },
      },
      { label: "อดทน ฝึกเพิ่มอีกสักหน่อย", run: (l) => { gainExp(l, 300); return meh("คุณกลับห้องแล้วฝึกกระบวนท่าเดียวซ้ำจนรุ่งสาง"); } },
    ],
  },
  {
    id: "m.demon_hunt",
    minAge: 16,
    maxAge: 70,
    maxTimes: 2,
    weight: (l) => (guildById(l.power?.guild)?.demonic || l.power?.hunterClass === "m_demon" ? 10 : 0),
    text: () => "ศิษย์จากสามสำนักฝ่ายธรรมะดักรอคุณที่สะพานหิน \"สาวกมาร! วันนี้เราจะกำจัดเจ้าเพื่อใต้หล้า\"",
    choices: [
      { label: "สู้", tone: "danger", odds: (l) => fightOdds(l, rank(l)), survival: (l) => survivalOdds(l, rank(l)), run: (l, _c, ok) => { if (ok) { gainExp(l, 500); addFame(l, -5); return good("คุณดูดพลังของพวกมันจนแห้งเหี่ยว ข่าวลือเรื่องคุณยิ่งน่ากลัวขึ้น"); } if (!chance(l, survivalOdds(l, rank(l)))) { kill(l, "ถูกฝ่ายธรรมะรุมสังหาร"); return bad("กระบี่สามเล่มแทงทะลุอกคุณพร้อมกัน"); } return bad("คุณหนีรอดไปได้อย่างหวุดหวิด" + damage(l, 15, 30, "ถูกฝ่ายธรรมะรุมสังหาร")); } },
      { label: "กระโดดลงแม่น้ำหนี", check: { stat: "luck", dc: 45 }, run: (l, _c, ok) => (ok ? meh("กระแสน้ำพาคุณไปไกลหลายสิบลี้") : bad("ลูกธนูตามมาถึงใต้น้ำ" + damage(l, 10, 25, "ถูกฝ่ายธรรมะรุมสังหาร"))) },
    ],
  },
  {
    id: "m.ascend",
    minAge: 50,
    maxAge: 200,
    maxTimes: 1,
    weight: (l) => (rank(l) >= 8 ? 40 : 0),
    title: "เหาะขึ้นสวรรค์",
    text: () => "ประตูสวรรค์สีทองเปิดออกเหนือยอดเขา แสงเจ็ดสีสาดลงมาที่คุณ เสียงหนึ่งดังก้องไปทั่วฟ้า \"ถึงเวลาแล้ว เซียนผู้บำเพ็ญ\"",
    choices: [
      { label: "ก้าวขึ้นสู่สวรรค์", tone: "special", run: (l) => { l.flags.ascended = true; kill(l, "เหาะขึ้นสวรรค์กลายเป็นเซียน"); return { text: "ร่างของคุณสลายเป็นแสง ทิ้งไว้เพียงตำนานบนโลกมนุษย์", kind: "milestone" }; } },
      { label: "ปฏิเสธ ขออยู่กับคนที่รัก", run: (l) => { addStat(l, "happiness", 15); return meh("ประตูสวรรค์ค่อยๆ ปิดลง… คุณเลือกเป็นมนุษย์ต่อไป"); } },
    ],
  },
];

/** ตัวเลือกวิชาสำหรับคนที่ตื่นพลังช่วงหลัง (ให้วิชาตามสเตตัสเด่น) */
function styleChoicesForLate() {
  return (["m_sword", "m_palm", "m_spear", "m_hidden", "m_medic"] as HunterClass[]).map((id) => ({
    label: `${classById(id).emoji} ${classById(id).name}`,
    show: (l: Life) => offerClassesSafe(l).includes(id),
    run: (l: Life): Outcome => {
      const r = Math.max(1, rollAwakening(l, 1));
      awaken(l, r, id);
      openHiddenSlot(l, "เส้นชีพจรทะลวง");
      return { text: `⛰️ คุณเริ่มเส้นทาง${classById(id).name} ขั้น${RL(l, r)} ในวัย ${l.age} ปี`, kind: "milestone" };
    },
  }));
}

function offerClassesSafe(l: Life): HunterClass[] {
  const keys = (["health", "smarts", "luck"] as const).slice().sort((a, b) => l.stats[b] - l.stats[a]);
  const m: Record<string, HunterClass[]> = { health: ["m_sword", "m_spear"], smarts: ["m_palm", "m_medic"], luck: ["m_hidden"] };
  return [...m[keys[0]], ...m[keys[1]]];
}

// ───────────────────────── คนธรรมดา ─────────────────────────

const MUNDANE: GameEvent[] = [
  {
    id: "m.matchmaker",
    minAge: 17,
    maxAge: 30,
    weight: (l) => (!people(l, "partner").length && !people(l, "spouse").length ? 8 : 0),
    text: () => "แม่สื่อประจำเมืองมาที่บ้าน พร้อมรายชื่อคู่ที่ 'ดวงสมพงษ์' ยาวเหยียด พ่อแม่ตาเป็นประกาย",
    choices: [
      { label: "ยอมดูตัว", run: (l) => { const p = createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -2, 3), bond: 45 }); addMoney(l, -50_000); return { text: `คุณแต่งงานกับ${shortName(p)}ตามประเพณี วันแรกที่เห็นหน้ากันคือวันแต่ง`, kind: "milestone" }; } },
      { label: "ปฏิเสธ ขอเลือกเอง", run: (l) => { for (const p of l.people) if (p.relation === "mother" || p.relation === "father") p.bond = Math.max(0, p.bond - 8); return meh("แม่บ่นไปสามวัน"); } },
    ],
  },
  {
    id: "m.exam",
    minAge: 17,
    maxAge: 40,
    maxTimes: 2,
    weight: (l) => (!l.power && l.stats.smarts >= 50 && l.job?.careerId !== "official" ? 9 : 0),
    title: "สอบขุนนาง",
    text: () => "ราชสำนักเปิดสอบจอหงวนประจำสามปี บัณฑิตทั่วแผ่นดินมุ่งหน้าสู่เมืองหลวง",
    choices: [
      {
        label: "เข้าสอบ",
        check: { stat: "smarts", dc: 70 },
        run: (l, _c, ok) => {
          if (!ok) { addStat(l, "happiness", -10); return bad("ชื่อคุณไม่อยู่ในประกาศ… รออีกสามปี"); }
          l.job = { careerId: "official", level: 1, performance: 60, years: 0 };
          addFame(l, 15);
          return { text: "📯 คุณสอบได้! ขบวนแห่จากเมืองหลวงมาถึงหมู่บ้าน ได้รับแต่งตั้งเป็นเสมียนอำเภอ", kind: "milestone" };
        },
      },
      { label: "ไม่สอบ", run: () => meh("ตำแหน่งขุนนางไม่ใช่ทางของคุณ") },
    ],
  },
  {
    id: "m.famine",
    minAge: 5,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => (l.wealth === "poor" || l.job?.careerId === "farmer" ? 6 : 2),
    text: () => "ฝนไม่ตกมาทั้งปี ข้าวในนาแห้งตาย ราคาข้าวสารแพงขึ้นสิบเท่า",
    choices: [
      { label: "แบ่งข้าวให้เพื่อนบ้าน", run: (l) => { addMoney(l, -Math.min(Math.max(0, l.money), 20_000)); addFame(l, 4); addStat(l, "health", -4); return good("ทั้งหมู่บ้านจดจำน้ำใจคุณ"); } },
      { label: "เก็บไว้กินเอง", run: (l) => { addStat(l, "happiness", -4); return meh("คุณรอดผ่านฤดูแล้งไปได้ แต่เพื่อนบ้านบางคนไม่"); } },
    ],
  },
  {
    id: "m.lantern",
    minAge: 12,
    maxAge: 70,
    weight: 5,
    text: () => "เทศกาลโคมไฟ ถนนทั้งเมืองสว่างไสว มีการทายปริศนาโคมไฟชิงรางวัล",
    choices: [
      { label: "ทายปริศนา", check: { stat: "smarts", dc: 55 }, run: (l, _c, ok) => (ok ? (addFame(l, 2), addStat(l, "happiness", 8), good("คุณทายถูกครบสิบข้อ ได้โคมกระต่ายหยกมาเป็นรางวัล")) : meh("ข้อที่สามยากเกินไป")) },
      { label: "ลอยโคมขอพร", run: (l) => { addStat(l, "happiness", 6); if (chance(l, 0.2)) addStat(l, "luck", 2); return good("โคมของคุณลอยสูงกว่าใคร"); } },
    ],
  },
  {
    id: "m.monk",
    minAge: 8,
    maxAge: 80,
    weight: 4,
    text: () => "พระธุดงค์รูปหนึ่งหยุดมองหน้าคุณที่ตลาด \"โยมมีดวงชะตาแปลกนัก กรรมเก่าหนัก แต่บุญก็ไม่น้อย\"",
    choices: [
      { label: "ขอให้ท่านทำนายต่อ", run: (l) => { addStat(l, "luck", 2); return sys("\"สิ่งที่โยมตามหาอยู่ไกล แต่คนที่โยมต้องปกป้องอยู่ใกล้นิดเดียว… อย่าให้อย่างแรกทำให้เสียอย่างหลัง\""); } },
      { label: "ถวายเงินแล้วเดินจากไป", run: (l) => { addMoney(l, -100); addStat(l, "happiness", 3); return meh("พระยิ้มให้แล้วเดินจากไปโดยไม่พูดอะไรอีก"); } },
    ],
  },
];

// ───────────────────────── ความทรงจำ (ข้อเท็จจริงของโลกยุทธภพ) ─────────────────────────

const F = worldFacts;
const pct = (l: Life) => `${Math.round(memoryOdds(l) * 100)}%`;

const MEMORY: GameEvent[] = [
  {
    id: "m.memory.death_warning",
    minAge: 0,
    maxAge: 200,
    forced: true,
    when: (l) => { const m = remembers(l, "death"); return !!m && m.age - 1 === l.age; },
    system: true,
    text: (l) => `[ความทรงจำ] ปีหน้าคือปีที่คุณตายในชาติก่อน — "${remembers(l, "death")!.text}"`,
  },
  {
    id: "m.world.cave_news",
    minAge: 14,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).secretGateAge && !remembers(l, "cave"),
    text: () => "ข่าวลือแพร่ไปทั่วยุทธภพ: เด็กเลี้ยงวัวคนหนึ่งตกน้ำตกเจ็ดชั้น แล้วกลับขึ้นมาพร้อมเพลงกระบี่ไร้เทียมทาน — ว่ากันว่าหลังม่านน้ำมีถ้ำของปรมาจารย์",
    auto: (l) => { observe(l, "cave", `อายุ ${l.age}: ถ้ำหลังน้ำตกเจ็ดชั้นมีมรดกวิชาของปรมาจารย์`); },
  },
  {
    id: "m.memory.cave",
    minAge: 14,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).secretGateAge && !!remembers(l, "cave"),
    title: "ความทรงจำ: ถ้ำหลังน้ำตก",
    text: () => "คุณจำได้ — ปีนี้เด็กเลี้ยงวัวคนนั้นจะตกน้ำตกเจ็ดชั้นและได้มรดกวิชาไป ถ้าไปก่อน… มันจะเป็นของคุณ",
    choices: [
      {
        label: (l) => `ไปที่น้ำตกก่อนใคร (อนาคตยังตรง ${pct(l)})`,
        tone: "special",
        run: (l) => {
          if (!useMemory(l)) return bad("หลังม่านน้ำ… มีแต่ผนังหินเปล่า อนาคตเปลี่ยนไปแล้ว");
          if (!l.power) {
            const r = Math.max(3, rollAwakening(l, 3));
            awaken(l, r, "m_sword");
            openHiddenSlot(l, "ได้รับมรดกวิชา");
            return { text: `คุณมุดผ่านม่านน้ำเข้าไปเจอถ้ำของปรมาจารย์กระบี่ เส้นชีพจรทะลวงในคืนเดียว (ขั้น${RL(l, r)})`, kind: "milestone" };
          }
          luckyRankUp(l, "รับมรดกวิชาจากถ้ำหลังน้ำตก");
          gainExp(l, 1000);
          return { text: "มรดกของปรมาจารย์ตกเป็นของคุณ — วาสนาที่ชาติก่อนไม่ใช่ของคุณ", kind: "milestone" };
        },
      },
      { label: "ปล่อยให้เป็นวาสนาของเด็กคนนั้น", run: (l) => { addStat(l, "happiness", 4); return meh("บางวาสนาก็ไม่ควรแย่ง"); } },
    ],
  },
  {
    id: "m.world.cult_war",
    minAge: 10,
    maxAge: 200,
    forced: true,
    when: (l) => l.age === F(l).cataclysmAge,
    title: "ลัทธิมารบุกที่ราบภาคกลาง",
    text: (l) =>
      l.flags.mEvacuated
        ? "ข่าวมาถึงหมู่บ้านบนเขาที่คุณพาครอบครัวมาหลบ: ลัทธิมารสวรรค์บุกเผาเมืองเก่าของคุณราบเป็นหน้ากลอง…"
        : "กลองศึกดังสนั่น! ทัพลัทธิมารสวรรค์หมื่นคนบุกที่ราบภาคกลาง เผาทุกหมู่บ้านที่ขวางหน้า เมืองของคุณอยู่ในเส้นทาง",
    choices: [
      {
        label: "ครอบครัวปลอดภัย",
        show: (l) => !!l.flags.mEvacuated,
        run: (l) => { observe(l, "cult_war", "ลัทธิมารเผาเมืองของคุณ"); l.flags.savedFamily = true; return sys("ครอบครัวของคุณรอดทุกคน คุณเปลี่ยนชะตาได้สำเร็จ"); },
      },
      {
        label: "ยืนหยัดปกป้องประตูเมือง",
        tone: "danger",
        show: (l) => !l.flags.mEvacuated && !!l.power,
        odds: (l) => fightOdds(l, 5, l.flags.mReady ? 0.3 : 0),
        survival: (l) => survivalOdds(l, 5, l.flags.mReady ? 0.3 : 0),
        run: (l, _c, ok) => {
          observe(l, "cult_war", "ลัทธิมารเผาเมือง และคนในครอบครัวคุณไม่รอด");
          if (ok) { addFame(l, 40); gainExp(l, 2000); luckyRankUp(l, "สังหารแม่ทัพลัทธิมาร"); l.flags.savedFamily = true; return { text: "คุณยืนเฝ้าประตูเมืองสามวันสามคืน ศพสาวกมารกองสูงเป็นภูเขา เมืองรอด!", kind: "milestone" }; }
          familyLoss(l, 0.25);
          if (!chance(l, survivalOdds(l, 5, l.flags.mReady ? 0.3 : 0))) { kill(l, "สละชีพปกป้องประตูเมืองจากลัทธิมาร"); return bad("ประตูเมืองพังลงพร้อมร่างคุณ"); }
          return bad("ประตูเมืองแตก คุณรอดมาได้แต่ไม่อาจปกป้องทุกคน" + damage(l, 15, 30, "บาดแผลจากสงครามลัทธิมาร"));
        },
      },
      {
        label: "พาครอบครัวหนีขึ้นเขา",
        show: (l) => !l.flags.mEvacuated,
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          const lost = familyLoss(l, ok ? 0.1 : 0.35);
          observe(l, "cult_war", lost ? `ลัทธิมารเผาเมืองของคุณ และคุณเสีย${lost}ไป` : "ลัทธิมารเผาเมืองของคุณ");
          if (!ok && chance(l, 0.12)) { kill(l, "ถูกทัพลัทธิมารไล่ฆ่าระหว่างอพยพ"); return bad("ทหารม้าลัทธิมารไล่ทันกลางป่าไผ่…"); }
          return lost ? bad(`คุณหนีมาได้ แต่${lost}ไม่รอด`) : good("ทั้งครอบครัวรอดมาได้อย่างปาฏิหาริย์");
        },
      },
    ],
  },
  {
    id: "m.memory.cult_prep",
    minAge: 9,
    maxAge: 200,
    forced: true,
    when: (l) => !!remembers(l, "cult_war") && l.age === F(l).cataclysmAge - 1,
    title: "ความทรงจำ: ศึกลัทธิมาร",
    text: (l) => `ปีหน้าลัทธิมารจะบุก — ชาติก่อน${remembers(l, "cult_war")!.text}`,
    choices: [
      { label: (l) => `พาครอบครัวย้ายขึ้นเขาก่อน (อนาคตยังตรง ${pct(l)})`, tone: "special", run: (l) => { if (useMemory(l)) { l.flags.mEvacuated = true; return good("คุณอ้างว่าหมอดูทำนายร้าย แล้วพาทุกคนย้ายไปบ้านพักบนเขา"); } return bad("ข่าวลือว่าลัทธิมารเปลี่ยนเส้นทางเริ่มดังขึ้น… อนาคตเบี่ยงไปแล้ว"); } },
      { label: "เตรียมตัวรบ", tone: "special", show: (l) => !!l.power, run: (l) => { l.flags.mReady = true; gainExp(l, 400); return good("คุณศึกษากระบวนทัพของลัทธิมารจากความทรงจำ"); } },
    ],
  },
];

function familyLoss(l: Life, p: number): string {
  const lost: string[] = [];
  for (const x of l.people) {
    if (!x.alive || !["father", "mother", "sibling", "spouse", "child"].includes(x.relation)) continue;
    if (chance(l, p)) { x.alive = false; lost.push(shortName(x)); for (const h of kinDeathHooks) h(l, x, true, "ทัพลัทธิมารสวรรค์"); }
  }
  if (lost.length) addStat(l, "happiness", -15 * lost.length);
  return lost.join(", ");
}

// ───────────────────────── มรดก ─────────────────────────

const LEGACY: GameEvent[] = [
  {
    id: "m.legacy.hall",
    minAge: 8,
    maxAge: 80,
    weight: (l) => (l.legacy ? 10 : 0),
    text: (l) => `คุณเดินผ่านหอบรรพชนของตระกูล${l.legacy!.lastName} ป้ายวิญญาณแผ่นใหญ่ที่สุดสลักชื่อ "${l.legacy!.founderName}" — คนที่คุณได้ยินเรื่องเล่ามาตั้งแต่เด็ก`,
    choices: [
      { label: "จุดธูปคารวะ", run: (l) => { addStat(l, "happiness", 5); addStat(l, "luck", 2); return sys("ควันธูปม้วนเป็นวงกลมรอบตัวคุณ ผู้เฝ้าหอบอกว่าท่านผู้นั้นคงพอใจที่ยังมีคนจำได้"); } },
      { label: "แก้ลำดับรุ่นที่จารึกผิด", run: (l) => { addFame(l, 1); return meh("ผู้เฝ้าหอโกรธจนหนวดสั่น"); } },
    ],
  },
  {
    id: "m.legacy.descendant",
    minAge: 16,
    maxAge: 70,
    weight: (l) => (l.legacy && !l.flags.descendant ? 12 : 0),
    prepare: (l) => { const p = createPerson(l, "friend", { age: l.age + randInt(l, -3, 3), bond: 35, lastName: l.legacy!.lastName }); return { id: p.id, name: shortName(p) }; },
    text: (l, c) => `${c.name}ทายาทตระกูล${l.legacy!.lastName}ที่ตกอับ ถูกสำนักคู่อริรังแกกลางตลาด`,
    choices: [
      { label: "ช่วยลูกหลานของตระกูลนั้น", tone: "special", run: (l, c) => { const p = l.people.find((x) => x.id === c.id); if (p) p.bond = 85; addFame(l, 4); return good(`${c.name}คุกเข่าขอบคุณ คุณลูบหัวเขาเหมือนเป็นหลานแท้ๆ`); } },
      { label: "ปล่อยไป", run: (l) => { addStat(l, "happiness", -6); return meh("ตระกูลที่คุณสร้างตกต่ำลงขนาดนี้เลยหรือ…"); } },
    ],
  },
];

export const MURIM_EVENTS: GameEvent[] = [ASSESSMENT, BREAKTHROUGH, ...CHILD, ...SECT, ...JIANGHU, ...MUNDANE, ...MEMORY, ...LEGACY];


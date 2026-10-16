// ชีวิตก่อนและหลังวันสิ้นโลก
import type { GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, shortName } from "../../engine/util";
import { fightOdds, gainExp, markTurn, survivalOdds } from "../hunter/power";
import { countryOf } from "../countries";
import { inRuins, missingPerson, scenarioNo } from "./scenario";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const before = (l: Life) => !l.flags.doomed;
const doomIn = (l: Life) => Number(l.flags.awakenAge ?? 99) - l.age;
const foe = (l: Life, d = 0) => clamp((l.power?.rank ?? 0) + d, 0, 8);

function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

// ───────────────────────── ก่อนวันสิ้นโลก ─────────────────────────

const BEFORE: GameEvent[] = [
  {
    id: "apoc.pre.novel",
    minAge: 12,
    maxAge: 40,
    when: before,
    title: "นิยายที่ไม่มีใครอ่าน",
    text: () => "เว็บนิยายออนไลน์มีเรื่องหนึ่งที่ยาวสามพันตอน ยอดอ่านทุกตอนเป็น 1 — ชื่อเรื่องคือ 'วิธีเอาตัวรอดหลังวันที่โลกพัง' คนเขียนขอบคุณผู้อ่านคนเดียวของเขาทุกตอน",
    choices: [
      {
        label: "อ่านจนจบทุกตอน",
        run: (l) => {
          l.flags.readNovel = true;
          addStat(l, "smarts", 3);
          addStat(l, "happiness", -2);
          return meh("ใช้เวลาหลายปีกว่าจะอ่านจบ ตอนจบทำให้คุณนั่งนิ่งไปทั้งคืน… คุณส่งข้อความขอบคุณคนเขียน และไม่เคยได้รับคำตอบ");
        },
      },
      { label: "อ่านไปสองตอนแล้วเลิก", run: () => meh("พล็อตซ้ำซาก ตัวเอกคิดมาก คุณกดปิดแท็บ") },
    ],
  },
  {
    id: "apoc.pre.omen",
    minAge: 6,
    maxAge: 60,
    when: (l) => before(l) && doomIn(l) <= 3 && doomIn(l) > 0,
    text: (l) =>
      pick(l, [
        "ฝนดาวตกตกหนักผิดปกติทุกคืน นักดาราศาสตร์ออกมาบอกว่า 'ไม่มีอะไรต้องกังวล'",
        "นกพิราบทั้งเมืองบินไปทางเดียวกันพร้อมกัน แล้วไม่กลับมาอีก",
        "คุณฝันเห็นหน้าต่างสีน้ำเงินลอยอยู่กลางห้อง ตื่นมาเหงื่อท่วม",
      ]),
    auto: () => "normal",
  },
  {
    id: "apoc.pre.memory",
    minAge: 6,
    maxAge: 60,
    weight: 40,
    when: (l) => before(l) && (l.regressions ?? 0) > 0 && !l.flags.knowsDoom,
    title: "คุณจำวันนั้นได้",
    system: true,
    text: (l) => `[ความทรงจำจากชาติก่อน] อีก ${doomIn(l)} ปี เวลา 19:00 น. โลกจะพัง — และคราวนี้คุณรู้ล่วงหน้า`,
    choices: [
      {
        label: "เตรียมตัวทุกอย่าง: ตุนเสบียง ฝึกร่างกาย",
        run: (l) => {
          l.flags.knowsDoom = true;
          l.flags.stockpile = 3;
          addStat(l, "health", 6);
          addMoney(l, -50_000);
          markTurn(l);
          return { text: "คุณสร้างห้องใต้ดินเล็กๆ และวิ่งทุกเช้า — ครอบครัวคิดว่าคุณบ้า แต่คุณไม่สน", kind: "milestone" };
        },
      },
      {
        label: "พยายามเตือนทุกคน",
        check: { stat: "looks", dc: 60 },
        run: (l, _c, ok) => {
          l.flags.knowsDoom = true;
          if (ok) { addFame(l, 8); for (const p of l.people) if (p.alive) p.bond = clamp(p.bond + 5, 0, 100); return good("คนส่วนใหญ่หัวเราะ แต่ครอบครัวและเพื่อนสนิทเชื่อคุณ — พวกเขาเตรียมตัวด้วย"); }
          addFame(l, -5);
          return bad("คลิปของคุณกลายเป็นมีม 'คนบ้าวันสิ้นโลก' ไปทั้งประเทศ");
        },
      },
    ],
  },
];

// ───────────────────────── หลังวันสิ้นโลก ─────────────────────────

const RUINS: GameEvent[] = [
  {
    id: "apoc.food",
    minAge: 6,
    maxAge: 90,
    maxTimes: 3,
    when: inRuins,
    title: "ข้าวกล่องสุดท้าย",
    text: () => "เสบียงในฐานเหลือพอสำหรับสามวัน เด็กผู้หญิงคนหนึ่งมองข้าวกล่องในมือคุณไม่วางตา",
    choices: [
      { label: "แบ่งให้", run: (l) => { addStat(l, "health", -4); addStat(l, "happiness", 5); addFame(l, 2); return good("เด็กคนนั้นกินจนหมดแล้วยิ้มให้คุณครั้งแรก"); } },
      { label: "กินเอง — พรุ่งนี้ต้องออกไปสู้", run: (l) => { addStat(l, "happiness", -4); return meh("คุณกินแบบไม่รู้รส"); } },
    ],
  },
  {
    id: "apoc.night_raid",
    minAge: 8,
    maxAge: 90,
    maxTimes: 0,
    weight: 6,
    when: (l) => inRuins(l) && !!l.power,
    title: "เสียงข่วนที่ประตู",
    text: () => "ตีสาม เสียงข่วนประตูเหล็กของฐานดังขึ้นพร้อมกันหลายสิบจุด ยามตะโกนว่าฝูงสัตว์อสูรมาถึงแล้ว",
    choices: [
      {
        label: "ออกไปสู้หน้าประตู",
        tone: "danger",
        odds: (l) => fightOdds(l, foe(l)),
        survival: (l) => survivalOdds(l, foe(l)),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 3); gainExp(l, 350); return good("ฝูงสัตว์อสูรแตกกระเจิงก่อนฟ้าสาง — คนในฐานเรียกคุณว่าประตูมีชีวิต"); }
          if (!chance(l, survivalOdds(l, foe(l)))) { kill(l, "ถูกฝูงสัตว์อสูรฉีกร่างหน้าประตูฐาน"); return bad("ประตูเหล็กพังลงพร้อมกับคุณ…"); }
          return bad(`ฐานเสียหายไปครึ่งหนึ่ง${hurt(l, 10, 20, "บาดแผลจากฝูงสัตว์อสูร")}`);
        },
      },
      {
        label: "เสริมกำแพงแล้วรอให้ผ่านไป",
        check: { stat: "smarts", dc: 50, bonus: (l) => (l.power?.hunterClass === "a_warden" ? 0.3 : 0) },
        run: (l, _c, ok) => (ok ? good("กำแพงที่คุณออกแบบรับได้ทั้งคืน ไม่มีใครในฐานตายเลย") : bad(`กำแพงด้านตะวันออกพัง${hurt(l, 6, 14, "กำแพงฐานพังทับ")}`)),
      },
    ],
  },
  {
    id: "apoc.raiders",
    minAge: 10,
    maxAge: 90,
    maxTimes: 2,
    when: inRuins,
    title: "แก๊งปล้นมาเก็บส่วย",
    text: () => "แก๊งปล้นผู้รอดชีวิตยี่สิบคนล้อมฐาน หัวหน้าแก๊งตะโกน \"ส่งเหรียญครึ่งหนึ่งมา ไม่งั้นพรุ่งนี้ไม่มีฐานนี้แล้ว\"",
    choices: [
      {
        label: "ออกไปท้าดวลหัวหน้าแก๊ง",
        tone: "danger",
        odds: (l) => (l.power ? fightOdds(l, foe(l, 1)) : 0.15),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 6); addMoney(l, 200_000); return good("หัวหน้าแก๊งคุกเข่ายอมแพ้ ลูกน้องครึ่งหนึ่งขอเข้าร่วมฐานคุณ"); }
          return bad(`คุณแพ้ต่อหน้าทุกคน — ฐานต้องจ่ายส่วยสองเท่า${hurt(l, 10, 22, "ถูกหัวหน้าแก๊งปล้นสังหาร")}`);
        },
      },
      { label: "จ่ายไปก่อน", run: (l) => { addMoney(l, -Math.round(Math.max(0, l.money) * 0.4)); addStat(l, "happiness", -5); return meh("แก๊งจากไปพร้อมเหรียญ และสัญญาว่าจะกลับมาอีก"); } },
    ],
  },
  {
    id: "apoc.shop",
    minAge: 8,
    maxAge: 90,
    maxTimes: 3,
    when: (l) => inRuins(l) && !!l.power && l.money >= 150_000,
    system: true,
    text: () => "[ร้านค้าของดวงดาวเปิดชั่วคราว] สินค้าแนะนำวันนี้: กล่องสุ่มจากฉากภารกิจ — 150,000 บาท",
    choices: [
      {
        label: "ซื้อกล่องสุ่ม",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          addMoney(l, -150_000);
          if (ok) { const item = pick(l, ["ยาฟื้นพลังจากร้านดวงดาว", "เสื้อเกราะจากฉากก่อน", "ขนนกหลบหนี"]); l.power!.items.push(item); return good(`ได้「${item}」!`); }
          return bad("ในกล่องคือกระดาษเขียนว่า 'ขอบคุณที่อุดหนุน' — ดวงดาวทั้งจักรวาลหัวเราะ");
        },
      },
      { label: "ปิดหน้าต่าง", run: () => meh("[ร้านค้าปิดแล้ว]") },
    ],
  },
  {
    id: "apoc.missing",
    minAge: 8,
    maxAge: 90,
    weight: 14,
    when: (l) => inRuins(l) && !!missingPerson(l),
    title: "ข่าวจากฐานทางเหนือ",
    prepare: (l) => ({ name: shortName(missingPerson(l)!) }),
    text: (_l, c) => `พ่อค้าเร่บอกว่าเห็นคนหน้าเหมือน${c.name}ที่ฐานทางเหนือ — ทางไปต้องผ่านเขตของสัตว์อสูรระดับภัยพิบัติ`,
    choices: [
      {
        label: "ออกตามหา",
        tone: "danger",
        odds: (l) => (l.power ? survivalOdds(l, foe(l, 1)) : 0.4),
        run: (l, c, ok) => {
          const p = missingPerson(l)!;
          delete l.flags.missingId;
          if (ok) { p.bond = 100; addStat(l, "happiness", 25); markTurn(l); return { text: `คุณเจอ${c.name}จริงๆ — ผอมลงครึ่งหนึ่ง แต่ยังมีชีวิต ทั้งสองคนกอดกันร้องไห้กลางลานฐาน`, kind: "milestone" }; }
          p.alive = false;
          l.flags.lossAge = l.age;
          addStat(l, "happiness", -15);
          return bad(`คุณไปถึงช้าไปสามวัน — เหลือแค่ป้ายชื่อของ${c.name}แขวนอยู่บนกำแพงผู้เสียชีวิต${hurt(l, 5, 15, "ตายระหว่างตามหาครอบครัว")}`);
        },
      },
      { label: "ฝากข้อความไปกับพ่อค้า", run: (_l, c) => meh(`คุณเขียนจดหมายถึง${c.name}ห้าหน้า ไม่รู้ว่าจะไปถึงไหม`) },
    ],
  },
  {
    id: "apoc.radio",
    minAge: 8,
    maxAge: 90,
    maxTimes: 2,
    when: inRuins,
    text: (l) => {
      const here = countryOf(l.country).name;
      const others = ["ไทย", "เกาหลีใต้", "ญี่ปุ่น", "สหรัฐฯ", "จีน"].filter((x) => x !== here);
      return `วิทยุสื่อสารจับสัญญาณได้: "…ที่นี่${pick(l, others)} เราผ่านฉากหลักที่ ${scenarioNo(l) + 1} แล้ว… ยังมีคนรอดอยู่ข้างนอก…" แล้วสัญญาณก็ขาดไป`;
    },
    auto: (l) => { addStat(l, "happiness", 4); return "good"; },
  },
  {
    id: "apoc.cult",
    minAge: 14,
    maxAge: 80,
    when: (l) => inRuins(l) && !l.power?.guild,
    title: "ลัทธิบูชาดวงดาว",
    text: () => "สาวกลัทธิบูชาดวงดาวมาเคาะประตู \"ดวงดาวคือพระเจ้า วันสิ้นโลกคือการคัดเลือก — มาอยู่กับเรา แล้วคุณจะไม่ต้องหิวอีก\"",
    choices: [
      { label: "ไปดูสักครั้ง", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => { if (ok) { addMoney(l, 100_000); return good("คุณเห็นว่าลัทธินี้แค่ขายเหรียญให้ดวงดาว — คุณแอบขนเสบียงของพวกมันออกมาได้"); } addMoney(l, -Math.round(Math.max(0, l.money) * 0.3)); return bad("คุณถูกล้างสมองไปสามเดือน กว่าจะรู้ตัว เหรียญหายไปเกือบหมด"); } },
      { label: "ปิดประตู", run: () => meh("เสียงสวดยังดังอยู่หน้าประตูอีกครึ่งชั่วโมง") },
    ],
  },
  {
    id: "apoc.thief",
    minAge: 10,
    maxAge: 90,
    when: inRuins,
    text: () => "เสบียงในห้องคุณหายไปครึ่งหนึ่ง รอยเท้าเล็กๆ นำไปสู่มุมที่เด็กกำพร้าสามคนนอนเบียดกันอยู่",
    choices: [
      { label: "ปล่อยไป แล้วให้เพิ่ม", run: (l) => { addMoney(l, -20_000); addStat(l, "happiness", 4); if (chance(l, 0.4)) createPerson(l, "ally", { age: randInt(l, 10, 14), bond: 70, job: "เด็กกำพร้าที่คุณเลี้ยง" }); return good("เด็กพวกนั้นติดตามคุณทุกที่ตั้งแต่วันนั้น"); } },
      { label: "แจ้งหัวหน้าฐาน", run: (l) => { addStat(l, "happiness", -3); return meh("เด็กๆ ถูกไล่ออกจากฐาน คุณไม่เห็นพวกเขาอีกเลย"); } },
    ],
  },
  {
    id: "apoc.ash_rain",
    minAge: 4,
    maxAge: 90,
    maxTimes: 2,
    when: inRuins,
    text: () => "ฝนเถ้าสีดำตกทั้งสัปดาห์ น้ำทุกแหล่งปนเปื้อน คนในฐานเริ่มป่วย",
    auto: (l) => { addStat(l, "health", -randInt(l, 3, 8)); return "bad"; },
  },
];

// ───────────────────────── หลังฉากสุดท้าย ─────────────────────────

const AFTER: GameEvent[] = [
  {
    id: "apoc.after.market",
    minAge: 10,
    maxAge: 95,
    when: (l) => !!l.flags.rebuilt,
    text: () => "ตลาดนัดแห่งแรกหลังวันสิ้นโลกเปิดขึ้นที่ลานจอดรถเก่า คนเอาผักที่ปลูกเองมาแลกกัน มีเสียงหัวเราะเป็นครั้งแรกในรอบหลายปี",
    auto: (l) => { addStat(l, "happiness", 10); return "good"; },
  },
  {
    id: "apoc.after.memorial",
    minAge: 10,
    maxAge: 95,
    when: (l) => !!l.flags.rebuilt,
    text: (l) => `วันรำลึกผู้เสียชีวิตจากวันสิ้นโลก ชื่อนับล้านถูกสลักบนกำแพงยาวสุดสายตา${l.flags.apocHero ? " — และรูปปั้นของคุณยืนอยู่ปลายกำแพง" : ""}`,
    auto: (l) => { addStat(l, "happiness", l.flags.apocHero ? 4 : -2); if (l.flags.apocHero) addFame(l, 5); return "normal"; },
  },
  {
    id: "apoc.after.school",
    minAge: 25,
    maxAge: 95,
    when: (l) => !!l.flags.rebuilt && !!l.power,
    title: "โรงเรียนแห่งใหม่",
    text: () => "เมืองเปิดโรงเรียนแห่งแรกหลังวันสิ้นโลก ครูใหญ่ขอให้คุณมาเล่าเรื่องฉากภารกิจให้เด็กๆ ฟัง",
    choices: [
      { label: "เล่าความจริงทั้งหมด", run: (l) => { addFame(l, 4); addStat(l, "happiness", 6); return good("เด็กๆ เงียบกริบ แล้วถามว่า 'ถ้าโลกพังอีก เราจะทำยังไง' — คุณตอบว่า 'ช่วยกัน'"); } },
      { label: "เล่าแต่เรื่องตลก", run: (l) => { addStat(l, "happiness", 8); return meh("ทั้งห้องหัวเราะจนครูต้องห้าม คุณยิ้มอยู่ทั้งวัน"); } },
    ],
  },
];

export const APOCALYPSE_EVENTS: GameEvent[] = [...BEFORE, ...RUINS, ...AFTER];

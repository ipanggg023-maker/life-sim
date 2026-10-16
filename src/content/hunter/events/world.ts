import type { GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import { addFame, addMoney, addStat } from "../../../engine/util";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

/** โลก Hunter: ข่าว Gate, ลางบอกเหตุ และ hook สำหรับ M2/M3 */
export const WORLD_EVENTS: GameEvent[] = [
  {
    id: "world.gate_news",
    minAge: 6,
    maxAge: 90,
    weight: 6,
    maxTimes: 3,
    prepare: (l) => ({
      place: pick(l, ["สยามพาราก้อน", "สนามหลวง", "ตลาดนัดจตุจักร", "สถานีหัวลำโพง", "เขาใหญ่", "พัทยา", "ท่าเรือคลองเตย"]),
      rank: pick(l, ["D", "C", "B", "A"]),
    }),
    text: (_l, c) => `📺 ข่าวด่วน: Gate แรงก์ ${c.rank} เปิดขึ้นที่${c.place} สมาคม Hunter สั่งปิดพื้นที่ 2 กิโลเมตร`,
  },
  {
    id: "world.awaken_test_ad",
    minAge: 17,
    maxAge: 22,
    weight: 10,
    text: () => "โฆษณาเด้งขึ้นมา: \"ตรวจหาศักยภาพผู้ตื่นพลังล่วงหน้า! แม่นยำ 99% เพียง 4,990 บาท\"",
    choices: [
      {
        label: "จ่ายตรวจ",
        run: (l) => {
          addMoney(l, -4990);
          l.flags.awakenTest = true;
          return meh("เครื่องสแกนส่งเสียงปี๊บยาว... ผล: \"ไม่สามารถระบุได้\" พนักงานบอกว่าเครื่องไม่เคยขึ้นแบบนี้มาก่อน");
        },
      },
      { label: "หลอกลวงชัดๆ", run: () => meh("คุณปัดโฆษณาทิ้ง") },
    ],
  },
  {
    id: "world.old_man_book",
    minAge: 10,
    maxAge: 40,
    weight: 3,
    title: "พบวาสนา?",
    text: () => "ชายแก่เคราขาวนั่งขายของเก่าใต้สะพานลอย ยื่นหนังสือปกหนังเก่าๆ ให้คุณ \"เล่มนี้รอเจ้าของมานานแล้ว ห้าสิบบาทพอ\"",
    choices: [
      { label: "ซื้อ", run: (l) => { addMoney(l, -50); l.flags.oldBook = true; return { text: "อ่านไม่ออกสักตัว แต่ทุกครั้งที่จับ ปลายนิ้วจะชาวาบๆ คุณเก็บไว้ใต้หมอน", kind: "system" }; } },
      { label: "ไม่ซื้อ", run: () => meh("พอหันกลับไปมองอีกที ชายแก่หายไปแล้ว ทั้งแผงของ") },
    ],
  },
  {
    id: "world.system_glitch",
    minAge: 14,
    maxAge: 60,
    weight: 3,
    system: true,
    text: () => "[ระบ█ ...กำลังเชื่อมต่อ... ผู้ใช้ยังไม่ผ่านเงื่อนไข — ยกเลิก] (หน้าต่างสีฟ้าแวบขึ้นมาตรงหน้าคุณครึ่งวินาที แล้วหายไป ไม่มีใครเห็นนอกจากคุณ)",
    auto: (l) => { l.flags.glitch = Number(l.flags.glitch ?? 0) + 1; },
  },
  {
    id: "world.past_life_dream",
    minAge: 5,
    maxAge: 90,
    weight: 3,
    maxTimes: 2,
    prepare: (l) => ({
      dream: pick(l, [
        "คุณยืนอยู่บนกำแพงเมืองโบราณ ถือดาบที่เปื้อนเลือด มีคนตะโกนเรียกคุณว่า 'ท่านเจ้าสำนัก'",
        "คุณสวมชุดราตรีหรูอยู่ในห้องโถงคริสตัล ทุกคนกำลังหัวเราะเยาะคุณ",
        "คุณยืนอยู่หน้า Gate สีแดงขนาดมหึมา และรู้ว่าอีกห้านาทีจะตาย",
      ]),
    }),
    text: (_l, c) => `คุณฝันประหลาด: ${c.dream} ...ตื่นมาพร้อมน้ำตา โดยไม่รู้ว่าทำไม`,
    auto: (l) => { l.flags.pastDream = true; },
  },
  {
    id: "world.gate_near",
    minAge: 12,
    maxAge: 75,
    weight: 4,
    title: "Gate Break!",
    text: () => "เสียงไซเรนดังลั่น! Gate ใกล้ๆ เกิดการแตก (Gate Break) มอนสเตอร์รูปร่างคล้ายหมาป่าสองหัวโผล่ออกมากลางถนน มีเด็กคนหนึ่งยืนตัวแข็งอยู่ข้างทาง",
    choices: [
      {
        label: "วิ่งเข้าไปอุ้มเด็กหนี",
        tone: "danger",
        check: { stat: "health", dc: 65 },
        survival: (l) => Math.min(0.95, 0.6 + (l.stats.health - 50) / 150 + (l.stats.luck - 50) / 300),
        run: (l, _c, ok) => {
          if (ok) { addFame(l, 15); addStat(l, "happiness", 12); l.flags.gateHero = true; return good("คุณอุ้มเด็กกลิ้งหลบกรงเล็บไปได้หวุดหวิด Hunter มาถึงพอดี คลิปคุณถูกแชร์ไปทั่วประเทศ"); }
          if (chance(l, 0.45)) { kill(l, "ถูกมอนสเตอร์จาก Gate Break โจมตี"); return bad("กรงเล็บฟาดลงมา... เด็กคนนั้นรอด แต่คุณไม่"); }
          addStat(l, "health", -40); addFame(l, 8);
          return bad("คุณช่วยเด็กไว้ได้ แต่โดนกรงเล็บเฉี่ยวหลังจนต้องผ่าตัดใหญ่");
        },
      },
      { label: "ตะโกนเรียกให้เด็กวิ่งมา แล้วหนี", check: { stat: "luck", dc: 50 }, run: (l, _c, ok) => ok ? good("เด็กวิ่งมาหาคุณ ทั้งสองคนหนีเข้าตึกได้ทัน") : (addStat(l, "happiness", -15), bad("เด็กไม่ได้ยิน... คุณได้แต่มองจากหลังกระจก ภาพนั้นติดตาไปอีกนาน")) },
      { label: "วิ่งหนีเอาตัวรอด", run: (l) => { addStat(l, "happiness", -8); return meh("คุณรอด ข่าวคืนนั้นบอกว่าเด็กคนนั้นก็รอดเพราะ Hunter มาทัน") ; } },
    ],
  },
  {
    id: "world.hunter_crush",
    minAge: 18,
    maxAge: 40,
    weight: 3,
    text: () => "Hunter แรงก์ A หน้าตาดีจากกิลด์ดังมานั่งโต๊ะข้างๆ คุณในร้านกาแฟ แล้วทำกาแฟหกใส่คุณ",
    choices: [
      { label: "ยิ้มแล้วบอกว่าไม่เป็นไร", check: { stat: "looks", dc: 70 }, run: (l, _c, ok) => ok ? (l.flags.hunterContact = true, addStat(l, "happiness", 8), good("เขายื่นนามบัตรกิลด์ให้ \"ถ้ามีอะไรให้ช่วย ติดต่อมาได้เลย\"")) : meh("เขาขอโทษแล้วรีบออกไปรับภารกิจ") },
      { label: "เรียกค่าเสียหายเสื้อ", run: (l) => { addMoney(l, randInt(l, 2, 5) * 1000); return meh("เขาโอนให้ทันทีโดยไม่ต่อรอง คนรวยนี่ดีจัง"); } },
    ],
  },
];

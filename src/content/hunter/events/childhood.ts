import type { GameEvent, Outcome } from "../../../engine/events";
import { chance, pick, randInt } from "../../../engine/rng";
import { addMoney, addStat, createPerson, firstPerson, hasTalent, people, shortName } from "../../../engine/util";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

export const CHILDHOOD_EVENTS: GameEvent[] = [
  {
    id: "child.first_word",
    minAge: 1,
    maxAge: 2,
    weight: 20,
    prepare: (l) => ({ word: pick(l, ["แม่", "พ่อ", "หม่ำ", "ไม่", "เกต", "แมว", "เงิน"]) }),
    text: (_l, c) => `คำแรกที่คุณพูดคือ "${c.word}"${c.word === "เกต" ? " ...ทั้งบ้านเงียบกริบ" : c.word === "เงิน" ? " พ่อแม่หัวเราะไม่ออก" : ""}`,
    auto: (l) => { addStat(l, "happiness", 3); },
  },
  {
    id: "child.fever",
    minAge: 0,
    maxAge: 5,
    weight: 8,
    text: () => "คุณเป็นไข้สูงจนต้องนอนโรงพยาบาลสามคืน",
    auto: (l) => { addStat(l, "health", -randInt(l, 4, 10)); return "bad"; },
  },
  {
    id: "child.hunter_tv",
    world: "hunter",
    minAge: 3,
    maxAge: 6,
    weight: 15,
    text: () => "คุณเห็นข่าว Hunter แรงก์ S ปราบมอนสเตอร์กลางสีลมในทีวี แล้วประกาศกับทุกคนว่า \"โตขึ้นจะเป็น Hunter!\"",
    auto: (l) => { l.flags.dreamHunter = true; addStat(l, "happiness", 4); },
  },
  {
    id: "child.amulet",
    minAge: 2,
    maxAge: 7,
    weight: 8,
    text: () => "ยายแขวนพระเครื่ององค์เล็กๆ ให้คุณ \"เอาไว้คุ้มครองหลาน\" แปลกตรงที่มันอุ่นๆ อยู่ตลอด",
    auto: (l) => { l.flags.amulet = true; addStat(l, "luck", 5); return "good"; },
  },
  {
    id: "child.sibling_born",
    minAge: 1,
    maxAge: 9,
    weight: (l) => {
      const mom = firstPerson(l, "mother");
      return mom && mom.age <= 40 && people(l, "sibling").length < 3 ? 8 : 0;
    },
    maxTimes: 2,
    prepare: (l) => {
      const p = createPerson(l, "sibling", { age: 0, bond: 60, lastName: l.lastName });
      return { name: shortName(p), g: p.gender };
    },
    text: (_l, c) => `คุณมีน้อง${c.g === "m" ? "ชาย" : "สาว"}แล้ว! ชื่อ${c.name} ...ทุกคนเลิกสนใจคุณไปหนึ่งปีเต็ม`,
  },
  {
    id: "child.bite",
    minAge: 3,
    maxAge: 5,
    weight: 12,
    text: () => "เพื่อนในห้องอนุบาลกัดแขนคุณจนเป็นรอยฟัน คุณจะทำยังไง?",
    choices: [
      {
        label: "กัดคืน!",
        check: { stat: "health", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { addStat(l, "happiness", 4); return good("คุณกัดคืนแรงกว่า เพื่อนร้องไห้จ้า ไม่มีใครกล้ามายุ่งกับคุณอีก"); }
          addStat(l, "health", -3);
          return bad("คุณกัดพลาดไปโดนโต๊ะ ฟันโยกไปหนึ่งซี่");
        },
      },
      { label: "ร้องไห้ไปฟ้องครู", run: (l) => { addStat(l, "happiness", -2); return meh("ครูให้เพื่อนขอโทษ คุณได้ขนมเป็นค่าชดเชย"); } },
      {
        label: "ยิ้มให้ แล้วชวนเป็นเพื่อน",
        run: (l) => {
          const p = createPerson(l, "friend", { age: l.age, bond: 65 });
          return good(`${shortName(p)}งงไปเลย แต่หลังจากนั้นก็กลายเป็นเพื่อนสนิทของคุณ`);
        },
      },
    ],
  },
  {
    id: "child.lost_mall",
    minAge: 4,
    maxAge: 7,
    weight: 8,
    text: () => "คุณพลัดหลงกับแม่ในห้างใหญ่ มีพี่สาวแปลกหน้าบอกว่าจะพาไปหาแม่",
    choices: [
      {
        label: "ไปกับพี่สาว",
        check: { stat: "luck", dc: 45 },
        run: (l, _c, ok) => {
          if (ok) return good("พี่สาวเป็นพนักงานห้างจริงๆ พาคุณไปประกาศเสียงตามสาย ได้เจอแม่ในห้านาที");
          addStat(l, "happiness", -10);
          return bad("เธอพาคุณเดินออกนอกห้าง... โชคดีที่ รปภ. เห็นแล้ววิ่งมาทัน คุณฝันร้ายไปหลายเดือน");
        },
      },
      { label: "ยืนรอตรงที่หลงเหมือนที่แม่สอน", run: (l) => { addStat(l, "smarts", 2); return good("แม่วิ่งกลับมาเจอคุณในสิบนาที พร้อมชมว่าฉลาดมาก"); } },
      { label: "ร้องไห้ดังที่สุดเท่าที่จะทำได้", run: () => meh("ทั้งชั้นหันมามอง แม่วิ่งมาด้วยใบหน้าแดงก่ำ") },
    ],
  },
  {
    id: "child.parents_fight",
    minAge: 5,
    maxAge: 16,
    weight: (l) => (l.wealth === "poor" ? 10 : 5),
    maxTimes: 2,
    text: () => "พ่อกับแม่ทะเลาะกันเรื่องเงินเสียงดังทั้งคืน คุณได้ยินทุกคำ",
    choices: [
      { label: "เข้าไปห้าม", check: { stat: "smarts", dc: 50 }, run: (l, _c, ok) => {
        if (ok) { addStat(l, "happiness", 2); return good("คุณพูดอะไรบางอย่างที่ทำให้ทั้งคู่หยุดแล้วกอดคุณ"); }
        addStat(l, "happiness", -6); return bad("\"เด็กไม่เกี่ยว! เข้าห้องไป!\"");
      } },
      { label: "ใส่หูฟังแล้วนอน", run: (l) => { addStat(l, "happiness", -4); return meh("คุณนอนไม่หลับทั้งคืน"); } },
    ],
  },
  {
    id: "child.ghost_house",
    minAge: 6,
    maxAge: 12,
    weight: 6,
    text: () => "เพื่อนท้าให้เข้าไปในบ้านร้างท้ายซอยตอนกลางคืน ว่ากันว่ามีผีตายโหง",
    choices: [
      {
        label: "เข้าไปคนเดียว",
        check: { stat: "luck", dc: 50 },
        run: (l, _c, ok) => {
          if (ok) { l.flags.ghostBox = true; addStat(l, "happiness", 5); return good("ไม่เจอผี แต่เจอกล่องไม้เก่าที่ข้างในมีเหรียญโบราณสลักอักษรประหลาด คุณเก็บไว้"); }
          addStat(l, "health", -6); addStat(l, "happiness", -6);
          return bad("ประตูปิดเองดังปัง คุณวิ่งหนีจนสะดุดล้มหัวแตก");
        },
      },
      { label: "ปฏิเสธ ไม่อยากตาย", run: (l) => { addStat(l, "happiness", -2); return meh("เพื่อนล้อว่าขี้ขลาดไปหนึ่งเทอม"); } },
    ],
  },
  {
    id: "child.allowance_found",
    minAge: 6,
    maxAge: 14,
    weight: 5,
    text: () => "คุณเจอแบงก์พันตกอยู่หน้าโรงเรียน",
    choices: [
      { label: "เก็บเอาไว้เอง", run: (l) => { addMoney(l, 1000); return meh("คุณซื้อการ์ดเกมไปเกือบหมด"); } },
      { label: "เอาไปให้ครู", run: (l) => { addStat(l, "happiness", 4); if (chance(l, 0.4)) addStat(l, "luck", 2); return good("ครูชมหน้าเสาธง เพื่อนทั้งโรงเรียนรู้จักชื่อคุณ"); } },
    ],
  },
  {
    id: "child.talented_kid",
    minAge: 5,
    maxAge: 10,
    weight: (l) => (hasTalent(l, "genius") || hasTalent(l, "tragic_genius") ? 25 : 0),
    text: () => "คุณแก้โจทย์เลขของพี่ ม.3 ได้ตอนอายุแค่นี้ ครูเรียกพ่อแม่มาคุยเรื่องข้ามชั้น",
    auto: (l) => { l.education.grade = Math.min(100, l.education.grade + 15); addStat(l, "happiness", 5); return "good"; },
  },
];

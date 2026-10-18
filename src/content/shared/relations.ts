// M25 — ความสัมพันธ์ลึกขึ้น: ลูกมีเรื่องราวชีวิตของตัวเอง (ดูลูกโต) + เมนู "คุย" กับทุกคน
import type { Ctx, GameEvent } from "../../engine/events";
import { pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addMoney, addStat, clamp, createPerson, shortName } from "../../engine/util";
import { tone } from "./freedom";

const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const bond = (l: Life, c: Ctx, d: number) => { const p = who(l, c); if (p) p.bond = clamp(p.bond + d, 0, 100); };
const kidAt = (lo: number, hi: number, flag: string) => (l: Life) =>
  l.people.find((p) => p.relation === "child" && p.alive && p.age >= lo && p.age <= hi && !p.tags?.includes(flag));
/** จดไว้ในตัวคนนั้นว่าเรื่องนี้เกิดแล้ว (ไม่ซ้ำกับลูกคนเดิม) · job = อาชีพใหม่ถ้ามี */
const mark = (p: Person | undefined, flag: string, job?: string) => { if (!p) return; p.tags = [...(p.tags ?? []), flag]; if (job) p.job = job; };
const kidJob = (p?: Person) => p?.job ?? "";

function kidEvent(id: string, lo: number, hi: number, title: string, text: (l: Life, c: Ctx) => string, choices: GameEvent["choices"]): GameEvent {
  return {
    id, minAge: 18, maxAge: 120, maxTimes: 4, weight: (l) => (kidAt(lo, hi, id)(l) ? 18 : 0), title,
    when: (l) => !!kidAt(lo, hi, id)(l),
    prepare: (l) => { const k = kidAt(lo, hi, id)(l)!; mark(k, id); return { pid: k.id }; },
    text, choices,
  };
}

export const RELATION_EVENTS: GameEvent[] = [
  // ───────── ลูกโต ─────────
  kidEvent("kid.school_day", 5, 7, "วันแรกที่โรงเรียน", (l, c) => `${nm(l, c)}ไม่ยอมปล่อยมือคุณที่หน้าประตูโรงเรียน`, [
    { label: "อยู่ด้วยจนเขาพร้อม", run: (l, c) => { bond(l, c, 10); return { text: `${nm(l, c)}เดินเข้าห้องเองหลังสิบนาที แล้วหันมาโบกมือ`, kind: "good" }; } },
    { label: "ให้กำลังใจแล้วกลับ", run: (l, c) => { bond(l, c, 3); return { text: `ตอนเย็น${nm(l, c)}เล่าเรื่องเพื่อนใหม่ไม่หยุด` }; } },
  ]),
  kidEvent("kid.talent", 7, 12, "พรสวรรค์ของลูก", (l, c) => `ครูบอกว่า${nm(l, c)}มีแววด้าน${pick(l, ["ดนตรี", "กีฬา", "คณิตศาสตร์", "วาดรูป", "ภาษา"])}มาก`, [
    { label: "สนับสนุนเต็มที่", run: (l, c) => { addMoney(l, -50_000); bond(l, c, 8); mark(who(l, c), "gifted"); return { text: `${nm(l, c)}เรียนพิเศษด้านนั้นและเก่งขึ้นทุกปี`, kind: "good" }; } },
    { label: "ปล่อยให้เลือกเอง", run: (l, c) => { bond(l, c, 5); return { text: `${nm(l, c)}เลือกทำสิ่งที่ชอบโดยไม่มีใครกดดัน`, kind: "good" }; } },
  ]),
  kidEvent("kid.rebel", 13, 17, "วัยต่อต้าน", (l, c) => `${nm(l, c)}เริ่มกลับบ้านดึก ปิดประตูห้อง และพูดกับคุณแค่วันละคำ`, [
    { label: "นั่งคุยกันตรงๆ", check: { stat: "smarts", dc: 55 }, run: (l, c, ok) => { bond(l, c, ok ? 12 : -5); return ok ? { text: `${nm(l, c)}ร้องไห้แล้วเล่าเรื่องที่โรงเรียน — คุณเพิ่งรู้ว่าเขาโดนแกล้ง`, kind: "good" } : { text: `${nm(l, c)}ตะโกนว่า "ไม่เข้าใจหรอก!" แล้วปิดประตูใส่`, kind: "bad" }; } },
    { label: "ให้พื้นที่ส่วนตัว", run: (l, c) => { bond(l, c, 2); return { text: "สองปีต่อมาเขาบอกว่าขอบคุณที่ไม่บังคับ" }; } },
    { label: "ลงโทษให้เข็ด", run: (l, c) => { bond(l, c, -12); return { text: `${nm(l, c)}เชื่อฟังมากขึ้น แต่ไม่เล่าอะไรให้ฟังอีก`, kind: "bad" }; } },
  ]),
  kidEvent("kid.first_love", 15, 19, "รักแรกของลูก", (l, c) => `${nm(l, c)}พาเพื่อนพิเศษมาที่บ้าน ทั้งคู่หน้าแดงตลอดมื้อเย็น`, [
    { label: "ต้อนรับอย่างอบอุ่น", run: (l, c) => { bond(l, c, 8); addStat(l, "happiness", 4); return { text: "บ้านมีเสียงหัวเราะมากขึ้น", kind: "good" }; } },
    { label: "แกล้งซักถามแบบพ่อแม่หวงลูก", run: (l, c) => { bond(l, c, -2); addStat(l, "happiness", 5); return { text: `${nm(l, c)}อายจนอยากมุดดิน แต่ภายหลังเล่าเรื่องนี้ให้หลานฟังทุกปี` }; } },
  ]),
  kidEvent("kid.career", 18, 25, "ทางเดินของลูก", (l, c) => `${nm(l, c)}ต้องเลือกเส้นทางชีวิต และอยากฟังความเห็นคุณ`, [
    ...(["หมอ", "วิศวกร", "ศิลปิน", "นักธุรกิจ", "นักกีฬา"] as const).map((j) => ({
      label: `แนะนำให้เป็น${j}`,
      run: (l: Life, c: Ctx) => { const p = who(l, c); mark(p, "career", tone(l) === "murim" ? (j === "นักกีฬา" ? "จอมยุทธ์" : j === "หมอ" ? "หมอสมุนไพร" : j) : j); bond(l, c, 4); return { text: `${nm(l, c)}เลือกเป็น${kidJob(p)} และตั้งใจเต็มที่`, kind: "good" as const }; },
    })),
    { label: "บอกว่าเลือกเองได้เลย", run: (l, c) => { const p = who(l, c); mark(p, "career", pick(l, ["นักเขียน", "เชฟ", "นักสำรวจ", "ครู", "นักดนตรี"])); bond(l, c, 8); return { text: `${nm(l, c)}เลือกเป็น${kidJob(p)} — สิ่งที่ไม่มีใครคาดคิด แต่ตาเป็นประกาย`, kind: "good" }; } },
  ]),
  kidEvent("kid.success", 22, 40, "ข่าวดีของลูก", (l, c) => `${nm(l, c)}โทรมาด้วยเสียงสั่น — ${pick(l, ["ได้เลื่อนตำแหน่งใหญ่", "ได้รางวัลระดับประเทศ", "เปิดกิจการของตัวเองสำเร็จ"])}`, [
    { label: "ไปฉลองด้วยกัน", run: (l, c) => { bond(l, c, 6); addStat(l, "happiness", 8); return { text: "คุณกอดลูกแน่นที่สุดตั้งแต่เขาเกิด", kind: "good" }; } },
    { label: "บอกว่าภูมิใจที่สุด", run: (l, c) => { bond(l, c, 10); addStat(l, "happiness", 6); return { text: `${nm(l, c)}เงียบไปนาน แล้วบอกว่ารอฟังคำนี้มาทั้งชีวิต`, kind: "good" }; } },
  ]),
  kidEvent("kid.trouble", 20, 45, "ลูกมีปัญหา", (l, c) => `${nm(l, c)}${pick(l, ["ตกงานกะทันหัน", "เป็นหนี้ก้อนใหญ่", "เลิกกับคนรักและซึมเศร้า"])} แล้วกลับมาขอพักที่บ้าน`, [
    { label: "รับกลับมาอยู่ด้วย", run: (l, c) => { bond(l, c, 12); addMoney(l, -50_000); return { text: `${nm(l, c)}พักหนึ่งปีแล้วตั้งตัวใหม่ได้`, kind: "good" }; } },
    { label: "ช่วยเงินแต่ให้ยืนเอง", run: (l, c) => { bond(l, c, 4); addMoney(l, -150_000); return { text: "เงินก้อนนั้นช่วยได้ และเขาไม่ลืมบุญคุณ" }; } },
    { label: "บอกให้แก้ปัญหาเอง", run: (l, c) => { bond(l, c, -10); return { text: `${nm(l, c)}เงียบไปหลายเดือน — แต่ก็ผ่านมันมาได้ด้วยตัวเอง`, kind: "bad" }; } },
  ]),
  kidEvent("kid.wedding", 24, 40, "ลูกแต่งงาน", (l, c) => `${nm(l, c)}จะแต่งงาน และขอให้คุณกล่าวอวยพรในงาน`, [
    { label: "กล่าวอวยพรจากใจ", check: { stat: "smarts", dc: 45 }, run: (l, c, ok) => { bond(l, c, ok ? 10 : 5); addStat(l, "happiness", 10); return ok ? { text: "แขกทั้งงานร้องไห้ตาม", kind: "good" } : { text: "คุณพูดติดๆ ขัดๆ แต่ลูกกอดคุณแน่นที่สุด", kind: "good" }; } },
    { label: "ออกค่างานทั้งหมด", run: (l, c) => { addMoney(l, -300_000); bond(l, c, 8); addStat(l, "happiness", 8); return { text: "งานแต่งที่สวยที่สุดในชีวิตลูก", kind: "good" }; } },
  ]),
  kidEvent("kid.grandchild", 26, 45, "หลานคนแรก", (l, c) => `${nm(l, c)}อุ้มทารกตัวเล็กมาให้คุณดู "นี่หลานของพ่อ/แม่นะ"`, [
    { label: "อุ้มหลาน", run: (l, c) => { bond(l, c, 8); addStat(l, "happiness", 15); l.flags.grandkids = Number(l.flags.grandkids ?? 0) + 1; return { text: "มือคุณสั่นตอนรับหลานมาอุ้ม — ครอบครัวยาวขึ้นอีกหนึ่งรุ่น", kind: "milestone" }; } },
  ]),

  // ───────── เมนูคุย (กดจากแท็บคน) ─────────
  {
    id: "talk.menu",
    minAge: 0, maxAge: 200, manual: true, maxTimes: 0,
    title: "คุยกัน",
    text: (l, c) => { const p = who(l, c); return p ? `คุณนั่งลงคุยกับ${shortName(p)} (ความผูกพัน ${p.bond})` : "ไม่มีใครอยู่ตรงนี้แล้ว"; },
    choices: [
      { label: "ถามสารทุกข์สุกดิบ", run: (l, c) => { bond(l, c, randInt(l, 3, 7)); return { text: `${nm(l, c)}เล่าเรื่องช่วงนี้ให้ฟังยาวเหยียด คุณได้รู้จักเขามากขึ้น`, kind: "good" }; } },
      { label: "ขอคำปรึกษาเรื่องชีวิต", check: { stat: "luck", dc: 45 }, run: (l, c, ok) => { bond(l, c, 4); if (ok) { addStat(l, "smarts", 2); return { text: `คำแนะนำของ${nm(l, c)}ตรงใจจนคุณเปลี่ยนวิธีคิด`, kind: "good" }; } return { text: `${nm(l, c)}แนะนำเต็มที่ แต่มันไม่ค่อยเข้ากับคุณเท่าไหร่` }; } },
      { label: "เล่าความลับให้ฟัง", run: (l, c) => { const p = who(l, c); if (p && p.bond >= 60) { bond(l, c, 12); return { text: `${nm(l, c)}จับมือคุณ "ขอบคุณที่ไว้ใจ" — ความสัมพันธ์ลึกขึ้นอีกขั้น`, kind: "good" }; } bond(l, c, -8); addStat(l, "happiness", -4); return { text: `ความลับของคุณไปถึงหูคนอื่นในสัปดาห์ต่อมา`, kind: "bad" }; } },
      { label: "ชวนไปเที่ยวด้วยกัน", run: (l, c) => { if (l.age >= 18) addMoney(l, -20_000); bond(l, c, randInt(l, 8, 14)); addStat(l, "happiness", 5); return { text: `ทริปกับ${nm(l, c)}เต็มไปด้วยเรื่องตลกที่จะเล่ากันไปอีกหลายปี`, kind: "good" }; } },
      { label: "แซวเล่น หยอกล้อ", run: (l, c) => { const p = who(l, c); if (p && p.bond >= 40) { bond(l, c, 3); addStat(l, "happiness", 4); return { text: "หัวเราะกันจนท้องแข็ง", kind: "good" }; } bond(l, c, -5); return { text: `${nm(l, c)}ไม่ขำด้วย บรรยากาศอึดอัด`, kind: "bad" }; } },
      { label: "สอนสิ่งที่คุณรู้", show: (l, c) => { const p = who(l, c); return !!p && (p.relation === "child" || p.age < l.age - 5); }, run: (l, c) => { bond(l, c, 7); return { text: `${nm(l, c)}ตั้งใจฟังแล้วถามคำถามที่ทำให้คุณคิดตาม`, kind: "good" }; } },
      { label: "ขอโทษเรื่องที่ผ่านมา", show: (l, c) => (who(l, c)?.bond ?? 100) < 50, run: (l, c) => { bond(l, c, randInt(l, 8, 18)); addStat(l, "happiness", 3); return { text: `${nm(l, c)}เงียบไปพักหนึ่ง แล้วพยักหน้า — ความหนักอึ้งที่ค้างมานานเบาลง`, kind: "good" }; } },
      { label: "ชวนเข้าทีม/ร่วมงานด้วยกัน", show: (l, c) => { const p = who(l, c); return !!p && p.relation === "friend" && p.bond >= 70 && l.age >= 16; }, run: (l, c) => { const p = who(l, c); if (p) p.relation = "ally"; return { text: `${nm(l, c)}ตอบตกลงทันที "รอคำนี้มานานแล้ว"`, kind: "good" }; } },
      { label: "ชวนลูกมาทำงานในกิจการ", show: (l, c) => { const p = who(l, c); return !!p && p.relation === "child" && p.age >= 18 && !!l.flags.bizData && l.flags.bizData !== "[]"; }, run: (l, c) => { bond(l, c, 6); mark(who(l, c), "family_biz", "ทายาทกิจการครอบครัว"); return { text: `${nm(l, c)}เข้ามาช่วยกิจการ และพาไอเดียใหม่ๆ มาด้วย`, kind: "good" }; } },
    ],
  },
];

/** ลูกบุญธรรมจากเพื่อนสนิท (เกิดขึ้นได้เมื่อเพื่อนเสียชีวิตและทิ้งลูกไว้) */
export const FRIEND_ORPHAN: GameEvent = {
  id: "kid.friend_orphan",
  minAge: 30, maxAge: 70, weight: (l) => (l.people.some((p) => p.relation === "friend" && !p.alive && p.bond >= 80) ? 6 : 0),
  title: "คำขอสุดท้ายของเพื่อน",
  text: () => "พินัยกรรมของเพื่อนสนิทที่จากไป ขอให้คุณดูแลลูกที่ยังเล็กของเขา",
  choices: [
    { label: "รับมาเลี้ยงเหมือนลูก", run: (l) => { const k = createPerson(l, "child", { age: randInt(l, 3, 10), bond: 50, lastName: l.lastName }); addStat(l, "happiness", 6); return { text: `${shortName(k)} กลายเป็นส่วนหนึ่งของครอบครัวคุณ`, kind: "milestone" }; } },
    { label: "ส่งเสียค่าเล่าเรียนแทน", run: (l) => { addMoney(l, -200_000); return { text: "เด็กคนนั้นเรียนจบ และส่งจดหมายขอบคุณมาทุกปี", kind: "good" }; } },
  ],
};

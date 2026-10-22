// พิธีบรรลุนิติภาวะ (MURIM_PLAN §8 ช่วงวัย): ชายสวมกวานตอนอายุ 20 · หญิงปักปิ่นตอนอายุ 15 พร้อมชื่อรอง (จื้อ)
// ใครเป็นผู้ประกอบพิธีขึ้นกับคนที่ยังอยู่ในชีวิตจริง (พ่อ แม่ อาจารย์ ผู้อาวุโส หรือไม่มีใครเลย)
// ผ่านพิธีแล้ว = เป็นผู้ใหญ่ในสายตาสังคม (ชื่อรองขึ้นข้างชื่อ · ผู้อาวุโสให้เกียรติ) · ไม่ได้ทำพิธี = ทำเองทีหลังได้
import type { Ctx, GameEvent } from "../../../engine/events";
import { pick } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { people, shortName } from "../../../engine/util";
import { B, BIG, C, E, G, N, type Res } from "../story/kit";

const MALE = [["จื่อหลง", "มังกรผู้เป็นปราชญ์"], ["ป๋อเยว่", "พี่ใหญ่ผู้ส่องแสง"], ["จ้งหมิง", "ผู้กลางผู้ฉลาด"], ["หยวนจือ", "รากฐานแห่งปัญญา"], ["เมิ่งเต๋อ", "ผู้เริ่มต้นด้วยคุณธรรม"], ["อวิ๋นฉาง", "เมฆที่ยาวไกล"], ["เสวียนเต๋อ", "คุณธรรมอันลึกล้ำ"], ["ป๋อเหยียน", "ผู้พูดน้อยแต่หนักแน่น"], ["จื่อจิ้ง", "ผู้สงบนิ่ง"]];
const FEMALE = [["หว่านอิง", "ดอกไม้ที่อ่อนโยน"], ["ซูอวิ๋น", "เมฆขาวบริสุทธิ์"], ["เยว่หรง", "แสงจันทร์ที่เปิดกว้าง"], ["หลิงซวง", "น้ำค้างแข็งที่เด็ดเดี่ยว"], ["ชิงหว่าน", "ความสงบยามเย็น"], ["อวี้เจิน", "หยกแท้"], ["ซินเหยา", "ดวงใจที่ส่องสว่าง"]];

export const courtesyOf = (l: Life) => (l.flags.courtesyName ? String(l.flags.courtesyName) : undefined);

/** ผู้ประกอบพิธี: พ่อ (ชาย) / แม่ (หญิง) → พ่อแม่อีกคน → อาจารย์ → ผู้อาวุโสที่สนิท */
function officiant(l: Life): Person | undefined {
  const first = l.gender === "m" ? "father" : "mother";
  const second = l.gender === "m" ? "mother" : "father";
  return (
    people(l, first).find((p) => p.alive) ??
    people(l, second).find((p) => p.alive) ??
    l.people.find((p) => p.alive && p.tags?.includes("master")) ??
    l.people.find((p) => p.alive && p.age >= l.age + 20 && p.bond >= 50)
  );
}
const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);

/** ตั้งชื่อรองและผ่านพิธี */
const named = (i: number, r: Res): Res =>
  Object.assign(
    (l: Life, c: Ctx) => {
      const list = l.gender === "m" ? MALE : FEMALE;
      const [n, meaning] = i >= 0 ? list[(Number(c.k) + i) % list.length] : pick(l, list);
      l.flags.courtesyName = n;
      l.flags.cameOfAge = true;
      const p = who(l, c);
      if (p) p.bond = Math.min(100, p.bond + 10);
      const out = r(l, c);
      return { ...out, text: `${out.text} — ชื่อรองของคุณคือ "${n}" (${meaning})` };
    },
    { fx: r.fx },
  );
const opt = (l: Life, c: Ctx, i: number) => {
  const list = l.gender === "m" ? MALE : FEMALE;
  const [n, meaning] = list[(Number(c.k) + i) % list.length];
  return `ชื่อรอง "${n}" — ${meaning}`;
};
const prep = (l: Life) => ({ pid: officiant(l)?.id ?? "", k: Math.floor((l.seed % 97) + l.age) });

export const RITE_EVENTS: GameEvent[] = [
  E("ca.capping", [20, 20], (l, c) => {
    const p = who(l, c);
    return p
      ? `วันเกิดอายุยี่สิบ — ${p.name}สวมกวานสามชั้นให้คุณต่อหน้าป้ายบรรพบุรุษ: ผ้าโพกของคนทั่วไป หมวกหนังของคนที่ถือดาบได้ และกวานของบัณฑิต แล้วถามว่าจะใช้ชื่อรองว่าอะไร`
      : "วันเกิดอายุยี่สิบ — ไม่มีพ่อแม่หรืออาจารย์เหลืออยู่จะสวมกวานให้ คุณยืนอยู่หน้าป้ายบรรพบุรุษคนเดียว";
  }, [
    C((l, c) => opt(l, c, 0), named(0, BIG("กวานถูกปักแน่นบนมวยผม — ตั้งแต่วันนี้ผู้คนเรียกคุณด้วยชื่อรอง ไม่ใช่ชื่อเล่นสมัยเด็กอีกแล้ว", { joy: 4, fame: 1 })), { show: (l, c) => !!who(l, c) }),
    C((l, c) => opt(l, c, 1), named(1, BIG("ผู้อาวุโสในตระกูลพยักหน้ารับชื่อนี้ — คุณเป็นผู้ใหญ่เต็มตัวแล้ว", { joy: 4, fame: 1 })), { show: (l, c) => !!who(l, c) }),
    C((l, c) => `ให้${who(l, c)?.name ?? "ผู้ประกอบพิธี"}ตั้งให้`, named(-1, G("ชื่อที่เขาเลือกให้มีความหวังทั้งชีวิตของเขาอยู่ในนั้น", { joy: 5 })), { show: (l, c) => !!who(l, c) }),
    C("สวมกวานให้ตัวเองหน้าป้ายบรรพบุรุษ", named(-1, N("ไม่มีใครเห็น ไม่มีใครเรียกชื่อใหม่ — แต่คุณรู้ว่าวันนี้คุณเป็นผู้ใหญ่แล้ว", { joy: -2 })), { show: (l, c) => !who(l, c) }),
    C("ไม่จัดพิธี — พิธีรีตองไม่จำเป็น", B("ผู้อาวุโสหลายคนยังเรียกคุณว่า \"เด็กคนนั้น\" ไปอีกหลายปี", { fame: -1 })),
  ], { when: (l) => l.gender === "m" && !l.flags.cameOfAge, prepare: prep, forced: true, title: "พิธีสวมกวาน" }),

  E("ca.hairpin_alone", [15, 15], (l, c) => {
    const p = who(l, c);
    return p ? `วันเกิดอายุสิบห้า — ไม่มีท่านแม่แล้ว ${p.name}จึงเป็นคนหวีผมคุณขึ้นเป็นมวยและปักปิ่นให้แทน มือสั่นเล็กน้อย` : "วันเกิดอายุสิบห้า — ไม่มีใครหวีผมให้ คุณเกล้ามวยเองหน้าน้ำในอ่าง แล้วปักปิ่นไม้ที่เหลาเอง";
  }, [
    C((l, c) => opt(l, c, 0), named(0, G("ทุกคนเรียกคุณว่า 'คุณหนู' แทน 'เด็กหญิง' แล้ว", { joy: 4, look: 1 }))),
    C((l, c) => opt(l, c, 1), named(1, G("ปิ่นนั้นอาจไม่ใช่หยก แต่คุณจะเก็บไว้ทั้งชีวิต", { joy: 4, look: 1 }))),
  ], { when: (l) => l.gender === "f" && !l.flags.cameOfAge && people(l, "mother").every((p) => !p.alive), prepare: prep, forced: true, title: "พิธีปักปิ่น" }),

  // ผ่านพิธีปักปิ่นกับแม่แล้ว (t.l.coming_of_age_f) — เลือกชื่อรอง
  E("ca.courtesy_f", [15, 17], "ท่านแม่ส่งกระดาษแดงมาสองแผ่น บนแต่ละแผ่นเขียนชื่อรองที่นางกับท่านพ่อคิดไว้ให้ \"ลูกเลือกเองเถิด\"", [
    C((l, c) => opt(l, c, 0), named(0, G("ท่านแม่ยิ้มทั้งน้ำตา", { joy: 3 }))),
    C((l, c) => opt(l, c, 1), named(1, G("ท่านพ่อพยักหน้าเงียบๆ — ชื่อนั้นเขาเป็นคนคิด", { joy: 3 }))),
  ], { when: (l) => l.gender === "f" && !!l.flags.cameOfAge && !l.flags.courtesyName, prepare: prep, forced: true, title: "ชื่อรอง" }),

  // ไม่ได้ทำพิธีตอนถึงวัย — ทำทีหลังได้เมื่อมีคนที่นับถือ
  E("ca.late", [21, 40], (l, c) => `${who(l, c) ? shortName(who(l, c)!) : "ผู้อาวุโสคนหนึ่ง"}ถามว่าทำไมคนอายุ ${l.age} อย่างคุณยังไม่มีชื่อรอง "ถ้าเจ้าไม่ว่าอะไร ข้าจะจัดพิธีให้"`, [
    C("ขอบคุณ รับพิธี", named(-1, G("พิธีเล็กๆ ในลานบ้าน มีแขกสามคน — แต่ทุกคนเรียกชื่อใหม่ของคุณดังๆ", { joy: 5, fame: 1 }))),
    C("ปฏิเสธ", N("คุณชินกับการไม่มีชื่อรองแล้ว")),
  ], { when: (l) => !l.flags.cameOfAge && l.age > 20 && !!officiant(l), prepare: prep, weight: 4, maxTimes: 1, title: "พิธีที่ล่าช้า" }),
];

// คิดค้นวิชาของตัวเองเป็นโครงการหลายปี: เลือกแนววิชา ค้นคว้าทีละปี แล้วตั้งชื่อ
// และทางวิชา (แนวทางการต่อสู้) ที่ผู้เล่นเลือกเองแล้วมีผลจริงกับการฝึก
import { injure } from "../../../engine/body";
import type { Choice, GameEvent } from "../../../engine/events";
import { runEvent } from "../../../engine/game";
import { randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addStat, clamp, log } from "../../../engine/util";
import { BIG, C, G, K, N, P, type Res } from "../story/kit";
import { STYLES, TYPE_NAME, artsOf, comprehension, styleOf, type ArtType, type StyleId } from "./arts";

const TYPES: ArtType[] = ["sword", "saber", "palm", "fist", "qinggong", "internal"];
const NEED_M = 50, NEED_ARTS = 2, NEED_COMP = 50, MIN_AGE = 25;
export const STYLE_WAIT = 5;

const fx = (r: Res, f: (l: Life) => void): Res => Object.assign(((l: Life, c: Parameters<Res>[1]) => { f(l); return r(l, c); }) as Res, { fx: r.fx });

const skilled = (l: Life) => artsOf(l).filter((a) => a.m >= NEED_M).length;
const proj = (l: Life) => Number(l.flags.artProj ?? 0);
export const artProject = (l: Life) => (l.flags.artProjType ? { type: String(l.flags.artProjType) as ArtType, name: TYPE_NAME[String(l.flags.artProjType) as ArtType], done: proj(l) } : undefined);
const step = (l: Life) => Math.round(10 + comprehension(l) / 6 + skilled(l) * 3);

/** เหตุผลที่ยังเริ่มไม่ได้ · undefined = เริ่มได้ */
export function createLocked(l: Life): string | undefined {
  if (!l.power) return "ยังไม่มีวิชาลมปราณ";
  if (l.flags.createdArt) return "คุณคิดค้นวิชาของตัวเองไปแล้ว";
  if (l.age < MIN_AGE) return `อายุ ${MIN_AGE}+`;
  if (skilled(l) < NEED_ARTS) return `ต้องชำนาญใหญ่อย่างน้อย ${NEED_ARTS} วิชา (ตอนนี้ ${skilled(l)})`;
  if (comprehension(l) < NEED_COMP) return `ความเข้าใจต้องถึง ${NEED_COMP} (ตอนนี้ ${comprehension(l)})`;
  if (l.doneThisYear.includes("artProj")) return "ปีนี้ค้นคว้าไปแล้ว";
}
export const openCreate = (l: Life) => { l.doneThisYear.push("artProj"); runEvent(l, artProject(l) ? "mw.art.study" : "mw.art.begin"); };

function finish(l: Life, name: string) {
  const type = String(l.flags.artProjType) as ArtType;
  artsOf(l).push({ id: `own_${l.age}`, m: 30, src: "คิดค้นเอง", since: l.age, own: { name, type, school: Number(l.flags.m17Align ?? 0) <= -40 ? "demonic" : "neutral" } });
  l.flags.createdArt = name;
  delete l.flags.artProj; delete l.flags.artProjType;
  addFame(l, 6);
  log(l, `📜 「${name}」ถือกำเนิดขึ้นในโลก`, "milestone");
}

const add = (l: Life, d: number) => { l.flags.artProj = clamp(proj(l) + d, 0, 100); };

const nameChoice = (i: number): Choice => {
  const WORDS = ["สายลมพลิ้ว", "จันทร์ร้าง", "คลื่นพันชั้น", "ดอกท้อร่วง", "ใต้หล้าเงียบงัน", "ไร้นาม"];
  const title = (l: Life) => `${["เพลง", "กระบวน", "วิถี"][i]}${TYPE_NAME[String(l.flags.artProjType) as ArtType]}${WORDS[(l.age + i * 2) % WORDS.length]}`;
  return C((l: Life) => `ตั้งชื่อว่า「${title(l)}」`, (l, c) => { const n = title(l); finish(l, n); return BIG(`คุณเขียนชื่อนี้ลงบนหน้าแรกของสมุด「${n}」เป็นวิชาที่ไม่มีใครเคยเห็น`, { joy: 10 })(l, c); });
};

export const CREATION_EVENTS: GameEvent[] = [
  {
    id: "mw.art.begin", minAge: 20, maxAge: 130, manual: true, maxTimes: 0, title: "เริ่มคิดค้นวิชา",
    text: () => "สิ่งที่คุณเรียนมาทั้งหมดเริ่มไม่พอแล้ว คุณเปิดสมุดเปล่าเล่มหนึ่ง จะหลอมวิชาไปทางไหน",
    choices: [
      ...TYPES.map((t): Choice => C(`มุ่งไปทาง${TYPE_NAME[t]}`, fx(N(`คุณเขียนคำว่า${TYPE_NAME[t]}ไว้กลางหน้าแรก งานนี้จะกินเวลาหลายปี`, {}), (l) => { l.flags.artProjType = t; l.flags.artProj = 0; }))),
      C("ยังไม่เริ่มตอนนี้", N("คุณปิดสมุดลงอีกครั้ง", {})),
    ],
  },
  {
    id: "mw.art.study", minAge: 20, maxAge: 130, manual: true, maxTimes: 0, title: "ค้นคว้าวิชา",
    text: (l) => `วิชา${artProject(l)?.name ?? ""}ของคุณคืบหน้า ${proj(l)}/100 ปีนี้จะลงมืออย่างไร`,
    choices: [
      K("ทดลองทีละท่าอย่างระวัง", "smarts", 40, fx(G("สมุดหนาขึ้นอีกยี่สิบหน้า ทุกหน้ามีเหตุผลรองรับ", {}), (l) => add(l, step(l))), fx(N("ท่าที่คิดไว้ใช้ไม่ได้จริง คุณขีดฆ่าไปครึ่งเล่ม", {}), (l) => add(l, Math.round(step(l) / 3)))),
      P("เดินลมปราณผ่านเส้นทางที่ไม่มีใครเคยใช้", (l) => clamp(0.45 + comprehension(l) / 220 + (l.stats.smarts - 50) / 250, 0.1, 0.9), fx(G("เส้นทางนั้นเปิดออก คุณเห็นทั้งวิชาในชั่วลมหายใจเดียว", {}), (l) => add(l, step(l) * 2)), ((l, c) => { addStat(l, "health", -randInt(l, 8, 16)); return N(`ลมปราณไหลย้อนกลางคัน คุณกระอักเลือดลงบนสมุด${injure(l, "meridians", "internal", 1, "คิดค้นวิชาผิดทาง")}`, {})(l, c); }) as Res, { tone: "danger" }),
      C("พักงานนี้ไว้ก่อน", N("คุณวางพู่กัน ปีนี้ไม่แตะสมุด", {})),
    ],
  },
  {
    id: "mw.art.name", minAge: 20, maxAge: 130, forced: true, maxTimes: 0, title: "ตั้งชื่อวิชา",
    when: (l) => !!l.flags.artProjType && proj(l) >= 100,
    text: () => "ท่าสุดท้ายลงตัว คุณลืมตาขึ้นตอนรุ่งสาง วิชานี้ยังไม่มีชื่อ",
    choices: [nameChoice(0), nameChoice(1), nameChoice(2)],
  },
];

/** เลือกทางวิชา: เปลี่ยนได้ทุก 5 ปี */
export const styleLocked = (l: Life): string | undefined => {
  const wait = Number(l.flags.mwStyleAt ?? -99) + STYLE_WAIT - l.age;
  return !l.power ? "ยังไม่มีวิชาลมปราณ" : wait > 0 ? `เปลี่ยนได้อีกใน ${wait} ปี` : undefined;
};
export function setStyle(l: Life, id: StyleId) {
  if (styleLocked(l) || styleOf(l) === id) return;
  l.flags.mwStyle = id; l.flags.mwStyleAt = l.age;
  log(l, `คุณตัดสินใจเดิน${STYLES[id].name}`, "good");
}
export const styleLine = (l: Life) => { const s = styleOf(l); return s ? `${STYLES[s].name} · ${STYLES[s].effect}` : undefined; };

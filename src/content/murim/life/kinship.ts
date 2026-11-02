// การกระทำรายคนในแท็บผู้คน: อบรมลูก หาคู่ให้ลูก ไปคารวะอาจารย์ อบรมศิษย์ ปรึกษาคู่ชีวิต
// ระบบเดิม (hh.child_path · hh.heir · md.*) เกิดขึ้นเองตามเวลา ไฟล์นี้ให้ผู้เล่นเป็นฝ่ายลงมือ
import type { Choice, Ctx, GameEvent } from "../../../engine/events";
import { runEvent, yearHooks } from "../../../engine/game";
import { chance } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { log, shortName } from "../../../engine/util";
import { feel, relOf, remember } from "../../../engine/npc";
import { artInfo, artsOf } from "../martial/arts";
import { B, C, G, K, N, P, PAY, ab, nm, who, type Res } from "../story/kit";
import { startMartial } from "./npcMartial";

const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });

/** ตัวนับเล็กๆ ที่เก็บไว้ใน tag ของคนนั้น */
const count = (p: Person, k: string) => Number(p.tags?.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1) ?? 0);
const bump = (p: Person, k: string) => { const n = count(p, k) + 1; p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith(`${k}:`)), `${k}:${n}`]; };
const mark = (p: Person, t: string) => { if (!p.tags?.includes(t)) p.tags = [...(p.tags ?? []), t]; };

const bestArt = (l: Life) => artsOf(l).sort((a, b) => b.m - a.m)[0];
const MASTER_WAIT = 3;

export const isSovereign = (p: Person) => !!p.tags?.includes("sovereign");
export const isPrincess = (p: Person) => !!p.tags?.includes("princess");

export interface PersonAction { id: string; label: string; locked?: string; run: (l: Life) => void }

const yearly = (l: Life, p: Person, id: string) => (l.doneThisYear.includes(`pa:${id}:${p.id}`) ? "ปีนี้ทำไปแล้ว" : undefined);
const open = (id: string, eventId: string) => (p: Person) => (l: Life) => { l.doneThisYear.push(`pa:${id}:${p.id}`); runEvent(l, eventId, { pid: p.id }); };

/** ปุ่มพิเศษของคนคนนี้ตามความสัมพันธ์ */
export function personActions(l: Life, p: Person): PersonAction[] {
  if (l.worldId !== "murim" || !p.alive || l.age < 16) return [];
  const out: PersonAction[] = [];
  const add = (id: string, label: string, eventId: string, locked?: string) => out.push({ id, label, locked: locked ?? yearly(l, p, id), run: (x) => open(id, eventId)(p)(x) });
  if (isSovereign(p)) add("audience", "เข้าเฝ้า", "qn.audience");
  else if (p.relation === "spouse") add("spouse", "ปรึกษาหารือ", "hh.a_spouse");
  if (p.relation === "child" && p.age >= 6 && p.age <= 17) add("raise", "อบรมลูก", "hh.a_raise");
  if (p.relation === "child" && p.age >= 18 && !p.tags?.includes("wed")) add("match", "หาคู่ให้ลูก", "hh.a_match");
  if (p.tags?.includes("master")) {
    const wait = Number(l.flags.paMaster ?? -99) + MASTER_WAIT - l.age;
    add("master", "ไปคารวะอาจารย์", "hh.a_master", wait > 0 ? `อีก ${wait} ปี` : undefined);
  }
  if (p.tags?.includes("disciple")) add("disciple", "อบรมศิษย์", "hh.a_disciple");
  return out;
}

const scene = (id: string, title: string, text: (l: Life, c: Ctx) => string, choices: Choice[]): GameEvent => ({ id, minAge: 0, maxAge: 130, manual: true, maxTimes: 0, title, text, choices });

export const KINSHIP_EVENTS: GameEvent[] = [
  scene("hh.a_raise", "อบรมลูก", (l, c) => `${nm(l, c)}อายุ ${who(l, c)?.age ?? ""} ปี ปีนี้คุณจะใส่ใจเรื่องอะไรเป็นพิเศษ`, [
    K("สอนอ่านเขียนด้วยตัวเอง", "smarts", 40, act(G("เด็กคัดตัวหนังสือได้เรียบขึ้นทุกเดือน", { joy: 2, feel: { respect: 3 } }), (l, c) => { const p = who(l, c); if (p) bump(p, "edu"); }), N("คุณสอนไปโกรธไป เด็กจำได้แค่เสียงคุณ", { feel: { love: -2 } })),
    K("พาฝึกลมปราณพื้นฐาน", "smarts", 45, act(G("เด็กยืนท่าม้าได้นานกว่าเดิมสองเท่า แล้วล้มหัวเราะ", { joy: 2, feel: { respect: 4 } }), (l, c) => { const p = who(l, c); if (p) bump(p, "mar"); }), N("เด็กซ้อมจนเท้าพองแล้วไม่ยอมซ้อมอีกทั้งฤดู", {}), { show: (l) => artsOf(l).length > 0 }),
    C("เข้มงวดเรื่องวินัย", act(N("ไม่มีใครในบ้านกล้ากินข้าวก่อนคุณนั่ง เด็กทำงานเรียบร้อยขึ้น แต่เลิกเล่าเรื่องให้คุณฟัง", { feel: { love: -4, respect: 4 } }), (l, c) => { const p = who(l, c); if (p) bump(p, "edu"); })),
    C("ปล่อยให้เป็นเด็ก พาไปเล่น", G("คุณกับลูกจับปลาไม่ได้สักตัวทั้งวัน แล้วกลับบ้านเปียกทั้งคู่", { joy: 4, feel: { love: 6, trust: 4 } })),
  ]),

  scene("hh.a_match", "หาคู่ให้ลูก", (l, c) => `${nm(l, c)}อายุ ${who(l, c)?.age ?? ""} ปีแล้ว แม่สื่อเริ่มแวะมาบ้าน`, [
    PAY("สู่ขอลูกหลานตระกูลพ่อค้าใหญ่", 30, act(G("สองบ้านแลกของหมั้นกันเต็มลาน ตระกูลคุณมีคนหนุนหลังเรื่องเงินแล้ว", { fame: 3, tael: 50, feel: { respect: 3 } }), (l, c) => { const p = who(l, c); if (p) mark(p, "wed"); })),
    K("ผูกดองกับตระกูลยุทธ์", "looks", 55, act(G("ประมุขตระกูลยุทธ์ยอมรับคำสู่ขอ คนในยุทธภพเริ่มเกรงใจชื่อตระกูลคุณ", { fame: 6, feel: { respect: 3 } }), (l, c) => { const p = who(l, c); if (p) mark(p, "wed"); }), N("ฝ่ายนั้นปฏิเสธอย่างสุภาพ แล้วเล่าเรื่องนี้ให้คนอื่นฟัง", { fame: -1 })),
    C("ให้ลูกเลือกเอง", act(G("ลูกเลือกคนที่ทำให้หัวเราะได้ คุณนั่งดื่มเหล้ามงคลอย่างสบายใจ", { joy: 6, feel: { love: 10, trust: 6 } }), (l, c) => { const p = who(l, c); if (p) mark(p, "wed"); })),
    C("ยังไม่ถึงเวลา", N("คุณส่งแม่สื่อกลับไป", {})),
  ]),

  scene("hh.a_master", "ไปคารวะอาจารย์", (l, c) => `คุณเดินทางไปคารวะ${nm(l, c)} ท่านนั่งชงชาอยู่ใต้ต้นสน`, [
    K("ขอคำชี้แนะเรื่องวิชา", "smarts", 45, act(G((l) => `ท่านแตะข้อศอกคุณเบาๆ แล้วถามคำถามเดียว คุณคิดตามจนค่ำ${bestArt(l) ? ` ความเข้าใจใน「${artInfo(bestArt(l)).name}」ลึกขึ้น` : ""}`, { feel: { respect: 3 } }), (l) => { l.flags.paMaster = l.age; const a = bestArt(l); if (a) a.m = Math.min(100, a.m + 6); }), act(N("ท่านส่ายหน้า \"ยังไม่ถึงเวลา\" แล้วรินชาให้คุณอีกถ้วย", {}), (l) => { l.flags.paMaster = l.age; })),
    PAY("ถวายของบำรุงร่างกาย", 10, act(G("ท่านบ่นว่าสิ้นเปลือง แต่เก็บไว้ที่หัวเตียง", { joy: 3, feel: { love: 8, loyalty: 4 } }), (l) => { l.flags.paMaster = l.age; })),
    C("นั่งฟังท่านเล่าเรื่องเก่า", act(N("เรื่องเดิมที่ฟังมาสิบรอบ คุณยังหัวเราะตรงจุดเดิม", { joy: 3, feel: { love: 4 } }), (l) => { l.flags.paMaster = l.age; })),
  ]),

  scene("hh.a_disciple", "อบรมศิษย์", (l, c) => `${nm(l, c)}ยืนรออยู่กลางลานฝึกตั้งแต่ก่อนรุ่งสาง`, [
    K("สอนวิชาด้วยตัวเอง", "smarts", 40, act(G("ศิษย์ทำท่าเดิมซ้ำจนพื้นลานเป็นรอย แล้วเข้าใจในที่สุด", { feel: { loyalty: 5, respect: 4 } }), (l, c) => { const p = who(l, c); if (!p) return; if (!p.martial) startMartial(l, p); if (p.martial) p.martial.xp = Math.min(100, p.martial.xp + 20); }), N("คุณอธิบายไม่ชัดเอง ศิษย์ไม่กล้าถาม", {})),
    P("ทดสอบใจศิษย์", ab(0.5, "smarts", 0.6), (l, c) => { const p = who(l, c); const r = p ? relOf(p).loyalty : 0; if (p) mark(p, "tested"); return (r >= 40 ? G(`คุณทิ้งถุงเงินไว้กลางทาง ${nm(l, c)}เดินเอามาคืนโดยไม่เปิดดู คนนี้ไว้ใจได้`, { feel: { trust: 5 } }) : B(`คุณทิ้งถุงเงินไว้กลางทาง ${nm(l, c)}เปิดดูก่อนส่งคืน และเงินขาดไปสองเหรียญ คุณเริ่มรู้แล้วว่าต้องระวังอะไร`, {}))(l, c); }, N("ศิษย์รู้ทันว่าถูกทดสอบ แล้วรู้สึกเสียใจ", { feel: { trust: -4 } })),
    C("แต่งตั้งเป็นศิษย์เอก", act(G("ป้ายศิษย์เอกแขวนที่เอวเขา ถ้าวันหนึ่งคุณจากไป คนนี้คือคนแรกที่จะสืบวิชา", { feel: { loyalty: 15, love: 5 } }), (l, c) => { const p = who(l, c); for (const o of l.people) if (o.tags?.includes("chosen")) o.tags = o.tags.filter((t) => t !== "chosen"); if (p) { mark(p, "chosen"); remember(l, p, "chosen", "ถูกแต่งตั้งเป็นศิษย์เอก", 3, {}); } }), { show: (l, c) => { const p = who(l, c); return !!p && p.age >= 18 && !p.tags?.includes("chosen"); } }),
    C("ปล่อยให้ฝึกเอง", N("คุณนั่งดูอยู่บนระเบียง ไม่พูดอะไร", {})),
  ]),

  scene("hh.a_spouse", "ปรึกษาหารือ", (l, c) => `ค่ำนี้คุณกับ${nm(l, c)}นั่งคุยกันตามลำพังหลังเก็บจานชาม`, [
    C("คุยเรื่องอนาคตของบ้าน", G("ตัวเลขในบัญชีไม่ได้ดีขึ้น แต่คุณไม่ได้แบกมันคนเดียวแล้ว", { joy: 4, feel: { trust: 6 } })),
    K("ขอให้ช่วยคิดเรื่องที่ติดอยู่", "smarts", 40, G("คำพูดสั้นๆ ประโยคเดียวแก้เรื่องที่คุณคิดไม่ออกมาทั้งเดือน", { iq: 1, feel: { respect: 5 } }), N("คุณสองคนคิดไม่ออกทั้งคู่ แล้วเข้านอน", {})),
    C("ปรับความเข้าใจเรื่องที่ค้างคาใจ", (l, c) => { const p = who(l, c); if (p) feel(p, { grudge: -12, jealousy: -10 }); return G("คุณเป็นฝ่ายพูดก่อน มันยากกว่าที่คิด แต่คืนนี้นอนหลับ", { joy: 3 })(l, c); }, { show: (l, c) => { const p = who(l, c); return !!p && relOf(p).grudge + relOf(p).jealousy >= 15; } }),
  ]),
];

/** ลูกอายุครบ 18: สิ่งที่ปลูกฝังมาออกผล */
yearHooks.push((l) => {
  if (l.worldId !== "murim") return;
  for (const p of l.people) {
    if (!p.alive || p.relation !== "child" || p.age !== 18 || p.tags?.includes("grown")) continue;
    mark(p, "grown");
    const edu = count(p, "edu"), mar = count(p, "mar"), path = p.tags?.find((t) => t.startsWith("path:"));
    if (mar + (path === "path:sect" ? 2 : 0) >= 3) {
      if (!p.martial) startMartial(l, p, chance(l, 0.2 + mar * 0.05) ? 2 : 1);
      log(l, `${shortName(p)}อายุครบสิบแปด วิชาที่คุณปลูกฝังมาทำให้เขาเป็นคนของยุทธภพแล้ว`, "good");
    } else if (edu + (path === "path:scholar" ? 2 : 0) >= 3) {
      p.job = "ขุนนางท้องถิ่น";
      log(l, `${shortName(p)}อายุครบสิบแปดและสอบเข้ารับราชการได้ ตระกูลคุณมีคนในที่ว่าการแล้ว`, "good");
    } else if (edu + mar >= 2) {
      p.job ??= "ผู้ดูแลกิจการ";
      log(l, `${shortName(p)}อายุครบสิบแปด เป็นคนรู้เรื่องรู้ราวและเลี้ยงตัวเองได้`, "good");
    }
  }
});

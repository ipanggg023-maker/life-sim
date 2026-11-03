// แท็บอาชีพ: ที่ทำงานมีเจ้านายและเพื่อนร่วมงานที่จำสิ่งที่คุณทำ · ผลงานขึ้นกับนิสัยที่เหมาะกับงาน ข่าวลือ และคนรอบตัว
// เรื่องในที่ทำงานมีช่องของตัวเองทุกปี · การเลื่อนขั้นต้องแข่งกับเพื่อนร่วมงาน · เรื่องเก่าที่ฉาวตามมาถึงที่ทำงานได้
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { feel, relOf, remember } from "../../engine/npc";
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp, createPerson, log, shortName } from "../../engine/util";
import { careerById } from "../core/careers";
import { ECHO, seedsOf, tagged } from "./conseq";
import { B, BIG, C, E, G, K, N, P, PAY } from "./kit";
import { lean, personaOf, type Persona } from "./persona";
import { spread, talkHere } from "./rumors";

/** นิสัยที่แต่ละงานต้องการ · บวก = ต้องการฝั่งบวกของแกนนั้น */
export const CAREER_FIT: Record<string, Partial<Persona>> = {
  ft_knight: { c: 8, h: 6, f: 3 }, ft_soldier: { c: 8 }, ft_gladiator: { c: 8, m: -3 }, ft_priest: { f: 9, m: 5 }, ft_thief: { h: -9, c: 3 },
  ft_merchant: { h: -3, c: 3 }, ft_diplomat: { h: -4, m: 3 }, ft_courtier: { h: -5 }, ft_scholar: { h: 6, c: -3 }, ft_alchemist: { c: 3, f: -4 },
  ft_mage: { f: -3, c: 3 }, ft_bard: { c: 4 }, ft_ranger: { m: 3, c: 4 }, ft_sailor: { c: 6 }, ft_miner: { c: 4 }, ft_farmer: { h: 5, m: 3 },
  ft_smith: { h: 6 }, ft_chef: { m: 3 }, ft_inn: { m: 4, h: 2 }, ft_tamer: { m: 7 }, ft_enchanter: { h: 4 }, ft_wandwright: { h: 4 },
  ft_cartographer: { c: 6, h: 3 }, ft_dragonkeeper: { m: 6, c: 5 },
};
/** งานที่ต้องเจอผู้คน ชื่อเสียงมีผลมาก */
const PUBLIC = new Set(["ft_courtier", "ft_diplomat", "ft_priest", "ft_knight", "ft_bard", "ft_inn", "ft_merchant", "ft_chef"]);

const cid = (l: Life) => (l.job?.careerId.startsWith("ft_") ? l.job.careerId : undefined);
const circle = (l: Life, role?: "boss" | "mate") => { const c = cid(l); return c ? l.people.filter((p) => p.alive && p.tags?.includes(`work:${c}`) && (!role || p.tags.includes(role))) : []; };
export const bossOf = (l: Life) => circle(l, "boss")[0];
export const matesOf = (l: Life) => circle(l, "mate");
const titleOf = (l: Life) => { const c = l.job && careerById(l.job.careerId); return c ? c.titles[l.job!.level - 1] : ""; };
const jobName = (l: Life) => careerById(l.job?.careerId ?? "")?.name ?? "งาน";

/** มีงานใหม่: เจ้านายหนึ่งคน เพื่อนร่วมงานสองคน · งานเก่ากลายเป็นอดีตเพื่อนร่วมงาน */
function ensureCircle(l: Life) {
  for (const p of l.people) {
    const t = p.tags?.find((x) => x.startsWith("work:"));
    if (t && t !== `work:${cid(l)}`) p.tags = [...p.tags!.filter((x) => !x.startsWith("work:") && x !== "boss" && x !== "mate"), "work_ex"];
  }
  const c = cid(l);
  if (!c || l.age < 14) return;
  const job = careerById(c)!;
  if (!bossOf(l)) {
    const b = createPerson(l, "ally", { age: Math.max(30, l.age + randInt(l, 10, 25)), bond: 40 });
    b.job = `หัวหน้า${job.name}`;
    b.tags = [...(b.tags ?? []), `work:${c}`, "boss"];
  }
  while (matesOf(l).length < 2) {
    const m = createPerson(l, "ally", { age: Math.max(16, l.age + randInt(l, -6, 6)), bond: 40 });
    m.job = `เพื่อนร่วมงาน${job.name}`;
    m.tags = [...(m.tags ?? []), `work:${c}`, "mate"];
  }
}

export interface Factor { label: string; value: number }
/** ทำไมผลงานขึ้นหรือลงปีนี้ · ใช้ทั้งคำนวณและแสดงในแท็บอาชีพ */
export function workFactors(l: Life): Factor[] {
  const c = cid(l);
  if (!c) return [];
  const out: Factor[] = [];
  const b = bossOf(l);
  if (b) { const r = relOf(b); // วัดจากความรู้สึกตั้งต้นของเจ้านายคนใหม่ ไม่ใช่จากศูนย์กลางห้าสิบ
    const v = clamp(Math.round((r.respect - 35) / 12 + (r.trust - 30) / 16 - r.grudge / 20), -5, 5); if (v) out.push({ label: v > 0 ? `${shortName(b)}เจ้านายเห็นฝีมือคุณ` : `${shortName(b)}เจ้านายไม่ปลื้มคุณ`, value: v }); }
  const fit = CAREER_FIT[c];
  if (fit) { const p = personaOf(l); let s = 0; for (const k of Object.keys(fit) as (keyof Persona)[]) s += (fit[k] ?? 0) * p[k]; const v = clamp(Math.round(s / 200), -4, 5); if (v) out.push({ label: v > 0 ? "นิสัยของคุณเหมาะกับงานนี้" : "นิสัยของคุณขัดกับงานนี้", value: v }); }
  if (PUBLIC.has(c)) { const talk = talkHere(l); const h = talk.reduce((s, r) => s + r.tone * r.heat, 0); const v = clamp(Math.round(h / 50), -4, 4); if (v) out.push({ label: v > 0 ? "ชื่อเสียงดีช่วยงานของคุณ" : "ข่าวลือเสียๆ ทำให้ลูกค้าหนี", value: v }); }
  const ms = matesOf(l);
  if (ms.length) { const s = ms.reduce((a, m) => { const r = relOf(m); return a + r.love + r.loyalty - r.grudge - r.jealousy; }, 0) / ms.length; const v = clamp(Math.round((s - 50) / 25), -3, 3); if (v) out.push({ label: v > 0 ? "เพื่อนร่วมงานช่วยคุณ" : "เพื่อนร่วมงานไม่เอาด้วย", value: v }); }
  return out;
}

const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const mem = (k: string, text: string, w: 1 | 2 | 3, d: Parameters<typeof feel>[1]) => (l: Life, c: Ctx) => { const p = who(l, c); if (p) remember(l, p, k, text, w, d); };
const bossMem = (k: string, text: string, w: 1 | 2 | 3, d: Parameters<typeof feel>[1]) => (l: Life) => { const b = bossOf(l); if (b) remember(l, b, k, text, w, d); };
/** ผลเสียในที่ทำงานเบากว่าผลดี · พลาดครั้งเดียวไม่ควรตกงาน */
const perf = (n: number) => (l: Life) => { if (l.job) l.job.performance = clamp(l.job.performance + (n < 0 ? Math.round(n * 0.6) : n), 0, 100); };
const both = (...fs: ((l: Life, c: Ctx) => void)[]) => (l: Life, c: Ctx) => { for (const f of fs) f(l, c); };
const withMate = { when: (l: Life) => matesOf(l).length > 0, prepare: (l: Life): Ctx => ({ pid: pick(l, matesOf(l)).id }) };
const withBoss = { when: (l: Life) => !!bossOf(l), prepare: (l: Life): Ctx => ({ pid: bossOf(l)!.id }) };
const W = (id: string, title: string, text: (l: Life, c: Ctx) => string, choices: GameEvent["choices"], o: { when?: (l: Life) => boolean; prepare?: (l: Life) => Ctx; maxTimes?: number; weight?: number } = {}): GameEvent => ({ ...E(`ft.wk.${id}`, [14, 900], text, choices!, { title, maxTimes: o.maxTimes ?? 2, when: o.when, prepare: o.prepare, weight: o.weight }), manual: true });

export const WORK_EVENTS: GameEvent[] = [
  W("credit", "ผลงานที่ถูกขโมย", (l, c) => `${nm(l, c)}เพื่อนร่วมงานเอางานที่คุณทำทั้งเดือนไปเสนอเจ้านายในชื่อตัวเอง`, [
    tagged(K("ยื่นหลักฐานให้เจ้านาย", "smarts", 50, G("เจ้านายรู้ความจริง และเรียกคุณไปคุยเรื่องอนาคต", {}, both(perf(10), bossMem("truth", "คุณพิสูจน์ได้ว่างานเป็นของคุณ", 2, { respect: 10 }), mem("exposed", "คุณเปิดโปงเขาต่อหน้าเจ้านาย", 2, { grudge: 20 }))), B("หลักฐานไม่พอ เจ้านายมองว่าคุณขี้อิจฉา", {}, both(perf(-6), bossMem("petty", "คุณกล่าวหาเพื่อนร่วมงาน", 1, { respect: -6 })))), { h: 4 }),
    tagged(C("คุยกับเขาตรงๆ ตามลำพัง", G((l, c) => `${nm(l, c)}หน้าซีด แล้วไปบอกเจ้านายว่าทำร่วมกัน`, {}, both(perf(4), mem("confronted", "คุณให้โอกาสเขาแก้ตัว", 2, { respect: 10, grudge: -5 })))), { h: 3, m: 3 }),
    tagged(C("ปล่อยไป", N("งานชิ้นต่อไปคุณเก็บไว้ในลิ้นชักที่ล็อกได้", {}, perf(-3))), { c: -3 }),
  ], withMate),
  W("bad_order", "คำสั่งที่ผิด", (l) => `${bossOf(l) ? shortName(bossOf(l)!) : "เจ้านาย"}สั่งให้คุณ${pick(l, ["แอบผสมของด้อยคุณภาพแล้วขายราคาเต็ม", "ปลอมบัญชีปิดยอดขาดทุน", "ไล่คนงานแก่ออกโดยไม่จ่ายค่าชดเชย", "รายงานเท็จต่อผู้ตรวจของแผ่นดิน"])}`, [
    tagged(C("ทำตามคำสั่ง", N("เจ้านายพยักหน้าพอใจ และคุณนอนไม่หลับไปหลายคืน", { gold: 4 }, both(perf(6), bossMem("obeyed", "คุณทำตามคำสั่งที่ผิดให้", 2, { trust: 10, loyalty: 6 })))), { h: -6, m: -3, seed: "dirty_order" }),
    tagged(C("ปฏิเสธต่อหน้า", (l) => { perf(-8)(l); bossMem("refused", "คุณปฏิเสธคำสั่งต่อหน้า", 2, { trust: -10, respect: 4 })(l); return { text: "เจ้านายเงียบไปนาน แล้วสั่งงานที่หนักที่สุดให้คุณแทน", kind: "bad" }; }), { h: 6, c: 5 }),
    tagged(K("ทำทีเป็นทำ แต่แอบทำให้ถูก", "smarts", 55, G("ไม่มีใครรู้ และงานก็ออกมาถูกต้อง", {}, perf(2)), B("เจ้านายจับได้", {}, both(perf(-10), bossMem("tricked", "คุณแอบขัดคำสั่ง", 2, { trust: -15 })))), { h: -2, m: 3 }),
  ], withBoss),
  W("cover", "ขอให้ช่วยปิด", (l, c) => `${nm(l, c)}ทำของสำคัญเสียหาย และขอร้องให้คุณช่วยบอกเจ้านายว่าเป็นอุบัติเหตุจากหนู`, [
    tagged(C("ช่วยปิด", G((l, c) => `${nm(l, c)}จับมือคุณแน่น "ข้าติดหนี้เจ้า"`, {}, mem("covered", "คุณช่วยปิดความผิดของเขา", 3, { debt: 35, loyalty: 10 }))), { h: -4, m: 4 }),
    tagged(C("ให้เขาไปสารภาพเอง", N((l, c) => `${nm(l, c)}ไปสารภาพ ถูกหักเงินเดือน แต่ไม่ถูกไล่ออก`, {}, mem("honest_push", "คุณผลักให้เขาสารภาพ", 1, { respect: 5, love: -3 }))), { h: 4 }),
    tagged(C("บอกเจ้านายเอง", N((l, c) => `${nm(l, c)}ถูกไล่ออก และรู้ว่าใครเป็นคนบอก`, {}, both(perf(4), mem("reported", "คุณไปฟ้องเจ้านาย", 3, { grudge: 40, trust: -30 })))), { h: 5, m: -5 }),
  ], withMate),
  W("bribe", "ของฝากจากลูกค้า", (l) => `ลูกค้ารายใหญ่ส่งหีบทองคำมาที่บ้านคุณ พร้อมข้อความสั้นๆ ว่าหวังว่างานหน้าจะ "ราบรื่น" ในฐานะ${titleOf(l)}`, [
    tagged(C("รับไว้", N("ทองคำหนักมือ และงานของเขาราบรื่นจริงๆ", { gold: 25 })), { h: -7, seed: "took_bribe" }),
    tagged(C("ส่งคืนพร้อมจดหมายขอบคุณ", G("ลูกค้าเคารพคุณมากขึ้น แม้จะผิดหวัง", {}, perf(3))), { h: 6 }),
    tagged(C("ส่งหีบให้เจ้านาย", G("เจ้านายยกย่องความซื่อของคุณต่อหน้าทุกคน", {}, both(perf(8), bossMem("honest", "คุณส่งของสินบนให้เขา", 2, { trust: 12, respect: 8 })))), { h: 8 }),
  ], { when: (l) => !!l.job && l.job.level >= 2 }),
  W("overtime", "งานด่วนตอนดึก", (l) => `งานด่วนเข้ามาก่อนวันเทศกาล ${bossOf(l) ? shortName(bossOf(l)!) : "เจ้านาย"}ขอให้ทุกคนอยู่จนเช้า และวันนั้นตรงกับ${pick(l, ["วันเกิดของคู่ครองคุณ", "งานแสดงของลูก", "นัดสำคัญที่รอมาทั้งปี", "คืนที่เพื่อนเก่าจะมาเยี่ยม"])}`, [
    tagged(C("อยู่ทำงานจนเสร็จ", N("งานเสร็จทันเวลา และเจ้านายจำได้ แต่คนที่บ้านก็จำได้เช่นกัน", { joy: -5 }, both(perf(8), bossMem("stayed", "คุณอยู่ทำงานจนเช้า", 1, { respect: 6 }), (l) => { const s = l.people.find((p) => p.alive && p.relation === "spouse"); if (s) remember(l, s, "missed", "คุณเลือกงานแทนวันสำคัญ", 1, { love: -6 }); }))), { c: 2 }),
    tagged(C("ขอตัวกลับบ้าน", G("คืนนั้นที่บ้านอบอุ่น แต่เช้ามาโต๊ะทำงานกองท่วม", { joy: 5 }, both(perf(-5), bossMem("left", "คุณขอตัวกลับตอนงานด่วน", 1, { respect: -4 })))), { m: 2 }),
  ], withBoss),
  W("newbie", "เด็กใหม่ไฟแรง", (l) => `มีเด็กใหม่เข้ามาในแผนก${jobName(l)} เขาเก่งเกินกว่าที่ควร และเริ่มทำงานแทนส่วนของคุณ`, [
    tagged(C("สอนทุกอย่างที่รู้ให้", G("เขาเรียกคุณว่าอาจารย์ตลอดชีวิต", { joy: 3 }, (l) => { const m = createPerson(l, "ally", { age: Math.max(16, l.age - 10), bond: 60 }); m.job = `ลูกศิษย์ในงาน${jobName(l)}`; m.tags = [...(m.tags ?? []), `work:${cid(l)}`, "mate"]; remember(l, m, "mentor", "คุณสอนงานให้ตอนเขาเพิ่งเข้ามา", 3, { respect: 20, loyalty: 15, debt: 20 }); })), { m: 5, seed: "mentored_newbie" }),
    tagged(C("เก็บความลับของงานไว้", N("เขาสะดุดเองหลายครั้ง และคุณยังมีที่ยืน", {}, perf(3))), { m: -4 }),
  ], { when: (l) => !!l.job && l.job.years >= 3, maxTimes: 1 }),
  W("party", "งานเลี้ยงของเจ้านาย", (l) => `${bossOf(l) ? shortName(bossOf(l)!) : "เจ้านาย"}จัดงานเลี้ยงที่บ้าน ทุกคนในที่ทำงานพยายามเข้าหาเขา`, [
    K("ชวนเจ้านายคุยเรื่องที่เขาชอบ", "looks", 50, G("เจ้านายหัวเราะทั้งคืน และจำชื่อลูกคุณได้", {}, both(perf(5), bossMem("party", "คุณคุยถูกคอในงานเลี้ยง", 1, { love: 6, respect: 3 }))), N("คุณพูดผิดเรื่อง เจ้านายหันไปคุยกับคนอื่น", {}, bossMem("party_bad", "คุณพูดผิดเรื่องในงานเลี้ยง", 1, { love: -3 }))),
    tagged(C("นั่งคุยกับคนรับใช้ในครัวแทน", G("คนรับใช้เล่าความลับของบ้านนี้ให้ฟังครึ่งคืน", { iq: 1, joy: 2 })), { m: 2 }),
    tagged(C("ไม่ไป", N("เจ้านายสังเกตเห็นเก้าอี้ว่าง", {}, both(perf(-3), bossMem("absent", "คุณไม่มางานเลี้ยงของเขา", 1, { love: -5 })))), { c: -1 }),
  ], withBoss),
  W("mistake", "ความผิดพลาดของคุณ", (l) => `คุณทำพลาดครั้งใหญ่ในงาน${jobName(l)} ยังไม่มีใครรู้ แต่ถ้ามีคนตรวจ เรื่องจะแดง`, [
    tagged(C("ไปสารภาพกับเจ้านาย", (l) => { const b = bossOf(l); const fine = b && relOf(b).trust >= 50; perf(fine ? -2 : -8)(l); if (b) remember(l, b, "confess", "คุณมาสารภาพความผิดเอง", 2, { trust: 10, respect: 6 }); return { text: fine ? "เจ้านายถอนหายใจ แล้วช่วยคุณแก้ ด้วยความไว้ใจที่มีอยู่" : "เจ้านายหักเงินเดือนคุณ แต่ไม่ลืมว่าคุณมาบอกเอง", kind: "normal" }; }), { h: 7, c: 3 }),
    tagged(K("แก้ไขเงียบๆ ก่อนใครรู้", "smarts", 55, G("ทุกอย่างกลับมาเรียบร้อยเหมือนไม่เคยเกิด", {}, perf(2)), B("เรื่องแดงขึ้นมาก่อนคุณแก้เสร็จ และดูแย่กว่าเดิมสองเท่า", {}, both(perf(-15), bossMem("hid", "คุณปกปิดความผิด", 3, { trust: -25 })))), { h: -3 }),
    tagged(C("โยนความผิดให้เพื่อนร่วมงาน", (l) => { const m = matesOf(l)[0]; perf(2)(l); if (m) remember(l, m, "blamed", "คุณโยนความผิดของคุณมาให้", 3, { grudge: 50, trust: -40 }); return { text: m ? `${shortName(m)}ถูกหักเงินเดือนแทนคุณ เขารู้ความจริงในอีกไม่กี่วัน` : "ไม่มีใครถูกลงโทษ", kind: "bad" }; }), { h: -10, m: -6 }),
  ], { when: (l) => !!cid(l) }),
  W("strike", "คนงานรวมตัว", (l) => `คนงานในงาน${jobName(l)}รวมตัวกันจะหยุดงานประท้วงค่าจ้าง พวกเขาอยากให้คุณเป็นคนพูด`, [
    tagged(C("ขึ้นพูดแทนทุกคน", (l) => { const b = bossOf(l); perf(-4)(l); for (const m of matesOf(l)) remember(l, m, "spoke", "คุณขึ้นพูดแทนทุกคนตอนประท้วง", 2, { respect: 12, loyalty: 10 }); if (b) remember(l, b, "strike", "คุณนำคนงานประท้วง", 2, { trust: -12 }); spread(l, "นำคนงานประท้วงค่าจ้าง", 1, 35); return { text: "ค่าจ้างของทุกคนขึ้นในเดือนต่อมา แต่เจ้านายมองคุณไม่เหมือนเดิม", kind: "good" }; }), { c: 6, m: 4 }),
    tagged(C("ไปบอกเจ้านายก่อน", (l) => { perf(8)(l); for (const m of matesOf(l)) remember(l, m, "snitch", "คุณเอาเรื่องประท้วงไปบอกเจ้านาย", 3, { grudge: 30, trust: -25 }); return { text: "การประท้วงล่มก่อนเริ่ม เจ้านายชมคุณ และเพื่อนร่วมงานเลิกคุยกับคุณ", kind: "bad" }; }), { h: -3, m: -6 }),
    tagged(C("อยู่เฉยๆ", N("การประท้วงเกิดขึ้นโดยไม่มีคุณ")), { c: -3 }),
  ], { when: (l) => !!cid(l) && !["ft_thief", "ft_bard", "ft_cartographer"].includes(cid(l)!), maxTimes: 1 }),
  W("spy_mate", "ขอให้จับตา", (l, c) => `เจ้านายขอให้คุณคอยรายงานว่า${nm(l, c)}พูดอะไรลับหลังเขาบ้าง`, [
    tagged(C("รับปากและรายงานทุกอย่าง", N((l, c) => `เจ้านายไว้ใจคุณมากขึ้น และ${nm(l, c)}ถูกย้ายไปที่ห่างไกลในอีกครึ่งปี`, {}, both(perf(6), bossMem("informer", "คุณเป็นหูเป็นตาให้", 2, { trust: 12 }), mem("informed_on", "คุณแอบรายงานเรื่องเขาให้เจ้านาย", 1, { grudge: 10 })))), { h: -5, m: -4 }),
    tagged(C("ปฏิเสธอย่างสุภาพ", N("เจ้านายยิ้มบางๆ และไม่ถามอีก", {}, both(perf(-2), bossMem("declined_spy", "คุณไม่ยอมเป็นสายให้", 1, { trust: -4, respect: 4 })))), { h: 3 }),
    tagged(C("เตือนเขาให้ระวังตัว", G((l, c) => `${nm(l, c)}ขอบคุณคุณ และระวังคำพูดมากขึ้น`, {}, mem("warned", "คุณเตือนว่าเจ้านายกำลังจับตา", 3, { loyalty: 15, debt: 25 }))), { m: 4, h: -2 }),
  ], { ...withMate, when: (l) => !!bossOf(l) && matesOf(l).length > 0 }),
  W("raise", "ขอขึ้นเงินเดือน", (l) => `คุณทำงาน${jobName(l)}มา ${l.job?.years ?? 0} ปีแล้ว และรู้ว่าคนอื่นได้มากกว่า`, [
    K("ขอขึ้นเงินเดือนตรงๆ", "looks", 50, G("เจ้านายยอมขึ้นให้ พร้อมบอกว่าเขากำลังรอให้คุณขอ", { gold: 12 }, bossMem("raise", "คุณขอขึ้นเงินเดือนอย่างกล้าหาญ", 1, { respect: 4 })), N("เจ้านายบอกว่ายังไม่ถึงเวลา", {}, perf(-2))),
    tagged(C("ยื่นข้อเสนอจากที่อื่นให้ดู", (l) => { const ok = chance(l, 0.55); if (ok) { l.money += 20 * 100; bossMem("leverage", "คุณใช้ข้อเสนอจากที่อื่นมาต่อรอง", 1, { respect: 3, trust: -4 })(l); } else perf(-6)(l); return { text: ok ? "เจ้านายยอมจ่ายเพิ่มเพื่อรั้งคุณไว้" : "เจ้านายบอกว่างั้นก็ไปเถอะ คุณต้องกลืนคำพูดกลับ", kind: ok ? "good" : "bad" }; }), { c: 4, h: -2 }),
  ], { when: (l) => !!l.job && l.job.years >= 4 && !!bossOf(l), maxTimes: 2 }),
  W("poach", "ข้อเสนอจากคู่แข่ง", (l) => `คู่แข่งของนายจ้างคุณเสนอค่าจ้างสองเท่า ถ้าคุณย้ายไปพร้อมความลับของงาน${jobName(l)}`, [
    tagged(C("ย้ายไปพร้อมความลับ", (l) => { const b = bossOf(l); if (b) remember(l, b, "traitor", "คุณขโมยความลับไปให้คู่แข่ง", 3, { grudge: 60, trust: -50 }); l.money += 60 * 100; spread(l, "ขโมยความลับของนายจ้างไปให้คู่แข่ง", -1, 40); return { text: "คุณได้เงินก้อนใหญ่ และศัตรูตัวใหม่", kind: "bad" }; }), { h: -12 }),
    tagged(C("ปฏิเสธและบอกนายจ้าง", G("นายจ้างประทับใจในความภักดีของคุณ", {}, both(perf(10), bossMem("loyal", "คุณปฏิเสธข้อเสนอของคู่แข่ง", 3, { trust: 20, loyalty: 15 })))), { h: 6 }),
    tagged(C("ปฏิเสธเงียบๆ", N("ไม่มีใครรู้ว่าคุณเคยได้ข้อเสนอนี้")), {}),
  ], { when: (l) => !!l.job && l.job.level >= 3, maxTimes: 1 }),
  W("accident", "อุบัติเหตุในที่ทำงาน", (l, c) => `${nm(l, c)}ถูกของหนักทับขาระหว่างทำงาน ทุกคนยืนตะลึง`, [
    tagged(P("ยกของออกด้วยตัวเอง", (l) => 0.35 + (l.ft?.bstars ?? 0) * 0.05 + l.stats.health / 300, G((l, c) => `คุณยกมันขึ้นได้ ${nm(l, c)}รอดโดยขาไม่หัก`, { body: 4 }, mem("saved", "คุณยกของหนักออกจากขาเขา", 3, { debt: 40, love: 10 })), B("คุณยกไม่ไหว หลังเคล็ดไปหนึ่งเดือน", { hp: -10 }, mem("tried", "คุณพยายามช่วยเต็มที่", 2, { love: 8 }))), { c: 5, m: 4 }),
    tagged(C("วิ่งไปตามหมอ", G("หมอมาทันเวลา", {}, mem("doctor", "คุณวิ่งไปตามหมอ", 1, { love: 4 }))), { c: -2 }),
  ], withMate),
  W("gossip", "ซุบซิบหน้าบ่อน้ำ", (l, c) => `เพื่อนร่วมงานกำลังนินทาว่า${nm(l, c)}เคยติดคุก และชวนคุณร่วมวงด้วย`, [
    tagged(C("หัวเราะร่วมวง", N((l, c) => `เรื่องนี้ไปถึงหู${nm(l, c)}ในวันรุ่งขึ้น`, {}, mem("gossiped", "คุณร่วมวงนินทาเขา", 2, { grudge: 15, trust: -10 }))), { m: -3 }),
    tagged(C("บอกให้หยุด", G((l, c) => `วงนินทาแยกย้าย ${nm(l, c)}ได้ยินเรื่องนี้ทีหลังและไม่ลืม`, {}, mem("defended", "คุณปกป้องเขาจากวงนินทา", 2, { loyalty: 12, love: 6 }))), { m: 4, c: 3 }),
  ], withMate),
  W("scandal", "เรื่องเก่าโผล่", (l) => `มีจดหมายไม่ลงชื่อส่งถึงนายจ้าง เล่าว่าคุณ${seedsOf(l).find((s) => SCANDAL.includes(s.id))?.note ?? talkHere(l).find((r) => r.tone < 0)?.text ?? "เคยทำเรื่องไม่ดีไว้"}`, [
    tagged(C("ยอมรับและขอโทษ", (l) => { perf(-8)(l); bossMem("admitted", "คุณยอมรับเรื่องเก่าของตัวเอง", 2, { respect: 6 })(l); return { text: "นายจ้างลดตำแหน่งคุณชั่วคราว แต่ไม่ไล่ออก เพราะคุณไม่โกหก", kind: "normal" }; }), { h: 7 }),
    tagged(K("ปฏิเสธว่าเป็นข่าวลือ", "smarts", 50, G("ไม่มีหลักฐาน เรื่องจึงจบ", {}, perf(-2)), (l) => { if (l.job && l.job.level > 1) l.job.level--; perf(-10)(l); bossMem("lied", "คุณโกหกเรื่องเก่าของตัวเอง", 3, { trust: -25 })(l); return { text: "หลักฐานมาถึงโต๊ะนายจ้างในสัปดาห์ต่อมา คุณถูกลดขั้น", kind: "bad" }; }), { h: -5 }),
  ], { when: (l) => !!cid(l) && (seedsOf(l).some((s) => SCANDAL.includes(s.id)) || talkHere(l).some((r) => r.tone < 0 && r.heat >= 35)), maxTimes: 2, weight: 18 }),
  W("promo", "ชิงตำแหน่ง", (l, c) => `ตำแหน่ง${careerById(l.job?.careerId ?? "")?.titles[l.job?.level ?? 1] ?? "ที่สูงขึ้น"}ว่างลง คุณกับ${nm(l, c)}เป็นตัวเต็งสองคนสุดท้าย`, [
    C("ปล่อยให้ผลงานพูดแทน", (l, c) => promoRace(l, c, 0)),
    tagged(K("หาเสียงสนับสนุนในที่ทำงาน", "looks", 50, (l, c) => promoRace(l, c, 0.15), (l, c) => promoRace(l, c, -0.05)), { c: 2 }),
    tagged(C("แอบปล่อยข่าวเสียหายของคู่แข่ง", (l, c) => { const p = who(l, c); if (p) remember(l, p, "smeared", "คุณปล่อยข่าวเสียหายเพื่อชิงตำแหน่ง", 3, { grudge: 40 }); lean(l, { h: -3 }); return promoRace(l, c, 0.2); }), { h: -6, m: -4 }),
    tagged(C("ถอนตัวให้เขา", G((l, c) => `${nm(l, c)}ได้ตำแหน่ง และไม่ลืมว่าคุณยอมให้`, {}, mem("yielded", "คุณถอนตัวให้เขาได้ตำแหน่ง", 3, { debt: 40, loyalty: 15, jealousy: -30 }))), { m: 6, c: -2 }),
  ], { ...withMate, when: (l) => !!l.job && l.job.level < 5 && l.job.performance >= 60 && matesOf(l).length > 0, maxTimes: 4, weight: 20 }),
];
/** เมล็ดที่เป็นเรื่องฉาวได้ถ้าโผล่ขึ้นมา */
const SCANDAL = ["tax_hide", "votes_bought", "took_bribe", "dirty_order", "faction_sold", "assassin_hire", "treasure_pocket", "ring_sold", "purse_keep", "spy_taken", "signet_kept"];

/** การชิงตำแหน่ง: ผลงาน เจ้านาย นิสัยที่เหมาะ และสิ่งที่คุณทำมาตลอด ตัดสิน */
function promoRace(l: Life, c: Ctx, bonus: number) {
  const job = l.job;
  if (!job) return { text: "ตำแหน่งนั้นถูกยุบไปแล้ว" };
  const f = workFactors(l).reduce((s, x) => s + x.value, 0);
  const p = clamp(0.45 + (job.performance - 60) / 100 + f / 40 + bonus, 0.08, 0.92);
  const rival = who(l, c);
  if (chance(l, p)) {
    job.level = Math.min(5, job.level + 1);
    job.performance = 55;
    if (rival) remember(l, rival, "lost_promo", "แพ้คุณในการชิงตำแหน่ง", 2, { jealousy: 25, respect: 5 });
    const t = careerById(job.careerId)!.titles[job.level - 1];
    log(l, `คุณได้เลื่อนเป็น "${t}"`, "good");
    return { text: `เจ้านายเรียกชื่อคุณต่อหน้าทุกคน ตำแหน่ง${t}เป็นของคุณ`, kind: "milestone" as const };
  }
  job.performance = clamp(job.performance - 8, 0, 100);
  if (rival) remember(l, rival, "won_promo", "ชนะคุณในการชิงตำแหน่ง", 1, { respect: 3 });
  return { text: `${rival ? shortName(rival) : "อีกคน"}ได้ตำแหน่งไป คุณต้องรออีกรอบ`, kind: "bad" as const };
}

export const WORK_ECHOES: GameEvent[] = [
  ECHO("dirty_order", "ทำตามคำสั่งผิดๆ ของเจ้านาย", [2, 10], "ผู้ตรวจของแผ่นดินมาถึงพร้อมสมุดบัญชีเล่มที่คุณเคยแก้ตามคำสั่งเจ้านาย ลายมือในนั้นเป็นของคุณ", [
    tagged(C("เล่าทุกอย่างว่าใครสั่ง", (l) => { const b = bossOf(l); if (b) remember(l, b, "testified", "คุณให้การปรักปรำเขาต่อผู้ตรวจ", 3, { grudge: 50 }); return { text: "เจ้านายถูกจับ คุณรอดเพราะเป็นพยาน แต่ศัตรูคนใหม่จะออกจากคุกในวันหนึ่ง", kind: "normal" }; }), { h: 8 }),
    tagged(C("รับผิดแทนเจ้านาย", (l) => { const b = bossOf(l); if (b) remember(l, b, "took_fall", "คุณรับผิดแทนเขา", 3, { debt: 50, loyalty: 25 }); l.money = Math.max(0, l.money - 30 * 100); return { text: "คุณเสียค่าปรับก้อนใหญ่ เจ้านายจะไม่มีวันลืมเรื่องนี้", kind: "bad" }; }), { m: 3, h: -3 }),
  ], "ผู้ตรวจของแผ่นดิน"),
  ECHO("took_bribe", "รับหีบทองจากลูกค้า", [2, 10], "ลูกค้าคนที่เคยส่งหีบทองมาให้ถูกจับข้อหาฉ้อโกง และในสมุดของเขามีชื่อคุณ", [
    PAY("จ่ายให้ชื่อหายไปจากสมุด", 30, N("ชื่อหายไปจริง แต่คนที่ลบรู้ว่าคุณจ่าย", {}, (l) => lean(l, { h: -3 }))),
    tagged(C("คืนทองให้ศาลพร้อมคำสารภาพ", N("คุณถูกปรับ แต่ไม่ติดคุก", { gold: -25 }, (l) => { if (l.job) l.job.performance = clamp(l.job.performance - 10, 0, 100); })), { h: 8 }),
  ], "ชื่อในสมุดของคนโกง"),
  ECHO("mentored_newbie", "สอนงานให้เด็กใหม่ทุกอย่างที่รู้", [5, 20], "เด็กใหม่ที่คุณสอนงานตอนนั้นเป็นนายใหญ่ของอาชีพนี้ทั้งแผ่นดินแล้ว เขามาขอให้คุณเป็นที่ปรึกษาประจำสมาคม", [
    C("รับตำแหน่ง", BIG("ทุกคนในสมาคมรู้ว่านายใหญ่เรียนงานจากใคร", { gold: 30, fame: 5 }, (l) => spread(l, "เป็นครูของนายใหญ่แห่งสมาคม", 1, 40))),
  ], "ศิษย์ที่กลายเป็นนายใหญ่"),
];

/** ช่องเรื่องในที่ทำงานปีละครั้ง · เรื่องฉาวมาก่อนถ้ามี */
export const WORK_CHANCE = 0.45;
function workYear(l: Life) {
  ensureCircle(l);
  const c = cid(l);
  if (!c) return;
  const j = l.job!;
  j.performance = clamp(j.performance + clamp(workFactors(l).reduce((s, x) => s + x.value, 0), -5, 8), 0, 100);
  // เจ้านายที่รักคุณช่วยไว้ก่อนจะถูกไล่ออก ครั้งเดียวต่องาน
  const b = bossOf(l);
  if (j.performance < 22 && b && relOf(b).love + relOf(b).loyalty >= 100 && !b.tags?.includes("saved_you")) { j.performance = 40; b.tags = [...(b.tags ?? []), "saved_you"]; log(l, `${shortName(b)}เจ้านายเรียกคุณไปคุย "ข้าจะปกป้องเจ้าครั้งนี้ ครั้งเดียว" ผลงานของคุณได้อีกโอกาส`, "good"); }
  if (!chance(l, WORK_CHANCE) || l.queue.some((q) => q.eventId.startsWith("ft.wk."))) return;
  const pool = WORK_EVENTS.filter((e) => (l.seen[e.id] ?? 0) < (e.maxTimes ?? 2) && (!e.when || e.when(l)));
  const e = weightedPick(l, pool, (x) => (typeof x.weight === "number" ? x.weight : 10));
  if (e) runEvent(l, e.id);
}

export function loadWorklife() {
  yearHooks.push((l) => { if (l.worldId === "fantasy" && l.ft && l.alive) workYear(l); });
}

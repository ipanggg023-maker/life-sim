// NPC มีชีวิตของตัวเอง (EXPANSION §4.5 · checklist "ดำเนินชีวิตเมื่อผู้เล่นไม่เกี่ยวข้อง")
// คนรู้จักแต่งงานกันเอง ทะเลาะกันเอง ย้ายไปแล้วกลับมาในสภาพที่เปลี่ยนไป ได้งาน เลื่อนตำแหน่ง ตั้งชื่อลูกตามคุณ
// คุณได้ข่าวเฉพาะคนที่สนิทพอ · บางเรื่องดึงคุณเข้าไปเกี่ยว (งานแต่ง การทะเลาะ การกลับมา)
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { feel, relOf, remember } from "../../../engine/npc";
import { chance, pick } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { log, shortName } from "../../../engine/util";
import { B, BIG, C, E, G, K, N, PAY, type Res } from "../story/kit";
import { REGIONS } from "./region";
import { plantSeed } from "./seedStore";

export interface Link { a: string; b: string; k: "wed" | "feud"; y: number }
const KEY = "mwLinks";
export function linksOf(l: Life): Link[] {
  try { return JSON.parse(String(l.flags[KEY] ?? "[]")) as Link[]; } catch { return []; }
}
const saveLinks = (l: Life, xs: Link[]) => { l.flags[KEY] = JSON.stringify(xs.slice(-20)); };
const cal = (l: Life) => l.birthYear + l.age;
const CORE = ["father", "mother", "spouse", "partner", "child"];
const tags = (p: Person) => (p.tags ??= []);
export const isAway = (p: Person) => tags(p).some((t) => t.startsWith("away:"));
/** คนรู้จักที่มีชีวิตของตัวเอง (ไม่ใช่พ่อแม่ คู่ครอง ลูก) */
const free = (l: Life) => l.people.filter((p) => p.alive && !CORE.includes(p.relation) && p.age >= 16);
const close = (p: Person) => p.bond >= 40 || relOf(p).love >= 40 || relOf(p).trust >= 40;

const JOBS = ["พ่อค้าผ้า", "ช่างไม้", "ครูสอนหนังสือ", "หมอยา", "มือปราบ", "คนคุมคาราวาน", "เจ้าของโรงเตี๊ยม", "ชาวนา", "ศิษย์สำนัก", "เสมียนอำเภอ"];
const SENIOR: Record<string, string> = { "พ่อค้าผ้า": "เจ้าของร้านผ้าใหญ่", "ช่างไม้": "นายช่างใหญ่", "ครูสอนหนังสือ": "อาจารย์ใหญ่ของสำนักศึกษา", "หมอยา": "หมอมีชื่อ", "มือปราบ": "หัวหน้ามือปราบ", "คนคุมคาราวาน": "เจ้าของสำนักคุ้มภัย", "เจ้าของโรงเตี๊ยม": "เจ้าของโรงเตี๊ยมสามสาขา", "ชาวนา": "เจ้าของนาร้อยไร่", "ศิษย์สำนัก": "ผู้อาวุโสสำนัก", "เสมียนอำเภอ": "นายอำเภอ" };
const FEUD_WHY = ["เงินกู้ที่ไม่ยอมคืน", "ที่นาที่อ้างว่าเป็นของตัวเอง", "คนรักคนเดียวกัน", "คำพูดในงานเลี้ยงที่ไม่ควรพูด", "การแย่งลูกค้า"];
const FORTUNE = ["rich", "ruined", "master", "family"] as const;

/** เรื่องที่รอผู้เล่น (งานแต่ง/ทะเลาะ/กลับมา) — ทีละเรื่อง */
const pending = (l: Life) => { try { return JSON.parse(String(l.flags.npcPending ?? "null")) as Ctx | null; } catch { return null; } };
const setPending = (l: Life, c: Ctx) => { if (!l.flags.npcPending) l.flags.npcPending = JSON.stringify(c); };

function tickNpcLives(l: Life) {
  if (l.worldId !== "murim" || !l.alive) return;
  const ppl = free(l);
  const links = linksOf(l);
  let told = 0;
  const news = (p: Person, text: string) => { if (close(p) && told < 2) { told++; log(l, `🗞️ ข่าวจากคนรู้จัก: ${text}`); } };
  for (const p of ppl) {
    const t = tags(p);
    // งานและการเลื่อนตำแหน่ง
    if (!p.job && p.age >= 18 && chance(l, 0.3)) p.job = pick(l, JOBS);
    else if (p.job && SENIOR[p.job] && p.age >= 28 && chance(l, 0.04)) { const before = p.job; p.job = SENIOR[p.job]; news(p, `${shortName(p)}จาก${before}กลายเป็น${p.job}แล้ว`); }
    // ย้ายไปไกล → กลับมาในสภาพที่เปลี่ยนไป
    const away = t.find((x) => x.startsWith("away:"));
    if (!away && ["friend", "rival", "ally"].includes(p.relation) && p.age >= 18 && chance(l, 0.015)) {
      t.push(`away:${cal(l)}`);
      news(p, `${shortName(p)}ย้ายไปตั้งตัวที่${pick(l, REGIONS).name}`);
    } else if (away && cal(l) - Number(away.slice(5)) >= 3 && chance(l, 0.15)) {
      p.tags = t.filter((x) => x !== away);
      setPending(l, { ev: "npc.l_return", a: p.id, yrs: cal(l) - Number(away.slice(5)), f: pick(l, [...FORTUNE]) });
    }
    // ตั้งชื่อลูกตามคุณ
    if (t.includes("parent") && !t.includes("namedKid") && relOf(p).love >= 70 && chance(l, 0.25)) {
      t.push("namedKid");
      remember(l, p, "named_child", "ตั้งชื่อลูกตามคุณ", 2, { love: 3 }, true);
      log(l, `🎐 ${shortName(p)}ตั้งชื่อลูกคนแรกตามชื่อคุณ — "เพื่อให้เขาโตมาเป็นคนแบบนั้น"`, "good");
      l.stats.happiness = Math.min(100, l.stats.happiness + 3);
    }
  }
  // คนรู้จักแต่งงานกันเอง
  const single = ppl.filter((p) => p.age >= 18 && !tags(p).includes("married") && !isAway(p));
  if (single.length >= 2 && chance(l, 0.1)) {
    const a = pick(l, single);
    const b = single.find((x) => x.gender !== a.gender && Math.abs(x.age - a.age) <= 12 && x.id !== a.id);
    if (b) {
      tags(a).push("married"); tags(b).push("married");
      links.push({ a: a.id, b: b.id, k: "wed", y: cal(l) });
      if (close(a) || close(b)) setPending(l, { ev: "npc.l_wedding", a: a.id, b: b.id });
    }
  }
  // คนรู้จักทะเลาะกันเอง
  const hot = ppl.filter((p) => !isAway(p) && (p.traits ?? []).some((x) => ["ambitious", "envious", "vengeful", "cunning"].includes(x)));
  if (hot.length && ppl.length >= 3 && chance(l, 0.03)) {
    const a = pick(l, hot);
    const b = pick(l, ppl.filter((x) => x.id !== a.id && !isAway(x)));
    if (b && !links.some((x) => x.k === "feud" && [x.a, x.b].includes(a.id) && [x.a, x.b].includes(b.id))) {
      links.push({ a: a.id, b: b.id, k: "feud", y: cal(l) });
      if (close(a) && close(b)) setPending(l, { ev: "npc.l_feud", a: a.id, b: b.id, why: pick(l, FEUD_WHY) });
      else news(a, `${shortName(a)}กับ${shortName(b)}ไม่มองหน้ากันแล้ว เพราะ${pick(l, FEUD_WHY)}`);
    }
  }
  // คู่ที่แต่งกันแล้วอีกฝ่ายจากไป
  for (const k of links.filter((x) => x.k === "wed")) {
    const a = l.people.find((p) => p.id === k.a), b = l.people.find((p) => p.id === k.b);
    if (a && b && a.alive !== b.alive) {
      const alive = a.alive ? a : b, dead = a.alive ? b : a;
      news(alive, `${shortName(alive)}เพิ่งเสีย${shortName(dead)}ไป — งานศพเงียบกว่าที่ควร`);
      k.k = "feud"; // ปิดลิงก์ (ไม่แจ้งซ้ำ)
      k.b = k.a;
    }
  }
  saveLinks(l, links.filter((x) => x.a !== x.b));
}
yearHooks.push(tickNpcLives);

const P = (l: Life, c: Ctx, k: "a" | "b") => l.people.find((p) => p.id === c[k]);
const nm = (l: Life, c: Ctx, k: "a" | "b") => { const p = P(l, c, k); return p ? shortName(p) : "เขา"; };
/** ปิดเรื่องที่รอ + ขยับความรู้สึกของสองคน */
const done = (r: Res, fa: Parameters<typeof feel>[1] = {}, fb: Parameters<typeof feel>[1] = {}): Res =>
  Object.assign((l: Life, c: Ctx) => { delete l.flags.npcPending; const a = P(l, c, "a"), b = P(l, c, "b"); if (a) feel(a, fa); if (b) feel(b, fb); return r(l, c); }, { fx: r.fx });
const isP = (ev: string) => (l: Life) => pending(l)?.ev === ev && !!l.people.find((p) => p.id === pending(l)?.a && p.alive);
const fromPending = (l: Life) => pending(l) ?? {};

export const NPC_LIFE_EVENTS: GameEvent[] = [
  E("npc.l_wedding", [10, 100], (l, c) => `${nm(l, c, "a")}กับ${nm(l, c, "b")} — คนรู้จักของคุณทั้งคู่ — จะแต่งงานกันเดือนหน้า เทียบเชิญสีแดงวางอยู่บนโต๊ะ`, [
    PAY("ไปร่วมงานพร้อมของขวัญ", 10, done(G("คุณนั่งโต๊ะหน้า ยกจอกอวยพรจนเสียงแหบ — ทั้งคู่จำวันนี้ได้", { joy: 4 }), { love: 10, trust: 5 }, { love: 10, trust: 5 })),
    C("ไปร่วมงานมือเปล่า", done(N("คุณไปนั่งกินเลี้ยงมุมห้อง — ไม่มีใครว่าอะไร", { joy: 2 }), { love: 3 }, { love: 3 })),
    C("ไม่ไป", done(N("คุณส่งคนไปบอกว่าติดธุระ — เทียบเชิญยังวางอยู่บนโต๊ะอีกหลายเดือน"), { love: -5 }, { love: -5 })),
  ], { when: isP("npc.l_wedding"), prepare: fromPending, weight: 40, maxTimes: 0, title: "งานแต่งของคนรู้จัก" }),

  E("npc.l_feud", [14, 100], (l, c) => `${nm(l, c, "a")}กับ${nm(l, c, "b")}ทะเลาะกันหนักเรื่อง${String(c.why ?? "เงิน")} — ทั้งคู่มาหาคุณคนละวัน และต่างก็ถามคำถามเดียวกัน: "เจ้าอยู่ข้างใคร"`, [
    C((l, c) => `อยู่ข้าง${nm(l, c, "a")}`, done(N("คุณเลือกแล้ว — มิตรภาพหนึ่งแน่นขึ้น อีกหนึ่งแตกร้าว", {}), { trust: 15, loyalty: 10 }, { grudge: 25, trust: -15 })),
    C((l, c) => `อยู่ข้าง${nm(l, c, "b")}`, done(N("คุณเลือกแล้ว — มิตรภาพหนึ่งแน่นขึ้น อีกหนึ่งแตกร้าว", {}), { grudge: 25, trust: -15 }, { trust: 15, loyalty: 10 })),
    K("นัดทั้งคู่มากินข้าวโต๊ะเดียวกัน", "looks", 55, done(Object.assign((l: Life, c: Ctx) => { saveLinks(l, linksOf(l).filter((x) => !(x.k === "feud" && [x.a, x.b].includes(String(c.a)) && [x.a, x.b].includes(String(c.b))))); return G("เหล้าไหที่สาม ทั้งคู่เริ่มหัวเราะเรื่องเก่า — คุณได้มิตรภาพสองคนคืนมาพร้อมกัน", { fame: 1, joy: 3 })(l, c); }, { fx: { fame: 1, joy: 3 } }), { trust: 10, respect: 8 }, { trust: 10, respect: 8 }), done(B("โต๊ะคว่ำตั้งแต่ไหแรก — ทั้งคู่โทษว่าคุณจัดฉากให้อีกฝ่าย", { joy: -3 }), { trust: -8 }, { trust: -8 })),
    C("ไม่ยุ่ง", done(N("คุณบอกว่าเป็นเรื่องของพวกเขา — ทั้งคู่รู้สึกว่าคุณทิ้งพวกเขา"), { trust: -4 }, { trust: -4 })),
  ], { when: isP("npc.l_feud"), prepare: fromPending, weight: 40, maxTimes: 0, title: "คนรู้จักทะเลาะกัน" }),

  E("npc.l_return", [14, 100], (l, c) => {
    const f = String(c.f), who = nm(l, c, "a"), y = Number(c.yrs ?? 3);
    return f === "rich" ? `${who}กลับมาหลังหายไป ${y} ปี — ขี่ม้าดี ใส่แหวนหยก "ข้ามีกิจการที่ทางใต้ อยากชวนเจ้าร่วมหุ้น"`
      : f === "ruined" ? `${who}กลับมาหลังหายไป ${y} ปี — ผอม เสื้อขาด "ทุกอย่างพังหมดแล้ว ขอยืมเงินสักก้อนได้ไหม"`
      : f === "master" ? `${who}กลับมาหลังหายไป ${y} ปี — ฝีเท้าเงียบผิดปกติ ฝ่ามือมีรอยด้านของคนฝึกวิชามาอย่างหนัก`
      : `${who}กลับมาหลังหายไป ${y} ปี พร้อมภรรยาและลูกสามคน — "อยากให้ลูกๆ รู้จักเพื่อนเก่าของพ่อ"`;
  }, [
    PAY("ร่วมหุ้นด้วย", 30, done(Object.assign((l: Life, c: Ctx) => (chance(l, 0.6) ? G("สามปีต่อมากิจการรุ่ง — เงินปันผลกลับมาเกินทุน", { tael: 70 })(l, c) : B("กิจการล่มในปีที่สอง — เงินหายไปพร้อมความเชื่อใจ", { joy: -4 })(l, c)), { fx: { tael: 70 } }), { trust: 10 }), { show: (_l, c) => c.f === "rich", pros: "อาจได้เงินคืนมากกว่าเดิม", cons: "อาจเสียทุน" }),
    C("ปฏิเสธ ขอแค่ดื่มฉลองกัน", done(N("คุณดื่มกันจนดึก — เขาไม่ได้น้อยใจ", { joy: 3 }), { love: 4 }), { show: (_l, c) => c.f === "rich" }),
    PAY("ให้ยืมโดยไม่ทวง", 20, done(Object.assign((l: Life, c: Ctx) => { const p = P(l, c, "a"); if (p) plantSeed(l, "kindness", p.name, p.id); return G("เขากุมมือคุณแน่น — เงินก้อนนี้อาจไม่ได้คืน แต่เขาจะไม่ลืม", { align: 3 })(l, c); }, { fx: { align: 3 } }), { debt: 40, love: 15 }), { show: (_l, c) => c.f === "ruined" }),
    C("ปฏิเสธ", done(B("เขาพยักหน้าช้าๆ แล้วเดินจากไป — คุณเห็นแผ่นหลังที่ค่อมลงกว่าเดิม", { joy: -2 }), { grudge: 10, trust: -10 }), { show: (_l, c) => c.f === "ruined" }),
    K("ขอประลองฝีมือกันสักกระบวน", "health", 50, done(BIG("คุณแพ้ไปอย่างสวยงาม แต่ได้เห็นวิชาที่ไม่เคยเห็น — เขาชี้ท่าให้สามท่า", { exp: 900 }), { respect: 10 }), done(N("เขายั้งมือ — คุณรู้ตัวว่าห่างชั้นแค่ไหน", { exp: 300 }), { respect: 5 }), { show: (_l, c) => c.f === "master" }),
    C("ต้อนรับเลี้ยงข้าวทั้งครอบครัว", done(G("เด็กๆ เรียกคุณว่าลุง/ป้าตั้งแต่มื้อแรก — บ้านคุณเสียงดังกว่าที่เคยเป็นมาหลายปี", { joy: 5 }), { love: 12 }), { show: (_l, c) => c.f === "family" }),
  ], { when: isP("npc.l_return"), prepare: fromPending, weight: 40, maxTimes: 0, title: "คนที่กลับมา" }),
];

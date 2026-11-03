// แท็บผู้คนชุดใหญ่: ทุกการกระทำกับคนจดเป็นความทรงจำ · คนรอบตัวมีชีวิตของตัวเอง · ครอบครัวมีเรื่อง · ศัตรูลงมือ · เพื่อนใช้หนี้บุญคุณ
// ความแค้นตกทอดถึงลูกหลานทั้งสองฝั่ง
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { feel, profileOf, relOf, remember, type RelAxes } from "../../engine/npc";
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { clamp, createPerson, log, shortName } from "../../engine/util";
import { personActionHooks, type PersonAction } from "../murim/life/kinship";
import { plant, tagged } from "./conseq";
import { B, C, E, G, GOLD, K, N, P, PAY, SCENE, type Res } from "./kit";
import { lean } from "./persona";
import { fightOdds } from "./power";
import { spread, talkHere } from "./rumors";

const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const mem = (k: string, text: string, w: 1 | 2 | 3, d: Partial<RelAxes>) => (l: Life, c: Ctx) => { const p = who(l, c); if (p) remember(l, p, k, text, w, d); };
const both = (...fs: ((l: Life, c: Ctx) => void)[]) => (l: Life, c: Ctx) => { for (const f of fs) f(l, c); };
const alive = (l: Life, f: (p: Person) => boolean) => l.people.filter((p) => p.alive && !p.tags?.some((t) => t.startsWith("away:")) && f(p));
const FAM = ["father", "mother", "sibling", "spouse", "child"];
const CLOSE = ["friend", "sibling", "spouse", "partner", "father", "mother", "ally"];
/** เลือกคนหนึ่งคนที่เข้าเงื่อนไขให้ฉากนี้ */
const one = (f: (l: Life, p: Person) => boolean) => ({ when: (l: Life) => alive(l, (p) => f(l, p)).length > 0, prepare: (l: Life): Ctx => ({ pid: pick(l, alive(l, (p) => f(l, p))).id }) });
const r = (p: Person) => relOf(p);

// ── ความรู้สึกเป็นคำ ไม่ใช่ตัวเลข ──
const WORDS: Record<keyof RelAxes, [number, string, string]> = {
  love: [55, "รักคุณ", "รักคุณมาก"], trust: [55, "ไว้ใจคุณ", "ไว้ใจคุณสุดใจ"], respect: [55, "นับถือคุณ", "นับถือคุณอย่างยิ่ง"],
  loyalty: [60, "ภักดีต่อคุณ", "พร้อมตายแทนคุณ"], debt: [30, "ติดหนี้บุญคุณคุณ", "จะไม่ลืมบุญคุณคุณ"], fear: [30, "เกรงกลัวคุณ", "กลัวคุณจนตัวสั่น"],
  grudge: [30, "ยังแค้นคุณ", "แค้นคุณจนวันตาย"], jealousy: [35, "อิจฉาคุณ", "อิจฉาคุณจนกินไม่ได้"],
};
export function feelingWords(p: Person): string[] {
  const x = r(p);
  const out = (Object.keys(WORDS) as (keyof RelAxes)[]).filter((k) => x[k] >= WORDS[k][0]).sort((a, b) => x[b] - x[a]).slice(0, 3).map((k) => (x[k] >= 80 ? WORDS[k][2] : WORDS[k][1]));
  if (x.trust <= 20 && !FAM.includes(p.relation)) out.push("ไม่ไว้ใจคุณ");
  return out.slice(0, 3);
}
export const topMemories = (p: Person, n = 3) => [...(p.mem ?? [])].filter((m) => m.known).sort((a, b) => b.w - a.w || b.age - a.age).slice(0, n);

// ── ของขวัญตามใจ: คนแต่ละคนให้ค่ากับสิ่งต่างกัน ──
const GIFTS: Record<string, string> = {
  "ความภักดี": "แหวนสลักชื่อทั้งสองคน", "เงินทอง": "ถุงเหรียญทองปักลาย", "ชื่อเสียง": "เสื้อคลุมขนนกยูง", "ครอบครัว": "ภาพวาดครอบครัวของเขา", "ความยุติธรรม": "ตราชั่งเงินแบบที่ศาลใช้",
  "อิสรภาพ": "ม้าหนุ่มหนึ่งตัว", "พลัง": "มีดสั้นเหล็กดาว", "ความสงบ": "พิณไม้ซีดาร์", "ศักดิ์ศรี": "ดาบพิธีปลายทอง",
};
const giftFor = (p: Person) => GIFTS[profileOf(p).values[0]] ?? "ตะกร้าผลไม้";
const giftWrong = (p: Person) => GIFTS[Object.keys(GIFTS).find((v) => !profileOf(p).values.includes(v)) ?? "ความสงบ"];

const OWE = "owe:";
const owedAt = (p: Person) => Number(p.tags?.find((t) => t.startsWith(OWE))?.slice(OWE.length) ?? -1);

const SCENES: GameEvent[] = [
  SCENE("ft.q.confide", "ระบายใจ", (l, c) => `คุณกับ${nm(l, c)}นั่งเงียบกันอยู่พักหนึ่ง`, [
    tagged(C("เล่าเรื่องที่กลัวที่สุดตามจริง", G((l, c) => `${nm(l, c)}จับมือคุณไว้ "ข้าก็กลัวเหมือนกัน"`, { joy: 5 }, mem("confide", "คุณเล่าเรื่องที่กลัวที่สุดให้ฟัง", 2, { trust: 10, love: 5 }))), { h: 3 }),
    tagged(C("ขอคำแนะนำเรื่องชีวิต", G((l, c) => `${nm(l, c)}คิดอยู่นาน แล้วให้คำตอบที่คุณไม่คาดคิด`, { iq: 2, joy: 2 }, mem("advice", "คุณมาขอคำแนะนำ", 1, { respect: 5, love: 3 }))), {}),
    tagged(C("ฟังเรื่องของเขาแทน", G((l, c) => `${nm(l, c)}เล่าเรื่องที่ไม่เคยเล่าให้ใครฟังจนดึก`, { joy: 3 }, mem("listen", "คุณนั่งฟังเรื่องของเขาทั้งคืน", 2, { love: 8, trust: 6 }))), { m: 3 }),
  ]),
  SCENE("ft.q.favor", "ขอความช่วยเหลือ", (l, c) => `คุณบอก${nm(l, c)}ว่ามีเรื่องอยากขอ${(who(l, c) && r(who(l, c)!).debt >= 30) ? " สีหน้าเขาบอกว่ายินดีตั้งแต่ยังไม่ทันฟัง" : ""}`, [
    C("ขอให้ช่วยเรื่องเงิน", (l, c) => { const p = who(l, c)!; const ok = r(p).debt >= 30 || r(p).love >= 65; const g = ok ? randInt(l, 8, 20) : 0; l.money += g * GOLD; if (ok) feel(p, { debt: -20 }); else remember(l, p, "used", "คุณมาขอเงินทั้งที่ไม่เคยช่วยอะไร", 1, { love: -4 }); return { text: ok ? `${nm(l, c)}ยื่นถุงเงิน ${g} เหรียญทองให้โดยไม่ถามสักคำ` : `${nm(l, c)}อึกอัก แล้วบอกว่าตอนนี้ไม่สะดวก`, kind: ok ? "good" : "bad" }; }),
    C("ขอให้รับรองชื่อเสียงคุณต่อหน้าคนอื่น", (l, c) => { const p = who(l, c)!; const ok = r(p).respect >= 45 || r(p).loyalty >= 60; if (ok) { spread(l, `มี${shortName(p)}รับรองความดี`, 1, 25); feel(p, { debt: -10 }); } return { text: ok ? `${nm(l, c)}เล่าเรื่องดีๆ ของคุณให้ทั้งตลาดฟัง` : `${nm(l, c)}บอกว่าไม่อยากพูดในสิ่งที่ไม่แน่ใจ`, kind: ok ? "good" : "normal" }; }),
  ]),
  SCENE("ft.q.gift", "ให้ของขวัญ", (l, c) => `คุณอยากให้ของขวัญ${nm(l, c)} ${who(l, c) && (r(who(l, c)!).trust >= 40 || FAM.includes(who(l, c)!.relation)) ? `คุณรู้ว่าเขาให้ค่ากับ${profileOf(who(l, c)!).values[0]}` : "แต่คุณยังไม่รู้จักเขาดีพอ"}`, [
    PAY("ของที่ตรงใจเขา", 4, G((l, c) => `${nm(l, c)}เงียบไปนาน ตาแดงๆ "เจ้ารู้ได้อย่างไร"`, { joy: 5 }, mem("gift", "คุณให้ของขวัญที่ตรงใจที่สุด", 2, { love: 12, trust: 4 })), { label: (l: Life, c: Ctx) => `${who(l, c) ? giftFor(who(l, c)!) : "ของขวัญ"} (4 เหรียญทอง)` }),
    PAY("ของที่คนทั่วไปชอบ", 4, G((l, c) => `${nm(l, c)}ขอบคุณอย่างสุภาพ`, { joy: 1 }, mem("gift", "คุณให้ของขวัญ", 1, { love: 3 })), { label: (l: Life, c: Ctx) => `${who(l, c) ? giftWrong(who(l, c)!) : "ของขวัญ"} (4 เหรียญทอง)` }),
    C("ทำขนมให้เองแทน", G((l, c) => `${nm(l, c)}หัวเราะกับรูปร่างขนม แต่กินจนหมด`, { joy: 3 }, mem("gift", "คุณทำขนมให้เอง", 1, { love: 5 }))),
  ]),
  SCENE("ft.q.lend", "ให้ยืมเงิน", (l, c) => `${nm(l, c)}ไม่ได้ขอ แต่คุณรู้ว่าช่วงนี้เขาลำบาก`, [
    PAY("ยื่นเงินให้ยืม", 10, G((l, c) => `${nm(l, c)}รับไว้ด้วยมือสั่น "ข้าจะไม่ลืม"`, {}, both(mem("lent", "คุณให้ยืมเงินตอนลำบาก", 3, { debt: 30, love: 6 }), (l, c) => plant(l, "lend_friend", who(l, c)?.name), (l) => lean(l, { m: 4 })))),
    PAY("ให้เปล่าไม่ต้องคืน", 10, G((l, c) => `${nm(l, c)}ร้องไห้ต่อหน้าคุณเป็นครั้งแรก`, {}, both(mem("gave", "คุณให้เงินเปล่าตอนลำบาก", 3, { debt: 40, love: 10, loyalty: 8 }), (l) => lean(l, { m: 6 })))),
  ]),
  SCENE("ft.q.borrow", "ขอยืมเงิน", (l, c) => `คุณขอยืมเงิน${nm(l, c)}สิบเหรียญทอง`, [
    C("สัญญาว่าจะคืนในห้าปี", (l, c) => { const p = who(l, c)!; const ok = r(p).trust >= 45 || r(p).love >= 60; if (ok) { l.money += 10 * GOLD; p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith(OWE)), `${OWE}${l.age}`]; remember(l, p, "lent_you", "เขาให้คุณยืมเงิน", 1, { trust: -3 }); } return { text: ok ? `${nm(l, c)}ให้ยืม "ข้าเชื่อเจ้า"` : `${nm(l, c)}ส่ายหน้า "ข้ายังไม่รู้จักเจ้าดีพอ"`, kind: ok ? "good" : "bad" }; }),
  ]),
  SCENE("ft.q.repay", "คืนเงิน", (l, c) => `ถึงเวลาคืนเงินที่ยืม${nm(l, c)}ไว้แล้ว`, [
    PAY("คืนพร้อมของขวัญ", 12, G((l, c) => `${nm(l, c)}ยิ้มกว้าง "เจ้าเป็นคนที่ข้าให้ยืมแล้วได้คืน คนเดียว"`, { joy: 3 }, both(mem("repaid", "คุณคืนเงินพร้อมของขวัญ", 2, { trust: 15, respect: 6 }), (l, c) => { const p = who(l, c); if (p) p.tags = p.tags?.filter((t) => !t.startsWith(OWE)); }, (l) => lean(l, { h: 4 })))),
    PAY("คืนตามจำนวน", 10, G((l, c) => `${nm(l, c)}รับไว้แล้วพยักหน้า`, {}, both(mem("repaid", "คุณคืนเงินตามสัญญา", 1, { trust: 8 }), (l, c) => { const p = who(l, c); if (p) p.tags = p.tags?.filter((t) => !t.startsWith(OWE)); }, (l) => lean(l, { h: 3 })))),
  ]),
  SCENE("ft.q.apologize", "ขอโทษ", (l, c) => `คุณยืนอยู่หน้าประตูบ้าน${nm(l, c)} รู้ดีว่าเขายังไม่ลืมเรื่องเก่า`, [
    tagged(K("ขอโทษจากใจ", "looks", 45, G((l, c) => `${nm(l, c)}เงียบไปนาน แล้วเปิดประตูกว้างขึ้น`, { joy: 5 }, mem("sorry", "คุณมาขอโทษถึงหน้าบ้าน", 2, { grudge: -28, trust: 10 })), N((l, c) => `${nm(l, c)}ฟังจนจบ แล้วปิดประตูช้าๆ แต่ไม่กระแทก`, {}, mem("sorry", "คุณมาขอโทษ แม้เขายังไม่พร้อม", 1, { grudge: -8 }))), { m: 4, h: 2 }),
    PAY("ขอโทษพร้อมชดใช้", 12, G((l, c) => `${nm(l, c)}รับไว้ ความแค้นเบาลงไปมาก`, {}, mem("sorry", "คุณขอโทษพร้อมชดใช้", 2, { grudge: -35, trust: 6 }))),
  ]),
  SCENE("ft.q.confront", "เผชิญหน้า", (l, c) => `คุณกับ${nm(l, c)}ยืนเผชิญหน้ากันกลางลาน ทุกคนรู้ว่าเรื่องค้างคามานาน`, [
    tagged(K("พูดกันให้รู้เรื่อง", "smarts", 50, G((l, c) => `ทั้งสองคนพูดเรื่องที่ไม่เคยพูด ${nm(l, c)}ยอมรับว่าตัวเองก็ผิด`, { joy: 4 }, mem("talked", "คุณยอมพูดกันตรงๆ", 2, { grudge: -30, jealousy: -20, respect: 6 })), B((l, c) => `คำพูดยิ่งจุดไฟ ${nm(l, c)}เดินจากไปพร้อมความแค้นที่มากขึ้น`, { joy: -3 }, mem("argued", "คุณทะเลาะกับเขากลางลาน", 2, { grudge: 10 }))), { h: 4, c: 3 }),
    tagged(C("ขู่ให้เขาเลิกยุ่ง", N((l, c) => `${nm(l, c)}หน้าซีด แล้วถอยออกไป`, {}, mem("threat", "คุณขู่เขาต่อหน้าคนอื่น", 2, { fear: 25, grudge: 10, love: -10 }))), { m: -5, c: 3 }),
    tagged(P("ท้าดวลให้จบเรื่อง", (l, c) => fightOdds(l, 14 + (who(l, c)?.age ?? 20) * 0.6), G((l, c) => `${nm(l, c)}ล้มลง แล้วยอมรับความพ่ายแพ้`, { body: 6 }, mem("beaten", "คุณชนะเขาในการดวล", 2, { respect: 15, grudge: -10, fear: 10 })), B((l, c) => `${nm(l, c)}ชนะ และทั้งเมืองเห็น`, { hp: -10 }, mem("won", "เขาชนะคุณในการดวล", 2, { grudge: -15, respect: -5 }))), { c: 6 }),
  ]),
];

const yearly = (l: Life, p: Person, id: string) => (l.doneThisYear.includes(`fq:${id}:${p.id}`) ? "ปีนี้ทำไปแล้ว" : undefined);
const open = (l: Life, p: Person, id: string, eventId: string) => { l.doneThisYear.push(`fq:${id}:${p.id}`); runEvent(l, eventId, { pid: p.id }); };

export function morePersonActions(l: Life, p: Person): PersonAction[] {
  if (!l.ft || l.age < 12 || p.age < 12) return [];
  const out: PersonAction[] = [];
  const add = (id: string, label: string, eventId: string, locked?: string) => out.push({ id, label, locked: locked ?? yearly(l, p, id), run: (x) => open(x, p, id, eventId) });
  const x = r(p);
  if (CLOSE.includes(p.relation)) add("confide", "ระบายใจ", "ft.q.confide");
  if (l.age >= 16 && (x.love >= 40 || x.debt >= 30)) add("favor", "ขอความช่วยเหลือ", "ft.q.favor");
  if (l.age >= 14) add("gift", "ให้ของขวัญ", "ft.q.gift");
  if (l.age >= 16 && ["friend", "sibling", "ally", "father", "mother", "child"].includes(p.relation) && p.age >= 16) add("lend", "ให้ยืมเงิน", "ft.q.lend");
  if (l.age >= 16 && p.age >= 16 && owedAt(p) < 0 && ["friend", "sibling", "ally", "father", "mother"].includes(p.relation)) add("borrow", "ขอยืมเงิน", "ft.q.borrow");
  if (owedAt(p) >= 0) add("repay", "คืนเงิน", "ft.q.repay");
  if (x.grudge >= 20) add("apologize", "ขอโทษ", "ft.q.apologize");
  if (l.age >= 14 && (x.grudge >= 30 || x.jealousy >= 40 || p.relation === "rival")) add("confront", "เผชิญหน้า", "ft.q.confront");
  return out;
}

// ── คนรอบตัวมีชีวิตของตัวเอง ──
const NPC_LIFE: GameEvent[] = [
  E("ft.np.sick", [8, 400], (l, c) => `${nm(l, c)}ล้มป่วยหนัก หมอบอกว่ายาที่ได้ผลแพงเกินกว่าที่บ้านเขาจะซื้อไหว`, [
    PAY("ซื้อยาให้", 10, G((l, c) => `${nm(l, c)}หายดีในหนึ่งเดือน และไม่เคยลืมว่าใครซื้อยามา`, {}, both(mem("medicine", "คุณซื้อยาให้ตอนป่วยหนัก", 3, { debt: 40, love: 10 }), (l) => lean(l, { m: 4 })))),
    C("ไปเฝ้าไข้ทุกวัน", G((l, c) => `${nm(l, c)}ค่อยๆ ดีขึ้น เพราะมีคนนั่งข้างเตียงทุกวัน`, { joy: -2 }, mem("visited", "คุณมาเฝ้าไข้ทุกวัน", 2, { love: 12, trust: 6 }))),
    tagged(C("ส่งจดหมายอวยพรไปแทน", N((l, c) => `${nm(l, c)}อ่านจดหมาย แล้ววางไว้ข้างเตียง`, {}, mem("letter", "คุณส่งแค่จดหมายตอนเขาป่วยหนัก", 1, { love: -6 }))), { m: -2 }),
  ], { ...one((_l, p) => CLOSE.includes(p.relation) && p.age >= 10), weight: 12, maxTimes: 3, title: "คนใกล้ตัวป่วย" }),
  E("ft.np.wedding", [16, 400], (l, c) => `${nm(l, c)}จะแต่งงาน และส่งเทียบเชิญมาให้คุณเป็นคนกล่าวอวยพร`, [
    C("กล่าวอวยพรจนแขกน้ำตาซึม", G((l, c) => `ทั้งงานปรบมือ ${nm(l, c)}กอดคุณกลางเวที`, { joy: 6 }, both(mem("wedding", "คุณกล่าวอวยพรในงานแต่งงาน", 2, { love: 10, loyalty: 6 }), (_l, c) => { const p = who(_l, c); if (p && !p.tags?.includes("married")) p.tags = [...(p.tags ?? []), "married"]; }))),
    C("ปฏิเสธเพราะติดธุระ", N((l, c) => `${nm(l, c)}ตอบว่าเข้าใจ แต่น้ำเสียงไม่ใช่`, {}, both(mem("no_show", "คุณไม่มางานแต่งงาน", 2, { love: -10 }), (_l, c) => { const p = who(_l, c); if (p && !p.tags?.includes("married")) p.tags = [...(p.tags ?? []), "married"]; }))),
  ], { ...one((_l, p) => p.relation === "friend" && p.age >= 18 && !p.tags?.includes("married") && r(p).love >= 45), weight: 10, maxTimes: 2, title: "เทียบเชิญงานแต่ง" }),
  E("ft.np.godparent", [18, 400], (l, c) => `${nm(l, c)}เพิ่งมีลูก และขอให้คุณเป็นพ่อแม่อุปถัมภ์ของเด็ก`, [
    C("รับด้วยความยินดี", G(() => `คุณอุ้มเด็กตัวเล็กไว้ และสัญญาว่าจะดูแลเขาถ้าวันหนึ่งเกิดอะไรขึ้น`, { joy: 8 }, both(mem("godparent", "คุณรับเป็นพ่อแม่อุปถัมภ์ของลูกเขา", 3, { love: 12, loyalty: 12, trust: 8 }), (_l, c) => { const p = who(_l, c); if (p) p.tags = [...(p.tags ?? []).filter((t) => t !== "parent"), "parent"]; }))),
    C("บอกว่ายังไม่พร้อม", N((l, c) => `${nm(l, c)}ไปขอคนอื่นแทน`, {}, mem("no_godparent", "คุณปฏิเสธเป็นพ่อแม่อุปถัมภ์", 1, { love: -4 }))),
  ], { ...one((_l, p) => ["friend", "sibling"].includes(p.relation) && p.age >= 20 && p.age <= 45 && !!p.tags?.includes("married") && !p.tags?.includes("parent")), weight: 10, maxTimes: 2, title: "ลูกของเพื่อน" }),
  E("ft.np.ask_loan", [16, 400], (l, c) => `${nm(l, c)}มาหาตอนดึก หน้าซีด "ข้าติดหนี้พวกนักเลง ถ้าไม่จ่ายภายในสามวัน"`, [
    PAY("จ่ายหนี้ให้", 15, G((l, c) => `${nm(l, c)}ร้องไห้กอดคุณ`, {}, both(mem("saved_debt", "คุณจ่ายหนี้ให้ตอนนักเลงจะเอาชีวิต", 3, { debt: 50, love: 12, loyalty: 10 }), (l, c) => plant(l, "friend_debt", who(l, c)?.name), (l) => lean(l, { m: 5 })))),
    P("ไปคุยกับพวกนักเลงเอง", (l) => fightOdds(l, 22), G((l, c) => `นักเลงยอมลดหนี้ให้ครึ่งหนึ่ง หลังเห็นดาบของคุณ ${nm(l, c)}จ่ายส่วนที่เหลือเอง`, { body: 4 }, both(mem("stood_up", "คุณไปยืนเผชิญหน้ากับพวกนักเลงแทน", 3, { debt: 35, respect: 12 }), (l) => lean(l, { c: 5 }))), B("พวกนักเลงรุมคุณกลางซอย", { hp: -14 }, mem("tried", "คุณพยายามช่วยแม้จะแพ้", 2, { love: 8 }))),
    tagged(C("บอกว่าช่วยไม่ได้", B((l, c) => `${nm(l, c)}หายไปสองเดือน กลับมาพร้อมแผลที่หน้า`, {}, mem("refused", "คุณไม่ช่วยตอนนักเลงจะเอาชีวิต", 2, { love: -12, grudge: 10 }))), { m: -4 }),
  ], { ...one((_l, p) => ["friend", "sibling"].includes(p.relation) && p.age >= 18), weight: 9, maxTimes: 2, title: "หนี้นักเลง" }),
  E("ft.np.hurt", [16, 400], (l, c) => `${nm(l, c)}ถูกหามกลับจากงานกิลด์ ขาข้างหนึ่งหัก หมอบอกว่าต้องพักครึ่งปี`, [
    C("ทำงานแทนเขาจนหาย", G((l, c) => `คุณเหนื่อยครึ่งปี แต่${nm(l, c)}ไม่เสียงานกิลด์`, { hp: -4, gold: 6 }, mem("covered", "คุณทำงานแทนตอนขาหัก", 3, { debt: 35, loyalty: 12 }))),
    PAY("จ้างหมอเวทรักษา", 12, G((l, c) => `${nm(l, c)}เดินได้ในสามวัน`, {}, mem("healer", "คุณจ้างหมอเวทรักษาขาให้", 2, { debt: 25, love: 6 }))),
  ], { ...one((l, p) => (p.relation === "friend" || !!p.tags?.some((t) => t.startsWith("party:"))) && p.age >= 16 && l.age >= 16), weight: 9, maxTimes: 2, title: "เพื่อนบาดเจ็บ" }),
  E("ft.np.success", [16, 400], (l, c) => `${nm(l, c)}ได้เลื่อนขั้นเป็นหัวหน้าในงานของเขา และทั้งเมืองพูดถึง`, [
    tagged(C("ไปแสดงความยินดีจากใจ", G((l, c) => `${nm(l, c)}ยิ้มกว้าง "ข้าอยากให้เจ้าเห็นวันนี้ที่สุด"`, { joy: 3 }, mem("cheered", "คุณมาแสดงความยินดีจากใจ", 1, { love: 6 }))), { m: 2 }),
    tagged(C("แอบหงุดหงิดว่าทำไมไม่ใช่คุณ", N("คุณยิ้มไม่ออก และเขาสังเกตเห็น", { joy: -3 }, mem("envied", "คุณดูไม่ดีใจด้วย", 1, { love: -4 }))), { m: -2 }),
  ], { ...one((_l, p) => p.relation === "friend" && p.age >= 22 && !p.tags?.includes("promoted")), weight: 8, maxTimes: 2, title: "เพื่อนได้ดี", prepare: (l) => { const p = pick(l, alive(l, (x) => x.relation === "friend" && x.age >= 22 && !x.tags?.includes("promoted"))); p.tags = [...(p.tags ?? []), "promoted"]; return { pid: p.id }; } }),
  E("ft.np.secret", [16, 400], (l, c) => `${nm(l, c)}สารภาพความลับที่ไม่เคยบอกใคร: เขา${profileOf(who(l, c)!).secret?.text ?? "เคยทำเรื่องที่ไม่อยากให้ใครรู้"}`, [
    tagged(C("เก็บเป็นความลับไปจนตาย", G((l, c) => `${nm(l, c)}โล่งใจจนน้ำตาไหล`, {}, both(mem("kept", "คุณเก็บความลับของเขา", 3, { trust: 20, loyalty: 10 }), (_l, c) => { const p = who(_l, c); if (p?.secret) p.secret.known = true; }))), { h: 3 }),
    tagged(C("เล่าให้คนอื่นฟัง", B((l, c) => `ความลับนั้นแพร่ไปทั้งเมืองภายในสัปดาห์ ${nm(l, c)}รู้ว่าใครเล่า`, {}, both(mem("betrayed", "คุณเอาความลับของเขาไปเล่า", 3, { trust: -40, grudge: 40, love: -20 }), (l) => spread(l, "เอาความลับของเพื่อนไปเล่า", -1, 35)))), { h: -6, m: -4 }),
  ], { ...one((_l, p) => !!profileOf(p).secret && !profileOf(p).secret!.known && r(p).trust >= 60), weight: 10, maxTimes: 2, title: "ความลับของเพื่อน" }),
  E("ft.np.drift", [14, 400], (l, c) => `คุณกับ${nm(l, c)}ไม่ได้คุยกันนานแล้ว วันนี้เดินสวนกันที่ตลาด ต่างฝ่ายต่างทำเป็นไม่เห็น`, [
    C("วิ่งตามไปทัก", G((l, c) => `${nm(l, c)}หัวเราะ "ข้านึกว่าเจ้าลืมข้าไปแล้ว"`, { joy: 4 }, mem("reached", "คุณวิ่งตามมาทักทั้งที่ห่างกันไปนาน", 2, { love: 10, trust: 5 }))),
    C("ปล่อยให้เดินผ่านไป", N("บางมิตรภาพจบลงเงียบๆ แบบนี้", { joy: -2 })),
  ], { ...one((_l, p) => p.relation === "friend" && p.bond < 30 && p.bond > 5), weight: 9, maxTimes: 3, title: "เพื่อนที่ห่างกัน" }),
  E("ft.np.moving", [14, 400], (l, c) => `${nm(l, c)}กำลังจะย้ายไปอยู่เมืองอื่น เกวียนจอดรออยู่หน้าบ้าน`, [
    C("ช่วยขนของจนเสร็จ", G((l, c) => `${nm(l, c)}โบกมือจากเกวียนจนลับตา และสัญญาว่าจะเขียนจดหมายมา`, { joy: -2 }, both(mem("helped_move", "คุณช่วยขนของวันย้ายบ้าน", 2, { love: 8 }), (_l, c) => { const p = who(_l, c); if (p) p.tags = [...(p.tags ?? []), `away:${_l.age}`]; }))),
    K("ขอให้อยู่ต่อ", "looks", 55, G((l, c) => `${nm(l, c)}ยกของลงจากเกวียน "ก็ได้ เพื่อเจ้า"`, { joy: 6 }, mem("stayed", "เขายอมไม่ย้ายเพราะคุณขอ", 3, { love: 10, loyalty: 10 })), N((l, c) => `${nm(l, c)}กอดคุณ แล้วขึ้นเกวียนไป`, { joy: -4 }, (_l, c) => { const p = who(_l, c); if (p) p.tags = [...(p.tags ?? []), `away:${_l.age}`]; })),
  ], { ...one((_l, p) => p.relation === "friend" && p.age >= 18 && !p.tags?.some((t) => t.startsWith("party:"))), weight: 5, maxTimes: 2, title: "เพื่อนย้ายเมือง" }),
];

// ── เรื่องในครอบครัว ──
const parentGoneRecently = (l: Life) => l.people.some((p) => !p.alive && (p.relation === "father" || p.relation === "mother")) && Number(l.flags.lossAge ?? -99) >= l.age - 2;
const FAMILY: GameEvent[] = [
  E("ft.fd.inherit", [14, 400], (l, c) => `หลังงานศพ ${nm(l, c)}ยื่นพินัยกรรมให้ดู ทรัพย์สินที่เหลือไม่มาก แต่มีบ้านหลังเก่าที่ทั้งคู่โตมา`, [
    tagged(C("แบ่งกันเท่าๆ กัน", G((l, c) => `${nm(l, c)}พยักหน้า ทั้งคู่นั่งเงียบอยู่ในบ้านหลังเก่าด้วยกัน`, { gold: 15 }, mem("fair", "คุณแบ่งมรดกอย่างยุติธรรม", 2, { trust: 10, love: 6 }))), { h: 3 }),
    tagged(C("ยกบ้านให้เขาทั้งหลัง", G((l, c) => `${nm(l, c)}ไม่พูดอะไร แต่กอดคุณแน่นเหมือนตอนเด็ก`, { joy: 4 }, mem("gave_house", "คุณยกบ้านของพ่อแม่ให้", 3, { love: 15, debt: 30 }))), { m: 6 }),
    tagged(K("อ้างว่าพ่อแม่สัญญาไว้ให้คุณ", "smarts", 50, G("คุณได้ทุกอย่าง", { gold: 40 }, mem("cheated", "คุณโกงมรดกที่ควรแบ่งกัน", 3, { grudge: 45, trust: -30, love: -15 })), B((l, c) => `${nm(l, c)}จับโกหกได้ และเล่าให้ญาติทุกคนฟัง`, {}, both(mem("cheated", "คุณพยายามโกงมรดก", 3, { grudge: 35, trust: -25 }), (l) => spread(l, "พยายามโกงมรดกพี่น้อง", -1, 30)))), { h: -8, m: -5 }),
  ], { ...one((l, p) => p.relation === "sibling" && parentGoneRecently(l)), weight: 25, maxTimes: 2, title: "พินัยกรรม" }),
  E("ft.fd.parent_care", [20, 400], (l, c) => `${nm(l, c)}แก่ลงมาก เดินได้ไม่ไกลแล้ว และลืมว่าวางแว่นไว้ที่ไหนทุกวัน`, [
    tagged(C("รับมาอยู่ด้วยกัน", G((l, c) => `บ้านแคบลง แต่${nm(l, c)}หัวเราะทุกเย็น`, { joy: 3, gold: -6 }, mem("took_in", "คุณรับมาดูแลตอนแก่", 3, { love: 15, debt: 30 }))), { m: 6 }),
    PAY("จ้างคนดูแล", 12, G((l, c) => `${nm(l, c)}สบายดี แต่ถามหาคุณทุกวัน`, {}, mem("nurse", "คุณจ้างคนมาดูแล", 1, { love: 3 }))),
    tagged(C("แวะไปเยี่ยมบ้างเมื่อว่าง", N((l, c) => `${nm(l, c)}นั่งรอที่หน้าต่างทุกเย็น`, {}, mem("left", "คุณปล่อยให้อยู่คนเดียวตอนแก่", 2, { love: -10 }))), { m: -4 }),
  ], { ...one((l, p) => (p.relation === "father" || p.relation === "mother") && p.age >= 68 && l.age >= 20 && !p.tags?.includes("cared")), weight: 16, maxTimes: 2, title: "พ่อแม่แก่ชรา", prepare: (l) => { const p = pick(l, alive(l, (x) => (x.relation === "father" || x.relation === "mother") && x.age >= 68 && !x.tags?.includes("cared"))); p.tags = [...(p.tags ?? []), "cared"]; return { pid: p.id }; } }),
  E("ft.fd.rebel", [28, 400], (l, c) => `${nm(l, c)}อายุ ${who(l, c)?.age} ปี กลับบ้านดึกทุกคืน และวันนี้ตะโกนใส่คุณว่า "ท่านไม่เคยเข้าใจข้าเลย"`, [
    tagged(C("นั่งลงฟังว่าเกิดอะไรขึ้น", G((l, c) => `${nm(l, c)}ร้องไห้ เรื่องทั้งหมดมาจากเพื่อนที่โรงเรียน`, { joy: 2 }, mem("listened", "คุณนั่งฟังตอนเขาโกรธที่สุด", 3, { trust: 15, love: 10 }))), { m: 5 }),
    tagged(C("ลงโทษให้รู้ว่าใครเป็นพ่อแม่", N((l, c) => `${nm(l, c)}เงียบ แต่ประตูห้องปิดดังกว่าเดิม`, {}, mem("punished", "คุณลงโทษหนักตอนเขาวัยรุ่น", 2, { respect: 6, love: -8, grudge: 8 }))), { m: -3 }),
    tagged(C("ปล่อยให้เขาเรียนรู้เอง", N((l, c) => `${nm(l, c)}ทำพลาดหลายเรื่อง แต่เรียนรู้จากทุกเรื่อง`, {}, mem("free", "คุณปล่อยให้เขาเลือกทางเอง", 1, { trust: 6 }))), { c: 2 }),
  ], { ...one((_l, p) => p.relation === "child" && p.age >= 13 && p.age <= 17), weight: 16, maxTimes: 2, title: "ลูกวัยรุ่น" }),
  E("ft.fd.path", [34, 400], (l, c) => `${nm(l, c)}บอกว่าจะ${pick(l, ["ไปเป็นนักผจญภัยในดินแดนไกล", "แต่งงานกับคนที่คุณไม่ชอบหน้า", "ไปบวชในวิหารบนเขา", "ทิ้งงานของตระกูลไปเป็นนักดนตรี"])}`, [
    tagged(C("สนับสนุนเต็มที่", G((l, c) => `${nm(l, c)}กอดคุณแน่น "ข้ากลัวท่านจะห้ามที่สุด"`, { joy: 4 }, mem("supported", "คุณสนับสนุนทางที่เขาเลือก", 3, { love: 15, trust: 12 }))), { m: 4 }),
    tagged(C("ห้ามเด็ดขาด", B((l, c) => `${nm(l, c)}ไปอยู่ดี และไม่เขียนจดหมายกลับบ้านอีกหลายปี`, { joy: -6 }, mem("forbade", "คุณห้ามทางที่เขาเลือก", 3, { love: -15, grudge: 20 }))), { m: -4, h: 2 }),
  ], { ...one((_l, p) => p.relation === "child" && p.age >= 18 && p.age <= 24 && !p.tags?.includes("pathed")), weight: 16, maxTimes: 2, title: "ทางของลูก", prepare: (l) => { const p = pick(l, alive(l, (x) => x.relation === "child" && x.age >= 18 && x.age <= 24 && !x.tags?.includes("pathed"))); p.tags = [...(p.tags ?? []), "pathed"]; return { pid: p.id }; } }),
  E("ft.fd.sibling_envy", [18, 400], (l, c) => `${nm(l, c)}ดื่มหนักในงานรวมญาติ แล้วพูดเสียงดังว่าพ่อแม่รักคุณมากกว่ามาตลอด`, [
    tagged(C("ยอมรับว่าเขาอาจพูดถูก", G((l, c) => `${nm(l, c)}อึ้งไป แล้วหัวเราะทั้งน้ำตา`, {}, mem("admitted", "คุณยอมรับว่าเขาถูกเปรียบเทียบมาตลอด", 2, { jealousy: -25, love: 10 }))), { h: 4, m: 3 }),
    tagged(C("ตอบกลับต่อหน้าทุกคน", B((l, c) => `งานรวมญาติจบลงด้วยจานแตกสามใบ และ${nm(l, c)}ไม่พูดกับคุณอีกนาน`, {}, mem("shamed", "คุณตอบโต้ต่อหน้าญาติทั้งหมด", 2, { grudge: 20, jealousy: 10 }))), { m: -3 }),
  ], { ...one((l, p) => p.relation === "sibling" && (l.fame >= 25 || l.money >= 300 * GOLD)), weight: 10, maxTimes: 2, title: "พี่น้องอิจฉา" }),
  E("ft.fd.inlaws", [20, 400], (l, c) => `พ่อแม่ของ${nm(l, c)}มาค้างที่บ้านหนึ่งสัปดาห์ แม่ของเขาลูบนิ้วตามขอบโต๊ะแล้วมองฝุ่นบนนิ้ว`, [
    K("ทำอาหารมื้อใหญ่ต้อนรับ", "smarts", 45, G("พ่อตาแม่ยายขอสูตรกลับไปด้วย", { joy: 5 }, mem("inlaws", "คุณต้อนรับพ่อแม่ของเขาอย่างดี", 2, { love: 8 })), N("อาหารไหม้ แต่ทุกคนหัวเราะ", {}, mem("inlaws", "คุณพยายามเต็มที่กับพ่อแม่ของเขา", 1, { love: 4 }))),
    tagged(C("บอกตรงๆ ว่าไม่ชอบถูกตรวจ", N((l, c) => `บ้านเย็นชาไปทั้งสัปดาห์ ${nm(l, c)}ยืนอยู่ตรงกลางระหว่างสองฝั่ง`, {}, mem("inlaws_fight", "คุณทะเลาะกับพ่อแม่ของเขา", 2, { love: -8 }))), { h: 4, m: -2 }),
  ], { ...one((_l, p) => p.relation === "spouse"), weight: 9, maxTimes: 2, title: "พ่อตาแม่ยาย" }),
  E("ft.fd.secret", [16, 400], (l, c) => `${nm(l, c)}เรียกคุณเข้าไปคุยตามลำพัง "มีเรื่องหนึ่งที่ข้าเก็บไว้ตั้งแต่เจ้าเกิด"`, [
    C("ฟังให้จบ", (l, c) => { const roll = randInt(l, 0, 2); const p = who(l, c); if (p) remember(l, p, "secret_told", "เล่าความลับของครอบครัวให้คุณฟัง", 2, { trust: 10 }); if (roll === 0) { l.money += 40 * GOLD; return { text: "ปู่ของคุณเป็นขุนนางที่ถูกริบยศ และทิ้งทองไว้ใต้ต้นโอ๊กหลังบ้าน", kind: "good" }; } if (roll === 1) { const s = createPerson(l, "sibling", { age: l.age, bond: 30 }); s.job = "พี่น้องที่ไม่เคยรู้จัก"; return { text: `คุณมีพี่น้องอีกคนที่ถูกส่งไปเลี้ยงที่อื่นตั้งแต่เกิด ชื่อ${shortName(s)}`, kind: "milestone" }; } l.money = Math.max(0, l.money - 20 * GOLD); return { text: "บ้านหลังนี้ติดจำนองมาสามรุ่น และงวดสุดท้ายถึงกำหนดแล้ว", kind: "bad" }; }),
  ], { ...one((_l, p) => (p.relation === "father" || p.relation === "mother") && p.age >= 55), weight: 8, maxTimes: 1, title: "ความลับของครอบครัว" }),
  E("ft.fd.spouse_jealous", [20, 400], (l, c) => `${nm(l, c)}เห็นคุณหัวเราะกับเพื่อนคนหนึ่งในตลาด คืนนั้นทั้งบ้านเงียบผิดปกติ`, [
    tagged(C("อธิบายและพาเพื่อนมาทำความรู้จัก", G((l, c) => `${nm(l, c)}เขินอาย และกลายเป็นเพื่อนกับเพื่อนคุณ`, { joy: 3 }, mem("reassured", "คุณอธิบายด้วยความจริงใจ", 2, { trust: 12, jealousy: -20 }))), { h: 4 }),
    tagged(C("บอกว่าคิดมากเกินไป", N((l, c) => `${nm(l, c)}ไม่ถามอีก แต่ไม่ได้เชื่อ`, {}, mem("dismissed", "คุณปัดความรู้สึกของเขาทิ้ง", 1, { trust: -6, jealousy: 10 }))), { m: -2 }),
  ], { ...one((l, p) => p.relation === "spouse" && l.people.some((x) => x.alive && x.relation === "friend")), weight: 8, maxTimes: 2, title: "ความหึง" }),
];

// ── ศัตรูลงมือ ──
/** ศัตรูลงมือแล้วความแค้นระบายไปบ้าง ไม่ตามรังควานทุกปี */
const foeOf = (min: number) => { const o = one((l, p) => !FAM.includes(p.relation) && r(p).grudge >= min && p.age >= 14 && l.age >= 14); return { when: o.when, prepare: (l: Life): Ctx => { const c = o.prepare(l); const p = who(l, c); if (p) feel(p, { grudge: -12 }); return c; } }; };
const ENEMIES: GameEvent[] = [
  E("ft.en.rumor", [14, 400], (l, c) => `ข่าวลือเสียๆ หายๆ เรื่องคุณแพร่ไปทั่วตลาด ต้นเรื่องคือ${nm(l, c)}`, [
    tagged(K("เล่าความจริงแก้ข่าว", "looks", 50, G("คนส่วนใหญ่เชื่อคุณ ข่าวลือเงียบลง", { joy: 2 }), B("ยิ่งแก้ยิ่งดูมีพิรุธ", { fame: -3 }, (l) => spread(l, "ถูกลือว่าทำเรื่องน่าอาย", -1, 35))), { h: 3 }),
    tagged(C("ปล่อยข่าวลือกลับใส่เขา", N((l, c) => `ข่าวลือของคุณแรงกว่า ${nm(l, c)}ต้องหลบหน้าหลายเดือน`, {}, both(mem("rumored", "คุณปล่อยข่าวลือกลับใส่เขา", 2, { grudge: 15, fear: 10 }), (l) => lean(l, { h: -5 })))), { h: -4 }),
    C("ไม่สนใจ", N("ข่าวลือจางไปเองในหนึ่งปี แต่ไม่ใช่ทุกคนจะลืม", {}, (l) => spread(l, "ถูกลือว่าทำเรื่องน่าอาย", -1, 20))),
  ], { ...foeOf(45), weight: 12, maxTimes: 3, title: "ข่าวลือ" }),
  E("ft.en.sabotage", [16, 400], (l, c) => `งานของคุณพังกลางคันเพราะใครบางคนแอบเปลี่ยนเอกสาร หลักฐานชี้ไปที่${nm(l, c)}`, [
    K("ยื่นหลักฐานให้นายจ้าง", "smarts", 55, G((l, c) => `${nm(l, c)}ถูกไล่ออก และนายจ้างไว้ใจคุณมากขึ้น`, { gold: 8 }, mem("exposed", "คุณเปิดโปงเขาต่อนายจ้าง", 3, { grudge: 20, fear: 15 })), B("หลักฐานไม่พอ คุณถูกหักเงินเดือน", { gold: -10 })),
    C("ซ่อมงานให้เสร็จเงียบๆ", N("คุณทำงานเกินเวลาไปทั้งเดือน", { hp: -4 }, (l) => lean(l, { c: -2 }))),
  ], { ...foeOf(55), weight: 10, maxTimes: 2, title: "งานที่ถูกแกล้ง" }),
  E("ft.en.lover", [18, 400], (l, c) => `${nm(l, c)}เริ่มแวะเวียนมาหาคู่ครองของคุณบ่อยขึ้น พร้อมของขวัญและคำหวาน`, [
    C("รอดูว่าคู่ครองจะทำอย่างไร", (l, c) => { const s = l.people.find((x) => x.alive && x.relation === "spouse"); const loyal = !!s && (r(s).love >= 60 || r(s).loyalty >= 60); if (s && loyal) { remember(l, s, "loyal", "ปฏิเสธคนที่พยายามแย่งไปจากคุณ", 2, { loyalty: 6 }); return { text: `คู่ครองของคุณปิดประตูใส่${nm(l, c)} แล้วมาเล่าให้คุณฟังทุกอย่าง`, kind: "good" }; } if (s) { feel(s, { trust: -15, love: -10 }); return { text: "คู่ครองของคุณรับของขวัญไว้ และคุณเห็นแววตาที่เปลี่ยนไป", kind: "bad" }; } return { text: "เรื่องนี้จางไปเอง", kind: "normal" }; }),
    tagged(C("ไปเตือนเขาถึงบ้าน", N((l, c) => `${nm(l, c)}ยิ้มเยาะ แต่ไม่มาอีก`, {}, mem("warned", "คุณมาเตือนถึงบ้าน", 1, { fear: 10, grudge: 5 }))), { c: 3 }),
  ], { ...one((l, p) => !FAM.includes(p.relation) && r(p).grudge >= 50 && l.people.some((x) => x.alive && x.relation === "spouse")), weight: 8, maxTimes: 1, title: "มือที่สาม" }),
  E("ft.en.thugs", [16, 400], (l, c) => `นักเลงสามคนดักคุณในซอยมืด "${nm(l, c)}ฝากความคิดถึงมา"`, [
    P("สู้", (l) => fightOdds(l, 20 + Math.min(30, l.age / 2)), G("นักเลงวิ่งหนี คนหนึ่งทำมีดหล่นไว้", { body: 8 }), B("พวกมันกระทืบคุณจนลุกไม่ขึ้นไปสามวัน", { hp: -18 })),
    PAY("จ่ายให้พวกมันไปทำงานให้คุณแทน", 15, G((l, c) => `นักเลงเปลี่ยนข้าง และไปทุบประตูบ้าน${nm(l, c)}แทน`, {}, both(mem("thugs_back", "คุณจ้างนักเลงย้อนกลับไปหาเขา", 2, { fear: 20, grudge: 10 }), (l) => lean(l, { m: -4, h: -2 })))),
  ], { ...foeOf(65), weight: 10, maxTimes: 2, title: "นักเลงในซอย" }),
  E("ft.en.assassin", [16, 400], (l, c) => `มือสังหารที่${nm(l, c)}จ้างมารออยู่ในห้องนอนของคุณ แสงจันทร์สะท้อนคมมีด`, [
    P("สู้เพื่อชีวิต", (l) => fightOdds(l, 34 + Math.min(30, l.age / 2)), G((l, c) => `มือสังหารรับสารภาพว่าใครจ้าง ${nm(l, c)}ถูกจับในวันรุ่งขึ้น`, { body: 10 }, (_l, c) => { const p = who(_l, c); if (p) { p.tags = [...(p.tags ?? []), `away:${_l.age}`]; feel(p, { grudge: 10 }); } }), B("มีดเฉียดหัวใจ คุณรอดเพราะเพื่อนบ้านได้ยินเสียง", { hp: -30 })),
    tagged(K("เสนอเงินมากกว่าที่เขาได้", "smarts", 50, G((l, c) => `มือสังหารยิ้ม แล้วเดินออกไปหา${nm(l, c)}แทน`, { gold: -20 }, (l) => lean(l, { h: -2 })), B("มือสังหารรับเงิน แล้วแทงคุณอยู่ดี", { hp: -24, gold: -20 })), { c: -2 }),
  ], { ...foeOf(85), weight: 6, maxTimes: 1, title: "มือสังหาร" }),
];

// ── เพื่อนใช้หนี้บุญคุณ ──
const friendOf = (f: (l: Life, p: Person) => boolean) => one((l, p) => !["rival"].includes(p.relation) && (r(p).debt >= 45 || r(p).loyalty >= 70) && f(l, p));
const FRIENDS: GameEvent[] = [
  E("ft.fr.jail", [14, 400], (l, c) => `ประตูห้องขังเปิดออกก่อนกำหนด ${nm(l, c)}จ่ายค่าประกันตัวให้คุณ และยืนรออยู่หน้าคุก`, [
    C("กอดเขา", G("แสงแดดข้างนอกไม่เคยสดใสขนาดนี้", { joy: 10 }, both((l) => { l.flags.jailUntil = l.age; }, (_l, c) => { const p = who(_l, c); if (p) feel(p, { debt: -30 }); }))),
  ], { ...friendOf((l) => Number(l.flags.jailUntil ?? -1) > l.age + 1), weight: 40, maxTimes: 2, title: "ประตูคุกเปิด" }),
  E("ft.fr.broke", [14, 400], (l, c) => `ถุงเงินถูกวางไว้หน้าประตูบ้านคุณตอนเช้า ลายมือบนป้ายคือของ${nm(l, c)}`, [
    C("รับไว้ด้วยความขอบคุณ", G("เงินก้อนนั้นพาคุณผ่านฤดูหนาวไปได้", { gold: 15, joy: 5 }, (_l, c) => { const p = who(_l, c); if (p) feel(p, { debt: -25 }); })),
  ], { ...friendOf((l) => l.money < 5 * GOLD && l.age >= 16), weight: 25, maxTimes: 3, title: "ถุงเงินหน้าประตู" }),
  E("ft.fr.nurse", [10, 400], (l, c) => `${nm(l, c)}ย้ายมานอนในบ้านคุณ ต้มยาทุกเช้า และไม่ยอมให้คุณลุกจากเตียง`, [
    C("ยอมนอนพัก", G("คุณหายเร็วกว่าที่หมอคาดไว้มาก", { hp: 18, joy: 4 }, (_l, c) => { const p = who(_l, c); if (p) feel(p, { debt: -20, love: 4 }); })),
  ], { ...friendOf((l) => l.stats.health < 30), weight: 30, maxTimes: 3, title: "คนเฝ้าไข้" }),
  E("ft.fr.warn", [14, 400], (l, c) => `${nm(l, c)}แอบมาบอกว่าได้ยินศัตรูของคุณวางแผนอะไรบางอย่าง และบอกว่าใคร`, [
    C("ขอบคุณแล้วระวังตัว", G("คุณรู้ล่วงหน้า และแผนนั้นไม่เคยได้เริ่ม", { joy: 3 }, (l) => { for (const p of l.people) if (p.alive && relOf(p).grudge >= 50) feel(p, { grudge: -15 }); })),
  ], { ...friendOf((l) => l.people.some((p) => p.alive && relOf(p).grudge >= 50)), weight: 8, maxTimes: 2, title: "คำเตือนจากเพื่อน" }),
  E("ft.fr.defend", [14, 400], (l, c) => `${nm(l, c)}ลุกขึ้นยืนกลางโรงเตี๊ยม แล้วตะโกนว่าข่าวลือเรื่องคุณไม่จริงสักคำ`, [
    C("ยืนข้างเขา", G("ทั้งร้านเงียบ แล้วคนที่เล่าข่าวลือก็ลุกออกไป", { joy: 5 }, (l) => { for (const x of talkHere(l)) if (x.tone === -1) x.heat -= 20; })),
  ], { ...friendOf((l) => talkHere(l).some((x) => x.tone === -1 && x.heat >= 30)), weight: 10, maxTimes: 2, title: "เพื่อนแก้ข่าว" }),
];

export const PEOPLE2_EVENTS: GameEvent[] = [...SCENES, ...NPC_LIFE, ...FAMILY, ...ENEMIES, ...FRIENDS];

/** ความแค้นตกทอด: ศัตรูที่ตายไปอาจมีลูกหรือพวกพ้องมารับช่วงต่อ */
function grudgeYear(l: Life) {
  for (const p of l.people) {
    if (p.alive || p.tags?.includes("feud_done") || relOf(p).grudge < 60 || FAM.includes(p.relation)) continue;
    p.tags = [...(p.tags ?? []), "feud_done"];
    if (!chance(l, 0.5)) continue;
    const heir = createPerson(l, "rival", { age: Math.max(16, Math.min(l.age, p.age - 22)), bond: 10 });
    heir.job = `ลูกของ${shortName(p)}`;
    heir.tags = [...(heir.tags ?? []), "feud"];
    remember(l, heir, "feud", `พ่อแม่ของเขาแค้นคุณจนวันตาย`, 3, { grudge: 55, trust: -20 });
    log(l, `${shortName(heir)} ลูกของ${shortName(p)} สาบานต่อหน้าหลุมศพว่าจะสะสางเรื่องที่พ่อแม่ค้างไว้กับคุณ`, "bad");
  }
  // เงินที่ยืมแล้วไม่คืนห้าปี กลายเป็นความแค้น
  for (const p of l.people) {
    const at = owedAt(p);
    if (!p.alive || at < 0 || l.age - at < 5 || p.tags?.includes("owe_late")) continue;
    p.tags = [...(p.tags ?? []), "owe_late"];
    remember(l, p, "unpaid", "คุณยืมเงินแล้วไม่เคยคืน", 2, { grudge: 20, trust: -20 });
    log(l, `${shortName(p)}เลิกทวงเงินที่คุณยืมไปห้าปีก่อน และเลิกไว้ใจคุณไปด้วย`, "bad");
  }
}

/** ทายาทรับศัตรูของพ่อแม่ไปด้วย */
export function inheritFeuds(dead: Life, next: Life) {
  for (const p of dead.people) {
    if (!p.alive || FAM.includes(p.relation) || relOf(p).grudge < 50) continue;
    if (next.people.some((x) => x.id === p.id)) continue;
    const copy: Person = { ...structuredClone(p), relation: "rival", tags: [...(p.tags ?? []).filter((t) => !t.startsWith("party:")), "feud"], mem: [{ age: 0, k: "feud", text: `แค้น${dead.firstName}พ่อแม่ของคุณ`, w: 3, known: true }] };
    copy.rel = { ...relOf(p), grudge: Math.round(relOf(p).grudge * 0.8), love: 0, trust: 10 };
    copy.bond = clamp(copy.bond, 0, 20);
    next.people.push(copy);
  }
}

/** เรื่องของคนรอบตัวมีช่องของตัวเองทุกปี ไม่ต้องแย่งกับเรื่องอื่นอีกหลายร้อยเรื่อง */
const DRAMA = [...NPC_LIFE, ...FAMILY, ...ENEMIES, ...FRIENDS];
export const DRAMA_CHANCE = 0.55;
function dramaYear(l: Life) {
  if (l.age < 8 || !chance(l, DRAMA_CHANCE) || l.queue.some((q) => q.eventId.startsWith("ft.np.") || q.eventId.startsWith("ft.fd.") || q.eventId.startsWith("ft.en.") || q.eventId.startsWith("ft.fr."))) return;
  const pool = DRAMA.filter((e) => l.age >= e.minAge && l.age <= e.maxAge && (l.seen[e.id] ?? 0) < (e.maxTimes ?? 1) && (!e.when || e.when(l)));
  const e = weightedPick(l, pool, (x) => (typeof x.weight === "function" ? x.weight(l) : x.weight ?? 10));
  if (e) runEvent(l, e.id);
}

export function loadPeople2() {
  const base = personActionHooks.fantasy;
  personActionHooks.fantasy = (l, p) => [...(base?.(l, p) ?? []), ...morePersonActions(l, p)];
  yearHooks.push((l) => { if (l.worldId === "fantasy" && l.ft && l.alive) { grudgeYear(l); dramaYear(l); } });
}
export type { Res };

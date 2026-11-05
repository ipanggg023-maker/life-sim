// ครอบครัวและบั้นปลาย: สิ่งที่สอนลูกติดตัวทายาท · พินัยกรรมส่งของใหญ่ต่อ · งานของชีวิตช่วงหลัง
// แผนอยู่ที่ design/SYSTEMS_UPDATE.md (Release 4)
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { runEvent, yearHooks } from "../../engine/game";
import { remember } from "../../engine/npc";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addStat, clamp, createPerson, displayName, log, people, shortName } from "../../engine/util";
import { addLegend } from "../../engine/worldState";
import { careerById } from "../core/careers";
import { B, BIG, C, E, G, K, N, P, PAY, SCENE } from "./kit";
import { ESTATES, owns } from "./economy";
import { stageAge } from "./folk";
import { fightOdds } from "./power";
import { addStanding, deed, fl, worldOfLife } from "./state";
import { cityOf } from "./cities";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;

export { stageAge };

// ───────────── การเลี้ยงลูก ─────────────
export const lessons = (p: Person, k: string) => Number(p.tags?.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1) ?? 0);
export interface Upbringing { body: number; magic: number; mind: number; trade: number; school: boolean }
export const upbringing = (p: Person): Upbringing => ({ body: lessons(p, "taught_body"), magic: lessons(p, "taught_magic"), mind: lessons(p, "taught_mind"), trade: lessons(p, "taught_trade"), school: !!p.tags?.includes("ft_school") });
/** แต้มฝึกที่ทายาทได้จากบทเรียนของพ่อแม่ */
export const headStart = (u: Upbringing) => ({ body: Math.min(200, u.body * 15 + (u.school ? 10 : 0)), magic: Math.min(200, u.magic * 15 + (u.school ? 10 : 0)), smarts: Math.min(10, u.mind * 2) });
export const TRADE_LESSONS = 3;

// ───────────── พินัยกรรม ─────────────
const kids = (l: Life) => people(l, "child").filter((c) => c.alive);
/** ทายาทที่ได้ของใหญ่: คนที่ระบุในพินัยกรรม หรือลูกที่โตแล้วและใกล้ชิดที่สุด */
export function legacyHeir(l: Life): Person | undefined {
  const named = kids(l).find((c) => c.id === l.flags.ftWill);
  if (named) return named;
  const ks = kids(l), grown = ks.filter((c) => c.age >= 16);
  return [...(grown.length ? grown : ks)].sort((a, b) => b.bond - a.bond)[0];
}
/** ของใหญ่ที่ส่งต่อได้ */
export function heirlooms(l: Life): string[] {
  const f = fl(l), out: string[] = [];
  for (const id of Object.keys(ESTATES) as (keyof typeof ESTATES)[]) if (owns(l, id) && !ESTATES[id].once) out.push(ESTATES[id].name);
  const home = Number(l.flags.ftHome ?? 0);
  if (home >= 2) out.push("บ้านของตระกูล");
  if (f.weapon) out.push(f.weapon.name);
  if (f.armor) out.push(f.armor.name);
  if (l.flags.ftHall) out.push("สำนักของคุณ");
  if (l.flags.ftMemoirKept) out.push("บันทึกชีวิตที่เขียนไว้");
  return out;
}
const SLOTS = [0, 1, 2, 3, 4, 5];
const WILL: GameEvent = SCENE("ft.fm.will", "เขียนพินัยกรรม", (l) => {
  const h = legacyHeir(l), items = heirlooms(l);
  return `ทนายของตระกูลกางกระดาษเปล่าบนโต๊ะ ${items.length ? `ของที่จะส่งต่อ: ${items.join(" · ")}` : "ตอนนี้คุณยังไม่มีของใหญ่ให้ส่งต่อ นอกจากเงินและชื่อตระกูล"} · ${l.flags.ftWill && h ? `ตอนนี้ระบุไว้ให้${shortName(h)}` : "ยังไม่ได้ระบุทายาท"}`;
}, [
  ...SLOTS.map((i) => C((l) => { const k = kids(l)[i]; return k ? `ยกให้${shortName(k)} (อายุ ${k.age} · ผูกพัน ${k.bond})` : ""; },
    G((l) => { const k = kids(l)[i]; return `คุณลงชื่อใต้ชื่อ${k ? shortName(k) : "ลูก"} ทนายประทับตราแล้วม้วนกระดาษเก็บ`; }, {}, (l) => {
      const k = kids(l)[i]; if (!k) return;
      l.flags.ftWill = k.id; k.bond = clamp(k.bond + 5, 0, 100);
      for (const o of kids(l)) if (o.id !== k.id && o.age >= 14) remember(l, o, "will", `คุณยกมรดกให้${shortName(k)}แทนเขา`, 2, { jealousy: 15, love: -5 });
    }), { show: (l) => !!kids(l)[i], cons: "พี่น้องคนอื่นจะรู้และจำ" })),
  C("ไม่ระบุใคร ให้ตกกับลูกที่ใกล้ชิดที่สุด", N("คุณฉีกร่างเก่าทิ้ง ปล่อยให้ความผูกพันตัดสินเอง", {}, (l) => { delete l.flags.ftWill; })),
]);

/** งานที่สอนลูก: งานปัจจุบัน หรืองานที่เคยไปถึงขั้นสูงสุด (เกษียณแล้วก็ยังสอนได้) */
export function tradeOf(l: Life): string | undefined {
  if (l.job) return l.job.careerId;
  let best: string | undefined, lv = 0;
  for (const [k, v] of Object.entries(l.flags)) if (k.startsWith("ftBest_") && Number(v) > lv) { lv = Number(v); best = k.slice(7); }
  return best;
}

/** ส่งต่อให้ทายาท: บทเรียนในวัยเด็ก ของใหญ่ ศิษย์ · เรียกจาก inheritLife */
export function passOn(dead: Life, next: Life, heirId?: string) {
  if (!dead.ft || !next.ft) return;
  const child = dead.people.find((p) => p.id === heirId);
  const nf = next.ft;
  if (child) {
    const u = upbringing(child), hs = headStart(u);
    nf.body += hs.body; nf.magic += hs.magic;
    if (hs.smarts) addStat(next, "smarts", hs.smarts);
    const said: string[] = [];
    if (u.body) said.push(`ดาบ ${u.body} ครั้ง`);
    if (u.magic) said.push(`เวท ${u.magic} ครั้ง`);
    if (u.mind) said.push(`หนังสือ ${u.mind} ครั้ง`);
    if (u.trade) said.push(`งาน ${u.trade} ครั้ง`);
    const trade = tradeOf(dead);
    if (u.trade >= TRADE_LESSONS && trade) {
      next.flags[`ftBest_${trade}`] = Math.max(Number(next.flags[`ftBest_${trade}`] ?? 0), 3);
      said.push(`ถ้าทำงาน${careerById(trade)?.name ?? ""} จะเริ่มที่ขั้นสอง`);
    }
    if (said.length) log(next, `สิ่งที่${displayName(dead)}สอนไว้ติดตัวคุณมา: ${said.join(" · ")}`, "good");
    if (child.bond >= 70) { addStat(next, "happiness", 6); log(next, "คุณโตมาโดยรู้ว่าพ่อแม่รักคุณ และนั่นทำให้คุณยืนได้มั่นคงกว่าคนอื่น", "good"); }
    else if (child.bond < 30) { addStat(next, "happiness", -6); log(next, "บ้านที่คุณโตมาเย็นชา คุณยังไม่รู้ว่าจะเสียใจหรือโล่งใจที่พ่อแม่จากไป", "bad"); }
  }
  // ของใหญ่ตกกับทายาทคนเดียว
  const heir = legacyHeir(dead), items = heirlooms(dead);
  if (items.length && heir) {
    if (heir.id === heirId) {
      const df = dead.ft;
      if (df.estates) nf.estates = { ...df.estates };
      if (Number(dead.flags.ftHome ?? 0) >= 2) next.flags.ftHome = dead.flags.ftHome;
      if (df.weapon) nf.weapon = { ...df.weapon };
      if (df.armor) nf.armor = { ...df.armor };
      if (dead.flags.ftHall) next.flags.ftHall = 1;
      if (dead.flags.ftMemoirKept) { addStat(next, "smarts", 3); next.flags.ftReadMemoir = true; }
      if (dead.flags.ftSwordPassed && df.weapon) nf.body += 40;
      log(next, `มรดกของตระกูลตกเป็นของคุณ: ${items.join(" · ")}`, "milestone");
    } else {
      const sib = next.people.find((p) => p.id === heir.id);
      if (sib) remember(next, sib, "heirloom", "เขาได้ของใหญ่ของตระกูลไปแทนคุณ", 2, { jealousy: 10 });
      addStat(next, "happiness", dead.flags.ftWill ? -4 : -1);
      log(next, `${shortName(heir)}${dead.flags.ftWill ? "ได้รับตามพินัยกรรม" : "ได้รับไปเพราะใกล้ชิดที่สุด"}: ${items.join(" · ")} · ส่วนคุณได้แต่ส่วนแบ่งเงิน`, "bad");
    }
  }
  // ศิษย์ของพ่อแม่ตามมาเป็นพวกของทายาท
  for (const p of dead.people) if (p.alive && p.tags?.some((t) => t === "apprentice" || t === "el_student")) next.people.push({ ...p, relation: "ally", bond: Math.min(60, p.bond) });
}

// ───────────── งานของชีวิตช่วงหลัง ─────────────
export type CallingId = "mentor" | "memoir" | "journey" | "guardian" | "rest";
export const CALLINGS: Record<CallingId, { name: string; desc: string; goal: string; need: number }> = {
  mentor: { name: "ครูของคนรุ่นใหม่", desc: "รับศิษย์ สอนจนเขาออกไปสร้างชื่อ", goal: "ส่งศิษย์ออกไปสร้างชื่อสองคน", need: 2 },
  memoir: { name: "บันทึกชีวิต", desc: "เขียนเรื่องชีวิตทีละบท แล้วตัดสินใจว่าจะให้ใครอ่าน", goal: "เขียนให้ครบห้าบทแล้วตีพิมพ์หรือเก็บไว้", need: 5 },
  journey: { name: "การเดินทางครั้งสุดท้าย", desc: "ไปที่ที่ฝันไว้ทีละแห่ง ก่อนขาจะไม่ไหว", goal: "ไปให้ครบห้าแห่ง", need: 5 },
  guardian: { name: "ผู้พิทักษ์เมือง", desc: "เฝ้าเมืองด้วยฝีมือที่เหลือ และส่งดาบต่อให้คนรุ่นหลัง", goal: "ปกป้องเมืองห้าครั้ง", need: 5 },
  rest: { name: "ใช้ชีวิตเงียบๆ", desc: "อยู่กับคนที่รัก ไม่ต้องพิสูจน์อะไรอีก", goal: "", need: 0 },
};
export const CALLING_AGE = 60;
export const CALLING_GAP = 40;
export const callingOf = (l: Life) => l.flags.ftCalling as CallingId | undefined;
export const callingProg = (l: Life) => Number(l.flags.ftCallProg ?? 0);
const prog = (l: Life, d = 1) => { l.flags.ftCallProg = callingProg(l) + d; };
/** จบงานหนึ่งแล้ว ปีหน้าเลือกงานใหม่ได้ */
const finishCalling = (l: Life, text: string) => { deed(l, text); l.flags.ftCallingAt = l.age - CALLING_GAP; l.flags.ftCallingDone = Number(l.flags.ftCallingDone ?? 0) + 1; };
const choose = (id: CallingId) => (l: Life) => {
  l.flags.ftCalling = id; l.flags.ftCallingAt = l.age; l.flags.ftCallProg = 0;
  // งานที่เลือกซ้ำเริ่มใหม่: ทริปใหม่ เล่มใหม่
  if (id === "journey") for (const [t] of TRIPS) delete l.flags[`ftTrip_${t}`];
  if (id === "memoir") delete l.flags.ftMemoirLies;
};
export const callingDue = (l: Life) => on(l) && l.age >= CALLING_AGE && l.age - Number(l.flags.ftCallingAt ?? -999) >= CALLING_GAP;

const CALLING: GameEvent = { ...E("ft.el.calling", [40, 900], (l) => (l.flags.ftCalling
  ? `อายุ ${l.age} แล้ว งานที่คุณทำมาหลายปีจบลงอย่างที่ควรจะจบ ใจคุณเริ่มถามว่าบทต่อไปจะเป็นอะไร`
  : `อายุ ${l.age} แล้ว ร่างกายยังไหว แต่ใจเริ่มถามว่าเวลาที่เหลือจะใช้ทำอะไร`), [
  C("สอนคนรุ่นใหม่", BIG("คุณแขวนป้ายเล็กๆ หน้าบ้าน \"รับศิษย์\" แล้วนั่งรอดูว่าใครจะกล้าเคาะประตู", { joy: 3 }, choose("mentor")), { mark: CALLINGS.mentor.desc }),
  C("เขียนเรื่องชีวิตของตัวเอง", BIG("คุณซื้อสมุดเล่มหนาที่สุดในร้าน แล้วนั่งมองหน้าแรกที่ยังว่างอยู่ทั้งคืน", { joy: 3 }, choose("memoir")), { mark: CALLINGS.memoir.desc }),
  C("ออกเดินทางไปที่ที่ยังไม่เคยไป", BIG("คุณกางแผนที่เก่าบนโต๊ะ แล้ววงห้าที่ด้วยหมึกแดง", { joy: 4 }, choose("journey")), { mark: CALLINGS.journey.desc }),
  C("เฝ้าเมืองของคุณ", BIG("คุณลับดาบเล่มเก่าอีกครั้ง ทหารยามที่ประตูเมืองเริ่มทักคุณทุกเช้า", { joy: 2 }, choose("guardian")), { mark: CALLINGS.guardian.desc, show: (l) => Math.max(fl(l).bodyRank, fl(l).magicRank) >= 2 }),
  C("ใช้ชีวิตเงียบๆ กับคนที่รัก", G("คุณปลูกสวนหลังบ้าน และเรียนรู้ที่จะนั่งเฉยๆ โดยไม่รู้สึกผิด", { joy: 6, hp: 3 }, choose("rest"))),
], { title: "บทต่อไปของชีวิต", forced: true, maxTimes: 0 }), manual: true };

// ── ครู ──
const student = (l: Life, ready = 0) => l.people.find((p) => p.alive && p.tags?.includes("el_student") && lessons(p, "el_skill") >= ready);
const sc = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const snm = (l: Life, c: Ctx) => { const p = sc(l, c); return p ? shortName(p) : "ศิษย์"; };
const skill = (p: Person | undefined, d: number) => { if (!p) return; const n = Math.max(0, lessons(p, "el_skill") + d); p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith("el_skill:")), `el_skill:${n}`]; };
const newStudent = (l: Life, bond: number, gifted: boolean) => {
  const p = createPerson(l, "friend", { age: randInt(l, 12, 17), bond });
  p.job = `ศิษย์ของ${l.firstName}`;
  p.tags = [...(p.tags ?? []), "el_student", `el_skill:${gifted ? 2 : 0}`];
  return p;
};
const MENTOR: GameEvent[] = [
  SCENE("ft.el.m.arrive", "เด็กหน้าประตู", () => "เด็กคนหนึ่งมายืนหน้าประตูบ้านคุณสามวันติด ไม่ขออาหาร ไม่ขอเงิน ขอแค่ให้คุณสอน", [
    C("รับเป็นศิษย์", G((l) => { const p = newStudent(l, 55, false); return `${shortName(p)}ก้มกราบจนหน้าผากแตะพื้น แล้วถามว่าเริ่มพรุ่งนี้ได้ไหม`; }, { joy: 4 })),
    K("ทดสอบก่อนว่ามีแววไหม", "smarts", 45, G((l) => { const p = newStudent(l, 65, true); return `คุณเห็นแววในตา${shortName(p)}ตั้งแต่คำถามแรก เด็กคนนี้เกิดมาเพื่อเรื่องนี้`; }, { joy: 5 }), N("เด็กตอบคำถามไม่ได้สักข้อ แล้วเดินจากไปเงียบๆ คุณมองตามจนลับตา", { joy: -1 })),
    C("ปฏิเสธ ยังไม่พร้อมสอนใคร", N("เด็กยืนอยู่อีกคืน แล้วหายไปตอนเช้า")),
  ]),
  SCENE("ft.el.m.lesson", "บทเรียนของศิษย์", (l, c) => `${snm(l, c)}ยืนรอที่ลานหลังบ้านตั้งแต่ฟ้ายังไม่สาง วันนี้คุณจะสอนอะไร`, [
    C("สอนหนักแบบที่ครูของคุณเคยสอน", N((l, c) => (chance(l, 0.15) ? `${snm(l, c)}ร้องไห้กลางลาน แต่ยังไม่ยอมวางดาบ` : `${snm(l, c)}ล้มแล้วลุกจนคุณเป็นฝ่ายเหนื่อยก่อน`), {}, (l, c) => { const p = sc(l, c); skill(p, 2); if (p) p.bond = clamp(p.bond - 4, 0, 100); })),
    C("สอนสิ่งที่ตำราไม่มี", G((l, c) => `คุณเล่าเรื่องความผิดพลาดที่เกือบทำให้ตาย ${snm(l, c)}จดทุกคำ`, { joy: 3 }, (l, c) => { const p = sc(l, c); skill(p, 1); if (p) p.bond = clamp(p.bond + 8, 0, 100); })),
    P("ให้ลงสนามจริงกับงานของสมาคม", (l, c) => 0.5 + lessons(sc(l, c)!, "el_skill") * 0.05, G((l, c) => `${snm(l, c)}กลับมาพร้อมรางวัลชิ้นแรกในชีวิต และยื่นให้คุณก่อนใคร`, { fame: 2, joy: 4 }, (l, c) => skill(sc(l, c), 2)),
      B((l, c) => `${snm(l, c)}กลับมาพร้อมแผลที่แขน และไม่พูดกับคุณสองวัน`, { joy: -4 }, (l, c) => { const p = sc(l, c); if (p) p.bond = clamp(p.bond - 6, 0, 100); })),
  ]),
  SCENE("ft.el.m.surpass", "ศิษย์ชนะครู", (l, c) => `ในการซ้อมเช้านี้ ${snm(l, c)}ปัดอาวุธของคุณหลุดมือเป็นครั้งแรก แล้วยืนนิ่ง ไม่รู้ว่าควรดีใจหรือขอโทษ`, [
    C("หัวเราะแล้วยอมรับว่าเขาเก่งกว่า", G((l, c) => `${snm(l, c)}ยิ้มกว้างที่สุดตั้งแต่มาอยู่ด้วยกัน ข่าวว่าศิษย์ของคุณชนะครูไปทั่วเมือง`, { joy: 6, fame: 1 }, (l, c) => { const p = sc(l, c); if (p) remember(l, p, "surpass", "ครูยอมรับว่าเขาเก่งกว่า", 3, { respect: 20, love: 10 }); })),
    P("ขอดวลจริงอีกรอบ", (l, c) => fightOdds(l, 18 + lessons(sc(l, c)!, "el_skill") * 4), G((l, c) => `คุณชนะรอบที่สองด้วยท่าที่ไม่เคยสอนใคร ${snm(l, c)}ขอให้สอนท่านั้น`, { body: 6, fame: 1 }), N((l, c) => `${snm(l, c)}ชนะอีกครั้ง และครั้งนี้คุณรู้ว่าไม่ใช่ความบังเอิญ`, { joy: -3, hp: -3 })),
  ]),
  SCENE("ft.el.m.graduate", "วันที่ศิษย์พร้อม", (l, c) => `${snm(l, c)}ไม่ต้องให้คุณบอกแล้วว่าต้องทำอะไร ทั้งเมืองเริ่มเรียกชื่อเขาแทนชื่อคุณ`, [
    C("ส่งออกไปสร้างชื่อของตัวเอง", BIG((l, c) => `${snm(l, c)}ออกเดินทางพร้อมดาบที่คุณมอบให้ จดหมายฉบับแรกมาถึงในสามเดือน เล่าว่าเขาช่วยหมู่บ้านทั้งหมู่บ้านไว้`, { fame: 4, joy: 6 }, (l, c) => {
      const p = sc(l, c); if (p) { p.tags = [...(p.tags ?? []).filter((t) => t !== "el_student"), "el_grad"]; p.job = "ยอดฝีมือที่คุณสอนมา"; }
      prog(l); if (callingProg(l) >= CALLINGS.mentor.need) finishCalling(l, `สอนศิษย์จนออกไปสร้างชื่อ ${callingProg(l)} คน`);
    })),
    C("ขอให้อยู่เป็นผู้ช่วยสอนต่อ", G((l, c) => `${snm(l, c)}อยู่ต่อ และเริ่มสอนเด็กรุ่นถัดไปด้วยคำพูดเดียวกับคุณ`, { joy: 4 }, (l, c) => {
      const p = sc(l, c); if (p) { p.tags = [...(p.tags ?? []).filter((t) => t !== "el_student"), "apprentice"]; p.relation = "ally"; p.bond = clamp(p.bond + 10, 0, 100); }
      prog(l); if (callingProg(l) >= CALLINGS.mentor.need) finishCalling(l, `สอนศิษย์จนพร้อมสืบทอด ${callingProg(l)} คน`);
    }), { mark: "ศิษย์จะอยู่กับครอบครัวคุณต่อหลังคุณจากไป" }),
  ]),
];

// ── บันทึกชีวิต ──
const topic = (l: Life) => { const d = fl(l).deeds; const i = callingProg(l); return i === 0 ? "วัยเด็ก" : d.length ? d[(i * 3) % d.length] : pick(l, ["ความรักครั้งแรก", "ปีที่ลำบากที่สุด", "คนที่คุณเสียไป", "งานแรกในชีวิต"]); };
const MEMOIR: GameEvent[] = [
  SCENE("ft.el.w.chapter", "บันทึกชีวิต", (l) => `บทที่ ${callingProg(l) + 1} ของเรื่องชีวิตคุณ: เรื่อง "${topic(l)}" ปากกาค้างอยู่เหนือกระดาษนานกว่าทุกบท`, [
    C("เขียนตามจริงทุกอย่าง", G("คุณเขียนจนเทียนหมดสองเล่ม บางหน้ามีรอยน้ำตาแห้งติดอยู่", { iq: 1, joy: 2, fame: 1 }, (l) => prog(l))),
    C("เติมแต่งให้ยิ่งใหญ่กว่าที่เกิดขึ้น", G("บทนี้อ่านสนุกที่สุดในเล่ม แต่คุณรู้ว่าใครบางคนจะจำได้ว่าไม่ใช่แบบนั้น", { fame: 2 }, (l) => { prog(l); l.flags.ftMemoirLies = Number(l.flags.ftMemoirLies ?? 0) + 1; }), { cons: "คนที่อยู่ในเรื่องอาจจำได้" }),
    C("ข้ามส่วนที่เจ็บที่สุดไป", N("คุณเขียนแค่ครึ่งเรื่อง แต่คืนนั้นหลับสบาย", { joy: 3 }, (l) => prog(l))),
  ]),
  SCENE("ft.el.w.visitor", "คนในเรื่อง", "คนคนหนึ่งที่อยู่ในบันทึกของคุณได้ยินว่าคุณกำลังเขียน และมาเคาะประตูพร้อมความทรงจำอีกแบบ", [
    C("นั่งฟังแล้วแก้ตามที่เขาเล่า", G("เรื่องของคุณสั้นลง แต่จริงขึ้น และเขาจับมือคุณก่อนกลับ", { joy: 3 }, (l) => { l.flags.ftMemoirLies = Math.max(0, Number(l.flags.ftMemoirLies ?? 0) - 1); })),
    C("ยืนยันตามที่เขียนไว้", B("เขาเดินออกไปพร้อมบอกทุกคนในเมืองว่าคุณโกหก", { joy: -2 }, (l) => addStanding(l, -1))),
  ]),
  SCENE("ft.el.w.publish", "บันทึกเล่มจบ", (l) => `บันทึกชีวิตของคุณครบ ${callingProg(l)} บทแล้ว หนาจนต้องใช้สองมือถือ โรงพิมพ์หลวงส่งคนมาขอดูต้นฉบับ`, [
    C("ตีพิมพ์ให้ทั้งแผ่นดินอ่าน", BIG((l) => {
      const lies = Number(l.flags.ftMemoirLies ?? 0), caught = lies > 0 && chance(l, Math.min(0.8, lies * 0.25));
      if (caught) { l.fame = Math.max(0, l.fame - 4); return "หนังสือขายดี แต่คนในเรื่องลุกขึ้นมาแย้งทีละคน ทั้งเมืองถกเถียงว่าตอนไหนจริงตอนไหนแต่ง"; }
      addLegend(worldOfLife(l), { name: displayName(l), deed: "เขียนบันทึกชีวิตที่ทุกคนในแผ่นดินเคยอ่าน", lifeId: l.id });
      return "หนังสือของคุณถูกคัดลอกไปทุกหอสมุด เด็กๆ ในเมืองเริ่มเล่นเป็นตัวคุณในวัยหนุ่ม";
    }, { fame: 6, gold: 20 }, (l) => finishCalling(l, "เขียนบันทึกชีวิตจนจบเล่ม"))),
    C("เก็บไว้ให้ลูกหลานอ่าน", BIG("คุณห่อสมุดด้วยผ้าไหมแล้ววางไว้ในหีบของตระกูล ทายาทของคุณจะได้อ่านมันในวันที่คุณไม่อยู่", { joy: 6 }, (l) => { l.flags.ftMemoirKept = true; finishCalling(l, "เขียนบันทึกชีวิตเก็บไว้ให้ลูกหลาน"); }), { mark: "ทายาทที่รับมรดกจะได้อ่าน" }),
    C("เผามันทิ้ง", G("เปลวไฟกินกระดาษทีละหน้า คุณรู้สึกเบาเหมือนวางของหนักที่แบกมาทั้งชีวิต", { joy: 8 }, (l) => finishCalling(l, "เขียนเรื่องชีวิตจนจบแล้วเผามันทิ้ง"))),
  ]),
];

// ── การเดินทาง ──
type Trip = [id: string, title: string, text: string, ok: string];
const TRIPS: Trip[] = [
  ["sea", "ทะเลที่ไม่เคยเห็น", "ทะเลอยู่ห่างไปสิบวัน คุณได้ยินเรื่องของมันมาทั้งชีวิตแต่ไม่เคยเห็นด้วยตา", "คลื่นซัดถึงข้อเท้า คุณหัวเราะเสียงดังเหมือนเด็กจนชาวประมงหันมามอง"],
  ["home", "บ้านเกิด", "บ้านที่คุณเกิดยังอยู่ไหม คุณไม่รู้ และคิดถึงมันทุกครั้งที่หลับตา", "บ้านหลังนั้นมีครอบครัวอื่นอยู่ เด็กคนหนึ่งในบ้านพาคุณไปดูต้นไม้ที่คุณปลูกไว้ ตอนนี้มันสูงกว่าหลังคา"],
  ["peaks", "ยอดเขามังกร", "ว่ากันว่าบนยอดเขามังกรมองเห็นทุกแผ่นดินพร้อมกัน ทางขึ้นชันและหนาว", "บนยอดเขา คุณเห็นทุกที่ที่เคยไปในชีวิตพร้อมกัน และรู้สึกว่าโลกเล็กลงแต่ชีวิตใหญ่ขึ้น"],
  ["far", "เมืองหลวงของแผ่นดินอื่น", "มีเมืองหลวงอีกแห่งที่คุณเคยได้ยินแต่ชื่อ ภาษาไม่เหมือน อาหารไม่เหมือน", "คุณหลงทางในตลาดทั้งวัน กินของที่ไม่รู้ชื่อ และได้เพื่อนใหม่ที่พูดกันไม่รู้เรื่อง"],
  ["grave", "หลุมศพของคนที่จากไป", "มีคนที่จากไปแล้วที่คุณไม่เคยไปลา หลุมศพอยู่อีกฟากของแผ่นดิน", "คุณนั่งคุยกับป้ายหินจนตะวันตก เล่าทุกอย่างที่เขาพลาดไป แล้วเดินกลับเบาขึ้นครึ่งตัว"],
];
const tripDone = (l: Life, id: string) => !!l.flags[`ftTrip_${id}`];
const doneTrip = (id: string) => (l: Life) => { l.flags[`ftTrip_${id}`] = true; prog(l); if (callingProg(l) >= CALLINGS.journey.need) finishCalling(l, "เดินทางไปครบทุกที่ที่ฝันไว้ในบั้นปลาย"); };
const tripCost = (l: Life) => -Math.min(10, 2 + Math.max(0, stageAge(l) - 60) / 4);
const JOURNEY: GameEvent[] = TRIPS.map(([id, title, text, ok]) => SCENE(`ft.el.j.${id}`, title, text, [
  C("ออกเดินทางคนเดียว", BIG(ok, { joy: 9, fame: 1 }, (l) => { addStat(l, "health", Math.round(tripCost(l))); doneTrip(id)(l); }), { cons: "ทางไกลกินแรงคนแก่" }),
  PAY("พาครอบครัวไปด้วย", 12, BIG(`${ok} ครั้งนี้มีเสียงหัวเราะของคนในบ้านอยู่ข้างๆ`, { joy: 12 }, (l) => { addStat(l, "health", Math.round(tripCost(l) / 2)); for (const p of l.people) if (p.alive && ["spouse", "child"].includes(p.relation)) p.bond = clamp(p.bond + 6, 0, 100); doneTrip(id)(l); })),
  C("ยังไม่ใช่ปีนี้", N("คุณพับแผนที่เก็บ แล้วบอกตัวเองว่าปีหน้า")),
]));

// ── ผู้พิทักษ์ ──
const THREATS = ["ฝูงหมาป่ายักษ์ลงมาจากเขา", "โจรกลุ่มใหญ่ตั้งค่ายนอกกำแพง", "อสูรตัวหนึ่งกินแกะไปครึ่งฝูง", "ทหารหนีทัพปล้นหมู่บ้านรอบเมือง"];
const guard = (l: Life, text: string) => { prog(l); if (callingProg(l) >= CALLINGS.guardian.need) finishCalling(l, `เฝ้าเมือง${cityOf(l).name}จนคนทั้งเมืองเรียกว่าผู้พิทักษ์`); return text; };
const GUARDIAN: GameEvent[] = [
  SCENE("ft.el.g.threat", "เมืองต้องการคุณ", (l) => `${pick(l, THREATS)} คนในเมือง${cityOf(l).name}มาเคาะประตูบ้านคุณก่อนจะไปหาทหาร`, [
    P("ออกไปจัดการเอง", (l) => fightOdds(l, 24 + Math.max(0, stageAge(l) - 60) / 2), G((l) => guard(l, "คุณกลับเข้าเมืองตอนเช้า เหนื่อยจนยืนแทบไม่ไหว แต่ทั้งถนนยืนปรบมือ"), { fame: 3, joy: 4 }, (l) => addStanding(l, 2)),
      B("ขาคุณไม่เร็วเหมือนเดิม คุณถูกหามกลับมา แต่ภัยก็ถอยไปเพราะเห็นว่ามีคนกล้าสู้", { hp: -8, joy: -3 }, (l) => { guard(l, ""); })),
    C("ฝึกคนหนุ่มในเมืองให้สู้เอง", G((l) => guard(l, "คนหนุ่มยี่สิบคนจับอาวุธตามที่คุณสอน และไล่ภัยออกไปได้โดยที่คุณยืนดูอยู่บนกำแพง"), { fame: 1, body: 3 }, (l) => addStanding(l, 1))),
    C("ส่งข่าวให้กองทัพจัดการ", N("กองทัพมาช้าไปสามวัน แต่ก็มา")),
  ]),
  SCENE("ft.el.g.youth", "คนหนุ่มปากกล้า", "นักดาบหนุ่มคนหนึ่งตะโกนกลางตลาดว่าผู้พิทักษ์เมืองเป็นแค่คนแก่ที่ใช้ชื่อเก่ากิน", [
    P("ให้บทเรียนเขาต่อหน้าทุกคน", (l) => fightOdds(l, 20), G("คุณปัดดาบเขาหลุดมือด้วยไม้เท้า เขาขอเป็นศิษย์ในวันรุ่งขึ้น", { fame: 2 }), B("เขาชนะ และคุณกลับบ้านช้ากว่าปกติ", { joy: -3, hp: -2 })),
    C("ยิ้มแล้วเดินผ่านไป", N("คนหนุ่มตะโกนตามหลัง แต่ไม่มีใครในตลาดหัวเราะด้วย")),
  ]),
  SCENE("ft.el.g.pass", "ส่งดาบต่อ", (l) => `${fl(l).weapon?.name ?? "อาวุธของคุณ"}อยู่กับคุณมาทั้งชีวิต มือที่จับมันเริ่มสั่น คุณคิดว่าถึงเวลาสอนทายาทให้ใช้มันแล้ว`, [
    C("สอนทายาททุกท่าที่ใช้กับอาวุธนี้", BIG((l) => { const h = legacyHeir(l); return `${h ? shortName(h) : "ทายาทของคุณ"}ฝึกกับคุณทุกเช้าจนจับอาวุธเหมือนมันเป็นแขนของตัวเอง`; }, { joy: 6, fame: 1 }, (l) => { l.flags.ftSwordPassed = true; deed(l, `ส่ง${fl(l).weapon?.name ?? "อาวุธประจำตัว"}ต่อให้คนรุ่นถัดไป`); }), { mark: "ทายาทที่รับมรดกเริ่มต้นด้วยแต้มฝึกกายเพิ่ม" }),
    C("ยังไม่ถึงเวลา", N("คุณเช็ดดาบแล้วแขวนกลับที่เดิม")),
  ]),
];

// ── ชีวิตเงียบๆ ──
const youngKin = (l: Life) => l.people.find((p) => p.alive && p.relation === "child") ?? l.people.find((p) => p.alive && ["sibling", "friend"].includes(p.relation));
const REST: GameEvent[] = [
  SCENE("ft.el.r.garden", "สวนหลังบ้าน", "สวนที่คุณปลูกไว้ออกผลมากเกินกว่าบ้านเดียวจะกินหมด เพื่อนบ้านมองข้ามรั้วมาทุกเช้า", [
    C("แจกให้ทั้งถนน", G("ทุกบ้านบนถนนมีผลไม้จากสวนคุณ เด็กๆ เริ่มเรียกคุณว่าเจ้าของสวนผลไม้", { joy: 5 }, (l) => addStanding(l, 1))),
    PAY("ขยายสวนให้ใหญ่กว่าเดิม", 6, G("ปีถัดมาสวนของคุณใหญ่จนต้องจ้างเด็กมาช่วยเก็บ และขายได้กำไรเล็กน้อย", { joy: 3, gold: 10, hp: 2 })),
    C("เก็บไว้ทำแยมกินเองทั้งปี", N("บ้านคุณหอมกลิ่นผลไม้กวนไปทั้งฤดูหนาว", { joy: 3, hp: 1 })),
  ]),
  SCENE("ft.el.r.visit", "แขกในวันหยุด", (l) => { const p = youngKin(l); return `${p ? shortName(p) : "ญาติห่างๆ"}พาเด็กเล็กสามคนมาเยี่ยม เด็กๆ วิ่งรอบบ้านเหมือนเป็นบ้านตัวเอง`; }, [
    C("เล่าเรื่องสมัยหนุ่มสาวให้เด็กฟัง", G("เด็กๆ นั่งล้อมคุณจนลืมกินข้าว และขอให้มาเล่าต่อทุกปี", { joy: 6 }, (l) => { const p = youngKin(l); if (p) p.bond = clamp(p.bond + 6, 0, 100); })),
    PAY("ซื้อของขวัญให้ทุกคน", 5, G("เด็กๆ กอดขาคุณไม่ยอมปล่อย", { joy: 6 }, (l) => { const p = youngKin(l); if (p) p.bond = clamp(p.bond + 8, 0, 100); })),
    C("บอกว่าเหนื่อย ขอพักก่อน", N("บ้านเงียบลงเร็วกว่าที่คิด", { hp: 2, joy: -1 })),
  ]),
  SCENE("ft.el.r.friend", "เพื่อนเก่า", "จดหมายจากเพื่อนเก่าที่ไม่ได้เจอกันมาหลายสิบปี ลายมือสั่นกว่าเดิม \"ยังจำร้านเหล้าข้างท่าเรือได้ไหม\"", [
    C("เดินทางไปหา", G("คุณสองคนนั่งที่ร้านเดิม โต๊ะเดิม หัวเราะเรื่องเดิมจนร้านปิด", { joy: 8, hp: -2 })),
    C("เขียนตอบยาวสิบหน้า", G("จดหมายตอบกลับมาทุกฤดู จนกลายเป็นนิสัยของคุณทั้งคู่", { joy: 4, iq: 1 })),
    C("เก็บจดหมายไว้ก่อน", N("จดหมายวางอยู่บนโต๊ะทั้งปี ทุกครั้งที่เห็นคุณยิ้ม", { joy: 1 })),
  ]),
];

/** ฉากของงานที่เลือกในปีนี้ · คืน [id, ctx] หรือไม่มี */
function beatFor(l: Life): [string, Ctx?] | undefined {
  const cd = (id: string, gap: number) => l.age - Number(l.flags[`ftElCd_${id}`] ?? -99) >= gap;
  const opts: [string, Ctx?][] = [];
  switch (callingOf(l)) {
    case "mentor": {
      const ready = student(l, 6), s = student(l);
      if (ready) opts.push(["ft.el.m.graduate", { pid: ready.id }]);
      else if (s) {
        opts.push(["ft.el.m.lesson", { pid: s.id }]);
        if (lessons(s, "el_skill") >= 4 && cd("ft.el.m.surpass", 6)) opts.push(["ft.el.m.surpass", { pid: s.id }]);
      }
      if (!s && cd("ft.el.m.arrive", 1)) opts.push(["ft.el.m.arrive"]);
      break;
    }
    case "memoir":
      if (callingProg(l) >= CALLINGS.memoir.need) opts.push(["ft.el.w.publish"]);
      else { opts.push(["ft.el.w.chapter"]); if (callingProg(l) >= 2 && cd("ft.el.w.visitor", 10)) opts.push(["ft.el.w.visitor"]); }
      break;
    case "journey":
      for (const [id] of TRIPS) if (!tripDone(l, id)) opts.push([`ft.el.j.${id}`]);
      break;
    case "rest":
      for (const id of ["ft.el.r.garden", "ft.el.r.visit", "ft.el.r.friend"]) if (cd(id, 15)) opts.push([id]);
      break;
    case "guardian":
      opts.push(["ft.el.g.threat"]);
      if (cd("ft.el.g.youth", 8)) opts.push(["ft.el.g.youth"]);
      if (fl(l).weapon && !l.flags.ftSwordPassed && legacyHeir(l)) opts.push(["ft.el.g.pass"]);
      break;
  }
  return opts.length ? pick(l, opts) : undefined;
}
export const CALLING_CHANCE = 0.6;
function familyYear(l: Life) {
  if (!on(l) || !l.alive) return;
  if (callingDue(l) && l.flags.ftCallingAsked !== l.age) { l.flags.ftCallingAsked = l.age; runEvent(l, "ft.el.calling"); return; }
  if (!chance(l, CALLING_CHANCE)) return;
  const b = beatFor(l);
  if (!b) return;
  l.flags[`ftElCd_${b[0]}`] = l.age;
  runEvent(l, b[0], b[1]);
}

const ACTS: Activity[] = [
  { id: "ft_will", emoji: "", name: "เขียนพินัยกรรม", desc: "เลือกว่าลูกคนไหนจะได้ของใหญ่ของตระกูล", minAge: 40, time: 0, world: "fantasy", group: "ชีวิต",
    available: (l) => !!l.ft && kids(l).length > 0, run: (l) => { runEvent(l, "ft.fm.will"); return { text: "" }; } },
];

export const FAMILY_EVENTS: GameEvent[] = [WILL, CALLING, ...MENTOR, ...MEMOIR, ...JOURNEY, ...GUARDIAN, ...REST];

export function loadFamily() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(familyYear);
}

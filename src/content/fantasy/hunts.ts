// ตามล่าอาวุธตำนาน (Release 20 · design/HUNTS_PLAN.md)
// เลือกอาวุธจากกระดานตำนานในแท็บโลก · สี่บท บทละ 1-3 ปี · บทสุดท้ายถึงตายได้ · คู่แข่งตามล่าเล่มเดียวกัน
// ถ้ามีคนถือไว้แล้ว บทสุดท้ายคือเผชิญหน้าเจ้าของ: ดวล ขโมย ซื้อ ได้เป็นของขวัญ หรือรอให้เขาตาย
import { activityFilters } from "../../engine/activities";
import { registerEvents, type Choice, type Ctx, type GameEvent } from "../../engine/events";
import { kill, runEvent, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { displayName, log } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { HUNTS, type Chapter } from "./hunts_data";
import { apply, B, C, G, K, N, P, PAY, SCENE, type Fx } from "./kit";
import { takeRelic } from "./legends";
import { NEW_RELICS, worthy } from "./legends2";
import { fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, myRelic, passRelic, relicOf, worldOfLife, type Relic } from "./state";

export const HUNT_AGE = 16;
/** ความยากของแต่ละบท: ศัตรู · ค่าที่ต้องผ่าน */
export const THREAT = [32, 44, 54, 66];
export const DC = [46, 52, 58, 66];
const HURT = [3, 5, 8, 24];
export const HOLDER_THREAT = 62;
export const BUY_GOLD = 80;
/** พลาดได้กี่ครั้งก่อนร่องรอยจะหายไป */
export const MAX_FAILS = 3;

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
export const isPerson = (holder: string) => holder !== "lost" && holder !== "stone" && holder !== "player";
export const huntOf = (l: Life) => fl(l).hunt;
const relic = (l: Life) => relicOf(l, huntOf(l)!.id)!;
const rivalName = (l: Life) => huntOf(l)?.rival ?? "นักล่าสมบัติอีกกลุ่ม";
const fill = (l: Life, s: string) => s.replaceAll("{r}", rivalName(l));

/** อาวุธทั้งหมดที่มีตำนานให้ตามล่า (โลกใหม่ยังไม่มีอาวุธชุดที่สองจนถึงปีแรก จึงเติมให้ครบตรงนี้) */
export function huntRelics(l: Life): Relic[] {
  const d = dataOf(l);
  for (const r of NEW_RELICS) if (!d.relics.some((x) => x.id === r.id)) d.relics.push({ ...r });
  return d.relics.filter((r) => HUNTS[r.id]);
}
/** อาวุธที่ยังตามล่าได้ในชีวิตนี้ */
export const huntable = (l: Life) => huntRelics(l).filter((r) => r.holder !== "player" && !(fl(l).huntsClosed ?? []).includes(r.id));
export function canStart(l: Life, id: string): string | undefined {
  if (!on(l)) return "ยังไม่ได้อยู่ในโลกนี้";
  if (l.age < HUNT_AGE) return `ตามล่าได้ตั้งแต่อายุ ${HUNT_AGE}`;
  if (huntOf(l)) return "กำลังตามล่าเล่มอื่นอยู่";
  if (fl(l).relic) return "ถืออาวุธตำนานอยู่แล้ว วางคืนแท่นก่อน";
  if ((fl(l).huntsClosed ?? []).includes(id)) return "เลิกตามล่าเล่มนี้ไปแล้วในชีวิตนี้";
  const r = huntRelics(l).find((x) => x.id === id);
  if (!r) return "ไม่มีตำนานของเล่มนี้";
  if (r.holder === "player") return "อยู่ในมือคุณแล้ว";
  return undefined;
}

/** คู่แข่ง: คนเด่นที่แข็งแรงที่สุดคนหนึ่งที่ยังไม่มีอาวุธตำนาน */
function pickRival(l: Life): string | undefined {
  const d = dataOf(l);
  const free = d.notables.filter((n) => !d.relics.some((r) => r.holder === n.name)).sort((a, b) => b.power - a.power).slice(0, 4);
  return free.length ? pick(l, free).name : undefined;
}
/** เริ่มตามล่าพร้อมคู่แข่งหนึ่งคน */
export function startHunt(l: Life, id: string) {
  const why = canStart(l, id);
  if (why) return { text: why };
  const rival = pickRival(l);
  fl(l).hunt = { id, ch: 0, next: l.age + 1, ...(rival ? { rival } : {}) };
  const r = relicOf(l, id)!;
  log(l, `คุณเริ่มตามล่า${r.name} ข่าวว่า${rival ?? "นักล่าสมบัติอีกกลุ่ม"}ก็กำลังตามหาเล่มเดียวกัน`, "milestone");
  return { text: `คุณเริ่มตามล่า${r.name} บทแรกจะมาถึงในปีหน้า` };
}
export function giveUp(l: Life) {
  const h = huntOf(l);
  if (!h) return { text: "" };
  const r = relicOf(l, h.id)!;
  fl(l).huntsClosed = [...(fl(l).huntsClosed ?? []), h.id];
  fl(l).hunt = undefined;
  log(l, `คุณเลิกตามล่า${r.name} ตำนานเล่มนี้ปิดลงสำหรับชีวิตนี้`, "normal");
  return { text: `คุณเลิกตามล่า${r.name}` };
}

/** คนที่เคยถือ: จากตำนานของโลก (ปี 1-999) ต่อด้วยคนที่ถือจริงในโลกนี้ */
export function pastHolders(r: Relic): string[] {
  const old = (HUNTS[r.id]?.holders ?? []).map(([y, n, f]) => `ปี ${y} ${n} (${f})`);
  return [...old, ...(r.history ?? [])];
}

function finish(l: Life, r: Relic, text: string): { text: string; kind: "milestone" } {
  const was = r.holder;
  takeRelic(l, r);
  fl(l).hunt = undefined;
  deed(l, `ตามล่า${r.name}จนได้มาครอง`);
  if (isPerson(was)) recordChronicle(worldOfLife(l), `${displayName(l)}ชิง${r.name}มาจาก${was}`);
  return { text, kind: "milestone" };
}
function delay(l: Life, years: number) { const h = huntOf(l); if (h) h.next = l.age + years; }

/** ผลเมื่อผ่านบทหนึ่ง */
function pass(l: Life, okText: string) {
  const h = huntOf(l)!, r = relic(l);
  if (h.ch >= 3) {
    if (r.id === "excalibur" && !worthy(l)) { delay(l, 2); return { text: "คุณรู้ทุกเงื่อนไขของดาบแล้ว แต่มันไม่ขยับ ต้องเป็นผู้ครอง ขุนนางชั้นสูง สายเลือดสูงศักดิ์ หรือคนที่ทั้งแผ่นดินยอมรับก่อน (ชื่อเสียงในแผ่นดิน 40)", kind: "bad" as const }; }
    return finish(l, r, fill(l, okText));
  }
  h.ch++;
  h.fails = 0;
  h.next = l.age + randInt(l, 1, 3);
  return { text: fill(l, okText), kind: "good" as const };
}
/** ผลเมื่อพลาด: บทที่สามพลาด = คู่แข่งได้อาวุธไปก่อน · บทสุดท้ายถึงตายได้ */
function fail(l: Life, kind: "fight" | "wit" | "heart") {
  const h = huntOf(l)!, r = relic(l);
  const fx: Fx = kind === "fight" ? { hp: -HURT[h.ch] } : { joy: -2 };
  apply(l, fx);
  if (h.ch === 3 && kind === "fight" && l.stats.health <= 0) { kill(l, `ตายในบททดสอบสุดท้ายของ${r.name}`); return { text: "บททดสอบสุดท้ายแรงเกินกว่าที่คุณจะรับไหว", kind: "bad" as const }; }
  if (h.ch === 2 && h.rival && r.holder === "lost" && dataOf(l).notables.some((n) => n.name === h.rival)) {
    r.holder = h.rival; passRelic(worldOfLife(l), r, h.rival);
    h.ch = 3; h.next = l.age + randInt(l, 1, 2);
    return { text: `ระหว่างที่คุณพลาด ${h.rival}ไปถึงก่อน และคว้า${r.name}ไปได้ บทสุดท้ายของคุณคือการชิงมันคืนจากมือเขา`, kind: "bad" as const };
  }
  const why = { fight: "คุณพ่ายและต้องถอยกลับมารักษาแผล", wit: "ร่องรอยพาคุณหลงทางไปอีกปีหนึ่ง", heart: "สิ่งที่คุณหวังไม่เกิดขึ้น และต้องรอโอกาสใหม่" }[kind];
  // พลาดครบสามครั้ง ร่องรอยก็เย็นชืด การตามล่าจบลง (ไม่ปล่อยให้เสี่ยงไปทั้งชีวิต)
  h.fails = (h.fails ?? 0) + 1;
  if (h.fails >= MAX_FAILS) {
    fl(l).hunt = undefined; fl(l).huntsClosed = [...(fl(l).huntsClosed ?? []), r.id];
    return { text: `${why} ร่องรอยของ${r.name}เย็นชืดลงแล้ว การตามล่าครั้งนี้จบลง เล่มนี้คงต้องรอคนรุ่นหลัง`, kind: "bad" as const };
  }
  delay(l, randInt(l, 1, 2));
  return { text: `${why} (พลาดได้อีก ${MAX_FAILS - h.fails} ครั้งก่อนร่องรอยจะหายไป)`, kind: "bad" as const };
}

const chap = (l: Life): Chapter => HUNTS[huntOf(l)!.id].ch[huntOf(l)!.ch];
const chapterChoices: Choice[] = [
  P((l) => fill(l, chap(l)[2]), (l) => fightOdds(l, THREAT[huntOf(l)?.ch ?? 0]), (l) => pass(l, chap(l)[3]), (l) => fail(l, "fight")),
  K((l) => fill(l, chap(l)[4]), "smarts", 0, (l) => pass(l, chap(l)[5]), (l) => fail(l, "wit"), { check: { stat: "smarts", dc: 0, bonus: (l) => -DC[huntOf(l)?.ch ?? 0] / 60 } }),
  K((l) => fill(l, chap(l)[6]), "luck", 0, (l) => pass(l, chap(l)[7]), (l) => fail(l, "heart"), { check: { stat: "luck", dc: 0, bonus: (l) => -(DC[huntOf(l)?.ch ?? 0] - 2) / 60 } }),
  C("ขอเวลาเตรียมตัวอีกหนึ่งปี", (l) => { delay(l, 1); return { text: "คุณกลับไปฝึกและเตรียมของ ร่องรอยยังรออยู่ที่เดิม" }; }),
];

/** บทสุดท้ายเมื่อมีคนถืออยู่ */
const holderChoices: Choice[] = [
  P((l) => `ท้าดวล${relic(l).holder}ต่อหน้าพยาน`, (l) => fightOdds(l, HOLDER_THREAT), (l) => finish(l, relic(l), `${relic(l).holder}ล้มลงกลางวง และยอมส่ง${relic(l).name}ให้ตามธรรมเนียมของผู้แพ้`), (l) => { const r = relic(l); apply(l, { hp: -18 }); if (l.stats.health <= 0) { kill(l, `ตายในการดวลชิง${r.name}กับ${r.holder}`); return { text: `${r.holder}ไม่ได้ออมมือ`, kind: "bad" }; } delay(l, 2); return { text: `${r.holder}ฟันคุณล้มลง แล้วบอกให้กลับมาใหม่เมื่อเก่งพอ`, kind: "bad" }; }),
  K("ย่องเข้าไปขโมยตอนกลางคืน", "luck", 60, (l) => { const r = relic(l), from = r.holder; const out = finish(l, r, `คุณออกมาพร้อม${r.name}ก่อนไก่ขัน ${from}จะรู้ตัวตอนเช้า และจะไม่ลืม`); fl(l).huntStolen = { id: r.id, from, at: l.age }; return out; }, (l) => { apply(l, { hp: -4 }); addStanding(l, -5); delay(l, 2); return { text: "ยามจับได้ คุณหนีออกมาได้พร้อมชื่อเสียงที่เสียไป", kind: "bad" }; }),
  { ...PAY("เสนอซื้อด้วยทองก้อนใหญ่", BUY_GOLD, (l) => finish(l, relic(l), `${relic(l).holder}นับทองสามรอบ แล้วยื่น${relic(l).name}ให้ด้วยมือที่สั่น`)) },
  K((l) => `รับใช้${relic(l).holder}จนเขาเต็มใจมอบให้`, "looks", 55, (l) => finish(l, relic(l), `หลังรับใช้กันมาหนึ่งปี ${relic(l).holder}มอบ${relic(l).name}ให้คุณด้วยตัวเอง "มันควรอยู่กับคนอย่างเจ้า"`), (l) => { delay(l, 1); return { text: `${relic(l).holder}ขอบคุณที่ช่วย แต่ยังไม่พร้อมจะยกมันให้ใคร` }; }, { show: (l) => l.fame >= 30 }),
  C((l) => `รอให้${relic(l).holder}ตายไปเอง`, (l) => { huntOf(l)!.wait = true; return { text: "คุณตัดสินใจรอ ตำนานรอมาเป็นพันปี คุณรอได้อีกหน่อย" }; }),
];

const HUNTED: GameEvent = SCENE("ft.hu.hunted", "เจ้าของเดิมมาทวง", (l) => { const s = fl(l).huntStolen!; return `คนของ${s.from}ตามรอย${relicOf(l, s.id)?.name}มาจนถึงบ้านคุณ พวกเขาบอกว่าจะเอามันกลับไปไม่ทางใดก็ทางหนึ่ง`; }, [
  P("สู้เพื่อรักษามันไว้", (l) => fightOdds(l, 55), G("คนของเจ้าของเดิมถอยกลับไปพร้อมแผล และไม่กลับมาอีก", { fame: 2 }, (l) => { fl(l).huntStolen = undefined; }), B("คุณแพ้ และพวกมันเอาอาวุธกลับไป", { hp: -12 }, (l) => returnStolen(l))),
  C("คืนให้แล้วขอโทษ", N("คุณคืนอาวุธให้ด้วยมือตัวเอง เจ้าของเดิมรับไว้ และบอกว่าจะไม่ตามเรื่องอีก", { joy: -4 }, (l) => returnStolen(l))),
  K("พาอาวุธหนีไปซ่อนที่อื่น", "luck", 55, N("คุณหายไปครึ่งปี พวกมันตามรอยไม่เจอ และเลิกตามในที่สุด", { joy: -2 }, (l) => { fl(l).huntStolen = undefined; }), B("พวกมันดักคุณกลางทางและเอาอาวุธไป", { hp: -8 }, (l) => returnStolen(l))),
]);
function returnStolen(l: Life) {
  const s = fl(l).huntStolen, r = myRelic(l);
  fl(l).huntStolen = undefined;
  if (!s || !r || r.id !== s.id) return;
  const alive = dataOf(l).notables.some((n) => n.name === s.from);
  r.holder = alive ? s.from : "lost"; fl(l).relic = undefined;
  passRelic(worldOfLife(l), r, alive ? `${s.from}ทวงคืน` : "หายไปหลังถูกทวงคืน");
}

export const HUNT_EVENTS: GameEvent[] = [
  SCENE("ft.hu.ch", "ตามล่าอาวุธตำนาน", (l) => { const h = huntOf(l)!, c = chap(l); return `${relic(l).name} · บทที่ ${h.ch + 1}/4 · ${c[0]}: ${fill(l, c[1])}`; }, chapterChoices),
  SCENE("ft.hu.holder", "ชิงอาวุธตำนาน", (l) => `${relic(l).name}อยู่ในมือ${relic(l).holder} บทสุดท้ายของการตามล่าคือการทำให้มันเปลี่ยนมือ`, holderChoices),
  HUNTED,
];

function huntYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const h = huntOf(l);
  if (h) {
    const r = relicOf(l, h.id);
    if (!r || r.holder === "player") { fl(l).hunt = undefined; return; }
    if (h.wait) { if (!isPerson(r.holder)) { h.wait = false; h.next = l.age; } else return; }
    // คู่แข่งตายไประหว่างทาง: มีคนใหม่ได้ยินข่าวและเข้ามาแทน
    if (h.ch < 3 && h.rival && !dataOf(l).notables.some((n) => n.name === h.rival)) {
      const next = pickRival(l);
      if (next) { log(l, `${h.rival}คู่แข่งในการตามล่า${r.name}จากไปแล้ว แต่${next}ได้ยินข่าวและเริ่มตามหาเล่มเดียวกัน`, "normal"); h.rival = next; }
    }
    if (l.age >= h.next && !l.queue.some((q) => q.eventId.startsWith("ft.hu."))) runEvent(l, h.ch === 3 && isPerson(r.holder) ? "ft.hu.holder" : "ft.hu.ch", { relic: h.id } as Ctx);
  }
  const s = fl(l).huntStolen;
  if (s && myRelic(l)?.id === s.id && l.age >= s.at + 2 && chance(l, 0.35)) runEvent(l, "ft.hu.hunted");
}

let loaded = false;
export function loadHunts() {
  if (loaded) return;
  loaded = true;
  registerEvents(HUNT_EVENTS);
  yearHooks.push(huntYear);
  // ระหว่างตามล่า ทางสืบเบาะแสแบบเก่าปิดไว้ เบาะแสจะได้ไม่กระจายสองทาง
  activityFilters.push((l, a) => a.id !== "ft_legend" || !huntOf(l));
}

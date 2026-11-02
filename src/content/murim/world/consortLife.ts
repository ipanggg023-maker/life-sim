// วังหลังจากมุมของผู้เล่นหญิง: เข้าคัดเลือก → ไต่ตำแหน่งสนม → ฮองเฮา → ไทเฮา → จักรพรรดินี
// ความโปรดปราน ลูก และการหักหลังคู่แข่งคือบันได · ทุกแผนทิ้งร่องรอย ถูกกล่าวหาแล้วต้องเอาตัวรอดด้วยความสามารถของตัวเอง
import { ACTIVITIES, type Activity } from "../../../engine/activities";
import { eligibilityFilters, type Ctx, type GameEvent } from "../../../engine/events";
import { runEvent, yearHooks } from "../../../engine/game";
import { chance, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addFame, addMoney, addStat, checkChance, clamp, createPerson, log, people, shortName } from "../../../engine/util";
import { B, BIG, C, E, G, K, N, P, PAY, TAEL, ab, type Res } from "../story/kit";
import { calYear } from "../life/world";
import { courtOf } from "./court";
import { castOf, type PNpc } from "./palace";
import { claimThrone, schemeHeat } from "./palaceSchemes";
import { coverUp } from "./survival";

export const CONSORT_RANKS = ["ไฉเหริน", "กุ้ยเหริน", "เฟย", "กุ้ยเฟย", "ฮองเฮา", "ไทเฮา"];
const EMPRESS = 4, DOWAGER = 5;
const NEED = [40, 55, 70];

const M = (a: Omit<Activity, "world"> & { group: string }): Activity => ({ ...a, world: "murim" });
const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });

const qn = (l: Life) => Number(l.flags.qnRank ?? -1);
const inHarem = (l: Life) => l.flags.qnRank !== undefined && !l.flags.emperorSelf;
const cold = (l: Life) => !!l.flags.qnCold;
const favor = (l: Life) => Number(l.flags.qnFavor ?? 0);
const sons = (l: Life) => Number(l.flags.qnSons ?? 0);
const shift = (l: Life, d: number) => { l.flags.qnFavor = clamp(favor(l) + d, 0, 100); };
const heat = (l: Life, d: number) => { l.flags.schemeHeat = clamp(schemeHeat(l) + d, 0, 100); };
const rivals = (l: Life) => castOf(l).filter((n) => n.role === "consort").sort((a, b) => b.inf - a.inf);
const rival = (l: Life): PNpc | undefined => rivals(l)[0];
const empress = (l: Life) => castOf(l).find((n) => n.role === "empress");
const rn = (l: Life) => rival(l)?.name ?? "สนมคนนั้น";
const canEnter = (l: Life) => l.gender === "f" && l.age >= 18 && l.age <= 28 && l.flags.qnRank === undefined && !l.flags.qnLeft && !l.flags.emperorSelf && !people(l, "spouse").length && !people(l, "partner").length;

/** ฮ่องเต้ในฐานะสวามี: คนจริงในแท็บผู้คน ความผูกพันคือความโปรดปราน */
const sovereign = (l: Life): Person | undefined => l.people.find((p) => p.alive && p.tags?.includes("sovereign"));
function ensureSovereign(l: Life) {
  const e = courtOf(l).emperor;
  if (sovereign(l) || l.flags.qnEmp !== e.name) return;
  const p = createPerson(l, "spouse", { gender: "m", age: e.age, bond: favor(l) });
  p.name = e.name; p.short = e.name;
  p.tags = ["sovereign", "title:ฮ่องเต้ · พระสวามี"];
}
/** องค์ชายของคุณที่อาจขึ้นครองราชย์ */
const ownSon = (l: Life) => people(l, "child").filter((p) => p.alive && p.gender === "m" && p.tags?.includes("royal")).sort((a, b) => b.age - a.age)[0];
const seatOdds = (l: Life) => clamp(0.25 + favor(l) / 250 + qn(l) * 0.08 + (l.stats.smarts - 50) / 200 - schemeHeat(l) / 300, 0.05, 0.85);

function setRank(l: Life, r: number, why: string) {
  l.flags.qnRank = r;
  l.flags.qnBest = Math.max(Number(l.flags.qnBest ?? 0), r);
  log(l, `${why} — ตอนนี้คุณคือ${CONSORT_RANKS[r]}`, "milestone");
}
function enter(l: Life) {
  l.flags.qnRank = 0;
  l.flags.qnFavor = 20;
  l.flags.qnEmp = courtOf(l).emperor.name;
  l.flags.palaceAccess = true;
  delete l.job;
  ensureSovereign(l);
}
export function leavePalace(l: Life) {
  delete l.flags.qnRank; delete l.flags.qnCold; delete l.flags.qnAccused;
  l.flags.qnLeft = true;
  delete l.flags.palaceAccess;
  l.flags.schemeHeat = 0;
  l.people = l.people.filter((p) => !p.tags?.includes("sovereign"));
}
function crown(l: Life) {
  const e = empress(l);
  if (e) e.out = true;
  courtOf(l).empress.name = `ฮองเฮา${l.firstName}`;
  l.flags.qnRank = EMPRESS;
  l.flags.qnBest = EMPRESS;
  log(l, "คุณสวมมงกุฎหงส์ ตอนนี้คุณคือฮองเฮา แม่แห่งแผ่นดิน", "milestone");
}
/** โทษเมื่อดิ้นไม่หลุด: ครั้งแรกตำหนักเย็น ครั้งที่สองแพรขาว */
function punished(l: Life) {
  delete l.flags.qnAccused;
  if (l.flags.qnFellOnce) { l.flags.qnDeath = true; return; }
  l.flags.qnFellOnce = true;
  l.flags.qnCold = true;
  l.flags.qnFavor = 0;
  l.flags.schemeHeat = 0;
  l.flags.qnRank = Math.min(qn(l), 1);
}

ACTIVITIES.push(
  M({ group: "วังหลัง", id: "mw_consort_enter", emoji: "🏮", name: "สมัครเข้ารับคัดเลือกสนม", desc: "ทางสู่ฮองเฮา สตรีโสดอายุ 18–28", minAge: 18, available: canEnter, run: (l) => { runEvent(l, "qn.selection"); return { text: "" }; } }),
  M({ group: "ในวัง", id: "mw_q_dowager", emoji: "🍵", name: "เข้าเฝ้าไทเฮา", desc: "ผู้ใหญ่ในวังเอ็นดูแล้วคนอื่นก็เกรงใจ", minAge: 18, available: (l) => qn(l) < DOWAGER, odds: (l) => checkChance(l, "smarts", 45), run: (l) => {
    if (!chance(l, checkChance(l, "smarts", 45))) return { text: "ไทเฮาทรงนับลูกประคำต่อ โดยไม่ตรัสอะไรกับคุณ" };
    shift(l, 4); heat(l, -6);
    return { text: "คุณรินชาได้ถูกจังหวะ ไทเฮาตรัสถามถึงคุณกับฮ่องเต้ในวันรุ่งขึ้น", kind: "good" };
  } }),
  M({ group: "ในวัง", id: "mw_q_study", emoji: "🧵", name: "ปักผ้าและอ่านตำราในตำหนัก", desc: "สติปัญญา + รูปลักษณ์เล็กน้อย", minAge: 18, run: (l) => { addStat(l, "smarts", randInt(l, 1, 2)); addStat(l, "looks", 1); return { text: "ลายปักของคุณละเอียดขึ้น และคุณอ่านตำราหมดไปอีกตู้", kind: "good" }; } }),
  M({ group: "ในวัง", id: "mw_q_child", emoji: "🧸", name: "ดูแลลูกในตำหนัก", desc: "ลูกที่ใกล้แม่ปลอดภัยกว่า", minAge: 18, available: (l) => people(l, "child").some((p) => p.alive && p.age < 16), run: (l) => {
    for (const k of people(l, "child")) if (k.alive && k.age < 16) k.bond = clamp(k.bond + 6, 0, 100);
    addStat(l, "happiness", 4);
    return { text: "คุณชิมข้าวให้ลูกทุกมื้อ ไม่ใช่เพราะหิว", kind: "good" };
  } }),
  M({ group: "ในวัง", id: "mw_q_home", emoji: "🏡", name: "ขอพระราชทานกลับเยี่ยมบ้าน", desc: "ความโปรดปราน 50+ · ทุก 5 ปี", minAge: 18, available: (l) => favor(l) >= 50 && l.age >= Number(l.flags.qnHomeNext ?? 0) && (people(l, "father").some((p) => p.alive) || people(l, "mother").some((p) => p.alive)), run: (l) => {
    l.flags.qnHomeNext = l.age + 5;
    for (const p of [...people(l, "father"), ...people(l, "mother")]) if (p.alive) p.bond = clamp(p.bond + 15, 0, 100);
    addStat(l, "happiness", 10); addFame(l, 2);
    return { text: "ขบวนเกี้ยวหยุดหน้าบ้านเก่า พ่อแม่คุกเข่ารับคุณตามธรรมเนียม แล้วคุณรีบดึงท่านขึ้นมากอด", kind: "good" };
  } }),
  M({ group: "ตำหนักเย็น", id: "mw_c_garden", emoji: "🥬", name: "ปลูกผักหลังตำหนัก", desc: "ประทังชีวิต สุขภาพ +", minAge: 18, run: (l) => { addStat(l, "health", randInt(l, 2, 5)); addStat(l, "happiness", 1); return { text: "ผักเหี่ยวไปครึ่งแปลง อีกครึ่งทำให้คุณมีอะไรให้รอคอย", kind: "good" }; } }),
  M({ group: "วังหลัง", id: "mw_consort", emoji: "🪷", name: "เดินเกมในวังหลัง", desc: "เอาใจฮ่องเต้ ผูกมิตร หรือหักหลังคู่แข่ง", minAge: 18, available: (l) => inHarem(l) && !cold(l), run: (l) => { runEvent(l, "qn.menu"); return { text: "" }; } }),
);

const poison = (l: Life) => { const r = rival(l); if (r) r.alive = false; l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1; };
const oust = (l: Life) => { const r = rival(l); if (r) r.out = true; };

export const CONSORT_EVENTS: GameEvent[] = [
  {
    id: "qn.audience", minAge: 18, maxAge: 120, manual: true, maxTimes: 0, title: "เข้าเฝ้า",
    text: (l) => `${courtOf(l).emperor.name}รับสั่งให้คุณเข้าเฝ้าที่ห้องทรงพระอักษร ความโปรดปราน ${favor(l)}`,
    choices: [
      K("ถวายคำปรึกษาเรื่องบ้านเมือง", "smarts", 50, act(G("ฮ่องเต้วางพู่กัน แล้วถามความเห็นคุณอีกข้อ", { iq: 1 }), (l) => shift(l, 10)), act(N("ฮ่องเต้ทรงพระสรวลเบาๆ \"เรื่องนี้ไม่ใช่เรื่องของวังหลัง\"", {}), (l) => shift(l, -3))),
      K("ชวนเล่นหมากชมจันทร์", "looks", 45, act(G("คุณแพ้ไปหนึ่งเม็ดอย่างตั้งใจ และพระองค์ไม่รู้", { joy: 3 }), (l) => shift(l, 8)), N("พระองค์ทรงง่วงตั้งแต่ตาที่สิบ", {})),
      P("ทูลขอตำแหน่งให้ตระกูล", ab(0.35, "smarts", 0.6), act(G("ราชโองการไปถึงบ้านเกิดคุณก่อนจดหมายของคุณ ตระกูลคุณส่งของกำนัลกลับมา", { tael: 40, fame: 3 }), (l) => heat(l, 8)), act(B("พระองค์ทรงนิ่งไปนาน \"เจ้ามาหาข้า หรือมาหาตำแหน่ง\"", {}), (l) => shift(l, -6))),
      C("นั่งฟังเงียบๆ", act(N("คืนนั้นพระองค์ตรัสเรื่องที่ไม่เคยตรัสกับใคร", {}), (l) => shift(l, 3))),
    ],
  } satisfies GameEvent,

  E("qn.selection", [18, 28], "ราชโองการคัดเลือกสนมมาถึงเมือง ขันทีตรวจหน้าตา กิริยา และลายมือ หญิงสาวทั้งแผ่นดินยืนเรียงกันหน้าวัง", [
    P("เข้ารับการคัดเลือกด้วยรูปโฉม", ab(0.4, "looks", 0.8), act(BIG("ฮ่องเต้หยุดมองคุณนานกว่าคนอื่นสามลมหายใจ ป้ายชื่อคุณถูกเก็บไว้ ประตูวังปิดตามหลังคุณ", { joy: 3 }), enter), N("ขันทีส่ายหน้า คุณได้ผ้าหนึ่งพับเป็นค่าเดินทางกลับบ้าน", {})),
    P("แสดงความรู้ เขียนบทกวีถวาย", ab(0.35, "smarts", 0.8), act(BIG("บทกวีของคุณถูกอ่านออกเสียงในตำหนัก \"คนนี้ไม่เหมือนคนอื่น\" คุณได้เข้าวัง", { iq: 1 }), enter), N("บทกวีดี แต่ไม่มีใครอ่าน", {})),
    PAY("ติดสินบนขันทีให้ได้ชื่อเข้าวัง", 40, act(N("ชื่อคุณอยู่ในบัญชี แต่ขันทีรู้ราคาของคุณแล้ว", {}), (l) => { enter(l); heat(l, 10); })),
    C("ไม่เข้าวัง", N("คุณกลับบ้าน ชีวิตนอกกำแพงยังยาวไกล", {})),
  ], { when: canEnter, weight: (l) => (l.stats.looks >= 60 ? 6 : 3), maxTimes: 3, title: "คัดเลือกสนม" }),

  {
    id: "qn.menu", minAge: 14, maxAge: 120, manual: true, maxTimes: 0, title: "เกมในวังหลัง",
    text: (l) => `ตอนนี้คุณคือ${CONSORT_RANKS[qn(l)]} · ความโปรดปราน ${favor(l)} · ลูกชาย ${sons(l)} คน · ร่องรอย ${schemeHeat(l)}${rival(l) ? ` · คู่แข่ง: ${rival(l)!.name}` : ""}\n${qn(l) < 3 ? `ขึ้นขั้นต่อไปต้องมีความโปรดปราน ${NEED[qn(l)]}` : qn(l) === 3 ? "ขั้นต่อไปคือฮองเฮา ต้องมีลูกชายหรือความโปรดปรานสูงก่อนโค่นนาง" : "ตำแหน่งสูงสุดในวังหลัง แต่ทุกคนจ้องจะดึงคุณลง"}`,
    choices: [
      K("ถวายการปรนนิบัติให้ฮ่องเต้พอพระทัย", "looks", 50, act(G("ค่ำนั้นฮ่องเต้ไม่ได้เสด็จไปตำหนักอื่น", { joy: 2 }), (l) => shift(l, 12)), act(N("ฮ่องเต้ทรงเหนื่อย และเรียกคุณผิดชื่อ", { joy: -2 }), (l) => shift(l, -2))),
      PAY("ส่งของกำนัลให้หัวหน้าขันที", 20, act(N("ขันทีบอกว่าวันไหนฮ่องเต้อารมณ์ดี และใครกำลังนินทาคุณ", {}), (l) => { shift(l, 6); heat(l, -10); })),
      K("ซ่อนตุ๊กตาเข็มในห้องคู่แข่ง แล้วแจ้งจับ", "smarts", 55, act(G((l) => `ขันทีค้นเจอตุ๊กตาเขียนดวงฮ่องเต้ใต้เตียงของ${rn(l)} นางถูกลากออกไปทั้งร้องไห้`, { align: -6 }), (l) => { oust(l); shift(l, 8); heat(l, 25); }), act(B("ขันทีเจอรอยเข็มบนนิ้วคุณก่อน", { align: -3 }), (l) => heat(l, 35)), { show: (l) => !!rival(l) }),
      P("วางยาในซุปรังนกของคู่แข่ง", ab(0.4, "smarts", 0.6), act(G((l) => `${rn(l)}ล้มลงกลางงานเลี้ยงน้ำชา หมอหลวงบอกว่าเป็นโรคหัวใจ`, { align: -10 }), (l) => { poison(l); heat(l, 35); }), act(B("สาวใช้ชิมซุปก่อน คนตายผิดคน และการสอบสวนเริ่มขึ้น", { align: -8 }), (l) => heat(l, 50)), { tone: "danger", show: (l) => !!rival(l) }),
      K("แฉเรื่องที่คู่แข่งแอบพบองครักษ์", "looks", 55, act(G((l) => `จดหมายรักถูกอ่านต่อหน้าพระพักตร์ ${rn(l)}ถูกส่งไปตำหนักเย็นคืนนั้น จะจริงหรือไม่ก็ไม่มีใครถามแล้ว`, { align: -4 }), (l) => { oust(l); heat(l, 20); }), act(B("จดหมายถูกพิสูจน์ว่าปลอม", {}), (l) => { shift(l, -10); heat(l, 25); }), { show: (l) => !!rival(l) }),
      P("เป็นคนสนิทฮองเฮา แล้วนำความลับนางไปถวายฮ่องเต้", ab(0.4, "smarts", 0.6), act(G("ฮองเฮาจับมือคุณไว้เมื่อวาน วันนี้ฮ่องเต้จับมือคุณแทน", { align: -5 }), (l) => { shift(l, 18); heat(l, 20); }), act(B("ฮองเฮารู้ก่อน นางยิ้มให้คุณในงานเลี้ยง แล้วทุกอย่างในตำหนักคุณก็เริ่มหาย", {}), (l) => { shift(l, -10); heat(l, 30); }), { show: (l) => qn(l) >= 1 && qn(l) < EMPRESS && !!empress(l) }),
      P("โค่นฮองเฮาลงจากตำแหน่ง", (l) => clamp(0.25 + (favor(l) - 50) / 150 + sons(l) * 0.1 + (l.stats.smarts - 50) / 150 - schemeHeat(l) / 300, 0.05, 0.85), act(BIG((l) => `ราชโองการถอดฮองเฮาถูกอ่านกลางลาน คนที่สวมมงกุฎหงส์แทนคือคุณ ${l.firstName}`, { fame: 20 }), crown), act(B("ตระกูลฮองเฮาลุกขึ้นทั้งราชสำนัก ฎีกากล่าวโทษคุณมาถึงโต๊ะฮ่องเต้สิบสองฉบับ", { fame: -5 }), (l) => { heat(l, 45); l.flags.qnAccused = true; }), { tone: "danger", show: (l) => qn(l) === 3 && !!empress(l) }),
      C("สงบเสงี่ยมไปก่อน ไม่ทำอะไรเด่น", act(N("คุณปักผ้าอยู่ในตำหนักทั้งฤดู คนที่จ้องคุณเริ่มหันไปจ้องคนอื่น", {}), (l) => heat(l, -12))),
    ],
  } satisfies GameEvent,

  E("qn.promote", [14, 100], (l) => `ราชโองการมาถึงตำหนักของคุณ ฮ่องเต้เลื่อนคุณเป็น${CONSORT_RANKS[qn(l) + 1]} นางกำนัลคุกเข่าเต็มลาน และคนที่เคยมองข้ามคุณเริ่มยิ้มให้`, [
    C("รับด้วยความถ่อมตน", act(G("คุณก้มลงรับป้ายทอง ไม่มีใครเห็นรอยยิ้มคุณ", { fame: 3, joy: 3 }), (l) => setRank(l, qn(l) + 1, "ความโปรดปรานพาคุณขึ้น"))),
  ], { when: (l) => inHarem(l) && !cold(l) && qn(l) < 3 && favor(l) >= NEED[qn(l)], forced: true, maxTimes: 0, title: "เลื่อนตำแหน่งในวังหลัง" }),

  E("qn.child", [14, 45], "หมอหลวงจับชีพจรแล้วก้มกราบ \"ทรงพระครรภ์\" ข่าวไปถึงทุกตำหนักก่อนเที่ยง สิบเดือนนี้จะเป็นสิบเดือนที่อันตรายที่สุดของคุณ", [
    P("เฝ้าระวังอาหารและคนรอบตัวทุกมื้อ", ab(0.55, "smarts", 0.5), (l, c) => { const son = chance(l, 0.5); const k = createPerson(l, "child", { age: 0, gender: son ? "m" : "f", bond: 80 }); k.tags = [...(k.tags ?? []), "royal"]; if (son) l.flags.qnSons = sons(l) + 1; shift(l, son ? 15 : 6); return G(son ? "องค์ชายร้องลั่นตำหนัก ฮ่องเต้เสด็จมาเอง ตั้งแต่นี้คุณมีที่ยืนในราชวงศ์" : "องค์หญิงตัวน้อยกำนิ้วคุณแน่น ฮ่องเต้ทรงพระสรวล", { joy: 10 })(l, c); }, act(B("ซุปชามหนึ่งทำให้ทุกอย่างจบลงในคืนเดียว และไม่มีใครยอมรับ", { hp: -15, joy: -15 }), (l) => heat(l, -10))),
  ], { when: (l) => inHarem(l) && !cold(l) && favor(l) >= 45 && l.age >= Number(l.flags.qnBabyNext ?? 0), weight: 14, maxTimes: 4, title: "ทรงพระครรภ์", prepare: (l) => { l.flags.qnBabyNext = l.age + 3; return {}; } }),

  E("qn.suspect", [14, 110], "นางกำนัลคนสนิทกระซิบว่ามีคนถามหาบัญชียาของตำหนักคุณ ขันทีตรวจการเดินผ่านหน้าประตูเป็นรอบที่สาม ยังไม่มีใครพูดอะไร", [
    K("เผาหลักฐานให้หมดก่อนคนจะมาถึง", "smarts", 50, act(G("ขี้เถ้าลงเตาไปหมดก่อนรุ่งสาง", {}), (l) => heat(l, -25)), act(B("ควันไหม้ทำให้คนยิ่งสงสัย", {}), (l) => heat(l, 10))),
    P("ปิดปากนางกำนัลที่รู้เรื่อง", ab(0.5, "smarts", 0.4), act(N("นางกำนัลตกบ่อในคืนฝนตก คุณจัดงานศพให้อย่างดี", { align: -8 }), (l) => heat(l, -35)), act(B("นางหนีไปหาฝ่ายตรงข้ามก่อน", { align: -4 }), (l) => heat(l, 25)), { tone: "danger" }),
    P("เข้าหาฮ่องเต้ก่อนข่าวจะไปถึง", ab(0.4, "looks", 0.7), act(G("คุณเล่าเรื่องในแบบของคุณก่อนใคร ข่าวที่ตามมาจึงกลายเป็นคำใส่ร้าย", {}), (l) => { heat(l, -20); shift(l, 4); }), act(N("ฮ่องเต้ไม่รับเฝ้าวันนี้", {}), (l) => shift(l, -4))),
    C("ทำตัวตามปกติ", N("คุณปักผ้าต่อ และนับเข็มผิดเป็นครั้งแรก", {})),
  ], { when: (l) => inHarem(l) && !cold(l) && schemeHeat(l) >= 40, weight: 18, maxTimes: 0, title: "มีคนกำลังสืบ" }),

  E("qn.accused", [14, 110], (l) => `ฎีกากล่าวโทษคุณถูกอ่านต่อหน้าพระพักตร์ ไทเฮาประทับเป็นประธาน พยานคุกเข่าอยู่หน้าบัลลังก์ (ร่องรอย ${schemeHeat(l)})${l.flags.qnFellOnce ? " ครั้งนี้ไม่มีตำหนักเย็นให้กลับไปแล้ว" : ""}`,
    [
      ...coverUp({ clear: (l) => { delete l.flags.qnAccused; heat(l, -40); }, caught: punished }),
    ], { when: (l) => inHarem(l) && !!l.flags.qnAccused, forced: true, maxTimes: 0, title: "ถูกกล่าวหาในวัง" }),

  E("qn.silk", [14, 110], "ขันทีถือถาดเดินเข้ามาช้าๆ บนถาดมีแพรขาวหนึ่งผืน กับสุราหนึ่งจอก ราชโองการสั้นกว่าที่คุณคิด", [
    C("รับพระราชทาน", B("คุณจัดผมให้เรียบร้อยก่อน", { die: "รับแพรขาวพระราชทานในวังหลัง" })),
    P("แหกกำแพงหนีออกจากวัง", ab(0.2, "health", 0.6), act(BIG("คุณลอดท่อน้ำออกนอกกำแพงในคราบนางกำนัล ชื่อคุณถูกลบจากทุกทะเบียน", { hp: -15, fame: -10, flag: "wanted" }), (l) => { delete l.flags.qnDeath; leavePalace(l); }), B("ทหารรักษาวังรออยู่ที่ปลายท่อ", { die: "ถูกจับได้ขณะหนีออกจากวังหลัง" })),
  ], { when: (l) => inHarem(l) && !!l.flags.qnDeath, forced: true, maxTimes: 0, title: "แพรขาว" }),

  E("qn.cold", [14, 110], "ตำหนักเย็นไม่มีเตาไฟ ข้าวส่งมาวันละมื้อ ผู้หญิงในห้องข้างๆ คุยกับเงาตัวเองมาสิบปีแล้ว", [
    P("ส่งบทกวีเศร้าออกไปถึงฮ่องเต้", (l) => clamp(0.2 + (l.stats.smarts - 50) / 200 + (l.stats.looks - 50) / 200 + sons(l) * 0.15, 0.05, 0.8), act(G("ฮ่องเต้อ่านจบแล้วนิ่งไปนาน รุ่งขึ้นประตูตำหนักเย็นเปิดออก", { joy: 8 }), (l) => { delete l.flags.qnCold; l.flags.qnFavor = 35; }), N("กระดาษแผ่นนั้นไปไม่ถึงมือใคร", { joy: -3 })),
    P("ติดสินบนยามแล้วหนีออกจากวัง", ab(0.35, "smarts", 0.5), act(BIG("คุณเดินออกจากวังในชุดคนเก็บขยะ ไม่มีใครมองหน้าคนเก็บขยะ", { joy: 6 }), leavePalace), B("ยามรับเงินแล้วรายงานหัวหน้า อาหารวันละมื้อกลายเป็นสองวันมื้อ", { hp: -6 })),
    C("อดทนรอ", N("คุณนับรอยแตกบนเพดานอีกหนึ่งปี", { joy: -2 })),
  ], { when: (l) => inHarem(l) && cold(l), weight: 25, maxTimes: 0, title: "ตำหนักเย็น" }),

  E("qn.widow", [20, 110], (l) => `ระฆังเก้าครั้งดังจากหอกลอง ฮ่องเต้สวรรคตแล้ว ${courtOf(l).emperor.name}ขึ้นครองราชย์ คุณมียศ${CONSORT_RANKS[qn(l)]} และสนมที่ไม่มีลูกชายมักถูกส่งไปวัดหลวง`, [
    P((l) => `ผลักดันองค์ชาย${ownSon(l) ? shortName(ownSon(l)!) : ""}ขึ้นครองราชย์`, seatOdds, act(BIG(`พระราชพินัยกรรมถูกอ่านกลางท้องพระโรง ชื่อที่ออกจากปากขันทีคือลูกของคุณ คุณได้เป็นไทเฮาตั้งแต่วันนี้`, { fame: 15 }), (l) => {
      const k = ownSon(l)!, c = courtOf(l);
      c.reigns.push({ name: c.emperor.name, from: c.emperor.since, to: calYear(l), how: "สละราชสมบัติให้พระราชบุตรของพระสนม" });
      c.emperor = { name: `ฮ่องเต้${k.name}`, age: k.age, temper: "wise", health: 100, since: calYear(l) };
      c.regent = k.age < 16 ? `ไทเฮา${l.firstName}` : undefined;
      k.tags = [...(k.tags ?? []), "title:ฮ่องเต้ · พระโอรส"];
      l.flags.qnRank = DOWAGER; l.flags.qnBest = DOWAGER; l.flags.qnEmp = c.emperor.name; l.flags.qnSonOnThrone = k.id; delete l.flags.qnCold;
    }), act(B("ฝ่ายองค์ชายอีกองค์เร็วกว่าคุณหนึ่งก้าว ฎีกาที่คุณเตรียมไว้กลายเป็นหลักฐาน", {}), (l) => heat(l, 30)), { tone: "danger", show: (l) => !!ownSon(l) && !cold(l) }),
    C((l) => (qn(l) >= EMPRESS || sons(l) ? "รับฐานันดรไทเฮา" : "ขอไปบวชที่วัดหลวง"), (l, c) => {
      if (qn(l) >= EMPRESS || sons(l)) { l.flags.qnRank = DOWAGER; l.flags.qnBest = DOWAGER; l.flags.qnEmp = courtOf(l).emperor.name; delete l.flags.qnCold; log(l, "ตอนนี้คุณคือไทเฮา คนในวังทั้งหมดต้องคุกเข่าให้คุณ", "milestone"); return BIG("ฮ่องเต้องค์ใหม่คุกเข่าถวายน้ำชาให้คุณ และคนทั้งราชสำนักเห็น", { fame: 8 })(l, c); }
      leavePalace(l);
      return N("ผมยาวร่วงลงบนพื้นวัด ไม่มีใครในวังหลวงจำชื่อคุณอีก", { joy: -3 })(l, c);
    }),
  ], { when: (l) => inHarem(l) && qn(l) < DOWAGER && !!l.flags.qnEmp && l.flags.qnEmp !== courtOf(l).emperor.name, forced: true, maxTimes: 0, title: "ผลัดแผ่นดิน" }),

  E("qn.regnant", [30, 110], (l) => `ขุนนางทั้งท้องพระโรงรายงานต่อคุณหลังม่าน ไม่ใช่ต่อ${courtOf(l).emperor.name} ม่านผืนนี้บางลงทุกปี (ร่องรอย ${schemeHeat(l)})`, [
    P("เปิดม่าน ประกาศตนเป็นจักรพรรดินี", (l) => clamp(0.3 + l.fame / 300 + (l.stats.smarts - 50) / 200 - (l.mw?.legitimacy ?? 50) / 400 + sons(l) * 0.05 + (l.flags.qnSonOnThrone ? 0.15 : 0) - schemeHeat(l) / 250, 0.05, 0.8), act(BIG("กลองเก้าครั้งดังขึ้น โลกนี้ไม่เคยมีผู้หญิงนั่งบัลลังก์มังกรมาก่อน จนถึงวันนี้", { fame: 30 }), (l) => { claimThrone(l, "ไทเฮาขึ้นครองราชย์เอง"); }), B("ราชวงศ์ลุกฮือทั้งเมืองหลวง ฮ่องเต้หนุ่มสั่งให้คุณดื่มสุราจอกสุดท้ายด้วยมือตัวเอง", { die: "ถูกโค่นขณะชิงบัลลังก์จากหลังม่าน" }), { tone: "danger", survival: (l) => clamp(0.3 + l.fame / 300 + (l.stats.smarts - 50) / 200 - (l.mw?.legitimacy ?? 50) / 400 + sons(l) * 0.05 + (l.flags.qnSonOnThrone ? 0.15 : 0) - schemeHeat(l) / 250, 0.05, 0.8) }),
    C("ปกครองหลังม่านต่อไป", act(N("ฮ่องเต้ลงพระนาม คุณเป็นคนบอกว่าให้ลงตรงไหน", { fame: 2 }), (l) => { l.flags.courtRank = Math.max(Number(l.flags.courtRank ?? 0), 4); addFame(l, 1); })),
    C("คืนอำนาจแล้วอยู่อย่างสงบ", N("คุณเลิกอ่านฎีกา และเริ่มปลูกดอกโบตั๋น", { joy: 6 })),
  ], { when: (l) => inHarem(l) && qn(l) === DOWAGER, weight: 10, maxTimes: 6, title: "หลังม่าน" }),
];

yearHooks.push((l) => {
  if (l.flags.qnRank !== undefined && l.job) l.job = undefined; // คนในวังหลังไม่มีงานนอกวัง
  if (l.worldId !== "murim" || !l.alive) return;
  const sv = sovereign(l);
  if (sv && sv.name !== courtOf(l).emperor.name) sv.alive = false; // สวรรคตหรือถูกโค่น · ผลัดแผ่นดินเล่าต่อใน qn.widow
  if (!inHarem(l)) return;
  ensureSovereign(l);
  if (!cold(l)) {
    shift(l, l.age >= 40 ? -6 : -3);
    if (qn(l) >= 1) addMoney(l, (qn(l) + 1) * 20 * TAEL);
    const h = schemeHeat(l);
    if (h > 0) { if (chance(l, h / 240)) l.flags.qnAccused = true; heat(l, -5); }
  }
  const now = sovereign(l);
  if (now) { now.bond = favor(l); now.age = courtOf(l).emperor.age; }
});

// คนในวังไม่มีเรื่องรักนอกกำแพงแบบชาวบ้าน · ราชบุตรเขยรับเมียรองไม่ได้
eligibilityFilters.push((l, e) => {
  if (inHarem(l) && /^(lv\.|fm\.spouse|fm\.widow|hh\.(husband|quarrel|poison|second))/.test(e.id)) return false;
  if (l.flags.pcRank !== undefined && /^(hh\.(second|poison)|lv\.political)/.test(e.id)) return false;
  return true;
});

export const consortLine = (l: Life) => (inHarem(l) ? `${CONSORT_RANKS[qn(l)]}${cold(l) ? " ในตำหนักเย็น" : ` · โปรดปราน ${favor(l)}`}` : "");

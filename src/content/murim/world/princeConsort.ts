// ราชบุตรเขยจากมุมของผู้เล่นชาย: อภิเษกกับองค์หญิง → ได้ความไว้วางใจ → ร่วมสำเร็จราชการ → ชิงบัลลังก์
// คู่กับวังหลังของผู้เล่นหญิง (consortLife.ts) · ทุกแผนทิ้งร่องรอย ถูกจับได้ครั้งแรกเสียตำแหน่ง ครั้งที่สองเสียหัว
import { ACTIVITIES, type Activity } from "../../../engine/activities";
import type { Ctx, GameEvent } from "../../../engine/events";
import { kill, runEvent, yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addMoney, clamp, createPerson, log, people } from "../../../engine/util";
import { MURIM_FEMALE } from "../names";
import { B, BIG, C, E, G, K, N, P, PAY, TAEL, ab, type Res } from "../story/kit";
import { courtOf } from "./court";
import { claimThrone, schemeHeat } from "./palaceSchemes";
import { coverUp } from "./survival";

export const PC_RANKS = ["ราชบุตรเขย", "ราชบุตรเขยคนสนิท", "ผู้ร่วมสำเร็จราชการ"];
const NEED = [45, 70];

const M = (a: Omit<Activity, "world"> & { group: string }): Activity => ({ ...a, world: "murim" });
const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });

const pc = (l: Life) => Number(l.flags.pcRank ?? -1);
export const isFuma = (l: Life) => l.flags.pcRank !== undefined;
const trust = (l: Life) => Number(l.flags.pcTrust ?? 0);
const allies = (l: Life) => Number(l.flags.pcAllies ?? 0);
const shift = (l: Life, d: number) => { l.flags.pcTrust = clamp(trust(l) + d, 0, 100); };
const heat = (l: Life, d: number) => { l.flags.schemeHeat = clamp(schemeHeat(l) + d, 0, 100); };
const princess = (l: Life): Person | undefined => l.people.find((p) => p.alive && p.tags?.includes("princess"));
const canEnter = (l: Life) => l.gender === "m" && l.age >= 18 && l.age <= 32 && !isFuma(l) && !l.flags.pcLeft && !l.flags.emperorSelf && !people(l, "spouse").length && !people(l, "partner").length && l.job?.careerId !== "monk";

function enter(l: Life) {
  const name = pick(l, MURIM_FEMALE);
  const p = createPerson(l, "spouse", { gender: "f", age: Math.max(18, l.age + randInt(l, -4, 2)), bond: 45 });
  p.name = `องค์หญิง${name}`; p.short = `องค์หญิง${name}`;
  p.tags = [...(p.tags ?? []), "princess", "title:องค์หญิง · ภรรยา"];
  l.flags.pcRank = 0; l.flags.pcBest = 0; l.flags.pcTrust = 25; l.flags.pcEmp = courtOf(l).emperor.name;
  l.flags.palaceAccess = true;
}
function setRank(l: Life, r: number) {
  l.flags.pcRank = r; l.flags.pcBest = Math.max(Number(l.flags.pcBest ?? 0), r);
  l.flags.courtRank = Math.max(Number(l.flags.courtRank ?? 0), r * 2);
  log(l, `ตอนนี้คุณคือ${PC_RANKS[r]}`, "milestone");
}
function strip(l: Life) {
  delete l.flags.pcRank; delete l.flags.pcAccused; delete l.flags.palaceAccess;
  l.flags.pcLeft = true; l.flags.schemeHeat = 0;
  l.people = l.people.filter((p) => !p.tags?.includes("princess"));
}
const coupOdds = (l: Life) => clamp(0.15 + trust(l) / 300 + allies(l) * 0.06 + (l.stats.smarts - 50) / 200 + l.fame / 400 - schemeHeat(l) / 250, 0.05, 0.8);

ACTIVITIES.push(
  M({ group: "วังหลัง", id: "mw_pc_enter", emoji: "🎐", name: "ถวายตัวเป็นราชบุตรเขย", desc: "ทางเข้าวังของชายโสดอายุ 18–32", minAge: 18, available: canEnter, run: (l) => { runEvent(l, "qn.pc_select"); return { text: "" }; } }),
  M({ group: "วังหลัง", id: "mw_pc", emoji: "🎋", name: "เดินเกมราชบุตรเขย", desc: "เอาใจองค์หญิง ถวายงาน หรือสร้างพรรคพวก", minAge: 18, available: isFuma, run: (l) => { runEvent(l, "qn.pc_menu"); return { text: "" }; } }),
);

export const FUMA_EVENTS: GameEvent[] = [
  E("qn.pc_grandson", [20, 80], "ลูกของคุณกับองค์หญิงวิ่งเข้าห้องทรงงานแล้วปีนตักฮ่องเต้ ขุนนางทั้งห้องกลั้นหายใจ พระองค์ทรงพระสรวลเป็นครั้งแรกในรอบปี", [
    C("ปล่อยให้เล่นต่อ", act(G("ฮ่องเต้เรียกเด็กว่าหลานรัก คนทั้งวังได้ยิน", { joy: 5 }), (l) => shift(l, 8))),
    K("ถือโอกาสทูลขอตำแหน่งให้ตระกูล", "smarts", 55, act(G("พระองค์พยักพระพักตร์ก่อนจะรู้ตัวว่าทรงรับปาก", { tael: 30 }), (l) => heat(l, 6)), act(B("พระองค์หยุดหัวเราะ และมองคุณอย่างคนที่เพิ่งเห็นบางอย่าง", {}), (l) => shift(l, -8))),
  ], { when: (l) => isFuma(l) && people(l, "child").some((p) => p.alive && p.age >= 3 && p.age <= 12), weight: 7, maxTimes: 2, title: "หลานรัก" }),
  E("qn.pc_prince", [20, 90], "องค์ชายสามนัดคุณดื่มชาลับๆ \"ท่านพี่เขยอยู่ใกล้เสด็จพ่อที่สุด วันหนึ่งข้าอาจต้องการเพื่อน และวันนั้นข้าจะจำได้ว่าใครมาก่อน\"", [
    P("รับคำ ผูกสัมพันธ์ลับกับองค์ชาย", ab(0.45, "smarts", 0.6), act(G("คุณมีพรรคพวกในราชวงศ์เป็นครั้งแรก", { align: -2 }), (l) => { l.flags.pcAllies = allies(l) + 1; heat(l, 18); }), act(B("คนรับใช้ของเขาเป็นคนของเจ้ากรมตรวจการ", {}), (l) => heat(l, 35)), { tone: "danger" }),
    C("นำเรื่องนี้ไปทูลฮ่องเต้", act(G("องค์ชายถูกส่งไปเฝ้าสุสานหลวงหนึ่งปี ฮ่องเต้เริ่มไว้ใจคุณมากขึ้น", { align: -3 }), (l) => shift(l, 12))),
    C("ดื่มชาแล้วบอกว่าไม่ได้ยินอะไร", N("คุณกลับจวนโดยไม่มีศัตรูเพิ่ม และไม่มีเพื่อนเพิ่ม", {})),
  ], { when: isFuma, weight: 6, maxTimes: 2, title: "ชาหนึ่งถ้วย" }),
  E("qn.pc_old_friend", [20, 80], "เพื่อนเก่าตั้งแต่ก่อนคุณจะได้เป็นราชบุตรเขยมายืนรอหน้าจวน เขาลำบาก และขอให้คุณช่วยฝากงานในวัง ยามหน้าประตูมองเขาเหมือนมองขอทาน", [
    C("พาเข้าจวนแล้วช่วยฝากงาน", act(G("เขาร้องไห้ในห้องรับแขกของคุณ องค์หญิงเลิกคิ้วแต่ไม่ว่าอะไร", { align: 3, joy: 3 }), (l) => heat(l, 8))),
    C("ให้เงินแล้วส่งกลับ", N("เขารับเงินโดยไม่มองหน้าคุณ", { tael: -5 })),
    C("สั่งยามไล่ไป", N("ตอนนี้คุณเป็นคนในวังแล้ว คุณบอกตัวเองแบบนั้น", { align: -4, joy: -3 })),
  ], { when: isFuma, weight: 5, maxTimes: 1, title: "เพื่อนเก่าหน้าประตู" }),

  E("qn.pc_select", [18, 32], "ฮ่องเต้ทรงเลือกราชบุตรเขยให้พระธิดา ชายหนุ่มทั่วแผ่นดินถูกเรียกเข้าเมืองหลวง องค์หญิงจะฟังคำตอบจากหลังม่าน", [
    P("ตอบปัญหาขององค์หญิงหลังม่าน", ab(0.35, "smarts", 0.8), act(BIG("เสียงหลังม่านหัวเราะเบาๆ \"คนนี้ไม่น่าเบื่อ\" ฮ่องเต้พระราชทานสมรสเดือนนั้น", { fame: 8, joy: 8 }), enter), N("องค์หญิงถามคำถามที่สาม แล้วคุณก็เงียบ", {})),
    P("แสดงฝีมือหน้าพระที่นั่ง", ab(0.3, "health", 0.6), act(BIG("คุณล้มองครักษ์สามคนแล้ววางดาบคุกเข่า ฮ่องเต้พยักพระพักตร์ คุณได้เป็นราชบุตรเขย", { fame: 10, joy: 6 }), enter), N("คุณแพ้ตั้งแต่คนที่สอง พร้อมรอยช้ำเป็นของที่ระลึก", { hp: -3 })),
    PAY("ฝากตัวกับหัวหน้าขันที", 60, act(N("ชื่อคุณอยู่ในบัญชี แต่ขันทีจำราคาของคุณได้", { fame: 2 }), (l) => { enter(l); heat(l, 12); })),
    C("ถอนตัว", N("คุณกลับบ้านพร้อมเรื่องเล่าหนึ่งเรื่อง", {})),
  ], { when: canEnter, weight: (l) => (l.stats.smarts >= 60 || l.fame >= 30 ? 5 : 2), maxTimes: 3, title: "เลือกราชบุตรเขย" }),

  {
    id: "qn.pc_menu", minAge: 18, maxAge: 120, manual: true, maxTimes: 0, title: "เกมของราชบุตรเขย",
    text: (l) => `ตอนนี้คุณคือ${PC_RANKS[pc(l)]} · ความไว้วางใจ ${trust(l)} · พรรคพวก ${allies(l)} คน · ร่องรอย ${schemeHeat(l)}\n${pc(l) < 2 ? `ขึ้นขั้นต่อไปต้องมีความไว้วางใจ ${NEED[pc(l)]}` : "คุณยืนใกล้บัลลังก์ที่สุดเท่าที่คนนอกราชวงศ์จะยืนได้"}`,
    choices: [
      K("เอาใจองค์หญิง", "looks", 45, act(G("องค์หญิงเลิกเรียกคุณว่า \"ท่านราชบุตรเขย\" เมื่ออยู่กันสองคน", { joy: 3 }), (l) => { shift(l, 7); const p = princess(l); if (p) p.bond = clamp(p.bond + 8, 0, 100); }), N("องค์หญิงอ่านหนังสือต่อโดยไม่เงยหน้า", {})),
      K("ถวายงานรับใช้ฮ่องเต้", "smarts", 50, act(G("ฎีกาที่คุณสรุปถวายทำให้ฮ่องเต้เลิกคิ้ว", { fame: 2 }), (l) => shift(l, 10)), act(N("ฮ่องเต้ทรงอ่านผ่านๆ แล้ววางลง", {}), (l) => shift(l, -2))),
      P("สร้างพรรคพวกในราชสำนัก", ab(0.45, "smarts", 0.6), act(G("ขุนนางคนหนึ่งเริ่มส่งข่าวให้คุณก่อนส่งให้คนอื่น", { align: -2 }), (l) => { l.flags.pcAllies = allies(l) + 1; heat(l, 15); }), act(B("ขุนนางคนนั้นนำจดหมายของคุณไปให้เจ้ากรมตรวจการ", {}), (l) => heat(l, 30))),
      P("ยึดอำนาจขึ้นครองราชย์", coupOdds, act(BIG("ประตูวังเปิดจากด้านใน พรรคพวกของคุณยืนเต็มท้องพระโรง คนนอกราชวงศ์นั่งบัลลังก์มังกรแล้ว", { fame: 25 }), (l) => { claimThrone(l, "ราชบุตรเขยยึดอำนาจ"); delete l.flags.pcRank; }), act(B("ทหารรักษาวังรู้ก่อนคุณหนึ่งชั่วยาม", { fame: -8 }), (l) => { heat(l, 50); l.flags.pcAccused = true; }), { tone: "danger", show: (l) => pc(l) === 2 }),
      C("อยู่เงียบๆ ไม่ทำอะไรเด่น", act(N("คุณเลี้ยงนกกับองค์หญิงไปทั้งฤดู คนเลิกจับตาดูคุณ", { joy: 2 }), (l) => heat(l, -12))),
    ],
  } satisfies GameEvent,

  E("qn.pc_promote", [18, 110], (l) => `ฮ่องเต้ทรงเรียกคุณเข้าห้องทรงพระอักษรตามลำพัง ตั้งแต่วันนี้คุณคือ${PC_RANKS[pc(l) + 1]}`, [
    C("รับด้วยความถ่อมตน", act(G("คุณก้มรับ ขุนนางเฒ่าที่เคยมองผ่านคุณเริ่มทักทาย", { fame: 4 }), (l) => setRank(l, pc(l) + 1))),
  ], { when: (l) => isFuma(l) && pc(l) < 2 && trust(l) >= NEED[pc(l)], forced: true, maxTimes: 0, title: "ความไว้วางใจ" }),

  E("qn.pc_jealous", [18, 80], "องค์หญิงวางจดหมายฉบับหนึ่งลงบนโต๊ะ ลายมือผู้หญิง ส่งถึงชื่อคุณ \"ท่านจะอธิบายเอง หรือให้เสด็จพ่ออ่าน\"", [
    K("พิสูจน์ว่าเป็นจดหมายปลอม", "smarts", 50, act(G("คุณชี้รอยหมึกที่ใหม่เกินไป องค์หญิงหันไปถามนางกำนัลคนสนิทแทน", {}), (l) => shift(l, 6)), act(B("องค์หญิงฟังจบแล้วเก็บจดหมายเข้าแขนเสื้อ", {}), (l) => { shift(l, -12); heat(l, 10); })),
    C("สารภาพและขอโทษ", act(N("องค์หญิงไม่พูดกับคุณสามเดือน แต่ไม่ส่งจดหมายไปไหน", { joy: -4 }), (l) => shift(l, -6))),
  ], { when: (l) => isFuma(l) && !!princess(l), weight: 8, maxTimes: 3, title: "จดหมายบนโต๊ะ" }),

  E("qn.pc_suspect", [18, 110], "คนของเจ้ากรมตรวจการขอดูบัญชีของจวนราชบุตรเขย ยังไม่มีข้อกล่าวหา แค่ขอดู", [
    K("เผาจดหมายที่ไม่ควรมีอยู่", "smarts", 50, act(G("ขี้เถ้าลงเตาไปก่อนรุ่งสาง", {}), (l) => heat(l, -25)), act(B("ควันไหม้ทำให้คนยิ่งสงสัย", {}), (l) => heat(l, 10))),
    K("ให้องค์หญิงช่วยพูด", "looks", 50, act(G("องค์หญิงเดินเข้าห้องทรงงานคนเดียว แล้วการตรวจก็จบลง", {}), (l) => heat(l, -30)), act(N("องค์หญิงบอกว่าเรื่องนี้ท่านต้องจัดการเอง", {}), (l) => shift(l, -4))),
    C("ทำตัวตามปกติ", N("คุณเลี้ยงนกต่อ และให้อาหารมันสองรอบโดยไม่รู้ตัว", {})),
  ], { when: (l) => isFuma(l) && schemeHeat(l) >= 40, weight: 18, maxTimes: 0, title: "มีคนกำลังสืบ" }),

  E("qn.pc_accused", [18, 110], (l) => `ฎีกากล่าวโทษราชบุตรเขยถูกอ่านกลางท้องพระโรง (ร่องรอย ${schemeHeat(l)})${l.flags.pcFell ? " ฮ่องเต้ไม่ทรงเงยพระพักตร์มองคุณเลย" : ""}`, [
    ...coverUp({
      clear: (l) => { delete l.flags.pcAccused; heat(l, -40); },
      caught: (l) => { if (l.flags.pcFell) { kill(l, "ถูกประหารข้อหากบฏในฐานะราชบุตรเขย"); return; } l.flags.pcFell = true; strip(l); },
    }),
  ], { when: (l) => isFuma(l) && !!l.flags.pcAccused, forced: true, maxTimes: 0, title: "ถูกกล่าวหา" }),

  E("qn.pc_new_reign", [20, 110], (l) => `ระฆังเก้าครั้งดังจากหอกลอง ${courtOf(l).emperor.name}ขึ้นครองราชย์ พี่น้องขององค์หญิงอาจไม่ต้องการราชบุตรเขยของรัชกาลก่อน`, [
    K("ถวายความภักดีต่อฮ่องเต้องค์ใหม่", "smarts", 50, act(G("คุณเป็นคนแรกที่คุกเข่า และคนใหม่จำได้", { fame: 2 }), (l) => { l.flags.pcEmp = courtOf(l).emperor.name; shift(l, 5); }), act(N("พระองค์รับฎีกาของคุณไว้โดยไม่อ่าน", {}), (l) => { l.flags.pcEmp = courtOf(l).emperor.name; shift(l, -15); })),
    C("ขอถอยไปอยู่จวนเงียบๆ", act(N("คุณคืนตราประจำตำแหน่ง องค์หญิงบอกว่านี่คือครั้งแรกที่นางเห็นคุณหายใจเต็มปอด", { joy: 6 }), (l) => { l.flags.pcEmp = courtOf(l).emperor.name; shift(l, -10); heat(l, -30); })),
  ], { when: (l) => isFuma(l) && !!l.flags.pcEmp && l.flags.pcEmp !== courtOf(l).emperor.name, forced: true, maxTimes: 0, title: "ผลัดแผ่นดิน" }),
];

yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || !isFuma(l)) return;
  shift(l, -3);
  addMoney(l, (pc(l) + 1) * 15 * TAEL);
  if (!princess(l)) { strip(l); log(l, "องค์หญิงสิ้นพระชนม์ ตำแหน่งราชบุตรเขยก็จบลงพร้อมกัน"); return; }
  const h = schemeHeat(l);
  if (h > 0) { if (chance(l, h / 240)) l.flags.pcAccused = true; heat(l, -5); }
});

export const fumaLine = (l: Life) => (isFuma(l) ? `${PC_RANKS[pc(l)]} · ไว้วางใจ ${trust(l)}` : "");

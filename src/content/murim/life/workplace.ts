// คนในที่ทำงาน: หัวหน้า เพื่อนร่วมงาน การขอเลื่อนตำแหน่ง และการเกษียณ
// งานเฉพาะอาชีพอยู่ที่ jobActions.ts · ไฟล์นี้คือเรื่องระหว่างคนกับคนในงานที่มีผู้บังคับบัญชา
import { timeLeft } from "../../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../../engine/events";
import { runEvent, salaryOf, yearHooks } from "../../../engine/game";
import { feel, relOf } from "../../../engine/npc";
import { randInt } from "../../../engine/rng";
import type { Life, Person } from "../../../engine/types";
import { addMoney, addStat, clamp, createPerson, log, money, shortName } from "../../../engine/util";
import { careerById } from "../../hunter/careers";
import { DARK_JOBS } from "../careers";
import { B, BIG, C, E, G, K, N, P, PAY, nm, who, withPerson, type Res } from "../story/kit";
import { plantSeed } from "./seedStore";

/** งานที่มีผู้บังคับบัญชา (ชาวนา พ่อค้าเร่ และงานคนเดียวไม่มี) */
const TEAM_JOBS = new Set(["escort", "official", "porter", "constable", "soldier", "waiter", "imperial_guard", "jinyiwei", "palace_physician", "bandit", "pirate", "cultist"]);
const ASK_WAIT = 2;

const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });
const perf = (l: Life, d: number) => { if (l.job) l.job.performance = clamp(l.job.performance + d, 0, 100); };
const tagged = (l: Life, t: string): Person | undefined => l.people.find((p) => p.alive && p.tags?.includes(t));
export const bossOf = (l: Life) => tagged(l, "boss");
export const mateOf = (l: Life) => tagged(l, "colleague");
const bond = (p: Person | undefined, d: number) => { if (p) p.bond = clamp(p.bond + d, 0, 100); };
const askReady = (l: Life) => l.age >= Number(l.flags.jbAskNext ?? 0);

/** โอกาสได้เลื่อนตำแหน่งเมื่อเอ่ยปากขอ: ผลงานคือหลัก หัวหน้าเป็นตัวช่วย */
export const askOdds = (l: Life) => clamp(0.05 + (l.job?.performance ?? 0) / 130 + (bossOf(l)?.bond ?? 30) / 300 + (l.stats.smarts - 50) / 300 - (l.job?.level ?? 1) * 0.05, 0.05, 0.9);

export interface WorkAction { id: string; label: string; locked?: string; run: (l: Life) => void }
export function workActions(l: Life): WorkAction[] {
  if (l.worldId !== "murim" || !l.job) return [];
  const out: WorkAction[] = [];
  const add = (id: string, label: string, eventId: string, pid: string) => {
    const left = timeLeft(l);
    const locked = l.doneThisYear.includes(`job:${id}`) ? "ปีนี้ทำไปแล้ว" : left !== undefined && left < 1 ? "ปีนี้ไม่มีเวลาเหลือ" : undefined;
    out.push({ id, label, locked, run: (x) => { x.doneThisYear.push(`job:${id}`); runEvent(x, eventId, { pid }); } });
  };
  const b = bossOf(l), m = mateOf(l);
  if (b) add("w_boss", `พบ${shortName(b)}`, "jb.w_boss", b.id);
  if (m) add("w_mate", `คุยกับ${shortName(m)}`, "jb.w_mate", m.id);
  return out;
}

/** สิ่งที่ต้องรู้เรื่องตำแหน่งถัดไป */
export function nextStep(l: Life): string | undefined {
  const j = l.job;
  if (!j) return;
  const c = careerById(j.careerId);
  if (!c) return;
  if (j.performance < 25) return `ผลงานต่ำมาก ถ้าต่ำกว่า 15 อาจถูกไล่ออก`;
  if (j.level >= 5) return "คุณอยู่ตำแหน่งสูงสุดของอาชีพนี้แล้ว";
  return `ต่อไป: ${c.titles[j.level]} · รายได้ ${money(l, salaryOf(l, c, j.level + 1))}/ปี · ผลงานถึง 80 มีโอกาสได้เลื่อนทุกปี`;
}

export const canRetire = (l: Life) => l.worldId === "murim" && !!l.job && l.age >= 55 && l.job.years >= 10 && !DARK_JOBS.has(l.job.careerId) && !l.flags.pension;
export const pensionOf = (l: Life) => { const c = l.job && careerById(l.job.careerId); return c ? Math.round(salaryOf(l, c, l.job!.level) * 0.3) : 0; };
export function retire(l: Life) {
  const c = careerById(l.job!.careerId)!;
  const amount = pensionOf(l);
  l.flags.pension = amount;
  log(l, `คุณวางมือจากตำแหน่ง${c.titles[l.job!.level - 1]}หลังทำงานมา ${l.job!.years} ปี ได้เบี้ยเลี้ยงปีละ ${money(l, amount)}`, "milestone");
  l.job = undefined;
  addStat(l, "happiness", 8);
}

const scene = (id: string, title: string, text: (l: Life, c: Ctx) => string, choices: Choice[]): GameEvent => ({ id, minAge: 10, maxAge: 120, manual: true, maxTimes: 0, title, text, choices });

export const WORKPLACE_EVENTS: GameEvent[] = [
  scene("jb.w_boss", "พบหัวหน้า", (l, c) => `${nm(l, c)}เงยหน้าจากโต๊ะ ผลงานของคุณตอนนี้ ${l.job?.performance ?? 0}`, [
    K("รายงานผลงานของปีนี้", "smarts", 45, act(G("คุณพูดสั้น ตัวเลขชัด หัวหน้าพยักหน้าครั้งเดียว", { feel: { respect: 4 } }), (l, c) => { perf(l, 8); bond(who(l, c), 4); }), N("หัวหน้าฟังไปครึ่งเดียวแล้วเรียกคนอื่นเข้ามา", {})),
    PAY("ส่งของกำนัลตามธรรมเนียม", 8, act(G("หัวหน้ารับไว้โดยไม่พูดอะไร ปีนี้งานดีๆ ผ่านมือคุณมากขึ้น", {}), (l, c) => { perf(l, 3); bond(who(l, c), 12); })),
    P("ขอเลื่อนตำแหน่งตรงๆ", askOdds, act(BIG((l) => { const t = careerById(l.job!.careerId)!.titles[l.job!.level]; return `หัวหน้าเงียบไปพักหนึ่ง แล้วเซ็นชื่อ ตั้งแต่พรุ่งนี้คุณคือ${t}`; }, { joy: 8 }), (l) => { l.flags.jbAskNext = l.age + ASK_WAIT; if (l.job) { l.job.level++; l.job.performance = 50; } }), act(B("\"ยังไม่ถึงเวลา\" ประตูปิดลง และคนข้างนอกได้ยินหมด", { joy: -3 }), (l, c) => { l.flags.jbAskNext = l.age + ASK_WAIT; perf(l, -5); bond(who(l, c), -8); }), { show: (l) => !!l.job && l.job.level < 5 && l.job.performance >= 50 && askReady(l) }),
    C("ทำงานต่อไปเงียบๆ", N("คุณคำนับแล้วกลับไปที่โต๊ะ", {})),
  ]),

  scene("jb.w_mate", "เพื่อนร่วมงาน", (l, c) => `${nm(l, c)}ยังทำงานอยู่ตอนคนอื่นกลับบ้านหมดแล้ว`, [
    C("ช่วยงานที่ค้างอยู่", act(G("งานเสร็จก่อนเที่ยงคืน เขาเลี้ยงข้าวต้มคุณหนึ่งชาม", { feel: { love: 4, trust: 6 } }), (l, c) => { perf(l, 2); bond(who(l, c), 10); })),
    K("เลื่อยขาเก้าอี้เขาต่อหน้าหัวหน้า", "smarts", 55, act(G("บัญชีที่ผิดพลาดถูกวางบนโต๊ะหัวหน้าในเช้าวันถัดมา เขาเก็บของออกไปโดยไม่รู้ว่าใครทำ", { align: -5 }), (l, c) => { const p = who(l, c); perf(l, 10); if (p) { plantSeed(l, "betrayed", shortName(p), p.id); p.tags = (p.tags ?? []).filter((t) => t !== "colleague" && !t.startsWith("title:")); } }), act(B("หัวหน้าถามว่าทำไมคุณรู้เรื่องนี้ดีนัก", { align: -3, feel: { grudge: 30, trust: -20 } }), (l) => { perf(l, -10); bond(bossOf(l), -10); }), { tone: "danger" }),
    C("ปล่อยเขาไว้แล้วกลับบ้าน", N("คุณผ่านโต๊ะเขาไปโดยไม่พูดอะไร", {})),
  ]),

  E("jb.w_credit", [16, 80], (l, c) => `งานที่คุณทำมาทั้งฤดูถูกเสนอขึ้นไปในชื่อของ${nm(l, c)} ข้างบนชมเขาเสียงดัง`, [
    C("ยอมเงียบไว้", act(N("คุณกลับไปทำงาน หัวหน้าไม่มองหน้าคุณไปหลายวัน", { joy: -3 }), (l, c) => bond(who(l, c), 8))),
    K("ทวงความดีความชอบต่อหน้าทุกคน", "looks", 55, act(G("คุณเล่าขั้นตอนงานได้ละเอียดจนทุกคนเข้าใจตรงกัน", { fame: 2 }), (l, c) => { perf(l, 10); bond(who(l, c), -15); }), act(B("หัวหน้ายิ้มแล้วถามว่าคุณกล่าวหาเขาหรือ", {}), (l, c) => { perf(l, -8); bond(who(l, c), -10); })),
    P("แอบส่งหลักฐานถึงคนที่อยู่เหนือหัวหน้า", (l) => clamp(0.35 + (l.stats.smarts - 50) / 150, 0.05, 0.85), act(G("หัวหน้าถูกย้ายไปด่านชายแดน ที่ว่างตรงนั้นทำให้ทุกคนหันมามองคุณ", { align: -2 }), (l, c) => { perf(l, 15); const p = who(l, c); if (p) p.tags = (p.tags ?? []).filter((t) => t !== "boss" && !t.startsWith("title:")); }), act(B("จดหมายย้อนกลับมาถึงมือหัวหน้า", { feel: { grudge: 40 } }), (l) => perf(l, -15)), { tone: "danger" }),
  ], { ...withPerson(["friend"], (p) => !!p.tags?.includes("boss")), weight: 5, maxTimes: 3, title: "ผลงานของใคร" }),

  E("jb.w_cover", [16, 80], (l, c) => `คุณทำงานพลาดชิ้นหนึ่ง ก่อนหัวหน้าจะรู้ ${nm(l, c)}เดินเข้ามาพูดเบาๆ ว่าเขาเก็บให้แล้ว`, [
    C("ขอบคุณและจำไว้", G("คุณเลี้ยงเหล้าเขาหนึ่งมื้อ และรู้ว่าติดหนี้เขาอีกหนึ่งครั้ง", { feel: { debt: 15, trust: 6 } })),
    C("ไปสารภาพกับหัวหน้าเอง", act(G("หัวหน้าประหลาดใจ คนแบบนี้หายากในที่ทำงาน", { align: 3 }), (l) => { perf(l, 4); bond(bossOf(l), 6); })),
  ], { ...withPerson(["friend"], (p) => !!p.tags?.includes("colleague") && p.bond >= 50), weight: 4, maxTimes: 3, title: "คนที่หลังบ้าน" }),

  E("jb.w_race", [16, 80], (l, c) => `ตำแหน่งเดียวว่างลง ชื่อคุณกับ${nm(l, c)}อยู่ในรายชื่อสองคนสุดท้าย`, [
    K("ทำงานให้ดีกว่าเขา", "smarts", 55, act(G("ผลงานของคุณพูดแทนคุณเอง", {}), (l) => perf(l, 12)), N("ปีนี้เขาทำได้ดีกว่าจริงๆ", { joy: -2 })),
    C("เสนอให้เขาไปก่อน", act(G("เขามองคุณนาน แล้วจับมือคุณแน่น", { feel: { love: 8, debt: 25 } }), (l) => perf(l, -5))),
  ], { ...withPerson(["friend"], (p) => !!p.tags?.includes("colleague")), weight: 4, maxTimes: 2, title: "ที่นั่งเดียว" }),
];

function hire(l: Life, role: "boss" | "colleague") {
  const c = careerById(l.job!.careerId)!;
  const age = role === "boss" ? Math.max(l.age + randInt(l, 4, 16), 30) : Math.max(18, l.age + randInt(l, -4, 4));
  const p = createPerson(l, "friend", { age, bond: role === "boss" ? 35 : 40, job: c.name });
  p.tags = [...(p.tags ?? []), role, `title:${role === "boss" ? "หัวหน้างาน" : "เพื่อนร่วมงาน"}`];
  void relOf(p);
  if (role === "boss") feel(p, { respect: 5 });
}

yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive) return;
  if (l.flags.pension) addMoney(l, Number(l.flags.pension));
  const here = l.job?.careerId;
  if (l.flags.jbCareer !== undefined && l.flags.jbCareer !== here) {
    // เปลี่ยนงาน: คนที่สนิทยังเป็นเพื่อน คนที่เหลือหายไปจากชีวิต
    l.people = l.people.filter((p) => !(p.alive && (p.tags?.includes("boss") || p.tags?.includes("colleague")) && p.bond < 55));
    for (const p of l.people) if (p.tags?.includes("boss") || p.tags?.includes("colleague")) p.tags = p.tags.filter((t) => t !== "boss" && t !== "colleague" && !t.startsWith("title:"));
    delete l.flags.jbCareer;
  }
  if (!here || !TEAM_JOBS.has(here) || (l.job?.years ?? 0) < 1) return;
  l.flags.jbCareer = here;
  if (!bossOf(l)) hire(l, "boss");
  if (!mateOf(l)) hire(l, "colleague");
});

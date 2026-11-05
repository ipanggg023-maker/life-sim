// แท็บพลัง: พลังที่เกิดจากตัวตน · นิสัยที่เด่นให้แง่มุมของพลัง · ปณิธานที่ทุกทางเลือกรักษาหรือทำลายได้
// การทะลวงขั้นมีทางของแต่ละนิสัย · ท่าประจำตัวตั้งชื่อตามคนที่คุณเป็น
import type { Choice, GameEvent } from "../../engine/events";
import { getEvent } from "../../engine/events";
import { choiceHooks, runEvent, yearHooks } from "../../engine/game";
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Life } from "../../engine/types";
import { addStat, log } from "../../engine/util";
import { tagged } from "./conseq";
import { B, BIG, C, N, P, SCENE } from "./kit";
import { personaOf, tr, type Axis } from "./persona";
import { BODY_RANKS, MAGIC_RANKS, MASTER, breakOdds, combatHooks, needXp, safetyHooks } from "./power";
import { spread } from "./rumors";
import { addStanding, deed, fl } from "./state";

// ── แง่มุมของพลังจากนิสัย ──
export interface Aspect { axis: Axis; dir: 1 | -1; name: string; desc: string; fight: number; safety: number }
export const ASPECTS: Aspect[] = [
  { axis: "m", dir: 1, name: "โล่แห่งเมตตา", desc: "สู้เพื่อปกป้อง จึงรอดง่ายกว่า", fight: 2, safety: 0.85 },
  { axis: "m", dir: -1, name: "คมไร้ปรานี", desc: "ไม่ลังเลที่จะจบศัตรู", fight: 6, safety: 1 },
  { axis: "h", dir: 1, name: "ใจไม่หวั่น", desc: "ไม่มีอะไรต้องซ่อน มือจึงนิ่ง", fight: 3, safety: 0.95 },
  { axis: "h", dir: -1, name: "เล่ห์กลกลางศึก", desc: "หลอกล่อ ลวงตา แทงข้างหลัง", fight: 5, safety: 1 },
  { axis: "c", dir: 1, name: "ใจสิงห์", desc: "พุ่งเข้าหาโดยไม่ถอย", fight: 6, safety: 1.05 },
  { axis: "c", dir: -1, name: "สัญชาตญาณเอาตัวรอด", desc: "รู้ว่าเมื่อไรควรถอย", fight: 0, safety: 0.8 },
  { axis: "f", dir: 1, name: "แสงศรัทธา", desc: "เทพคุ้มครองคนที่ไม่เคยทิ้งเทพ", fight: 3, safety: 0.9 },
  { axis: "f", dir: -1, name: "พลังนอกรีต", desc: "ใช้ทุกพลังที่หยิบได้ ไม่สนว่ามาจากไหน", fight: 5, safety: 1 },
];
export const ASPECT_AT = 45;
export const ASPECT_CAP = 12;
const STRONG_AT = 75;
export const aspectsOf = (l: Life) => ASPECTS.filter((a) => tr(l, a.axis) * a.dir >= ASPECT_AT);
const strong = (l: Life, a: Aspect) => tr(l, a.axis) * a.dir >= STRONG_AT;

// ── ปณิธาน: ถือได้ทีละข้อ · ทางเลือกที่ขัดกับปณิธานทำลายมันทันที ──
export interface Vow { id: string; name: string; axis: Axis; dir: 1 | -1; desc: string; fight: number; safety: number; breakAt: number }
export const VOWS: Vow[] = [
  { id: "no_kill", name: "ปณิธานไม่พรากชีวิต", axis: "m", dir: 1, desc: "รอดง่ายขึ้นมาก ความสุขทุกปี", fight: 0, safety: 0.75, breakAt: 6 },
  { id: "no_lie", name: "ปณิธานไม่โกหก", axis: "h", dir: 1, desc: "ชื่อเสียงในแผ่นดินดีขึ้นทุกปี · พลังต่อสู้ +3", fight: 3, safety: 1, breakAt: 5 },
  { id: "no_retreat", name: "ปณิธานไม่ถอย", axis: "c", dir: 1, desc: "พลังต่อสู้ +8 แต่เสี่ยงกว่าเดิม", fight: 8, safety: 1.1, breakAt: 4 },
  { id: "serve_gods", name: "ปณิธานรับใช้เทพ", axis: "f", dir: 1, desc: "พลังต่อสู้ +4 · เทพคุ้มครอง", fight: 4, safety: 0.9, breakAt: 5 },
  { id: "no_gods", name: "ปณิธานไม่คุกเข่าต่อเทพ", axis: "f", dir: -1, desc: "พลังต่อสู้ +5 · พลังเวทโตเร็วขึ้นทุกปี", fight: 5, safety: 1, breakAt: 5 },
];
export const vowOf = (l: Life) => VOWS.find((v) => v.id === fl(l).vow?.id);
const brokeRecently = (l: Life, id: string) => fl(l).vowBroke?.id === id && l.age - fl(l).vowBroke!.age < 5;
function breakVow(l: Life, v: Vow) {
  const f = fl(l);
  f.vowBroke = { id: v.id, age: l.age };
  (f.vowLog ??= []).push({ age: l.age, text: `ผิด${v.name}` });
  f.vow = undefined;
  addStat(l, "happiness", -8);
  spread(l, `ผิด${v.name}ที่ตั้งไว้ต่อหน้าทุกคน`, -1, 40);
  log(l, `คุณทำลาย${v.name}ด้วยมือตัวเอง พลังที่มากับปณิธานหายไปพร้อมความภูมิใจ`, "bad");
}

// ── ท่าประจำตัว: ตั้งชื่อเมื่อถึงขั้นสาม ตามนิสัยที่เด่นที่สุด ──
const SIG_WORD: Record<Axis, [string, string]> = { m: ["พิทักษ์", "โลหิต"], h: ["ตรงดิ่ง", "ลวงตา"], c: ["พายุ", "เงา"], f: ["อรุณ", "นอกรีต"] };
function signatureName(l: Life) {
  const p = personaOf(l);
  const k = (["m", "h", "c", "f"] as Axis[]).sort((a, b) => Math.abs(p[b]) - Math.abs(p[a]))[0];
  const word = Math.abs(p[k]) >= 20 ? SIG_WORD[k][p[k] >= 0 ? 0 : 1] : "ไร้นาม";
  const f = fl(l);
  const kind = f.magicRank > f.bodyRank ? "เวท" : "ดาบ";
  return `${kind}${word}แห่ง${l.firstName}`;
}
export const signatureBonus = (l: Life) => { const s = fl(l).signature; return s ? (s.tier >= 2 ? 7 : 3) : 0; };

// ── ทางทะลวงขั้นของแต่ละนิสัย ──
export function broke(l: Life, track: "body" | "magic") {
  const f = fl(l);
  if (track === "body") { f.bodyRank++; f.body = 0; if (f.bodyRank >= 3) deed(l, `ยอดฝีมือระดับ${BODY_RANKS[f.bodyRank]}`); return `คุณเป็น${BODY_RANKS[f.bodyRank]}แล้ว`; }
  f.magicRank++; f.magic = 0; if (f.magicRank >= 3) deed(l, `ถึงระดับ${MAGIC_RANKS[f.magicRank]}`); if (f.magicRank === 3 && !f.wand) l.flags.wandless = true;
  return `คุณเป็น${MAGIC_RANKS[f.magicRank]}แล้ว`;
}
export const failBreak = (track: "body" | "magic", hp: number) => B("กำแพงยังไม่ยอมแตก คุณต้องสะสมใหม่บางส่วน", { hp: -hp }, (l) => { const f = fl(l); if (track === "body") f.body = Math.round(needXp(f.bodyRank) * 0.6); else f.magic = Math.round(needXp(f.magicRank) * 0.6); });
const way = (track: "body" | "magic", axis: Axis, min: number, label: string, bonus: number, ok: string, extra: { hp?: number; lean?: Partial<Record<Axis, number>> } = {}): Choice => ({
  ...tagged(P(label, (l) => breakOdds(l, track) + bonus, BIG((l) => `${ok} ${broke(l, track)}`, { joy: 6, fame: 2, hp: -(extra.hp ?? 0) }), failBreak(track, 8 + (extra.hp ?? 0))), extra.lean ?? {}),
  show: (l) => (min > 0 ? tr(l, axis) >= min : tr(l, axis) <= min), tone: "special",
});
const BREAK_WAYS: Record<string, Choice[]> = {
  "ft.break_body": [
    way("body", "c", 40, "สู้กับเงาของตัวเองจนกว่าจะชนะ", 0.12, "เงาของคุณคุกเข่าลงก่อน", { lean: { c: 2 } }),
    way("body", "m", 40, "นึกถึงคนที่อยากปกป้องแล้วฝ่ากำแพง", 0.1, "ใบหน้าของคนที่คุณรักลอยอยู่ตรงหน้าจนกำแพงแตก", { lean: { m: 2 } }),
    way("body", "h", -40, "กลืนยาเม็ดต้องห้ามจากตลาดมืด", 0.22, "ยาเผาเส้นเลือดเหมือนไฟ แต่กำแพงก็พังลง", { hp: 10, lean: { h: -2 } }),
    way("body", "f", 40, "สวดขอพรจากเทพแห่งสงครามก่อนทะลวง", 0.08, "เสียงกลองศักดิ์สิทธิ์ดังในหัว", { lean: { f: 2 } }),
  ],
  "ft.break_magic": [
    way("magic", "f", -40, "ดึงพลังจากตำราต้องห้ามมาเปิดวงเวท", 0.2, "ตัวอักษรต้องห้ามลุกเป็นไฟ วงเวทเปิดออก", { hp: 8, lean: { f: -2 } }),
    way("magic", "f", 40, "ภาวนาให้เทพนำทางมานา", 0.1, "แสงอุ่นไหลผ่านมือคุณ", { lean: { f: 2 } }),
    way("magic", "c", 40, "เปิดวงเวทกลางพายุฝนเพื่อดึงมานาจากฟ้า", 0.12, "ฟ้าผ่าลงกลางวงเวทของคุณพอดี", { hp: 5, lean: { c: 2 } }),
    way("magic", "m", 40, "นั่งสมาธิจนใจสงบเหมือนน้ำนิ่ง", 0.08, "มานาไหลเข้ามาเองเมื่อคุณหยุดไขว่คว้า", { lean: { m: 1 } }),
  ],
};

export const VOW_SCENE: GameEvent = SCENE("ft.vw.take", "ตั้งปณิธาน", (l) => (vowOf(l) ? `คุณถือ${vowOf(l)!.name}มาตั้งแต่อายุ ${fl(l).vow!.age} ปี` : "คุณยืนอยู่หน้าแท่นบูชาเก่า ปณิธานที่ตั้งไว้ที่นี่จะให้พลัง ตราบที่คุณไม่ทำลายมันเอง"), [
  ...VOWS.map((v): Choice => ({ ...C(`${v.name} · ${v.desc}`, BIG(`คุณสาบานต่อหน้าแท่นบูชา ${v.name}เริ่มนับตั้งแต่วันนี้`, { joy: 3 }, (l) => { fl(l).vow = { id: v.id, age: l.age }; (fl(l).vowLog ??= []).push({ age: l.age, text: `ตั้ง${v.name}` }); spread(l, `ตั้ง${v.name}`, 1, 25); })), show: (l) => !vowOf(l), req: (l) => (brokeRecently(l, v.id) ? "เพิ่งผิดปณิธานนี้ ต้องรออีกหลายปี" : tr(l, v.axis) * v.dir < 0 ? "นิสัยของคุณยังไปทางตรงข้าม" : undefined) })),
  { ...C("ถอนปณิธานที่ถืออยู่", N("คุณถอนคำสาบานอย่างเงียบๆ ไม่มีใครตำหนิ แต่พลังนั้นก็จากไป", { joy: -2 }, (l) => { fl(l).vow = undefined; })), show: (l) => !!vowOf(l) },
  C("ยังไม่ตั้ง", N("แท่นบูชาจะรออยู่ที่นี่")),
]);
export const POWER_EVENTS: GameEvent[] = [VOW_SCENE];

export function loadPowerplus() {
  ACTIVITIES.push(VOW_ACTIVITY);
  combatHooks.push((l) => {
    if (!l.ft) return [];
    // แง่มุมจากนิสัยรวมกันไม่เกินสิบสอง · นิสัยสุดขั้วทุกทางไม่ทำให้ไร้เทียมทาน
    let room = ASPECT_CAP;
    const out: [string, number][] = [];
    for (const a of aspectsOf(l)) { const v = Math.min(room, strong(l, a) ? Math.round(a.fight * 1.5) : a.fight); room -= v; if (v) out.push([a.name, v]); }
    const v = vowOf(l);
    if (v?.fight) out.push([v.name, v.fight]);
    const s = fl(l).signature;
    if (s) out.push([s.name, signatureBonus(l)]);
    return out;
  });
  safetyHooks.push((l) => (l.ft ? Math.max(0.7, aspectsOf(l).reduce((m, a) => m * a.safety, 1) * (vowOf(l)?.safety ?? 1)) : 1));
  // ปณิธานแตกเมื่อเลือกทางที่ขัดกับมันชัดเจน
  choiceHooks.push((l, c) => {
    if (l.worldId !== "fantasy" || !l.ft || !c.lean) return;
    const v = vowOf(l);
    if (v && (c.lean[v.axis] ?? 0) * v.dir <= -v.breakAt) breakVow(l, v);
  });
  for (const [id, ways] of Object.entries(BREAK_WAYS)) getEvent(id)?.choices?.push(...ways);
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive) return;
    const f = fl(l), v = vowOf(l);
    if (v) {
      if (v.id === "no_kill") addStat(l, "happiness", 2);
      if (v.id === "no_lie") addStanding(l, 1);
      if (v.id === "no_gods") f.magic += 4;
      const years = l.age - f.vow!.age;
      if (years > 0 && years % 10 === 0) { deed(l, `ผู้รักษา${v.name}มา ${years} ปี`); log(l, `คุณรักษา${v.name}มาครบ ${years} ปีแล้ว`, "milestone"); }
    }
    const top = Math.max(f.bodyRank, f.magicRank);
    if (top >= 3 && !f.signature) { f.signature = { name: signatureName(l), tier: 1 }; log(l, `ท่าประจำตัวของคุณเกิดขึ้นเอง ผู้คนเรียกมันว่า "${f.signature.name}"`, "milestone"); }
    else if (f.signature && f.signature.tier < 2 && top > MASTER) { f.signature.tier = 2; log(l, `"${f.signature.name}" ไปถึงขั้นตำนาน ไม่มีใครเลียนแบบได้อีก`, "milestone"); }
  });
}

/** ปุ่มตั้งปณิธานในแท็บทำ */
export const VOW_ACTIVITY: Activity = { world: "fantasy", group: "ฝึกฝน", id: "ft_vow", emoji: "", name: "ตั้งปณิธาน", desc: "พลังจากคำสาบาน · ทางเลือกที่ขัดกับมันจะทำลายมัน", minAge: 14, time: 0, run: (l) => { runEvent(l, "ft.vw.take"); return { text: "" }; } };

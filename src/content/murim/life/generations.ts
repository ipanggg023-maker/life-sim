// Phase 7 — การเล่นข้ามรุ่นและบันทึกยุทธภพ (MURIM_PLAN §9 · §18.9 · MURIM_EXPANSION §12)
// โลกจำ: สำนัก ราชสำนัก ยุค วิกฤต ส่งต่อไปยังรุ่นถัดไป · สิ่งที่ส่งต่อได้: เงิน ตำรา วิชาที่สอนไว้ อาวุธประจำตระกูล สำนัก ความแค้น บุญคุณ เป้าหมายที่ค้าง
// สิ่งที่ไม่ส่งต่อ: ความชำนาญทั้งหมด ความสัมพันธ์ส่วนตัว ความภักดีของศิษย์ ตำแหน่งที่ต้องได้รับการยอมรับ
import type { GameEvent } from "../../../engine/events";
import { createLife } from "../../../engine/game";
import { feel, relOf, remember } from "../../../engine/npc";
import { pick, randInt } from "../../../engine/rng";
import type { Life, Person, Soul } from "../../../engine/types";
import { addFame, createPerson, displayName, log, money, people, shortName } from "../../../engine/util";
import { awaken, rankLabel } from "../../hunter/power";
import { addQi, artInfo, artsOf, learn } from "../martial/arts";
import { mySect, saveSect } from "../m17core";
import { courtOf } from "../world/court";
import { factions } from "../world/factions";
import { goalById, setGoal } from "./goals";
import { ERA, calYear, CRISIS } from "./world";
import { B, BIG, C, E, G, N, flagged } from "../story/kit";

// ───────── บันทึกยุทธภพ (ข้ามชีวิต — เก็บในวิญญาณ) ─────────

export interface ChronEntry {
  year: number;
  /** ชีวิต · โลก · ตำนาน */
  kind: "life" | "world" | "legend";
  text: string;
  /** แหล่งที่มาของบันทึก (ใครเล่า/ใครจด) */
  src: string;
}

const pushC = (s: Soul, e: ChronEntry) => {
  const list = (s.chronicle ??= []);
  if (list.some((x) => x.year === e.year && x.text === e.text)) return;
  list.push(e);
  list.sort((a, b) => a.year - b.year);
  if (list.length > 300) list.splice(0, list.length - 300);
};

/** จดชีวิตที่เพิ่งจบ + เหตุการณ์โลกในช่วงชีวิตนั้น ลงบันทึกยุทธภพ */
export function recordChronicle(s: Soul, l: Life) {
  if (l.worldId !== "murim") return;
  const born = l.birthYear, died = l.birthYear + l.age;
  const realm = l.power ? `ฝีมือขั้น${rankLabel(l, l.power.rank)}` : "คนธรรมดาที่ไม่เคยฝึกวิชา";
  const epithet = l.flags.m17Epithet ? `ฉายา「${l.flags.m17Epithet}」` : "";
  const won = (l.goals ?? []).filter((g) => g.end === "won").map((g) => goalById(g.id)?.name).filter(Boolean);
  const sect = mySect(l);
  pushC(s, {
    year: died,
    kind: l.flags.ascended || l.flags.foundedDynasty || l.flags.heavenlyDemon || l.flags.slewDemonLord ? "legend" : "life",
    text: `${displayName(l)} ${epithet} (${born}–${died}) ${realm}${sect ? ` ผู้ก่อตั้ง「${sect.n}」` : ""}${won.length ? ` · ทำสำเร็จ: ${won.join(", ")}` : ""} — ${l.causeOfDeath ?? "จากไป"}`,
    src: l.flags.ascended ? "ตำนานบนยอดเขา" : sect ? "ทะเบียนสำนัก" : "ป้ายวิญญาณในหอบรรพชน",
  });
  if (l.flags.foundedDynasty) pushC(s, { year: died, kind: "legend", text: `${displayName(l)} ตั้งราชวงศ์ใหม่ขึ้นปกครองแผ่นดิน`, src: "พงศาวดารหลวง" });
  if (l.flags.heavenlyDemon) pushC(s, { year: died, kind: "legend", text: `${displayName(l)} เคยเป็นมารสวรรค์ ประมุขลัทธิมาร`, src: "คำเล่าลือของสาวกมาร" });
  if (l.flags.slewDemonLord) pushC(s, { year: died, kind: "legend", text: `${displayName(l)} สังหารจอมมารที่หุบเขาเมฆดำ`, src: "ศิลาจารึกพันธมิตรยุทธจักร" });
  for (const r of courtOf(l).reigns.filter((x) => x.to >= born && x.to <= died)) pushC(s, { year: r.to, kind: "world", text: `${r.name}สวรรคต — ${r.how}`, src: "พงศาวดารหลวง" });
  for (const c of (l.mw?.past ?? []).filter((x) => x.year >= born && x.year <= died)) pushC(s, { year: c.year, kind: "world", text: `${CRISIS[c.id].name}`, src: "บันทึกอำเภอ" });
  for (const f of factions(l).filter((x) => x.status === "fallen")) pushC(s, { year: died, kind: "world", text: `${f.name}ล่มสลาย`, src: "ข่าวยุทธภพ" });
}

// ───────── ส่งต่อโลกและมรดก ─────────

/** ให้รุ่นต่อไปอยู่ในโลกเดิม: ยุค สำนัก ราชสำนัก (ถ้าข้ามไปหลายปี เดินเวลาโลกแบบย่อ) */
export function carryWorld(dead: Life, next: Life, yearsLater: number) {
  if (!dead.mw) return;
  next.mw = structuredClone(dead.mw);
  if (yearsLater <= 0) return;
  const w = next.mw;
  for (const f of w.fx ?? []) {
    f.leaderAge += yearsLater;
    if (f.leaderAge > 75) { f.leader = `${pick(next, ["ซ่ง", "หลิว", "เยี่ยน", "ไป๋", "ฉิน"])}${pick(next, ["เจิ้นหลง", "อวิ๋นเฟิง", "เส้าหัว", "ชิงหาน"])}`; f.leaderAge = randInt(next, 40, 60); }
    f.power = Math.max(0, Math.min(100, f.power + randInt(next, -20, 20)));
    f.rep = Math.round(f.rep * 0.3); // คนรุ่นใหม่ไม่ได้รู้จักคุณ
  }
  if (w.court) {
    w.court.emperor.age += yearsLater;
    if (w.court.emperor.age > 70) {
      const yr = calYear(dead);
      w.court.reigns.push({ name: w.court.emperor.name, from: w.court.emperor.since, to: yr + randInt(next, 1, yearsLater), how: "สวรรคตตามพระชนมายุ" });
      w.court.emperor = { name: `ฮ่องเต้${pick(next, ["ไท่ชาง", "เจิ้งเต๋อ", "อวี้หมิง", "เสียนฟง"])}`, age: randInt(next, 25, 50), temper: pick(next, ["wise", "tyrant", "puppet", "paranoid"] as const), health: 80, since: yr + yearsLater - randInt(next, 0, 10) };
      w.court.heir = undefined;
      w.court.regent = undefined;
    }
  }
  w.era = pick(next, ["peace", "decline", "chaos", "recovery"] as const);
  w.eraSince = next.birthYear;
  w.crisis = undefined;
}

/** มรดกของยุทธภพ (เรียกหลังสร้างชีวิตรุ่นถัดไป) */
export function inheritMurim(dead: Life, next: Life, how: "heir" | "disciple" | "era", pid?: string) {
  if (dead.worldId !== "murim") return;
  carryWorld(dead, next, how === "era" ? next.birthYear - (dead.birthYear + dead.age) : 0);
  const heir = pid ? dead.people.find((p) => p.id === pid) : undefined;
  // วิชาที่สอนไว้ (ป้ายศิลปะ art:id บนตัวลูก/ศิษย์) — ไม่ได้ความชำนาญมาทั้งหมด
  const taught = (heir?.tags ?? []).filter((t) => t.startsWith("art:")).map((t) => t.slice(4));
  for (const id of taught) { learn(next, id, how === "disciple" ? "อาจารย์" : "ตำราประจำตระกูล", true); const k = artsOf(next).find((a) => a.id === id); if (k) k.m = 35; }
  // ตำราที่เขียนไว้ (ถ้ารุ่นใหม่เป็นลูก/ศิษย์ ได้รับโดยตรง · ถ้าฝังไว้ รุ่นหลังต้องตามหา)
  const best = artsOf(dead).slice().sort((a, b) => b.m - a.m)[0];
  if (best) {
    next.flags.plArt = best.id;
    next.flags.plArtName = artInfo(best).name;
    if (dead.flags.wroteManual && !dead.flags.buriedManual && how !== "era") learn(next, best.id, "ตำราประจำตระกูล", true);
    if (dead.flags.buriedManual) next.flags.plBuried = true;
  }
  // อาวุธ/ของประจำตระกูล
  const heirloom = dead.power?.items.find((i) => /กระบี่|ดาบ|ทวน|พิณ/.test(i));
  if (heirloom && how !== "era") next.flags.heirloom = heirloom;
  // สำนัก: ทายาท/ศิษย์ที่ถูกเลือกได้สืบทอดสำนัก (ความภักดีของศิษย์ไม่ตามมาทั้งหมด)
  const sect = mySect(dead);
  if (sect && how !== "era" && (how === "disciple" || dead.flags.heirId === pid || !dead.flags.heirId)) {
    saveSect(next, { ...sect, d: Math.max(1, Math.round(sect.d * 0.6)), r: Math.max(5, sect.r - 15) });
    next.flags.inheritedSect = sect.n;
  }
  // ความแค้นและบุญคุณ ข้ามรุ่น
  const foes = dead.people.filter((p) => p.alive && relOf(p).grudge >= 50).slice(0, 2);
  for (const f of foes) {
    const np = createPerson(next, "rival", { age: Math.max(10, next.age + randInt(next, -5, 5)), bond: 10 });
    np.tags = ["blood_feud", `feud_of:${shortName(f)}`];
    remember(next, np, "feud", `ความแค้นของตระกูลต่อ${displayName(dead)}`, 3, { grudge: 45 });
  }
  const debtors = dead.people.filter((p) => p.alive && relOf(p).debt >= 50 && p.relation !== "child").slice(0, 2);
  for (const d of debtors) {
    const np = createPerson(next, "friend", { age: Math.max(10, d.age - randInt(next, 20, 30)), bond: 50 });
    np.tags = ["family_debt", `debt_of:${shortName(d)}`];
    feel(np, { debt: 40, loyalty: 15 });
  }
  // เป้าหมายล้างแค้นที่ค้าง ส่งต่อให้ลูก/ศิษย์
  const open = dead.goals?.find((g) => !g.end && g.id === "revenge");
  if (open && how !== "era") next.flags.plRevenge = displayName(dead);
  next.flags.plName = displayName(dead);
  next.flags.plHow = how;
  if (dead.flags.m17Epithet) next.flags.plEpithet = String(dead.flags.m17Epithet);
}

// ───────── เล่นต่อเป็นศิษย์ ─────────

export const disciplesOf = (dead: Life): Person[] => dead.people.filter((p) => p.alive && p.tags?.includes("disciple") && p.age >= 12);

export function buildDisciple(dead: Life, pid: string): Life {
  const d = dead.people.find((p) => p.id === pid)!;
  const life = createLife({
    seed: (dead.seed ^ pid.length * 2654435761) >>> 0,
    worldId: "murim",
    worldSeed: dead.worldSeed,
    birthYear: dead.birthYear + dead.age - d.age,
    gender: d.gender,
    firstName: d.name,
    lastName: "",
    wealth: "poor",
  });
  life.id = `${dead.id}d${d.id}`;
  life.age = d.age;
  life.flags.startAge = d.age;
  life.flags.awakenDone = true;
  life.flags.generation = Number(dead.flags.generation ?? 1) + 1;
  life.people = [{ id: `m${dead.id}`, name: displayName(dead), gender: dead.gender, relation: "ally", age: dead.age, bond: d.bond, alive: false, tags: ["master"] }];
  life.money = Math.round(Math.max(0, dead.money) * 0.1);
  life.fame = Math.round(dead.fame * 0.15);
  // ศิษย์ที่ฝึกกับอาจารย์มาแล้ว: ฝีมือต่ำกว่าอาจารย์สองขั้น ลมปราณตามวัยที่ฝึก
  const rank = Math.max(1, Math.min(3, (dead.power?.rank ?? 2) - 2));
  awaken(life, rank, dead.power?.hunterClass ?? "m_sword");
  life.flags.mwRoot = Math.max(1, Math.min(4, rank + randInt(life, 0, 1)));
  addQi(life, Math.max(3, (d.age - 10) * 0.8));
  life.log = [];
  log(life, `คุณคือ ${displayName(life)} อายุ ${life.age} ปี ศิษย์ของ${displayName(dead)} ผู้เพิ่งจากไป — ทุกสิ่งที่อาจารย์สอน ตอนนี้อยู่ในมือคุณ`, "milestone");
  inheritMurim(dead, life, "disciple", pid);
  return life;
}

// ───────── เรื่องของรุ่นต่อไป: โลกจำคนรุ่นก่อน ─────────

export const GENERATION_EVENTS: GameEvent[] = [
  E("gen.storyteller", [8, 80], (l) => `นักเล่านิทานในโรงน้ำชากำลังเล่าเรื่อง "${l.flags.plEpithet ? `【${l.flags.plEpithet}】` : ""}${l.flags.plName}" — ${pick(l, ["ว่ากันว่าฟันโจรร้อยคนด้วยกระบี่เล่มเดียว", "ว่ากันว่าไม่เคยแพ้ใครเลยสักครั้ง", "ว่ากันว่าร้องไห้ให้ศัตรูทุกคนที่ฆ่า"])} คนทั้งร้านฟังอย่างตั้งใจ — คุณรู้ว่าเรื่องจริงไม่ได้เป็นแบบนั้นทั้งหมด`, [
    C("แก้เรื่องให้ถูกต้อง", G("คนทั้งร้านหันมามอง — นักเล่านิทานยิ้ม แล้วขอให้คุณเล่าเรื่องจริงแทน คืนนั้นคุณกลายเป็นคนที่เล่าเรื่องได้ดีที่สุดในเมือง", { fame: 2 })),
    C("ฟังเงียบๆ จนจบ", N("ตำนานโตเกินความจริงไปมากแล้ว — และบางทีนั่นอาจเป็นสิ่งที่ตำนานควรเป็น", { joy: 2 })),
  ], { when: flagged("plName"), weight: 6, title: "ตำนานในโรงน้ำชา" }),
  E("gen.buried_manual", [14, 80], (l) => `ชาวบ้านขุดพบหีบเหล็กใต้ต้นท้อแก่บนเขา สลักชื่อ "${l.flags.plName}" — ข่าวลือว่าข้างในคือคัมภีร์${l.flags.plArtName ? `「${l.flags.plArtName}」` : ""}กำลังแพร่ไปทั่วยุทธภพ`, [
    C("รีบไปก่อนคนอื่น", (l, c) => (l.flags.plArt ? BIG(`คุณไปถึงก่อนสำนักใหญ่สามสำนัก — คัมภีร์ที่คนรุ่นก่อนฝังไว้ ตกอยู่ในมือคุณ${learn(l, String(l.flags.plArt), "ตำรา", true)}`, { flag: "foundAncestorManual" }) : N("หีบว่างเปล่า — มีคนมาก่อนคุณ"))(l, c)),
    C("ปล่อยให้คนอื่นแย่งกัน", N("สามสำนักฆ่ากันตายเพื่อหีบใบนั้น — คุณดื่มชาดูข่าวอยู่ที่โรงเตี๊ยม")),
  ], { when: (l) => !!l.flags.plBuried && !l.flags.foundAncestorManual, weight: 5, title: "หีบใต้ต้นท้อ" }),
  E("gen.tomb", [10, 90], (l) => `คุณเดินผ่านสุสานเก่า — หลุมศพของ${l.flags.plName}รกไปด้วยหญ้า ป้ายเอียงจะล้มแหล่มิล้มแหล่`, [
    C("ถอนหญ้า ซ่อมป้าย จุดธูป", G("ลมพัดเบาๆ ใบท้อร่วงลงบนป้าย เหมือนมีใครบางคนขอบคุณ", { joy: 4, align: 1, luck: 1 })),
    C("ขุดหาของมีค่าในหลุม", B("คุณพบแค่กระดูกกับกระบี่สนิมเขรอะ — และคืนนั้นฝันร้ายจนเหงื่อท่วมตัว", { align: -4, joy: -5 }), { tone: "danger" }),
    C("เดินผ่านไป", N("คนตายก็คือคนตาย — คุณคิดแบบนั้น")),
  ], { when: flagged("plName"), weight: 4, title: "สุสานเก่า" }),
  E("gen.feud_heir", [16, 80], (l, c) => `${pick(l, ["ชายหนุ่มหน้าตาคุ้นๆ", "หญิงสาวถือกระบี่สั้น"])}ขวางทางคุณ "ข้า${nm2(l, c)} — ตระกูลของเจ้าติดค้างเลือดตระกูลข้ามาหนึ่งรุ่นแล้ว"`, [
    C("ขอโทษแทนบรรพบุรุษ", (l, c) => { const p = l.people.find((x) => x.id === c.pid); if (p) feel(p, { grudge: -30, respect: 15 }); return G("เขานิ่งไปนาน ก่อนจะลดกระบี่ลง \"เจ้าไม่ใช่คนที่ทำ… แต่ข้าจะจำว่าเจ้าขอโทษ\"")(l, c); }, { pros: "อาจยุติความแค้นข้ามรุ่น", cons: "เสียหน้า" }),
    C("บอกว่าไม่รู้ไม่เห็น", B("\"ไม่รู้ก็ไม่ได้แปลว่าไม่ต้องชดใช้\" — การต่อสู้เลี่ยงไม่ได้แล้ว", { hp: -10, wound: ["armL", "cut", 1] })),
  ], { when: (l) => l.people.some((p) => p.alive && p.tags?.includes("blood_feud")), prepare: (l) => ({ pid: l.people.find((p) => p.alive && p.tags?.includes("blood_feud"))!.id }), weight: 6, title: "ความแค้นข้ามรุ่น" }),
  E("gen.debt_repaid", [14, 80], (l) => `คนแปลกหน้ามาเคาะประตู "ปู่ของข้าเคยได้รับบุญคุณจาก${l.flags.plName} — ตระกูลข้าสาบานว่าจะทดแทนให้ลูกหลานของท่าน"`, [
    C("รับไว้ด้วยความขอบคุณ", G("เขามอบเงินกับจดหมายแนะนำตัวให้สำนักใหญ่ — บุญคุณที่ทำไว้เมื่อรุ่นก่อน กลับมาหาคุณ", { tael: 30, fame: 2 })),
  ], { when: (l) => l.people.some((p) => p.alive && p.tags?.includes("family_debt")), weight: 6, title: "บุญคุณข้ามรุ่น" }),
  E("gen.revenge_inherit", [14, 60], (l) => `ก่อนตาย ${l.flags.plName} ยังล้างแค้นไม่สำเร็จ — คนในตระกูล/สำนักมองมาที่คุณ รอดูว่าคุณจะแบกความแค้นนี้ต่อหรือไม่`, [
    C("สาบานจะทำให้สำเร็จ", (l, c) => { setGoal(l, "revenge", `สืบทอดความแค้นของ${l.flags.plName}`); const foe = createPerson(l, "rival", { age: l.age + 25, bond: 0, gender: "m" }); foe.tags = ["killer", "rank:3"]; l.goals![l.goals!.length - 1].pid = foe.id; l.flags.plRevenge = false; return BIG("ความแค้นที่ไม่ใช่ของคุณ กลายเป็นของคุณแล้ว")(l, c); }),
    C("ขอใช้ชีวิตของตัวเอง", (l, c) => { l.flags.plRevenge = false; return G("ผู้อาวุโสบางคนผิดหวัง — แต่คุณรู้สึกว่าโซ่เส้นหนึ่งหลุดออกจากข้อเท้า", { joy: 6 })(l, c); }),
  ], { when: (l) => !!l.flags.plRevenge, forced: true, title: "มรดกความแค้น" }),
  E("gen.heirloom", [12, 60], (l) => `คุณได้รับ「${l.flags.heirloom}」ของ${l.flags.plName}ต่อ — ทุกครั้งที่จับด้าม รู้สึกเหมือนมีมือของคนรุ่นก่อนวางทับอยู่`, [
    C("พกติดตัวไว้เสมอ", (l, c) => { if (l.power && !l.power.items.includes(String(l.flags.heirloom))) l.power.items.push(String(l.flags.heirloom)); l.flags.heirloomClaimed = true; return G("อาวุธประจำตระกูลอยู่ข้างกายคุณแล้ว", { fame: 1 })(l, c); }),
  ], { when: (l) => !!l.flags.heirloom && !!l.power && !l.flags.heirloomClaimed, forced: true, title: "อาวุธประจำตระกูล" }),
];

function nm2(l: Life, c: { pid?: string | number | boolean }) {
  const p = l.people.find((x) => x.id === c.pid);
  return p ? shortName(p) : "";
}

/** สรุปก่อนเปลี่ยนรุ่น (หน้าจอหลังความตาย) */
export function lifeSummary(l: Life) {
  const goals = (l.goals ?? []).map((g) => ({ name: goalById(g.id)?.name ?? g.id, end: g.end }));
  const people_ = l.people.filter((p) => p.mem?.some((m) => m.w === 3 && m.known)).slice(0, 6).map((p) => {
    const m = p.mem!.filter((x) => x.w === 3 && x.known).pop()!;
    return `${shortName(p)} — จำได้ว่า "${m.text}"`;
  });
  const promises: string[] = [];
  for (const p of l.people) if (p.alive && p.tags?.includes("sworn")) promises.push(`คำสาบานพี่น้องกับ${shortName(p)}`);
  const openGoal = l.goals?.find((g) => !g.end);
  if (openGoal) promises.push(`เป้าหมายที่ยังไม่สำเร็จ: ${goalById(openGoal.id)?.name}`);
  const assets: string[] = [];
  if (l.money > 0) assets.push(`เงิน ${money(l, l.money)}`);
  const best = artsOf(l).slice().sort((a, b) => b.m - a.m)[0];
  if (best) assets.push(`วิชา「${artInfo(best).name}」${l.flags.wroteManual ? (l.flags.buriedManual ? " (คัมภีร์ฝังไว้)" : " (เขียนเป็นคัมภีร์แล้ว)") : ""}`);
  const sect = mySect(l);
  if (sect) assets.push(`สำนัก「${sect.n}」ศิษย์ ${sect.d} คน`);
  const family = `${people(l, "spouse").filter((p) => p.alive).length} คู่ชีวิต · ลูก ${people(l, "child").filter((p) => p.alive).length} คน · ศิษย์ ${disciplesOf(l).length} คน`;
  return { goals, people: people_, promises, assets, family, era: l.mw ? ERA[l.mw.era].name : "" };
}

void addFame;

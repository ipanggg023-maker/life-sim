// ครอบครัวชุดที่สอง: หลาน · รับเลี้ยง · การมีลูกตามเผ่าและวัย · วิธีเลี้ยงลูก · ฝันของลูกเอง · พี่น้องแย่งความรัก
// ความชราที่เลือกรับมือได้ · บ้านในวัยชรา · ฉากสุดท้ายกับคำขอที่ตามไปถึงทายาท · ชื่อเสียงของตระกูลข้ามชีวิต · มรดกที่ถูกโต้แย้ง
// ความลับของตระกูล · ลูกหลังการหย่า · ครอบครัวใหม่ · อยู่จนเห็นลูกหลานแก่ตาย · ลูกเข้ามาช่วยงานของตระกูล
// แผนอยู่ที่ design/GRILL.md ส่วนที่ 5 (Release 7)
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Ctx, GameEvent } from "../../engine/events";
import { babyHooks, breakupHooks, runEvent, yearHooks } from "../../engine/game";
import { relOf, remember } from "../../engine/npc";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addStat, clamp, createPerson, log, shortName } from "../../engine/util";
import type { WorldState } from "../../engine/worldState";
import { careerById } from "../core/careers";
import { B, BIG, C, E, G, N, P, PAY, SCENE } from "./kit";
import { RACE_YOUNGER, raceOf, stageAge } from "./folk";
import { addStanding, deed, fl, type FamilyRecord, type RaceId } from "./state";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
const bond = (p: Person | undefined, d: number) => { if (p) p.bond = clamp(p.bond + d, 0, 100); };
const kids = (l: Life) => l.people.filter((p) => p.alive && p.relation === "child");
const tagOf = (p: Person, k: string) => p.tags?.find((t) => t.startsWith(`${k}:`))?.slice(k.length + 1);

// ───────────── หลาน ─────────────
export const grandkids = (l: Life) => l.people.filter((p) => p.alive && p.relation === "grandchild");
export const GRANDKID_CHANCE = 0.07;
function grandYear(l: Life) {
  for (const c of kids(l)) {
    if (c.age < 22 || c.age > 45) continue;
    const mine = l.people.filter((g) => g.relation === "grandchild" && g.tags?.includes(`parent:${c.id}`)).length;
    if (mine >= 3 || !chance(l, GRANDKID_CHANCE)) continue;
    const g = createPerson(l, "grandchild", { age: 0, bond: 50, lastName: l.lastName });
    g.tags = [...(g.tags ?? []), `parent:${c.id}`];
    log(l, `${shortName(c)}มีลูกแล้ว ${shortName(g)}คือ${g.gender === "m" ? "หลานชาย" : "หลานสาว"}ของคุณ`, "milestone");
  }
}

// ───────────── การมีลูก: วัยและเผ่า ─────────────
const FERTILE: Partial<Record<RaceId, number>> = { elf: 0.5, dwarf: 0.7, dragon: 0.4, demon: 0.6, halfling: 1.2, orc: 1.15 };
/** ช่วงวัยที่มีลูกได้นับตามช่วงชีวิต · เผ่าอายุยืนมีลูกได้นานกว่า แต่ยากกว่า · คนรักที่ไม่ผูกพันไม่อยากมีลูกด้วย */
const babyRules = {
  age: (l: Life, p: Person) => { if (!on(l)) return undefined; if (l.gender === "f") return stageAge(l); const y = Math.max(0, RACE_YOUNGER[raceOf(p) ?? fl(l).race] ?? 0); return p.age < 20 ? p.age : Math.round(20 + ((p.age - 20) * 80) / (80 + y)); },
  mult: (l: Life, p: Person) => (on(l) ? (FERTILE[fl(l).race] ?? 1) * (p.bond < 35 ? 0 : 1) : 1),
};
const NEWBORN: GameEvent = E("ft.f2.newborn", [14, 900], (l, c) => `${nm(l, c)}ลืมตาดูโลกในคืนที่ฝนตกหนัก ทั้งบ้านรอฟังว่าคุณจะตั้งชื่อเรียกในบ้านให้ว่าอะไร`, [
  C("ตั้งตามชื่อพ่อหรือแม่ของคุณ", G("พ่อแม่ของคุณกอดหลานแน่นจนเด็กร้อง", { joy: 6 }, (l) => { for (const p of l.people) if (p.alive && (p.relation === "father" || p.relation === "mother")) bond(p, 10); })),
  C("ตั้งตามวีรบุรุษในตำนาน", G("ชื่อนั้นหนักสำหรับทารกตัวเล็ก แต่ทุกคนในเมืองจำได้ตั้งแต่วันแรก", { joy: 4, fame: 1 })),
  C("ตั้งชื่อที่คุณสองคนคิดกันเอง", G((l, c) => `คุณกับคู่ชีวิตหัวเราะกันทั้งคืนกว่าจะได้ชื่อ ${nm(l, c)}หลับไปก่อนคุณสองคนตกลงกันได้`, { joy: 7 }, (l) => { for (const p of l.people) if (p.alive && p.relation === "spouse") bond(p, 8); })),
], { title: "เด็กคนใหม่ในบ้าน", forced: true, maxTimes: 0, when: (l) => on(l) && !!newborn(l), prepare: (l) => ({ pid: newborn(l)!.id }) });
const newborn = (l: Life) => kids(l).find((k) => k.age === 0 && !k.tags?.includes("named"));

// ───────────── รับเลี้ยง ─────────────
const ADOPT = SCENE("ft.f2.adopt", "รับเลี้ยงเด็ก", "คุณไปที่วิหารเพื่อถามเรื่องรับเลี้ยงเด็ก นักบวชพาคุณเดินผ่านห้องต่างๆ", [
  PAY("เด็กกำพร้าตัวเล็กในห้องหลังวิหาร", 5, BIG("เด็กคนนั้นจับนิ้วคุณไว้ไม่ยอมปล่อย และคุณรู้ว่านี่คือลูกของคุณ", { joy: 10 }, (l) => adoptKid(l, randInt(l, 2, 6), "ลูกบุญธรรมจากวิหาร"))),
  C("ลูกของทหารที่ตายในสงคราม", BIG("เด็กคนนั้นไม่ยิ้มเลยหนึ่งปีเต็ม แล้ววันหนึ่งก็หัวเราะตอนคุณทำขนมไหม้", { joy: 8 }, (l) => { adoptKid(l, randInt(l, 8, 12), "ลูกบุญธรรมจากสงคราม"); addStanding(l, 3); })),
  C("เด็กฝึกงานที่ไม่มีใครรับ", BIG("เด็กคนนั้นขอเรียกคุณว่าครูก่อน อีกหลายปีต่อมาถึงจะเรียกว่าพ่อแม่", { joy: 6 }, (l) => { const k = adoptKid(l, randInt(l, 12, 16), "ลูกบุญธรรมที่เคยเป็นเด็กฝึกงาน"); k.tags = [...(k.tags ?? []), "taught_trade:2"]; }), { show: (l) => !!l.job }),
  C("ยังไม่พร้อม", N("คุณกลับบ้านพร้อมคำถามเต็มหัว")),
]);
export const ADOPT_GAP = 3;
function adoptKid(l: Life, age: number, job: string) {
  const k = createPerson(l, "child", { age, bond: 55, lastName: l.lastName, job: age >= 12 ? job : undefined });
  k.tags = [...(k.tags ?? []), "adopted", "named"];
  l.flags.ftAdoptAt = l.age;
  return k;
}

// ───────────── วิธีเลี้ยงลูก ─────────────
export type Parenting = "strict" | "warm" | "free" | "absent";
export const PARENTING: Record<Parenting, { name: string; desc: string }> = {
  strict: { name: "เข้มงวด", desc: "ลูกเก่งขึ้นทุกปี แต่ผูกพันน้อยลงเล็กน้อย" },
  warm: { name: "อบอุ่น", desc: "ลูกผูกพันกับคุณมากขึ้นทุกปี" },
  free: { name: "ปล่อยให้เป็นตัวเอง", desc: "ลูกมีความฝันชัดเจน และผูกพันขึ้นนิดหน่อย" },
  absent: { name: "ไม่ค่อยอยู่บ้าน", desc: "คุณมีเวลาทำอย่างอื่นมากขึ้น แต่ลูกห่างเหิน" },
};
export const parentingOf = (l: Life) => l.flags.ftParenting as Parenting | undefined;
function parentYear(l: Life) {
  const s = parentingOf(l);
  if (!s) return;
  for (const k of [...kids(l), ...grandkids(l).filter(() => s === "warm")]) {
    if (k.age >= 18) continue;
    if (s === "strict") { bond(k, -1); if (k.age >= 6 && chance(l, 0.5)) k.tags = [...(k.tags ?? []).filter((t) => !t.startsWith("taught_mind:")), `taught_mind:${Number(tagOf(k, "taught_mind") ?? 0) + 1}`]; }
    if (s === "warm") bond(k, 2);
    if (s === "free") bond(k, 1);
    if (s === "absent") bond(k, -3);
  }
}

// ───────────── ฝันของลูกเอง · พี่น้องแย่งความรัก · ลูกช่วยงานของตระกูล ─────────────
const DREAMS = ["นักผจญภัย", "นักปราชญ์", "ศิลปิน", "นักบวช", "พ่อค้า", "ช่างฝีมือ"];
export const dreamOf = (p: Person) => tagOf(p, "dream");
const dreamer = (l: Life) => kids(l).find((k) => k.age >= 16 && k.age <= 22 && dreamOf(k) && !k.tags?.includes("dream_told"));
const KIDS: GameEvent[] = [
  E("ft.f2.dream", [30, 900], (l, c) => `${nm(l, c)}อยากเป็น${dreamOf(who(l, c)!)} ไม่ใช่สิ่งที่คุณวาดไว้ให้ ${who(l, c)!.age} ปีที่ผ่านมา และเขาพูดออกมาในที่สุด`, [
    C("หนุนเต็มที่", G((l, c) => `${nm(l, c)}ร้องไห้กอดคุณ แล้วเริ่มเดินทางของตัวเองในปีนั้น`, { joy: 5 }, (l, c) => { const p = who(l, c); if (p) { bond(p, 12); p.job = dreamOf(p); remember(l, p, "dream", "คุณหนุนความฝันของเขา", 3, { love: 15, trust: 15 }); } })),
    C("หาทางกลางให้ทั้งสองฝั่ง", N((l, c) => `${nm(l, c)}ยอมช่วยงานบ้านอีกสองปีก่อนจะออกไปตามฝัน ทุกคนพอใจครึ่งหนึ่ง`, { joy: 1 }, (l, c) => bond(who(l, c), 3))),
    C("ห้ามเด็ดขาด", B((l, c) => `${nm(l, c)}ทำตามที่คุณสั่ง แต่หยุดเล่าเรื่องในใจให้คุณฟังตั้งแต่วันนั้น`, { joy: -3 }, (l, c) => { const p = who(l, c); if (p) { bond(p, -15); remember(l, p, "dream", "คุณห้ามความฝันของเขา", 3, { grudge: 20, love: -10 }); } })),
  ], { title: "ความฝันของลูก", weight: 25, maxTimes: 0, when: (l) => on(l) && !!dreamer(l), prepare: (l) => ({ pid: dreamer(l)!.id }) }),
  E("ft.f2.rivalry", [30, 900], (l) => { const [a, b] = kids(l).filter((k) => k.age >= 12).sort((x, y) => y.bond - x.bond); return `${shortName(a)}กับ${shortName(b)}ทะเลาะกันกลางโต๊ะอาหารว่าคุณรักใครมากกว่ากัน และใครจะได้บ้านหลังนี้`; }, [
    C("บอกว่ารักเท่ากัน และพิสูจน์ด้วยการกระทำ", G("คุณใช้เวลากับลูกแต่ละคนแยกกันทั้งปี ความอิจฉาค่อยๆ เบาลง", { joy: 3 }, (l) => { for (const k of kids(l)) { bond(k, 4); remember(l, k, "fair", "คุณรักลูกทุกคนเท่ากัน", 2, { jealousy: -15 }); } })),
    C("เข้าข้างคนที่ถูกในเรื่องนี้", N("ลูกคนหนึ่งยิ้ม อีกคนหนึ่งเดินออกจากห้อง", {}, (l) => { const ks = kids(l).filter((k) => k.age >= 12); if (ks[1]) remember(l, ks[1], "favored", "คุณเข้าข้างพี่น้องอีกคน", 3, { jealousy: 25 }); })),
    C("ปล่อยให้ลูกตกลงกันเอง", N("ลูกทั้งสองไม่คุยกันไปหนึ่งเดือน แล้วก็กลับมาคุยกันเองโดยไม่มีใครรู้ว่าเกิดอะไรขึ้น", {})),
  ], { title: "ลูกที่แย่งความรัก", weight: 14, maxTimes: 1, when: (l) => on(l) && kids(l).filter((k) => k.age >= 12).length >= 2 }),
  E("ft.f2.trade", [35, 900], (l, c) => `${nm(l, c)}ถามว่าขอมาช่วยงาน${careerById(l.job?.careerId ?? "")?.name ?? ""}ของคุณได้ไหม`, [
    C("รับเข้ามาสอนทุกอย่าง", G((l, c) => `${nm(l, c)}เรียนเร็วกว่าที่คุณเคยเรียน ลูกค้าเริ่มถามหาเขาก่อนคุณ`, { joy: 5 }, (l, c) => { const p = who(l, c); if (p && l.job) { p.job = `ผู้ช่วย${careerById(l.job.careerId)?.name ?? ""}ของตระกูล`; p.tags = [...(p.tags ?? []).filter((t) => !t.startsWith("taught_trade:")), "taught_trade:3", "family_trade"]; l.job.performance = clamp(l.job.performance + 8, 0, 100); bond(p, 8); } })),
    C("บอกให้ไปหาทางของตัวเอง", N((l, c) => `${nm(l, c)}พยักหน้า แล้วไปสมัครงานที่อื่น`, {}, (l, c) => bond(who(l, c), -3))),
  ], { title: "ลูกขอช่วยงาน", weight: 12, maxTimes: 1, when: (l) => on(l) && !!l.job && !!traineeKid(l), prepare: (l) => ({ pid: traineeKid(l)!.id }) }),
];
const traineeKid = (l: Life) => kids(l).find((k) => k.age >= 18 && k.age <= 35 && !k.tags?.includes("family_trade") && !k.tags?.some((t) => t.startsWith("away:")));

// ───────────── ความชรา · บ้านในวัยชรา · ฉากสุดท้าย ─────────────
export const ELDER_AT = 65;
export type ElderHome = "alone" | "child" | "temple" | "estate";
export const ELDER_HOME: Record<ElderHome, string> = { alone: "อยู่บ้านตัวเองคนเดียว", child: "ย้ายไปอยู่กับลูก", temple: "อยู่ที่วิหาร", estate: "อยู่บ้านใหญ่กับคนรับใช้" };
const AGEING: GameEvent[] = [
  E("ft.f2.ageing", [40, 900], "ขาของคุณไม่ยอมขึ้นบันไดเหมือนเมื่อก่อน และบางเช้าคุณลืมว่าวางแว่นไว้ที่ไหน", [
    PAY("ไปหาหมอเวทที่เก่งที่สุดในเมือง", 15, G("ยาของหมอเวททำให้คุณเดินขึ้นเขาได้อีกครั้ง", { hp: 8 })),
    PAY("ซื้อยาอายุวัฒนะจากพ่อค้าต่างแดน", 60, (l, c) => { if (chance(l, 0.5)) { fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) + 6; return G("ยานั้นได้ผลจริง ผมของคุณกลับมาดำครึ่งหัว", { hp: 10, joy: 4 })(l, c); } return B("ยานั้นเป็นน้ำผึ้งผสมสีย้อมผม", { joy: -3 })(l, c); }),
    C("พักผ่อนให้มากขึ้น", G("คุณนอนกลางวันเป็นครั้งแรกในชีวิต และพบว่ามันไม่ได้แย่อย่างที่คิด", { hp: 4, joy: 3 })),
    C("ทำเหมือนไม่มีอะไรเกิดขึ้น", N("คุณทำงานต่อเหมือนเดิม หัวเข่าส่งเสียงทุกครั้งที่ลุก", { hp: -3 }, (l) => { if (l.job) l.job.performance = clamp(l.job.performance + 6, 0, 100); })),
  ], { title: "ร่างกายที่ช้าลง", weight: 25, maxTimes: 0, when: (l) => on(l) && stageAge(l) >= ELDER_AT && l.age - Number(l.flags.ftAgeingAt ?? -99) >= 8 }),
  E("ft.f2.home", [40, 900], "คุณอายุมากพอที่ต้องคิดว่าจะใช้ชีวิตช่วงสุดท้ายที่ไหน", [
    C("อยู่บ้านตัวเองคนเดียว", N("บ้านเงียบ แต่เป็นบ้านของคุณ", {}, (l) => { l.flags.ftElderHome = "alone"; })),
    C("ย้ายไปอยู่กับลูก", G("หลานๆ วิ่งรอบตัวคุณทุกเช้า บ้านไม่เคยเงียบอีกเลย", { joy: 5 }, (l) => { l.flags.ftElderHome = "child"; for (const k of kids(l)) bond(k, 6); }), { show: (l) => kids(l).some((k) => k.age >= 20) }),
    C("ไปอยู่ที่วิหาร", G("นักบวชดูแลคุณอย่างดี และคุณมีเวลาคิดเรื่องที่ไม่เคยมีเวลาคิด", { joy: 3, hp: 3 }, (l) => { l.flags.ftElderHome = "temple"; })),
    C("อยู่บ้านใหญ่กับคนรับใช้", G("ทุกอย่างพร้อมตลอดเวลา แต่บางคืนคุณก็นั่งกินข้าวคนเดียวที่โต๊ะยาว", { hp: 4 }, (l) => { l.flags.ftElderHome = "estate"; }), { show: (l) => Number(l.flags.ftHome ?? 0) >= 3 }),
  ], { title: "บ้านในวัยชรา", forced: true, maxTimes: 1, when: (l) => on(l) && stageAge(l) >= 70 && !l.flags.ftElderHome }),
  E("ft.f2.last", [40, 900], (l) => `คุณรู้ว่าเวลาเหลือไม่มากแล้ว ${l.people.find((p) => p.alive && p.relation === "spouse")?.name ?? kids(l)[0]?.name ?? "คนที่รัก"}นั่งอยู่ข้างเตียง และถามว่ามีอะไรอยากทำเป็นอย่างสุดท้ายไหม`, [
    C("ให้อภัยศัตรูทุกคน", G("คุณส่งจดหมายสั้นๆ ไปหาทุกคนที่เคยแค้นกัน บางคนตอบกลับ บางคนไม่ แต่คุณนอนหลับสบาย", { joy: 6 }, (l) => { for (const p of l.people) if (p.alive && relOf(p).grudge >= 20) remember(l, p, "forgive", "คุณให้อภัยเขาก่อนจากไป", 3, { grudge: -40 }); l.flags.ftLastWish = "forgive"; })),
    C("แบ่งของที่มีให้ทุกคนที่รัก", G("คุณเรียกทุกคนเข้ามาทีละคน และมอบของชิ้นเล็กๆ ที่มีความหมายให้", { joy: 5 }, (l) => { for (const p of l.people) if (p.alive && p.bond >= 50) bond(p, 10); l.flags.ftLastWish = "give"; })),
    C("บอกความลับที่เก็บมาทั้งชีวิต", G("คุณเล่าเรื่องที่ไม่เคยบอกใคร คนข้างเตียงจับมือคุณแน่น แล้วสัญญาว่าจะส่งต่อเรื่องนี้ให้ถูกคน", { joy: 4 }, (l) => { l.flags.ftLastWish = "secret"; })),
  ], { title: "คำขอสุดท้าย", forced: true, maxTimes: 0, when: (l) => on(l) && !!l.flags.ftLastDue && !l.flags.ftLastWish }),
];

// ───────────── ชื่อเสียงของตระกูล · ความลับของตระกูล ─────────────
export function familyOf(w: WorldState, last: string): FamilyRecord {
  const d = w.data as unknown as { families?: Record<string, FamilyRecord> };
  return ((d.families ??= {})[last] ??= { fame: 0, lives: 0 });
}
export const familyRec = (l: Life) => familyOf(l.fw!, l.lastName);
const CRESTS = ["มังกรเงินบนโล่สีคราม", "ค้อนกับดาวเหนือ", "นกฮูกถือกุญแจ", "ต้นโอ๊กใต้จันทร์เสี้ยว"];
const MOTTOS = ["ไม่ก้มหัวให้พายุ", "รักษาคำพูดยิ่งกว่าชีวิต", "ทุกประตูมีกุญแจ", "รากลึกจึงยืนนาน"];
const FAMILY_EVENTS: GameEvent[] = [
  E("ft.f2.crest", [25, 900], (l) => `ชื่อของตระกูล${l.lastName}เริ่มเป็นที่รู้จัก ช่างตราประทับในเมืองมาถามว่าตระกูลของคุณจะใช้ตราแบบไหน`, [
    ...[0, 1, 2, 3].map((i) => C(`${CRESTS[i]} · "${MOTTOS[i]}"`, BIG(`ตรา${CRESTS[i]}ถูกแกะลงบนประตูบ้าน ใต้ตราเขียนว่า "${MOTTOS[i]}"`, { joy: 4, fame: 1 }, (l) => { const r = familyRec(l); r.crest = CRESTS[i]; r.motto = MOTTOS[i]; }))),
  ], { title: "ตราของตระกูล", forced: true, maxTimes: 1, when: (l) => on(l) && !!l.fw && familyRec(l).fame + l.fame >= 30 && !familyRec(l).crest && l.age >= 25 }),
  E("ft.f2.secret", [20, 900], (l) => ({ sibling: "หญิงชราคนหนึ่งมาเคาะประตู เธอบอกว่าเป็นพี่สาวต่างแม่ของพ่อแม่คุณ ที่ไม่มีใครในตระกูลยอมพูดถึง", crime: "นักสืบของศาลนำเอกสารเก่ามาให้ดู พ่อแม่ของคุณเคยปล้นคาราวานของขุนนางเมื่อสี่สิบปีก่อน และไม่เคยถูกจับ", stolen: "ทนายแก่คนหนึ่งบอกว่ามรดกส่วนหนึ่งของตระกูลถูกญาติห่างๆ ยักยอกไปเมื่อสองรุ่นก่อน และยังทวงคืนได้", curse: "หมอดูประจำเมืองบอกว่าตระกูลของคุณถูกสาปมาสามรุ่น ผู้ชายในตระกูลไม่เคยอยู่เกินหกสิบ ผู้หญิงไม่เคยมีความสุขในงานแต่ง" })[familyRec(l).secret!], [
    C("ยอมรับความจริงและทำให้มันถูกต้อง", (l, c) => {
      const r = familyRec(l); r.revealed = true;
      if (r.secret === "sibling") { const p = createPerson(l, "friend", { age: l.age + 25, bond: 50, lastName: l.lastName, job: "ญาติที่ตระกูลลืม" }); p.tags = [...(p.tags ?? []), "hidden_kin"]; return G("คุณพาเธอเข้าบ้านในงานรวมญาติ ทุกคนเงียบไปครู่หนึ่ง แล้วเลื่อนเก้าอี้ให้", { joy: 5 })(l, c); }
      if (r.secret === "crime") return N("คุณชดใช้ให้ตระกูลขุนนางนั้นด้วยตัวเอง ชื่อตระกูลมีรอยด่าง แต่คุณนอนหลับได้", { gold: -20 }, (x) => addStanding(x, 2))(l, c);
      if (r.secret === "stolen") return BIG("ศาลตัดสินให้มรดกกลับคืนมา ญาติห่างๆ ไม่มาร่วมงานใดๆ ของตระกูลอีก", { gold: 60 })(l, c);
      return P("ไปหาแม่มดที่สาปตระกูล", (x) => 0.4 + x.stats.luck / 200, BIG("แม่มดหัวเราะแล้วถอนคำสาป \"ข้ารอให้ใครสักคนกล้ามาหาข้ามาสามรุ่นแล้ว\"", { joy: 8 }, (x) => { fl(x).lifeBonus = (fl(x).lifeBonus ?? 0) + 5; deed(x, "ถอนคำสาปของตระกูล"); }), B("แม่มดไม่อยู่แล้ว เหลือเพียงกระท่อมร้าง", { joy: -4 })).run(l, c, chance(l, 0.4 + l.stats.luck / 200));
    }),
    C("เก็บไว้เป็นความลับต่อไป", N("คุณเผาเอกสารทิ้ง แต่รู้ว่าวันหนึ่งลูกหลานของคุณอาจต้องเจอมันอีก", {})),
  ], { title: "ความลับของตระกูล", weight: 20, maxTimes: 1, when: (l) => on(l) && !!l.fw && !!familyRec(l).secret && !familyRec(l).revealed }),
  E("ft.f2.dispute", [16, 900], `พี่น้องที่ไม่ได้มรดกชิ้นใหญ่ยื่นเรื่องต่อศาล ขอแบ่งของที่พ่อแม่ทิ้งไว้ให้คุณ`, [
    PAY("แบ่งให้พวกเขาด้วยเงิน", 25, G("พี่น้องรับเงินไปแล้วถอนเรื่อง ทุกคนกลับมานั่งกินข้าวด้วยกันได้อีก", { joy: 4 }, (l) => { for (const p of l.people) if (p.alive && p.relation === "sibling") bond(p, 10); })),
    P("สู้คดีในศาล", (l) => 0.45 + l.stats.smarts / 250, G("ศาลยืนตามพินัยกรรม ของทุกชิ้นเป็นของคุณ", { joy: 2 }, (l) => { for (const p of l.people) if (p.alive && p.relation === "sibling") remember(l, p, "court", "คุณสู้คดีมรดกกับเขา", 3, { grudge: 25 }); }), B("ศาลสั่งแบ่งครึ่ง และพี่น้องไม่พูดกับคุณอีกเลย", { gold: -30, joy: -5 })),
    C("ตัดขาดพวกเขา", B("คุณไม่ตอบจดหมายของพี่น้องอีกเลย บ้านของตระกูลเงียบลงทุกปี", { joy: -3 }, (l) => { for (const p of l.people) if (p.alive && p.relation === "sibling") { bond(p, -30); remember(l, p, "cut", "คุณตัดขาดเขาเรื่องมรดก", 3, { grudge: 35 }); } })),
  ], { title: "มรดกที่ถูกโต้แย้ง", forced: true, maxTimes: 1, when: (l) => on(l) && !!l.flags.ftHeirDispute }),
];
/** ตอนจบชีวิต: ชีวิตที่น่าจดจำเพิ่มชื่อเสียงให้ตระกูล · บางตระกูลซ่อนความลับไว้ให้รุ่นหลัง */
export function recordFamily(w: WorldState, l: Life, memorable: boolean) {
  const r = familyOf(w, l.lastName);
  r.lives++;
  if (memorable) r.fame = clamp(r.fame + Math.round(l.fame / 4) + fl(l).deeds.length, -50, 200);
  if (l.flags.ftOutcast || (fl(l).crimes ?? 0) >= 2) r.fame = clamp(r.fame - 10, -50, 200);
  if (!r.secret && chance(l, SECRET_CHANCE)) { r.secret = pick(l, ["sibling", "crime", "stolen", "curse"] as const); r.revealed = false; }
}
export const SECRET_CHANCE = 0.15;
/** ทายาทรับชื่อเสียงของตระกูล · พี่น้องที่ถูกข้ามอาจฟ้องขอแบ่ง · คำขอสุดท้ายของพ่อแม่ตามมาด้วย */
export function inheritFamily(dead: Life, next: Life, passedOver: boolean) {
  if (!dead.fw) return;
  const r = familyOf(dead.fw, dead.lastName);
  if (r.fame >= 10) { addStanding(next, Math.round(r.fame / 5)); log(next, `ตระกูล${dead.lastName}${r.crest ? `ตรา${r.crest}` : ""}เป็นที่รู้จักในแผ่นดิน ผู้คนให้เกียรติคุณตั้งแต่วันแรก`, "good"); }
  else if (r.fame <= -10) { addStanding(next, Math.round(r.fame / 5)); log(next, `ชื่อตระกูล${dead.lastName}ยังมีรอยด่างในสายตาคนในแผ่นดิน`, "bad"); }
  if (!passedOver && next.people.some((p) => p.alive && p.relation === "sibling") && chance(next, DISPUTE_CHANCE)) next.flags.ftHeirDispute = true;
  const w = dead.flags.ftLastWish;
  if (w === "give") log(next, "ของชิ้นเล็กที่พ่อแม่มอบให้ก่อนจากไปยังอยู่ในกระเป๋าเสื้อของคุณทุกวัน", "normal");
  if (w === "secret") { addStat(next, "smarts", 2); log(next, "คุณจำเรื่องที่พ่อแม่เล่าก่อนจากไปได้ทุกคำ มันอธิบายหลายอย่างที่ไม่เคยเข้าใจ", "normal"); }
  if (w === "forgive") log(next, "ศัตรูหลายคนของพ่อแม่มาร่วมงานศพ และไม่มีใครพูดถึงความแค้นอีก", "good");
}
export const DISPUTE_CHANCE = 0.35;

// ───────────── หลังการหย่า · ครอบครัวใหม่ · อยู่จนเห็นลูกหลานแก่ตาย ─────────────
function afterDivorce(l: Life, _p: Person, divorce: boolean) {
  if (!on(l) || !divorce) return;
  for (const k of kids(l)) {
    bond(k, k.age < 18 ? -15 : -8);
    remember(l, k, "divorce", "พ่อแม่หย่ากัน", 2, { trust: -10 });
    if (k.age < 18 && chance(l, 0.3)) { k.tags = [...(k.tags ?? []), `away:${l.age}`, "with_other_parent"]; log(l, `${shortName(k)}ย้ายไปอยู่กับอีกฝ่าย`, "bad"); }
  }
}
const LATER: GameEvent[] = [
  E("ft.f2.step", [20, 900], (l, c) => `${nm(l, c)}คู่ชีวิตคนใหม่ของคุณพยายามทุกอย่าง แต่ลูกคนโตของคุณยังไม่ยอมเรียกเขาด้วยชื่อ`, [
    C("ให้เวลาทั้งสองฝั่ง", G("หนึ่งปีต่อมา ลูกของคุณเรียกเขาว่าพ่อหรือแม่โดยไม่รู้ตัวที่โต๊ะอาหาร ทั้งบ้านเงียบไปครู่หนึ่ง แล้วก็หัวเราะ", { joy: 6 }, (l, c) => { bond(who(l, c), 8); for (const k of kids(l)) bond(k, 4); })),
    C("บอกลูกว่าต้องยอมรับ", B("ลูกยอมทำตาม แต่ประตูห้องของเขาปิดเสียงดังกว่าเดิม", { joy: -2 }, (l) => { for (const k of kids(l)) if (k.age >= 10) remember(l, k, "step", "คุณบังคับให้ยอมรับคนใหม่", 2, { grudge: 10 }); })),
  ], { title: "ครอบครัวใหม่", weight: 20, maxTimes: 1, when: (l) => on(l) && !!stepSpouse(l), prepare: (l) => ({ pid: stepSpouse(l)!.id }) }),
  E("ft.f2.outlive", [100, 900], (l, c) => `${nm(l, c)}จากไปในวัยชรา คุณจำวันที่อุ้มเขาครั้งแรกได้เหมือนเพิ่งเมื่อวาน ร่างกายของคุณยังไม่แก่ไปกว่าวันนั้นเท่าไร`, [
    C("ดูแลลูกหลานรุ่นต่อไปแทนเขา", G("คุณย้ายไปอยู่ใกล้หลานเหลน และสอนพวกเขาทุกอย่างที่เคยสอนพ่อแม่ของเขา", { joy: 4 }, (l) => { for (const g of grandkids(l)) bond(g, 10); })),
    C("ถอยห่างจากโลกของคนอายุสั้น", N("คุณกลับไปอยู่กับเผ่าของตัวเอง การสูญเสียแบบนี้เจ็บน้อยลงเมื่ออยู่ไกล แต่ก็ไม่ได้หายไป", { joy: -2 })),
  ], { title: "อยู่จนเห็นลูกแก่ตาย", forced: true, maxTimes: 0, when: (l) => on(l) && !!outlived(l), prepare: (l) => { const p = outlived(l)!; return { pid: p.id }; } }),
];
const stepSpouse = (l: Life) => { const s = l.people.find((p) => p.alive && p.relation === "spouse"); return s && Number(tagOf(s, "since") ?? l.age) > Math.max(-1, ...kids(l).map((k) => l.age - k.age)) && kids(l).some((k) => k.age >= 6) && !l.flags.ftStepDone ? s : undefined; };
const outlived = (l: Life) => l.people.find((p) => !p.alive && (p.relation === "child" || p.relation === "grandchild") && p.age >= 60 && !p.tags?.includes("outlived"));

/** ใกล้วาระสุดท้าย: จดไว้ครั้งเดียว · ฉากต้องไม่หายเพราะสุขภาพขึ้นลงระหว่างปี */
export const lastDue = (l: Life) => stageAge(l) >= 85 || (stageAge(l) >= 75 && l.stats.health <= 35) || (stageAge(l) >= 68 && l.stats.health <= 22);
function familyYear2(l: Life) {
  if (!on(l) || !l.alive) return;
  if (!l.flags.ftLastDue && lastDue(l)) l.flags.ftLastDue = true;
  grandYear(l);
  parentYear(l);
  // ลูกเริ่มมีความฝันของตัวเองตอนสิบสี่
  for (const k of kids(l)) if (k.age === 14 && !dreamOf(k)) k.tags = [...(k.tags ?? []), `dream:${parentingOf(l) === "free" ? DREAMS[k.id.length % DREAMS.length] : pick(l, DREAMS)}`];
  // บ้านในวัยชรา
  const h = l.flags.ftElderHome as ElderHome | undefined;
  if (h === "alone") addStat(l, "happiness", -1);
  if (h === "temple") addStat(l, "health", 1);
  if (h === "child") addStat(l, "happiness", 1);
}

const ACTS: Activity[] = [
  { id: "ft_adopt", emoji: "", name: "รับเลี้ยงเด็ก", desc: "เด็กกำพร้า ลูกทหาร หรือเด็กฝึกงาน", minAge: 22, time: 0, world: "fantasy", group: "ครอบครัว", available: (l) => !!l.ft && kids(l).length < 6 && l.age - Number(l.flags.ftAdoptAt ?? -99) >= ADOPT_GAP, run: (l) => { runEvent(l, "ft.f2.adopt"); return { text: "" }; } },
];

/** เรื่องที่ต้องปิดตัวเองหลังเลือก */
function after(e: GameEvent, fn: (l: Life, c: Ctx) => void): GameEvent {
  return { ...e, choices: (e.choices ?? []).map((ch) => ({ ...ch, run: (l: Life, c: Ctx, ok: boolean) => { fn(l, c); return ch.run(l, c, ok); } })) };
}
const tagPerson = (t: string) => (l: Life, c: Ctx) => { const p = who(l, c); if (p) p.tags = [...(p.tags ?? []), t]; };
export const FAMILY2_EVENTS: GameEvent[] = [
  after(NEWBORN, tagPerson("named")), ADOPT,
  ...KIDS.map((e) => (e.id === "ft.f2.dream" ? after(e, tagPerson("dream_told")) : e)),
  ...AGEING.map((e) => (e.id === "ft.f2.ageing" ? after({ ...e, when: (l) => on(l) && stageAge(l) >= ELDER_AT && l.age - Number(l.flags.ftAgeingAt ?? -99) >= 8 }, (l) => { l.flags.ftAgeingAt = l.age; }) : e)),
  ...FAMILY_EVENTS.map((e) => (e.id === "ft.f2.dispute" ? after(e, (l) => { delete l.flags.ftHeirDispute; }) : e)),
  after(LATER[0], (l) => { l.flags.ftStepDone = true; }), after(LATER[1], tagPerson("outlived")),
];
export function loadFamily2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(familyYear2);
  babyHooks.push(babyRules);
  breakupHooks.push(afterDivorce);
}

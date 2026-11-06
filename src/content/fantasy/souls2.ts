// ความตายและวิญญาณ (Release 16): อันดับของวิญญาณ ร่องรอยจางๆ จากชีวิตก่อน การพิพากษาหลังความตาย สิ่งที่ปลดได้จากสิ่งที่ทำ
// เกิดใหม่เร็วหรือช้า การจำกันได้ที่เกิดขึ้นยาก คำสุดท้าย การรอดตายครั้งเดียวด้วยราคา หลุมศพในโลก การกลับมาเป็นอมตะ
// และความสำเร็จแรกของโลก · กติกา: เรื่องราวไม่ข้ามชีวิต วิญญาณพาไปได้แค่ร่องรอยเล็กๆ และตำนานที่อยู่ในโลก
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { GameEvent } from "../../engine/events";
import { deathSaves, runEvent, yearHooks } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life, Soul } from "../../engine/types";
import { addMoney, addStat, createPerson, displayName, log, shortName } from "../../engine/util";
import { recordChronicle } from "../../engine/worldState";
import { C, E, G, GOLD, N, P, SCENE } from "./kit";
import { fightOdds } from "./power";
import { addStanding, dataOf, deed, fl, homeKingdom, worldOfLife, type FData } from "./state";
import { lean, personaOf } from "./persona";
import { craftRank, CRAFT_NAME, type Craft } from "./power2";
import { closest, volumesOf, isTurn } from "./lifestory";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const D = (l: Life) => dataOf(l) as FData;

// ───────────── อันดับของวิญญาณ ─────────────
export const SOUL_RANKS: [number, string, string][] = [[0, "วิญญาณใหม่", ""], [3, "วิญญาณเก่า", "สติปัญญา +2 ตอนเกิด"], [8, "วิญญาณโบราณ", "สติปัญญาและโชค +2 ตอนเกิด"], [20, "วิญญาณนิรันดร์", "ทุกค่า +2 ตอนเกิด"]];
export const soulRank = (s: Soul) => [...SOUL_RANKS].reverse().find(([n]) => s.lives >= n)!;

// ───────────── เกิดใหม่เร็วหรือช้า ─────────────
export const SOON: [number, number] = [5, 20], FAR: [number, number] = [50, 200];
let nextGap: "soon" | "far" | undefined;
/** หน้าหลังความตายเลือกว่าจะเกิดใหม่เร็วหรือช้า (ใช้ครั้งเดียว) */
export const setStrangerGap = (g: "soon" | "far" | undefined) => { nextGap = g; };
export const takeStrangerGap = (): [number, number] | undefined => { const g = nextGap; nextGap = undefined; return g === "soon" ? SOON : g === "far" ? FAR : undefined; };

// ───────────── ตอนชีวิตจบ: บันทึกลงวิญญาณและโลก ─────────────
export const UNLOCKS: Record<string, { name: string; desc: string; test: (l: Life) => boolean }> = {
  royal: { name: "สายเลือดราชัน", desc: "เกิดในตระกูลขุนนางได้บ่อยขึ้น", test: (l) => fl(l).deeds.some((d) => d.startsWith("ครองบัลลังก์")) },
  dragon: { name: "เสียงเรียกของมังกร", desc: "เกิดมาพร้อมลางมังกรและใจที่มังกรชอบ", test: (l) => !!fl(l).mount || !!fl(l).whelp || !!l.flags.dragonRider },
  smith: { name: "มือของช่าง", desc: "เกิดมาพร้อมพื้นฐานงานช่าง", test: (l) => craftRank(l, "smith") >= 5 },
  sage: { name: "ดวงตาของปราชญ์", desc: "เกิดมาพร้อมความรู้และตำรา", test: (l) => craftRank(l, "lore") >= 5 || (D(l).lore?.length ?? 0) >= 4 },
};
export function judge(l: Life): "light" | "shadow" | "plain" {
  const p = personaOf(l), f = fl(l);
  const score = p.m + p.h / 2 + p.f / 3 - (f.kills ?? 0) * 10 - (f.corruption ?? 0) / 3;
  return score >= 30 ? "light" : score <= -30 ? "shadow" : "plain";
}
/** เรียกจาก closeLife */
export function recordSoul(s: Soul, l: Life) {
  if (!on(l)) return;
  const f = fl(l), d = D(l), w = worldOfLife(l);
  const sp = l.people.find((p) => p.relation === "spouse");
  const kid = l.people.find((p) => p.relation === "child");
  const crafts = (Object.keys(CRAFT_NAME) as Craft[]).filter((k) => craftRank(l, k) >= 3).sort((a, b) => craftRank(l, b) - craftRank(l, a));
  s.ftEcho = { name: displayName(l), lastName: l.lastName, kingdom: f.kingdom, spouse: sp?.name, child: kid?.name, craft: crafts[0], judged: judge(l), age: l.age };
  for (const [k, u] of Object.entries(UNLOCKS)) if (u.test(l) && !s.ftUnlocks?.includes(k)) s.ftUnlocks = [...(s.ftUnlocks ?? []), k];
  // หลุมศพอยู่ในโลกให้ชีวิตต่อไปไปเยี่ยมได้
  d.graves = [...(d.graves ?? []), { name: displayName(l), lastName: l.lastName, kingdom: f.kingdom, deed: f.deeds.at(-1), age: l.age, year: w.year }].slice(-30);
  // คนที่เล่นกับความตายหรือความมืดมากเกินไป บางครั้งไม่ได้ไปสู่ที่สงบ
  if (!d.undead && (f.mschool === "death" || (f.corruption ?? 0) >= 60) && chance(l, 0.5)) {
    d.undead = { name: displayName(l), kind: f.mschool === "death" ? "lich" : "ghost", kingdom: f.kingdom };
    recordChronicle(w, `${displayName(l)}ไม่ได้ไปสู่ที่สงบ แต่กลับมาเป็น${d.undead.kind === "lich" ? "ลิช" : "วิญญาณที่ยังวนเวียน"}ที่${homeKingdom(l).name}`);
  }
}

// ───────────── ตอนเกิดใหม่ ─────────────
/** เรียกจาก attachWorld หลังโลกเดินหน้าแล้ว */
export function welcomeSoul(l: Life, s: Soul, gap: "soon" | "far" | undefined) {
  if (!on(l)) return;
  const rank = soulRank(s);
  if (s.lives >= 3) addStat(l, "smarts", 2);
  if (s.lives >= 8) addStat(l, "luck", 2);
  if (s.lives >= 20) { addStat(l, "health", 2); addStat(l, "looks", 2); addStat(l, "happiness", 2); }
  if (s.lives >= 3) l.flags.ftSoulRank = rank[1];
  const e = s.ftEcho;
  // การพิพากษาหลังความตายเอียงชีวิตใหม่ไปเล็กน้อย · การเกิดยังสุ่มเสมอ
  if (e?.judged === "light") { addStat(l, "luck", 3); l.flags.ftGuideDue = true; }
  if (e?.judged === "shadow") { addStat(l, "happiness", -5); l.flags.ftShadowBorn = true; }
  // ร่องรอยจางๆ: ฝีมือที่มือยังจำได้ และแผ่นดินที่รู้สึกคุ้น (ไม่ใช่เรื่องราว)
  if (e?.craft) l.flags.ftEchoCraft = e.craft;
  if (e && e.kingdom === fl(l).kingdom) l.flags.ftEchoPlace = true;
  // เกิดเร็ว คนที่เคยรักยังอยู่ และนานๆ ครั้งจะรู้สึกคุ้นเคย
  if (gap === "soon" && e && (e.spouse || e.child) && chance(l, 0.4)) l.flags.ftRecog = e.spouse ?? e.child!;
  // สิ่งที่ปลดได้จากชีวิตก่อนๆ
  const u = s.ftUnlocks ?? [];
  if (u.includes("royal") && !l.flags.ftNobleBlood && chance(l, 0.12)) { l.flags.ftNobleBlood = "known"; l.wealth = "elite"; }
  if (u.includes("dragon")) { fl(l).dragonBond += 15; l.flags.ftDragonOmen = true; }
  if (u.includes("smith")) fl(l).craft = { ...fl(l).craft, smith: (fl(l).craft?.smith ?? 0) + 30 };
  if (u.includes("sage")) fl(l).craft = { ...fl(l).craft, lore: (fl(l).craft?.lore ?? 0) + 30 };
}

// ───────────── เหตุการณ์ ─────────────
const RECOG = E("ft.sl.recog", [16, 900], (l) => `หญิงชราที่ตลาดชื่อ${l.flags.ftRecog}มองคุณนาน เธอไม่รู้จักคุณ แต่เธอบอกว่าคุณยิ้มเหมือนใครบางคนที่เธอเสียไป`, [
  C("ยิ้มแล้วพูดประโยคที่คนนั้นเคยพูด", G("เธอนิ่งไปนาน แล้วจับมือคุณแน่น ไม่มีใครพูดอะไรอีก แต่ทั้งคู่รู้", { joy: 10 }, (l) => { delete l.flags.ftRecog; l.flags.ftRecognized = true; })),
  C("บอกความจริงทั้งหมด", (l) => { delete l.flags.ftRecog; if (chance(l, 0.4)) { addMoney(l, 20 * GOLD); return { text: "เธอร้องไห้ แล้วเอาของชิ้นเล็กๆ ที่เก็บไว้หลายสิบปีมาให้คุณ", kind: "milestone" as const }; } addStat(l, "happiness", -3); return { text: "เธอถอยหนีและบอกคนอื่นว่าคุณบ้า", kind: "bad" as const }; }),
  C("ทำเป็นไม่เข้าใจ", N("คุณเดินจากไป และมองย้อนกลับมาครั้งเดียว", {}, (l) => { delete l.flags.ftRecog; })),
], { title: "ใบหน้าที่คุ้นเคย", forced: true, maxTimes: 1, when: (l) => on(l) && !!l.flags.ftRecog && l.age >= 16 });
const GUIDE = E("ft.sl.guide", [8, 14], "ชายชราแปลกหน้าหยุดอยู่หน้าบ้าน บอกว่าฝันเห็นเด็กคนนี้มาสามคืนติด และขอสอนสิ่งที่รู้ให้", [
  C("ยอมให้เขาสอน", G("เขาสอนคุณทุกเย็นจนจากไปอย่างสงบในอีกหลายปีต่อมา", { iq: 3, luck: 2 }, (l) => { delete l.flags.ftGuideDue; const p = createPerson(l, "ally", { age: 70, bond: 60 }); p.job = "ผู้ชี้ทางที่มาหาคุณตอนเด็ก"; })),
  C("ไม่ไว้ใจคนแปลกหน้า", N("เขาพยักหน้าแล้วเดินจากไป และไม่กลับมาอีก", {}, (l) => { delete l.flags.ftGuideDue; })),
], { title: "ผู้ชี้ทาง", forced: true, maxTimes: 1, when: (l) => on(l) && !!l.flags.ftGuideDue });
const graveHere = (l: Life) => (D(l).graves ?? []).filter((g) => g.kingdom === fl(l).kingdom && !l.flags[`ftGrave_${g.name}`]);
const GRAVE = SCENE("ft.sl.grave", "สุสานเก่า", (l) => `ในสุสานเก่าของ${homeKingdom(l).name}มีหลุมศพที่คุณรู้สึกว่าต้องมาเยี่ยม แม้จะไม่รู้ว่าทำไม`, [
  ...[0, 1, 2].map((i) => C((l) => { const g = graveHere(l)[i]; return `หลุมศพของ${g.name}${g.deed ? ` · ${g.deed}` : ""} · อยู่ได้ ${g.age} ปี`; }, (l) => {
    const g = graveHere(l)[i]; l.flags[`ftGrave_${g.name}`] = true;
    const r = randInt(l, 0, 2);
    if (r === 0) { addStat(l, "luck", 2); return { text: `คุณวางดอกไม้บนหลุมศพของ${g.name} ลมอุ่นพัดผ่านเหมือนมีคนลูบหัว`, kind: "good" as const }; }
    if (r === 1) { addStat(l, "smarts", 2); return { text: `ระหว่างยืนหน้าหลุมศพของ${g.name} คุณนึกถึงบางอย่างที่ไม่เคยเรียน แต่รู้ว่ามันจริง`, kind: "good" as const }; }
    addStat(l, "happiness", 4); return { text: `คุณนั่งข้างหลุมศพของ${g.name}จนตะวันตก และรู้สึกเบาใจอย่างประหลาด`, kind: "good" as const };
  }, { show: (l) => !!graveHere(l)[i] })),
  C("กลับบ้าน", N("คุณเดินออกจากสุสานโดยไม่หันกลับ")),
]);
const UNDEAD = E("ft.sl.undead", [20, 900], (l) => { const u = D(l).undead!; return u.kind === "lich" ? `ลิชที่เคยเป็น${u.name}ตื่นขึ้นในหอคอยเก่า มันจำโลกนี้ได้ แต่จำตัวเองไม่ได้แล้ว` : `วิญญาณของ${u.name}ยังวนเวียนอยู่ในคฤหาสน์ร้าง และไม่มีใครกล้าเข้าไป`; }, [
  P("ปลดปล่อยมันด้วยกำลัง", (l) => fightOdds(l, D(l).undead!.kind === "lich" ? 60 : 30), (l) => { const u = D(l).undead!; u.met = true; delete (D(l) as { undead?: unknown }).undead; deed(l, `ผู้ปลดปล่อยวิญญาณของ${u.name}`); recordChronicle(worldOfLife(l), `${displayName(l)}ปลดปล่อยวิญญาณของ${u.name}ให้ไปสู่ที่สงบ`); return { text: `${u.name}สลายไปในแสงเช้า และคุณได้ยินคำขอบคุณที่ไม่มีเสียง`, kind: "milestone" as const }; }, (l) => { addStat(l, "health", -15); return { text: "มนตร์ของมันเหวี่ยงคุณออกมาจากประตู", kind: "bad" as const }; }),
  C("นั่งคุยกับมัน", G((l) => `${D(l).undead!.name}เล่าเรื่องโลกเมื่อร้อยปีก่อน และร้องไห้ตอนเล่าถึงคนที่มันเคยรัก`, { iq: 3 }, (l) => lean(l, { m: 3 }))),
  C("ปิดประตูแล้วจากไป", N("บางเรื่องในโลกนี้ปล่อยไว้ดีกว่า")),
], { title: "ผู้ที่ไม่ได้ไปสู่ที่สงบ", forced: true, maxTimes: 1, when: (l) => on(l) && !!D(l).undead && D(l).undead!.kingdom === fl(l).kingdom && Math.max(fl(l).bodyRank, fl(l).magicRank) >= 1 });

// ───────────── ความสำเร็จแรกของโลก ─────────────
export const FIRSTS: Record<string, { name: string; test: (l: Life) => boolean }> = {
  smith: { name: "ช่างตีเหล็กระดับสูงสุดคนแรกของโลก", test: (l) => craftRank(l, "smith") >= 6 },
  rider: { name: "ผู้ขี่มังกรคนแรกของโลก", test: (l) => !!fl(l).mount },
  orcking: { name: "ราชาออร์กคนแรกของโลก", test: (l) => fl(l).race === "orc" && !!fl(l).throne },
  archmage: { name: "จอมเวทระดับสูงสุดคนแรกของโลก", test: (l) => fl(l).magicRank >= 6 },
};

// ───────────── คำสุดท้าย และการรอดตายครั้งเดียว ─────────────
export const CHEAT_FAITH = 60, CHEAT_CHANCE = 0.3;
function lastWords(l: Life, cause: string): string {
  const p = personaOf(l), c = closest(l, 1)[0];
  if (/ชรา|สงบ|หลับ/.test(cause)) return c ? `คุณหลับตาลงโดยมีมือของ${shortName(c)}อยู่ในมือ` : "คุณหลับตาลงอย่างสงบ";
  if (c && p.m >= 20) return `คำสุดท้ายของคุณคือชื่อของ${shortName(c)}`;
  if (p.c >= 30) return "คุณหัวเราะออกมาครั้งสุดท้าย เหมือนรู้ว่าวันนี้ต้องมาถึง";
  if (p.h <= -30) return "คุณพยายามพูดความลับที่เก็บไว้ทั้งชีวิต แต่เสียงไม่ออกแล้ว";
  return "ในวินาทีสุดท้าย คุณนึกถึงบ้านที่เกิด";
}

// ───────────── กิจกรรม ─────────────
const M = (a: Omit<Activity, "world" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy" });
const ACTS: Activity[] = [
  M({ group: "ชีวิต", id: "ft_graves", name: "ไปสุสานเก่า", desc: "หลุมศพของคนที่เคยอยู่ในแผ่นดินนี้ · ได้พรหรือความทรงจำเล็กๆ", minAge: 10, time: 0, available: (l) => on(l) && graveHere(l).length > 0, run: (l) => { runEvent(l, "ft.sl.grave"); return { text: "" }; } }),
];

function soulYear(l: Life) {
  if (!on(l) || !l.alive) return;
  // ฝีมือที่มือยังจำได้ เริ่มรู้สึกตอนโตพอ · แผ่นดินที่คุ้นเคย
  if (l.flags.ftEchoCraft && l.age >= 12) { const k = String(l.flags.ftEchoCraft) as Craft; fl(l).craft = { ...fl(l).craft, [k]: (fl(l).craft?.[k] ?? 0) + 40 }; log(l, `มือของคุณจำ${CRAFT_NAME[k]}ได้ทั้งที่ไม่เคยเรียน ครูบอกว่าคุณเรียนเร็วผิดปกติ`, "good"); delete l.flags.ftEchoCraft; }
  if (l.flags.ftEchoPlace && l.age >= 10) { addStanding(l, 3); log(l, `บางมุมของ${homeKingdom(l).name}คุ้นตาจนน่าขนลุก เหมือนคุณเคยเดินผ่านมาแล้วหลายครั้ง`); delete l.flags.ftEchoPlace; }
  if (l.flags.ftShadowBorn && l.age === 8) log(l, "คุณฝันร้ายบ่อยตั้งแต่จำความได้ ฝันถึงสิ่งที่ไม่เคยทำ", "bad");
  if (l.flags.ftDragonOmen && l.age === 6) { log(l, "มังกรบินวนเหนือบ้านในวันเกิดอายุหกขวบของคุณ ผู้เฒ่าบอกว่านั่นคือลาง", "milestone"); delete l.flags.ftDragonOmen; }
  if (l.flags.ftSoulRank && l.age === 12) { log(l, `ผู้เฒ่าในหมู่บ้านบอกว่าคุณมีแววตาของ${l.flags.ftSoulRank}`, "milestone"); delete l.flags.ftSoulRank; }
  // ความสำเร็จแรกของโลก
  const d = D(l);
  for (const [k, x] of Object.entries(FIRSTS)) if (!d.firsts?.[k] && x.test(l)) { d.firsts = { ...d.firsts, [k]: displayName(l) }; deed(l, x.name); recordChronicle(worldOfLife(l), `${displayName(l)}กลายเป็น${x.name}`); }
}

export const SOUL2_EVENTS: GameEvent[] = [RECOG, GUIDE, GRAVE, UNDEAD];

/** เรียกหลังลงทะเบียน event ทั้งหมดแล้ว */
export function loadSouls2() {
  ACTIVITIES.push(...ACTS);
  yearHooks.push(soulYear);
  // รอดตายได้ครั้งเดียวในชีวิต ด้วยศรัทธาที่แรงพอ (ความชราไม่นับ) · ราคาคือปีของชีวิตและความสุข
  deathSaves.push((l, cause) => {
    if (!on(l) || l.flags.ftCheated || /ชรา|สงบ|หลับ|ขึ้นสู่สวรรค์/.test(cause) || !fl(l).god || personaOf(l).f < CHEAT_FAITH || !chance(l, CHEAT_CHANCE)) return false;
    l.flags.ftCheated = true; l.stats.health = Math.max(l.stats.health, 20); fl(l).lifeBonus = (fl(l).lifeBonus ?? 0) - 5; addStat(l, "happiness", -10);
    log(l, "ในวินาทีที่ลมหายใจกำลังจะหมด เทพที่คุณบูชาดึงคุณกลับมา ราคาคือห้าปีของชีวิต และความฝันร้ายที่จะตามคุณไปจนตาย", "milestone");
    return true;
  });
  // คำสุดท้าย (ไม่ช่วยให้รอด แค่บันทึกไว้)
  deathSaves.push((l, cause) => { if (on(l) && l.alive) log(l, lastWords(l, cause)); return false; });
}

/** การ์ดเรื่องเล่าชีวิตในหน้าหลังความตาย */
export function storyCard(l: Life, s: Soul): { title: string; lines: string[] }[] {
  const out: { title: string; lines: string[] }[] = [];
  const vols = volumesOf(l).filter((v) => v.beats.length);
  if (vols.length) out.push({ title: "บทต่างๆ ของชีวิต", lines: vols.map((v) => `${v.name} (อายุ ${v.from}–${v.to}): ${v.beats.filter(isTurn).slice(0, 2).map((b) => b.text).join(" · ") || v.beats[0].text}`) });
  const ppl = closest(l, 3);
  if (ppl.length) out.push({ title: "คนที่สำคัญที่สุด", lines: ppl.map((p) => `${shortName(p)} · ${p.job ?? ""}`.replace(/ · $/, "")) });
  const j = judge(l), r = soulRank(s);
  out.push({ title: "การเดินทางของวิญญาณ", lines: [`วิญญาณของคุณผ่านการพิพากษาว่า${j === "light" ? "สว่าง ชีวิตหน้าจะมีผู้ชี้ทางและโชคดีขึ้นเล็กน้อย" : j === "shadow" ? "มืด ชีวิตหน้าจะเริ่มด้วยฝันร้าย" : "ธรรมดา ชีวิตหน้าเริ่มต้นอย่างเท่าเทียม"}`, `${r[1]} · ชีวิตที่ ${s.lives + 1} ของวิญญาณนี้${r[2] ? ` · ${r[2]}` : ""}`, ...(s.ftUnlocks ?? []).map((k) => `ปลดแล้ว: ${UNLOCKS[k].name} · ${UNLOCKS[k].desc}`)] });
  return out;
}

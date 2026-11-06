// ใช้ง่ายขึ้น (Release 17): สัญญาณเตือน สิ่งที่น่าทำปีนี้ เป้าหมายชีวิต คำแนะนำครั้งแรก เหตุผลของปุ่มที่ยังทำไม่ได้ และเรื่องเล่าที่ส่งออกได้
import { ACTIVITIES, activitiesFor, activityFilters, activityLocked } from "../../engine/activities";
import { yearHooks } from "../../engine/game";
import type { Life } from "../../engine/types";
import { addFame, log } from "../../engine/util";
import { GOLD } from "./kit";
import { canBreak } from "./power";
import { deed, fl } from "./state";
import { CREDITOR_AT } from "./economy";
import { RAID_HEAT, jailed, yearsLeft } from "./underworld";

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const gold = (l: Life) => Math.floor(l.money / GOLD);

// ───────────── สัญญาณเตือน ─────────────
export interface Alert { kind: "danger" | "need" | "ready"; text: string; tab?: string }
export function alertsOf(l: Life): Alert[] {
  if (!on(l) || !l.alive) return [];
  const f = fl(l), out: Alert[] = [];
  if (l.stats.health < 30) out.push({ kind: "danger", text: `สุขภาพเหลือ ${l.stats.health} · หาหมอหรือพักผ่อน`, tab: "activities" });
  if (f.wound !== undefined) out.push({ kind: "danger", text: "มีแผลที่ยังไม่หาย · พักหรือหาหมอก่อนสิ้นปี", tab: "activities" });
  if (f.ailment) out.push({ kind: "danger", text: "พิษ คำสาป หรือโรคกำลังทรุดลงทุกปี", tab: "power" });
  if (Math.ceil(l.debt / GOLD) >= CREDITOR_AT) out.push({ kind: "danger", text: `หนี้ ${Math.ceil(l.debt / GOLD)} เหรียญทอง · เจ้าหนี้อาจมาทวง`, tab: "career" });
  if ((f.ug?.heat ?? 0) >= RAID_HEAT - 10 && !jailed(l)) out.push({ kind: "danger", text: "ยามจับตามองคุณมาก · ติดสินบนหรือเงียบไว้สักพัก", tab: "activities" });
  if (f.nemesis && !f.nemesis.dead && l.age - f.nemesis.last >= 5) out.push({ kind: "danger", text: `${f.nemesis.name}ใกล้จะกลับมาแล้ว`, tab: "power" });
  if (jailed(l)) out.push({ kind: "need", text: `ติดคุก · เหลืออีก ${yearsLeft(l)} ปี`, tab: "activities" });
  const needy = l.people.find((p) => p.alive && ["spouse", "partner", "child"].includes(p.relation) && p.bond < 25);
  if (needy) out.push({ kind: "need", text: `${needy.name}ห่างเหินจากคุณมาก`, tab: "people" });
  if (f.whelp && l.age - f.whelp.lastCare >= 1) out.push({ kind: "need", text: `${f.whelp.name}รอให้คุณดูแล`, tab: "jianghu" });
  if (f.steed && f.steed.bond < 30) out.push({ kind: "need", text: `${f.steed.name}เริ่มไม่ยอมฟังคุณ`, tab: "activities" });
  if (canBreak(l, "body") || canBreak(l, "magic")) out.push({ kind: "ready", text: "พร้อมทะลวงขั้นแล้ว · จะมีบททดสอบตอนขึ้นปีใหม่", tab: "power" });
  if (l.job && l.job.performance >= 80 && l.job.level < 5) out.push({ kind: "ready", text: "ผลงานดีพอจะได้เลื่อนขั้น", tab: "career" });
  if (f.egg && f.egg.warmth >= 3) out.push({ kind: "ready", text: "ไข่มังกรใกล้ฟักแล้ว", tab: "jianghu" });
  return out.slice(0, 4);
}

// ───────────── สิ่งที่น่าทำปีนี้ ─────────────
const want = (l: Life, id: string, why: string) => { const a = ACTIVITIES.find((x) => x.id === id); return a && activitiesFor(l).includes(a) && !activityLocked(l, a) ? { id, name: a.name, why } : undefined; };
export function suggestionsOf(l: Life): { id: string; name: string; why: string }[] {
  if (!on(l) || l.age < 6) return [];
  const f = fl(l);
  const picks = [
    f.wound !== undefined || l.stats.health < 40 ? want(l, "ft_healer", "รักษาแผลก่อนจะกลายเป็นแผลถาวร") ?? want(l, "ft_rest", "พักให้แผลหาย") : undefined,
    f.ailment ? (f.ailment.kind === "curse" ? want(l, "ft_h_temple", "ไปวิหารเพื่อแก้คำสาป") : want(l, "ft_healer", "หาหมอรักษาพิษหรือโรค")) : undefined,
    jailed(l) ? want(l, "ft_p_plan", "เตรียมแผนไว้ก่อน") ?? want(l, "ft_p_learn", "เรียนจากนักโทษ") : undefined,
    gold(l) < 3 && !l.job ? want(l, "ft_oddjob", "หาเงินพอประทังชีวิต") : undefined,
    f.pet && f.pet.bond < 40 ? want(l, "ft_h_petplay", `${f.pet.name}เหงา`) : undefined,
    f.steed && f.steed.bond < 50 ? want(l, "ft_steed", `${f.steed.name}ต้องการคนดูแล`) : undefined,
    f.whelp && l.age - f.whelp.lastCare >= 1 ? want(l, "ft_whelp", `${f.whelp.name}รอคุณอยู่`) : undefined,
    ...goalSteps(l),
    l.age >= 6 && l.age < 40 && !canBreak(l, "body") ? want(l, "ft_train", "ฝึกต่อเพื่อเข้าใกล้ขั้นต่อไป") : undefined,
  ].filter(Boolean) as { id: string; name: string; why: string }[];
  const seen = new Set<string>();
  return picks.filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 3);
}

// ───────────── เป้าหมายชีวิต (เลือกได้ 1–3) ─────────────
export interface Goal { id: string; name: string; progress: (l: Life) => number; next: (l: Life) => string; step?: string }
export const GOALS: Goal[] = [
  { id: "throne", name: "ครองบัลลังก์", progress: (l) => (fl(l).throne ? 1 : Math.min(0.9, (fl(l).court?.rank ?? 0) / 4)), next: (l) => ((fl(l).court?.rank ?? 0) ? "ไต่ขั้นในราชสำนักต่อไป" : "เข้าเฝ้าในราชสำนัก (ต้องเป็นคหบดีขึ้นไปหรือมีชื่อเสียง)"), step: "ft_court" },
  { id: "master", name: "เป็นนายใหญ่ของอาชีพ", progress: (l) => (l.job ? l.job.level / 5 : 0), next: (l) => (l.job ? "ทำผลงานให้ถึง 80 เพื่อเลื่อนขั้น" : "หางานที่แท็บอาชีพ") },
  { id: "rich", name: "สะสมทอง 1,000 เหรียญ", progress: (l) => Math.min(1, gold(l) / 1000), next: () => "ลงทุน เปิดกิจการ หรือซื้อที่ดิน", step: "ft_invest" },
  { id: "warrior", name: "เป็นยอดนักรบ", progress: (l) => Math.min(1, fl(l).bodyRank / 3), next: () => "ฝึกดาบทุกปี และผ่านบททดสอบการทะลวงขั้น", step: "ft_train" },
  { id: "family", name: "มีลูกหลานห้าคน", progress: (l) => Math.min(1, l.people.filter((p) => p.alive && (p.relation === "child" || p.relation === "grandchild")).length / 5), next: (l) => (l.people.some((p) => p.alive && p.relation === "spouse") ? "ใช้เวลากับคู่ครองและครอบครัว" : "มองหาคู่ครอง"), step: "ft_match" },
  { id: "relic", name: "ได้อาวุธตำนาน", progress: (l) => (fl(l).relic ? 1 : Math.min(0.9, Math.max(0, ...Object.values(fl(l).clues ?? {})) / 4)), next: () => "สืบหาอาวุธตำนานจากเบาะแส", step: "ft_legend" },
  { id: "legend", name: "เป็นตำนานที่โลกจำ", progress: (l) => Math.min(1, l.fame / 80), next: () => "ทำสิ่งยิ่งใหญ่ที่คนจะเล่าต่อ" },
  { id: "dragon", name: "เลี้ยงมังกรของตัวเอง", progress: (l) => (fl(l).whelp ? 1 : fl(l).egg ? 0.5 : 0), next: () => "หาไข่มังกร หรือผูกมิตรกับมังกร" },
];
const goals = (l: Life) => fl(l).goals ?? [];
export const goalsOf = (l: Life) => goals(l).map((id) => GOALS.find((g) => g.id === id)!).filter(Boolean);
export const MAX_GOALS = 3;
export function setGoal(l: Life, id: string, onOff: boolean) {
  const f = fl(l);
  const g = goals(l).filter((x) => x !== id);
  f.goals = onOff && g.length < MAX_GOALS ? [...g, id] : g;
}
function goalSteps(l: Life) {
  return goalsOf(l).filter((g) => g.progress(l) < 1 && g.step).map((g) => want(l, g.step!, `ก้าวต่อไปของเป้าหมาย「${g.name}」`));
}
function goalYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const f = fl(l);
  for (const g of goalsOf(l)) if (g.progress(l) >= 1 && !f.goalsDone?.includes(g.id)) {
    f.goalsDone = [...(f.goalsDone ?? []), g.id];
    deed(l, `บรรลุเป้าหมายชีวิต: ${g.name}`); addFame(l, 3);
    log(l, `คุณทำเป้าหมายที่ตั้งไว้สำเร็จ:「${g.name}」`, "milestone");
  }
}
export const goalDone = (l: Life, id: string) => !!fl(l).goalsDone?.includes(id);

// ───────────── คำแนะนำครั้งแรกของแต่ละหมวด ─────────────
export const GROUP_HINTS: Record<string, string> = {
  "ทางมืด": "เส้นทางโจร: ยิ่งทำงานให้กิลด์ ยามยิ่งจับตา ความร้อนถึง 60 ยามจะบุกบ้าน",
  "ชีวิตในคุก": "ในคุกทำได้แค่สิ่งในหมวดนี้ วางแผนแหกคุกได้ปีละขั้น หรือรอพ้นโทษ",
  "เงิน": "ลงทุนได้ผลในอีกไม่กี่ปี ปล่อยกู้มีคนไม่คืน ที่ดินมีผู้เช่าที่ต้องดูแล",
  "สัตว์": "สัตว์ขี่ช่วยสู้และเดินทาง ต้องดูแลทุกปี ไม่งั้นมันจะดื้อหรือหนี",
  "ตำนาน": "อาวุธตำนานใช้ได้ในฉากต่อสู้ปีละครั้ง สิ่งมหัศจรรย์มีคนค้นพบได้คนเดียวต่อโลก",
  "การงาน": "งานเสริม กิจการ และสมาคมช่วยการงาน ปุ่มที่ยังไม่ถึงเวลาจะซ่อนไว้",
  "ผจญภัย": "งานอันตรายพลาดแล้วมักแค่เจ็บ แต่แผลที่ไม่รักษาอาจกลายเป็นแผลถาวร",
  "สังคม": "เข้าเฝ้าในราชสำนักเพื่อไต่ขั้น อุทิศตนให้เทพเพื่อรับพรทุกปี",
};

// ───────────── เรื่องเล่าที่ส่งออกได้ ─────────────
export function storyText(l: Life): string {
  const lines = [`${l.firstName} ${l.lastName}`, `อายุ ${l.age} ปี${l.alive ? "" : ` · ${l.causeOfDeath ?? ""}`}`, ""];
  let age = -1;
  for (const e of l.log) {
    if (e.age !== age) { age = e.age; lines.push("", `── อายุ ${age} ──`); }
    lines.push(e.text);
  }
  return lines.join("\n");
}

/** เหตุผลของปุ่มที่ยังทำไม่ได้ */
const NEED: Record<string, (l: Life) => string | undefined> = {
  ft_contract: () => "ต้องสมัครกิลด์นักผจญภัยก่อน",
  ft_bounty: () => "ต้องเป็นกิลด์ขั้นที่สองขึ้นไป",
  ft_guildboard: (l) => (fl(l).guild ? "ปีนี้ดูกระดานไปแล้ว" : "ต้องสมัครกิลด์นักผจญภัยก่อน"),
  ft_seclude: () => "ต้องเป็นนักรบหรือผู้ฝึกหัดเวทขึ้นไป และว่างจากการเก็บตัวครั้งก่อนห้าปี",
  ft_study: () => "ต้องร่ายเวทได้ (ซื้อคทาที่ร้านคทา)",
  ft_tguild: () => "ต้องทำงานในสายช่าง การค้า ศิลปะ หรือการเดินทาง",
  ft_court: () => "ต้องเป็นคหบดีขึ้นไป หรือมีชื่อเสียง 30",
  ft_invest: () => "ต้องมีเงิน 20 เหรียญทองขึ้นไป",
  ft_lend: () => "ต้องมีเงิน 20 เหรียญทองขึ้นไป",
  ft_land: () => "ต้องมีเงิน 60 เหรียญทองสำหรับไร่แปลงแรก",
  ft_reforge: () => "ต้องมีฝีมือช่างขั้นชำนาญ และมีอาวุธติดตัว",
  ft_style: (l) => (fl(l).style ? `เปลี่ยนได้อีกครั้งตอนอายุ ${Number(l.flags.ftStyleNext ?? 0)}` : "ต้องเลือกสายอาวุธก่อน"),
};

export function loadEase() {
  yearHooks.push(goalYear);
  for (const [id, need] of Object.entries(NEED)) { const a = ACTIVITIES.find((x) => x.id === id); if (a && !a.need) a.need = need; }
  // ปุ่มที่ใช้ได้เฉพาะตอนเก็บตัวบนเขา ไม่ต้องขึ้นตอนอยู่ในเมือง
  activityFilters.push((l, a) => a.id !== "ft_unseclude" || !a.available || a.available(l));
}

// วังหลังและราชวงศ์ของผู้เล่น (คำขอของผู้เล่น: เป็นฮ่องเต้แล้วครอบครัวไม่ได้มาด้วย ยังไม่มีสนม ระบบน้อยเกินไป)
// · ขึ้นครองราชย์แล้ว ครอบครัวเข้าวังพร้อมพระอิสริยยศ: แม่ = ไทเฮา · พ่อ = ไท่ซ่างหวง · พี่น้อง = อ๋อง/องค์หญิงใหญ่ · ลูก = องค์ชาย/องค์หญิง · คู่ชีวิต = ฮองเฮา/พระราชสวามี
// · วังหลังเต็มรูปแบบ: คัดเลือกสนม (ฮ่องเต้หญิงมีสนมชาย) · เลื่อน/ลดขั้น · ตำหนักเย็น · คนโปรดและความริษยา · ตระกูลสนมทวงผลประโยชน์
//   สนมวางแผนต่อลูกของกันและกัน · องค์ชายต่างมารดาแข่งชิงตำแหน่งรัชทายาท · คลอดลูกอาจไม่รอด
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { feel } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Gender, Life, Person } from "../../../engine/types";
import { addStat, clamp, createPerson, log, people, shortName } from "../../../engine/util";
import { calYear } from "../life/world";
import { B, BIG, C, E, G, K, N, NEXT, P, PAY, ab, kinDies, nm, type Res } from "../story/kit";
import { palaceOf } from "./palace";

export type ConsortTrait = "gentle" | "ambitious" | "clever" | "proud";
export interface Consort {
  pid: string;
  /** 0–5 · 5 = ฮองเฮา/พระราชสวามี (มีได้คนเดียว) */
  rank: number;
  clan: string;
  trait: ConsortTrait;
  since: number;
  /** ส่งไปตำหนักเย็นแล้ว */
  cold?: boolean;
  /** จำนวนคืนที่ฮ่องเต้เสด็จ · ปีล่าสุดที่เสด็จ (อายุผู้เล่น) */
  nights: number;
  lastNight?: number;
  /** ความริษยา/ความแค้นสะสม 0–100 */
  resent: number;
}

const RANK_F = ["ไฉเหริน", "กุ้ยเหริน", "เจาอี๋", "เฟย", "กุ้ยเฟย", "ฮองเฮา"];
const RANK_M = ["นายในชั้นตรี", "นายในชั้นโท", "นายในชั้นเอก", "พระสนมชาย", "พระสนมเอกชาย", "พระราชสวามี"];
export const EMPRESS = 5;
const CLANS = ["ตระกูลหวัง", "ตระกูลเซี่ย", "ตระกูลหยาง", "ตระกูลตู้กู", "ตระกูลเหลียง", "ตระกูลจ่าง", "ตระกูลซู", "ตระกูลหลู"];
export const TRAIT_NAME: Record<ConsortTrait, string> = { gentle: "อ่อนโยน", ambitious: "ทะเยอทะยาน", clever: "เฉลียวฉลาด", proud: "หยิ่งทะนง" };
const TRAITS = Object.keys(TRAIT_NAME) as ConsortTrait[];

const emp = (l: Life) => l.worldId === "murim" && !!l.flags.emperorSelf;
const alive = (l: Life, id: string) => l.people.find((p) => p.id === id && p.alive);
export const haremOf = (l: Life): Consort[] => (l.mw?.harem ?? []).filter((c) => alive(l, c.pid));
export const consortP = (l: Life, c: Consort) => alive(l, c.pid)!;
const byPid = (l: Life, pid: unknown) => haremOf(l).find((c) => c.pid === pid);
export const rankName = (p: Person, r: number) => (p.gender === "m" ? RANK_M : RANK_F)[clamp(r, 0, EMPRESS)];
export const consortLabel = (l: Life, c: Consort) => `${c.cold ? "ตำหนักเย็น" : rankName(consortP(l, c), c.rank)}${shortName(consortP(l, c))}`;

export function setTitle(p: Person, t?: string) {
  p.tags = (p.tags ?? []).filter((x) => !x.startsWith("title:"));
  if (t) p.tags.push(`title:${t}`);
}
function retitle(l: Life, c: Consort) {
  const p = alive(l, c.pid);
  if (p) setTitle(p, c.cold ? `${rankName(p, c.rank)} (ตำหนักเย็น)` : rankName(p, c.rank));
}
export const empressOf = (l: Life) => haremOf(l).find((c) => c.rank === EMPRESS && !c.cold);
/** คนโปรด: ความผูกพันกับจำนวนคืนที่เสด็จ */
export const favourite = (l: Life) => haremOf(l).filter((c) => !c.cold).sort((a, b) => consortP(l, b).bond + b.nights * 3 - (consortP(l, a).bond + a.nights * 3))[0];
export function setConsortRank(l: Life, c: Consort, r: number) {
  const to = clamp(r, 0, EMPRESS);
  if (to === EMPRESS) { const e = empressOf(l); if (e && e !== c) { e.rank = 4; retitle(l, e); } }
  c.rank = to;
  c.cold = false;
  retitle(l, c);
}
/** เพศของสนมที่ถูกคัดเข้าวัง: ฮ่องเต้ชาย = สนมหญิง · ฮ่องเต้หญิง = สนมชาย · ถ้ารักเพศเดียวกัน บางคนเป็นเพศเดียวกัน */
export const consortGender = (l: Life): Gender => (l.flags.lovesSameSex && chance(l, 0.5) ? l.gender : l.gender === "m" ? "f" : "m");
export function addConsort(l: Life, o: { gender: Gender; age: number; clan?: string; trait?: ConsortTrait; rank?: number; bond?: number }): Person {
  const clan = o.clan ?? pick(l, CLANS);
  // แซ่ของสนมตรงกับตระกูลที่ส่งเข้าวัง (ตระกูลจ่าง = แซ่จ่าง)
  const p = createPerson(l, "spouse", { gender: o.gender, age: o.age, bond: o.bond ?? 40, lastName: CLANS.includes(clan) ? clan.slice("ตระกูล".length) : undefined });
  p.tags = [...(p.tags ?? []), "secondary", "consort"];
  const c: Consort = { pid: p.id, rank: 0, clan, trait: o.trait ?? pick(l, TRAITS), since: calYear(l), nights: 0, resent: 0 };
  (l.mw!.harem ??= []).push(c);
  setConsortRank(l, c, o.rank ?? 0);
  return p;
}

const siblingTitle = (l: Life, p: Person) => (p.gender === "m" ? `ท่านอ๋อง · ${p.age > l.age ? "พระเชษฐา" : "พระอนุชา"}` : `องค์หญิงใหญ่ · ${p.age > l.age ? "พระพี่นาง" : "พระน้องนาง"}`);
const childTitle = (l: Life, p: Person) => `${p.gender === "f" ? "องค์หญิง" : "องค์ชาย"}${l.flags.heirId === p.id ? " · รัชทายาท" : ""}`;
/** ครอบครัวเข้าวังพร้อมพระอิสริยยศ (เรียกทุกปีขณะครองราชย์ — คนใหม่ในครอบครัวได้ตำแหน่งด้วย) */
export function royalize(l: Life) {
  if (!emp(l) || !l.mw) return;
  l.mw.harem ??= [];
  const first = !l.flags.royalized;
  for (const p of l.people) {
    if (!p.alive) continue;
    if (p.relation === "mother") setTitle(p, "ไทเฮา · พระพันปีหลวง");
    else if (p.relation === "father") setTitle(p, "ไท่ซ่างหวง · พระราชบิดา");
    else if (p.relation === "sibling") setTitle(p, siblingTitle(l, p));
    else if (p.relation === "child") setTitle(p, childTitle(l, p));
    else if (p.relation === "spouse" && !byPid(l, p.id)) {
      const main = !p.tags?.includes("secondary");
      l.mw.harem.push({ pid: p.id, rank: 0, clan: "ตระกูลเดิมก่อนขึ้นครองราชย์", trait: "gentle", since: calYear(l), nights: 0, resent: 0 });
      setConsortRank(l, byPid(l, p.id)!, main && !empressOf(l) ? EMPRESS : 3);
    }
  }
  if (first) {
    l.flags.royalized = true;
    const fam = l.people.filter((p) => p.alive && ["mother", "father", "sibling", "spouse", "child"].includes(p.relation));
    if (fam.length) log(l, `🏯 ครอบครัวของคุณย้ายเข้าวังหลวง — ${fam.slice(0, 6).map((p) => `${shortName(p)} (${p.tags?.find((t) => t.startsWith("title:"))?.slice(6) ?? ""})`).join(" · ")}`, "milestone");
  }
}
/** เสียบัลลังก์: พระอิสริยยศหายไป สนมที่คัดเข้าวังแยกย้าย (คู่ชีวิตเดิมยังอยู่) */
export function unroyalize(l: Life) {
  for (const p of l.people) {
    if (!p.tags?.some((t) => t.startsWith("title:"))) continue;
    setTitle(p);
    if (p.alive && p.tags.includes("consort")) {
      p.relation = "friend";
      p.tags = p.tags.filter((t) => t !== "consort" && t !== "secondary");
      p.bond = Math.min(p.bond, 30);
    }
  }
  if (l.mw) l.mw.harem = undefined;
  delete l.flags.royalized;
}

// ───────── ทุกปี: คลอดลูก · ความริษยา · ตำหนักเย็น ─────────
function birth(l: Life, c: Consort) {
  const p = consortP(l, c);
  const kid = createPerson(l, "child", { age: 0, bond: 80, lastName: l.lastName });
  kid.tags = [...(kid.tags ?? []), `parent:${c.pid}`];
  setTitle(kid, childTitle(l, kid));
  feel(p, { love: 8, trust: 5 });
  addStat(l, "happiness", 8);
  log(l, `👶 ${consortLabel(l, c)}${l.gender === "f" && p.gender === "m" ? "กับคุณได้" : "ประสูติ"}${kid.gender === "m" ? "พระโอรส" : "พระธิดา"} — ${shortName(kid)} · ทั้งวังจุดโคมแดงเจ็ดวัน`, "milestone");
  // คลอดในยุคนี้คือการเดินผ่านความตาย
  if (p.gender === "f" && chance(l, 0.05)) {
    const who = consortLabel(l, c);
    p.alive = false;
    addStat(l, "happiness", -15);
    log(l, `🕯️ ${who}สิ้นใจหลังคลอดได้สามวัน — ทิ้งลูกน้อยไว้ในอ้อมแขนแม่นม`, "bad");
  }
}
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || !l.mw) return;
  if (!emp(l)) { if (l.flags.royalized && !l.flags.retiredEmperor) unroyalize(l); return; }
  royalize(l);
  for (const c of haremOf(l)) {
    const p = consortP(l, c);
    const visited = c.lastNight === l.age - 1;
    const mother = p.gender === "f" ? p : l.gender === "f" ? l : undefined;
    if (visited && p.gender !== l.gender && mother && mother.age <= 42 && chance(l, 0.32 + p.bond / 400)) birth(l, c);
    if (!alive(l, c.pid)) continue;
    if (visited) c.resent = clamp(c.resent - 12, 0, 100);
    else if (!c.cold) c.resent = clamp(c.resent + (c.trait === "ambitious" || c.trait === "proud" ? 7 : 3), 0, 100);
    if (c.cold) p.bond = clamp(p.bond - 4, 0, 100);
    if (p.age >= 70 && chance(l, 0.08)) p.alive = false;
  }
  // ค่าใช้จ่ายวังหลัง
  const pal = palaceOf(l);
  pal.treasury = clamp(pal.treasury - Math.floor(haremOf(l).length / 3), 0, 100);
});

// ───────── ฉากในวังหลัง ─────────
/** ผลที่เกิดกับเด็กในฉาก (ctx.kid) แทนสนมในฉาก (ctx.pid) */
const onKid = (r: Res): Res => Object.assign((l: Life, c: Ctx) => { const save = c.pid; c.pid = c.kid; const o = r(l, c); c.pid = save; return o; }, { fx: r.fx });
const bump = (p: Person, d: number) => { p.bond = clamp(p.bond + d, 0, 100); };
const with_ = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { f(l, c); return r(l, c); }, { fx: r.fx });
const slot = (i: number) => (l: Life) => haremOf(l).filter((c) => !c.cold).sort((a, b) => b.rank - a.rank || consortP(l, b).bond - consortP(l, a).bond)[i];
const anySlot = (i: number) => (l: Life) => haremOf(l).slice().sort((a, b) => Number(a.cold) - Number(b.cold) || b.rank - a.rank)[i];
const ctxC = (l: Life, c: Ctx) => byPid(l, c.pid);
const cn = (l: Life, c: Ctx) => { const k = ctxC(l, c); return k ? consortLabel(l, k) : "สนมคนนั้น"; };
/** ลูกของสนมคนนี้ */
const kidsOf = (l: Life, pid: string) => people(l, "child").filter((k) => k.alive && k.tags?.includes(`parent:${pid}`));
const sons = (l: Life) => people(l, "child").filter((k) => k.alive && k.gender === "m" && k.age >= 8);
const motherOf = (l: Life, k: Person) => byPid(l, k.tags?.find((t) => t.startsWith("parent:"))?.slice(7));

const visit = (i: number) => C(
  (l: Life) => { const c = slot(i)(l); return c ? `${consortLabel(l, c)} (${TRAIT_NAME[c.trait]} · ${consortP(l, c).age} ปี)` : "—"; },
  with_(G((l) => `คืนนี้ตำหนักของ${consortLabel(l, slot(i)(l)!)}จุดโคมแดงหน้าประตู — ทั้งวังหลังรู้ภายในหนึ่งก้านธูปว่าคุณเสด็จไปที่ไหน`, { joy: 4 }), (l) => {
    const c = slot(i)(l)!;
    c.nights++;
    c.lastNight = l.age;
    const p = consortP(l, c);
    p.bond = clamp(p.bond + 7, 0, 100);
    feel(p, { love: 5 });
    for (const o of haremOf(l)) if (o !== c && !o.cold) o.resent = clamp(o.resent + 3, 0, 100);
  }),
  { show: (l) => !!slot(i)(l) },
);

const pickFor = (i: number, label: string) => C(
  (l: Life) => { const c = anySlot(i)(l); return c ? `${consortLabel(l, c)} — ${TRAIT_NAME[c.trait]} · ${c.clan} · ลูก ${kidsOf(l, c.pid).length}` : "—"; },
  (l, c) => { c.pid = anySlot(i)(l)!.pid; return NEXT("act", label)(l, c); },
  { show: (l) => !!anySlot(i)(l) },
);

/** ผู้เข้าคัดเลือกสนม 3 คน (เก็บใน ctx) */
function candidates(l: Life): Ctx {
  const c: Ctx = {};
  for (let i = 0; i < 3; i++) {
    c[`g${i}`] = consortGender(l);
    c[`a${i}`] = randInt(l, 16, 24);
    c[`c${i}`] = pick(l, CLANS);
    c[`t${i}`] = pick(l, TRAITS);
  }
  return c;
}
const cand = (i: number) => C(
  (_l: Life, c: Ctx) => `${c[`g${i}`] === "m" ? "บุรุษรูปงาม" : "สาวงาม"}จาก${c[`c${i}`]} อายุ ${c[`a${i}`]} — ${TRAIT_NAME[c[`t${i}`] as ConsortTrait]}`,
  (l, c) => {
    const p = addConsort(l, { gender: c[`g${i}`] as Gender, age: Number(c[`a${i}`]), clan: String(c[`c${i}`]), trait: c[`t${i}`] as ConsortTrait });
    const t = c[`t${i}`] as ConsortTrait;
    return BIG(`${shortName(p)}จาก${c[`c${i}`]}เข้าวังในเกี้ยวสีชมพู ได้ตำแหน่ง${rankName(p, 0)} — ${t === "ambitious" ? "สายตาคู่นั้นมองบัลลังก์ฮองเฮาตั้งแต่ก้าวแรก" : t === "clever" ? "อ่านหนังสือได้ทุกเล่มในหอตำรา และจำทุกคำที่คุณพูด" : t === "proud" ? "ไม่ยอมก้มหัวให้สนมคนไหนตั้งแต่วันแรก" : "ยิ้มให้ขันทีแก่ที่ถือโคมนำทางด้วย"}`, { joy: 3 })(l, c);
  },
);

export const HAREM_EVENTS: GameEvent[] = [
  E("ct.h_select", [16, 80], (l) => `พิธีคัดเลือก${l.gender === "f" ? "นายใน" : "นางใน"}ประจำปี — ตระกูลขุนนางทั่วแผ่นดินส่งลูกหลานมาเข้าแถวหน้าตำหนัก สามคนสุดท้ายยืนรอคำตัดสินของคุณ (วังหลังตอนนี้มี ${haremOf(l).length} คน)`, [
    cand(0), cand(1), cand(2),
    C("ไม่รับใครปีนี้", N("ทั้งสามคนถูกส่งกลับบ้าน — ตระกูลของพวกเขาผิดหวัง แต่ท้องพระคลังโล่งใจ", {})),
  ], { prepare: candidates, when: emp, weight: 0, maxTimes: 0, title: "คัดเลือกเข้าวังหลัง" }),

  E("ct.h_night", [16, 90], (l) => `ขันทีถือแผ่นป้ายหยกชื่อ${l.gender === "f" ? "นายใน" : "สนม"}ทุกคนมาวางบนถาดเงิน — คืนนี้คุณจะเสด็จตำหนักไหน${favourite(l) ? ` (คนโปรดตอนนี้: ${consortLabel(l, favourite(l)!)})` : ""}`, [
    visit(0), visit(1), visit(2), visit(3), visit(4),
    C("บรรทมคนเดียว", N("คืนนั้นทั้งวังหลังนอนไม่หลับ — ทุกคนคิดว่าคุณกำลังโกรธใครสักคน")),
  ], { when: (l) => emp(l) && haremOf(l).some((c) => !c.cold), weight: 0, maxTimes: 0, title: "ป้ายหยกบนถาดเงิน" }),

  E("ct.h_ranks", [16, 100], "ขันทีหัวหน้าฝ่ายในถวายทะเบียนวังหลัง — ตำแหน่งของใครจะขึ้น ใครจะลง อยู่ในพระหัตถ์ของคุณ", [
    pickFor(0, "เลือกแล้ว — จะทำอะไรกับคนนี้"), pickFor(1, "เลือกแล้ว — จะทำอะไรกับคนนี้"), pickFor(2, "เลือกแล้ว — จะทำอะไรกับคนนี้"), pickFor(3, "เลือกแล้ว — จะทำอะไรกับคนนี้"), pickFor(4, "เลือกแล้ว — จะทำอะไรกับคนนี้"), pickFor(5, "เลือกแล้ว — จะทำอะไรกับคนนี้"),
    C("ปิดทะเบียน", N("ทุกอย่างคงเดิม — วังหลังถอนหายใจพร้อมกัน")),
  ], {
    when: (l) => emp(l) && haremOf(l).length > 0,
    weight: 0,
    maxTimes: 0,
    title: "ทะเบียนวังหลัง",
    scenes: {
      act: {
        text: (l, c) => { const k = ctxC(l, c); return k ? `${consortLabel(l, k)} (${TRAIT_NAME[k.trait]} · ${k.clan}) คุกเข่ารอฟังพระราชโองการ — ความผูกพัน ${consortP(l, k).bond}/100 · ความริษยาที่สะสม ${k.resent}/100` : "คนผู้นั้นไม่อยู่แล้ว"; },
        choices: [
          C("เลื่อนขึ้นหนึ่งขั้น", with_(G((l, c) => `${cn(l, c)}กราบสามครั้งจนหน้าผากแดง — ตระกูลของเขาจัดงานเลี้ยงเจ็ดวัน`, {}), (l, c) => { const k = ctxC(l, c); if (k) { setConsortRank(l, k, k.rank + 1); bump(consortP(l, k), 8); for (const o of haremOf(l)) if (o !== k) o.resent = clamp(o.resent + 6, 0, 100); } }), { show: (l, c) => { const k = ctxC(l, c); return !!k && !k.cold && k.rank < EMPRESS - 1; } }),
          C((l, c) => `สถาปนาเป็น${ctxC(l, c) ? rankName(consortP(l, ctxC(l, c)!), EMPRESS) : "ฮองเฮา"}`, with_(BIG((l, c) => `พิธีสถาปนาที่ตำหนักคุนหนิง — ${cn(l, c)}รับตราประทับหงส์ทอง${empressOf(l) && empressOf(l)!.pid !== c.pid ? " ฮองเฮาองค์เดิมถูกลดลงเป็นกุ้ยเฟย และจะไม่ลืมวันนี้" : ""}`, { fame: 2 }), (l, c) => { const old = empressOf(l); const k = ctxC(l, c); if (!k) return; if (old && old !== k) { old.resent = clamp(old.resent + 50, 0, 100); feel(consortP(l, old), { grudge: 40, love: -20 }); } setConsortRank(l, k, EMPRESS); }), { show: (l, c) => { const k = ctxC(l, c); return !!k && !k.cold && k.rank < EMPRESS; } }),
          C("ลดขั้นลงหนึ่งขั้น", with_(B((l, c) => `${cn(l, c)}ร้องไห้จนเช้า — คนในตำหนักเริ่มเก็บของย้ายไปรับใช้คนอื่น`, {}), (l, c) => { const k = ctxC(l, c); if (k) { setConsortRank(l, k, k.rank - 1); k.resent = clamp(k.resent + 25, 0, 100); feel(consortP(l, k), { grudge: 20, love: -10 }); } }), { show: (l, c) => { const k = ctxC(l, c); return !!k && !k.cold && k.rank > 0; } }),
          C("ส่งไปตำหนักเย็น", with_(B((l, c) => `ประตูตำหนักเย็นปิดลงข้างหลัง${cn(l, c)} — ที่นั่นมีแต่ใบไม้แห้งกับเสียงลม`, { align: -2 }), (l, c) => { const k = ctxC(l, c); if (k) { k.cold = true; retitle(l, k); k.resent = clamp(k.resent + 40, 0, 100); feel(consortP(l, k), { grudge: 40, love: -30 }); } }), { show: (l, c) => !!ctxC(l, c) && !ctxC(l, c)!.cold }),
          C("เรียกกลับจากตำหนักเย็น", with_(G((l, c) => `${cn(l, c)}เดินออกจากตำหนักเย็นด้วยผมที่หงอกขึ้นครึ่งศีรษะ — คุกเข่าขอบพระทัยโดยไม่พูดอะไรอีก`, { align: 2 }), (l, c) => { const k = ctxC(l, c); if (k) { const taken = k.rank === EMPRESS && !!empressOf(l); k.cold = false; setConsortRank(l, k, taken ? EMPRESS - 1 : k.rank); k.resent = clamp(k.resent - 30, 0, 100); feel(consortP(l, k), { debt: 30 }); } }), { show: (l, c) => !!ctxC(l, c)?.cold }),
          C("ปล่อยออกจากวัง ให้กลับบ้านไปแต่งงานใหม่", with_(N((l, c) => `${cn(l, c)}ออกจากประตูวังพร้อมหีบสินเดิมหนึ่งใบ — บางคนว่าเป็นพระเมตตา บางคนว่าเป็นความอัปยศ`, { align: 2 }), (l, c) => { const k = ctxC(l, c); if (!k) return; const p = consortP(l, k); setTitle(p); p.relation = "friend"; p.tags = (p.tags ?? []).filter((t) => t !== "consort" && t !== "secondary"); l.mw!.harem = (l.mw!.harem ?? []).filter((x) => x !== k); }), { show: (l, c) => { const k = ctxC(l, c); return !!k && consortP(l, k).tags?.includes("consort") === true && kidsOf(l, k.pid).length === 0; } }),
          C("ไม่เปลี่ยนอะไร", N("คุณพยักหน้าแล้วโบกมือให้ถอยออกไป")),
        ],
      },
    },
  }),

  // ───── ความริษยาและแผนร้ายในวังหลัง ─────
  E("ct.h_poison_child", [20, 100], (l, c) => `${nm(l, { pid: c.kid })}อาเจียนเป็นเลือดหลังกินขนมที่ส่งมาจากตำหนักของ${cn(l, c)} — หมอหลวงบอกว่าเป็นพิษ ${consortLabel(l, motherOf(l, l.people.find((p) => p.id === c.kid)!) ?? haremOf(l)[0])}มารดาของเด็กคุกเข่าร้องไห้ขอความเป็นธรรมกลางลาน`, [
    K("สอบสวนเองทุกคนที่แตะขนม", "smarts", 60, with_(BIG((l, c) => `คุณพบว่านางกำนัลถูกจ้างให้ใส่ยา — คนจ้างไม่ใช่${cn(l, c)} แต่เป็นคนที่อยากให้คุณลงโทษ${cn(l, c)} แผนซ้อนแผนในวังหลังพังลงในคืนเดียว`, { iq: 1 }), (l, c) => { const k = ctxC(l, c); if (k) feel(consortP(l, k), { debt: 30, trust: 20 }); const r = haremOf(l).filter((x) => x.pid !== c.pid && x.trait === "ambitious").sort((a, b) => b.resent - a.resent)[0]; if (r) { r.cold = true; retitle(l, r); } }), with_(B("หลักฐานทุกชิ้นชี้ไปทางเดียวกัน — คุณสั่งลงโทษตามหลักฐาน แต่ไม่แน่ใจว่าลงโทษถูกคน", {}), (l, c) => { const k = ctxC(l, c); if (k) { k.cold = true; retitle(l, k); feel(consortP(l, k), { grudge: 50 }); } })),
    C("ลงโทษตามหลักฐานทันที", with_(N((l, c) => `${cn(l, c)}ถูกลากไปตำหนักเย็นทั้งที่ยังตะโกนว่าไม่ได้ทำ`, { align: -2 }), (l, c) => { const k = ctxC(l, c); if (k) { k.cold = true; retitle(l, k); feel(consortP(l, k), { grudge: 60 }); } })),
    P("เฝ้าไข้ลูกเองทั้งคืน ให้หมอเทวดามารักษา", ab(0.6, "luck"), G((l, c) => `ตอนฟ้าสาง${nm(l, { pid: c.kid })}ลืมตาเรียกหาคุณ — เด็กรอด และจำได้ว่าใครนั่งอยู่ข้างเตียง`, { hp: -2 }), onKid(kinDies("ยาทุกขนานไม่ได้ผล — ร่างเล็กๆ เย็นลงในอ้อมแขนคุณก่อนไก่ขัน", "ถูกวางยาในวังหลัง", { joy: -10 }))),
  ], {
    when: (l) => emp(l) && haremOf(l).length >= 2 && people(l, "child").some((k) => k.alive && k.age <= 12 && k.tags?.some((t) => t.startsWith("parent:"))) && haremOf(l).some((c) => c.resent >= 40),
    prepare: (l) => { const kid = pick(l, people(l, "child").filter((k) => k.alive && k.age <= 12 && k.tags?.some((t) => t.startsWith("parent:")))); const mom = motherOf(l, kid); const sus = haremOf(l).filter((c) => c !== mom).sort((a, b) => b.resent - a.resent)[0] ?? haremOf(l)[0]; return { kid: kid.id, pid: sus.pid }; },
    weight: 7, maxTimes: 3, title: "ขนมจากตำหนักข้างๆ",
  }),

  E("ct.h_favourite_clan", [20, 100], (l, c) => `${cn(l, c)}คนโปรดของคุณซบอกคุณหลังงานเลี้ยง กระซิบว่าพี่ชายใน${ctxC(l, c)?.clan ?? "ตระกูล"}เก่งกาจพอจะเป็นแม่ทัพรักษาเมืองหลวง — "เพื่อความปลอดภัยของฝ่าบาทเอง"`, [
    C("แต่งตั้งตามขอ", with_(N((l, c) => `${ctxC(l, c)?.clan}ได้คุมทหารรักษาเมืองหลวง — ขุนนางเริ่มเรียกตระกูลนี้ว่า "ครึ่งราชสำนัก"`, {}), (l, c) => { const k = ctxC(l, c); if (k) bump(consortP(l, k), 8); l.flags.consortClanGuard = k?.clan ?? true; if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 3, 0, 100); })),
    K("ให้ตำแหน่งที่ฟังดูใหญ่แต่ไม่มีทหาร", "smarts", 55, G("พี่ชายของคนโปรดได้ตำแหน่งราชครูฝ่ายพิธี — ใหญ่ สวย และไม่มีดาบสักเล่ม", { iq: 1 }), B("คนโปรดรู้ทัน — คืนนั้นตำหนักปิดประตูใส่คุณ", { joy: -3, feel: { love: -8 } })),
    C("ปฏิเสธ — วังหลังห้ามยุ่งราชการ", with_(N((l, c) => `${cn(l, c)}ก้มหน้ารับคำ แต่ไม่ยิ้มอีกเลยทั้งเดือน`, { align: 2 }), (l, c) => { const k = ctxC(l, c); if (k) { k.resent = clamp(k.resent + 15, 0, 100); bump(consortP(l, k), -6); } })),
  ], { when: (l) => emp(l) && !!favourite(l) && favourite(l)!.nights >= 2, prepare: (l) => ({ pid: favourite(l)!.pid }), weight: 6, maxTimes: 2, title: "คำกระซิบของคนโปรด" }),

  E("ct.h_empress_feud", [20, 100], (l, c) => `${empressOf(l) ? consortLabel(l, empressOf(l)!) : "ฮองเฮา"}ยื่นฎีกาว่า${cn(l, c)}ไม่ยอมมาถวายบังคมตามธรรมเนียมทุกเช้ามาสามเดือนแล้ว — วังหลังทั้งวังรอดูว่าคุณจะยืนข้างใคร`, [
    C("ยืนข้างฮองเฮา — ธรรมเนียมต้องมาก่อน", with_(N((l, c) => `${cn(l, c)}ถูกสั่งให้คุกเข่าหน้าตำหนักฮองเฮาสามชั่วยาม — วังหลังรู้แล้วว่าใครคือนาย`, {}), (l, c) => { const k = ctxC(l, c); if (k) { k.resent = clamp(k.resent + 20, 0, 100); bump(consortP(l, k), -8); } const e = empressOf(l); if (e) bump(consortP(l, e), 6); })),
    C("ยืนข้างคนโปรด", with_(B("ฮองเฮาเงียบ — แต่ตระกูลของนางในราชสำนักเริ่มขัดทุกราชโองการของคุณ", {}), (l) => { const e = empressOf(l); if (e) { e.resent = clamp(e.resent + 30, 0, 100); feel(consortP(l, e), { grudge: 25 }); } if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 3, 0, 100); })),
    K("เรียกทั้งสองมากินข้าวด้วยกัน ไกล่เกลี่ยเอง", "looks", 55, G("ทั้งสองยิ้มให้กันต่อหน้าคุณ — และอย่างน้อยหนึ่งฤดูหนาว วังหลังก็สงบ", {}), N("มื้อนั้นเงียบจนได้ยินเสียงตะเกียบกระทบชาม", { joy: -2 })),
  ], { when: (l) => emp(l) && !!empressOf(l) && !!favourite(l) && favourite(l) !== empressOf(l) && favourite(l)!.trait !== "gentle", prepare: (l) => ({ pid: favourite(l)!.pid }), weight: 6, maxTimes: 2, title: "ฮองเฮากับคนโปรด" }),

  E("ct.h_fake_pregnancy", [20, 80], (l, c) => `${cn(l, c)}ประกาศว่าตั้งครรภ์ หมอหลวงสองคนยืนยัน — แต่ขันทีคนสนิทกระซิบว่าเห็นคนลักลอบนำทารกจากนอกวังเข้ามาซ่อนไว้ในตำหนักนั้น`, [
    K("ให้หมอที่ไว้ใจได้ตรวจซ้ำต่อหน้าคุณ", "smarts", 55, with_(B((l, c) => `ครรภ์ทำจากผ้าไหมสามชั้น — ${cn(l, c)}คุกเข่าสารภาพว่าแค่อยากให้คุณหันมามอง`, {}), (l, c) => { const k = ctxC(l, c); if (k) { k.cold = true; retitle(l, k); } }), N("หมอยืนยันว่าตั้งครรภ์จริง — ขันทีคนนั้นหายตัวไปในคืนเดียวกัน", {})),
    C("เชื่อและรอวันคลอด", with_(N((l, c) => `เก้าเดือนต่อมา${cn(l, c)}อุ้มทารกชายตัวแดงมาให้ดู — หน้าตาไม่เหมือนคุณเลยสักนิด แต่ไม่มีใครกล้าพูด`, {}), (l, c) => { const kid = createPerson(l, "child", { age: 0, bond: 50, lastName: l.lastName, gender: "m" }); kid.tags = [...(kid.tags ?? []), `parent:${c.pid}`, "not_blood"]; })),
  ], { when: (l) => emp(l) && l.gender === "m" && haremOf(l).some((c) => c.trait === "ambitious" && consortP(l, c).gender === "f" && kidsOf(l, c.pid).length === 0), prepare: (l) => ({ pid: haremOf(l).find((c) => c.trait === "ambitious" && consortP(l, c).gender === "f" && kidsOf(l, c.pid).length === 0)!.pid }), weight: 5, maxTimes: 1, title: "ครรภ์ผ้าไหม" }),

  E("ct.h_secret_lover", [20, 100], (l, c) => `องครักษ์จับได้ว่า${cn(l, c)}ลอบพบนายทหารเวรยามที่สวนหลังตำหนักทุกคืนวันเพ็ญ — ทั้งสองถูกมัดคุกเข่าอยู่หน้าคุณ`, [
    C("ประหารทั้งคู่ตามกฎมณเฑียรบาล", kinDies("ทั้งสองไม่ร้องขอชีวิต — แค่จับมือกันไว้จนดาบลง ทั้งวังหลังเงียบไปหลายเดือน", "ถูกประหารฐานลอบพบชายอื่น", { align: -4 })),
    C("ปลดออกจากวัง ให้ไปอยู่ด้วยกันที่ชายแดน", with_(G((l, c) => `${cn(l, c)}กราบคุณจนหน้าผากแตก — คนในวังกระซิบว่าฮ่องเต้องค์นี้ใจอ่อน บางคนกระซิบว่าใจกว้าง`, { align: 4 }), (l, c) => { const k = ctxC(l, c); if (!k) return; const p = consortP(l, k); setTitle(p); p.relation = "friend"; p.tags = (p.tags ?? []).filter((t) => t !== "consort" && t !== "secondary"); l.mw!.harem = (l.mw!.harem ?? []).filter((x) => x !== k); if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 2, 0, 100); })),
    C("ปิดเรื่องเงียบ ส่งไปตำหนักเย็น", with_(N((l, c) => `นายทหารคนนั้นถูกย้ายไปชายแดนในวันรุ่งขึ้น — ${cn(l, c)}ไม่ได้ออกจากตำหนักเย็นอีกเลย`, {}), (l, c) => { const k = ctxC(l, c); if (k) { k.cold = true; retitle(l, k); } })),
  ], { when: (l) => emp(l) && haremOf(l).some((c) => c.resent >= 50 && c.rank < EMPRESS), prepare: (l) => ({ pid: haremOf(l).filter((c) => c.resent >= 50 && c.rank < EMPRESS).sort((a, b) => b.resent - a.resent)[0].pid }), weight: 5, maxTimes: 2, title: "สวนหลังตำหนักคืนวันเพ็ญ" }),

  E("ct.h_clan_demand", [20, 100], (l, c) => `ประมุข${ctxC(l, c)?.clan ?? "ตระกูลสนม"}ขอเข้าเฝ้า — ตั้งแต่${cn(l, c)}ได้เป็น${ctxC(l, c) ? rankName(consortP(l, ctxC(l, c)!), ctxC(l, c)!.rank) : "สนม"} ตระกูลนี้ขอยกเว้นภาษีที่นาสามอำเภอ และขอตำแหน่งให้หลานอีกเจ็ดคน`, [
    C("ให้ทั้งหมด — ตระกูลนี้คือฐานของวังหลัง", with_(N("ตระกูลนั้นร่ำรวยขึ้นภายในปีเดียว — ราษฎรสามอำเภอจ่ายภาษีแทนพวกเขา", {}), (l, c) => { const k = ctxC(l, c); if (k) bump(consortP(l, k), 8); if (l.mw) { l.mw.unrest = clamp(l.mw.unrest + 6, 0, 100); l.mw.legitimacy = clamp(l.mw.legitimacy - 2, 0, 100); } })),
    C("ให้ตำแหน่งสองคน ภาษีไม่ให้", G("ประมุขตระกูลโค้งต่ำแล้วถอยออกไป — พอใจครึ่งเดียว ซึ่งในวังนี้ถือว่ามาก", {})),
    P("ปฏิเสธ และส่งขุนนางตรวจการไปสอบบัญชีตระกูลนั้น", ab(0.5, "smarts"), with_(G("ขุนนางตรวจการพบนาเถื่อนสองพันหมู่ — ตระกูลนั้นสงบเสงี่ยมไปอีกสิบปี", { align: 2 }), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 3, 0, 100); }), with_(B((l, c) => `ขุนนางตรวจการถูกพบเป็นศพในแม่น้ำ — ${cn(l, c)}ร้องไห้ว่าไม่รู้เรื่อง`, {}), (l, c) => { const k = ctxC(l, c); if (k) k.resent = clamp(k.resent + 20, 0, 100); })),
  ], { when: (l) => emp(l) && haremOf(l).some((c) => c.rank >= 3 && !c.cold), prepare: (l) => ({ pid: pick(l, haremOf(l).filter((c) => c.rank >= 3 && !c.cold)).pid }), weight: 5, maxTimes: 3, title: "ตระกูลสนมทวงบุญคุณ" }),

  E("ct.h_neglected", [20, 100], (l, c) => `นางกำนัลวิ่งมาทูลว่า${cn(l, c)}ไม่ยอมกินอะไรมาเจ็ดวันแล้ว — ตั้งแต่เข้าวังมา คุณไม่เคยเสด็จไปตำหนักนั้นเลย ที่หัวเตียงมีผ้าขาวยาวสามศอกพับวางไว้`, [
    C("เสด็จไปทันที", with_(G((l, c) => `${cn(l, c)}เงยหน้าขึ้นจากหมอน ร้องไห้จนพูดไม่ออก — คืนนั้นคุณนั่งฟังเรื่องบ้านเกิดของเขาจนฟ้าสาง`, { joy: 2 }), (l, c) => { const k = ctxC(l, c); if (k) { k.nights++; k.lastNight = l.age; k.resent = 0; bump(consortP(l, k), 15); } })),
    C("อนุญาตให้ออกบวชที่วัดหลวง", with_(N((l, c) => `${cn(l, c)}โกนผมในวัดนอกเมือง — ส่งจดหมายมาขอบพระทัยปีละครั้ง จนวันหนึ่งจดหมายก็หยุดมา`, { align: 2 }), (l, c) => { const k = ctxC(l, c); if (!k) return; const p = consortP(l, k); setTitle(p, "ภิกษุณีวัดหลวง"); p.relation = "friend"; p.tags = (p.tags ?? []).filter((t) => t !== "consort" && t !== "secondary"); l.mw!.harem = (l.mw!.harem ?? []).filter((x) => x !== k); })),
    P("ส่งหมอไปพร้อมของขวัญ", ab(0.6, "luck"), G("ของขวัญกับหมอช่วยได้ — อย่างน้อยก็ช่วยให้ยังมีชีวิต", {}), kinDies("ตอนหมอไปถึง ผ้าขาวสามศอกไม่ได้พับอยู่ที่หัวเตียงแล้ว", "ผูกคอตายในตำหนักที่ถูกลืม", { joy: -8, align: -3 })),
  ], { when: (l) => emp(l) && haremOf(l).some((c) => c.nights === 0 && !c.cold && calYear(l) - c.since >= 3 && consortP(l, c).tags?.includes("consort")), prepare: (l) => ({ pid: haremOf(l).find((c) => c.nights === 0 && !c.cold && calYear(l) - c.since >= 3 && consortP(l, c).tags?.includes("consort"))!.pid }), weight: 6, maxTimes: 2, title: "ผ้าขาวสามศอก" }),

  E("ct.h_mothers_lobby", [30, 100], (l) => { const ss = sons(l).slice(0, 2); return `${ss.map((s) => `${motherOf(l, s) ? consortLabel(l, motherOf(l, s)!) : "มารดา"}มารดาของ${shortName(s)}`).join(" กับ ")} ต่างส่งคนมาทูลข้อดีของลูกตัวเองทุกวัน — ขุนนางเริ่มแบ่งเป็นสองฝ่าย ใครได้เป็นรัชทายาท ตระกูลนั้นได้ครึ่งแผ่นดิน`; }, [
    C((l) => `แต่งตั้ง${sons(l)[0] ? shortName(sons(l)[0]) : "องค์ชายองค์โต"}ตามลำดับอาวุโส`, with_(N("ฝ่ายองค์โตจัดงานเลี้ยงสามวัน — ฝ่ายองค์รองปิดประตูตำหนักเงียบ", {}), (l) => { const s = sons(l)[0]; if (s) { l.flags.heirId = s.id; setTitle(s, childTitle(l, s)); } const loser = sons(l)[1]; const m = loser && motherOf(l, loser); if (m) m.resent = clamp(m.resent + 35, 0, 100); })),
    K("จัดสอบองค์ชายทั้งสองต่อหน้าขุนนาง", "smarts", 50, with_(G("องค์ชายทั้งสองตอบโจทย์การปกครองคนละครึ่งวัน — คุณเลือกคนที่ตอบว่า \"ราษฎรต้องอิ่มก่อน\" ไม่มีใครเถียงได้", { iq: 1 }), (l) => { const s = sons(l).slice(0, 2).sort((a, b) => b.bond - a.bond)[0]; if (s) { l.flags.heirId = s.id; setTitle(s, childTitle(l, s)); } }), N("การสอบจบลงโดยไม่มีใครชนะ — มารดาทั้งสองต่างบอกว่าลูกตนถูกโกง", {})),
    C("ห้ามพูดเรื่องนี้อีก — ข้ายังไม่ตาย", with_(N("ทั้งวังเงียบ — แต่ความเงียบในวังหลังมักดังกว่าเสียงตะโกน", {}), (l) => { for (const s of sons(l).slice(0, 2)) { const m = motherOf(l, s); if (m) m.resent = clamp(m.resent + 10, 0, 100); } })),
  ], { when: (l) => emp(l) && sons(l).filter((s) => motherOf(l, s)).length >= 2 && new Set(sons(l).map((s) => motherOf(l, s)?.pid)).size >= 2, weight: 6, maxTimes: 2, title: "มารดาสองตำหนัก" }),

  E("ct.h_male_consorts", [20, 100], "ขุนนางอาวุโสสามคนคุกเข่ากลางท้องพระโรง ถือฎีกาเขียนด้วยเลือด — \"นับแต่โบราณ ไม่มีฮ่องเต้หญิงองค์ใดเลี้ยงนายในไว้เต็มวัง ฟ้าดินจะลงโทษ\"", [
    P("โต้กลับ: ฮ่องเต้ชายมีสนมสามพัน ทำไมข้ามีไม่ได้", ab(0.45, "smarts"), with_(BIG("ท้องพระโรงเงียบกริบ — ขุนนางผู้เฒ่าเปิดปากแล้วปิดลง ไม่มีใครตอบได้ ข่าวนี้แพร่ไปทั้งแผ่นดิน", { fame: 4 }), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 2, 0, 100); }), with_(B("ขุนนางผู้เฒ่าโขกศีรษะกับเสาท้องพระโรงจนเลือดอาบ — ทั้งเมืองหลวงพูดถึงเรื่องนี้แทนเรื่องอื่น", {}), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 5, 0, 100); })),
    C("ปลดขุนนางทั้งสาม", with_(N("ทั้งสามถูกส่งกลับบ้านเกิด — ขุนนางที่เหลือเรียนรู้ว่าเรื่องไหนไม่ควรพูด", { align: -2 }), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 2, 0, 100); })),
    C("ลดจำนวนนายในลง เพื่อให้เรื่องจบ", with_(N("นายในครึ่งหนึ่งถูกส่งกลับบ้าน — ขุนนางพอใจ ตำหนักที่ว่างเงียบจนน่ากลัว", {}), (l) => { const low = haremOf(l).filter((c) => c.rank <= 1 && consortP(l, c).tags?.includes("consort") && kidsOf(l, c.pid).length === 0); for (const k of low) { const p = consortP(l, k); setTitle(p); p.relation = "friend"; p.tags = (p.tags ?? []).filter((t) => t !== "consort" && t !== "secondary"); } l.mw!.harem = (l.mw!.harem ?? []).filter((x) => !low.includes(x)); if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 3, 0, 100); })),
  ], { when: (l) => emp(l) && l.gender === "f" && haremOf(l).filter((c) => consortP(l, c).gender === "m").length >= 3, weight: 6, maxTimes: 1, title: "ฎีกาเลือด" }),

  E("ct.h_princes_hunt", [35, 100], (l) => `งานล่าสัตว์ฤดูใบไม้ร่วงที่ป่าหลวง — ${sons(l).slice(0, 3).map((s) => shortName(s)).join(" ")} ขี่ม้าแข่งกันไล่กวางเผือกตัวเดียวกัน ลูกธนูดอกหนึ่งพลาดเป้าไปปักต้นไม้ห่างศีรษะ${sons(l)[0] ? shortName(sons(l)[0]) : "องค์โต"}แค่ฝ่ามือเดียว`, [
    K("สืบว่าลูกธนูดอกนั้นมาจากใคร", "smarts", 55, with_(B(() => `ขนนกท้ายลูกธนูเป็นสีของตำหนักองค์ชายอีกองค์ — คุณเก็บเรื่องนี้ไว้คนเดียว และมองลูกคนนั้นไม่เหมือนเดิมอีกเลย`, { joy: -4 }), (l) => { const s = sons(l)[1]; if (s) feel(s, { trust: -20 }); }), N("ไม่มีใครรู้ — หรือไม่มีใครกล้าพูด", {})),
    C("ประกาศว่าใครทำร้ายพี่น้องคือทำร้ายข้า", with_(G("องค์ชายทุกองค์คุกเข่าพร้อมกันกลางป่า — อย่างน้อยต่อหน้าคุณ พวกเขายังเป็นพี่น้องกัน", {}), (l) => { for (const s of sons(l)) feel(s, { trust: 5 }); })),
    C("ให้รางวัลคนที่ล่ากวางเผือกได้ แล้วจบงาน", N("ลูกคนที่สามล่ากวางได้ — แล้วยื่นเขากวางให้พี่ชายคนโต ทั้งป่าเงียบไปครู่หนึ่ง", { joy: 2 })),
  ], { when: (l) => emp(l) && sons(l).length >= 2, weight: 5, maxTimes: 2, title: "ลูกธนูพลาดเป้า" }),

  // ───── ครอบครัวในวัง ─────
  E("ct.f_dowager_niece", [20, 100], (l, c) => `${nm(l, c)} ไทเฮา เรียกคุณไปเสวยน้ำชาที่ตำหนักฉือหนิง — ข้างกายพระนางมีหลานสาวจากบ้านเกิดนั่งก้มหน้าอยู่ "ลูกเอ๋ย แม่แก่แล้ว อยากเห็นคนบ้านเดียวกันอยู่ใกล้ๆ"`, [
    C("รับหลานของแม่เข้าวัง", with_(G("ไทเฮายิ้มกว้างที่สุดในรอบหลายปี — วังหลังมีคนใหม่ที่รายงานทุกอย่างให้ไทเฮาฟัง", { feel: { love: 10 } }), (l) => { addConsort(l, { gender: l.gender === "m" ? "f" : "m", age: randInt(l, 16, 20), clan: "ตระกูลฝ่ายไทเฮา", trait: "gentle", rank: 2, bond: 45 }); })),
    K("ปฏิเสธอย่างนุ่มนวล ยกหลานให้แต่งกับขุนนางหนุ่มแทน", "looks", 50, G("ไทเฮาหัวเราะ \"ลูกแม่ปากหวานเหมือนพ่อ\" — หลานได้สามีดี ไทเฮาได้หน้า คุณได้ความสงบ", { feel: { love: 3 } }), B("ไทเฮาวางถ้วยชาเสียงดัง — ตำหนักฉือหนิงปิดประตูใส่คุณไปหนึ่งฤดู", { feel: { love: -10, grudge: 10 } })),
    C("ปฏิเสธตรงๆ", B("ไทเฮาเงียบไปนาน \"ลูกโตแล้วจริงๆ\" — พระนางไม่เรียกคุณไปเสวยน้ำชาอีกหลายเดือน", { feel: { love: -12, grudge: 10 } })),
  ], { when: (l) => emp(l) && people(l, "mother").some((p) => p.alive), prepare: (l) => ({ pid: people(l, "mother").find((p) => p.alive)!.id }), weight: 6, maxTimes: 1, title: "ชาที่ตำหนักฉือหนิง" }),

  E("ct.f_sibling_fief", [20, 100], (l, c) => `${nm(l, c)}ท่านอ๋องพี่น้องของคุณขอเข้าเฝ้า — ขอหัวเมืองทางใต้เป็นแคว้นศักดินา มีทหารของตัวเองสามพัน "ให้ข้าช่วยเฝ้าแผ่นดินของพี่น้องเราเถิด"`, [
    C("ให้แคว้นศักดินาพร้อมทหาร", with_(N((l, c) => `${nm(l, c)}ออกเดินทางพร้อมธงอ๋อง — หัวเมืองทางใต้มีเจ้าเหนือหัวคนใหม่ที่ใช้แซ่เดียวกับคุณ`, { feel: { love: 10, debt: 20 } }), (l, c) => { const p = l.people.find((x) => x.id === c.pid); if (p) p.tags = [...(p.tags ?? []), "fief"]; })),
    C("ให้ศักดินาแต่ไม่ให้ทหาร", G("พี่น้องของคุณได้วัง ได้นา ได้ภาษี — แต่ไม่ได้ดาบ ทุกคนพอใจครึ่งหนึ่ง", { feel: { love: 3 } })),
    C("ให้อยู่ในเมืองหลวงใกล้ตัว พร้อมเบี้ยหวัดสูง", N("กรงทองก็ยังเป็นกรง — พี่น้องของคุณยิ้มรับ แต่มองกำแพงวังนานกว่าที่เคย", { feel: { love: -5, grudge: 8 } })),
  ], { when: (l) => emp(l) && people(l, "sibling").some((p) => p.alive && p.age >= 18 && !p.tags?.includes("fief")), prepare: (l) => ({ pid: people(l, "sibling").find((p) => p.alive && p.age >= 18 && !p.tags?.includes("fief"))!.id }), weight: 5, maxTimes: 2, title: "ท่านอ๋องขอศักดินา" }),

  E("ct.f_sibling_plot", [25, 100], (l, c) => `ราชเลขาธิการนำจดหมายที่ดักได้มาถวาย — ${nm(l, c)}พี่น้องของคุณติดต่อแม่ทัพสองคน เขียนว่า "แซ่เดียวกัน บัลลังก์เดียวกัน ใครนั่งก็เหมือนกัน"`, [
    P("เรียกมาพบตามลำพัง ถามด้วยตัวเอง", ab(0.5, "looks"), G((l, c) => `${nm(l, c)}ร้องไห้ยอมรับ — เล่าว่าแม่ทัพเป็นคนยุ คุณให้อภัย และพี่น้องของคุณไม่เคยคิดเรื่องนี้อีกเลย`, { feel: { love: 15, debt: 40 } }), B((l, c) => `${nm(l, c)}ปฏิเสธทุกอย่างทั้งที่จดหมายอยู่ตรงหน้า — คืนนั้นทหารของเขาเคลื่อนพลออกจากเมือง`, { feel: { grudge: 30 } })),
    C("ปลดยศ ส่งไปเฝ้าสุสานบรรพชน", with_(N("ท่านอ๋องกลายเป็นคนเฝ้าสุสาน — ทุกเทศกาลเชงเม้งคุณเห็นเขาคุกเข่าอยู่ไกลๆ", { align: -1, feel: { grudge: 30, love: -20 } }), (l, c) => { const p = l.people.find((x) => x.id === c.pid); if (p) setTitle(p, "อดีตอ๋อง · ผู้เฝ้าสุสานหลวง"); })),
    C("พระราชทานสุราพิษ", kinDies("ท่านอ๋องรับจอกสุราด้วยมือที่ไม่สั่น \"พี่น้องกันแท้ๆ\" — แล้วดื่มจนหมด", "ถูกพระราชทานสุราพิษฐานคิดกบฏ", { align: -8, joy: -10 })),
  ], { when: (l) => emp(l) && people(l, "sibling").some((p) => p.alive && p.age >= 20 && p.bond < 45), prepare: (l) => ({ pid: people(l, "sibling").filter((p) => p.alive && p.age >= 20 && p.bond < 45).sort((a, b) => a.bond - b.bond)[0].id }), weight: 5, maxTimes: 1, title: "จดหมายของท่านอ๋อง" }),

  E("ct.f_poor_relatives", [20, 100], "ญาติจากบ้านเกิดสามสิบคนเดินทางมาถึงประตูวัง — ลุงที่เคยไล่คุณออกจากบ้าน ป้าที่เคยแบ่งข้าวให้ ลูกพี่ลูกน้องที่คุณจำหน้าไม่ได้ ทุกคนขอตำแหน่งราชการ", [
    C("ให้ตำแหน่งทุกคน — ครอบครัวต้องมาก่อน", with_(N("หัวเมืองหลายแห่งมีนายอำเภอแซ่เดียวกับคุณ — บางคนอ่านหนังสือไม่ออก ราษฎรเริ่มบ่น", { joy: 3 }), (l) => { if (l.mw) { l.mw.legitimacy = clamp(l.mw.legitimacy - 4, 0, 100); l.mw.unrest = clamp(l.mw.unrest + 3, 0, 100); } })),
    C("ตอบแทนเฉพาะคนที่เคยดีกับคุณ ด้วยที่ดินและเงิน", G("ป้าที่เคยแบ่งข้าวได้นาร้อยหมู่ ลุงได้แค่ข้าวหนึ่งมื้อกับคำขอบคุณ — ทั้งหมู่บ้านเล่าเรื่องนี้ไปอีกร้อยปี", { align: 3, joy: 4 })),
    PAY("แจกเงินแล้วส่งกลับบ้านทุกคน", 30, N("ญาติทั้งหมดกลับบ้านพร้อมเงินคนละถุง — และเล่าให้ทั้งตำบลฟังว่าฮ่องเต้ลืมกำพืด", {})),
  ], { when: emp, weight: 5, maxTimes: 1, title: "ญาติจากบ้านเกิด" }),

  E("ct.f_dowager_birthday", [25, 100], (l, c) => `${nm(l, c)} ไทเฮา จะมีพระชนมายุครบหกสิบพรรษา — ขุนนางเสนอให้จัดงานเจ็ดวันเจ็ดคืนทั่วแผ่นดิน ท้องพระคลังบอกว่าพอจัดได้ แต่ไม่เหลือสำหรับซ่อมเขื่อน`, [
    C("จัดเต็มที่ — แม่ลำบากมาทั้งชีวิต", with_(G("โคมแดงหมื่นดวงทั่วเมืองหลวง ไทเฮาร้องไห้กลางงานเลี้ยง \"แม่ไม่เคยคิดว่าชีวิตนี้จะมีวันนี้\"", { joy: 6, feel: { love: 20 } }), (l) => { const pal = palaceOf(l); pal.treasury = clamp(pal.treasury - 15, 0, 100); if (l.mw) l.mw.unrest = clamp(l.mw.unrest + 3, 0, 100); })),
    C("จัดเรียบง่าย เอาเงินไปซ่อมเขื่อนในนามของแม่", with_(G("เขื่อนใหม่ได้ชื่อว่า \"เขื่อนพระพันปี\" — ไทเฮาบอกว่านี่คือของขวัญที่ดีที่สุดในชีวิต", { align: 3, feel: { love: 12 } }), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 4, 0, 100); })),
  ], { when: (l) => emp(l) && people(l, "mother").some((p) => p.alive && p.age >= 58), prepare: (l) => ({ pid: people(l, "mother").find((p) => p.alive)!.id }), weight: 7, maxTimes: 1, title: "หกสิบพรรษาไทเฮา" }),
];

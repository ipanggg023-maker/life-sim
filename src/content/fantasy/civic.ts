// ผู้เล่นกับสังคม: ฝ่ายอำนาจ อาชญากรรมและกฎหมาย ชื่อเสียงรายอาณาจักร การค้า และบุคคลสำคัญ
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { pick, weightedPick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, checkChance, clamp, createPerson, displayName, log } from "../../engine/util";
import { addLegend, recordChronicle } from "../../engine/worldState";
import { B, BIG, C, E, G, GOLD, K, N, P, SCENE, type Res } from "./kit";
import { learnSpell, SPELLS } from "./magic";
import { canCast, fightOdds } from "./power";
import { GOODS, priceOf, setLaw } from "./society";
import { addStanding, dataOf, deed, fl, homeKingdom, kingdomsOf, LAWS, ROLES, standingOf, worldOfLife, type Faction, type Good, type Kingdom, type LawId, type Notable } from "./state";

export const FACTION_RANKS = ["ผู้ติดตาม", "สมาชิก", "แกนนำ", "ผู้นำ"];
const M = (a: Omit<Activity, "world">): Activity => ({ ...a, world: "fantasy" });
const hereHas = (l: Life, id: LawId) => !!homeKingdom(l).laws?.includes(id);
export const wanted = (l: Life) => standingOf(l) <= -30;
export const standingWord = (v: number) => (v >= 50 ? "วีรบุรุษของแผ่นดิน" : v >= 20 ? "เป็นที่เคารพ" : v > -10 ? "คนธรรมดา" : v > -30 ? "มีชื่อเสีย" : v > -60 ? "ถูกหมายจับ" : "ศัตรูของแผ่นดิน");
export const myFaction = (l: Life): Faction | undefined => dataOf(l).factions.find((x) => x.id === fl(l).faction);
const inFaction = (l: Life, id: string) => fl(l).faction === id;
const needMerit = (l: Life) => (fl(l).fRank + 1) * 3;
const away = (l: Life) => kingdomsOf(l).filter((k) => k.id !== fl(l).kingdom);

/** หนีข้ามแดน: ชื่อเสียงผูกกับอาณาจักร คดีจึงไม่ตามมาด้วย */
export function flee(l: Life) {
  const k = pick(l, away(l));
  fl(l).kingdom = k.id;
  return k;
}

// ---------- ฝ่ายอำนาจ ----------
interface Job { label: string; stat: "smarts" | "health" | "looks" | "luck"; dc: number; ok: string; fail: string }
const JOBS: Record<string, { clean: Job; dirty: Job; perk: Res }> = {
  silver: {
    clean: { label: "คุ้มกันหมู่บ้านชายแดน", stat: "health", dc: 45, ok: "ชาวบ้านจดชื่อคุณไว้ในบทสวด", fail: "คุณมาถึงช้าไปหนึ่งคืน" },
    dirty: { label: "ไล่ที่ชาวนาตามคำสั่งลอร์ด", stat: "health", dc: 35, ok: "คำสั่งเสร็จสิ้น แต่ไม่มีใครมองหน้าคุณ", fail: "ชาวนาทั้งหมู่บ้านลุกขึ้นต้าน" },
    perk: G("โล่เงินฝึกคุณหนักกว่าที่เคย", { body: 10 }),
  },
  conclave: {
    clean: { label: "คัดลอกตำราเก่าในหอ", stat: "smarts", dc: 45, ok: "คุณเจอบทที่ไม่มีใครอ่านมานาน", fail: "หมึกซึมลงบนหน้าที่หายากที่สุด" },
    dirty: { label: "ทดลองเวทกับนักโทษ", stat: "smarts", dc: 40, ok: "ผลทดลองน่าทึ่ง และคุณนอนไม่หลับ", fail: "การทดลองพังและข่าวรั่วออกไป" },
    perk: G("สภาเปิดชั้นหนังสือใหม่ให้คุณ", { magic: 10 }),
  },
  league: {
    clean: { label: "เจรจาสัญญาการค้า", stat: "looks", dc: 45, ok: "ทั้งสองฝ่ายคิดว่าตนได้เปรียบ", fail: "คู่ค้าเดินออกจากโต๊ะ" },
    dirty: { label: "กักตุนสินค้าโก่งราคา", stat: "smarts", dc: 40, ok: "ราคาขึ้นเท่าตัว คนในตลาดด่าทอไม่หยุด", fail: "สินค้าเน่าคาโกดัง" },
    perk: G("ส่วนแบ่งของสมาคมเข้ากระเป๋าคุณ", { gold: 25 }),
  },
  night: {
    clean: { label: "ส่งจดหมายลับ", stat: "luck", dc: 45, ok: "ไม่มีใครเห็นคุณเลย", fail: "ยามถามชื่อคุณสองรอบ" },
    dirty: { label: "ขโมยตราประทับขุนนาง", stat: "luck", dc: 45, ok: "ตราอยู่ในมือคุณแล้ว", fail: "สุนัขเฝ้าบ้านจำกลิ่นคุณได้" },
    perk: G("ส่วนแบ่งจากตลาดมืดตกถึงมือคุณ", { gold: 15 }),
  },
  dawn: {
    clean: { label: "ดูแลคนไข้ในโรงทาน", stat: "looks", dc: 40, ok: "คนไข้จำชื่อคุณได้ทุกคน", fail: "ยาไม่พอสำหรับทุกเตียง" },
    dirty: { label: "ไต่สวนคนนอกรีต", stat: "smarts", dc: 40, ok: "คำสารภาพได้มาแล้ว ไม่ว่าจริงหรือไม่", fail: "ชาวเมืองขว้างก้อนหินใส่ขบวนคุณ" },
    perk: G("คำอธิษฐานของศาสนจักรรักษาแผลคุณ", { hp: 8 }),
  },
  ember: {
    clean: { label: "ถวายของขวัญที่เชิงเขา", stat: "luck", dc: 40, ok: "ควันจากยอดเขาโค้งลงมาเหมือนรับรู้", fail: "ของถวายถูกนกแย่งไป" },
    dirty: { label: "ลักพาคนจากหมู่บ้านไปถวาย", stat: "health", dc: 45, ok: "คุณไม่ถามว่าเขาไปไหนต่อ", fail: "ชาวบ้านไล่ตามถึงเชิงเขา" },
    perk: G("เถ้าถ่านบนหน้าผากคุณอุ่นขึ้น", { body: 4, magic: 4 }, (l) => { fl(l).dragonBond += 2; }),
  },
};

function earnMerit(l: Life, n: number, c: Ctx) {
  const f = fl(l);
  f.fMerit = (f.fMerit ?? 0) + n;
  if (f.fRank < 2 && f.fMerit >= needMerit(l)) {
    f.fMerit = 0; f.fRank++;
    deed(l, `${FACTION_RANKS[f.fRank]}แห่ง${myFaction(l)!.name}`);
    if (f.faction === "conclave") { const s = SPELLS.find((x) => x.tier <= Math.max(1, f.magicRank) && !f.spells?.includes(x.id)); if (s) learnSpell(l, s.id); }
    log(l, `คุณได้เลื่อนเป็น${FACTION_RANKS[f.fRank]}ของ${myFaction(l)!.name}`, "milestone");
  }
  JOBS[kindOf(l)].perk(l, c);
}
const jobChoice = (j: Job, dirty: boolean): Res => G(j.ok, { fame: dirty ? 1 : 0 }, (l, c) => { if (dirty) addStanding(l, -6); else addStanding(l, 2); earnMerit(l, dirty ? 2 : 1, c); });
const kindOf = (l: Life) => { const x = myFaction(l); return x?.kind ?? x?.id ?? "silver"; };
const jobOf = (l: Life) => JOBS[kindOf(l)];
const jobCheck = (l: Life, j: Job) => checkChance(l, j.stat, j.dc);

const joinOdds = (l: Life, x: Faction) => clamp(0.35 + standingOf(l) / 200 + l.fame / 200 + (l.stats.smarts + l.stats.health - 100) / 300 - (x.id === "silver" || x.id === "dawn" ? (wanted(l) ? 0.5 : 0) + (fl(l).race === "demon" ? 0.5 : 0) : 0), 0.05, 0.9);
const joinChoice = (i: number): Choice => P((l) => { const x = dataOf(l).factions[i]; return x ? `${x.name} · ${x.creed}` : "—"; }, (l) => joinOdds(l, dataOf(l).factions[i]), BIG((l) => `คุณกล่าวคำสาบานเข้าร่วม${dataOf(l).factions[i].name}`, { joy: 4 }, (l) => { const f = fl(l); f.faction = dataOf(l).factions[i].id; f.fRank = 0; f.fMerit = 0; if (f.foe === f.faction) f.foe = undefined; }), N("พวกเขามองคุณแล้วส่ายหน้า ยังไม่ใช่ตอนนี้", { joy: -2 }), { show: (l) => !!dataOf(l).factions[i] });

const leaderPower = (l: Life) => { const x = myFaction(l)!; return dataOf(l).notables.find((n) => n.name === x.leader)?.power ?? 40; };
const demote = (l: Life) => { const f = fl(l); f.fRank = 1; f.fMerit = 0; };
const takeLead: Res = BIG((l) => `ทั้งโถงลุกขึ้นยืน คุณคือผู้นำ${myFaction(l)!.name}คนใหม่`, { fame: 15, joy: 10 }, (l) => {
  const f = fl(l), x = myFaction(l)!;
  f.fRank = 3; x.leader = displayName(l); x.playerLed = true;
  deed(l, `ผู้นำ${x.name}`);
  recordChronicle(worldOfLife(l), `${displayName(l)}ขึ้นเป็นผู้นำ${x.name}`);
});

// ---------- อาชญากรรมและคดี ----------
const nightBonus = (l: Life) => (inFaction(l, "night") ? 0.15 : 0) + (fl(l).race === "halfling" ? 0.1 : 0);
const crimeOdds = (base: number) => (l: Life) => base + (l.stats.luck - 50) / 200 + (l.stats.smarts - 50) / 300 + nightBonus(l);
const caught = (sev: number): Res => (l) => { runEvent(l, "ft.l.arrest", { sev }); return { text: "มือของยามตะปบไหล่คุณ", kind: "bad" }; };
const got = (text: string, gold: number, drop: number): Res => G(text, { gold }, (l) => { addStanding(l, -drop); fl(l).crimes = (fl(l).crimes ?? 0) + 1; });
const fine = (l: Life, c: Ctx) => Number(c.sev) * 20 * (hereHas(l, "harshCourts") ? 2 : 1);
const jail = (l: Life, c: Ctx) => { const y = Number(c.sev) + (hereHas(l, "harshCourts") ? 1 : 0); l.flags.jailUntil = l.age + y + 1; l.job = undefined; return y; };

// ---------- การค้า ----------
const destOf = (l: Life, g: Good): Kingdom => away(l).sort((a, b) => priceOf(b, g) - priceOf(a, g))[0];
// ทุนต่อเที่ยวโตตามประสบการณ์แต่มีเพดาน · ส่งทุกปีติดกันตลาดปลายทางอิ่มตัว กำไรบางลง (พักหนึ่งปีแล้วกลับมาเต็ม)
const airship = (l: Life) => fl(l).estates?.airship !== undefined;
export const capitalOf = (l: Life) => Math.min(Math.floor(l.money / GOLD), Math.min(250, 80 + (fl(l).trades ?? 0) * 6) + (inFaction(l, "league") ? fl(l).fRank * 40 : 0));
const tradeOdds = (l: Life, g: Good) => 0.8 - (destOf(l, g).war ? 0.15 : 0) + (inFaction(l, "league") ? 0.08 : 0) + (fl(l).race === "halfling" ? 0.05 : 0) + (airship(l) ? 0.08 : 0) + (l.stats.luck - 50) / 400;
const streakOf = (l: Life) => (fl(l).tradeLast === l.age - 1 ? (fl(l).tradeStreak ?? 0) + 1 : 0);
export const tradeSaturation = (l: Life) => streakOf(l) * 0.03;
export function tradeProfit(l: Life, g: Good) {
  const here = priceOf(homeKingdom(l), g), there = priceOf(destOf(l, g), g);
  return Math.round(capitalOf(l) * Math.max(0.1, there / here - 1 - tradeSaturation(l)) * (hereHas(l, "freeTrade") ? 1.25 : 1) * (airship(l) ? 1.1 : 1));
}
const tradeChoice = (g: Good): Choice => P((l) => `ขน${GOODS[g].name}ไป${destOf(l, g).name} · ลงทุน ${capitalOf(l)} เหรียญทอง`, (l) => tradeOdds(l, g), (l, c) => {
  const gain = tradeProfit(l, g);
  const f = fl(l);
  f.tradeStreak = streakOf(l); f.tradeLast = l.age;
  fl(l).trades = (fl(l).trades ?? 0) + 1;
  if (fl(l).trades === 15) deed(l, "เจ้าของเส้นทางการค้า");
  return G(`สินค้าถึงปลายทางครบ กำไร ${gain} เหรียญทอง`, { gold: gain })(l, c);
}, (l, c) => {
  const loss = Math.round(capitalOf(l) * 0.4);
  return B(`โจรปล้นกองคาราวานกลางทาง คุณเสียไป ${loss} เหรียญทอง`, { gold: -loss, hp: -4 })(l, c);
}, { show: (l) => capitalOf(l) >= 10 });

// ---------- บุคคลสำคัญ ----------
const peopleHere = (l: Life) => { const d = dataOf(l), n = d.notables.filter((x) => x.kingdom === fl(l).kingdom); return n.length ? n : d.notables; };
const notableAt = (l: Life, c: Ctx): Notable | undefined => dataOf(l).notables.find((n) => n.id === c.nid);
const nm = (l: Life, c: Ctx) => notableAt(l, c)?.name ?? "คนผู้นั้น";
const nPower = (l: Life, c: Ctx) => notableAt(l, c)?.power ?? 30;
const TEACH_FEE = 30;

function befriend(l: Life, c: Ctx) {
  const n = notableAt(l, c);
  if (!n) return;
  const p = createPerson(l, "friend", { age: n.age, bond: 55, job: ROLES[n.role] });
  p.name = n.name; p.short = n.name.split(" ")[0];
  p.notable = n.id;
}

const lawLabel = (id: LawId) => `ยื่นคำร้องยกเลิก${LAWS[id].name}`;
const petition = (id: LawId, on: boolean): Choice => K(on ? `ยื่นคำร้องขอ${LAWS[id].name}` : lawLabel(id), "looks", 50, G("คำร้องของคุณผ่านสภา ชื่อคุณถูกพูดถึงทั่วเมือง", { fame: 3 }, (l) => { setLaw(worldOfLife(l), homeKingdom(l), id, on); addStanding(l, 6); }), N("สภาขอบคุณคุณ แล้วเก็บคำร้องลงลิ้นชัก", {}, (l) => addStanding(l, -2)), { show: (l) => hereHas(l, id) !== on });

const ACTS: Activity[] = [
  M({ group: "ฝ่ายอำนาจ", id: "ft_join", emoji: "", name: "เข้าร่วมฝ่ายอำนาจ", desc: "หกฝ่ายที่แย่งชิงโลกนี้", minAge: 16, available: (l) => !fl(l).faction, run: (l) => { runEvent(l, "ft.f.join"); return { text: "" }; } }),
  M({ group: "ฝ่ายอำนาจ", id: "ft_fjob", emoji: "", name: "ทำงานให้ฝ่าย", desc: "เลื่อนขั้นและรับผลประโยชน์", minAge: 16, available: (l) => !!fl(l).faction, run: (l) => { runEvent(l, "ft.f.job"); return { text: "" }; } }),
  M({ group: "ฝ่ายอำนาจ", id: "ft_fleave", emoji: "", name: "ออกจากฝ่าย", desc: "จากไปดีๆ หรือหักหลัง", minAge: 16, time: 0, available: (l) => !!fl(l).faction, run: (l) => { runEvent(l, "ft.f.leave"); return { text: "" }; } }),
  M({ group: "สังคม", id: "ft_meet", emoji: "", name: "พบผู้มีชื่อเสียง", desc: "คบหา ขอเรียน หรือท้าดวล", minAge: 14, run: (l) => { const n = weightedPick(l, peopleHere(l), (x) => 1 + x.fame)!; runEvent(l, "ft.n.meet", { nid: n.id }); return { text: "" }; } }),
  M({ group: "สังคม", id: "ft_crime", emoji: "", name: "ทำผิดกฎหมาย", desc: "เงินง่าย แต่ชื่อเสียงในแคว้นนี้ลด", minAge: 14, run: (l) => { runEvent(l, "ft.l.crime"); return { text: "" }; } }),
  M({ group: "สังคม", id: "ft_petition", emoji: "", name: "ยื่นคำร้องต่อสภา", desc: "เปลี่ยนกฎหมาย · ทุก 3 ปี · ต้องมีคนนับถือ", minAge: 18, available: (l) => (standingOf(l) >= 20 || (fl(l).fRank ?? 0) >= 2) && l.age >= Number(l.flags.ftPetition ?? 0), run: (l) => { l.flags.ftPetition = l.age + 3; runEvent(l, "ft.l.petition"); return { text: "" }; } }),
  M({ group: "ค้าขาย", id: "ft_trade", emoji: "", name: "ส่งกองคาราวาน", desc: "ซื้อถูกที่นี่ ขายแพงที่อื่น", minAge: 16, available: (l) => capitalOf(l) >= 10, run: (l) => { runEvent(l, "ft.e.trade"); return { text: "" }; } }),
];

export const CIVIC_EVENTS: GameEvent[] = [
  SCENE("ft.f.join", "ฝ่ายอำนาจ", "ทุกฝ่ายมีคนคอยดูอยู่เสมอ คุณจะยื่นชื่อต่อใคร", [...Array.from({ length: 9 }, (_, i) => joinChoice(i)), C("ยังไม่ผูกมัดตัวเอง", N("คุณอยากเป็นอิสระไปก่อน"))]),
  SCENE("ft.f.job", "งานของฝ่าย", (l) => `${myFaction(l)!.name}มีงานให้คุณ · ${FACTION_RANKS[fl(l).fRank]} (ผลงาน ${fl(l).fMerit ?? 0}/${needMerit(l)})`, [
    P((l) => jobOf(l).clean.label, (l) => jobCheck(l, jobOf(l).clean), (l, c) => jobChoice(jobOf(l).clean, false)(l, c), (l, c) => N(jobOf(l).clean.fail)(l, c)),
    P((l) => `${jobOf(l).dirty.label} (ได้ผลงานสองเท่า · ชื่อเสียงลด)`, (l) => jobCheck(l, jobOf(l).dirty), (l, c) => jobChoice(jobOf(l).dirty, true)(l, c), (l, c) => B(jobOf(l).dirty.fail, { hp: -4 }, (x) => addStanding(x, -3))(l, c)),
    C("ท้าชิงตำแหน่งผู้นำ", (l) => { runEvent(l, "ft.f.challenge"); return { text: "คุณเดินเข้าโถงใหญ่" }; }, { show: (l) => fl(l).fRank === 2 && (fl(l).fMerit ?? 0) >= 6 && !myFaction(l)!.playerLed }),
  ]),
  SCENE("ft.f.challenge", "ชิงตำแหน่ง", (l) => `${myFaction(l)!.leader}นั่งอยู่หัวโต๊ะ ทุกคนรอดูว่าคุณจะทำอย่างไร`, [
    P("ท้าดวลต่อหน้าทุกคน", (l) => fightOdds(l, leaderPower(l) + 15) + (fl(l).relic === "stormcrown" ? 0.2 : 0), takeLead, B("คุณถูกปลดอาวุธต่อหน้าทั้งโถง และถูกลดขั้น", { hp: -12, joy: -6 }, demote)),
    K("รวบรวมเสียงสนับสนุน", "looks", 82, takeLead, N("เสียงไม่พอ และคนของผู้นำจำชื่อคุณไว้แล้ว คุณถูกลดขั้น", {}, demote)),
    C("ถอยก่อน", N("ยังไม่ถึงเวลาของคุณ")),
  ]),
  SCENE("ft.f.leave", "ออกจากฝ่าย", (l) => `คุณกำลังจะทิ้ง${myFaction(l)!.name}`, [
    C("ลาออกอย่างสงบ", N("พวกเขาคืนคำสาบานให้คุณ", {}, (l) => leave(l))),
    C("ขายความลับให้ศัตรู", G("เงินก้อนโตมาถึง พร้อมศัตรูที่จำชื่อคุณได้ตลอดชีวิต", { gold: 90, fame: -3 }, (l) => { const x = myFaction(l)!; x.power = clamp(x.power - 8, 10, 90); fl(l).foe = x.id; recordChronicle(worldOfLife(l), `${l.firstName}หักหลัง${x.name}`); leave(l); })),
    C("เปลี่ยนใจ", N("คุณเก็บจดหมายลาออกกลับเข้าเสื้อ")),
  ]),
  E("ft.f.feud", [16, 400], (l) => `${myFaction(l)!.name}กำลังสู้กับ${dataOf(l).factions.find((x) => x.id === myFaction(l)!.feud)?.name} พวกเขาต้องการคุณในแนวหน้า`, [
    P("ลงสนามเพื่อฝ่าย", (l) => fightOdds(l, 25 + fl(l).fRank * 12), G("ฝ่ายคุณยึดโกดังของอีกฝั่งได้", { fame: 2, body: 4, magic: 4 }, (l, c) => { myFaction(l)!.power += 3; earnMerit(l, 2, c); }), B("คุณถูกหามกลับมาทางประตูหลัง", { hp: -14 })),
    C("อยู่ห่างจากเรื่องนี้", N("คนในฝ่ายเริ่มซุบซิบ", {}, (l) => { const f = fl(l); f.fMerit = Math.max(0, (f.fMerit ?? 0) - 1); })),
  ], { when: (l) => !!myFaction(l)?.feud, weight: 16, maxTimes: 0, title: "ศึกระหว่างฝ่าย" }),
  E("ft.f.assassin", [16, 400], (l) => `มีดเล่มหนึ่งปักอยู่บนหมอนคุณ พร้อมตราของ${dataOf(l).factions.find((x) => x.id === fl(l).foe)?.name ?? "คนที่คุณหักหลัง"}`, [
    P("ซุ่มรอแล้วจัดการมือสังหาร", (l) => fightOdds(l, 35), G("พวกเขาคงไม่ส่งใครมาอีกนาน", { fame: 2 }, (l) => { fl(l).foe = undefined; }), B("คุณรอดมาได้อย่างหวุดหวิด", { hp: -16 })),
    C("ย้ายหนีข้ามแดน", N("คุณออกเดินทางก่อนเช้า", { joy: -3 }, (l) => { flee(l); })),
  ], { when: (l) => !!fl(l).foe, weight: 14, maxTimes: 0, title: "คนที่จำคุณได้" }),

  SCENE("ft.l.crime", "ทางมืด", (l) => `ชื่อเสียงของคุณใน${homeKingdom(l).name}: ${standingWord(standingOf(l))}${hereHas(l, "harshCourts") ? " · ศาลที่นี่โหดเป็นพิเศษ" : ""}`, [
    P("ล้วงกระเป๋าในตลาด", crimeOdds(0.6), got("ถุงเงินหนักกว่าที่คิด", 14, 2), caught(1)),
    P("ย่องเข้าคฤหาสน์ขุนนาง", crimeOdds(0.42), got("คุณเดินออกมาพร้อมเครื่องเงินทั้งหีบ", 70, 6), caught(2)),
    P("ลอบสังหารตามคำจ้าง", (l) => crimeOdds(0.2)(l) + fightOdds(l, 30) / 3, got("เช้านี้ทั้งเมืองคุยกันเรื่องศพเดียว", 130, 15), caught(3)),
    C("ไม่ทำดีกว่า", N("คุณเดินกลับบ้านทางสว่าง")),
  ]),
  SCENE("ft.l.arrest", "ถูกจับกุม", (l, c) => `ยามลากคุณมาหน้าศาล${hereHas(l, "harshCourts") ? " ศาลที่นี่ไม่เคยปรานีใคร" : ""}${Number(c.sev) >= 2 ? " คดีนี้หนักเกินกว่าจะจบด้วยค่าปรับ" : ` ค่าปรับคือ ${fine(l, c)} เหรียญทอง`}`, [
    { label: "จ่ายค่าปรับ", req: (l, c) => (l.money < fine(l, c) * GOLD ? `ต้องมี ${fine(l, c)} เหรียญทอง` : undefined), run: (l, c) => { addMoney(l, -fine(l, c) * GOLD); addStanding(l, -Number(c.sev) * 3); return { text: "คุณจ่ายแล้วเดินออกมาโดยไม่เหลียวหลัง" }; } },
    K("แก้ต่างในศาล", "smarts", 55, G("คุณพลิกคดีจนผู้พิพากษาขอโทษ", { joy: 4 }), (l, c) => { const y = jail(l, c); addStanding(l, -5); return B(`ศาลตัดสินจำคุก ${y} ปี`, { joy: -10 })(l, c); }),
    P("สู้ฝ่าออกไป", (l, c) => fightOdds(l, 15 + Number(c.sev) * 8), B("คุณฝ่าวงล้อมออกไปได้ ทั้งแคว้นรู้จักหน้าคุณแล้ว", { hp: -6 }, (l) => addStanding(l, -18)), (l, c) => { const y = jail(l, c) + 1; l.flags.jailUntil = l.age + y + 1; addStanding(l, -8); return B(`คุณถูกจับได้อีก ศาลตัดสินจำคุก ${y} ปี`, { hp: -10, joy: -10 })(l, c); }),
    C("หนีข้ามแดนคืนนี้", (l, c) => { addStanding(l, -12); const k = flee(l); return B(`คุณทิ้งทุกอย่างแล้วหนีไป${k.name}`, { joy: -6 })(l, c); }),
  ]),
  E("ft.l.bounty", [16, 400], "นักล่าค่าหัวถือใบประกาศที่มีหน้าคุณเดินเข้ามาในโรงเตี๊ยม", [
    P("สู้", (l) => fightOdds(l, 25 - standingOf(l) / 3), G("คุณส่งเขากลับไปพร้อมใบประกาศขาดครึ่ง", { fame: 2, body: 4 }), B("เขาเกือบเอาหัวคุณไปขึ้นเงิน", { hp: -16 })),
    { label: "ติดสินบน (40 เหรียญทอง)", req: (l) => (l.money < 40 * GOLD ? "ต้องมี 40 เหรียญทอง" : undefined), run: (l) => { addMoney(l, -40 * GOLD); return { text: "เขาบอกว่าไม่เคยเห็นคุณ" }; } },
    C("หนีข้ามแดน", (l, c) => { const k = flee(l); return N(`คุณหนีไปเริ่มใหม่ที่${k.name}`, { joy: -4 })(l, c); }),
  ], { when: (l) => wanted(l) && l.age >= Number(l.flags.ftBounty ?? 0), weight: 40, maxTimes: 0, title: "ใบประกาศจับ", prepare: (l) => { l.flags.ftBounty = l.age + 2; return {}; } }),
  E("ft.l.magicban", [14, 400], (l) => `${homeKingdom(l).name}ห้ามใช้เวทในที่สาธารณะ ผู้ตรวจการหยุดอยู่หน้าประตูบ้านคุณเพราะกลิ่นโอโซนจากห้องซ้อม`, [
    K("ซ่อนคทาให้ทัน", "luck", 45, G("เขาค้นทั่วบ้านแล้วไม่เจออะไร", {}), B("เขายึดของคุณและจดชื่อไว้", {}, (l) => addStanding(l, -8))),
    C("ร่ายใส่หน้าเขาเลย", B("ข่าวผู้ท้าทายกฎหมายแพร่ไปทั่ว", { fame: 3, magic: 3 }, (l) => addStanding(l, -15))),
    C("ยอมหยุดซ้อมปีนี้", N("คุณเก็บคทาไว้ใต้กระดาน", { joy: -2 })),
  ], { when: (l) => hereHas(l, "banMagic") && canCast(l), weight: 9, maxTimes: 4, title: "ผู้ตรวจการเวท" }),
  E("ft.l.tax", [18, 400], "คนเก็บภาษีมาพร้อมทหารสองนาย ภาษีปีนี้สูงเกินคนจะอยู่ได้", [
    C("จ่ายตามหน้าที่", N("คุณนับเหรียญให้ทีละเหรียญ", { gold: -15, joy: -2 }, (l) => addStanding(l, 2))),
    K("หลบภาษี", "smarts", 50, G("สมุดบัญชีของคุณอ่านยากโดยเจตนา", { gold: 10 }), B("เขาจับได้และคิดค่าปรับด้วย", { gold: -25 }, (l) => addStanding(l, -6))),
    C("รวมตัวชาวบ้านประท้วง", G("ทั้งถนนยืนข้างคุณ", { fame: 3 }, (l) => { addStanding(l, 4); homeKingdom(l).stability = clamp(homeKingdom(l).stability - 3, 5, 95); })),
  ], { when: (l) => hereHas(l, "heavyTax"), weight: 8, maxTimes: 5, title: "คนเก็บภาษี" }),
  SCENE("ft.l.petition", "สภา", (l) => `สมาชิกสภาของ${homeKingdom(l).name}เปิดห้องรับฟังคุณ`, [
    ...(Object.keys(LAWS) as LawId[]).map((id) => petition(id, false)),
    petition("freeTrade", true),
    C("ถอนคำร้อง", N("คุณเก็บเอกสารกลับบ้าน")),
  ]),

  SCENE("ft.e.trade", "กองคาราวาน", (l) => { const h = homeKingdom(l); const sat = Math.round(tradeSaturation(l) * 100); return `ราคาที่${h.name}: ${(Object.keys(GOODS) as Good[]).map((g) => `${GOODS[g].name} ${priceOf(h, g)}`).join(" · ")}${sat ? `\nส่งติดกันหลายปี ตลาดปลายทางเริ่มอิ่ม กำไรลดลง ${sat}% · พักหนึ่งปีแล้วจะกลับมาเต็ม` : ""}`; }, [
    tradeChoice("grain"), tradeChoice("iron"), tradeChoice("herbs"),
    C("ปีนี้ไม่ส่ง", N("คุณเก็บเงินไว้ก่อน")),
  ]),
  E("ft.e.famine", [14, 400], (l) => `ทุพภิกขภัยใน${homeKingdom(l).name} คนยืนต่อแถวหน้าโรงทานยาวถึงกำแพงเมือง`, [
    C("แบ่งเสบียงให้ชาวบ้าน", G("เด็กในถนนนี้จะจำคุณไปอีกนาน", { gold: -10, joy: 5, fame: 3 }, (l) => addStanding(l, 10))),
    C("ขายข้าวราคาแพง", G("คุณกำไรงาม และเพื่อนบ้านเลิกทักคุณ", { gold: 40, joy: -3 }, (l) => addStanding(l, -12))),
    C("เก็บไว้ให้ครอบครัว", N("คุณปิดประตูตอนกลางคืน", { joy: -2 })),
  ], { when: (l) => !!homeKingdom(l).famine, weight: 25, maxTimes: 3, title: "ทุพภิกขภัย" }),
  E("ft.e.boom", [16, 400], (l) => `${homeKingdom(l).name}กำลังรุ่งเรือง เรือสินค้าเต็มท่า และทุกคนพูดถึงการลงทุน`, [
    K("ลงทุนกับเพื่อนพ่อค้า", "smarts", 50, G("เงินเติบโตเร็วกว่าที่คิด", { gold: 60 }), B("เพื่อนพ่อค้าหายไปพร้อมเงิน", { gold: -30 })),
    C("เปิดร้านเล็กๆ", G("คนเดินผ่านร้านคุณไม่ขาดสาย", { gold: 15, joy: 3 })),
  ], { when: (l) => (homeKingdom(l).prosperity ?? 100) >= 120, weight: 8, maxTimes: 3, title: "ยุครุ่งเรือง" }),

  SCENE("ft.n.meet", "ผู้มีชื่อเสียง", (l, c) => { const n = notableAt(l, c); return n ? `คุณได้พบ${n.name} ${ROLES[n.role]}วัย ${n.age} ปี${n.faction ? ` แห่ง${dataOf(l).factions.find((x) => x.id === n.faction)?.name}` : ""}` : "คนผู้นั้นจากไปแล้ว"; }, [
    K("ทำความรู้จัก", "looks", 45, G((l, c) => `${nm(l, c)}จำชื่อคุณได้ และชวนคุณนั่งร่วมโต๊ะ`, { joy: 3 }, befriend), N("เขาพยักหน้าแล้วเดินจากไป"), { show: (l, c) => !!notableAt(l, c) && !l.people.some((p) => p.notable === c.nid) }),
    { label: `ขอเรียนวิชา (${TEACH_FEE} เหรียญทอง)`, show: (l, c) => !!notableAt(l, c), req: (l) => (l.money < TEACH_FEE * GOLD ? `ต้องมี ${TEACH_FEE} เหรียญทอง` : undefined), run: (l, c) => { addMoney(l, -TEACH_FEE * GOLD); const xp = Math.min(25, Math.round(nPower(l, c) / 3)); fl(l).body += xp; if (canCast(l)) fl(l).magic += xp; return { text: `${nm(l, c)}แก้ท่าให้คุณเพียงสามครั้ง แต่ได้ผลเกินคาด`, kind: "good" }; } },
    P("ท้าดวล", (l, c) => fightOdds(l, nPower(l, c)), (l, c) => {
      const n = notableAt(l, c), big = (n?.power ?? 0) >= 70;
      if (n) n.fame = Math.max(0, n.fame - 2);
      return (big ? BIG : G)(`คุณเอาชนะ${nm(l, c)}ต่อหน้าฝูงชน`, { fame: big ? 12 : 4, joy: 5 }, (x) => {
        addStanding(x, 2);
        if (!big) return;
        deed(x, `ชนะ${nm(x, c)}`);
        recordChronicle(worldOfLife(x), `${displayName(x)}เอาชนะ${nm(x, c)}`);
        if (!fl(x).beatGreat) { fl(x).beatGreat = true; addLegend(worldOfLife(x), { name: displayName(x), deed: `เอาชนะ${nm(x, c)}`, lifeId: x.id }); }
      })(l, c);
    }, B((l, c) => `${nm(l, c)}จัดการคุณในพริบตา`, { hp: -10 }), { show: (l, c) => !!notableAt(l, c) }),
    C("ปล่อยให้เขาไปตามทาง", N("คุณมองตามจนลับตา")),
  ]),
];

function leave(l: Life) {
  const f = fl(l), x = myFaction(l);
  if (x?.playerLed) { x.playerLed = false; x.leader = ""; }
  f.faction = undefined; f.fRank = 0; f.fMerit = 0;
}

/** เรื่องที่เกิดกับผู้เล่นทุกปีจากโลกรอบตัว */
export function civicYear(l: Life) {
  const k = homeKingdom(l), d = dataOf(l);
  if (l.flags.ftAmnesty !== k.ruler) {
    if (l.flags.ftAmnesty && standingOf(l) < 0) { addStanding(l, 15); log(l, `${k.ruler}ประกาศนิรโทษกรรมเนื่องในการขึ้นครอง`); }
    l.flags.ftAmnesty = k.ruler;
  }
  if (myFaction(l)?.playerLed) addMoney(l, 80 * GOLD);
  if (fl(l).relic === "stormcrown") addStanding(l, 2);
  if (fl(l).relic === "grief") addStat(l, "happiness", -4);
  // ใครที่รู้จักตายในโลก ข่าวมาถึงผู้เล่น · ใครตายในชีวิตผู้เล่น โลกก็เสียเขาไปด้วย
  for (const p of l.people) {
    if (p.relation !== "friend" || !p.notable) continue;
    const n = d.notables.find((x) => x.id === p.notable);
    if (p.alive && !n) { p.alive = false; log(l, `ข่าวมาถึงคุณ: ${p.name}เสียชีวิตแล้ว`); }
    else if (!p.alive && n) d.notables = d.notables.filter((x) => x !== n);
  }
}

export const loadCivic = () => { ACTIVITIES.push(...ACTS); };

// การหักหลังในราชสำนักเพื่อขึ้นเป็นใหญ่ (คำขอของผู้เล่น · ต่อยอด EXPANSION §8.5)
// บันไดอำนาจของผู้เล่น: ขุนนางผู้น้อย → คนสนิท → ขุนนางชั้นผู้ใหญ่ → เสนาบดี → มหาเสนาบดี → ผู้สำเร็จราชการ → ฮ่องเต้
// ทางสว่าง: ผลงาน ผู้อุปถัมภ์ ฝ่ายที่ชนะการสืบทอด · ทางมืด: ขายผู้อุปถัมภ์ ใส่ร้าย วางยา ผูกแม่ทัพ ยึดอำนาจ ชิงบัลลังก์
// ทุกแผนทิ้งร่องรอย (ความร้อนของแผน) — ถูกเปิดโปง ถูกหักหลังกลับ และถูกลอบสังหารได้ ยิ่งสูงยิ่งหนาว
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addMoney, clamp, displayName, log } from "../../../engine/util";
import { plantSeed } from "../life/seedStore";
import { calYear } from "../life/world";
import { B, BIG, C, E, FIGHT, G, K, N, P, PAY, near, type Res } from "../story/kit";
import { TAEL } from "../story/kit";
import { courtOf, palaceAccess } from "./court";
import { castOf, npcById, palaceOf, patronOf, princesOf, type PNpc } from "./palace";

export const COURT_RANKS = ["ขุนนางชั้นผู้น้อย", "คนสนิทในวัง", "ขุนนางชั้นผู้ใหญ่", "เสนาบดี", "มหาเสนาบดี", "ผู้สำเร็จราชการ", "ฮ่องเต้"];
export const courtRank = (l: Life) => Number(l.flags.courtRank ?? 0);
export const schemeHeat = (l: Life) => Number(l.flags.schemeHeat ?? 0);
export const HEAT_LABEL = (h: number) => (h >= 60 ? "มีคนกำลังสืบ" : h >= 30 ? "มีร่องรอย" : h > 0 ? "ยังเงียบ" : "สะอาด");
const inCourt = (l: Life) => palaceAccess(l) && !l.flags.palaceWithdrawn;

function setRank(l: Life, r: number, why: string) {
  const before = courtRank(l);
  const to = clamp(r, 0, 6);
  if (to === before) return;
  l.flags.courtRank = to;
  // ขุนนางตามสายงาน: ตำแหน่งในบันไดอำนาจดันขั้นงานขึ้นด้วย
  if (l.job?.careerId === "official") l.job.level = Math.max(l.job.level, Math.min(5, to + 1));
  log(l, `${to > before ? "📈" : "📉"} ${why} — ตอนนี้คุณคือ${COURT_RANKS[to]}`, to > before ? "milestone" : "bad");
}
const heat = (l: Life, d: number) => { l.flags.schemeHeat = clamp(schemeHeat(l) + d, 0, 100); };
/** ใครขวางทางขึ้นของคุณ (คนที่มีอิทธิพลสูงสุดที่ไม่ใช่ผู้อุปถัมภ์) */
const blocker = (l: Life) => castOf(l).filter((n) => n.id !== l.flags.palacePatron && n.role !== "empress" && n.role !== "dowager").sort((a, b) => b.inf - a.inf)[0];
const general = (l: Life) => castOf(l).find((n) => n.role === "general");
const name = (n?: PNpc) => n?.name ?? "คนผู้นั้น";
function feel(n: PNpc | undefined, d: { trust?: number; debt?: number; grudge?: number }) {
  if (!n) return;
  n.known = true;
  n.you.trust = clamp(n.you.trust + (d.trust ?? 0), -100, 100);
  n.you.debt = clamp(n.you.debt + (d.debt ?? 0), 0, 100);
  n.you.grudge = clamp(n.you.grudge + (d.grudge ?? 0), 0, 100);
}
const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { f(l, c); return r(l, c); }, { fx: r.fx });
const odds = (base: number) => (l: Life) => clamp(base + (l.stats.smarts - 50) / 200 + courtRank(l) * 0.02 - schemeHeat(l) / 300, 0.05, 0.92);

/** ยึดอำนาจ: เป็นผู้สำเร็จราชการ มีฮ่องเต้หุ่นเชิด */
function seize(l: Life) {
  const c = courtOf(l);
  const p = palaceOf(l);
  const puppet = princesOf(l).sort((a, b) => a.age - b.age)[0];
  if (puppet) {
    c.reigns.push({ name: c.emperor.name, from: c.emperor.since, to: calYear(l), how: `ถูกบีบให้สละราชสมบัติ — ${displayName(l)}ยึดอำนาจ` });
    c.emperor = { name: `ฮ่องเต้${puppet.name.replace("องค์ชาย", "")}`, age: puppet.age, temper: "puppet", health: 80, since: calYear(l) };
    p.princes = p.princes.filter((x) => x !== puppet);
  } else c.emperor.temper = "puppet";
  c.regent = displayName(l);
  l.mw!.legitimacy = clamp(l.mw!.legitimacy - 15, 0, 100);
  l.mw!.unrest = clamp(l.mw!.unrest + 10, 0, 100);
}
/** ชิงบัลลังก์: ตั้งราชวงศ์ของตัวเอง */
function usurp(l: Life) {
  const c = courtOf(l);
  c.reigns.push({ name: c.emperor.name, from: c.emperor.since, to: calYear(l), how: `ถูกโค่นบัลลังก์ — ${displayName(l)}ตั้งราชวงศ์ใหม่` });
  c.dynasty = `ราชวงศ์${l.lastName || l.firstName}`;
  c.emperor = { name: `ฮ่องเต้${l.firstName}`, age: l.age, temper: "wise", health: 100, since: calYear(l) };
  c.regent = undefined;
  palaceOf(l).princes = [];
  l.flags.emperorSelf = true;
  l.flags.foundedDynasty = true;
  l.mw!.legitimacy = clamp(l.mw!.legitimacy - 25, 0, 100);
  l.mw!.unrest = clamp(l.mw!.unrest + 20, 0, 100);
}

const fail = (text: string, d: { heat?: number; rank?: number; grudgeOn?: (l: Life, c: Ctx) => PNpc | undefined } = {}): Res =>
  act(B(text, { align: -2 }), (l, c) => { heat(l, d.heat ?? 30); if (d.rank) setRank(l, courtRank(l) + d.rank, "แผนพัง"); feel(d.grudgeOn?.(l, c), { grudge: 60, trust: -50 }); });

export const SCHEME_EVENTS: GameEvent[] = [
  {
    id: "ct.s_menu",
    minAge: 18,
    maxAge: 100,
    manual: true,
    maxTimes: 0,
    title: "แผนชิงอำนาจ",
    text: (l) => `ตอนนี้คุณคือ${COURT_RANKS[courtRank(l)]} — ร่องรอยของแผนเก่า: ${HEAT_LABEL(schemeHeat(l))}${patronOf(l) ? ` · ผู้อุปถัมภ์: ${patronOf(l)!.name}` : ""}${blocker(l) ? ` · คนที่ขวางทางขึ้น: ${blocker(l)!.name} (${blocker(l)!.title})` : ""}`,
    choices: [
      P("ขายความลับของผู้อุปถัมภ์ให้ศัตรูของเขา", odds(0.5), act(G((l) => `${name(patronOf(l))}ถูกปลดในเช้าวันรุ่งขึ้น — คนที่รับความลับไปตั้งคุณขึ้นแทนที่ คืนนั้นคุณนอนไม่หลับ`, { align: -6, tael: 40 }), (l) => {
        const old = patronOf(l)!;
        old.out = true;
        feel(old, { grudge: 90, trust: -80 });
        plantSeed(l, "betrayed", old.name);
        const rival = castOf(l).filter((n) => n.id !== old.id && n.backs !== old.backs).sort((a, b) => b.inf - a.inf)[0];
        if (rival) { l.flags.palacePatron = rival.id; feel(rival, { trust: 25, debt: 20 }); } else delete l.flags.palacePatron;
        heat(l, 20);
        setRank(l, courtRank(l) + 1, `คุณขายผู้อุปถัมภ์เพื่อก้าวขึ้น`);
      }), fail("ผู้อุปถัมภ์รู้ก่อน — เขาตัดคุณออกจากทุกอย่าง และเล่าให้ทั้งวังฟังว่าคุณเป็นคนแบบไหน", { heat: 30, rank: -1, grudgeOn: (l) => patronOf(l) }), { show: (l) => !!patronOf(l), pros: "ขึ้นหนึ่งขั้นทันที", cons: "หักหลังคนที่ช่วยคุณ · ร่องรอยหนัก" }),

      K("ปลอมหลักฐานใส่ร้ายคนที่ขวางทาง", "smarts", 62, act(G((l) => `${name(blocker(l))}ถูกจับกลางท้องพระโรงพร้อม "จดหมายกบฏ" ที่คุณเขียนเอง — ตำแหน่งของเขาตกเป็นของคุณ`, { align: -5 }), (l) => {
        const b = blocker(l)!;
        b.out = true;
        plantSeed(l, "betrayed", b.name);
        heat(l, 25);
        l.flags.framedSomeone = Number(l.flags.framedSomeone ?? 0) + 1;
        setRank(l, courtRank(l) + 1, `คุณใส่ร้ายคู่แข่งจนพ้นทาง`);
      }), fail("หมึกในจดหมายยังไม่แห้งดีตอนถูกตรวจ — คนที่คุณจะใส่ร้ายรู้แล้วว่าเป็นใคร", { heat: 35, grudgeOn: (l) => blocker(l) }), { show: (l) => !!blocker(l), pros: "ขึ้นหนึ่งขั้น", cons: "ร่องรอยหนัก · ถ้าพลาด เขาจะแค้น" }),

      P("วางยาคนที่ขวางทาง (40 ตำลึง)", odds(0.45), act(G((l) => `${name(blocker(l))}ล้มลงกลางงานเลี้ยง หมอหลวงบอกว่าหัวใจวาย — ไม่มีใครมองมาทางคุณ`, { align: -10, tael: -40 }), (l) => {
        const b = blocker(l)!;
        b.alive = false;
        plantSeed(l, "killed", b.name);
        l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1;
        heat(l, 35);
        setRank(l, courtRank(l) + 1, "ที่ว่างของคนตายตกเป็นของคุณ");
      }), act(fail("เขาเทชาทิ้งเพราะกลิ่นแปลก — คนในครัวถูกจับ และกำลังถูกสอบสวน", { heat: 45, grudgeOn: (l) => blocker(l) }), (l) => addMoney(l, -40 * TAEL)), { tone: "danger", req: (l) => (l.money < 40 * TAEL ? "ต้องมีเงิน 40 ตำลึง" : undefined), show: (l) => !!blocker(l) && courtRank(l) >= 1, pros: "ขึ้นหนึ่งขั้น", cons: "ฆ่าคน · ถ้าคนในครัวพูด คุณจบ" }),

      K("ผูกสัมพันธ์ลับกับแม่ทัพ", "looks", 55, act(G((l) => `${name(general(l))}รับของขวัญและคำสัญญา — "เมื่อถึงวันนั้น ทหารของข้าจะรู้ว่าต้องยืนข้างใคร"`, {}), (l) => {
        const g = general(l)!;
        feel(g, { trust: 30, debt: 20 });
        l.flags.generalAlly = g.id;
        heat(l, 10);
      }), fail("แม่ทัพส่งของขวัญคืนพร้อมจดหมายสั้นๆ: \"ข้ารับใช้บัลลังก์ ไม่ใช่คน\"", { heat: 15 }), { show: (l) => !!general(l) && !l.flags.generalAlly && courtRank(l) >= 2 }),

      P("ยึดอำนาจ — ล้อมวังในคืนเดียว", (l) => clamp(0.3 + courtRank(l) * 0.05 + (l.stats.smarts - 50) / 200 + (npcById(l, l.flags.generalAlly)?.inf ?? 0) / 300 - schemeHeat(l) / 250, 0.1, 0.85), act(BIG((l) => `ทหารของแม่ทัพล้อมวังก่อนรุ่งสาง ประตูทุกบานเปิดให้คุณ — ${courtOf(l).emperor.name}ประทับบนบัลลังก์ แต่คนที่ออกคำสั่งตอนนี้คือคุณ`, { fame: 15 }), (l) => {
        seize(l);
        heat(l, 30);
        setRank(l, 5, "คุณยึดอำนาจทั้งราชสำนัก");
      }), act(B("ทหารครึ่งหนึ่งไม่ยอมยกดาบใส่วัง — คุณหนีออกทางประตูหลังพร้อมแผลที่หลัง ชื่อคุณอยู่บนใบประกาศจับทั่วแผ่นดิน", { hp: -25, flag: ["wanted", "palaceWithdrawn"], wound: ["ribs", "broken", 2] }), (l) => { l.flags.courtRank = 0; l.flags.heat = 90; l.flags.lastCrime = "กบฏ"; }), { tone: "danger", survival: () => 0.8, show: (l) => courtRank(l) >= 4 && courtRank(l) < 5 && !!npcById(l, l.flags.generalAlly)?.alive, pros: "เป็นผู้สำเร็จราชการ คุมทั้งแผ่นดิน", cons: "พลาด = กบฏ ถูกตามล่าทั้งแผ่นดิน" }),

      P("ขึ้นครองบัลลังก์เอง", (l) => clamp(0.35 + l.fame / 300 + (l.mw?.legitimacy ?? 50) / -400 + 0.15 - schemeHeat(l) / 250, 0.1, 0.8), act(BIG((l) => `ขุนนางทั้งท้องพระโรงคุกเข่า — วันนี้คุณคือฮ่องเต้${l.firstName} ผู้ตั้งราชวงศ์ใหม่ ประวัติศาสตร์จะเขียนว่าคุณเป็นผู้กอบกู้ หรือกบฏ ขึ้นกับว่าใครเป็นคนเขียน`, { fame: 30 }), (l) => {
        usurp(l);
        heat(l, 20);
        setRank(l, 6, "คุณขึ้นครองบัลลังก์มังกร");
      }), act(B("ขุนนางฝ่ายราชวงศ์เดิมลุกฮือ — คุณถูกจับในห้องบรรทมของตัวเอง", { die: "ถูกประหารข้อหาชิงบัลลังก์" }), () => {}), { tone: "danger", survival: (l) => clamp(0.35 + l.fame / 300 - schemeHeat(l) / 250 + 0.15, 0.1, 0.8), show: (l) => courtRank(l) === 5, pros: "เป็นฮ่องเต้ ตั้งราชวงศ์ของตัวเอง", cons: "พลาด = ประหาร" }),

      C("ยังไม่ใช่เวลา", N("คุณเก็บแผนไว้ในใจ — ในวังนี้ คนที่รีบมักตายก่อน")),
    ],
  },

  // ───── ผลที่ตามมา ─────
  E("ct.s_exposed", [18, 100], (l) => `ขุนนางตรวจการยื่นฎีกาต่อหน้าพระพักตร์ — มีชื่อคุณ หลักฐานจากแผนเก่า และพยานหนึ่งคนที่คุณคิดว่าเงียบไปแล้ว (ร่องรอย: ${HEAT_LABEL(schemeHeat(l))})`, [
    K("ทำลายหลักฐานให้ทันก่อนรุ่งเช้า", "smarts", 58, act(G("ห้องเก็บเอกสารเกิดไฟไหม้เล็กๆ ตอนตีสาม — คดีไม่มีหลักฐานเหลือ", {}), (l) => heat(l, -40)), act(B("คนเฝ้าหอเอกสารจับได้คาหนังคาเขา — ความผิดเพิ่มอีกหนึ่งข้อ", { fame: -5 }), (l) => { heat(l, 15); setRank(l, courtRank(l) - 2, "คุณถูกปลดจากตำแหน่ง"); })),
    PAY("ติดสินบนขุนนางตรวจการ", (l) => 60 + courtRank(l) * 30, act(N("ฎีกาฉบับนั้นหายไปจากโต๊ะ — ขุนนางตรวจการมีบ้านหลังใหม่", { align: -2 }), (l) => heat(l, -30))),
    C("โยนความผิดให้ลูกน้อง", act(N("ลูกน้องคนสนิทถูกตัดหัวแทนคุณ — คนในวังเห็นทุกอย่าง และไม่มีใครอยากเป็นลูกน้องคุณอีก", { align: -8, fame: -4 }), (l) => { heat(l, -35); plantSeed(l, "killed", "ลูกน้องที่รับผิดแทน"); })),
    C("หนีออกจากเมืองหลวง", act(N("คุณออกประตูเมืองในคราบพ่อค้าผ้า — ตำแหน่งทั้งหมดที่ไต่ขึ้นมาหายไปในคืนเดียว", { joy: -6 }), (l) => { l.flags.courtRank = 0; l.flags.palaceWithdrawn = true; delete l.flags.palacePatron; l.flags.schemeHeat = 0; })),
    C("ยอมรับผิด", act(B("คุณถูกปลด ยึดทรัพย์ครึ่งหนึ่ง และจำคุกห้าปี — แต่ยังมีชีวิต", { fame: -10 }), (l) => { addMoney(l, -Math.round(Math.max(0, l.money) / 2)); l.flags.jailUntil = l.age + 5; l.flags.courtRank = 0; l.flags.schemeHeat = 0; l.flags.palaceWithdrawn = true; })),
  ], { when: (l) => !!l.flags.schemeExposed, forced: true, weight: 60, maxTimes: 0, title: "ถูกเปิดโปง" }),

  E("ct.s_backstab", [18, 100], (l, c) => `${name(npcById(l, c.nid))}ที่คุณไว้ใจที่สุดในวัง ยื่นสมุดบัญชีลับของคุณให้คู่แข่ง — เขาเห็นว่าคุณสูงเกินไปแล้ว และคนที่สูงเกินไปมักล้มแรง`, [
    P("ชิงลงมือก่อน", odds(0.5), act(G((l, c) => `ก่อนสมุดบัญชีจะถึงมือคนอ่าน ${name(npcById(l, c.nid))}ถูกปลดด้วยข้อหาที่คุณเตรียมไว้นานแล้ว`, { align: -3 }), (l, c) => { const n = npcById(l, c.nid); if (n) n.out = true; heat(l, 15); }), act(B("คุณช้าไปหนึ่งก้าว — สมุดบัญชีถึงมือฮ่องเต้แล้ว", { fame: -6 }), (l) => { setRank(l, courtRank(l) - 2, "ถูกคนสนิทหักหลัง"); heat(l, 20); })),
    K("ทูลแก้ต่างต่อหน้าพระพักตร์", "looks", 55, act(G("ฮ่องเต้ทรงเห็นว่าเป็นการใส่ร้ายกันในวัง — คนที่หักหลังคุณถูกส่งไปชายแดน", {}), (l, c) => { const n = npcById(l, c.nid); if (n) n.out = true; }), act(B("ไม่มีใครเชื่อ — คุณถูกลดขั้น", { fame: -4 }), (l) => setRank(l, courtRank(l) - 1, "ถูกคนสนิทหักหลัง"))),
    C("ยอมถอยหนึ่งก้าว", act(N("คุณยอมลดตำแหน่งให้เรื่องจบ — บทเรียนคือในวังนี้ไม่มีคนสนิท", { joy: -4 }), (l) => setRank(l, courtRank(l) - 1, "คุณยอมถอย"))),
  ], { when: (l) => inCourt(l) && courtRank(l) >= 3 && castOf(l).some((n) => n.you.trust >= 15 && n.amb >= 60), prepare: (l) => ({ nid: pick(l, castOf(l).filter((n) => n.you.trust >= 15 && n.amb >= 60)).id }), weight: 5, maxTimes: 2, title: "คนสนิทหักหลัง" }),

  E("ct.s_assassin", [18, 100], (l) => `คืนเดือนมืด เงาสามเงาข้ามกำแพงจวนของ${COURT_RANKS[courtRank(l)]} — คนที่คุณเหยียบขึ้นมาไม่ได้ลืม`, [
    FIGHT("สู้ด้วยตัวเอง", "มือสังหารที่ศัตรูในวังส่งมา", near(0), { lethal: true, intro: "คุณคว้าดาบข้างหมอน — พวกมันไม่คิดว่าขุนนางจะจับดาบเป็น" }),
    PAY("เรียกองครักษ์ที่จ้างไว้", 20, G("องครักษ์ของคุณจับได้สองคน คนที่สามหนีไป — อย่างน้อยคุณรู้แล้วว่าใครส่งมา", {})),
    P("หนีทางลับใต้ห้องนอน", () => 0.75, G("คุณหายลงไปในอุโมงค์ที่ขุดไว้ตั้งแต่วันแรกที่ได้ตำแหน่ง — คนในวังต้องมีทางหนีเสมอ", {}), B("ทางลับถูกปิดตาย — คุณถูกแทงก่อนองครักษ์จะมาถึง", { hp: -30, wound: ["organs", "cut", 2] }), { skill: ["escape"] }),
  ], { when: (l) => inCourt(l) && courtRank(l) >= 3, weight: (l) => 2 + courtRank(l), maxTimes: 0, title: "มือสังหารในจวน" }),

  E("ct.s_promote", [18, 100], (l) => `${name(patronOf(l))}ผู้อุปถัมภ์ของคุณกราบทูลชื่อคุณต่อหน้าที่ประชุม — ผลงานหลายปีที่ผ่านมามีคนเห็น`, [
    C("รับตำแหน่งด้วยความถ่อมตน", act(G("คุณก้าวขึ้นโดยไม่ต้องเหยียบหัวใคร — หายากในวังนี้", { fame: 3 }), (l) => setRank(l, courtRank(l) + 1, "ผลงานและผู้อุปถัมภ์พาคุณขึ้น"))),
  ], { when: (l) => inCourt(l) && courtRank(l) < 3 && (patronOf(l)?.you.trust ?? 0) >= 30 && (patronOf(l)?.inf ?? 0) >= 50, weight: 6, maxTimes: 3, title: "เลื่อนตำแหน่ง" }),
];

/** ทุกปี: ร่องรอยจางลง แต่อาจถูกเปิดโปง · ตำแหน่งสูงได้เบี้ยหวัด · ฮ่องเต้คือคุณ (ไม่สวรรคตแยกจากตัวคุณ) */
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || !l.mw) return;
  const h = schemeHeat(l);
  if (h > 0) {
    if (inCourt(l) && chance(l, h / 220)) l.flags.schemeExposed = true;
    heat(l, -6);
  }
  // หนุนองค์ชายที่ได้ครองราชย์ = ได้ขยับในราชสำนัก (ครั้งเดียวต่อการผลัดแผ่นดิน)
  if (l.flags.courtHonored && !l.flags.honorRanked) { l.flags.honorRanked = true; setRank(l, courtRank(l) + 1, "ฮ่องเต้องค์ใหม่ไม่ลืมคนที่ยืนข้างพระองค์"); }
  const r = courtRank(l);
  if (r >= 1 && inCourt(l)) addMoney(l, r * 15 * TAEL);
  if (l.flags.emperorSelf) { const c = courtOf(l); c.emperor.age = l.age; c.emperor.health = 100; c.edict = undefined; }
});

/** ทางเข้าแผนชิงอำนาจ (กิจกรรมในแท็บทำ) */
export const canScheme = (l: Life) => inCourt(l) && courtRank(l) < 6;
// ฉากถูกเปิดโปง: ไม่ว่าเลือกอะไร เรื่องนี้จบในฉากนี้ (ล้างธงตอนเลือก ไม่ใช่ตอนเตรียมฉาก)
for (const ch of SCHEME_EVENTS.find((e) => e.id === "ct.s_exposed")!.choices!) {
  const run = ch.run;
  ch.run = (l, c, ok) => { delete l.flags.schemeExposed; return run(l, c, ok); };
}

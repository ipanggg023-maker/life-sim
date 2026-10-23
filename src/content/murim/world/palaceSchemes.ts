// การหักหลังในราชสำนักเพื่อขึ้นเป็นใหญ่ (คำขอของผู้เล่น · ต่อยอด EXPANSION §8.5)
// บันไดอำนาจของผู้เล่น: ขุนนางผู้น้อย → คนสนิท → ขุนนางชั้นผู้ใหญ่ → เสนาบดี → มหาเสนาบดี → ผู้สำเร็จราชการ → ฮ่องเต้
// ทางสว่าง: ผลงาน ผู้อุปถัมภ์ ฝ่ายที่ชนะการสืบทอด · ทางมืด: ขายผู้อุปถัมภ์ ใส่ร้าย วางยา ผูกแม่ทัพ ยึดอำนาจ ชิงบัลลังก์
// ทุกแผนทิ้งร่องรอย (ความร้อนของแผน) — ถูกเปิดโปง ถูกหักหลังกลับ และถูกลอบสังหารได้ ยิ่งสูงยิ่งหนาว
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addMoney, clamp, displayName, log, people } from "../../../engine/util";
import { plantSeed } from "../life/seedStore";
import { calYear } from "../life/world";
import { B, BIG, C, E, FIGHT, G, K, N, P, PAY, near, type Res } from "../story/kit";
import { TAEL } from "../story/kit";
import { courtOf, palaceAccess } from "./court";
import { castOf, npcById, palaceOf, patronOf, princesOf, type PNpc } from "./palace";
import { emperorTitle, syncThrone } from "./emperor";
import { hasT } from "../life/talentArcs";

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
function usurp(l: Life, o: { legit?: number; unrest?: number; how?: string } = {}) {
  const c = courtOf(l);
  c.reigns.push({ name: c.emperor.name, from: c.emperor.since, to: calYear(l), how: o.how ?? `ถูกโค่นบัลลังก์ — ${displayName(l)}ตั้งราชวงศ์ใหม่` });
  c.dynasty = `ราชวงศ์${l.lastName || l.firstName}`;
  c.emperor = { name: emperorTitle(l), age: l.age, temper: "wise", health: 100, since: calYear(l) };
  c.regent = undefined;
  palaceOf(l).princes = [];
  l.flags.emperorSelf = true;
  l.flags.foundedDynasty = true;
  l.mw!.legitimacy = clamp(l.mw!.legitimacy - (o.legit ?? 25), 0, 100);
  l.mw!.unrest = clamp(l.mw!.unrest + (o.unrest ?? 20), 0, 100);
  syncThrone(l);
}
/** ขึ้นครองบัลลังก์จากนอกวัง (เช่น ทายาทราชวงศ์เก่ายกทัพเข้าเมืองหลวง) */
export function claimThrone(l: Life, how: string) {
  usurp(l, { legit: 15, unrest: 10, how: `${how} — ${displayName(l)}ขึ้นครองราชย์` });
  l.flags.courtRank = 6;
  l.flags.palaceAccess = true;
}
const eunuch = (l: Life) => castOf(l).filter((n) => n.role === "eunuch").sort((a, b) => b.inf - a.inf)[0];
/** พรรคพวกที่ใช้ยึดอำนาจได้: แม่ทัพ หรือขันทีคุมประตูวัง */
const ally = (l: Life) => { const g = npcById(l, l.flags.generalAlly); if (g?.alive && !g.out) return g; const e = npcById(l, l.flags.eunuchAlly); return e?.alive && !e.out ? e : undefined; };
/** ลูกที่ส่งเข้าวังได้ (อายุ 14–30) */
const marriageable = (l: Life) => people(l, "child").find((p) => p.alive && p.age >= 14 && p.age <= 30 && !p.tags?.includes("in_palace"));
/** โอกาสขึ้นบัลลังก์: ชื่อเสียง สติปัญญา ลางร้ายที่ปล่อยไว้ พรรคพวก หักด้วยความชอบธรรมของราชวงศ์เดิมและร่องรอย */
const throneOdds = (base: number) => (l: Life) => clamp(base + l.fame / 300 + (l.stats.smarts - 50) / 250 - (l.mw?.legitimacy ?? 50) / 400 + (l.flags.omenSpread ? 0.08 : 0) + (ally(l) ? 0.06 : 0) + (hasT(l, "mt_lost_royal") ? 0.1 : 0) - schemeHeat(l) / 250, 0.05, 0.85);
const ego = (l: Life) => emperorTitle(l);

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

      P("ยึดอำนาจ — ล้อมวังในคืนเดียว", (l) => clamp(0.3 + courtRank(l) * 0.05 + (l.stats.smarts - 50) / 200 + (ally(l)?.inf ?? 0) / 300 - schemeHeat(l) / 250, 0.1, 0.85), act(BIG((l) => `ทหารของแม่ทัพล้อมวังก่อนรุ่งสาง ประตูทุกบานเปิดให้คุณ — ${courtOf(l).emperor.name}ประทับบนบัลลังก์ แต่คนที่ออกคำสั่งตอนนี้คือคุณ`, { fame: 15 }), (l) => {
        seize(l);
        heat(l, 30);
        setRank(l, 5, "คุณยึดอำนาจทั้งราชสำนัก");
      }), act(B("ทหารครึ่งหนึ่งไม่ยอมยกดาบใส่วัง — คุณหนีออกทางประตูหลังพร้อมแผลที่หลัง ชื่อคุณอยู่บนใบประกาศจับทั่วแผ่นดิน", { hp: -25, flag: ["wanted", "palaceWithdrawn"], wound: ["ribs", "broken", 2] }), (l) => { l.flags.courtRank = 0; l.flags.heat = 90; l.flags.lastCrime = "กบฏ"; }), { tone: "danger", survival: () => 0.8, show: (l) => courtRank(l) >= 4 && courtRank(l) < 5 && !!ally(l), pros: "เป็นผู้สำเร็จราชการ คุมทั้งแผ่นดิน", cons: "พลาด = กบฏ ถูกตามล่าทั้งแผ่นดิน" }),

      P("ประกาศขึ้นครองบัลลังก์กลางท้องพระโรง", throneOdds(0.5), act(BIG((l) => `ขุนนางทั้งท้องพระโรงคุกเข่า — วันนี้คุณคือ${ego(l)} ผู้ตั้งราชวงศ์ใหม่ ประวัติศาสตร์จะเขียนว่าคุณเป็นผู้กอบกู้ หรือกบฏ ขึ้นกับว่าใครเป็นคนเขียน`, { fame: 30 }), (l) => {
        usurp(l);
        heat(l, 20);
        setRank(l, 6, "คุณขึ้นครองบัลลังก์มังกร");
      }), act(B("ขุนนางฝ่ายราชวงศ์เดิมลุกฮือ — คุณถูกจับในห้องบรรทมของตัวเอง", { die: "ถูกประหารข้อหาชิงบัลลังก์" }), () => {}), { tone: "danger", survival: throneOdds(0.5), show: (l) => courtRank(l) === 5, pros: "เป็นฮ่องเต้ ตั้งราชวงศ์ของตัวเอง", cons: "พลาด = ประหาร" }),

      // ───── ทางขึ้นบัลลังก์แบบอื่น ─────
      P("บีบหุ่นเชิดให้สละราชสมบัติให้ในพิธีหน้าศาลบรรพชน", throneOdds(0.35), act(BIG((l) => `ฮ่องเต้หุ่นเชิดอ่านราชโองการสละราชสมบัติด้วยเสียงสั่น — "ฟ้าเลือก${displayName(l)}" ไม่มีเลือดสักหยด ราษฎรเรียกวันนี้ว่าวันที่ฟ้าเปลี่ยนโดยชอบ และเรียกคุณว่า${ego(l)}`, { fame: 25 }), (l) => { usurp(l, { legit: 5, unrest: 5, how: `สละราชสมบัติให้${displayName(l)}ในพิธีหน้าศาลบรรพชน` }); heat(l, 5); setRank(l, 6, "คุณรับราชสมบัติจากมือหุ่นเชิด"); }), act(B("หุ่นเชิดหนีออกจากวังกลางดึกไปหาขุนนางฝ่ายราชวงศ์เดิม — ประกาศว่าคุณบังคับขู่เข็ญ หัวเมืองครึ่งหนึ่งไม่ยอมรับคุณอีก", { fame: -8 }), (l) => { heat(l, 35); if (l.mw) l.mw.unrest = clamp(l.mw.unrest + 15, 0, 100); }), { show: (l) => courtRank(l) === 5 && courtOf(l).emperor.temper === "puppet", pros: "ขึ้นบัลลังก์อย่างชอบธรรม ราชวงศ์มั่นคง", cons: "พลาด = หุ่นเชิดหนีไปตั้งตัวต่อต้าน" }),
      P("ยกทัพเข้าวัง ชิงบัลลังก์ด้วยดาบ", (l) => clamp(throneOdds(0.45)(l) + (npcById(l, l.flags.generalAlly)?.alive ? 0.15 : 0), 0.05, 0.9), act(BIG((l) => `ทหารห้าพันนายล้อมวังตอนเที่ยงคืน — ราชวงศ์เก่าสิ้นสุดในคืนเดียว เช้ามาคุณนั่งบัลลังก์ด้วยเกราะที่ยังเปื้อนเลือด ทั้งแผ่นดินรู้ว่า${ego(l)}ได้บัลลังก์มาด้วยดาบ`, { fame: 20, align: -8 }), (l) => { usurp(l, { legit: 35, unrest: 25, how: `ถูกโค่นด้วยกำลังทหาร — ${displayName(l)}ยึดวังในคืนเดียว` }); heat(l, 25); setRank(l, 6, "คุณยึดบัลลังก์ด้วยกำลังทหาร"); }), act(B("ทหารรักษาวังสู้ถึงคนสุดท้าย — กบฏของคุณแตกพ่ายก่อนรุ่งสาง", { die: "ตายในการยกทัพบุกวังชิงบัลลังก์" }), () => {}), { tone: "danger", survival: (l) => clamp(throneOdds(0.45)(l) + (npcById(l, l.flags.generalAlly)?.alive ? 0.15 : 0), 0.05, 0.9), show: (l) => courtRank(l) === 5 && !!ally(l), pros: "ได้บัลลังก์แน่นอนกว่า", cons: "ความชอบธรรมพังหนัก · พลาด = ตายในวัง" }),
      C("อยู่เบื้องหลังต่อไป — ให้หุ่นเชิดนั่งบัลลังก์", act(N("คุณถวายบังคมหุ่นเชิดทุกเช้า แล้วกลับไปออกคำสั่งทุกบ่าย — อำนาจเต็มมือ โดยไม่ต้องเป็นเป้าของฟ้า", {}), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 3, 0, 100); heat(l, -10); }), { show: (l) => courtRank(l) === 5 }),

      // ───── หักหลังแบบอื่นระหว่างทาง ─────
      K("ยุแยงองค์ชายให้แย่งบัลลังก์กันเอง", "smarts", 58, act(G("จดหมายนิรนามสองฉบับ คนละวัง คนละเรื่อง — สามเดือนต่อมาองค์ชายสองพระองค์ไม่มองหน้ากัน และทั้งสองฝ่ายต่างส่งคนมาซื้อใจคุณ", { align: -3 }), (l) => { const p = palaceOf(l); p.pressure = clamp(p.pressure + 20, 0, 100); heat(l, 15); setRank(l, courtRank(l) + 1, "ทั้งสองขั้วต้องการคุณ"); }), fail("ลายมือในจดหมายนิรนามถูกเทียบได้ — องค์ชายทั้งสองรู้ว่าใครเป็นคนยุ", { heat: 30 }), { show: (l) => princesOf(l).length >= 2 && courtRank(l) >= 1 && courtRank(l) < 5, pros: "ขึ้นหนึ่งขั้น · วังปั่นป่วน", cons: "ร่องรอย · ถ้าพลาด ทั้งสองฝ่ายเกลียดคุณ" }),

      P("ซื้อใจขันทีคุมประตูวัง (30 ตำลึง)", odds(0.55), act(G((l) => `${name(eunuch(l))}รับกล่องทองแล้วยิ้มบาง — "ประตูไหนที่ท่านอยากให้เปิดตอนดึก ข้าจำได้ทุกบาน"`, { tael: -30 }), (l) => { const e = eunuch(l)!; feel(e, { trust: 25, debt: 30 }); l.flags.eunuchAlly = e.id; heat(l, 10); }), act(fail("ขันทีรับทอง แล้วนำกล่องไปถวายฮ่องเต้พร้อมชื่อคุณ", { heat: 30 }), (l) => addMoney(l, -30 * TAEL)), { req: (l) => (l.money < 30 * TAEL ? "ต้องมีเงิน 30 ตำลึง" : undefined), show: (l) => !!eunuch(l) && !ally(l) && courtRank(l) >= 2, pros: "มีพรรคพวกในวังชั้นใน ใช้ยึดอำนาจแทนแม่ทัพได้", cons: "ถ้าขันทีขายคุณ ร่องรอยหนัก" }),

      P("ส่งลูกเข้าวังเป็นสนม/ผูกดองกับตระกูลฮองเฮา", (l) => clamp(0.35 + (l.stats.looks - 50) / 200 + courtRank(l) * 0.05 + l.fame / 400, 0.1, 0.85), act(G((l) => `${marriageable(l)?.name ?? "ลูกของคุณ"}เข้าวังในเกี้ยวแดง — ตอนนี้คุณเป็นญาติของราชวงศ์ ขุนนางที่เคยมองข้ามคุณเริ่มโค้งต่ำลง`, {}), (l) => { const k = marriageable(l); if (k) { k.tags = [...(k.tags ?? []), "in_palace"]; k.bond = Math.max(0, k.bond - 10); } setRank(l, courtRank(l) + 1, "คุณกลายเป็นญาติของราชวงศ์"); heat(l, 5); }), fail("ฮองเฮาไม่ยอมให้ตระกูลคุณเข้ามาแข่งบารมี — ลูกของคุณถูกส่งกลับบ้านพร้อมคำดูถูก", { heat: 10 }), { show: (l) => !!marriageable(l) && courtRank(l) >= 2 && courtRank(l) < 5, pros: "ขึ้นหนึ่งขั้นโดยไม่ต้องฆ่าใคร", cons: "ชีวิตลูกกลายเป็นหมากการเมือง" }),

      P("ปล่อยข่าวลางร้ายว่าฟ้าทอดทิ้งราชวงศ์", odds(0.5), act(G("ไก่ตัวเมียขันกลางวัง บ่อน้ำหน้าศาลบรรพชนกลายเป็นสีเลือด — คนทั้งเมืองหลวงกระซิบว่าอาณัติแห่งฟ้ากำลังจะย้ายไปหาคนใหม่", { align: -3 }), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 12, 0, 100); l.flags.omenSpread = true; heat(l, 15); }), fail("หมอผีที่คุณจ้างถูกจับและสารภาพว่าใครจ่ายเงิน", { heat: 35 }), { show: (l) => courtRank(l) >= 2 && !l.flags.omenSpread, pros: "ราชวงศ์อ่อนลง ขึ้นบัลลังก์ง่ายขึ้นภายหลัง", cons: "ร่องรอย · แผ่นดินปั่นป่วน" }),

      P("ให้หมอหลวงวางยาฮ่องเต้ทีละน้อย", odds(0.4), act(G((l) => `ยาบำรุงพระวรกายทุกเช้าเติมผงสีขาวหนึ่งหยิบมือ — ${courtOf(l).emperor.name}ทรงประชวรบ่อยขึ้นทุกเดือน และไม่มีหมอคนไหนหาสาเหตุเจอ`, { align: -10 }), (l) => { const c = courtOf(l); c.emperor.health = clamp(c.emperor.health - 40, 0, 100); plantSeed(l, "killed", c.emperor.name); heat(l, 30); }), act(fail("หมอหลวงคนหนึ่งชิมยาก่อนถวาย แล้วล้มลงต่อหน้าองครักษ์ — การสอบสวนเริ่มขึ้นในคืนนั้น", { heat: 50 }), (l) => { l.flags.schemeExposed = true; }), { tone: "danger", show: (l) => courtRank(l) >= 3 && courtRank(l) < 5 && courtOf(l).emperor.health > 20, pros: "ฮ่องเต้สวรรคตเร็วขึ้น ฝ่ายที่คุณหนุนได้ขึ้น", cons: "ปลงพระชนม์ · ถ้าพลาด ถูกเปิดโปงทันที" }),

      K("ทรยศพรรคพวก — นำแผนกบฏของพวกเขาไปถวายฮ่องเต้", "smarts", 55, act(G((l) => `คุณคุกเข่าถวายรายชื่อผู้ร่วมคิด — ${name(ally(l))}ถูกจับในคืนนั้น ฮ่องเต้จับมือคุณและเรียกคุณว่าขุนนางผู้ภักดีที่สุด`, { align: -5, fame: 4 }), (l) => { const a = ally(l); if (a) { a.out = true; feel(a, { grudge: 90, trust: -100 }); plantSeed(l, "betrayed", a.name); } delete l.flags.generalAlly; delete l.flags.eunuchAlly; l.flags.schemeHeat = 0; setRank(l, courtRank(l) + 1, "คุณขายพรรคพวกเพื่อความดีความชอบ"); }), fail("พรรคพวกของคุณรู้ตัวก่อน — และพาชื่อคุณลงไปด้วย", { heat: 45, grudgeOn: (l) => ally(l) }), { show: (l) => !!ally(l) && courtRank(l) >= 2 && courtRank(l) < 5, pros: "ล้างร่องรอยทั้งหมด · ขึ้นหนึ่งขั้น", cons: "หักหลังคนที่ร่วมคิดกับคุณ" }),

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
  ], { when: (l) => inCourt(l) && courtRank(l) >= 3, weight: (l) => Math.min(5, 2 + courtRank(l)), maxTimes: 0, title: "มือสังหารในจวน" }),

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
  if (l.flags.emperorSelf) { const c = courtOf(l); c.emperor.age = l.age; c.emperor.health = 100; }
});

/** ทางเข้าแผนชิงอำนาจ (กิจกรรมในแท็บทำ) */
export const canScheme = (l: Life) => inCourt(l) && courtRank(l) < 6;
// ฉากถูกเปิดโปง: ไม่ว่าเลือกอะไร เรื่องนี้จบในฉากนี้ (ล้างธงตอนเลือก ไม่ใช่ตอนเตรียมฉาก)
for (const ch of SCHEME_EVENTS.find((e) => e.id === "ct.s_exposed")!.choices!) {
  const run = ch.run;
  ch.run = (l, c, ok) => { delete l.flags.schemeExposed; return run(l, c, ok); };
}

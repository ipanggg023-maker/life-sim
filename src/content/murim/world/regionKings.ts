// อ๋องผู้ครองแต่ละภูมิภาค (คำขอของผู้เล่น: ย้ายไปเมืองไหนก็ควรมีผู้ปกครองของตัวเอง)
// แผ่นดินเดียว ฮ่องเต้องค์เดียวที่เมืองหลวง — แต่ทุกภูมิภาคมีอ๋องที่มีวัง ทหาร ภาษี และความทะเยอทะยานของตัวเอง
// · อยู่ในถิ่นของอ๋อง: ถูกเรียกตัวไปรับใช้ ภาษีซ้อนภาษี งานล่าสัตว์ อ๋องชวนก่อกบฏ ลูกอ๋องแย่งตำแหน่ง
// · เป็นฮ่องเต้เอง: อ๋องคือเมืองขึ้นที่ต้องคุม — กบฏ ลดอำนาจอ๋อง เรียกตัวประกัน ผูกดอง
// · ยุคสามแคว้น: แต่ละแคว้นครองภูมิภาคของตัวเอง เจ้าแคว้นประกาศตนเป็นฮ่องเต้ · แคว้นที่ล่ม ภูมิภาคของมันถูกผนวกไปตลอดกาล
import type { GameEvent } from "../../../engine/events";
import { kill, yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, clamp, log } from "../../../engine/util";
import { REGIONS, regionOf } from "../life/region";
import { calYear, worldOfLife } from "../life/world";
import { B, BIG, C, E, G, K, N, P, PAY, ab, type Res } from "../story/kit";
import { TAEL } from "../story/kit";
import { courtOf } from "./court";
import type { Kingdom } from "./war";

export type KingTemper = "loyal" | "ambitious" | "idle" | "cruel";
export const KING_TEMPER: Record<KingTemper, string> = { loyal: "ภักดีต่อบัลลังก์", ambitious: "ทะเยอทะยาน", idle: "รักสบาย", cruel: "โหดเหี้ยม" };
export interface RegionKing {
  region: string;
  name: string;
  age: number;
  temper: KingTemper;
  /** กำลังทหาร 0–100 · ความภักดีต่อฮ่องเต้ 0–100 */
  power: number;
  loyalty: number;
  heir?: string;
  /** ปีที่ลุกขึ้นก่อกบฏ (ยังไม่ถูกปราบ) */
  rebel?: number;
}

const SEAT: Record<string, string> = { north: "แห่งเยี่ยนจิง", jiangnan: "แห่งเจียงหนาน", sichuan: "แห่งแคว้นสู่", west: "ผู้พิทักษ์ตะวันตก", south: "แห่งหนานเยว่" };
const GIVEN = ["เจิ้งเหอ", "อวี้หลง", "ไท่ผิง", "จิ่งหยวน", "หมิงหยาง", "ฉางเล่อ", "เสวียนอู่", "เทียนโย่ว", "หย่งชิง", "ซิ่วเหวิน"];
const TEMPERS = Object.keys(KING_TEMPER) as KingTemper[];
/** ยุคสามแคว้น: แคว้นไหนครองภูมิภาคไหน */
export const KINGDOM_REGIONS: Record<string, string[]> = { north: ["north", "capital"], west: ["sichuan", "west"], south: ["jiangnan", "south"] };

const emp = (l: Life) => !!l.flags.emperorSelf;
const mkKing = (l: Life, region: string): RegionKing => ({ region, name: `อ๋อง${pick(l, GIVEN)}`, age: randInt(l, 25, 60), temper: pick(l, TEMPERS), power: randInt(l, 25, 60), loyalty: randInt(l, 40, 80), heir: `ซื่อจื่อ${pick(l, GIVEN)}` });
export const kingTitle = (k: RegionKing) => SEAT[k.region] ?? "อ๋อง";

/** อ๋องทุกภูมิภาค (ยกเว้นเมืองหลวงที่ฮ่องเต้ปกครองเอง) — สร้างเมื่อเรียกครั้งแรก */
export function kingsOf(l: Life): RegionKing[] {
  const w = worldOfLife(l);
  w.kings ??= REGIONS.filter((r) => r.id !== "capital").map((r) => mkKing(l, r.id));
  return w.kings;
}
export const kingOf = (l: Life, region = regionOf(l).id) => (region === "capital" ? undefined : kingsOf(l).find((k) => k.region === region));
const myKing = (l: Life) => kingOf(l);

/** ยุคสามแคว้น: แคว้นที่ครองภูมิภาคนี้ (ถ้าแคว้นเดิมล่ม = แคว้นที่ผนวก) */
export function kingdomOfRegion(l: Life, region = regionOf(l).id): { k: Kingdom; annexedFrom?: Kingdom } | undefined {
  const ks = (l.mw?.kingdoms ?? []) as Kingdom[];
  const own = ks.find((k) => KINGDOM_REGIONS[k.id]?.includes(region));
  if (!own) return undefined;
  let cur = own;
  for (let i = 0; i < 3 && cur.fallen && cur.fellTo; i++) cur = ks.find((x) => x.id === cur.fellTo) ?? cur;
  return { k: cur, annexedFrom: cur !== own ? own : undefined };
}
/** ใครปกครองที่ที่คุณอยู่ — ใช้ในแท็บยุทธภพ */
export function rulerHere(l: Life): string {
  const r = regionOf(l);
  if (l.mw?.era === "war") {
    const kk = kingdomOfRegion(l);
    if (!kk) return `${r.name} — ไม่มีใครปกครอง`;
    return `${r.name} อยู่ใต้${kk.k.name} — ${kk.k.lord}ประกาศตนเป็นฮ่องเต้แห่ง${kk.k.name}${kk.annexedFrom ? ` (${kk.annexedFrom.name}ที่เคยปกครองที่นี่ล่มสลายไปแล้ว)` : ""}`;
  }
  if (r.id === "capital") return `เมืองหลวง — ${emp(l) ? "คุณปกครองเองจากบัลลังก์มังกร" : `${courtOf(l).emperor.name}ปกครองโดยตรง`}`;
  const k = myKing(l)!;
  return `${r.name} — ${k.name}${kingTitle(k)} (${k.age} ปี · ${KING_TEMPER[k.temper]})${k.rebel ? " · กำลังก่อกบฏต่อบัลลังก์" : ""}`;
}

// ───────── ทุกปี: อ๋องแก่ลง สิ้นพระชนม์ ความภักดีขยับตามความชอบธรรม กบฏ ─────────
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || !l.mw) return;
  const w = l.mw;
  // ยุคสามแคว้น: อ๋องทุกองค์เลือกข้างแคว้นในถิ่นตัวเอง (ไม่มีอ๋องแยก) · พอรวมแผ่นดิน ราชวงศ์ใหม่แต่งตั้งอ๋องชุดใหม่
  if (w.era === "war") { if (w.kings) { w.kings = undefined; w.kingsFrom = "war"; } return; }
  if (w.kingsFrom === "war") { w.kingsFrom = undefined; log(l, "🏯 ราชวงศ์ใหม่แต่งตั้งอ๋องครองหัวเมืองชุดใหม่ทั่วแผ่นดิน", "normal"); }
  const ks = kingsOf(l);
  const mine = myKing(l);
  for (const k of ks) {
    k.age++;
    k.power = clamp(k.power + randInt(l, -3, 3) + (k.temper === "ambitious" ? 1 : 0), 5, 95);
    k.loyalty = clamp(k.loyalty + (w.legitimacy >= 60 ? 1 : w.legitimacy < 30 ? -3 : -1) + (k.temper === "loyal" ? 1 : k.temper === "ambitious" ? -1 : 0), 0, 100);
    if (k.age >= 50 && chance(l, (k.age - 45) * 0.01)) {
      const old = k.name;
      const nu = mkKing(l, k.region);
      Object.assign(k, { name: k.heir?.replace("ซื่อจื่อ", "อ๋อง") ?? nu.name, age: randInt(l, 20, 35), temper: pick(l, TEMPERS), heir: nu.heir, rebel: undefined, loyalty: clamp(k.loyalty + 10, 0, 100) });
      if (k === mine || emp(l)) log(l, `🕯️ ${old}${kingTitle(k)}สิ้นพระชนม์ — ${k.name}ขึ้นครองแทน`);
      if (k === mine && !emp(l)) l.flags.kingChanged = k.region;
      continue;
    }
    // อ๋องที่ภักดีน้อยและมีทหารมาก ลุกขึ้นก่อกบฏ
    if (!k.rebel && k.loyalty < 20 && k.power >= 55 && chance(l, 0.2)) {
      k.rebel = calYear(l);
      w.unrest = clamp(w.unrest + 12, 0, 100);
      w.legitimacy = clamp(w.legitimacy - 5, 0, 100);
      log(l, `⚔️ ${k.name}${kingTitle(k)}ยกทัพประกาศว่าฟ้าทอดทิ้ง${emp(l) ? "คุณ" : courtOf(l).emperor.name}แล้ว`, emp(l) || k === mine ? "bad" : "normal");
      if (emp(l)) l.flags.kingRebel = k.region;
    } else if (k.rebel && emp(l)) {
      // กบฏที่ฮ่องเต้ปล่อยไว้ กัดกินแผ่นดินทุกปี
      w.legitimacy = clamp(w.legitimacy - 3, 0, 100);
      w.unrest = clamp(w.unrest + 3, 0, 100);
      l.flags.kingRebel = k.region;
    } else if (k.rebel && !emp(l) && chance(l, 0.3)) {
      // ไม่ใช่ฮ่องเต้: ราชสำนักปราบเอง หรือกบฏชนะแล้วอ๋องขึ้นครองราชย์
      if (k.power >= 70 && w.legitimacy < 35 && chance(l, 0.35)) {
        const c = courtOf(l);
        c.reigns.push({ name: c.emperor.name, from: c.emperor.since, to: calYear(l), how: `ถูกโค่นโดย${k.name}${kingTitle(k)}` });
        c.emperor = { name: `ฮ่องเต้${k.name.replace("อ๋อง", "")}`, age: k.age, temper: k.temper === "cruel" ? "tyrant" : "wise", health: 80, since: calYear(l) };
        w.legitimacy = 45;
        log(l, `🏯 ทัพของ${k.name}เข้าเมืองหลวง — ${c.emperor.name}ขึ้นครองราชย์`, "milestone");
        Object.assign(k, mkKing(l, k.region));
        if (l.flags.kingRebelWith === k.region) { addFame(l, 15); addMoney(l, 200 * TAEL); l.flags.courtRank = Math.max(Number(l.flags.courtRank ?? 0), 3); l.flags.palaceAccess = true; log(l, "👑 คุณยืนข้างผู้ชนะ — ฮ่องเต้องค์ใหม่แต่งตั้งคุณเป็นเสนาบดี", "milestone"); }
      } else {
        log(l, `🏳️ ทัพหลวงปราบกบฏของ${k.name}สำเร็จ — ${REGIONS.find((r) => r.id === k.region)?.name ?? "หัวเมือง"}ได้อ๋ององค์ใหม่`, k === mine ? "bad" : "normal");
        if (l.flags.kingRebelWith === k.region) l.flags.rebelHunted = true;
        Object.assign(k, mkKing(l, k.region), { loyalty: 70 });
      }
      delete l.flags.kingRebelWith;
    }
  }
});

const kn = (l: Life) => myKing(l)?.name ?? "ท่านอ๋อง";
const kt = (l: Life) => (myKing(l) ? kingTitle(myKing(l)!) : "");
const with_ = (r: Res, f: (l: Life) => void): Res => Object.assign((l: Life, c: Parameters<Res>[1]) => { f(l); return r(l, c); }, { fx: r.fx });
const local = (l: Life) => !emp(l) && l.mw?.era !== "war" && !!myKing(l);
const rebelKing = (l: Life) => kingsOf(l).find((k) => k.region === l.flags.kingRebel && k.rebel);

export const KING_EVENTS: GameEvent[] = [
  // ───── อยู่ในถิ่นของอ๋อง ─────
  E("kg.summon", [18, 70], (l) => `${kn(l)}${kt(l)}ได้ยินชื่อเสียงของคุณ — ส่งเกี้ยวแปดคนหามมารับไปวังอ๋อง "ท่านอ๋องต้องการคนเก่งไว้ข้างกาย"`, [
    C("รับใช้ท่านอ๋อง", with_(G((l) => `คุณได้ป้ายหยกของวังอ๋อง — ทั้ง${regionOf(l).name}รู้ว่าคุณคือคนของ${kn(l)}`, { fame: 3, tael: 15 }), (l) => { l.flags.kingServe = regionOf(l).id; })),
    K("ปฏิเสธอย่างสุภาพ อ้างว่าต้องดูแลพ่อแม่", "looks", 50, G("ท่านอ๋องส่งโสมพันปีมาให้แม่คุณพร้อมคำว่า \"ลูกกตัญญูหายาก\"", { fame: 1 }), B("ท่านอ๋องไม่พอใจ — คนเก็บภาษีของวังอ๋องเริ่มมาที่บ้านคุณบ่อยขึ้น", { tael: -5 })),
  ], { when: (l) => local(l) && l.fame >= 20 && l.flags.kingServe !== regionOf(l).id, weight: 4, maxTimes: 2, title: "เกี้ยวจากวังอ๋อง" }),

  E("kg.tax", [18, 85], (l) => `ประกาศจากวังอ๋อง${kt(l)}: นอกจากภาษีหลวง ราษฎรต้องจ่าย "ภาษีรักษาถิ่น" ให้${kn(l)}อีกส่วนหนึ่ง — ใครไม่จ่ายจะถูกเกณฑ์ไปสร้างวังใหม่ของท่านอ๋อง`, [
    PAY("จ่ายตามสั่ง", 3, N("ภาษีสองชั้น — ข้าวสวยกลายเป็นข้าวต้มอีกหนึ่งปี", { joy: -2 })),
    P("รวมชาวบ้านยื่นฎีกาถึงราชสำนักโดยตรง", ab(0.35, "smarts"), with_(G("ราชสำนักส่งขุนนางตรวจการมา — ภาษีรักษาถิ่นถูกยกเลิก ท่านอ๋องถูกตำหนิต่อหน้าทั้งแผ่นดิน", { fame: 3, align: 2 }), (l) => { const k = myKing(l); if (k) k.loyalty = clamp(k.loyalty - 10, 0, 100); }), B("ฎีกาไปไม่ถึงเมืองหลวง — คนนำฎีกาถูกเฆี่ยนหน้าวังอ๋อง", { hp: -10, align: 1 }), { tone: "danger", survival: () => 0.99 }),
    C("ย้ายไปอยู่ภูมิภาคอื่น", N("คุณเก็บของขึ้นเกวียน — อ๋องที่อื่นอาจดีกว่า หรืออาจแย่กว่า (ย้ายถิ่นได้ที่แท็บทำ → ยุทธภพ)", {})),
  ], { when: (l) => local(l) && (myKing(l)!.temper === "cruel" || myKing(l)!.temper === "ambitious"), weight: 4, maxTimes: 2, title: "ภาษีซ้อนภาษี" }),

  E("kg.hunt", [16, 60], (l) => `${kn(l)}จัดงานล่าสัตว์ประจำปีที่ป่าของวังอ๋อง เปิดให้ยอดฝีมือในถิ่นเข้าแข่ง — ใครล่าเสือได้ ได้เป็นนายกองรักษาวัง`, [
    P("เข้าแข่งล่าเสือ", ab(0.4, "health"), with_(BIG((l) => `เสือลายพาดกลอนล้มลงใต้ดาบของคุณ — ${kn(l)}ลุกจากที่นั่งมาตบไหล่คุณเอง`, { fame: 4, exp: 200, tael: 10 }), (l) => { l.flags.kingServe = regionOf(l).id; }), B("เสือตะปบไหล่จนเป็นแผลลึก — คุณรอด แต่แพ้ต่อหน้าคนทั้งถิ่น", { hp: -14, wound: ["armL", "cut", 2] }), { tone: "danger", survival: () => 0.96 }),
    C("ไปดูเฉยๆ", N("คุณได้เห็นว่าทหารของวังอ๋องมีมากกว่าที่คิด — มากเกินกว่าที่อ๋องควรมี", { iq: 1 })),
  ], { when: (l) => local(l) && !!l.power, weight: 3, maxTimes: 2, title: "ล่าเสือที่วังอ๋อง" }),

  E("kg.rebel_join", [20, 75], (l) => `${kn(l)}เรียกคุณเข้าห้องลับใต้วัง บนโต๊ะมีแผนที่เมืองหลวง — "${courtOf(l).emperor.name}ไม่ใช่ฮ่องเต้ที่ฟ้าเลือก ข้ามีทหารสามหมื่น ขาดแต่คนที่ข้าไว้ใจได้ เจ้าจะอยู่ข้างไหน"`, [
    C("ร่วมก่อการ", with_(N((l) => `คุณกรีดนิ้วหยดเลือดลงจอกสุรากับ${kn(l)} — ถ้าชนะ คุณคือขุนนางผู้ก่อตั้งราชวงศ์ ถ้าแพ้ ศีรษะคุณจะอยู่บนประตูเมือง`, { align: -3 }), (l) => { const k = myKing(l); if (k) { k.loyalty = Math.min(k.loyalty, 10); k.power = clamp(k.power + 10, 0, 100); k.rebel = calYear(l); } l.flags.kingRebelWith = regionOf(l).id; })),
    P("แอบนำความไปทูลราชสำนัก", ab(0.45, "smarts"), with_(BIG((l) => `ทัพหลวงล้อมวังอ๋องก่อนแผนจะเริ่ม — ${kn(l)}ถูกจับ ราชสำนักแต่งตั้งคุณเป็นขุนนางด้วยความดีความชอบ`, { fame: 6, tael: 50, align: -2 }), (l) => { const k = myKing(l); if (k) Object.assign(k, mkKing(l, k.region), { loyalty: 75 }); l.flags.courtRank = Math.max(Number(l.flags.courtRank ?? 0), 2); l.flags.palaceAccess = true; }), (l, c) => { kill(l, "ถูกคนของอ๋องปิดปากระหว่างทางไปเมืองหลวง"); return B("ม้าของคุณวิ่งได้ไม่ถึงครึ่งทาง…")(l, c); }, { tone: "danger", survival: (l) => ab(0.45, "smarts")(l) }),
    C("ขอตัวไม่ยุ่ง", N("ท่านอ๋องมองคุณนาน แล้วพยักหน้า — คืนนั้นคุณรู้สึกว่ามีคนตามหลังมาจนถึงบ้าน", { joy: -2 })),
  ], { when: (l) => local(l) && myKing(l)!.temper !== "loyal" && myKing(l)!.loyalty < 40 && (l.flags.kingServe === regionOf(l).id || l.fame >= 35), weight: 5, maxTimes: 1, title: "แผนที่ใต้วังอ๋อง" }),

  E("kg.new_king", [16, 90], (l) => `${kn(l)}ขึ้นครองวังอ๋อง${kt(l)}แทนอ๋ององค์ก่อน — ขุนนางในวังอ๋องแบ่งเป็นสองฝ่าย ฝ่ายหนึ่งหนุนอ๋องใหม่ อีกฝ่ายหนุนน้องชายของท่านที่คุมทหารอยู่ชายแดน`, [
    C("ไปถวายพระพรอ๋ององค์ใหม่", with_(G("อ๋ององค์ใหม่จำหน้าคุณได้ — คนที่มาก่อนคือคนที่ได้ก่อน", { fame: 2 }), (l) => { delete l.flags.kingChanged; })),
    P("หนุนน้องชายที่คุมทหาร", ab(0.35, "smarts"), with_(BIG("น้องชายยกทัพกลับมายึดวังอ๋องในสามวัน — คุณกลายเป็นคนสนิทของอ๋ององค์ใหม่ที่แท้จริง", { fame: 4, tael: 30 }), (l) => { delete l.flags.kingChanged; const k = myKing(l); if (k) { k.name = `อ๋อง${pick(l, GIVEN)}`; k.temper = "ambitious"; } l.flags.kingServe = regionOf(l).id; }), with_(B("น้องชายถูกจับตั้งแต่ยังไม่ข้ามแม่น้ำ — รายชื่อผู้สนับสนุนมีชื่อคุณอยู่ด้วย", { fame: -4, tael: -20 }), (l) => { delete l.flags.kingChanged; delete l.flags.kingServe; })),
    C("อยู่เฉยๆ", with_(N("วังอ๋องเปลี่ยนเจ้าของ ชาวบ้านยังต้องจ่ายภาษีเหมือนเดิม", {}), (l) => { delete l.flags.kingChanged; })),
  ], { when: (l) => local(l) && l.flags.kingChanged === regionOf(l).id, weight: 30, maxTimes: 0, title: "อ๋ององค์ใหม่" }),

  // ───── เป็นฮ่องเต้: อ๋องคือเมืองขึ้น ─────
  E("kg.e_rebel", [18, 100], (l) => { const k = rebelKing(l)!; return `${k.name}${kingTitle(k)}ยกทัพ ${Math.round(k.power * 600)} นายประกาศว่าฟ้าทอดทิ้งคุณแล้ว — หัวเมืองรายทางสามแห่งเปิดประตูรับ ขุนนางรอฟังพระราชโองการ`; }, [
    P("ส่งทัพหลวงไปปราบ", (l) => clamp(0.35 + (l.mw?.legitimacy ?? 50) / 200 - (rebelKing(l)?.power ?? 50) / 300 + (l.stats.smarts - 50) / 250, 0.1, 0.9), with_(BIG((l) => `ทัพหลวงตีทัพกบฏแตกที่ริมแม่น้ำ — ${rebelKing(l)?.name ?? "อ๋องกบฏ"}ถูกจับใส่กรงส่งเมืองหลวง`, { fame: 6 }), (l) => { const k = rebelKing(l); if (k) Object.assign(k, mkKing(l, k.region), { loyalty: 70 }); delete l.flags.kingRebel; if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 6, 0, 100); }), with_(B("ทัพหลวงแตกพ่าย — กบฏเดินหน้าเข้าใกล้เมืองหลวงอีกร้อยลี้", { fame: -5 }), (l) => { const k = rebelKing(l); if (k) k.power = clamp(k.power + 10, 0, 100); if (l.mw) { l.mw.legitimacy = clamp(l.mw.legitimacy - 8, 0, 100); l.mw.unrest = clamp(l.mw.unrest + 10, 0, 100); } }), { tone: "danger" }),
    K("ส่งทูตเจรจา ยอมให้ศักดินาเพิ่ม", "smarts", 55, with_(N("อ๋องกบฏถอยทัพกลับ — ได้หัวเมืองเพิ่มสองแห่ง และรู้แล้วว่าการกบฏมีราคาที่คุณยอมจ่าย", {}), (l) => { const k = rebelKing(l); if (k) { k.rebel = undefined; k.loyalty = 35; k.power = clamp(k.power + 8, 0, 100); } delete l.flags.kingRebel; }), with_(B("ทูตของคุณถูกตัดศีรษะส่งกลับมาในกล่อง", {}), (l) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy - 4, 0, 100); })),
    P("ส่งมือสังหารเข้าค่ายกบฏ", (l) => clamp(0.3 + (l.stats.smarts - 50) / 200 + (l.power?.rank ?? 0) * 0.03, 0.08, 0.8), with_(G((l) => `${rebelKing(l)?.name ?? "อ๋องกบฏ"}ถูกพบสิ้นพระชนม์ในกระโจม — ทัพกบฏแตกฮือในคืนเดียว`, { align: -6 }), (l) => { const k = rebelKing(l); if (k) Object.assign(k, mkKing(l, k.region), { loyalty: 65 }); delete l.flags.kingRebel; }), B("มือสังหารถูกจับและสารภาพว่าใครส่งมา — ทั้งแผ่นดินรู้ว่าฮ่องเต้ใช้มีดในที่มืด", { align: -4, fame: -4 })),
  ], { when: (l) => emp(l) && !!rebelKing(l), weight: 30, maxTimes: 0, title: "อ๋องกบฏ" }),

  E("kg.e_reduce", [20, 100], (l) => { const ks = kingsOf(l).slice().sort((a, b) => b.power - a.power); return `ราชเลขาธิการถวายฎีกาลดอำนาจอ๋อง — ${ks.slice(0, 2).map((k) => `${k.name}${kingTitle(k)} มีทหาร ${Math.round(k.power * 600)}`).join(" · ")} "อ๋องที่มีทหารมากกว่าเมืองหลวงคือพายุที่รอวันพัด"`; }, [
    P("ลดศักดินาและทหารของอ๋องทุกองค์พร้อมกัน", (l) => clamp(0.3 + (l.mw?.legitimacy ?? 50) / 150 + (l.stats.smarts - 50) / 250, 0.1, 0.85), with_(BIG("ราชโองการลดอำนาจอ๋องผ่านไปโดยไม่มีใครกล้าขัด — บัลลังก์ของคุณมั่นคงกว่าที่เคย", { fame: 4 }), (l) => { for (const k of kingsOf(l)) { k.power = clamp(k.power - 20, 5, 100); k.loyalty = clamp(k.loyalty - 8, 0, 100); } if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + 3, 0, 100); }), with_(B("อ๋องสองพระองค์รวมทัพกันต่อต้าน — แผ่นดินลุกเป็นไฟ", {}), (l) => { const k = kingsOf(l).slice().sort((a, b) => b.power - a.power)[0]; if (k) { k.rebel = calYear(l); k.loyalty = 5; l.flags.kingRebel = k.region; } if (l.mw) l.mw.unrest = clamp(l.mw.unrest + 15, 0, 100); }), { tone: "danger" }),
    C("ค่อยๆ ลด — แบ่งศักดินาให้ลูกอ๋องทุกคนเท่ากัน", with_(G("ศักดินาใหญ่แตกเป็นศักดินาเล็กในหนึ่งรุ่น — อ๋องรุ่นต่อไปไม่มีใครใหญ่พอจะท้าทายคุณ", { iq: 1 }), (l) => { for (const k of kingsOf(l)) k.power = clamp(k.power - 8, 5, 100); })),
    C("ยังไม่ทำอะไร", N("ฎีกาถูกเก็บเข้าลิ้นชัก — อ๋องทุกองค์ยังมีทหารเท่าเดิม")),
  ], { when: (l) => emp(l) && kingsOf(l).some((k) => k.power >= 55), weight: 7, maxTimes: 2, title: "ลดอำนาจอ๋อง" }),

  E("kg.e_hostage", [20, 100], (l) => { const k = kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0]; return `${k.name}${kingTitle(k)}ไม่มาเข้าเฝ้าในงานปีใหม่เป็นปีที่สาม — ขุนนางเสนอให้เรียก${k.heir ?? "ลูกชาย"}มาเป็นตัวประกันในเมืองหลวง`; }, [
    K("เรียกตัวประกัน", "smarts", 50, with_(G("ลูกอ๋องมาถึงเมืองหลวงพร้อมของกำนัลสามเกวียน — ตอนนี้พ่อของเขาต้องคิดสองครั้งก่อนทำอะไร", {}), (l) => { const k = kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0]; k.loyalty = clamp(k.loyalty + 15, 0, 100); k.power = clamp(k.power - 5, 5, 100); }), with_(B("อ๋องส่งจดหมายตอบว่าลูกป่วย — และเพิ่มทหารรักษาวังอีกหนึ่งหมื่น", {}), (l) => { const k = kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0]; k.loyalty = clamp(k.loyalty - 10, 0, 100); })),
    C("ยกองค์หญิงให้แต่งกับลูกอ๋อง ผูกเป็นทองแผ่นเดียวกัน", with_(N("งานแต่งข้ามแผ่นดิน — อ๋องกลายเป็นพ่อตาพ่อดองของคุณ ความภักดีที่ซื้อด้วยลูกสาวมักทนกว่าที่ซื้อด้วยทอง", {}), (l) => { const k = kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0]; k.loyalty = clamp(k.loyalty + 30, 0, 100); })),
    C("ปล่อยไป", N("ปีหน้าเขาก็คงไม่มาอีก")),
  ], { when: (l) => emp(l) && kingsOf(l).some((k) => k.loyalty < 40 && !k.rebel), weight: 7, maxTimes: 2, title: "อ๋องไม่มาเข้าเฝ้า" }),
];

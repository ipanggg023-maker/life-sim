// แท็บทำ: ทุกกิจกรรมได้ผลตามตัวคุณ · นิสัย ดาว อายุ เมือง ลางแห่งยุค และประวัติ เปลี่ยนสิ่งที่เกิด
// ทำซ้ำจนชำนาญได้รางวัล · ทำจนติดเป็นนิสัยหล่อหลอมตัวตน · บางครั้งมีเรื่องต่อเนื่องให้เลือก · ทิ้งการฝึกนานฝีมือขึ้นสนิม
import type { Activity } from "../../engine/activities";
import { activityHooks, activityNotes } from "../../engine/activities";
import { runEvent, yearHooks } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { log } from "../../engine/util";
import { apply, type Fx } from "./kit";
import { lean, tr, type Persona } from "./persona";
import { needXp } from "./power";
import { deed, fl } from "./state";
import { omenOf } from "./world2";
import { cityOf } from "./cities";
import { MOMENTS } from "./moments";

type Cond = (l: Life) => boolean;
/** บรรทัดผลเสริม: เงื่อนไข ข้อความ ผล */
type Line = [Cond | null, string | ((l: Life) => string), Fx?];
const T = (k: keyof Persona, min: number): Cond => (l) => (min > 0 ? tr(l, k) >= min : tr(l, k) <= min);
const bs = (min: number): Cond => (l) => (fl(l).bstars ?? 0) >= min;
const ms = (min: number): Cond => (l) => fl(l).potential >= min;
const age = (a: number, b: number): Cond => (l) => l.age >= a && l.age <= b;
const city = (k: string): Cond => (l) => cityOf(l).kind === k;
const omen = (id: string): Cond => (l) => omenOf(l)?.id === id;
const wed: Cond = (l) => l.people.some((p) => p.alive && p.relation === "spouse");
const kids: Cond = (l) => l.people.some((p) => p.alive && p.relation === "child" && p.age <= 14);
const rankB = (min: number): Cond => (l) => fl(l).bodyRank >= min;
const rankM = (min: number): Cond => (l) => fl(l).magicRank >= min;

const LINES: Record<string, Line[]> = {
  ft_train: [
    [bs(8), "ดาบไม้ในมือคุณหักเป็นท่อนเมื่อฟันเสาซ้อม ครูฝึกเงียบไปนาน", { body: 4 }],
    [bs(5), "ร่างกายของคุณจำท่าได้ก่อนที่หัวจะคิดทัน"],
    [(l) => (fl(l).bstars ?? 0) <= 1, "คุณช้ากว่าคนอื่นในลาน แต่เป็นคนสุดท้ายที่เดินออกไป", { body: 2 }],
    [T("c", 40), "คุณขอซ้อมกับคนที่ตัวใหญ่ที่สุดในลาน และไม่ถอยสักก้าว", { body: 3, hp: -1 }],
    [T("c", -40), "คุณซ้อมท่าป้องกันซ้ำร้อยครั้งจนไม่มีใครเจาะได้"],
    [T("m", -40), "คู่ซ้อมของคุณเดินกะเผลกออกจากลาน และไม่มีใครอยากซ้อมกับคุณอีก"],
    [age(6, 12), "ดาบไม้ใหญ่กว่าแขนคุณ แต่คุณไม่ยอมวาง"],
    [age(55, 400), "ข้อต่อดังกร๊อบทุกครั้งที่ฟัน แต่ท่ายังคมเหมือนเดิม", { hp: -1 }],
    [city("frontier"), "ทหารชายแดนหยุดดูคุณซ้อม แล้วโยนดาบจริงมาให้ลองหนึ่งเล่ม", { body: 3 }],
    [city("mountain"), "คุณวิ่งขึ้นเขาแบกหินทุกเช้า อากาศบางทำให้ปอดแกร่งขึ้น", { hp: 1 }],
    [omen("tide"), "ปีที่อสูรบุก ทุกลานฝึกเต็มไปด้วยคนที่ซ้อมเหมือนพรุ่งนี้จะไม่มี", { body: 3 }],
    [rankB(4), "เด็กๆ มาแอบดูปรมาจารย์ซ้อม และคุณแกล้งพลาดให้พวกเขาหัวเราะ", { joy: 2 }],
    [wed, "คู่ครองนำน้ำมาให้กลางลาน แล้วนั่งดูจนคุณซ้อมเสร็จ", { joy: 2 }],
    [null, "เหงื่อหยดลงพื้นลานจนเป็นรอยเท้าของคุณเอง"],
  ],
  ft_study: [
    [ms(8), "เปลวไฟจากปลายนิ้วคุณลุกขึ้นก่อนจะร่ายจบ อาจารย์ถอยหลังหนึ่งก้าว", { magic: 4 }],
    [ms(5), "มานาไหลเข้าหาคุณเหมือนน้ำไหลลงที่ต่ำ"],
    [(l) => fl(l).potential <= 1, "คทาเป็นคนร่าย คุณแค่ถือมันไว้ แต่วันนี้มันฟังคุณมากขึ้นนิดหนึ่ง", { magic: 2 }],
    [T("f", 40), "คุณสวดก่อนร่ายทุกครั้ง และรู้สึกว่ามีใครบางคนฟังอยู่"],
    [T("f", -40), "คุณร่ายเวทที่ตำราบอกว่าห้าม แค่เพื่อดูว่าทำไม", { magic: 3, hp: -1 }],
    [T("h", -40), "คุณแอบลอกบันทึกของรุ่นพี่มาศึกษา และมันได้ผลจริง", { magic: 3 }],
    [city("arcane"), "หอคอยในเมืองเวทเปิดชั้นหนังสือให้นักเรียนทุกคน คุณอ่านจนรุ่งเช้า", { magic: 3, iq: 1 }],
    [omen("surge"), "ปีที่มานาท่วมโลก เวทของคุณแรงจนต้องร่ายลดลงครึ่งหนึ่ง", { magic: 4 }],
    [omen("eclipse"), "ใต้ดวงอาทิตย์ดับ เวทแสงของคุณริบหรี่ แต่เวทมืดกระซิบชื่อคุณ"],
    [age(6, 12), "คุณเผลอเสกขนมปังในตะกร้าให้ลอยไปทั้งครัว", { joy: 2 }],
    [rankM(4), "นักเวทหนุ่มสามคนนั่งจดทุกคำที่คุณพึมพำ", { fame: 1 }],
    [null, "ตัวอักษรในตำราเรียงตัวใหม่ทุกครั้งที่คุณเข้าใจมันมากขึ้น"],
  ],
  ft_rest: [
    [T("c", 50), "คุณนอนไม่หลับทั้งบ่าย หัวใจอยากออกไปหาเรื่องผจญภัย", { joy: -1 }],
    [T("c", -40), "การพักคือสิ่งที่คุณถนัดที่สุด และคุณไม่ขอโทษใครเรื่องนี้", { joy: 2 }],
    [wed, "คู่ครองนอนหนุนตักคุณ ทั้งสองคนไม่ได้พูดอะไรเลยทั้งบ่าย", { joy: 2 }],
    [kids, "ลูกๆ ปีนขึ้นมานอนทับคุณจนการพักผ่อนกลายเป็นการเล่น", { joy: 3 }],
    [omen("winter"), "หิมะตกหนาจนออกจากบ้านไม่ได้ คุณนั่งข้างเตาผิงอ่านจดหมายเก่า", { hp: 1 }],
    [omen("golden"), "ปีทองแห่งการเก็บเกี่ยว คุณนอนใต้กองฟางที่สูงกว่าบ้าน", { joy: 2 }],
    [age(60, 400), "คุณงีบหลับบนเก้าอี้โยก ฝันถึงคนที่จากไปแล้ว"],
    [city("port"), "คุณนอนฟังเสียงคลื่นบนท่าเรือจนหลับไป", { joy: 1 }],
    [null, "เมฆลอยผ่านไปช้าๆ และวันนี้ไม่มีอะไรต้องรีบ"],
  ],
  ft_healer: [
    [T("f", 40), "หมอสวดให้คุณเพิ่มอีกบทโดยไม่คิดเงิน", { hp: 2 }],
    [T("f", -40), "คุณยืนยันจะเอาแค่ยา ไม่เอาบทสวด หมอทำหน้าไม่พอใจ"],
    [(l) => l.stats.health < 30, "หมอเงียบไปนานก่อนบอกว่าคุณมาช้าไปอีกนิดเดียวก็ไม่ทันแล้ว"],
    [omen("winter"), "ห้องรอหมอเต็มไปด้วยคนไอ คุณรอทั้งวัน"],
    [null, "กลิ่นสมุนไพรติดเสื้อคุณไปสามวัน"],
  ],
  ft_tavern: [
    [T("h", -40), "คุณชนะพนันมือเปล่ากับพ่อค้าเมาสองคน ด้วยลูกเต๋าที่ไม่ค่อยตรง", { gold: 3 }],
    [T("h", 50), "คุณบอกพ่อค้าข้างโต๊ะว่าโดนโกงลูกเต๋า เขาเลี้ยงเหล้าคุณทั้งคืน", { joy: 2 }],
    [T("m", -40), "คนในร้านเว้นโต๊ะรอบตัวคุณไว้ว่างๆ สามโต๊ะ"],
    [T("m", 40), "เด็กเสิร์ฟกระซิบว่าคุณเป็นลูกค้าคนเดียวที่ทิปทุกครั้ง"],
    [T("c", 50), "มีคนท้าคุณยกถังเบียร์ และคุณยกได้สองถัง", { fame: 1 }],
    [omen("comet"), "ทั้งร้านพูดแต่เรื่องดาวหาง หมอดูขายคำทำนายได้เป็นกอบเป็นกำ"],
    [omen("migration"), "เงามังกรบินผ่านหน้าต่างโรงเตี๊ยม ทุกคนวางแก้วพร้อมกัน"],
    [city("port"), "กะลาสีร้องเพลงทะเลที่คุณไม่เคยได้ยิน แล้วสอนคุณร้องท่อนฮุก", { joy: 1 }],
    [city("frontier"), "ทหารชายแดนเล่าเรื่องสิ่งที่เห็นในหมอก แล้วไม่มีใครหัวเราะ"],
    [wed, "คุณกลับบ้านดึก คู่ครองรออยู่หน้าประตูพร้อมสีหน้าที่อ่านไม่ออก", { joy: -1 }],
    [null, "ไฟในเตาผิงเต้นตามเสียงพิณ คุณลืมไปชั่วคราวว่าโลกข้างนอกยุ่งแค่ไหน"],
  ],
  ft_match: [
    [(l) => l.stats.looks >= 70, "ทุกคนในงานเต้นรำหันมามองตอนคุณเดินเข้ามา", { joy: 2 }],
    [T("h", -40), "คุณเล่าเรื่องการผจญภัยเกินจริงไปมาก แต่ได้ผล"],
    [T("c", -40), "คุณยืนติดกำแพงเกือบทั้งคืนก่อนจะกล้าขอใครเต้น"],
    [null, "ดนตรีเล่นเพลงช้าพอดีตอนคุณกล้าพูด"],
  ],
  ft_move: [
    [T("c", 40), "คุณไม่หันกลับไปมองเมืองเก่าเลยสักครั้ง"],
    [kids, "ลูกๆ ร้องไห้ตลอดทางเพราะต้องจากเพื่อน", { joy: -2 }],
    [null, "เกวียนเก่าส่งเสียงเอี๊ยดตลอดทางไปบ้านใหม่"],
  ],
  ft_guild: [
    [bs(7), "เจ้าหน้าที่กิลด์มองแขนคุณแล้วกระซิบว่าคงไม่อยู่ขั้นเหล็กนาน"],
    [null, "ป้ายชื่อเหล็กยังอุ่นจากเตาตอนวางลงในมือ"],
  ],
  ft_c_fish: [
    [T("m", 40), "คุณปล่อยปลาตัวเล็กกลับลงทะเลทุกตัว"],
    [omen("tide"), "ปีที่คลื่นอสูร อวนของคุณติดเกล็ดที่ใหญ่กว่าฝ่ามือ", { gold: 3 }],
    [null, "นกนางนวลตามเรือคุณกลับฝั่งเป็นฝูง"],
  ],
  ft_c_climb: [
    [T("c", 50), "คุณปีนหน้าผาด้านที่ไม่มีใครเคยปีน", { body: 3, hp: -2 }],
    [bs(6), "คุณถึงยอดก่อนไกด์ที่ปีนมาสามสิบปี"],
    [null, "ลมบนยอดเขาพัดชื่อคุณหายไปในเมฆ"],
  ],
  ft_c_wall: [
    [T("c", 40), "คุณอาสายืนป้อมที่ใกล้หมอกที่สุด", { fame: 1, hp: -1 }],
    [T("c", -40), "คุณจุดคบไฟเพิ่มอีกสามดวง และไม่มีอะไรกล้าเข้าใกล้"],
    [omen("tide"), "คืนนั้นกำแพงสั่นเพราะอสูรที่ชนจากด้านนอก คุณไม่ได้นอน", { body: 3, hp: -2 }],
    [null, "รุ่งสางมาถึงพร้อมกาแฟขมจากหม้อของทหารแก่"],
  ],
  ft_c_library: [
    [ms(6), "หนังสือเล่มหนึ่งบินลงมาอยู่ในมือคุณเอง เหมือนรอคุณมานาน", { magic: 3 }],
    [T("h", -40), "คุณฉีกหน้าหนึ่งของตำราหายากกลับบ้านไปด้วย", { magic: 2 }],
    [null, "หอสมุดลอยฟ้าเอียงตามลม และหมึกในขวดไม่เคยหก"],
  ],
  ft_c_herbs: [
    [T("f", 40), "คุณขอบคุณเทพแห่งป่าก่อนเด็ดทุกต้น"],
    [omen("golden"), "ปีทอง สมุนไพรขึ้นหนาจนเก็บไม่หมด", { gold: 2 }],
    [null, "มือคุณมีกลิ่นใบสะระแหน่ไปทั้งวัน"],
  ],
  ft_c_tourney: [
    [T("c", 50), "คุณกำมือแน่นตลอดการประลอง อยากลงไปเองใจจะขาด"],
    [null, "ธงสีต่างๆ โบกสะบัดจนท้องฟ้าดูเหมือนผ้าปะ"],
  ],
  ft_dlore: [
    [(l) => fl(l).dragonBond >= 40, "ตัวอักษรมังกรอ่านง่ายขึ้นเหมือนมีใครกระซิบความหมายให้"],
    [omen("migration"), "ปีที่มังกรย้ายถิ่น หอสมุดเต็มไปด้วยคนอยากรู้เรื่องมังกร"],
    [null, "เกล็ดมังกรเก่าที่ใช้เป็นที่คั่นหนังสือยังอุ่นอยู่"],
  ],
  ft_h_petplay: [
    [T("m", 40), "สัตว์เลี้ยงของคุณหลับบนอกคุณจนคุณไม่กล้าขยับ", { joy: 2 }],
    [kids, "ลูกๆ กับสัตว์เลี้ยงวิ่งไล่กันรอบบ้านจนแจกันแตก", { joy: 2 }],
    [null, "มันนำของมาให้คุณหนึ่งชิ้น คุณไม่อยากรู้ว่าไปเอามาจากไหน"],
  ],
};

// ── นิสัยติดตัวจากสิ่งที่ทำซ้ำ ──
const HABIT: Record<string, Partial<Persona>> = {
  ft_train: { c: 1 }, ft_c_wall: { c: 2 }, ft_c_climb: { c: 1 }, ft_h_dungeon: { c: 1 }, ft_contract: { c: 1 }, ft_dragon: { c: 2 }, ft_beast: { c: 2 },
  ft_crime: { h: -2, m: -1 }, ft_h_dice: { h: -1 }, ft_h_temple: { f: 2 }, ft_c_herbs: { f: 1 }, ft_h_petplay: { m: 1 }, ft_rest: { c: -1 }, ft_petition: { h: 1 },
  ft_circle: { f: -1 }, ft_gate: { f: -1 }, ft_c_library: { h: 1 },
};

// ── ความชำนาญ ──
export const TIERS = [5, 15, 30, 60];
export const TIER_NAMES = ["มือใหม่", "เริ่มคล่อง", "ชำนาญ", "เชี่ยวชาญ", "ปรมาจารย์"];
export const doneCount = (l: Life, id: string) => Number(l.flags[`act_${id}`] ?? 0);
export const masteryTier = (l: Life, id: string) => TIERS.filter((n) => doneCount(l, id) >= n).length;
/** รางวัลตามหมวดของกิจกรรมเมื่อถึงขั้นใหม่ · ขั้นสูงสุดเป็นผลงานในตำนาน */
const REWARD: Record<string, (t: number) => Fx> = {
  "ฝึกฝน": (t) => ({ body: 15 * t, magic: 15 * t }),
  "เวทมนตร์": (t) => ({ magic: 25 * t, iq: t }),
  "ผจญภัย": (t) => ({ body: 15 * t, fame: 2 * t }),
  "ชีวิต": (t) => ({ joy: 4 * t, hp: 2 * t }),
  "เมือง": (t) => ({ joy: 3 * t, gold: 4 * t }),
  "งานอดิเรก": (t) => ({ joy: 4 * t, luck: t }),
  "มังกร": (t) => ({ fame: 3 * t, joy: 3 * t }),
  "สังคม": (t) => ({ fame: 3 * t }),
  "ค้าขาย": (t) => ({ gold: 15 * t }),
  "ฝ่ายอำนาจ": (t) => ({ fame: 3 * t }),
  "บัลลังก์": (t) => ({ fame: 4 * t }),
};
const TIER_LINE = ["", "คุณเริ่มทำ{a}ได้คล่องมือ", "คนเริ่มพูดกันว่าคุณ{a}เก่ง", "ไม่มีใครในเมือง{a}ได้อย่างคุณ", "คุณ{a}มาจนกลายเป็นตำนาน"];
function checkMastery(l: Life, a: Activity) {
  const t = masteryTier(l, a.id);
  const key = `ftMast_${a.id}`;
  if (t <= Number(l.flags[key] ?? 0)) return;
  l.flags[key] = t;
  const fx = REWARD[a.group ?? ""]?.(t) ?? { joy: 3 * t };
  apply(l, fx);
  log(l, `${TIER_LINE[t].replace("{a}", a.name)} · ${TIER_NAMES[t]}`, "milestone");
  if (t === TIERS.length) deed(l, `ปรมาจารย์แห่งการ${a.name}`);
}

/** ปีละครั้ง: เรื่องต่อเนื่องจากกิจกรรม */
export const MOMENT_CHANCE = 0.14;
function maybeMoment(l: Life, a: Activity) {
  const list = MOMENTS[a.id];
  if (!list || l.doneThisYear.includes("ftMoment") || !chance(l, MOMENT_CHANCE)) return;
  const ok = list.filter((m) => (l.seen[m.id] ?? 0) < (m.maxTimes ?? 1) && (!m.when || m.when(l)) && l.age >= m.minAge && l.age <= m.maxAge);
  if (!ok.length) return;
  l.doneThisYear.push("ftMoment");
  runEvent(l, pick(l, ok).id);
}

/** ทิ้งการฝึกนานเกินสามปี ฝีมือที่สะสมไว้ค่อยๆ หาย (ขั้นไม่ตก) */
function rustYear(l: Life) {
  const f = fl(l);
  for (const [track, key, name] of [["body", "ftBodyAt", "ดาบ"], ["magic", "ftMagicAt", "เวท"]] as const) {
    const rank = track === "body" ? f.bodyRank : f.magicRank;
    if (rank < 1 || l.age < 16) continue;
    const last = Number(l.flags[key] ?? l.age);
    l.flags[key] ??= l.age;
    if (l.age - last < 4) continue;
    const lose = Math.round(needXp(rank) * 0.05);
    if (track === "body") f.body = Math.max(0, f.body - lose); else f.magic = Math.max(0, f.magic - lose);
    if (l.age - last === 4) log(l, `ไม่ได้ฝึก${name}มาสี่ปี มือเริ่มช้าลง ฝีมือขึ้นสนิมไปบ้าง`, "bad");
  }
}

export function loadDoings() {
  activityHooks.push((l, a, out) => {
    if (l.worldId !== "fantasy" || !l.ft || !a.id.startsWith("ft_")) return;
    if (a.id === "ft_train") l.flags.ftBodyAt = l.age;
    if (a.id === "ft_study" || a.id === "ft_mschool" || a.id === "ft_circle") l.flags.ftMagicAt = l.age;
    // นิสัยจากความเคยชินค่อยๆ ซึม ไม่ใช่ทุกครั้ง
    if (HABIT[a.id] && chance(l, 0.4)) lean(l, HABIT[a.id]);
    // ผลเสริมตามตัวคุณ · เฉพาะกิจกรรมที่จบในตัว (ฉากเลือกมีผลของมันเอง)
    const lines = LINES[a.id];
    if (out.text && lines && chance(l, 0.75)) {
      const fit = lines.filter(([c]) => !c || c(l));
      const special = fit.filter(([c]) => !!c);
      const [, text, fx] = special.length && chance(l, 0.8) ? pick(l, special) : pick(l, fit);
      out.text += ` ${typeof text === "string" ? text : text(l)}`;
      if (fx) apply(l, fx);
    }
    checkMastery(l, a);
    maybeMoment(l, a);
  });
  activityNotes.push((l, a) => {
    if (l.worldId !== "fantasy" || !a.id.startsWith("ft_")) return;
    const n = doneCount(l, a.id);
    if (!n) return;
    const t = masteryTier(l, a.id);
    const next = TIERS[t];
    return `${TIER_NAMES[t]} · ทำมาแล้ว ${n} ครั้ง${next ? ` · อีก ${next - n} ครั้งถึงขั้น${TIER_NAMES[t + 1]}` : ""}`;
  });
  yearHooks.push((l) => { if (l.worldId === "fantasy" && l.ft && l.alive) rustYear(l); });
}

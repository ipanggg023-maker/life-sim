// สกิลติดตัวชุดใหญ่ (M24) — ได้จากวิธีใช้ชีวิต แต่ละอันมีเงื่อนไขชัดเจน ผลเล็กแต่สะสมได้
// ห้าม import engine/util (util → passives → ไฟล์นี้)
import type { Life, StatKey, WorldId } from "../engine/types";
import { fxText } from "./talentsMore";

export interface PassiveDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  how: string;
  earn: (l: Life) => boolean;
  cp?: number;
  survival?: number;
  exp?: number;
  money?: number;
  check?: Partial<Record<StatKey, number>>;
  yearly?: Partial<Record<StatKey, number>>;
}

type Fx = Pick<PassiveDef, "cp" | "survival" | "exp" | "money" | "check" | "yearly">;

const n = (l: Life, k: string) => Number(l.flags[k] ?? 0);
/** จำนวนครั้งที่กดกิจกรรม (รวมหลาย id) */
const act = (l: Life, ...ids: string[]) => ids.reduce((s, id) => s + n(l, `act_${id}`), 0);
/** จำนวนกิจกรรมที่ id ตรงรูปแบบ */
const actLike = (l: Life, re: RegExp) => Object.keys(l.flags).filter((k) => k.startsWith("act_") && re.test(k.slice(4))).reduce((s, k) => s + n(l, k), 0);
/** จำนวน event ที่เคยเจอซึ่งขึ้นต้นด้วย prefix */
const sp = (l: Life, ...prefixes: string[]) => Object.keys(l.seen).filter((id) => prefixes.some((p) => id.startsWith(p))).length;
const alive = (l: Life, rel: string) => l.people.filter((p) => p.alive && p.relation === rel).length;
const inWorld = (l: Life, ...w: WorldId[]) => w.includes(l.worldId);
const net = (l: Life) => l.money - l.debt;

function P(id: string, emoji: string, name: string, how: string, earn: (l: Life) => boolean, fx: Fx): PassiveDef {
  return { id, emoji, name, how, earn, desc: fxText({ y: fx.yearly, c: fx.check, survival: fx.survival, cp: fx.cp, exp: fx.exp, money: fx.money }), ...fx };
}

export const MORE_PASSIVES: PassiveDef[] = [
  // ───────── ร่างกาย ─────────
  P("p_marathoner", "🏃", "นักวิ่งทางไกล", "ออกกำลังกายรวม 20 ปี", (l) => act(l, "gym") + n(l, "trainCount") >= 20, { yearly: { health: 1 }, survival: 0.02 }),
  P("p_centenarian", "🎂", "ผู้มีอายุยืน", "อายุถึง 90 ปี", (l) => l.age >= 90, { yearly: { health: 1, happiness: 1 } }),
  P("p_old_body", "🦴", "กระดูกเก่าแต่แกร่ง", "อายุ 70 และสุขภาพ 60 ขึ้นไป", (l) => l.age >= 70 && l.stats.health >= 60, { yearly: { health: 1 } }),
  P("p_scarred", "🩹", "แผลเป็นเต็มตัว", "รอดจากภาวะใกล้ตาย และอายุ 30 ขึ้นไป", (l) => !!l.flags.nearDeath && l.age >= 30, { survival: 0.03, check: { health: 0.03 } }),
  P("p_fit", "🏋️", "หุ่นนักกีฬา", "สุขภาพ 95 ขึ้นไปตอนอายุ 40 ขึ้นไป", (l) => l.age >= 40 && l.stats.health >= 95, { check: { health: 0.05 } }),
  P("p_doctor_friend", "🏥", "คนไข้ประจำ", "ไปหาหมอรวม 10 ครั้ง", (l) => act(l, "doctor") >= 10, { yearly: { health: 1 } }),
  P("p_fighter_body", "🥊", "ร่างนักสู้ข้างถนน", "หาเรื่องคนรวม 10 ครั้ง", (l) => act(l, "free_brawl") >= 10, { cp: 2, check: { health: 0.03 } }),
  P("p_martial_course", "🥋", "ป้องกันตัวเป็น", "ลงคอร์สต่อสู้ 4 ครั้ง", (l) => n(l, "c_fight") >= 4, { survival: 0.04, cp: 1 }),
  P("p_medic_course", "⛑️", "ปฐมพยาบาลได้", "ลงคอร์สปฐมพยาบาล/รักษา 4 ครั้ง", (l) => n(l, "c_med") >= 4, { survival: 0.04, yearly: { health: 1 } }),
  P("p_party_liver", "🍻", "ตับเหล็ก", "ไปปาร์ตี้รวม 15 ครั้ง", (l) => act(l, "nightout") >= 15, { check: { health: 0.03 }, yearly: { happiness: 1 } }),
  P("p_sleepless", "🌙", "คนไม่หลับไม่นอน", "ทำงานพิเศษรวม 15 ครั้ง", (l) => actLike(l, /_sidejob$/) >= 15, { money: 0.04, check: { health: 0.02 } }),
  P("p_rested", "😴", "ผู้รู้จักพัก", "พักผ่อนรวม 20 ครั้ง", (l) => actLike(l, /_rest$/) >= 20, { yearly: { health: 1, happiness: 1 } }),

  // ───────── จิตใจ ─────────
  P("p_optimist", "🌈", "มองโลกสว่าง", "ความสุขเต็ม 100 ตอนอายุ 40 ขึ้นไป", (l) => l.age >= 40 && l.stats.happiness >= 100, { check: { happiness: 0.05 } }),
  P("p_survivor_heart", "🫀", "หัวใจที่ผ่านพายุ", "ความสุขเคยต่ำกว่า 10 แล้วกลับมาเกิน 60", (l) => { if (l.stats.happiness < 10) l.flags.p_lowHap = true; return !!l.flags.p_lowHap && l.stats.happiness >= 60; }, { yearly: { happiness: 1 }, survival: 0.02 }),
  P("p_hermit", "🏔️", "ฤๅษี", "ปลีกวิเวกรวม 8 ครั้ง", (l) => act(l, "free_retreat") >= 8, { yearly: { happiness: 2 } }),
  P("p_monk_mind", "🪷", "จิตนิ่ง", "ทำบุญรวม 20 ครั้ง", (l) => actLike(l, /(temple|shrine|chapel)/) >= 20, { check: { happiness: 0.04, luck: 0.03 } }),
  P("p_karma", "🙏", "บุญหนุนนำ", "ทำความดีสะสมแต้มกรรมดี 15", (l) => n(l, "karma") >= 15, { check: { luck: 0.05 }, survival: 0.02 }),
  P("p_saint", "😇", "นักบุญ", "แต้มกรรมดี 40", (l) => n(l, "karma") >= 40, { yearly: { happiness: 2 }, check: { luck: 0.05 } }),
  P("p_volunteer", "🤲", "อาสาสมัครตัวยง", "ทำความดีรวม 12 ครั้ง", (l) => act(l, "free_charity") >= 12, { yearly: { happiness: 1 }, check: { looks: 0.03 } }),
  P("p_grief", "🕯️", "ผู้ผ่านการสูญเสีย", "มีคนในครอบครัวจากไป 4 คน", (l) => l.people.filter((p) => !p.alive && ["father", "mother", "sibling", "spouse", "child"].includes(p.relation)).length >= 4, { check: { happiness: 0.04 }, exp: 0.03 }),
  P("p_lonely_strong", "🐺", "หมาป่าเดียวดาย", "อายุ 40 และไม่เคยมีคู่ชีวิต", (l) => l.age >= 40 && !l.people.some((p) => p.relation === "spouse" || p.relation === "partner"), { cp: 2, check: { smarts: 0.04 } }),
  P("p_reborn", "♻️", "ผู้เริ่มต้นใหม่", "ย้ายถิ่นฐานหรือย้ายประเทศ 3 ครั้ง", (l) => act(l, "free_move") >= 3, { check: { luck: 0.03, happiness: 0.03 } }),
  P("p_regressor", "⏪", "ผู้จำอนาคต", "ย้อนเวลา 1 ครั้ง", (l) => (l.regressions ?? 0) >= 1, { check: { smarts: 0.04 }, exp: 0.05 }),
  P("p_hundred_lives", "🔁", "ผู้ย้อนกาลนับไม่ถ้วน", "ย้อนเวลา 5 ครั้ง", (l) => (l.regressions ?? 0) >= 5, { check: { smarts: 0.05, luck: 0.05 }, survival: 0.03 }),

  // ───────── ปัญญา / ทักษะ ─────────
  P("p_scholar", "🎓", "ปัญญาชน", "จบปริญญา", (l) => !!l.education.degree, { check: { smarts: 0.04 }, money: 0.03 }),
  P("p_genius", "🧠", "สมองเพชร", "สติปัญญา 98 ขึ้นไปก่อนอายุ 30", (l) => l.age < 30 && l.stats.smarts >= 98, { check: { smarts: 0.05 }, exp: 0.05 }),
  P("p_polyglot", "🗣️", "พูดได้หลายภาษา", "ลงคอร์สภาษา 5 ครั้ง", (l) => n(l, "c_lang") >= 5, { check: { smarts: 0.04, looks: 0.02 }, money: 0.05 }),
  P("p_chef", "🍳", "พ่อครัว/แม่ครัวประจำบ้าน", "ลงคอร์สทำอาหาร 4 ครั้ง", (l) => n(l, "c_cook") >= 4, { yearly: { health: 1 }, check: { happiness: 0.03 } }),
  P("p_musician", "🎻", "นักดนตรี", "ลงคอร์สดนตรี 5 ครั้ง", (l) => n(l, "c_music") >= 5, { yearly: { happiness: 1 }, check: { looks: 0.04 } }),
  P("p_actor", "🎭", "นักแสดงในชีวิตจริง", "ลงคอร์สการแสดง 4 ครั้ง", (l) => n(l, "c_act") >= 4, { check: { looks: 0.05 } }),
  P("p_accountant", "🧾", "หัวบัญชี", "ลงคอร์สการลงทุน/บัญชี 4 ครั้ง", (l) => n(l, "c_biz") >= 4, { money: 0.06 }),
  P("p_lifelong", "📖", "นักเรียนตลอดชีวิต", "ลงคอร์สรวม 15 ครั้ง", (l) => act(l, "free_course") >= 15, { exp: 0.06, check: { smarts: 0.03 } }),
  P("p_author", "✍️", "นักเขียน", "สร้างผลงานรวม 10 ชิ้น", (l) => n(l, "works") >= 10, { check: { smarts: 0.04 }, money: 0.03 }),
  P("p_master_creator", "🌟", "ผู้สร้างผลงานชิ้นเอก", "สร้างผลงานระดับปรากฏการณ์ 2 ชิ้น", (l) => n(l, "masterpiece") >= 2, { money: 0.06, check: { looks: 0.03 } }),
  P("p_bookworm2", "🗃️", "ห้องสมุดเดินได้", "อ่านหนังสือรวม 25 ครั้ง", (l) => actLike(l, /read|library/) >= 25, { check: { smarts: 0.05 }, exp: 0.04 }),
  P("p_storyteller", "📜", "นักเล่าเรื่อง", "เจอเหตุการณ์ระหว่างทางรวม 8 เรื่อง", (l) => sp(l, "free.x.") >= 8, { check: { looks: 0.03, smarts: 0.03 } }),
  P("p_explorer", "🗺️", "นักสำรวจ", "ออกไปเดินเล่นรวม 20 ครั้ง", (l) => act(l, "free_wander") >= 20, { check: { luck: 0.04 }, survival: 0.01 }),
  P("p_strategist", "♟️", "นักวางหมาก", "สติปัญญา 80 และอายุ 40 ขึ้นไป", (l) => l.age >= 40 && l.stats.smarts >= 80, { check: { smarts: 0.04 }, cp: 1 }),

  // ───────── สังคม / ความรัก ─────────
  P("p_many_friends", "👥", "เพื่อนเยอะ", "มีเพื่อนพร้อมกัน 5 คน", (l) => alive(l, "friend") >= 5, { yearly: { happiness: 1 }, check: { looks: 0.03 } }),
  P("p_best_friend", "🤝", "เพื่อนตาย", "มีเพื่อนที่ผูกพัน 95 ขึ้นไป", (l) => l.people.some((p) => p.alive && p.relation === "friend" && p.bond >= 95), { survival: 0.02, yearly: { happiness: 1 } }),
  P("p_romantic", "💌", "นักรักโรแมนติก", "ให้ของขวัญรวม 5 ครั้ง", (l) => n(l, "gifts") >= 5, { check: { looks: 0.05 } }),
  P("p_golden_couple", "💑", "คู่ชีวิตในฝัน", "แต่งงานมาแล้ว 20 ปี (ความผูกพัน 80+)", (l) => l.people.some((p) => p.alive && p.relation === "spouse" && p.bond >= 80) && l.age >= 45, { yearly: { happiness: 2 } }),
  P("p_big_family", "👨‍👩‍👧‍👦", "ครอบครัวใหญ่", "มีลูก 5 คน", (l) => l.people.filter((p) => p.relation === "child").length >= 5, { yearly: { happiness: 1 }, money: -0.02 }),
  P("p_parent_heart", "🧸", "หัวใจพ่อแม่", "รับอุปการะเด็ก", (l) => n(l, "adopted") >= 1, { yearly: { happiness: 1 }, check: { luck: 0.03 } }),
  P("p_grandparent", "👴", "ปู่ย่าตายาย", "อายุ 60 และมีลูกอายุ 25 ขึ้นไป", (l) => l.age >= 60 && l.people.some((p) => p.relation === "child" && p.alive && p.age >= 25), { yearly: { happiness: 2 } }),
  P("p_heartbreaker", "💔", "ผู้ผ่านรักมาโชกโชน", "เลิก/หย่ามาแล้ว 3 ครั้ง (อายุ 30+)", (l) => l.age >= 30 && n(l, "breakups") >= 3, { check: { smarts: 0.04 }, survival: 0.01 }),
  P("p_matchmaker", "💘", "นักปัดขวา", "เล่นแอปหาคู่รวม 6 ครั้ง", (l) => act(l, "dating") >= 6, { check: { looks: 0.04 } }),
  P("p_influencer", "📸", "คนดังในโซเชียล", "โพสต์โซเชียลรวม 10 ครั้ง", (l) => act(l, "social") >= 10, { check: { looks: 0.04 }, money: 0.02 }),
  P("p_famous", "⭐", "คนดัง", "ชื่อเสียง 75 ขึ้นไป", (l) => l.fame >= 75, { money: 0.06, check: { looks: 0.04 } }),
  P("p_infamous", "😈", "ชื่อเสียงฉาวโฉ่", "ชื่อเสียงติดลบ 30", (l) => l.fame <= -30, { cp: 3, check: { smarts: 0.03 } }),
  P("p_followers", "📱", "ผู้ติดตามล้านคน", "ผู้ติดตาม IG หรือ YouTube 1 ล้าน", (l) => (l.phone?.ig ?? 0) >= 1_000_000 || (l.phone?.yt ?? 0) >= 1_000_000, { money: 0.08 }),
  P("p_rival_respect", "⚔️", "คู่ปรับที่นับถือ", "มีคู่แข่ง 3 คนพร้อมกัน", (l) => alive(l, "rival") >= 3, { cp: 3, exp: 0.04 }),
  P("p_team_player", "🛡️", "คนของทีม", "มีเพื่อนร่วมทีม 3 คน", (l) => alive(l, "ally") >= 3, { survival: 0.03, cp: 2 }),
  P("p_mentor2", "👨‍🏫", "อาจารย์ของคนรุ่นใหม่", "มีเพื่อนร่วมทีม/ศิษย์ 2 คน และอายุ 50 ขึ้นไป", (l) => l.age >= 50 && alive(l, "ally") >= 2, { exp: 0.05, yearly: { happiness: 1 } }),

  // ───────── เงิน / งาน ─────────
  P("p_millionaire", "💵", "เศรษฐีเงินล้าน", "ทรัพย์สินสุทธิ 50 ล้าน", (l) => net(l) >= 50_000_000, { money: 0.04 }),
  P("p_billionaire", "🏦", "มหาเศรษฐีพันล้าน", "ทรัพย์สินสุทธิ 1,000 ล้าน", (l) => net(l) >= 1_000_000_000, { money: 0.08, check: { luck: 0.03 } }),
  P("p_debt_free", "🧮", "หนี้หมดแล้ว", "เคยมีหนี้ 1 ล้านแล้วใช้หมด", (l) => { if (l.debt >= 1_000_000) l.flags.p_hadDebt = true; return !!l.flags.p_hadDebt && l.debt <= 0; }, { money: 0.05, yearly: { happiness: 1 } }),
  P("p_broke_strong", "🪙", "จนแต่ไม่ยอม", "เงินติดลบแต่ความสุข 60 ขึ้นไป", (l) => l.money < 0 && l.stats.happiness >= 60 && l.age >= 20, { check: { happiness: 0.04 } }),
  P("p_career_top", "📈", "สุดทางสายอาชีพ", "เลื่อนตำแหน่งถึงขั้นสูงสุด", (l) => (l.job?.level ?? 0) >= 5, { money: 0.06 }),
  P("p_loyal_worker", "🏢", "พนักงานสามสิบปี", "ทำงานที่เดิม 15 ปี", (l) => (l.job?.years ?? 0) >= 15, { money: 0.05, check: { smarts: 0.02 } }),
  P("p_job_hopper", "🔀", "เปลี่ยนงานบ่อย", "ทำงานพิเศษหลายแบบ และอายุ 312 ขึ้นไป", (l) => l.age >= 312 && actLike(l, /_sidejob$/) >= 12, { check: { luck: 0.03, smarts: 0.02 } }),
  P("p_investor", "📊", "นักลงทุน", "มูลค่าพอร์ตหุ้น 5 ล้าน", (l) => (l.phone?.portfolio ?? 0) >= 5_000_000, { money: 0.05, check: { luck: 0.02 } }),
  P("p_landlord", "🏠", "เจ้าของบ้านหลังใหญ่", "ซื้อบ้านหลังใหญ่", (l) => !!l.flags.bigHouse || !!l.flags.x23_home, { yearly: { happiness: 1 } }),
  P("p_luxury", "💎", "รสนิยมหรู", "ใช้เงินแบบไม่คิด 6 ครั้ง", (l) => act(l, "free_splurge") >= 6, { check: { looks: 0.04 } }),
  P("p_lottery_fan", "🎟️", "ขาประจำลอตเตอรี่", "ซื้อลอตเตอรี่รวม 25 ครั้ง", (l) => act(l, "lottery") >= 25, { check: { luck: 0.04 } }),
  P("p_gambler", "🎲", "เซียนพนัน", "เล่นการพนันรวม 15 ครั้ง", (l) => act(l, "free_gamble") >= 15, { check: { luck: 0.04, smarts: 0.02 } }),
  P("p_ruined", "📉", "เคยหมดตัว", "หมดตัวจากการพนัน แล้วอายุเกิน 40", (l) => n(l, "gambleRuin") >= 1 && l.age >= 40, { check: { smarts: 0.05 }, money: 0.03 }),

  // ───────── ด้านมืด ─────────
  P("p_ex_con", "⛓️", "อดีตนักโทษ", "พ้นโทษจากคุก", (l) => n(l, "jailCount") >= 1 && Number(l.flags.jailUntil ?? -1) <= l.age, { survival: 0.03, cp: 2 }),
  P("p_repeat_offender", "🚔", "ขาประจำห้องขัง", "ติดคุก 3 ครั้ง", (l) => n(l, "jailCount") >= 3, { cp: 3, check: { health: 0.03 } }),
  P("p_shadow", "🥷", "คนในเงามืด", "ทำเรื่องผิดกฎหมายสำเร็จ 10 ครั้ง", (l) => n(l, "crimes") >= 10, { check: { luck: 0.04 }, money: 0.04 }),
  P("p_reformed", "🌅", "กลับใจ", "เคยติดคุก แต่แต้มกรรมดีถึง 15", (l) => n(l, "jailCount") >= 1 && n(l, "karma") >= 15, { yearly: { happiness: 1 }, check: { looks: 0.03 } }),

  // ───────── การเดินทาง / สะสม ─────────
  P("p_globetrotter", "✈️", "พลเมืองโลก", "ย้ายประเทศ 3 ครั้ง", (l) => n(l, "emigrated") >= 3, { check: { smarts: 0.03, luck: 0.03 } }),
  P("p_beach", "🏖️", "ลูกทะเล", "ไปเที่ยวทะเลรวม 12 ครั้ง", (l) => act(l, "trip") >= 12, { yearly: { happiness: 1 } }),
  P("p_collector", "🏺", "นักสะสม", "เจอของสะสม 3 ชิ้นในชาติเดียว", (l) => String(l.flags.found ?? "").split(",").filter(Boolean).length >= 3, { check: { luck: 0.04 } }),
  P("p_curator", "🖼️", "ภัณฑารักษ์", "เจอของสะสม 6 ชิ้นในชาติเดียว", (l) => String(l.flags.found ?? "").split(",").filter(Boolean).length >= 6, { check: { luck: 0.05 }, money: 0.04 }),
  P("p_pet_lover", "🐾", "ทาสสัตว์เลี้ยง", "รับเลี้ยงสัตว์", (l) => !!l.flags.pet, { yearly: { happiness: 1 } }),
  P("p_beauty_lab", "💉", "หน้าใหม่", "ศัลยกรรมรวม 3 ครั้ง", (l) => act(l, "surgery") >= 3, { check: { looks: 0.04 } }),

  // ───────── ภารกิจ / พลัง ─────────
  P("p_quest_vet", "🗡️", "นักผจญภัยมือเก๋า", "ทำภารกิจไม่ซ้ำครบ 15 แบบ", (l) => ["murim", "court", "apoc", "gate"].reduce((s, k) => s + String(l.flags[`done_${k}`] ?? "").split(",").filter(Boolean).length, 0) >= 15, { survival: 0.03, exp: 0.05 }),
  P("p_quest_master", "🏆", "ผู้พิชิตทุกภารกิจ", "ทำภารกิจไม่ซ้ำครบ 40 แบบ", (l) => ["murim", "court", "apoc", "gate"].reduce((s, k) => s + String(l.flags[`done_${k}`] ?? "").split(",").filter(Boolean).length, 0) >= 40, { survival: 0.04, cp: 4 }),
  P("p_secret_agent", "🕶️", "ผู้รับภารกิจลับ", "ภารกิจลับของระบบสำเร็จ 3 ครั้ง", (l) => n(l, "sqDone") >= 3, { exp: 0.06, check: { luck: 0.03 } }),
  P("p_boss_slayer", "🐉", "นักล่าบอส", "ล้มบอส 25 ครั้ง", (l) => (l.power?.bossKills ?? 0) >= 25, { cp: 5 }),
  P("p_thousand_battles", "🎖️", "ร้อยศึก", "ผ่านภารกิจ 100 ครั้ง", (l) => (l.power?.gates ?? 0) >= 100, { survival: 0.05, cp: 3 }),
  P("p_level50", "🔱", "ผู้ข้ามขีดจำกัด", "เลเวลพลัง 50", (l) => (l.power?.level ?? 0) >= 50, { cp: 4, exp: 0.05 }),
  P("p_top_rank", "👑", "ผู้อยู่บนยอด", "แรงก์สูงสุดของโลก (SSS หรือเทียบเท่า)", (l) => (l.power?.rank ?? 0) >= 8, { cp: 6, survival: 0.04 }),
  P("p_underdog", "🐣", "แรงก์ต่ำผู้ไม่ยอมแพ้", "แรงก์ต่ำสุดแต่ผ่านภารกิจ 30 ครั้ง", (l) => !!l.power && l.power.rank <= 0 && l.power.gates >= 30, { survival: 0.04, exp: 0.06 }),
  P("p_skill_master", "🌀", "ปรมาจารย์สกิล", "ใช้สกิลในฉากจริงรวม 30 ครั้ง", (l) => Object.values(l.power?.mastery ?? {}).reduce((s, v) => s + v, 0) >= 30, { cp: 3, exp: 0.04 }),
  P("p_dual_path", "☯️", "สองเส้นทาง", "ได้สายรอง (คลาสที่สอง)", (l) => !!l.flags.subClass, { cp: 3, exp: 0.04 }),
  P("p_late_awaken", "⏳", "ตื่นช้าแต่ไปไกล", "ตื่นพลังหลังอายุ 30", (l) => !!l.power && l.power.awakenedAt >= 30, { exp: 0.08 }),
  P("p_never_awaken", "🙂", "คนธรรมดาที่ภูมิใจ", "อายุ 50 โดยไม่เคยตื่นพลัง (ในโลกที่มีพลัง)", (l) => l.age >= 50 && !l.power && !l.sys, { yearly: { happiness: 1 }, check: { smarts: 0.03, luck: 0.03 } }),

  // ───────── ประจำโลก ─────────
  P("p_hunter_city", "🌆", "ชาวเมืองแห่ง Gate", "อยู่ในโลก Hunter จนอายุ 40", (l) => inWorld(l, "hunter") && l.age >= 40, { survival: 0.02 }),
  P("p_core_trader", "💠", "พ่อค้าคอร์", "เจอเหตุการณ์ตลาดคอร์ 6 ครั้ง (Hunter)", (l) => sp(l, "h16.mkt", "h16.m_") >= 6, { money: 0.05 }),
  P("p_murim_wanderer", "🍃", "จอมยุทธ์พเนจร", "เจอเหตุการณ์ยุทธภพ 40 เรื่อง", (l) => inWorld(l, "murim") && sp(l, "m", "murim") >= 40, { cp: 2, check: { health: 0.03 } }),
  P("p_jianghu_debts", "📒", "บุญคุณความแค้นยุทธภพ", "เจอเหตุการณ์สมุดบุญคุณ 5 เรื่อง", (l) => sp(l, "m17.l.") >= 5, { check: { luck: 0.03, smarts: 0.03 } }),
  P("p_court_player", "🎭", "นักเล่นเกมการเมือง", "เจอเหตุการณ์การเมืองในราชสำนัก 10 เรื่อง", (l) => sp(l, "c18.") >= 10, { check: { smarts: 0.04, looks: 0.03 } }),
  P("p_novel_breaker", "📕", "ผู้แหกพล็อต", "เข้าร่างในนิยายแล้วรอดเกินอายุ 40", (l) => inWorld(l, "court") && !!l.flags.role && l.age >= 40, { survival: 0.03, check: { luck: 0.03 } }),
  P("p_tower_climber", "🗼", "นักปีนชั้นสูง", "ปีนหอคอยถึงชั้น 30", (l) => n(l, "floor") >= 30, { survival: 0.03, cp: 2 }),
  P("p_tower_peak", "☁️", "ผู้มองลงมาจากเมฆ", "ปีนหอคอยถึงชั้น 70", (l) => n(l, "floor") >= 70, { survival: 0.05, cp: 4 }),
  P("p_apoc_survivor", "☢️", "ผู้รอดจากวันสิ้นโลก", "มีชีวิตรอด 10 ปีหลังวันโลกพัง", (l) => !!l.flags.doomed && sp(l, "a20.", "apoc.") >= 20, { survival: 0.04, yearly: { health: 1 } }),
  P("p_base_builder", "🏗️", "ผู้สร้างฐาน", "เจอเหตุการณ์ในฐาน 10 เรื่อง", (l) => sp(l, "a20.b.", "a20.crisis.") >= 10, { survival: 0.03, money: 0.03 }),
  P("p_system_user", "🔔", "ผู้ใช้ระบบเต็มตัว", "ระบบชีวิตเลเวล 10 (โลกธรรมดา)", (l) => (l.sys?.level ?? 0) >= 10, { exp: 0.06, check: { smarts: 0.03 } }),
  P("p_ordinary_hero", "🦸", "ฮีโร่ธรรมดา", "ภารกิจระบบสำเร็จ 10 ครั้ง (โลกธรรมดา)", (l) => inWorld(l, "ordinary") && (l.power?.gates ?? 0) >= 10, { survival: 0.02, check: { health: 0.03 } }),
  P("p_three_nations", "🌏", "สามแผ่นดิน", "เจอเหตุการณ์เฉพาะประเทศ 12 เรื่อง", (l) => sp(l, "cty.") >= 12, { check: { smarts: 0.03, luck: 0.02 } }),
  P("p_storyline", "📚", "ตัวละครหลักของเรื่อง", "จบเส้นเรื่องต่อเนื่อง 2 เรื่อง", (l) => Object.keys(l.flags).filter((k) => /^q_[a-z0-9]+$/.test(k) && Number(l.flags[k]) === 99).length >= 2, { exp: 0.05, check: { luck: 0.03 } }),
  P("p_nemesis_end", "🎯", "ปิดบัญชีคู่ปรับ", "ชนะคู่ปรับประจำชีวิต", (l) => !!l.flags.nemesisBeaten, { cp: 3, yearly: { happiness: 1 } }),
  P("p_nemesis_friend", "🫂", "ศัตรูกลายเป็นมิตร", "คืนดีกับคู่ปรับประจำชีวิต", (l) => l.flags.nemesisStage === "friend", { survival: 0.03, yearly: { happiness: 1 } }),
  P("p_heir", "🧬", "ทายาทผู้สืบทอด", "เกิดเป็นลูกหลานของชาติก่อน (เล่นต่อเป็นลูก)", (l) => !!l.flags.inherited || !!l.flags.descendant, { money: 0.04, check: { luck: 0.03 } }),
  P("p_club_star", "🏅", "ดาวเด่นของชมรม", "ไต่ระดับชมรมถึงขั้นที่ 3", (l) => n(l, "clubBest") >= 3, { check: { health: 0.03, looks: 0.03 } }),
  P("p_champion", "🥇", "แชมป์ตัวจริง", "ชนะการแข่งขันชมรม 5 ครั้ง", (l) => n(l, "clubWins") >= 5, { check: { luck: 0.03 }, yearly: { happiness: 1 } }),
  P("p_club_pro", "📝", "นักกีฬา/ศิลปินอาชีพ", "ได้สัญญาจากแมวมอง", (l) => !!l.flags.clubPro, { money: 0.05, check: { health: 0.03 } }),
  P("p_old_soul", "👻", "วิญญาณเก่าแก่", "ฝันถึงชาติก่อนจากโลกอื่น", (l) => sp(l, "past.") >= 1, { exp: 0.05, check: { smarts: 0.03 } }),
];

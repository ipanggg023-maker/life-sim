// แท็บ "ทำ" ของยุทธภพ (เขียนใหม่ทั้งหมด · MURIM_PLAN §7) — แบ่งหมวด: ฝึกฝน · ยุทธภพ · ชีวิต · ครอบครัว · อาชญากรรม
// ยุทธภพแสดงเฉพาะกิจกรรมชุดนี้ (และหาหมอรักษาบาดแผล) — กิจกรรมกลางของโลกอื่นถูกซ่อน
import { ACTIVITIES, activityFilters, timeBudget, type Activity } from "../../../engine/activities";
import { runEvent } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, checkChance, clamp, createPerson, people, shortName } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { addQi, artsOf, practise } from "../martial/arts";
import { startDuel } from "./duel";
import { jailed, mourning } from "./law";
import { REL_LABEL, coverTracks, hearRumor } from "./rumors";
import { palaceAccess } from "../world/court";
import { patronOf, spyPalace } from "../world/palace";
import { canScheme } from "../world/palaceSchemes";
import { AUDIENCE, abdicate, crownHeir, isEmperor, royalKids } from "../world/emperor";
import { haremOf } from "../world/harem";
import { getEvent } from "../../../engine/events";
import { TAEL } from "../story/kit";
import { gift } from "./gifts";

const pow = (l: Life) => l.power?.rank ?? 0;
const adult = 16;
/** สนามสอบที่เปิดให้คุณปีนี้ (ตามวุฒิที่มี) — undefined = ปีนี้ไม่มีสนามสอบ/สอบครบแล้ว */
export function examLevel(l: Life): string | undefined {
  const triennial = (l.birthYear + l.age) % 3 === 0;
  if (!l.flags.xiucai) return l.age >= 15 ? "goal.exam" : undefined;
  if (!l.flags.juren) return l.age >= 17 && triennial ? "jh.exam_province" : undefined;
  if (!l.flags.jinshi) return l.age >= 20 && triennial ? "jh.exam_palace" : undefined;
  return undefined;
}
const ok = (text: string) => ({ text, kind: "good" as const });
const big = (text: string) => ({ text, kind: "milestone" as const });
const bad = (text: string) => ({ text, kind: "bad" as const });
const meh = (text: string) => ({ text });

const M = (a: Omit<Activity, "world"> & { group: string }): Activity => ({ ...a, world: "murim" });

const MURIM_ACTS: Activity[] = [
  // ───── ฝึกฝน ─────
  M({ group: "ฝึกฝน", id: "mw_body", emoji: "🥋", name: "ฝึกร่างกายใต้น้ำตก", desc: "สุขภาพ + พื้นฐาน", minAge: 6, run: (l) => { addStat(l, "health", randInt(l, 2, 5)); l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1; return ok("น้ำตกเย็นจนกระดูกปวด — แต่ทุกเช้าคุณยืนได้นานขึ้นอีกนิด"); } }),
  M({ group: "ฝึกฝน", id: "mw_meditate", emoji: "🧘", name: "นั่งสมาธิ", desc: "ความสุข + ลมปราณนิ่ง", minAge: 8, run: (l) => { addStat(l, "happiness", randInt(l, 2, 5)); if (l.power) addQi(l, 0.5); return ok(l.power ? "ลมปราณไหลเป็นวงช้าๆ ใจสงบลงเหมือนน้ำในบ่อ" : "คุณนั่งหลับตาจนขาเป็นเหน็บ — แต่ใจเบาขึ้น"); } }),
  M({ group: "ฝึกฝน", id: "mw_manual", emoji: "📜", name: "อ่านตำรา", desc: "สติปัญญา + ความเข้าใจวิชา", minAge: 6, run: (l) => { addStat(l, "smarts", randInt(l, 1, 3)); const a = artsOf(l)[0]; if (a) practise(l, a.id, 3); return ok("คุณอ่านจนตะเกียงหมดน้ำมัน — ตัวอักษรบางตัวเริ่มมีความหมายใหม่"); } }),
  // สอบขุนนาง: ใครก็สอบได้ ไม่ต้องมีเป้าหมายขุนนาง · ระดับตามที่สอบผ่านแล้ว · มณฑลและหน้าพระที่นั่งจัดทุกสามปี
  M({ group: "ฝึกฝน", id: "mw_exam", emoji: "🖌️", name: "สอบขุนนาง", desc: "อำเภอ → มณฑล → หน้าพระที่นั่ง (สองระดับหลังจัดทุก 3 ปี)", minAge: 15, available: (l) => !!examLevel(l), run: (l) => { runEvent(l, examLevel(l)!); return { text: "" }; } }),
  M({ group: "ฝึกฝน", id: "mw_spar", emoji: "🤺", name: "ประลองกับเพื่อนร่วมฝึก", desc: "ฝีมือ + อาจบาดเจ็บเล็กน้อย", minAge: 12, available: (l) => !!l.power, odds: (l) => clamp(0.5 + (l.stats.health - 50) / 200, 0.2, 0.9), run: (l) => { gainExp(l, 250); if (chance(l, clamp(0.5 + (l.stats.health - 50) / 200, 0.2, 0.9))) return ok("คุณชนะสองในสามยก — ท่าที่ติดมาหลายเดือนเริ่มลื่นไหล"); addStat(l, "health", -3); return bad("ไม้ฟาดเข้าซี่โครงเต็มแรง — เจ็บแต่ได้บทเรียน"); } }),
  M({ group: "ฝึกฝน", id: "mw_wander", emoji: "⛰️", name: "ท่องเขาหาวาสนา", desc: "อาจเจอสิ่งไม่คาดฝัน", minAge: 14, odds: (l) => clamp(0.12 + l.stats.luck / 400, 0.05, 0.4), run: (l) => {
    if (chance(l, clamp(0.12 + l.stats.luck / 400, 0.05, 0.4))) {
      const r = randInt(l, 0, 2);
      if (r === 0) { addQi(l, 2); return { text: "ในถ้ำหลังน้ำตกมีบ่อน้ำอุ่นที่ลมปราณหนาแน่นผิดธรรมชาติ — คุณนั่งอยู่เจ็ดวัน", kind: "milestone" as const }; }
      if (r === 1) { addStat(l, "health", 8); return { text: "โสมป่าอายุร้อยปีขึ้นอยู่ใต้รากต้นสน — คุณต้มกินทั้งราก", kind: "milestone" as const }; }
      gainExp(l, 600); return { text: "ฤาษีชราตกปลาริมลำธารชี้ท่าคุณผิดสามจุด แล้วหายไปในหมอก", kind: "milestone" as const };
    }
    if (chance(l, 0.25)) { addStat(l, "health", -6); return bad("หลงทางสามวัน ข้อเท้าแพลงกลางป่า"); }
    addStat(l, "happiness", 2); return meh("ภูเขาสวยงาม — แต่ไม่มีอะไรรอคุณอยู่ คราวนี้");
  } }),

  // ───── ยุทธภพ ─────
  M({ group: "ยุทธภพ", id: "mw_teahouse", emoji: "🍵", name: "ฟังข่าวในโรงน้ำชา", desc: "ข่าวลือ อาจกลายเป็นงาน", minAge: 10, cost: 200, run: (l) => {
    addMoney(l, -200);
    const jobs = ["ad.j.wanted_hunt", "ad.j.inn_secret", "ad.j.escort_small", "ms.m.challenge_board"].filter((id) => !(l.seen[id] ?? 0) || id === "ad.j.escort_small");
    if (l.age >= 18 && jobs.length && chance(l, 0.25)) { runEvent(l, pick(l, jobs)); return { text: "" }; }
    const r = hearRumor(l);
    addStat(l, "happiness", 1); return meh(`ข่าวลือจาก${r.src}: "${r.text}" (${REL_LABEL[r.rel]}) — ตรวจสอบหรือลงมือได้ที่แท็บยุทธภพ`);
  } }),
  M({ group: "ยุทธภพ", id: "mw_challenge", emoji: "⚔️", name: "ท้าประลองจอมยุทธ์", desc: "ชนะได้ชื่อเสียง แพ้อาจเจ็บ", minAge: adult, available: (l) => !!l.power, run: (l) => { startDuel(l, { foe: pick(l, ["จอมยุทธ์พเนจร", "ศิษย์สำนักใหญ่", "นักดาบไร้นาม"]), rank: clamp(pow(l) + randInt(l, -1, 1), 0, 8), lethal: false, on: "brawl" }); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_bounty", emoji: "📯", name: "ล่าค่าหัว", desc: "เงินดี ถึงตาย", minAge: 18, available: (l) => !!l.power && pow(l) >= 2, run: (l) => { startDuel(l, { foe: pick(l, ["โจรร้ายมีค่าหัว", "ฆาตกรหนีคดี", "หัวหน้าโจรภูเขา"]), rank: clamp(pow(l) + randInt(l, 0, 1), 0, 8), lethal: true, on: "bandit" }); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_investigate", emoji: "🔍", name: "รับสืบคดี", desc: "หาคนร้ายจากเบาะแส", minAge: 16, available: (l) => l.stats.smarts >= 40, run: (l) => { runEvent(l, "iv.case"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_patron", emoji: "🎁", name: "เยี่ยมผู้อุปถัมภ์ในวัง", desc: "ของขวัญรักษาน้ำใจ", minAge: 18, cost: 10 * TAEL, available: (l) => palaceAccess(l) && !l.flags.emperorSelf && !!patronOf(l)?.alive && !patronOf(l)?.out, run: (l) => { addMoney(l, -10 * TAEL); const p = patronOf(l)!; p.you.trust = Math.min(100, p.you.trust + 8); p.known = true; return ok(`${p.name}รับของขวัญด้วยรอยยิ้ม — "${p.goal}" คือเรื่องที่เขาเล่าให้ฟังทั้งบ่าย`); } }),
  M({ group: "ราชสำนัก", id: "mw_palace_spy", emoji: "👂", name: "สืบข่าวในวัง", desc: "รู้ว่าใครหนุนใคร", minAge: 18, available: palaceAccess, odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 150 + (l.job?.careerId === "jinyiwei" ? 0.2 : 0), 0.1, 0.9), run: (l) => { if (chance(l, clamp(0.4 + (l.stats.smarts - 50) / 150 + (l.job?.careerId === "jinyiwei" ? 0.2 : 0), 0.1, 0.9))) return ok(`ข่าวในวัง: ${spyPalace(l)}`); return bad("นางกำนัลที่คุณถามเอาเรื่องไปเล่าต่อ — มีคนรู้ว่าคุณกำลังสืบ"); } }),
  M({ group: "ราชสำนัก", id: "mw_memorial", emoji: "📜", name: "ถวายฎีกา", desc: "ทูลเรื่องทุกข์ราษฎร", minAge: 20, available: (l) => palaceAccess(l) && !l.flags.emperorSelf && (l.job?.careerId === "official" || l.fame >= 30), run: (l) => { runEvent(l, "ct.p_memorial"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_scheme", emoji: "🗡️", name: "วางแผนชิงอำนาจ", desc: "หักหลัง ใส่ร้าย ยึดอำนาจ — ขึ้นเป็นใหญ่", minAge: 18, available: canScheme, run: (l) => { runEvent(l, "ct.s_menu"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_audience", emoji: "🏛️", name: "ออกว่าราชการเช้า", desc: "ขุนนางยื่นเรื่องที่ค้างอยู่", minAge: 18, available: isEmperor, run: (l) => { const ok2 = AUDIENCE.filter((id) => { const e = getEvent(id); return !!e && (!e.when || e.when(l)) && (e.maxTimes === 0 || (l.seen[id] ?? 0) < (e.maxTimes ?? 1)); }); runEvent(l, ok2.length ? pick(l, ok2) : "ct.e_edict"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_tour", emoji: "🐎", name: "เสด็จตรวจราชการหัวเมือง", desc: "ดูแผ่นดินด้วยตาตัวเอง", minAge: 18, available: isEmperor, run: (l) => { runEvent(l, "ct.e_tour"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_heaven", emoji: "🌄", name: "บวงสรวงฟ้า ณ หอเทียนถาน", desc: "ความชอบธรรมของรัชกาล", minAge: 18, available: isEmperor, run: (l) => { runEvent(l, "ct.e_heaven"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_exam_palace", emoji: "🖌️", name: "สอบหน้าพระที่นั่ง", desc: "เลือกจอหงวน ได้ขุนนางของตัวเอง", minAge: 18, available: isEmperor, run: (l) => { runEvent(l, "ct.e_exam"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_royal_hunt", emoji: "🏹", name: "ล่าสัตว์ฤดูใบไม้ร่วง", desc: "พาองค์ชายออกป่าหลวง", minAge: 18, available: (l) => isEmperor(l) && royalKids(l).filter((p) => p.gender === "m" && p.age >= 8).length >= 2, run: (l) => { runEvent(l, "ct.h_princes_hunt"); return { text: "" }; } }),
  M({ group: "วังหลัง", id: "mw_h_select", emoji: "🌺", name: "คัดเลือกเข้าวังหลัง", desc: "ตระกูลขุนนางส่งลูกหลานมาเข้าคัด", minAge: 16, available: isEmperor, run: (l) => { runEvent(l, "ct.h_select"); return { text: "" }; } }),
  M({ group: "วังหลัง", id: "mw_h_night", emoji: "🏮", name: "เสด็จตำหนักในวังหลัง", desc: "ความผูกพัน · ลูก · ความริษยาของคนอื่น", minAge: 16, time: 0, available: (l) => isEmperor(l) && haremOf(l).some((c) => !c.cold), run: (l) => { runEvent(l, "ct.h_night"); return { text: "" }; } }),
  M({ group: "วังหลัง", id: "mw_h_ranks", emoji: "📒", name: "ทะเบียนวังหลัง", desc: "เลื่อนขั้น ลดขั้น ตั้งฮองเฮา ตำหนักเย็น", minAge: 16, time: 0, available: (l) => isEmperor(l) && haremOf(l).length > 0, run: (l) => { runEvent(l, "ct.h_ranks"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_rule", emoji: "📯", name: "ว่าราชการ ออกราชโองการ", desc: "ภาษี นิรโทษ ห้ามสำนัก ขุดคลอง", minAge: 18, available: isEmperor, run: (l) => { runEvent(l, "ct.e_edict"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_name_heir", emoji: "🐉", name: "แต่งตั้งรัชทายาท", desc: "เลือกลูกที่จะสืบบัลลังก์", minAge: 18, available: (l) => isEmperor(l) && royalKids(l).some((p) => p.age >= 6), run: (l) => { runEvent(l, "ct.e_heir"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_incognito", emoji: "🎭", name: "ปลอมตัวออกนอกวัง", desc: "ดูชีวิตราษฎรด้วยตาตัวเอง", minAge: 18, available: isEmperor, run: (l) => { runEvent(l, "ct.e_incognito"); return { text: "" }; } }),
  M({ group: "ราชสำนัก", id: "mw_abdicate", emoji: "🍂", name: "สละราชสมบัติให้รัชทายาท", desc: "เป็นไท่ซ่างหวง ใช้ชีวิตที่เหลืออย่างสงบ", minAge: 30, time: 0, available: (l) => isEmperor(l) && !!crownHeir(l) && crownHeir(l)!.age >= 16, run: (l) => { const h = crownHeir(l)!; abdicate(l, h); return big(`คุณถอดมงกุฎวางบนศีรษะของ${h.name}ต่อหน้าศาลบรรพชน — ตอนนี้คุณคือไท่ซ่างหวง พระเจ้าหลวงผู้สละราชสมบัติ ลูกของคุณนั่งบัลลังก์ และคุณได้นอนหลับสนิทเป็นครั้งแรกในรอบหลายปี`); } }),
  M({ group: "ราชสำนัก", id: "mw_court_leave", emoji: "🚪", name: "ถอนตัวจากการเมืองในวัง", desc: "ไม่ยุ่งอีก แต่โลกยังเดินต่อ", minAge: 18, time: 0, available: (l) => palaceAccess(l) && !l.flags.emperorSelf, run: (l) => { l.flags.palaceWithdrawn = true; delete l.flags.palaceBack; delete l.flags.palacePatron; return meh("คุณคืนป้ายผ่านประตูวัง — ข่าวในวังจากนี้จะมาถึงคุณแบบข่าวลือเหมือนชาวบ้านทั่วไป"); } }),
  M({ group: "ยุทธภพ", id: "mw_visit", emoji: "⛩️", name: "เยือนสำนักอื่น", desc: "ผูกมิตร แลกเปลี่ยนวิชา", minAge: 14, cost: 2000, run: (l) => { runEvent(l, "jh.visit"); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_alliance", emoji: "🛡️", name: "รับงานพันธมิตรยุทธจักร", desc: "คุ้มกัน สืบข่าว ไกล่เกลี่ย", minAge: 16, available: (l) => Number(l.flags.m17Align ?? 0) >= 0 && (!!l.power || l.stats.smarts >= 55), run: (l) => { runEvent(l, "jh.alliance"); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_cult_hunt", emoji: "🔥", name: "ล่าลัทธิมาร", desc: "ช่วยคน เสี่ยงชีวิต", minAge: 16, available: (l) => !!l.power && Number(l.flags.m17Align ?? 0) >= 0 && l.power.guild !== "cult", run: (l) => { runEvent(l, "jh.cult_hunt"); return { text: "" }; } }),
  M({ group: "ชีวิต", id: "mw_beauty", emoji: "🌸", name: "ประกวดโฉมงาม", desc: "รูปลักษณ์ตัดสิน", minAge: 15, available: (l) => l.age <= 35, run: (l) => { runEvent(l, "jh.beauty"); return { text: "" }; } }),
  M({ group: "อาชญากรรม", id: "mw_steal_manual", emoji: "📕", name: "ขโมยคัมภีร์ลับของสำนัก", desc: "ได้วิชาลับ สำนักจะตามล่า", minAge: 16, available: (l) => !!l.power, run: (l) => { runEvent(l, "jh.steal_manual"); return { text: "" }; } }),
  M({ group: "ยุทธภพ", id: "mw_travel", emoji: "🧭", name: "ย้ายถิ่นไปภูมิภาคอื่น", desc: "เปลี่ยนที่อยู่ เรื่องราวเปลี่ยนตาม", minAge: adult, run: (l) => { runEvent(l, "tv.move"); return { text: "" }; } }),

  // ───── ชีวิต ─────
  M({ group: "ชีวิต", id: "mw_doctor", emoji: "🌿", name: "หาหมอจีน", desc: "สุขภาพ +", minAge: 0, cost: 2000, run: (l) => { if (l.age >= 18) addMoney(l, -2000); addStat(l, "health", randInt(l, 4, 10)); return ok("หมอแมะชีพจรนาน แล้วจ่ายยาต้มขมปี๋มาสามหม้อ"); } }),
  M({ group: "ชีวิต", id: "mw_shrine", emoji: "🏮", name: "ไหว้บรรพชน/ดูดวง", desc: "ความสุข + บางทีโชค", minAge: 5, run: (l) => { addStat(l, "happiness", randInt(l, 2, 5)); if (chance(l, 0.2)) { addStat(l, "luck", 1); return ok("ธูปสามดอกไหม้เท่ากันพอดี — ซินแสบอกว่าลางดี"); } return ok("ควันธูปลอยขึ้นช้าๆ ใจคุณสงบลง"); } }),
  M({ group: "ชีวิต", id: "mw_tavern", emoji: "🍶", name: "ดื่มที่โรงเตี๊ยม", desc: "ความสุข + อาจได้เพื่อน", minAge: adult, cost: 1000, available: (l) => !mourning(l), run: (l) => {
    addMoney(l, -1000); addStat(l, "happiness", randInt(l, 3, 7));
    if (chance(l, 0.2)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -5, 5), bond: 50 }); return ok(`คุณร่วมโต๊ะกับ${shortName(p)} คุยกันถูกคอจนไก่ขัน`); }
    if (chance(l, 0.15)) { addStat(l, "health", -3); return bad("สุราหมักร้อยปีแรงเกินคาด — ตื่นมาในคอกม้า"); }
    return ok("เสียงพิณจากชั้นบนกับสุราอุ่นๆ — คืนธรรมดาที่ดี");
  } }),
  M({ group: "ชีวิต", id: "mw_gamble", emoji: "🎲", name: "เล่นถั่วในบ่อน", desc: "เสี่ยงโชค", minAge: adult, cost: 2000, available: (l) => !mourning(l), odds: (l) => clamp(0.3 + (l.stats.luck - 50) / 250, 0.1, 0.6), run: (l) => {
    addMoney(l, -2000);
    if (chance(l, clamp(0.3 + (l.stats.luck - 50) / 250, 0.1, 0.6))) { const w = randInt(l, 3, 8); addMoney(l, w * TAEL); return ok(`ถ้วยเปิด — ถูก! ได้ ${w} ตำลึง`); }
    if (chance(l, 0.1)) { l.flags.gambleDebt = true; addMoney(l, -5 * TAEL); return bad("เสียแล้วยังยืมเงินบ่อนเล่นต่อ — คนทวงหนี้จำหน้าคุณได้แล้ว"); }
    return meh("ถ้วยเปิด… เสียตามระเบียบ");
  } }),
  M({ group: "ชีวิต", id: "mw_pill", emoji: "💊", name: "ซื้อยาวิเศษที่ตลาดยา", desc: "ยาทะลวงชีพจร (อาจได้ของปลอม)", minAge: 18, cost: 50 * TAEL, available: (l) => !!l.power && !l.power.items.includes("ยาเม็ดทะลวงชีพจร"), odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 150 + (l.flags.medicKnow ? 0.2 : 0), 0.1, 0.9), run: (l) => {
    addMoney(l, -50 * TAEL);
    if (chance(l, clamp(0.4 + (l.stats.smarts - 50) / 150 + (l.flags.medicKnow ? 0.2 : 0), 0.1, 0.9))) { l.power!.items.push("ยาเม็ดทะลวงชีพจร"); return ok("ยาเม็ดสีทองกลิ่นหอมเย็น — ของจริง เก็บไว้ใช้ตอนทะลวงขั้น"); }
    return bad("ยาเม็ดเป็นแป้งผสมน้ำผึ้ง — พ่อค้าหายตัวไปจากตลาดในวันรุ่งขึ้น");
  } }),
  M({ group: "ชีวิต", id: "mw_gear", emoji: "🗡️", name: "ซื้ออาวุธคู่กาย", desc: "อาวุธดีช่วยในการต่อสู้", minAge: 14, cost: 30 * TAEL, available: (l) => !!l.power && !l.power.items.some((i) => /กระบี่|ดาบ|ทวน/.test(i)), run: (l) => { addMoney(l, -30 * TAEL); const w = pick(l, ["กระบี่เหล็กกล้าสามฟุต", "ดาบหลังหนาตีมือ", "ทวนเหล็กยาวเก้าศอก"]); l.power!.items.push(w); return ok(`${w}พอดีมือราวกับทำมาให้คุณ`); } }),
  M({ group: "ชีวิต", id: "mw_rest", emoji: "😌", name: "พักผ่อนอยู่บ้าน", desc: "ความสุข + สุขภาพเล็กน้อย", minAge: 3, run: (l) => { addStat(l, "happiness", randInt(l, 2, 4)); addStat(l, "health", 1); return ok("ปีนี้คุณนอนกลางวันใต้ต้นท้อบ่อยกว่าปกติ — และไม่เสียใจเลย"); } }),

  // ───── ครอบครัว ─────
  M({ group: "ครอบครัว", id: "mw_matchmaker", emoji: "💮", name: "ไปหาแม่สื่อ", desc: "หาคู่ครอง", minAge: adult, cost: 3000, available: (l) => !people(l, "partner").length && !people(l, "spouse").length && !mourning(l) && l.job?.careerId !== "monk", odds: (l) => checkChance(l, "looks", 45, (l.wealth === "rich" || l.wealth === "elite" ? 0.2 : 0) + gift(l, "romance")), run: (l) => {
    addMoney(l, -3000);
    if (chance(l, checkChance(l, "looks", 45, (l.wealth === "rich" || l.wealth === "elite" ? 0.2 : 0) + gift(l, "romance")))) { const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -3, 3), bond: 55 }); return ok(`แม่สื่อพาไปดูตัว${shortName(p)} — สองบ้านพอใจกันมาก`); }
    return bad("ฝ่ายนั้นดูดวงแล้วบอกว่าธาตุไม่ถูกกัน");
  } }),
  M({ group: "ครอบครัว", id: "mw_filial", emoji: "🍲", name: "ดูแลพ่อแม่", desc: "ความกตัญญู + ชื่อเสียง", minAge: 12, available: (l) => people(l, "father").length + people(l, "mother").length > 0, run: (l) => { for (const p of [...people(l, "father"), ...people(l, "mother")]) p.bond = Math.min(100, p.bond + 6); addFame(l, 1); addStat(l, "happiness", 2); return ok("คุณต้มโจ๊กไก่ป้อนพ่อแม่ทุกเช้า — เพื่อนบ้านพูดถึงลูกกตัญญูบ้านนี้"); } }),
  M({ group: "ครอบครัว", id: "mw_adopt", emoji: "🧸", name: "รับเด็กกำพร้ามาเลี้ยง", desc: "ลูกบุญธรรม", minAge: 22, cost: 5 * TAEL, run: (l) => { addMoney(l, -5 * TAEL); const k = createPerson(l, "child", { age: randInt(l, 1, 8), bond: 50 }); k.tags = ["adopted"]; addFame(l, 1); return ok(`${shortName(k)}จากวัดร้างจับมือคุณแน่นตลอดทางกลับบ้าน`); } }),
  M({ group: "ครอบครัว", id: "mw_disown", emoji: "✂️", name: "ตัดพ่อตัดลูก", desc: "ขีดชื่อลูกออกจากผังตระกูล", minAge: 35, available: (l) => people(l, "child").some((p) => p.age >= 14), run: (l) => { runEvent(l, "fm.disown"); return { text: "" }; } }),

  // ───── อาชญากรรม ─────
  M({ group: "อาชญากรรม", id: "mw_disguise", emoji: "🎭", name: "ปลอมตัวหลบสายตา", desc: "ทางการจับตาน้อยลง", minAge: 14, available: (l) => Number(l.flags.heat ?? 0) > 0, odds: (l) => clamp(0.45 + (l.stats.smarts - 50) / 150, 0.1, 0.9), run: (l) => { if (chance(l, clamp(0.45 + (l.stats.smarts - 50) / 150, 0.1, 0.9))) { coverTracks(l, 15); return ok("หนวดปลอม ผ้าโพกหัว และสำเนียงต่างถิ่น — ยามเดินผ่านคุณไปสามครั้งโดยไม่หันมอง"); } l.flags.heat = Number(l.flags.heat ?? 0) + 5; return bad("หนวดปลอมหลุดกลางตลาด — มีคนจำหน้าคุณได้"); } }),
  M({ group: "อาชญากรรม", id: "mw_forge", emoji: "📜", name: "ทำเอกสารตัวตนปลอม", desc: "ล้างใบประกาศจับได้ ถ้าไม่ถูกหักหลัง", minAge: 16, cost: 30 * TAEL, available: (l) => Number(l.flags.heat ?? 0) >= 20, odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 150 + (l.stats.luck - 50) / 300, 0.1, 0.85), run: (l) => { addMoney(l, -30 * TAEL); if (chance(l, clamp(0.4 + (l.stats.smarts - 50) / 150 + (l.stats.luck - 50) / 300, 0.1, 0.85))) { coverTracks(l, 35); l.flags.forgedId = true; return ok("ตราประทับนายอำเภอเหมือนจริงทุกเส้น — ในทะเบียน คุณกลายเป็นคนอื่นไปแล้ว"); } l.flags.heat = Number(l.flags.heat ?? 0) + 20; return bad("ช่างปลอมเอกสารเป็นสายของทางการ — ชื่อจริงของคุณถูกส่งต่อให้มือปราบ"); } }),
  M({ group: "อาชญากรรม", id: "mw_cover", emoji: "🔥", name: "ทำลายหลักฐาน", desc: "เผาเอกสาร ปิดปากพยาน", minAge: 16, available: (l) => Number(l.flags.heat ?? 0) > 0, odds: (l) => clamp(0.5 + (l.stats.smarts - 50) / 150, 0.15, 0.9), run: (l) => { if (chance(l, clamp(0.5 + (l.stats.smarts - 50) / 150, 0.15, 0.9))) { coverTracks(l, 20); return ok("เถ้าถ่านของบันทึกปลิวไปกับลม — ข่าวเรื่องคุณเริ่มเงียบลง"); } l.flags.heat = Number(l.flags.heat ?? 0) + 10; return bad("พยานคนหนึ่งเห็นคุณเผาเอกสาร — ตอนนี้เขาเป็นหลักฐานชิ้นใหม่"); } }),
  M({ group: "อาชญากรรม", id: "mw_steal", emoji: "🤏", name: "ล้วงกระเป๋า/ขโมย", desc: "ได้เงิน เสี่ยงถูกจับ", minAge: 8, run: (l) => { runEvent(l, "cr.steal"); return { text: "" }; } }),
  M({ group: "อาชญากรรม", id: "mw_rob", emoji: "🗡️", name: "ดักปล้นคนเดินทาง", desc: "เงินมาก บาปมาก", minAge: adult, run: (l) => { runEvent(l, "cr.rob"); return { text: "" }; } }),
  M({ group: "อาชญากรรม", id: "mw_poison", emoji: "☠️", name: "วางยา / ลอบสังหาร", desc: "เลือกเป้าหมายเอง ใครก็ได้ — ยิ่งสูงยิ่งยาก", minAge: adult, run: (l) => { runEvent(l, "dk.menu"); return { text: "" }; } }),
  M({ group: "อาชญากรรม", id: "mw_hit", emoji: "🌑", name: "รับงานลอบสังหาร", desc: "ทองหนัก ถึงตาย", minAge: 18, available: (l) => !!l.power, run: (l) => { runEvent(l, "cr.assassinate"); return { text: "" }; } }),
  M({ group: "อาชญากรรม", id: "mw_frame", emoji: "🎭", name: "ใส่ร้ายคนอื่น", desc: "ส่งศัตรูเข้าคุก", minAge: 18, run: (l) => { runEvent(l, "cr.frame"); return { text: "" }; } }),
];

// หาหมอรักษาบาดแผล (ลงทะเบียนใน bodyEvents) ย้ายมาอยู่หมวดชีวิต ต่อจากหาหมอจีน
const heal = ACTIVITIES.findIndex((a) => a.id === "m_heal");
const healAct = heal >= 0 ? ACTIVITIES.splice(heal, 1)[0] : undefined;
if (healAct) MURIM_ACTS.splice(MURIM_ACTS.findIndex((a) => a.id === "mw_doctor") + 1, 0, { ...healAct, group: "ชีวิต" });
ACTIVITIES.push(...MURIM_ACTS);

/** ยุทธภพเห็นเฉพาะกิจกรรมชุดใหม่ + หาหมอรักษาบาดแผล · ในคุกทำได้แค่ฝึก/สมาธิ/อ่าน/พัก */
const KEEP = new Set(["m_heal"]);
const IN_JAIL = new Set(["mw_body", "mw_meditate", "mw_manual", "mw_rest"]);
activityFilters.push((l, a) => {
  if (l.worldId !== "murim") return true;
  if (!a.id.startsWith("mw_") && !KEEP.has(a.id)) return false;
  return !jailed(l) || IN_JAIL.has(a.id);
});

// เวลาในหนึ่งปีมีจำกัด (EXPANSION §3.1): เดินทางไกล/งานใหญ่กินเวลาสองส่วน
const LONG = ["mw_wander", "mw_travel", "mw_investigate", "mw_visit", "mw_alliance", "mw_cult_hunt", "mw_steal_manual"];
for (const a of ACTIVITIES) if (LONG.includes(a.id)) a.time = 2;
/** งบเวลากิจกรรมรอง: ผู้ใหญ่ 5 ส่วน · เด็กและคนชราน้อยกว่า · ป่วยหนักหรือติดคุกเหลือน้อย */
export function murimTimeBudget(l: Life): number | undefined {
  if (l.worldId !== "murim") return undefined;
  let t = l.age < 10 ? 2 : l.age < 16 ? 3 : l.age >= 85 ? 2 : l.age >= 70 ? 3 : 5;
  if (l.stats.health < 30) t -= 1;
  if (jailed(l)) t = Math.min(t, 2);
  return Math.max(1, t);
}
timeBudget.fn = murimTimeBudget;

// เหตุการณ์ของเป้าหมายชีวิตชุดใหม่ (MURIM_PLAN §18.1 · EXPANSION §2)
// แต่ละเป้าหมาย: เกิดจากเหตุการณ์จริง → มีขั้นที่มองเห็น → ทางเลือกมีต้นทุน → จบได้หลายแบบ · เปลี่ยนได้เมื่อความจริงปรากฏ
import type { Ctx, GameEvent } from "../../../engine/events";
import { feel } from "../../../engine/npc";
import { pick } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { shortName } from "../../../engine/util";
import { alignment, mySect } from "../m17core";
import { artsOf } from "../martial/arts";
import { B, BIG, C, E, G, K, N, P, PAY, ab } from "../story/kit";
import { addSideGoal, hasGoal, mainGoal, setGoal, sideGoals } from "./goals";

const rank = (l: Life) => l.power?.rank ?? -1;
const goalOf = (l: Life, id: string) => (l.goals ?? []).find((g) => !g.end && g.id === id);
const sworn = (l: Life) => l.people.find((p) => p.alive && p.tags?.includes("sworn"));
const oathFriend = (l: Life) => { const g = goalOf(l, "oath"); return l.people.find((p) => p.id === g?.pid); };

/** ที่มาที่แท้จริงของชาติกำเนิด — สุ่มครั้งเดียวต่อชีวิต */
const ORIGINS = {
  noble: "ทายาทคนสุดท้ายของตระกูลขุนนางที่ถูกประหารทั้งตระกูลเมื่อยี่สิบปีก่อน",
  cult: "ลูกของผู้อาวุโสลัทธิมารสวรรค์ ที่ถูกลักพาตัวมาจากเทือกเขาตะวันตก",
  enemy: "ลูกของตระกูลที่เคยเป็นศัตรูกับคนที่เลี้ยงคุณมา — พวกเขาพาคุณมาเลี้ยงแทนการฆ่า",
  poor: "ลูกของหญิงยากจนคนหนึ่งที่เลี้ยงลูกไม่ไหว และยังมีชีวิตอยู่ในหมู่บ้านห่างไกล",
} as const;
type Origin = keyof typeof ORIGINS;
const originOf = (l: Life): Origin => (l.flags.birthOrigin as Origin | undefined) ?? "poor";

export const GOAL2_EVENTS: GameEvent[] = [
  // ───── ชาติกำเนิด ─────
  E("goal.birth_clue1", [12, 70], "ผ้าห่อตัวเก่าที่ติดตัวคุณมาตั้งแต่เกิด มีลายปักตระกูลที่ไม่มีใครในหมู่บ้านจำได้", [
    K("ไปค้นทะเบียนเก่าที่ว่าการอำเภอ", "smarts", 50, G("ในสมุดทะเบียนปีที่คุณเกิด มีบันทึกเด็กถูกทิ้งหน้าวัด — พร้อมชื่อหมอตำแยที่รับตัวไว้", { flag: "birthClue1", iq: 1 }), N("เสมียนไม่ยอมให้ดู — อาจต้องลองวิธีอื่น", {})),
    PAY("ติดสินบนเสมียน", 3, G("เสมียนเปิดสมุดให้ดูครึ่งคืน — คุณได้ชื่อหมอตำแยที่รับคุณมา", { flag: "birthClue1" })),
    C("ถามคนเลี้ยงตรงๆ", (l, c) => { const p = l.people.find((x) => x.alive && (x.relation === "mother" || x.relation === "father")); if (p) { feel(p, { love: 5, trust: 5 }); return G(`${shortName(p)}นิ่งไปนาน แล้วเล่าทุกอย่างที่รู้ — ไม่มาก แต่พอเป็นจุดเริ่มต้น`, { flag: "birthClue1" })(l, c); } return N("ไม่มีใครเหลือให้ถาม — คุณต้องหาเอง", {})(l, c); }),
  ], { when: (l) => hasGoal(l, "birth") && !l.flags.birthClue1, weight: 12, maxTimes: 0, title: "ผ้าห่อตัว", prepare: (l): Ctx => { l.flags.birthOrigin ??= pick(l, ["noble", "cult", "enemy", "poor", "poor"]); return {}; } }),
  E("goal.birth_clue2", [14, 75], "หมอตำแยคนนั้นย้ายไปอยู่หมู่บ้านบนเขาที่ห่างไปสามวันเดินทาง — นางแก่มากแล้ว ว่ากันว่าความจำเริ่มเลือน", [
    P("เดินทางไปพบ", ab(0.55, "health"), G("นางจำลายปักบนผ้าได้ทันที น้ำตาไหล \"ข้านึกว่าเด็กคนนั้นตายไปแล้ว\"", { flag: "birthClue2", hp: -2 }), B("ระหว่างทางเจอโจร — คุณไปถึงช้าไปหนึ่งเดือน นางจากไปแล้ว แต่ทิ้งจดหมายไว้ให้หลานสาว", { flag: "birthClue2", hp: -6 })),
    C("ส่งจดหมายไปถาม", N("สามเดือนไม่มีคำตอบ — บางเรื่องต้องไปเอง", {})),
  ], { when: (l) => hasGoal(l, "birth") && !!l.flags.birthClue1 && !l.flags.birthClue2, weight: 12, maxTimes: 0, title: "หมอตำแย" }),
  E("goal.birth_truth", [15, 80], (l) => `ความจริงอยู่ตรงหน้าแล้ว — คุณคือ${ORIGINS[originOf(l)]}`, [
    C("ยอมรับความจริง แล้วใช้ชีวิตแบบที่เลือกเอง", (l, c) => { l.flags.birthTruth = true; return BIG("คุณพับจดหมายเก็บ — อดีตไม่ได้กำหนดว่าคุณต้องเป็นใคร", { joy: 6, iq: 1 })(l, c); }),
    C("ทวงคืนสิ่งที่เป็นของตระกูล", (l, c) => { l.flags.birthTruth = true; const o = originOf(l); if (o === "noble") { l.flags.fallenClanHeir = true; return BIG("คุณยื่นฎีกาขอล้างมลทินตระกูล — เส้นทางยาวไกล แต่ชื่อตระกูลกลับมามีเจ้าของอีกครั้ง", { fame: 5, goal: ["leader", "เพื่อกอบกู้เกียรติตระกูลที่ถูกพรากไป"] })(l, c); } if (o === "cult") { l.flags.cultBlood = true; return BIG("ลัทธิมารส่งคนมาเชิญคุณกลับ \"บ้าน\" — คุณยังไม่ตอบ แต่สายเลือดเรียกหา", { align: -3 })(l, c); } if (o === "enemy") return B("ตระกูลที่แท้จริงของคุณไม่ต้อนรับ — และคนที่เลี้ยงคุณมาเริ่มมองคุณด้วยสายตาหวาดระแวง", { joy: -6 })(l, c); return BIG("แม่ผู้ให้กำเนิดยังอยู่ — ผมขาวทั้งหัว นางกอดคุณแน่นจนหายใจไม่ออก", { joy: 10, meet: { rel: "mother", age: l.age + 22, gender: "f", bond: 70, tag: "birth_mother" } })(l, c); }),
    C("เก็บความลับนี้ไว้ ไม่บอกใคร", (l, c) => { l.flags.birthTruth = true; l.flags.birthSecret = true; return N("ความลับนี้จะตายไปพร้อมคุณ — หรือพร้อมลูกหลานที่บังเอิญไปเจอมันเข้า", { joy: -1 })(l, c); }),
  ], { when: (l) => hasGoal(l, "birth") && !!l.flags.birthClue2 && !l.flags.birthTruth, weight: 14, title: "ความจริง" }),

  // ───── คำสัตย์ ─────
  E("goal.oath_offer", [16, 70], (l) => `หลังพิธีสาบานใต้ต้นท้อ ${shortName(sworn(l)!)}พูดเบาๆ "ไม่ว่าอะไรจะเกิดขึ้น อย่าทิ้งข้านะ"`, [
    C("สัญญากับตัวเองว่าจะรักษาคำสาบานนี้ให้ได้", (l, c) => { addSideGoal(l, "oath", `คำสาบานกับ${shortName(sworn(l)!)}`, sworn(l)!.id); return G("คำพูดเบาๆ นั้นกลายเป็นสิ่งที่คุณจะแบกไปทั้งชีวิต", { align: 1 })(l, c); }),
    C("ยิ้มแล้วตบไหล่", N("คำสาบานยังอยู่ — แต่มันยังเป็นแค่คำพูด", {})),
  ], { when: (l) => !!sworn(l) && !hasGoal(l, "oath") && sideGoals(l).length < 2 && !l.flags.oathOffered, weight: 8, title: "คำสาบาน", prepare: (l): Ctx => { l.flags.oathOffered = true; return {}; } }),
  E("goal.oath_test", [16, 80], (l) => `${shortName(oathFriend(l)!)}${pick(l, ["ถูกใส่ร้ายว่าขโมยของสำนัก กำลังจะถูกลงโทษตัดมือ", "ติดหนี้บ่อนก้อนใหญ่ คนทวงหนี้ขู่จะฆ่าทั้งครอบครัว", "บาดเจ็บสาหัสจากการประลอง ต้องใช้ยาราคาแพง"])} — เขาส่งคนมาตามคุณกลางดึก`, [
    PAY("ทุ่มทุกอย่างช่วยเขา", 25, (l, c) => { l.flags.oathKept = Number(l.flags.oathKept ?? 0) + 1; const p = oathFriend(l); if (p) feel(p, { loyalty: 20, debt: 30, love: 10 }); return G("เงินเก็บหายไปเกือบหมด — แต่พี่น้องของคุณยังมีชีวิต และไม่มีวันลืม", { align: 2 })(l, c); }),
    P("ฝ่าวงล้อมไปช่วยด้วยตัวเอง", ab(0.45, "health", 0.5), (l, c) => { l.flags.oathKept = Number(l.flags.oathKept ?? 0) + 1; const p = oathFriend(l); if (p) feel(p, { loyalty: 25, love: 10 }); return G("คุณพาเขาออกมาได้ทั้งที่ตัวเองเลือดโชก — ยุทธภพเล่าเรื่องนี้ไปอีกหลายปี", { hp: -8, fame: 2 })(l, c); }, B("คุณไปไม่ทัน — แต่เขารู้ว่าคุณพยายาม", { hp: -10, wound: ["armL", "cut", 2] })),
    C("ไม่ไป — ครั้งนี้เสี่ยงเกินไป", (l, c) => { const g = goalOf(l, "oath"); if (g) g.end = "lost"; const p = oathFriend(l); if (p) { feel(p, { love: -30, trust: -40, grudge: 30 }); p.tags = (p.tags ?? []).filter((t) => t !== "sworn"); } return B("คำสาบานใต้ต้นท้อแตกสลายในคืนนั้น — เขาไม่เคยมองหน้าคุณอีกเลย", { align: -4, joy: -6 })(l, c); }),
  ], { when: (l) => hasGoal(l, "oath") && !!oathFriend(l)?.alive && Number(l.flags.oathKept ?? 0) < 2, weight: 9, maxTimes: 0, title: "คำสาบานถูกทดสอบ" }),

  // ───── ชดใช้บาป ─────
  E("goal.atone_offer", [22, 90], "คืนนี้คุณฝันถึงใบหน้าของคนที่ตายด้วยมือคุณอีกครั้ง — คราวนี้พวกเขาไม่ได้โกรธ แค่ยืนมองเงียบๆ", [
    C("ตั้งใจจะวางดาบ ชดใช้สิ่งที่ทำ", (l, c) => { setGoal(l, "atone", "เพราะเลือดบนมือเริ่มหนักเกินจะแบก"); return BIG("รุ่งเช้า คุณห่อกระบี่ด้วยผ้าขาวแล้วซ่อนไว้ใต้เตียง", { align: 2 })(l, c); }),
    C("ฝันก็คือฝัน", N("คุณดื่มสุราจนหลับไม่ฝัน — ได้แค่คืนนั้น", { joy: -2 })),
  ], { when: (l) => (Number(l.flags.mwKills ?? 0) >= 3 || alignment(l) <= -30) && !hasGoal(l, "atone") && !l.flags.goalWon_atone, weight: 6, maxTimes: 2, title: "ใบหน้าในฝัน" }),
  E("goal.atone_temptation", [22, 90], "นักเลงหัวไม้รู้ว่าคุณเลิกฆ่าคนแล้ว — มันถุยน้ำลายใส่รองเท้าคุณกลางตลาด แล้วตบหน้าลูกน้องของคุณต่อหน้า", [
    C("อดทน พาลูกน้องกลับบ้าน", G("คนทั้งตลาดเห็นคุณเดินจากไป — บางคนหัวเราะ บางคนเริ่มนับถือ", { align: 3, fame: -1 })),
    C("ปลิดชีพมันตรงนั้น", (l, c) => { const g = goalOf(l, "atone"); if (g) g.end = "lost"; l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1; l.flags.mwKillAge = l.age; return B("ดาบที่ซ่อนไว้ออกจากฝักเร็วกว่าความคิด — สองปีของการวางดาบจบลงในพริบตา", { align: -6, joy: -8 })(l, c); }),
    K("สั่งสอนโดยไม่ฆ่า", "health", 50, G("มันกลับบ้านพร้อมแขนเคล็ด — และไม่มีใครตาย", { align: 1 }), B("ยั้งมือไม่ทัน — มันล้มหัวฟาดพื้น รอดมาได้แต่พิการ", { align: -3 })),
  ], { when: (l) => hasGoal(l, "atone"), weight: 7, maxTimes: 2, title: "บททดสอบของคนวางดาบ" }),

  // ───── ล้างแค้น: ความจริงอาจเปลี่ยนเป้าหมาย ─────
  E("goal.revenge_truth", [14, 90], (l) => `ระหว่างตามรอย${shortName(l.people.find((p) => p.id === mainGoal(l)?.pid) ?? l.people[0])} คุณพบจดหมายเก่าที่บอกว่า${pick(l, ["คนในครอบครัวคุณเคยฆ่าพ่อของเขาก่อน", "เขาถูกจ้างให้ทำ — คนสั่งการตัวจริงยังลอยนวล", "เขาพยายามช่วยครอบครัวคุณในคืนนั้น แต่ไม่ทัน"])}`, [
    C("ให้อภัย ความแค้นจบที่รุ่นนี้", (l, c) => { const g = mainGoal(l); if (g) g.end = "changed"; const f = l.people.find((p) => p.id === g?.pid); if (f) feel(f, { grudge: -40, debt: 20 }); return BIG("คุณเผาจดหมายแล้วโปรยเถ้าลงแม่น้ำ — หนักที่สุดที่เคยแบก กลับเบาลงในพริบตา", { align: 4, joy: 6 })(l, c); }),
    C("ไม่สนใจ — เลือดต้องล้างด้วยเลือด", N("คุณขยำจดหมายทิ้ง ความแค้นที่เหลืออยู่ เย็นและแข็งกว่าเดิม", { align: -3 })),
    K("สืบต่อหาความจริงทั้งหมด", "smarts", 55, G("ภาพเริ่มชัดขึ้น — ศัตรูตัวจริงอาจไม่ใช่คนที่คุณตามล่ามาตลอด", { iq: 1, flag: "revengeTruthKnown" }), N("หลักฐานขาดตอน — คุณยังไม่แน่ใจอะไรเลย", {})),
  ], { when: (l) => { const g = mainGoal(l); return g?.id === "revenge" && g.step >= 1 && !l.flags.revengeTruthSeen; }, weight: 6, title: "จดหมายเก่า", prepare: (l): Ctx => { l.flags.revengeTruthSeen = true; return {}; } }),

  // ───── ชีวิตเสนอเป้าหมายใหม่ ─────
  E("goal.teach_offer", [42, 95], "คุณเห็นเด็กคนหนึ่งทำท่าที่คุณฝึกมาทั้งชีวิตผิดตั้งแต่ท่าแรก — แล้วนึกขึ้นได้ว่า ถ้าคุณตายพรุ่งนี้ วิชานี้จะหายไปกับคุณ", [
    C("ตั้งใจถ่ายทอดวิชาให้คนรุ่นหลัง", (l, c) => { addSideGoal(l, "teach", "เพราะสิ่งที่เรียนมาไม่ควรตายไปพร้อมตัว"); return G("คืนนั้นคุณเริ่มจดท่าแรกลงกระดาษ", { iq: 1 })(l, c); }),
    C("ไม่ใช่ตอนนี้", N("เด็กคนนั้นเดินจากไปพร้อมท่าที่ผิด", {})),
  ], { when: (l) => !!l.power && artsOf(l).length > 0 && !hasGoal(l, "teach") && !l.flags.goalWon_teach && sideGoals(l).length < 2, weight: 4, title: "วิชาที่จะสูญหาย" }),
  E("goal.sect_offer", [28, 85], "คนแปลกหน้าสามคนมาคุกเข่าหน้าบ้านขอเป็นศิษย์ในปีเดียวกัน — ทั้งที่คุณไม่เคยประกาศรับใคร", [
    C("ตั้งเป้าสร้างสำนักของตัวเอง", (l, c) => { setGoal(l, "sect", "เพราะคนที่มาคุกเข่าหน้าบ้านควรมีที่ให้อยู่"); return BIG("คุณเดินขึ้นเขาหลังเมืองไปยืนดูที่ดินว่างเปล่า — ที่นี่", {})(l, c); }),
    C("ให้เป็นเป้าหมายรอง", (l, c) => { addSideGoal(l, "sect", "สักวันหนึ่ง"); return G("ความคิดนั้นยังอยู่ — ไว้พร้อมกว่านี้ค่อยว่ากัน", {})(l, c); }, { show: (l) => sideGoals(l).length < 2 }),
    C("ไล่กลับไป", N("พวกเขากลับไปพร้อมความผิดหวัง", {})),
  ], { when: (l) => rank(l) >= 4 && !mySect(l) && !hasGoal(l, "sect") && !l.flags.goalWon_sect, weight: 5, title: "ผู้ขอเป็นศิษย์" }),
  E("goal.leader_offer", [25, 80], (l) => (l.mw?.era === "chaos" || l.mw?.era === "war" ? "แผ่นดินแตกเป็นเสี่ยง ผู้คนพูดถึงชื่อคุณในฐานะคนที่อาจรวมใจทุกคนได้ — แม่ทัพแก่คนหนึ่งคุกเข่าตรงหน้า \"ท่านควรเป็นผู้ปกครอง\"" : l.power?.guild === "cult" ? "ประมุขลัทธิแก่ชราและป่วยหนัก เสียงกระซิบในลัทธิบอกว่าคุณคือผู้ท้าชิงที่น่ากลัวที่สุด" : "ผู้อาวุโสในยุทธภพเริ่มพูดถึงคุณในฐานะคนที่ควรนำ ไม่ใช่ตาม"), [
    C("ใช่ — ข้าจะขึ้นไปให้ถึงที่สูงสุด", (l, c) => { l.flags.leaderPath = l.mw?.era === "chaos" || l.mw?.era === "war" ? "throne" : l.power?.guild === "cult" ? "demon" : "sect"; setGoal(l, "leader", "เพราะโอกาสแบบนี้มาแค่ครั้งเดียวในชีวิต"); return BIG("คุณรับคำคุกเข่านั้นไว้ — และรู้ว่าตั้งแต่วันนี้ ทุกคนจะจับตามอง", { fame: 2 })(l, c); }),
    C("ข้าไม่ต้องการบัลลังก์", G("คุณช่วยดึงแม่ทัพแก่ให้ลุกขึ้น — บางคนนับถือคุณมากขึ้นเพราะเหตุนี้", { align: 2 })),
  ], { when: (l) => l.fame >= 40 && rank(l) >= 3 && !hasGoal(l, "leader") && !l.flags.goalWon_leader, weight: 4, maxTimes: 2, title: "เสียงเรียก" }),
  E("goal.ascend_offer", [40, 200], "ลมปราณในตัวคุณเริ่มสั่นพ้องกับฟ้าดิน คืนหนึ่งคุณฝันถึงประตูสีขาวบนยอดเมฆ — มีคนรออยู่อีกฝั่ง", [
    C("มุ่งสู่ประตูนั้น", (l, c) => { setGoal(l, "ascend", "เพราะเหลือเพียงก้าวเดียวที่มนุษย์ไม่เคยก้าว"); return BIG("คุณเริ่มปลดวางทุกอย่างทีละน้อย — ทรัพย์สิน ตำแหน่ง ความแค้น", {})(l, c); }),
    C("ยังมีสิ่งที่ต้องทำบนโลกนี้", N("ประตูยังรออยู่ — มันไม่รีบ", {})),
  ], { when: (l) => rank(l) >= 7 && !hasGoal(l, "ascend") && !l.flags.ascended, weight: 10, maxTimes: 2, title: "ประตูบนยอดเมฆ" }),
  E("goal.birth_offer", [12, 60], "คำพูดที่ได้ยินวันนั้นวนอยู่ในหัวทุกคืน — ถ้าคุณไม่ใช่ลูกแท้ๆ แล้วพ่อแม่จริงอยู่ที่ไหน", [
    C("ออกตามหาความจริง", (l, c) => { if (mainGoal(l)) addSideGoal(l, "birth", "คำถามที่ไม่มีวันหายไป"); else setGoal(l, "birth", "คำถามที่ไม่มีวันหายไป"); return G("คุณเริ่มจากผ้าห่อตัวเก่าที่ท่านแม่เก็บไว้ในหีบ", {})(l, c); }),
    C("คนที่เลี้ยงข้ามาคือพ่อแม่ข้า", G("คุณกอดท่านแม่ไว้นาน นางไม่ถามว่าทำไม", { joy: 4 })),
  ], { when: (l) => !!l.flags.knowsAdopted && !hasGoal(l, "birth") && !l.flags.birthTruth, weight: 8, title: "ลูกของใคร" }),
  E("goal.side_offer", [18, 60], "ปีนี้ชีวิตเดินไปตามทางที่ตั้งใจ — แต่บางคืนคุณนึกถึงสิ่งอื่นที่อยากทำด้วย", [
    C("💰 เก็บเงินให้มากพอจะไม่ต้องกลัวอะไร", (l, c) => { addSideGoal(l, "wealth", "เผื่อวันที่ทุกอย่างพัง"); return G("คุณเริ่มแบ่งเงินใส่ไหฝังใต้ต้นท้อทุกเดือน", {})(l, c); }, { show: (l) => !hasGoal(l, "wealth") }),
    C("🏡 มีครอบครัวที่อบอุ่น", (l, c) => { addSideGoal(l, "family", "ชีวิตไม่ควรมีแต่เรื่องเดียว"); return G("คุณเริ่มมองคนรอบตัวต่างไปจากเดิม", {})(l, c); }, { show: (l) => !hasGoal(l, "family") }),
    C("🗺️ ไปให้ถึงสุดขอบแผ่นดินสักครั้ง", (l, c) => { addSideGoal(l, "wander", "ก่อนแก่เกินไป"); return G("คุณกางแผนที่เก่าบนโต๊ะ แล้วลากเส้นจากบ้านไปสุดทะเลทราย", {})(l, c); }, { show: (l) => !hasGoal(l, "wander") }),
    C("ไม่ต้องมีอะไรเพิ่ม", N("ทางเดียวก็พอแล้ว", {})),
  ], { when: (l) => !!mainGoal(l) && sideGoals(l).length === 0, weight: 3, maxTimes: 2, title: "อีกทางหนึ่ง" }),
];


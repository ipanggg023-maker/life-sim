// การหักหลังนอกวัง: เพื่อน สำนัก พี่น้องร่วมสาบาน นาย คู่ค้า · ทุกแบบมีราคาที่ตามมาทีหลัง
import type { Ctx, GameEvent } from "../../../engine/events";
import type { Life } from "../../../engine/types";
import { shortName } from "../../../engine/util";
import { B, C, E, G, K, N, P, ab, who, withPerson, type Res } from "../story/kit";
import { mySectFaction, shiftRep } from "../world/factions";
import { kingdoms, myLord } from "../world/war";
import { plantSeed } from "./seedStore";

const act = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });
const seed = (l: Life, c: Ctx) => { const p = who(l, c); if (p) plantSeed(l, "betrayed", shortName(p), p.id); };
const friend = withPerson(["friend"], (p) => p.bond >= 40);
const sworn = withPerson(["friend", "ally"], (p) => !!p.tags?.includes("sworn"));

export const BETRAYAL_EVENTS: GameEvent[] = [
  E("bt.friend", [16, 80], (l, c) => `${who(l, c) ? shortName(who(l, c)!) : "เพื่อนเก่า"}ชวนคุณร่วมปล้นคลังพ่อค้าเกลือ แบ่งคนละครึ่ง นายอำเภอกำลังตั้งรางวัลนำจับพวกโจรที่ทำงานนี้ด้วย`, [
    C("ร่วมมือกันจริงๆ", G("ทุกอย่างราบรื่น คุณได้เงิน และได้เพื่อนที่รู้ความลับของคุณ", { tael: 40, align: -3 })),
    P("ทำงานให้จบ แล้วหนีไปกับเงินทั้งหมด", ab(0.5, "smarts", 0.5), act(N("คุณหายไปก่อนรุ่งสางพร้อมถุงเงินทั้งสองถุง", { tael: 90, align: -6, feel: { grudge: 60, trust: -60 } }), seed), act(B("เขานอนไม่หลับเหมือนกัน เขารออยู่ที่ประตู", { hp: -10, feel: { grudge: 50 } }), seed), { tone: "danger" }),
    K("แจ้งนายอำเภอก่อนลงมือ รับรางวัล", "looks", 50, act(N("เพื่อนของคุณถูกจับคาคลังเกลือ เขาเงยหน้ามองคุณตอนถูกคุมตัวผ่านตลาด", { tael: 60, align: -5, feel: { grudge: 70, trust: -70 } }), seed), B("นายอำเภอหัวเราะ \"คนขายเพื่อน ข้าใช้ไม่ลง\" แล้วส่งข่าวไปถึงเขา", { fame: -3, feel: { grudge: 40 } })),
    C("ปฏิเสธ", N("คุณบอกว่าไม่ขอยุ่ง เขาตบไหล่คุณแล้วจากไป", { align: 2 })),
  ], { ...friend, weight: 3, title: "คลังเกลือ" }),

  E("bt.sworn", [18, 90], (l, c) => `มีคนเสนอตำแหน่งสูงให้คุณ แลกกับที่อยู่ของ${who(l, c) ? shortName(who(l, c)!) : "พี่น้องร่วมสาบาน"} พี่น้องที่กรีดเลือดดื่มเหล้าด้วยกัน เขากำลังถูกล่าและเชื่อใจคุณที่สุด`, [
    C("ส่งข่าวเตือนเขา", G("เขาหนีทันในคืนนั้น และเขียนไว้สั้นๆ ว่า \"ข้าจะไม่ลืม\"", { align: 6, joy: 3, feel: { love: 15, loyalty: 15 } })),
    P("ขายที่อยู่เขา แล้วทำเป็นไม่รู้เรื่อง", ab(0.45, "smarts", 0.6), act(N("คุณไปร่วมงานศพเขาในชุดขาว เงินรางวัลอยู่ในอกเสื้อ", { tael: 150, fame: 4, align: -14, joy: -8 }), (l, c) => { const p = who(l, c); if (p) { p.alive = false; plantSeed(l, "killed", shortName(p)); } }), act(B("เขารอดมาได้ และรู้ว่าใครบอก", { align: -10, feel: { grudge: 90, trust: -100 } }), seed), { tone: "danger" }),
    C("ไม่ทำอะไรเลย", N("คุณนั่งดื่มชาคนเดียว ปล่อยให้เรื่องเป็นไปตามทาง", { align: -2, joy: -3 })),
  ], { ...sworn, weight: 4, title: "ราคาของคำสาบาน" }),

  E("bt.sect", [16, 80], (l) => `ทูตจากสำนักคู่แข่งนัดคุณที่โรงน้ำชา เขาเลื่อนกล่องเงินมาตรงหน้า ขอแลกสำเนาคัมภีร์ชั้นในของ${mySectFaction(l)?.name ?? "สำนักคุณ"}`, [
    P("คัดลอกคัมภีร์ปลอมขายให้เขา", ab(0.45, "smarts", 0.6), G("เขาจ่ายเต็มราคาให้กระดาษที่คุณแต่งเอง ศิษย์ของเขาฝึกแล้วปวดท้องไปสามปี", { tael: 100, fame: 2 }), B("เขาตรวจออกทันที ตอนนี้มีคนอีกสำนักที่อยากฆ่าคุณ", { hp: -8 })),
    P("ขโมยของจริงให้เขา", ab(0.45, "luck", 0.6), act(N("คุณได้เงินก้อนใหญ่ และตั้งแต่วันนั้นคุณนอนหันหน้าเข้าประตู", { tael: 200, align: -10 }), (l) => { l.flags.tnMode ??= "dark"; const f = mySectFaction(l); if (f) shiftRep(l, f.id, -15); }), act(B("ผู้ดูแลหอคัมภีร์นับเล่มทุกคืน", { fame: -5, align: -6 }), (l) => { l.flags.tnHiding = true; l.flags.tnMode = "dark"; l.flags.tnSus = 3; }), { tone: "danger" }),
    C("นำเรื่องไปรายงานผู้อาวุโส", act(G("สำนักจับสายลับได้ทั้งกลุ่ม ชื่อคุณถูกอ่านในที่ประชุม", { fame: 4, align: 3 }), (l) => { const f = mySectFaction(l); if (f) shiftRep(l, f.id, 12); })),
  ], { when: (l) => !!mySectFaction(l), weight: 3, title: "กล่องเงินในโรงน้ำชา" }),

  E("bt.lord", [18, 80], (l) => `จดหมายลับจากแคว้นศัตรูมาถึงคุณ ถ้าเปิดประตูเมืองหรือส่งแผนทัพของ${myLord(l)?.lord ?? "นายของคุณ"} ตำแหน่งและที่ดินจะเป็นของคุณ`, [
    C("เผาจดหมาย", N("กระดาษไหม้หมดในครู่เดียว คุณไม่บอกใคร", { align: 2 })),
    P("แปรพักตร์ ส่งแผนทัพให้ข้าศึก", ab(0.45, "smarts", 0.6), act(N("ทัพของนายเก่าแตกที่ช่องเขา คุณเดินเข้าค่ายใหม่พร้อมของขวัญคือความพ่ายแพ้", { tael: 180, fame: 3, align: -14 }), (l) => { const k = kingdoms(l).filter((x) => x.id !== l.flags.lord).sort((a, b) => b.power - a.power)[0]; if (k) { l.flags.lord = k.id; l.flags.lordFavor = 35; } else delete l.flags.lord; l.flags.turncoatGeneral = true; }), B("จดหมายของคุณถูกดักได้กลางทาง นายของคุณอ่านแล้วเรียกคุณไปพบ", { hp: -12, fame: -8, align: -6 }), { tone: "danger" }),
    K("ซ้อนกล ส่งแผนปลอมไปลวงข้าศึก", "smarts", 60, G("ทัพข้าศึกเดินเข้าซุ่มทั้งกอง นายของคุณยกจอกให้คุณต่อหน้าทุกคน", { fame: 6, tael: 40 }), B("ข้าศึกรู้ทัน คุณเสียคนส่งข่าวไปหนึ่งคน", { joy: -3 })),
  ], { when: (l) => !!l.flags.lord && l.mw?.era === "war", weight: 5, maxTimes: 2, title: "จดหมายจากฝั่งตรงข้าม" }),

  E("bt.partner", [20, 80], (l, c) => `${who(l, c) ? shortName(who(l, c)!) : "คู่ค้า"}ฝากเงินกองทุนการค้าร่วมไว้ที่คุณระหว่างเดินทางไกล เงินก้อนนี้มากพอจะเริ่มชีวิตใหม่ในเมืองที่ไม่มีใครรู้จัก`, [
    C("เก็บไว้ให้ครบทุกตำลึง", G("เขากลับมาพร้อมของฝาก และเรียกคุณว่าคนเดียวที่เชื่อได้", { align: 4, feel: { trust: 20 } })),
    P("แต่งบัญชีปลอม ยักยอกไปครึ่งหนึ่ง", ab(0.5, "smarts", 0.6), N("ตัวเลขลงตัวทุกบรรทัด คุณรวยขึ้นและเขายังขอบคุณคุณ", { tael: 120, align: -6 }), act(B("เขานับเหรียญเองในคืนเดียว และทั้งตลาดรู้ก่อนเช้า", { fame: -6, align: -4, feel: { grudge: 60 } }), seed)),
  ], { ...withPerson(["friend", "ally"], (p) => p.bond >= 30), weight: 3, title: "เงินกองกลาง" }),
];

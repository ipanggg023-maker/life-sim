// ทางเข้าเส้นทางที่หายาก: ไม่บังคับ แค่ทำให้ประตูมีอยู่จริงสำหรับคนที่อยากเดิน
import { ACTIVITIES, type Activity } from "../../../engine/activities";
import type { Ctx, GameEvent } from "../../../engine/events";
import { runEvent } from "../../../engine/game";
import type { Life } from "../../../engine/types";
import { B, C, E, G, K, N, type Res } from "../story/kit";
import { mainGoal } from "./goals";

const M = (a: Omit<Activity, "world"> & { group: string }): Activity => ({ ...a, world: "murim" });
const fx = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign(((l: Life, c: Ctx) => { f(l, c); return r(l, c); }) as Res, { fx: r.fx });

/** สงครามสามแคว้น: เลือกนายได้ทุกเมื่อ แม้เคยปฏิเสธทูตไปแล้ว */
ACTIVITIES.push(M({
  group: "ยุทธภพ", id: "mw_join_lord", emoji: "🚩", name: "ไปรับใช้เจ้าแคว้น", desc: "เลือกนายในสงครามสามแคว้น", minAge: 16,
  available: (l) => l.mw?.era === "war" && !l.flags.lord && !l.flags.emperorSelf,
  run: (l) => { delete l.flags.refusedLords; runEvent(l, "mw.war.recruit"); return { text: "" }; },
}));

export const PATHWAY_EVENTS: GameEvent[] = [
  // พ่อค้าเข้าวังได้ด้วยสัญญาส่งของ
  E("rt.supplier", [20, 70], "สำนักพระคลังเปิดประมูลสัญญาส่งผ้าไหมเข้าวังหลวง ชื่อร้านของคุณอยู่ในรายชื่อพ่อค้าที่ได้รับเชิญ", [
    K("เสนอราคาด้วยบัญชีที่คำนวณมาแล้ว", "smarts", 50, fx(G("สัญญาเป็นของคุณ คุณมีสิทธิ์เดินผ่านประตูข้างของวังหลวงแล้ว", { fame: 2 }), (l) => { l.flags.palaceSupplier = true; }), N("พ่อค้าอีกเจ้ากดราคาต่ำกว่าคุณสองส่วน ปีหน้ายังมีประมูลอีก", {})),
    C("ไม่ยุ่งกับของหลวง", N("คุณขายของในตลาดต่อไป นอนหลับสบายกว่า", {})),
  ], { when: (l) => l.job?.careerId === "merchant" && l.job.level >= 3 && !l.flags.palaceSupplier, weight: 8, maxTimes: 3, title: "สัญญาของหลวง" }),

  // ทางเข้าราชการสำหรับคนที่ยังไม่เคยสอบ
  E("rt.clerk", [16, 45], "อำเภอขาดเสมียนกะทันหัน นายอำเภอเห็นคุณอ่านประกาศหน้าที่ว่าการออกเสียงได้ถูกทุกคำ \"เขียนหนังสือเป็นไหม ลองคัดฎีกานี้ให้ดูหน่อย\"", [
    K("คัดให้ดู", "smarts", 45, fx(G("ตัวหนังสือเรียบร้อยกว่าเสมียนคนเก่า คุณได้ตำแหน่งเสมียนอำเภอตั้งแต่พรุ่งนี้ นี่คือบันไดขั้นแรกสู่ราชการ", { iq: 1 }), (l) => { l.job = { careerId: "official", level: 1, performance: 50, years: 0 }; l.flags.rtClerk = true; }), B("น้ำหมึกเลอะทั้งแผ่น นายอำเภอหัวเราะแล้วโบกมือไล่", { joy: -2 })),
    C("ขอบคุณ แต่ไม่ใช่ทางของคุณ", N("คุณเดินผ่านหน้าที่ว่าการต่อไป", {})),
  ], { when: (l) => l.job?.careerId !== "official" && l.job?.careerId !== "disciple" && !l.flags.emperorSelf && l.flags.qnRank === undefined && !l.flags.rtClerk, weight: (l) => (mainGoal(l)?.id === "official" ? 20 : l.stats.smarts >= 55 ? 6 : 2), maxTimes: 2, title: "เสมียนอำเภอ" }),
];

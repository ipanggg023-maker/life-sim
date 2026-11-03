// คลาสที่สอง (สายรอง): พลังสายใหม่ตื่นขึ้นซ้อนกับสายเดิม — สกิลของสายรองปลดล็อกช้ากว่า 10 เลเวล
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import type { Life, LegacyWorld } from "../../engine/types";
import { addFame } from "../../engine/util";
import { CLASSES, classById, markTurn, offerClasses } from "../core/power";

const TEXT: Record<LegacyWorld, string> = {
  murim: "ระหว่างนั่งสมาธิ ลมปราณสองสายในร่างคุณไหลสวนทางกันแต่ไม่ปะทะ — ผู้อาวุโสบอกว่าร่างกายคุณรับวิชาที่สองได้",
};

const offered = (c: Ctx, id: string) => String(c.offer ?? "").split(",").includes(id);

export const DUAL_CLASS: GameEvent = {
  id: "dual.awaken",
  minAge: 14,
  maxAge: 70,
  weight: (l) => (l.power && l.power.level >= 20 && !l.flags.subClass ? 10 : 0),
  title: "พลังสายที่สอง",
  system: true,
  prepare: (l: Life) => {
    const mine = l.power!.hunterClass;
    const pool = [...offerClasses(l), ...CLASSES.filter((c) => (c.world ?? "hunter") === l.worldId).map((c) => c.id)];
    const offer = [...new Set(pool)].filter((id) => id !== mine).slice(0, 3);
    return { offer: offer.join(",") };
  },
  text: (l) => TEXT[(l.worldId ?? "hunter") as LegacyWorld],
  choices: [
    ...CLASSES.map((cls) => ({
      label: `${cls.emoji} รับสายรอง: ${cls.name} — ${cls.desc}`,
      show: (_l: Life, c: Ctx) => offered(c, cls.id),
      run: (l: Life): Outcome => {
        l.flags.subClass = cls.id;
        addFame(l, 6);
        markTurn(l);
        return { text: `⚡ คุณได้สายรอง「${classById(cls.id).name}」— ตอนนี้คุณใช้พลังได้สองสาย (สกิลสายรองปลดล็อกช้ากว่า 10 เลเวล)`, kind: "milestone" };
      },
    })),
    { label: "ไม่รับ — ขอทุ่มให้สายเดียว", run: (): Outcome => ({ text: "พลังสายที่สองค่อยๆ สลายไป คุณเลือกความบริสุทธิ์ของสายเดิม" }) },
  ],
};

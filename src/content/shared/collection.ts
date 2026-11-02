// M23 — ตู้สะสมของวิญญาณ: ของหายากที่เจอระหว่างใช้ชีวิต ติดตัววิญญาณข้ามชาติ ครบชุดได้โบนัสตอนเกิด
import { yearHooks } from "../../engine/game";
import { chance, pick } from "../../engine/rng";
import type { Life, StatKey, WorldId } from "../../engine/types";
import { addStat, log } from "../../engine/util";

export interface Collectible {
  id: string;
  world: WorldId;
  emoji: string;
  name: string;
}

const RAW: Record<WorldId, [string, string][]> = {
  murim: [["📜", "คัมภีร์ครึ่งเล่ม"], ["🍶", "จอกเหล้าของยอดฝีมือ"], ["🪭", "พัดเหล็กไร้เจ้าของ"], ["💊", "โอสถพันปี (ไม่กล้ากิน)"], ["🪨", "หินลับกระบี่จากยอดเขา"], ["🎐", "กระดิ่งลมของสำนักที่ล่มสลาย"], ["🧧", "ป้ายประกาศจับปลอม"], ["🀄", "หมากล้อมหยก"]],
};

export const COLLECTIBLES: Collectible[] = (Object.keys(RAW) as WorldId[]).flatMap((world) =>
  RAW[world].map(([emoji, name], i) => ({ id: `${world}_${i}`, world, emoji, name })),
);

/** โบนัสเมื่อครบชุดของโลกนั้น — ได้ตอนเกิดทุกชาติ */
export const SET_BONUS: Record<WorldId, { stat: StatKey; amount: number; label: string }> = {
  murim: { stat: "health", amount: 5, label: "สุขภาพ +5" },
};

/** ของที่เจอในชาตินี้ (เก็บใน flags) */
export const foundThisLife = (l: Life) => String(l.flags.found ?? "").split(",").filter(Boolean);
const owned = (l: Life) => new Set([...(l.ownedItems ?? []), ...foundThisLife(l)]);

export function completedSets(items: Iterable<string>): WorldId[] {
  const have = new Set(items);
  return (Object.keys(RAW) as WorldId[]).filter((w) => COLLECTIBLES.filter((c) => c.world === w).every((c) => have.has(c.id)));
}

/** หาของสะสมชิ้นใหม่ของโลกนี้ (ไม่ซ้ำกับที่วิญญาณมีแล้ว) — คืน undefined ถ้าครบแล้ว */
export function findCollectible(l: Life, how: string): Collectible | undefined {
  const have = owned(l);
  const pool = COLLECTIBLES.filter((c) => c.world === l.worldId && !have.has(c.id));
  if (!pool.length) return;
  const c = pick(l, pool);
  l.flags.found = [...foundThisLife(l), c.id].join(",");
  log(l, `🏺 ของสะสมใหม่: ${c.emoji} ${c.name} — ${how}`, "milestone");
  if (completedSets(owned(l)).includes(l.worldId) && !completedSets(l.ownedItems ?? []).includes(l.worldId)) {
    log(l, `✨ ตู้สะสมของโลกนี้ครบทั้งชุดแล้ว! ทุกชาติต่อจากนี้จะเกิดมาพร้อม ${SET_BONUS[l.worldId].label}`, "system");
  }
  return c;
}

const HOW = ["เจอวางทิ้งไว้ในที่ที่ไม่น่ามีใครมา", "คนแปลกหน้ายื่นให้แล้วเดินจากไปโดยไม่พูดอะไร", "ได้มาจากแผงของเก่าในราคาถูกเกินจริง", "มันอยู่ในกระเป๋าคุณตอนตื่นนอน ทั้งที่จำไม่ได้ว่าได้มาจากไหน"];

yearHooks.push((l) => {
  if (!l.alive || l.age < 6 || l.worldId === "murim") return; // ตู้สะสมข้ามชาติไม่มีในโลกสมจริง
  const p = 0.035 + (l.power ? 0.02 : 0) + (l.flags.collectBuy ? 0.03 : 0);
  if (chance(l, p)) findCollectible(l, pick(l, HOW));
  if (l.flags.collectBuy) {
    // ซื้อของสะสมหายาก (ปุ่มใช้เงินแบบไม่คิด) — ได้ของแน่ๆ ในปีนั้น
    delete l.flags.collectBuy;
    findCollectible(l, "ซื้อมาจากนักสะสมด้วยราคาที่ไม่ควรบอกใคร");
  }
});

/** โบนัสครบชุดตอนเกิด */
export function applySetBonus(l: Life, items: string[]) {
  for (const w of completedSets(items)) addStat(l, SET_BONUS[w].stat, SET_BONUS[w].amount);
}

// ผลรายปีของพรสวรรค์ยุทธภพ (แยกจาก gifts.ts เพื่อไม่ให้วงจร import กับ engine/game)
import { lifespanHooks, yearHooks } from "../../../engine/game";
import { clamp } from "../../../engine/util";
import { gift } from "./gifts";

// อายุขัยตามพรสวรรค์ (ร่างเซียน +20 · ร่างเก้าหยิน −6 …)
lifespanHooks.push((l) => gift(l, "lifespan"));

// ดาวสังหาร: ใจโหดขึ้นทีละน้อยทุกปี — เลือกทำดีได้ แต่ต้องฝืนธรรมชาติตัวเอง
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || l.age < 12) return;
  const d = gift(l, "dark");
  if (d > 0) l.flags.m17Align = clamp(Number(l.flags.m17Align ?? 0) - d, -100, 100);
});

// แจ้งความสำเร็จทันทีที่ทำได้ระหว่างชีวิต — แต้มวิญญาณยังให้ตอนจบชีวิตเหมือนเดิม
import { yearHooks } from "../../engine/game";
import { log } from "../../engine/util";
import { isRealistic } from "../worlds";
import { achievedNow } from "../achievements";

yearHooks.push((l) => {
  const shown = String(l.flags.achShown ?? "").split(",").filter(Boolean);
  const fresh = achievedNow(l).filter((a) => !shown.includes(a.id));
  if (!fresh.length) return;
  // โลกสมจริงไม่มีป้ายแจ้งความสำเร็จกลางชีวิต — สรุปให้ดูตอนจบชีวิตทีเดียว
  if (isRealistic(l.worldId)) return;
  for (const a of fresh) log(l, `🏆 ความสำเร็จ:「${a.name}」— ${a.desc} (+${a.points} แต้มวิญญาณเมื่อจบชีวิต ถ้ายังไม่เคยได้)`, "milestone");
  l.flags.achShown = [...shown, ...fresh.map((a) => a.id)].join(",");
});

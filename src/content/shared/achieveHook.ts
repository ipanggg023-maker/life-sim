// แจ้งความสำเร็จทันทีที่ทำได้ระหว่างชีวิต — แต้มวิญญาณยังให้ตอนจบชีวิตเหมือนเดิม
import { yearHooks } from "../../engine/game";
import { log } from "../../engine/util";
import { achievedNow } from "../achievements";

yearHooks.push((l) => {
  const shown = String(l.flags.achShown ?? "").split(",").filter(Boolean);
  const fresh = achievedNow(l).filter((a) => !shown.includes(a.id));
  if (!fresh.length) return;
  for (const a of fresh) log(l, `🏆 ความสำเร็จ「${a.name}」— ${a.desc} · +${a.points} แต้มวิญญาณ`, "milestone");
  l.flags.achShown = [...shown, ...fresh.map((a) => a.id)].join(",");
});

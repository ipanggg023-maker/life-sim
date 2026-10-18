// สกิลติดตัว: ตรวจทุกปีว่าได้อันใหม่ไหม และให้ผลรายปี (ความสุข/สุขภาพ)
import { yearHooks } from "../../engine/game";
import { addStat, log } from "../../engine/util";
import { PASSIVE_CAP, newPassives, passivesOf } from "../passives";
import { activeTalents } from "../talents";

yearHooks.push((l) => {
  const sum: Record<string, number> = {};
  for (const p of passivesOf(l)) for (const [k, v] of Object.entries(p.yearly ?? {})) sum[k] = (sum[k] ?? 0) + v;
  for (const [k, v] of Object.entries(sum)) addStat(l, k as keyof typeof l.stats, Math.min(PASSIVE_CAP.yearly, v));
  for (const t of activeTalents(l)) for (const [k, v] of Object.entries(t.y ?? {})) addStat(l, k as keyof typeof l.stats, v);
  for (const p of newPassives(l)) log(l, `ได้รับสกิลติดตัว「${p.emoji} ${p.name}」— ${p.desc}`, "system");
});

// สกิลติดตัว: ตรวจทุกปีว่าได้อันใหม่ไหม และให้ผลรายปี (ความสุข/สุขภาพ)
import { yearHooks } from "../../engine/game";
import { addStat, log } from "../../engine/util";
import { newPassives, passivesOf } from "../passives";

yearHooks.push((l) => {
  for (const p of passivesOf(l)) for (const [k, v] of Object.entries(p.yearly ?? {})) addStat(l, k as keyof typeof l.stats, v);
  for (const p of newPassives(l)) log(l, `ได้รับสกิลติดตัว「${p.emoji} ${p.name}」— ${p.desc}`, "system");
});

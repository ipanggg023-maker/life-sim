// สำนักที่มาคัดศิษย์ในถิ่นของคุณ — ไม่ใช่ทุกสำนักในใต้หล้าจะเดินทางมาถึงหมู่บ้านเดียวกัน
// ชีวิตหนึ่งเจอราวห้าหกสำนัก (สุ่มครั้งเดียวต่อชีวิต) ตัวเลือกในฉากรับศิษย์จะได้ไม่ยาวเป็นสิบปุ่ม
import { nextFloat, pick } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { guildsFor } from "../../hunter/power";

export function sectOffers(l: Life): Set<string> {
  const have = String(l.flags.sectOffers ?? "");
  if (have) return new Set(have.split(","));
  const ids = guildsFor({ worldId: "murim" }).map((g) => g.id).filter((id) => id !== "alliance");
  const big = pick(l, ["vajra", "cloud"].filter((id) => ids.includes(id)));
  const rest = ids.filter((id) => id !== big && id !== "beggar").map((id) => ({ id, k: nextFloat(l) })).sort((a, b) => a.k - b.k).slice(0, 4).map((x) => x.id);
  const set = [big, "beggar", ...rest].filter(Boolean);
  l.flags.sectOffers = set.join(",");
  return new Set(set);
}

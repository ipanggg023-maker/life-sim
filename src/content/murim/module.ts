// สิ่งที่ engine ถามจากยุทธภพ
import type { WorldModule } from "../../engine/worldModule";
import { convertOldTalents, gift, type GiftKey } from "./life/gifts";
import { recordDynasty } from "./life/dynasty";
import { birthplaceOf } from "./life/region";
import { ribbonOf } from "./life/ribbons";
import { applyRouteGifts, recordRoutes } from "./life/routes";
import { artById } from "./martial/arts";

export const MURIM_MODULE: WorldModule = {
  id: "murim",
  traits: { body: true, npcLife: true, hiddenTalents: true, repeatActs: true, surnameFirst: true, classicKinTerms: true },
  gift: (l, key) => gift(l, key as GiftKey),
  birthplace: birthplaceOf,
  // ค่าครองชีพยุคโบราณถูกกว่าค่าเช่าเมืองใหญ่ งานธรรมดาพอเลี้ยงครอบครัวได้
  livingCost: (_l, kids, income) => 35_000 + kids * 18_000 + Math.round(income * 0.25),
  marriageBlock: (l) => (l.job?.careerId === "monk" ? "คุณบวชอยู่ — ต้องสึกก่อนจึงจะแต่งงานได้ (ลาออกจากอาชีพ)" : undefined),
  migrate: convertOldTalents,
  onSoulRecord: (s, l) => {
    s.ribbons = [...new Set([...(s.ribbons ?? []), ribbonOf(l).id])];
    recordRoutes(s, l);
    recordDynasty(s, l);
  },
  onNewBirth: applyRouteGifts,
  isKnownArt: (id) => !!artById(id),
};

import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { allEvents, currentScene, eligibilityFilters } from "./events";
import { createLife } from "./game";
loadMurimWorld(); loadSharedEvents();
describe("ยุทธภพ: สกิลใช้ได้เฉพาะฉากที่เหมาะ", () => it("สกิลต่อสู้อยู่ในการต่อสู้ · ลอบเร้นในการลอบ · หนีในการหนี · ไม่มีในฉากที่ไม่เกี่ยว", () => {
  const l = createLife({ seed: 5, worldId: "murim" });
  l.age = 30;
  l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: ["กระบี่ลมพัดใบไผ่", "กระบี่พันเงา", "เข็มเงาเหมยฮวา", "เข็มทองฟื้นชีพ"], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  const where: Record<string, string[]> = {};
  for (const e of allEvents().filter((e) => (!e.world || e.world === "murim") && eligibilityFilters.every((f) => f(l, e)))) {
    for (const scene of ["start", ...Object.keys(e.scenes ?? {})]) {
      let s; try { s = currentScene({ eventId: e.id, ctx: { pid: "x" }, scene }, l); } catch { continue; }
      const extra = (s?.choices ?? []).filter((c) => typeof c.label === "string" && c.label.includes("ใช้「"));
      if (extra.length) { const base = (s?.choices ?? []).find((c) => c.skill && (c.odds || c.check)); where[e.id + "/" + scene] = [String(typeof base?.label === "string" ? base.label : "(duel)"), String(base?.skill)]; }
    }
  }
  const spots = Object.keys(where);
  for (const bad of ["mk.breakthrough", "rr.earthquake", "ft.qixi", "yt.t.dare", "ms.s.dawn_bell", "yt.t.first_love", "c.l.new_year"]) expect(spots.some((k) => k.startsWith(bad)), bad).toBe(false);
  for (const good of ["mw.war.battle", "cr.steal", "rk.challenge", "yt.m.wolf_attack", "dl.b.snake_bite"]) expect(spots.some((k) => k.startsWith(good)), good).toBe(true);
}));

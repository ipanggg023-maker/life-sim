import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { plansFor, setPlan } from "../content/murim/life/plan";
import { courtOf } from "../content/murim/world/court";
import { factions } from "../content/murim/world/factions";
import { worldOfLife } from "../content/murim/life/world";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("Murim Phase 6: สำนัก ราชสำนัก ตำนาน", () => {
  it("โลกเดินเอง: ฮ่องเต้เปลี่ยนรัชกาล สำนักขึ้นลง ราชโองการเกิด ข้อมูลไม่พัง", () => {
    const N = 120;
    let reigns = 0, falls = 0, edicts = 0, courtEv = 0, fxEv = 0, legendEv = 0, wars = 0;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 7717, worldId: "murim" });
      const r = { rng: s * 3 };
      worldOfLife(l);
      let guard = 0;
      while (l.alive && guard++ < 120) {
        drain(l, r);
        if (!l.alive) break;
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.3) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        const before = l.log.length;
        ageUp(l);
        edicts += l.log.slice(before).filter((e) => e.text.startsWith("📯")).length;
        wars += l.log.slice(before).filter((e) => e.text.startsWith("⚔️ ข่าวยุทธภพ")).length;
        for (const f of factions(l)) {
          expect(f.power >= 0 && f.power <= 100).toBe(true);
          expect(f.rep >= -100 && f.rep <= 100).toBe(true);
        }
      }
      drain(l, r);
      reigns += courtOf(l).reigns.length;
      falls += factions(l).filter((f) => f.status === "fallen").length;
      for (const [k, v] of Object.entries(l.seen)) {
        if (k.startsWith("ct.")) courtEv += v;
        if (k.startsWith("fx.")) fxEv += v;
        if (k.startsWith("lg.")) legendEv += v;
      }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM P6 เปลี่ยนรัชกาล", reigns, "| สำนักล่ม", falls, "| ราชโองการ", edicts, "| ศึกธรรมะ-มาร", wars, "| ฉากราชสำนัก", courtEv, "| ฉากสำนัก", fxEv, "| ฉากตำนาน", legendEv);
    expect(reigns).toBeGreaterThan(N * 0.3);
    expect(edicts).toBeGreaterThan(N * 0.3);
    expect(fxEv + courtEv).toBeGreaterThan(10);
  });
});

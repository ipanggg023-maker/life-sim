import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { syncThrone } from "../content/murim/world/emperor";
import { EMPRESS, empressOf, haremOf } from "../content/murim/world/harem";
import { ACTIVITIES } from "./activities";
import { labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson, relationLabel } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function emperor(seed: number, gender: "m" | "f" = "m") {
  const l = createLife({ seed, worldId: "murim", gender });
  worldOfLife(l);
  l.age = 30; l.stats.health = 90; l.stats.smarts = 70; l.stats.looks = 65; l.money = 3_000_000;
  courtOf(l);
  if (!l.people.some((p) => p.relation === "mother" && p.alive)) createPerson(l, "mother", { age: 52, gender: "f" });
  createPerson(l, "sibling", { age: 27, gender: "m", bond: 40 });
  createPerson(l, "spouse", { age: 28, gender: gender === "m" ? "f" : "m", bond: 70 });
  l.flags.emperorSelf = true;
  syncThrone(l);
  return l;
}
const act = (id: string) => ACTIVITIES.find((a) => a.id === id)!;
function drain(l: Life, r: { rng: number }, prefer?: string) {
  let g = 0;
  while (l.queue.length && g++ < 60) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const i = prefer ? o.findIndex((x) => String(labelOf(x.c, l, l.queue[0].ctx)).startsWith(prefer)) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("ราชวงศ์และวังหลังของฮ่องเต้", () => {
  it("ขึ้นครองราชย์แล้วครอบครัวได้พระอิสริยยศ คู่ชีวิตเป็นฮองเฮา", () => {
    const l = emperor(7);
    const mom = l.people.find((p) => p.relation === "mother" && p.alive)!;
    expect(relationLabel(mom, l)).toContain("ไทเฮา");
    expect(relationLabel(l.people.find((p) => p.relation === "sibling")!, l)).toContain("อ๋อง");
    const sp = l.people.find((p) => p.relation === "spouse")!;
    expect(relationLabel(sp, l)).toBe("ฮองเฮา");
    expect(empressOf(l)?.pid).toBe(sp.id);
    const f = emperor(8, "f");
    expect(relationLabel(f.people.find((p) => p.relation === "spouse")!, f)).toBe("พระราชสวามี");
  });

  it("คัดเลือก เสด็จ มีลูก เลื่อนขั้น ตำหนักเย็น และเรื่องในวังหลังเกิดจริง ไม่มีฉากตัน", () => {
    let births = 0, consorts = 0, seenH = 0, maleConsorts = 0;
    for (let s = 1; s <= 24; s++) {
      const l = emperor(100 + s * 13, s % 3 === 0 ? "f" : "m");
      const r = { rng: s };
      const kids0 = l.people.filter((p) => p.relation === "child").length;
      for (let y = 0; y < 16 && l.alive && l.flags.emperorSelf; y++) {
        l.stats.health = Math.max(l.stats.health, 70);
        if (y % 2 === 0) { act("mw_h_select").run(l); drain(l, r); }
        if (act("mw_h_night").available!(l)) { act("mw_h_night").run(l); drain(l, r); }
        if (y % 3 === 1) { act("mw_h_ranks").run(l); drain(l, r); }
        if (act("mw_audience").available!(l)) { act("mw_audience").run(l); drain(l, r); }
        drain(l, r);
        ageUp(l);
        drain(l, r);
        expect(validateLife(l)).toEqual([]);
        expect(haremOf(l).filter((c) => c.rank === EMPRESS && !c.cold).length).toBeLessThanOrEqual(1);
      }
      births += l.people.filter((p) => p.relation === "child").length - kids0;
      consorts += haremOf(l).length;
      maleConsorts += haremOf(l).filter((c) => l.people.find((p) => p.id === c.pid)!.gender === "m").length;
      seenH += Object.keys(l.seen).filter((k) => /^ct\.(h|f)_/.test(k) && !["ct.h_select", "ct.h_night", "ct.h_ranks"].includes(k)).length;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM harem", { births, consorts, maleConsorts, seenH });
    expect(births).toBeGreaterThan(15);
    expect(consorts).toBeGreaterThan(40);
    expect(maleConsorts).toBeGreaterThan(5);
    expect(seenH).toBeGreaterThan(20);
  });

  it("เสียบัลลังก์แล้วพระอิสริยยศหาย สนมที่คัดเข้าวังแยกย้าย", () => {
    const l = emperor(55);
    act("mw_h_select").run(l); drain(l, { rng: 1 }, "สาวงาม");
    expect(haremOf(l).length).toBeGreaterThanOrEqual(2);
    delete l.flags.emperorSelf;
    ageUp(l);
    expect(l.mw!.harem).toBeUndefined();
    expect(l.people.some((p) => p.tags?.some((t) => t.startsWith("title:")))).toBe(false);
    expect(l.people.filter((p) => p.relation === "spouse" && p.alive).length).toBe(1);
  });
});

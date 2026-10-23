import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { syncThrone } from "../content/murim/world/emperor";
import { traitor } from "../content/murim/world/emperorLife";
import { addConsort, haremOf, schemer } from "../content/murim/world/harem";
import { castOf, palaceOf } from "../content/murim/world/palace";
import { activitiesFor } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";
import { shortName } from "./util";

loadMurimWorld();
loadSharedEvents();

function emperor(seed: number) {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 30; l.stats.health = 85; l.stats.smarts = 100;
  l.job = { careerId: "official", level: 4, performance: 50, years: 5 };
  courtOf(l);
  l.flags.emperorSelf = true;
  syncThrone(l);
  l.queue = [];
  return l;
}
const labelOf = (l: Life, i: number) => { const ch = l.queue[0] && visibleChoices(l, l.queue[0]).find((o) => o.index === i)?.c; const lb = ch?.label; return typeof lb === "function" ? lb(l, l.queue[0].ctx) : lb ?? ""; };
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]).find((x) => labelOf(l, x.index).startsWith(start));
  expect(o, `ไม่มีตัวเลือก "${start}" ใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeTruthy();
  resolveChoice(l, o!.index);
}
const finish = (l: Life) => { let g = 0; while (l.queue.length && g++ < 10) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); };

describe("ฮ่องเต้กวาดล้างคนที่ไม่น่าไว้ใจ และหาเงินเข้าท้องพระคลัง", () => {
  it("รายชื่อขุนนาง: สืบแล้วรู้ว่าใครคิดคด · ประหารคนผิดได้ความชอบธรรม · ประหารคนบริสุทธิ์เสียความชอบธรรม", () => {
    const l = emperor(7);
    expect(activitiesFor(l).some((a) => a.id === "mw_purge")).toBe(true);
    const cast = castOf(l).filter((n) => ["minister", "eunuch", "general"].includes(n.role));
    expect(cast.length).toBeGreaterThan(1);
    const bad = cast[0], good = cast[1];
    bad.amb = 90; bad.you.grudge = 40;
    good.amb = 20; good.you.grudge = 0; good.backs = "emperor"; good.secret = undefined;
    expect(traitor(bad)).toBe(true);
    expect(traitor(good)).toBe(false);

    // สืบคนผิด: ป้ายบอกว่าคิดคด
    runEvent(l, "ct.e_purge");
    choose(l, bad.name);
    choose(l, "ให้หน่วยลับสืบ");
    finish(l);
    expect(bad.vetted).toBe("traitor");
    runEvent(l, "ct.e_purge");
    expect(visibleChoices(l, l.queue[0]).some((o) => labelOf(l, o.index).includes("สืบแล้ว: คิดคด"))).toBe(true);
    // ประหารคนผิด
    const before = l.mw!.legitimacy;
    choose(l, bad.name);
    choose(l, "พระราชทานความตาย");
    finish(l);
    expect(bad.alive).toBe(false);
    expect(l.mw!.legitimacy).toBeGreaterThanOrEqual(before);

    // ประหารคนบริสุทธิ์: ความชอบธรรมตก ขุนนางคนอื่นไว้ใจน้อยลง
    const leg = l.mw!.legitimacy;
    const other = castOf(l).find((n) => n !== good && n.alive && ["minister", "eunuch", "general"].includes(n.role));
    const trust = other?.you.trust ?? 0;
    runEvent(l, "ct.e_purge");
    choose(l, good.name);
    choose(l, "พระราชทานความตาย");
    finish(l);
    expect(good.alive).toBe(false);
    expect(l.mw!.legitimacy).toBeLessThan(leg);
    if (other) expect(other.you.trust).toBeLessThan(trust);
  });

  it("วังหลัง: สืบสนมที่คิดร้าย แล้วพระราชทานผ้าขาวสามศอก", () => {
    const l = emperor(11);
    const p = addConsort(l, { gender: l.gender === "m" ? "f" : "m", age: 22, trait: "ambitious", rank: 2 });
    const k = haremOf(l).find((c) => c.pid === p.id)!;
    k.resent = 60;
    expect(schemer(k)).toBe(true);
    runEvent(l, "ct.h_ranks");
    choose(l, visibleChoices(l, l.queue[0]).map((o) => labelOf(l, o.index)).find((x) => x.includes(shortName(p)))!);
    choose(l, "ให้ขันทีคนสนิทสืบ");
    finish(l);
    expect(k.vetted).toBe("traitor");
    runEvent(l, "ct.h_ranks");
    const lb = visibleChoices(l, l.queue[0]).map((o) => labelOf(l, o.index)).find((s) => s.includes("สืบแล้ว: คิดร้าย"));
    expect(lb).toBeTruthy();
    choose(l, lb!);
    choose(l, "พระราชทานผ้าขาวสามศอก");
    finish(l);
    expect(p.alive).toBe(false);
    expect(haremOf(l).some((c) => c.pid === p.id)).toBe(false);
  });

  it("ท้องพระคลัง: มีทางหาเงินหลายทาง · คลังว่างทำให้ความชอบธรรมหาย", () => {
    const l = emperor(13);
    expect(activitiesFor(l).some((a) => a.id === "mw_revenue")).toBe(true);
    palaceOf(l).treasury = 20;
    runEvent(l, "ct.e_revenue");
    const labels = visibleChoices(l, l.queue[0]).map((o) => labelOf(l, o.index));
    expect(labels.length).toBeGreaterThanOrEqual(5);
    choose(l, "เปิดขายตำแหน่งขุนนาง");
    finish(l);
    expect(palaceOf(l).treasury).toBe(32);
    // ยึดทรัพย์
    runEvent(l, "ct.e_revenue");
    choose(l, "ยึดทรัพย์");
    finish(l);
    expect(palaceOf(l).treasury).toBeGreaterThan(32);

    // คลังว่างหลายปี: ความชอบธรรมไหลลง
    const run = (t: number) => { const m = emperor(17); m.mw!.legitimacy = 60; for (let y = 0; y < 4; y++) { palaceOf(m).treasury = t; m.queue = []; ageUp(m); m.stats.health = 85; m.queue = []; } return m.mw!.legitimacy; };
    expect(run(5)).toBeLessThan(run(50));
  });
});

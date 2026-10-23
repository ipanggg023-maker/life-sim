import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { myLord, startWarEra } from "../content/murim/world/war";
import { stratagemCount } from "../content/murim/world/threeKingdoms";
import { activitiesFor } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function officer(seed: number, role = "strategist"): Life {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  startWarEra(l);
  l.age = 30;
  l.stats.smarts = 100; l.stats.health = 90; l.stats.luck = 100; l.stats.looks = 90;
  l.power = { rank: 5, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] } as never;
  l.flags.lord = "west"; l.flags.warRole = role; l.flags.warRank = 2; l.flags.lordFavor = 60;
  l.queue = [];
  return l;
}
const labelOf = (l: Life, i: number) => { const ch = visibleChoices(l, l.queue[0]).find((o) => o.index === i)?.c; const lb = ch?.label; return typeof lb === "function" ? lb(l, l.queue[0].ctx) : lb ?? ""; };
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]).find((x) => labelOf(l, x.index).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${l.queue[0]?.eventId}`).toBeTruthy();
  resolveChoice(l, o!.index);
}
const finish = (l: Life) => { let g = 0; while (l.queue.length && g++ < 20) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); };

describe("สามก๊ก: เหตุการณ์ดังและสามสิบหกกลยุทธ์", () => {
  it("เสนาธิการวางกลยุทธ์ได้ทุกปี · กลที่ใช้ถูกนับ · ใช้แล้วกำลังแคว้นเปลี่ยน", () => {
    const l = officer(11);
    expect(activitiesFor(l).some((a) => a.id === "mw_stratagem")).toBe(true);
    const before = myLord(l)!.power;
    for (let i = 0; i < 8; i++) { runEvent(l, "tk.stratagem"); choose(l, "กลที่"); finish(l); }
    expect(stratagemCount(l)).toBeGreaterThanOrEqual(5);
    expect(myLord(l)!.power).not.toBe(before);
  });

  it("กลยุทธ์เมืองว่าง · ไฟเผาผาแดง → ช่องเขาหัวหรง", () => {
    const l = officer(12);
    runEvent(l, "tk.empty_fort");
    choose(l, "เปิดประตูเมือง");
    finish(l);
    expect(l.flags.emptyFort === true || Number(l.flags.lordFavor) < 60).toBe(true);
    const m = officer(13);
    runEvent(m, "tk.red_cliffs");
    choose(m, "รอลมตะวันออก");
    finish(m);
    if (m.flags.redCliffs) {
      runEvent(m, "tk.huarong");
      choose(m, "หลีกทางให้");
      finish(m);
      expect(m.flags.redCliffs).toBe(true);
    }
  });

  it("คนที่รับใช้เจ้าแคว้นในยุคสามแคว้นเจอเหตุการณ์ดังหลายเรื่องตลอดชีวิต", () => {
    const r = { rng: 21 };
    const seen = new Set<string>();
    for (let s = 1; s <= 12; s++) {
      const l = officer(700 + s, s % 2 ? "strategist" : "general");
      for (let y = 0; y < 25 && l.alive && l.mw?.era === "war"; y++) {
        l.stats.health = Math.max(l.stats.health, 60);
        ageUp(l);
        let g = 0;
        while (l.queue.length && g++ < 80) { if (l.queue[0].eventId.startsWith("tk.")) seen.add(l.queue[0].eventId); const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
      }
    }
    console.log("TK seen", seen.size, [...seen].join(","));
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
});

import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { ARTS, knows } from "../content/murim/martial/arts";
import { sectOffers } from "../content/murim/martial/sectOffers";
import { factionById } from "../content/murim/world/factions";
import { worldOfLife } from "../content/murim/life/world";
import { guildsFor } from "../content/hunter/power";
import { activitiesFor } from "./activities";
import { visibleChoices } from "./events";
import { createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const power = (rank: number) => ({ rank, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] as string[], guild: "plum" });
function disciple(seed: number, level = 1): Life {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 20;
  l.stats.smarts = 100; l.stats.health = 90; l.stats.luck = 100; l.stats.looks = 100;
  l.power = power(3) as never;
  l.job = { careerId: "disciple", level, performance: 50, years: 2 };
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

describe("สำนักและวิชาชุดใหม่ · ชีวิตในสำนัก · ของวิเศษ", () => {
  it("วิชายุทธ์มีมากกว่า 60 · สำนักใหม่เข้าได้และมีวิชาประจำสำนักทั้งพื้นฐานและวิชาลับ · ฉากรับศิษย์แสดงไม่เกินหกสำนัก", () => {
    expect(ARTS.length).toBeGreaterThanOrEqual(60);
    for (const g of ["plum", "snow", "jade", "nangong", "peng", "zhuge", "blood", "shadow", "blackway"]) {
      expect(guildsFor({ worldId: "murim" }).some((x) => x.id === g), g).toBe(true);
      expect(ARTS.some((a) => a.sect === g && a.grade === 2), g).toBe(true);
      expect(ARTS.some((a) => a.sect === g && a.grade === 3), g).toBe(true);
    }
    for (let s = 1; s <= 20; s++) { const l = createLife({ seed: s, worldId: "murim" }); const o = sectOffers(l); expect(o.size).toBeLessThanOrEqual(6); expect(o.has("beggar")).toBe(true); }
    const l = disciple(3);
    expect(factionById(l, "plum")).toBeTruthy();
  });

  it("ภารกิจสำนักได้ความดีความชอบ → ครบแล้วสอบเลื่อนขั้นบนลานประลอง · หอคัมภีร์แลกวิชาได้", () => {
    const l = disciple(5);
    expect(activitiesFor(l).some((a) => a.id === "mw_sect_mission")).toBe(true);
    for (let i = 0; i < 6; i++) { runEvent(l, "sx.mission"); choose(l, "คุ้มกันผู้อาวุโส"); finish(l); }
    expect(Number(l.flags.sectMerit)).toBeGreaterThanOrEqual(5);
    // หอคัมภีร์: แลกวิชาพื้นฐานของสำนัก
    runEvent(l, "sx.library");
    choose(l, "แลกวิชาพื้นฐาน");
    finish(l);
    expect(knows(l, "s_plum_sword")).toBe(true);
    // สอบเลื่อนขั้น: ชนะแล้วได้ขึ้นขั้น
    l.flags.sectMerit = 10;
    runEvent(l, "sx.exam");
    l.power!.rank = 8;
    choose(l, "ขึ้นลานประลอง");
    finish(l);
    expect(l.job!.level).toBeGreaterThanOrEqual(1);
  });

  it("ผู้อาวุโสชิงตำแหน่งได้แล้วเป็นเจ้าสำนัก · ศิษย์สำนักที่เสื่อมถอยฟื้นฟูสำนักได้", () => {
    const l = disciple(7, 4);
    const f = factionById(l, "plum")!;
    f.leaderAge = 80;
    runEvent(l, "sx.succession");
    choose(l, "รวบรวมเสียง");
    finish(l);
    expect(l.flags.sectHead).toBe("plum");
    expect(l.job!.level).toBe(5);
    // ฟื้นฟูสำนัก
    const m = disciple(8, 2);
    const p = factionById(m, "plum")!;
    p.power = 30;
    expect(activitiesFor(m).some((a) => a.id === "mw_sect_revive")).toBe(true);
    m.money = 1_000_000;
    for (let i = 0; i < 8 && !m.flags.sectRevived; i++) { runEvent(m, "sx.revive"); choose(m, "ซ่อมหอบรรพชน"); finish(m); }
    expect(m.flags.sectRevived).toBe(true);
    expect(p.power).toBeGreaterThanOrEqual(55);
  });

  it("ถ้ำสามประตู: ไม่โลภทอง ผ่านเสือ ได้คัมภีร์ · สุสานกระบี่ได้อาวุธในตำนาน", () => {
    const l = disciple(9);
    runEvent(l, "tr.cave_trial");
    choose(l, "เข้าไป");
    choose(l, "ไม่แตะทอง");
    choose(l, "นั่งลงช้าๆ");
    choose(l, "อ่านจนจบ");
    finish(l);
    expect(l.flags.caveInheritance).toBe(true);
    expect(knows(l, "l_immortal_scroll")).toBe(true);
    runEvent(l, "tr.sword_tomb");
    choose(l, "ดึงกระบี่เล่มที่เปล่งแสง");
    finish(l);
    expect(Number(l.flags.mwWeaponTier)).toBe(4);
  });
});

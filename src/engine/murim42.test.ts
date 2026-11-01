import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { factionById, mySectFaction } from "../content/murim/world/factions";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function member(seed: number, guild: string, align: number, age = 25): Life {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.money = 500_000; l.queue = [];
  l.stats.smarts = 95; l.stats.health = 90; l.stats.luck = 95; l.stats.looks = 90;
  l.power = { rank: 3, hunterClass: "m_sword", level: 20, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [], guild } as never;
  l.flags.m17Align = align;
  return l;
}
const labelOf = (l: Life, i: number) => { const ch = visibleChoices(l, l.queue[0]).find((o) => o.index === i)?.c; const lb = ch?.label; return typeof lb === "function" ? lb(l, l.queue[0].ctx) : lb ?? ""; };
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]).find((x) => labelOf(l, x.index).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${l.queue[0]?.eventId}/${l.queue[0]?.scene ?? ""}`).toBeTruthy();
  resolveChoice(l, o!.index);
}

describe("คนทรยศ: ธรรมะตกสู่มาร และมารกลับใจ", () => {
  it("ปิดบัง → ความสงสัยครบแล้วถูกไต่สวน → ยอมชำระล้าง เสียฝีมือแต่ยังอยู่สำนัก", () => {
    const l = member(1, "cloud", -30);
    expect(getEvent("tn.fall")!.when!(l)).toBe(true);
    runEvent(l, "tn.fall");
    choose(l, "ปิดบังไว้");
    expect(l.flags.tnHiding).toBe(true);
    expect(getEvent("tn.trial")!.when!(l)).toBe(false);
    l.flags.tnSus = 3;
    expect(getEvent("tn.trial")!.when!(l)).toBe(true);
    runEvent(l, "tn.trial");
    choose(l, "ยอมรับทุกข้อหา");
    expect(l.queue[0].scene).toBe("verdict");
    choose(l, "ยอมรับโทษ");
    expect(l.power!.rank).toBe(2);
    expect(l.power!.guild).toBe("cloud");
    expect(l.flags.tnHiding).toBeUndefined();
    expect(Number(l.flags.m17Align)).toBeGreaterThanOrEqual(-5);
  });

  it("หนีออกจากสำนัก → ถูกล่า → ศิษย์น้องมาคนสุดท้าย แล้วการล่าจบได้ · กลับใจแล้วขอกลับสำนักได้", () => {
    const l = member(2, "cloud", -30);
    runEvent(l, "tn.fall");
    choose(l, "ลงจากภูเขา");
    expect(mySectFaction(l)).toBeUndefined();
    expect(l.flags.tnHuntBy).toBeTruthy();
    expect(getEvent("tn.hunt")!.when!(l)).toBe(true);
    expect(getEvent("tn.hunt_last")!.when!(l)).toBe(false);
    l.seen["tn.hunt"] = 2;
    runEvent(l, "tn.hunt_last");
    choose(l, "ยืนนิ่ง");
    expect(l.flags.tnHuntBy).toBeUndefined();
    l.flags.tnMode = "dark"; l.flags.m17Align = 20;
    expect(getEvent("tn.return")!.when!(l)).toBe(true);
  });

  it("มารกลับใจแอบปล่อยชาวบ้าน · หนีออกมาแล้วขอเข้าฝ่ายธรรมะได้", () => {
    const l = member(3, "cult", 15);
    expect(getEvent("tn.light")!.when!(l)).toBe(true);
    runEvent(l, "tn.light");
    choose(l, "ทิ้งคบไฟ");
    expect(mySectFaction(l)).toBeUndefined();
    delete l.flags.tnHuntBy;
    expect(getEvent("tn.asylum")!.when!(l)).toBe(true);
    runEvent(l, "tn.asylum");
    expect(visibleChoices(l, l.queue[0]).length).toBe(2);
  });

  it("เจ้าสำนักตกเป็นมาร: ทั้งสำนักเปลี่ยนฝ่ายจริง และผู้อาวุโสก่อรัฐประหาร", () => {
    const l = member(4, "cloud", -30, 50);
    l.flags.sectHead = "cloud";
    expect(getEvent("tn.fall")!.when!(l)).toBe(false);
    runEvent(l, "tn.head_dark");
    choose(l, "ประกาศทางใหม่");
    expect(factionById(l, "cloud")!.side).toBe("demonic");
    expect(getEvent("tn.head_coup")!.when!(l)).toBe(true);
    runEvent(l, "tn.head_coup");
    choose(l, "สละตำแหน่ง");
    expect(l.flags.sectHead).toBeUndefined();
    expect(mySectFaction(l)).toBeUndefined();
  });

  it("เล่นสุ่มแล้วไม่ค้าง และเรื่องนี้เกิดจริงกับศิษย์ที่ทำชั่ว", () => {
    const r = { rng: 9 };
    const seen = new Set<string>();
    for (let s = 1; s <= 90; s++) {
      const l = member(100 + s, s % 3 ? "cloud" : "cult", s % 3 ? -25 : 15, 20);
      for (let y = 0; y < 30 && l.alive; y++) {
        l.stats.health = Math.max(l.stats.health, 60);
        ageUp(l);
        let g = 0;
        while (l.queue.length && g++ < 80) {
          if (l.queue[0].eventId.startsWith("tn.")) seen.add(l.queue[0].eventId);
          const o = visibleChoices(l, l.queue[0]);
          expect(o.length, l.queue[0].eventId).toBeGreaterThan(0);
          resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
        }
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

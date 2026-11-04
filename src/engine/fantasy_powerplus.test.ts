import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { personaOf } from "../content/fantasy/persona";
import { combat, deathOdds, needXp, powerParts } from "../content/fantasy/power";
import { ASPECTS, aspectsOf, vowOf } from "../content/fantasy/powerplus";
import { fl } from "../content/fantasy/state";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const pickLabel = (l: Life, start: string) => { const o = visibleChoices(l, l.queue[0]).find((x) => String(x.c.label).startsWith(start)); expect(o, start).toBeTruthy(); resolveChoice(l, o!.index); };

describe("พลังจากตัวตน", () => {
  it("พลังต่อสู้คือผลรวมของที่มาทุกอย่าง", () => {
    const l = life(3);
    fl(l).bodyRank = 2; fl(l).weapon = { name: "ดาบ", quality: 3 };
    expect(combat(l)).toBe(Math.round(powerParts(l).reduce((s, [, v]) => s + v, 0)));
    expect(powerParts(l).some(([k]) => k === "อาวุธและเกราะ")).toBe(true);
  });
  it("นิสัยที่เด่นปลุกแง่มุมของพลัง ทั้งพลังต่อสู้และความปลอดภัย", () => {
    const l = life(4);
    fl(l).bodyRank = 2;
    const c0 = combat(l), d0 = deathOdds(l, 60);
    personaOf(l).c = 60;
    expect(aspectsOf(l).map((a) => a.name)).toContain("ใจสิงห์");
    expect(combat(l)).toBeGreaterThan(c0);
    personaOf(l).c = -60;
    expect(deathOdds(l, 60)).toBeLessThan(d0);
    expect(ASPECTS.length).toBe(8);
  });
  it("ตั้งปณิธานได้ถ้านิสัยไม่ขัด และทางเลือกที่ขัดทำลายมัน", () => {
    const l = life(5);
    personaOf(l).m = -30;
    expect(activityLocked(l, ACTIVITIES.find((a) => a.id === "ft_vow")!)).toBeUndefined();
    doActivity(l, "ft_vow");
    // นิสัยไปทางตรงข้าม: กดตั้งปณิธานนี้ไม่ได้
    expect(visibleChoices(l, l.queue[0]).some((x) => String(x.c.label).startsWith("ปณิธานไม่พรากชีวิต"))).toBe(false);
    l.queue = []; l.doneThisYear = []; personaOf(l).m = 10;
    doActivity(l, "ft_vow");
    pickLabel(l, "ปณิธานไม่พรากชีวิต");
    expect(vowOf(l)?.id).toBe("no_kill");
    runEvent(l, "ft.l.crime");
    resolveChoice(l, 2);
    expect(vowOf(l)).toBeUndefined();
    expect(fl(l).vowBroke?.id).toBe("no_kill");
  });
  it("คนกล้ามีทางทะลวงขั้นของตัวเอง", () => {
    const l = life(6);
    const f = fl(l); f.bodyRank = 1; f.body = needXp(1); f.bstars = 8; personaOf(l).c = 60;
    runEvent(l, "ft.break_body");
    const way = visibleChoices(l, l.queue[0]).find((x) => String(x.c.label).startsWith("สู้กับเงา"));
    expect(way).toBeTruthy();
    personaOf(l).c = 0;
    expect(visibleChoices(l, l.queue[0]).some((x) => String(x.c.label).startsWith("สู้กับเงา"))).toBe(false);
  });
  it("ถึงขั้นสามแล้วเกิดท่าประจำตัวที่ตั้งชื่อตามนิสัย", () => {
    const l = life(7);
    fl(l).bodyRank = 3; personaOf(l).m = 70;
    ageUp(l);
    expect(fl(l).signature?.name).toContain("พิทักษ์");
    expect(powerParts(l).some(([k]) => k === fl(l).signature!.name)).toBe(true);
  });
  it("รักษาปณิธานครบสิบปีเป็นผลงาน", () => {
    const l = life(8, 30);
    fl(l).vow = { id: "no_lie", age: 20 };
    l.queue = [];
    ageUp(l);
    expect(fl(l).deeds.some((d) => d.includes("ปณิธานไม่โกหก"))).toBe(false);
    fl(l).vow = { id: "no_lie", age: 21 };
    l.age = 30; l.queue = []; ageUp(l);
    expect(fl(l).deeds.some((d) => d.includes("ปณิธานไม่โกหก"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf, palaceAccess } from "../content/murim/world/court";
import { crownHeir, emperorTitle } from "../content/murim/world/emperor";
import { castOf } from "../content/murim/world/palace";
import { labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson, displayName } from "./util";
import { validateLife } from "./validate";
import { ACTIVITIES } from "./activities";

loadMurimWorld();
loadSharedEvents();

function courtier(seed: number, rank: number) {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 35; l.stats.smarts = 85; l.stats.looks = 70; l.fame = 70; l.money = 5_000_000;
  l.job = { careerId: "official", level: 4, performance: 50, years: 5, salary: 0 } as never;
  l.flags.courtRank = rank;
  courtOf(l);
  return l;
}
const labels = (l: Life) => visibleChoices(l, l.queue[0]).map((x) => String(labelOf(x.c, l, l.queue[0].ctx)));
function pickLabel(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]);
  const i = o.findIndex((x) => String(labelOf(x.c, l, l.queue[0].ctx)).startsWith(start));
  expect(i, `ไม่มีตัวเลือก ${start}: ${labels(l).join(" | ")}`).toBeGreaterThanOrEqual(0);
  resolveChoice(l, o[i].index);
  while (l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
}

describe("หักหลังฮ่องเต้หลายทาง · เมื่อคุณเป็นฮ่องเต้ ราชสำนักเป็นของคุณจริง", () => {
  it("เมนูแผนชิงอำนาจมีทางเลือกหลากหลายตามขั้น", () => {
    const l = courtier(3, 3);
    createPerson(l, "child", { age: 17, gender: "f" });
    runEvent(l, "ct.s_menu");
    const a = labels(l);
    for (const s of ["ปล่อยข่าวลางร้าย", "ให้หมอหลวงวางยาฮ่องเต้", "ส่งลูกเข้าวัง", "ซื้อใจขันที"]) expect(a.some((x) => x.startsWith(s)), `${s} ใน ${a.join(" | ")}`).toBe(true);
    const m = courtier(4, 5);
    courtOf(m).emperor.temper = "puppet";
    m.flags.eunuchAlly = castOf(m).find((n) => n.role === "eunuch")!.id;
    runEvent(m, "ct.s_menu");
    const b = labels(m);
    for (const s of ["ประกาศขึ้นครองบัลลังก์", "บีบหุ่นเชิดให้สละราชสมบัติ", "ยกทัพเข้าวัง", "อยู่เบื้องหลังต่อไป"]) expect(b.some((x) => x.startsWith(s)), `${s} ใน ${b.join(" | ")}`).toBe(true);
  });

  it("ขึ้นบัลลังก์ได้ทุกทาง และพระนามในราชสำนักคือชื่อเต็มของคุณ", () => {
    const ways = ["ประกาศขึ้นครองบัลลังก์", "บีบหุ่นเชิดให้สละราชสมบัติ", "ยกทัพเข้าวัง"];
    const won: Record<string, number> = {};
    for (const way of ways) for (let s = 1; s <= 40; s++) {
      const l = courtier(100 + s, 5);
      courtOf(l).emperor.temper = "puppet";
      l.flags.generalAlly = castOf(l).find((n) => n.role === "general")!.id;
      runEvent(l, "ct.s_menu");
      pickLabel(l, way);
      if (!l.flags.emperorSelf) continue;
      won[way] = (won[way] ?? 0) + 1;
      expect(courtOf(l).emperor.name).toBe(`ฮ่องเต้${displayName(l)}`);
      expect(emperorTitle(l)).toContain(l.lastName);
      expect(palaceAccess(l)).toBe(true);
    }
    console.log("SIM throne ways", won);
    for (const w of ways) expect(won[w] ?? 0, w).toBeGreaterThan(3);
  });

  it("เป็นฮ่องเต้แล้วไม่มีเรื่องของขุนนาง (หาผู้อุปถัมภ์ ถูกเรียกตัว ถูกฎีกาฟ้อง) · มีเรื่องของฮ่องเต้ · ลูกเป็นรัชทายาท", () => {
    const subject: string[] = [];
    let emperorEvents = 0, heirs = 0;
    for (let s = 1; s <= 30; s++) {
      const l = courtier(500 + s * 7, 5);
      courtOf(l).emperor.temper = "puppet";
      runEvent(l, "ct.s_menu");
      const o = visibleChoices(l, l.queue[0]);
      resolveChoice(l, o.find((x) => String(labelOf(x.c, l, l.queue[0].ctx)).startsWith("ประกาศขึ้น"))!.index);
      while (l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
      if (!l.flags.emperorSelf) continue;
      createPerson(l, "child", { age: 7, gender: "m" });
      createPerson(l, "child", { age: 4, gender: "f" });
      const r = { rng: s };
      for (let y = 0; y < 20 && l.alive && l.flags.emperorSelf; y++) {
        l.stats.health = Math.max(l.stats.health, 60);
        let g = 0;
        while (l.queue.length && g++ < 50) {
          const id = l.queue[0].eventId;
          if (/^ct\.(?!e_|h_|f_|s_assassin)/.test(id)) subject.push(id);
          if (id.startsWith("ct.e_")) emperorEvents++;
          const o2 = visibleChoices(l, l.queue[0]);
          resolveChoice(l, o2[Math.floor(nextFloat(r) * o2.length)].index);
        }
        if (!l.alive || !l.flags.emperorSelf) break;
        ageUp(l);
        if (l.flags.emperorSelf) expect(courtOf(l).emperor.name).toBe(`ฮ่องเต้${displayName(l)}`);
        expect(validateLife(l)).toEqual([]);
      }
      if (crownHeir(l)) { heirs++; expect(courtOf(l).heir?.name).toContain(crownHeir(l)!.name); }
    }
    console.log("SIM emperor life", { emperorEvents, heirs, subject: subject.length });
    expect(subject).toEqual([]);
    expect(emperorEvents).toBeGreaterThan(20);
    expect(heirs).toBeGreaterThan(5);
  });

  it("เซฟเก่าที่ขึ้นครองราชย์ไปแล้วด้วยชื่อตัว ถูกซ่อมเป็นชื่อเต็มในปีถัดไป · สละราชสมบัติให้ลูกได้", () => {
    const l = courtier(9, 6);
    l.flags.emperorSelf = true;
    courtOf(l).emperor.name = `ฮ่องเต้${l.firstName}`;
    ageUp(l);
    expect(courtOf(l).emperor.name).toBe(`ฮ่องเต้${displayName(l)}`);
    const k = createPerson(l, "child", { age: 20, gender: "m" });
    l.flags.heirId = k.id;
    const ab = ACTIVITIES.find((a) => a.id === "mw_abdicate")!;
    expect(ab.available!(l)).toBe(true);
    ab.run(l);
    expect(l.flags.emperorSelf).toBeUndefined();
    expect(courtOf(l).emperor.name).toBe(`ฮ่องเต้${k.name}`);
    expect(ACTIVITIES.find((a) => a.id === "mw_rule")!.available!(l)).toBe(false);
  });
});

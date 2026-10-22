import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { inheritMurim } from "../content/murim/life/generations";
import { ribbonOf } from "../content/murim/life/ribbons";
import { seedsOf } from "../content/murim/life/seedStore";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { castOf, palaceOf } from "../content/murim/world/palace";
import { courtRank, schemeHeat } from "../content/murim/world/palaceSchemes";
import { labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { buildHeir } from "./soul";
import type { Life } from "./types";
import { createPerson, displayName } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

type R = { rng: number };
function drain(l: Life, r: R, prefer?: string) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const i = prefer ? o.findIndex((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(prefer)) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}
const insider = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 35; l.money = 2_000_000; l.fame = 40; l.stats.smarts = 95; l.stats.looks = 80; l.stats.health = 90;
  l.job = { careerId: "official", level: 2, performance: 60, years: 5 };
  palaceOf(l);
  return l;
};
/** เปิดเมนูแผน แล้วเลือกตัวเลือกที่ขึ้นต้นด้วยข้อความนี้ */
function scheme(l: Life, prefix: string, r: R) {
  runEvent(l, "ct.s_menu");
  const o = visibleChoices(l, l.queue[0]);
  const pick = o.find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(prefix));
  if (!pick) { drain(l, r, "ยังไม่ใช่เวลา"); return false; }
  resolveChoice(l, pick.index);
  drain(l, r);
  return true;
}

describe("หักหลังในราชสำนักเพื่อขึ้นเป็นใหญ่", () => {
  it("ขายผู้อุปถัมภ์ / ใส่ร้าย / วางยา ขึ้นตำแหน่งได้จริง ทิ้งร่องรอยและผลที่ตามมาหลายปี", () => {
    const ups: Record<string, number> = {};
    for (const prefix of ["ขายความลับของผู้อุปถัมภ์", "ปลอมหลักฐาน", "วางยา"]) {
      ups[prefix] = 0;
      for (let s = 1; s <= 40; s++) {
        const l = insider(1000 + s);
        l.flags.courtRank = 1;
        const patron = castOf(l).find((n) => n.role === "minister")!;
        l.flags.palacePatron = patron.id;
        const before = courtRank(l);
        scheme(l, prefix, { rng: s });
        if (courtRank(l) > before) {
          ups[prefix]++;
          expect(schemeHeat(l)).toBeGreaterThan(0);
          expect(seedsOf(l).length).toBeGreaterThan(0);
          if (prefix.startsWith("ขาย")) expect(patron.out).toBe(true);
        }
        expect(validateLife(l)).toEqual([]);
      }
    }
    console.log("SIM scheme rank-ups of 40", ups);
    for (const v of Object.values(ups)) expect(v).toBeGreaterThan(8);
  });

  it("ยึดอำนาจเป็นผู้สำเร็จราชการ แล้วชิงบัลลังก์ตั้งราชวงศ์ใหม่ · ฮ่องเต้คือเราไม่สวรรคตแยก · ลูกขึ้นครองราชย์ต่อ", () => {
    let regent = 0, emperor: Life | undefined;
    for (let s = 1; s <= 60 && !emperor; s++) {
      const l = insider(2000 + s);
      l.flags.courtRank = 4;
      const g = castOf(l).find((n) => n.role === "general")!;
      l.flags.generalAlly = g.id;
      scheme(l, "ยึดอำนาจ", { rng: s });
      if (courtRank(l) !== 5) continue;
      regent++;
      expect(courtOf(l).regent).toBe(displayName(l));
      scheme(l, "ประกาศขึ้นครองบัลลังก์", { rng: s * 3 });
      if (l.alive && l.flags.emperorSelf) emperor = l;
    }
    expect(regent).toBeGreaterThan(0);
    expect(emperor).toBeTruthy();
    const l = emperor!;
    const c = courtOf(l);
    expect(c.dynasty).toContain(l.lastName || l.firstName);
    expect(l.flags.foundedDynasty).toBe(true);
    expect(ribbonOf(l).id).toBe("emperor");
    const reigns = c.reigns.length;
    for (let y = 0; y < 30 && l.alive; y++) { l.stats.health = 95; drain(l, { rng: y }); ageUp(l); drain(l, { rng: y + 1 }); }
    if (l.alive && l.flags.emperorSelf) {
      expect(courtOf(l).emperor.name).toBe(`ฮ่องเต้${displayName(l)}`);
      expect(courtOf(l).reigns.length).toBe(reigns);
    }
    if (!l.flags.emperorSelf) expect(l.flags.lostThrone).toBe(true); // ราชวงศ์ล่มระหว่างรัชกาล = เสียบัลลังก์
    l.flags.emperorSelf = true; // ทดสอบการสืบราชสมบัติให้ลูก
    const kid = createPerson(l, "child", { age: 20, bond: 80 });
    l.alive = false;
    const heir = buildHeir(l, kid.id);
    inheritMurim(l, heir, "heir", kid.id);
    expect(heir.flags.emperorSelf).toBe(true);
    expect(courtOf(heir).emperor.name).toBe(`ฮ่องเต้${displayName(heir)}`);
  });

  it("ร่องรอยของแผนนำไปสู่การถูกเปิดโปง และทุกทางเลือกปิดเรื่องได้", () => {
    let exposed = 0;
    for (let s = 1; s <= 40; s++) {
      const l = insider(3000 + s);
      l.flags.courtRank = 3;
      l.flags.schemeHeat = 100;
      for (let y = 0; y < 6 && l.alive; y++) {
        ageUp(l);
        if (l.queue.some((q) => q.eventId === "ct.s_exposed")) exposed++;
        drain(l, { rng: s * 10 + y });
        expect(l.flags.schemeExposed ?? false).toBeFalsy();
      }
    }
    expect(exposed).toBeGreaterThan(10);
  });

  it("ชีวิตในวังที่วางแผนสุ่ม 50 ชีวิต ไม่มีฉากตันและสถานะไม่เสีย", () => {
    let top = 0;
    for (let s = 1; s <= 50; s++) {
      const l = insider(4000 + s);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 50) {
        if (g % 3 === 0 && courtRank(l) < 6 && !l.flags.palaceWithdrawn) { runEvent(l, "ct.s_menu"); drain(l, r); }
        drain(l, r); if (l.alive) ageUp(l); drain(l, r);
        expect(validateLife(l)).toEqual([]);
      }
      top = Math.max(top, courtRank(l));
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM highest court rank reached", top);
    expect(top).toBeGreaterThanOrEqual(3);
  });
});

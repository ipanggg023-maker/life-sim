import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { inheritMurim, lineageOf } from "../content/murim/life/generations";
import { doJobAction, jobActionLocked, jobActionsFor } from "../content/murim/life/jobActions";
import { RIBBON_COUNT, ribbonOf } from "../content/murim/life/ribbons";
import { worldOfLife } from "../content/murim/life/world";
import { saveSect } from "../content/murim/m17core";
import { TAEL } from "../content/murim/story/kit";
import { activitiesFor, activityLocked, doActivity, timeLeft } from "./activities";
import { injure } from "./body";
import { visibleChoices } from "./events";
import { ageUp, choiceChance, createLife, migrateLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import { buildHeir, claimAward, heirsOf, newSoul } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";
import { SAVE_VERSION, repairLife, validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

type R = { rng: number };
const roll = (r: R) => nextFloat(r);

/** ตอบทุกฉาก (สุ่ม) — คืนคู่ (โอกาสที่แสดง, ผลจริง) ของทุกตัวเลือกที่มี % */
function drain(l: Life, r: R, rolls?: { shown: number; used: number; ok: boolean }[]) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const pick = o[Math.floor(roll(r) * o.length)];
    const shown = choiceChance(l, l.queue[0], pick.index);
    const out = resolveChoice(l, pick.index);
    if (rolls && shown !== undefined && out?.roll) rolls.push({ shown, used: out.roll.p, ok: out.roll.ok });
  }
}

/** หนึ่งปีของบอท: ทำกิจกรรมสุ่ม (ตามเวลาที่เหลือ) แล้วอายุขึ้น */
function year(l: Life, r: R, rolls?: { shown: number; used: number; ok: boolean }[]) {
  drain(l, r, rolls);
  for (let i = 0; i < 6 && l.alive; i++) {
    const open = activitiesFor(l).filter((a) => !activityLocked(l, a));
    if (!open.length || roll(r) < 0.3) break;
    doActivity(l, open[Math.floor(roll(r) * open.length)].id);
    drain(l, r, rolls);
  }
  if (l.alive) ageUp(l);
  drain(l, r, rolls);
}

const murim = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  return l;
};

describe("กลุ่ม 4: UI ระบบเวลา ความเสถียร และการทดสอบ", () => {
  it("งบเวลากิจกรรมต่อปี: ผู้ใหญ่ 5 ส่วน เดินทางไกลกินสอง งานอาชีพใช้เวลาเดียวกัน เริ่มใหม่ทุกปี", () => {
    const l = murim(11);
    l.age = 30; l.money = 1_000_000; l.stats.health = 80;
    l.job = { careerId: "smith", level: 3, performance: 60, years: 3 };
    expect(timeLeft(l)).toBe(5);
    expect(doActivity(l, "mw_travel") ?? doActivity(l, "mw_wander")).toBeTruthy();
    drain(l, { rng: 1 });
    expect(timeLeft(l)).toBe(3);
    const ja = jobActionsFor(l).find((a) => !jobActionLocked(l, a))!;
    doJobAction(l, ja.id);
    drain(l, { rng: 1 });
    expect(timeLeft(l)).toBe(2);
    for (const id of ["mw_meditate", "mw_body", "mw_shrine"]) { doActivity(l, id); drain(l, { rng: 2 }); }
    expect(timeLeft(l)).toBe(0);
    const any = activitiesFor(l).find((a) => !l.doneThisYear.includes(`act:${a.id}`));
    expect(activityLocked(l, any!)).toBe("ปีนี้ไม่มีเวลาเหลือ");
    ageUp(l); drain(l, { rng: 3 });
    expect(timeLeft(l)).toBeGreaterThanOrEqual(4);
    const kid = murim(12); kid.age = 7;
    expect(timeLeft(kid)).toBe(2);
    // โลกอื่นไม่จำกัด
    expect(timeLeft(createLife({ seed: 1, worldId: "hunter" }))).toBeUndefined();
  });

  it("% ที่แสดงคือ % ที่ใช้จริง และอัตราชนะตรงกับที่แสดงเมื่อเล่นจำนวนมาก (EXPANSION §17)", () => {
    const rolls: { shown: number; used: number; ok: boolean }[] = [];
    for (let s = 1; s <= 200; s++) {
      const l = murim(s * 7919);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 100) year(l, r, rolls);
    }
    for (const x of rolls) expect(x.used).toBeCloseTo(x.shown, 10);
    const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.01];
    const rep: string[] = [];
    for (let i = 0; i < buckets.length - 1; i++) {
      const b = rolls.filter((x) => x.shown >= buckets[i] && x.shown < buckets[i + 1]);
      if (b.length < 150) continue;
      const shown = b.reduce((s, x) => s + x.shown, 0) / b.length;
      const won = b.filter((x) => x.ok).length / b.length;
      rep.push(`${Math.round(buckets[i] * 100)}-${Math.round(Math.min(1, buckets[i + 1]) * 100)}%: shown ${(shown * 100).toFixed(1)} won ${(won * 100).toFixed(1)} (n=${b.length})`);
      // ขอบเขตตามสถิติ (3.5 sigma ตามขนาดตัวอย่าง) — อคติจริงจะเกินขอบนี้เมื่อตัวอย่างมากพอ
      const tol = Math.max(0.03, 3.5 * Math.sqrt((shown * (1 - shown)) / b.length));
      expect(Math.abs(won - shown), rep[rep.length - 1]).toBeLessThan(tol);
    }
    console.log("SIM odds calibration", rolls.length, "\n" + rep.join("\n"));
    expect(rep.length).toBeGreaterThanOrEqual(3);
  });

  it("กรณีสุดขั้ว: ทุกแบบเล่นได้ถึงจบ สถานะไม่เสีย และเซฟ/โหลดกลางเหตุการณ์ได้", () => {
    const setups: Record<string, (l: Life) => void> = {
      ไม่มีวิชา: () => {},
      พิการแต่เด็ก: (l) => { l.age = 6; injure(l, "legL", "severed", 3, "รถม้าทับ"); },
      รวยมาก: (l) => { l.age = 18; l.money = 100_000 * TAEL; },
      จนและมีหนี้: (l) => { l.age = 20; l.money = 0; l.debt = 500 * TAEL; },
      ฆ่าคนสำคัญตั้งแต่ต้น: (l) => { l.age = 16; l.flags.mwKills = 1; l.flags.lastCrime = "ฆ่าบุตรขุนนาง"; l.flags.heat = 80; l.flags.wanted = true; },
      พ่อค้าตลอดชีวิต: (l) => { l.age = 20; l.job = { careerId: "merchant", level: 2, performance: 60, years: 0 }; },
      หมอตลอดชีวิต: (l) => { l.age = 20; l.job = { careerId: "herbalist", level: 2, performance: 60, years: 0 }; },
      ลูกมาก: (l) => { l.age = 40; for (let i = 0; i < 8; i++) createPerson(l, "child", { age: 2 + i * 2, bond: 60 }); },
      ไม่มีทายาท: (l) => { l.age = 70; },
      สำนักถูกทำลาย: (l) => { l.age = 45; l.power = { rank: 4, hunterClass: "m_sword", level: 40, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] }; saveSect(l, { n: "สำนักเมฆาคราม", y: 30, d: 0, r: 0, rv: "พรรคพยัคฆ์ดำ", rr: 95, m: 5 }); },
      โรคระบาด: (l) => { l.age = 25; l.mw!.crisis = { id: "plague", stage: 2, since: l.birthYear + 24 }; },
    };
    let n = 0;
    for (const [name, setup] of Object.entries(setups)) {
      for (let k = 0; k < 4; k++) {
        let l = murim(9000 + n++ * 131);
        setup(l);
        const r = { rng: n * 17 + k };
        let g = 0;
        while (l.alive && g++ < 100) {
          year(l, r);
          const bad = validateLife(l);
          expect(bad, `${name} อายุ ${l.age}`).toEqual([]);
          // เซฟ/โหลดกลางเหตุการณ์ (มีคิวค้าง) แล้วเล่นต่อ
          if (l.queue.length && g % 7 === 0) l = migrateLife(JSON.parse(JSON.stringify(l)) as Life);
        }
        expect(l.alive, `${name} ไม่ตายภายใน 100 ปีของการจำลอง`).toBe(false);
        expect(JSON.parse(JSON.stringify(l))).toEqual(l);
      }
    }
  });

  it("ตรวจและซ่อมสถานะที่เสีย · เซฟรุ่นเก่าเข้าโหมด legacy จนจบชีวิตนั้น", () => {
    const l = murim(5);
    l.age = 20;
    const p = createPerson(l, "friend", { age: 20, bond: 50 });
    l.people.push({ ...p });
    l.money = Number.NaN;
    l.stats.health = 140;
    l.flags.heat = Number.POSITIVE_INFINITY;
    l.mwArts = [{ id: "a_ghost_art", m: 10 } as never];
    expect(validateLife(l).length).toBeGreaterThanOrEqual(5);
    expect(repairLife(l)).toBeGreaterThanOrEqual(5);
    expect(validateLife(l)).toEqual([]);

    const old = murim(6);
    delete old.sv;
    migrateLife(old);
    expect(old.sv).toBe(SAVE_VERSION);
    expect(old.flags.legacySave).toBe(1);
    expect(murim(7).flags.legacySave).toBeUndefined();
  });

  it("ผังตระกูลสืบต่อหลายรุ่น และริบบิ้นตอนตายมีหลายแบบ สะสมในวิญญาณ", () => {
    const soul = newSoul();
    let l = murim(4242);
    l.age = 20;
    let gens = 1;
    const r = { rng: 9 };
    for (let guard = 0; guard < 12 && gens < 4; guard++) {
      // ให้มีลูกแน่ๆ
      if (!l.people.some((p) => p.relation === "child")) {
        createPerson(l, "spouse", { age: l.age, bond: 70 });
        createPerson(l, "child", { age: 1, bond: 70 });
      }
      let g = 0;
      while (l.alive && g++ < 120) year(l, r);
      claimAward(soul, l, false);
      // ทดสอบการสืบสาย ไม่ใช่อัตรารอดของเด็ก — ถ้าลูกตายหมด ให้มีทายาทที่โตแล้วหนึ่งคน
      if (!heirsOf(l).length) createPerson(l, "child", { age: 20, bond: 70 });
      const kids = heirsOf(l);
      if (!kids.length) break;
      const next = buildHeir(l, kids[0].id);
      inheritMurim(l, next, "heir", kids[0].id);
      expect(lineageOf(next).length).toBe(Math.min(8, gens));
      expect(lineageOf(next).at(-1)!.how).toBe("heir");
      l = next;
      gens++;
    }
    expect(gens).toBeGreaterThanOrEqual(3);
    expect(soul.ribbons?.length).toBeGreaterThanOrEqual(1);

    const seen = new Map<string, number>();
    for (let s = 1; s <= 150; s++) {
      const x = murim(s * 104729);
      const rr = { rng: s };
      let g = 0;
      while (x.alive && g++ < 110) year(x, rr);
      const rb = ribbonOf(x);
      seen.set(rb.id, (seen.get(rb.id) ?? 0) + 1);
    }
    console.log("SIM ribbons", JSON.stringify([...seen].sort((a, b) => b[1] - a[1])), "of", RIBBON_COUNT);
    expect(seen.size).toBeGreaterThanOrEqual(6);
    // ไม่มีริบบิ้นไหนครองเกินครึ่ง
    expect(Math.max(...seen.values())).toBeLessThan(75);
  });

  it("หลักฐานสำหรับ rubric: ความหลากหลายของเหตุการณ์ จังหวะของปี และสาเหตุการตาย (EXPANSION §19)", () => {
    const distinct: number[] = [], topShare: number[] = [], eventYears: number[] = [];
    const causes = new Map<string, number>();
    for (let s = 1; s <= 80; s++) {
      const l = murim(s * 6151);
      const r = { rng: s };
      let g = 0, withEvent = 0, yrs = 0;
      while (l.alive && g++ < 110) {
        const before = l.queue.length;
        year(l, r);
        yrs++;
        if (before || Object.keys(l.seen).length) withEvent += l.log.some((e) => e.age === l.age - 1 && (e.kind === "chapter" || e.kind === "good" || e.kind === "bad")) ? 1 : 0;
      }
      const counts = Object.values(l.seen).filter((n) => n > 0);
      const total = counts.reduce((a, b) => a + b, 0);
      distinct.push(counts.length);
      topShare.push(total ? Math.max(...counts) / total : 0);
      eventYears.push(yrs ? withEvent / yrs : 0);
      const c = (l.causeOfDeath ?? "?").replace(/[0-9]/g, "").slice(0, 18);
      causes.set(c, (causes.get(c) ?? 0) + 1);
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(
      "SIM rubric",
      `distinct events/life ${avg(distinct).toFixed(1)}`,
      `· most-repeated event share ${(avg(topShare) * 100).toFixed(1)}%`,
      `· years with a notable result ${(avg(eventYears) * 100).toFixed(0)}%`,
      `· death causes ${causes.size}: ${JSON.stringify([...causes].sort((a, b) => b[1] - a[1]).slice(0, 6))}`,
    );
    expect(avg(distinct)).toBeGreaterThan(20);
    expect(avg(topShare)).toBeLessThan(0.35);
    expect(causes.size).toBeGreaterThanOrEqual(8);
  });

  it("ขนาดเซฟและความเร็วจำลองพอสำหรับมือถือ", () => {
    let worst = 0, ms = 0, years = 0;
    for (let s = 1; s <= 25; s++) {
      const l = murim(s * 31337);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 110) {
        drain(l, r);
        const t = performance.now();
        if (l.alive) ageUp(l);
        ms += performance.now() - t;
        years++;
      }
      worst = Math.max(worst, JSON.stringify(l).length);
    }
    console.log("SIM save worst", worst, "bytes · ageUp", (ms / years).toFixed(2), "ms/year");
    expect(worst).toBeLessThan(400_000);
    expect(ms / years).toBeLessThan(15);
  });
});

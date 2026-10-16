import { describe, expect, it } from "vitest";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadCourtWorld } from "../content/court";
import { worldFacts } from "../content/hunter/worldFacts";
import { exportCode, importCode } from "../save";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import { buildRegression, claimAward, newSoul, nextEraOptions, regressTarget } from "./soul";
import type { Life } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();

/** เล่นจนตาย (หรือถึงอายุ stopAt) โดยเก็บ snapshot ทุกปีไว้ใน Map แบบเดียวกับ UI */
function play(life: Life, snaps: Map<number, Life>, pickFirst = false, stopAt = 200) {
  const r = { rng: life.seed ^ 0x1234 };
  let guard = 0;
  while (life.alive && life.age < stopAt && guard++ < 220) {
    while (life.queue.length) {
      const opts = visibleChoices(life, life.queue[0]);
      expect(opts.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
      resolveChoice(life, (pickFirst ? opts[0] : opts[Math.floor(nextFloat(r) * opts.length)]).index);
    }
    if (!life.alive || life.age >= stopAt) break;
    snaps.set(life.age, structuredClone({ ...life, log: [], queue: [] }));
    ageUp(life);
  }
  return life;
}

describe("ระบบวิญญาณ", () => {
  it("ย้อนเวลากลับไปอายุเป้าหมายพร้อมความทรงจำ และเล่นต่อได้หลายรอบ", () => {
    for (let s = 1; s <= 40; s++) {
      const snaps = new Map<number, Life>();
      let life = play(createLife({ seed: s * 31337 }), snaps);
      for (let round = 1; round <= 3; round++) {
        const target = regressTarget(life);
        const snap = [...snaps.entries()].filter(([a]) => a <= target).sort((a, b) => b[0] - a[0])[0]?.[1];
        const next = buildRegression(life, snap, false);
        expect(next.alive).toBe(true);
        expect(next.regressions).toBe(round);
        expect(next.divergence).toBe((life.divergence ?? 0) + 12);
        expect(next.memories?.some((m) => m.key === "death")).toBe(true);
        if (snap) expect(next.age).toBe(snap.age);
        snaps.clear();
        life = play(next, snaps);
        expect(life.alive).toBe(false);
      }
    }
  });

  it("ความทรงจำเรื่องหวยทำให้ถูกรางวัลเมื่ออนาคตยังไม่เพี้ยน", () => {
    const life = createLife({ seed: 777 });
    const f = worldFacts(life);
    life.memories = [{ key: "lottery", age: f.lotteryAge, text: "", data: { num: f.lotteryNumber } }];
    life.stats.health = 100;
    play(life, new Map(), true, f.lotteryAge + 1);
    if (life.alive) expect(life.flags.jackpot).toBe(true);
  });

  it("ข้อเท็จจริงของโลกเหมือนเดิมเมื่อย้อนเวลา แต่เปลี่ยนในยุคถัดไป", () => {
    const a = createLife({ seed: 99 });
    const snaps = new Map<number, Life>();
    play(a, snaps);
    const reg = buildRegression(a, snaps.get(regressTarget(a)), false);
    expect(worldFacts(reg)).toEqual(worldFacts(a));
    const era = createLife(nextEraOptions(a));
    expect(era.worldSeed).toBe(a.worldSeed);
    expect(era.birthYear).toBeGreaterThan(a.birthYear + a.age);
    expect(era.legacy?.founderName).toBe(`${a.firstName} ${a.lastName}`);
    expect(worldFacts(era)).not.toEqual(worldFacts(a));
  });

  it("แต้มวิญญาณให้ครั้งเดียวต่อชีวิต และย้อนเวลาได้น้อยกว่า", () => {
    const life = play(createLife({ seed: 4242 }), new Map());
    const s1 = newSoul();
    const full = claimAward(s1, life, false);
    expect(full).toBeGreaterThan(0);
    expect(claimAward(s1, life, false)).toBe(0);
    const s2 = newSoul();
    expect(claimAward(s2, life, true)).toBeLessThanOrEqual(full);
  });

  it("export/import เซฟได้ข้อมูลเดิม", async () => {
    const life = play(createLife({ seed: 5150 }), new Map(), false, 40);
    const soul = newSoul();
    soul.points = 123;
    const code = await exportCode({ v: 1, soul, life, graveyard: [] });
    const back = await importCode(code);
    expect(back.soul.points).toBe(123);
    expect(back.life).toEqual(life);
    const small = await exportCode({ v: 1, soul, life, graveyard: [] }, true);
    console.log("SAVE ขนาดเต็ม", code.length, "ตัวอักษร | แบบย่อ", small.length);
  });
});

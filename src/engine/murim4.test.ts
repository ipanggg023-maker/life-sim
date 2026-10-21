import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { artsOf, conflicted, learn, martialBonus, practise, qiYears, tickMartial } from "../content/murim/martial/arts";
import { TRAIN_MODES, trainArt } from "../content/murim/martial/training";
import { plansFor, setPlan } from "../content/murim/life/plan";
import { awaken, combatPower } from "../content/hunter/power";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("Murim Phase 4: วิชา ลมปราณ ความเข้าใจ วิธีฝึก ขั้นฝีมือ", () => {
  it("วิชาเพิ่มพลังจริงแต่มีเพดาน · วิธีฝึกต่างกัน · วิชาต่างขั้วเสี่ยงธาตุไฟเข้าแทรก", () => {
    const l = createLife({ seed: 101, worldId: "murim" });
    l.age = 20;
    awaken(l, 2, "m_sword");
    const base = combatPower(l);
    learn(l, "s_cloud_sword", "สำนัก", true);
    learn(l, "x_taiji", "อาจารย์", true);
    for (const k of artsOf(l)) k.m = 90;
    l.flags.mwQi = 40;
    expect(combatPower(l)).toBeGreaterThan(base);
    expect(martialBonus(l)).toBeLessThanOrEqual(28);
    // ฝึกปลอดภัยไม่มีความเสี่ยง · ฝึกกับอาจารย์ต้องมีอาจารย์
    const k = createLife({ seed: 7, worldId: "murim" });
    k.age = 15;
    awaken(k, 1, "m_palm");
    learn(k, "a_breathing", "ครูฝึก", true);
    const hp = k.stats.health;
    trainArt(k, "a_breathing", "safe");
    expect(k.stats.health).toBe(hp);
    expect(artsOf(k)[0].m).toBeGreaterThan(0);
    expect(TRAIN_MODES.find((m) => m.id === "master")!.req!(k, "a_breathing")).toBeTruthy();
    expect(trainArt(k, "a_breathing", "hard").text).toContain("ฝึกเต็มที่ไปแล้ว");
    // ธรรมะ + มาร
    learn(k, "x_heavenly_demon", "ตำรา", true);
    learn(k, "x_yijin", "ตำรา", true);
    expect(conflicted(k)).toBe(true);
    let hurt = 0;
    for (let i = 0; i < 200; i++) { const before = k.stats.health; k.stats.health = 100; tickMartial(k); if (k.stats.health < 100) hurt++; void before; }
    expect(hurt).toBeGreaterThan(5);
    // ความชำนาญเพิ่มตามความเข้าใจ
    const a = createLife({ seed: 9, worldId: "murim" });
    learn(a, "a_long_fist", "ครูฝึก", true);
    a.flags.mwComp = 95;
    const b = createLife({ seed: 9, worldId: "murim" });
    learn(b, "a_long_fist", "ครูฝึก", true);
    b.flags.mwComp = 10;
    expect(practise(a, "a_long_fist", 10)).toBeGreaterThan(practise(b, "a_long_fist", 10));
  });

  it("ประชากรจำลอง: ยอดฝีมือขั้นสูงหายากจริง ลมปราณสะสมตามเวลา คนได้วิชาจากเรื่องราว", () => {
    const N = 200;
    const ranks: number[] = [];
    let withArts = 0, qiSum = 0, cultivators = 0;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 3571, worldId: "murim" });
      const r = { rng: s * 5 };
      let guard = 0;
      while (l.alive && guard++ < 130) {
        drain(l, r);
        if (!l.alive) break;
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.3) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        const arts = artsOf(l);
        if (arts.length && nextFloat(r) < 0.5) trainArt(l, arts[0].id, nextFloat(r) < 0.7 ? "safe" : "hard");
        ageUp(l);
      }
      drain(l, r);
      if (l.power) { cultivators++; ranks.push(l.power.rank); qiSum += qiYears(l); }
      if (artsOf(l).length) withArts++;
    }
    const share = (f: (r: number) => boolean) => ranks.filter(f).length / Math.max(1, cultivators);
    console.log("SIM P4 ฝึกลมปราณ", cultivators, "/", N, "| ขั้น ≥ชั้นหนึ่ง", (share((x) => x >= 3) * 100).toFixed(1), "% | ≥จุดสูงสุด", (share((x) => x >= 4) * 100).toFixed(1), "% | ≥หลอมรวม", (share((x) => x >= 6) * 100).toFixed(1), "% | ลมปราณเฉลี่ย", (qiSum / Math.max(1, cultivators)).toFixed(1), "ปี | มีวิชา", withArts);
    expect(share((x) => x >= 3)).toBeLessThan(0.7);
    expect(share((x) => x >= 4)).toBeLessThan(0.12);
    expect(share((x) => x >= 6)).toBeLessThan(0.03);
    expect(withArts).toBeGreaterThan(cultivators * 0.8);
  });
});

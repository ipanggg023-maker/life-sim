import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { fightOdds, survivalOdds } from "../content/hunter/power";
import { MURIM_TALENTS, gift } from "../content/murim/life/gifts";
import { hearRumor, rumorsOf, type Truth } from "../content/murim/life/rumors";
import { worldOfLife } from "../content/murim/life/world";
import { addQi, learnRate, qiYears, rootOf } from "../content/murim/martial/arts";
import { talentById } from "../content/talents";
import { careerById } from "../content/hunter/careers";
import { injure, tickBody } from "./body";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, choiceChance, createLife, lifespanHooks, migrateLife, resolveChoice, runEvent, salaryOf } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";

loadMurimWorld();
loadSharedEvents();

const murim = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  return l;
};
/** ชีวิตคู่เทียบ: เหมือนกันทุกอย่าง ต่างกันแค่พรสวรรค์ที่เปิดเผยแล้ว */
function pair(seed: number, talent: string): [Life, Life] {
  const base = murim(seed);
  base.talents = [];
  base.age = 25;
  base.power = { rank: 2, hunterClass: "m_sword", level: 20, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  const a = JSON.parse(JSON.stringify(base)) as Life;
  const b = JSON.parse(JSON.stringify(base)) as Life;
  b.talents = [{ id: talent, revealed: true }];
  return [a, b];
}
const MURIM_GENERIC = ["sturdy", "memory", "cute", "optimist", "sweettalk", "diligent", "genius", "charm", "lucky", "merchant", "heaven_child", "protagonist_face", "tragic_genius", "golden_spoon"];

describe("พรสวรรค์ยุทธภพมีผลจริง · ลงมือตามข่าวได้แม้ข่าวไม่จริง", () => {
  it("ยุทธภพสุ่มได้แต่พรสวรรค์ของยุทธภพ (และชุดทั่วไปที่เข้ากัน) · โลกอื่นไม่ได้พรสวรรค์ยุทธภพ", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 300; s++) {
      const l = murim(s * 7);
      for (const t of l.talents) {
        seen.add(t.id);
        expect(talentById(t.id)?.world === "murim" || MURIM_GENERIC.includes(t.id), t.id).toBe(true);
      }
      const h = createLife({ seed: s * 7, worldId: "hunter" });
      for (const t of h.talents) expect(talentById(t.id)?.world, t.id).toBeUndefined();
    }
    expect([...seen].filter((id) => id.startsWith("mt_")).length).toBeGreaterThanOrEqual(12);
    for (const t of MURIM_TALENTS) expect(t.desc).toContain(" — ");
  });

  it("ผลของพรสวรรค์วัดได้จริงในระบบ: ลมปราณ การเรียน การต่อสู้ การรอด อายุขัย รายได้ ใจโหด", () => {
    let [a, b] = pair(1, "mt_long_breath");
    addQi(a, 2); addQi(b, 2);
    expect(qiYears(b) - qiYears(a)).toBeCloseTo(0.2, 1);
    [a, b] = pair(2, "mt_martial_eye");
    expect(learnRate(b) / learnRate(a)).toBeCloseTo(1.3, 5);
    expect(fightOdds(b, 3) - fightOdds(a, 3)).toBeCloseTo(0.04, 5);
    [a, b] = pair(3, "mt_born_fighter");
    expect(survivalOdds(b, 7)).toBeGreaterThan(survivalOdds(a, 7));
    [a, b] = pair(4, "mt_immortal_body");
    expect(lifespanHooks.reduce((s, h) => s + h(b), 0) - lifespanHooks.reduce((s, h) => s + h(a), 0)).toBeGreaterThanOrEqual(20);
    [a, b] = pair(5, "mt_merchant_blood");
    a.job = b.job = { careerId: "merchant", level: 2, performance: 60, years: 2 };
    const mc = careerById("merchant")!;
    expect(salaryOf(b, mc, 2) / salaryOf(a, mc, 2)).toBeCloseTo(1.3, 1);
    [a, b] = pair(6, "mt_born_killer");
    const al = (l: Life) => Number(l.flags.m17Align ?? 0);
    const a0 = al(a), b0 = al(b);
    a.stats.health = b.stats.health = 90;
    ageUp(a); ageUp(b);
    expect(al(b) - b0).toBeLessThan(al(a) - a0 + 0.5);
    // พรสวรรค์โลกอื่นไม่มีผลในยุทธภพ และพรสวรรค์ยุทธภพไม่มีผลนอกยุทธภพ
    const h = createLife({ seed: 9, worldId: "hunter" });
    h.talents = [{ id: "mt_born_fighter", revealed: true }];
    expect(gift(h, "fight")).toBe(0);
  });

  it("เซฟเก่า: พรสวรรค์โลกอื่นถูกแปลงเป็นพรสวรรค์ยุทธภพที่มีผลจริง (ชุดทั่วไปที่เข้ากันคงไว้ · แปลงครั้งเดียว · โลกอื่นไม่แตะ)", () => {
    const l = murim(77);
    l.talents = [
      { id: "genius", revealed: true },
      { id: "early_bird", revealed: true },
      { id: "dimples", revealed: true },
      { id: "mana_heart", revealed: false },
    ];
    delete l.sv;
    migrateLife(l);
    const ids = l.talents.map((t) => t.id);
    expect(ids[0]).toBe("genius");
    expect(ids.slice(1).every((id) => talentById(id)?.world === "murim")).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(l.talents[3].revealed).toBe(false);
    expect(gift(l, "qi")).toBeGreaterThan(0); // ตื่นเช้า → ลมหายใจยาว
    expect(l.log.at(-1)!.text).toContain("ตีความตามโลกยุทธภพ");
    const before = JSON.stringify(l.talents);
    migrateLife(l);
    expect(JSON.stringify(l.talents)).toBe(before);
    const h = createLife({ seed: 3, worldId: "hunter" });
    h.talents = [{ id: "mana_heart", revealed: true }];
    migrateLife(h);
    expect(h.talents[0].id).toBe("mana_heart");
  });

  it("พรสวรรค์รากฐานกระดูกสอดคล้องกับตัวละคร: ศิลาตอบเสมอ รากฐานสูงตาม · ช่องลับถูกเผย · คนที่พลาดไปแล้วได้เปิดชีพจรทีหลัง", () => {
    let cultivated = 0, alive = 0, minRoot = 9;
    for (let s = 1; s <= 80; s++) {
      const l = createLife({ seed: 500 + s * 11, worldId: "murim", talents: ["mt_immortal_body"] });
      worldOfLife(l);
      const r = { rng: s };
      let g = 0;
      while (l.alive && l.age < 16 && g++ < 20) {
        let k = 0;
        while (l.queue.length && k++ < 60) { const o = visibleChoices(l, l.queue[0]); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
        if (l.alive) ageUp(l);
      }
      let k = 0;
      while (l.queue.length && k++ < 60) { const o = visibleChoices(l, l.queue[0]); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
      if (!l.alive) continue;
      alive++;
      if (l.power) { cultivated++; minRoot = Math.min(minRoot, rootOf(l)); }
    }
    console.log("SIM immortal body", { alive, cultivated, minRoot });
    expect(cultivated).toBe(alive);
    expect(minRoot).toBeGreaterThanOrEqual(2);

    // ช่องลับที่เป็นรากฐาน ถูกเผยที่ศิลาวัดกระดูก
    const h = murim(31);
    h.talents = [{ id: "mt_heaven_bones", revealed: false }];
    h.age = Number(h.flags.ceremonyAge ?? 12);
    runEvent(h, "mk.assessment");
    resolveChoice(h, visibleChoices(h, h.queue[0])[0].index);
    expect(h.talents[0].revealed).toBe(true);

    // ตัวละครเก่าที่ศิลาไม่ตอบ (หรือพลาดไปแล้ว) — ผู้อาวุโสพเนจรเปิดชีพจรให้
    const old = murim(32);
    old.age = 25; old.flags.awakenDone = true; delete old.power;
    old.talents = [{ id: "mt_immortal_body", revealed: true }];
    expect(getEvent("mk.talent_root")!.when!(old)).toBe(true);
    runEvent(old, "mk.talent_root");
    resolveChoice(old, visibleChoices(old, old.queue[0])[0].index);
    expect(old.power).toBeTruthy();
    expect(rootOf(old)).toBeGreaterThanOrEqual(2);
  });

  it("ร่างร้อยพิษไม่ติดพิษ · เนื้อหนังหายไวทำให้แผลหายเร็วกว่า", () => {
    const [a, b] = pair(7, "mt_hundred_poison");
    injure(a, "organs", "poison", 2, "ทดสอบ");
    injure(b, "organs", "poison", 2, "ทดสอบ");
    expect(a.body!.injuries.some((i) => i.kind === "poison")).toBe(true);
    expect(b.body?.injuries.some((i) => i.kind === "poison") ?? false).toBe(false);
    let slow = 0, fast = 0;
    for (let s = 1; s <= 60; s++) {
      const [x, y] = pair(100 + s, "mt_quick_heal");
      injure(x, "armL", "broken", 2); injure(y, "armL", "broken", 2);
      for (const l of [x, y]) l.flags[`treated_${l.body!.injuries[0].id}`] = true;
      for (let t = 0; t < 6; t++) { if (x.body!.injuries.length) { tickBody(x); slow++; } if (y.body!.injuries.length) { tickBody(y); fast++; } }
    }
    expect(fast).toBeLessThan(slow);
  });

  it("หูไวตาไว: โอกาสตรวจสอบข่าวที่แสดงสูงขึ้นจริง", () => {
    const [a, b] = pair(8, "mt_keen_ear");
    const ra = hearRumor(a), rb = hearRumor(b);
    runEvent(a, "rm.verify", { rid: ra.id });
    runEvent(b, "rm.verify", { rid: rb.id });
    const sum = (l: Life) => visibleChoices(l, l.queue[0]).reduce((s, x) => s + (choiceChance(l, l.queue[0], x.index) ?? 0), 0);
    expect(sum(b)).toBeGreaterThan(sum(a));
  });

  it("ลงมือตามข่าวได้ทุกความจริง: ข่าวไม่จริง/กับดักก็มีทางเลือกที่ได้ประโยชน์", () => {
    const setTruth = (l: Life, id: string, truth: Truth, verified: boolean) => {
      const rs = rumorsOf(l);
      const r = rs.find((x) => x.id === id)!;
      r.truth = truth; r.verified = verified;
      l.flags.mwRumors = JSON.stringify(rs);
    };
    const goodOnFalse = new Map<string, number>();
    for (let s = 1; s <= 200; s++) {
      for (const truth of ["false", "trap", "true", "partial"] as Truth[]) {
        const l = murim(4000 + s);
        l.age = 30; l.money = 500_000; l.stats.smarts = 85; l.stats.looks = 70;
        l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
        createPerson(l, "friend", { age: 30, bond: 60 });
        const r = hearRumor(l);
        if (truth === "trap" && r.kind !== "treasure") continue;
        setTruth(l, r.id, truth, s % 2 === 0);
        runEvent(l, "rm.act", { rid: r.id });
        const opts = visibleChoices(l, l.queue[0]);
        const real = opts.filter((o) => labelOf(o.c, l, l.queue[0].ctx) !== "เปลี่ยนใจ");
        expect(real.length, `${r.kind}/${truth}`).toBeGreaterThanOrEqual(3);
        if (truth === "false" || truth === "trap") {
          const pickI = real[Math.floor(nextFloat({ rng: s }) * real.length)];
          const label = labelOf(pickI.c, l, l.queue[0].ctx);
          const out = resolveChoice(l, pickI.index);
          if (out?.kind === "good" || out?.kind === "milestone") goodOnFalse.set(label, (goodOnFalse.get(label) ?? 0) + 1);
        }
      }
    }
    console.log("SIM good outcomes on false/trap rumours", JSON.stringify([...goodOnFalse]));
    expect(goodOnFalse.size).toBeGreaterThanOrEqual(4);
  });
});

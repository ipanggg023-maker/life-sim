import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { ASSETS, FT_JOB_ACTIONS, assetIncome } from "../content/fantasy/careers";
import { raceOf } from "../content/fantasy/folk";
import { NAMES } from "../content/fantasy/names";
import { combat } from "../content/fantasy/power";
import { CAREERS } from "../content/core/careers";
import { doJobAction, jobActionLocked } from "../content/murim/life/jobActions";
import { ageUp, createLife, resolveChoice } from "./game";
import { visibleChoices } from "./events";
import { buildHeir } from "./soul";
import { fantasyPersonActions } from "../content/fantasy/bonds";
import { SPELLS } from "../content/fantasy/magic";
import { epithetOf, styleBonus, techsOf } from "../content/fantasy/styles";
import { getEvent } from "./events";
import { createPerson } from "./util";

loadFantasyWorld();
const fantasy = (seed: number) => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.queue = [];
  return l;
};

describe("ชื่อและเผ่าของผู้คน", () => {
  it("ตัวละครและครอบครัวใช้ชื่อของเผ่าตัวเอง", () => {
    for (let s = 1; s <= 60; s++) {
      const l = fantasy(s * 13);
      const pool = NAMES[l.ft!.race];
      expect(pool.m.concat(pool.f), `${l.ft!.race} ${l.firstName}`).toContain(l.firstName);
      for (const p of l.people.filter((x) => ["father", "mother", "sibling"].includes(x.relation))) {
        expect(raceOf(p)).toBe(l.ft!.race);
        expect(p.name.endsWith(l.lastName)).toBe(true);
      }
    }
  });
  it("คนนอกครอบครัวมีหลายเผ่า และเอลฟ์แก่ช้ากว่ามนุษย์", () => {
    const l = fantasy(7);
    const races = new Set<string>();
    for (let i = 0; i < 80; i++) races.add(raceOf(createPerson(l, "friend", { age: 20 }))!);
    expect(races.size).toBeGreaterThanOrEqual(4);
    // เพื่อนเอลฟ์อายุ 150 ยังไม่ควรตายจากความชรา
    const elf = createPerson(l, "friend", { age: 150, bond: 99 });
    elf.tags = ["race:elf"];
    for (let y = 0; y < 10; y++) { l.queue = []; ageUp(l); elf.bond = 99; }
    expect(elf.alive).toBe(true);
  });
  it("ทุกเผ่ามีชื่อมากพอ", () => {
    for (const p of Object.values(NAMES)) {
      expect(p.m.length).toBeGreaterThanOrEqual(10);
      expect(p.f.length).toBeGreaterThanOrEqual(10);
      expect(p.last.length).toBeGreaterThanOrEqual(8);
    }
    expect(NAMES.human.m.length + NAMES.human.f.length).toBeGreaterThanOrEqual(90);
  });
});

describe("อาชีพของโลกแฟนตาซี", () => {
  const jobs = CAREERS.filter((c) => c.world === "fantasy");
  it("มีอาชีพหลากหลาย และทุกอาชีพมีงานของตัวเอง", () => {
    expect(jobs.length).toBeGreaterThanOrEqual(24);
    for (const c of jobs) expect(FT_JOB_ACTIONS.some((a) => a.jobs.includes(c.id)), c.id).toBe(true);
  });
  it("งานทุกอย่างทำได้โดยไม่พัง", () => {
    for (const a of FT_JOB_ACTIONS) {
      const l = fantasy(3);
      l.age = 30; l.money = 100_000; l.job = { careerId: a.jobs[0], level: 5, years: 5, performance: 50 };
      l.ft!.weapon = { name: "ดาบ", quality: 1 };
      if (jobActionLocked(l, a)) continue;
      expect(() => doJobAction(l, a.id), a.id).not.toThrow();
    }
  });
  it("ทรัพย์สินให้รายได้ทุกปี และอาวุธเพิ่มพลังต่อสู้", () => {
    const l = fantasy(11);
    l.age = 30;
    l.flags.ftLand = 2; l.flags.ftShop = 1;
    expect(assetIncome(l)).toBe(ASSETS.ftLand.gold * 2 + ASSETS.ftShop.gold);
    const before = l.money;
    ageUp(l);
    expect(l.money).toBeGreaterThan(before - 100 * 100);
    const base = combat(l);
    l.ft!.weapon = { name: "ดาบ", quality: 4, enchant: true };
    expect(combat(l)).toBe(base + 16);
  });
});

describe("ความสัมพันธ์รายคนและปาร์ตี้", () => {
  it("ทุกปุ่มรายคนเปิดฉากได้ และทุกทางเลือกเล่นได้ไม่พัง", () => {
    for (let pick = 0; pick < 4; pick++) {
      const l = fantasy(21 + pick);
      l.age = 35; l.money = 100_000; l.ft!.bodyRank = 2; l.ft!.magicRank = 2; l.ft!.wand = { name: "ค", quality: 1, material: "ไม้" };
      const kids = [4, 8, 12].map((a) => createPerson(l, "child", { age: a, bond: 70, lastName: l.lastName }));
      const friend = createPerson(l, "friend", { age: 30, bond: 80 });
      const rival = createPerson(l, "rival", { age: 33, bond: 30 });
      const spouse = createPerson(l, "spouse", { age: 34, bond: 70 });
      for (const p of [...kids, friend, rival, spouse, ...l.people.filter((x) => x.relation === "father")]) {
        for (const a of fantasyPersonActions(l, p)) {
          if (a.locked) continue;
          a.run(l);
          const q = l.queue[0];
          if (!q) continue;
          const vis = visibleChoices(l, q);
          const i = Math.min(pick, vis.length - 1);
          expect(() => resolveChoice(l, vis[i].index), `${a.id}`).not.toThrow();
          l.queue = [];
          l.alive = true;
        }
      }
    }
  });
  it("ปาร์ตี้ช่วยสู้ และเต็มที่สามคน", () => {
    const l = fantasy(5);
    l.age = 25;
    const base = combat(l);
    for (let i = 0; i < 4; i++) { const p = createPerson(l, "ally", { age: 25, bond: 70 }); p.tags = [...(p.tags ?? []), "party:warrior"]; }
    expect(combat(l)).toBe(base + 12);
    const f = createPerson(l, "friend", { age: 25, bond: 90 });
    expect(fantasyPersonActions(l, f).find((a) => a.id === "party")?.locked).toBeTruthy();
  });
  it("ทายาทเก็บชื่อของลูกที่สืบต่อไว้", () => {
    const l = fantasy(9);
    l.age = 60;
    const kid = createPerson(l, "child", { age: 30, bond: 80, lastName: l.lastName });
    const next = buildHeir(l, kid.id);
    expect(`${next.firstName} ${next.lastName}`).toBe(kid.name);
  });
});

describe("พลัง: เวท สายอาวุธ และฉายา", () => {
  it("เวทมีครบสี่ขั้นทุกธาตุ และ id เดิมยังเป็นบทเดิม", () => {
    expect(SPELLS.length).toBe(42);
    for (const e of ["fire", "water", "earth", "wind", "light", "dark"]) {
      for (const t of [1, 2, 3, 4]) expect(SPELLS.some((s) => s.element === e && s.tier === t), `${e}${t}`).toBe(true);
      expect(SPELLS.find((s) => s.id === `${e}3`)!.tier).toBe(3);
    }
  });
  it("เป็นนักสู้แล้วต้องเลือกสายอาวุธ ท่าไม้ตายเปิดตามขั้น และเผ่าที่ถนัดได้มากกว่า", () => {
    const l = fantasy(17);
    l.age = 16;
    l.ft!.bodyRank = 1;
    expect(getEvent("ft.style_pick")!.when!(l)).toBe(true);
    l.ft!.style = "axe";
    expect(techsOf(l).length).toBe(1);
    l.ft!.bodyRank = 3;
    expect(techsOf(l).length).toBe(3);
    l.ft!.race = "human";
    const human = styleBonus(l);
    l.ft!.race = "orc";
    expect(styleBonus(l)).toBe(human + 3);
  });
  it("ฉายาตามเรื่องที่ทำ", () => {
    const l = fantasy(19);
    expect(epithetOf(l)).toBeUndefined();
    l.ft!.guild = 5;
    expect(epithetOf(l)).toBe("นักผจญภัยขั้นมิธริล");
    l.ft!.magicRank = 4;
    expect(epithetOf(l)).toBe("อัครจอมเวท");
  });
});

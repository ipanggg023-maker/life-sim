import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { ASSETS, FT_JOB_ACTIONS, assetIncome } from "../content/fantasy/careers";
import { raceOf } from "../content/fantasy/folk";
import { NAMES } from "../content/fantasy/names";
import { combat } from "../content/fantasy/power";
import { CAREERS } from "../content/core/careers";
import { doJobAction, jobActionLocked } from "../content/murim/life/jobActions";
import { ageUp, createLife } from "./game";
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

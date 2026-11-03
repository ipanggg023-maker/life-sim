import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { ASSETS, FT_JOB_ACTIONS, assetIncome } from "../content/fantasy/careers";
import { raceOf } from "../content/fantasy/folk";
import { NAMES } from "../content/fantasy/names";
import { combat } from "../content/fantasy/power";
import { CAREERS } from "../content/core/careers";
import { TALENTS, talentById } from "../content/talents";
import { doJobAction, jobActionLocked } from "../content/murim/life/jobActions";
import { ageUp, createLife, resolveChoice, runEvent, salaryOf } from "./game";
import { visibleChoices } from "./events";
import { buildHeir } from "./soul";
import { fantasyPersonActions } from "../content/fantasy/bonds";
import { SPELLS } from "../content/fantasy/magic";
import { SAGA_LIST } from "../content/fantasy/sagas";
import { mArtsOf } from "../content/fantasy/mschools";
import { MASTER_JOBS } from "../content/fantasy/arcs";
import { BEASTS, homeOf } from "../content/fantasy/world2";
import { epithetOf, styleBonus, techsOf } from "../content/fantasy/styles";
import { allEvents, getEvent } from "./events";
import { CITIES, citiesOf, cityCost, cityOf } from "../content/fantasy/cities";
import { dataOf, worldOfLife } from "../content/fantasy/state";
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

describe("เมือง", () => {
  it("ทุกคนเกิดในเมืองของแผ่นดินตัวเอง และเมืองมีหลายแบบ", () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 80; s++) {
      const l = fantasy(s * 29);
      const c = cityOf(l);
      expect(citiesOf(dataOf(l).kingdoms.find((k) => k.id === l.ft!.kingdom)!).map((x) => x.id)).toContain(c.id);
      kinds.add(c.kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
  });
  it("งานที่ตรงกับเมืองได้ค่าจ้างมากขึ้น และหมู่บ้านป่าค่าครองชีพถูกกว่าเมืองหลวง", () => {
    const l = fantasy(3);
    l.ft!.kingdom = "aldria";
    l.ft!.city = "galven";
    const sailor = CAREERS.find((c) => c.id === "ft_sailor")!;
    const farmer = CAREERS.find((c) => c.id === "ft_farmer")!;
    const port = salaryOf(l, sailor, 1), portFarm = salaryOf(l, farmer, 1);
    l.ft!.city = "irongate";
    expect(port).toBeGreaterThan(salaryOf(l, sailor, 1));
    expect(portFarm / salaryOf(l, farmer, 1)).toBeCloseTo(1);
    l.ft!.kingdom = "thalos"; l.ft!.city = "willowdale";
    const cheap = cityCost(l);
    l.ft!.kingdom = "aldria"; l.ft!.city = "aldria_cap";
    expect(cityCost(l)).toBeGreaterThan(cheap);
  });
  it("ทุกเมืองมีเรื่องของตัวเองอย่างน้อยสองเรื่อง", () => {
    for (const list of Object.values(CITIES)) for (const c of list) {
      const n = allEvents().filter((e) => e.id.startsWith("ft.cy.") && e.when?.({ ...fantasy(1), ft: { ...fantasy(1).ft!, kingdom: Object.keys(CITIES).find((k) => CITIES[k].includes(c))!, city: c.id } } as never)).length;
      expect(n, c.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("งานอดิเรก: สัตว์เลี้ยง ดันเจี้ยน วิหาร", () => {
  const play = (l: ReturnType<typeof fantasy>, id: string, choice = 0) => {
    runEvent(l, id);
    const vis = visibleChoices(l, l.queue[0]);
    resolveChoice(l, vis[Math.min(choice, vis.length - 1)].index);
  };
  it("สัตว์เลี้ยงช่วยตามชนิด แก่ตายตามอายุ และหนีถ้าไม่ดูแล", () => {
    const l = fantasy(31);
    l.age = 20;
    l.ft!.pet = { kind: "wolf", name: "เขี้ยว", bond: 80, born: 20 };
    const base = combat(l);
    l.ft!.pet.bond = 10;
    expect(combat(l)).toBe(base - 3);
    l.ft!.pet = { kind: "cat", name: "หมอก", bond: 60, born: 0 };
    l.age = 18;
    ageUp(l);
    expect(l.ft!.pet).toBeUndefined();
  });
  it("ดันเจี้ยนเลื่อนทีละชั้น ชั้นสุดท้ายได้อาวุธและวีรกรรม", () => {
    const l = fantasy(33);
    l.age = 40; l.ft!.bodyRank = 4; l.ft!.body = 9999; l.stats.health = 100;
    let guard = 0;
    while ((l.ft!.dungeons?.warren ?? 0) < 3 && guard++ < 40 && l.alive) {
      runEvent(l, "ft.h.floor", { dg: "warren" });
      const vis = visibleChoices(l, l.queue[0]);
      resolveChoice(l, vis[0].index);
      l.queue = []; l.stats.health = 100;
    }
    expect(l.ft!.dungeons?.warren).toBe(3);
    expect(l.ft!.deeds).toContain("พิชิตรังก็อบลินใต้เนิน");
    expect(l.ft!.weapon?.quality).toBeGreaterThanOrEqual(1);
  });
  it("ทุกฉากในงานอดิเรกเล่นได้ทุกทางเลือก", () => {
    for (const id of ["ft.h.pet_shop", "ft.h.temple", "ft.h.brew", "ft.h.dice", "ft.h.dungeon", "ft.city.festival"]) {
      for (let i = 0; i < 7; i++) {
        const l = fantasy(40 + i);
        l.age = 30; l.money = 500_000;
        expect(() => play(l, id, i), `${id} ${i}`).not.toThrow();
      }
    }
  });
});

describe("เหตุการณ์ชุดที่สี่", () => {
  it("ทุกเรื่องแสดงชื่อคนจริงได้ ไม่มีช่องว่างค้าง และทุกทางเลือกเล่นได้", () => {
    const evs = allEvents().filter((e) => e.id.startsWith("ft.y."));
    expect(evs.length).toBeGreaterThanOrEqual(160);
    for (const e of evs) {
      for (const i of [0, 1]) {
        const l = fantasy(61);
        l.age = Math.max(e.minAge, Math.min(e.maxAge, 30));
        l.money = 50_000;
        for (const r of ["spouse", "child", "friend", "sibling"] as const) createPerson(l, r, { age: r === "child" ? 8 : 30, bond: 60 });
        runEvent(l, e.id);
        const q = l.queue[0];
        expect(q, e.id).toBeTruthy();
        const text = getEvent(e.id)!.text(l, q.ctx);
        expect(text, e.id).not.toMatch(/\{n\}|\{k\}|undefined/);
        const vis = visibleChoices(l, q);
        const out = resolveChoice(l, vis[Math.min(i, vis.length - 1)].index);
        expect(out?.text ?? "", e.id).not.toMatch(/\{n\}|\{k\}|undefined/);
      }
    }
  });
});

describe("พรสวรรค์ตื่น", () => {
  it("ทุกพรสวรรค์แฟนตาซีมีร่างสว่างและมืด และมีฉากตื่น", () => {
    for (const t of TALENTS.filter((x) => x.world === "fantasy" && !x.noRoll)) {
      expect(talentById(`${t.id}_l`), t.id).toBeTruthy();
      expect(talentById(`${t.id}_d`), t.id).toBeTruthy();
      expect(getEvent(`ft.te.${t.id.slice(3)}`), t.id).toBeTruthy();
    }
  });
  it("ตื่นเมื่อทำสิ่งที่พรสวรรค์รอ เลือกทางแล้วได้ผลจริง และรอได้", () => {
    const l = fantasy(71);
    l.age = 25;
    l.talents = [{ id: "ft_blade", revealed: true }];
    const ev = getEvent("ft.te.blade")!;
    expect(ev.when!(l)).toBe(false);
    l.ft!.bodyRank = 3;
    expect(ev.when!(l)).toBe(true);
    const before = l.ft!.body;
    runEvent(l, "ft.te.blade");
    resolveChoice(l, visibleChoices(l, l.queue[0])[1].index);
    expect(l.talents[0].id).toBe("ft_blade_d");
    expect(l.ft!.body).toBeGreaterThan(before + 100);
    expect(l.flags.ftEvolved).toBe(1);
    const m = fantasy(72);
    m.age = 25; m.talents = [{ id: "ft_lucky", revealed: true }];
    m.flags.lossAge = 25;
    expect(getEvent("ft.te.lucky")!.when!(m)).toBe(true);
    runEvent(m, "ft.te.lucky");
    resolveChoice(m, visibleChoices(m, m.queue[0])[2].index);
    expect(getEvent("ft.te.lucky")!.when!(m)).toBe(false);
  });
});

describe("มหากาพย์ตำนาน", () => {
  it("เริ่มจากเรื่องบังเอิญ ไปต่อทีละบท และจบด้วยรางวัลกับชื่อในตำนาน", () => {
    for (const s of SAGA_LIST) {
      const l = fantasy(81);
      l.age = 30; l.money = 1_000_000; l.ft!.bodyRank = 4; l.ft!.magicRank = 4; l.ft!.body = 9999;
      for (const k of ["health", "smarts", "looks", "luck"] as const) l.stats[k] = 100;
      runEvent(l, `ft.sgh.${s.id}`);
      resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
      l.queue = [];
      expect(l.ft!.sagas?.[s.id], s.id).toBe(0);
      let guard = 0;
      while ((l.ft!.sagas?.[s.id] ?? 0) < 99 && guard++ < 60 && l.alive) {
        l.stats.health = 100;
        runEvent(l, `ft.sg.${s.id}`);
        const vis = visibleChoices(l, l.queue[0]);
        expect(vis.length, `${s.id} บท ${l.ft!.sagas?.[s.id]}`).toBeGreaterThan(1);
        resolveChoice(l, vis[0].index);
        l.queue = [];
      }
      expect(l.ft!.sagas?.[s.id], s.id).toBe(99);
      expect(l.ft!.deeds).toContain(s.legend);
      expect(worldOfLife(l).legends.some((g) => g.deed === s.legend)).toBe(true);
    }
  });
  it("ตามรอยตำนานได้ปีละครั้ง และมีพร้อมกันได้ไม่เกินสามเรื่อง", () => {
    const l = fantasy(83);
    l.age = 25;
    l.ft!.sagas = { blackwyrm: 0, feyqueen: 1, ancestor: 0 };
    expect(getEvent("ft.sgh.starfall")!.when!(l)).toBe(false);
    runEvent(l, "ft.sg.pick");
    expect(visibleChoices(l, l.queue[0]).length).toBe(4);
  });
});

describe("เรื่องของมังกร", () => {
  it("ทุกเรื่องใช้ชื่อมังกรจริง ไม่มีช่องว่างค้าง และเล่นได้ทุกทาง", () => {
    const evs = allEvents().filter((e) => e.id.startsWith("ft.dt."));
    expect(evs.length).toBeGreaterThanOrEqual(30);
    for (const e of evs) for (const i of [0, 1, 2]) {
      const l = fantasy(91);
      l.age = 30; l.money = 100_000;
      l.ft!.whelp = { name: "ไซรัส", element: "fire", age: 8, bond: 60, power: 30, lastCare: 30, from: "x" };
      l.ft!.mount = "whelp"; l.ft!.dragonblood = true; l.ft!.dragonBond = 20;
      l.ft!.dBonds = { valgrias: 50 };
      runEvent(l, e.id);
      const q = l.queue[0];
      expect(q, e.id).toBeTruthy();
      expect(getEvent(e.id)!.text(l, q.ctx), e.id).not.toMatch(/\{[dtew]\}|undefined/);
      const vis = visibleChoices(l, q);
      const out = resolveChoice(l, vis[Math.min(i, vis.length - 1)].index);
      expect(out?.text ?? "", e.id).not.toMatch(/\{[dtew]\}|undefined/);
    }
  });
});

describe("ศาสตร์แห่งเวท", () => {
  it("เลือกเมื่อเป็นนักเวท วิชาเปิดตามขั้น และแต่ละศาสตร์ให้ผลต่างกัน", () => {
    const l = fantasy(101);
    l.age = 25; l.ft!.wand = { name: "ค", quality: 1, material: "ไม้" }; l.ft!.magicRank = 2;
    expect(getEvent("ft.ms.pick")!.when!(l)).toBe(true);
    l.ft!.mschool = "summon";
    expect(mArtsOf(l).length).toBe(1);
    const base = combat(l);
    l.ft!.magicRank = 4;
    expect(mArtsOf(l).length).toBe(3);
    expect(combat(l)).toBeGreaterThan(base);
    l.ft!.mschool = "time"; l.ft!.potential = 2;
    runEvent(l, "ft.ms.pick");
    const vis = visibleChoices(l, l.queue[0]);
    expect(vis.length).toBeGreaterThanOrEqual(6);
  });
  it("ทุกฉากของศาสตร์เวทเล่นได้", () => {
    for (const s of ["death", "time", "summon", "healing", "illusion", "elemental"] as const) for (const id of ["ft.ms.inquisitor", "ft.ms.time_echo", "ft.ms.summon_wild", "ft.ms.plague_heal", "ft.ms.illusion_heist", "ft.ms.element_storm"]) {
      const l = fantasy(103);
      l.age = 30; l.ft!.wand = { name: "ค", quality: 1, material: "ไม้" }; l.ft!.magicRank = 4; l.ft!.mschool = s;
      runEvent(l, id);
      const vis = visibleChoices(l, l.queue[0]);
      expect(() => resolveChoice(l, vis[0].index), `${s} ${id}`).not.toThrow();
    }
  });
});

describe("เส้นเรื่องยาว: งานชิ้นเอก ลูก รัก งานแต่ง", () => {
  it("ทุกอาชีพมีงานชิ้นเอกเมื่อถึงตำแหน่งสูงสุด", () => {
    for (const c of CAREERS.filter((x) => x.world === "fantasy")) {
      expect(MASTER_JOBS, c.id).toContain(c.id);
      const l = fantasy(111);
      l.age = 40; l.job = { careerId: c.id, level: 5, years: 10, performance: 80 };
      const ev = getEvent(`ft.mp.${c.id.slice(3)}`)!;
      expect(ev.when!(l), c.id).toBe(true);
      l.job.level = 4;
      expect(ev.when!(l), c.id).toBe(false);
    }
  });
  it("ลูกที่ได้สอนดาบสามครั้งออกเดินทางเป็นอัศวิน", () => {
    const l = fantasy(113);
    l.age = 45;
    const k = createPerson(l, "child", { age: 19, bond: 70, lastName: l.lastName });
    k.tags = [...(k.tags ?? []), "taught_body:3"];
    runEvent(l, "ft.ar.destiny");
    resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    expect(k.job).toBe("อัศวินหนุ่ม");
  });
  it("รักต่างเผ่าได้คู่เผ่านั้น และงานแต่งเป็นไปตามประเพณีของเผ่า", () => {
    const l = fantasy(115);
    l.age = 25; l.stats.looks = 100;
    runEvent(l, "ft.ar.love_dwarf");
    resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    const p = l.people.find((x) => x.relation === "partner")!;
    expect(raceOf(p)).toBe("dwarf");
    p.relation = "spouse";
    runEvent(l, "ft.ar.wedding");
    expect(getEvent("ft.ar.wedding")!.text(l, l.queue[0].ctx)).toContain("โถงหิน");
    resolveChoice(l, visibleChoices(l, l.queue[0])[1].index);
    expect(getEvent("ft.ar.wedding")!.when!(l)).toBe(false);
  });
});

describe("ลาง ภารกิจเมือง สัตว์ในตำนาน และบ้าน", () => {
  it("ลางเกิดขึ้นในโลก และผู้เล่นเห็นครั้งเดียวต่อลาง", () => {
    const l = fantasy(121);
    let seen = 0;
    for (let y = 0; y < 80 && l.alive; y++) {
      ageUp(l);
      while (l.queue.length && l.alive) { if (l.queue[0].eventId === "ft.om.seen") seen++; resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); }
    }
    expect(seen).toBeGreaterThan(0);
  });
  it("กระดานมีสามงานไม่ซ้ำกันทุกปี ล่าสัตว์ตำนานได้ครั้งเดียว และบ้านขยายทีละขั้น", () => {
    const l = fantasy(123);
    l.age = 30; l.money = 1_000_000; l.ft!.bodyRank = 4; l.ft!.body = 9999;
    runEvent(l, "ft.w2.board");
    const labels = visibleChoices(l, l.queue[0]).map((v) => v.index);
    expect(labels.length).toBe(4);
    resolveChoice(l, labels[0]); l.queue = [];
    for (let i = 0; i < 20 && !l.ft!.trophies?.length; i++) { l.stats.health = 100; runEvent(l, "ft.w2.hunt", { bs: "stag" }); resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); l.queue = []; }
    expect(l.ft!.trophies).toContain("เขากวางทองคำ");
    runEvent(l, "ft.w2.beasts");
    expect(visibleChoices(l, l.queue[0]).length).toBe(BEASTS.length);
    l.queue = [];
    runEvent(l, "ft.w2.home");
    resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    expect(homeOf(l).name).toBe("กระท่อมของตัวเอง");
  });
});

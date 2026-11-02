import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { artProject, createLocked, openCreate, setStyle, styleLocked } from "../content/murim/martial/creation";
import { addQi, artInfo, artsOf, learnRate, martialBonus, qiYears, styleOf, tickMartial } from "../content/murim/martial/arts";
import { TRAIN_MODES, trainArt } from "../content/murim/martial/training";
import { worldOfLife } from "../content/murim/life/world";
import { inheritMurim } from "../content/murim/life/generations";
import { buildHeir } from "./soul";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, kill, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson } from "./util";

loadMurimWorld();
loadSharedEvents();

const fighter = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "murim", gender: "m" });
  worldOfLife(l);
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 100; l.stats.smarts = 90;
  l.power = { rank: 3, hunterClass: "m_sword", level: 5, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 15, items: [] };
  l.flags.mwComp = 80;
  artsOf(l).push({ id: "a_long_fist", m: 60, src: "ครูฝึก", since: 15 }, { id: "a_basic_sword", m: 60, src: "ครูฝึก", since: 15 });
  return l;
};
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}`).toBeTruthy();
  o!.c.run(l, q.ctx, ok);
  l.queue.shift();
};

describe("คิดค้นวิชาเอง", () => {
  it("ต้องถึงเกณฑ์จึงเริ่มได้", () => {
    expect(createLocked(fighter(1))).toBeUndefined();
    expect(createLocked(fighter(2, 20))).toBeTruthy();
    const weak = fighter(3); artsOf(weak)[0].m = 10;
    expect(createLocked(weak)).toContain("ชำนาญใหญ่");
  });

  it("เลือกแนว ค้นคว้าหลายปี แล้วตั้งชื่อได้วิชาจริงที่ติดตัว", () => {
    const l = fighter(4);
    openCreate(l);
    force(l, "มุ่งไปทางกระบี่");
    expect(artProject(l)?.type).toBe("sword");
    let years = 0;
    while (artProject(l) && Number(l.flags.artProj) < 100 && years++ < 20) {
      l.doneThisYear = [];
      openCreate(l);
      force(l, "ทดลองทีละท่า");
    }
    expect(years).toBeGreaterThan(1);
    expect(getEvent("mw.art.name")!.when!(l)).toBe(true);
    runEvent(l, "mw.art.name");
    visibleChoices(l, l.queue[0])[0].c.run(l, l.queue[0].ctx, true);
    l.queue = [];
    expect(l.flags.createdArt).toBeTruthy();
    const own = artsOf(l).find((a) => a.own)!;
    expect(artInfo(own).name).toBe(l.flags.createdArt);
    expect(createLocked(l)).toContain("คิดค้น");
  });

  it("ค้นคว้าครบ 100 แล้วฉากตั้งชื่อขึ้นเองตอนขึ้นปี", () => {
    const l = fighter(8);
    l.flags.artProjType = "palm"; l.flags.artProj = 100;
    ageUp(l);
    expect(l.queue.some((q) => q.eventId === "mw.art.name")).toBe(true);
  });

  it("เหตุการณ์สุ่มแบบเก่าไม่สร้างวิชาซ้ำ", () => {
    const l = fighter(5);
    l.flags.createdArt = "x";
    const w = getEvent("mw.art.create")!.weight;
    expect(typeof w === "function" ? w(l) : w).toBe(0);
  });

  it("ทางเสี่ยงพลาดแล้วบาดเจ็บจริง", () => {
    const l = fighter(6);
    l.flags.artProjType = "sword"; l.flags.artProj = 10;
    openCreate(l);
    const hp = l.stats.health;
    force(l, "เดินลมปราณ", false);
    expect(l.stats.health).toBeLessThan(hp);
  });

  it("วิชาที่คิดค้นเองตกทอดถึงทายาทได้เมื่อเขียนตำรา", () => {
    const l = fighter(7, 60);
    artsOf(l).push({ id: "own_40", m: 90, src: "คิดค้นเอง", since: 40, own: { name: "เพลงกระบี่ไร้นาม", type: "sword", school: "neutral" } });
    for (const a of artsOf(l)) if (!a.own) a.m = 20;
    l.flags.wroteManual = true;
    const k = createPerson(l, "child", { age: 30, gender: "m", bond: 80, lastName: l.lastName });
    l.flags.heirId = k.id;
    kill(l, "ชราภาพ");
    const next = buildHeir(l, k.id);
    inheritMurim(l, next, "heir", k.id);
    expect(artsOf(next).some((a) => a.own?.name === "เพลงกระบี่ไร้นาม")).toBe(true);
  });
});

describe("ฝึกกับคนอื่น", () => {
  const mode = TRAIN_MODES.find((m) => m.id === "partner")!;
  it("ต้องมีคนที่มีวิชา ทั้งสองฝ่ายได้ประโยชน์", () => {
    const l = fighter(10);
    expect(mode.req!(l, "a_long_fist")).toBeTruthy();
    const p = createPerson(l, "friend", { age: 30, bond: 50 });
    p.martial = { rank: 2, style: "กระบี่", xp: 0 };
    expect(mode.req!(l, "a_long_fist")).toBeUndefined();
    const m0 = artsOf(l)[0].m;
    trainArt(l, "a_long_fist", "partner");
    expect(artsOf(l)[0].m).toBeGreaterThan(m0);
    expect(p.bond).toBeGreaterThan(50);
    expect(p.martial.xp).toBeGreaterThan(0);
  });
});

describe("ทางวิชา", () => {
  it("แต่ละทางมีผลจริง", () => {
    const base = fighter(20), might = fighter(20), mind = fighter(20);
    setStyle(might, "might"); setStyle(mind, "mind");
    expect(styleOf(might)).toBe("might");
    expect(martialBonus(might)).toBe(martialBonus(base) + 2);
    expect(learnRate(mind)).toBeGreaterThan(learnRate(base));
    const qi = fighter(21), plain = fighter(21);
    setStyle(qi, "qi");
    tickMartial(qi); tickMartial(plain);
    expect(qiYears(qi)).toBeGreaterThan(qiYears(plain));
    void addQi;
  });
  it("เปลี่ยนได้ทุก 5 ปี", () => {
    const l = fighter(22);
    setStyle(l, "swift");
    expect(styleLocked(l)).toContain("5");
    setStyle(l, "might");
    expect(styleOf(l)).toBe("swift");
    l.age += 5;
    expect(styleLocked(l)).toBeUndefined();
    setStyle(l, "might");
    expect(styleOf(l)).toBe("might");
  });
  it("ขึ้นปีได้ตามปกติ", () => {
    const l = fighter(23);
    setStyle(l, "mind");
    ageUp(l);
    expect(l.alive).toBe(true);
  });
});

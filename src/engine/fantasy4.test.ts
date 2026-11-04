import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { addBond, aliveDragons, bondOf, release } from "../content/fantasy/dragons";
import { closeLife, inheritLife, setRace } from "../content/fantasy/life";
import { combat, magicCap } from "../content/fantasy/power";
import { dataOf, ensureSociety, fl, newFantasyWorld, worldOfLife } from "../content/fantasy/state";
import { tickWorld } from "../content/fantasy/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { lifespanHooks } from "./game";
import { nextFloat } from "./rng";
import type { Life, Soul } from "./types";
import { validateLife } from "./validate";

loadFantasyWorld();

const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  setRace(l, "human");
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.stats.smarts = 70; l.stats.looks = 70; l.stats.luck = 70;
  fl(l).wand = { name: "ค", quality: 1, material: "ไม้" };
  fl(l).dragonBond = 0; // ตัดผลพรสวรรค์ที่สุ่มได้ตอนเกิด ให้วัดแต่ความผูกพันที่ทดสอบ
  return l;
};
const labels = (l: Life) => visibleChoices(l, l.queue[0]).map((x) => labelOf(x.c, l, l.queue[0].ctx));
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).includes(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}: ${labels(l).join(" / ")}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  // ฉากที่มีจังหวะต่อ (เช่น คำเตือนก่อนสู้มังกร) ไปต่อด้วยทางเลือกชื่อเดิม
  if (out.next) { q.scene = out.next; return force(l, start, ok); }
  l.queue.shift();
  return out;
};
const meet = (l: Life, id: string) => runEvent(l, "ft.dragon_meet", { dg: id });

describe("สังคมมังกร", () => {
  it("มีห้าตัว ห้าธาตุ และเลือกได้ว่าจะไปหาตัวไหน", () => {
    const l = life(1);
    expect(aliveDragons(l).length).toBe(5);
    expect(new Set(aliveDragons(l).map((d) => d.element)).size).toBe(5);
    runEvent(l, "ft.d.choose");
    force(l, "เนริธ");
    expect(l.queue[0].ctx.dg).toBe("nerith");
  });
  it("ฆ่าตัวหนึ่ง ตัวอื่นโกรธ และมีพิธีเลือดมังกร", () => {
    const l = life(2);
    const other = dataOf(l).dragons[1];
    const mood = other.mood;
    meet(l, "sylphae");
    force(l, "ท้าสู้");
    expect(dataOf(l).dragons.find((d) => d.id === "sylphae")!.alive).toBe(false);
    expect(other.mood).toBe(mood - 10);
    expect(l.queue[0].eventId).toBe("ft.d.blood");
    force(l, "อาบเลือด");
    expect(fl(l).dragonblood).toBe(true);
    expect(lifespanHooks.reduce((s, h) => s + h(l), 0)).toBe(30);
  });
  it("ผูกมิตรแยกตามตัว เรียนภาษามังกรได้เวทขั้นสาม", () => {
    const l = life(3);
    addBond(l, dataOf(l).dragons[0], 60);
    expect(bondOf(l, dataOf(l).dragons[0])).toBe(60);
    expect(bondOf(l, dataOf(l).dragons[1])).toBe(0);
    meet(l, "valgrias");
    force(l, "ขอเรียนภาษามังกร");
    expect(fl(l).spells).toContain("fire3");
    meet(l, "valgrias");
    expect(labels(l).some((x) => x.includes("ขอเรียนภาษามังกร"))).toBe(false);
  });
  it("แตรมังกรทำให้ผูกพันเร็วขึ้นสองเท่า", () => {
    const l = life(4);
    fl(l).relic = "dragonhorn";
    addBond(l, dataOf(l).dragons[0], 10);
    expect(bondOf(l, dataOf(l).dragons[0])).toBe(20);
  });
});

describe("ไข่และลูกมังกร", () => {
  const withEgg = (seed: number) => {
    const l = life(seed);
    dataOf(l).eggs.push({ mother: "nerith", element: "water", laid: 0 });
    return l;
  };
  it("ขอไข่ได้เมื่อผูกพันมาก ลักไข่ได้แต่แม่ตามมา", () => {
    const a = withEgg(5);
    addBond(a, dataOf(a).dragons[1], 85);
    meet(a, "nerith");
    force(a, "ขอไข่");
    expect(fl(a).egg?.element).toBe("water");
    expect(dataOf(a).eggs.length).toBe(0);
    const b = withEgg(6);
    meet(b, "nerith");
    expect(labels(b).some((x) => x.includes("ขอไข่"))).toBe(false);
    force(b, "ลักไข่");
    expect(fl(b).dragonFoe).toBe("nerith");
    expect(getEvent("ft.d.vengeance")!.when!(b)).toBe(true);
    runEvent(b, "ft.d.vengeance", { dg: "nerith" });
    force(b, "คืนไข่");
    expect(fl(b).egg).toBeUndefined();
    expect(dataOf(b).eggs.length).toBe(1);
  });
  it("ไข่ฟักเมื่ออุ่นครบ และเย็นตายถ้าทิ้งสามปี", () => {
    const l = life(7);
    fl(l).egg = { element: "fire", warmth: 0, from: "valgrias", lastCare: l.age };
    for (let i = 0; i < 4; i++) { runEvent(l, "ft.d.egg"); force(l, "อุ่นไว้"); }
    expect(fl(l).egg).toBeUndefined();
    expect(fl(l).whelp?.element).toBe("fire");
    const keep = life(14);
    fl(keep).whelp = { name: "เดิม", element: "earth", age: 5, bond: 70, power: 30, lastCare: keep.age, from: "korvath" };
    fl(keep).egg = { element: "fire", warmth: 3, from: "valgrias", lastCare: keep.age };
    runEvent(keep, "ft.d.egg"); force(keep, "อุ่นไว้");
    expect(fl(keep).whelp!.name).toBe("เดิม");
    expect(fl(keep).egg?.warmth).toBe(4);
    const c = life(8);
    fl(c).egg = { element: "fire", warmth: 0, from: "valgrias", lastCare: c.age };
    for (let i = 0; i < 3; i++) { c.queue = []; ageUp(c); }
    expect(fl(c).egg).toBeUndefined();
  });
  it("ลูกมังกรโต ช่วยสู้ ขี่ได้เมื่อโต และหนีไปถ้าถูกทิ้ง", () => {
    const l = life(9);
    const base = combat(l);
    fl(l).whelp = { name: "ไซรัส", element: "fire", age: 6, bond: 95, power: 50, lastCare: l.age, from: "valgrias" };
    expect(combat(l)).toBeGreaterThan(base);
    runEvent(l, "ft.d.whelp");
    force(l, "ลองขี่");
    expect(fl(l).mount).toBe("whelp");
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_fly")!)).toBeUndefined();
    const n = life(10);
    fl(n).whelp = { name: "อิกนิส", element: "fire", age: 2, bond: 10, power: 20, lastCare: n.age, from: "valgrias" };
    const count = dataOf(n).dragons.length;
    for (let i = 0; i < 4; i++) { n.queue = []; ageUp(n); }
    expect(fl(n).whelp).toBeUndefined();
    expect(dataOf(n).dragons.length).toBe(count + 1);
  });
  it("ตายแล้วลูกมังกรกลับสู่โลก และจำครอบครัวได้ ไข่ส่งต่อให้ลูก", () => {
    const l = life(11);
    fl(l).whelp = { name: "ออรัม", element: "earth", age: 12, bond: 80, power: 60, lastCare: l.age, from: "korvath" };
    fl(l).egg = { element: "water", warmth: 2, from: "nerith", lastCare: l.age };
    const soul = { fantasyWorld: undefined } as unknown as Soul;
    closeLife(soul, l);
    const d = (soul.fantasyWorld!.data as unknown as ReturnType<typeof dataOf>).dragons.find((x) => x.name === "ออรัม")!;
    expect(d.kin).toBe(l.lastName);
    const heir = createLife({ seed: 12, worldId: "fantasy" });
    heir.lastName = l.lastName;
    inheritLife(l, heir);
    expect(fl(heir).egg?.warmth).toBe(2);
    expect(bondOf(heir, d)).toBeGreaterThanOrEqual(40);
  });
  it("ปล่อยลูกมังกรที่ไม่ผูกพัน มันจำใครไม่ได้", () => {
    const l = life(13);
    release(worldOfLife(l), l, { name: "x", element: "wind", age: 3, bond: 0, power: 20, lastCare: 0, from: "sylphae" }, "หนีไป");
    expect(dataOf(l).dragons.at(-1)!.kin).toBeUndefined();
  });
});

describe("อาวุธตำนานชุดใหม่", () => {
  it("มีแปดชิ้น และเซฟเก่าได้ชิ้นใหม่กับฝูงมังกร", () => {
    const l = life(20);
    expect(dataOf(l).relics.length).toBe(8);
    const data = worldOfLife(l).data as Record<string, unknown>;
    data.relics = (data.relics as { id: string }[]).slice(0, 3);
    data.dragon = { name: "วาลเกรียส", title: "เก่า", home: "varn", age: 1234, mood: 0, alive: true };
    delete data.dragons; delete data.eggs;
    expect(dataOf(l).relics.length).toBe(8);
    expect(dataOf(l).dragons[0].age).toBe(1234);
    expect(dataOf(l).dragons.length).toBe(5);
    expect(data.dragon).toBeUndefined();
  });
  it("คทาเพิ่มเพดานเวท แหวนให้ด้ายชะตาครั้งเดียว", () => {
    const l = life(21);
    const cap = magicCap(l);
    fl(l).relic = "embersoul";
    expect(magicCap(l)).toBe(Math.min(4, cap + 1));
    const r = life(22);
    const ring = dataOf(r).relics.find((x) => x.id === "phoenixring")!;
    fl(r).clues[ring.id] = 3;
    const t = fl(r).threads;
    runEvent(r, "ft.legend_trail", { relic: ring.id });
    force(r, "ค้นบันทึก");
    force(r, "ยื่นมือ");
    expect(fl(r).threads).toBe(t + 1);
    expect(ring.history?.at(-1)).toContain(r.firstName);
  });
  it("ดาบโศกาดูดความสุขทุกปี และปล่อยมือยาก", () => {
    const l = life(23);
    fl(l).relic = "grief";
    dataOf(l).relics.find((x) => x.id === "grief")!.holder = "player";
    const j = l.stats.happiness;
    ageUp(l); l.queue = [];
    expect(l.stats.happiness).toBeLessThan(j);
    runEvent(l, "ft.relic_drop");
    expect(labels(l).some((x) => x.startsWith("วางคืนแท่น"))).toBe(false);
    force(l, "ฝืนแกะนิ้ว");
    expect(fl(l).relic).toBeUndefined();
  });
  it("วางอาวุธคืนแท่นแล้วตามหาชิ้นใหม่ได้", () => {
    const l = life(24);
    fl(l).relic = "veilcutter";
    dataOf(l).relics[0].holder = "player";
    const a = activitiesFor(l).find((x) => x.id === "ft_legend")!;
    expect(activityLocked(l, a)).toBeTruthy();
    doActivity(l, "ft_relic_drop");
    force(l, "วางคืนแท่น");
    expect(dataOf(l).relics[0].holder).toBe("lost");
    expect(activityLocked(l, a)).toBeUndefined();
  });
});

describe("ตำนานที่ถูกเล่าซ้ำ", () => {
  it("ยิ่งเล่ายิ่งเกินจริง และตามรอยได้เบาะแส", () => {
    const l = life(30);
    const w = worldOfLife(l);
    w.legends.push({ name: "อัลดริค", deed: "สังหารมังกรวาลเกรียส", lifeId: "old", year: 900, retold: 0 });
    expect(getEvent("ft.legend_tale")!.when!(l)).toBe(true);
    const plain = getEvent("ft.legend_tale")!.text(l, { g: 0 });
    w.legends[0].retold = 5;
    const tall = getEvent("ft.legend_tale")!.text(l, { g: 0 });
    expect(tall.length).toBeGreaterThan(plain.length);
    runEvent(l, "ft.legend_tale", { g: 0 });
    force(l, "ตามรอย");
    expect(Object.values(fl(l).clues).reduce((a, b) => a + b, 0)).toBe(1);
  });
  it("ตำนานของตัวเองไม่ถูกเล่าให้ตัวเองฟัง", () => {
    const l = life(31);
    worldOfLife(l).legends.push({ name: "ตัวเอง", deed: "x", lifeId: l.id, year: 1, retold: 0 });
    expect(getEvent("ft.legend_tale")!.when!(l)).toBe(false);
  });
});

describe("โลกมังกร 1,000 ปี", () => {
  it("มังกรตาย เกิดใหม่ วางไข่ และไม่ล้นหรือสูญพันธุ์ถาวร", () => {
    const w = newFantasyWorld(9, 1000), d = ensureSociety(w), r = { rng: 31 };
    let hatched = 0, minAlive = 99, maxAlive = 0, slain = 0;
    const names = new Set<string>();
    for (let y = 0; y < 1000; y++) {
      w.year++; tickWorld(w, r);
      const alive = d.dragons.filter((x) => x.alive);
      minAlive = Math.min(minAlive, alive.length); maxAlive = Math.max(maxAlive, alive.length);
      for (const x of d.dragons) { if (!names.has(x.id) && x.age <= 1) hatched++; names.add(x.id); }
      expect(d.dragons.length).toBeLessThanOrEqual(13);
    }
    slain = w.chronicle.filter((c) => /สังหารมังกร|ฆ่ามังกร|ไม่ได้กลับลงมา/.test(c.text)).length;
    expect(hatched).toBeGreaterThan(2);
    expect(maxAlive).toBeLessThanOrEqual(8);
    expect(minAlive).toBeGreaterThan(0);
    expect(slain + hatched).toBeGreaterThan(3);
  });
});

describe("เล่นจริง", () => {
  it("100 ชีวิตสุ่มรวมมังกร ไม่พัง", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 100; s++) {
      const l = createLife({ seed: s * 67, worldId: "fantasy" });
      const r = { rng: s };
      const drain = () => { let g = 0; while (l.queue.length && l.alive && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); } };
      for (let i = 0; i < 500 && l.alive; i++) {
        for (const a of activitiesFor(l)) if (l.alive && !activityLocked(l, a) && nextFloat(r) < 0.3) { doActivity(l, a.id); drain(); }
        if (l.alive) { ageUp(l); drain(); }
      }
      expect(validateLife(l), `seed ${s}`).toEqual([]);
      for (const k of Object.keys(l.seen)) seen.add(k);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
    }
    for (const id of ["ft.d.choose", "ft.dragon_meet"]) expect(seen.has(id), id).toBe(true);
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(186);
  }, 300_000);
});

import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { bondOf } from "../content/fantasy/dragons";
import { canRewind, closeLife, RACES, RARE_RACES, setRace } from "../content/fantasy/life";
import { canEnter, godly } from "../content/fantasy/realms";
import { canCast, combat } from "../content/fantasy/power";
import { dataOf, ensureSociety, fl, newFantasyWorld, standingOf, worldOfLife } from "../content/fantasy/state";
import { tickWorld } from "../content/fantasy/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, lifespanHooks, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life, Soul } from "./types";
import { validateLife } from "./validate";

loadFantasyWorld();

const life = (seed: number, race: keyof typeof RACES = "human", age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  setRace(l, race);
  l.age = age; l.queue = []; l.money = 900_000; l.stats.health = 95; l.stats.smarts = 80; l.stats.looks = 80; l.stats.luck = 70;
  return l;
};
const labels = (l: Life) => visibleChoices(l, l.queue[0]).map((x) => labelOf(x.c, l, l.queue[0].ctx));
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).includes(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}: ${labels(l).join(" / ")}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  l.queue.shift();
  return out;
};
const years = (l: Life) => lifespanHooks.reduce((s, h) => s + h(l), 0);

describe("เผ่าหายาก", () => {
  it("เกิดได้แต่หายาก ราวหนึ่งถึงสามในร้อย", () => {
    let rare = 0;
    for (let s = 1; s <= 2000; s++) if (RARE_RACES.includes(fl(createLife({ seed: s * 3, worldId: "fantasy" })).race)) rare++;
    expect(rare).toBeGreaterThan(10);
    expect(rare).toBeLessThan(70);
  });
  it("มังกรร่ายเวทได้เอง เด็กอ่อนแอ แก่แล้วแกร่ง และมังกรทุกตัวนับเป็นญาติ", () => {
    const young = life(1, "dragon", 10), old = life(1, "dragon", 300), human = life(1, "human", 300);
    expect(canCast(young)).toBe(true);
    expect(combat(old) - combat(human)).toBeGreaterThanOrEqual(40);
    expect(combat(young) - combat(life(1, "human", 10))).toBeLessThanOrEqual(5);
    expect(bondOf(young, dataOf(young).dragons[0])).toBeGreaterThanOrEqual(40);
    expect(standingOf(young)).toBe(-25);
    expect(years(young)).toBe(400);
  });
  it("ทายาทปีศาจถูกระแวงหนักและศาสนจักรไม่รับ", () => {
    const d = life(2, "demon");
    expect(standingOf(d)).toBe(-40);
    expect(canCast(d)).toBe(true);
    runEvent(d, "ft.f.join");
    const dawn = visibleChoices(d, d.queue[0]).find((x) => labelOf(x.c, d, d.queue[0].ctx).includes("ศาสนจักรอรุณ"))!;
    const silverless = visibleChoices(d, d.queue[0]).find((x) => labelOf(x.c, d, d.queue[0].ctx).includes("สมาคมทองคำ"))!;
    expect(dawn.c.odds!(d, d.queue[0].ctx)).toBeLessThan(silverless.c.odds!(d, d.queue[0].ctx));
  });
  it("เผ่าหายากเลือกเองไม่ได้ ต้องเกิดมาเป็น", () => {
    const l = createLife({ seed: 9, worldId: "fantasy" });
    const born = fl(l).race;
    expect(l.flags.ftBornRace).toBe(born);
  });
  it("เรื่องของเผ่าหายากเกิดเฉพาะเผ่านั้น", () => {
    expect(getEvent("ft.r.dragon_hunter")!.when!(life(3, "dragon"))).toBe(true);
    expect(getEvent("ft.r.dragon_hunter")!.when!(life(3, "human"))).toBe(false);
    expect(getEvent("ft.r.demon_paladin")!.when!(life(3, "demon"))).toBe(true);
  });
});

describe("ประตูและภพอื่น", () => {
  it("คนธรรมดาเข้าไม่ได้จนกว่าจะมีประตูเปิดในแผ่นดินตัวเอง", () => {
    const l = life(10);
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_gate")!)).toBeTruthy();
    dataOf(l).gates.push({ realm: "demon", kingdom: fl(l).kingdom, until: worldOfLife(l).year + 3 });
    expect(canEnter(l, "demon")).toBe(true);
    expect(canEnter(l, "dragon")).toBe(false);
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_gate")!)).toBeUndefined();
    doActivity(l, "ft_gate");
    force(l, "ภพปีศาจ");
    expect(l.queue[0].eventId).toBe("ft.v.demon");
    expect(fl(l).realmVisits?.demon).toBe(1);
  });
  it("พันธสัญญาให้พลังแต่กินอายุขัยจริง", () => {
    const l = life(11, "demon");
    const y = years(l), m = fl(l).magic;
    runEvent(l, "ft.v.demon");
    force(l, "ทำพันธสัญญา");
    expect(fl(l).magic).toBe(m + 60);
    expect(years(l)).toBe(y - 10);
    for (let i = 0; i < 2; i++) { runEvent(l, "ft.v.demon"); force(l, "ทำพันธสัญญา"); }
    runEvent(l, "ft.v.demon");
    expect(labels(l).some((x) => x.includes("ทำพันธสัญญา"))).toBe(false);
  });
  it("พิธีแปลงกายเปลี่ยนคนที่มีเลือดมังกรให้เป็นมังกร", () => {
    const l = life(12);
    fl(l).dragonblood = true;
    expect(canEnter(l, "dragon")).toBe(true);
    runEvent(l, "ft.v.dragon");
    force(l, "พิธีแปลงกาย");
    expect(fl(l).race).toBe("dragon");
    expect(canCast(l)).toBe(true);
    runEvent(l, "ft.v.dragon");
    expect(labels(l).some((x) => x.includes("พิธีแปลงกาย"))).toBe(false);
  });
  it("ทะเลสาบเกล็ดทองเพิ่มอายุได้ครั้งเดียว", () => {
    const l = life(13);
    const y = years(l);
    runEvent(l, "ft.v.dragon");
    force(l, "ดื่มน้ำ");
    expect(years(l)).toBe(y + 20);
    runEvent(l, "ft.v.dragon");
    expect(labels(l).some((x) => x.includes("ดื่มน้ำ"))).toBe(false);
  });
  it("ประตูเปิดเองในโลก ไม่เกินสองบาน และปิดเมื่อหมดเวลา", () => {
    const w = newFantasyWorld(5, 1000), d = ensureSociety(w), r = { rng: 3 };
    let opened = 0;
    for (let y = 0; y < 400; y++) { w.year++; tickWorld(w, r); expect(d.gates.length).toBeLessThanOrEqual(2); opened = Math.max(opened, w.chronicle.filter((c) => c.text.startsWith("ประตูสู่")).length); }
    expect(opened).toBeGreaterThan(2);
    expect(d.gates.every((g) => g.until >= w.year)).toBe(true);
  });
});

describe("ความเป็นเทพ", () => {
  const great = (seed: number) => { const l = life(seed); const f = fl(l); f.bodyRank = 4; f.body = 900; l.fame = 80; f.deeds.push("1", "2", "3", "4", "5"); return l; };
  it("สรวงสวรรค์เปิดเฉพาะคนที่ยิ่งใหญ่จริง", () => {
    expect(godly(life(20))).toBe(false);
    expect(godly(great(21))).toBe(true);
  });
  it("ผ่านสามบททดสอบแล้วขึ้นเป็นเทพ ชีวิตจบ และโลกมีเทพองค์ใหม่", () => {
    const l = great(22);
    runEvent(l, "ft.v.divine"); force(l, "บททดสอบแห่งกำลัง");
    runEvent(l, "ft.v.divine"); force(l, "บททดสอบแห่งปัญญา");
    runEvent(l, "ft.v.divine");
    expect(labels(l).filter((x) => x.startsWith("เป็นเทพแห่ง")).length).toBe(5);
    force(l, "เป็นเทพแห่งความเมตตา");
    expect(l.alive).toBe(false);
    expect(l.causeOfDeath).toContain("เทพ");
    expect(dataOf(l).gods.at(-1)!.domain).toBe("mercy");
    expect(canRewind(l)).toBe(false);
    closeLife({} as Soul, l);
    expect(worldOfLife(l).legends.filter((g) => g.lifeId === l.id).length).toBe(1);
  });
  it("สละอาวุธตำนานแทนบททดสอบแห่งปัญญาได้", () => {
    const l = great(23);
    fl(l).divine = 1; fl(l).relic = "veilcutter"; dataOf(l).relics[0].holder = "player";
    runEvent(l, "ft.v.divine");
    force(l, "สละอาวุธตำนาน");
    expect(fl(l).divine).toBe(2);
    expect(fl(l).relic).toBeUndefined();
    expect(dataOf(l).relics[0].holder).toBe("lost");
  });
  it("คนรุ่นหลังไปขอพรที่วิหารของเทพได้", () => {
    const l = life(24);
    dataOf(l).gods.push({ name: "อัลดริค", domain: "war", year: 1000, kin: l.lastName });
    expect(getEvent("ft.g.temple")!.when!(l)).toBe(true);
    expect(getEvent("ft.g.temple")!.text(l, { g: 0 })).toContain("นามสกุลเดียวกับคุณ");
    const b = fl(l).body;
    runEvent(l, "ft.g.temple", { g: 0 });
    force(l, "ขอพรแห่งชัยชนะ");
    expect(fl(l).body).toBe(b + 15);
  });
});

describe("เล่นจริง", () => {
  it("120 ชีวิตสุ่มรวมเผ่าหายากและภพอื่น ไม่พัง", () => {
    for (let s = 1; s <= 120; s++) {
      const l = createLife({ seed: s * 97, worldId: "fantasy" });
      if (s % 3 === 0) setRace(l, s % 2 ? "dragon" : "demon");
      const r = { rng: s };
      const drain = () => { let g = 0; while (l.queue.length && l.alive && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); } };
      for (let i = 0; i < 300 && l.alive; i++) {
        if (i === 20) dataOf(l).gates.push({ realm: "dragon", kingdom: fl(l).kingdom, until: worldOfLife(l).year + 40 });
        for (const a of activitiesFor(l)) if (l.alive && !activityLocked(l, a) && nextFloat(r) < 0.3) { doActivity(l, a.id); drain(); }
        if (l.alive) { ageUp(l); drain(); }
      }
      expect(validateLife(l), `seed ${s}`).toEqual([]);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
    }
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(228);
  }, 400_000);
});

import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { declareWar, newKingdom, provincesOf, settleWar } from "../content/fantasy/empire";
import { closeLife, inheritLife, setRace } from "../content/fantasy/life";
import { crown, throneOf } from "../content/fantasy/realm";
import { addStanding, dataOf, ensureSociety, fl, homeKingdom, newFantasyWorld, worldOfLife } from "../content/fantasy/state";
import { tickWorld } from "../content/fantasy/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life, Soul } from "./types";
import { displayName } from "./util";
import { validateLife } from "./validate";

loadFantasyWorld();

const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  setRace(l, "human");
  l.age = age; l.queue = []; l.money = 900_000; l.stats.health = 95; l.stats.smarts = 75; l.stats.looks = 80; l.stats.luck = 70;
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
const locked = (l: Life, id: string) => activityLocked(l, activitiesFor(l).find((a) => a.id === id)!);

describe("จักรวรรดิในโลก", () => {
  it("ชนะขาดแล้วผนวก เมืองขึ้นของผู้แพ้ย้ายตาม", () => {
    const w = newFantasyWorld(1, 1000), d = ensureSociety(w);
    const [a, b, c] = d.kingdoms;
    c.overlord = b.id;
    a.power = 90; b.power = 40;
    for (let i = 0; i < 20 && !b.overlord; i++) settleWar(w, d, a, b, { rng: i + 1 });
    expect(b.overlord).toBe(a.id);
    expect(c.overlord).toBe(a.id);
    expect(provincesOf(d, a).length).toBe(2);
  });
  it("สงครามใหญ่มีพันธมิตรเข้าร่วม", () => {
    let big = 0;
    for (let s = 1; s <= 40; s++) {
      const w = newFantasyWorld(s, 1000), d = ensureSociety(w);
      declareWar(w, d, d.kingdoms[0], d.kingdoms[1], { rng: s });
      if (d.kingdoms[2].war) big++;
    }
    expect(big).toBeGreaterThan(3);
    expect(big).toBeLessThan(30);
  });
  it("800 ปี: มีการผนวก มีกบฏแยกตัว มีแผ่นดินใหม่ และไม่มีใครกลืนโลกถาวร", () => {
    const w = newFantasyWorld(21, 1000), d = ensureSociety(w), r = { rng: 5 };
    let annex = 0, maxProv = 0, allOneYears = 0;
    for (let y = 0; y < 800; y++) {
      w.year++; tickWorld(w, r);
      const free = d.kingdoms.filter((k) => !k.overlord).length;
      if (free === 1) allOneYears++;
      maxProv = Math.max(maxProv, ...d.kingdoms.map((k) => provincesOf(d, k).length));
      for (const k of d.kingdoms) expect(k.overlord === k.id).toBe(false);
    }
    const text = w.chronicle.map((c) => c.text).join("\n");
    annex = w.chronicle.filter((c) => c.text.includes("ผนวก")).length;
    expect(annex + maxProv).toBeGreaterThan(0);
    expect(allOneYears).toBeLessThan(200);
    expect(d.kingdoms.length).toBeLessThanOrEqual(6);
    expect(d.kingdoms.every((k) => k.power > 15 || k.power < 95)).toBe(true);
    expect(text).not.toMatch(/undefined|NaN/);
  });
  it("สภาทาลอสเลือกผู้นำใหม่เป็นรอบ", () => {
    const w = newFantasyWorld(3, 1000), d = ensureSociety(w), r = { rng: 2 };
    const thalos = d.kingdoms.find((k) => k.id === "thalos")!;
    const leaders = new Set<string>();
    for (let y = 0; y < 100; y++) { w.year++; tickWorld(w, r); leaders.add(thalos.ruler); }
    expect(leaders.size).toBeGreaterThan(3);
  });
});

describe("ทางสู่บัลลังก์", () => {
  it("แต่งงานกับผู้ครอง แล้วสืบบัลลังก์เมื่อเขาสวรรคต", () => {
    const l = life(10);
    l.fame = 40;
    const k = dataOf(l).kingdoms.find((x) => !x.elective)!;
    for (const x of dataOf(l).kingdoms) x.rulerAge = 90;
    k.rulerAge = l.age;
    expect(getEvent("ft.k.proposal")!.when!(l)).toBe(true);
    runEvent(l, "ft.k.proposal");
    force(l, "รับคำขอ");
    expect(fl(l).consort).toBe(k.id);
    expect(l.people.some((p) => p.relation === "spouse" && p.tags?.includes("royal"))).toBe(true);
    expect(getEvent("ft.k.proposal")!.when!(l)).toBe(false);
    k.rulerAge = 100;
    for (let i = 0; i < 40 && !fl(l).throne; i++) { l.queue = []; ageUp(l); }
    expect(fl(l).throne).toBe(k.id);
    expect(k.ruler).toBe(displayName(l));
    expect(l.people.find((p) => p.tags?.includes("royal"))!.alive).toBe(false);
  });
  it("รัฐประหารต้องมีเงื่อนไขครบ และสำเร็จแล้วได้บัลลังก์", () => {
    const l = life(11);
    homeKingdom(l).overlord = undefined; homeKingdom(l).playerRuled = false;
    expect(locked(l, "ft_coup")).toBeTruthy();
    addStanding(l, 50); fl(l).bodyRank = 3; homeKingdom(l).stability = 30;
    expect(locked(l, "ft_coup")).toBeUndefined();
    doActivity(l, "ft_coup");
    force(l, "บุกพระราชวัง");
    expect(throneOf(l)?.id).toBe(homeKingdom(l).id);
    expect(homeKingdom(l).playerRuled).toBe(true);
  });
  it("รัฐประหารพลาดแล้วติดคุกหรือตาย", () => {
    let jailed = 0, dead = 0;
    for (let s = 0; s < 30; s++) {
      const l = life(100 + s);
      runEvent(l, "ft.k.coup");
      force(l, "บุกพระราชวัง", false);
      if (!l.alive) dead++; else if (Number(l.flags.jailUntil) > l.age) jailed++;
    }
    expect(jailed + dead).toBe(30);
    expect(dead).toBeGreaterThan(0);
  });
  it("เลือกตั้งที่ทาลอส ครบวาระแล้วต้องลงใหม่", () => {
    const l = life(12);
    fl(l).kingdom = "thalos";
    addStanding(l, 40);
    const k = homeKingdom(l);
    k.nextElection = 0;
    expect(locked(l, "ft_election")).toBeUndefined();
    doActivity(l, "ft_election");
    force(l, "ปราศรัย");
    expect(throneOf(l)?.id).toBe("thalos");
    expect(k.nextElection).toBeGreaterThan(worldOfLife(l).year);
    worldOfLife(l).year = k.nextElection!;
    expect(getEvent("ft.k.reelect")!.when!(l)).toBe(true);
    runEvent(l, "ft.k.reelect");
    force(l, "ลงจากตำแหน่ง");
    expect(throneOf(l)).toBeUndefined();
    expect(k.playerRuled).toBe(false);
  });
  it("ก่อตั้งแผ่นดินใหม่เมื่อพร้อม และมีได้ไม่เกินหก", () => {
    const l = life(13);
    expect(locked(l, "ft_found")).toBeTruthy();
    l.fame = 55; fl(l).mount = "valgrias";
    expect(locked(l, "ft_found")).toBeUndefined();
    const n = dataOf(l).kingdoms.length;
    doActivity(l, "ft_found");
    force(l, "ปักธง");
    expect(dataOf(l).kingdoms.length).toBe(n + 1);
    expect(throneOf(l)?.name).toBe(`ราชรัฐ${l.lastName}`);
    const m = life(14);
    m.fame = 70; fl(m).mount = "valgrias";
    while (dataOf(m).kingdoms.length < 6) dataOf(m).kingdoms.push(newKingdom(`x${dataOf(m).kingdoms.length}`, "x", "x", 30, 1));
    expect(locked(m, "ft_found")).toBeTruthy();
  });
});

describe("การปกครองและราชวงศ์", () => {
  const ruler = (seed: number) => { const l = life(seed); crown(l, homeKingdom(l), "ทดสอบ"); return l; };
  it("ว่าราชการเปลี่ยนแผ่นดินจริง และมีรายได้ทุกปี", () => {
    const l = ruler(20);
    const k = throneOf(l)!;
    const p = k.prosperity ?? 100;
    runEvent(l, "ft.k.court");
    force(l, "สร้างถนน");
    expect(k.prosperity).toBe(Math.min(140, p + 9));
    const m = l.money;
    l.queue = []; ageUp(l);
    expect(l.money).toBeGreaterThan(m - 10_000);
  });
  it("ประกาศสงครามได้ และพระราชโองการเปลี่ยนกฎหมายทันที", () => {
    const l = ruler(21);
    const k = throneOf(l)!;
    k.war = undefined; k.overlord = undefined; k.laws = [];
    runEvent(l, "ft.k.court");
    force(l, "ประกาศสงครามกับ");
    expect(k.war).toBeTruthy();
    runEvent(l, "ft.k.decree");
    force(l, "ประกาศใช้การค้าเสรี");
    expect(k.laws).toContain("freeTrade");
  });
  it("บ้านเมืองปั่นป่วนแล้วเกิดปฏิวัติ สละราชย์แล้วมีผู้ครองใหม่", () => {
    const l = ruler(22);
    const k = throneOf(l)!;
    k.stability = 10;
    expect(getEvent("ft.k.revolt")!.when!(l)).toBe(true);
    runEvent(l, "ft.k.revolt");
    force(l, "สละราชสมบัติ");
    expect(throneOf(l)).toBeUndefined();
    expect(k.ruler).not.toBe(displayName(l));
    expect(k.playerRuled).toBe(false);
  });
  it("เมืองขึ้นประกาศอิสรภาพได้", () => {
    const l = ruler(23);
    const k = throneOf(l)!, o = dataOf(l).kingdoms.find((x) => x.id !== k.id)!;
    k.overlord = o.id;
    runEvent(l, "ft.k.court");
    force(l, "ประกาศอิสรภาพ");
    expect(k.overlord).toBeUndefined();
  });
  it("ตายแล้วทายาทสืบบัลลังก์ ส่วนคนแปลกหน้าเจอผู้ครองจากสกุลเดิม", () => {
    const l = ruler(24);
    const id = fl(l).throne!;
    const soul = {} as Soul;
    closeLife(soul, l);
    const k = (soul.fantasyWorld!.data as never as ReturnType<typeof dataOf>).kingdoms.find((x) => x.id === id)!;
    expect(k.playerRuled).toBe(false);
    expect(k.ruler).toContain(l.lastName);
    const heir = createLife({ seed: 25, worldId: "fantasy" });
    heir.lastName = l.lastName; heir.age = 20;
    inheritLife(l, heir);
    expect(fl(heir).throne).toBe(id);
    expect(dataOf(heir).kingdoms.find((x) => x.id === id)!.ruler).toBe(displayName(heir));
  });
  it("ผู้ครองที่เป็นคู่ครองตายก่อนกษัตริย์ ชื่อไม่ค้างในโลก", () => {
    const l = life(26);
    const k = dataOf(l).kingdoms[0];
    k.consortHeir = displayName(l); fl(l).consort = k.id;
    closeLife({} as Soul, l);
    expect(k.consortHeir).toBeUndefined();
  });
});

describe("ภาคีของตัวเอง", () => {
  it("ก่อตั้งแล้วเป็นผู้นำ ทำงานได้ตามแบบที่เลือก และอยู่ต่อหลังตาย", () => {
    const l = life(30);
    l.fame = 50;
    expect(locked(l, "ft_order")).toBeUndefined();
    doActivity(l, "ft_order");
    force(l, "ภาคีแบบผู้เก็บความรู้");
    const x = dataOf(l).factions.at(-1)!;
    expect(x.kind).toBe("conclave");
    expect(fl(l).faction).toBe(x.id);
    expect(fl(l).fRank).toBe(3);
    runEvent(l, "ft.f.job");
    expect(labels(l).some((t) => t.includes("คัดลอกตำรา"))).toBe(true);
    l.queue = [];
    const soul = {} as Soul;
    closeLife(soul, l);
    const w = soul.fantasyWorld!;
    const d = w.data as never as ReturnType<typeof dataOf>;
    const order = d.factions.find((y) => y.id === x.id)!;
    expect(order.playerLed).toBe(false);
    for (let y = 0; y < 5 && !order.leader; y++) { w.year++; tickWorld(w, { rng: y + 1 }); }
    expect(order.leader).not.toBe("");
  });
  it("รายชื่อเข้าร่วมแสดงภาคีใหม่ด้วย", () => {
    const l = life(31);
    dataOf(l).factions.push({ id: "otest", kind: "dawn", name: "ภาคีทดสอบ", creed: "x", power: 20, leader: "" });
    runEvent(l, "ft.f.join");
    expect(labels(l).some((t) => t.includes("ภาคีทดสอบ"))).toBe(true);
  });
});

describe("เล่นจริง", () => {
  it("100 ชีวิตสุ่มรวมระบบบัลลังก์ ไม่พัง", () => {
    for (let s = 1; s <= 100; s++) {
      const l = createLife({ seed: s * 89, worldId: "fantasy" });
      const r = { rng: s };
      const drain = () => { let g = 0; while (l.queue.length && l.alive && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); } };
      for (let i = 0; i < 500 && l.alive; i++) {
        if (i === 30) { l.fame = Math.max(l.fame, 65); l.money += 100_000; }
        for (const a of activitiesFor(l)) if (l.alive && !activityLocked(l, a) && nextFloat(r) < 0.3) { doActivity(l, a.id); drain(); }
        if (l.alive) { ageUp(l); drain(); }
      }
      expect(validateLife(l), `seed ${s}`).toEqual([]);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
      for (const k of dataOf(l).kingdoms) if (k.playerRuled) expect(fl(l).throne === k.id || !l.alive, k.name).toBe(true);
    }
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(214);
  }, 300_000);
});

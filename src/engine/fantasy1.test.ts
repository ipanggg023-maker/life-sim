import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { DRAGON_THREAT, NEED_CLUES } from "../content/fantasy/legends";
import { RACES, applyRewind, attachWorld, canMercy, canRewind, closeLife, inheritLife, rewindTarget, setRace } from "../content/fantasy/life";
import { SCHOOLS } from "../content/fantasy/places";
import { canCast, canBreak, combat, fightOdds, magicCap } from "../content/fantasy/power";
import { dataOf, fl, newFantasyWorld } from "../content/fantasy/state";
import { fastForward, tickWorld } from "../content/fantasy/world";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { isOpenWorld } from "../content/worlds";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { buildHeir, newSoul } from "./soul";
import type { Life } from "./types";
import { createPerson, displayName } from "./util";
import { validateLife } from "./validate";
import { moduleOf } from "./worldModule";

loadMurimWorld();
loadFantasyWorld();
loadSharedEvents();

const life = (seed: number, age = 20): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90;
  return l;
};
const drain = (l: Life, r: { rng: number }) => {
  let g = 0;
  while (l.queue.length && l.alive && g++ < 40) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, l.queue[0].eventId).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
};
const play = (l: Life, acts = true) => {
  const r = { rng: l.seed + 3 };
  for (let i = 0; i < 520 && l.alive; i++) {
    if (acts) for (const a of activitiesFor(l)) if (!activityLocked(l, a) && nextFloat(r) < 0.4) { doActivity(l, a.id); drain(l, r); if (!l.alive) break; }
    if (!l.alive) break;
    l.queue.length || ageUp(l);
    drain(l, r);
  }
  return l;
};
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  l.queue.shift();
  return out;
};

describe("เกิดและเผ่า", () => {
  it("เกิดแบบสุ่มมีเผ่า อาณาจักร และพลังแต่กำเนิด หลายแบบ", () => {
    const races = new Set<string>(), pots = new Set<number>(), homes = new Set<string>();
    for (let s = 1; s <= 200; s++) { const f = fl(createLife({ seed: s * 7, worldId: "fantasy" })); races.add(f.race); pots.add(f.potential); homes.add(f.kingdom); }
    expect(races.size).toBe(3);
    expect(pots.size).toBeGreaterThanOrEqual(5);
    expect(homes.size).toBe(3);
  });
  it("เปลี่ยนเผ่าตอนเกิดไม่ทิ้งค่าสถานะเดิมค้าง", () => {
    const l = life(1);
    setRace(l, "human");
    const base = { ...l.stats };
    setRace(l, "elf"); setRace(l, "dwarf"); setRace(l, "human");
    expect(l.stats.smarts).toBe(base.smarts);
    expect(fl(l).race).toBe("human");
  });
  it("เอลฟ์อยู่ได้นานกว่ามนุษย์มาก และคนแคระนานกว่าเล็กน้อย", () => {
    const avg = (r: "human" | "elf" | "dwarf") => {
      let t = 0;
      for (let s = 1; s <= 24; s++) { const l = createLife({ seed: s * 31, worldId: "fantasy" }); setRace(l, r); play(l, false); t += l.age; }
      return t / 24;
    };
    const h = avg("human"), d = avg("dwarf"), e = avg("elf");
    expect(d).toBeGreaterThan(h + 25);
    expect(e).toBeGreaterThan(h + 150);
    expect(RACES.elf.younger).toBeGreaterThan(RACES.dwarf.younger);
  });
});

describe("พลัง", () => {
  it("ไม่มีพลังแต่กำเนิดก็ร่ายเวทได้เมื่อมีคทา แต่เพดานต่ำกว่า", () => {
    const n = life(2); fl(n).potential = 0;
    expect(canCast(n)).toBe(false);
    expect(activityLocked(n, activitiesFor(n).find((a) => a.id === "ft_study")!)).toBeTruthy();
    fl(n).wand = { name: "คทา", quality: 1, material: "ไม้" };
    expect(canCast(n)).toBe(true);
    expect(magicCap(n)).toBe(2);
    const g = life(3); fl(g).potential = 5; fl(g).wand = { name: "คทา", quality: 1, material: "ไม้" };
    expect(magicCap(g)).toBe(4);
  });
  it("ไม่ใช้เวทก็เก่งได้ และเลยเพดานไม่ได้", () => {
    const l = life(4);
    fl(l).bodyRank = 4;
    expect(combat(l)).toBeGreaterThan(50);
    fl(l).magic = 200; fl(l).magicRank = magicCap(l);
    expect(canBreak(l, "magic")).toBe(false);
  });
  it("ทะลวงขั้นเกิดเองเมื่อฝึกเต็ม", () => {
    const l = life(5);
    fl(l).body = 100;
    ageUp(l);
    expect(l.queue.some((q) => q.eventId === "ft.break_body")).toBe(true);
  });
});

describe("โรงเรียน กิลด์ อาชีพ", () => {
  it("มีสามโรงเรียน โอกาสสอบขึ้นกับตัวละคร และสอบไม่ติดยังเล่นต่อได้", () => {
    expect(SCHOOLS.length).toBe(5);
    const a = life(6, 12), b = life(6, 12);
    fl(a).potential = 5; fl(b).potential = 0;
    expect(SCHOOLS[0].odds(a)).toBeGreaterThan(SCHOOLS[0].odds(b));
    runEvent(b, "ft.school_apply");
    force(b, "สถาบันเวท", false);
    expect(fl(b).school).toBeUndefined();
    expect(activitiesFor(b).some((x) => x.id === "ft_guild")).toBe(true);
  });
  it("สอบติด เรียนจนจบได้ป้าย และมีคู่แข่งร่วมรุ่น", () => {
    const l = life(7, 12);
    runEvent(l, "ft.school_apply");
    force(l, "สำนักดาบ");
    expect(fl(l).school).toBe("steelcrest");
    expect(l.people.some((p) => p.relation === "rival" && p.alive)).toBe(true);
    l.age = 18;
    expect(getEvent("ft.graduate")!.when!(l)).toBe(true);
    runEvent(l, "ft.graduate");
    force(l, "รับป้าย");
    expect(fl(l).graduated).toBe(true);
    expect(fl(l).deeds.length).toBe(1);
  });
  it("กิลด์เลื่อนขั้นเมื่อทำงานครบ", () => {
    const l = life(8);
    doActivity(l, "ft_guild");
    expect(fl(l).guild).toBe(1);
    for (let i = 0; i < 6; i++) { runEvent(l, "ft.contract", { mon: 0 }); force(l, "กำจัดสัตว์อสูร"); }
    expect(fl(l).guild).toBe(2);
  });
  it("สมัครงานในโลกนี้ได้ และงานนักเวทต้องร่ายเวทเป็น", () => {
    const l = life(9);
    const count = () => { let n = 0; for (let i = 0; i < 40; i++) { l.doneThisYear = []; applyJob(l, "ft_farmer"); if (l.job) { n++; break; } } return n; };
    expect(count()).toBe(1);
  });
});

describe("ตำนานและมังกร", () => {
  it("เบาะแสครบเปิดบททดสอบ แล้วได้อาวุธตำนาน", () => {
    const l = life(10);
    const r = dataOf(l).relics[0];
    fl(l).clues[r.id] = NEED_CLUES - 1;
    runEvent(l, "ft.legend_trail", { relic: r.id });
    force(l, "ค้นบันทึก");
    expect(l.queue[0].eventId).toBe("ft.relic_trial");
    force(l, "สู้เพื่อสิทธิ์");
    expect(fl(l).relic).toBe(r.id);
    expect(r.holder).toBe("player");
  });
  it("อาวุธตำนานไม่ได้ทำให้ชนะมังกรแน่นอน", () => {
    const l = life(11);
    fl(l).relic = "veilcutter";
    expect(fightOdds(l, DRAGON_THREAT)).toBeLessThan(0.5);
  });
  it("สังหารมังกรได้ ตายได้ และเป็นสหายได้", () => {
    const l = life(12);
    runEvent(l, "ft.dragon_meet");
    force(l, "ท้าสู้");
    expect(dataOf(l).dragon.alive).toBe(false);
    const d = life(13);
    runEvent(d, "ft.dragon_meet");
    force(d, "ท้าสู้", false);
    expect(d.alive).toBe(false);
    const f = life(14);
    fl(f).dragonBond = 60;
    runEvent(f, "ft.dragon_meet");
    force(f, "ขอเป็นเพื่อนร่วมทาง");
    expect(f.flags.dragonRider).toBe(true);
  });
});

describe("โลกมีชีวิต", () => {
  it("500 ปีไม่มีผู้เล่น: ผู้ปกครองเปลี่ยน มีสงคราม อาวุธเปลี่ยนมือ และไม่มีใครครองโลกถาวร", () => {
    const w = newFantasyWorld(5);
    const first = (w.data as never as { kingdoms: { ruler: string }[] }).kingdoms.map((k) => k.ruler);
    const r = { rng: 77 };
    const seen = { rulers: 0, wars: 0, relic: 0 };
    const d = w.data as never as ReturnType<typeof dataOf>;
    const owners = new Set<string>();
    for (let i = 0; i < 500; i++) {
      w.year++; tickWorld(w, r);
      if (d.kingdoms.some((k, n) => k.ruler !== first[n])) seen.rulers++;
      if (d.kingdoms.some((k) => k.war)) seen.wars++;
      for (const x of d.relics) owners.add(x.holder);
    }
    expect(seen.rulers).toBeGreaterThan(100);
    expect(seen.wars).toBeGreaterThan(30);
    expect(owners.size).toBeGreaterThan(2);
    expect(d.kingdoms.every((k) => k.power > 0 && k.stability > 0)).toBe(true);
    expect(w.chronicle.length).toBeLessThanOrEqual(400);
    expect(JSON.stringify(w).length).toBeLessThan(200_000);
  });
  it("โลกเดียวกันจาก seed เดียวกันได้ผลเหมือนกัน", () => {
    const run = () => { const w = newFantasyWorld(9); fastForward(w, 120, { rng: 5 }); return JSON.stringify(w); };
    expect(run()).toBe(run());
  });
});

describe("หลายชีวิตในโลกเดียว", () => {
  it("คนดังตายแล้วโลกจำ ตัวละครใหม่เกิดหลังจากนั้นในโลกเดิมและได้ยินเรื่องของเขา", () => {
    const s = newSoul();
    const a = life(20);
    fl(a).deeds.push("สังหารมังกรวาลเกรียส");
    a.fame = 90; a.alive = false;
    const year0 = a.birthYear + a.age;
    closeLife(s, a);
    expect(s.fantasyWorld!.legends[0].name).toBe(displayName(a));
    const b = createLife({ seed: 21, worldId: "fantasy" });
    attachWorld(b, s);
    expect(b.birthYear).toBeGreaterThanOrEqual(year0 + 20);
    expect(b.fw!.legends[0].deed).toContain("มังกร");
    expect(getEvent("ft.w.legend")!.when!(b)).toBe(true);
    runEvent(b, "ft.w.legend", getEvent("ft.w.legend")!.prepare!(b));
    expect(getEvent("ft.w.legend")!.text(b, b.queue[0].ctx)).toContain(displayName(a));
  });
  it("คนธรรมดาไม่เป็นตำนาน", () => {
    const s = newSoul(), a = life(22);
    a.fame = 5;
    closeLife(s, a);
    expect(s.fantasyWorld!.legends).toEqual([]);
    expect(s.fantasyWorld!.chronicle.at(-1)!.text).toContain(displayName(a));
  });
  it("อาวุธของคนตายกลับสู่โลกให้คนอื่นตามหา", () => {
    const s = newSoul(), a = life(23);
    const r = dataOf(a).relics[0];
    r.holder = "player"; fl(a).relic = r.id;
    closeLife(s, a);
    expect((s.fantasyWorld!.data as never as ReturnType<typeof dataOf>).relics[0].holder).toBe("lost");
  });
  it("เล่นต่อเป็นลูก: ได้เผ่า อาณาจักร โลกเดิม แต่ฝีมือต้องฝึกเอง", () => {
    const a = life(24, 50);
    setRace(a, "dwarf");
    fl(a).bodyRank = 4;
    const k = createPerson(a, "child", { age: 22, bond: 80, lastName: a.lastName });
    const next = buildHeir(a, k.id);
    inheritLife(a, next);
    expect(fl(next).race).toBe("dwarf");
    expect(fl(next).kingdom).toBe(fl(a).kingdom);
    expect(fl(next).bodyRank).toBe(0);
    expect(next.fw).toBe(a.fw);
  });
});

describe("ย้อนชะตา", () => {
  it("ตายก่อน 30 ย้อนได้ครั้งเดียว ทิ้งแผล และหลังจากนั้นไม่ได้อีก", () => {
    const snap = structuredClone({ ...life(30, 12), log: [] });
    const dead = structuredClone(snap);
    dead.age = 14; dead.alive = false; dead.causeOfDeath = "ไข้";
    expect(canRewind(dead)).toBe(true);
    expect(rewindTarget(dead)).toBe(12);
    const next = applyRewind(dead, snap);
    expect(next.alive).toBe(true);
    expect(next.age).toBe(12);
    expect(next.causeOfDeath).toBeUndefined();
    expect(fl(next).scars.length).toBe(1);
    next.age = 15; next.alive = false;
    expect(canRewind(next)).toBe(false);
  });
  it("อายุเกิน 30 ย้อนไม่ได้ เว้นแต่มีด้ายชะตา", () => {
    const l = life(31, 50);
    fl(l).threads = 0;
    expect(canMercy(l)).toBe(false);
    expect(canRewind(l)).toBe(false);
    fl(l).threads = 2;
    expect(canRewind(l)).toBe(true);
    const next = applyRewind(l, structuredClone({ ...l, age: 45, log: [] }));
    expect(fl(next).threads).toBe(1);
  });
  it("โลกย้อนกลับพร้อมตัวละคร", () => {
    const snap = life(32, 12);
    const year = dataOf(snap).dragon.age;
    const dead = structuredClone(snap);
    dataOf(dead).dragon.age = year + 50;
    dead.age = 14;
    expect(dataOf(applyRewind(dead, structuredClone(snap))).dragon.age).toBe(year);
  });
});

describe("เล่นจริง", () => {
  it("120 ชีวิตสุ่มไม่พัง ไม่ค้าง ไม่มีข้อความเพี้ยน", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 120; s++) {
      const l = createLife({ seed: s * 13, worldId: "fantasy" });
      play(l);
      expect(l.alive).toBe(false);
      expect(validateLife(l)).toEqual([]);
      for (const k of Object.keys(l.seen)) seen.add(k);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    expect(seen.size).toBeGreaterThan(90);
  });
  it("โลกแฟนตาซียังไม่เปิดให้ผู้เล่นทั่วไป และยุทธภพไม่ถูกแตะ", () => {
    expect(isOpenWorld("fantasy")).toBe(false);
    expect(moduleOf("fantasy")?.gift).toBeUndefined();
    const m = createLife({ seed: 1, worldId: "murim" });
    expect(m.ft).toBeUndefined();
    expect(m.fw).toBeUndefined();
  });
});

describe("สมดุล", () => {
  it("คนบ้าบิ่นตายเร็ว ยอดฝีมือหายาก แต่คนใช้ชีวิตเงียบๆ อยู่ได้นาน", () => {
    const N = 80;
    const ages: number[] = [];
    let top = 0, guildDeaths = 0, relics = 0;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 211, worldId: "fantasy" });
      setRace(l, "human");
      play(l);
      const f = fl(l);
      ages.push(l.age);
      if (f.bodyRank === 4 || f.magicRank === 4) top++;
      if (f.relic) relics++;
      if (l.causeOfDeath?.includes("กิลด์")) guildDeaths++;
    }
    ages.sort((a, b) => a - b);
    const med = ages[N >> 1];
    expect(med).toBeGreaterThanOrEqual(18);
    expect(med).toBeLessThanOrEqual(60);
    const quiet: number[] = [];
    for (let s = 1; s <= 30; s++) { const l = createLife({ seed: s * 223, worldId: "fantasy" }); setRace(l, "human"); play(l, false); quiet.push(l.age); }
    quiet.sort((a, b) => a - b);
    expect(quiet[15]).toBeGreaterThanOrEqual(55);
    expect(top / N).toBeLessThan(0.45);
    expect(relics).toBeGreaterThan(0);
    expect(relics / N).toBeLessThan(0.6);
    expect(guildDeaths).toBeGreaterThan(0);
  }, 120_000);
});

describe("ปริมาณเนื้อหา", () => {
  it("มีเหตุการณ์อย่างน้อย 150 เรื่อง", () => {
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(150);
  });
});

import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { SEEDS, TAGS, activeSeed, seedsOf } from "../content/fantasy/conseq";
import { inheritFeuds, morePersonActions, PEOPLE2_EVENTS, feelingWords } from "../content/fantasy/people2";
import { inCharacter, lean, personaOf, traitWords, verdict } from "../content/fantasy/persona";
import { rumorYear, rumorsOf, spread, talkIn } from "../content/fantasy/rumors";
import { fl, kingdomsOf } from "../content/fantasy/state";
import { ECHOES_1 } from "../content/fantasy/echoes";
import { ECHOES_2 } from "../content/fantasy/echoes2";
import { allEvents, getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { relOf, remember } from "./npc";
import type { Life } from "./types";
import { createPerson } from "./util";
import { buildHeir } from "./soul";

loadFantasyWorld();

const life = (seed: number, age = 20): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const choose = (l: Life, id: string, idx: number, ctx = {}) => {
  runEvent(l, id, ctx);
  const q = l.queue[0];
  const vis = visibleChoices(l, q).find((x) => x.index === idx);
  expect(vis, `${id}#${idx}`).toBeTruthy();
  resolveChoice(l, idx);
  while (l.queue.length && l.alive) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
};

describe("ป้ายของตัวเลือก", () => {
  it("ทุกป้ายชี้ไปที่ตัวเลือกที่มีอยู่จริง", () => {
    const bad = Object.keys(TAGS).filter((k) => { const [id, i] = k.split("#"); return !getEvent(id)?.choices?.[Number(i)]; });
    expect(bad).toEqual([]);
    expect(Object.keys(TAGS).length).toBeGreaterThanOrEqual(250);
  });
  it("ทุกเมล็ดมีเรื่องที่กลับมา และทุกเรื่องที่กลับมามีที่ปลูก", () => {
    const fromChoices = allEvents().flatMap((e) => (e.choices ?? []).map((c) => c.seed)).filter(Boolean);
    const planted = new Set([...Object.values(TAGS).map((t) => t.seed).filter(Boolean), ...fromChoices, "lend_friend", "friend_debt"]);
    for (const s of planted) expect(SEEDS[s!], `seed ${s}`).toBeTruthy();
    const orphan = Object.keys(SEEDS).filter((s) => !planted.has(s));
    expect(orphan).toEqual([]);
    expect(Object.keys(SEEDS).length).toBeGreaterThanOrEqual(115);
  });
  it("ตัวเลือกที่ปลูกเมล็ดมีป้ายบอกว่าจะถูกจดจำ", () => {
    const c = getEvent("ft.y.z_bandit_kid")!.choices![0];
    expect(c.mark).toBeTruthy();
    expect(c.lean?.m).toBeGreaterThan(0);
  });
});

describe("นิสัยจากทางเลือก", () => {
  it("เลือกแล้วนิสัยขยับและปลูกเมล็ด แล้วเรื่องนั้นกลับมาในอีกหลายปี", () => {
    const l = life(3, 20);
    choose(l, "ft.y.z_bandit_kid", 0);
    expect(personaOf(l).m).toBeGreaterThan(0);
    expect(activeSeed(l, "bandit_kid_fed")).toBeTruthy();
    const e = getEvent("ft.ec.bandit_kid_fed")!;
    expect(e.when!(l)).toBe(false);
    l.age = 30;
    expect(e.when!(l)).toBe(true);
    runEvent(l, "ft.ec.bandit_kid_fed");
    expect(activeSeed(l, "bandit_kid_fed")).toBeUndefined();
    expect(seedsOf(l)[0].done).toBe(30);
    expect(l.log.some((x) => x.text.includes("เรื่องเก่ากลับมา"))).toBe(true);
  });
  it("เด็กเปลี่ยนง่าย ผู้ใหญ่เปลี่ยนยาก", () => {
    const a = life(4, 10), b = life(5, 60);
    lean(a, { h: 10 }); lean(b, { h: 10 });
    expect(personaOf(a).h).toBeGreaterThan(personaOf(b).h);
  });
  it("ทำตามนิสัยตัวเองสำเร็จง่ายขึ้น ฝืนนิสัยยากขึ้น", () => {
    const l = life(6);
    personaOf(l).m = 80;
    expect(inCharacter(l, { label: "", lean: { m: 8 }, run: () => ({ text: "" }) })).toBeGreaterThan(0.03);
    expect(inCharacter(l, { label: "", lean: { m: -8 }, run: () => ({ text: "" }) })).toBeLessThan(0);
  });
  it("ตัวเลือกเฉพาะนิสัยเห็นเฉพาะคนที่นิสัยเด่นพอ", () => {
    const l = life(7, 25);
    runEvent(l, "ft.a.goblins");
    const count = () => visibleChoices(l, l.queue[0]).length;
    const before = count();
    personaOf(l).m = 60;
    expect(count()).toBe(before + 1);
  });
  it("คำบรรยายนิสัย ฉายา และคำตัดสินบนหลุมศพตามนิสัย", () => {
    const l = life(8);
    expect(traitWords(l)).toEqual([]);
    personaOf(l).h = -70; personaOf(l).c = 40;
    expect(traitWords(l)[0]).toBe("จิ้งจอกเจ้าเล่ห์");
    expect(verdict(l)).toContain("จิ้งจอกเจ้าเล่ห์");
  });
});

describe("ข่าวลือ", () => {
  it("เริ่มที่เมือง ลามทั้งแผ่นดิน ข้ามแดนเมื่อร้อน และจางหายในที่สุด", () => {
    const l = life(9);
    const home = fl(l).kingdom;
    const other = kingdomsOf(l).find((k) => k.id !== home)!.id;
    spread(l, "ทดสอบข่าวลือ", 1, 90);
    expect(talkIn(l, home).length).toBe(1);
    expect(talkIn(l, other).length).toBe(0);
    rumorYear(l); rumorYear(l);
    expect(talkIn(l, other).length).toBe(1);
    for (let i = 0; i < 15; i++) rumorYear(l);
    expect(rumorsOf(l).some((r) => r.text === "ทดสอบข่าวลือ")).toBe(false);
  });
});

describe("แท็บผู้คน", () => {
  it("ทุกฉากกลับมาและฉากผู้คนเขียนข้อความได้", () => {
    const l = life(10, 40);
    const kid = createPerson(l, "child", { age: 15 }); kid.bond = 60;
    const fr = createPerson(l, "friend", { age: 38 }); fr.bond = 70; remember(l, fr, "x", "x", 3, { debt: 60, trust: 70, grudge: 0 });
    const foe = createPerson(l, "rival", { age: 38 }); remember(l, foe, "x", "x", 3, { grudge: 90 });
    createPerson(l, "spouse", { age: 39 });
    for (const e of [...ECHOES_1, ...ECHOES_2, ...PEOPLE2_EVENTS]) {
      const ctx = e.manual ? { pid: fr.id } : e.prepare && (!e.when || e.when(l)) ? e.prepare(l) : { pid: fr.id };
      const t = e.text(l, ctx);
      expect(t, e.id).toBeTruthy();
      expect(t, e.id).not.toMatch(/undefined|NaN/);
    }
  });
  it("ปุ่มรายคนใหม่ปรากฏตามความรู้สึก และทุกการกระทำเขียนความทรงจำ", () => {
    const l = life(11, 30);
    const p = createPerson(l, "friend", { age: 30 }); p.bond = 60;
    const ids = morePersonActions(l, p).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["confide", "gift", "lend", "borrow"]));
    expect(ids).not.toContain("apologize");
    remember(l, p, "hurt", "x", 2, { grudge: 40 });
    expect(morePersonActions(l, p).map((a) => a.id)).toContain("apologize");
    const before = p.mem!.length;
    morePersonActions(l, p).find((a) => a.id === "confide")!.run(l);
    resolveChoice(l, 2);
    expect(p.mem!.length).toBe(before + 1);
    expect(feelingWords(p).length).toBeGreaterThan(0);
  });
  it("ศัตรูที่ตายอาจมีลูกมาล้างแค้น และทายาทรับศัตรูของพ่อแม่ไปด้วย", () => {
    const l = life(12, 40);
    let spawned = 0;
    for (let i = 0; i < 6; i++) {
      const foe = createPerson(l, "rival", { age: 60 }); remember(l, foe, "x", "x", 3, { grudge: 90 }); foe.alive = false;
    }
    const n = l.people.length;
    ageUp(l);
    spawned = l.people.filter((p) => p.tags?.includes("feud") && p.alive).length;
    expect(spawned).toBeGreaterThan(0);
    expect(l.people.length).toBeGreaterThan(n);
    const live = createPerson(l, "rival", { age: 40 }); remember(l, live, "x", "x", 3, { grudge: 80 });
    const kid = createPerson(l, "child", { age: 20 });
    const next = buildHeir(l, kid.id);
    inheritFeuds(l, next);
    const carried = next.people.find((p) => p.id === live.id);
    expect(carried?.relation).toBe("rival");
    expect(relOf(carried!).grudge).toBeGreaterThanOrEqual(50);
  });
});

describe("สมดุล", () => {
  it("เล่นสุ่มหลายชีวิต: นิสัยกระจาย เมล็ดถูกปลูกและกลับมา โดยไม่มีอะไรพัง", () => {
    let planted = 0, returned = 0, strong = 0;
    for (let s = 1; s <= 12; s++) {
      const l = createLife({ seed: s * 17, worldId: "fantasy" });
      const rng = { n: s };
      for (let y = 0; y < 70 && l.alive; y++) {
        ageUp(l);
        let g = 0;
        while (l.queue.length && l.alive && g++ < 40) { const o = visibleChoices(l, l.queue[0]); rng.n = (rng.n * 9301 + 49297) % 233280; resolveChoice(l, o[Math.floor((rng.n / 233280) * o.length)].index); }
      }
      planted += seedsOf(l).length;
      returned += seedsOf(l).filter((x) => x.done !== undefined).length;
      if (traitWords(l).length) strong++;
    }
    expect(planted).toBeGreaterThan(12);
    expect(returned).toBeGreaterThan(2);
    expect(strong).toBeGreaterThan(3);
    expect(allEvents().length).toBeGreaterThan(0);
  }, 120000);
});

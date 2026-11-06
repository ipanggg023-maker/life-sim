import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { FAR, SOON, judge, setStrangerGap, soulRank, storyCard } from "../content/fantasy/souls2";
import { attachWorld, closeLife } from "../content/fantasy/life";
import { dataOf, fl, type FData } from "../content/fantasy/state";
import { lean } from "../content/fantasy/persona";
import { doActivity } from "./activities";
import { currentScene, getEvent, labelOf } from "./events";
import { ageUp, createLife, kill, runEvent } from "./game";
import { newSoul } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0]; const s = currentScene(q, l)!; return s.choices.filter((c) => !c.show || c.show(l, q.ctx)).map((c) => labelOf(c, l, q.ctx)); };
const pickRun = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0], s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no choice ${re} in ${q.eventId}/${q.scene ?? "start"}: ${labels(l).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
const only = (l: Life, id: string) => { l.queue = l.queue.filter((q) => q.eventId === id); };
const year = (l: Life) => { l.queue = []; l.doneThisYear = []; ageUp(l); };
const D = (l: Life) => dataOf(l) as FData;
/** ปิดชีวิตแรกแล้วเกิดใหม่เป็นคนแปลกหน้า */
const reborn = (dead: Life, seed: number, gap?: "soon" | "far") => {
  const s = newSoul(); s.lives = 5; closeLife(s, dead);
  const next = createLife({ seed, worldId: "fantasy", plain: true });
  setStrangerGap(gap); attachWorld(next, s);
  return { s, next };
};

describe("วิญญาณที่เดินทางต่อ", () => {
  it("ชีวิตที่จบบันทึกการพิพากษา หลุมศพในโลก และสิ่งที่ปลดได้", () => {
    const l = life(1, 70); lean(l, { m: 60, h: 40 }, true); fl(l).craft = { smith: 900 };
    const { s } = reborn(l, 2);
    expect(s.ftEcho?.judged).toBe("light");
    expect(s.ftUnlocks).toContain("smith");
    expect(D(l).graves?.some((g) => g.name.length > 0)).toBe(true);
  });
  it("ชีวิตใหม่ได้ร่องรอยเล็กๆ: อันดับวิญญาณ ฝีมือที่มือจำได้ และผู้ชี้ทางเมื่อชีวิตก่อนสว่าง", () => {
    const l = life(3, 70); lean(l, { m: 60, h: 40 }, true); fl(l).craft = { smith: 900 };
    const { s, next } = reborn(l, 4);
    expect(soulRank(s)[1]).toBe("วิญญาณเก่า");
    expect(next.flags.ftGuideDue).toBe(true);
    expect(fl(next).craft?.smith).toBeGreaterThanOrEqual(30);
    next.age = 12; next.queue = []; year(next);
    expect(next.flags.ftEchoCraft).toBeUndefined();
  });
  it("เลือกเกิดเร็วหรือช้าได้ และเกิดเร็วอาจเจอคนที่เคยรัก", () => {
    const a = life(5, 50); const y0 = D(a) && a.birthYear + a.age;
    createPerson(a, "spouse", { age: 48, bond: 80 });
    let recog = 0;
    for (let s = 6; s < 26; s++) { const dead = life(5, 50); createPerson(dead, "spouse", { age: 48, bond: 80 }); const { next } = reborn(dead, s, "soon"); if (next.flags.ftRecog) recog++; expect(next.birthYear - (dead.birthYear + dead.age)).toBeLessThanOrEqual(SOON[1] + 1); }
    expect(recog).toBeGreaterThan(0);
    const far = life(7, 50); const { next } = reborn(far, 27, "far");
    expect(next.birthYear - (far.birthYear + far.age)).toBeGreaterThanOrEqual(FAR[0]);
    void y0;
  });
  it("ชีวิตที่มืดเริ่มด้วยฝันร้าย", () => {
    const l = life(8, 60); lean(l, { m: -70 }, true); fl(l).kills = 3;
    expect(judge(l)).toBe("shadow");
    const { next } = reborn(l, 9);
    expect(next.flags.ftShadowBorn).toBe(true);
  });
});

describe("ความตาย", () => {
  it("ตายแล้วมีคำสุดท้าย", () => {
    const l = life(10); kill(l, "ตายในศึก");
    expect(l.alive).toBe(false);
    expect(l.log.some((e) => /คำสุดท้าย|หัวเราะ|นึกถึงบ้าน|ความลับ|หลับตา/.test(e.text))).toBe(true);
  });
  it("ศรัทธาแรงพอรอดตายได้ครั้งเดียว และมีราคา", () => {
    let saved = 0;
    for (let s = 1; s <= 10 && !saved; s++) {
      const l = life(s); fl(l).god = "solia"; lean(l, { f: 80 }, true);
      kill(l, "ตายในศึก");
      if (l.alive) { saved++; expect(l.flags.ftCheated).toBe(true); expect(fl(l).lifeBonus).toBeLessThan(0); kill(l, "ตายในศึก"); expect(l.alive).toBe(false); }
    }
    expect(saved).toBe(1);
  });
  it("คนที่เล่นกับความตายอาจกลับมาเป็นอมตะในโลก และชีวิตต่อมาปลดปล่อยได้", () => {
    let undead = false;
    for (let s = 1; s <= 10 && !undead; s++) {
      const l = life(s, 70); fl(l).mschool = "death";
      const { next } = reborn(l, s + 40);
      if (D(next).undead) {
        undead = true;
        fl(next).kingdom = D(next).undead!.kingdom; fl(next).bodyRank = 2; next.age = 30;
        expect(getEvent("ft.sl.undead")!.when!(next)).toBe(true);
        runEvent(next, "ft.sl.undead"); pickRun(next, /ปลดปล่อย/, true);
        expect(D(next).undead).toBeUndefined();
      }
    }
    expect(undead).toBe(true);
  });
  it("ไปเยี่ยมหลุมศพในโลกได้ และการ์ดเรื่องเล่าบอกการเดินทางของวิญญาณ", () => {
    const l = life(11, 60);
    const { s, next } = reborn(l, 12);
    fl(next).kingdom = D(next).graves!.at(-1)!.kingdom; next.age = 20;
    doActivity(next, "ft_graves"); only(next, "ft.sl.grave"); pickRun(next, /หลุมศพของ/);
    expect(Object.keys(next.flags).some((k) => k.startsWith("ftGrave_"))).toBe(true);
    expect(storyCard(l, s).some((c) => c.title === "การเดินทางของวิญญาณ")).toBe(true);
  });
});

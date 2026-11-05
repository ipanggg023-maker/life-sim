import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { ESCAPE_STEPS, RAID_HEAT, addHeat, heatOf, jailed, lawLines, sentence, ugRank } from "../content/fantasy/underworld";
import { fl, homeKingdom } from "../content/fantasy/state";
import { ACTIVITIES, activitiesFor, activityLocked, doActivity } from "./activities";
import { currentScene, eligibilityFilters, getEvent, labelOf } from "./events";
import { ageUp, createLife, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  homeKingdom(l).laws = [];
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
const year = (l: Life, acts = "") => { l.queue = []; l.doneThisYear = acts ? acts.split("|") : []; ageUp(l); };
const act = (l: Life, id: string) => activitiesFor(l).find((a) => a.id === id);

describe("กิลด์โจร", () => {
  it("พิสูจน์ตัวแล้วเข้ากิลด์ ทำงานจนเลื่อนขั้น", () => {
    const l = life(1);
    doActivity(l, "ft_ug_join"); only(l, "ft.ug.join"); pickRun(l, /ล้วงกระเป๋าคนเฝ้าประตู/, true);
    expect(ugRank(l)).toBe(1);
    for (let i = 0; i < 3; i++) { runEvent(l, "ft.ug.job"); only(l, "ft.ug.job"); pickRun(l, /ล้วงกระเป๋าตามรายชื่อ/, true); }
    expect(ugRank(l)).toBe(2);
    expect(heatOf(l)).toBeGreaterThan(0);
  });
  it("งานปล้นใหญ่มีสี่จังหวะ เตรียมดีแล้วโอกาสสูงขึ้น", () => {
    const l = life(2); fl(l).ug = { rank: 3, merit: 0, heat: 0 };
    runEvent(l, "ft.ug.heist"); pickRun(l, /คฤหาสน์ขุนนาง/);
    expect(l.queue[0].scene).toBe("plan");
    pickRun(l, /ซื้อตัวคนใน/); pickRun(l, /ทำคนเดียว/);
    expect(l.queue[0].scene).toBe("go");
    expect(Number(l.queue[0].ctx.edge)).toBeCloseTo(0.15, 5);
    const g0 = l.money; pickRun(l, /ลงมือ/, true);
    expect(l.money - g0).toBe(150 * 100);
    expect(heatOf(l)).toBeGreaterThanOrEqual(25);
  });
  it("ปล้นพลาดแล้วไปศาลทันที", () => {
    const l = life(3); fl(l).ug = { rank: 3, merit: 0, heat: 0 };
    runEvent(l, "ft.ug.heist"); pickRun(l, /คลังของพ่อค้า/); pickRun(l, /ไปเลย/); pickRun(l, /ทำคนเดียว/); pickRun(l, /ลงมือ/, false);
    expect(l.queue[0].eventId).toBe("ft.l.arrest");
  });
  it("ยามจับตามองมากเกินไปแล้วบุกบ้าน และติดสินบนลดความร้อนได้", () => {
    const l = life(4); fl(l).ug = { rank: 2, merit: 0, heat: 0 };
    expect(getEvent("ft.ug.raid")!.when!(l)).toBe(false);
    addHeat(l, RAID_HEAT);
    expect(getEvent("ft.ug.raid")!.when!(l)).toBe(true);
    runEvent(l, "ft.ug.raid"); pickRun(l, /ติดสินบน/);
    expect(heatOf(l)).toBeLessThan(RAID_HEAT);
    expect(getEvent("ft.ug.raid")!.when!(l)).toBe(false);
  });
});

describe("ศาล", () => {
  it("มีทางสู้คดีหลายแบบ และการป้องกันตัวอ้างได้เฉพาะคดีที่เกี่ยวข้อง", () => {
    const l = life(5);
    runEvent(l, "ft.l.arrest", { sev: 2 });
    const ls = labels(l);
    for (const re of [/ทนาย/, /สารภาพ/, /ติดสินบนผู้พิพากษา/]) expect(ls.some((t) => re.test(t))).toBe(true);
    expect(ls.some((t) => /ป้องกันตัว/.test(t))).toBe(false);
    l.queue = []; runEvent(l, "ft.l.arrest", { sev: 2, selfdef: 1 });
    expect(labels(l).some((t) => /ป้องกันตัว/.test(t))).toBe(true);
  });
  it("สารภาพได้โทษเบากว่า และทนายชนะคดีได้", () => {
    const a = life(6); runEvent(a, "ft.l.arrest", { sev: 3 }); pickRun(a, /สารภาพ/);
    const b = life(7); runEvent(b, "ft.l.arrest", { sev: 3 }); pickRun(b, /ทนาย/, false);
    expect(Number(a.flags.jailUntil) - a.age).toBeLessThan(Number(b.flags.jailUntil) - b.age);
    const c = life(8); runEvent(c, "ft.l.arrest", { sev: 3 }); pickRun(c, /ทนาย/, true);
    expect(jailed(c)).toBe(false);
  });
});

describe("คุก", () => {
  it("ในคุกทำได้แค่สิ่งที่ทำในคุก ภัยข้างนอกตามมาไม่ถึง และพ้นโทษแล้วมีวันออกจากคุก", () => {
    const l = life(9); sentence(l, 2);
    year(l);
    expect(jailed(l)).toBe(true);
    expect(act(l, "ft_crime")).toBeUndefined();
    expect(activityLocked(l, act(l, "ft_p_train")!)).toBeUndefined();
    expect(eligibilityFilters.every((f) => f(l, getEvent("ft.dg.road")!))).toBe(false);
    expect(lawLines(l).some((t) => /ติดคุก/.test(t))).toBe(true);
    year(l); year(l);
    expect(jailed(l)).toBe(false);
    expect(getEvent("ft.ug.out")!.when!(l)).toBe(true);
    expect(act(l, "ft_p_train")).toBeUndefined();
  });
  it("วางแผนครบแล้วแหกคุกได้ หนีสำเร็จกลายเป็นคนหนีคดี", () => {
    const l = life(10); sentence(l, 5); year(l);
    let tries = 0;
    while ((fl(l).escape ?? 0) < ESCAPE_STEPS && tries++ < 20) { l.doneThisYear = []; doActivity(l, "ft_p_plan"); }
    expect(fl(l).escape).toBe(ESCAPE_STEPS);
    l.doneThisYear = []; l.queue = [];
    doActivity(l, "ft_p_escape"); only(l, "ft.ug.escape"); pickRun(l, /หนีตอนเปลี่ยนเวร/, true);
    expect(jailed(l)).toBe(false);
    expect(heatOf(l)).toBeGreaterThanOrEqual(40);
    year(l);
    expect(getEvent("ft.ug.out")!.when!(l)).toBe(false);
  });
  it("ถูกตัดสินแล้วยามเลิกจับตามอง และงานในคุกนับเป็นผลงานของกิลด์ที่เลื่อนขั้นได้", () => {
    const l = life(13); fl(l).ug = { rank: 1, merit: 2, heat: 70 };
    sentence(l, 2);
    expect(heatOf(l)).toBeLessThan(RAID_HEAT);
    year(l); doActivity(l, "ft_p_learn");
    expect(ugRank(l) >= 2 || l.stats.smarts > 0).toBe(true);
    expect(getEvent("ft.ug.raid")!.when!(l)).toBe(false);
  });
  it("กิจกรรมในคุกไม่ใช้ชื่อหมวดเดียวกับคุกของยุทธภพ", () => {
    for (const a of ACTIVITIES.filter((x) => x.id.startsWith("ft_p_"))) expect(a.group).not.toBe("ในคุก");
  });
  it("หาพวกในคุกแล้วพวกช่วยในลานคุกได้", () => {
    const l = life(11); sentence(l, 3); year(l);
    doActivity(l, "ft_p_ally");
    expect(l.people.some((p) => p.tags?.includes("prisoner"))).toBe(true);
    runEvent(l, "ft.ug.yard"); only(l, "ft.ug.yard");
    expect(labels(l).some((t) => /ช่วย/.test(t))).toBe(true);
  });
});

describe("ฆ่าคนมีผล", () => {
  it("รับจ้างฆ่าสำเร็จแล้วนับเป็นการฆ่า ใจแข็งขึ้น และครอบครัวเขากลับมาหาในภายหลัง", () => {
    const l = life(12);
    runEvent(l, "ft.l.crime"); only(l, "ft.l.crime"); pickRun(l, /ลอบสังหาร/, true);
    expect(fl(l).kills).toBe(1);
    expect(fl(l).persona!.m).toBeLessThan(0);
    l.age = Number(l.flags.ftKinRevengeAt);
    delete l.flags.jailUntil;
    expect(getEvent("ft.ug.kin")!.when!(l)).toBe(true);
  });
});

describe("ปีในคุกมีเรื่องของมันเอง", () => {
  it("ติดคุกหลายปีแล้วมีเรื่องในคุกเกิดขึ้น และไม่มีเรื่องชีวิตข้างนอก", () => {
    let prisonStories = 0, outside = 0;
    for (let s = 20; s < 32; s++) {
      const l = life(s, 30); sentence(l, 3);
      for (let i = 0; i < 3; i++) {
        l.queue = []; l.doneThisYear = []; ageUp(l);
        if (!jailed(l)) break;
        for (const q of l.queue) { if (/^ft\.ug\./.test(q.eventId)) prisonStories++; else if (!/^ft\.(break_|f2\.last|fr\.jail)/.test(q.eventId)) outside++; }
      }
    }
    expect(prisonStories).toBeGreaterThan(6);
    expect(outside).toBe(0);
  });
});

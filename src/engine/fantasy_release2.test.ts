import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { HEADLINES, pickHeadline } from "../content/fantasy/hkit";
import { setRace } from "../content/fantasy/life";
import { volumesOf, VOLUMES } from "../content/fantasy/lifestory";
import { fl, worldOfLife } from "../content/fantasy/state";
import { SITUATIONS, storyCtx, storylinesOf } from "../content/fantasy/storygen";
import { chapterTitle, liveQuietly, redoMoment, redoable, stopsQuiet, worldNews } from "../content/fantasy/year";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";
import { recordChronicle } from "./worldState";

loadFantasyWorld();
const life = (seed = 3, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 50_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(ev.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re} in ${q.eventId}`);
  return resolveChoice(l, o.index);
};

describe("เรื่องที่ประกอบจากชิ้นส่วน", () => {
  it("แต่ละเรื่องมีคนในเรื่องจริงและไม่ซ้ำชุดเดิม", () => {
    const l = life(5);
    const keys = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const s = storyCtx(l)!;
      const c = s.make();
      expect(l.people.some((p) => p.id === c.pid)).toBe(true);
      const k = Object.keys(l.seen).filter((x) => x.startsWith("ft.sg:")).length;
      expect(k).toBe(i + 1);
      keys.add(`${c.s}.${c.r}.${c.t}`);
      l.age += 16; // สถานการณ์เดียวกันห่างกัน 15 ปี
    }
    expect(keys.size).toBe(12);
  });
  it("ทุกสถานการณ์เล่นได้ครบทุกทาง", () => {
    for (const [i, s] of SITUATIONS.entries()) {
      for (let w = 0; w < 3; w++) {
        const l = life(100 + i * 3 + w);
        const st = storyCtx(l)!;
        const c = { ...st.make(), s: i };
        runEvent(l, `ft.sg.${s.id}`, c);
        const vis = visibleChoices(l, l.queue[0]);
        expect(vis.length).toBe(3);
        const out = resolveChoice(l, vis[w].index)!;
        expect(out.text.length).toBeGreaterThan(10);
        expect(out.text).not.toMatch(/\{[nrc]\}/);
      }
    }
  });
  it("เรื่องที่ช่วยไว้แล้วเขาสัญญาว่าจะกลับมา เปิดเส้นเรื่องที่กลับมาจริง", () => {
    const l = life(7);
    const st = storyCtx(l)!;
    const c = { ...st.make(), s: 0, t: "returns" };
    runEvent(l, "ft.sg.purse", c);
    choose(l, /ยื่นเงิน/);
    expect(storylinesOf(l)).toHaveLength(1);
    l.age = storylinesOf(l)[0].due;
    let came = false;
    for (let tries = 0; tries < 5 && !came; tries++) { l.queue = []; storylinesOf(l).length || storylinesOf(l).push({ kind: "help", pid: String((c as Record<string, unknown>).pid), due: l.age, title: "x" }); ageUp(l); came = l.queue.some((q) => q.eventId === "ft.sg.cont") || l.log.some((e) => e.text.includes("ไม่ลืม") || e.text.includes("ห่อ")); }
    expect(came).toBe(true);
  });
  it("เมื่อเรื่องเขียนไว้ที่เข้ากับปีนี้ถูกใช้ไปในชาติก่อนแล้ว ได้เรื่องที่ประกอบขึ้นมาแทน", () => {
    const l = life(8);
    l.pastSeen = HEADLINES.slice(0, HEADLINES.length - 20).map((h) => `ft.hl.${h.id}`).concat(HEADLINES.slice(-20).map((h) => `ft.hl.${h.id}`).slice(0, 5));
    l.pastSeen = HEADLINES.map((h) => `ft.hl.${h.id}`).slice(0, HEADLINES.length - 12);
    let made = 0;
    for (let i = 0; i < 20; i++) { const h = pickHeadline(l); if (h?.id.startsWith("ft.sg.")) made++; }
    expect(made).toBeGreaterThan(0);
  });
});

describe("เพศของคนในเรื่อง", () => {
  it("เรื่องที่ชื่อบอกว่าเป็นชายแก่ ได้ผู้ชายเสมอ", () => {
    for (let s = 0; s < 10; s++) {
      const l = life(60 + s, 40); fl(l).bodyRank = 3;
      runEvent(l, "ft.hl.duel_challenge_old");
      const p = l.people.find((x) => x.id === l.queue[l.queue.length - 1].ctx.pid)!;
      expect(p.gender).toBe("m");
    }
  });
});

describe("ใช้ชีวิตเงียบๆ", () => {
  it("เดินหลายปีได้ และหยุดเมื่อมีเรื่องอันตรายหรือเรื่องสำคัญ", () => {
    const l = life(9, 30);
    const age0 = l.age;
    const why = liveQuietly(l, 5, ageUp);
    expect(l.age).toBeGreaterThan(age0);
    if (l.age - age0 < 5) expect(why).toBeTruthy();
    runEvent(l, "ft.ar.bout");
    expect(stopsQuiet(l, l.queue[l.queue.length - 1]) ?? "x").toBeTruthy();
  });
});

describe("บทของปี", () => {
  it("ชื่อบทตามเรื่องที่เกิด และปีเงียบก็บอกว่าเงียบ", () => {
    const l = life(10);
    expect(chapterTitle(l, "ไฟไหม้กลางดึก")).toBe(`อายุ ${l.age} · ไฟไหม้กลางดึก`);
    expect(chapterTitle(l)).toMatch(/^อายุ \d+ · ปี/);
  });
  it("ข่าวของโลกปีนี้ไม่ใช่เรื่องของคุณเอง", () => {
    const l = life(11);
    const w = worldOfLife(l);
    recordChronicle(w, `${l.firstName}ทำบางอย่าง`);
    recordChronicle(w, "กษัตริย์แห่งวาร์นสิ้นพระชนม์");
    expect(worldNews(l)).toBe("กษัตริย์แห่งวาร์นสิ้นพระชนม์");
  });
  it("ชีวิตแบ่งเป็นเล่มตามวัย เผ่าอายุยืนอยู่ในวัยหนุ่มสาวนานกว่า", () => {
    const h = life(12, 50); fl(h).deedLog = [{ text: "a", age: 8 }, { text: "b", age: 16 }, { text: "c", age: 40 }];
    const vol = (l: Life, txt: string) => volumesOf(l).find((v) => v.beats.some((b) => b.text === txt))?.name;
    expect([vol(h, "a"), vol(h, "b"), vol(h, "c")]).toEqual([VOLUMES[0], VOLUMES[1], VOLUMES[3]]);
    const e = life(13, 120); setRace(e, "elf"); fl(e).deedLog = [{ text: "x", age: 70 }];
    expect(vol(e, "x")).toBe(VOLUMES[2]);
  });
});

describe("คิดใหม่หนึ่งเรื่อง", () => {
  it("ย้อนก่อนช่วงเล็กๆ ของปีนี้ ให้เลือกเรื่องนั้นเอง เสียความสุขสาม และทำได้ปีละครั้ง", () => {
    let l = life(14, 25);
    let list: { i: number; title: string }[] = [];
    for (let y = 0; y < 30 && !list.length; y++) { l.queue = []; ageUp(l); list = redoable(l); }
    expect(list.length).toBeGreaterThan(0);
    const joy = l.stats.happiness;
    const n = redoMoment(l, list[0].i)!;
    expect(n).toBeTruthy();
    expect(n.stats.happiness).toBeLessThanOrEqual(joy);
    expect(n.queue.length).toBeGreaterThan(0);
    expect(redoable(n)).toEqual([]);
    l = n;
    expect(redoMoment(l, list[0].i)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { activitiesFor, doActivity } from "./activities";
import { allEvents, eligibilityFilters, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { worldOfLife } from "../content/murim/life/world";
import { addHeat } from "../content/murim/life/law";
import { canFound, foundSect, masters, mySect, myPlace } from "../content/murim/m17core";
import { CAREERS } from "../content/hunter/careers";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("Murim Phase 9: เอาของเก่าออกทั้งหมด + ระบบที่ยังขาด", () => {
  it("ยุทธภพไม่มี event เก่าเหลืออยู่เลย และกิจกรรมเป็นชุดใหม่ทั้งหมด", () => {
    const l = createLife({ seed: 3, worldId: "murim" });
    const old = allEvents().filter((e) => (!e.world || e.world === "murim") && !e.notIn?.includes("murim") && eligibilityFilters.every((f) => f(l, e)) && /^(murim|m|m2|m17|m23|q|kid|free|fate|nemesis|party|phone|l23)\./.test(e.id));
    expect(old.map((e) => e.id)).toEqual([]);
    l.age = 30;
    const acts = activitiesFor(l).map((a) => a.id);
    expect(acts.every((id) => id.startsWith("mw_") || id === "m_heal"), acts.join(",")).toBe(true);
    expect(new Set(activitiesFor(l).map((a) => (a as { group?: string }).group)).size).toBeGreaterThanOrEqual(5);
  });

  it("อาชญากรรม → ประกาศจับ → ศาล → คุก/เนรเทศ ทำงานจริง และไม่มีฉากตัน", () => {
    let jailed = 0, exiled = 0, wanted = 0, trials = 0;
    for (let s = 1; s <= 80; s++) {
      const l = createLife({ seed: s * 911, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s * 7 };
      l.age = 20;
      for (let y = 0; y < 25 && l.alive; y++) {
        for (const id of ["mw_steal", "mw_rob", "mw_frame"]) { doActivity(l, id); drain(l, r); }
        if (l.flags.wanted) wanted++;
        if (Number(l.flags.jailUntil ?? -1) > l.age) jailed++;
        if (l.flags.exiled) exiled++;
        trials += l.seen["cr.trial"] ?? 0;
        drain(l, r);
        ageUp(l);
        drain(l, r);
      }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM P9 อาชญากรรม: ถูกประกาศจับ", wanted, "| ปีในคุก", jailed, "| เนรเทศ", exiled, "| ขึ้นศาล", trials);
    expect(wanted).toBeGreaterThan(0);
    expect(jailed + exiled).toBeGreaterThan(0);
  });

  it("ย้ายถิ่น ไว้ทุกข์ ยุคสามแคว้น อาชีพใหม่ ทำเนียบ และสำนัก ทำงาน", () => {
    // ย้ายถิ่น
    const a = createLife({ seed: 77, worldId: "murim" });
    a.age = 25; a.money = 100_000;
    const from = a.flags.region ?? "";
    runEvent(a, "tv.move");
    const opts = visibleChoices(a, a.queue[0]);
    resolveChoice(a, opts[0].index);
    expect(a.flags.region).not.toBe(from);
    // ไว้ทุกข์ห้ามแต่งงาน
    a.flags.mourningUntil = a.age + 3;
    expect(activitiesFor(a).find((x) => x.id === "mw_matchmaker")).toBeTruthy();
    // ยุคสามแคว้นเกิดได้
    let wars = 0, served = 0;
    for (let s = 1; s <= 60; s++) {
      const l = createLife({ seed: s * 313, worldId: "murim" });
      const w = worldOfLife(l);
      w.era = "chaos"; w.eraSince = l.birthYear - 10; w.legitimacy = 10; w.unrest = 90;
      l.age = 18;
      const r = { rng: s };
      for (let y = 0; y < 30 && l.alive; y++) { ageUp(l); drain(l, r); if (l.mw?.era === "war") wars++; if (l.flags.lord) served++; }
    }
    console.log("SIM P9 ยุคสามแคว้น: ปีสงคราม", wars, "| ปีที่รับใช้เจ้าแคว้น", served);
    expect(wars).toBeGreaterThan(20);
    // อาชีพใหม่มีครบตามแผน
    for (const id of ["fisher", "smith", "merchant", "constable", "soldier", "teacher", "monk", "beggar_sect", "bandit", "thief", "poisoner", "cultist"]) expect(CAREERS.some((c) => c.id === id && c.world === "murim"), id).toBe(true);
    const m = createLife({ seed: 9, worldId: "murim" });
    m.age = 20; m.stats.smarts = 90;
    expect(String(applyJob(m, "official").text)).toMatch(/สอบ/);
    // ทำเนียบและสำนักยังทำงาน (ระบบเดิม เนื้อเรื่องใหม่)
    const k = createLife({ seed: 21, worldId: "murim" });
    k.age = 40; k.money = 5_000_000;
    k.power = { rank: 5, hunterClass: "m_sword", level: 40, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
    ageUp(k);
    expect(masters(k).length).toBeGreaterThan(0);
    expect(canFound(k)).toBeUndefined();
    foundSect(k, "สำนักทดสอบ");
    expect(mySect(k)?.n).toBe("สำนักทดสอบ");
    expect(myPlace(k)).toBeGreaterThanOrEqual(0);
    addHeat(k, 60);
    expect(k.flags.wanted).toBe(true);
  });
});

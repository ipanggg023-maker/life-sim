import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { careerById } from "../content/hunter/careers";
import { knows } from "../content/murim/martial/arts";
import { worldOfLife } from "../content/murim/life/world";
import { activeWar, mySide, warsOf } from "../content/murim/world/sectWar";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, jobRequirementMissing, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }, prefer?: string) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const i = prefer ? o.findIndex((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(prefer)) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("ปลุกพลังตั้งแต่เด็ก · ขุนนางสมัครได้ทุกคน", () => {
  it("พรสวรรค์แรง (ร่างเซียน) ทำให้ชีพจรเปิดเองตอนหกเจ็ดขวบ แล้วสำนักมาทาบทาม", () => {
    let early = 0, alive = 0, invited = 0;
    for (let s = 1; s <= 40; s++) {
      const l = createLife({ seed: 300 + s * 13, worldId: "murim", talents: ["mt_immortal_body"] });
      worldOfLife(l);
      const r = { rng: s };
      while (l.alive && l.age < 13) { drain(l, r); if (l.alive) ageUp(l); }
      drain(l, r);
      if (!l.alive) continue;
      alive++;
      if (l.power && (l.power.awakenedAt ?? 99) <= 7) early++;
      if (l.seen["mk.early_sect"] || l.seen["ta.w_sects"]) invited++;
    }
    console.log("SIM early awakening", { alive, early, invited });
    expect(early).toBeGreaterThan(alive * 0.8);
    expect(invited).toBeGreaterThan(alive * 0.6);
  });

  it("ผู้สอนลึกลับ: เด็กคนไหนก็เจอได้ ได้พลังปราณก่อนวัยพร้อมวิชาลมหายใจ หรือได้อาจารย์ลับ", () => {
    const l = createLife({ seed: 5, worldId: "murim" });
    worldOfLife(l);
    l.age = 7;
    expect(getEvent("mk.mystery_teacher")!.weight).toBeTruthy();
    runEvent(l, "mk.mystery_teacher");
    drain(l, { rng: 1 }, "ขอตามไปเป็นศิษย์");
    expect(l.power).toBeTruthy();
    expect(knows(l, "a_breathing")).toBe(true);
    expect(l.people.some((p) => p.tags?.includes("master"))).toBe(true);
    // ในชีวิตสุ่ม เด็กบางส่วนเจอผู้สอนลึกลับ
    let met = 0;
    for (let s = 1; s <= 120; s++) {
      const x = createLife({ seed: s * 911, worldId: "murim" });
      worldOfLife(x);
      const r = { rng: s };
      while (x.alive && x.age < 11) { drain(x, r); if (x.alive) ageUp(x); }
      if (x.seen["mk.mystery_teacher"]) met++;
    }
    console.log("SIM mystery teacher met", met, "/ 120");
    expect(met).toBeGreaterThan(3);
  });

  it("สอบผ่านแล้วสมัครขุนนางได้ทุกคน รวมคนที่ฝึกยุทธ์", () => {
    const l = createLife({ seed: 9, worldId: "murim" });
    worldOfLife(l);
    l.age = 25; l.stats.smarts = 80;
    l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
    const official = careerById("official")!;
    expect(jobRequirementMissing(l, official)).toBeTruthy();
    l.flags.xiucai = true;
    expect(jobRequirementMissing(l, official)).toBeUndefined();
  });

  it("สงครามสำนัก: ประกาศ เลือกข้าง รบหลายปี จบด้วยชนะ/แพ้/สงบศึก และคนรู้จักตายในศึกได้", () => {
    let wars = 0, ended = 0, joined = 0, npcDeaths = 0;
    for (let s = 1; s <= 40; s++) {
      const l = createLife({ seed: 1000 + s * 17, worldId: "murim" });
      worldOfLife(l);
      l.age = 20; l.stats.health = 95; l.mw!.cult = 95;
      l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
      for (let i = 0; i < 6; i++) { const p = createPerson(l, "friend", { age: 22, bond: 60 }); p.martial = { rank: 2, style: "กระบี่", sect: i % 2 ? "สำนักกระบี่เมฆา" : "วัดวัชระ", xp: 0 }; }
      const r = { rng: s };
      for (let y = 0; y < 20 && l.alive; y++) {
        l.stats.health = 95;
        ageUp(l);
        drain(l, r, y < 2 ? "เข้าร่วมฝ่าย" : undefined);
        if (mySide(l)) joined++;
        expect(validateLife(l)).toEqual([]);
      }
      wars += warsOf(l).length;
      ended += warsOf(l).filter((w) => w.ended).length;
      npcDeaths += l.people.filter((p) => p.martial && !p.alive).length;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM sect wars", { wars, ended, joinedYears: joined, npcDeaths });
    expect(wars).toBeGreaterThan(10);
    expect(ended).toBeGreaterThan(5);
    expect(joined).toBeGreaterThan(10);
    expect(npcDeaths).toBeGreaterThan(0);
    expect(activeWar).toBeTruthy();
  });
});

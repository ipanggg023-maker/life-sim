import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { REGIONS } from "../content/murim/life/region";
import { calYear, worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { syncThrone } from "../content/murim/world/emperor";
import { kingOf, kingdomOfRegion, kingsOf, rulerHere } from "../content/murim/world/regionKings";
import type { Kingdom } from "../content/murim/world/war";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 60) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("อ๋องครองแต่ละภูมิภาค · ยุคสามแคว้นแบ่งภูมิภาค", () => {
  it("ทุกภูมิภาคยกเว้นเมืองหลวงมีอ๋องของตัวเอง ย้ายไปที่ไหนก็เห็นผู้ปกครองต่างกัน", () => {
    const l = createLife({ seed: 3, worldId: "murim" });
    worldOfLife(l);
    expect(kingsOf(l).length).toBe(REGIONS.length - 1);
    const seen = new Set<string>();
    for (const r of REGIONS) { l.flags.region = r.id; seen.add(rulerHere(l)); }
    expect(seen.size).toBe(REGIONS.length);
    l.flags.region = "capital";
    expect(kingOf(l)).toBeUndefined();
    expect(rulerHere(l)).toContain(courtOf(l).emperor.name);
  });

  it("ชีวิตในถิ่นของอ๋อง: เรื่องของอ๋องเกิดจริง อ๋องสิ้นพระชนม์และกบฏได้ ข้อมูลไม่พัง", () => {
    let kg = 0, deaths = 0, rebels = 0;
    for (let s = 1; s <= 40; s++) {
      const l = createLife({ seed: 700 + s * 11, worldId: "murim" });
      worldOfLife(l);
      l.flags.region = REGIONS[s % 5].id;
      l.fame = 40;
      const names0 = kingsOf(l).map((k) => k.name).join();
      const r = { rng: s };
      for (let y = 0; y < 40 && l.alive; y++) {
        drain(l, r);
        if (!l.alive) break;
        if (l.age >= 18) l.stats.health = Math.max(l.stats.health, 50);
        ageUp(l);
        if (l.mw?.kings?.some((k) => k.rebel)) rebels++;
      }
      drain(l, r);
      expect(validateLife(l)).toEqual([]);
      kg += Object.keys(l.seen).filter((k) => k.startsWith("kg.")).length;
      if (l.mw?.kings && l.mw.kings.map((k) => k.name).join() !== names0) deaths++;
    }
    console.log("SIM kings", { kg, deaths, rebels });
    expect(kg).toBeGreaterThan(10);
    expect(deaths).toBeGreaterThan(10);
  });

  it("ฮ่องเต้ต้องคุมอ๋อง: กบฏ ลดอำนาจ ตัวประกัน", () => {
    let seen = 0;
    for (let s = 1; s <= 20; s++) {
      const l = createLife({ seed: 900 + s, worldId: "murim" });
      worldOfLife(l);
      l.age = 35; l.stats.smarts = 70;
      courtOf(l);
      l.flags.emperorSelf = true;
      syncThrone(l);
      for (const k of kingsOf(l)) { k.power = 70; k.loyalty = 15; }
      const r = { rng: s };
      for (let y = 0; y < 12 && l.alive && l.flags.emperorSelf; y++) { l.stats.health = 90; drain(l, r); ageUp(l); }
      drain(l, r);
      seen += Object.keys(l.seen).filter((k) => k.startsWith("kg.e_")).length;
      expect(validateLife(l)).toEqual([]);
    }
    console.log("SIM emperor vs kings", seen);
    expect(seen).toBeGreaterThan(10);
  });

  it("ยุคสามแคว้น: ภูมิภาคเป็นของแคว้น แคว้นที่ล่ม ภูมิภาคถูกผนวกไปตลอด · รวมแผ่นดินแล้วมีอ๋องชุดใหม่", () => {
    const l = createLife({ seed: 41, worldId: "murim" });
    const w = worldOfLife(l);
    kingsOf(l);
    w.era = "war"; w.eraSince = calYear(l);
    w.kingdoms = [
      { id: "north", name: "แคว้นจิ้นเหนือ", lord: "เฉาเจิ้นอวี่", power: 60, trait: "เหี้ยม" },
      { id: "west", name: "แคว้นซูตะวันตก", lord: "หลิวอันเหริน", power: 30, trait: "ใจกว้าง" },
      { id: "south", name: "แคว้นหลินใต้", lord: "ซุนเหยาหมิง", power: 10, trait: "ระวังตัว", fallen: calYear(l), fellTo: "north" },
    ] as Kingdom[];
    l.flags.region = "jiangnan";
    expect(kingdomOfRegion(l)!.k.id).toBe("north");
    expect(kingdomOfRegion(l)!.annexedFrom?.id).toBe("south");
    expect(rulerHere(l)).toContain("ล่มสลาย");
    l.flags.region = "sichuan";
    expect(kingdomOfRegion(l)!.k.id).toBe("west");
    ageUp(l);
    expect(w.kings).toBeUndefined();
    w.era = "recovery"; w.kingdoms = undefined;
    ageUp(l);
    expect(kingsOf(l).length).toBe(REGIONS.length - 1);
  });
});

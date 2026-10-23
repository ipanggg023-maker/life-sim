import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { calYear, worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { syncThrone } from "../content/murim/world/emperor";
import { royalEvent } from "../content/murim/world/emperorLife";
import { plansFor } from "../content/murim/life/plan";
import { activitiesFor } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

function emperor(seed: number) {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 30; l.stats.health = 85;
  l.job = { careerId: "official", level: 4, performance: 50, years: 5 };
  courtOf(l);
  l.flags.emperorSelf = true;
  syncThrone(l);
  l.queue = [];
  return l;
}
function drain(l: Life, r: { rng: number }, seen?: string[]) {
  let g = 0;
  while (l.queue.length && g++ < 60) {
    seen?.push(l.queue[0].eventId);
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("ฮ่องเต้เจอแต่เรื่องของคนบนบัลลังก์", () => {
  it("ขึ้นครองราชย์แล้วไม่มีอาชีพเดิม · กิจกรรมเหลือแค่ราชสำนัก วังหลัง ชีวิตในวัง และฝึกยุทธ์", () => {
    const l = emperor(3);
    expect(l.job).toBeUndefined();
    const acts = activitiesFor(l);
    for (const a of acts) expect(["ราชสำนัก", "วังหลัง", "ชีวิตในวัง"].includes(a.group ?? "") || ["mw_body", "mw_meditate", "mw_manual", "mw_poison"].includes(a.id), a.id).toBe(true);
    expect(acts.some((a) => a.id === "mw_r_garden")).toBe(true);
    expect(acts.some((a) => a.id === "mw_tavern" || a.id === "mw_gamble")).toBe(false);
    // แผนประจำปีเป็นของคนบนบัลลังก์ (ฝึกวิชา/พักฟื้นยังเลือกได้)
    const plans = plansFor(l).map((p) => p.id);
    expect(plans).toContain("r_rule");
    expect(plans.some((id) => ["work", "wander", "study", "family"].includes(id))).toBe(false);
    const commoner = createLife({ seed: 4, worldId: "murim" });
    commoner.age = 30;
    expect(plansFor(commoner).some((p) => p.id.startsWith("r_"))).toBe(false);
  });

  it("ยี่สิบปีบนบัลลังก์: ไม่มีเรื่องของชาวบ้านสักเรื่อง และมีเรื่องของฮ่องเต้หลากหลาย", () => {
    const seen: string[] = [];
    for (let s = 1; s <= 25; s++) {
      const l = emperor(100 + s * 11);
      createPerson(l, "child", { age: 10, gender: "f" });
      const r = { rng: s };
      for (let y = 0; y < 20 && l.alive && l.flags.emperorSelf; y++) {
        l.stats.health = Math.max(60, l.stats.health);
        drain(l, r, seen);
        if (!l.alive || !l.flags.emperorSelf) break;
        ageUp(l);
        expect(validateLife(l)).toEqual([]);
      }
    }
    const notRoyal = [...new Set(seen.filter((id) => !royalEvent(id)))];
    expect(notRoyal, notRoyal.join(", ")).toEqual([]);
    const kinds = new Set(seen);
    console.log("SIM royal variety", kinds.size, "events,", seen.length, "scenes");
    expect(kinds.size).toBeGreaterThan(30);
  });

  it("วิกฤตของแผ่นดินมาถึงฮ่องเต้ในฐานะผู้ปกครอง ครั้งเดียวต่อวิกฤต", () => {
    for (const id of ["famine", "plague", "rebellion", "cult"] as const) {
      const l = emperor(7);
      l.mw!.crisis = { id, stage: 2, since: calYear(l) };
      runEvent(l, `ct.e_cr_${id}`);
      expect(l.queue[0].eventId).toBe(`ct.e_cr_${id}`);
      drain(l, { rng: 1 });
      expect(l.flags.royalCrisis).toBe(`${id}:${calYear(l)}`);
    }
  });

  it("ฎีกาเช้านี้เปลี่ยนเรื่องไปเรื่อยๆ", () => {
    const l = emperor(9);
    const texts = new Set<string>();
    for (let i = 0; i < 12; i++) { runEvent(l, "ct.e_morning"); texts.add(String(l.queue[0].ctx.k)); drain(l, { rng: i }); }
    expect(texts.size).toBeGreaterThan(3);
  });
});

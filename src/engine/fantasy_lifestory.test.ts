import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { plant } from "../content/fantasy/conseq";
import { closest, enemies, epitaph, timelineOf } from "../content/fantasy/lifestory";
import { personaOf } from "../content/fantasy/persona";
import { deed, fl } from "../content/fantasy/state";
import { mark } from "../content/fantasy/worldmark";
import { ageUp, createLife, runEvent, toPastLife } from "./game";
import { remember } from "./npc";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 29): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};

describe("เรื่องราวชีวิต", () => {
  it("ร้อยทางเลือก เรื่องที่กลับมา ผลงาน และรอยเท้าบนแผ่นดินเป็นลำดับเวลา", () => {
    const l = life(3, 12);
    plant(l, "bandit_kid_fed");
    l.age = 20; deed(l, "สังหารมังกรทดสอบ");
    l.age = 25; mark(l, "ทดสอบแผ่นดิน", { s: 2 });
    l.age = 30; runEvent(l, "ft.ec.bandit_kid_fed");
    const t = timelineOf(l);
    expect(t.map((b) => b.kind)).toEqual(expect.arrayContaining(["seed", "echo", "deed", "mark"]));
    expect(t[0].age).toBeLessThanOrEqual(t.at(-1)!.age);
    expect(t.find((b) => b.kind === "echo")!.text).toContain("อัศวินที่เคยเป็นโจร");
  });
  it("จดนิสัยทุกสิบปี เพื่อเห็นว่าเปลี่ยนไปอย่างไร", () => {
    const l = life(4, 29);
    personaOf(l).h = -70;
    ageUp(l);
    expect(fl(l).personaLog?.at(-1)).toEqual({ age: 30, words: ["จิ้งจอกเจ้าเล่ห์"] });
  });
  it("คนที่รักที่สุด คนที่แค้นที่สุด และคำจารึก", () => {
    const l = life(5);
    const a = createPerson(l, "friend", { age: 30 }); remember(l, a, "x", "คุณช่วยชีวิตเขา", 3, { love: 60, loyalty: 40 });
    const b = createPerson(l, "rival", { age: 30 }); remember(l, b, "x", "คุณทำให้เขาเสียงาน", 3, { grudge: 80 });
    personaOf(l).m = 70;
    deed(l, "ปราบปลาไหลยักษ์");
    expect(closest(l, 1)[0].id).toBe(a.id);
    expect(enemies(l)[0].id).toBe(b.id);
    const e = epitaph(l);
    expect(e[0]).toContain("ผู้มีใจเมตตา");
    expect(e.join(" ")).toContain(a.name);
    expect(e.join(" ")).toContain(b.name);
    expect(toPastLife(l).verdict).toContain("ผู้มีใจเมตตา");
  });
});

import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { ANCIENTS, NEED_LEADS, reachable, stateOf, threatOf } from "../content/fantasy/ancients";
import { attachWorld, closeLife } from "../content/fantasy/life";
import { fl } from "../content/fantasy/state";
import { doActivity } from "./activities";
import { currentScene, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, runEvent } from "./game";
import { newSoul } from "./soul";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const know = (l: Life, id: string) => { fl(l).ancientLeads = { ...fl(l).ancientLeads, [id]: NEED_LEADS }; };
const choose = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0]; const s = currentScene(q, l)!;
  const i = s.choices.findIndex((c) => (!c.show || c.show(l, q.ctx)) && re.test(labelOf(c, l, q.ctx)));
  if (i < 0) throw new Error(`no ${re} in ${q.eventId}: ${s.choices.map((c) => labelOf(c, l, q.ctx)).join(" | ")}`);
  const out = s.choices[i].run(l, q.ctx, ok);
  l.queue.shift();
  return out;
};
const visit = (l: Life) => { l.queue = []; doActivity(l, "ft_ancient"); l.queue = l.queue.filter((q) => q.eventId.startsWith("ft.an.")); return l.queue[0]?.eventId; };

describe("มังกรโบราณ", () => {
  it("มีห้าตัว ชื่อตามที่อนุมัติ และทุกฉากมีทางเลือกอย่างน้อยสามทาง", () => {
    expect(ANCIENTS.map((a) => a.name)).toEqual(["อาซาร์โกธ", "ไวร์มัคซาร์", "เลวีอาธัล", "โกลโมรอธ", "เซราฟาเอล"]);
    const l = life(1); know(l, "azargoth");
    for (const id of ["ft.an.sleep", "ft.an.awake", "ft.an.friend", "ft.an.bones", "ft.an.raid"]) {
      l.queue = []; runEvent(l, id, { a: "azargoth" });
      expect(visibleChoices(l, l.queue[0]).length, id).toBeGreaterThanOrEqual(3);
    }
  });
  it("ข่าวลือให้เบาะแสเมื่อตามไปถามจนได้ความ", () => {
    const l = life(7);
    runEvent(l, "ft.an.rumor");
    const id = String(l.queue[0].ctx.a);
    choose(l, /ตามไปถาม/, true);
    expect(fl(l).ancientLeads?.[id]).toBe(1);
    expect(l.flags.ftAnRumor).toBe(l.age);
  });
  it("ต้องได้ยินข่าวครบก่อนถึงจะไปที่หลับได้", () => {
    const l = life(2);
    expect(reachable(l)).toBeUndefined();
    know(l, "golmoroth");
    expect(reachable(l)?.id).toBe("golmoroth");
    expect(visit(l)).toBe("ft.an.sleep");
  });
  it("ปลุกแล้วสังหารได้ และโลกจำผลไว้ข้ามชีวิต", () => {
    const l = life(3); know(l, "wyrmaxar");
    visit(l); choose(l, /ปลุก/);
    expect(l.queue[0]?.eventId).toBe("ft.an.awake");
    choose(l, /สู้กับ/, true);
    expect(stateOf(l, "wyrmaxar").state).toBe("slain");
    expect(stateOf(l, "wyrmaxar").by).toBe(l.lastName);
    const s = newSoul(); s.lives = 3; closeLife(s, l);
    const next = createLife({ seed: 30, worldId: "fantasy", plain: true }); attachWorld(next, s);
    next.age = 25; know(next, "wyrmaxar");
    expect(stateOf(next, "wyrmaxar").state).toBe("slain");
    expect(visit(next)).toBe("ft.an.bones");
  });
  it("เจรจาสำเร็จแล้วมังกรจำตระกูล ลูกหลานไปหาได้", () => {
    const l = life(4); know(l, "leviathal");
    visit(l); choose(l, /ปลุก/); choose(l, /เจรจา/, true);
    expect(stateOf(l, "leviathal")).toMatchObject({ state: "friend", by: l.lastName });
    const kid = life(40); kid.lastName = l.lastName; kid.fw = l.fw; kid.ft = { ...kid.ft!, ancientLeads: { leviathal: NEED_LEADS } };
    expect(visit(kid)).toBe("ft.an.friend");
  });
  it("ปลุกแล้วหนี มังกรออกอาละวาดและบุกแผ่นดิน", () => {
    const l = life(5); know(l, "seraphael");
    visit(l); choose(l, /ปลุก/); choose(l, /ถอยหนี/);
    expect(stateOf(l, "seraphael").state).toBe("raging");
    let raids = 0;
    for (let i = 0; i < 25; i++) { l.queue = []; l.doneThisYear = []; ageUp(l); if (l.queue.some((q) => q.eventId === "ft.an.raid")) raids++; }
    expect(raids).toBeGreaterThan(0);
  });
  it("ถืออาวุธที่ผูกกับมังกรได้เปรียบในการสู้ และได้ยินข่าวของมัน", () => {
    const l = life(6);
    const a = ANCIENTS.find((x) => x.id === "golmoroth")!;
    const plain = threatOf(l, a);
    fl(l).relic = "cleaver";
    expect(threatOf(l, a)).toBeLessThan(plain);
    l.queue = []; ageUp(l);
    expect(fl(l).ancientLeads?.golmoroth ?? 0).toBeGreaterThanOrEqual(1);
  });
});

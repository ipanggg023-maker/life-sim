import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { lean } from "../content/fantasy/persona";
import { fl } from "../content/fantasy/state";
import { spellOdds, SPELLS } from "../content/fantasy/magic";
import { CORES, WAND_NAMES, WOODS, bestWood, wandCtx } from "../content/fantasy/wands";
import { doActivity } from "./activities";
import { currentScene, labelOf, visibleChoices } from "./events";
import { ageUp, createLife } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 14): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const pick = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0]; const s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no ${re}: ${s.choices.map((x) => labelOf(x, l, q.ctx)).join(" | ")}`);
  const out = c.run(l, q.ctx, ok); l.queue.shift(); return out;
};

describe("คทาเลือกคุณ", () => {
  it("มี 24 เล่ม ชื่อไม่ซ้ำ", () => {
    const names = Object.values(WAND_NAMES).flat();
    expect(names).toHaveLength(WOODS.length * CORES.length);
    expect(new Set(names).size).toBe(24);
  });
  it("เนื้อไม้ตามนิสัย: ใจเมตตาได้หลิว ใจโหดได้ยู", () => {
    const kind = life(1); lean(kind, { m: 80 }, true);
    expect(bestWood(kind).id).toBe("willow");
    const cruel = life(2); lean(cruel, { m: -80 }, true);
    expect(bestWood(cruel).id).toBe("yew");
  });
  it("แกนตามธาตุ และคุณภาพตามดาวเวท", () => {
    const l = life(3); fl(l).element = "water"; fl(l).potential = 9;
    const c = wandCtx(l);
    expect(c.core).toBe("serpent");
    expect(Number(c.q)).toBeGreaterThanOrEqual(4);
    const low = life(4); fl(low).potential = 0;
    expect(Number(wandCtx(low).q)).toBeLessThanOrEqual(2);
  });
  it("ไปร้านครั้งแรกคทาเป็นฝ่ายเลือก และมีทางเลือกอย่างน้อยสามทาง", () => {
    const l = life(5); lean(l, { c: 70 }, true);
    doActivity(l, "ft_wand");
    expect(l.queue[0].eventId).toBe("ft.wand.first");
    expect(visibleChoices(l, l.queue[0]).length).toBeGreaterThanOrEqual(3);
    pick(l, /จ่ายแล้วรับ/);
    expect(fl(l).wand?.wood).toBe("ash");
    expect(fl(l).wand?.name).toBe(WAND_NAMES.ash[["phoenix", "serpent", "griffin"].indexOf(fl(l).wand!.core!)]);
  });
  it("นักเรียนได้คทาแรกจากโรงเรียนฟรี", () => {
    const l = life(6, 11); l.money = 0; fl(l).school = "arcanvale"; fl(l).schoolSince = 11;
    l.queue = []; ageUp(l);
    l.queue = l.queue.filter((q) => q.eventId === "ft.wand.first");
    expect(l.queue.length).toBe(1);
    const before = l.money;
    pick(l, /รับคทาจากโรงเรียน/);
    expect(fl(l).wand).toBeTruthy();
    expect(l.money).toBe(before);
  });
  it("หาคทาที่ดีกว่าได้ แต่คทาต้องยอมรับคุณก่อน", () => {
    const l = life(7); fl(l).wand = { name: "คทาไม้ฮอลลี", quality: 1, material: "ไม้ฮอลลี" };
    doActivity(l, "ft_wand");
    expect(l.queue[0].eventId).toBe("ft.wand.seek");
    pick(l, /ลองจับ/, false);
    expect(fl(l).wand?.quality).toBe(1);
    l.doneThisYear = []; doActivity(l, "ft_wand");
    l.queue = l.queue.filter((q) => q.eventId === "ft.wand.seek");
    pick(l, /ลองจับ/, true);
    expect(fl(l).wand?.quality).toBeGreaterThanOrEqual(2);
  });
  it("แกนช่วยเวทธาตุของมัน", () => {
    const l = life(8); fl(l).magicRank = 2;
    const fire = SPELLS.find((s) => s.element === "fire")!;
    const before = spellOdds(l, fire, 30);
    fl(l).wand = { name: "ซอลเวริน", quality: 2, material: "", wood: "oak", core: "phoenix" };
    expect(spellOdds(l, fire, 30)).toBeGreaterThan(before);
  });
});

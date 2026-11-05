import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { CRISIS_WIN, LORE, NEW_RELICS, WONDERS, legendLines, worthy } from "../content/fantasy/legends2";
import { dataOf, fl, homeKingdom, myRelic, type FData } from "../content/fantasy/state";
import { lean } from "../content/fantasy/persona";
import { doActivity } from "./activities";
import { currentScene, getEvent, labelOf } from "./events";
import { ageUp, createLife, oddsOf, runEvent } from "./game";
import type { Life } from "./types";

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
const give = (l: Life, id: string) => { const r = D(l).relics.find((x) => x.id === id)!; r.holder = "player"; fl(l).relic = id; return r; };

describe("อาวุธตำนาน", () => {
  it("โลกมีอาวุธตำนานชิ้นใหม่แปดชิ้น รวมเอ็กซ์คาลิเบอร์ในหิน", () => {
    const l = life(1); year(l);
    for (const r of NEW_RELICS) expect(D(l).relics.some((x) => x.id === r.id), r.id).toBe(true);
    expect(D(l).relics.find((x) => x.id === "excalibur")!.holder).toBe("stone");
  });
  it("เอ็กซ์คาลิเบอร์ดึงได้เฉพาะคนที่คู่ควรแก่บัลลังก์", () => {
    const l = life(2); year(l);
    const ex = D(l).relics.find((x) => x.id === "excalibur")!; ex.at = homeKingdom(l).id;
    expect(worthy(l)).toBe(false);
    l.queue = []; runEvent(l, "ft.lg.stone"); pickRun(l, /ลองดึงดาบ/);
    expect(fl(l).relic).toBeUndefined();
    fl(l).court = { rank: 3, favor: 0 };
    expect(worthy(l)).toBe(true);
    runEvent(l, "ft.lg.stone"); pickRun(l, /ลองดึงดาบ/);
    expect(fl(l).relic).toBe("excalibur");
  });
  it("อาวุธตำนานขึ้นเป็นทางเลือกในฉากต่อสู้ ปีละครั้ง และโอกาสสูงกว่าสู้ธรรมดา", () => {
    const l = life(3); year(l); give(l, "cleaver");
    l.queue = []; runEvent(l, "ft.dg.road");
    const s = currentScene(l.queue[0], l)!;
    const relic = s.choices.find((c) => labelOf(c, l, l.queue[0].ctx).startsWith("ขวานผ่าภูผา"));
    expect(relic).toBeTruthy();
    expect(oddsOf(l, relic!, l.queue[0].ctx)!).toBeGreaterThan(oddsOf(l, s.choices[0], l.queue[0].ctx)!);
    relic!.run(l, l.queue[0].ctx, true); l.queue.shift();
    runEvent(l, "ft.dg.road");
    expect(currentScene(l.queue[0], l)!.choices.some((c) => labelOf(c, l, l.queue[0].ctx).startsWith("ขวานผ่าภูผา"))).toBe(false);
  });
  it("อาวุธแต่ละชิ้นมีเรื่องของตัวเอง", () => {
    const l = life(4); year(l);
    for (const id of ["veilcutter", "grief", "excalibur", "cleaver", "chronos"]) { give(l, id); expect(getEvent(`ft.lg.r_${id}`)!.when!(l), id).toBe(true); }
  });
  it("อาวุธตำนานมีใจ: เอ็กซ์คาลิเบอร์ทิ้งคนไม่ซื่อตรง", () => {
    const l = life(5); year(l); give(l, "excalibur");
    lean(l, { h: -60 }, true);
    year(l);
    expect(myRelic(l)).toBeUndefined();
    expect(D(l).relics.find((x) => x.id === "excalibur")!.holder).toBe("stone");
  });
  it("ช่างระดับสูงสุดตีอาวุธตำนานของตัวเองได้ และมันอยู่ในโลกพร้อมชื่อ", () => {
    const l = life(6, 40); l.money = 1_000_000; fl(l).craft = { smith: 800 };
    doActivity(l, "ft_forge_relic"); only(l, "ft.lg.forge"); pickRun(l, /ชื่อเสียง/);
    expect(myRelic(l)?.name).toContain(l.lastName);
    expect(D(l).relics.some((r) => r.id === fl(l).relic)).toBe(true);
  });
});

describe("สิ่งมหัศจรรย์ ภัยของโลก และความจริง", () => {
  it("สิ่งมหัศจรรย์ต้องมีเบาะแสก่อน และค้นพบได้คนเดียวต่อโลก", () => {
    const a = life(7); a.stats.smarts = 80;
    expect(a.flags.ftMapFound).toBeFalsy();
    a.flags.ftMapFound = true;
    doActivity(a, "ft_wonder"); only(a, "ft.lg.wonder"); pickRun(a, /นครที่สาบสูญ/);
    expect(D(a).wonders?.lostcity).toBeTruthy();
    runEvent(a, "ft.lg.wonder");
    const c = currentScene(a.queue[0], a)!.choices[0];
    expect(c.req?.(a, a.queue[0].ctx)).toMatch(/ค้นพบไปแล้ว/);
    expect(Object.keys(WONDERS)).toHaveLength(4);
  });
  it("ภัยของโลกต้านได้ทีละขั้นจนจบ", () => {
    const l = life(8); D(l).crisis = { kind: "demon", stage: CRISIS_WIN - 1, since: 0 };
    expect(getEvent("ft.lg.crisis")!.when!(l)).toBe(true);
    runEvent(l, "ft.lg.crisis"); pickRun(l, /ทุ่มทุกอย่าง/, true);
    expect(D(l).crisis!.done).toBe("won");
    expect(legendLines(l).some((t) => /ปิดลงในที่สุด/.test(t))).toBe(true);
  });
  it("ความจริงของโลกที่ค้นพบอยู่กับโลก ไม่หายไปกับชีวิต", () => {
    const l = life(9); l.stats.smarts = 90;
    runEvent(l, "ft.lg.library"); pickRun(l, /ถอดความ/, true);
    expect(D(l).lore).toHaveLength(1);
    expect(LORE.length).toBeGreaterThan(4);
  });
  it("คำอธิษฐานใหญ่ได้ครั้งเดียวและมีราคา", () => {
    const l = life(10);
    doActivity(l, "ft_prayer"); only(l, "ft.lg.prayer"); pickRun(l, /ความมั่งคั่ง/);
    expect(l.flags.ftGodPrice).toBe("curse");
    l.doneThisYear = [];
    expect(doActivity(l, "ft_prayer")).toBeUndefined();
  });
});

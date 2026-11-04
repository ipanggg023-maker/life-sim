import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { LADDER, arenaRank, ladderOf, nextFoe } from "../content/fantasy/arena";
import { aliveDragons } from "../content/fantasy/dragons";
import { breakOdds } from "../content/fantasy/power";
import { fl } from "../content/fantasy/state";
import { doActivity } from "./activities";
import { getEvent, labelOf, visibleChoices } from "./events";
import { choiceFactors, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed = 3): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = 25; l.queue = []; l.money = 50_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const find = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const scene = q.scene && ev.scenes ? ev.scenes[q.scene] : ev;
  return visibleChoices(l, q).find((x) => re.test(labelOf(scene.choices![x.index], l, q.ctx)));
};

describe("การฝึก", () => {
  it("ฝึกหนักได้แต้มมากกว่า ฝึกกับครูเสียเงินแต่ทะลวงง่ายขึ้น", () => {
    let steady = 0, hard = 0;
    for (let s = 0; s < 30; s++) {
      const a = life(10 + s); const b0 = fl(a).body; doActivity(a, "ft_train"); steady += fl(a).body - b0;
      const b = life(10 + s); b.flags.ftTrainFocus = "hard"; const b1 = fl(b).body; doActivity(b, "ft_train"); hard += fl(b).body - b1;
    }
    expect(hard).toBeGreaterThan(steady * 1.2);
    const m = life(5); fl(m).bodyRank = 3; m.stats.health = 50; const before = breakOdds(m, "body");
    m.flags.ftTrainFocus = "master";
    expect(breakOdds(m, "body")).toBeGreaterThan(before);
    const g0 = m.money; doActivity(m, "ft_train");
    expect(m.money).toBe(g0 - 300);
  });
});

describe("สังเวียนแห่งแผ่นดิน", () => {
  it("สิบยอดฝีมือเรียงตามพลัง · คนยังไม่มีอันดับเจอคนที่สิบก่อน", () => {
    const l = life(7);
    const lad = ladderOf(l);
    expect(lad.length).toBeLessThanOrEqual(LADDER);
    for (let i = 1; i < lad.length; i++) expect(lad[i - 1].power).toBeGreaterThanOrEqual(lad[i].power);
    expect(nextFoe(l)?.id).toBe(lad[lad.length - 1].id);
  });
  it("ชนะแล้วขึ้นอันดับ แพ้แค่เจ็บไม่ตาย", () => {
    let won = 0, alive = 0;
    for (let s = 0; s < 30; s++) {
      const l = life(40 + s); fl(l).bodyRank = 3; fl(l).body = 300;
      doActivity(l, "ft_arena");
      resolveChoice(l, find(l, /สู้เต็มกำลัง/)!.index);
      if (arenaRank(l)) won++;
      if (l.alive) alive++;
    }
    expect(won).toBeGreaterThan(10);
    expect(alive).toBe(30);
  });
  it("บาดเจ็บหนักขึ้นสังเวียนไม่ได้", () => {
    const l = life(8); l.stats.health = 40;
    expect(doActivity(l, "ft_arena")).toBeUndefined();
  });
});

describe("มังกร", () => {
  it("โอกาสรอดต่ำต้องผ่านคำเตือนก่อน และถอยออกมาได้", () => {
    const l = life(9); fl(l).bodyRank = 0; fl(l).body = 0;
    const d = aliveDragons(l)[0];
    runEvent(l, "ft.dragon_meet", { dg: d.id });
    const fight = find(l, /ท้าสู้เพื่อสังหารมังกร/)!;
    resolveChoice(l, fight.index);
    expect(l.alive).toBe(true);
    expect(l.queue[0]?.scene).toBe("sure_slay");
    resolveChoice(l, find(l, /ถอยออกมาก่อน/)!.index);
    expect(l.alive).toBe(true);
    expect(l.queue.length).toBe(0);
  });
});

describe("ทำไมโอกาสเป็นแบบนี้", () => {
  it("หน้าต่างโอกาสแยกอาวุธออกมาให้เห็น", () => {
    const l = life(11); fl(l).bodyRank = 2; fl(l).weapon = { name: "ดาบ", quality: 5, enchant: true };
    const n = nextFoe(l)!;
    runEvent(l, "ft.ar.bout", { foe: n.id });
    const i = find(l, /สู้เต็มกำลัง/)!.index;
    const rows = choiceFactors(l, l.queue[0], i)!;
    expect(rows.some((r) => r.label === "อาวุธและเกราะ" && r.delta > 0)).toBe(true);
  });
});

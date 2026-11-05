import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { BIZ_OPEN, CONTACT_EDGE, FIRED_PENALTY, GUILDS, REFERENCE_EDGE, WORK_LEGEND, careerLines, famOf } from "../content/fantasy/careers2";
import { fl } from "../content/fantasy/state";
import { careerById } from "../content/core/careers";
import { doActivity } from "./activities";
import { currentScene, getEvent, labelOf } from "./events";
import { ageUp, applyJob, createLife, jobChance, quitJob, runEvent, salaryOf, startJob } from "./game";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0]; const s = currentScene(q, l)!; return s.choices.filter((c) => !c.show || c.show(l, q.ctx)).map((c) => labelOf(c, l, q.ctx)); };
const pickRun = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0], s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no choice ${re} in ${q.eventId}: ${labels(l).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
const only = (l: Life, id: string) => { l.queue = l.queue.filter((q) => q.eventId === id); };
const year = (l: Life) => { l.queue = []; l.doneThisYear = []; ageUp(l); };

describe("อาชีพใหม่และบททดสอบ", () => {
  it("มีอาชีพสายศาล ศรัทธา ศิลปะ และการเดินทางเพิ่ม", () => {
    for (const id of ["ft_scribe", "ft_taxman", "ft_inquisitor", "ft_healer", "ft_painter", "ft_playwright", "ft_jester", "ft_caravan"]) {
      expect(careerById(id)?.world, id).toBe("fantasy");
      expect(famOf(id), id).toBeTruthy();
    }
  });
  it("สมัครงานแล้วมีบททดสอบตามสายงาน ผ่านแล้วได้งาน", () => {
    const l = life(1);
    applyJob(l, "ft_smith");
    expect(l.queue[0].eventId).toBe("ft.c2.trial");
    expect(currentScene(l.queue[0], l)!.text(l, l.queue[0].ctx)).toMatch(/นายช่าง/);
    pickRun(l, /แสดงฝีมือ/, true);
    expect(l.job?.careerId).toBe("ft_smith");
  });
  it("คนรู้จักในวงการช่วยให้ผ่านง่ายขึ้น", () => {
    const l = life(2);
    applyJob(l, "ft_bard");
    expect(labels(l).some((t) => /เอ่ยชื่อ/.test(t))).toBe(false);
    l.queue = [];
    const p = createPerson(l, "friend", { age: 30, bond: 70 }); p.job = "กวีพเนจร";
    l.doneThisYear = []; applyJob(l, "ft_bard");
    expect(labels(l).some((t) => /เอ่ยชื่อ/.test(t))).toBe(true);
    expect(CONTACT_EDGE).toBeGreaterThan(0);
  });
});

describe("รอยที่ทิ้งไว้ตอนจากงาน", () => {
  it("ลาออกดีๆ หลังทำงานนานได้คำรับรอง ถูกไล่ออกแล้วสมัครสายเดิมยากขึ้น", () => {
    const a = life(3); a.stats.smarts = 70; startJob(a, "ft_smith"); a.job!.years = 4; a.job!.performance = 70;
    const k = careerById("ft_enchanter")!;
    quitJob(a);
    const twin = life(3); twin.stats.smarts = 70; const before = jobChance(twin, k);
    expect(fl(a).leftMark?.craft?.how).toBe("reference");
    expect(jobChance(a, k)).toBeGreaterThan(before + REFERENCE_EDGE * 0.8);
    const b = life(4); startJob(b, "ft_smith"); b.job!.performance = 5;
    const p0 = jobChance(b, k);
    for (let i = 0; i < 20 && b.job; i++) { b.job.performance = 5; year(b); }
    expect(b.job).toBeUndefined();
    expect(fl(b).leftMark?.craft?.how).toBe("fired");
    expect(jobChance(b, k)).toBeLessThan(p0);
    expect(FIRED_PENALTY).toBeGreaterThan(0);
    expect(careerLines(b).some((t) => /ถูกไล่ออก/.test(t))).toBe(true);
  });
  it("ขอขึ้นเงินเดือนสำเร็จแล้วค่าจ้างสูงขึ้นจริง", () => {
    const l = life(5); startJob(l, "ft_scribe"); l.job!.years = 2;
    const c = careerById("ft_scribe")!, s0 = salaryOf(l, c, 1);
    doActivity(l, "ft_raise"); only(l, "ft.c2.raise"); pickRun(l, /ขอขึ้นเงินเดือน/, true);
    expect(salaryOf(l, c, 1)).toBeGreaterThan(s0);
  });
});

describe("กิจการ สมาคม และผลงาน", () => {
  it("เปิดร้านแล้วมีรายได้ ขยายได้ทีละขั้น และขั้นสูงสุดขยายต่อไม่ได้", () => {
    const l = life(6); l.money = 1_000_000;
    doActivity(l, "ft_biz_open"); only(l, "ft.c2.biz_open"); pickRun(l, /โรงตีเหล็ก/);
    expect(fl(l).biz?.level).toBe(1);
    expect(fl(l).biz?.name).toContain(l.lastName);
    expect(BIZ_OPEN).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) { runEvent(l, "ft.c2.biz_grow"); only(l, "ft.c2.biz_grow"); pickRun(l, /ลงทุนขยาย/, true); }
    expect(fl(l).biz?.level).toBe(5);
    runEvent(l, "ft.c2.biz_grow"); only(l, "ft.c2.biz_grow");
    const grow = currentScene(l.queue[0], l)!.choices[0];
    expect(grow.req?.(l, l.queue[0].ctx)).toMatch(/ใหญ่ที่สุด/);
    const m0 = l.money; year(l);
    expect(l.money).not.toBe(m0);
  });
  it("สมาคมเก็บค่าบำรุง ค้างสองปีถูกขับออก", () => {
    const l = life(7); startJob(l, "ft_painter");
    doActivity(l, "ft_tguild");
    expect(fl(l).tguild?.fam).toBe("arts");
    expect(GUILDS.arts).toBeTruthy();
    l.money = -1_000_000; year(l); l.money = -1_000_000; year(l);
    expect(fl(l).tguild).toBeUndefined();
  });
  it("สมาคมหางานใหม่ให้ได้ครั้งหนึ่งเมื่อถูกไล่ออก", () => {
    const l = life(8); startJob(l, "ft_merchant"); l.job!.level = 3;
    doActivity(l, "ft_tguild");
    for (let i = 0; i < 20 && (!fl(l).tguild?.saved); i++) { if (l.job) l.job.performance = 5; year(l); }
    expect(fl(l).tguild?.saved).toBe(true);
    expect(l.job?.careerId).toBe("ft_merchant");
  });
  it("ทำงานนานแล้วมีผลงานที่มีชื่อ และงานดังกลายเป็นตำนาน", () => {
    const l = life(9); startJob(l, "ft_bard"); l.job!.level = 3;
    const keep = () => { if (!l.job) { startJob(l, "ft_bard"); l.job!.level = 3; } l.job!.performance = 60; };
    for (let i = 0; i < 40 && !(fl(l).works ?? []).length; i++) { keep(); year(l); }
    const w = fl(l).works![0];
    expect(w.name.length).toBeGreaterThan(2);
    w.fame = WORK_LEGEND - 1;
    for (let i = 0; i < 30 && w.fame < WORK_LEGEND; i++) { keep(); year(l); }
    expect(fl(l).deeds.some((d) => d.includes(w.name))).toBe(true);
  });
});

describe("ลูกมือ จุดเปลี่ยน และผู้อุปถัมภ์", () => {
  it("ขั้นสามรับลูกมือได้ และลูกมือที่เก่งกว่ามีเรื่องให้ตัดสินใจ", () => {
    const l = life(10, 35); startJob(l, "ft_smith"); l.job!.level = 3;
    doActivity(l, "ft_apprentice");
    const a = l.people.find((p) => p.tags?.includes("apprentice"))!;
    expect(a).toBeTruthy();
    l.age += 5;
    expect(getEvent("ft.c2.apprentice")!.when!(l)).toBe(true);
    runEvent(l, "ft.c2.apprentice"); pickRun(l, /เก็บความลับ/);
    expect(a.relation).toBe("rival");
  });
  it("เปลี่ยนสายกลางชีวิต งานใหม่ที่ใช้ฝีมือแบบเดิมเริ่มขั้นสอง", () => {
    const l = life(11, 40); startJob(l, "ft_scholar"); l.job!.years = 8;
    expect(getEvent("ft.c2.turn")!.when!(l)).toBe(true);
    runEvent(l, "ft.c2.turn"); pickRun(l, /ลาออกไปเริ่มทางใหม่/);
    expect(l.job).toBeUndefined();
    startJob(l, "ft_scribe");
    expect(l.job!.level).toBe(2);
  });
  it("ผู้อุปถัมภ์ให้เงินทุกปี", () => {
    const l = life(12); l.fame = 20;
    doActivity(l, "ft_patron"); only(l, "ft.c2.patron"); pickRun(l, /ขุนนาง/, true);
    expect(fl(l).patron?.kind).toBe("noble");
    expect(careerLines(l).some((t) => /ผู้อุปถัมภ์/.test(t))).toBe(true);
  });
});

describe("เรื่องประจำสายงาน", () => {
  it("ขึ้นขั้นสองแล้วมีฉากแรกของสาย ขั้นสามมีวิกฤต และไม่ซ้ำในงานเดิม", () => {
    const l = life(13); startJob(l, "ft_healer"); l.job!.level = 2;
    const first = getEvent("ft.c2.first_faith")!;
    expect(first.when!(l)).toBe(true);
    runEvent(l, "ft.c2.first_faith"); pickRun(l, /พูดจากใจ/);
    expect(first.when!(l)).toBe(false);
    l.job!.level = 3;
    expect(getEvent("ft.c2.crisis_faith")!.when!(l)).toBe(true);
  });
});

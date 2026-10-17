import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { CAREERS } from "../content/hunter/careers";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { canChallenge, startChallenge } from "../content/ordinary/system";
import { allocate, sysDaily, trainSys } from "../content/ordinary/sys";
import { SYS_STATS } from "../content/gameStats";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { igPost, invest, ytUpload } from "../content/phone";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, jobRequirementMissing, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

function drain(life: Life, r: { rng: number }) {
  while (life.queue.length) {
    const o = visibleChoices(life, life.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
    resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("M15 โลกธรรมดา: ระบบชีวิต STR–LUK + มือถือ", () => {
  it("ได้ระบบอย่างเดียว ฝึกค่าสถานะ แล้วไปทำอาชีพเฉพาะทางได้", () => {
    const jobs: Record<string, number> = {};
    let withSystem = 0, powered = 0, maxLv = 0, skilled = 0, famous = 0;
    const N = 200;
    const special = CAREERS.filter((c) => c.sys);
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 69069, worldId: "ordinary" });
      const r = { rng: s };
      while (life.alive && life.age < 120) {
        drain(life, r);
        if (!life.alive) break;
        if (life.sys) {
          sysDaily(life);
          const focus = SYS_STATS[s % 6];
          trainSys(life, focus);
          trainSys(life, focus);
          // แจกแต้มให้ค่าหลัก ถ้าเต็มแล้วไล่ไปค่าอื่น
          for (const k of [focus, ...SYS_STATS]) while (life.sys.points > 0 && life.sys[k] < 100) allocate(life, k);
          if (!life.job || life.job.careerId === "store") {
            const ok = special.filter((c) => !jobRequirementMissing(life, c));
            if (ok.length) applyJob(life, ok[Math.floor(nextFloat(r) * ok.length)].id);
            else if (life.age >= 18 && !life.job) applyJob(life, "store");
          }
          if (!canChallenge(life)) { startChallenge(life); drain(life, r); }
        }
        if (!life.alive) break;
        ageUp(life);
      }
      expect(life.alive).toBe(false);
      if (life.sys) withSystem++;
      if (life.power) powered++;
      if (life.job) jobs[life.job.careerId] = (jobs[life.job.careerId] ?? 0) + 1;
      maxLv = Math.max(maxLv, life.sys?.level ?? 0);
      if (String(life.flags.sysSkills ?? "")) skilled++;
      if (life.fame >= 50) famous++;
    }
    console.log("SIM M15 มีระบบ", withSystem, "/", N, "| มีพลังพิเศษ", powered, "| เลเวลสูงสุด", maxLv, "| ได้สกิลระบบ", skilled, "| ดังมาก", famous, "| งานสุดท้าย", JSON.stringify(jobs));
    expect(withSystem).toBeGreaterThan(N * 0.7);
    expect(powered).toBe(0); // โลกธรรมดาไม่มีพลังพิเศษ
    expect(skilled).toBeGreaterThan(withSystem * 0.8);
  });

  it("มือถือ: IG, YouTube, หุ้น ทำงานและเซฟได้", () => {
    const l = createLife({ seed: 5, worldId: "hunter" });
    l.age = 20;
    l.money = 1_000_000;
    expect(igPost(l, "selfie")).toBeDefined();
    expect(ytUpload(l, "vlog")).toBeDefined();
    invest(l, 0.5);
    expect(l.phone!.portfolio).toBe(500_000);
    expect(l.phone!.ig).toBeGreaterThan(0);
    ageUp(l);
    expect(JSON.parse(JSON.stringify(l)).phone.ytVideos).toBe(1);
    // โลกแฟนตาซีไม่มีมือถือ
    const m = createLife({ seed: 6, worldId: "murim" });
    m.age = 20;
    expect(igPost(m, "selfie")).toBeUndefined();
  });
});

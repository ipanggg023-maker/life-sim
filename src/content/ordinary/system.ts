// โลกธรรมดา: วันที่ "ระบบชีวิต" มาหาคุณคนเดียว และภารกิจระบบตามอาชีพ
// ระบบให้แค่ "ระบบ" — ไม่มีสายพลัง ไม่มีแรงก์ · คุณต้องฝึก STR–LUK เอง แล้วไปทำอาชีพปกติ
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, SysStat } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, money } from "../../engine/util";
import { trackOf } from "../hunter/power";
import { SYS_INFO, effSys } from "../gameStats";
import { gainSysExp, initSys } from "./sys";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

export const SYSTEM_ARRIVAL: GameEvent = {
  id: "ord.system",
  minAge: 4,
  maxAge: 80,
  forced: true,
  when: (l) => !l.sys && !l.power && trackOf(l) !== "never" && l.age === Number(l.flags.awakenAge ?? 18),
  title: "ระบบชีวิต",
  system: true,
  text: (l) =>
    `ตี 3 คุณสะดุ้งตื่นเพราะเสียง "ติ๊ง" ในหัว หน้าต่างสีฟ้าลอยอยู่ตรงหน้า\n「ระบบชีวิต เริ่มทำงาน — ยินดีต้อนรับ ผู้ใช้เพียงหนึ่งเดียวบนโลกใบนี้」\n` +
    `${l.age < 12 ? "เด็กอายุเท่าคุณไม่ควรต้องรับรู้อะไรแบบนี้… แต่มันมาแล้ว" : "คุณขยี้ตาสามครั้ง หน้าต่างก็ยังไม่หายไป"}`,
  choices: [
    {
      label: "กดปุ่ม [ยืนยัน]",
      run: (l) => {
        initSys(l);
        return { text: "[ระบบ] ลงทะเบียนผู้ใช้สำเร็จ — ค่าสถานะของคุณถูกวัดเป็นตัวเลขแล้ว ที่เหลือขึ้นอยู่กับการฝึกของคุณ (แต้มเริ่มต้น 5 · ดูที่แท็บพลัง)", kind: "milestone" };
      },
    },
    {
      label: "ถามระบบว่าเป็นใคร",
      check: { stat: "smarts", dc: 55 },
      run: (l, _c, ok) => {
        initSys(l);
        if (ok) l.sys!.points += 3;
        return { text: ok ? "[ผู้ใช้ไม่จำเป็นต้องรู้ — แต่ระบบชอบคำถามนี้: แต้มสถานะ +3]" : "[คำถามนี้ไม่อยู่ในขอบเขตการตอบ] — ระบบเริ่มทำงานโดยไม่สนใจคุณ", kind: "milestone" };
      },
    },
  ],
};

// ───────────────────────── ภารกิจระบบ (ตามอาชีพ) ─────────────────────────

type Stage = { main: SysStat; tag: string; names: string[]; foe: string[]; go: string; safe: string; win: string; lose: string; danger: boolean; fame: boolean };
const STAGES: Record<string, Stage> = {
  fighter: {
    main: "str", tag: "combat", danger: true, fame: true,
    names: ["สังเวียนใต้ดิน", "แมตช์ MMA ระดับประเทศ", "ศึกชิงแชมป์เอเชีย", "ศึกชิงแชมป์โลก"],
    foe: ["แชมป์ใต้ดินร่างยักษ์", "นักสู้ต่างชาติไร้พ่าย", "แชมป์เก่าที่กลับมาแก้แค้น"],
    go: "บุกเข้าแลกหมัด", safe: "เล่นเกมรับ เก็บแต้ม",
    win: "คู่ต่อสู้ล้มลงไม่ลุก ทั้งสนามลุกขึ้นยืน", lose: "หมัดสุดท้ายของคู่ต่อสู้ทำให้โลกมืดไปครู่หนึ่ง",
  },
  idol: {
    main: "cha", tag: "perform", danger: false, fame: true,
    names: ["ออดิชันรายการเซอร์ไววัล", "คอนเสิร์ตใหญ่ครั้งแรก", "บทนำในซีรีส์ฟอร์มยักษ์", "เวทีประกาศรางวัลระดับโลก"],
    foe: ["เด็กฝึกที่ค่ายดันสุดตัว", "นักแสดงรุ่นพี่ที่เกลียดคุณ", "ซูเปอร์สตาร์ที่ครองเวทีมาสิบปี"],
    go: "ปล่อยของเต็มที่", safe: "เล่นตามบทที่ซ้อมมา",
    win: "ทั้งฮอลล์เงียบไปสามวินาที แล้วเสียงกรี๊ดก็ระเบิดขึ้น", lose: "เสียงหลุดในท่อนสำคัญ คลิปนั้นถูกแชร์ไปทั่วโซเชียล",
  },
  doctor: {
    main: "int", tag: "medical", danger: false, fame: false,
    names: ["เคสฉุกเฉินตอนตีสาม", "ผ่าตัดหัวใจเด็กแปดขวบ", "เคสที่ทุกโรงพยาบาลปฏิเสธ", "ผ่าตัดผู้นำต่างประเทศ"],
    foe: ["หัวหน้าแผนกที่รอให้คุณพลาด", "โรคหายากที่ไม่มีในตำรา", "เวลาที่เหลือไม่ถึงชั่วโมง"],
    go: "ผ่าตัดตามที่ระบบชี้", safe: "ทำตามขั้นตอนมาตรฐาน",
    win: "ชีพจรคนไข้กลับมาเต้น ทั้งห้องผ่าตัดถอนหายใจพร้อมกัน", lose: "คนไข้ไม่ฟื้น — คุณนั่งอยู่ในห้องเปลี่ยนชุดคนเดียวจนเช้า",
  },
  gamer: {
    main: "agi", tag: "game", danger: false, fame: true,
    names: ["แรงก์เกมในเซิร์ฟเวอร์ใหม่", "ลีกอาชีพประจำฤดูกาล", "ศึกชิงแชมป์ประเทศ", "รอบชิงแชมป์โลกในโลกเสมือน"],
    foe: ["ทีมที่ใช้โปรแกรมโกง", "ผู้เล่นอันดับหนึ่งของเซิร์ฟเวอร์", "ทีมแชมป์โลกสามสมัย"],
    go: "เปิดเกมบุกตั้งแต่นาทีแรก", safe: "เล่นตามแผนทีม",
    win: "แคสเตอร์ตะโกนชื่อคุณจนเสียงแตก", lose: "คุณพลาดจังหวะเดียว และเกมก็จบลง",
  },
  chef: {
    main: "int", tag: "cook", danger: false, fame: true,
    names: ["รายการแข่งทำอาหารทางทีวี", "นักวิจารณ์ชื่อดังมาที่ร้าน", "เปิดร้านสาขาต่างประเทศ", "การประเมินดาวมิชลิน"],
    foe: ["เชฟดาวรุ่งที่เลียนแบบสูตรคุณ", "นักวิจารณ์ปากร้ายที่สุดในประเทศ", "เชฟสามดาวจากปารีส"],
    go: "ทำเมนูที่ไม่เคยมีใครทำ", safe: "ทำเมนูซิกเนเจอร์ที่ชัวร์",
    win: "กรรมการวางช้อนลงแล้วนิ่งไปนาน ก่อนจะยิ้ม", lose: "เกลือมากไปนิดเดียว — นิดเดียวที่ทำให้ทุกอย่างพัง",
  },
  athlete: {
    main: "sta", tag: "combat", danger: false, fame: true,
    names: ["คัดตัวทีมชาติ", "ซีเกมส์", "เอเชียนเกมส์", "โอลิมปิก"],
    foe: ["นักกีฬาเจ้าถิ่นที่ไม่เคยแพ้", "แชมป์เก่าที่กลับมาฟิต", "เจ้าของสถิติโลก"],
    go: "เร่งตั้งแต่ต้น", safe: "รักษาจังหวะ เก็บแรงไว้ช่วงท้าย",
    win: "คุณเข้าเส้นชัยก่อน ธงชาติขึ้นสู่ยอดเสา", lose: "ขาของคุณหมดแรงในร้อยเมตรสุดท้าย",
  },
  business: {
    main: "int", tag: "business", danger: false, fame: false,
    names: ["ดีลกับลูกค้ารายใหญ่", "เสนอโปรเจกต์ต่อบอร์ด", "เทคโอเวอร์บริษัทคู่แข่ง", "ดีลข้ามชาติมูลค่าแสนล้าน"],
    foe: ["ผู้จัดการที่อยากเอาผลงานคุณไป", "กองทุนต่างชาติ", "ประธานคนปัจจุบันของเครือ"],
    go: "ใช้ข้อมูลที่ระบบวิเคราะห์ให้", safe: "เสนอตามแผนเดิม",
    win: "ดีลปิดได้สวยงาม — ทุกคนในห้องประชุมหันมามองคุณ", lose: "ดีลพังกลางห้องประชุม",
  },
  general: {
    main: "sta", tag: "study", danger: false, fame: false,
    names: ["งานด่วนก่อนเส้นตาย", "โปรเจกต์สำคัญของที่ทำงาน", "งานที่ไม่มีใครกล้ารับ", "งานที่จะเปลี่ยนชีวิต"],
    foe: ["เพื่อนร่วมงานที่ขี้อิจฉา", "หัวหน้าจอมจู้จี้", "เวลาที่ไม่พอ"],
    go: "ทุ่มสุดตัวตามแผนที่ระบบจัดให้", safe: "ทำตามขั้นตอน",
    win: "งานเสร็จสมบูรณ์จนหัวหน้าเรียกไปชมต่อหน้าทุกคน", lose: "งานพังตอนนาทีสุดท้าย",
  },
};
const JOB_STAGE: Record<string, string> = {
  o_mma: "fighter", o_bodyguard: "fighter", o_trainee: "idol", o_model: "idol", doctor: "doctor", o_progamer: "gamer", streamer: "gamer",
  o_chef_job: "chef", o_athlete: "athlete", o_heir: "business", finance: "business", office: "business", o_dev: "business",
};
export const stageOf = (l: Life): Stage => STAGES[JOB_STAGE[l.job?.careerId ?? ""] ?? "general"];
export const CHALLENGES_PER_YEAR = 2;
export const challengesLeft = (l: Life) => CHALLENGES_PER_YEAR - l.doneThisYear.filter((x) => x === "syschal").length;
/** ระดับความยากที่เปิดให้ = ตามเลเวลระบบ */
export const challengeLevel = (l: Life) => clamp(Math.floor((l.sys?.level ?? 1) / 3), 0, 3);

function odds(l: Life, c: Ctx, mod = 0) {
  return clamp(0.5 + (effSys(l, stageOf(l).main) - (25 + Number(c.r) * 12)) / 35 + mod + Number(l.flags.skillBoost ?? 0), 0.05, 0.95);
}

export function canChallenge(l: Life): string | undefined {
  if (!l.sys) return "ยังไม่มีระบบ";
  if (!l.job) return "ต้องมีงานทำก่อน — ภารกิจระบบมาตามอาชีพ";
  if (l.queue.length) return "กำลังมีเหตุการณ์อยู่";
  if (challengesLeft(l) <= 0) return "ปีนี้ทำภารกิจระบบครบแล้ว";
  return;
}

/** เริ่มภารกิจระบบ (เซฟเก่าที่ยังมีพลังสายเดิม จะได้ระบบชีวิตแทนอัตโนมัติ) */
export function startChallenge(l: Life, _r?: number) {
  if (!l.sys) initSys(l);
  if (canChallenge(l)) return;
  l.doneThisYear.push("syschal");
  runEvent(l, "ord.challenge", { r: challengeLevel(l), foe: pick(l, stageOf(l).foe), score: 0 });
}

const winRate = (l: Life) => clamp(0.82 + (effSys(l, "sta") - 30) / 150, 0.5, 0.99);

export const CHALLENGE: GameEvent = {
  id: "ord.challenge",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ภารกิจระบบ",
  system: true,
  text: (l, c) => `[ภารกิจระบบ ระดับ ${Number(c.r) + 1}/4]【${stageOf(l).names[Number(c.r)]}】\nคู่แข่ง: ${c.foe} · ค่าที่ใช้: ${SYS_INFO[stageOf(l).main].label}`,
  choices: [
    {
      label: (l) => stageOf(l).safe,
      odds: (l, c) => odds(l, c, 0.1),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("แผนที่ซ้อมมาเดินไปได้ดี", "final"); }
        addStat(l, "health", -randInt(l, 1, 4));
        return bad("แผนพังตั้งแต่ครึ่งแรก", "final");
      },
    },
    {
      label: "ขอให้ระบบช่วยวิเคราะห์ก่อน",
      odds: (l) => clamp(0.4 + (effSys(l, "int") - 25) / 80, 0.1, 0.9),
      run: (_l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 2; return { text: "[ระบบ] วิเคราะห์จุดอ่อนของคู่แข่งเสร็จสิ้น — โอกาสชนะเพิ่มขึ้น", kind: "system", next: "final" }; }
        return meh("[ระบบ] ข้อมูลไม่เพียงพอ", "final");
      },
    },
  ],
  scenes: {
    final: {
      title: "ช่วงตัดสิน",
      text: (l, c) => `ทุกอย่างมาถึงจุดตัดสิน — ${c.foe}ไม่ยอมถอยแม้แต่ก้าวเดียว${stageOf(l).danger ? " และหมัดของเขาหนักพอจะฆ่าคนได้" : ""}`,
      choices: [
        {
          label: (l) => stageOf(l).go,
          tone: "danger",
          skill: (l) => [stageOf(l).tag],
          odds: (l, c) => odds(l, c, Number(c.score) * 0.07),
          survival: (l) => (stageOf(l).danger ? winRate(l) : 1),
          run: (l, c, ok) => {
            const s = stageOf(l);
            const r = Number(c.r);
            if (ok) {
              const pay = Math.round(((r + 1) ** 2 * 60_000 * (0.7 + randInt(l, 0, 60) / 100)) / 1000) * 1000;
              addMoney(l, pay);
              gainSysExp(l, 80 * (r + 1));
              if (s.fame && r >= 2) addFame(l, 1);
              if (l.job) l.job.performance = clamp(l.job.performance + 10, 0, 100);
              addStat(l, "happiness", 4);
              return { text: `🏆 ${s.win} ได้ ${money(l, pay)} และ EXP ระบบ ${80 * (r + 1)}`, kind: "good" };
            }
            if (s.danger && !chance(l, winRate(l))) {
              kill(l, `ล้มลงบนสังเวียนระหว่าง${s.names[r]}`);
              return bad("ระฆังไม่ดังอีกเลยสำหรับคุณ…");
            }
            gainSysExp(l, 30);
            addStat(l, "health", -randInt(l, 3, 10));
            return bad(s.lose);
          },
        },
        { label: "ยอมถอย รักษาชื่อเสียงไว้ก่อน", run: (l) => { gainSysExp(l, 15); return meh("คุณถอยอย่างมีชั้นเชิง — ปีหน้าค่อยว่ากันใหม่"); } },
      ],
    },
  },
};

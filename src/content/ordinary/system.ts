// โลกธรรมดา: วันที่ "ระบบชีวิต" มาหาคุณคนเดียว และภารกิจระบบตามเส้นทาง
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, openHiddenSlot, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { HunterClass, Life } from "../../engine/types";
import { addFame, addStat, clamp } from "../../engine/util";
import { CLASSES, awaken, classById, fightOdds, gateRewards, offerClasses, rankName, rollAwakening, survivalOdds, trackOf } from "../hunter/power";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

const PATHS = CLASSES.filter((c) => c.world === "ordinary");
const offered = (c: Ctx, id: HunterClass) => String(c.offer ?? "").split(",").includes(id);

function rollInto(l: Life, c: Ctx, bonus: number) {
  l.flags.forceAwaken = true;
  c.rank = Math.max(0, rollAwakening(l, bonus));
  delete l.flags.forceAwaken;
  const offer: HunterClass[] = offerClasses(l).filter((x) => x !== "o_chaebol");
  // แชโบลย้อนเวลา: เปิดให้เฉพาะคนที่ย้อนเวลามาเท่านั้น
  if ((l.regressions ?? 0) > 0) offer.push("o_chaebol");
  c.offer = offer.join(",");
}

export const SYSTEM_ARRIVAL: GameEvent = {
  id: "ord.system",
  minAge: 4,
  maxAge: 80,
  forced: true,
  when: (l) => !l.power && !l.flags.awakenDone && trackOf(l) !== "never" && l.age === Number(l.flags.awakenAge ?? 18),
  title: "ระบบชีวิต",
  system: true,
  text: (l) =>
    `ตี 3 คุณสะดุ้งตื่นเพราะเสียง "ติ๊ง" ในหัว หน้าต่างสีฟ้าลอยอยู่ตรงหน้า\n「ระบบชีวิต เริ่มทำงาน — ยินดีต้อนรับ ผู้ใช้เพียงหนึ่งเดียวบนโลกใบนี้」\n` +
    `${l.age < 12 ? "เด็กอายุเท่าคุณไม่ควรต้องรับรู้อะไรแบบนี้… แต่มันมาแล้ว" : "คุณขยี้ตาสามครั้ง หน้าต่างก็ยังไม่หายไป"}`,
  choices: [
    {
      label: "ลองกดปุ่ม [ยืนยัน]",
      check: { stat: "luck", dc: 50 },
      run: (l, c, ok) => {
        rollInto(l, c, ok ? 1 : 0);
        return meh(ok ? "แสงสีฟ้าซึมเข้าตา ความรู้สึกเหมือนร่างกายถูกอัปเดตเวอร์ชัน" : "หัวคุณปวดจนแทบระเบิด แล้วทุกอย่างก็เงียบลง", "path");
      },
    },
    {
      label: "ถามระบบว่าเป็นใคร",
      check: { stat: "smarts", dc: 55 },
      run: (l, c, ok) => {
        rollInto(l, c, ok ? 1 : 0);
        return meh(ok ? "[ผู้ใช้ไม่จำเป็นต้องรู้ — แต่ระบบชอบคำถามนี้ โบนัสการประเมิน +1]" : "[คำถามนี้ไม่อยู่ในขอบเขตการตอบ]", "path");
      },
    },
  ],
  scenes: {
    path: {
      title: "เลือกเส้นทาง",
      system: true,
      text: (_l, c) => `[ระบบ] ประเมินศักยภาพผู้ใช้:【${rankName(Number(c.rank))}】\nไม่มีใครบนโลกนี้มองเห็นหน้าต่างนี้นอกจากคุณ — กรุณาเลือกเส้นทางชีวิต`,
      choices: PATHS.map((cls) => ({
        label: `${cls.emoji} ${cls.name} — ${cls.desc}`,
        tone: cls.id === "o_chaebol" ? ("special" as const) : undefined,
        show: (_l: Life, c: Ctx) => offered(c, cls.id),
        run: (l: Life, c: Ctx): Outcome => {
          const rank = Number(c.rank);
          awaken(l, rank, cls.id);
          openHiddenSlot(l, "ระบบชีวิตเริ่มทำงาน");
          return { text: `🪟 ระบบตั้งเส้นทางของคุณเป็น「${classById(cls.id).name}」ระดับ ${rankName(rank)} — ชีวิตธรรมดาของคุณจบลงตรงนี้`, kind: "milestone" };
        },
      })),
    },
  },
};

// ───────────────────────── ภารกิจระบบ (ตามเส้นทาง) ─────────────────────────

type PathId = "o_fighter" | "o_idol" | "o_doctor" | "o_gamer" | "o_chef" | "o_chaebol";
const STAGE: Record<PathId, { names: string[]; foe: string[]; go: string; safe: string; win: string; lose: string; danger: boolean }> = {
  o_fighter: {
    names: ["ศึกนักเลงข้ามโรงเรียน", "สังเวียนใต้ดิน", "แมตช์ MMA ระดับประเทศ", "ศึกชิงแชมป์เอเชีย"],
    foe: ["หัวหน้าแก๊งรอบเมือง", "แชมป์ใต้ดินร่างยักษ์", "นักสู้ต่างชาติไร้พ่าย"],
    go: "บุกเข้าแลกหมัด",
    safe: "เล่นเกมรับ เก็บแต้ม",
    win: "คู่ต่อสู้ล้มลงไม่ลุก ทั้งสนามลุกขึ้นยืน",
    lose: "หมัดสุดท้ายของคู่ต่อสู้ทำให้โลกมืดไปครู่หนึ่ง",
    danger: true,
  },
  o_idol: {
    names: ["ออดิชันรายการเซอร์ไววัล", "คอนเสิร์ตใหญ่ครั้งแรก", "บทนำในซีรีส์ฟอร์มยักษ์", "เวทีประกาศรางวัลระดับโลก"],
    foe: ["เด็กฝึกที่ค่ายดันสุดตัว", "นักแสดงรุ่นพี่ที่เกลียดคุณ", "ซูเปอร์สตาร์ที่ครองเวทีมาสิบปี"],
    go: "ปล่อยของเต็มที่",
    safe: "เล่นตามบทที่ซ้อมมา",
    win: "ทั้งฮอลล์เงียบไปสามวินาที แล้วเสียงกรี๊ดก็ระเบิดขึ้น",
    lose: "เสียงหลุดในท่อนสำคัญ คลิปนั้นถูกแชร์ไปทั่วโซเชียล",
    danger: false,
  },
  o_doctor: {
    names: ["เคสฉุกเฉินตอนตีสาม", "ผ่าตัดหัวใจเด็กแปดขวบ", "เคสที่ทุกโรงพยาบาลปฏิเสธ", "ผ่าตัดประธานาธิบดีต่างประเทศ"],
    foe: ["หัวหน้าแผนกที่รอให้คุณพลาด", "โรคหายากที่ไม่มีในตำรา", "เวลาที่เหลือไม่ถึงชั่วโมง"],
    go: "ผ่าตัดตามที่ระบบชี้",
    safe: "ทำตามขั้นตอนมาตรฐาน",
    win: "ชีพจรคนไข้กลับมาเต้น ทั้งห้องผ่าตัดถอนหายใจพร้อมกัน",
    lose: "คนไข้ไม่ฟื้น — คุณนั่งอยู่ในห้องเปลี่ยนชุดคนเดียวจนเช้า",
    danger: false,
  },
  o_gamer: {
    names: ["แรงก์เกมในเซิร์ฟเวอร์ใหม่", "ลีกอาชีพประจำฤดูกาล", "ศึกชิงแชมป์ประเทศ", "รอบชิงแชมป์โลกในโลกเสมือน"],
    foe: ["ทีมที่ใช้โปรแกรมโกง", "ผู้เล่นอันดับหนึ่งของเซิร์ฟเวอร์", "ทีมแชมป์โลกสามสมัย"],
    go: "เปิดเกมบุกตั้งแต่นาทีแรก",
    safe: "เล่นตามแผนทีม",
    win: "แคสเตอร์ตะโกนชื่อคุณจนเสียงแตก",
    lose: "คุณพลาดจังหวะเดียว และเกมก็จบลง",
    danger: false,
  },
  o_chef: {
    names: ["รายการแข่งทำอาหารทางทีวี", "นักวิจารณ์ชื่อดังมาที่ร้าน", "เปิดร้านสาขาต่างประเทศ", "การประเมินดาวมิชลิน"],
    foe: ["เชฟดาวรุ่งที่เลียนแบบสูตรคุณ", "นักวิจารณ์ปากร้ายที่สุดในประเทศ", "เชฟสามดาวจากปารีส"],
    go: "ทำเมนูที่ไม่เคยมีใครทำ",
    safe: "ทำเมนูซิกเนเจอร์ที่ชัวร์",
    win: "กรรมการวางช้อนลงแล้วนิ่งไปนาน ก่อนจะยิ้ม",
    lose: "เกลือมากไปนิดเดียว — นิดเดียวที่ทำให้ทุกอย่างพัง",
    danger: false,
  },
  o_chaebol: {
    names: ["ซื้อหุ้นก่อนข่าวใหญ่", "เทคโอเวอร์บริษัทคู่แข่ง", "ศึกชิงตำแหน่งในตระกูล", "ดีลข้ามชาติมูลค่าแสนล้าน"],
    foe: ["ลุงที่วางแผนฆ่าคุณในชาติก่อน", "กองทุนต่างชาติ", "ประธานคนปัจจุบันของเครือ"],
    go: "ใช้ความรู้จากอนาคตเต็มที่",
    safe: "ค่อยๆ เก็บหุ้นเงียบๆ",
    win: "กระดานหุ้นเป็นสีเขียวทั้งแถบ — ทุกคนในห้องประชุมหันมามองคุณ",
    lose: "อนาคตเปลี่ยนไปจากที่คุณจำได้ ดีลนั้นพังกลางห้องประชุม",
    danger: false,
  },
};

const R = (c: Ctx) => Number(c.rank);
const pathOf = (l: Life) => (l.power?.hunterClass ?? "o_fighter") as PathId;
const stageOf = (l: Life) => STAGE[pathOf(l)] ?? STAGE.o_fighter;

export function startChallenge(life: Life, r: number) {
  const s = stageOf(life);
  runEvent(life, "ord.challenge", { rank: r, n: clamp(Math.floor(r / 2), 0, s.names.length - 1), foe: pick(life, s.foe), score: 0, share: 1 });
}

function strain(l: Life, r: number, min: number, max: number): string {
  const gap = Math.max(0, r - (l.power?.rank ?? 0));
  const d = Math.round(randInt(l, min, max) * (1 + gap * 0.4));
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, pathOf(l) === "o_fighter" ? "บาดเจ็บสาหัสบนสังเวียน" : "ร่างกายพังจากการทำงานหนักเกินไป");
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

export const CHALLENGE: GameEvent = {
  id: "ord.challenge",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ภารกิจระบบ",
  system: true,
  text: (l, c) => `[ภารกิจระบบ ระดับ ${rankName(R(c))}]【${stageOf(l).names[Number(c.n)]}】\nคู่แข่ง: ${c.foe}`,
  choices: [
    {
      label: (l) => stageOf(l).safe,
      odds: (l, c) => fightOdds(l, R(c), 0.1),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("แผนที่ซ้อมมาเดินไปได้ดี", "final"); }
        return bad("แผนพังตั้งแต่ครึ่งแรก" + strain(l, R(c), 2, 6), "final");
      },
    },
    {
      label: "ขอให้ระบบช่วยวิเคราะห์ก่อน",
      odds: (l) => clamp(0.45 + (l.stats.smarts - 50) / 120, 0.1, 0.9),
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
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06),
          survival: (l, c) => (stageOf(l).danger ? survivalOdds(l, R(c), Number(c.score) * 0.06) : 1),
          run: (l, c, ok) => {
            const s = stageOf(l);
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share) * 0.8, true);
              addFame(l, R(c) >= 2 ? Math.ceil(R(c) / 2) : 0);
              addStat(l, "happiness", 4);
              return { text: `🏆 ${s.win} ${r}`, kind: "good" };
            }
            if (s.danger && !chance(l, survivalOdds(l, R(c), Number(c.score) * 0.06))) {
              kill(l, `ล้มลงบนสังเวียนระหว่าง${s.names[Number(c.n)]}`);
              return bad("ระฆังไม่ดังอีกเลยสำหรับคุณ…");
            }
            addFame(l, -2);
            return bad(`${s.lose}${strain(l, R(c), 6, 16)}`);
          },
        },
        {
          label: "ยอมถอย รักษาชื่อเสียงไว้ก่อน",
          run: (l, c) => meh(`คุณถอยอย่างมีชั้นเชิง — ${gateRewards(l, R(c), Number(c.share) * 0.3, false)}`),
        },
      ],
    },
  },
};

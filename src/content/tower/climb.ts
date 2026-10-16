// หอคอย: คำเชิญ (เทียบเท่าวันตื่นพลัง) และการปีนทีละชั้น
// ชั้น 1–100 · ระดับผู้ท้าชิง (F–SSS) จำกัดว่าปีนได้สูงสุดถึงชั้นไหน
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, openHiddenSlot, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { HunterClass, Life } from "../../engine/types";
import { addFame, addStat, checkChance, clamp, log } from "../../engine/util";
import { CLASSES, awaken, classById, fightOdds, gateRewards, luckyRankUp, markTurn, offerClasses, rankName, rollAwakening, survivalOdds } from "../hunter/power";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

export const TOP_FLOOR = 100;
export const floorOf = (l: Life) => Number(l.flags.floor ?? 0);
/** ระดับบททดสอบที่ต้องผ่านเพื่อขึ้นชั้น f */
export const tierOfFloor = (f: number) => clamp(Math.floor((f - 1) / 12), 0, 8);
/** ชั้นสูงสุดที่บททดสอบระดับ r พาไปถึงได้ */
export const floorCap = (r: number) => (r >= 8 ? TOP_FLOOR : (r + 1) * 12);

// ───────────────────────── คำเชิญจากหอคอย ─────────────────────────

const TOWER_CLASSES = CLASSES.filter((c) => c.world === "tower");
const offered = (c: Ctx, id: HunterClass) => String(c.offer ?? "").split(",").includes(id);

function rollInto(l: Life, c: Ctx, bonus: number) {
  c.rank = rollAwakening(l, bonus);
  c.offer = offerClasses(l).join(",");
}

export const INVITATION: GameEvent = {
  id: "tower.invitation",
  minAge: 4,
  maxAge: 70,
  forced: true,
  when: (l) => !l.power && !l.flags.awakenDone && l.age === Number(l.flags.awakenAge ?? 19),
  title: "คำเชิญจากหอคอย",
  text: (l) =>
    `เที่ยงคืนพอดี ตัวอักษรสีทองลอยขึ้นกลางห้องนอน\n「${l.firstName} — หอคอยเชิญท่านขึ้นมา สิ่งที่ปรารถนาทั้งหมดรออยู่บนยอด」\n` +
    `${l.age < 16 ? "เด็กอายุเท่าคุณไม่ควรได้รับคำเชิญ… แต่มันมาแล้ว" : "ทั่วประเทศมีคนได้รับคำเชิญปีละไม่ถึงพันคน"}`,
  choices: [
    {
      label: "ยื่นมือไปแตะตัวอักษร",
      check: { stat: "luck", dc: 50 },
      run: (l, c, ok) => {
        rollInto(l, c, ok ? 1 : 0);
        return meh(ok ? "ตัวอักษรละลายเข้าฝ่ามือ คุณได้ยินเสียงประตูบานใหญ่เปิดออกที่ไหนสักแห่ง" : "แสงจ้าจนตาพร่า แล้วทุกอย่างก็มืดลง", c.rank === -1 ? "none" : "enter");
      },
    },
    {
      label: "ถามหอคอยว่าทำไมต้องเป็นฉัน",
      check: { stat: "smarts", dc: 55 },
      run: (l, c, ok) => {
        rollInto(l, c, ok ? 1 : 0);
        return meh(ok ? "\"เพราะท่านถาม\" — ตัวอักษรตอบกลับ แล้วคุณก็ถูกดึงเข้าไป" : "ไม่มีคำตอบ มีแต่แรงดึงที่ต้านไม่ได้", c.rank === -1 ? "none" : "enter");
      },
    },
    {
      label: "ปฏิเสธคำเชิญ",
      run: (l) => {
        l.flags.awakenDone = true;
        l.flags.refusedTower = true;
        addStat(l, "happiness", 2);
        return meh("ตัวอักษรค้างอยู่กลางอากาศครู่หนึ่ง แล้วสลายไปเงียบๆ — คุณเลือกชีวิตบนโลก");
      },
    },
  ],
  scenes: {
    none: {
      title: "ประตูที่ไม่เปิด",
      text: () => "คุณยืนอยู่หน้าประตูหินสูงเสียดฟ้า แต่ประตูไม่ขยับ เสียงเย็นชาดังขึ้น 「ศักยภาพไม่ถึงเกณฑ์ — คำเชิญถูกเพิกถอน」",
      choices: [
        { label: "กลับไปใช้ชีวิตบนโลก", run: (l) => { l.flags.awakenDone = true; addStat(l, "happiness", -8); return meh("คุณตื่นขึ้นบนเตียงตัวเอง เหงื่อท่วมตัว"); } },
        { label: "ตะโกนว่าจะกลับมาให้ได้", run: (l) => { l.flags.awakenDone = true; l.flags.stubborn = true; addStat(l, "happiness", -4); return meh("เสียงสะท้อนก้องไปทั้งความว่างเปล่า — หอคอยได้ยิน"); } },
      ],
    },
    enter: {
      title: "ชั้นที่ 1",
      system: true,
      text: (_l, c) => `[หอคอย] ยินดีต้อนรับผู้ท้าชิงคนใหม่ — ระดับประเมินเบื้องต้น:【${rankName(Number(c.rank))}】\nกรุณาเลือกตำแหน่งในทีม`,
      choices: TOWER_CLASSES.map((cls) => ({
        label: `${cls.emoji} ${cls.name} — ${cls.desc}`,
        tone: cls.id === "t_outsider" ? ("special" as const) : undefined,
        show: (_l: Life, c: Ctx) => offered(c, cls.id),
        run: (l: Life, c: Ctx): Outcome => {
          const rank = Number(c.rank);
          awaken(l, rank, cls.id);
          l.flags.floor = 1;
          openHiddenSlot(l, "เข้าสู่หอคอย");
          const hype = rank >= 6 ? " ผู้ดูแลชั้นทุกคนหันมามอง ดวงดาวหลายดวงเริ่มจับตาคุณ" : rank >= 4 ? " ทีมใหญ่หลายทีมส่งคนมาทาบทามตั้งแต่ชั้นแรก" : "";
          return { text: `🗼 คุณเข้าสู่หอคอยในตำแหน่ง${classById(cls.id).name} ระดับ ${rankName(rank)}!${hype}`, kind: "milestone" };
        },
      })),
    },
  },
};

// ───────────────────────── ปีนหอคอย ─────────────────────────

const TRIALS = [
  { name: "เกาะลอยฟ้า", desc: "เกาะหินนับร้อยลอยอยู่เหนือเหว ต้องไปถึงเกาะกลางก่อนเกาะจะร่วงทีละเกาะ" },
  { name: "เขาวงกตกระจก", desc: "ทุกกระจกสะท้อนตัวคุณในอดีต และบางเงาก็เดินออกมาได้" },
  { name: "เกมโหวตเสียงข้างมาก", desc: "ผู้ท้าชิงยี่สิบคนต้องโหวตกันเองว่าใครจะไม่ได้ไปต่อ" },
  { name: "ป่าแก้ว", desc: "ต้นไม้ใสเหมือนแก้ว ทุกเสียงดังจะปลุกสัตว์ที่หลับอยู่ข้างใน" },
  { name: "สนามประลองหนึ่งต่อหนึ่ง", desc: "สู้กับผู้ท้าชิงที่หอคอยจับคู่ให้ ผู้แพ้ต้องรอปีหน้า" },
  { name: "เมืองใต้น้ำ", desc: "ทั้งชั้นจมอยู่ใต้น้ำ หายใจได้แค่ในฟองอากาศที่ค่อยๆ เล็กลง" },
] as const;

const GUARDIANS = ["ผู้คุมชั้นหน้ากากเหล็ก", "อัศวินไร้ศีรษะแห่งชั้นนี้", "งูขาวเจ็ดหัว", "ผู้ดูแลชั้นที่ยิ้มตลอดเวลา", "ยักษ์แก้ว", "เงาของผู้ท้าชิงที่ตายในชั้นนี้"];
const MIDS = ["betray", "rival", "door", "betray", "rival"] as const;
const R = (c: Ctx) => Number(c.rank);
const guardian = (c: Ctx) => String(c.g);

function hurt(l: Life, r: number, min: number, max: number): string {
  const gap = Math.max(0, r - (l.power?.rank ?? 0));
  const dmg = Math.round(randInt(l, min, max) * (1 + gap * 0.5));
  addStat(l, "health", -dmg);
  if (l.stats.health <= 0) {
    kill(l, `บาดเจ็บสาหัสระหว่างบททดสอบชั้น ${floorOf(l) + 1}`);
    return " บาดแผลสาหัสเกินกว่าจะรอด…";
  }
  return ` (สุขภาพ -${dmg})`;
}

/** ผ่านผู้คุมชั้น: ถ้าบททดสอบระดับพอ ก็ขึ้นชั้นใหม่ */
function climb(l: Life, r: number): string {
  const f = floorOf(l);
  if (r < tierOfFloor(f + 1) || f >= floorCap(r)) return " (ชั้นนี้คุณผ่านมาแล้ว — ได้แค่รางวัล)";
  const next = Math.min(floorCap(r), f + randInt(l, 2, 4));
  l.flags.floor = next;
  if (Math.floor(next / 10) > Math.floor(f / 10)) {
    addFame(l, 3 + Math.floor(next / 10));
    if (next >= 30 && chance(l, 0.3)) luckyRankUp(l, `[หอคอย] ผ่านชั้น ${Math.floor(next / 10) * 10} — ประเมินระดับใหม่`);
  }
  if (next >= TOP_FLOOR && !l.flags.towerTop) {
    l.flags.towerTop = true;
    markTurn(l);
    log(l, "🗼 คุณยืนอยู่บนยอดหอคอย — ที่ที่ไม่มีมนุษย์คนไหนเคยไปถึง ประตูสุดท้ายเปิดออก และหอคอยถามว่าคุณปรารถนาอะไร", "milestone");
  }
  return ` — ขึ้นสู่ชั้นที่ ${next}`;
}

export function startClimb(life: Life, r: number) {
  const t = randInt(life, 0, TRIALS.length - 1);
  runEvent(life, "tower.climb", {
    rank: r,
    t,
    g: pick(life, GUARDIANS),
    mid: !life.flags.secretFloor && chance(life, 0.02) ? "door" : pick(life, MIDS.slice(0, 2)),
    score: 0,
    share: 1,
  });
}

export const CLIMB: GameEvent = {
  id: "tower.climb",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "บททดสอบหอคอย",
  text: (l, c) => {
    const tr = TRIALS[Number(c.t)];
    return `ชั้นที่ ${floorOf(l) + 1} · บททดสอบระดับ ${rankName(R(c))}:【${tr.name}】— ${tr.desc}`;
  },
  choices: [
    {
      label: "ฝ่าด้วยพลังตรงๆ",
      odds: (l, c) => fightOdds(l, R(c)),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("คุณทะลวงผ่านทุกอย่างที่ขวางหน้า ผู้ท้าชิงคนอื่นมองตามอย่างตะลึง", "mid"); }
        return bad("บททดสอบโหดกว่าที่คิด คุณผ่านมาได้แบบสะบักสะบอม" + hurt(l, R(c), 6, 14), "mid");
      },
    },
    {
      label: "หาช่องโหว่ของกฎบททดสอบ",
      odds: (l, c) => clamp(checkChance(l, "smarts", 50) + (l.power?.hunterClass === "t_scout" ? 0.2 : 0) - Math.max(0, R(c) - (l.power?.rank ?? 0)) * 0.1, 0.05, 0.95),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("กฎข้อสามมีช่องโหว่ — คุณผ่านโดยไม่ต้องสู้เลย ผู้ดูแลชั้นจดชื่อคุณไว้", "mid"); }
        return bad("หอคอยลงโทษคนที่เล่นนอกกติกา!" + hurt(l, R(c), 4, 10), "mid");
      },
    },
    {
      label: "จับทีมกับผู้ท้าชิงคนอื่น (ปลอดภัยแต่ต้องแบ่ง)",
      run: (_l, c) => { c.share = 0.5; return meh("คุณจับทีมกับผู้ท้าชิงแปลกหน้าสามคน", "mid"); },
    },
  ],
  scenes: {
    mid: {
      text: (_l, c) =>
        ({
          betray: "กลางบททดสอบ เพื่อนร่วมทีมชั่วคราวกระซิบ \"ถ้าเราผลักทีมนั้นตกเหว คะแนนจะเป็นของเราทั้งหมด\"",
          rival: "ผู้ท้าชิงบาดเจ็บคนหนึ่งนอนขวางทาง เขาเป็นคนที่เพิ่งด่าคุณเมื่อชั้นก่อน",
          door: "ผนังตรงหน้ามีประตูบานเล็กที่ไม่มีในแผนที่ของใครเลย — มีตัวอักษรเขียนว่า 「เฉพาะผู้ที่ไม่ควรอยู่ที่นี่」",
        })[String(c.mid)] ?? "",
      choices: [
        {
          label: "ไม่ทำ — ปีนด้วยฝีมือตัวเอง",
          show: (_l, c) => c.mid === "betray",
          run: (l) => { addStat(l, "happiness", 2); addFame(l, 1); return meh("เพื่อนร่วมทีมเบ้ปาก แต่ทีมนั้นมาขอบคุณคุณทีหลัง", "boss"); },
        },
        {
          label: "ผลักให้ตก",
          tone: "danger",
          show: (_l, c) => c.mid === "betray",
          run: (l, c) => { c.score = Number(c.score) + 2; addStat(l, "happiness", -8); addFame(l, -6); return bad("เสียงกรีดร้องหายลงไปในเหว — คะแนนของคุณพุ่งขึ้น แต่คุณจะได้ยินเสียงนั้นไปอีกนาน", "boss"); },
        },
        {
          label: "แบกเขาไปด้วย",
          show: (_l, c) => c.mid === "rival",
          run: (l, c) => { c.score = Number(c.score) - 1; addFame(l, 3); addStat(l, "happiness", 4); return good("เขาเงียบไปตลอดทาง พอถึงทางออกก็พูดเบาๆ ว่า \"ขอบใจ\"", "boss"); },
        },
        { label: "เดินผ่านไป", show: (_l, c) => c.mid === "rival", run: () => meh("ในหอคอย ทุกคนต้องรับผิดชอบชีวิตตัวเอง", "boss") },
        {
          label: "เปิดประตู",
          tone: "danger",
          show: (_l, c) => c.mid === "door",
          odds: (l, c) => survivalOdds(l, R(c) + 2),
          survival: (l, c) => survivalOdds(l, R(c) + 2),
          run: (l, _c, ok) => {
            l.flags.secretFloor = true;
            if (!ok) {
              addStat(l, "health", -40);
              if (l.stats.health <= 0) { kill(l, "หายไปในชั้นลับของหอคอย"); return bad("ประตูปิดลง และไม่มีใครเห็นคุณอีกเลย"); }
              return bad("ชั้นลับปฏิเสธคุณ ร่างคุณถูกโยนกลับมาพร้อมแผลเต็มตัว", "boss");
            }
            luckyRankUp(l, "[หอคอย] ผ่านบททดสอบของชั้นลับ");
            return { text: "คุณพบห้องที่มีบัลลังก์ว่าง และผู้ท้าชิงในตำนานที่รอคุณมาร้อยปี — สิ่งที่เขาสอนเปลี่ยนคุณไปตลอดกาล", kind: "milestone", next: "boss" };
          },
        },
        { label: "ไม่เสี่ยง", show: (_l, c) => c.mid === "door", run: () => meh("คุณจำตำแหน่งประตูไว้ — แต่พอหันกลับไปมองอีกที มันก็หายไปแล้ว", "boss") },
      ],
    },
    boss: {
      title: "ผู้คุมชั้น",
      text: (l, c) => `【${guardian(c)}】ขวางทางขึ้นชั้นที่ ${floorOf(l) + 1} พลังระดับ ${rankName(R(c))} กดทับจนอากาศหนักอึ้ง`,
      choices: [
        {
          label: "สู้เต็มกำลัง",
          tone: "danger",
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06),
          run: (l, c, ok) => {
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              addFame(l, R(c) >= 4 ? 4 : 1);
              return { text: `🗼 คุณล้ม${guardian(c)}ได้! ${r}${climb(l, R(c))}`, kind: "good" };
            }
            if (!chance(l, survivalOdds(l, R(c), Number(c.score) * 0.06))) {
              kill(l, `ถูก${guardian(c)}สังหารที่ชั้น ${floorOf(l) + 1} ของหอคอย`);
              return bad(`${guardian(c)}ไม่ให้โอกาสครั้งที่สอง…`);
            }
            return bad("คุณพ่ายแพ้ หอคอยส่งคุณกลับชั้นปลอดภัย" + hurt(l, R(c), 15, 30));
          },
        },
        {
          label: (l) => `ใช้「${l.power?.items[0] ?? ""}」แล้วสู้`,
          tone: "special",
          show: (l) => (l.power?.items.length ?? 0) > 0,
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          run: (l, c, ok) => {
            const item = l.power!.items.shift();
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              return { text: `🗼「${item}」พลิกเกม! ${guardian(c)}ล้มลง ${r}${climb(l, R(c))}`, kind: "good" };
            }
            return bad(`แม้แต่「${item}」ก็ไม่พอ คุณถอยกลับมาได้หวุดหวิด` + hurt(l, R(c), 10, 20));
          },
        },
        {
          label: "ยอมแพ้ ไว้ปีหน้าค่อยมาใหม่",
          run: (l, c) => meh(`คุณกดปุ่มยอมแพ้ — ${gateRewards(l, R(c), Number(c.share) * 0.3, false)}`),
        },
      ],
    },
  },
};

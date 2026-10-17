// หอคอย: คำเชิญ (เทียบเท่าวันตื่นพลัง) และการปีนทีละชั้น
// ชั้น 1–100 · ระดับผู้ท้าชิง (F–SSS) จำกัดว่าปีนได้สูงสุดถึงชั้นไหน
import type { Choice, Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, openHiddenSlot, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { HunterClass, Life } from "../../engine/types";
import { addFame, addStat, checkChance, clamp, log, money, shortName } from "../../engine/util";
import { sponsorOf } from "../sponsors";
import { RULES, applyHalf, bandRange, isMajor, placeBet, removeMate, rivalGrudge, rivalStar, ruleFor, ruleMod, ruleOfCtx, settleWager, shieldDeath, stakeOf, team, teamGrow, teamMod, teamName, teamSize, wagerText } from "./m19sys";
import { CLASSES, awaken, classById, fightOdds, gateRewards, gainExp, luckyRankUp, markTurn, offerClasses, rankName, rollAwakening, survivalOdds } from "../hunter/power";

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
  const f = floorOf(life);
  const rule = ruleFor(life, f + 1);
  const canUp = r >= tierOfFloor(f + 1) && f < floorCap(r);
  const door = !life.flags.secretFloor && chance(life, 0.02);
  life.flags.t19rules = Number(life.flags.t19rules ?? 0) + 1;
  runEvent(life, "tower.climb", {
    rank: r,
    t,
    g: pick(life, GUARDIANS),
    mid: door ? "door" : (rule.forceMid ?? pick(life, MIDS.slice(0, 2))),
    score: 0,
    share: 1,
    f,
    rule: rule.id,
    rm: 0,
    // ชั้นใหญ่ (อาจข้ามหลักสิบ) — ดวงดาวเปิดโต๊ะพนัน
    wager: canUp && isMajor(f, floorCap(r)),
  });
}

// ── M19: กฎของชั้น · ทีม · โต๊ะพนัน ──
const nx = (c: Ctx) => (c.wager ? "wager" : "boss");
const bossMod = (l: Life, c: Ctx) => Number(c.score) * 0.06 + ruleMod(l, c, "boss") + teamMod(l, c) + Number(c.rig ?? 0) + (c.train19 ? 0.03 : 0);
const bossOdds = (l: Life, c: Ctx) => fightOdds(l, R(c), bossMod(l, c));
const bossSurvival = (l: Life, c: Ctx) => survivalOdds(l, R(c), bossMod(l, c));

/** จบผู้คุมชั้น (ทุกผลลัพธ์): จำเลเวลไว้ให้กฎ "ศัตรูคือตัวท่านเมื่อปีก่อน" */
function closeClimb(l: Life) {
  l.flags.t19lastLv = l.power?.level ?? 0;
}

/** ชนะผู้คุมชั้น: รางวัล + ขึ้นชั้น + ทีมโต + กฎ + เดิมพัน */
function winBoss(l: Life, c: Ctx, head: string): Outcome {
  const r = gateRewards(l, R(c), Number(c.share), true);
  if (c.train19) gainExp(l, 400);
  let up: string;
  if (c.selfless && teamSize(l) >= 2) {
    up = ` — คุณส่งทีมขึ้นไปก่อน แล้วยืนมองประตูปิดลงตรงหน้า${teamGrow(l)}${teamGrow(l)}`;
    addFame(l, 3);
  } else {
    up = climb(l, R(c)) + teamGrow(l) + applyHalf(l, c);
  }
  const w = settleWager(l, c, true);
  closeClimb(l);
  return { text: `${head} ${r}${up}${w}`, kind: "good" };
}

function loseBoss(l: Life, c: Ctx, text: string, hurtMin: number, hurtMax: number): Outcome {
  const w = settleWager(l, c, false);
  closeClimb(l);
  return bad(text + hurt(l, R(c), hurtMin, hurtMax) + w);
}

const teamLine = (l: Life, c: Ctx) => {
  const n = teamSize(l);
  if (!n) return "ทีม: คุณปีนคนเดียว";
  const s = Math.round(teamMod(l, c) * 100);
  return `ทีม${teamName(l) ? `「${teamName(l)}」` : ""}: ${n} คน · ความเข้าขา ${s >= 0 ? "+" : ""}${s}%`;
};

export const CLIMB: GameEvent = {
  id: "tower.climb",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "บททดสอบหอคอย",
  // ฉากแรก = การ์ดกฎของช่วงชั้น (แสดงก่อนเริ่มบททดสอบ)
  text: (l, c) => {
    const tr = TRIALS[Number(c.t)];
    const rule = ruleOfCtx(c);
    const [a, b] = bandRange(Number(c.f) + 1);
    return (
      `ชั้นที่ ${Number(c.f) + 1} · บททดสอบระดับ ${rankName(R(c))}:【${tr.name}】— ${tr.desc}\n\n` +
      `${rule.emoji} กฎของชั้น ${a}–${b}:「${rule.name}」\n${rule.desc}\n(ผลต่อการปีน: ${rule.effect})\n${teamLine(l, c)}`
    );
  },
  choices: [
    ...RULES.flatMap((rule) =>
      (rule.prep ?? []).map((ch): Choice => ({
        ...ch,
        show: (l, c) => c.rule === rule.id && (ch.show ? ch.show(l, c) : true),
      })),
    ),
    { label: "รับทราบกฎ แล้วเริ่มบททดสอบ", run: () => meh("", "trial") },
  ],
  scenes: {
    trial: {
      text: (_l, c) => `${ruleOfCtx(c).emoji}「${ruleOfCtx(c).name}」— บททดสอบ【${TRIALS[Number(c.t)].name}】เริ่มขึ้น`,
      choices: [
        {
          label: "ฝ่าด้วยพลังตรงๆ",
          odds: (l, c) => fightOdds(l, R(c), ruleMod(l, c, "force") + teamMod(l, c) * 0.5),
          run: (l, c, ok) => {
            if (ok) { c.score = Number(c.score) + 1; return good("คุณทะลวงผ่านทุกอย่างที่ขวางหน้า ผู้ท้าชิงคนอื่นมองตามอย่างตะลึง", "mid"); }
            return bad("บททดสอบโหดกว่าที่คิด คุณผ่านมาได้แบบสะบักสะบอม" + hurt(l, R(c), 6, 14), "mid");
          },
        },
        {
          label: "หาช่องโหว่ของกฎบททดสอบ",
          odds: (l, c) => clamp(checkChance(l, "smarts", 50) + (l.power?.hunterClass === "t_scout" ? 0.2 : 0) - Math.max(0, R(c) - (l.power?.rank ?? 0)) * 0.1 + ruleMod(l, c, "trick"), 0.05, 0.95),
          run: (l, c, ok) => {
            if (ok) { c.score = Number(c.score) + 1; return good("กฎข้อสามมีช่องโหว่ — คุณผ่านโดยไม่ต้องสู้เลย ผู้ดูแลชั้นจดชื่อคุณไว้", "mid"); }
            return bad("หอคอยลงโทษคนที่เล่นนอกกติกา!" + hurt(l, R(c), 4, 10), "mid");
          },
        },
        {
          label: "จับทีมกับผู้ท้าชิงคนอื่น (ปลอดภัยแต่ต้องแบ่ง)",
          show: (_l, c) => !ruleOfCtx(c).noAlliance,
          run: (_l, c) => { c.share = 0.5; return meh("คุณจับทีมกับผู้ท้าชิงแปลกหน้าสามคน", "mid"); },
        },
      ],
    },
    mid: {
      text: (_l, c) =>
        ({
          betray: "กลางบททดสอบ เพื่อนร่วมทีมชั่วคราวกระซิบ \"ถ้าเราผลักทีมนั้นตกเหว คะแนนจะเป็นของเราทั้งหมด\"",
          rival: "ผู้ท้าชิงบาดเจ็บคนหนึ่งนอนขวางทาง เขาเป็นคนที่เพิ่งด่าคุณเมื่อชั้นก่อน",
          door: "ผนังตรงหน้ามีประตูบานเล็กที่ไม่มีในแผนที่ของใครเลย — มีตัวอักษรเขียนว่า 「เฉพาะผู้ที่ไม่ควรอยู่ที่นี่」",
          rbetray: "ประตูทางออกปรากฏขึ้นพร้อมเสียงประกาศ 「ยังไม่มีใครทรยศ — ประตูจะไม่เปิด」 ทุกคนเริ่มมองหน้ากัน",
        })[String(c.mid)] ?? "",
      choices: [
        {
          label: "ไม่ทำ — ปีนด้วยฝีมือตัวเอง",
          show: (_l, c) => c.mid === "betray",
          run: (l, c) => { addStat(l, "happiness", 2); addFame(l, 1); return meh("เพื่อนร่วมทีมเบ้ปาก แต่ทีมนั้นมาขอบคุณคุณทีหลัง", nx(c)); },
        },
        {
          label: "ผลักให้ตก",
          tone: "danger",
          show: (_l, c) => c.mid === "betray",
          run: (l, c) => { c.score = Number(c.score) + 2; addStat(l, "happiness", -8); addFame(l, -6); return bad("เสียงกรีดร้องหายลงไปในเหว — คะแนนของคุณพุ่งขึ้น แต่คุณจะได้ยินเสียงนั้นไปอีกนาน", nx(c)); },
        },
        {
          label: "แบกเขาไปด้วย",
          show: (_l, c) => c.mid === "rival",
          run: (l, c) => { c.score = Number(c.score) - 1; addFame(l, 3); addStat(l, "happiness", 4); return good("เขาเงียบไปตลอดทาง พอถึงทางออกก็พูดเบาๆ ว่า \"ขอบใจ\"", nx(c)); },
        },
        { label: "เดินผ่านไป", show: (_l, c) => c.mid === "rival", run: (_l, c) => meh("ในหอคอย ทุกคนต้องรับผิดชอบชีวิตตัวเอง", nx(c)) },
        {
          label: "เปิดประตู",
          tone: "danger",
          show: (_l, c) => c.mid === "door",
          odds: (l, c) => survivalOdds(l, R(c) + 2),
          survival: (l, c) => survivalOdds(l, R(c) + 2),
          run: (l, c, ok) => {
            l.flags.secretFloor = true;
            if (!ok) {
              addStat(l, "health", -40);
              if (l.stats.health <= 0) { kill(l, "หายไปในชั้นลับของหอคอย"); return bad("ประตูปิดลง และไม่มีใครเห็นคุณอีกเลย"); }
              return bad("ชั้นลับปฏิเสธคุณ ร่างคุณถูกโยนกลับมาพร้อมแผลเต็มตัว", nx(c));
            }
            luckyRankUp(l, "[หอคอย] ผ่านบททดสอบของชั้นลับ");
            return { text: "คุณพบห้องที่มีบัลลังก์ว่าง และผู้ท้าชิงในตำนานที่รอคุณมาร้อยปี — สิ่งที่เขาสอนเปลี่ยนคุณไปตลอดกาล", kind: "milestone", next: nx(c) };
          },
        },
        { label: "ไม่เสี่ยง", show: (_l, c) => c.mid === "door", run: (_l, c) => meh("คุณจำตำแหน่งประตูไว้ — แต่พอหันกลับไปมองอีกที มันก็หายไปแล้ว", nx(c)) },
        // กฎ "ต้องทรยศหนึ่งคน"
        {
          label: (l) => `ทรยศเพื่อนร่วมทีม — ทิ้ง${team(l).length ? shortName(team(l)[team(l).length - 1].p) : "ใครสักคน"}ไว้ในกับดัก`,
          tone: "danger",
          show: (l, c) => c.mid === "rbetray" && teamSize(l) >= 1,
          run: (l, c) => {
            const x = team(l)[team(l).length - 1];
            removeMate(l, x.p.id);
            x.p.relation = "rival";
            x.p.bond = 0;
            c.score = Number(c.score) + 2;
            addStat(l, "happiness", -10);
            if (c.oath) addFame(l, -5);
            l.flags.t19betrayer = Number(l.flags.t19betrayer ?? 0) + 1;
            return bad(`ประตูเปิดทันทีที่${shortName(x.p)}ร่วงลงไปในกับดัก — สายตาที่${shortName(x.p)}มองคุณก่อนพื้นปิด จะตามหลอกหลอนคุณ${c.oath ? " ทั้งทีมเห็นคุณผิดคำสัญญา" : ""}`, nx(c));
          },
        },
        {
          label: "ทรยศคนแปลกหน้า — ขโมยแผนที่ของทีมอื่น",
          show: (_l, c) => c.mid === "rbetray",
          run: (l, c) => { c.score = Number(c.score) + 1; addStat(l, "happiness", -5); addFame(l, -2); return meh("ทีมนั้นหลงอยู่ในชั้นนี้ไปอีกสามวัน ประตูเปิดให้คุณอย่างพอใจ", nx(c)); },
        },
        {
          label: "นัดให้เพื่อนร่วมทีม \"แกล้งทรยศ\" คุณ",
          show: (l, c) => c.mid === "rbetray" && teamSize(l) >= 1,
          check: { stat: "luck", dc: 50 },
          run: (l, c, ok) => {
            const x = team(l).sort((a, b) => b.p.bond - a.p.bond)[0];
            if (ok) { c.score = Number(c.score) + 1; x.p.bond = clamp(x.p.bond + 5, 0, 100); return good(`${shortName(x.p)}ขโมยขวดน้ำคุณไปอย่างจงใจ ประตูเปิด — หอคอยยอมรับการทรยศที่ซ้อมมาแล้ว`, nx(c)); }
            removeMate(l, x.p.id);
            x.p.relation = "rival";
            return bad(`${shortName(x.p)}ทรยศคุณจริงๆ — เอาคะแนนทั้งหมดของคุณไป แล้วหายไปหลังประตู "ขอโทษนะ… แต่หอคอยบอกให้ทำ"`, nx(c));
          },
        },
        {
          label: "ทรยศกฎของหอคอยเสียเอง",
          tone: "special",
          show: (_l, c) => c.mid === "rbetray",
          check: { stat: "smarts", dc: 60 },
          run: (l, c, ok) => {
            if (ok) { c.score = Number(c.score) + 2; addFame(l, 3); return good("\"กฎบอกให้ทรยศใครสักคน — ฉันเลือกทรยศหอคอย\" ผู้ดูแลชั้นนิ่งไปนาน แล้วเปิดประตูให้พร้อมเสียงหัวเราะ", nx(c)); }
            c.rm = Number(c.rm ?? 0) - 0.15;
            return bad("หอคอยไม่ขำ — ประตูเปิดแต่พื้นทางเดินไปผู้คุมชั้นกลายเป็นหนาม" + hurt(l, R(c), 6, 12), nx(c));
          },
        },
      ],
    },
    wager: {
      title: "โต๊ะพนันของดวงดาว",
      system: true,
      text: (l, c) => wagerText(l, c, bossOdds(l, c)),
      choices: [
        {
          label: (l) => `แทงข้าง "รอด" — ลง ${money(l, stakeOf(l))}`,
          show: (l) => l.money >= 10_000,
          run: (l, c) => { placeBet(l, c, "for", bossOdds(l, c)); addStat(l, "happiness", 1); return meh("คุณวางเดิมพันกับชีวิตตัวเอง ดวงดาวหลายดวงส่งเสียงเชียร์", "boss"); },
        },
        {
          label: (l) => `แทงข้าง "แพ้" — เดิมพันกับตัวเอง ลง ${money(l, stakeOf(l))}`,
          tone: "danger",
          show: (l) => l.money >= 10_000,
          run: (l, c) => { placeBet(l, c, "against", bossOdds(l, c)); return meh("[ดวงดาวทั้งโต๊ะเงียบกริบ] — แล้วแชทของจักรวาลก็ระเบิด \"มันแทงว่าตัวเองแพ้!?\"", "boss"); },
        },
        {
          label: "สมคบกับดวงดาวล้มโต๊ะ",
          tone: "special",
          show: (l) => !!sponsorOf(l) || rivalGrudge(l) >= 2,
          check: { stat: "smarts", dc: 60 },
          run: (l, c, ok) => {
            if (ok) {
              placeBet(l, c, "rig", bossOdds(l, c));
              c.rig = 0.12;
              return good(`[ข้อความลับจากดวงดาว] "กับดักฝั่งซ้ายของผู้คุมชั้นจะหน่วงไปสองวินาที" — โต๊ะถูกล้มเรียบร้อย`, "boss");
            }
            addFame(l, -6);
            if (sponsorOf(l)) {
              const s = sponsorOf(l)!;
              l.flags.sponsor = "none";
              return bad(`[ประกาศทั่วทุกชั้น] จับได้คาหนังคาเขา! ดวงดาว '${s.name}' ถูกห้ามเดิมพันและตัดขาดจากคุณ`, "boss");
            }
            return bad(`'${rivalStar(l).name}' แฉแผนของคุณกลางโต๊ะ — ทั้งหอคอยรู้ว่าคุณพยายามโกง`, "boss");
          },
        },
        {
          label: "ไม่ลงเดิมพัน — ให้ดวงดาวเล่นกันไป",
          run: (l) => meh(`คุณเดินผ่านโต๊ะพนันไปเฉยๆ '${rivalStar(l).name}' หัวเราะ "เดี๋ยวก็รู้"`, "boss"),
        },
      ],
    },
    boss: {
      title: "ผู้คุมชั้น",
      text: (l, c) => `【${guardian(c)}】ขวางทางขึ้นชั้นที่ ${floorOf(l) + 1} พลังระดับ ${rankName(R(c))} กดทับจนอากาศหนักอึ้ง${c.bet ? `\n(เดิมพันของคุณ: ${({ for: "รอด", against: "แพ้", rig: "ล้มโต๊ะ" } as Record<string, string>)[String(c.bet)]} ×${c.pay})` : ""}`,
      choices: [
        {
          label: "สู้เต็มกำลัง",
          tone: "danger",
          odds: bossOdds,
          survival: bossSurvival,
          run: (l, c, ok) => {
            if (ok) {
              addFame(l, R(c) >= 4 ? 4 : 1);
              return winBoss(l, c, `🗼 คุณล้ม${guardian(c)}ได้!`);
            }
            if (!chance(l, bossSurvival(l, c))) {
              const saved = shieldDeath(l);
              if (saved) return loseBoss(l, c, saved, 10, 20);
              settleWager(l, c, false);
              kill(l, `ถูก${guardian(c)}สังหารที่ชั้น ${floorOf(l) + 1} ของหอคอย`);
              return bad(`${guardian(c)}ไม่ให้โอกาสครั้งที่สอง…`);
            }
            return loseBoss(l, c, "คุณพ่ายแพ้ หอคอยส่งคุณกลับชั้นปลอดภัย", 15, 30);
          },
        },
        {
          label: (l) => `ใช้「${l.power?.items[0] ?? ""}」แล้วสู้`,
          tone: "special",
          show: (l, c) => (l.power?.items.length ?? 0) > 0 && (!ruleOfCtx(c).noItems || !!c.keepItem),
          odds: (l, c) => fightOdds(l, R(c), bossMod(l, c) + 0.25),
          survival: (l, c) => survivalOdds(l, R(c), bossMod(l, c) + 0.25),
          run: (l, c, ok) => {
            const item = l.power!.items.shift();
            if (ok) return winBoss(l, c, `🗼「${item}」พลิกเกม! ${guardian(c)}ล้มลง`);
            return loseBoss(l, c, `แม้แต่「${item}」ก็ไม่พอ คุณถอยกลับมาได้หวุดหวิด`, 10, 20);
          },
        },
        {
          label: "แกล้งแพ้ — เก็บเงินเดิมพันข้าง \"แพ้\"",
          tone: "special",
          show: (_l, c) => c.bet === "against",
          run: (l, c) => {
            const w = settleWager(l, c, false, true);
            closeClimb(l);
            addStat(l, "happiness", -3);
            return meh(`คุณล้มลงอย่างสวยงามในจังหวะที่ดูเป็นธรรมชาติที่สุด ${guardian(c)}มองคุณอย่างสงสัย${w}`);
          },
        },
        {
          label: "ยอมแพ้ ไว้ปีหน้าค่อยมาใหม่",
          run: (l, c) => {
            const w = settleWager(l, c, false);
            closeClimb(l);
            return meh(`คุณกดปุ่มยอมแพ้ — ${gateRewards(l, R(c), Number(c.share) * 0.3, false)}${w}`);
          },
        },
      ],
    },
  },
};

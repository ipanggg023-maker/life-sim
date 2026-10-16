import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, openHiddenSlot } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life, WorldId } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, log, money } from "../../engine/util";
import {
  MAX_RANK,
  CLASSES,
  awaken,
  classById,
  fightOdds,
  gainExp,
  markTurn,
  offerClasses,
  rankLabel,
  luckyRankUp,
  rankUp,
  rollAwakening,
  survivalOdds,
  trackOf,
} from "../hunter/power";
import { worldOf } from "../worlds";
import { startArc } from "../manhwa";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });
const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });
const big = (text: string, next?: string): Outcome => ({ text, kind: "milestone", next });

/** เลือกข้อความตามโลก */
const W = <T>(l: Life, t: Record<WorldId, T>): T => t[l.worldId ?? "hunter"];
const rank = (l: Life) => l.power?.rank ?? -1;
const RL = rankLabel;

function damage(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** ฉากเลือกสายพลัง ใช้ร่วมกันทุกตอนพิเศษที่ทำให้ตื่นพลัง — ctx.rank, ctx.offer */
function chooseStyle(title: string): GameEvent["scenes"] {
  return {
    pick: {
      system: true,
      title,
      text: (l, c) => `[ระบบ] ${worldOf(l.worldId).labels.rank}:【${RL(l, Number(c.rank))}】 — กรุณาเลือกเส้นทาง`,
      choices: CLASSES.map((cls) => cls.id).map((id) => ({
        label: `${classById(id).emoji} ${classById(id).name} — ${classById(id).desc}`,
        tone: ["summoner", "m_demon", "c_dark", "t_outsider"].includes(id) ? ("special" as const) : undefined,
        show: (_l: Life, c: Ctx) => String(c.offer ?? "").split(",").includes(id),
        run: (l: Life, c: Ctx): Outcome => {
          const r = Number(c.rank);
          awaken(l, r, id);
          openHiddenSlot(l, W(l, { hunter: "ตื่นพลัง", murim: "เส้นชีพจรทะลวง", court: "พลังเวทตื่น", tower: "ได้รับคำเชิญจากหอคอย" }));
          const hype = r >= 8 ? " — ทั้งโลกสั่นสะเทือน" : r >= 6 ? " — ข่าวแพร่ไปทั่วทั้งแผ่นดิน" : "";
          return big(`⚡ คุณได้พลัง${classById(id).name} ${worldOf(l.worldId).labels.rank}${RL(l, r)} ในวัย ${l.age} ปี${hype}`);
        },
      })),
    },
  };
}

function prepAwaken(l: Life, c: Ctx, bonus: number) {
  l.flags.forceAwaken = true;
  c.rank = Math.max(0, rollAwakening(l, bonus));
  delete l.flags.forceAwaken;
  c.offer = offerClasses(l).join(",");
}

// ───────────────────────── ตื่นพลังนอกกำหนด ─────────────────────────

const AWAKEN_EVENTS: GameEvent[] = [
  {
    id: "fate.not_yet",
    minAge: 10,
    maxAge: 30,
    forced: true,
    when: (l) => l.worldId === "hunter" && !l.power && !l.flags.notYet && trackOf(l) === "late" && l.age === Number(l.flags.ceremonyAge ?? 19),
    text: () => "คนรุ่นเดียวกันตื่นพลังกันทั้งรุ่น ข่าวเช้าพูดถึงแต่ผู้ตื่นพลังหน้าใหม่… แต่ไม่ใช่คุณ — อย่างน้อยก็ยังไม่ใช่ตอนนี้",
    auto: (l) => { l.flags.notYet = true; addStat(l, "happiness", -5); },
  },
  {
    id: "fate.awaken_offtrack",
    minAge: 4,
    maxAge: 70,
    forced: true,
    when: (l) => l.worldId !== "hunter" && l.worldId !== "tower" && !l.power && !l.flags.awakenDone && ["early", "late"].includes(trackOf(l)) && l.age === Number(l.flags.awakenAge),
    title: "ชะตาที่มาก่อน/หลังกำหนด",
    text: (l) =>
      trackOf(l) === "early"
        ? W(l, {
            hunter: "",
            tower: "",
            murim: `เด็กอายุ ${l.age} ขวบอย่างคุณเผลอตบโต๊ะไม้แตกเป็นสองท่อน ผู้ใหญ่ทั้งบ้านเงียบกริบ — ลมปราณไหลเวียนในตัวคุณตั้งแต่ยังไม่มีใครสอน`,
            court: `ระหว่างร้องไห้งอแง เด็กอายุ ${l.age} ขวบอย่างคุณทำให้แจกันทั้งห้องลอยขึ้นกลางอากาศ — พลังเวทระเบิดออกมาก่อนพิธีตรวจพลังหลายปี`,
          })
        : W(l, {
            hunter: "",
            tower: "",
            murim: `ในวัย ${l.age} ปี ระหว่างผ่าฟืนตามปกติ เส้นชีพจรที่เคยอุดตันมาทั้งชีวิตก็ทะลวงออกพร้อมเสียงดังก้องในหัว`,
            court: `ลูกแก้วมานาเคยไม่เรืองแสงให้คุณ แต่คืนนี้ ในวัย ${l.age} ปี เทียนทุกเล่มในห้องก็ลุกพรึ่บขึ้นเองตามจังหวะหัวใจคุณ`,
          }),
    choices: [
      {
        label: "ยอมรับพลังที่ไหลเข้ามา",
        run: (l, c) => {
          prepAwaken(l, c, 0);
          return sys(trackOf(l) === "early" ? "อัจฉริยะตื่นเร็ว — ทุกคนเริ่มจับตาคุณ" : "ตื่นช้ากว่าคนอื่น… แต่พลังนี้ดูจะเติบโตเร็วผิดปกติ", "pick");
        },
      },
    ],
    scenes: chooseStyle("พลังตื่น"),
  },
  {
    id: "fate.trigger",
    minAge: 5,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (!l.power && (l.stats.health <= 20 || l.flags.lossAge === l.age) ? 60 : 0),
    title: "จุดแตกหัก",
    text: (l) =>
      l.flags.lossAge === l.age
        ? "ยืนอยู่หน้าหลุมศพของคนที่รักที่สุด… ความโกรธ ความเสียใจ และความไร้พลังอัดแน่นจนอกแทบระเบิด บางอย่างในตัวคุณกำลังแตกออก"
        : "ร่างกายใกล้ถึงขีดสุด ลมหายใจแผ่วลงทุกที… แต่ลึกลงไปในความมืด มีบางอย่างกำลังเคาะประตูออกมา",
    choices: [
      {
        label: "เปิดประตูนั้น",
        tone: "special",
        odds: (l) => clamp(0.5 + (l.stats.luck - 50) / 150, 0.2, 0.85),
        run: (l, c, ok) => {
          if (!ok) return meh("ความรู้สึกนั้นค่อยๆ จางหายไป… แต่คุณจะไม่ลืมมัน");
          prepAwaken(l, c, 1);
          return sys("แสงพุ่งออกจากร่างคุณ — ชะตาที่ไม่เคยถูกเขียนไว้ เริ่มต้นตรงนี้", "pick");
        },
      },
      { label: "ปิดตา ปล่อยให้มันผ่านไป", run: () => meh("คุณหลับไปยาวนาน ตื่นมาพร้อมความว่างเปล่า") },
    ],
    scenes: chooseStyle("ตื่นพลังจากจุดแตกหัก"),
  },
];

// ───────────────────────── SSS / วัดแรงก์ผิด ─────────────────────────

const RANK_EVENTS: GameEvent[] = [
  {
    id: "fate.sss_news",
    minAge: 4,
    maxAge: 90,
    forced: true,
    when: (l) => !!l.flags.sssAwakened && !l.flags.sssNews,
    system: true,
    text: (l) =>
      W(l, {
        hunter: "[ข่าวด่วนทั่วโลก] ตรวจพบผู้ตื่นพลังแรงก์ SSS คนที่ 9 ของโลก! ประธานาธิบดีสามประเทศโทรมาขอพบ กิลด์ใหญ่ทั่วโลกส่งข้อเสนอเกินพันล้าน… และมีบางคนเริ่มจ้องเอาชีวิตคุณ",
        tower: "[ข่าวด่วนทั่วโลก] หอคอยประเมินผู้ท้าชิงระดับ SSS เป็นครั้งแรกในรอบสิบปี! สถานีถ่ายทอดทุกช่องแย่งกันขอสัมภาษณ์ และสปอนเซอร์นับร้อยส่งข้อความมาหาคุณ",
        murim: "[ข่าวลือสะเทือนยุทธภพ] ยอดฝีมือระดับเซียนปรากฏตัวในรอบสามร้อยปี! สำนักทั้งใต้หล้าส่งคนมาคารวะ… ลัทธิมารส่งมือสังหารมาเช่นกัน",
        court: "[ประกาศราชสำนัก] พลังเวทวงที่ 8 ปรากฏในรอบห้าร้อยปี! จักรพรรดิเชิญเข้าวัง หอคอยเวทขอรับเป็นศิษย์… และศัตรูของบัลลังก์ก็เริ่มขยับตัว",
      }),
    auto: (l) => { l.flags.sssNews = true; addFame(l, 30); markTurn(l); },
  },
  {
    id: "fate.assassins",
    minAge: 6,
    maxAge: 90,
    maxTimes: 2,
    weight: (l) => ((l.flags.sssAwakened || rank(l) >= 6) && l.age >= Number(l.power?.awakenedAt ?? 0) + 1 ? 10 : 0),
    title: "นักฆ่าในความมืด",
    text: (l) =>
      W(l, {
        hunter: "กลางดึก หน้าต่างห้องแตกกระจาย Hunter แรงก์ A ห้าคนในชุดดำบุกเข้ามา \"ไม่มีอะไรส่วนตัว — มีคนจ่ายให้เราจัดการแรงก์ SSS ก่อนที่จะแข็งแกร่งเกินไป\"",
        tower: "ระหว่างพักในชั้นปลอดภัย ผู้ท้าชิงห้าคนจากกลุ่มล่าผู้ท้าชิงล้อมคุณไว้ \"คะแนนของแกมีค่าเท่ากับทั้งชั้น\"",
        murim: "เงาดำห้าสายลอยข้ามกำแพงคฤหาสน์ มือสังหารจากหอเงาโลหิตล้อมคุณไว้ \"หัวของเจ้ามีค่าหนึ่งหมื่นตำลึงทอง\"",
        court: "รถม้าของคุณถูกซุ่มโจมตีในป่าสน จอมเวทมืดห้าคนร่ายวงเวทผนึกพร้อมกัน \"ท่านผู้นั้นไม่อยากเห็นพลังวงที่ 8 อยู่ข้างบัลลังก์\"",
      }),
    choices: [
      {
        label: "เผชิญหน้าทั้งหมด",
        tone: "danger",
        odds: (l) => fightOdds(l, Math.max(4, rank(l) - 1)),
        survival: (l) => survivalOdds(l, Math.max(4, rank(l) - 1)),
        run: (l, _c, ok) => {
          if (ok) { gainExp(l, 1500); addFame(l, 10); return good("ห้านาทีต่อมา ห้องเงียบสนิท — นักฆ่าทั้งห้านอนอยู่บนพื้น คุณยังไม่ได้ใช้พลังเต็มที่ด้วยซ้ำ"); }
          if (!chance(l, survivalOdds(l, Math.max(4, rank(l) - 1)))) { kill(l, "ถูกลอบสังหารหลังพลังตื่นได้ไม่นาน"); return bad("พลังของคุณยังไม่ทันได้เติบโต…"); }
          return bad("คุณรอดมาได้ แต่ต้องพักฟื้นหลายเดือน" + damage(l, 20, 35, "ถูกลอบสังหาร"));
        },
      },
      { label: "หนีแล้วหายตัวไปสักพัก", check: { stat: "luck", dc: 45 }, run: (l, _c, ok) => (ok ? meh("คุณหายตัวไปหนึ่งปีเต็ม ข่าวลือว่าคุณตายแล้วแพร่สะพัด") : bad("พวกมันตามมาทัน" + damage(l, 15, 30, "ถูกลอบสังหารระหว่างหลบหนี"))) },
    ],
  },
  {
    id: "fate.rank_reveal",
    minAge: 5,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (l.flags.trueRank && l.power && (l.power.level >= 5 || l.stats.health <= 30) ? 25 : 0),
    title: "เครื่องวัดระเบิด",
    text: (l) =>
      W(l, {
        hunter: `การตรวจวัดแรงก์ประจำปีของสมาคม เข็มของเครื่องวัดพุ่งทะลุหน้าปัด แล้วเครื่องก็ระเบิดเป็นเสี่ยงๆ เจ้าหน้าที่หน้าซีด "คุณ… ไม่ใช่แรงก์ ${RL(l, rank(l))} มาตั้งแต่แรก"`,
        tower: `ศิลาประเมินผู้ท้าชิงที่ชั้นปลอดภัยแตกร้าวทันทีที่คุณแตะ — ผู้ดูแลชั้นหน้าซีด "ระดับที่ประเมินไว้ตอนเข้าหอคอย… ผิดพลาด"`,
        murim: `ผู้อาวุโสวางมือบนชีพจรคุณเพื่อตรวจลมปราณ แล้วกระเด็นไปชนเสา "ตันเถียนของเจ้า… กว้างเหมือนมหาสมุทร! ใครบอกว่าเจ้าขั้น${RL(l, rank(l))}!"`,
        court: `ลูกแก้วมานาในหอคอยเวทแตกละเอียดทันทีที่คุณแตะ "เครื่องวัดในพิธีตอนเด็ก… วัดพลังท่านผิดมาตลอด"`,
      }),
    choices: [
      {
        label: "ปลดผนึกพลังที่แท้จริง",
        tone: "special",
        run: (l) => {
          const target = Number(l.flags.trueRank);
          const steps = Math.max(1, target - rank(l));
          delete l.flags.trueRank;
          rankUp(l, "เผยพลังที่แท้จริง", steps); // ไม่ติดเพดาน: พลังนี้เป็นของคุณมาตั้งแต่แรก
          if (rank(l) >= 8) l.flags.sssAwakened = true;
          markTurn(l);
          addFame(l, 20);
          return big("คนที่เคยดูถูกคุณทั้งหมด… ตอนนี้ไม่กล้าแม้แต่จะสบตา");
        },
      },
    ],
  },
];

// ───────────────────────── เส้นทางเลื่อนแรงก์ ─────────────────────────

const RANKUP_EVENTS: GameEvent[] = [
  {
    id: "fate.second_awakening",
    minAge: 10,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (l.power && rank(l) < MAX_RANK && l.stats.health <= 20 ? 50 : 0),
    title: "ตื่นพลังครั้งที่สอง",
    text: () => "ร่างกายแหลกเหลว ลมหายใจแทบไม่เหลือ… \"ข้า… ยังไม่จบ!\" พลังที่เคยมีเริ่มแตกร้าว และบางอย่างที่ใหญ่กว่ากำลังจะออกมาแทนที่",
    choices: [
      {
        label: "ปล่อยให้พลังเก่าแตกสลาย",
        tone: "danger",
        odds: (l) => clamp(0.55 + (l.stats.luck - 50) / 150, 0.25, 0.85),
        survival: (l) => clamp(0.8 + (l.stats.luck - 50) / 200, 0.5, 0.95),
        run: (l, _c, ok) => {
          if (ok) { luckyRankUp(l, "ตื่นพลังครั้งที่สอง", chance(l, 0.3) ? 2 : 1); l.flags.secondAwakened = true; addStat(l, "health", 40); markTurn(l); return big("พลังใหม่ไหลเวียนทั่วร่าง บาดแผลปิดสนิทในพริบตา — คุณไม่ใช่คนเดิมอีกต่อไป"); }
          if (chance(l, 0.25)) { kill(l, "ร่างกายรับพลังที่แตกสลายไม่ไหว"); return bad("พลังทะลักออกมาเกินกว่าร่างกายจะรับไหว…"); }
          return bad("พลังสงบลง… โอกาสผ่านไปแล้ว แต่อย่างน้อยคุณก็ยังหายใจ");
        },
      },
      { label: "ยึดพลังเดิมไว้ให้แน่น", run: (l) => { addStat(l, "health", 10); return meh("คุณรอดมาด้วยพลังเดิม"); } },
    ],
  },
  {
    id: "fate.rage",
    minAge: 8,
    maxAge: 90,
    maxTimes: 1,
    weight: (l) => (l.power && rank(l) < MAX_RANK && l.flags.lossAge === l.age ? 50 : 0),
    title: "พลังจากความแค้น",
    text: () => "เลือดของคนที่คุณรักยังไม่ทันแห้ง… พลังในตัวคุณเดือดพล่านจนอากาศรอบตัวสั่นไหว",
    choices: [
      { label: "ปลดปล่อยความโกรธ", tone: "special", run: (l) => { luckyRankUp(l, "ความแค้นปลุกพลังที่หลับใหล"); addStat(l, "happiness", -5); markTurn(l); return big("อากาศรอบตัวแตกร้าวเป็นริ้ว — ใครก็ตามที่ทำเรื่องนี้ จะต้องชดใช้"); } },
      { label: "ข่มใจไว้ ไม่ให้ความแค้นครอบงำ", run: (l) => { addStat(l, "smarts", 3); return meh("คุณกำหมัดจนเลือดซึม… แต่ยังรักษาสติไว้ได้"); } },
    ],
  },
  {
    id: "fate.black_pill",
    minAge: 16,
    maxAge: 80,
    maxTimes: 2,
    weight: (l) => (l.power && rank(l) < 7 && l.money >= (rank(l) + 1) * 2_000_000 ? 3 : 0),
    title: "ยาเลื่อนขั้นของแท้",
    text: (l) =>
      W(l, {
        hunter: `นายหน้าตลาดมืดเปิดกล่องตะกั่วให้ดู "คริสตัลเลื่อนแรงก์จากดันเจี้ยนแรงก์ SS ของแท้ 100% — ${money(l, (rank(l) + 1) * 2_000_000)}"`,
        tower: `พ่อค้าเร่ในชั้นตลาดมืดยื่นขวดน้ำสีดำให้ "น้ำพุจากชั้น 80 — ดื่มแล้วระดับขึ้นทันที หรือไม่ก็ตาย"`,
        murim: `เถ้าแก่ร้านยาลับใต้ดินหยิบตลับหยกออกมา "ยาเม็ดสวรรค์เก้าขั้น หมื่นปีมีหนึ่งเม็ด — ${money(l, (rank(l) + 1) * 2_000_000)}"`,
        court: `พ่อค้าลึกลับในงานประมูลใต้ดินยกขวดแก้วเรืองแสงขึ้น "น้ำตามังกร ดื่มแล้ววงเวทเพิ่มหนึ่งวง — ${money(l, (rank(l) + 1) * 2_000_000)}"`,
      }),
    choices: [
      {
        label: "ซื้อและใช้ทันที",
        tone: "danger",
        odds: () => 0.6,
        survival: () => 0.9,
        run: (l, _c, ok) => {
          addMoney(l, -(rank(l) + 1) * 2_000_000);
          if (ok) { luckyRankUp(l, "ฤทธิ์ยาเลื่อนขั้น"); markTurn(l); return big("พลังพุ่งพล่านเกินบรรยาย — เงินก้อนนั้นคุ้มทุกบาท"); }
          if (chance(l, 0.1)) { kill(l, "ยาเลื่อนขั้นจากตลาดมืดเป็นพิษ"); return bad("ยาออกฤทธิ์ผิดทาง…"); }
          return bad("ของปลอม! ร่างกายต่อต้านอย่างรุนแรง" + damage(l, 20, 35, "ยาเลื่อนขั้นจากตลาดมืดเป็นพิษ"));
        },
      },
      { label: "ไม่เสี่ยง", run: () => meh("ของดีจริงคงไม่มาขายกันง่ายๆ แบบนี้") },
    ],
  },
  {
    id: "fate.devour",
    minAge: 14,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (l.power && (l.power.bossKills ?? 0) >= 5 && rank(l) < MAX_RANK ? 8 : 0),
    title: "กลืนแกนพลัง",
    text: (l) =>
      W(l, {
        hunter: "แกนมอนสเตอร์บอสที่คุณสะสมไว้ห้าลูกเริ่มสั่นพร้อมกัน เหมือนกำลังเรียกหาคุณ… ข่าวลือว่าถ้ากลืนพร้อมกันได้ พลังจะกระโดดขั้น",
        tower: "เศษพลังของผู้คุมชั้นที่คุณล้มมาห้าคนยังวนเวียนอยู่ในร่างคุณ ถ้าหลอมรวมได้…",
        murim: "แก่นพลังของยอดฝีมือที่คุณล้มมาทั้งห้าคนยังตกค้างในเส้นลมปราณ ถ้าหลอมรวมได้… หรือถ้าหลอมไม่ได้…",
        court: "ผลึกวิญญาณของศัตรูที่คุณปราบมาส่งเสียงกระซิบในหัวทุกคืน \"กลืนพวกเราเข้าไป\"",
      }),
    choices: [
      {
        label: "กลืนทั้งหมด",
        tone: "danger",
        odds: (l) => clamp(0.5 + (l.stats.health - 50) / 150, 0.2, 0.85),
        survival: () => 0.85,
        run: (l, _c, ok) => {
          if (ok) { luckyRankUp(l, "กลืนแกนพลังของศัตรู"); markTurn(l); return big("พลังของศัตรูทั้งห้ากลายเป็นของคุณ ดวงตาเปล่งแสงอยู่สามวัน"); }
          if (chance(l, 0.15)) { kill(l, "กลืนแกนพลังแล้วร่างแตกสลาย"); return bad("พลังห้าสายตีกันในร่าง…"); }
          return bad("พลังต่อต้านกันจนร่างแทบแหลก" + damage(l, 20, 35, "กลืนแกนพลังแล้วร่างแตกสลาย"));
        },
      },
      { label: "ขายแกนพลังทิ้ง", run: (l) => { addMoney(l, (rank(l) + 1) * 1_500_000); return meh(`คุณขายได้ ${money(l, (rank(l) + 1) * 1_500_000)}`); } },
    ],
  },
  {
    id: "fate.pact",
    minAge: 15,
    maxAge: 70,
    maxTimes: 1,
    weight: (l) => (rank(l) < 7 ? 3 : 0),
    title: "สัญญา",
    text: (l) =>
      W(l, {
        hunter: "หน้าต่างสีแดงเด้งขึ้นตรงหน้า [ผู้สนับสนุน 'ราชาผู้หลับใหลใต้ทะเลลึก' สนใจคุณ — ยอมรับสัญญาหรือไม่? ราคา: อายุขัยส่วนหนึ่ง]",
        tower: "หน้าต่างสีแดงเด้งขึ้นตรงหน้า [ดวงดาว 'ผู้ปกครองชั้นที่หายไป' ต้องการทำสัญญากับคุณ — พลังแลกกับอายุขัย]",
        murim: "กระบี่เก่าในโกดังส่งเสียงพูดได้ \"ข้าคือเทพมารที่ถูกผนึกไว้พันปี ให้ข้าอาศัยร่างเจ้าบ้าง แล้วข้าจะให้พลังที่เจ้าใฝ่ฝัน\"",
        court: "เงาในกระจกยิ้มให้คุณทั้งที่คุณไม่ได้ยิ้ม \"ข้ามอบพลังได้มากกว่าที่วิหารให้เจ้าทั้งชีวิต แลกกับวิญญาณเพียงเสี้ยวเดียว\"",
      }),
    choices: [
      {
        label: "ยอมรับสัญญา",
        tone: "danger",
        run: (l, c) => {
          l.flags.pact = true;
          markTurn(l);
          addFame(l, -5);
          if (!l.power) { prepAwaken(l, c, 3); return sys("พลังอันมืดมิดหลั่งไหลเข้าสู่ร่างที่ไม่เคยมีพลังมาก่อน", "pick"); }
          luckyRankUp(l, "พลังจากสัญญา", 2);
          return big("พลังมหาศาลไหลเข้ามา — แต่คุณรู้สึกได้ว่าอายุขัยค่อยๆ ถูกกัดกินทุกปี");
        },
      },
      { label: "ปฏิเสธ", run: () => meh("เสียงนั้นหัวเราะ \"เราจะพบกันอีก\" แล้วเงียบหายไป") },
    ],
    scenes: chooseStyle("พลังจากสัญญา"),
  },
  {
    id: "fate.master",
    minAge: 12,
    maxAge: 50,
    maxTimes: 1,
    weight: (l) => (l.power && rank(l) < MAX_RANK ? 3 : 0),
    title: "การถ่ายทอด",
    text: (l) =>
      W(l, {
        hunter: "Hunter แรงก์ S ชราที่คุณช่วยไว้ในดันเจี้ยนเมื่อหลายปีก่อน นอนรอความตายอยู่ในโรงพยาบาล \"ข้าไม่มีลูกหลาน… รับพลังของข้าไปเถอะ\"",
        tower: "ผู้ท้าชิงชราที่ติดอยู่ชั้นเดิมมาสามสิบปี และเคยสอนคุณใช้พลังหอคอย นอนรอความตายในชั้นปลอดภัย \"พลังทั้งหมดของข้า… เอาไปปีนต่อแทนข้าที\"",
        murim: "อาจารย์ชราผู้สอนคุณแบบลับๆ มาหลายปีนอนป่วยใกล้สิ้นใจ \"ลมปราณแปดสิบปีของข้า… จะสูญเปล่าไม่ได้ วางฝ่ามือลงบนอกข้า\"",
        court: "จอมเวทหลวงชราผู้ไม่เคยมีศิษย์ เรียกคุณเข้าห้องในคืนสุดท้ายของชีวิต \"วงเวทของข้า… จงสืบต่อมัน\"",
      }),
    choices: [
      { label: "รับการถ่ายทอด", tone: "special", run: (l) => { luckyRankUp(l, "รับการถ่ายทอดพลังจากผู้อาวุโส"); gainExp(l, 1500); markTurn(l); addStat(l, "happiness", -5); return big("แสงอุ่นไหลจากมือที่เย็นลงทุกที… คุณจะไม่ทำให้พลังนี้เสียเปล่า"); } },
      { label: "ปฏิเสธ ขอให้ท่านพักผ่อน", run: (l) => { addStat(l, "happiness", 5); addFame(l, 3); return meh("ผู้อาวุโสยิ้มอย่างพอใจ แล้วหลับตาลงอย่างสงบ"); } },
    ],
  },
  {
    id: "fate.method",
    minAge: 5,
    maxAge: 90,
    forced: true,
    when: (l) => (l.regressions ?? 0) >= 1 && !!l.power && !l.flags.knowsMethod,
    system: true,
    text: () => "[ความทรงจำ] คุณจำวิธีฝึกที่ถูกต้องจากชาติก่อนได้ทุกขั้นตอน — ข้ามความผิดพลาดที่เสียเวลาไปหลายสิบปี (EXP ×1.25)",
    auto: (l) => { l.flags.knowsMethod = true; },
  },
];

// ───────────────────────── ปิดด่าน / ห้องเวลา ─────────────────────────

export const SECLUSION_YEARS = 3;
export const isSecluded = (l: Life) => Number(l.flags.secludeUntil ?? 0) > l.age;

export function canSeclude(l: Life): string | undefined {
  if (!l.power) return "ยังไม่มีพลัง";
  if (isSecluded(l)) return "กำลังปิดด่านอยู่";
  if (l.age - Number(l.flags.lastSeclusion ?? -99) < 10) return "ปิดด่านได้ทุก 10 ปี";
  if (l.queue.length) return "กำลังมีเหตุการณ์อยู่";
  return;
}

export function startSeclusion(l: Life): Outcome | undefined {
  if (canSeclude(l)) return;
  l.flags.secludeUntil = l.age + SECLUSION_YEARS;
  l.flags.lastSeclusion = l.age;
  const text = W(l, {
    hunter: `คุณเช่าห้องฝึกแรงโน้มถ่วงสิบเท่าของสมาคมแบบปิดตาย ${SECLUSION_YEARS} ปี ตัดขาดจากโลกภายนอก`,
    tower: `คุณเข้าห้องฝึกเวลาบิดเบี้ยวของหอคอย ${SECLUSION_YEARS} ปี ไม่ออกมาพบใครเลย`,
    murim: `คุณปิดด่านในถ้ำหลังน้ำตก ${SECLUSION_YEARS} ปี ไม่พบผู้คน ไม่รับรู้เรื่องใดในยุทธภพ`,
    court: `คุณขังตัวเองในห้องเวลาของหอคอยเวท ${SECLUSION_YEARS} ปี ที่หนึ่งวันข้างในเท่ากับหนึ่งเดือนข้างนอก`,
  });
  log(l, text, "system");
  return { text, kind: "system" };
}

const SECLUSION_EVENTS: GameEvent[] = [
  {
    id: "fate.seclusion_year",
    minAge: 0,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: isSecluded,
    text: (l) => `[ปิดด่าน] ฝึกฝนอย่างต่อเนื่อง… เหลืออีก ${Number(l.flags.secludeUntil) - l.age} ปี`,
    auto: (l) => { gainExp(l, 400 + (l.power?.level ?? 1) * 45); addStat(l, "happiness", -2); return "system"; },
  },
  {
    id: "fate.seclusion_end",
    minAge: 0,
    maxAge: 200,
    forced: true,
    maxTimes: 0,
    when: (l) => !!l.flags.secludeUntil && Number(l.flags.secludeUntil) === l.age,
    title: "ออกจากด่าน",
    text: () => "ประตูหินเปิดออก แสงอาทิตย์แรกในรอบสามปีสาดเข้ามา… ร่างกายคุณรู้สึกต่างไปจากเดิม",
    choices: [
      {
        label: "ทดสอบพลังที่สะสมไว้",
        odds: () => 0.45,
        run: (l, _c, ok) => {
          delete l.flags.secludeUntil;
          gainExp(l, 500);
          if (ok) { luckyRankUp(l, "ผลจากการปิดด่าน"); markTurn(l); return big("หินผาตรงหน้าแยกออกเป็นสองท่อนเพียงแค่คุณมอง"); }
          return good("พลังแน่นขึ้นมาก แม้จะยังไม่ข้ามขั้น");
        },
      },
    ],
  },
];

// ───────────────────────── จุดพลิกที่การันตี ─────────────────────────

const TURNING: GameEvent = {
  id: "fate.turning_point",
  minAge: 14,
  maxAge: 60,
  forced: true,
  when: (l) => !l.flags.turnDone && l.age === Number(l.flags.tpAge ?? 30),
  title: "จุดเปลี่ยนของชะตา",
  text: (l) =>
    l.power
      ? W(l, {
          hunter: "ระหว่างเดินกลับบ้าน ประตูมิติสีทองที่ไม่มีในแผนที่ของสมาคมเปิดขึ้นตรงหน้าคุณเพียงคนเดียว — หน้าต่างระบบเด้งขึ้น [บททดสอบของผู้ถูกเลือก: ผ่าน = รางวัลไม่จำกัด / ล้มเหลว = ความตาย]",
          tower: "ระหว่างบททดสอบ คุณหลงเข้าไปในชั้นลับที่ไม่มีอยู่ในแผนที่ของหอคอย มีบัลลังก์ว่างตั้งอยู่กลางห้อง",
          murim: "ชายชราตาบอดดักรอคุณที่สะพาน \"ข้ารอเจ้ามาสามสิบปี — ภายในหุบเขามรณะมีเคล็ดวิชาที่จะพาเจ้าข้ามขั้น หากกล้าพอ\"",
          court: "ภูตแสงตัวเล็กบินมาเกาะไหล่คุณแล้วกระซิบ \"เทพธิดาเลือกท่านแล้ว — ใต้ทะเลสาบหลวงมีบททดสอบที่รอคนอย่างท่านอยู่\"",
        })
      : W(l, {
          hunter: "คุณได้งานแบกของในทีมจู่โจมราคาถูก ระหว่างทาง Gate แรงก์ D กลับมีประตูบานที่สองที่ไม่มีใครเคยเห็น… หัวใจคุณเต้นแรงอย่างประหลาด",
          tower: "คุณรับจ้างแบกเสบียงให้ทีมใหญ่ แต่พื้นชั้นถล่มกลางทาง คุณตกลงไปในห้องที่มีโครงกระดูกผู้ท้าชิงในตำนานนั่งรออยู่",
          murim: "พายุพัดคุณพลัดตกลงในหุบเขาลึก ในถ้ำมีโครงกระดูกนั่งสมาธิอยู่ ข้างกายมีคัมภีร์ที่เขียนว่า 'สำหรับผู้ที่ชะตาไม่เคยเหลียวแล'",
          court: "ในห้องใต้หลังคาของบ้าน คุณเจอหนังสือเวทเล่มเก่าที่ตัวอักษรขยับได้ หน้าแรกเขียนว่า 'เจ้าของคนต่อไป: คุณ'",
        }),
  choices: [
    {
      label: (l) => (l.power ? "รับบททดสอบ" : "ก้าวเข้าไป"),
      tone: "danger",
      odds: (l) => clamp(0.55 + (l.stats.luck - 50) / 150 + (l.stats.smarts - 50) / 200, 0.2, 0.9),
      survival: (l) => clamp(0.75 + (l.stats.health - 50) / 200, 0.4, 0.95),
      run: (l, c, ok) => {
        markTurn(l);
        if (!ok) {
          if (!chance(l, clamp(0.75 + (l.stats.health - 50) / 200, 0.4, 0.95))) { kill(l, "ล้มเหลวในบททดสอบแห่งชะตา"); return bad("ชะตาเลือกคุณ… แต่คุณยังไม่พร้อมสำหรับมัน"); }
          return bad("คุณล้มเหลว แต่รอดกลับมาได้" + damage(l, 15, 30, "บททดสอบแห่งชะตา"));
        }
        if (!l.power) { prepAwaken(l, c, 2); return sys("คุณผ่านบททดสอบ… และพลังที่ไม่เคยมีมาก่อนก็ตื่นขึ้น", "pick"); }
        luckyRankUp(l, "ผ่านบททดสอบแห่งชะตา", chance(l, 0.35) ? 2 : 1);
        gainExp(l, 2000);
        return big("คุณก้าวออกมาพร้อมพลังที่ทำให้ฟ้าดินเปลี่ยนสี");
      },
    },
    { label: "หันหลังกลับ", run: (l) => { markTurn(l); return meh("บางทีชีวิตธรรมดาก็ดีอยู่แล้ว… ประตูนั้นปิดลงและไม่เคยเปิดอีกเลย"); } },
  ],
  scenes: chooseStyle("ชะตาที่ถูกเขียนใหม่"),
};

// ───────────────────────── ภาคศัตรูระดับเดียวกัน ─────────────────────────

const ARC: GameEvent = {
  id: "fate.arc_rival",
  minAge: 16,
  maxAge: 90,
  maxTimes: 1,
  weight: (l) => (rank(l) >= 6 && l.age >= Number(l.power?.awakenedAt ?? 0) + 2 ? 12 : 0),
  title: "ภาคใหม่: ศัตรูระดับเดียวกัน",
  text: (l) =>
    W(l, {
      hunter: "ทั่วโลกนิ่งงัน — Hunter แรงก์ SSS จากต่างประเทศประกาศท้าดวลคุณผ่านสื่อทุกช่อง \"ประเทศเล็กๆ ไม่ควรมีพลังระดับนี้ ถ้าแพ้ Gate ทั้งหมดในประเทศจะตกเป็นของเรา\"",
      tower: "ผู้ท้าชิงระดับ SSS อีกคนที่ปีนมาจากอีกฝั่งของหอคอยประกาศผ่านจอทุกชั้น \"ยอดหอคอยมีที่สำหรับคนเดียว\"",
      murim: "จอมมารสวรรค์ที่ถูกผนึกไว้สามร้อยปีคืนชีพ ส่งศีรษะเจ้าสำนักสามแห่งมาที่หน้าประตูบ้านคุณ \"เจ้าคือคนเดียวในยุคนี้ที่คู่ควรให้ข้าฆ่า\"",
      court: "ท้องฟ้าเหนือนครหลวงแตกออก ราชาปีศาจก้าวลงมาบนบัลลังก์ลอยฟ้า \"ผู้ใช้เวทวงที่ 8… มาเป็นของเล่นให้ข้าเถิด\"",
    }),
  choices: [
    {
      label: "รับคำท้า",
      tone: "danger",
      run: (l) => { startArc(l, "ศึกระดับตำนาน"); return sys("คุณใช้เวลาหนึ่งปีเตรียมตัว… และวันนั้นก็มาถึง", "battle"); },
    },
    { label: "หลีกเลี่ยงการปะทะ", run: (l) => { addFame(l, -25); addStat(l, "happiness", -10); return bad("ทั้งโลกผิดหวังในตัวคุณ และศัตรูยึดทุกอย่างไปโดยไม่ต้องสู้"); } },
  ],
  scenes: {
    battle: {
      title: "การต่อสู้ระดับตำนาน",
      text: (l) =>
        W(l, {
          hunter: "เมืองทั้งเมืองถูกอพยพเพื่อการดวลครั้งนี้ ทุกช่องถ่ายทอดสด พลังของคุณและศัตรูปะทะกันจนเมฆบนฟ้าแยกเป็นสองฝั่ง",
          tower: "ผู้ดูแลหอคอยเปิดชั้นพิเศษให้คุณสองคนดวลกันต่อหน้าผู้ท้าชิงทั้งหอคอย พื้นชั้นแตกร้าวทุกครั้งที่พลังปะทะกัน",
          murim: "บนยอดเขาไท่ซาน ลมปราณของคุณกับจอมมารสวรรค์ปะทะกันเจ็ดวันเจ็ดคืน ภูเขาลูกข้างๆ ทลายลงทั้งลูก",
          court: "เวทวงที่ 8 ของคุณกับเปลวเพลิงนรกของราชาปีศาจปะทะกันกลางฟ้า นครหลวงทั้งเมืองเงยหน้ามองโดยไม่กล้าหายใจ",
        }),
      choices: [
        {
          label: "ทุ่มทุกอย่างที่มี",
          tone: "danger",
          odds: (l) => fightOdds(l, 8, 0.1),
          survival: (l) => survivalOdds(l, 8, 0.15),
          run: (l, _c, ok) => {
            if (ok) { l.flags.arcWon = true; addFame(l, 50); gainExp(l, 5000); if (rank(l) < MAX_RANK && chance(l, 0.5)) rankUp(l, "ข้ามขีดจำกัดในการต่อสู้ระดับตำนาน"); return big("ศัตรูคุกเข่าลง — ตั้งแต่วันนี้ ไม่มีใครในโลกกล้าเรียกตัวเองว่าเหนือกว่าคุณอีก"); }
            if (!chance(l, survivalOdds(l, 8, 0.15))) { kill(l, "สละชีพในการต่อสู้ระดับตำนาน"); return bad("แสงสุดท้ายของคุณสว่างพอจะพาศัตรูไปด้วย… ทั้งโลกจดจำชื่อคุณตลอดกาล"); }
            return bad("คุณพ่ายแพ้ แต่รอดมาได้อย่างหวุดหวิด — ภาคต่อไปคือการแก้แค้น" + damage(l, 25, 45, "พ่ายแพ้ในการต่อสู้ระดับตำนาน"));
          },
        },
        {
          label: "ใช้ไอเทมที่เก็บไว้ทั้งหมด",
          tone: "special",
          show: (l) => (l.power?.items.length ?? 0) >= 2,
          odds: (l) => fightOdds(l, 8, 0.35),
          run: (l, _c, ok) => {
            l.power!.items = [];
            if (ok) { l.flags.arcWon = true; addFame(l, 50); return big("ไอเทมทุกชิ้นที่สะสมมาตลอดชีวิตถูกใช้ในจังหวะเดียว — และมันได้ผล"); }
            return bad("แม้จะใช้ทุกอย่าง ศัตรูก็ยังยืนอยู่" + damage(l, 25, 45, "พ่ายแพ้ในการต่อสู้ระดับตำนาน"));
          },
        },
      ],
    },
  },
};

export const FATE_EVENTS: GameEvent[] = [...AWAKEN_EVENTS, ...RANK_EVENTS, ...RANKUP_EVENTS, ...SECLUSION_EVENTS, TURNING, ARC];

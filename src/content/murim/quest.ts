import { woundFrom } from "../../engine/body";
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addStat, checkChance, clamp } from "../../engine/util";
import { fightOdds, gateRewards, luckyRankUp, rankLabel, survivalOdds } from "../hunter/power";
import { atPlace, freshQuest } from "../shared/questPool";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

export const QUEST_TYPES = [
  { name: "ปราบโจรที่{p}", desc: "โจรหลายร้อยคนยึดเส้นทาง ปล้นขบวนสินค้ามาสามเดือนแล้ว", bosses: ["หัวหน้าโจรขวานคู่", "ยอดโจรพยัคฆ์ดำ", "เจ้าป้อมโจรสามแขน"] },
  { name: "คุ้มกันขบวนสินค้าผ่าน{p}", desc: "หีบหยกล้ำค่าสามสิบหีบ ข่าวว่ามีคนจ้องปล้นตลอดทาง", bosses: ["มือดาบเร่ร่อนหน้าบาก", "สามพี่น้องอสูรทราย", "นางพญางูพิษ"] },
  { name: "ล่าอสูรกินคนแห่ง{p}", desc: "สัตว์อสูรตาแดงกินคนไปแล้วสิบสองคน ชาวบ้านไม่กล้าออกจากบ้าน", bosses: ["พยัคฆ์ขาวตาโลหิต", "ราชาลิงเพลิง", "งูเหลือมหงอนทอง"] },
  { name: "ตามล่าโจรเด็ดดอกไม้ที่{p}", desc: "จอมโจรผู้ลักพาตัวหญิงสาวหลบซ่อนอยู่แถวนี้", bosses: ["โจรเด็ดดอกไม้หน้าหยก", "จอมขโมยไร้เงา", "บุรุษพันหน้า"] },
  { name: "บุกรังลับลัทธิมารที่{p}", desc: "สาวกลัทธิมารใช้ศาลเจ้าร้างเป็นที่ทำพิธีบูชายัญ", bosses: ["ผู้พิทักษ์ธงโลหิต", "นักบวชมารหกแขน", "ทูตปีศาจเสื้อแดง"] },
  { name: "ชิงคัมภีร์ที่ถูกขโมยคืนที่{p}", desc: "คัมภีร์ประจำสำนักพันธมิตรถูกขโมย คนร้ายหนีมาทางนี้", bosses: ["จอมขโมยมือเทวดา", "ศิษย์ทรยศสำนักบู๊ตึ๊ง", "นักพรตชุดดำ"] },
  { name: "ช่วยตัวประกันจากโจรสลัดที่{p}", desc: "ลูกสาวพ่อค้าเกลือถูกจับเรียกค่าไถ่ เส้นตายคือรุ่งเช้า", bosses: ["หัวหน้าโจรสลัดตาเดียว", "มือมีดบินพันเล่ม", "นางโจรสลัดแส้เหล็ก"] },
  { name: "สืบคดีฆาตกรรมปริศนาที่{p}", desc: "ศพชาวยุทธ์ห้าศพ บาดแผลเดียวกันหมด — วิชาที่ควรสาบสูญไปแล้ว", bosses: ["นักฆ่าวิชานิ้วมรณะ", "ผู้อาวุโสที่แสร้งตาย", "คนเฝ้าสุสานไร้หน้า"] },
] as const;

export const QUEST_PLACES = ["ภูเขาเฮยเฟิง", "ช่องเขาอินซาน", "ท่าเรือหยางโจว", "ป่าไผ่ซูโจว", "ทะเลสาบไท่หู", "ด่านเจียอวี้กวน", "เมืองลั่วหยาง", "หุบเขาวิญญาณร้าย", "ทุ่งหญ้าแดนเหนือ", "ริมแม่น้ำแยงซี"];

const MIDS = ["ambush", "treasure", "victim", "ambush", "treasure", "cave"] as const;
const R = (c: Ctx) => Number(c.rank);
const boss = (c: Ctx) => String(c.b);

function hurt(l: Life, qRank: number, min: number, max: number): string {
  const gap = Math.max(0, qRank - (l.power?.rank ?? 0));
  const dmg = Math.round(randInt(l, min, max) * (1 + gap * 0.5));
  addStat(l, "health", -dmg);
  if (l.stats.health <= 0) {
    kill(l, `บาดเจ็บสาหัสระหว่างภารกิจระดับ${rankLabel(l, qRank)}`);
    return " บาดแผลสาหัสเกินกว่าจะรอด…";
  }
  return ` (สุขภาพ -${dmg})` + woundFrom(l, dmg, `บาดเจ็บระหว่างภารกิจ`);
}

export function startQuest(life: Life, qRank: number) {
  const { t, p } = freshQuest(life, "murim", QUEST_TYPES.length, QUEST_PLACES.length);
  runEvent(life, "murim.quest", {
    rank: qRank,
    t,
    p,
    b: pick(life, QUEST_TYPES[t].bosses),
    mid: !life.flags.secretCave && chance(life, 0.015) ? "cave" : pick(life, MIDS.slice(0, 5)),
    score: 0,
    share: 1,
  });
}

export const MURIM_QUEST: GameEvent = {
  id: "murim.quest",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ภารกิจยุทธภพ",
  text: (l, c) => {
    const q = QUEST_TYPES[Number(c.t)];
    return `ภารกิจระดับ${rankLabel(l, R(c))}:【${atPlace(q.name, QUEST_PLACES[Number(c.p ?? 0)])}】— ${q.desc}`;
  },
  choices: [
    {
      label: "บุกตรงเข้าไปด้วยวิชาของตน",
      odds: (l, c) => fightOdds(l, R(c)),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("ลูกสมุนล้มระเนระนาดโดยไม่มีใครแตะชายเสื้อคุณได้", "mid"); }
        return bad("พวกมันรุมเข้ามาพร้อมกัน กว่าจะฝ่าออกมาได้ก็เลือดอาบ" + hurt(l, R(c), 6, 14), "mid");
      },
    },
    {
      label: "ใช้วิชาตัวเบาลอบเข้าทางหลังคา",
      odds: (l, c) => clamp(checkChance(l, "luck", 45) + (l.power?.hunterClass === "m_hidden" ? 0.2 : 0) - Math.max(0, R(c) - (l.power?.rank ?? 0)) * 0.1, 0.05, 0.95),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("คุณเหยียบกระเบื้องหลังคาไร้เสียงราวแมว", "mid"); }
        return bad("กระเบื้องแผ่นหนึ่งแตกดังกร๊อบ!" + hurt(l, R(c), 4, 10), "mid");
      },
    },
    {
      label: "ร่วมมือกับจอมยุทธ์คนอื่น (ปลอดภัยแต่ต้องแบ่งรางวัล)",
      run: (_l, c) => { c.share = 0.5; return meh("คุณจับมือกับจอมยุทธ์พเนจรสามคนที่ผ่านทางมา", "mid"); },
    },
  ],
  scenes: {
    mid: {
      text: (_l, c) =>
        ({
          ambush: "ลูกดอกอาบยาพิษพุ่งมาจากพุ่มไม้! มีคนซุ่มโจมตีอยู่",
          treasure: "ในห้องลับมีหีบไม้จันทน์สลักลายมังกร… อาจมีกลไกซ่อนอยู่",
          victim: "ชาวบ้านคนหนึ่งถูกมัดไว้กับเสา ร้องขอให้ช่วย",
          cave: "ผนังถ้ำหลังน้ำตกมีรอยกระบี่สลักเป็นตัวอักษร… ยิ่งมองยิ่งเหมือนเพลงกระบี่ที่มีชีวิต",
        })[String(c.mid)] ?? "",
      choices: [
        {
          label: "ปัดลูกดอก",
          show: (_l, c) => c.mid === "ambush",
          odds: (l, c) => fightOdds(l, R(c), 0.15),
          run: (l, c, ok) => (ok ? good("คุณปัดลูกดอกทั้งเจ็ดดอกตกพื้นด้วยฝักกระบี่", "boss") : bad("ลูกดอกดอกหนึ่งปักไหล่ พิษซึมเข้ากระแสเลือด" + hurt(l, R(c), 6, 12), "boss")),
        },
        {
          label: "ใช้ความรู้แพทย์ถอนพิษ",
          tone: "special",
          show: (l, c) => c.mid === "ambush" && l.power?.hunterClass === "m_medic",
          run: () => good("คุณฝังเข็มปิดจุดชีพจรห้าจุด พิษหยุดไหลเวียนทันที", "boss"),
        },
        {
          label: "เปิดหีบ",
          show: (_l, c) => c.mid === "treasure",
          check: { stat: "luck", dc: 50 },
          run: (l, c, ok) => {
            if (ok) {
              const item = pick(l, ["ยาเม็ดเก้าหยาง", "คัมภีร์ลมปราณขาดวิ่น", "ป้ายหยกคุ้มกาย", "ยาเม็ดทะลวงชีพจร"]);
              l.power?.items.push(item);
              return good(`ข้างในมี「${item}」! คุณเก็บเข้าอกเสื้อ`, "boss");
            }
            return bad("กลไกลับดีดเข็มพิษออกมาเป็นสาย!" + hurt(l, R(c), 6, 12), "boss");
          },
        },
        { label: "ไม่แตะ ไปต่อ", show: (_l, c) => c.mid === "treasure", run: () => meh("คุณเดินผ่านไปอย่างระวัง", "boss") },
        {
          label: "ตัดเชือกช่วยชาวบ้าน",
          show: (_l, c) => c.mid === "victim",
          run: (l, c) => { addFame(l, 3); addStat(l, "happiness", 4); c.score = Number(c.score) - 1; return good("ชาวบ้านคุกเข่าโขกศีรษะขอบคุณ แต่เสียงดังทำให้ศัตรูรู้ตัว", "boss"); },
        },
        { label: "ภารกิจต้องมาก่อน", show: (_l, c) => c.mid === "victim", run: (l) => { addStat(l, "happiness", -6); return meh("เสียงร้องไห้ตามหลังคุณไปจนสุดทาง", "boss"); } },
        {
          label: "นั่งสมาธิพิจารณารอยกระบี่",
          tone: "danger",
          show: (_l, c) => c.mid === "cave",
          survival: (l) => clamp(0.5 + (l.stats.smarts - 50) / 120, 0.2, 0.95),
          odds: (l) => clamp(0.5 + (l.stats.smarts - 50) / 120, 0.2, 0.95),
          run: (l, _c, ok) => {
            l.flags.secretCave = true;
            if (!ok) {
              addStat(l, "health", -40);
              if (l.stats.health <= 0) { kill(l, "ธาตุไฟเข้าแทรกขณะพิจารณาเคล็ดวิชาในถ้ำ"); return bad("ปราณกระบี่ในรอยสลักย้อนเข้าเส้นลมปราณของคุณ…"); }
              return bad("ปราณกระบี่ในรอยสลักพุ่งย้อนเข้าร่าง คุณกระอักเลือดแต่รอดมาได้", "boss");
            }
            luckyRankUp(l, "เข้าใจเคล็ดวิชาจากรอยกระบี่ของปรมาจารย์โบราณ");
            return { text: "คุณนั่งนิ่งสามวันสามคืน เมื่อลืมตาขึ้น เพลงกระบี่ทั้งหมดก็อยู่ในหัวคุณแล้ว", kind: "milestone", next: "boss" };
          },
        },
        { label: "ไม่เสี่ยง", show: (_l, c) => c.mid === "cave", run: () => meh("คุณจดจำตำแหน่งถ้ำไว้ในใจ", "boss") },
      ],
    },
    boss: {
      title: "เผชิญหน้า",
      text: (l, c) => `【${boss(c)}】ปรากฏตัว! พลังระดับ${rankLabel(l, R(c))} แผ่กระจายจนใบไม้รอบตัวปลิวว่อน`,
      choices: [
        {
          label: "ประลองฝีมือเต็มกำลัง",
          tone: "danger",
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06),
          run: (l, c, ok) => {
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              addFame(l, R(c) >= 4 ? 5 : 2);
              return { text: `⚔️ ${boss(c)}ล้มลงด้วยกระบวนท่าสุดท้ายของคุณ! ${r}`, kind: "good" };
            }
            if (!chance(l, survivalOdds(l, R(c), Number(c.score) * 0.06))) {
              kill(l, `พ่ายแพ้ต่อ${boss(c)}`);
              return bad(`กระบวนท่าของ${boss(c)}เร็วกว่าที่ตาคุณจะมองทัน…`);
            }
            return bad("คุณพ่ายแพ้ แต่หนีออกมาได้ด้วยวิชาตัวเบา" + hurt(l, R(c), 15, 30));
          },
        },
        {
          label: (l) => `กลืน「${l.power?.items[0] ?? ""}」แล้วสู้`,
          tone: "special",
          show: (l) => (l.power?.items.length ?? 0) > 0,
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06 + 0.25),
          run: (l, c, ok) => {
            const item = l.power!.items.shift();
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              return { text: `⚔️ พลังจาก「${item}」พลุ่งพล่าน! ${boss(c)}ล้มลง ${r}`, kind: "good" };
            }
            return bad(`แม้แต่「${item}」ก็ไม่พอ คุณถอยหนีมาได้หวุดหวิด` + hurt(l, R(c), 10, 20));
          },
        },
        {
          label: "ถอยไปก่อน รอวันแก้มือ",
          run: (l, c) => meh(`คุณถอยออกมา — ${gateRewards(l, R(c), Number(c.share) * 0.3, false)}`),
        },
      ],
    },
  },
};

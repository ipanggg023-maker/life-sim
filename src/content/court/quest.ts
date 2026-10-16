import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill, runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addStat, checkChance, clamp } from "../../engine/util";
import { fightOdds, gateRewards, rankLabel, rankUp, survivalOdds } from "../hunter/power";

const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
const meh = (text: string, next?: string): Outcome => ({ text, next });

export const COURT_QUESTS = [
  { name: "ปราบฝูงมอนสเตอร์ที่ชายแดนเหนือ", desc: "หิมะยังไม่ทันละลาย ฝูงหมาป่าน้ำแข็งก็บุกหมู่บ้านชายแดนอีกแล้ว", bosses: ["ราชาหมาป่าน้ำแข็ง", "ยักษ์หิมะตาเดียว", "ไวเวิร์นแห่งหุบเขาขาว"] },
  { name: "สืบคดีวางยาพิษในงานเลี้ยง", desc: "เคานต์คนหนึ่งล้มลงกลางงานเลี้ยงของมาร์ควิส คนร้ายยังอยู่ในคฤหาสน์", bosses: ["พ่อบ้านผู้เป็นนักฆ่า", "บารอนเนสผู้ปรุงยาพิษ", "นักฆ่าจากสมาคมเงา"] },
  { name: "คุ้มกันองค์หญิงข้ามเขาแดนศัตรู", desc: "ขบวนรถม้าหลวงต้องผ่านป่าที่ข่าวว่ามีกลุ่มกบฏซุ่มอยู่", bosses: ["หัวหน้ากบฏหน้ากากเงิน", "อัศวินทรยศแห่งราชวงศ์เก่า", "จอมเวทรับจ้างตาเดียว"] },
  { name: "ปิดประตูมิติปีศาจในป่าต้องสาป", desc: "รอยแยกสีม่วงเปิดขึ้นกลางป่า ปีศาจระดับล่างไหลออกมาไม่หยุด", bosses: ["อัศวินปีศาจเขาแพะ", "ซัคคิวบัสแห่งความฝัน", "ผู้คุมประตูนรก"] },
  { name: "ล่าแม่มดแห่งหนองน้ำดำ", desc: "เด็กในหมู่บ้านหายไปเจ็ดคน ทุกคนชี้ไปที่กระท่อมกลางหนองน้ำ", bosses: ["แม่มดหนองน้ำดำ", "ตุ๊กตาต้องสาปยักษ์", "ภูตหนองน้ำคลั่ง"] },
] as const;

const MIDS = ["ambush", "treasure", "victim", "ambush", "treasure", "ruin"] as const;
const R = (c: Ctx) => Number(c.rank);
const boss = (c: Ctx) => String(c.b);

function hurt(l: Life, qRank: number, min: number, max: number): string {
  const gap = Math.max(0, qRank - (l.power?.rank ?? 0));
  const dmg = Math.round(randInt(l, min, max) * (1 + gap * 0.5));
  addStat(l, "health", -dmg);
  if (l.stats.health <= 0) {
    kill(l, `บาดเจ็บสาหัสระหว่างภารกิจราชสำนักระดับ${rankLabel(l, qRank)}`);
    return " บาดแผลสาหัสเกินกว่าจะรอด…";
  }
  return ` (สุขภาพ -${dmg})`;
}

export function startCourtQuest(life: Life, qRank: number) {
  const t = randInt(life, 0, COURT_QUESTS.length - 1);
  runEvent(life, "court.quest", {
    rank: qRank,
    t,
    b: pick(life, COURT_QUESTS[t].bosses),
    mid: !life.flags.ancientRuin && chance(life, 0.015) ? "ruin" : pick(life, MIDS.slice(0, 5)),
    score: 0,
    share: 1,
  });
}

export const COURT_QUEST: GameEvent = {
  id: "court.quest",
  minAge: 0,
  maxAge: 200,
  manual: true,
  maxTimes: 0,
  title: "ภารกิจราชสำนัก",
  text: (l, c) => {
    const q = COURT_QUESTS[Number(c.t)];
    return `ภารกิจระดับ${rankLabel(l, R(c))}:【${q.name}】— ${q.desc}`;
  },
  choices: [
    {
      label: "นำทัพบุกตรงไปข้างหน้า",
      odds: (l, c) => fightOdds(l, R(c)),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("ศัตรูแตกกระเจิงต่อหน้าคุณ ทหารที่ตามมาโห่ร้องเรียกชื่อคุณ", "mid"); }
        return bad("ศัตรูมากกว่าที่รายงานไว้ คุณต้องถอยตั้งหลักพร้อมบาดแผล" + hurt(l, R(c), 6, 14), "mid");
      },
    },
    {
      label: "ใช้เวทพรางตัวลอบเข้าไป",
      odds: (l, c) => clamp(checkChance(l, "luck", 45) + (l.power?.hunterClass === "c_spirit" ? 0.2 : 0) - Math.max(0, R(c) - (l.power?.rank ?? 0)) * 0.1, 0.05, 0.95),
      run: (l, c, ok) => {
        if (ok) { c.score = Number(c.score) + 1; return good("ภูตลมพาคุณผ่านยามไปโดยไม่มีใครรู้ตัว", "mid"); }
        return bad("เวทพรางตัวสลายกลางทาง!" + hurt(l, R(c), 4, 10), "mid");
      },
    },
    {
      label: "รอกองหนุนแล้วบุกพร้อมกัน (ปลอดภัยแต่ต้องแบ่งความดีความชอบ)",
      run: (_l, c) => { c.share = 0.5; return meh("อัศวินอีกสองหน่วยมาสมทบ ความดีความชอบต้องแบ่งกันไป", "mid"); },
    },
  ],
  scenes: {
    mid: {
      text: (_l, c) =>
        ({
          ambush: "ลูกธนูอาบเวทพุ่งมาจากแนวไม้! มีพลธนูซุ่มอยู่",
          treasure: "ในห้องใต้ดินมีหีบที่สลักตราราชวงศ์เก่า… มีวงเวทเรืองแสงจางๆ บนฝา",
          victim: "เด็กชาวบ้านคนหนึ่งติดอยู่ใต้ซากบ้านที่พังลงมา",
          ruin: "พื้นทรุดตัวลงเผยให้เห็นซากวิหารโบราณ กลางห้องมีแท่นหินที่วงเวทยังหมุนอยู่ราวกับรอคุณมานับพันปี",
        })[String(c.mid)] ?? "",
      choices: [
        {
          label: "ร่ายโล่เวทรับลูกธนู",
          show: (_l, c) => c.mid === "ambush",
          odds: (l, c) => fightOdds(l, R(c), 0.15),
          run: (l, c, ok) => (ok ? good("โล่เวทสะท้อนลูกธนูกลับไปทั้งหมด", "boss") : bad("ลูกธนูดอกหนึ่งทะลุโล่เข้ามาปักไหล่" + hurt(l, R(c), 6, 12), "boss")),
        },
        {
          label: "ใช้พลังศักดิ์สิทธิ์รักษาตัวเองระหว่างสู้",
          tone: "special",
          show: (l, c) => c.mid === "ambush" && l.power?.hunterClass === "c_holy",
          run: () => good("แสงสีทองปิดแผลทุกแผลในพริบตา พลธนูถอยหนีด้วยความหวาดกลัว", "boss"),
        },
        {
          label: "คลายวงเวทแล้วเปิดหีบ",
          show: (_l, c) => c.mid === "treasure",
          check: { stat: "smarts", dc: 50 },
          run: (l, c, ok) => {
            if (ok) {
              const item = pick(l, ["ยาฟื้นมานาชั้นสูง", "คทาเวทโบราณ", "จี้ป้องกันคำสาป", "ศิลาเวทวงที่ 7"]);
              l.power?.items.push(item);
              return good(`วงเวทคลายออก ข้างในมี「${item}」`, "boss");
            }
            return bad("วงเวทระเบิดใส่หน้าคุณ!" + hurt(l, R(c), 6, 12), "boss");
          },
        },
        { label: "ไม่แตะ ไปต่อ", show: (_l, c) => c.mid === "treasure", run: () => meh("คุณจดตำแหน่งไว้ให้ทีมสำรวจมาเก็บทีหลัง", "boss") },
        {
          label: "ยกซากบ้านช่วยเด็ก",
          show: (_l, c) => c.mid === "victim",
          run: (l, c) => { addFame(l, 3); addStat(l, "happiness", 4); c.score = Number(c.score) - 1; return good("แม่ของเด็กคุกเข่าร้องไห้ขอบคุณ ข่าวความใจดีของคุณไปถึงนครหลวง", "boss"); },
        },
        { label: "ภารกิจต้องมาก่อน", show: (_l, c) => c.mid === "victim", run: (l) => { addStat(l, "happiness", -6); return meh("เสียงร้องไห้ยังดังอยู่ในหัวคุณอีกนาน", "boss"); } },
        {
          label: "ก้าวเข้าไปในวงเวทโบราณ",
          tone: "danger",
          show: (_l, c) => c.mid === "ruin",
          survival: (l) => clamp(0.5 + (l.stats.smarts - 50) / 120, 0.2, 0.95),
          odds: (l) => clamp(0.5 + (l.stats.smarts - 50) / 120, 0.2, 0.95),
          run: (l, _c, ok) => {
            l.flags.ancientRuin = true;
            if (!ok) {
              addStat(l, "health", -40);
              if (l.stats.health <= 0) { kill(l, "ถูกวงเวทโบราณกลืนกิน"); return bad("วงเวทหมุนเร็วขึ้นจนร่างคุณสลายเป็นละอองแสง…"); }
              return bad("วงเวทปฏิเสธคุณ แรงกระแทกโยนคุณกระเด็นออกมา", "boss");
            }
            rankUp(l, "ได้รับการยอมรับจากวงเวทของจอมเวทในตำนาน");
            return { text: "เสียงหนึ่งดังขึ้นในหัว \"ในที่สุดก็มีคนมาถึง\" — ความรู้เวทนับพันปีไหลเข้าสู่ร่างคุณ", kind: "milestone", next: "boss" };
          },
        },
        { label: "ไม่เสี่ยง", show: (_l, c) => c.mid === "ruin", run: () => meh("คุณปิดปากซากวิหารไว้แล้วรายงานหอคอยเวท", "boss") },
      ],
    },
    boss: {
      title: "เผชิญหน้า",
      text: (l, c) => `【${boss(c)}】ปรากฏตัว! พลังระดับ${rankLabel(l, R(c))} แผ่ไปทั่วบริเวณจนกระจกหน้าต่างแตกร้าว`,
      choices: [
        {
          label: "ปลดปล่อยพลังทั้งหมด",
          tone: "danger",
          odds: (l, c) => fightOdds(l, R(c), Number(c.score) * 0.06),
          survival: (l, c) => survivalOdds(l, R(c), Number(c.score) * 0.06),
          run: (l, c, ok) => {
            if (ok) {
              const r = gateRewards(l, R(c), Number(c.share), true);
              addFame(l, R(c) >= 4 ? 5 : 2);
              return { text: `✨ ${boss(c)}ล้มลง! จักรพรรดิส่งสาส์นชมเชยมาด้วยพระองค์เอง ${r}`, kind: "good" };
            }
            if (!chance(l, survivalOdds(l, R(c), Number(c.score) * 0.06))) {
              kill(l, `พ่ายแพ้ต่อ${boss(c)}`);
              return bad(`${boss(c)}ยิ้มเย็นชา… นั่นคือภาพสุดท้ายที่คุณเห็น`);
            }
            return bad("คุณพ่ายแพ้ แต่อัศวินคนสนิทลากคุณออกมาได้ทันเวลา" + hurt(l, R(c), 15, 30));
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
              return { text: `✨ พลังจาก「${item}」พลิกสถานการณ์! ${boss(c)}ล้มลง ${r}`, kind: "good" };
            }
            return bad(`แม้แต่「${item}」ก็ไม่พอ คุณถอยหนีมาได้หวุดหวิด` + hurt(l, R(c), 10, 20));
          },
        },
        {
          label: "ถอยทัพ รายงานกลับนครหลวง",
          run: (l, c) => meh(`คุณถอยทัพอย่างมีระเบียบ — ${gateRewards(l, R(c), Number(c.share) * 0.3, false)}`),
        },
      ],
    },
  },
};

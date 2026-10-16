// วิญญาณข้ามโลก: ความทรงจำจากชาติก่อนในโลกอื่นค่อยๆ กลับมา
// อดีต Hunter ในยุทธภพ · อดีตจอมยุทธ์ในราชสำนัก ฯลฯ
import type { GameEvent } from "../../engine/events";
import { randInt } from "../../engine/rng";
import type { Life, WorldId } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, money } from "../../engine/util";
import { gainExp, markTurn, rankLabel } from "../hunter/power";
import { worldOf } from "../worlds";

const pastWorld = (l: Life) => l.flags.pastWorld as WorldId | undefined;

/** ตัวตนชาติก่อนในแต่ละโลก */
const WHO: Record<WorldId, string> = {
  hunter: "นักล่าในโลกที่มีประตูมิติเปิดอยู่ทั่วเมือง",
  tower: "ผู้ท้าชิงที่ปีนหอคอยไม่มีที่สิ้นสุด",
  murim: "จอมยุทธ์ในยุทธภพ",
  court: "ขุนนางในจักรวรรดิที่มีวงเวท",
};

/** ภาพในความฝันจากโลกเก่า */
const DREAM: Record<WorldId, string> = {
  hunter: "ตึกสูงเสียดฟ้า รถไฟใต้ดิน และประตูสีฟ้าที่มีมอนสเตอร์เดินออกมา",
  tower: "หอคอยสีดำที่สูงจนมองไม่เห็นยอด ชั้นที่มีทะเลอยู่ข้างใน และเสียงประกาศของผู้ดูแลชั้น",
  murim: "ยอดเขาหิมะ เสียงกระบี่กระทบกัน และกลิ่นสุราในโรงเตี๊ยม",
  court: "ห้องบอลรูมแสงเทียน ชุดราตรีลากพื้น และเสียงกระซิบวางแผนหลังพัด",
};

const pastRank = (l: Life) => (l.flags.pastRank === undefined ? undefined : Number(l.flags.pastRank));

export const PAST_LIFE_EVENTS: GameEvent[] = [
  {
    id: "past.dream",
    minAge: 4,
    maxAge: 10,
    weight: 40,
    when: (l) => !!pastWorld(l),
    title: "ความฝันจากต่างโลก",
    text: (l) =>
      `คุณฝันเห็น${DREAM[pastWorld(l)!]}ซ้ำๆ ทุกคืน… ในฝัน มีคนเรียกคุณว่า "${l.flags.pastName}" — ${WHO[pastWorld(l)!]}`,
    choices: [
      {
        label: "ตั้งใจจำทุกอย่างไว้",
        run: (l) => {
          l.flags.pastRemembered = true;
          const w = pastWorld(l)!;
          if (w === "hunter") addStat(l, "smarts", 6);
          else if (w === "murim") addStat(l, "health", 6);
          else {
            addStat(l, "looks", 3);
            addStat(l, "smarts", 3);
          }
          const r = pastRank(l);
          const extra = r !== undefined ? ` — ชาติก่อนคุณเคยไปถึง【${rankLabel({ worldId: w }, r)}】` : "";
          return { text: `ความทรงจำชาติก่อนกลับมาเป็นชิ้นๆ คุณคือ${l.flags.pastName}${extra}`, kind: "system" };
        },
      },
      {
        label: "ปล่อยให้เป็นแค่ความฝัน",
        run: (l) => {
          addStat(l, "happiness", 3);
          return { text: "ภาพเหล่านั้นค่อยๆ จางไป เหลือแค่ความรู้สึกคิดถึงที่ไม่รู้ที่มา" };
        },
      },
    ],
  },
  {
    id: "past.skill",
    minAge: 8,
    maxAge: 70,
    weight: 25,
    when: (l) => !!l.flags.pastRemembered && !!l.flags.pastSkill && !!l.power && !l.power.skills.includes(String(l.flags.pastSkill)),
    title: "วิชาจากต่างโลก",
    system: true,
    text: (l) =>
      `[ระบบ] ตรวจพบวิชาที่ไม่มีอยู่ในโลกนี้ —「${l.flags.pastSkill}」จากชาติที่คุณเป็น${WHO[pastWorld(l)!]} ร่างกายนี้ยังจำการเคลื่อนไหวนั้นได้`,
    choices: [
      {
        label: "ฝึกวิชาจากชาติก่อน",
        run: (l) => {
          const s = String(l.flags.pastSkill);
          l.power!.skills.push(s);
          gainExp(l, 500);
          markTurn(l);
          return { text: `คุณได้สกิล「${s}」จากชาติก่อน — วิชาที่ทั้ง${worldOf(l.worldId).name}ไม่มีใครรู้จัก`, kind: "milestone" };
        },
      },
    ],
  },
  {
    id: "past.knowledge",
    minAge: 16,
    maxAge: 45,
    weight: 14,
    when: (l) => !!l.flags.pastRemembered,
    title: "ความรู้จากชาติก่อน",
    text: (l) => {
      const w = pastWorld(l)!;
      if (w === "hunter") return `คุณนึกออกว่าในโลกเก่ามีของที่โลกนี้ยังไม่มี — สบู่หอม ร่ม ซอสปรุงรส… ถ้าทำขายตอนนี้ล่ะ?`;
      if (w === "murim") return `ท่าลมปราณจากชาติก่อนยังติดอยู่ในร่างกาย คุณเริ่มฝึกหายใจแบบจอมยุทธ์ทุกเช้าโดยไม่รู้ตัว`;
      return `คุณอ่านเกมการเมืองรอบตัวออกหมด — มารยาท การวางตัว การพูดสองแง่สองง่าม ทั้งหมดคือสิ่งที่คุณเคยใช้เอาตัวรอดในราชสำนัก`;
    },
    choices: [
      {
        label: "ใช้ความรู้นั้นเต็มที่",
        check: { stat: "smarts", dc: 45 },
        run: (l, _c, ok) => {
          const w = pastWorld(l)!;
          if (!ok) {
            addStat(l, "happiness", -4);
            return { text: "ความรู้จากโลกเก่าใช้กับโลกนี้ได้ไม่ตรงทั้งหมด รอบนี้พลาดไปก่อน", kind: "bad" };
          }
          markTurn(l);
          if (w === "hunter") {
            const cash = Math.round(randInt(l, 8, 20) * 100_000 * (1 + clamp(l.stats.luck, 0, 100) / 100));
            addMoney(l, cash);
            addFame(l, 5);
            return { text: `สินค้าจากโลกเก่าขายดีเป็นเทน้ำเทท่า ได้กำไร ${money(l, cash)}`, kind: "good" };
          }
          if (w === "murim") {
            addStat(l, "health", 8);
            if (l.power) gainExp(l, 700);
            return { text: "ลมปราณจากชาติก่อนไหลเวียนในร่างใหม่ ร่างกายแข็งแรงขึ้นอย่างเห็นได้ชัด", kind: "good" };
          }
          addFame(l, 8);
          addStat(l, "looks", 3);
          if (l.job) l.job.performance = clamp(l.job.performance + 15, 0, 100);
          return { text: "คุณเอาตัวรอดในวงสังคมได้อย่างสง่างาม ผู้ใหญ่เริ่มจับตามอง", kind: "good" };
        },
      },
      {
        label: "เก็บไว้เป็นความลับ",
        run: () => ({ text: "บางเรื่องจากชาติก่อน… ไม่ควรมีใครรู้ คุณเลือกใช้ชีวิตแบบคนธรรมดาในโลกนี้" }),
      },
    ],
  },
];

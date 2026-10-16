// กิจกรรมที่แทน Focus เดิม: ผู้เล่นกดเองทีละปี
import { ACTIVITIES } from "../../engine/activities";
import { randInt } from "../../engine/rng";
import type { WorldId } from "../../engine/types";
import { addMoney, addStat, money } from "../../engine/util";

const SIDE_JOB: Record<WorldId, string[]> = {
  hunter: ["รับจ้างส่งอาหารตอนกลางคืน", "ขายของออนไลน์", "รับสอนพิเศษ", "เป็นลูกหาบให้ทีม Hunter"],
  murim: ["รับจ้างแบกของที่ท่าเรือ", "ช่วยเถ้าแก่โรงเตี๊ยม", "คัดลอกคัมภีร์ขาย", "ขุดสมุนไพรบนเขาไปขาย"],
  court: ["รับจ้างคัดลายมือจดหมาย", "ช่วยงานร้านขนมปัง", "รับงานเย็บผ้า", "ส่งของให้สมาคมพ่อค้า"],
};

const REST: Record<WorldId, string> = {
  hunter: "คุณลางานไปนอนตื่นสายทั้งอาทิตย์ ปิดมือถือ ดูซีรีส์จนหมดเรื่อง",
  murim: "คุณไปพักที่วัดบนเขา นั่งฟังเสียงลมผ่านป่าไผ่ทุกเช้า",
  court: "คุณไปพักตากอากาศที่บ้านริมทะเลสาบ อ่านนิยายรักใต้ร่มไม้",
};

for (const world of ["hunter", "murim", "court"] as WorldId[]) {
  ACTIVITIES.push(
    {
      id: `${world}_sidejob`,
      emoji: "💼",
      name: "หางานพิเศษ",
      desc: "ได้เงิน แต่เหนื่อย",
      minAge: 15,
      world,
      run: (l) => {
        const job = SIDE_JOB[world][randInt(l, 0, SIDE_JOB[world].length - 1)];
        const pay = Math.round(randInt(l, 15, 40) * 1000 * (1 + l.stats.luck / 100));
        addMoney(l, pay);
        addStat(l, "health", -1);
        addStat(l, "happiness", -2);
        return { text: `คุณ${job} ได้เงินเพิ่ม ${money(l, pay)}`, kind: "good" };
      },
    },
    {
      id: `${world}_rest`,
      emoji: "😌",
      name: "พักผ่อน",
      desc: "สุขภาพ + ความสุข +",
      minAge: 6,
      world,
      run: (l) => {
        addStat(l, "health", randInt(l, 1, 3));
        addStat(l, "happiness", randInt(l, 3, 6));
        return { text: REST[world], kind: "good" };
      },
    },
  );
}

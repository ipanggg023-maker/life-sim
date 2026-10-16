// ปาร์ตี้เพื่อนร่วมทีม: มีชื่อ มีบุคลิก โตไปด้วยกัน อาจตาย ทรยศ หรือกลายเป็นคนรัก
import type { Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person, WorldId } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, people, randomName, shortName } from "../../engine/util";
import { fightOdds, gainExp, partySize } from "../hunter/power";
import { worldOf } from "../worlds";

const good = (text: string): Outcome => ({ text, kind: "good" });
const bad = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string): Outcome => ({ text });

const W = <T>(l: Life, t: Record<WorldId, T>): T => t[l.worldId ?? "hunter"];
const allies = (l: Life) => people(l, "ally");
const questing = (l: Life) => !!l.power && worldOf(l.worldId).questJobs.includes(l.job?.careerId ?? "");
const byId = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.id && p.alive);

/** บุคลิก + บทบาทของเพื่อนร่วมทีม (เก็บใน Person.job) */
const ARCHETYPES: Record<WorldId, string[]> = {
  hunter: ["ฮีลเลอร์ขี้อายที่พกขนมตลอด", "แทงก์ปากเสียแต่ใจดี", "นักเวทอัจฉริยะที่ไม่เคยหลับ", "นักลอบสังหารเงียบขรึมที่ชอบแมว", "นักธนูที่เคยอยู่กิลด์ใหญ่"],
  tower: ["ผู้ถือโคมขี้กลัวที่จำแผนที่ได้ทุกชั้น", "หัวหอกพูดน้อยที่เคยติดชั้นเดิมห้าปี", "ลูกตระกูลชั้นบนที่หนีออกจากบ้าน", "มือขว้างหอกจอมโวยวาย", "สาวหน่วยสอดแนมที่ยิ้มตลอดเวลา"],
  murim: ["ศิษย์น้องขี้แยที่ฝีมือดาบไม่ธรรมดา", "จอมยุทธ์พเนจรขี้เมาที่ซ่อนวิชาไว้", "หมอยาสาวปากร้าย", "ขอทานหนุ่มจากพรรคกระยาจก", "มือสังหารที่ล้างมือในอ่างทองคำแล้ว"],
  court: ["อัศวินหนุ่มผู้ภักดีจนน่ารำคาญ", "นักเวทน้ำแข็งที่ยิ้มยาก", "นักบวชฝึกหัดซุ่มซ่าม", "นักผจญภัยผมแดงเสียงดัง", "สาวใช้ที่จริงๆ เป็นนักฆ่า"],
};

export const PARTY_EVENTS: GameEvent[] = [
  {
    id: "party.recruit",
    minAge: 12,
    maxAge: 70,
    maxTimes: 4,
    weight: (l) => (questing(l) && partySize(l) < 3 ? 12 : 0),
    title: "เพื่อนร่วมทีมคนใหม่",
    // ยังไม่สร้างคนจริงจนกว่าผู้เล่นจะตอบรับ — เก็บแค่ชื่อและบุคลิกไว้ใน ctx
    prepare: (l) => {
      const g = chance(l, 0.5) ? "m" : "f";
      const n = randomName(l, g);
      const full = l.worldId === "murim" ? `${n.last}${n.first}` : l.worldId === "court" ? `${n.first} ${n.last}` : `${n.first} (${n.nick}) ${n.last}`;
      const name = worldOf(l.worldId).modern ? n.nick : full;
      return { g, full, name, arch: pick(l, ARCHETYPES[l.worldId ?? "hunter"]) };
    },
    text: (l, c) =>
      W(l, {
        hunter: `หลังภารกิจ ${c.name} ${c.arch} เดินมาหาคุณ "ทีมคุณยังขาดคนไหม? ผมสู้ได้นะ… มั้ง"`,
        tower: `หลังผ่านบททดสอบ ${c.name} ${c.arch} เดินมาหาคุณ "ทีมคุณยังขาดคนไหม? ชั้นหน้าต้องใช้ห้าคนขึ้นไป"`,
        murim: `${c.name} ${c.arch} นั่งลงที่โต๊ะคุณในโรงเตี๊ยมโดยไม่ได้รับเชิญ "ข้าดูท่ากระบี่ของเจ้ามาสามวันแล้ว ให้ข้าร่วมทางด้วย"`,
        court: `${c.name} ${c.arch} คุกเข่าลงต่อหน้าคุณ "ได้โปรดให้กระหม่อมติดตามท่าน"`,
      }),
    choices: [
      {
        label: "รับเข้าทีม",
        run: (l, c) => {
          const p = createPerson(l, "ally", { gender: c.g as "m" | "f", age: l.age + randInt(l, -4, 6), bond: 45, job: String(c.arch) });
          p.name = String(c.full);
          addStat(l, "happiness", 4);
          return good(`${c.name}เข้าร่วมทีม — ทีมคุณมี ${partySize(l)} คนแล้ว (พลังต่อสู้และอัตรารอดเพิ่มขึ้น)`);
        },
      },
      {
        label: "ปฏิเสธ ขอเดินคนเดียว",
        run: () => meh("ตัวเอกที่เดินคนเดียวก็เท่ดี… แต่บางทีก็เหงาเหมือนกัน"),
      },
    ],
  },
  {
    id: "party.campfire",
    minAge: 12,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => (allies(l).length ? 6 : 0),
    prepare: (l) => {
      const p = pick(l, allies(l));
      return { id: p.id, name: shortName(p) };
    },
    text: (l, c) =>
      W(l, {
        hunter: `คืนหนึ่งหลังเคลียร์ Gate ${c.name}นั่งข้างกองไฟแล้วเล่าเรื่องครอบครัวที่ตายใน Gate Break ให้ฟังเป็นครั้งแรก`,
        tower: `ในห้องพักชั้นปลอดภัย ${c.name}มองวิวเมืองของหอคอยแล้วเล่าเรื่องน้องสาวที่รออยู่บนโลกให้ฟังเป็นครั้งแรก`,
        murim: `ใต้แสงจันทร์ริมแม่น้ำ ${c.name}ยื่นจอกสุรามาให้ "เจ้าเป็นคนแรกที่ข้าไว้ใจ"`,
        court: `ระหว่างพักทัพ ${c.name}ถอดถุงมือออกแล้วพูดเบาๆ "ท่านรู้ไหม… ข้าไม่เคยมีใครให้ปกป้องมาก่อน"`,
      }),
    choices: [
      {
        label: "รับฟังอย่างตั้งใจ",
        run: (l, c) => {
          const p = byId(l, c);
          if (p) p.bond = clamp(p.bond + randInt(l, 10, 18), 0, 100);
          addStat(l, "happiness", 3);
          return good(`คุณกับ${c.name}สนิทกันมากขึ้น`);
        },
      },
      {
        label: "เปลี่ยนเรื่องคุยเป็นเรื่องตลก",
        run: (l, c) => {
          const p = byId(l, c);
          if (p) p.bond = clamp(p.bond + 4, 0, 100);
          return meh(`${c.name}หัวเราะจนน้ำตาไหล — อาจจะไม่ได้หัวเราะเพราะมุกอย่างเดียว`);
        },
      },
    ],
  },
  {
    id: "party.romance",
    minAge: 16,
    maxAge: 60,
    maxTimes: 1,
    weight: (l) => (allies(l).some((p) => p.bond >= 70 && p.gender !== l.gender) && !people(l, "partner").length && !people(l, "spouse").length ? 10 : 0),
    title: "หัวใจในสนามรบ",
    prepare: (l) => {
      const p = pick(l, allies(l).filter((x) => x.bond >= 70 && x.gender !== l.gender));
      return { id: p.id, name: shortName(p) };
    },
    text: (_l, c) => `หลังการต่อสู้ครั้งใหญ่ ${c.name}จับมือคุณแน่นกว่าทุกครั้ง แล้วไม่ยอมปล่อย`,
    choices: [
      {
        label: "จับมือตอบ",
        run: (l, c) => {
          const p = byId(l, c);
          if (p) {
            p.relation = "partner";
            p.bond = 85;
          }
          addStat(l, "happiness", 15);
          return { text: `💕 จากเพื่อนร่วมทีม ${c.name}กลายเป็นคนรักของคุณ`, kind: "milestone" };
        },
      },
      { label: "ค่อยๆ ดึงมือออก", run: (l, c) => { const p = byId(l, c); if (p) p.bond = clamp(p.bond - 10, 0, 100); return meh("บรรยากาศอึดอัดไปหลายวัน"); } },
    ],
  },
  {
    id: "party.sacrifice",
    minAge: 12,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (allies(l).length && questing(l) ? 3 : 0),
    title: "การเสียสละ",
    prepare: (l) => {
      const p = pick(l, allies(l));
      return { id: p.id, name: shortName(p) };
    },
    text: (_l, c) => `ศัตรูจู่โจมจากจุดบอดของคุณ — ${c.name}กระโดดเข้ามารับการโจมตีแทน`,
    choices: [
      {
        label: "ระเบิดพลังทั้งหมดเพื่อช่วย",
        tone: "danger",
        odds: (l) => fightOdds(l, Math.max(0, (l.power?.rank ?? 0) + 1)),
        run: (l, c, ok) => {
          const p = byId(l, c);
          if (ok) {
            if (p) p.bond = 100;
            gainExp(l, 600);
            return { text: `พลังที่ไม่เคยมีพุ่งออกมา คุณกวาดศัตรูทั้งหมดก่อนคมอาวุธจะถึงตัว${c.name}`, kind: "milestone" };
          }
          if (p) p.alive = false;
          l.flags.lossAge = l.age;
          addStat(l, "happiness", -25);
          return bad(`${c.name}ยิ้มให้คุณเป็นครั้งสุดท้าย… "อย่าร้องไห้สิ หัวหน้า"`);
        },
      },
    ],
  },
  {
    id: "party.betrayal",
    minAge: 14,
    maxAge: 80,
    maxTimes: 1,
    weight: (l) => (allies(l).some((p) => p.bond < 30) ? 8 : 0),
    title: "มีดข้างหลัง",
    prepare: (l) => {
      const p = pick(l, allies(l).filter((x) => x.bond < 30));
      return { id: p.id, name: shortName(p) };
    },
    text: (_l, c) => `คุณตื่นมากลางดึก เห็น${c.name}กำลังค้นกระเป๋าของคุณ… มือถือมีดสั้นไว้อีกข้าง`,
    choices: [
      {
        label: "จับกุมทันที",
        odds: (l) => clamp(0.6 + (l.stats.health - 50) / 150, 0.2, 0.95),
        run: (l, c, ok) => {
          l.people = l.people.filter((x) => x.id !== c.id);
          if (ok) { addFame(l, 3); return good(`คุณบิดข้อมือ${c.name}จนมีดหล่น — รู้ทีหลังว่าคู่แข่งของคุณจ้างมา`); }
          addMoney(l, -Math.round(Math.max(0, l.money) * 0.2));
          addStat(l, "health", -15);
          if (l.stats.health <= 0) { kill(l, `ถูก${c.name}เพื่อนร่วมทีมหักหลัง`); return bad("คมมีดเร็วกว่าที่คิด…"); }
          return bad(`${c.name}แทงคุณแล้วหนีไปพร้อมเงินส่วนหนึ่ง`);
        },
      },
      {
        label: "แกล้งหลับ แล้วดูว่าจะทำอะไร",
        check: { stat: "smarts", dc: 55 },
        run: (l, c, ok) => {
          const p = byId(l, c);
          if (ok && p) { p.bond = 60; return good(`${c.name}แค่หายาให้คุณตอนเห็นคุณไข้ขึ้น… มีดมีไว้ตัดผ้าพันแผล คุณเกือบเข้าใจผิดแล้ว`); }
          l.people = l.people.filter((x) => x.id !== c.id);
          addMoney(l, -Math.round(Math.max(0, l.money) * 0.3));
          return bad(`${c.name}หายไปพร้อมเงินและไอเทมของคุณ`);
        },
      },
    ],
  },
  {
    id: "party.growth",
    minAge: 14,
    maxAge: 80,
    maxTimes: 0,
    weight: (l) => (allies(l).some((p) => p.bond >= 60) ? 4 : 0),
    prepare: (l) => {
      const p: Person = pick(l, allies(l).filter((x) => x.bond >= 60));
      return { id: p.id, name: shortName(p) };
    },
    text: (l, c) =>
      W(l, {
        hunter: `${c.name}ตื่นพลังครั้งที่สองระหว่างฝึกกับคุณ! แรงก์สูงขึ้นหนึ่งขั้น ทีมของคุณแข็งแกร่งขึ้นอีก`,
        tower: `${c.name}ปลดล็อกพลังหอคอยขั้นใหม่ระหว่างซ้อมกับคุณ "ชั้นหน้า… ฉันจะเป็นคนปกป้องนายบ้าง"`,
        murim: `${c.name}ทะลวงคอขวดได้หลังซ้อมประลองกับคุณทั้งคืน "ทั้งหมดนี้เพราะเจ้า"`,
        court: `${c.name}ปลดล็อกวงเวทใหม่ระหว่างภารกิจ แล้วหันมายิ้มให้คุณอย่างภูมิใจ`,
      }),
    auto: (l, c) => {
      const p = byId(l, c);
      if (p) p.bond = clamp(p.bond + 5, 0, 100);
      gainExp(l, 200);
      return "good";
    },
  },
];

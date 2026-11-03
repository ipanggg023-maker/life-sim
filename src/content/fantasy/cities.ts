// เมืองของแต่ละแผ่นดิน: เมืองหลวง เมืองท่า เมืองภูเขา ป้อมชายแดน เกาะเวท หมู่บ้านในป่า
// เมืองที่อยู่เปลี่ยนงานที่รุ่ง ค่าครองชีพ สิ่งที่ทำได้ เทศกาล และเรื่องที่เกิดขึ้น
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, StatKey } from "../../engine/types";
import { addMoney, addStat, createPerson, shortName } from "../../engine/util";
import { CAREERS } from "../core/careers";
import { BIG, C, E, G, GOLD, K, N, P, PAY, SCENE, type Fx } from "./kit";
import { fightOdds } from "./power";
import { addStanding, fl, homeKingdom, type Kingdom } from "./state";
import { MYSTERIES } from "./mysteries";

export type CityKind = "capital" | "port" | "mountain" | "frontier" | "arcane" | "forest";
export interface City { id: string; name: string; kind: CityKind; desc: string; festival: [name: string, text: string] }

export const KINDS: Record<CityKind, { name: string; jobs: string[]; cost: number; perk: string }> = {
  capital: { name: "เมืองหลวง", jobs: ["ft_courtier", "ft_diplomat", "ft_knight", "ft_chef", "ft_bard"], cost: 1.2, perk: "งานในราชสำนักรุ่ง ของแพง" },
  port: { name: "เมืองท่า", jobs: ["ft_sailor", "ft_merchant", "ft_inn", "ft_thief"], cost: 1, perk: "การค้าและท้องทะเล" },
  mountain: { name: "เมืองภูเขา", jobs: ["ft_miner", "ft_smith", "ft_enchanter"], cost: 0.9, perk: "เหมืองแร่และเตาหลอม" },
  frontier: { name: "ป้อมชายแดน", jobs: ["ft_soldier", "ft_ranger", "ft_gladiator", "ft_tamer"], cost: 0.85, perk: "ทหารและนักล่ามีงานเสมอ" },
  arcane: { name: "เมืองเวท", jobs: ["ft_mage", "ft_alchemist", "ft_wandwright", "ft_scholar"], cost: 1.1, perk: "หอสมุดและหอเวท" },
  forest: { name: "หมู่บ้านป่า", jobs: ["ft_ranger", "ft_tamer", "ft_farmer", "ft_priest", "ft_cartographer"], cost: 0.75, perk: "ชีวิตสงบ ของถูก" },
};
/** งานที่ตรงกับเมืองได้ค่าจ้างมากขึ้น */
const JOB_BONUS = 0.2;

export const CITIES: Record<string, City[]> = {
  aldria: [
    { id: "aldria_cap", name: "เมืองหลวงอัลเดรีย", kind: "capital", desc: "กำแพงขาวสามชั้นล้อมพระราชวังที่มีหอระฆังสูงที่สุดในแผ่นดิน", festival: ["เทศกาลระฆังเงิน", "ระฆังทั้งเมืองดังพร้อมกันตอนเที่ยงคืน ทุกคนอธิษฐานหนึ่งข้อ"] },
    { id: "galven", name: "ท่าเรือเกลเวน", kind: "port", desc: "ท่าเรือที่ไม่เคยหลับ เรือจากเจ็ดทะเลจอดเรียงจนเดินข้ามอ่าวได้", festival: ["เทศกาลโคมลอยน้ำ", "โคมนับพันลอยออกทะเลเพื่อส่งคนที่จากไป"] },
    { id: "irongate", name: "ป้อมหินไอรอนเกต", kind: "mountain", desc: "เมืองคนแคระที่สลักเข้าไปในภูเขา เตาหลอมส่องแสงแดงทั้งคืน", festival: ["วันตีทั่งร้อยครั้ง", "ช่างทุกคนตีทั่งพร้อมกันร้อยครั้ง ภูเขาทั้งลูกสั่นตาม"] },
  ],
  varn: [
    { id: "varn_cap", name: "นครวาร์นเหล็ก", kind: "capital", desc: "นครที่สร้างด้วยหินดำ ทหารเดินสวนสนามทุกเช้า และธงจักรวรรดิโบกทุกหลังคา", festival: ["สวนสนามแห่งชัย", "กองทัพทั้งจักรวรรดิเดินผ่านประตูชัย ประชาชนโปรยกลีบดอกไม้แดง"] },
    { id: "blackmarsh", name: "ป้อมชายแดนแบล็กมาร์ช", kind: "frontier", desc: "ป้อมไม้บนหนองน้ำดำ ทหารเฝ้ากำแพงทั้งคืนเพราะสิ่งที่อยู่ในหมอก", festival: ["คืนก่อกองไฟ", "ทุกคนก่อไฟบนกำแพงเพื่อไล่สิ่งที่อยู่ในหมอก แล้วร้องเพลงจนเช้า"] },
    { id: "ashpeak", name: "เมืองเหมืองแอชพีค", kind: "mountain", desc: "เมืองเหมืองบนภูเขาไฟที่หลับไปแล้ว ขี้เถ้าทำให้หิมะที่นี่เป็นสีเทา", festival: ["งานแข่งขุดแร่", "นักขุดแข่งกันขุดหาแร่ก้อนใหญ่ที่สุด ผู้ชนะได้ชื่อจารึกบนประตูเหมือง"] },
  ],
  thalos: [
    { id: "thalos_cap", name: "นครรัฐทาลอส", kind: "port", desc: "นครแห่งพ่อค้าบนสามเกาะ เชื่อมกันด้วยสะพานหินโค้งเจ็ดสิบสองแห่ง", festival: ["งานตลาดพันชาติ", "พ่อค้าจากทุกเผ่ามาเปิดแผงขายของที่หาไม่ได้ที่ไหน"] },
    { id: "selen", name: "เกาะหอคอยเซเลน", kind: "arcane", desc: "เกาะที่มีหอคอยเวทลอยอยู่เหนือน้ำ หนังสือในหอสมุดบินกลับชั้นเอง", festival: ["คืนดาวตก", "นักเวททั้งเกาะร่ายแสงขึ้นฟ้าพร้อมกัน ท้องฟ้าสว่างเหมือนกลางวัน"] },
    { id: "willowdale", name: "หมู่บ้านป่าวิลโลว์เดล", kind: "forest", desc: "หมู่บ้านเล็กใต้ต้นหลิวยักษ์ ฮาล์ฟลิงกับเอลฟ์อยู่ร่วมกันมาหลายร้อยปี", festival: ["เทศกาลเก็บเกี่ยวน้ำผึ้ง", "ทั้งหมู่บ้านกินพายน้ำผึ้งจนเดินไม่ไหว แล้วนอนกลางทุ่งดูหิ่งห้อย"] },
  ],
};

/** แผ่นดินใหม่ที่เกิดทีหลัง มีเมืองเดียวชื่อเดียวกับแผ่นดิน */
const capitalOf = (k: Kingdom): City => ({ id: `${k.id}_cap`, name: `เมืองหลวงแห่ง${k.name}`, kind: "capital", desc: "เมืองหลวงของแผ่นดินที่เพิ่งตั้งขึ้น ทุกอย่างยังใหม่ แม้แต่ชื่อถนน", festival: ["วันก่อตั้งแผ่นดิน", "ทั้งเมืองฉลองวันที่ธงผืนแรกถูกปักลง"] });
export const citiesOf = (k: Kingdom): City[] => CITIES[k.id] ?? [capitalOf(k)];
export function cityOf(l: Life): City {
  const list = citiesOf(homeKingdom(l));
  return list.find((c) => c.id === fl(l).city) ?? list[0];
}
export const kindOf = (l: Life) => KINDS[cityOf(l).kind];
/** ค่าครองชีพตามเมือง */
export const cityCost = (l: Life) => kindOf(l).cost;
export const cityPay = (l: Life, careerId: string) => (kindOf(l).jobs.includes(careerId) ? 1 + JOB_BONUS : 1);
export function moveTo(l: Life, k: Kingdom, city?: City) {
  fl(l).kingdom = k.id;
  fl(l).city = (city ?? pick(l, citiesOf(k))).id;
}

const M = (a: Omit<Activity, "world" | "group" | "emoji">): Activity => ({ ...a, emoji: "", world: "fantasy", group: "เมือง" });
const yearlyFlag = (k: string) => (l: Life) => Number(l.flags[k] ?? -1) !== l.age;
const learnMystery = (l: Life) => { const m = MYSTERIES.find((x) => !fl(l).mKnown?.includes(x.id)); if (m) fl(l).mKnown = [...(fl(l).mKnown ?? []), m.id]; return m; };

const ACTS: Activity[] = [
  M({ id: "ft_city_move", name: "ย้ายไปเมืองอื่นในแผ่นดิน", desc: "ค่าเดินทาง 4 เหรียญทอง", minAge: 14, cost: 4 * GOLD, available: (l) => citiesOf(homeKingdom(l)).length > 1, run: (l) => { runEvent(l, "ft.city.move"); return { text: "" }; } }),
  M({ id: "ft_festival", name: "เที่ยวเทศกาลของเมือง", desc: "ปีละครั้ง · ความสุข และอาจเจอคนใหม่", minAge: 4, available: yearlyFlag("ftFest"), run: (l) => { l.flags.ftFest = l.age; runEvent(l, "ft.city.festival"); return { text: "" }; } }),
  M({ id: "ft_c_tourney", name: "ชมการประลองหลวง", desc: "เมืองหลวง · อาจได้รู้จักขุนนาง", minAge: 8, cost: 2 * GOLD, available: (l) => cityOf(l).kind === "capital", run: (l) => { addMoney(l, -2 * GOLD); addStat(l, "happiness", 4); if (l.age >= 16 && chance(l, 0.25)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -5, 10), bond: 45, job: "ขุนนางหนุ่ม" }); addStanding(l, 1); return { text: `คุณเชียร์อัศวินคนเดียวกับ${shortName(p)} จนได้คุยกันทั้งบ่าย`, kind: "good" }; } return { text: "อัศวินในชุดเกราะทองพุ่งทวนจนแตกกระจาย ฝูงชนโห่ร้อง", kind: "good" }; } }),
  M({ id: "ft_c_fish", name: "ตกปลาทะเล", desc: "เมืองท่า · ได้ปลาขาย บางทีได้ไข่มุก", minAge: 8, available: (l) => cityOf(l).kind === "port", run: (l) => { if (chance(l, 0.06)) { addMoney(l, 30 * GOLD); return { text: "ปลาตัวหนึ่งคายไข่มุกสีชมพูออกมาบนดาดฟ้าเรือ", kind: "good" }; } addMoney(l, randInt(l, 1, 4) * GOLD); addStat(l, "happiness", 2); return { text: "คุณกลับฝั่งพร้อมปลาเต็มตะกร้าและผิวไหม้แดด", kind: "good" }; } }),
  M({ id: "ft_c_climb", name: "ปีนยอดเขา", desc: "เมืองภูเขา · พลังกาย บางทีเจอผลึก", minAge: 10, available: (l) => cityOf(l).kind === "mountain", run: (l) => { fl(l).body += randInt(l, 5, 9); if (chance(l, 0.08)) { addMoney(l, 25 * GOLD); return { text: "ในซอกหินบนยอดเขามีผลึกสีฟ้าส่องแสงอยู่", kind: "good" }; } return { text: "คุณยืนบนยอดเขา เห็นเมฆลอยอยู่ใต้เท้า", kind: "good" }; } }),
  M({ id: "ft_c_wall", name: "อาสาเฝ้ากำแพงยามค่ำ", desc: "ป้อมชายแดน · พลังกายและชื่อเสียงในแผ่นดิน", minAge: 14, available: (l) => cityOf(l).kind === "frontier", odds: (l) => fightOdds(l, 16), run: (l) => { if (chance(l, fightOdds(l, 16))) { fl(l).body += 6; addStanding(l, 2); return { text: "สิ่งที่อยู่ในหมอกถอยกลับไปเมื่อเห็นคบไฟของคุณ", kind: "good" }; } addStat(l, "health", -6); return { text: "บางอย่างกระโจนออกมาจากหมอก คุณได้แผลที่แขนกลับมา", kind: "bad" }; } }),
  M({ id: "ft_c_library", name: "อ่านหนังสือในหอสมุดลอยฟ้า", desc: "เมืองเวท · พลังเวทและสติปัญญา", minAge: 8, available: (l) => cityOf(l).kind === "arcane", run: (l) => { fl(l).magic += randInt(l, 4, 8); addStat(l, "smarts", 1); if (chance(l, 0.1)) { const m = learnMystery(l); if (m) return { text: `หนังสือเล่มหนึ่งบินมาเปิดหน้าตรงหน้าคุณเอง มันเล่าถึง${m.name}`, kind: "good" }; } return { text: "หนังสือที่คุณอ่านพยายามบินหนีกลับชั้นทุกครั้งที่คุณเผลอ", kind: "good" }; } }),
  M({ id: "ft_c_herbs", name: "เก็บสมุนไพรในป่า", desc: "หมู่บ้านป่า · สุขภาพและเงินเล็กน้อย", minAge: 6, available: (l) => cityOf(l).kind === "forest", run: (l) => { addStat(l, "health", 3); addMoney(l, randInt(l, 1, 3) * GOLD); return { text: "ตะกร้าของคุณเต็มไปด้วยรากไม้ที่หมอยาให้ราคาดี", kind: "good" }; } }),
];

type Opt = [label: string, text: string, fx?: Fx];
type Row = [city: string, id: string, title: string, text: string, a: Opt, b: Opt, check?: [StatKey, number, string, Fx?]];
const ROWS: Row[] = [
  ["aldria_cap", "bell_thief", "ขโมยระฆัง", "ระฆังเล็กของหอระฆังหายไปในคืนเดียว ราชาประกาศรางวัลให้คนที่หาเจอ", ["สืบจากรอยเท้าบนหลังคา", "รอยเท้านำไปถึงรังของนกอินทรีเหล็กที่ชอบของแวววาว คุณได้รางวัลจากราชา", { gold: 25, fame: 4 }], ["ช่วยชาวเมืองค้นตามบ้าน", "คนทั้งเมืองค้นจนเจอว่ามันตกอยู่ในบ่อน้ำ", { joy: 2 }], ["smarts", 50, "รอยเท้าพาคุณไปตกหลังคาโรงตีเหล็ก", { hp: -5 }]],
  ["aldria_cap", "royal_parade", "ขบวนแห่หลวง", "ขบวนแห่ของราชวงศ์ผ่านหน้าบ้าน รถม้าทองคันหนึ่งหยุดตรงหน้าคุณพอดี", ["โค้งคำนับ", "เจ้าหญิงองค์เล็กโยนดอกกุหลาบให้คุณ ทั้งถนนอิจฉา", { joy: 5, fame: 1 }], ["มองหน้าตรงๆ", "ทหารองครักษ์จ้องคุณจนขบวนผ่านไป"]],
  ["galven", "smuggler", "เรือลักลอบ", "ชาวเรือคนหนึ่งเสนอเงินให้คุณช่วยขนหีบที่ไม่มีตราภาษีลงจากเรือตอนเที่ยงคืน", ["รับงาน", "หีบหนักกว่าที่คิด แต่ค่าจ้างก็หนักกว่าที่คิดเหมือนกัน", { gold: 20 }], ["แจ้งเจ้าท่า", "เจ้าท่าจับได้ทั้งลำ และให้รางวัลคุณเล็กน้อย", { gold: 6, fame: 1 }], ["luck", 50, "ยามท่าเรือเดินมาพอดี คุณต้องกระโดดน้ำหนี", { hp: -4 }]],
  ["galven", "sea_serpent_sight", "งูทะเลยักษ์", "ทั้งท่าเรือเห็นงูทะเลยาวเท่าเกาะว่ายผ่านปากอ่าว", ["พายเรือออกไปดูใกล้ๆ", "มันมองคุณด้วยตาที่ใหญ่เท่าประตู แล้วดำน้ำหายไปอย่างสงบ", { joy: 6, luck: 2 }], ["วาดรูปมันจากฝั่ง", "รูปของคุณขายได้ให้นักสะสม", { gold: 8 }]],
  ["irongate", "forge_king", "ราชาแห่งเตาหลอม", "ช่างคนแคระที่แก่ที่สุดในภูเขาเปิดเตาหลอมโบราณที่ปิดมาร้อยปี และต้องการคนช่วยสูบลม", ["อาสาช่วย", "เขาตีขวานเล่มหนึ่งตลอดสามวันสามคืน แล้วสอนเคล็ดหนึ่งข้อเป็นค่าแรง", { body: 10, iq: 1 }], ["ยืนดูอยู่ห่างๆ", "แสงจากเตานั้นทำให้คุณจำได้ไปทั้งชีวิต", { joy: 3 }], ["health", 55, "ความร้อนทำให้คุณเป็นลมตั้งแต่วันแรก", { hp: -6 }]],
  ["irongate", "tunnel_echo", "เสียงในอุโมงค์", "เสียงร้องเพลงดังมาจากอุโมงค์ที่ถูกปิดตาย คนแคระบอกว่าคือวิญญาณบรรพบุรุษ", ["ร้องเพลงตอบ", "เสียงเพลงหยุด แล้วหินก้อนหนึ่งเลื่อนเปิดเผยถ้วยทองเก่า", { gold: 25 }], ["กลับบ้านเร็วๆ", "คืนนั้นคุณได้ยินเพลงนั้นในฝัน"]],
  ["varn_cap", "conscript_drill", "ลานฝึกหลวง", "แม่ทัพจักรวรรดิเปิดลานฝึกให้ประชาชนลองซ้อมกับทหารองครักษ์", ["ลงซ้อม", "ทหารองครักษ์ล้มคุณสามครั้ง แล้วยอมรับว่าครั้งที่สี่เกือบแพ้", { body: 8 }], ["นั่งดู", "คุณจำท่าได้สองสามท่า", { body: 2 }], ["health", 50, "คุณถูกหามออกจากลานตั้งแต่ยกแรก", { hp: -5 }]],
  ["varn_cap", "secret_police", "เงาในตรอก", "ชายในชุดดำถามคุณว่าเคยได้ยินใครพูดไม่ดีถึงจักรพรรดินีไหม", ["บอกว่าไม่เคย", "เขาจดชื่อคุณแล้วหายไปในฝูงชน", { joy: -2 }], ["ส่งชื่อเพื่อนบ้านที่เกลียด", "เพื่อนบ้านหายไปในคืนนั้น คุณได้บ้านเขามาครึ่งหลัง แต่หลับไม่สนิทอีกเลย", { gold: 15, joy: -6 }]],
  ["blackmarsh", "fog_thing", "สิ่งที่อยู่ในหมอก", "เด็กชาวป้อมหายเข้าไปในหมอก เสียงร้องของเขายังดังอยู่", ["ถือคบไฟเข้าไปตาม", "คุณพาเด็กกลับมาได้ สิ่งในหมอกถอยไปเมื่อเห็นไฟ", { fame: 5, body: 4 }], ["ตีระฆังเรียกทหาร", "ทหารหาเด็กเจอตอนรุ่งสาง ผมของเขาขาวไปทั้งหัว", { joy: -3 }], ["health", 55, "บางอย่างลากขาคุณเข้าไปในโคลน คุณดิ้นหลุดมาได้", { hp: -10 }]],
  ["blackmarsh", "deserter_camp", "ค่ายผู้หนีทัพ", "ในหนองน้ำมีค่ายของทหารที่หนีจากสงครามเมื่อสิบปีก่อน พวกเขาขออาหาร", ["แบ่งเสบียงให้", "หัวหน้าค่ายมอบแผนที่ทางลับข้ามหนองให้คุณ", { iq: 2, joy: 2 }], ["รายงานผู้บัญชาการ", "ค่ายถูกเผา คุณได้เหรียญตรา", { fame: 2, joy: -4 }]],
  ["ashpeak", "volcano_wake", "ภูเขาไฟพลิกตัว", "พื้นดินสั่นทั้งคืน ควันขาวลอยขึ้นจากปากปล่องที่หลับมาสามร้อยปี", ["ช่วยอพยพคนงานเหมือง", "ไม่มีใครตายในคืนนั้น เพราะคุณเคาะประตูทุกบ้าน", { fame: 5 }], ["ขนของมีค่าหนีก่อน", "คุณรอดพร้อมทรัพย์สิน แต่เพื่อนบ้านจำได้", { gold: 10, fame: -2 }]],
  ["ashpeak", "ash_rose", "กุหลาบเถ้า", "กุหลาบสีเทาบานขึ้นบนหินร้อน ตำนานว่าใครได้มันไปจะมีรักแท้", ["ปีนขึ้นไปเก็บ", "กุหลาบไม่เหี่ยวแม้ผ่านไปหลายปี", { joy: 5, look: 2 }], ["ปล่อยให้มันบานต่อ", "ปีหน้ามีกุหลาบเถ้าบานขึ้นอีกสามดอก"], ["health", 50, "หินร้อนลวกมือคุณ", { hp: -5 }]],
  ["thalos_cap", "bridge_race", "แข่งข้ามสะพาน", "นครจัดแข่งวิ่งข้ามสะพานทั้งเจ็ดสิบสองแห่งในวันเดียว", ["ลงแข่ง", "คุณเข้าเส้นชัยเป็นคนแรก สภาเก้าพ่อค้าคล้องเหรียญทองให้", { fame: 4, gold: 10 }], ["ตั้งแผงขายน้ำให้นักวิ่ง", "คุณขายน้ำหมดตั้งแต่สะพานที่ยี่สิบ", { gold: 8 }], ["health", 55, "ขาคุณตะคริวตั้งแต่สะพานที่สิบ", { hp: -3 }]],
  ["thalos_cap", "council_vote", "สภาเปิดให้ประชาชนพูด", "สภาเก้าพ่อค้าเปิดให้ประชาชนขึ้นพูดหนึ่งเรื่องก่อนลงมติภาษีใหม่", ["ขึ้นพูดคัดค้าน", "คำพูดของคุณทำให้สภาลดภาษีลงครึ่งหนึ่ง ทั้งตลาดเลี้ยงเหล้าคุณ", { fame: 5 }], ["ฟังอยู่เงียบๆ", "ภาษีขึ้นตามเดิม"], ["looks", 55, "คุณพูดติดอ่าง สภาหัวเราะ", { joy: -3 }]],
  ["selen", "rogue_book", "หนังสือหนีออกจากหอ", "หนังสือเวทเล่มหนึ่งบินหนีออกจากหอสมุด และกำลังกัดคนในตลาด", ["ไล่จับด้วยมือเปล่า", "คุณกอดหนังสือไว้จนมันสงบ บรรณารักษ์ให้คุณอ่านมันหนึ่งบท", { magic: 10 }], ["ช่วยคนที่โดนกัด", "แผลจากหนังสือหายเร็วกว่าที่คิด คนในตลาดขอบคุณคุณ", { fame: 2 }], ["luck", 50, "หนังสือกัดจมูกคุณแล้วบินหนีต่อ", { hp: -3 }]],
  ["selen", "tower_exam", "สอบเข้าหอคอย", "หอคอยเวทลอยต่ำลงจนแตะน้ำ ประตูเปิดให้ใครก็ได้ที่ตอบคำถามของมันได้", ["เข้าไปตอบคำถาม", "ประตูเปิดกว้าง ห้องข้างในมีคทาเรียงรอเจ้าของ", { magic: 12, iq: 2 }], ["รอดูคนอื่นก่อน", "ไม่มีใครตอบได้ หอคอยลอยกลับขึ้นไปอีกร้อยปี"], ["smarts", 60, "หอคอยไม่พอใจคำตอบ คุณตื่นมาบนชายหาดอีกฝั่งของเกาะ", { joy: -2 }]],
  ["willowdale", "honey_bear", "หมีขโมยน้ำผึ้ง", "หมีสีน้ำตาลตัวใหญ่ขโมยน้ำผึ้งทั้งหมู่บ้านไปทุกคืน", ["ทำข้อตกลงกับมัน", "คุณวางน้ำผึ้งหนึ่งไหไว้ชายป่าทุกเดือน หมีไม่เคยมาอีก และคอยไล่หมาป่าให้หมู่บ้าน", { joy: 4, luck: 2 }], ["ล้อมจับ", "หมีวิ่งหนีไปพร้อมไหน้ำผึ้งใบสุดท้าย"]],
  ["willowdale", "willow_spirit", "วิญญาณต้นหลิว", "ต้นหลิวยักษ์กลางหมู่บ้านเริ่มใบร่วงทั้งที่ยังไม่ถึงฤดูหนาว", ["นั่งฟังมันทั้งคืน", "ต้นไม้กระซิบว่ารากของมันเจ็บ คุณขุดเจอเหล็กสาปฝังอยู่และเอาออก", { magic: 6, fame: 3 }], ["ไปตามหมอยามาดู", "หมอยาบอกว่าต้นไม้แก่แล้ว"]],
];

const atCity = (id: string) => (l: Life) => !!l.ft && cityOf(l).id === id;
const CITY_EVENTS: GameEvent[] = ROWS.map(([city, id, title, text, a, b, ck]) => E(`ft.cy.${id}`, [8, 400], text, [
  ck ? K(a[0], ck[0], ck[1], G(a[1], a[2]), N(ck[2], ck[3])) : C(a[0], G(a[1], a[2])),
  C(b[0], N(b[1], b[2])),
], { title, when: atCity(city), maxTimes: 1, weight: 10 }));

export const CITY_SCENES: GameEvent[] = [
  ...CITY_EVENTS,
  SCENE("ft.city.move", "ย้ายเมือง", (l) => `ตอนนี้คุณอยู่ที่${cityOf(l).name} จะย้ายไปไหน`, [0, 1, 2].map((i) => C(
    (l) => { const c = citiesOf(homeKingdom(l))[i]; return c ? `${c.name} · ${KINDS[c.kind].name} · ${KINDS[c.kind].perk}` : "—"; },
    (l) => { const c = citiesOf(homeKingdom(l))[i]; addMoney(l, -4 * GOLD); fl(l).city = c.id; return { text: `คุณเก็บของย้ายมาอยู่${c.name} ${c.desc}`, kind: "good" }; },
    { show: (l) => { const c = citiesOf(homeKingdom(l))[i]; return !!c && c.id !== cityOf(l).id; } },
  )).concat(C("อยู่ที่เดิม", N("คุณมองแผนที่แล้วพับเก็บ")))),
  SCENE("ft.city.festival", "เทศกาล", (l) => `${cityOf(l).festival[0]} · ${cityOf(l).festival[1]}`, [
    C("สนุกให้สุด", G("คุณเต้นรำ กิน และหัวเราะจนเช้า", { joy: 7 })),
    K("ชวนคนแปลกหน้าเต้นรำ", "looks", 45, G("คุณได้เพื่อนใหม่ที่เต้นรำเก่งกว่าคุณ", { joy: 5 }, (l) => { createPerson(l, "friend", { age: Math.max(10, l.age + randInt(l, -6, 6)), bond: 50 }); }), N("เขาปฏิเสธอย่างสุภาพ คุณเต้นคนเดียวก็สนุกดี", { joy: 3 })),
    PAY("ซื้อของที่ระลึก", 3, G("ของชิ้นนั้นวางอยู่บนหิ้งของคุณไปอีกหลายสิบปี", { joy: 4, luck: 1 })),
    P("ลงแข่งเกมประจำเทศกาล", (l) => 0.35 + (l.stats.luck - 50) / 200, BIG("คุณชนะเกมประจำเทศกาล ชื่อคุณถูกประกาศกลางจัตุรัส", { fame: 3, gold: 10 }), N("คุณแพ้ แต่ได้ขนมปลอบใจหนึ่งชิ้น", { joy: 2 })),
  ]),
];

export function loadCities() {
  ACTIVITIES.push(...ACTS);
  for (const c of CAREERS) if (c.world === "fantasy") c.salary = (l, base) => base * (l.ft ? cityPay(l, c.id) : 1);
}

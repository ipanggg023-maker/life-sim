// พรสวรรค์ของโลกแฟนตาซี · ด้ายชะตาคือของหายากที่ย้อนเวลาได้
import type { Talent } from "../talents";

const T = (id: string, name: string, rarity: Talent["rarity"], desc: string, apply?: Talent["apply"]): Talent => ({ id, name, rarity, desc, world: "fantasy", apply });

export const FANTASY_TALENTS: Talent[] = [
  T("ft_strong", "กำลังวังชา", "common", "ร่างกายแข็งแรงกว่าเด็กทั่วไป — สุขภาพ +6", (l) => { l.stats.health = Math.min(100, l.stats.health + 6); }),
  T("ft_clever", "หัวไว", "common", "จำอะไรได้เร็ว — สติปัญญา +6", (l) => { l.stats.smarts = Math.min(100, l.stats.smarts + 6); }),
  T("ft_charm", "เสน่ห์ติดตัว", "common", "ใครเห็นก็เอ็นดู — รูปลักษณ์ +6", (l) => { l.stats.looks = Math.min(100, l.stats.looks + 6); }),
  T("ft_lucky", "ดาวนำโชค", "common", "เรื่องร้ายมักพลาดคุณไปนิดเดียว — โชค +6", (l) => { l.stats.luck = Math.min(100, l.stats.luck + 6); }),
  T("ft_blade", "สัมผัสดาบ", "rare", "ถือดาบเป็นตั้งแต่ครั้งแรก — เริ่มสายดาบเร็วกว่าคนอื่น", (l) => { if (l.ft) l.ft.body += 40; }),
  T("ft_mana", "มานาล้นตัว", "rare", "พลังเวทแต่กำเนิดสูงกว่าที่ควร — พรสวรรค์เวท +1", (l) => { if (l.ft) l.ft.potential = Math.min(5, l.ft.potential + 1); }),
  T("ft_dragonblood", "เลือดมังกร", "legendary", "บรรพบุรุษคนหนึ่งไม่ใช่มนุษย์ — ทนไฟ และมังกรมองคุณต่างออกไป", (l) => { if (l.ft) { l.ft.dragonBond += 20; l.stats.health = Math.min(100, l.stats.health + 8); } }),
  T("ft_fate_thread", "ด้ายชะตา", "legendary", "ด้ายสีเงินผูกข้อมือคุณมาตั้งแต่เกิด — ย้อนชะตาได้สองครั้งทุกวัย"),
];

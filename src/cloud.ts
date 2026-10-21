// ซิงก์เซฟผ่าน Supabase: ล็อกอินด้วยอีเมล + รหัสผ่าน แล้วเก็บเซฟ (ทั้งวิญญาณ ชีวิตปัจจุบัน สุสาน) ไว้บนคลาวด์ 1 แถวต่อบัญชี
// ไม่ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY = ปิดระบบนี้ทั้งหมด เกมเล่นแบบออฟไลน์ได้ตามเดิม
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { exportCode, importCode, type Bundle } from "./save";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const cloudEnabled = !!URL_ && !!KEY;

/** เวลาบนคลาวด์ที่เครื่องนี้รู้จักล่าสุด (อัปโหลดเอง หรือโหลดลงมา) — ถ้าคลาวด์ใหม่กว่านี้ แปลว่าอีกเครื่องเล่นต่อไปแล้ว */
const MARK = "ls.cloudAt";
const getMark = () => { try { return localStorage.getItem(MARK) ?? ""; } catch { return ""; } };
export const setMark = (v: string) => { try { localStorage.setItem(MARK, v); } catch { /* ไม่มี storage */ } };

/** เลือก "เล่นโดยไม่มีบัญชี" ไว้แล้ว — ไม่ต้องขึ้นหน้าเข้าสู่ระบบอีก */
const GUEST = "ls.guest";
export const isGuest = () => { try { return localStorage.getItem(GUEST) === "1"; } catch { return false; } };
export const setGuest = (on: boolean) => { try { if (on) localStorage.setItem(GUEST, "1"); else localStorage.removeItem(GUEST); } catch { /* ไม่มี storage */ } };

let client: Promise<SupabaseClient> | undefined;
/** โหลดไลบรารีตอนใช้ครั้งแรก — ไม่ทำให้เปิดเกมช้าลง */
function sb() {
  client ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(URL_!, KEY!));
  return client;
}

export async function currentUser(): Promise<User | null> {
  if (!cloudEnabled) return null;
  const { data } = await (await sb()).auth.getSession();
  return data.session?.user ?? null;
}

export async function onAuthChange(cb: (u: User | null) => void) {
  if (!cloudEnabled) return () => {};
  const { data } = (await sb()).auth.onAuthStateChange((_e, s) => cb(s?.user ?? null));
  return () => data.subscription.unsubscribe();
}

const thaiError = (m: string) =>
  /invalid login/i.test(m) ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
  : /not confirmed/i.test(m) ? "ยังไม่ได้ยืนยันอีเมล — เปิดลิงก์ในอีเมลก่อน"
  : /already registered/i.test(m) ? "อีเมลนี้สมัครไว้แล้ว — กดเข้าสู่ระบบแทน"
  : /password/i.test(m) ? "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร"
  : /fetch|network/i.test(m) ? "เชื่อมต่อไม่ได้ — ตรวจอินเทอร์เน็ต"
  : m;

/** คืนข้อความผิดพลาด (ภาษาไทย) หรือ null ถ้าสำเร็จ */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await (await sb()).auth.signInWithPassword({ email, password });
  return error ? thaiError(error.message) : null;
}

/** สมัคร: ถ้าโปรเจกต์เปิดยืนยันอีเมลไว้ จะยังไม่ล็อกอินจนกว่าจะกดลิงก์ */
export async function signUp(email: string, password: string): Promise<{ error: string | null; needConfirm: boolean }> {
  const { data, error } = await (await sb()).auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  return { error: error ? thaiError(error.message) : null, needConfirm: !error && !data.session };
}

export async function signOut() {
  await (await sb()).auth.signOut();
}

export interface CloudInfo {
  updatedAt: string;
  summary: { lives: number; name?: string; age?: number };
}

/** ข้อมูลเซฟบนคลาวด์ (ไม่โหลดตัวเซฟ) */
export async function cloudInfo(): Promise<CloudInfo | null> {
  const { data, error } = await (await sb()).from("saves").select("updated_at, summary").maybeSingle();
  if (error || !data) return null;
  return { updatedAt: data.updated_at, summary: data.summary };
}

export async function uploadSave(b: Bundle): Promise<string | null> {
  const user = await currentUser();
  if (!user) return "ยังไม่ได้เข้าสู่ระบบ";
  const code = await exportCode(b, false);
  const updated_at = new Date().toISOString();
  const summary = { lives: b.soul.lives, name: b.life?.firstName, age: b.life?.age };
  const { error } = await (await sb()).from("saves").upsert({ user_id: user.id, code, summary, updated_at });
  if (error) return thaiError(error.message);
  setMark(updated_at);
  return null;
}

export async function downloadSave(): Promise<{ bundle: Bundle; updatedAt: string } | null> {
  const { data, error } = await (await sb()).from("saves").select("code, updated_at").maybeSingle();
  if (error || !data) return null;
  return { bundle: await importCode(data.code), updatedAt: data.updated_at };
}

/** คลาวด์มีเซฟที่เครื่องนี้ยังไม่เคยเห็น (อีกเครื่องเล่นต่อไปแล้ว) */
export async function newerInCloud(): Promise<CloudInfo | null> {
  if (!(await currentUser())) return null;
  const info = await cloudInfo();
  return info && info.updatedAt !== getMark() ? info : null;
}

// อัปโหลดอัตโนมัติระหว่างเล่น: อย่างมากทุก 20 วินาที และทันทีที่ออกจากแอป
let latest: Bundle | undefined;
let timer: number | undefined;
let busy = false;
const GAP = 20_000;

async function flush() {
  timer = undefined;
  if (!latest || busy) return;
  const b = latest;
  latest = undefined;
  busy = true;
  try { await uploadSave(b); } catch { latest ??= b; } finally { busy = false; }
}

/** ทิ้งงานอัปโหลดที่รออยู่ (เช่น กำลังจะโหลดเซฟจากคลาวด์มาแทน) */
export function cancelUpload() {
  latest = undefined;
  if (timer) window.clearTimeout(timer);
  timer = undefined;
}

export function scheduleUpload(b: Bundle) {
  if (!cloudEnabled) return;
  latest = b;
  timer ??= window.setTimeout(flush, GAP);
}

if (typeof window !== "undefined" && cloudEnabled) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && latest) {
      if (timer) window.clearTimeout(timer);
      void flush();
    }
  });
}

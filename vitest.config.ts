import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // การจำลองหลายร้อยชีวิตใช้เวลาเกินค่าเริ่มต้น 5 วินาที
    testTimeout: 120_000,
    // worktree ของเซสชันอื่นอยู่ใต้ .claude/ — ไม่ต้องรันซ้ำ
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
});

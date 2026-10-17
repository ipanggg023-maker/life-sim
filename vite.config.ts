import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    // แยกไลบรารี / เนื้อหาเกม (event หลายพันอัน) / โค้ดหลัก — อัปเดตแล้วเครื่องไม่ต้องโหลดใหม่ทั้งก้อน
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor", test: /node_modules/ },
            { name: "content", test: /[\/]src[\/]content[\/]/ },
          ],
        },
      },
    },
  },
});

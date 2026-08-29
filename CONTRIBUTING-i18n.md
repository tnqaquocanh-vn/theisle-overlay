# Dịch giao diện / Translating the UI

Giao diện TheIsle Overlay đọc mọi chuỗi hiển thị từ `src/lib/i18n/`. Không file
UI nào viết thẳng chuỗi — nên thêm một ngôn ngữ chỉ là thêm một file từ điển.

## Cách thêm / hoàn thiện một ngôn ngữ

1. **Key nằm ở `vi.ts`.** Đây là "nguồn sự thật" — nó định nghĩa kiểu `MsgKey`.
   `en.ts` phải có **đủ** mọi key (trình biên dịch bắt buộc); các ngôn ngữ khác
   được phép thiếu — key nào thiếu sẽ tự lùi về tiếng Anh.

2. **Tạo (hoặc mở) file ngôn ngữ**, ví dụ `src/lib/i18n/pt.ts`:

   ```ts
   import type { MsgKey } from "./vi";

   export const pt: Partial<Record<MsgKey, string>> = {
     "tab.map": "Mapa",
     "btn.close": "Fechar",
     // …
   };
   ```

   Chép **value** tiếng Anh từ `en.ts`, dịch nó, **giữ nguyên key**. Placeholder
   dạng `{version}`, `{name}`, `{n}` phải được giữ nguyên.

3. **Đăng ký** ở `src/lib/i18n/index.ts`:

   ```ts
   import { pt } from "./pt";
   const DICTS = { vi, en, pt };
   export const LOCALES = [
     { code: "vi", label: "Tiếng Việt" },
     { code: "en", label: "English" },
     { code: "pt", label: "Português" },
   ];
   ```

   và mở rộng union `Locale` trong cùng file + `language` trong
   `src/lib/api.ts`.

4. **Kiểm tra:**

   ```bash
   node scripts/check-i18n.mjs   # báo % đã dịch + key lạ / key thiếu
   npm run check                 # svelte-check
   ```

   Script sẽ **fail** nếu file mang một key không có trong `vi.ts` (gõ sai), hoặc
   nếu `en.ts` thiếu key. File dịch chưa đủ 100% thì **không** fail.

## Ghi chú

- `translate.rs` (dịch nhiệm vụ Prime từ IslePilot) chỉ có tiếng Việt; ngôn ngữ
  khác hiện nhiệm vụ bằng tiếng Anh như bản `en`.
- Nhãn khay hệ thống (`src-tauri/src/tray.rs`) hiện chỉ vi/en — cần sửa tay nếu
  muốn dịch.

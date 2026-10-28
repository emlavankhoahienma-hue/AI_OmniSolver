# ⚡ AI Omni-Solver: Phím Tắt iOS Giải Đề Đa AI Kín Đáo (Back Tap Screenshot ➔ Multi-AI Solver)

Hệ thống Phím tắt iOS thông minh thế hệ 2026: Kích hoạt ngầm bằng cử chỉ **Gõ 2 lần mặt lưng iPhone (Back Tap)**, tự động chụp màn hình, kết hợp **Hybrid Vision + On-Device Live Text OCR**, chuyển tới hệ thống Đa AI tự động nhận diện Key và tự động fallback sang **Pollinations AI (0 cần Key)**, trả kết quả siêu tốc (`1B 2C 3A 4D`) ngầm vào Bộ nhớ tạm và hiện thông báo kín đáo.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Lõi Điều Phối Đa AI Tự Động (Auto-Detection & Fallback):**
   - `AIza...` ➔ **Google Gemini** (`gemini-2.5-flash` / `gemini-2.5-pro`).
   - `sk-or-...` ➔ **OpenRouter** (`gemini-2.5-flash` / `qwen2.5-vl-72b`).
   - `gsk_...` ➔ **Groq Siêu Tốc** (`meta-llama/llama-4-maverick-17b` / `llama-3.2-vision`).
   - `sk-...` ➔ **DeepSeek** (`deepseek-chat`) / **OpenAI** (`gpt-4.1`).
   - **Chế độ Bất Tử (Pollinations Free - 0 Key Needed):** Nếu bỏ trống Key hoặc API chính hết hạn/lỗi, hệ thống lập tức fallback ngầm sang Pollinations AI. 100% không bao giờ gián đoạn!

2. **Công Nghệ Hybrid "Vision + Live Text OCR":**
   - Chụp màn hình ➔ Thu nhỏ JPEG 1024px nén nhẹ ➔ Base64 không ngắt dòng.
   - Đồng thời trích xuất chữ bằng công nghệ Apple Live Text trên thiết bị.
   - Cung cấp dữ liệu chuẩn xác cho cả model nhận diện hình ảnh và model suy luận văn bản.

3. **Stealth UX (Hoạt động hoàn toàn ngầm):**
   - `Show When Run = false`: Không chuyển ứng dụng, không bật Safari.
   - Tự động sao chép đáp án vào **Clipboard**.
   - Bắn thông báo banner nhỏ trên đầu màn hình: `🎯 AI Omni-Solver: 1B 2C 3A 4D`.
   - Rung nhẹ phản hồi haptic.

---

## 🚀 HƯỚNG DẪN 3 BƯỚC CÀI ĐẶT NHANH TRÊN IPHONE

### Bước 1: Tải Phím Tắt Đã Ký Apple (`AI_OmniSolver.shortcut`)
- Tải trực tiếp file `.shortcut` đã được ký bởi Apple từ tab **Releases** hoặc **Artifacts**.
- Chạm vào file để mở trong ứng dụng **Phím tắt (Shortcuts)** trên iPhone.
- Điền API Key của bạn (nếu có) hoặc để trống để sử dụng chế độ Pollinations Miễn phí 100%.

### Bước 2: Kích Hoạt "Gõ Mặt Lưng" (Back Tap)
1. Mở **Cài đặt (Settings)** trên iPhone ➔ **Trợ năng (Accessibility)**.
2. Chọn **Cảm ứng (Touch)** ➔ Cuộn xuống dưới cùng chọn **Chạm vào mặt lưng (Back Tap)**.
3. Chọn **Chạm hai lần (Double Tap)** ➔ Cuộn xuống danh sách Phím tắt và tích chọn **AI_OmniSolver**.

### Bước 3: Triển Khai Cloudflare Worker (Tùy chọn - Tối ưu tốc độ cao nhất)
Nếu bạn muốn dùng Cloudflare Worker làm trạm trung chuyển điều phối đa AI:
1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com) ➔ Chọn **Workers & Pages** ➔ **Create Application**.
2. Dán nội dung file `omni_router.js` vào trình chỉnh sửa code.
3. Bấm **Deploy** và copy link Worker (ví dụ: `https://omni-solver.username.workers.dev/solve`), sau đó dán vào biến `ROUTER_URL` trong phím tắt!

---

## 🛠 QUY TRÌNH KÝ CHỨNG CHỈ APPLE TRÊN GITHUB ACTIONS
File phím tắt được tự động build và ký bằng công cụ macOS chính chủ `shortcuts sign`:
```bash
shortcuts sign --mode anyone --input AI_OmniSolver_Unsigned.shortcut --output AI_OmniSolver.shortcut
```
Đảm bảo iOS 16, 17 và 18 cho phép cài đặt trực tiếp không bị báo lỗi file không an toàn.

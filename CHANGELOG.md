# Changelog

Mọi thay đổi đáng chú ý của TheIsle Overlay được ghi tại đây, theo định dạng
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và đánh số phiên bản
[SemVer](https://semver.org/lang/vi/).

Nội dung mỗi phiên bản là **thông báo ngắn gọn cho người dùng** (tính năng mới,
sửa lỗi) — không đi vào chi tiết kỹ thuật, không nêu tên file/hàm. Đây cũng là
nội dung hiện trong mục "Có gì mới" của app. Chi tiết kỹ thuật nằm ở commit
message. Nếu cần ghi chú nội bộ trong file này, đặt dưới mục `### Nội bộ` — CI
tự cắt phần đó khỏi thông báo người dùng thấy.

## [1.41.0] — 2026-09-02

### Đổi

- **Chấm vị trí đồng đội & người chơi khác** trên bản đồ nhỏ và bản đồ lớn
  đổi sang kiểu chấm tròn phát sáng giống Google/Apple Maps, mượt hơn.
  Đồng đội tụt dưới 25% máu thì chấm to lên kèm vòng cảnh báo.

### Sửa

- **Cân nặng trên nhãn đồng đội/người chơi:** không còn đoán bừa một con số
  khi bên kia chưa gửi đủ chỉ số — lúc đó chỉ hiện tên loài.
- **Thanh chỉ số đồng đội trên bản đồ nhỏ nhẹ hơn nhiều trên máy yếu** — vẽ
  gọn lại, chỉ cập nhật khi có thay đổi thấy được, và giới hạn 10 dòng (đầu
  bảng vẫn ghi đúng sĩ số). Trước đây bật thanh này lên là máy yếu bị giật.
- **Ở chung nhóm/máy yếu đỡ giật hơn** — chấm đồng đội chỉ vẽ lại khi thật
  sự có dịch chuyển; ở Chế độ nhẹ chấm nhảy thẳng (không trượt) và chỉ hiện
  ~12 chấm gần nhất khi cả nhóm đứng chồng lên nhau.

### Nội bộ

- Overlay: cache cửa sổ game + thêm bộ đo hiệu năng (bật bằng
  `debug.perf_probe`) để lấy số CPU thật từ người dùng — R-02 (C-1/C-2).
- Bản đồ nhỏ: bỏ qua `party://update` không dịch chuyển (chữ ký bucket);
  Chế độ nhẹ bỏ vòng repaint mỗi frame của chấm party + cap 12 chấm gần
  nhất; thanh chỉ số đội tô phẳng + throttle ≤5 Hz + cap 10 dòng (khớp
  Rust). R-18 / R-19.

## [1.40.1] — 2026-09-02

### Sửa

- **Nhóm sinh tồn:** khi không vào/tạo được nhóm, app báo lý do rõ ràng thay
  vì dòng lỗi khó hiểu, và tự sửa địa chỉ relay nếu bạn nhập thiếu
  `https://`. Thêm nút chép mã nhóm cho tiện.
- **Cửa sổ ứng dụng đỡ giật khi chuyển tab** — các tab được nạp sẵn lúc máy
  rảnh, và mở lại mục Cài đặt không còn khựng.

### Đổi

- **Viết lại toàn bộ phần Hướng dẫn trong app** — chia 13 mục có mục lục,
  chi tiết hơn hẳn và phủ đủ mọi tính năng (Garage, Skin, Companion, xem lại
  hành trình, Npcap, gói PRO/PRO VIP…).

## [1.40.0] — 2026-09-02

### Thêm

- **Tự cài Npcap.** Bật "Vị trí tự động" mà máy chưa có Npcap thì app hỏi và
  cài luôn cho bạn (qua winget, hoặc tải bản cài chính chủ đã ký từ
  npcap.com) — không phải tự đi tìm và cài tay nữa.

### Đổi

- **Màn Cài đặt gọn hơn hẳn.** Chia thành các tab bên trái, thêm ô tìm kiếm,
  và gom những tuỳ chọn nâng cao của bản đồ nhỏ vào một mục thu gọn.
- **PRO và PRO VIP rõ ràng hơn.** Mục Tài khoản có bảng so sánh Free / PRO /
  PRO VIP, và mọi tính năng bị khoá giờ dùng chung một nhãn bấm được để mở
  thẳng chỗ nâng hạng.

### Sửa

- **Park dino.** Trước đây bấm Park xong đợi mãi không cất được; giờ chạy đúng
  như bên web.

## [1.39.1] — 2026-09-01

### Đổi

- **Bản bảo trì.** Cửa sổ chính khởi động nhẹ hơn một chút. Phần còn lại là
  cải thiện nội bộ và chuẩn bị nền cho các bản cập nhật bản đồ sắp tới —
  không có thay đổi đáng kể với người dùng.

## [1.39.0] — 2026-08-31

### Thêm

- **Nhãn loài + cân nặng trên bản đồ (PRO VIP).** Chấm đồng đội hiện nhãn gọn
  kiểu "T-Rex 12T", "Cera 800Kg" — cân nặng lấy từ chỉ số thật của họ (kể cả
  Prime Elder). Chấm còn đổi màu theo quan hệ với khủng long của bạn: cùng loài
  (xanh lá), ăn thịt (đỏ), ăn cỏ (xanh dương), AI (vàng). Bật ở Cài đặt → Bản đồ.
  Đồng đội cần cập nhật bản này để gửi dữ liệu.
- **Hai mức ủng hộ: PRO (30.000đ) và PRO VIP (50.000đ).** PRO gồm mọi tính năng
  nâng cao như trước. PRO VIP thêm nhãn loài+cân nặng trên bản đồ (và tính năng
  bản đồ nâng cao sắp tới). Đang là PRO thì có nút nâng lên PRO VIP, chỉ trả
  phần chênh 20.000đ.

### Đổi

- Người đã ủng hộ từ trước tự động thành **PRO** — không mất quyền gì.

## [1.38.3] — 2026-08-31

### Sửa

- **Park dino giờ chạy đúng.** Server mất 1–2 phút mới đưa dino vào garage
  (không phải 30 giây), nên bản trước hay báo "huỷ" oan dù park đã thành công.
  App giờ gửi lệnh rồi tự theo dõi tới khi dino vào garage mới báo — nút Park
  hiện "Đang park…" trong lúc chờ. Nhớ đứng yên trong game, di chuyển hay bị
  đánh lúc đếm ngược sẽ làm huỷ lệnh.

## [1.38.2] — 2026-08-31

### Thêm

- **Ô dán mã skin trong tab Skin.** Dán thẳng chuỗi skin định dạng game (chuỗi
  Import trong game) hoặc mã app `tio-skin:` vào ô rồi bấm Nhập mã — màu nạp vào
  trình chỉnh, sau đó bấm "Áp dụng vào game" như thường.

### Sửa

- **Park dino (tab Garage) giờ báo đúng.** Park có đếm ngược ~30 giây phía server:
  app sẽ nhắc bạn đứng yên trong game, đợi hết đếm ngược rồi tự kiểm tra lại. Nếu
  bạn di chuyển hay bị tấn công làm huỷ lệnh, app báo rõ thay vì lặng thinh.
  (Bản sửa ở 1.38.1 chưa đúng.)
- **Áp skin báo rõ hơn khi không đẩy được vào game.** Nếu bạn đã tắt "Cập nhật
  thời gian thực (WebSocket)" ở tab Khủng long thì app nói thẳng cần bật lại, thay
  vì hứa "sẽ tự áp khi vào lại" (mà không bao giờ áp). Log cũng ghi lại lý do
  socket rớt để dễ tìm nguyên nhân khi có người báo lỗi.

## [1.38.1] — 2026-08-31

### Thêm

- **Chỉnh riêng cỡ từng bảng dưới bản đồ nhỏ.** Cài đặt → Bản đồ nhỏ có thêm
  "Cỡ bảng chỉ số khủng long" và "Cỡ bảng nhiệm vụ Prime" — phóng to/thu nhỏ
  từng bảng mà không đụng tới đĩa bản đồ hay bảng còn lại.

### Sửa

- **Nút gửi phản hồi giờ hoạt động** kể cả khi tắt "Gửi số liệu sử dụng" —
  góp ý/báo lỗi của bạn đến thẳng nhà phát triển.
- **Park khủng long (tab Garage)** không dùng được với bản IslePilot mới —
  đã sửa để tự qua bước xác nhận.

## [1.38.0] — 2026-08-31

### Đổi

- **Đổi máy hay chơi qua máy cloud vẫn giữ được mã.** Mã bản quyền giờ gắn với
  tài khoản Steam đang đăng nhập (chỉ gửi một mã băm, không gửi thông tin
  Steam) — cài lại máy, đổi PC hay thuê máy cloud khác thì bấm "Đã mua trên máy
  này nhưng mất mã?" là lấy lại được, không cần nhập lại chuỗi mã.
- **Giới hạn số máy dùng cùng lúc thay cho giới hạn số lần đổi máy.** Một máy
  lâu không dùng sẽ tự nhả chỗ sau 14 ngày, nên đổi máy thường xuyên không còn
  bị chặn. Mã vẫn chỉ cho một vài máy hoạt động song song.
- Nếu bạn đang kẹt vì mua trên máy cloud: mở app, đăng nhập Steam như bình
  thường rồi bấm "Đã mua trên máy này nhưng mất mã?" một lần — từ đó về sau mã
  đi theo tài khoản Steam của bạn.

## [1.37.2] — 2026-08-31

### Thêm

- **🧪 Minimap tiết kiệm CPU (Cài đặt → Bản đồ nhỏ).** Cách vẽ bản đồ mới giúp
  di chuyển mượt hơn nhiều trên máy CPU yếu, không dùng thêm GPU. Đang thử
  nghiệm nên mặc định TẮT; bật lên nếu overlay làm máy giật khi chạy cạnh game.
  Tắt thì hình ảnh y như cũ.

## [1.37.1] — 2026-08-31

### Thêm

- **⚡ Chế độ nhẹ (Cài đặt → Bản đồ nhỏ)** cho máy CPU yếu bị giật khi chạy
  overlay. Bật lên: minimap giới hạn ~24 hình/giây, ảnh bản đồ nhẹ hơn, bỏ hiệu
  ứng trượt mượt và lớp sương mù. Mặc định TẮT — máy khoẻ chạy y như cũ.

## [1.37.0] — 2026-08-31

### Sửa

- **Trình chỉnh skin bị "nhảy về đen".** Khi đang đăng nhập IslePilot, skin
  trong game cứ ~1 giây lại ghi đè màu bạn vừa chỉnh khiến không sửa được gì.
  Giờ trình chỉnh mặc định không bị game can thiệp; muốn skin đổi theo thời
  gian thực thì bật ô **"☁ Áp trực tiếp vào game khi chỉnh màu"** (lựa chọn
  này được nhớ). Tắt thì dùng nút **Áp dụng vào game** như cũ.

### Đổi

- **Mở app nhanh hơn.** Các tab nặng (bản đồ, khủng long, garage, skin) chỉ
  nạp khi bạn mở lần đầu, nên cửa sổ chính hiện lên nhẹ hơn hẳn.
- **Thẻ Người ủng hộ rõ hơn.** Khi đang chạy offline sẽ hiện "còn N ngày ân
  hạn"; nút Kiểm tra lại nổi bật hơn và có cả ở bản dùng thử; báo rõ lý do khi
  kích hoạt/kiểm tra thất bại.
- **"Đã mua trên máy này nhưng mất mã?"** — link mới ở thẻ Người ủng hộ: cài
  lại Windows xong bấm là lấy lại mã đã mua trên máy đó (không cần liên hệ).
- Tạm ẩn tiếng Bồ Đào Nha khỏi danh sách ngôn ngữ (mới dịch 9%, để lại tiếng
  Anh cho đến khi hoàn thiện).

## [1.36.2] — 2026-08-30

### Đổi

- **Áp skin vào game giờ bấm nút, không còn tự động.** Trong trình chỉnh skin,
  chọn màu xong bấm **"Áp dụng vào game"**. Kéo màu không còn làm game giật;
  bản xem trước trong app vẫn hiện ngay.
- Nút báo rõ đã áp dụng hay chưa, và báo khi chưa kết nối được IslePilot.

## [1.36.1] — 2026-08-30

### Đổi

- **Chỗ nhận "Mã miễn phí" nổi bật hẳn lên.** Trong **Cài đặt → Người ủng hộ**,
  nút **"🎁 Dùng thử 3 ngày miễn phí"** giờ là nút lớn full-chiều-ngang, nằm
  chung một khung với ô dán mã (`hoặc đã có mã?`) — không còn bị lẫn dưới danh
  sách quyền lợi. Ô dán mã cũng hiện trong lúc đang dùng thử (để đổi sang mã
  thật giữa chừng).
- **Bỏ điều kiện "mở app 3 lần mới cho dùng thử"** — nhiều người mới không thấy
  nút ở đâu. Chỉ cần mở app một lần. Chống lạm dụng vẫn nằm ở máy chủ (một máy
  một lần theo vân tay, trần theo IP mỗi ngày, chặn máy ảo).

## [1.36.0] — 2026-08-30

### Thêm

- **Ghi chú thay đổi hiện ngay trong app.** Khi có bản mới, banner cập nhật có
  mục **"Có gì mới"** bung ra được, lấy đúng phần CHANGELOG của phiên bản đó —
  không cần mở GitHub. Mục này ở Cài đặt cũng mở sẵn.

### Sửa

- **`latest.json` trỏ sai tên file** → auto-update báo 404. GitHub đổi dấu cách
  trong tên file cài thành dấu chấm (`TheIsle Overlay_…` → `TheIsle.Overlay_…`);
  workflow giờ lấy đúng tên GitHub đã lưu, ghi `latest.json` **không BOM**, và
  tự kiểm tra URL trả về 200 trước khi kết thúc. Bản `v1.35.0` đã được vá tay.
- CI (`ci.yml`) + Release (`release.yml`) ép `CARGO_TARGET_DIR` vào thư mục
  workspace (config ghi cứng đường dẫn máy maintainer) → cache Rust hoạt động,
  CI nhanh hơn, và bản cài nằm đúng chỗ.

## [1.35.0] — 2026-08-30

### Thêm

- **Dùng thử 3 ngày miễn phí.** Người mới bấm một nút ở **Cài đặt → Người ủng
  hộ** là mở khoá toàn bộ tính năng nâng cao trong 3 ngày, không cần trả tiền,
  không cần nhập gì. Hết hạn tự về bản miễn phí. **Một lần / máy** (máy chủ khoá
  theo vân tay máy + trần theo IP mỗi ngày). Hiện đếm ngược "còn N ngày".

### Đổi

- **Nhóm sinh tồn (G6)** chuyển sang tính năng người ủng hộ. Nút Tạo/Vào nhóm bị
  khoá kèm dấu ★ khi chưa có mã; ai đang trong nhóm vẫn xem/rời được.
- **Mức ủng hộ gợi ý: 30.000đ** (chuỗi hiển thị; giá thật lấy từ biến
  `PRICE_VND` của Worker — nhớ đặt `PRICE_VND=30000`).

### Chống gian lận / sao chép

- **Vân tay máy mạnh hơn:** thêm `MachineGuid` của Windows (giữ nguyên khi đổi
  tên PC/tài khoản; chỉ đổi khi cài lại Windows / khôi phục ảnh đĩa).
- **Cache license gắn với máy:** chữ ký HMAC giờ phủ cả vân tay máy + mốc thời
  gian ghi. Chép `license.json` sang máy khác → cache bị từ chối → buộc kiểm tra
  online (dính giới hạn đổi máy của máy chủ).
- **Chống lùi đồng hồ:** nếu đồng hồ hệ thống bị chỉnh lùi nhiều so với lần ghi
  cache gần nhất → cache bị nghi ngờ, buộc kiểm tra lại (chặn mẹo "lùi giờ để
  giữ trial/ân hạn").
- **Phát hiện chia sẻ mã:** khi bật telemetry, mỗi ping gửi kèm *hash ngắn* của
  mã đang dùng + vân tay máy. Cron ban đêm tự **thu hồi** mã bị thấy trên >4 máy
  trong 10 ngày. Chưa bật telemetry thì phần này nằm im.
- **Rate-limit** `/v1/license/validate` + `/trial` theo IP (15 lần/phút) — chặn
  dò mã / spam trial.
- **Chống trial trên máy ảo:** app nhận diện VMware/VirtualBox/Hyper-V/QEMU qua
  SMBIOS; máy chủ từ chối cấp trial (không lộ lý do).
- **Trial chỉ mở sau 3 lần chạy app** — cài-bấm-gỡ không tiện.
- **Làm rối bundle JS** (đổi tên định danh, nén) cho code riêng của app trong
  bản release — lớp phụ, gate thật vẫn ở Rust. Thư viện 3D/bản đồ không đụng tới.
- **Điều khoản sử dụng** (`EULA.txt`) hiện trong trình cài đặt: cấm bán lại mã,
  đóng gói lại, vô hiệu hoá kiểm tra bản quyền.
- Trial: một mã `TRIAL-…` riêng, hết hạn cứng 3 ngày, leash offline ngắn (tin
  2 ngày + 3 ngày ân hạn).

### Kỹ thuật

- Rust `license.rs`: `Cache` += `until`/`fp`/`seen_ms`; `machine_guid()` (đọc
  registry, có sẵn ở `telemetry/mod.rs` pattern); `start_trial()`; `status()`
  xử lý trial + hết hạn. Lệnh `license_trial`. Gate `team_create`/`team_join`.
- Worker: `0004_trial.sql` (`license_expiry`, `trial_ip`); `POST /v1/license/
  trial` (một lần/vân tay + trần {TRIAL_IP_MAX}/IP/ngày); `validate` trả `until`
  và từ chối `expired`.
- Frontend: `isSupporter()` = supporter **hoặc** trial; `trialDaysLeft()`;
  `SupporterCard` nút dùng thử + đếm ngược; `DinoTab` khoá nhóm; i18n `sup.trial_*`.
- Worker `0005_abuse.sql` (`license_lk`, `license_seen`); `RL_LICENSE` binding;
  `recordLk` sau mọi lượt mint; `ping.ts` ghi `license_seen`; `cron.ts` tự thu
  hồi mã dùng chung. Rust `active_key_hash()` + `looks_like_vm()` + đếm lượt
  chạy `settings.meta.runs` (bump `recursion_limit` do json! macro).
  `vite-plugin-javascript-obfuscator` (chỉ `build`, chỉ code app).
  `bundle.licenseFile` = `EULA.txt`.

## [1.34.0] — 2026-08-30

### Đổi

- **Tách kho mã nguồn.** Mã nguồn + CI chuyển sang repo **riêng tư** của BumBum.
  Repo `github.com/tnqaquocanh-vn/theisle-overlay` giữ **public** làm *trang
  phát hành*: chỉ còn README / LICENSE / THIRD-PARTY-NOTICES / CHANGELOG + các
  bản cài. URL auto-update **không đổi** — người dùng cũ cập nhật bình thường.
- CI ở repo riêng build rồi đẩy bản cài + `latest.json` sang repo public (qua
  token `RELEASE_PAT`), đồng thời đồng bộ CHANGELOG.
- Không thay đổi gì trong ứng dụng — bản này chỉ để xác nhận đường phát hành mới.

## [1.33.1] — 2026-08-30

### Đổi

- **Biểu tượng ứng dụng mới** — kim la bàn (bắc màu hổ phách, nam xám ấm) trên
  đĩa minimap, đúng bảng màu Amber. Nguồn vector ở `src-tauri/icons/app-icon.svg`;
  tạo lại toàn bộ bộ icon bằng `tauri icon`. Tray icon lấy theo bộ mới tự động.

## [1.33.0] — 2026-08-30

### Đổi

- **Hoàn tất giới hạn bản miễn phí ↔ người ủng hộ (§02).** Toàn bộ phần lõi vẫn
  miễn phí (bản đồ, minimap, waypoint, đường đi, chỉ số khủng long, Garage, chỉnh
  skin cục bộ + xuất mã game, xem lại hành trình cơ bản). Các tính năng nâng cao
  giờ cần mã người ủng hộ:
  - **Cửa sổ Bảng phụ** (companion) — đã khoá từ v1.31.
  - **Bản đồ lớn trong game** (Ctrl+Alt+G) — phím tắt hiện thông báo nhẹ thay
    vì mở.
  - **Nền bản đồ IsleMaps** (sáng/tối) — nút bị khoá, Vulnona vẫn miễn phí.
  - **Lớp chỉ số khi xem lại hành trình** + **xuất `.geojson`** — thanh tua vẫn
    miễn phí.
  - **Tự áp preset theo loài** khi đổi khủng long.
  - **Âm thanh cảnh báo** HUD.
  - **Bảng chẩn đoán** minimap (render-ms / fps).
  - **Skin**: áp trực tiếp lên khủng long + preset đám mây (chỉnh + xuất mã game
    vẫn miễn phí; bản free lưu tối đa 3 preset cục bộ — từ v1.31).
- Nút / ô cài đặt của các mục trên hiện dấu **★** và bị mờ khi chưa có mã; bấm
  vào phần bị khoá sẽ nhắc mở mục **Cài đặt → Người ủng hộ**.

### Kỹ thuật

- Rust là "nguồn sự thật": `commands::clamp_supporter_settings` ép
  `minimap.diagnostics` / `minimap.auto_preset` / `sound.enabled` về false và
  nền IsleMaps về `vulnona` cho mọi cửa sổ (bản lưu trên đĩa giữ nguyên lựa
  chọn — hồi lại khi gia hạn). Gate ở `bigmap::toggle`,
  `set_basemap_source`, `export_trail_geojson`, `get_trail_stats`,
  `islepilot_send_liveskin`, `islepilot_skin_preset`,
  `islepilot::maybe_auto_preset`. `license_activate/refresh/clear` phát lại
  `settings://changed` để mọi cửa sổ áp lại clamp ngay.
- Frontend: badge ★ + trạng thái mờ ở `Settings.svelte`, `SkinEditor.svelte`;
  `FullMap.svelte` bắt lỗi `supporter_required` khi xuất `.geojson`.

## [1.32.0] — 2026-08-30

### Thêm

- **Mua mã ngay trong app (chuyển khoản Việt Nam, tự động).** Cài đặt → Người
  ủng hộ → **💳 Mua mã**: app xin máy chủ một *mã đơn*, hiện **QR VietQR** (nội
  dung chuyển khoản = mã đơn), rồi tự hỏi máy chủ tới khi webhook **SePay** báo
  đã nhận tiền → tự mint mã + tự kích hoạt. Không copy/paste gì.
  - Đơn hết hạn sau 30 phút; có nút Huỷ / Tạo đơn mới; đếm ngược thời gian.
  - Có nút chép nhanh số TK + nội dung để chuyển tay nếu không quét QR được.
  - Máy chủ chưa cấu hình ngân hàng → nút hiện thông báo nhẹ, không lỗi.
- Cứu hộ thủ công: `npm run license -- order-paid TIOxxxxxx` (khách đã trả nhưng
  webhook không về — sai nội dung, thiếu tiền, SePay lỗi). `npm run license --
  orders` xem 100 đơn gần nhất.

### Kỹ thuật

- Worker: bảng `license_order` (`0003_orders.sql`); route `POST /v1/license/
  order/new`, `GET /v1/license/order/{code}?fp=`, webhook `POST /v1/license/
  sepay` (auth `Authorization: Apikey <SEPAY_API_KEY>`), admin `POST /admin/
  license/order/paid` + `GET /admin/license/order/list`. Biến môi trường
  `PRICE_VND` / `ORDER_TTL_MIN` / `BANK_BIN` / `BANK_ACCOUNT` / `BANK_NAME` +
  secret `SEPAY_API_KEY`. Cron dọn đơn quá hạn.
- Rust: `license::order_new` / `order_poll` (gắn `fp` — chỉ máy mở đơn mới nhận
  được mã); lệnh `license_order_new` / `license_order_poll`.
- Frontend: `SupporterCard.svelte` thêm luồng mua (state machine + poll 5 giây),
  `api.ts` `LicenseOrder` / `licenseOrderNew` / `licenseOrderPoll`, i18n
  `sup.buy_*`.

## [1.31.1] — 2026-08-30

### Sửa

- **Hoàn tác đổi mã định danh.** `tauri.conf.json` `identifier` quay lại
  `io.github.mxhios.theisle-overlay` (v1.31.0 đã đổi thành `com.bumbum.*`).
  Lý do: Tauri khoá khoá gỡ cài đặt (registry) theo `identifier`, nên đổi nó
  làm bản cũ update tự động lên v1.31.0 để lại một mục "thừa" trong *Add or
  remove programs*. Giữ đúng chuỗi cũ = mọi lần update tự động đều liền mạch.
  Chuỗi này chỉ nằm trong registry/installer, người dùng không thấy; công tác
  giả gốc đã được ghi ở `THIRD-PARTY-NOTICES.md`.
  **Đừng đổi lại giá trị này** — mọi bản đã phát hành đều dùng nó.
- Dữ liệu/cài đặt người dùng không bị ảnh hưởng ở cả hai chiều (chúng nằm ở
  `%APPDATA%\TheIsleOverlay`, dùng hằng số `APP_DIR_NAME`, không dính
  `identifier`).

## [1.31.0] — 2026-08-30

### Thêm

- **Hệ thống người ủng hộ (license).** Toàn bộ tính năng cốt lõi vẫn miễn phí;
  một vài tiện ích nâng cao mở khoá bằng mã ủng hộ **trọn đời** (`BUMBUM-XXXX-
  XXXX-XXXX`). Mục **Cài đặt → Người ủng hộ**: dán mã → Kích hoạt; hiển thị
  trạng thái, nút Kiểm tra lại / Gỡ mã; link "Lấy mã ủng hộ".
  - Xác thực qua `worker/` (`POST /v1/license/validate`), buộc theo một vân tay
    máy mềm (env-based, HMAC-SHA256) với **2 lần đổi máy/tháng**.
  - Kết quả lưu cache cục bộ có **chữ ký HMAC** (`%APPDATA%\TheIsleOverlay\
    license.json`): tin trong 14 ngày offline, ân hạn thêm 3 ngày, sau đó khoá
    lại phần nâng cao — **phần cốt lõi không bao giờ bị khoá**.
  - Cấp mã: thủ công (`POST /admin/license/mint`) cho người thân/bạn bè, hoặc
    **tự động qua webhook Ko-fi** (`POST /v1/license/kofi`).
- **Giới hạn phiên bản miễn phí (đợt thí điểm):**
  - Cửa sổ **Bảng phụ** (companion, màn hình 2) → người ủng hộ. Nút mở bị khoá
    kèm gợi ý; phím tắt Ctrl+Alt+D hiện thông báo nhẹ thay vì mở.
  - **Trình chỉnh skin**: bản miễn phí lưu tối đa **3 skin** ở máy; người ủng hộ
    không giới hạn. (Áp skin trực tiếp + preset đám mây sẽ chuyển sang người
    ủng hộ ở đợt sau.)

### Đổi

- **README** viết lại phần giới thiệu theo BumBum: gỡ video hướng dẫn của tác
  giả cũ, bổ sung các tính năng đã thêm (xem lại hành trình, bảng phụ, trình
  chỉnh skin, giết khủng long), trỏ giấy phép về `LICENSE` +
  `THIRD-PARTY-NOTICES.md`.
- **Giấy phép:** thêm `LICENSE` (MIT — BumBum, có giữ dòng bản quyền nguồn gốc)
  và `THIRD-PARTY-NOTICES.md` (liệt kê đầy đủ IsleLiveMap, overlay gốc, nguồn
  skin, font, dữ liệu bản đồ).
- **Định danh app** đổi thành `com.bumbum.theisle-overlay` (dữ liệu người dùng
  KHÔNG mất — thư mục dữ liệu dùng hằng số `TheIsleOverlay`, không phải
  identifier).
- Build release siết lại (`[profile.release]`: `strip`, `lto = "fat"`,
  `codegen-units = 1`, `opt-level = "s"` — không `panic = "abort"`) để giảm khả
  năng sao chép/đọc ngược.

### Kỹ thuật

- Rust: `src-tauri/src/license.rs` (client + cache ký HMAC + `is_supporter()`
  qua `AtomicBool`); lệnh `license_status` / `license_activate` /
  `license_refresh` / `license_clear`; `companion::toggle` chặn khi chưa phải
  người ủng hộ và phát sự kiện `license://required`.
- Worker: bảng `license` (`0002_licenses.sql`), `worker/src/license.ts`
  (validate + Ko-fi webhook + admin mint/revoke/list), biến môi trường
  `KOFI_VERIFICATION_TOKEN` / `KOFI_MIN`.
- Frontend: `src/lib/license.svelte.ts` (`isSupporter()`), `api.ts` wrappers +
  `LicenseStatus`, `onSupporterRequired`; `SupporterCard.svelte`; App.svelte
  nạp trạng thái khi khởi động + toast "cần người ủng hộ".
- Allowlist mở URL thêm `ko-fi.com`, `www.paypal.com`, `paypal.me`.

## [1.30.1] — 2026-08-30

### Đổi

- **Đổi thương hiệu → BumBum.** Gỡ thông tin tác giả cũ khỏi phần người dùng
  nhìn thấy: footer ("TheIsle Overlay · phát triển bởi BumBum"), link GitHub
  trỏ về repo hiện tại, mục Liên hệ trong README (bỏ email/Facebook cá nhân +
  ảnh QR ủng hộ cũ). Endpoint telemetry đổi khỏi tên miền tác giả cũ (telemetry
  vẫn tắt cho tới khi bạn tự deploy `worker/`). Allowlist mở URL cập nhật theo
  repo mới.
- Ghi chú attribution trong mã nguồn (các đoạn port từ IsleLiveMap/overlay gốc,
  MIT) **giữ nguyên** — xoá đi là vi phạm giấy phép. Xem kế hoạch giấy phép để
  xử lý đúng cách.

## [1.30.0] — 2026-08-30

### Thêm

- **Giết khủng long (Slay)** — như trên web IslePilot. Nút **💀 Giết khủng long**
  ở tab **Garage**, chỉ hiện khi server cho phép (`selfSlayEnabled`). Có hộp
  xác nhận cảnh báo (con này chết ngay trong game, không lấy lại được). Dùng
  chung cơ chế lệnh bất đồng bộ với Park/Restore/Sell
  (`POST /api/overlay/garage/slay`).

### Kỹ thuật

- Rust: `GarageState.self_slay_enabled` (từ `settings.selfSlayEnabled`);
  lệnh `islepilot_garage_slay`. `api.ts`: `GarageState.selfSlayEnabled` +
  `islepilotGarageSlay`.

## [1.29.2] — 2026-08-30

### Thêm

- **Xem trước Pattern trong tab Skin.** Bộ chọn Pattern (thêm ở v1.29.1) giờ
  đổi cả model 3D — dùng đúng ảnh pattern của loài. Loài có 3–5 pattern; chọn
  quá số đó thì preview lùi về pattern 1 kèm ghi chú, nhưng **mã game vẫn xuất
  đúng chỉ số pattern**.

### Kỹ thuật

- `skin.ts`: `buildSkin` / `skinKey` nhận thêm tham số `pattern`; hàm
  `patternUrls(entry, pattern)` (lùi về "1" → pattern đầu tiên).
  `DinoViewer3D` thêm prop `pattern` — đổi pattern đi qua đường `recolor()`
  nhanh, giữ camera + animation.

## [1.29.1] — 2026-08-30

### Thêm

- **Mã skin dùng được với game.** Nút **⧉ Sao chép mã game** trong tab Skin
  xuất đúng định dạng skin gốc của The Isle Evrima
  (`<Loài><Pattern><Variation><Theme>` + 5 màu `RRGGBBAA`) — dán thẳng vào nút
  **Import** trong màn chỉnh nhân vật của game. **⇤ Dán mã** tự nhận cả mã game
  lẫn mã app (`tio-skin:`). Thêm bộ chọn **Pattern** (1–8) vì mã game có mang
  chỉ số pattern.
- Nút **⧉ Mã app** riêng cho chia sẻ giữa người dùng overlay
  (`tio-skin:1|loài|hex×10`).

### Sửa lỗi

- Nút Sao chép / Dán mã dùng **clipboard Tauri chuẩn**
  (`plugin-clipboard-manager`) thay cho `navigator.clipboard` — trước đây
  "sao chép không ra" trong cửa sổ Tauri.

### Không đổi

- Định dạng đẩy skin qua **live apply (WebSocket `liveskin`)** giữ nguyên
  (`{skin_body_r: 0.4, …}` RGB float, đủ 10 kênh như overlay gốc).

## [1.29.0] — 2026-08-30

### Thêm

- **Trình chỉnh Skin** — tab mới trên rail điều hướng. Chỉnh màu da khủng long
  và xem trực tiếp trên model 3D (dùng lại pipeline dựng skin sẵn có của
  Garage). Nghiên cứu từ skin editor của overlay gốc *TheIsleVN-Gacha-HUD*.
  - **10 kênh màu** có nhãn theo ngôn ngữ app (Thân · Hông · Bụng · Hoa văn ·
    Màu phô diễn · Chi tiết · Mắt · Răng · Miệng · Vuốt): mỗi ô = swatch +
    bộ chọn màu + ô hex sửa tay.
  - **🎲 Ngẫu nhiên** (random cả 10 kênh) · **↺ Đặt lại** · **⧉ Sao chép mã** /
    **⇤ Dán mã** — chuỗi `tio-skin:1|loài|hex×10` để chia sẻ Discord.
  - **Preset cục bộ**: lưu palette + tên, dòng chip (tag loài), xoá được — ở
    `settings.skin_presets`. Nhớ palette đang chỉnh dở qua `localStorage`.
  - Chọn 21 loài có model 3D; tự chọn theo loài đang chơi. Guard
    `#000000` → `#000001` như app gốc.
- **Áp trực tiếp lên khủng long qua IslePilot** (tùy chọn, chỉ khi đăng nhập
  Steam / token mode). Bật ở tab Skin → kéo màu là gửi ngay qua WebSocket
  realtime (`liveskin`); đồng bộ 2 chiều (màu đổi ở nơi khác → cập nhật lại
  ô màu). Nút **☁ Lưu lên IslePilot** + dòng preset trên server (áp / xoá).

### Kỹ thuật

- `DinoViewer3D.svelte`: thêm đường `recolor()` — đổi màu chỉ hoán 2
  `CanvasTexture` trên material đang chạy (skin.ts cache), giữ camera +
  animation; `$effect` tách nhánh cùng-loài / khác-loài. Debounce palette →
  viewer 180&nbsp;ms.
- Rust: `islepilot/api.rs` `skin_get` / `skin_preset_action`
  (`/api/overlay/skin`, `/api/overlay/skin/presets`); `realtime.rs` OUTBOX +
  `drain_outbox` gửi `{t:"liveskin"}` mỗi vòng lặp socket + `LiveData.skin` →
  emit `dino://skin`. Lệnh `islepilot_skin` / `islepilot_skin_preset` /
  `islepilot_send_liveskin`.
- `settings.skin_presets: []` (+ merge test). i18n +34 khoá `skin.*` /
  `tab.skin` (vi + en) → 470/470. Baseline hình ảnh `skin-editor`.
- Bộ khung test bản đồ lớn (`tauri-mock` cờ `fullmap`) + spec
  `fullmap` / `replay` / `companion` (bù coverage còn thiếu).

## [1.28.1] — 2026-08-30

### Sửa lỗi

- **Tab Khủng long (và bảng phụ) sập khi khủng long có 2 nhiệm vụ Prime trùng
  tên.** Danh sách Prime được `{#each}` khoá theo *nội dung nhiệm vụ*, mà game
  hoàn toàn có thể giao 2 nhiệm vụ chữ y hệt nhau → Svelte ném
  `each_key_duplicate` → cả tab rơi vào ranh giới lỗi ("Phần Khủng long gặp
  lỗi"). Nay khoá theo chỉ số. Sửa ở cả 4 chỗ: danh sách Prime + roster đội
  trong tab Khủng long, và trong cửa sổ bảng phụ. Kèm test hồi quy
  `dino-dupe-quests`.

### Thêm

- **Bảng phụ nhớ kích thước + vị trí.** Cửa sổ Companion giờ mở lại đúng chỗ
  và đúng cỡ bạn để lần trước (lưu khi rời cửa sổ / đóng). Nút **⊟/⊞** trên
  thanh tiêu đề bật **chế độ gọn** — ẩn bản đồ, chỉ hiện cột chỉ số/đội/nhiệm
  vụ (hợp màn phụ nhỏ). `settings.companion` giữ `w/h/x/y/compact`.

## [1.28.0] — 2026-08-30

### Thêm

- **Tự động cập nhật trong ứng dụng.** App kiểm tra bản phát hành mới và cho
  cập nhật bằng một nút bấm — người dùng không phải tải lại thủ công.
  - **Tự kiểm tra khi khởi động** (mặc định bật, tắt được ở **Cài đặt → Nâng
    cao → Cập nhật ứng dụng**): chỉ tải một file thông tin phiên bản
    (`latest.json`) từ trang phát hành, không tự tải/tự cài.
  - Có bản mới → hiện dải xanh ở đầu cửa sổ: **"Có bản mới X"** + nút **Tải &
    cài đặt** (thanh tiến độ) → app tự cài rồi khởi động lại. Kèm nút **Kiểm
    tra cập nhật** thủ công + xem "Có gì mới" trong Cài đặt.
  - Bản cập nhật được **ký số** (minisign); app từ chối bất kỳ gói nào không
    khớp khoá công khai nhúng sẵn.

### Kỹ thuật

- Thêm `tauri-plugin-updater` + `tauri-plugin-process`; `plugins.updater`
  (`pubkey` + `endpoints`) và `bundle.createUpdaterArtifacts` trong
  `tauri.conf.json`; capability `updater:default` + `process:allow-restart`.
- `src/lib/updater.svelte.ts` — máy trạng thái nhỏ dùng chung
  (`checkForUpdate` / `installUpdate`); dải báo trong `App.svelte`; thẻ
  `UpdateCard.svelte` trong Cài đặt. Setting `updates.auto_check`. i18n +14
  khoá `update.*` (vi + en) → 434/434.
- `.github/workflows/release.yml`: `includeUpdaterJson: true` + 2 secret
  `TAURI_SIGNING_PRIVATE_KEY` / `..._PASSWORD` → mỗi tag tự đăng `latest.json`
  + `.exe` + `.sig` lên GitHub Release. **Cần đặt repo của bạn** vào
  `tauri.conf.json → plugins.updater.endpoints` (đang để placeholder
  `__GH_OWNER__/__GH_REPO__`).

## [1.27.2] — 2026-08-30

### Thêm

- **A6 — lớp phủ chỉ số theo thời gian trên thanh tua.** Khi tua lại một phiên,
  nếu phiên đó có **lịch sử chỉ số** (bật ở Khủng long → "Lưu lịch sử chỉ số"),
  thanh tua hiện thêm một dải sparkline nhỏ: **máu (đỏ) · đói (hổ phách) · khát
  (teal)** theo đúng khoảng thời gian thật của phiên, kèm vạch con trỏ chạy
  theo điểm tua và số % đọc tại vị trí con trỏ. Phiên không có lịch sử (tắt tính
  năng, hoặc cũ hơn) thì không hiện dải này.

### Kỹ thuật

- `store::ReplayPoint` thêm `real_ms` (mốc epoch thật từng điểm) → lệnh
  `get_trail_replay` trả kèm `realMs`, để lồng đồng hồ phát (đã nén) khớp với
  trục thời gian thật.
- `islepilot::history::query_between(start_s, end_s)` — cửa sổ mẫu lịch sử theo
  khoảng thời gian bất kỳ (khác `query` vốn theo "đoạn hiện tại / mốc chết");
  lệnh `get_trail_stats(startMs, endMs)`. +2 unit test.
- Frontend: `getTrailStats` + `replayRealMsAt` + dải SVG 3 đường trong
  `FullMap.svelte` (không dùng khoá i18n mới — tái dùng `dino.health/hunger/thirst`).

## [1.27.1] — 2026-08-30

### Thêm

- **A7 — bảng phụ cho màn hình 2 (Companion).** Một **cửa sổ dashboard riêng**
  (có thanh tiêu đề, có trong taskbar — không phải overlay), mở bằng phím tắt
  **`Ctrl+Alt+D`** hoặc nút **Cài đặt → Bản đồ nhỏ (HUD) → Bảng phụ → "Mở bảng
  phụ"**. Bố cục: **bản đồ lớn** bên trái + cột bên phải gồm
  - **Chỉ số khủng long** gọn: tên · ♀/♂ · chip Online/Prime · thanh
    Growth/HP/Đói/Khát/Thể lực · biểu đồ tam giác dinh dưỡng;
  - **Đội sinh tồn**: danh sách thành viên + % máu (màu theo ngưỡng), mờ đi
    khi offline;
  - **Nhiệm vụ Prime**: thanh tiến độ + danh sách ✓/○.

  Tất cả lấy từ sự kiện sẵn có (`dino://update`, `team://status`,
  `settings://changed`) — dùng lại đúng `<FullMap>` của cửa sổ chính. Nút ✕
  trên thanh tiêu đề **ẩn** cửa sổ (mở lại tức thì, giữ nguyên zoom bản đồ),
  không đóng hẳn. Không đọc gì từ game.

### Kỹ thuật

- Cửa sổ webview thứ 4 (`companion`): `companion.html` + `src/companion/`;
  `companion.rs` (cửa sổ thường, `min_inner_size` 760×520, `center()`, chặn
  `CloseRequested` → `hide()`); lệnh `toggle_companion`; phím tắt
  `Ctrl+Alt+D`; capability + entry Vite thứ 4. `<FullMap>` chỉ "un-park" khi
  cửa sổ thực sự hiện (sự kiện `companion://vis`, cùng cách `bigmap://vis`).
- i18n: 7 khoá `companion.*` + `hotkey.toggle_companion` (vi + en) → 420/420.
- Bundle `companion` 3.0&nbsp;kB gzip (19% ngân sách).

## [1.27.0] — 2026-08-30

### Thêm

- **A6 — tua lại phiên chơi (lõi).** Trong panel lớp của bản đồ lớn, mục
  **"Phiên trước"** giờ có nút ▶ bên cạnh mỗi phiên: bấm để nạp phiên đó vào
  thanh tua ở đáy bản đồ.
  - Thanh tua có **phát/tạm dừng**, thanh kéo thời gian, **tốc độ 1× / 4× /
    16×**, và nút **xuất `.geojson`**.
  - Một điểm dấu (vòng hổ phách) chạy dọc đường đi đúng theo mốc thời gian
    từng điểm trong file trail. Đoạn nghỉ dài (AFK) và mốc "ngắt" được nén
    lại thành bước nhảy ngắn để không phải kéo qua khoảng chết.
  - **Xuất đường di cư**: ghi phiên ra file GeoJSON `FeatureCollection` (mỗi
    đoạn liền mạch là một `LineString`, toạ độ theo cm thế giới) để chia sẻ
    hoặc mở bằng công cụ GIS.
  - Hoàn toàn đọc dữ liệu đã lưu trên máy — không đụng gì tới game.

### Kỹ thuật

- Rust: `store::load_trail_replay` đọc file trail kèm mốc thời gian ISO từng
  điểm (trước đây `load_trail` bỏ mốc `t`), dựng đồng hồ phát nén; lệnh
  `get_trail_replay` (chiếu theo calibration hiện hành) và `export_trail_geojson`.
  Kèm 1 unit test cho việc nén đồng hồ.
- Frontend: `getTrailReplay` / `exportTrailGeojson` trong `api.ts`; thanh tua +
  điểm dấu replay trong `FullMap.svelte`; 12 khoá i18n `replay.*` (vi + en).

## [1.26.11] — 2026-08-30

### Thêm

- **A2 — đổi thứ tự các bảng HUD.** Ở **Cài đặt → Bản đồ nhỏ (HUD)**, dùng
  nút ↑/↓ để xếp lại thứ tự 3 bảng dưới đĩa (**chỉ số khủng long · nhiệm vụ
  Prime · đồng đội**) — ví dụ đưa bảng nhiệm vụ lên ngay dưới đĩa. Kích thước
  cửa sổ HUD không đổi (tổng chiều cao như nhau), chỉ đổi chỗ. Kèm test hình
  ảnh mới cho thứ tự đảo.

## [1.26.10] — 2026-08-30

### Thêm

- **A4 — tự đổi preset theo loài.** Bật ở **Cài đặt → Bản đồ nhỏ (HUD) → "Tự
  áp preset trùng tên loài"**: khi IslePilot báo bạn đổi sang loài khác, nếu có
  preset overlay tên trùng loài đó (không phân biệt hoa thường, khớp một phần)
  thì tự áp luôn — ví dụ đặt preset tên "Steg" cho lối chơi Stegosaurus. Mặc
  định tắt; bật lên chỉ có tác dụng từ lần đổi loài kế tiếp.

## [1.26.9] — 2026-08-30

### Thêm

- **A10 — âm báo trong game** (mặc định tắt). Bật ở **Cài đặt → Bản đồ nhỏ
  (HUD) → "Âm báo trong game"**: tiếng bíp ngắn khi
  - đồng đội ping "chạm địch"
  - đồng đội tụt dưới 25% máu
  - mất tín hiệu vị trí

  Tiếng tổng hợp bằng Web Audio (không đính kèm file, không thêm bề mặt CSP).
  Chế độ solo tắt luôn âm báo đồng đội.

## [1.26.8] — 2026-08-30

### Thêm

- **A5 — chế độ solo.** Bật ở **Cài đặt → Bản đồ nhỏ (HUD) → "Chế độ solo"**:
  ẩn hết đồng đội, chấm nhóm và ping "chạm địch" khỏi cả bản đồ nhỏ lẫn bản đồ
  lớn — để chơi một mình gọn gàng mà **không cần rời đội**. Tắt là mọi thứ
  hiện lại như cũ.

## [1.26.7] — 2026-08-30

### Thay đổi

Dọn dẹp sau đợt rà soát:

- **Bản đồ to tự dựng lại khi đổi bản đồ nền / bảng màu.** Trước đây đổi bản đồ
  nền lúc đang mở bản đồ to thì hình học bị lệch tới khi đóng/mở lại; giờ nó
  tự làm mới như cửa sổ chính.
- **CI chạy luôn bộ test hình ảnh + hiệu năng.** Job `visual` mới (windows,
  khớp baseline `win32`) chạy 10 spec Playwright mỗi lần push — bắt lỗi lệch
  giao diện và `render()` chậm tự động.
- Thêm unit test cho logic phát hiện chết (tách thành hàm thuần
  `is_death_transition`), gồm ca hồi quy cho lỗi cắm nhầm ở v1.26.6.

## [1.26.6] — 2026-08-30

### Sửa lỗi

Đợt rà soát tổng thể sau nhánh Amber:

- **Ghim bản đồ to không còn tự đóng.** Khi ghim, cửa sổ bản đồ giành focus →
  luồng giám sát tưởng bạn Alt-Tab khỏi game và ẩn nó đi sau ~0,5&nbsp;giây.
  Giờ khi bản đồ to đang là cửa sổ trước (hoặc đang ghim) thì không auto-ẩn.
- **Điểm chết không còn cắm nhầm khi mạng chập chờn.** Một bản cập nhật
  IslePilot lỗi mạng (không có dữ liệu khủng long *kèm* thông báo lỗi) từng bị
  hiểu là "đã chết" và cắm 💀 nhầm. Giờ chỉ cắm khi khủng long **thực sự** mất
  (không kèm lỗi) hoặc máu về 0.
- Dòng gợi ý dinh dưỡng trên HUD có thêm chút khoảng trống, không còn dính sát
  mép bảng.

## [1.26.5] — 2026-08-29

### Thay đổi

- **Ping "chạm địch" của đội giờ là vùng cảnh giác 3 phút.** Trước đây một ping
  đồng đội (`Ctrl+Alt+X`) chỉ hiện vòng nhỏ ~12&nbsp;giây. Giờ nó vẽ một
  **vùng nguy hiểm mờ đỏ** quanh điểm đó, giữ **~3 phút** và **nhạt dần** theo
  thời gian, trên cả bản đồ nhỏ lẫn bản đồ lớn — để cả đội biết khu vực nào
  vừa có thú săn. Vẫn không đọc gì từ game (ping do người bấm).

## [1.26.4] — 2026-08-29

### Thêm

- **A5 — tự cắm điểm chết.** Khi IslePilot báo khủng long chết (máu về 0 hoặc
  mất dino), tự cắm một waypoint **💀 Điểm chết** ở vị trí cuối cùng, gom vào
  thư mục "Điểm chết", và **chia sẻ cho đội** nếu đang trong đội — để quay lại
  lấy xác mà không cần nhớ tọa độ. Là waypoint bình thường: xoá được, hiện
  trên cả bản đồ nhỏ / lớn / bản đồ to. Tắt ở **Khủng long → "Tự cắm điểm chết
  khi khủng long chết"**. Chống nhấp nháy: tối đa 1 điểm/60&nbsp;giây. Không
  đọc gì từ game — vị trí lấy từ nguồn vị trí sẵn có.

## [1.26.3] — 2026-08-29

### Thêm

- **Tripwire thời gian vẽ cho `render()`** (hoàn tất B3). `tests/perf/
  minimap-bench.html` chạy `render()` 300 khung mô phỏng lúc xoay hướng (vị
  trí không đổi → cache khung nền phải giữ) + `tests/visual/minimap-perf.spec.ts`:
  fail nếu thời gian trung bình vượt ngưỡng, hoặc nếu burst xoay hướng phải
  cắt lại ảnh nền (cache hỏng). Hiện: **0,02&nbsp;ms/khung, 0 lần cắt lại**.
  Chạy cục bộ cùng bộ test hình ảnh (`npm run test:visual`).

## [1.26.2] — 2026-08-29

### Thay đổi

- **Bản đồ nhỏ: cache khung nền.** Việc cắt ảnh nền quanh người chơi là thao
  tác nặng nhất mỗi khung, mà nó chỉ đổi khi **di chuyển / zoom**, không đổi
  khi xoay hướng hay khi thanh HP đập. Giờ khung nền được cache và chỉ cắt
  lại khi thực sự cần — lúc xoay hướng chỉ còn một lần vẽ 1:1 rất rẻ thay vì
  resample cả ảnh ~3900&nbsp;px mỗi khung. Chỉ số chẩn đoán thêm `re<N>` (số
  lần cắt lại — nên tăng khi đi, đứng yên/xoay hướng thì không).
- Kết quả vẽ không đổi một pixel; thêm test hình ảnh có ảnh nền thật để bọc
  đường cache.

## [1.26.1] — 2026-08-29

### Thêm

- **Chỉ số chẩn đoán trên bản đồ nhỏ** — bật ở **Cài đặt → Bản đồ nhỏ (HUD) →
  "Hiện chỉ số chẩn đoán trên đĩa"**: một dòng nhỏ góc trên-trái đĩa hiện
  **thời gian vẽ mỗi khung** (ms) và **số lần vẽ lại/giây**. Số lần vẽ là
  nhịp thật — cửa sổ này chỉ vẽ khi có dữ liệu/animation, nên lúc đứng yên là
  0, lúc xoay hướng là ~60. Chữ đỏ nếu khung > 6&nbsp;ms. Mặc định tắt, không
  tốn gì khi không bật.
  - `render()` giờ bọc `renderInner()` để đo — logic vẽ không đổi một dòng.

## [1.26.0] — 2026-08-29

Bắt đầu đợt tối ưu vòng 3. Đợt này: **cổng ngân sách kích thước bundle (B3)**.

### Thêm

- **`scripts/check-bundle-size.mjs`** + bước CI mới (sau `npm run build`): gzip
  từng chunk JS trong `dist/assets`, so với ngưỡng khai trong script, fail nếu
  vượt hoặc nếu có chunk mới > 20&nbsp;kB chưa khai ngân sách. Chốt các bất
  biến quan trọng: **`main` và `minimap` phải nhỏ** — nếu `three` (~189&nbsp;kB
  gzip) hay Leaflet lọt vào một trong hai thì cổng nổ ngay. "Nhẹ / khởi động
  nhanh" thành số build ép, giống `check-i18n` / `check-versions`.
  - Hiện tại: `three.module` 189&nbsp;kB (lazy) · `FullMap` 90&nbsp;kB (tách
    riêng, dùng chung cửa sổ chính + bản đồ to) · `main` 38&nbsp;kB ·
    `minimap` 10&nbsp;kB · tổng JS gzip 356&nbsp;kB. Tất cả 34–80% ngân sách.
  - Chạy tay: `npm run size` (sau `npm run build`).

## [1.25.5] — 2026-08-29

### Thêm

- **Gợi ý dinh dưỡng giờ ghi tên món cụ thể.** Dữ liệu tách ra một file
  duy nhất, dễ sửa — `src/lib/dino-diets.data.ts` — để cập nhật theo từng
  patch bằng một dòng.
  - **Loài ăn thịt:** đúng nội tạng — carb → **Phổi** (2 lá/xác), đạm →
    **Tim**, béo → **Ruột** (nguồn: Steam guide 3440690332 + wiki Diet System).
  - **Loài ăn cỏ:** liệt kê món ưu tiên của loài — hiện có Tenontosaurus
    (Mountain Ash · Wild Potato Root · Radish Root) đầy đủ; Stegosaurus,
    Dryosaurus, Pachycephalosaurus, Hypsilophodon có một phần (bổ sung món thứ
    3 khi chơi in-game). Loài chưa có dữ liệu → gợi ý chung "ăn đa dạng nhiều
    cây".
  - Áp cho cả thẻ trong ứng dụng lẫn dòng HUD trong game.

## [1.25.4] — 2026-08-29

### Thêm

- **Gợi ý "nên ăn tiếp" hiện luôn trên HUD trong game** — một dòng dưới thanh
  Growth ở bảng chỉ số minimap: chất đang thấp nhất + cách nạp, khỏi phải mở
  ứng dụng. Khi cả ba chất đều ổn thì ghi "cân bằng" (màu rêu).

### Thay đổi

- **Đề xuất dinh dưỡng bám cơ chế chính thống của game, chuẩn theo từng loài.**
  Bảng loài → chế độ ăn dựng theo roster Evrima trên theisle.info/dinosaurs
  (2026-08-29): 9 loài ăn cỏ, 12 loài ăn thịt, 2 loài ăn tạp. Gợi ý cho
  **loài ăn thịt** giờ theo **nội tạng**: carb thấp → ăn **phổi**, đạm thấp →
  ăn **tim**, béo thấp → ăn **ruột** con mồi (quy tắc từ wiki Diet System).
  Loài ăn cỏ: "ăn đa dạng nhiều loại cây — mỗi loài có 3 cây ưu tiên, mỗi cây
  một chất". Không nhét tên món ăn cụ thể vì nguồn chính thống nói dữ liệu đó
  đổi theo patch và theo vùng.
- "Cân bằng" giờ nhắc: cả ba chất đang cộng tốc độ trưởng thành (tối đa +300%).

## [1.25.3] — 2026-08-29

### Thêm

- **A3 — gợi ý "nên ăn tiếp"** dưới biểu đồ tam giác dinh dưỡng (tab Khủng
  long). Từ ba chỉ số Carb / Đạm / Béo hiện tại + loài (bảng tra loài → chế độ
  ăn ăn cỏ/thịt/tạp), thẻ chỉ ra chất đang thiếu và nguồn thức ăn hợp với loài
  — ví dụ "Carb thấp — ăn dương xỉ hoặc tuế". Ba chip C/Đ/B đổi màu (đỏ = chất
  thiếu nhất). Chỉ hiện khi IslePilot có dữ liệu dinh dưỡng (chế độ token).

## [1.25.2] — 2026-08-29

### Thêm

- **Nút 📌 Ghim** trên bản đồ to. Bình thường bản đồ không nhận focus (bạn vẫn
  chơi được). Bấm **Ghim** để cửa sổ nhận bàn phím — gõ tên waypoint, dùng
  phím tắt Leaflet, Esc để đóng — đổi lại là nhân vật đứng yên. Bỏ ghim (hoặc
  đóng bản đồ) trả điều khiển cho game. Dưới nắp: lật `WS_EX_NOACTIVATE` trên
  HWND (`overlay::set_no_activate`), không dựng lại cửa sổ.
- **Mờ dần** khi bản đồ to hiện ra (theo `bigmap://vis` từ luồng giám sát).

## [1.25.1] — 2026-08-29

### Thay đổi

- **Bản đồ to trong game giờ bám game như minimap.** Thêm luồng giám sát
  (tick 250&nbsp;ms): cửa sổ **tự dời/thay đổi kích thước theo cửa sổ game**
  ngay khi game di chuyển hay đổi độ phân giải, **tự ẩn khi Alt-Tab** khỏi
  game và hiện lại khi quay vào, giữ luôn ở trên cùng, tự dựng lại nếu
  WebView2 sập. Phím `Ctrl+Alt+G` / nút ✕ giờ chỉ lật ý định — luồng giám sát
  lo phần hiện/ẩn (trễ ≤ 1 tick).
- **Cài đặt → Bản đồ nhỏ (HUD) → Bản đồ to trong game**: thanh trượt độ đục
  nền (60–100%).

## [1.25.0] — 2026-08-29

### Thêm

- **Bản đồ to trong game** (`Ctrl+Alt+G`). Một cửa sổ overlay thứ ba mở **cùng
  bản đồ lớn** (`FullMap`) của cửa sổ chính, phủ lên vùng chơi của game — xem
  cả đảo mà không cần Alt-Tab.
  - **Không cướp focus:** cửa sổ đặt `WS_EX_NOACTIVATE` + không nhận focus, nên
    khi mở bạn **vẫn di chuyển được trong game**. Chuột vẫn kéo/lăn để pan &
    zoom bản đồ; bàn phím thuộc về game.
  - **Không đụng tiến trình game:** chỉ đọc hình chữ nhật vùng client của cửa
    sổ game (`GetClientRect`/`ClientToScreen` — đúng các lệnh minimap đã dùng)
    để đặt cửa sổ *của mình*.
  - Đóng bằng `Ctrl+Alt+G` lần nữa hoặc nút ✕ ở góc. Phím tắt đổi được trong
    Cài đặt → Phím tắt. Độ mờ nền: `settings.bigmap.opacity` (mặc định 0.96).
  - *Đợt này là khung xương:* cửa sổ neo lại khi mở; nếu di chuyển cửa sổ game
    thì tắt/bật lại. Supervisor theo game realtime + tự ẩn khi Alt-Tab: v1.25.1.

## [1.24.6] — 2026-08-29

### Thêm

- **A9 — giao diện màu (skin).** 3 tông nền chọn được trong **Cài đặt → Giao
  diện → Giao diện màu**: **Hắc thạch** (mặc định, như cũ), **Đồng xương**
  (ấm, ngả nâu-ngà), **Phát quang** (lạnh, xanh phát quang). Đổi ngay lập tức
  toàn cửa sổ chính *và* bản đồ nhỏ trong game; màu nhấn amber giữ nguyên,
  màu trạng thái (máu/đói…) và bảng màu hỗ trợ mù màu không đổi.
  - `tokens.data.js` thêm 2 bộ 13 màu; `gen-tokens.mjs` sinh
    `:root[data-skin="…"]`. `App.svelte` đặt `data-skin` trên `<html>`;
    `render.ts` dựng lại `COLORS` mỗi khung theo `state.skin` (giống cách
    `SEM` bám hồ sơ mù màu). Cài mới / nâng cấp đều mặc định Hắc thạch.

## [1.24.5] — 2026-08-29

### Thêm

- **A1 — hướng dẫn cài đặt lần đầu (5 bước).** Lần chạy đầu tiên (máy mới)
  hiện một wizard toàn cửa sổ theo phong cách Amber: (1) giới thiệu +
  ranh giới anti-cheat, (2) tải dữ liệu bản đồ (có nút tải + tiến độ, tự nhận
  nếu đã có), (3) IslePilot — tùy chọn, tự kiểm tra đã đăng nhập chưa,
  (4) bảng phím tắt chính, (5) xong. Có thanh tiến độ + đếm bước "01 / 05".
  - Bản **nâng cấp không bị đụng**: `load_settings()` tự đặt `onboarding_done
    = true` khi `settings.json` cũ chưa có khoá này. Chỉ cài mới mới thấy wizard.
  - **Cài đặt → Nâng cao → "Chạy lại hướng dẫn"** để mở lại wizard bất cứ lúc nào.

## [1.24.4] — 2026-08-29

### Thêm

- **B5 — chép ảnh bản đồ nhỏ vào clipboard.** Phím tắt mới **`Ctrl+Alt+S`**
  (`map_snapshot`, đổi được trong Cài đặt → Phím tắt): chụp đúng khung minimap
  đang hiển thị (đĩa + panel + waypoint, giữ nền trong suốt quanh đĩa) và đặt
  lên clipboard dưới dạng ảnh — dán thẳng vào Discord / Paint / Word. Một pill
  biolum "Đã chép bản đồ" hiện ~1,6&nbsp;s trên đĩa rồi tự tắt.
  - Overlay không có focus nên `navigator.clipboard.write` ném lỗi ở đó;
    webview đọc pixel canvas của chính nó (`getImageData`) rồi đưa cho Rust
    (`copy_map_snapshot`), Rust đóng gói `CF_DIBV5` top-down 32-bpp (module
    `snapshot.rs`) qua Win32 clipboard. Canvas của mình — không đọc/ghi gì
    vào tiến trình game.

## [1.24.3] — 2026-08-29

### Thêm

- **HUD trong game: hàng chip danh tính.** Ngay dưới tên khủng long, bảng chỉ
  số giờ có chip **ONLINE / NGOẠI TUYẾN** (theo cờ theo dõi của IslePilot,
  chấm biolum khi live) và chip **PRIME 4/19** (đổi thành **PRIME ✦** màu
  biolum khi đủ điều kiện Prime hoặc xong hết nhiệm vụ). Ký hiệu **♀/♂** giờ
  có màu (hồng / xanh) để liếc là thấy. Đỡ phải Alt-Tab ra ứng dụng chỉ để
  xem mấy thứ này.
- `DINO_PANEL_H` 90 → 105&px cho hàng chip; cửa sổ HUD + canvas tự khớp qua
  `minimap://layout` như cũ.

### Thay đổi

- **Cài đặt gom theo 6 nhóm nhiệm vụ** — *Giao diện* (ngôn ngữ · định dạng số
  · bảng màu), *Bản đồ nhỏ (HUD)*, *Vị trí tự động*, *Phím tắt*, *Bản đồ &
  dữ liệu*, *Nâng cao* — mỗi nhóm có nhãn mono in hoa + hairline. Ô đánh dấu
  npcap của *Vị trí tự động* → atom `Toggle`.

## [1.24.2] — 2026-08-29

### Thay đổi

- **Tab Khủng long: mọi ô đánh dấu / thanh trượt → atom Amber.** 11 ô đánh
  dấu (bật IslePilot, hiện panel, theo dõi lịch sử, vị trí từ live map, hiện
  đồng đội, realtime, cảnh báo…) thành `Toggle`; "Tần suất cập nhật" thành
  `Slider`. Giờ tab này đồng bộ với thẻ hồ sơ và tab Cài đặt.
- **`Toggle` giờ là controlled** — trạng thái luôn theo prop (settings). Huỷ
  hộp thoại xác nhận "hiện đồng đội" để switch đúng chỗ cũ, không cần thủ
  thuật revert trên DOM.

### Ghi chú

- Gom Settings theo nhiệm vụ (6 nhóm) dời sang v1.24.3.

## [1.24.1] — 2026-08-29

Cửa sổ chính, tiếp: **thẻ hồ sơ khủng long**.

### Thêm

- **Thẻ hồ sơ** ở tab *Khủng long*: avatar (dấu chân), **tên loài bằng font
  Fraunces**, ký hiệu ♀/♂, chip *Online* + *Prime progress* (kiểu Amber),
  server + thời điểm cập nhật — thay cho dòng chữ rời rạc cũ.
- **Biểu đồ tam giác dinh dưỡng** (`NutritionTriangle`): một chấm trong tam
  giác Carb–Protein–Lipid cho biết khẩu phần đang lệch về đâu; % chính xác ở
  ba đỉnh. Thay cho "🌾 Carb: 12.3 …".
- Bảng chỉ số + biểu đồ dinh dưỡng xếp lưới 2 cột trên màn rộng.
- **Prime**: header "PRIME  4/19" + thanh tiến độ mảnh; danh sách gọn hơn,
  mục đã xong màu rêu.

### Ghi chú

- Các ô đánh dấu / thanh trượt riêng trong tab Khủng long (lịch sử chỉ số,
  cảnh báo, tần suất poll) chưa đổi sang atom Amber — gộp vào đợt dọn Cài đặt
  (v1.24.2).

## [1.24.0] — 2026-08-29

"Amber" đợt 4 — bắt đầu redesign **cửa sổ chính**. Đợt này: điều hướng.

### Thay đổi

- **Thanh tab ngang trên cùng → rail điều hướng dọc bên trái.** Mỗi mục là
  icon + nhãn; mục đang mở có chữ amber + vạch amber 2&px ở mép trái. Có
  wordmark "Bản đồ The Isle" (font hiển thị Fraunces — lần đầu dùng trong app)
  + monogram dấu chân khủng long. Chân rail có phiên bản (+ nút dev).
- **Tự thu gọn còn icon** khi cửa sổ hẹp (< 880&px) — hover hiện tooltip nhãn.
- Nội dung các tab giữ nguyên; chỉ khung vỏ đổi.

## [1.23.2] — 2026-08-29

Bảng chỉ số HUD "xịn" thêm một nấc.

### Thêm

- **Dòng danh tính** trên bảng chỉ số: tên khủng long (từ IslePilot) + ký hiệu
  ♀/♂, ngăn với phần chỉ số bằng một đường hairline. Bảng có "mặt" chứ không
  chỉ là mấy cái thanh.
- **Bộ icon nét thay emoji**: ♥ (HP) · lá (đói) · giọt (nước) · tia sét
  (stamina) — vẽ trực tiếp trên canvas, đồng bộ, không còn 🍖💧⚡ lẫn lộn.
- **Nhịp tim khi HP nguy kịch**: HP < 15% thì thanh HP + số đập nhẹ (vòng lặp
  tự dừng khi HP hồi hoặc chết).
- **Vạch phần tư trên mọi thanh** — đọc nhanh "còn khoảng 3/4" mà không cần
  nhìn số.
- **Tăng trưởng thành thanh đo riêng** (không còn là dòng chữ) + "GROWTH" chữ
  hoa mờ + "47%" + ETA.
- **Vành 8 hướng trên đĩa**: 8 vạch ngắn quanh mép (4 hướng chính dài hơn) —
  cảm giác "bệ ngắm" chiến thuật.

### Thay đổi

- `DINO_PANEL_H` 76 → 90 px (thêm dòng danh tính). Cửa sổ HUD tự khớp
  (`minimap.rs` là nguồn chiều cao).

## [1.23.1] — 2026-08-29

Làm lại thật sự phần nhìn của bảng chỉ số + bảng nhiệm vụ trên HUD (phản hồi:
"nhìn không khác gì cũ").

### Thay đổi

- **Bảng chỉ số:** viền hắt sáng amber dọc cạnh trái · thanh chỉ số dày hơn
  (8&px), có **gradient dọc + gờ sáng 1&px** ở mép trên (nhìn có khối, không
  còn phẳng) · số đọc to đậm hơn (11&px) · dòng tăng trưởng tách bằng đường
  hairline, "GROWTH" chữ hoa mờ + "47%" màu amber.
- **Bảng nhiệm vụ:** header thành **"PRIME  4/19" + thanh tiến độ mảnh** chạy
  hết bề ngang · chỉ hiện **10 nhiệm vụ, chưa xong lên trước** (danh sách 19
  dòng chữ li ti là quá tải; các dòng đã xong chỉ cần số ở header). `minimap.rs`
  chốt chiều cao card theo mức 10 dòng — có test.
- **Bảng đồng đội:** cùng ngôn ngữ — viền hắt sáng (hồng), thanh chỉ số dùng
  chung kiểu gradient, header "ĐỘI  N".
- **Chữ HUD có bóng đổ 1&px** ở mọi bảng → đọc được trên cả rừng nắng lẫn
  tuyết. Nền card đục hơn (92%).

## [1.23.0] — 2026-08-29

"Amber" đợt 3 — **HUD trong game theo ngôn ngữ mới**. Chỉ đổi hình thức bản
đồ nhỏ; cấu trúc và cách dùng giữ nguyên.

### Thay đổi

- **Chữ trên bản đồ nhỏ dùng IBM Plex** (trước là Segoe UI): Plex Sans cho
  chữ, Plex Mono cho nhãn / số / khoảng cách / hướng (chữ số thẳng cột). Bundle
  sẵn, không CDN — dùng chung woff2 với cửa sổ chính.
- **Màu từ token.** Nền đá vỏ chai, viền mảnh `--edge`, chữ xương, nhấn hổ
  phách — lấy từ hợp đồng token `src/lib/tokens.data.js`, hết hằng số hex rải
  rác trong `render.ts`.
- **Màu chỉ số theo thị lực (A8) — giờ áp cả trong game.** Thanh HP (bạn +
  đồng đội), kim cương đồng đội, dấu ✓ nhiệm vụ đổi sang bộ deuteranopia khi
  bật *Cài đặt → Bảng màu (hỗ trợ thị lực)*.
- **Đĩa bản đồ:** vignette tối dần ra rìa + viền hairline luôn định hình mép
  đĩa; nền đá vỏ chai khi ảnh bản đồ chưa/không tải được (không còn "lỗ" nhìn
  xuyên xuống game).
- **Chấm "bạn":** quầng đổi sang lân quang (biolum) — tín hiệu "đang sống".
- **Vệt đường đi:** nửa gần người chơi sáng, nửa cũ mờ dần (2 nét/đoạn — vẫn rẻ).
- Các thẻ chỉ số / nhiệm vụ / đồng đội dùng chung khối "panel obsidian"
  (nền token + viền `--edge`).

### Ghi chú

- Chưa làm trong đợt này: vòng ngoài chia 8 hướng, bóng loài (silhouette),
  sparkline tăng trưởng trên canvas — để đợt sau khi có dữ liệu/asset. B5
  (chụp bản đồ vào clipboard) hoãn: cần ghi ảnh vào clipboard qua Rust vì cửa
  sổ overlay không có focus.
- Ảnh chuẩn hồi quy hình ảnh mới: `minimap-hud` (đĩa + strip chỉ số).

## [1.22.1] — 2026-08-29

### Sửa

- **Mũi tên hướng trên overlay giật khi xoay.** Cổng lọc phát vị trí (v1.19)
  lượng tử hoá hướng theo bước 0,75° nên lúc xoay chậm–vừa mũi tên nhảy bậc.
  Hạ ngưỡng xuống 0,18° (chỉ vừa trên mức nhiễu của bộ làm mượt) + keepalive
  0,5 s → nhịp phát đều khi xoay. Thêm: mũi tên (và chế độ xoay bản đồ theo
  hướng) giờ **nội suy vòng tròn** mỗi khung hình về hướng thật, nên xoay mượt
  kể cả khi tắt "chấm vị trí trượt mượt". Vòng lặp tự dừng khi đã tới nơi.

### Thay đổi

- **Garage — tự phục hồi khi model 3D hỏng.** Nếu file model/skin trong cache
  không giải mã được (CDN IslePilot trả về nội dung lỗi kèm mã 200 sẽ bị lưu
  như file hợp lệ và kẹt vĩnh viễn), viewer tự **tải lại sạch một lần**
  (`islepilot_cdn_asset` thêm cờ `force`, xoá entry hỏng trước khi tải lại).
  *Lưu ý: bản thân việc tải model 3D không thay đổi từ v1.20 — nếu vẫn "không
  thấy khủng long" thì kiểm tra mạng tới `islepilot.eu/cdn`, hoặc CDN đang lỗi.*

## [1.22.0] — 2026-08-29

"Amber" đợt 2 — **nhóm nguyên tử**. Các thành phần nhỏ dựng lại trên token;
Cài đặt và bảng chỉ số khủng long "xịn" lên rõ, bố cục chưa đổi.

### Thêm

- **Thư viện atom** `src/lib/ui/`: `Toggle` (switch, biết bật bằng cả màu lẫn
  vị trí núm), `Slider` (nhãn + số mono), `Button` (3 cấp: chính/phụ/ngầm),
  `Pill` (neutral/live/stale/danger), `StatBar` (thanh mảnh + màu ngữ nghĩa),
  `Sparkline` (đường xu hướng + fill mờ). Tất cả token-driven, có trạng thái
  focus rõ, tôn trọng `prefers-reduced-motion`.
- **HUD an toàn (B4).** Nếu `render()` của bản đồ nhỏ ném lỗi giữa lúc chơi,
  overlay tụt về một đĩa tối thiểu (chấm "bạn" + chữ "Chế độ an toàn") thay vì
  cửa sổ đen/đơ, và khoá ở đó tới khi tải lại giao diện.
- **Bảng màu mù màu cho chỉ số (A8).** Cài đặt *Bảng màu (hỗ trợ thị lực)* giờ
  cũng đổi màu ok/cảnh báo/nguy của thanh chỉ số (`--sem-*`) sang bộ
  deuteranopia (teal / vàng / đỏ cam, khác cả độ sáng), không chỉ màu lớp bản đồ.
- **Phím tắt "đổi preset kế tiếp" (A4, `Ctrl+Alt+P`).** Lướt qua các preset
  overlay đã lưu — "săn solo" → "đi đàn" → "làm tổ" — bằng một phím.

### Thay đổi

- **Cài đặt → Bản đồ nhỏ**: 10 ô đánh dấu → `Toggle`, 6 thanh trượt → `Slider`.
- **Khủng long → chỉ số**: tăng trưởng + HP/Đói/Nước/Stamina → `StatBar`. Đói /
  Nước / Stamina giờ cũng đổi màu theo ngưỡng (thấp = cảnh báo/nguy) chứ không
  còn màu cố định — hợp với một HUD sinh tồn.
- Token: thêm `--sem-ok/warn/danger` (+ biến thể deuteranopia).

### Ghi chú

- Ảnh chuẩn hồi quy hình ảnh: cửa sổ Cài đặt (Toggle/Slider) + bản đồ + đĩa
  minimap. `StatBar`/`Pill`/`Sparkline` sẽ có ảnh chuẩn ở v1.23 khi dựng mock
  IslePilot đầy đủ.

## [1.21.0] — 2026-08-29

Đợt đầu của **"Amber"** — ngôn ngữ thiết kế mới (xem bản kế hoạch). v1.21 là
nền móng: gần như không đổi trên màn hình, chỉ tinh hơn một chút.

### Thêm

- **Hợp đồng token thiết kế (B1).** `src/lib/tokens.data.js` là nguồn sự thật
  duy nhất cho màu / kiểu chữ / chuyển động / bo góc. `scripts/gen-tokens.mjs`
  sinh `src/lib/tokens.gen.css`; `node scripts/gen-tokens.mjs --check` (đã thêm
  vào CI) fail nếu file sinh bị lệch — chặn drift màu như v1.20 đã chặn drift
  chiều cao panel.
- **Bộ chữ Amber, đóng gói sẵn.** Fraunces (hiển thị), IBM Plex Sans (nội
  dung), IBM Plex Mono (nhãn/số) — bundle woff2 (latin + latin-ext +
  vietnamese), không CDN. Cửa sổ chính dùng `--font-body`; canvas minimap giữ
  Segoe UI tới đợt HUD (v1.23).
- **Bộ test hồi quy hình ảnh (B2).** Playwright: chụp cửa sổ chính + đĩa minimap
  với lớp Tauri IPC giả lập. `npm run test:visual` / `test:visual:update`.
  Ảnh chuẩn cho Windows đã commit.

### Thay đổi

- **Bảng màu Amber.** `--color-bg/panel/border/text/muted/accent` nhích sang
  bộ Amber (đá vỏ chai `#0c0f0a`, xương `#ece6d2`, nhựa hổ phách `#e3a63c`…) —
  khác biệt rất nhỏ. Thêm token `--biolum` (lân quang) / `--blood` / `--moss`
  và bộ token sáng đầy đủ, chờ redesign cửa sổ chính (v1.24), hiện chưa dùng.
- **Hằng số chuyển động dùng chung.** `420ms` và đường cong ease-out
  `1−(1−t)²` của các tween vị trí (minimap + bản đồ lớn) giờ lấy từ
  `tokens.motion` / `glideK`, không còn rải rác trong 3 file.
- `tsconfig`: thêm `noEmit` (đúng bản chất — Vite/Svelte lo transpile).

## [1.20.0] — 2026-08-29

Năm đề xuất từ đợt rà soát v1.19 — bốn cái vô hình với người dùng, một cái
(pill "Mất tín hiệu") thấy được.

### Thêm

- **Pill "Mất tín hiệu vị trí" trên bản đồ nhỏ.** Khi không còn mẫu vị trí nào
  trong hơn 5 giây (đóng game, socket chết, ngừng dán tay), chấm người chơi
  đang đứng ở chỗ cũ — một pill hổ phách nhỏ dưới ô chỉ hướng nói rõ điều đó
  thay vì để người chơi tin vào chấm đã cũ. Không phải vòng lặp: chỉ một
  `setTimeout` được đặt lại mỗi lần có mẫu mới, chỉ kêu khi thật sự mất tín hiệu.

### Thay đổi

- **Chấm đồng đội trượt mượt (phía người xem).** Từ v1.19 relay chỉ gửi khi
  đồng đội thật sự di chuyển (~1–2 Hz lúc đi bộ), nên chấm hay bị "nhảy bước".
  Giờ mỗi chấm ease ~420 ms tới vị trí mới (cả minimap lẫn bản đồ lớn); bước
  nhảy lớn (hồi sinh) thì snap thẳng. Không phải vòng lặp nhàn rỗi — chỉ chạy
  trong lúc trượt rồi tự tắt.
- **Một nguồn sự thật cho chiều cao các bảng minimap.** `minimap.rs` (Rust) là
  nơi duy nhất tính chiều cao ba bảng (khủng long / nhiệm vụ / đồng đội); webview
  lấy qua lệnh `minimap_layout` lúc khởi động và bám theo sự kiện
  `minimap://layout`. `render.ts` bỏ bản sao hằng số + ba hàm `recompute*H` — sửa
  một bên không còn cắt canvas hay để hở nữa.
- **Dọn dẹp khi thoát app.** Hook `RunEvent::Exit` gọi `shutdown()` cho G1 (đóng
  `pcap` gọn), Raw Input (huỷ cửa sổ message-only) và relay đội (bỏ socket) —
  tránh hiếm khi "device busy / address in use" lúc mở lại ngay.

### Kiểm thử

- **Test bền vững cho decoder gói UE.** `crates/localpos/tests/fuzz.rs`: ~28k
  buffer ngẫu nhiên (nhiễu đều, thưa/đặc, lật bit từ payload thật) qua `decode`
  — bảo đảm không panic, không đọc ngoài mảng, không sinh toạ độ ngoài khung.
  RNG xorshift tự chứa, không thêm dependency.

## [1.19.0] — 2026-08-29

Đợt rà soát chuyên sâu + tối ưu mượt mà sau khi hoàn tất Phase A–D. Không thêm
tính năng người dùng thấy được; sửa lỗi treo tiềm ẩn và cắt tải nền.

### Sửa

- **Deadlock cử chỉ chuột (G7).** Nếu gạt tắt "Cử chỉ chuột" trong *Cài đặt*
  đúng lúc đang giữ Alt + cuộn/nhấn chuột giữa, luồng Raw Input và luồng chính
  có thể khoá chéo nhau → treo ứng dụng. Hành động cử chỉ giờ chạy trên luồng
  worker riêng (giống `hotkeys.rs`), luồng bơm message chỉ đẩy vào hàng đợi.
- **`apply_settings_patch` gọi thừa supervisor.** Mỗi hotkey/cử chỉ (đổi bán
  kính, độ mờ, ẩn/hiện) trước đây đều chạy lại toàn bộ khởi động G1 + G7 chỉ
  để kết luận "không đổi". Giờ chỉ chạy khi khoá tương ứng thực sự có trong
  patch — cũng chính là đường tái nhập gây deadlock ở trên.

### Thay đổi

- **Chấm vị trí không phát lại khi đứng yên.** Pipeline vị trí bỏ qua mẫu
  nào không dịch quá 2 cm và không xoay quá 0,75° so với lần phát trước (vẫn
  phát tối thiểu 1 lần/giây). Người đứng yên không còn khiến mọi cửa sổ vẽ lại
  ~22 lần/giây khi bật G1.
- **Bản đồ nhỏ gộp lần vẽ theo khung hình.** Mọi `draw()` từ sự kiện (vị trí
  22 Hz, roster đội ~10 Hz, party) giờ gộp qua một `requestAnimationFrame` —
  tối đa một lần vẽ mỗi nhịp màn hình; cửa sổ bị che thì trình duyệt tự hãm.
  Mũi tên viền waypoint hạ xuống ~5 Hz. `dino_history` chỉ hỏi khi bảng khủng
  long đang bật (không còn IPC nền cho người chỉ dùng dán tay / G1).
- **G1 chỉ mở card mạng đang hoạt động.** Bỏ qua loopback, card đã ngắt kết
  nối và card không có địa chỉ (Hyper-V/WSL/VMware/Bluetooth PAN nhàn rỗi…);
  tự quay lại mở tất cả nếu bộ lọc không còn gì. Dừng/đổi cổng: báo dừng tất
  cả rồi mới join, không còn tốn ~250 ms mỗi card theo dãy.
- **Relay đội gửi vị trí theo chuyển động.** Thay vì 4 gói/giây cố định, chỉ
  gửi khi dịch >2 m hoặc xoay >3° hoặc HP đổi ≥5% hoặc mỗi 2 giây (keepalive).
  Người đứng yên/AFK từ ~4 gói/s xuống ~0,5 — đủ để một tài khoản Cloudflare
  free không cạn hạn mức giữa buổi chơi. Chấm đồng đội trên bản đồ trễ tối đa
  vài mét (không nhìn ra ở cỡ bản đồ nhỏ).
- **Relay: hãm `pruneStale`.** Durable Object chỉ quét socket cũ tối đa mỗi
  2 giây thay vì mỗi gói vào. *(Cần `cd worker && npm run deploy:team` để có
  hiệu lực — không bắt buộc, bản cũ vẫn chạy.)*

## [1.18.1] — 2026-08-29

### Thêm

- **Bộ thiết lập nhanh — preset (P5).** *Cài đặt → Bản đồ nhỏ → Preset*: lưu
  cách bố trí overlay hiện tại (lớp bản đồ đang bật, cỡ/độ mờ/bán kính/scale
  bản đồ nhỏ, góc neo, các bảng chỉ số) thành một preset đặt tên; bấm tên để
  áp dụng lại. Ví dụ: "săn solo", "đi đàn", "làm tổ".
- **Chấm vị trí trượt mượt (P1 — mặc định TẮT).** *Cài đặt → Bản đồ nhỏ*: khi
  bật, mỗi lần có toạ độ mới chấm sẽ trượt ~0,4 giây tới chỗ mới thay vì nhảy.
  Hữu ích nhất ở chế độ dán tay; với G1 (bắt gói, nhiều mẫu/giây) thì gần như
  không cần. Chỉ là hiệu ứng chuyển tiếp ngắn có giới hạn, không phải vòng lặp.

## [1.18.0] — 2026-08-29

### Thêm

- **Beacon “Vị trí cuối” (P6).** Khi tín hiệu vị trí tắt giữa chừng (chết, DC,
  hoặc ngừng copy toạ độ) quá 30 giây, ứng dụng tự cắm một waypoint 💀 tại điểm
  cuối trong nhóm “Vị trí cuối” — dễ quay lại tìm xác / tổ. Mẫu vị trí mới xoá
  beacon đi. Tắt ở *Cài đặt → Bản đồ nhỏ*. Waypoint xoá được như thường.
- **ETA trưởng thành trên bản đồ nhỏ (P9).** Dòng Growth ở thanh chỉ số dưới
  đĩa minimap hiện thêm `→ ~35m` (thời gian tới 100% theo tốc độ hiện tại, lấy
  từ lịch sử chỉ số). Bảng “Khủng long của bạn” vốn đã có phần này đầy đủ.
- **Đồng hồ hard-swap (P7).** *Khủng long*: nút đếm ngược 30:00 sau khi đủ
  trưởng thành. Thêm biểu tượng 🥚 cho waypoint đặt tên bắt đầu bằng 🥚 (pin tổ).

## [1.17.0] — 2026-08-29

### Thêm

- **Cử chỉ chuột cho bản đồ nhỏ (G7 — thử nghiệm, mặc định TẮT).** *Cài đặt →
  Bản đồ nhỏ*: bật lên thì **Alt + cuộn** = zoom, **Alt + chuột giữa** = ẩn/hiện
  bản đồ nhỏ, hoạt động cả khi đang trong game. Dùng **Raw Input** (API mà game
  cũng dùng để đọc chuột) qua một cửa sổ message-only ẩn — KHÔNG phải
  `SetWindowsHookEx`, không chèn DLL, không đụng tiến trình game
  (`check-forbidden-apis` vẫn xanh). Chỉ can thiệp khi đang giữ Alt.
- **Cỡ toàn bộ overlay (G8).** *Cài đặt → Bản đồ nhỏ → Cỡ toàn bộ overlay*:
  một thanh 65–175% phóng to/thu nhỏ **cả đĩa bản đồ lẫn mọi bảng chỉ số**
  (khủng long, nhiệm vụ, đồng đội) theo cùng tỉ lệ. Cửa sổ overlay tự khớp
  kích thước (Rust `minimap.rs` và `render.ts` cùng một hệ số).

## [1.16.0] — 2026-08-29

### Thêm

- **Chia sẻ waypoint cho cả nhóm (P4) — hoàn tất Phase C.** Trong danh sách
  waypoint ở bản đồ lớn, mỗi điểm có nút **⤴** (chỉ hiện khi đang trong nhóm) →
  gửi điểm đó qua relay cho mọi thành viên. Người nhận thấy điểm tự thêm vào
  danh sách trong nhóm "Nhóm"/"Team" (màu hồng, xóa được như thường) + một
  toast báo ai chia sẻ. Relay dùng frame `wp` (fan-out, không lưu — cùng đợt
  với `mark` của ping).

> Cần `cd worker && npm run deploy:team` một lần nếu chưa deploy lại từ v1.15.1
> (frame `wp` + `mark` cùng một bản relay).

## [1.15.2] — 2026-08-28

### Thêm

- **Bảng chỉ số đồng đội ngay trên minimap overlay trong game.** Khi đang trong
  nhóm, dưới đĩa bản đồ nhỏ (và dưới bảng nhiệm vụ nếu có) hiện một strip gọn:
  mỗi đồng đội một dòng — tên + 3 thanh HP / Đói / Nước, giống bảng "khủng long
  của bạn". Cửa sổ overlay tự cao thêm theo số người; đồng đội mất tín hiệu bị
  làm mờ. Tắt ở *Cài đặt → Bản đồ nhỏ → Hiện chỉ số đồng đội*.
  Chiều cao panel tính khớp hai bên (Rust `minimap.rs` + `render.ts`) như các
  panel sẵn có.

## [1.15.1] — 2026-08-28

### Thêm

- **Ping “chạm địch” cho cả nhóm (P3).** Phím tắt `Ctrl+Alt+X` (đổi được ở *Cài
  đặt → Phím tắt*) thả một dấu tại vị trí hiện tại → cả nhóm thấy vòng đỏ nhấp
  nháy + tên người ping trên bản đồ nhỏ lẫn bản đồ lớn (~12 giây), và một toast
  đỏ trên cửa sổ chính. Relay thêm frame `mark` — fan-out tới mọi thành viên,
  không lưu.

> Cần chạy lại `cd worker && npm run deploy:team` một lần để relay hiểu frame mới.

## [1.15.0] — 2026-08-28

### Thêm

- **Chỉ số HP / Đói / Nước của đồng đội trong nhóm relay (G6).**
  - Trên bản đồ: chấm đồng đội đổi màu theo HP (xanh > 50%, cam 25–50%, đỏ < 25%),
    ai HP ≤ 25% có thêm vòng nhấp nháy đỏ để liếc phát biết. Bản đồ lớn hiện thêm
    `tên · HP%`. Marker F7 (không có HP) giữ màu hồng như cũ.
  - Trong *Khủng long → Nhóm sinh tồn*: danh sách thành viên với tên, loài, 3
    thanh HP/Đói/Nước, đánh dấu "bạn" và "mất tín hiệu".
  - Dữ liệu đã đi qua relay từ trước (frame `tele`); giờ mới vẽ ra.

## [1.14.3] — 2026-08-28

### Thay đổi

- **Relay nhóm mặc định trỏ vào deploy của chúng ta** (`isle-team-relay.quocanh.workers.dev`).
  Người dùng cuối chỉ cần nhập tên → *Tạo nhóm* → gửi mã, không phải dán URL.
- Thêm `worker/wrangler.team.jsonc` + `npm run deploy:team`: bản relay tối giản
  chỉ có Durable Object, không cần bật D1 / Analytics Engine trên tài khoản.

## [1.14.2] — 2026-08-28

### Thay đổi

- **Vị trí đồng đội — làm gọn cho người dùng phổ thông.**
  - Nếu server có **live map**: chỉ cần tick “Hiện đồng đội trên bản đồ” là xong —
    lấy thẳng marker từ live map của server, **không cần relay, không cần mã**.
    Trước đây chỉ chạy ở chế độ cookie; giờ chạy cả chế độ token (đọc thêm
    mảng `markers` từ `/api/overlay/map`). Bỏ ràng buộc phải bật “dùng vị trí
    từ live map” mới hiện được đồng đội.
  - **Nhóm riêng (mọi server):** relay giờ có **địa chỉ mặc định sẵn** — người
    dùng chỉ cần nhập tên → *Tạo nhóm* → gửi mã 6 ký tự, y như IsleLiveMap.
    Ô địa chỉ relay chuyển vào mục *Nâng cao*, để trống = dùng mặc định.
  - Panel *Khủng long → Nhóm sinh tồn* thiết kế lại: tên + 2 nút, bấm vào mã để
    copy, trạng thái 🟢/🟡 + số người.

> Lưu ý deploy: relay mặc định trỏ tới Worker telemetry. Chạy `cd worker &&
> npm run deploy` một lần để đưa Durable Object `TeamRoom` lên; nếu deploy sang
> tài khoản Cloudflare khác thì dán URL đó vào *Nâng cao → Địa chỉ relay*.

## [1.14.1] — 2026-08-28

### Xóa

- **Bỏ tính năng tự kiểm tra cập nhật qua GitHub.** Bản dựng này do chúng ta tự
  phát triển tiếp, không lấy update của tác giả gốc nữa. Gỡ: banner “Có bản cập
  nhật” + nút cập nhật trong app, plugin `updater` và `process`, khối
  `plugins.updater` + `createUpdaterArtifacts` trong `tauri.conf.json`, quyền
  `updater`/`process` trong capabilities, và phần ký updater trong workflow
  release. Cập nhật giờ là: cài đè bằng file `.exe` mới.

## [1.14.0] — 2026-08-28

### Thêm

- **Nhóm sinh tồn qua relay (G6).** *Khủng long → Nhóm sinh tồn*: tạo nhóm tạm
  bằng mã 6 ký tự, đồng đội hiện trên bản đồ lớn + bản đồ nhỏ ở **mọi server và
  mọi nguồn telemetry** — kể cả server không cài plugin, vì nó chia sẻ đúng vị
  trí overlay đang có (G1 bắt gói / IslePilot / dán tay). Đây là F7 làm cho đúng:
  không giới hạn chế độ cookie, không giới hạn cùng server.
  - Relay là một **Cloudflare Durable Object** trong `worker/` (`src/team.ts`) —
    một phòng cho mỗi mã, chỉ nằm trong RAM, phòng trống tự evict. SQLite-backed
    DO có sẵn ở Workers Free. Xem `worker/README.md` để deploy.
  - Người dùng tự dựng relay và dán URL worker vào ô *Địa chỉ relay*; chưa dán
    thì tính năng ẩn. Client dùng WebSocket blocking `tungstenite`, publish vị
    trí ~4 lần/giây, heartbeat 9 giây, tự kết nối lại theo backoff.
  - F7 (đọc marker live-map của server) tự nhường khi đang trong một nhóm relay.

## [1.13.0] — 2026-08-28

### Thêm

- **IslePilot thời gian thực qua WebSocket (G5 — chế độ token).** Mở kết nối
  `wss://islepilot.eu/ows` song song với vòng REST: vị trí + hướng + HP / đói /
  khát / stamina / dinh dưỡng cập nhật dưới 1 giây thay vì mỗi 10 giây. Vòng REST
  vẫn chạy nền cho những thứ khung `live` không có (persona, loài, server, nhiệm
  vụ Prime) và làm dự phòng khi socket rớt (tự kết nối lại theo thang
  1·2·4·8·15 giây + nhiễu). Tắt được ở *Khủng long → Cập nhật thời gian thực*.
  Port từ `IslePilotOverlayWebSocket` + `IslePilotReconnectBackoff` của IsleLiveMap
  (MIT); client WebSocket blocking bằng `tungstenite`, không thêm async runtime.
- **Hợp nhất nguồn vị trí (P2).** Khi G1 (bắt gói) đang chạy, nó giữ quyền vị trí
  (chính xác + nhiều mẫu hơn hẳn); IslePilot — cả REST lẫn WebSocket — vẫn gửi
  chỉ số và nhiệm vụ nhưng không ghi đè vị trí nữa. Tương tự, khi WebSocket đang
  đẩy vị trí thì vòng REST 10 giây nhường, tránh mũi tên nhảy lùi mỗi nhịp poll.

## [1.12.1] — 2026-08-28

### Sửa

- **Mũi tên hướng ở chế độ vị trí tự động (G1) mượt hơn.** Yaw lấy từ mỗi gói
  vốn giật (rung theo cử động chuột nhỏ). Giờ làm mượt bằng EMA vòng tròn và
  giới hạn nhịp cập nhật ~22 Hz (gộp cụm gói về gói mới nhất), nên mũi tên xoay
  đều thay vì nhảy. Vị trí không bị làm mượt — vẫn bám đúng.

## [1.12.0] — 2026-08-28

### Thêm

- **Vị trí tự động từ gói mạng (G1 — thử nghiệm, mặc định TẮT).** *Cài đặt → Vị trí
  tự động*: khi bật, ứng dụng bắt gói UDP mà máy bạn gửi đi (qua Npcap) và giải mã
  toạ độ + hướng quay từ gói chuyển động của UE 5.5 — không phải copy “Asset
  Location” thủ công nữa, chạy cả trên server không cài plugin. Không đọc bộ nhớ
  game, không chèn mã, không đụng tiến trình game; chỉ hỏi hệ điều hành xem game
  dùng cổng UDP nào (`GetExtendedUdpTable`) rồi lọc đúng luồng đó. Cần cài Npcap
  (bảng cài đặt có nút tải từ npcap.com). Port từ `TheIsleOverlay.LocalTelemetry`
  của IsleLiveMap (MIT):
  - crate `localpos` mới: bộ giải mã gói `FCharacterNetworkMoveData`
    (`FVector_NetQuantize100` + yaw nén) và máy khóa mục tiêu “8 hit liên tiếp mới
    khoá”, 16 test dựng lại từ payload thật.
  - lớp bắt gói nạp động `wpcap.dll` lúc chạy (không cần SDK lúc build, tự xử lý
    khi thiếu Npcap), một luồng bắt gói cho mỗi card mạng.
  - hướng quay lấy thẳng từ yaw trong gói (đứng yên xoay người vẫn đúng); hết hạn
    2 giây thì lùi về hướng suy từ di chuyển.

## [1.11.0] — 2026-08-28

### Thay đổi

- **Bản đồ nhỏ trong game nét hơn hẳn**: đĩa minimap trước đây vẽ từ ảnh nền
  tier 1 (~975 px cho cả đảo) nên khi phóng to nhìn rất mờ. Giờ nó dùng chung
  ảnh tier 3 (`fullmap.webp`, 3900 px) với bản đồ lớn, giải mã thu nhỏ về mức
  đặt trong *Cài đặt → Bản đồ nhỏ → Độ nét bản đồ* (mặc định 2600 px; kéo về
  975 nếu muốn nhẹ RAM như cũ, hoặc lên 3900 cho nét nhất).
- **Footer**: bản dựng này từ mã nguồn mở nên footer rút gọn còn “Dựa trên
  TheIsle Overlay (mã nguồn mở)” + link tới repo gốc; bỏ link Facebook cá nhân.

### Xóa

- **Tab “Ủng hộ”** (mã QR + số tài khoản) đã gỡ khỏi ứng dụng.

## [1.10.0] — 2026-08-28

### Thêm

- **Lớp "Vùng đã đi qua" (fog of war)**: tích lũy lưới ô 500 m các vùng đã đi qua
  các phiên (`%LOCALAPPDATA%\…\explored.json`), vẽ tô nhẹ màu hổ phách lên cả bản
  đồ lớn lẫn minimap — nhìn phát biết đã cày hết chỗ nào. Bật/tắt trong bảng lớp,
  có nút *Xóa vùng đã đi*. Ghi nhận trong `pipeline::ingest_sample` (mọi vị trí
  đều đi qua đây), chỉ phát sự kiện khi vào ô 500 m mới nên gần như miễn phí.
- **Kế hoạch tuyến đường** (bản đồ lớn, mục *Đo & tọa độ*): bấm 🧭 *Vẽ tuyến* rồi
  click các điểm — hiện đường + tổng khoảng cách (dùng lại `measure` của thước
  đo). *Lưu tuyến* đặt tên và lưu vào `%APPDATA%\…\routes.json`; danh sách tuyến
  đã lưu bấm để tải lại / xóa. Chuột phải / Esc xóa tuyến đang vẽ.
- **Khung dịch cộng đồng**: `t()` giờ lùi về tiếng Anh cho key chưa dịch (không
  còn hiện key thô), file locale được phép **thiếu key** (`Partial`). Thêm
  `scripts/check-i18n.mjs` (báo % đã dịch + key lạ/thiếu, có trong CI),
  `CONTRIBUTING-i18n.md`, và một bản `pt.ts` (Bồ Đào Nha) khởi đầu ~18% — chọn
  *Português (beta)* trong Cài đặt để thử.

- **Hiện vị trí đồng đội (party)** — *tùy chọn, mặc định tắt*, chỉ ở chế độ đăng
  nhập cookie có live map. Đọc chính endpoint `/api/p/{slug}/map/markers` mà app
  đã poll sẵn (một request, không thêm tải), lọc ra các marker không phải mình rồi
  vẽ lên bản đồ lớn (chấm hồng + tên) và minimap (kim cương hồng + tên rút gọn).
  Bật lần đầu phải xác nhận một hộp thoại nhắc luật server. Tắt / đăng xuất là pin
  tự xóa. Chế độ token chưa hỗ trợ (API overlay không có markers nhóm).

## [1.9.0] — 2026-08-28

### Thêm

- **Bản đồ nhỏ xoay theo hướng đi** (tùy chọn, *Cài đặt → Bản đồ nhỏ*): khi bật,
  đĩa minimap xoay để hướng đang đi luôn ở trên; chữ la bàn và mũi tên chỉ khủng
  long tự xoay ngược lại cho đúng, tam giác người chơi chỉ thẳng lên. Chưa rõ
  hướng thì đĩa vẫn Bắc-ở-trên như cũ. Mặc định tắt.
- **Bảng màu cho người mù màu đỏ–lục** (*Cài đặt → Bảng màu lớp bản đồ*): chọn
  *Hỗ trợ mù màu đỏ–lục* để đổi màu các lớp POI sang bộ Okabe–Ito — quan trọng
  nhất là tách 3 lớp trước đây xanh-lá / đỏ / đỏ-cam (di cư / tuần tra / thức ăn)
  thành xanh-lục-lam / vàng / cam-đỏ dễ phân biệt. Đổi bảng màu là bản đồ lớn
  dựng lại toàn bộ lớp. Minimap giữ màu mặc định (các chấm ở đó không có cặp
  đỏ-lục nào).
- **Nhắc tuổi dữ liệu bản đồ** (*Cài đặt → Dữ liệu*): nếu dữ liệu tải quá 30 ngày,
  hiện dòng nhắc "đã tải N ngày trước — tải lại nếu game/dữ liệu cộng đồng vừa
  cập nhật". Không dò mạng, không báo động giả — chỉ nhắc.

- **Nhóm / thư mục waypoint** (bản đồ lớn): mỗi điểm đánh dấu có thể gán một tên
  nhóm (nút 📁 trong danh sách, gõ mới hoặc chọn nhóm có sẵn). Hàng nút nhóm ở đầu
  danh sách — bấm để **ẩn/hiện cả nhóm trên bản đồ** (cả bản đồ lớn lẫn minimap;
  mũi tên rìa minimap cũng bỏ qua nhóm đang ẩn). Danh sách vẫn hiện điểm thuộc
  nhóm bị ẩn để còn gán lại. `waypoints.json` lên v2 — file cũ đọc bình thường,
  điểm chưa có nhóm giữ nguyên.
- **Xuất / nhập bộ waypoint** (bản đồ lớn): nút *Xuất* lưu toàn bộ điểm ra file
  `.tio-wp.json` (tên, tọa độ, màu, nhóm) để gửi cho bạn bè; nút *Nhập* trộn file
  vào bộ hiện có — điểm cách điểm cũ dưới 1 m coi là trùng và bỏ qua, phần còn
  lại thêm mới. Hiện số đã nhập / bỏ qua sau khi xong. Thuần file cục bộ, không
  gọi mạng.

## [1.8.0] — 2026-08-28

### Thêm

- **Nhiệm vụ Prime gắn với bản đồ** (bản đồ lớn): mục *Nhiệm vụ Prime* trong bảng
  bên phải liệt kê 10 nhiệm vụ (✓/○, dịch tiếng Việt như tab Khủng long). Nhiệm vụ
  có địa điểm ("Visit 2 Sanctuaries", "Visit 3 Patrol zones", "Visit Migration
  zone"…) mang biểu tượng 📍 — bấm vào để **ép bật lớp POI tương ứng** và nhảy tới
  khu gần nhất; khi đã có vị trí, dòng dưới hiện tên + hướng + khoảng cách tới khu
  gần nhất (cập nhật theo mỗi lần chép tọa độ). Nhiệm vụ không có địa điểm (chế độ
  ăn, sinh sản, loài) chỉ liệt kê. Việc khớp chuỗi → lớp và mọi phép đo nằm ở Rust.

- **Thước đo khoảng cách + tọa độ dưới con trỏ** (bản đồ lớn): mục *Đo & tọa độ*
  trong bảng bên phải. Bật *Thước đo* rồi bấm các điểm trên bản đồ — hiện đường
  đứt nét + tổng khoảng cách (m/km) và hướng la bàn từ điểm đầu tới điểm cuối,
  bấm tiếp để nối nhiều chặng; chuột phải hoặc Esc để xóa. Tùy chọn *Hiện tọa độ
  dưới con trỏ* hiện ô tọa độ game (cm) ở góc bản đồ khi rê chuột — tiện đọc cho
  bạn bè qua chat. Toàn bộ phép đo (px→cm, khoảng cách, bearing) tính ở Rust,
  frontend không tự chuyển đổi.
- **Xem lại đường đi phiên trước** (bản đồ lớn): mục *Phiên trước* trong phần
  Đường đã đi — liệt kê mọi file `trail_*.jsonl` đã lưu (mới nhất trước), tick để
  chồng lên bản đồ, mỗi phiên một màu mờ khác nhau. Chỉ đọc, không sửa file.

## [1.6.0] — 2026-08-28

### Thêm

- **Thông báo cảnh báo chỉ số** (tab Khủng long → *Cảnh báo*): hiện toast Windows khi
  khát / đói / máu tụt xuống ngưỡng đặt được, khi Prime đủ điều kiện, hoặc khi growth
  chạm mốc 25 / 50 / 75 / 100%. Kích theo cạnh + hysteresis: một thanh nằm dưới ngưỡng
  không báo lại cho tới khi hồi lên quá ngưỡng + 10 điểm; mỗi luật có cooldown riêng
  (đói/khát/máu 5 phút, Prime 10 phút, growth 2 phút). Chỉ báo khi khủng long **đang
  online** — không báo trên dữ liệu cache lúc offline. Mặc định **tắt** (thông báo dễ
  gây phiền); đặt ngưỡng = 0 để tắt riêng từng luật. Có nút *Gửi thử*. Chuỗi thông
  báo song ngữ theo ngôn ngữ app; không đụng game, không gọi mạng.

- **Lịch sử chỉ số khủng long + biểu đồ** (tab Khủng long): poller vốn kéo growth /
  máu / đói / khát / thể lực / Prime mỗi vài giây rồi bỏ đi; giờ mỗi mẫu tốt được
  ghi một dòng JSONL gọn vào `%LOCALAPPDATA%\TheIsleOverlay\dino_history.jsonl`
  (tự giới hạn nhịp ghi ~30 giây, tự cắt bớt theo `history_days` = 14 lúc khởi
  động). Tab hiển thị đường cong growth, hai biểu đồ đói/khát và các số liệu suy
  ra tính ở Rust: tốc độ lớn (%/giờ, khớp bình phương tối thiểu), ước tính giờ tới
  trưởng thành, tốc độ tụt + giờ cạn của đói/khát. Chuỗi được cắt theo "mạng hiện
  tại" — đổi dino / đổi server / gián đoạn dài là bắt đầu đoạn mới, nên một lần
  chết giữa cửa sổ không làm sai tốc độ. Tắt được ở *Khủng long → Lưu lịch sử chỉ
  số*; nút *Xóa lịch sử* xóa hẳn file. Không đụng game, không gọi mạng.

## [1.5.2] — 2026-08-25

### Thay đổi

- **Quay lại tab Bản đồ là hiện ngay, giữ nguyên chỗ đang xem**: trước đây rời tab Bản
  đồ là toàn bộ Leaflet bị huỷ, quay lại phải dựng lại từ đầu — khoảng 16 lượt gọi tuần
  tự sang Rust, đọc và parse lại 120 KB điểm quan tâm, dựng lại 634 đối tượng lớp (608
  trong số đó thuộc lớp đang tắt), nạp lại ảnh nền 7800×7817 — và mất luôn mức zoom, vị
  trí đã kéo. Số liệu sử dụng cho thấy người chơi quay lại tab này khoảng 2 lần mỗi
  phiên. Giờ bản đồ được giữ sống khi ẩn (đúng cách tab Khủng long và Garage đã làm);
  trong lúc ẩn, mẫu vị trí và đường đi chỉ được ghi nhớ chứ không vẽ, không kéo bản đồ,
  không hỏi Rust waypoint gần nhất — quay lại là vẽ đúng một lần từ mẫu mới nhất. Đổi
  nền bản đồ từ tab Cài đặt vẫn dựng lại đúng khung nhìn dù bản đồ đang ẩn. (`a2c2bdb`)
- **Bật/tắt lớp bản đồ không còn quét hai lần**: mỗi cú bấm trước đây duyệt toàn bộ nhóm
  lớp hai lượt (một từ ô tick, một từ thông báo cài đặt vòng về), và *mọi* thay đổi cài
  đặt khác — phím tắt độ đậm minimap, đổi ngôn ngữ, cả thông báo đồng bộ theo từng mẫu vị
  trí — cũng khiến bản đồ lớn duyệt lại toàn bộ lớp. Giờ chỉ duyệt khi trạng thái lớp thực
  sự thay đổi. (`a2c2bdb`)
- **Dữ liệu điểm quan tâm được cache phía Rust**: ba nơi gọi (bản đồ lớn lúc mở và sau
  mỗi lần tải dữ liệu, cửa sổ minimap) trước đây mỗi nơi tự đọc, parse và chiếu toạ độ
  lại toàn bộ file. Cache khoá theo nền bản đồ và dấu thời gian file, nên tải lại dữ liệu
  hay đổi nền tự làm mới, không cần ai nhớ xoá. (`a2c2bdb`)
- **Đo đạc sử dụng đúng hơn**: nhãn `dino3d_view` thực chất đo việc mở tab Khủng long
  (tab đó không có 3D — viewer nằm ở Garage), đổi thành `dino_tab_open`; `fullmap_open`
  không còn tự cộng một lượt mỗi lần mở app, vì số lần mở app đã có ô riêng. (`a2c2bdb`)

### Sửa

- **Lỗi hiếm "Cannot read properties of undefined (reading '_leaflet_pos')"** (1 báo cáo
  trên 1.5.1): Leaflet kết thúc animation zoom bằng một bộ hẹn giờ 250 ms sống lâu hơn
  `map.remove()`; lăn chuột zoom rồi bấm sang tab khác trong khoảng đó là bộ hẹn giờ
  chạm vào một bản đồ đã bị huỷ. Cùng họ với lỗi `'on'` của 1.5.0 — đều là bản đồ bị huỷ
  giữa chừng. Việc giữ bản đồ sống ở trên xoá luôn đường huỷ-khi-chuyển-tab; thêm chốt
  chặn cho đường còn lại khi đổi nền. (`7931471`)

## [1.5.1] — 2026-08-24

### Sửa

- **Bản đồ lớn thỉnh thoảng trống, không phản hồi** (báo lỗi tự động đầu tiên
  của 1.5.0: `Cannot read properties of undefined (reading 'on')`, 7 lần trên
  một máy): rời tab Bản đồ hoặc đổi nguồn bản đồ khi bản đồ chưa tải xong (máy
  chậm) làm phần tải tiếp tục chạy trên một bản đồ đã bị gỡ. Lỗi có từ trước,
  1.5.0 chỉ là bản đầu tiên nhìn thấy nó nhờ báo lỗi tự động. (`f5850e5`)
- **Minimap bật lại nhưng nằm dưới game**: sau khi tắt, game (hoặc overlay
  Steam/Discord) có thể chen lên trên trong nhóm cửa sổ "luôn trên cùng"; bật
  lại thì Windows trả minimap về đúng vị trí cũ — dưới game — và vòng kiểm tra
  2 giây không nhận ra vì cờ "trên cùng" vẫn còn. Giờ ép lên trên cùng ngay mỗi
  lần hiện. (`f5850e5`)
- **Ô "Hiện minimap" trong Cài đặt không đổi khi bấm hotkey**: đang mở tab Cài
  đặt mà bấm `Ctrl+Alt+M` tắt minimap thì ô vẫn tích, bấm vào "để bật lại" thực
  ra lại gửi lệnh tắt. Màn Cài đặt giờ nghe thay đổi từ hotkey. (`f5850e5`)

## [1.5.0] — 2026-08-24

### Thêm

- **Số liệu sử dụng ẩn danh**: app gửi một ping mỗi lần khởi động tới backend riêng
  trên Cloudflare Workers, để biết có bao nhiêu người còn dùng, phiên bản nào còn
  chạy ngoài thực tế, và **tính năng nào hay được mở** — cơ sở để quyết định nên tối
  ưu chỗ nào thay vì đoán. Số lần dùng từng tính năng được đếm cục bộ trong bộ nhớ,
  ghi xuống đĩa mỗi 60 giây (app overlay hay bị tắt cứng hơn là đóng sạch) rồi gửi
  kèm ping lần mở kế tiếp — nên **một lần mở app chỉ tốn đúng một request**, không
  phải một request mỗi lần bấm. Những gì được gửi: một mã cài đặt ngẫu nhiên, phiên
  bản app, số hiệu bản Windows, ngôn ngữ giao diện, và các bộ đếm đó. **Không gửi địa
  chỉ IP** — máy chủ chỉ lấy mã quốc gia từ biên Cloudflare rồi bỏ địa chỉ đi; không
  gửi vị trí trong game; không gửi tên tài khoản Windows. Tắt được bất cứ lúc nào ở
  **Cài đặt → Số liệu sử dụng & phản hồi**. Mất mạng hay backend chết thì app im lặng
  bỏ qua, không hiện lỗi và không chờ. (`ac28f61`)
- **Gửi phản hồi ngay trong app**: mục mới ở cuối màn Cài đặt — chọn Lỗi / Góp ý /
  Khác, mô tả vấn đề, để lại cách liên hệ nếu muốn nhận trả lời. Gửi trùng đúng một
  nội dung nhiều lần chỉ tính một. Nút này không phụ thuộc công tắc số liệu ở trên:
  bấm Gửi là đồng ý gửi đúng tin nhắn đó, không hơn. (`ac28f61`)
- **Báo lỗi tự động**: khi app hoặc giao diện gặp lỗi không bắt được, một báo cáo gọn
  (loại lỗi + vài dòng stack đầu) được gửi để sửa. Đường dẫn Windows được thay
  `C:\Users\<tên>\` bằng `%USERPROFILE%\` **ngay trên máy bạn trước khi gửi**, nên tên
  tài khoản không bao giờ rời khỏi máy. Tối đa 3 báo cáo mỗi lần chạy và 10 mỗi ngày
  — app kẹt vòng lặp lỗi cũng không thể spam. (`ac28f61`)

## [1.4.3] — 2026-08-23

### Sửa

- **Vùng khoanh hình đa giác không hiện trên bản đồ**: tầng render bắt mọi điểm phải có
  toạ độ tâm `x`/`y`, nhưng vùng đa giác chỉ mang danh sách đỉnh `points` — nên bị loại
  bỏ trước cả khi đọc tới đỉnh. Kết quả: **vùng di cư chỉ hiện 4/12** (mất Swamp,
  South Plains, NE Cape, Southern Beach, Highlands, Northern Jungle, East Jungle,
  Delta), **khu bảo tồn 1/7**, **vùng tuần tra AI 27/61**. Giờ tâm vùng được tính
  từ trọng tâm các đỉnh, mọi vùng đều vẽ đủ. Lỗi có từ bản Tauri đầu tiên. (`39c42e8`)

### Thêm

- **Vùng di cư Lagoon**: myislemap và Vulnona mỗi bên thiếu một vùng của bên kia,
  nên lớp vùng di cư giờ hợp cả hai nguồn (12 → 13 vùng): giữ nguyên hình dạng từ
  myislemap, bổ sung `Lagoon` đọc từ mục `dir Migration` của Vulnona `data_1.txt`.
  Tên trùng được khớp chuẩn hoá nên `Highlands` và `Highland (MMZ)` không bị
  nhân đôi. Dữ liệu trên máy đã cài tự nâng cấp offline từ cache ở lần mở kế tiếp. (`39c42e8`)

## [1.4.2] — 2026-08-23

### Sửa

- **Hotkey mở bản đồ khi cửa sổ bị game che**: bản đồ lớn nằm sau game (borderless
  fullscreen) vẫn được Windows coi là "đang hiện", nên bấm hotkey lần đầu bị hiểu
  ngược thành đóng bản đồ — thấy "nháy" một cái và phải bấm lần hai mới mở được.
  Giờ chỉ khi bản đồ lớn thực sự ở foreground (bạn đang nhìn nó) hotkey mới đóng;
  bị che hoặc thu nhỏ thì bấm một lần là mở lên ngay. (`b1f15c6`)

## [1.4.1] — 2026-08-23

### Thêm

- **Hotkey mở bản đồ tự về tab Bản đồ**: bấm Ctrl+Alt+F trong game để hiện cửa
  sổ là app chuyển ngay sang tab Bản đồ, không dừng ở tab đang mở dở; mở từ
  icon khay hoặc chạy lần hai vẫn giữ tab cũ. (`75cef13`)
- **Mục "Lớp bản đồ" thu gọn được**: bấm tiêu đề (mũi tên xoay + chữ Thu
  gọn/Mở rộng) để gập danh sách lớp — thấy ngay đường đã đi, vị trí, waypoint
  bên dưới không phải cuộn; trạng thái được nhớ qua các phiên. (`75cef13`)

## [1.4.0] — 2026-08-23

### Thêm

- **Đăng nhập Steam 1 lần cho mọi server IslePilot** (khuyên dùng): đăng nhập
  qua islepilot.eu duy nhất một lần, token dùng chung cho mọi server — hết cảnh
  nhập link server + copy cookie mỗi lần đổi server. Token lưu mã hóa DPAPI;
  redirect được bắt ngay trong cửa sổ đăng nhập (không đăng ký protocol hệ
  thống, không đụng app overlay gốc nếu có cài); có ô dán token thủ công làm
  lối thoát. Chế độ mới đọc API JSON thay vì scrape HTML: thêm **thể lực, dinh
  dưỡng Carb/Đạm/Béo, tên server đang chơi, giới tính** trong tab Khủng long.
  Cách cũ nhập server + cookie giữ nguyên làm dự phòng, người dùng cũ không
  phải làm lại gì. (`b8cff31`)
- **Tab Garage (Gacha)** — cần đăng nhập token: mỗi dino đã park là một card
  gồm **model 3D xoay/phóng được, đúng màu skin đã park** + tên/loài/growth +
  nút Park/Restore/Đổi tên/Bán (Bán chỉ hiện khi server bật; có hộp xác nhận).
  Model + texture tải từ CDN công khai của IslePilot (21 loài), cache trên đĩa
  — lần đầu mỗi loài tải vài MB có hiện tiến trình, các lần sau mở tức thì và
  offline được. Danh sách tự làm mới mỗi 10 phút khi tab đang mở (có dòng
  trạng thái), server không hỗ trợ garage thì báo rõ thay vì nút chết.
  (`63b4caf`, `2044c5f`)
- **Lớp bản đồ "POI server (IslePilot)"**: vẽ POI sống do admin server đặt
  (Sanctuaries, Migration/Patrol Zones…) lên bản đồ lớn, màu theo server, tự
  làm mới ~15 giây; cần đăng nhập token, thiếu quyền (link Discord/server tắt
  live map) thì hiện lý do trong bảng lớp. (`5bbb840`)
- **Thanh Thể lực trên minimap**: dải chỉ số dưới đĩa thêm hàng ⚡ khi có dữ
  liệu (chế độ token); cửa sổ overlay tự cao thêm đúng một hàng. (`f60d567`)
- **Icon cho thanh tab + tab Ủng hộ riêng**: 6 tab đều có icon; QR VietQR
  chuyển từ popup Footer thành tab Ủng hộ cạnh Hướng dẫn. (`69dbf51`)
- **Protocol `theisle-overlay://`**: bấm link `theisle-overlay://?sid=..&token=..`
  từ bất kỳ đâu là mở app và đăng nhập luôn — cố ý không dùng scheme
  `isle-overlay://` để không tranh với app gốc. (`aa9aa8e`)

### Sửa

- **Minimap "tự bỏ tích" rồi bật lại không hiện, phải mở lại app** — hai lỗi
  thực địa: (1) Windows tự lặp hotkey khi giữ tổ hợp làm toggle đảo ngược tức
  thì → thêm debounce 350 ms cho các phím bật/tắt (phím chỉnh độ đậm/zoom vẫn
  lặp như chủ đích); (2) cửa sổ minimap chết (WebView2 crash) thì supervisor
  trước đây lặp vô hạn không làm gì — giờ tự phát hiện và dựng lại trong ~5
  giây. (`6265364`)

### Thay đổi

- **Hướng dẫn kết nối IslePilot viết lại**: 2 cách rõ ràng — Đăng nhập Steam
  qua IslePilot (khuyên dùng) và cách cũ server + cookie (dự phòng); bỏ mục
  giải thích hướng đi và câu "giữ bí mật chuỗi như mật khẩu". (`f7d7818`)
- Tab Khủng long và Garage được giữ sống sau lần mở đầu (chuyển tab không còn
  khựng); model 3D chỉ dựng lại khi đổi loài/màu, tạm ngừng render khi khuất
  màn hình. (`2044c5f`)

## [1.3.0] — 2026-08-22

### Thêm

- **Bảng nhiệm vụ Prime trên overlay**: panel mới dưới thanh chỉ số của bản đồ
  nhỏ, liệt kê 10 nhiệm vụ Prime kèm ✓/○ và bộ đếm "Prime 2/10"; nhiệm vụ xong
  tô xanh, dòng dài tự cắt "…". Bật/tắt bằng checkbox trong tab Khủng long hoặc
  **hotkey Ctrl+Alt+Q** (đổi được trong Cài đặt); cửa sổ overlay tự co giãn
  theo số nhiệm vụ, mất mạng tạm thời không làm panel co giật. (`ec5da8a`)
- **Dịch nhiệm vụ sang tiếng Việt**: từ điển dịch tay cho toàn bộ pool nhiệm
  vụ đã biết + mẫu theo số ("Visit 3 Patrol zones" → "Ghé 3 khu Tuần tra");
  câu lạ dịch qua API miễn phí MyMemory **đúng một lần** rồi lưu vĩnh viễn tại
  `%LOCALAPPDATA%\TheIsleOverlay\quest_translations.json` (hết quota tự nghỉ
  6 giờ và hiện tiếng Anh; UI tiếng Anh bỏ qua API hoàn toàn). Tab Khủng long
  hiện câu tiếng Việt, rê chuột thấy câu gốc tiếng Anh. (`ec5da8a`)

### Thay đổi

- **Vị trí từ IslePilot chính xác hơn**: đọc thẳng JSON markers API của panel
  (`/api/p/{slug}/map/markers` — đúng nguồn panel tự dùng, tọa độ UE cm chuẩn
  xác, không sợ panel đổi giao diện), tự nhận marker của bạn qua steamId trong
  cookie phiên; trang HTML `/map` giữ làm nguồn dự phòng và để dò khả năng
  live map. (`ec5da8a`)

## [1.2.0] — 2026-08-22

### Thêm

- **Mũi tên dẫn đường waypoint trên minimap**: mũi tên ở rìa đĩa chỉ hướng +
  khoảng cách tới waypoint gần nhất khi nó nằm ngoài vùng nhìn; waypoint trong
  vùng nhìn hiện thành chấm (viền trắng, khác chấm POI viền đen). Có công tắc
  riêng trong Cài đặt › Bản đồ nhỏ.
- **Chế độ bám vị trí + mũi tên mép** trên bản đồ lớn: kéo bản đồ đi nơi khác
  là tạm ngừng tự căn giữa, mũi tên ở mép màn hình chỉ về phía bạn — bấm mũi
  tên hoặc nút "Về vị trí của tôi" để quay lại và bám tiếp.
- **Ô tìm kiếm địa danh** trên bảng phải tab Bản đồ: gõ tên vùng/địa
  điểm/hồ nước/waypoint → nhảy tới kèm hiệu ứng nhấp nháy đánh dấu.
- **Dán tọa độ → nhảy tới**: dán chuỗi tọa độ (bạn bè nhắn qua chat) vào ô tìm
  kiếm — parse bằng đúng bộ đọc tọa độ của clipboard (thuần thao tác tay).
- **Màu + biểu tượng cho waypoint**: nút tròn màu cạnh mỗi waypoint (bấm để
  đổi qua 7 màu, đồng bộ cả minimap); hộp đặt tên có sẵn nút biểu tượng nhanh
  💀 🏠 💧 ⚠️ 🍖 — waypoint mang biểu tượng thì **hiện thẳng biểu tượng đó
  trên cả hai bản đồ** thay cho chấm tròn, và nhãn mũi tên dẫn đường cũng kèm
  biểu tượng ("💧 850 m").

- **Lớp "Động vật"**: ~340 điểm spawn động vật AI (Boar, Bunny, Chicken, Crab,
  Deer, Frog, Goat, Teno, Turtle) từ dữ liệu cộng đồng của islemaps.com — bật
  trong bảng lớp của bản đồ lớn, hiện trên cả minimap, dùng được với mọi kiểu
  nền. **Mỗi loài một biểu tượng riêng** (🐗 🐰 🐔 🦀 🦌 🐸 🐐 🦕 🐢) để nhận
  ra ngay không cần rê chuột. Nguồn tải runtime và fail-soft như mọi nguồn
  khác: trang đổi cấu trúc thì lớp tạm vắng, không ảnh hưởng gì còn lại
  (POIS_VERSION 3).
- **Lớp "Nước ngọt"**: lớp phủ tô đúng các sông/hồ uống được (từ islemaps.com),
  căn chỉnh chính xác trên CẢ ba kiểu nền nhờ quy đổi khung tọa độ phía Rust;
  hiện trên cả bản đồ lớn lẫn minimap, bật/tắt trong bảng lớp.
- **Nút "Xóa đường đi"** trong bảng bên phải tab Bản đồ: xóa vết phiên hiện
  tại + ẩn vết phiên trước trên CẢ HAI cửa sổ cho đỡ rối mắt giữa trận; file
  lịch sử trên đĩa vẫn giữ nguyên (có ghi mốc ngắt).
- **Toggle "Hiện đường đi trên bản đồ nhỏ"** trong Cài đặt › Bản đồ nhỏ — tắt
  là minimap sạch vết, bản đồ lớn vẫn hiện đủ.
- **Lựa chọn nền bản đồ** trong Cài đặt: Vulnona (mặc định) / IsleMaps sáng /
  IsleMaps tối — nền vẽ tay từ [islemaps.com](https://www.islemaps.com/) (Pont
  & Emeara), áp dụng đồng thời cho bản đồ lớn lẫn minimap. Bản IsleMaps vẽ theo
  phiên bản game mới hơn nên thấy cả quần đảo đông nam (Hell's Mouth) mà ảnh
  Vulnona 0.21.7 cắt mất. Ảnh chỉ tải khi bạn chọn lần đầu (~6,4 / 4,5 MB, có
  kiểm tra toàn vẹn kích thước), sau đó dùng offline; nút "Tải lại dữ liệu"
  refresh có điều kiện qua ETag. Waypoint/trail giữ nguyên vì mọi tọa độ lưu
  bằng cm gốc của game; mỗi nền có calibration riêng nhúng sẵn kèm bộ test
  anchor, và `verify_data --source` đối chiếu điểm POI với ảnh nền cho cả 3
  nguồn.

### Thay đổi

- Hình học bản đồ (kích thước ảnh, khung zoom) giờ lấy động từ Rust
  (`get_map_info`) thay vì hằng số 7800×7817 phía frontend; khung zoom neo theo
  tỉ lệ mặt đất nên mức phóng to/thu nhỏ thực tế giữ nguyên trên mọi nền.
- Minimap nạp ảnh IsleMaps có thu nhỏ lúc decode (bitmap thường trú ~6 MB thay
  vì ~25 MB) và giải phóng bitmap cũ ngay khi đổi nền.

## [1.1.1] — 2026-08-21

### Sửa

- **Minimap ẩn khi Alt-Tab ra ngoài game**: game chạy borderless vẫn "visible"
  phía sau các app khác nên gate theo sự-tồn-tại khiến minimap lơ lửng đè lên
  Chrome/desktop — giờ gate theo cửa sổ foreground, có debounce ~0,5 giây chống
  nhấp nháy, quay lại game là hiện ngay. (`c45ecf8`)
- **Cài mới xong minimap không hiện trong game**: quy tắc "ẩn khi bản đồ lớn
  đang mở" kiểm tra WS_VISIBLE, mà cửa sổ chính nằm SAU game vẫn tính là
  visible → chặn nhầm minimap tới khi người dùng tự ẩn cửa sổ chính. Giờ chỉ
  chặn khi cửa sổ chính thực sự ở foreground. (`4409e87`)

### Thay đổi

- Bản đồ lần đầu mở chỉ bật lớp **Tên vùng** — các lớp POI khác tắt sẵn cho
  sạch, bật lại một chạm trong bảng lớp; lựa chọn đã lưu của người dùng cũ
  không bị ảnh hưởng. (`6f06035`)

## [1.1.0] — 2026-08-21

### Thêm

- **Icon khay hệ thống (system tray)** với menu Hiện cửa sổ / Thoát (song ngữ, đổi theo ngôn ngữ app). Nút X giờ thu app về khay như Steam/Discord thay vì hủy cửa sổ; chuột trái icon để mở lại. (`ccdb70c`)
- **Minimap chỉ hiện khi game đang chạy** — cài đặt mới "Chỉ hiện khi game đang chạy" (mặc định bật). Game thu nhỏ là minimap ẩn trong ~0,25 giây, tắt game là ẩn trong ~2,5 giây, mở game lại là tự hiện đúng góc đã neo. (`ccdb70c`)
- **Tam giác vàng đánh dấu vị trí của bạn** trên cả minimap lẫn bản đồ lớn — viền kép đen-trắng, xoay theo hướng di chuyển; khi chưa rõ hướng hiện đĩa vàng. Không thể nhầm với waypoint hay chấm POI nữa. (`518992d`)
- **Hotkey cứu hộ Ctrl+Alt+R**: tải lại giao diện cả hai cửa sổ — là phím tắt toàn cục nên hoạt động kể cả khi UI không nhận click; vị trí/trail tự khôi phục sau reload. (`cc0eb13`)
- **Footer** hiện phiên bản app + gợi ý "Nhấn F5 hoặc Ctrl+Alt+R để tải lại" ở góc trái dưới. (`518992d`, `cc0eb13`)
- **Tab Khủng long**: khu cài đặt server + cookie tự thu gọn sau khi đăng nhập (nút ⚙ để mở lại — hết cảnh phải cuộn mới thấy chỉ số). App tự dò server có live map hay không: có thì mặc định bật "lấy vị trí tự động" (vẫn tắt được, và lựa chọn tay của bạn luôn được tôn trọng), không có thì tự tắt và khóa ô tích, kèm dòng trạng thái ngay dưới. (`990dae9`)
- Lệnh `get_current_position`: mở lại cửa sổ hoặc F5 là vị trí + trail hiện ngay, không phải chờ lần copy tọa độ kế tiếp. (`ccdb70c`, `518992d`)
- Ghi log lỗi giao diện toàn cục vào file log (`%LOCALAPPDATA%\TheIsleOverlay\logs`) và log mọi lần ẩn/hiện cửa sổ — báo lỗi thực địa giờ tự chỉ đích danh nguyên nhân. (`518992d`, `462c67a`)
- Hướng dẫn kết nối tab Khủng long từng bước (Steam login / dán cookie, kèm ảnh minh họa) trong tab Hướng dẫn của app và cả hai README, cùng danh sách server IslePilot tham khảo. (`5e40555`)

### Sửa

- **Hotkey "chết hẳn" phải End Task**: message queue của thread hotkey giờ được tạo trước khi công bố thread id (WM_QUIT từng bị nuốt khiến thread mồ côi giữ toàn bộ phím); dừng thread cũ có chờ (join) trước khi đăng ký lại nên đổi phím không còn làm mất hết hotkey; đăng ký có retry; hành động chạy trên worker riêng nên vòng bơm message không bao giờ bị chặn. (`ccdb70c`)
- **Đơ tab / UI không nhận click**: nhiều lớp — watchdog tự phát hiện và hồi webview bị treo (`ccdb70c`), cú hích `NotifyParentWindowPositionChanged` tái đồng bộ luồng chuột sau mỗi lần hiện (`462c67a`), và loại bỏ tận gốc ở mục Thay đổi bên dưới (`a999133`).
- **Minimap nuốt click của chính app**: đĩa minimap (luôn-trên-cùng) đè lên cửa sổ chính sẽ nuốt click vùng nó che khi tắt click-xuyên → minimap giờ tự ẩn khi bản đồ lớn đang mở và tự hiện lại khi đóng. (`cc0eb13`)
- **Poller IslePilot chết vĩnh viễn** khi phiên hết hạn hoặc site đổi giao diện (hai trường hợp không phân biệt được): giờ cảnh báo một lần, poll chậm dần (backoff lũy tiến, trần 5 phút) và tự hồi khi đọc được trở lại. (`ccdb70c`)
- Mở app từ icon khay từng hiện trang cũ do thiếu bước đồng bộ. (`462c67a`)
- Chuyển tab nhanh làm rò rỉ listener sự kiện; F5 giờ giữ nguyên tab đang mở; lỗi Leaflet được cách ly khỏi thanh tab (có nút Thử lại). (`518992d`)
- Sample tọa độ đầu tiên sau khi khởi động từng bị mất; minimap giờ luôn được giám sát kể cả khi webview khởi tạo lỗi (fallback 5 giây). (`ccdb70c`)
- Cookie hợp lệ nhưng **chưa có dino trên server** từng bị từ chối oan là "cookie
  không hợp lệ" (trang /me chỉ ghi "No dino" nên không có chỉ số để parse) — cả 3
  đường dán cookie / đăng nhập Steam / cảnh báo hết-phiên của poller giờ xác thực
  bằng dấu hiệu phiên đăng nhập thật của panel, không phụ thuộc chỉ số dino. Link
  server thừa dấu `/` cuối cũng được chuẩn hóa. (`16c26a1`)
- Sửa lỗi biên dịch CI: trùng module test, chữ ký `IsSuspended`. (`bf7e5e2`)

### Thay đổi

- **Gỡ hoàn toàn cơ chế đóng băng webview (TrySuspend)** — thao tác bất đồng bộ bên trong WebView2 này là gốc của mọi biến thể "cửa sổ hiện mà click chết" (3 sự cố thực địa một ngày). Thay bằng gợi ý dọn cache đồng bộ (`MemoryUsageTargetLevel` LOW khi ẩn / NORMAL khi hiện); sự kiện broadcast tới cả cửa sổ ẩn nên hiện lại là đúng ngay. Đánh đổi: app ẩn/ngồi khay nặng thêm ~80 MB — đổi lấy độ tin cậy tuyệt đối giữa trận. Watchdog giữ lại làm lính canh. (`a999133`, đảo ngược `4a2f3c7`)
- Mọi mutex dùng khóa chống-poisoning (`lock_safe`) — một panic lẻ ở thread nào đó không còn kéo sập clipboard, supervisor và hotkey cùng lúc. (`ccdb70c`)
- Kiểm tra ẩn/hiện cửa sổ qua registry HWND (`IsWindowVisible`/`IsIconic` — đọc tức thời) thay cho getter chặn-luồng của tauri; luồng bơm hotkey không còn phụ thuộc main loop. (`ccdb70c`)
- Nâng phiên bản 1.1.0. (`6357f40`)

## [1.0.1] — 2026-08-19

### Sửa

- Spam Ctrl+Alt+F nhanh không còn làm treo cửa sổ (thêm độ trễ ổn định + token hủy cho cơ chế đóng băng webview). (`2cb6f44`)

### Tài liệu

- Thêm ảnh chụp trong game và toàn bản đồ vào README; thêm mục liên hệ/ủng hộ. (`a6ea77e`, `2cb6f44`)

## [1.0.0] — 2026-08-19

Bản viết lại toàn bộ bằng Tauri (Rust + WebView2) từ app PySide6 gốc — giữ nguyên định dạng cài đặt/waypoint/trail nên dữ liệu cũ dùng lại được ngay. (`ffb2126`)

### Thêm

- Nhãn tên vùng/địa danh trên bản đồ và các lớp bật/tắt mới. (`1b40416`)
- Tab "Khủng long của bạn": đọc chỉ số dino (growth, máu, đói, khát, Prime) từ panel IslePilot của server, đăng nhập Steam qua webview hoặc dán cookie. (`9ea7a90`)
- Footer ghi công tác giả với liên kết GitHub/Facebook và popup ủng hộ VietQR. (`19e4dd2`)
- README song ngữ Việt/Anh. (`859f061`)

### Sửa

- Dữ liệu tải lần đầu tới thẳng minimap không cần khởi động lại; các tab dùng được ngay trong lúc tải. (`3f1bff7`)
- Ctrl+Alt+F khôi phục được bản đồ lớn từ trạng thái thu nhỏ. (`f8988fe`)

### Hiệu năng

- Đóng băng cửa sổ ẩn để giải phóng RAM renderer. (`4a2f3c7` — *đã gỡ ở 1.1.0 vì gây lỗi treo, xem phần Thay đổi của 1.1.0*)

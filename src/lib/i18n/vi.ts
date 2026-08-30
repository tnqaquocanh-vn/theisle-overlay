// Toàn bộ chuỗi hiển thị tiếng Việt. Port từ strings_vi.py của bản gốc,
// thêm các khóa mới cho tab, danh sách waypoint, cài đặt và hướng dẫn.
// Không file UI nào được viết thẳng chuỗi hiển thị.

export const vi = {
  // --- chung ---
  "app.title": "Bản đồ The Isle",
  "app.minimap_title": "Bản đồ nhỏ",
  "app.fullmap_title": "Bản đồ Gateway",

  // --- tab ---
  "tab.map": "Bản đồ",
  "tab.dino": "Khủng long",
  "tab.settings": "Cài đặt",
  "tab.garage": "Garage",
  "tab.skin": "Skin",
  "tab.guide": "Hướng dẫn",

  // --- trình chỉnh skin ---
  "skin.title": "Trình chỉnh Skin",
  "skin.subtitle": "Chỉnh 10 kênh màu da khủng long, xem trực tiếp trên model 3D. Chỉ ở máy bạn — không gửi đi đâu.",
  "skin.species": "Loài",
  "skin.channels": "10 kênh màu",
  "skin.ch_body": "Thân",
  "skin.ch_flank": "Hông",
  "skin.ch_underbelly": "Bụng",
  "skin.ch_markings": "Hoa văn",
  "skin.ch_display": "Màu phô diễn",
  "skin.ch_detail": "Chi tiết",
  "skin.ch_eyes": "Mắt",
  "skin.ch_teeth": "Răng",
  "skin.ch_mouth": "Miệng",
  "skin.ch_claws": "Vuốt",
  "skin.randomize": "Ngẫu nhiên",
  "skin.reset": "Đặt lại",
  "skin.copy_game": "Sao chép mã game",
  "skin.copy_app": "Mã app",
  "skin.paste": "Dán mã",
  "skin.copied_game": "Đã chép mã game — vào game bấm Import để dán",
  "skin.copied_app": "Đã chép mã app (chia sẻ giữa người dùng overlay)",
  "skin.paste_bad": "Clipboard không có mã skin hợp lệ",
  "skin.pattern": "Pattern",
  "skin.pattern_nopreview": "Pattern này chưa có ảnh xem trước (chỉ có {n}) — mã game vẫn xuất đúng số.",
  "skin.hex_bad": "Mã hex không hợp lệ",
  "skin.your_skins": "Skin của bạn",
  "skin.preset_name": "Tên skin",
  "skin.save": "Lưu",
  "skin.no_presets": "Chưa lưu skin nào. Chỉnh màu rồi bấm Lưu.",
  "skin.delete": "Xoá skin này",
  "skin.no_model": "Loài này chưa có model 3D — vẫn chỉnh và lưu màu được.",
  "skin.live_apply": "Áp trực tiếp lên khủng long (IslePilot)",
  "skin.live_hint": "Gửi màu qua IslePilot theo thời gian thực khi bạn chỉnh. Cần đăng nhập Steam ở tab Khủng long.",
  "skin.save_cloud": "Lưu lên IslePilot",
  "skin.cloud_presets": "Preset trên IslePilot",
  "skin.cloud_saved": "Đã lưu lên IslePilot",
  "skin.cloud_err": "Lỗi IslePilot: {err}",

  // --- trạng thái vị trí ---
  "pos.none": "Chưa có vị trí",
  "pos.hint":
    "Trong game bấm Tab, rồi bấm chuột vào “Asset Location” ở góc trên bên phải để chép tọa độ.",
  "pos.off_map": "Ngoài bản đồ",

  // --- hướng ---
  "dir.N": "Bắc",
  "dir.NE": "Đông Bắc",
  "dir.E": "Đông",
  "dir.SE": "Đông Nam",
  "dir.S": "Nam",
  "dir.SW": "Tây Nam",
  "dir.W": "Tây",
  "dir.NW": "Tây Bắc",
  "heading.unknown": "Chưa rõ hướng",
  "heading.hint": "Chép tọa độ lần nữa sau khi di chuyển để biết hướng đi.",

  // --- layer POI ---
  "layer.freshwater": "Nước ngọt",
  "layer.water": "Nguồn nước",
  "layer.sanctuary": "Khu bảo tồn",
  "layer.migration": "Vùng di cư",
  "layer.saltlick": "Mỏ muối",
  "layer.mudwallow": "Vũng bùn",
  "layer.food": "Khu vực thức ăn",
  "layer.patrol": "Vùng tuần tra AI",
  "layer.region": "Tên vùng",
  "layer.landmark": "Địa điểm",
  "layer.animal": "Động vật",
  "layer.explored": "Vùng đã đi qua",
  "explored.reset": "Xóa vùng đã đi",
  "explored.reset_confirm": "Xóa toàn bộ lịch sử vùng đã đi qua?",
  "route.tool": "Vẽ tuyến",
  "route.total": "Tổng: {dist}",
  "route.save": "Lưu tuyến",
  "route.name_prompt": "Tên tuyến:",
  "route.clear": "Xóa",
  "route.list": "Tuyến đã lưu",
  "route.empty": "Chưa lưu tuyến nào.",
  "layers.title": "Lớp bản đồ",
  "layers.zone_labels": "Tên vùng khoanh",
  "layers.collapse": "Thu gọn",
  "layers.expand": "Mở rộng",

  // --- waypoint ---
  "wp.title": "Điểm đánh dấu",
  "wp.new": "Điểm đánh dấu mới",
  "wp.add": "Thêm điểm",
  "wp.remove": "Xóa điểm",
  "wp.rename": "Đổi tên",
  "wp.name_prompt": "Tên điểm đánh dấu:",
  "wp.empty": "Chưa có điểm nào. Bấm chuột phải lên bản đồ để thêm.",
  "wp.distance": "{dir} · {dist}",
  "wp.here": "Vị trí của tôi",
  "wp.confirm_delete": "Xóa điểm “{name}”?",
  "wp.color": "Đổi màu",
  "wp.group": "Nhóm",
  "wp.groups": "Nhóm",
  "wp.group_edit": "Đổi nhóm (trống = bỏ nhóm)",
  "wp.ungrouped": "Chưa phân nhóm",
  "wp.export": "Xuất",
  "wp.import": "Nhập",
  "wp.share": "Chia sẻ cho nhóm",
  "wp.import_done": "Đã nhập {added} điểm, bỏ qua {skipped} điểm trùng.",
  "wp.export_done": "Đã xuất {n} điểm.",

  // --- tìm kiếm & điều hướng ---
  "search.placeholder": "Tìm địa danh hoặc dán tọa độ…",
  "search.goto_coords": "Tới tọa độ đã nhập",
  "search.no_results": "Không thấy địa danh nào",
  "search.coords_failed": "Không đọc được tọa độ — kiểm tra lại chuỗi đã dán",
  "map.recenter": "Về vị trí của tôi",

  // --- vết đường ---
  "trail.title": "Đường đã đi",
  "trail.previous": "Đường đi phiên trước",
  "trail.clear": "Xóa đường đi",
  "trail.clear_hint":
    "Xóa vết trên cả hai bản đồ cho đỡ rối; file lịch sử trên máy vẫn giữ nguyên.",
  "trail.history": "Phiên trước",
  "trail.history_empty": "Chưa có phiên nào được lưu.",
  "trail.points": "{n} điểm",

  // --- tua lại phiên (A6) ---
  "replay.start": "Tua lại phiên này",
  "replay.play": "Phát",
  "replay.pause": "Tạm dừng",
  "replay.restart": "Về đầu",
  "replay.close": "Thoát chế độ tua",
  "replay.speed": "Tốc độ {n}×",
  "replay.export": "Xuất đường di cư (.geojson)",
  "replay.exported": "Đã xuất {n} điểm ra file GeoJSON.",
  "replay.export_failed": "Không xuất được: {err}",
  "replay.empty": "Phiên này không đủ điểm để tua lại.",
  "replay.caption": "Phiên lúc {when}",

  // --- nhiệm vụ Prime trên bản đồ ---
  "quest.section": "Nhiệm vụ Prime",
  "quest.hint": "Bấm nhiệm vụ có địa điểm để hiện lớp POI tương ứng lên bản đồ.",
  "quest.nearest": "Gần nhất: {name}",
  "quest.unpin": "Bỏ ghim",

  // --- đo & tọa độ ---
  "measure.section": "Đo & tọa độ",
  "ruler.tool": "Thước đo",
  "ruler.hint": "Bấm các điểm trên bản đồ. Chuột phải hoặc Esc để xóa.",
  "ruler.clear": "Xóa",
  "coord.show": "Hiện tọa độ dưới con trỏ",

  // --- nút chung ---
  "btn.close": "Đóng",
  "btn.ok": "Đồng ý",
  "btn.cancel": "Hủy",
  "btn.save": "Lưu",

  // --- cảnh báo ---
  "warn.exclusive_fullscreen":
    "Game đang chạy chế độ Toàn màn hình. Bản đồ nhỏ sẽ không hiện đè lên được. " +
    "Hãy vào Cài đặt › Hình ảnh trong game và đổi sang “Cửa sổ” hoặc “Toàn màn hình không viền”.",
  "warn.hotkey_failed":
    "Không đăng ký được các phím tắt sau, vì ứng dụng khác đang giữ chúng:",
  "warn.no_data":
    "Chưa có dữ liệu bản đồ trên máy. Cần tải về một lần trước khi dùng.",

  // --- phím tắt (tên hành động) ---
  "hotkey.toggle_minimap": "Hiện/ẩn bản đồ nhỏ",
  "hotkey.toggle_fullmap": "Mở/đóng bản đồ lớn",
  "hotkey.toggle_click_through": "Bật/tắt chế độ bấm được",
  "hotkey.mark_here": "Đánh dấu vị trí hiện tại",
  "hotkey.opacity_up": "Bản đồ nhỏ đậm hơn",
  "hotkey.opacity_down": "Bản đồ nhỏ nhạt hơn",
  "hotkey.zoom_in": "Thu gần vùng nhìn",
  "hotkey.zoom_out": "Nhìn xa hơn",
  "hotkey.toggle_quests": "Hiện/ẩn bảng nhiệm vụ Prime",
  "hotkey.team_ping": "Ping “chạm địch” cho cả nhóm",
  "hotkey.cycle_preset": "Đổi sang preset overlay kế tiếp",
  "hotkey.map_snapshot": "Chép ảnh bản đồ nhỏ vào clipboard",
  "hotkey.toggle_bigmap": "Mở/đóng bản đồ to trong game",
  "hotkey.toggle_companion": "Mở/đóng bảng phụ màn hình 2",
  "hotkey.reload_ui": "Tải lại giao diện (khi bị đơ)",
  "bigmap.title": "Bản đồ toàn cảnh",
  "bigmap.hint": "Ctrl+Alt+G hoặc ✕ để đóng · vẫn di chuyển được trong game",
  "bigmap.pin": "Ghim",
  "bigmap.pinned": "Đã ghim",
  "bigmap.unpin": "Bỏ ghim (trả điều khiển cho game)",
  "settings.bigmap": "Bản đồ to trong game",
  "settings.bigmap_opacity": "Độ đục nền",
  "settings.bigmap_hint": "Bấm Ctrl+Alt+G khi đang chơi để mở/đóng bản đồ toàn cảnh. Tự ẩn khi Alt-Tab khỏi game.",

  // --- bảng phụ màn hình 2 (A7) ---
  "companion.title": "Bảng phụ",
  "companion.hint": "Màn hình 2 · Esc hoặc ✕ để ẩn",
  "companion.open": "Mở bảng phụ (màn hình 2)",
  "companion.open_hint": "Một cửa sổ dashboard riêng (bản đồ lớn + chỉ số + đồng đội + nhiệm vụ) cho màn hình thứ hai. Phím tắt Ctrl+Alt+D.",
  "companion.no_team": "Chưa vào nhóm sinh tồn.",
  "companion.no_quests": "Chưa có nhiệm vụ Prime.",
  "companion.hide_map": "Ẩn bản đồ (chỉ hiện chỉ số)",
  "companion.show_map": "Hiện lại bản đồ",

  // --- cài đặt ---
  "settings.group_interface": "Giao diện",
  "settings.group_hud": "Bản đồ nhỏ (HUD)",
  "settings.group_map": "Bản đồ & dữ liệu",
  "settings.group_autopos": "Vị trí tự động",
  "settings.group_hotkeys": "Phím tắt",
  "settings.group_advanced": "Nâng cao",
  "settings.setup_title": "Hướng dẫn ban đầu",
  "settings.setup_rerun": "Chạy lại hướng dẫn",
  "settings.setup_hint": "Mở lại 5 bước cài đặt lần đầu (dữ liệu bản đồ, IslePilot, phím tắt).",
  "settings.language": "Ngôn ngữ · Language",
  "settings.minimap": "Bản đồ nhỏ",
  "settings.visible": "Hiện bản đồ nhỏ",
  "settings.require_game": "Chỉ hiện khi đang trong game (Alt-Tab ra là tự ẩn)",
  "settings.click_through": "Chuột bấm xuyên qua (không cản trở lúc chơi)",
  "settings.show_trail": "Hiện đường đi trên bản đồ nhỏ",
  "settings.show_waypoints": "Hiện waypoint trên bản đồ nhỏ",
  "settings.rotate_minimap": "Xoay bản đồ nhỏ theo hướng đi (hướng đi luôn ở trên)",
  "settings.show_team_panel": "Hiện chỉ số đồng đội dưới bản đồ nhỏ (khi trong nhóm)",
  "settings.last_seen_beacon": "Tự cắm điểm “Vị trí cuối” khi mất tín hiệu vị trí",
  "settings.smooth_motion": "Chấm vị trí trượt mượt giữa các lần cập nhật (thay vì nhảy)",
  "settings.solo_mode": "Chế độ solo — ẩn đồng đội, chấm nhóm và ping khỏi HUD",
  "settings.auto_preset": "Tự áp preset trùng tên loài khi đổi khủng long",
  "settings.panel_order": "Thứ tự các bảng dưới đĩa",
  "settings.panel_dino": "Bảng chỉ số khủng long",
  "settings.panel_quests": "Bảng nhiệm vụ Prime",
  "settings.panel_team": "Bảng đồng đội",
  "settings.minimap_diag": "Hiện chỉ số chẩn đoán trên đĩa (thời gian vẽ · số lần vẽ/giây)",
  "settings.sound_cues": "Âm báo trong game",
  "settings.sound_cues_hint": "Tiếng bíp ngắn khi: đồng đội ping “chạm địch” · đồng đội tụt dưới 25% máu · mất tín hiệu vị trí. Mặc định tắt.",
  "settings.mouse_gestures": "Cử chỉ chuột: Alt+cuộn để zoom, Alt+chuột giữa để ẩn/hiện bản đồ nhỏ",
  "settings.mouse_gestures_hint":
    "Dùng Raw Input (thứ game cũng dùng để đọc chuột) — KHÔNG phải hook, không chèn gì. " +
    "Chỉ nhận khi đang giữ Alt; cuộn/bấm bình thường không bị ảnh hưởng. Mặc định tắt.",
  "settings.color_profile": "Bảng màu (hỗ trợ thị lực)",
  "color.default": "Mặc định",
  "color.deuteranopia": "Hỗ trợ mù màu đỏ–lục",
  "settings.skin": "Giao diện màu",
  "settings.skin_hint": "Đổi tông nền của toàn ứng dụng và bản đồ nhỏ. Amber vẫn là màu nhấn.",
  "skin.obsidian": "Hắc thạch",
  "skin.bonefield": "Đồng xương",
  "skin.biolum": "Phát quang",
  "settings.data_age": "Đã tải dữ liệu bản đồ {n} ngày trước — bấm “Tải lại” nếu game hoặc dữ liệu cộng đồng vừa cập nhật.",
  "settings.corner": "Góc neo theo cửa sổ game",
  "corner.top-left": "Trên trái",
  "corner.top-right": "Trên phải",
  "corner.bottom-left": "Dưới trái",
  "corner.bottom-right": "Dưới phải",
  "settings.size": "Kích thước",
  "settings.margin": "Cách mép",
  "settings.opacity": "Độ đậm",
  "settings.radius": "Bán kính vùng nhìn",
  "settings.presets": "Bộ thiết lập nhanh (preset)",
  "settings.presets_hint":
    "Lưu lại cách bố trí overlay hiện tại (lớp bản đồ, cỡ/độ mờ/bán kính bản đồ nhỏ, góc, các bảng) " +
    "thành một preset đặt tên — bấm tên để áp dụng lại.",
  "settings.preset_name_ph": "Tên preset (vd: đi đàn)",
  "settings.preset_save": "Lưu",
  "settings.hud_scale": "Cỡ toàn bộ overlay",
  "settings.hud_scale_hint": "Phóng to/thu nhỏ cả bản đồ nhỏ lẫn các bảng chỉ số theo cùng tỉ lệ.",
  "settings.map_sharpness": "Độ nét bản đồ",
  "settings.map_sharpness_hint":
    "Độ phân giải ảnh nền dùng cho bản đồ nhỏ trong game. Cao hơn thì nét hơn nhưng tốn RAM hơn.",

  // --- G1: vị trí tự động qua bắt gói mạng ---
  "settings.localpos": "Vị trí tự động (thử nghiệm)",
  "settings.localpos_enable": "Tự đọc vị trí + hướng từ gói mạng của game",
  "settings.localpos_disclaimer":
    "Khi bật, ứng dụng bắt gói UDP mà máy bạn gửi đi (qua Npcap) để lấy toạ độ + hướng — " +
    "không phải copy “Asset Location” thủ công nữa. Ứng dụng KHÔNG đọc bộ nhớ game, KHÔNG " +
    "chèn mã, KHÔNG đụng vào tiến trình game; chỉ hỏi hệ điều hành xem game đang dùng cổng " +
    "UDP nào rồi lọc đúng luồng đó. EAC không cấm việc bắt gói thụ động này, nhưng rủi ro " +
    "cuối cùng là của bạn. Mặc định tắt.",
  "settings.localpos_npcap_missing":
    "Chưa có Npcap — cần cài để tính năng này chạy. Cài xong mở lại ứng dụng.",
  "settings.localpos_npcap_ok": "Npcap đã sẵn sàng.",
  "settings.localpos_get_npcap": "Tải Npcap (npcap.com)",

  "settings.hotkeys": "Phím tắt",
  "settings.hotkeys_hint":
    "Bấm vào ô phím rồi nhấn tổ hợp mới. Cần ít nhất một phím bổ trợ (Ctrl/Alt/Shift/Win).",
  "settings.press_keys": "Nhấn tổ hợp phím… (Esc để hủy)",
  "settings.hotkey_in_use": "Tổ hợp này đang bị ứng dụng khác giữ",
  "settings.hotkey_duplicate": "Trùng với một phím tắt khác trong ứng dụng",
  "settings.hotkey_invalid": "Tổ hợp không hợp lệ — cần ít nhất một phím bổ trợ",
  "settings.number_format": "Định dạng số tọa độ",
  "format.auto": "Tự động nhận biết",
  "format.us": "Kiểu Mỹ — 1,234.5",
  "format.eu": "Kiểu Châu Âu — 1.234,5",
  "settings.data": "Dữ liệu",
  "settings.open_trails": "Mở thư mục đường đi",
  "settings.redownload": "Tải lại dữ liệu bản đồ",
  "settings.basemap": "Nền bản đồ",
  "basemap.vulnona": "Vulnona (mặc định)",
  "basemap.islemaps_light": "IsleMaps — sáng",
  "basemap.islemaps_dark": "IsleMaps — tối",
  "basemap.hint":
    "Áp dụng cho cả bản đồ lớn lẫn bản đồ nhỏ. Lần đầu chọn sẽ tải ảnh nền " +
    "(~5–7 MB) về máy — sau đó dùng offline. Bản IsleMaps vẽ theo phiên bản game " +
    "mới hơn, thấy cả quần đảo đông nam (Hell's Mouth).",
  "basemap.downloading": "Đang tải ảnh nền…",
  "basemap.failed":
    "Tải ảnh nền thất bại — kiểm tra mạng rồi thử lại. Vẫn dùng nền hiện tại.",

  // --- chạy lần đầu ---
  "firstrun.title": "Tải dữ liệu bản đồ",
  "firstrun.explain":
    "Ứng dụng cần tải ảnh bản đồ (~3 MB) và dữ liệu điểm về máy bạn một lần. " +
    "Dữ liệu được tải trực tiếp từ nguồn thay vì đóng gói sẵn — đây là bản sao cá nhân " +
    "trên máy bạn, không phải bản phát hành lại.",
  "firstrun.start": "Bắt đầu tải",
  "firstrun.downloading": "Đang tải…",
  "firstrun.done": "Xong! Đang mở bản đồ…",
  "firstrun.partial":
    "Đã tải được ảnh bản đồ nhưng dữ liệu điểm bị lỗi. Bạn vẫn dùng được bản đồ; " +
    "thử tải lại dữ liệu trong phần Cài đặt sau.",
  "firstrun.failed": "Tải thất bại. Kiểm tra kết nối mạng rồi thử lại.",
  "firstrun.retry": "Thử lại",
  "firstrun.continue": "Tiếp tục với bản đồ",

  // --- hướng dẫn ban đầu (A1) ---
  "welcome.back": "Quay lại",
  "welcome.next": "Tiếp tục",
  "welcome.skip": "Bỏ qua bước này",
  "welcome.start": "Bắt đầu dùng",
  "welcome.s1_title": "Chào mừng đến với Bản đồ The Isle",
  "welcome.s1_body":
    "Bản đồ nhỏ hướng-Bắc ngay trong game, bản đồ lớn + điểm mốc + đường đi trong ứng dụng, " +
    "và chỉ số khủng long trực tiếp nếu bạn kết nối IslePilot.",
  "welcome.s1_anticheat":
    "Overlay chỉ đọc: nó đọc tọa độ bạn tự chép trong game (hoặc gói tin mạng nếu bạn bật), " +
    "không bao giờ đọc bộ nhớ hay can thiệp vào tiến trình game.",
  "welcome.s2_title": "Tải dữ liệu bản đồ",
  "welcome.s2_body":
    "Ảnh bản đồ và điểm mốc được tải riêng về máy (vì lý do bản quyền), không đóng gói sẵn. " +
    "Chỉ cần làm một lần.",
  "welcome.s2_download": "Tải xuống",
  "welcome.s2_have": "Máy đã có đủ dữ liệu bản đồ.",
  "welcome.s2_downloading": "Đang tải…",
  "welcome.s2_partial":
    "Tải được ảnh nền nhưng dữ liệu điểm bị lỗi — vẫn dùng được, thử lại trong Cài đặt sau.",
  "welcome.s2_failed": "Tải lỗi. Kiểm tra mạng rồi thử lại.",
  "welcome.s2_retry": "Thử lại",
  "welcome.s3_title": "Chỉ số khủng long trực tiếp",
  "welcome.s3_opt": "Tùy chọn",
  "welcome.s3_body":
    "Kết nối IslePilot để thấy máu / đói / khát / tăng trưởng / Prime ngay trên HUD và tab " +
    "Khủng long. Đăng nhập ở tab Khủng long — có thể làm sau.",
  "welcome.s3_linked": "Đã kết nối IslePilot.",
  "welcome.s3_notlinked": "Chưa kết nối — bỏ qua cũng được, kết nối sau ở tab Khủng long.",
  "welcome.s4_title": "Phím tắt",
  "welcome.s4_body": "Các phím tắt chính (đổi được trong Cài đặt → Phím tắt):",
  "welcome.s5_title": "Sẵn sàng",
  "welcome.s5_body":
    "Mở game rồi bật bản đồ nhỏ bằng phím tắt, hoặc xem bản đồ lớn ngay trong ứng dụng.",

  // --- khủng long của bạn (IslePilot) ---
  "dino.title": "Khủng long của bạn",
  "dino.explain":
    "Đọc thông tin khủng long của chính bạn từ trang quản lý IslePilot của server " +
    "(growth, máu, đói, khát, Prime progress). Chỉ là kết nối HTTPS tới website của server " +
    "— không đụng gì tới game, an toàn với anti-cheat.",
  "dino.server": "Server",
  "dino.login": "Đăng nhập Steam",
  "dino.login_wait": "Đang chờ bạn đăng nhập trong cửa sổ vừa mở…",
  "dino.login_failed": "Đăng nhập không thành công. Thử lại.",
  "dino.logged_in": "Đã đăng nhập",
  "dino.logout": "Đăng xuất",
  "dino.auth_expired": "Phiên đăng nhập đã hết hạn — hãy đăng nhập lại.",
  "dino.supported_servers":
    "Hỗ trợ mọi server chạy IslePilot — dạng xxx.islepilot.eu hoặc islepilot.eu/p/tên-server. " +
    "Xem danh sách ví dụ và hướng dẫn từng bước trong tab Hướng dẫn.",
  "dino.manual_cookie": "Dán cookie đăng nhập",
  "dino.manual_cookie_hint":
    "Mở trang server trong trình duyệt và đăng nhập Steam. Bấm F12 → tab Application " +
    "(Chrome) hoặc Storage (Firefox) → Cookies → chọn domain server → tìm cookie tên " +
    "islepilot_player rồi copy phần Value dán vào đây.",
  "dino.cancel_login": "Hủy đăng nhập",
  "dino.manual_cookie_save": "Kiểm tra & lưu cookie",
  "dino.manual_cookie_checking": "Đang kiểm tra cookie…",
  "dino.manual_cookie_bad":
    "Cookie không hợp lệ hoặc phiên chưa đăng nhập — kiểm tra lại chuỗi đã dán.",
  "dino.server_settings": "Cài đặt server",
  "dino.token_login": "Đăng nhập Steam (1 lần, dùng cho mọi server)",
  "dino.token_login_hint":
    "Đăng nhập qua islepilot.eu một lần duy nhất — token dùng chung cho MỌI server IslePilot " +
    "(mixi, hoho, sdvn…), không cần nhập server hay copy cookie nữa. Đổi server trong game " +
    "là dữ liệu tự đổi theo.",
  "dino.token_paste": "Hoặc dán token thủ công",
  "dino.token_paste_hint":
    "Nếu cửa sổ đăng nhập không tự bắt được token: dán token overlay (hoặc nguyên link " +
    "theisle-overlay://… / isle-overlay://…) vào đây.",
  "dino.token_save": "Kiểm tra & lưu token",
  "dino.token_checking": "Đang kiểm tra token…",
  "dino.token_bad": "Token không hợp lệ — kiểm tra lại chuỗi đã dán.",
  "dino.legacy_section": "Cách cũ: nhập server + cookie (dự phòng)",
  "dino.legacy_hint":
    "Chỉ cần khi cách đăng nhập mới không hoạt động với server của bạn. Cookie lưu riêng " +
    "cho từng server.",
  "dino.live_map_yes": "Server có live map — vị trí sẽ tự cập nhật",
  "dino.live_map_checking": "Đang kiểm tra live map của server…",
  "dino.enabled": "Theo dõi thông tin khủng long",
  "dino.interval": "Tần suất cập nhật",
  "dino.hardswap_timer": "Đồng hồ hard-swap:",
  "dino.hardswap_start": "Bắt đầu 30:00",
  "dino.realtime": "Cập nhật thời gian thực (WebSocket)",
  "dino.realtime_hint":
    "Dùng kết nối wss://islepilot.eu để cập nhật vị trí + chỉ số dưới 1 giây. " +
    "Vẫn giữ vòng REST làm nền khi socket rớt.",
  "dino.overlay_panel": "Hiện thanh chỉ số dưới bản đồ nhỏ",
  "dino.quests_panel": "Hiện nhiệm vụ Prime dưới bản đồ nhỏ",
  "dino.show_party": "Hiện đồng đội trên bản đồ",
  "dino.party_via_livemap": "Đang hiện đồng đội — lấy trực tiếp từ live map của server này. Không cần thiết lập gì thêm.",
  "dino.party_needs_relay":
    "Server này không có live map. Muốn hiện đồng đội thì cần một nhóm riêng qua relay — mở phần “Nhóm sinh tồn” bên dưới.",
  "party.rules_ack":
    "Bật để hiện vị trí đồng đội lên bản đồ (lấy từ live map của server). Một vài server có luật riêng " +
    "về công cụ bên thứ ba — nên hỏi admin trước. Bật?",
  "dino.use_map_position":
    "Lấy vị trí tự động từ live map của server (thay cho copy tọa độ thủ công)",
  "dino.rules_note":
    "⚠ Nên hỏi admin server trước khi dùng thường xuyên — một số server có luật riêng về " +
    "công cụ bên thứ ba. Dữ liệu hiển thị chỉ là của chính bạn, do panel của server cung cấp.",
  "dino.growth": "Trưởng thành",
  "dino.health": "Máu",
  "dino.hunger": "Đói",
  "dino.thirst": "Khát",
  "dino.stamina": "Thể lực",
  "dino.nutrition": "Dinh dưỡng",
  "dino.nutrition_carb": "Carb",
  "dino.nutrition_protein": "Đạm",
  "dino.nutrition_lipid": "Béo",
  "nutriadvice.title": "Nên ăn tiếp",
  "nutriadvice.balanced": "Cả ba chất đều ổn — cả ba đang cộng tốc độ trưởng thành (tối đa +300%).",
  "nutriadvice.herb": "Ăn thêm loại cây khác — mỗi loài có 3 cây ưu tiên, mỗi cây nạp một chất. Đừng cắm mãi một bụi.",
  "nutriadvice.herb_plants": "Thiếu {nutrient} — món ưu tiên của loài: {foods}. Ăn luân phiên, chọn món chưa động tới gần đây (mỗi món nạp một chất).",
  "nutriadvice.carn_carb": "Carb thấp — ăn PHỔI con mồi (2 lá mỗi xác; nội tạng nạp carb).",
  "nutriadvice.carn_protein": "Đạm thấp — ăn TIM con mồi (nội tạng nạp đạm).",
  "nutriadvice.carn_lipid": "Chất béo thấp — ăn RUỘT con mồi (nội tạng nạp chất béo).",
  "nutriadvice.omni_carb": "Carb thấp — ăn PHỔI con mồi, hoặc gặm cây đa dạng.",
  "nutriadvice.omni_protein": "Đạm thấp — ăn TIM con mồi, hoặc cây có hạt.",
  "nutriadvice.omni_lipid": "Chất béo thấp — ăn RUỘT con mồi, hoặc quả nhiều dầu.",
  "dino.server_playing": "Server",
  "dino.sex_female": "Cái",
  "dino.sex_male": "Đực",
  "dino.prime": "Prime progress",
  "dino.online": "Online",
  "dino.offline": "Offline",
  "dino.updated": "Cập nhật lúc {time}",
  "dino.no_data": "Chưa có dữ liệu — bật theo dõi và chờ lần cập nhật đầu.",
  "dino.fetch_error": "Lỗi kết nối tới panel:",
  "dino.layout_changed":
    "IslePilot vừa cập nhật phiên bản mới — nếu số liệu trông sai, giao diện của họ có thể " +
    "đã đổi và app cần cập nhật theo.",
  "dino.map_disabled": "Server này tắt live map.",
  "dino.crashed":
    "Phần Khủng long gặp lỗi và đã được cách ly — bản đồ và các tính năng khác không bị ảnh hưởng.",

  // --- lịch sử chỉ số ---
  "dino.history_track": "Lưu lịch sử chỉ số (biểu đồ growth, tốc độ đói/khát)",
  "dino.death_marker": "Tự cắm điểm chết khi khủng long chết",
  "dino.death_marker_hint": "Khi IslePilot báo khủng long chết, cắm một waypoint 💀 ở vị trí cuối (và chia sẻ cho đội nếu đang trong đội) để quay lại lấy xác. Xoá được như waypoint thường.",
  "dino.history_title": "Lịch sử chỉ số",
  "dino.history_empty":
    "Chưa đủ dữ liệu. Bật “Theo dõi thông tin khủng long” và chờ vài phút.",
  "dino.history_clear": "Xóa lịch sử",
  "dino.history_clear_confirm": "Xóa toàn bộ lịch sử chỉ số đã lưu trên máy?",
  "dino.history_range_6h": "6 giờ",
  "dino.history_range_24h": "24 giờ",
  "dino.history_range_all": "Tất cả",
  "dino.growth_rate": "Tốc độ lớn",
  "dino.eta_adult": "Tới trưởng thành",
  "dino.drain_hunger": "Tụt đói",
  "dino.drain_thirst": "Tụt khát",
  "dino.rate_per_h": "{v}%/giờ",
  "dino.eta_hours": "≈ {h} giờ",
  "dino.eta_soon": "sắp xong",
  "dino.empty_in": "cạn sau ≈ {h} giờ",
  "dino.chart_growth": "Growth",
  "dino.chart_hunger": "Đói",
  "dino.chart_thirst": "Khát",

  // --- cảnh báo (thông báo desktop) ---
  "alert.section": "Cảnh báo",
  "alert.enabled": "Bật thông báo cảnh báo",
  "alert.hint":
    "Hiện thông báo Windows khi chỉ số xuống ngưỡng — dùng lúc đang trong game. " +
    "Chỉ báo khi khủng long đang online, mỗi loại có thời gian nghỉ để không spam.",
  "alert.thirst_label": "Ngưỡng khát (%)",
  "alert.hunger_label": "Ngưỡng đói (%)",
  "alert.hp_label": "Ngưỡng máu (%)",
  "alert.threshold_off": "0 = tắt",
  "alert.prime_ready": "Khi Prime đủ điều kiện",
  "alert.growth_milestones": "Khi growth đạt mốc (25 / 50 / 75 / 100%)",
  "alert.test": "Gửi thử",

  // --- garage (gacha) — chỉ có ở chế độ đăng nhập token ---
  "garage.title": "Garage (Gacha)",
  "garage.hint":
    "Danh sách khủng long đã gửi vào garage của server. Park/Restore mất tới ~60 giây " +
    "vì server xử lý bất đồng bộ.",
  "garage.refresh": "Làm mới",
  "garage.park": "Park dino hiện tại",
  "garage.slay": "💀 Giết khủng long",
  "garage.slay_confirm": "Giết khủng long đang chơi? Con này sẽ chết ngay trong game và KHÔNG lấy lại được.",
  "garage.restore": "Restore",
  "garage.sell": "Bán",
  "garage.rename": "Đổi tên",
  "garage.rename_prompt": "Tên mới cho dino:",
  "garage.confirm_restore": "Restore dino “{name}”? Dino đang chơi có thể bị thay thế.",
  "garage.confirm_sell": "Bán dino “{name}”? Không thể hoàn tác.",
  "garage.empty": "Garage trống.",
  "garage.busy": "Đang gửi lệnh tới server… (tối đa ~60 giây)",
  "garage.error": "Lệnh thất bại:",
  "garage.sold": "Đã bán — nhận {amount} {currency}",
  "garage.done": "Xong!",
  "garage.need_token":
    "Garage cần đăng nhập Steam qua IslePilot (1 lần, dùng cho mọi server) — vào tab " +
    "Khủng long để đăng nhập. Cách cũ nhập server + cookie không dùng được Garage.",
  "garage.unsupported":
    "Không lấy được Garage — server bạn đang chơi có thể không hỗ trợ tính năng này.",
  "garage.updated":
    "Cập nhật lúc {time} · tự làm mới sau mỗi 10 phút — bấm Làm mới nếu cần ngay.",

  // --- xem 3D ---
  "dino3d.loading": "Đang tải model 3D…",
  "dino3d.no_model": "Loài này chưa có model 3D.",
  "dino3d.error": "Không tải được model 3D — kiểm tra mạng rồi thử lại.",

  // --- POI IslePilot trên bản đồ ---
  "layer.islepilot": "POI server (IslePilot)",
  "poi.islepilot_discord":
    "Cần liên kết Discord với IslePilot để mở khóa bản đồ server.",
  "poi.islepilot_disabled": "Server này tắt live map.",
  "poi.islepilot_login": "Đăng nhập token (tab Khủng long) để hiện POI của server.",
  "poi.islepilot_empty": "Server chưa có POI nào.",
  "map.crashed":
    "Bản đồ gặp lỗi hiển thị. Bấm Thử lại, hoặc nhấn F5 để tải lại toàn bộ ứng dụng.",
  "btn.retry": "Thử lại",

  // --- cập nhật ---

  // --- footer ---
  "footer.based_on": "TheIsle Overlay · phát triển bởi BumBum",
  "footer.source_link": "GitHub",
  "footer.reload_hint": "Nếu ứng dụng bị lỗi, nhấn F5 hoặc Ctrl+Alt+R để tải lại",


  // --- cập nhật ứng dụng ---
  "update.title": "Cập nhật ứng dụng",
  "update.current": "Phiên bản hiện tại: {version}",
  "update.check": "Kiểm tra cập nhật",
  "update.checking": "Đang kiểm tra…",
  "update.available": "Có bản mới {version}",
  "update.uptodate": "Bạn đang dùng bản mới nhất.",
  "update.notes": "Có gì mới",
  "update.install": "Tải & cài đặt {version}",
  "update.downloading": "Đang tải… {pct}%",
  "update.ready": "Đã cài xong — đang khởi động lại…",
  "update.error": "Không cập nhật được: {err}",
  "update.later": "Để sau",
  "update.auto_check": "Tự kiểm tra cập nhật khi khởi động",
  "update.auto_check_hint":
    "Chỉ tải một file thông tin phiên bản (latest.json) từ trang phát hành. " +
    "Không tự tải hay tự cài — luôn hỏi trước khi cập nhật.",

  // --- số liệu sử dụng & phản hồi ---
  "telemetry.title": "Số liệu sử dụng & phản hồi",
  "telemetry.enabled": "Gửi số liệu sử dụng ẩn danh",
  "telemetry.hint":
    "Chỉ gồm: một mã cài đặt ngẫu nhiên, phiên bản app, số hiệu bản Windows, " +
    "ngôn ngữ giao diện và số lần dùng từng tính năng. Không gửi địa chỉ IP, " +
    "không gửi vị trí trong game, không gửi tên tài khoản Windows.",
  "feedback.title": "Gửi phản hồi",
  "feedback.cat_bug": "Lỗi",
  "feedback.cat_idea": "Góp ý",
  "feedback.cat_other": "Khác",
  "feedback.body": "Mô tả (tối đa 2000 ký tự)",
  "feedback.contact": "Cách liên hệ lại (không bắt buộc)",
  "feedback.send": "Gửi",
  "feedback.sending": "Đang gửi…",
  "feedback.sent": "Đã gửi. Cảm ơn bạn!",
  "feedback.failed": "Không gửi được. Kiểm tra mạng rồi thử lại.",

  // --- G6: nhóm sinh tồn qua relay ---
  "team.title": "Nhóm sinh tồn",
  "team.intro":
    "Nhập tên → Tạo nhóm → gửi mã 6 ký tự cho bạn bè. Đồng đội hiện trên bản đồ ở MỌI server, " +
    "kể cả server không có live map. Bạn không cần cài đặt gì thêm.",
  "team.name_ph": "Tên hiển thị",
  "team.or": "hoặc",
  "team.code_ph": "MÃ",
  "team.create": "Tạo nhóm",
  "team.join": "Vào nhóm",
  "team.leave": "Rời nhóm",
  "team.code": "Mã nhóm",
  "team.copy_code": "Bấm để copy mã",
  "team.connected": "Đã kết nối",
  "team.connecting": "Đang kết nối…",
  "team.members": "{n} người",
  "team.advanced": "Nâng cao (đổi relay riêng)",
  "team.relay_base": "Địa chỉ relay",
  "team.relay_default_ph": "Để trống = dùng relay mặc định",
  "team.you": "bạn",
  "team.offline": "mất tín hiệu",
  "team.mark_toast": "{from} vừa đánh dấu điểm chạm địch trên bản đồ",
  "team.wp_toast": "{from} đã chia sẻ điểm “{name}” — đã thêm vào danh sách của bạn",

  // --- ghi công ---
  "credits.title": "Nguồn dữ liệu",
  "credits.body":
    "Ảnh nền: VulnonaMAP (Coco.N) — ghép từ ảnh chụp trong game. " +
    "Nền IsleMaps & điểm động vật: IsleMaps.com (Pont & Emeara). " +
    "Hình ảnh thuộc bản quyền Afterthought LLC (The Isle). " +
    "Dữ liệu điểm: VulnonaMAP, myislemap.com, hướng dẫn Steam của wiredredman. " +
    "Ứng dụng này không liên kết với Afterthought LLC.",
} as const;

export type MsgKey = keyof typeof vi;

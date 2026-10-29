# PTIT × Rikkei Cup 2026

Website tiếng Việt cho giải bóng đá nam 7 người PTIT × Rikkei 2026.

## Chức năng

- Xem cặp đấu vòng bảng và vòng loại trực tiếp; lọc theo bảng.
- Xem 12 đội, danh sách 153 cầu thủ và tìm theo tên đội/cầu thủ.
- Xem bốn bảng A–D và nhánh tứ kết, bán kết, chung kết, tranh giải ba.
- Hiển thị trạng thái đăng ký và chênh lệch số lượng kê khai trong chi tiết đội.

Ngày giờ, sân và kết quả chưa có trong tài liệu nguồn nên hiển thị chưa công bố.
Các cặp vòng bảng được lập từ ảnh phân bảng; thứ tự thi đấu chờ BTC xác nhận.

## Mở và chạy trong Visual Studio Code

1. Mở thư mục dự án bằng **File → Open Folder**.
2. Bấm **F5**, chọn **PTIT: Xem website trong Edge**. VS Code khởi động máy chủ tại <http://127.0.0.1:8765>.
3. Hoặc bấm **Ctrl+Shift+B** để chạy máy chủ, rồi mở địa chỉ trên trong trình duyệt.

Task Windows dùng Python đi kèm Codex tại `%USERPROFILE%/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`.
Nếu dùng máy khác, sửa `windows.command` trong `.vscode/tasks.json` thành đường dẫn Python 3 của máy, hoặc chạy thủ công:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Trên macOS/Linux, dùng `python3` thay `python`. Không cần cài gói phụ thuộc hay build.
Website đọc `data.json` qua HTTP, vì vậy cần chạy máy chủ thay vì mở `index.html` bằng `file://`.
Dừng máy chủ bằng **Tasks: Terminate Task** hoặc **Ctrl+C** tại terminal đang chạy.

## Cấu trúc

| Tệp | Nội dung |
| --- | --- |
| `dist/index.html` | Bố cục, nhánh đấu và nội dung tĩnh |
| `dist/style.css` | Giao diện và bố cục trên điện thoại |
| `dist/app.js` | Bộ lọc, tìm kiếm, lịch và chi tiết đội |
| `dist/data.json` | Đội và cầu thủ từ danh sách đăng ký |
| `.vscode/` | Task máy chủ và cấu hình chạy thử |
| `.openai/hosting.json` | Cấu hình website Sites hiện tại |

Để sửa tên hoặc danh sách cầu thủ, cập nhật `dist/data.json`. Cặp đấu loại trực tiếp hiện được khai báo trong `dist/app.js` và `dist/index.html`.
Nguồn là file Excel đăng ký và hai ảnh phân bảng/nhánh đấu do người dùng cung cấp.

## Git

Repository: <https://github.com/kienquyet1201/HoiThao20-11>.
Trong VS Code, dùng **Source Control** để xem thay đổi, commit và push sau khi đăng nhập tài khoản có quyền ghi repository.
Push Git lưu mã nguồn lên GitHub; việc xuất bản phiên bản mới lên Sites là một bước riêng.

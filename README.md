# PTIT × Rikkei Cup 2026

Website: <https://hoithao20-11.vercel.app/> · Quản trị: <https://hoithao20-11.vercel.app/admin>.

## Chức năng

- Xem lịch, kết quả, 12 đội, danh sách cầu thủ, 4 bảng và nhánh loại trực tiếp.
- Chủ website sửa đội/cầu thủ, lịch/sân/tỷ số, phân bảng, suất đi tiếp và thông tin giải tại `/admin`.
- Điểm được tính từ trận đã kết thúc. Nhất/nhì mỗi bảng do BTC xác nhận thủ công, không tự áp dụng điều lệ phân hạng chưa được cung cấp.
- Nhánh tứ kết, bán kết, chung kết và tranh giải ba dùng chung dữ liệu với lịch thi đấu.

Danh sách gốc được nhập từ Excel đăng ký và hai ảnh phân bảng/nhánh đấu, giữ đủ 12 đội và 153 cầu thủ. Ngày giờ, sân và kết quả ban đầu để trống.

## Bật đăng nhập quản trị

Trang dùng Auth.js với GitHub OAuth. Máy chủ chỉ chấp nhận tài khoản GitHub ID **232730198**, login **kienquyet1201**. Không có mật khẩu quản trị nằm trong JavaScript trình duyệt.

1. Tạo OAuth App tại <https://github.com/settings/applications/new>.
2. Homepage URL: `https://hoithao20-11.vercel.app`.
3. Authorization callback URL: `https://hoithao20-11.vercel.app/api/auth/callback/github`.
4. Giữ tùy chọn hết hạn token nếu GitHub cung cấp. Phiên quản trị kéo dài tối đa 30 phút; token hết hạn hoặc bị thu hồi yêu cầu đăng nhập lại.
5. Thêm hai biến **Secret** trong Vercel, cho Production/Preview: `AUTH_GITHUB_ID` (Client ID), `AUTH_GITHUB_SECRET` (Client secret). Không commit hay gửi secret vào chat.
6. Redeploy sau khi thêm/sửa biến môi trường. Đăng nhập và lưu nội dung trên domain Production nêu trên.

`AUTH_SECRET` là tùy chọn nếu muốn đặt khóa phiên riêng (ít nhất 32 ký tự ngẫu nhiên). Mặc định máy chủ dẫn xuất khóa phiên từ OAuth client secret với ngữ cảnh riêng. `SITE_ORIGIN` mặc định là domain Production; chỉ thay khi chuyển domain và đã cập nhật callback của OAuth App.

Nếu thiếu cấu hình, trang quản trị hiển thị hướng dẫn và API ghi từ chối yêu cầu. Kết nối GitHub trong Codex dùng cho tác vụ hỗ trợ; OAuth App này dành riêng cho người đăng nhập trên website.

## Lưu và xuất bản

**Lưu thay đổi** gửi dữ liệu qua API được xác thực và kiểm tra ID chủ tài khoản với GitHub. API kiểm tra nội dung, nguồn yêu cầu và phiên bản tệp trước khi ghi **duy nhất** `dist/content.json` trên nhánh `main` của `kienquyet1201/HoiThao20-11`.

Mỗi lần lưu tạo một commit GitHub, kích hoạt Vercel triển khai. Trang công khai cập nhật sau khi deployment mới hoàn tất. Không phải dữ liệu chỉ lưu trên trình duyệt. Hai bản chỉnh sửa cạnh tranh nhận lỗi 409 thay vì ghi đè âm thầm. Lịch sử GitHub có thể dùng để khôi phục phiên bản.

Ứng dụng xin phạm vi OAuth `read:user user:email public_repo`. Token chỉ nằm trong cookie phiên được mã hóa, HttpOnly; không được trả trong JSON phiên hay lưu vào localStorage. Người dùng khác và người chưa đăng nhập không được lưu.

## Chạy trong Visual Studio Code

Yêu cầu Node.js 22+ và pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Mở <http://127.0.0.1:8765>. Bấm **F5** trong VS Code để chạy máy chủ và mở Edge, hoặc **Ctrl+Shift+B** để chạy máy chủ. Task Windows dùng Node đi kèm Codex; trên máy khác sửa `windows.command` trong `.vscode/tasks.json` thành đường dẫn Node của máy.

Máy chủ local hỗ trợ cả API. Không dùng `file://` để mở HTML. Đăng nhập OAuth thực tế được kiểm tra trên domain Production; cấu hình local chưa có OAuth vẫn cho xem dữ liệu công khai và màn hình hướng dẫn quản trị.

Kiểm tra:

```sh
pnpm test
pnpm build
```

## Cấu trúc

| Đường dẫn | Vai trò |
| --- | --- |
| `dist/content.json` | Nguồn chung cho giải, đội, cầu thủ, trận và suất đi tiếp |
| `dist/model.js` | Phân giải đội/nhánh và tính điểm |
| `dist/app.js`, `dist/index.html`, `dist/style.css` | Website công khai |
| `dist/admin.html`, `dist/admin.js`, `dist/admin.css` | Giao diện quản trị |
| `api/` | Các Vercel Functions xác thực, đọc và lưu |
| `lib/` | Kiểm tra quyền, dữ liệu, HTTP và GitHub API |
| `tests/` | Kiểm tra quyền ghi, dữ liệu, phiên và xung đột |
| `vercel.json` | Functions, thư mục `dist` và đường dẫn `/admin`, `/api/auth/*` |
| `.openai/hosting.json` | Giữ danh tính bản Sites đã tạo trước đây |

`dist/data.json` giữ bản nhập cũ để tham chiếu; ứng dụng hiện đọc `content.json` thông qua API. Không sửa `data.json` để cập nhật website.

## Triển khai

Vercel kết nối repository <https://github.com/kienquyet1201/HoiThao20-11>, nhánh `main`; Root Directory là thư mục gốc repository. `vercel.json` cài phụ thuộc theo lockfile, kiểm tra nội dung trước build và xuất bản `dist` cùng các Functions trong `api/`.


# ĐẶC TẢ USE CASE - HỆ THỐNG GOODZWORK

## 1. USE CASE: ĐĂNG NHẬP HỆ THỐNG

**ID:** UC-AUTH-001  
**Tên:** Đăng nhập hệ thống  
**Actor:** Tất cả người dùng (Employee, Leader, HR Manager, Accountant, Super Admin)  
**Mô tả:** Người dùng xác thực danh tính để truy cập hệ thống

### Luồng chính:
1. Người dùng mở ứng dụng
2. Hệ thống hiển thị trang đăng nhập
3. Người dùng nhập email và mật khẩu
4. Hệ thống kiểm tra thông tin đăng nhập
5. Nếu hợp lệ, hệ thống tạo JWT Token
6. Hệ thống kiểm tra User Status
   - INIT → Redirect đến trang Profile Setup
   - PENDING → Redirect đến trang Pending
   - ACTIVE → Redirect đến Dashboard
   - SUSPENDED/INACTIVE → Hiển thị thông báo lỗi

### Luồng thay thế:
- 4a. Email không tồn tại → Thông báo "Email không tồn tại"
- 4b. Mật khẩu sai → Thông báo "Mật khẩu không chính xác"
- 4c. Tài khoản bị khóa → Thông báo "Tài khoản đang bị tạm khóa"

### Pre-condition:
- Người dùng đã có tài khoản trong hệ thống

### Post-condition:
- JWT Token được lưu trong localStorage
- Người dùng được redirect đến trang phù hợp

---

## 2. USE CASE: CHẤM CÔNG VỚI AI FACE RECOGNITION

**ID:** UC-ATT-001  
**Tên:** Check-in/Check-out với nhận diện khuôn mặt  
**Actor:** Employee, Leader  
**Mô tả:** Nhân viên chấm công bằng cách chụp ảnh khuôn mặt và xác thực vị trí GPS

### Luồng chính:
1. Người dùng truy cập trang Chấm công
2. Hệ thống lấy vị trí GPS hiện tại từ trình duyệt
3. Hệ thống gửi vị trí đến API check-location
4. API kiểm tra Geofencing (bán kính 50m từ công ty)
5. Nếu trong phạm vi → Hiển thị nút mở Camera
6. Người dùng chụp ảnh khuôn mặt
7. Hệ thống gửi ảnh đến API checkin/checkout
8. AI DeepFace so sánh với face_encodings đã đăng ký
9. Nếu khớp (confidence > 60%) → Lưu log chấm công
10. Hệ thống tính trạng thái (ON_TIME/LATE/EARLY_LEAVE)
11. Hiển thị kết quả chấm công thành công

### Luồng thay thế:
- 4a. Ngoài phạm vi Geofence → "Bạn đang ngoài phạm vi công ty"
- 8a. Chưa đăng ký khuôn mặt → "Bạn chưa đăng ký khuôn mặt"
- 8b. Không nhận diện được → "Không nhận diện được khuôn mặt"
- 9a. Đã check-in hôm nay → "Bạn đã check-in hôm nay rồi"

### Pre-condition:
- Người dùng có status ACTIVE
- Đã đăng ký khuôn mặt (face_encodings)
- Cho phép truy cập GPS và Camera

### Post-condition:
- Log chấm công được lưu vào MongoDB
- Ảnh chấm công được lưu vào uploads/

---

## 3. USE CASE: XIN NGHỈ PHÉP

**ID:** UC-LEAVE-001  
**Tên:** Tạo đơn xin nghỉ phép  
**Actor:** Employee  
**Mô tả:** Nhân viên tạo đơn xin nghỉ phép và gửi đến HR để phê duyệt

### Luồng chính:
1. Người dùng truy cập trang Leaves
2. Nhấn nút "Tạo đơn mới"
3. Điền thông tin:
   - Loại nghỉ phép (ANNUAL, SICK, PERSONAL, etc.)
   - Ngày bắt đầu, ngày kết thúc
   - Lý do
   - Nghỉ nửa ngày (tùy chọn)
4. Hệ thống kiểm tra trùng lặp đơn
5. Nếu không trùng → Lưu đơn (Status: PENDING)
6. Hệ thống gửi thông báo đến HR_MANAGER
7. Hiển thị "Đã gửi đơn thành công"

### Luồng thay thế:
- 4a. Trùng với đơn đã có → "Đã có đơn nghỉ phép trong thời gian này"
- 4b. Ngày bắt đầu > ngày kết thúc → "Ngày bắt đầu phải trước ngày kết thúc"

### Pre-condition:
- Người dùng có status ACTIVE
- Còn ngày phép (remaining_leave_days > 0)

### Post-condition:
- Đơn nghỉ phép được lưu (Status: PENDING)
- Notification được gửi đến HR

---

## 4. USE CASE: DUYỆT ĐƠN NGHỈ PHÉP

**ID:** UC-LEAVE-002  
**Tên:** Duyệt/Từ chối đơn nghỉ phép  
**Actor:** HR Manager, Super Admin  
**Mô tả:** HR xem xét và phê duyệt hoặc từ chối đơn nghỉ phép

### Luồng chính:
1. HR nhận thông báo có đơn mới
2. Truy cập trang Leaves
3. Xem danh sách đơn PENDING
4. Chọn đơn để xem chi tiết
5. Chọn "Duyệt" hoặc "Từ chối"
6. Nếu từ chối → Nhập lý do từ chối
7. Hệ thống cập nhật Status (APPROVED/REJECTED)
8. Gửi thông báo kết quả đến nhân viên

### Pre-condition:
- HR có role HR_MANAGER hoặc SUPER_ADMIN
- Đơn có status PENDING

### Post-condition:
- Đơn được cập nhật status
- Nếu APPROVED → Trừ ngày phép của nhân viên
- Notification được gửi đến nhân viên

---

## 5. USE CASE: TÍNH LƯƠNG

**ID:** UC-PAY-001  
**Tên:** Tính lương cho nhân viên  
**Actor:** HR Manager, Accountant  
**Mô tả:** Tính toán bảng lương tháng cho nhân viên bao gồm lương cơ bản, phụ cấp, khấu trừ

### Luồng chính:
1. HR/Accountant truy cập trang Payroll
2. Nhấn "Tính lương mới"
3. Nhập thông tin:
   - Chọn nhân viên
   - Tháng, năm
   - Lương cơ bản
   - Các khoản phụ cấp (bonus)
4. Hệ thống tự động lấy:
   - Số ngày làm việc thực tế (từ attendance_logs)
   - Số ngày đi muộn
   - Số giờ OT (từ overtime)
5. Hệ thống tính:
   - BHXH (8%)
   - BHYT (1.5%)
   - BHTN (1%)
   - Thuế TNCN (theo biểu thuế)
6. Tính Net Salary = Base + Bonuses - Deductions
7. Lưu bảng lương (Status: DRAFT)
8. Hiển thị preview bảng lương

### Pre-condition:
- Nhân viên có status ACTIVE
- Chưa có bảng lương cho tháng đó

### Post-condition:
- Bảng lương được lưu (Status: DRAFT)
- Chờ duyệt từ HR/Admin

---

## 6. USE CASE: CHAT REALTIME

**ID:** UC-CHAT-001  
**Tên:** Gửi/Nhận tin nhắn realtime  
**Actor:** Tất cả người dùng  
**Mô tả:** Người dùng gửi và nhận tin nhắn realtime qua Socket.IO

### Luồng chính (Gửi tin nhắn):
1. Người dùng mở trang Chat
2. Chọn hoặc tạo cuộc hội thoại
3. Nhập nội dung tin nhắn
4. Nhấn Gửi
5. Client emit socket event "send_message"
6. Server nhận và lưu vào MongoDB
7. Server broadcast "new_message" đến tất cả participants
8. Các client nhận event và hiển thị tin nhắn

### Luồng thay thế:
- 3a. Gửi file/hình ảnh → Upload file trước, sau đó gửi link
- 5a. Reply tin nhắn → Đính kèm reply_to_id
- 5b. Revoke tin nhắn → Emit "revoke_message" (trong 5 phút)

### Pre-condition:
- Người dùng đã đăng nhập
- Socket.IO đã kết nối

### Post-condition:
- Tin nhắn được lưu vào messages collection
- Conversation được cập nhật last_message

---

## 7. USE CASE: TẠO DỰ ÁN/CÔNG VIỆC

**ID:** UC-PROJ-001  
**Tên:** Tạo dự án và giao việc  
**Actor:** Leader, HR Manager, Super Admin  
**Mô tả:** Leader tạo dự án hoặc task và giao cho các thành viên

### Luồng chính:
1. Leader truy cập trang Projects
2. Nhấn "Tạo dự án mới"
3. Nhập thông tin:
   - Tên dự án
   - Mô tả
   - Deadline
   - Chọn thành viên (team_members)
4. Hệ thống tạo task (status: ASSIGNED)
5. Gửi thông báo đến các thành viên được giao
6. Hiển thị dự án trên Kanban Board

### Pre-condition:
- Người dùng có role LEADER hoặc cao hơn

### Post-condition:
- Project/Task được tạo
- Notifications được gửi đến assignees

---

## 8. USE CASE: CẬP NHẬT TIẾN ĐỘ CÔNG VIỆC

**ID:** UC-TASK-001  
**Tên:** Cập nhật tiến độ task  
**Actor:** Employee  
**Mô tả:** Nhân viên cập nhật trạng thái và tiến độ công việc được giao

### Luồng chính:
1. Nhân viên truy cập trang Tasks
2. Xem danh sách task được giao
3. Chọn task để cập nhật
4. Cập nhật:
   - Progress (0-100%)
   - Status (IN_PROGRESS, REVIEW, COMPLETED)
   - Ghi chú
5. Hệ thống lưu task_history
6. Gửi thông báo đến Leader

### Pre-condition:
- Task được giao cho người dùng này
- Task status không phải COMPLETED

### Post-condition:
- Task được cập nhật
- Leader nhận thông báo

---

## 9. USE CASE: QUẢN LÝ NGƯỜI DÙNG

**ID:** UC-USER-001  
**Tên:** Tạo và quản lý tài khoản người dùng  
**Actor:** HR Manager, Super Admin  
**Mô tả:** HR tạo tài khoản mới, duyệt hồ sơ, kích hoạt/vô hiệu hóa

### Luồng chính (Tạo tài khoản):
1. HR truy cập trang Admin Users
2. Nhấn "Tạo người dùng mới"
3. Nhập email, password, role
4. Hệ thống tạo user (status: INIT)
5. Gửi email thông báo cho người dùng mới

### Luồng duyệt hồ sơ:
1. HR xem danh sách user PENDING
2. Xem chi tiết hồ sơ
3. Duyệt → Status: ACTIVE
4. Từ chối → Status: INACTIVE + lý do

### Pre-condition:
- HR có quyền HR_MANAGER hoặc SUPER_ADMIN

### Post-condition:
- User được tạo/cập nhật status
- Notifications được gửi

---

## 10. USE CASE: ĐĂNG KÝ KHUÔN MẶT

**ID:** UC-FACE-001  
**Tên:** Đăng ký dữ liệu khuôn mặt cho chấm công  
**Actor:** Employee, HR Manager (thực hiện cho nhân viên)  
**Mô tả:** Thu thập và lưu trữ face encodings để sử dụng cho chấm công AI

### Luồng chính:
1. Người dùng truy cập trang Face Enrollment
2. Mở Camera
3. Chụp 3-5 ảnh khuôn mặt từ các góc khác nhau
4. Hệ thống xử lý từng ảnh bằng DeepFace (ArcFace)
5. Trích xuất face_encodings (vector 512 chiều)
6. Lưu face_encodings vào user document
7. Cập nhật face_registered = True

### Pre-condition:
- Người dùng có status INIT hoặc PENDING
- Cho phép truy cập Camera

### Post-condition:
- face_encodings được lưu vào MongoDB
- face_registered = True
- User có thể chấm công

---

## TỔNG KẾT

**Tổng số Use Case chính:** 10  
**Tổng số Actor:** 5 (Employee, Leader, HR Manager, Accountant, Super Admin)  
**Công nghệ sử dụng:**
- Frontend: React + Vite + TailwindCSS
- Backend: FastAPI + Python
- Database: MongoDB
- Realtime: Socket.IO
- AI: DeepFace (ArcFace), OpenCV
- Auth: JWT + bcrypt

**Phân quyền theo vai trò:**
- **Employee:** Chấm công, Xin phép, Đăng OT, Chat, Xem task, Xem lương
- **Leader:** + Tạo project, Giao việc, Duyệt OT, Duyệt KPI, Xem báo cáo team
- **Accountant:** Tính lương, Duyệt bảng lương, Xuất báo cáo tài chính
- **HR Manager:** + Tạo user, Duyệt hồ sơ, Đăng ký face, Quản lý nhân sự
- **Super Admin:** FULL ACCESS - Tất cả chức năng + Cấu hình hệ thống

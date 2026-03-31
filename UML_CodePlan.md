# UML CODE PLAN - HỆ THỐNG GOODZWORK

## Phần 1: SƠ ĐỒ USECASE

### 1.1. Đăng nhập và Đăng ký

**Các tác nhân (Actor):**
- Người dùng (User)
- Quản trị viên (Admin)

**Các chức năng (Use Case):**
- Đăng ký tài khoản mới
  - Nhập email, mật khẩu
  - Xác minh email
  - Tạo tài khoản thành công
- Đăng nhập hệ thống
  - Nhập email, mật khẩu
  - Xác thực thông tin
  - Cấp phát token JWT
  - Chuyển hướng vào dashboard
- Quên mật khẩu
  - Yêu cầu reset mật khẩu
  - Gửi email xác nhận
  - Tạo mật khẩu mới

**Mối quan hệ:**
- Người dùng thực hiện: Đăng ký, Đăng nhập, Quên mật khẩu
- Admin quản lý: Tạo tài khoản, Kích hoạt/Vô hiệu hóa tài khoản

---

### 1.2. Đăng ký khuôn mặt

**Các tác nhân (Actor):**
- Người dùng (User)
- Hệ thống nhận diện (Face Recognition System)

**Các chức năng (Use Case):**
- Chọn chức năng đăng ký khuôn mặt
- Mở camera
- Chụp ảnh khuôn mặt
- Lưu trữ thông tin khuôn mặt
- Xác nhận đăng ký thành công

**Mối quan hệ:**
- Người dùng bắt đầu quá trình
- Hệ thống xử lý và lưu trữ thông tin

---

### 1.3. Nhận diện khuôn mặt (Chấm công)

**Các tác nhân (Actor):**
- Người dùng (User)
- Hệ thống chấm công (Attendance System)
- Hệ thống nhận diện (Face Recognition System)

**Các chức năng (Use Case):**
- Chọn chấm công
- Mở camera
- Chụp ảnh khuôn mặt hiện tại
- So sánh với dữ liệu đã đăng ký
- Ghi nhận chấm công
- Thông báo kết quả

**Mối quan hệ:**
- Người dùng bắt đầu quá trình
- Hệ thống chấm công điều phối
- Hệ thống nhận diện xác thực khuôn mặt

---

## Phần 2: SƠ ĐỒ TUẦN TỰ (SEQUENCE DIAGRAM)

### 2.1. Sơ đồ tuần tự: Đăng ký tài khoản

**Các thành phần tham gia:**
- Người dùng (User)
- Trình duyệt (Browser)
- Ứng dụng React (Frontend)
- Máy chủ Backend (FastAPI)
- Database (MongoDB)
- Dịch vụ Email

**Luồng hoạt động:**
1. Người dùng mở ứng dụng
2. Điền form đăng ký (email, mật khẩu, tên, số điện thoại)
3. Frontend xác thực dữ liệu cục bộ
4. Gửi yêu cầu đăng ký đến Backend
5. Backend kiểm tra email có tồn tại trong Database không
6. Nếu email chưa tồn tại:
   - Mã hóa mật khẩu
   - Tạo tài khoản mới với trạng thái "INIT"
   - Lưu vào Database
   - Gửi email xác nhận
7. Trả về thông báo thành công cho Frontend
8. Chuyển hướng người dùng đến trang nhập mã xác nhận email

---

### 2.2. Sơ đồ tuần tự: Đăng nhập hệ thống

**Các thành phần tham gia:**
- Người dùng (User)
- Trình duyệt (Browser)
- Ứng dụng React (Frontend)
- AuthContext
- Máy chủ Backend (FastAPI)
- JWT Service
- Database (MongoDB)

**Luồng hoạt động:**
1. Người dùng mở ứng dụng
2. AuthContext kiểm tra token đã lưu trong localStorage
3. Nếu có token:
   - Giải mã token để lấy thông tin người dùng
   - Kiểm tra token còn hạn không
   - Nếu còn hạn:
     - Gửi yêu cầu GET /api/auth/me với token
     - Backend tìm kiếm user trong Database
     - Trả về thông tin user nếu tồn tại
     - Kiểm tra trạng thái user
       - Nếu ACTIVE: Chuyển hướng đến /dashboard
       - Nếu INIT: Chuyển hướng đến /setup-profile
       - Nếu PENDING: Chuyển hướng đến /pending
       - Nếu SUSPENDED: Hiển thị lỗi "Tài khoản bị khóa"
   - Nếu token hết hạn: Chuyển hướng đến /login
4. Nếu không có token:
   - Hiển thị trang đăng nhập
   - Người dùng nhập email và mật khẩu
   - Frontend gửi yêu cầu đăng nhập đến Backend
   - Backend:
     - Tìm user theo email trong Database
     - Kiểm tra mật khẩu có trùng khớp không
     - Nếu trùng khớp:
       - Tạo JWT token
       - Cập nhật last_login
       - Trả về token và thông tin user
     - Nếu không trùng khớp: Trả về lỗi xác thực
   - Frontend lưu token vào localStorage
   - Chuyển hướng theo trạng thái user

---

### 2.3. Sơ đồ tuần tự: Đăng ký khuôn mặt

**Các thành phần tham gia:**
- Người dùng (User)
- Trình duyệt (Browser)
- Ứng dụng React (Frontend)
- Máy chủ Backend (FastAPI)
- Dịch vụ nhận diện khuôn mặt (Face Recognition Service - DeepFace/ArcFace)
- Database (MongoDB)
- Kho lưu trữ file (File Storage)

**Luồng hoạt động:**
1. Người dùng chọn chức năng "Đăng ký khuôn mặt"
2. Frontend hiển thị hướng dẫn sử dụng
3. Yêu cầu quyền truy cập camera
4. Người dùng cho phép truy cập
5. Mở camera
6. Frontend hướng dẫn người dùng chụp ảnh
   - Chụp ảnh từ nhiều góc độ khác nhau
   - Tối thiểu 5-10 ảnh
7. Mỗi ảnh được chụp:
   - Gửi lên Backend
   - Backend xử lý ảnh:
     - Phát hiện khuôn mặt trong ảnh (DeepFace.extract_faces)
     - Trích xuất đặc trưng khuôn mặt (ArcFace embeddings)
     - Lưu ảnh vào File Storage
     - Tích luỹ thông tin khuôn mặt
8. Sau khi chụp đủ ảnh:
   - Backend tính toán vector đặc trưng trung bình
   - Lưu thông tin khuôn mặt vào Database
   - Cập nhật trạng thái face_registered = true
9. Trả về thông báo thành công
10. Frontend chuyển hướng người dùng đến bước tiếp theo

---

### 2.4. Sơ đồ tuần tự: Nhận diện khuôn mặt (Chấm công)

**Các thành phần tham gia:**
- Người dùng (Employee)
- Trình duyệt (Browser)
- Ứng dụng React (Frontend)
- Máy chủ Backend (FastAPI)
- Dịch vụ định vị địa lý (Geofencing Service)
- Dịch vụ nhận diện khuôn mặt (Face Recognition Service)
- Database (MongoDB)
- Kho lưu trữ file (File Storage)

**Luồng hoạt động:**
1. Người dùng mở trang "Chấm công"
2. Frontend yêu cầu quyền truy cập GPS
3. Người dùng cho phép
4. Frontend lấy vị trí hiện tại (latitude, longitude)
5. Frontend gửi API POST /api/attendance/check-location với vị trí
6. Backend:
   - Gọi Geofencing Service kiểm tra vị trí
   - So sánh với phạm vi công ty (bán kính 50m)
   - Tính khoảng cách
7. Nếu ngoài phạm vi:
   - Trả về lỗi "Bạn đang ngoài phạm vi công ty"
   - Frontend dừng quá trình
8. Nếu trong phạm vi:
   - Backend trả về xác nhận
   - Frontend yêu cầu quyền truy cập camera
9. Người dùng cho phép camera
10. Frontend mở camera
11. Người dùng chụp ảnh khuôn mặt
12. Frontend gửi API POST /api/attendance/checkin với:
    - Ảnh khuôn mặt (base64 hoặc file)
    - Vị trí (latitude, longitude)
    - Loại chấm công (CHECK_IN hoặc CHECK_OUT)
13. Backend xử lý:
    - Tìm user theo token JWT
    - Kiểm tra user có face_encodings trong Database không
    - Nếu chưa đăng ký khuôn mặt: Trả về lỗi
    - Gọi Face Recognition Service:
      - Phát hiện khuôn mặt trong ảnh
      - Trích xuất đặc trưng khuôn mặt
      - So sánh với face_encodings đã lưu (cosine similarity)
      - Nếu độ tin cậy < 60%: Xác thực thất bại
      - Nếu độ tin cậy >= 60%: Xác thực thành công
14. Nếu xác thực thành công:
    - Kiểm tra thời gian:
      - Nếu CHECK_IN:
        - Kiểm tra user đã check-in hôm nay chưa
        - Nếu rồi: Trả về lỗi
        - Nếu chưa:
          - So sánh với giờ làm việc
          - Nếu <= giờ làm việc: status = ON_TIME
          - Nếu > giờ làm việc: status = LATE
      - Nếu CHECK_OUT:
        - Kiểm tra user đã check-out hôm nay chưa
        - Nếu rồi: Trả về lỗi
        - Nếu chưa:
          - So sánh với giờ kết thúc
          - Nếu >= giờ kết thúc: status = ON_TIME
          - Nếu < giờ kết thúc: status = EARLY_LEAVE
    - Lưu ảnh vào File Storage
    - Lưu attendance_log vào Database với thông tin:
      - user_id
      - Loại chấm công
      - Thời gian
      - Vị trí (latitude, longitude)
      - Độ tin cậy khuôn mặt
      - Trạng thái
    - Tạo notification cho user
    - Trả về thông báo thành công
15. Nếu xác thực thất bại:
    - Trả về lỗi "Không nhận diện được khuôn mặt"
    - Frontend hiển thị lỗi, cho phép chụp lại

---

## Phần 3: SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAM)

### 3.1. Sơ đồ hoạt động: Đăng ký tài khoản

**Người dùng:**
1. Mở ứng dụng
2. Điền thông tin đăng ký (email, mật khẩu, tên, số điện thoại)
3. Nhấn nút "Đăng ký"

**Hệ thống:**
1. Xác thực dữ liệu:
   - Email hợp lệ?
   - Mật khẩu đủ mạnh?
   - Các trường bắt buộc đã điền?
2. Kiểm tra tính duy nhất:
   - Email đã tồn tại trong Database?
   - Nếu có: Trả về lỗi "Email đã được đăng ký"
3. Nếu không tồn tại:
   - Mã hóa mật khẩu (bcrypt)
   - Tạo tài khoản mới với trạng thái INIT
   - Lưu vào Database
   - Gửi email xác nhận
4. Trả về thông báo thành công

**Người dùng:**
1. Nhận thông báo thành công
2. Nhận email xác nhận
3. Click link xác nhận hoặc nhập mã
4. Hệ thống cập nhật trạng thái email_verified = true
5. Chuyển hướng đến trang đăng nhập

---

### 3.2. Sơ đồ hoạt động: Đăng nhập hệ thống

**Người dùng:**
1. Mở trang đăng nhập
2. Điền email
3. Điền mật khẩu
4. Nhấn nút "Đăng nhập"

**Hệ thống:**
1. Xác thực dữ liệu:
   - Email có hợp lệ không?
   - Mật khẩu có rỗng không?
2. Tìm kiếm user:
   - Tìm user theo email trong Database
   - Nếu không tìm thấy: Trả về lỗi "Email không tồn tại"
3. Nếu tìm thấy:
   - So sánh mật khẩu nhập vào với mật khẩu lưu trữ
   - Nếu không trùng khớp: Trả về lỗi "Mật khẩu không chính xác"
4. Nếu trùng khớp:
   - Kiểm tra trạng thái tài khoản:
     - Nếu SUSPENDED: Trả về lỗi "Tài khoản bị khóa"
     - Nếu INACTIVE: Trả về lỗi "Tài khoản không hoạt động"
   - Cấp phát JWT token
   - Cập nhật last_login = thời gian hiện tại
   - Trả về token và thông tin user

**Người dùng:**
1. Nhận token
2. Lưu token vào localStorage
3. Hệ thống chuyển hướng dựa trên trạng thái:
   - Nếu INIT: /setup-profile
   - Nếu PENDING: /pending
   - Nếu ACTIVE: /dashboard
   - Nếu TERMINATED: Hiển thị lỗi

---

### 3.3. Sơ đồ hoạt động: Đăng ký khuôn mặt

**Người dùng:**
1. Chọn menu "Cài đặt" hoặc "Hồ sơ"
2. Chọn "Đăng ký khuôn mặt"
3. Đọc hướng dẫn
4. Nhấn nút "Bắt đầu"

**Hệ thống:**
1. Kiểm tra quyền truy cập camera
2. Yêu cầu quyền camera

**Người dùng:**
1. Cho phép truy cập camera

**Hệ thống:**
1. Mở camera
2. Hiển thị preview camera

**Người dùng:**
1. Đặt đầu vào vị trí đúng
2. Chụp ảnh (click nút hoặc tự động)
3. Hệ thống hiển thị kết quả:
   - Nếu phát hiện được mặt: Lưu ảnh, yêu cầu chụp ảnh tiếp theo
   - Nếu không phát hiện mặt: Hiển thị lỗi, yêu cầu chụp lại

**Người dùng:**
1. Lặp lại quá trình chụp ảnh 5-10 lần từ các góc độ khác nhau

**Hệ thống:**
1. Sau khi chụp đủ ảnh:
   - Xử lý tất cả ảnh:
     - Phát hiện khuôn mặt (DeepFace)
     - Trích xuất đặc trưng (ArcFace)
   - Tính toán vector đặc trưng trung bình
   - Lưu vào Database:
     - Cập nhật face_encodings
     - Cập nhật face_registered = true
   - Lưu ảnh vào File Storage

**Người dùng:**
1. Nhận thông báo "Đăng ký khuôn mặt thành công"
2. Đóng dialog
3. Hệ thống chuyển hướng đến /dashboard

---

### 3.4. Sơ đồ hoạt động: Nhận diện khuôn mặt (Chấm công)

**Người dùng:**
1. Mở trang "Chấm công"
2. Hệ thống kiểm tra: Người dùng đã đăng nhập?
   - Nếu không: Chuyển hướng đến /login
3. Yêu cầu quyền truy cập GPS
4. Người dùng cho phép

**Hệ thống:**
1. Lấy vị trí hiện tại (latitude, longitude)
2. Gọi API kiểm tra vị trí
3. Kiểm tra Geofence (bán kính 50m từ công ty):
   - Nếu ngoài phạm vi: Hiển thị lỗi "Ngoài phạm vi công ty", dừng
   - Nếu trong phạm vi: Hiển thị khoảng cách, tiếp tục

**Người dùng:**
1. Nhấn nút "Mở camera"

**Hệ thống:**
1. Yêu cầu quyền truy cập camera

**Người dùng:**
1. Cho phép truy cập camera
2. Hệ thống mở camera
3. Người dùng chụp ảnh khuôn mặt
4. Hiển thị ảnh vừa chụp

**Hệ thống:**
1. Gửi ảnh đến Backend
2. Backend kiểm tra:
   - User có face_encodings không?
     - Nếu không: Lỗi "Chưa đăng ký khuôn mặt", dừng
     - Nếu có: Tiếp tục
3. Face Recognition Service xử lý:
   - Phát hiện khuôn mặt trong ảnh
     - Nếu không phát hiện: Lỗi "Không phát hiện khuôn mặt", dừng
   - Trích xuất đặc trưng
   - So sánh với face_encodings (cosine similarity)
   - Tính độ tin cậy (%)
4. Kiểm tra độ tin cậy:
   - Nếu < 60%: Lỗi "Không nhận diện được", cho phép chụp lại
   - Nếu >= 60%: Xác thực thành công, tiếp tục
5. Kiểm tra thời gian:
   - Nếu CHECK_IN:
     - Đã check-in hôm nay?
       - Nếu có: Lỗi "Đã check-in rồi", dừng
       - Nếu không: Tiếp tục
     - Giờ hiện tại <= giờ làm việc?
       - Nếu có: status = ON_TIME
       - Nếu không: status = LATE
   - Nếu CHECK_OUT:
     - Đã check-out hôm nay?
       - Nếu có: Lỗi "Đã check-out rồi", dừng
       - Nếu không: Tiếp tục
     - Giờ hiện tại >= giờ kết thúc?
       - Nếu có: status = ON_TIME
       - Nếu không: status = EARLY_LEAVE
6. Lưu thông tin:
   - Lưu ảnh vào File Storage
   - Tạo attendance_log với các thông tin:
     - user_id
     - Loại chấm công (CHECK_IN/CHECK_OUT)
     - Thời gian
     - Vị trí (latitude, longitude)
     - Độ tin cậy khuôn mặt
     - Trạng thái (ON_TIME/LATE/EARLY_LEAVE)
   - Lưu vào Database
   - Tạo notification cho user

**Người dùng:**
1. Nhận thông báo thành công:
   - "Chấm công thành công - 08:30 AM (Đúng giờ)"
   - Hiển thị độ tin cậy, vị trí
2. Có thể quay lại hoặc thoát

---

## Phần 4: CÁC BẢNG ENUM VÀ TRẠNG THÁI

### 4.1. Trạng thái User (UserStatus)
- **INIT**: Tài khoản mới tạo, chưa hoàn thành setup
- **PENDING**: Đã setup, chờ HR duyệt
- **ACTIVE**: Kích hoạt, có thể sử dụng đầy đủ
- **SUSPENDED**: Tạm khóa
- **INACTIVE**: Vô hiệu hóa
- **TERMINATED**: Nghỉ việc

### 4.2. Loại chấm công (AttendanceType)
- **CHECK_IN**: Vào làm
- **CHECK_OUT**: Rời khỏi công ty

### 4.3. Trạng thái chấm công (AttendanceStatus)
- **ON_TIME**: Đúng giờ
- **LATE**: Trễ giờ
- **EARLY_LEAVE**: Về sớm
- **ABSENT**: Vắng mặt

### 4.4. Trạng thái khuôn mặt (FaceStatus)
- **VERIFIED**: Xác thực thành công
- **UNVERIFIED**: Xác thực thất bại
- **NOT_REGISTERED**: Chưa đăng ký

### 4.5. Vị trí địa lý (LocationStatus)
- **IN_RANGE**: Trong phạm vi công ty
- **OUT_OF_RANGE**: Ngoài phạm vi công ty

---

## Phần 5: THÔNG TIN CẤU HÌNH HỆ THỐNG

### 5.1. Frontend (React + Vite)
- Framework: React.js
- Build tool: Vite
- State Management: Context API (AuthContext)
- Styling: TailwindCSS
- HTTP Client: Axios
- Socket Client: Socket.IO Client
- Camera: getUserMedia API
- GPS: Geolocation API

### 5.2. Backend (FastAPI)
- Framework: FastAPI
- Database: MongoDB (Motor driver)
- Authentication: JWT (PyJWT, python-jose)
- Password: bcrypt
- Face Recognition: DeepFace, ArcFace
- Geofencing: Haversine formula
- File Storage: Local filesystem / Cloud Storage
- Real-time: Socket.IO Server
- Image Processing: OpenCV, Pillow

### 5.3. Database (MongoDB)
- Collections:
  - users
  - attendance_logs
  - notifications
  - sessions
  - (và các collection khác)

### 5.4. Dịch vụ ngoài
- Email: SMTP (Gmail/SendGrid)
- Storage: Local filesystem hoặc AWS S3
- AI: DeepFace, ArcFace (chạy cục bộ)

---

## Phần 6: SECURITY & VALIDATION

### 6.1. Xác thực (Authentication)
- JWT token với expiry time
- Store token ở localStorage (Frontend)
- Gửi token trong Authorization header
- Refresh token strategy

### 6.2. Bảo mật mật khẩu
- Mã hóa với bcrypt
- Yêu cầu ít nhất 8 ký tự
- Phải bao gồm chữ hoa, chữ thường, số, ký tự đặc biệt

### 6.3. Xác thực khuôn mặt
- Độ tin cậy tối thiểu: 60%
- Cosine similarity threshold
- Lưu trữ face embeddings không phải ảnh gốc (metadata)

### 6.4. Định vị địa lý
- Verify GPS từ thiết bị (có thể bị giả mạo)
- Sử dụng Geofence (bán kính 50m)
- Kết hợp với camera verification

---

## Phần 7: ERROR HANDLING

### 7.1. Lỗi Đăng ký
- Email không hợp lệ
- Email đã tồn tại
- Mật khẩu không đủ mạnh
- Server error

### 7.2. Lỗi Đăng nhập
- Email không tồn tại
- Mật khẩu sai
- Tài khoản bị khóa
- Token hết hạn

### 7.3. Lỗi Đăng ký khuôn mặt
- Camera không hoạt động
- Không phát hiện được mặt
- Quá ít ảnh
- Ảnh chất lượng kém

### 7.4. Lỗi Chấm công
- Ngoài phạm vi Geofence
- Camera không hoạt động
- Không phát hiện được mặt
- Độ tin cậy thấp
- Đã chấm công rồi
- Không có face_encodings

---

## Phần 8: DATA FLOW

### Đăng ký:
User Input → Frontend Validation → Backend Validation → Hash Password → Save to DB → Send Email → Response

### Đăng nhập:
User Input → Frontend Validation → Backend Validation → Password Compare → Generate JWT → Response

### Đăng ký Khuôn mặt:
Capture Image → Send to Backend → Face Detection → Extract Features → Save Embeddings → Update User → Response

### Chấm công:
Get Location → Geofence Check → Capture Image → Face Recognition → Time Check → Create Attendance Log → Notification → Response

---

## Phần 9: DATABASE SCHEMA (DESCRIPTIONS)

### User Collection
- _id: ObjectId
- email: String (unique)
- hashed_password: String
- full_name: String
- phone: String
- avatar: String (URL)
- face_encodings: Array of Float (ArcFace embeddings)
- face_registered: Boolean
- status: Enum (INIT, PENDING, ACTIVE, etc.)
- role: Enum (ADMIN, HR, EMPLOYEE, etc.)
- created_at: DateTime
- updated_at: DateTime
- last_login: DateTime

### AttendanceLog Collection
- _id: ObjectId
- user_id: ObjectId (FK to User)
- user_name: String
- type: Enum (CHECK_IN, CHECK_OUT)
- timestamp: DateTime
- latitude: Float
- longitude: Float
- location_status: String
- face_confidence: Float
- face_status: String
- status: Enum (ON_TIME, LATE, EARLY_LEAVE, ABSENT)
- face_image_url: String
- notes: String

---

Đây là toàn bộ code plan UML cho hệ thống. Bạn có thể sử dụng các tài liệu này để:
1. Vẽ UML diagrams trên PlantUML Editor
2. Thiết kế hệ thống chi tiết
3. Phát triển according to specifications
4. Tạo documentation cho team


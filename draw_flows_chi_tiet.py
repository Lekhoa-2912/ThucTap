import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os

# Set font for better rendering if available
plt.rcParams['font.family'] = 'sans-serif'

# Create canvas with more space for details
fig, axes = plt.subplots(1, 3, figsize=(22, 14), dpi=120)
fig.suptitle('SƠ ĐỒ LUỒNG HOẠT ĐỘNG CHI TIẾT - GOODZWORK (BACKEND AI)', fontsize=22, fontweight='bold', color='#2c3e50')

def draw_flow(ax, title, steps, color):
    ax.set_title(title, fontsize=16, fontweight='bold', color=color, pad=25)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')
    
    # Background for column
    # ax.add_patch(patches.Rectangle((2, 2), 96, 96, facecolor='#f8f9fa', edgecolor='#ecf0f1', linewidth=1, zorder=-1, alpha=0.5))
    
    y = 92
    box_w = 84
    box_h = 9
    x = 8
    
    for i, step in enumerate(steps):
        # Draw box
        box = patches.FancyBboxPatch((x, y - box_h), box_w, box_h, 
                                    boxstyle="round,pad=1.2", 
                                    linewidth=2.3, edgecolor=color, facecolor='#ffffff')
        ax.add_patch(box)
        
        # Draw step number circle
        circle = patches.Circle((x + 5, y - box_h/2), 3.5, color=color, alpha=0.9)
        ax.add_patch(circle)
        ax.text(x + 5, y - box_h/2, str(i+1), ha='center', va='center', color='white', fontweight='bold', fontsize=11)
        
        # Draw text
        text_x = x + 11
        title_text = step[0]
        desc_text = step[1]
        
        ax.text(text_x, y - box_h/2 + 2, title_text, ha='left', va='center', fontsize=11, fontweight='bold', color='#2c3e50')
        ax.text(text_x, y - box_h/2 - 1.8, desc_text, ha='left', va='center', fontsize=9, fontweight='normal', color='#7f8c8d')
        
        # Draw arrow to next step
        if i < len(steps) - 1:
            ax.annotate('', xy=(50, y - box_h - 1), xytext=(50, y - box_h - 7),
                        arrowprops=dict(arrowstyle='<-', color=color, lw=2, mutation_scale=15))
        y -= (box_h + 8.5)

# Detailed Steps Content
steps_reg = [
    ["1. Yêu cầu tạo tài khoản", "HR/Admin thao tác tạo TK trên hệ thống"],
    ["2. POST /api/auth/register", "Truyền: Email, Mật khẩu, Vai trò (Role)"],
    ["3. Hệ thống kiểm tra", "Xác thực quyền HR/Admin & check Email tồn tại"],
    ["4. Băm mật khẩu (Bcrypt)", "Hệ thống mã hóa bảo mật thông tin mật khẩu"],
    ["5. Tạo bản ghi User (DB)", "Lưu trữ thông tin cơ bản vào CSDL MongoDB"],
    ["6. Đặt Status = INIT", "Tài khoản có trạng thái Initial\n(Yêu cầu cập nhật hồ sơ trước khi dùng)"]
]

steps_face = [
    ["1. POST /api/auth/login", "Nhân viên đăng nhập đợt đầu vào hệ thống"],
    ["2. PUT /api/users/profile", "Cập nhật Họ tên, SĐT, Phòng ban, Position"],
    ["3. Sinh Employee ID", "Hệ thống tự động sinh ID theo mã PB & Index"],
    ["4. POST /api/users/enroll-face", "Gửi danh sách ảnh khuôn mặt (Request)"],
    ["5. AI Trích xuất Embeddings", "Calls face_service đọc mặt -> Face encoding"],
    ["6. Lưu DB & PENDING", "Lưu face_encodings. face_registered=True;\nStatus=PENDING"],
    ["7. HR/Admin Duyệt", "PUT /.../approve duyệt ảnh -> ACTIVE"]
]

steps_att = [
    ["1. POST /api/attendance/checkin", "Nhân viên điểm danh (Lat, Long, Face_img)"],
    ["2. Kiểm tra Geofencing", "Calls geofencing_service; check bán kính VP"],
    ["3. Nhận diện khuôn mặt (AI)", "Khớp face_image hiện tại với embeddings DB"],
    ["4. Validate Log Duplicate", "Check xem hôm nay đã check-in hay chưa"],
    ["5. Tính toán Thời gian", "Bấm so sánh giờ Start/End Time trong Settings"],
    ["6. Tạo log điểm danh", "Lưu log: Time, Type, Status (On time/Late),\nConfidence"],
    ["7. Trả về kết quả", "Trả thông tin check-in kèm status thành công"]
]

draw_flow(axes[0], '1. ĐĂNG KÝ TÀI KHOẢN', steps_reg, '#2ecc71')
draw_flow(axes[1], '2. ĐĂNG KÝ KHUÔN MẶT', steps_face, '#3498db')
draw_flow(axes[2], '3. CHẤM CÔNG (CAMERA AI)', steps_att, '#9b59b6')

plt.tight_layout(rect=[0, 0.05, 1, 0.93])

# Save output to multi places
output_path = r'd:\DU_AN\GoodZWork\so_do_luong_chi_tiet_v2.png'
plt.savefig(output_path, bbox_inches='tight')

# Also save to artifact directory for this session if it is defined correctly by assistant later
print(f"Image saved to {output_path}")

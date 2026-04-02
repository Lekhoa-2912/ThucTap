import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { userAPI } from '../api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ProfilePage() {
    const { user, updateUser } = useAuth()
    const navigate = useNavigate()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const fileInputRef = useRef(null)

    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        department: '',
        position: '',
        bank_name: '',
        bank_account_number: '',
        bank_account_holder: ''
    })

    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    })

    useEffect(() => {
        loadProfile()
    }, [])

    const loadProfile = async () => {
        try {
            const response = await userAPI.getProfile()
            setProfile(response.data)
            setFormData({
                full_name: response.data.full_name || '',
                phone: response.data.phone || '',
                department: response.data.department || '',
                position: response.data.position || '',
                bank_name: response.data.bank_name || '',
                bank_account_number: response.data.bank_account_number || '',
                bank_account_holder: response.data.bank_account_holder || ''
            })
        } catch (error) {
            toast.error('Không thể tải thông tin hồ sơ')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSave = async () => {
        if (!formData.full_name) {
            toast.error('Vui lòng nhập họ và tên')
            return
        }

        setSaving(true)
        try {
            const response = await userAPI.updateProfile(formData)
            toast.success('Cập nhật hồ sơ thành công!')
            updateUser({ ...formData, employee_id: response.data.employee_id })
            setIsEditing(false)
            loadProfile()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Cập nhật thất bại')
        } finally {
            setSaving(false)
        }
    }

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const response = await userAPI.uploadAvatar(file)
            toast.success('Upload avatar thành công!')
            updateUser({ avatar: response.data.avatar_url })
            loadProfile()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Upload thất bại')
        }
    }

    const handleChangePassword = async () => {
        if (passwordData.new_password !== passwordData.confirm_password) {
            toast.error('Mật khẩu xác nhận không khớp')
            return
        }
        if (passwordData.new_password.length < 6) {
            toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
            return
        }

        try {
            await userAPI.changePassword(passwordData.current_password, passwordData.new_password)
            toast.success('Đổi mật khẩu thành công!')
            setShowPasswordModal(false)
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Đổi mật khẩu thất bại')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="glass-card p-6 border border-slate-200 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-800">Hồ sơ cá nhân</h1>
                <p className="text-slate-500 mt-1 font-medium">Xem và quản lý thông tin cá nhân của bạn</p>
            </div>

            {/* Profile Card */}
            <div className="glass-card p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-5 md:min-w-[200px]">
                        <div
                            onClick={handleAvatarClick}
                            className="relative w-32 h-32 rounded-full overflow-hidden cursor-pointer group shadow-lg border-4 border-white ring-4 ring-blue-500/20 hover:ring-blue-500/40 transition-all"
                        >
                            {profile?.avatar ? (
                                <img
                                    src={`${API_URL}${profile.avatar}`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-4xl font-bold text-white">
                                    {profile?.full_name?.[0] || profile?.email?.[0] || '?'}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-white text-sm">Đổi ảnh</span>
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarUpload}
                            accept="image/*"
                            className="hidden"
                        />

                        {/* Employee ID Badge */}
                        {profile?.employee_id && (
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 rounded-full">
                                <span className="text-white font-bold">{profile.employee_id}</span>
                            </div>
                        )}

                        {/* Role Badge */}
                        <span className={`text-xs px-3 py-1 font-semibold rounded-full border shadow-sm ${profile?.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' :
                            profile?.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                            {profile?.role?.replace('_', ' ')} • {profile?.status}
                        </span>
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 space-y-4">
                        {!isEditing ? (
                            /* View Mode */
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <InfoField label="Họ và tên" value={profile?.full_name} />
                                    <InfoField label="Email" value={profile?.email} />
                                    <InfoField label="Số điện thoại" value={profile?.phone} />
                                    <InfoField label="Phòng ban" value={profile?.department} />
                                    <InfoField label="Chức vụ" value={profile?.position} />
                                </div>

                                {/* Bank Info */}
                                <div className="border-t border-slate-200 pt-6 mt-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Thông tin ngân hàng</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <InfoField label="Ngân hàng" value={profile?.bank_name} />
                                        <InfoField label="Số tài khoản" value={profile?.bank_account_number} />
                                        <InfoField label="Chủ tài khoản" value={profile?.bank_account_holder} />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-3 pt-6">
                                    <button onClick={() => setIsEditing(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/30 transition-all font-medium">
                                        Chỉnh sửa hồ sơ
                                    </button>
                                    <button onClick={() => setShowPasswordModal(true)} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-sm transition-all font-medium">
                                        Đổi mật khẩu
                                    </button>
                                    <button onClick={() => navigate('/face-enrollment')} className="px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl shadow-sm transition-all font-medium">
                                        {profile?.face_registered ? 'Cập nhật khuôn mặt' : 'Đăng ký khuôn mặt'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Edit Mode */
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Họ và tên <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            value={formData.full_name}
                                            onChange={handleChange}
                                            className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Phòng ban</label>
                                        <select
                                            name="department"
                                            value={formData.department}
                                            onChange={handleChange}
                                            className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
                                        >
                                            <option value="">Chọn phòng ban</option>
                                            <option value="IT">Công nghệ thông tin</option>
                                            <option value="HR">Nhân sự</option>
                                            <option value="Finance">Tài chính</option>
                                            <option value="Marketing">Marketing</option>
                                            <option value="Sales">Kinh doanh</option>
                                            <option value="Operations">Vận hành</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Chức vụ</label>
                                        <input
                                            type="text"
                                            name="position"
                                            value={formData.position}
                                            onChange={handleChange}
                                            className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Bank Info Edit */}
                                <div className="border-t border-slate-200 pt-6 mt-6">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Thông tin ngân hàng</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Ngân hàng</label>
                                            <select
                                                name="bank_name"
                                                value={formData.bank_name}
                                                onChange={handleChange}
                                                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                                            >
                                                <option value="">Chọn ngân hàng</option>
                                                <option value="Vietcombank">Vietcombank</option>
                                                <option value="Techcombank">Techcombank</option>
                                                <option value="MB Bank">MB Bank</option>
                                                <option value="BIDV">BIDV</option>
                                                <option value="Vietinbank">Vietinbank</option>
                                                <option value="ACB">ACB</option>
                                                <option value="TPBank">TPBank</option>
                                                <option value="VPBank">VPBank</option>
                                                <option value="Sacombank">Sacombank</option>
                                                <option value="Agribank">Agribank</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Số tài khoản</label>
                                            <input
                                                type="text"
                                                name="bank_account_number"
                                                value={formData.bank_account_number}
                                                onChange={handleChange}
                                                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">Chủ tài khoản</label>
                                            <input
                                                type="text"
                                                name="bank_account_holder"
                                                value={formData.bank_account_holder}
                                                onChange={handleChange}
                                                className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Save/Cancel Buttons */}
                                <div className="flex gap-3 pt-6">
                                    <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/30 transition-all font-medium disabled:opacity-50">
                                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                    <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-sm transition-all font-medium">
                                        Hủy
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-8 w-full max-w-md border border-slate-200 rounded-2xl shadow-xl">
                        <h2 className="text-xl font-bold mb-6 text-slate-800">Đổi mật khẩu</h2>
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu hiện tại</label>
                                <input
                                    type="password"
                                    value={passwordData.current_password}
                                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu mới</label>
                                <input
                                    type="password"
                                    value={passwordData.new_password}
                                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Xác nhận mật khẩu</label>
                                <input
                                    type="password"
                                    value={passwordData.confirm_password}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl shadow-sm transition-all font-medium">
                                Hủy
                            </button>
                            <button onClick={handleChangePassword} className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md flex items-center justify-center shadow-blue-500/30 transition-all font-medium">
                                Đổi mật khẩu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Helper component for displaying info fields
function InfoField({ label, value, icon }) {
    return (
        <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-4 shadow-sm hover:bg-slate-50 transition-colors">
            <p className="text-xs text-slate-500 font-medium mb-1.5">{icon} {label}</p>
            <p className="font-semibold text-slate-800 text-[15px]">{value || '—'}</p>
        </div>
    )
}

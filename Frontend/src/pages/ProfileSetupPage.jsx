import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { userAPI, utilsAPI } from '../api'
import WebcamCapture from '../components/WebcamCapture'
import { Camera, Upload } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ProfileSetupPage() {
    const navigate = useNavigate()
    const { user, updateUser } = useAuth()
    const [loading, setLoading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null)
    const [uploading, setUploading] = useState(false)
    const [showScanner, setShowScanner] = useState(false)
    const [scanMode, setScanMode] = useState('upload') // 'upload' | 'camera'
    const [ocrLoading, setOcrLoading] = useState(false)
    const fileInputRef = useRef(null)

    // Helper to convert Base64 to File
    const dataURLtoFile = (dataurl, filename) => {
        let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }

    const processOCR = async (input) => {
        setOcrLoading(true)
        try {
            let file = input
            // If input is base64 string (from Webcam)
            if (typeof input === 'string' && input.startsWith('data:image')) {
                file = dataURLtoFile(input, 'capture.jpg')
            }

            const res = await utilsAPI.scanCCCD(file)
            const data = res.data

            // Auto fill
            setFormData(prev => ({
                ...prev,
                full_name: data.full_name || prev.full_name,
                // Simple date conversion if format matches dd/mm/yyyy
                // Note: Input type="date" expects yyyy-mm-dd
                // We'll leave it simple for now or try to parse
                // dob: convertDate(data.dob) || prev.dob

                // Map other fields if available
                bank_account_holder: data.full_name ? data.full_name.toUpperCase() : prev.bank_account_holder
            }))

            toast.success(`Đã trích xuất: ${data.full_name || 'Thông tin'}`)
            setShowScanner(false)
        } catch (error) {
            console.error(error)
            const detail = error.response?.data?.detail || error.message || 'Lỗi không xác định'
            toast.error(`Lỗi OCR: ${detail}`)
        } finally {
            setOcrLoading(false)
        }
    }

    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        phone: user?.phone || '',
        department: user?.department || '',
        position: user?.position || '',
        bank_name: user?.bank_name || '',
        bank_account_number: user?.bank_account_number || '',
        bank_account_holder: user?.bank_account_holder || ''
    })

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const response = await userAPI.uploadAvatar(file)
            setAvatarUrl(response.data.avatar_url)
            updateUser({ avatar: response.data.avatar_url })
            toast.success('Upload ảnh đại diện thành công!')
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Upload thất bại')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate required fields
        if (!avatarUrl) {
            toast.error('Vui lòng upload ảnh đại diện')
            return
        }
        if (!formData.full_name) {
            toast.error('Vui lòng nhập họ và tên')
            return
        }
        if (!formData.phone) {
            toast.error('Vui lòng nhập số điện thoại')
            return
        }
        if (!formData.department) {
            toast.error('Vui lòng chọn phòng ban')
            return
        }
        if (!formData.position) {
            toast.error('Vui lòng nhập chức vụ')
            return
        }
        if (!formData.bank_name) {
            toast.error('Vui lòng chọn ngân hàng')
            return
        }
        if (!formData.bank_account_number) {
            toast.error('Vui lòng nhập số tài khoản')
            return
        }
        if (!formData.bank_account_holder) {
            toast.error('Vui lòng nhập tên chủ tài khoản')
            return
        }

        setLoading(true)
        try {
            const response = await userAPI.updateProfile({
                ...formData,
                avatar: avatarUrl
            })
            updateUser({ ...formData, avatar: avatarUrl, employee_id: response.data.employee_id })
            toast.success('Cập nhật hồ sơ thành công!')
            navigate('/face-enrollment')
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Cập nhật thất bại')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card p-8 w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold">Hoàn tất hồ sơ</h1>
                    <p className="text-slate-400 mt-2">
                        Bước 1/2: Điền đầy đủ thông tin cá nhân
                    </p>
                    <div className="flex justify-center mt-4">
                        <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-4 py-2 rounded-full text-sm font-medium transition-colors border border-blue-600/50"
                        >
                            <Camera size={16} /> Scan CCCD (E-KYC)
                        </button>
                    </div>
                </div>

                {/* Progress */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="flex-1 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
                    <div className="flex-1 h-2 bg-slate-700 rounded-full" />
                </div>

                {/* Avatar Upload */}
                <div className="flex flex-col items-center mb-8">
                    <div
                        onClick={handleAvatarClick}
                        className={`relative w-28 h-28 rounded-full overflow-hidden cursor-pointer group border-4 ${avatarUrl ? 'border-green-500' : 'border-red-500/50'} hover:border-blue-500 transition-all`}
                    >
                        {avatarUrl ? (
                            <img
                                src={`${API_URL}${avatarUrl}`}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-700 flex items-center justify-center text-4xl">
                                Ảnh
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-sm">{uploading ? 'Chờ...' : 'Ảnh'}</span>
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <p className="text-sm text-slate-400 mt-2">
                        {avatarUrl ? 'Đã có ảnh đại diện' : 'Bắt buộc upload ảnh đại diện'}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Personal Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Họ và tên <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                placeholder="Nguyễn Văn A"
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Số điện thoại <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="0901234567"
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Phòng ban <span className="text-red-400">*</span>
                            </label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleChange}
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                            <label className="block text-sm font-medium mb-2">
                                Chức vụ <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                name="position"
                                value={formData.position}
                                onChange={handleChange}
                                placeholder="VD: Nhân viên, Trưởng phòng..."
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Bank Info */}
                    <div className="border-t border-slate-600 pt-5">
                        <h3 className="text-lg font-semibold mb-4">Thông tin ngân hàng</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Ngân hàng <span className="text-red-400">*</span>
                                </label>
                                <select
                                    name="bank_name"
                                    value={formData.bank_name}
                                    onChange={handleChange}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                <label className="block text-sm font-medium mb-2">
                                    Số tài khoản <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="bank_account_number"
                                    value={formData.bank_account_number}
                                    onChange={handleChange}
                                    placeholder="1234567890"
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Tên chủ TK <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="bank_account_holder"
                                    value={formData.bank_account_holder}
                                    onChange={handleChange}
                                    placeholder="NGUYEN VAN A"
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary mt-6"
                    >
                        {loading ? 'Đang lưu...' : 'Tiếp tục đăng ký khuôn mặt →'}
                    </button>
                </form>
            </div>

            {/* OCR Scanner Modal */}
            {showScanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
                        <button
                            onClick={() => setShowScanner(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
                        >
                            ✕
                        </button>

                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Camera className="text-blue-400" />
                            Scan CCCD/CMND (E-KYC)
                        </h3>

                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setScanMode('upload')}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${scanMode === 'upload' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <Upload size={16} className="inline mr-2" /> Upload Ảnh
                            </button>
                            <button
                                onClick={() => setScanMode('camera')}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${scanMode === 'camera' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <Camera size={16} className="inline mr-2" /> Chụp ảnh
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-black/20 rounded-xl relative min-h-[300px] flex flex-col items-center justify-center p-4">
                            {ocrLoading && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                                    <div className="spinner mb-4"></div>
                                    <p className="text-blue-400 animate-pulse">Đang phân tích CCCD (OCR)...</p>
                                </div>
                            )}

                            {scanMode === 'upload' ? (
                                <div className="text-center w-full">
                                    <input
                                        type="file"
                                        id="cccd-upload"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files[0]) processOCR(e.target.files[0])
                                        }}
                                    />
                                    <label
                                        htmlFor="cccd-upload"
                                        className="border-2 border-dashed border-slate-600 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-800/50 transition-all"
                                    >
                                        <Upload size={48} className="text-slate-500 mb-4" />
                                        <span className="text-lg font-medium">Chọn ảnh CCCD từ máy</span>
                                        <span className="text-sm text-slate-400 mt-2">Hỗ trợ JPG, PNG</span>
                                    </label>
                                </div>
                            ) : (
                                <div className="w-full h-full">
                                    <WebcamCapture
                                        onCapture={(imageSrc) => {
                                            if (imageSrc) processOCR(imageSrc)
                                        }}
                                        instruction="Đặt CCCD vào khung hình"
                                        singleShot={true}
                                        minImages={1}
                                        // We might need to adjust WebcamCapture to just return the file without forcing enrollment logic
                                        // OR just assume it returns array of Files/Blobs
                                        hideGallery={true}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

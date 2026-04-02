import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { userAPI, utilsAPI } from '../api'
import WebcamCapture from '../components/WebcamCapture'
import { Camera, Upload, CheckCircle2, AlertCircle, ScanFace } from 'lucide-react'

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
    const [ocrSuccess, setOcrSuccess] = useState(false)
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
        setOcrSuccess(false)
        try {
            let file = input
            // If input is base64 string (from Webcam)
            if (typeof input === 'string' && input.startsWith('data:image')) {
                file = dataURLtoFile(input, 'capture.jpg')
            }

            const res = await utilsAPI.scanCCCD(file)
            const data = res.data

            const hasFieldFound = data.full_name || data.cccd_number || data.dob || data.gender

            if (hasFieldFound) {
                // Auto fill
                setFormData(prev => ({
                    ...prev,
                    full_name: data.full_name || prev.full_name,
                    identity_number: data.cccd_number || prev.identity_number,
                    
                    // Convert DD/MM/YYYY to YYYY-MM-DD for date input
                    date_of_birth: data.dob 
                        ? data.dob.split('/').reverse().join('-') 
                        : prev.date_of_birth,
                    
                    gender: data.gender || prev.gender,
                    nationality: data.nationality || prev.nationality || 'Việt Nam',
                    place_of_origin: data.place_of_origin || prev.place_of_origin,
                    permanent_address: data.permanent_address || prev.permanent_address,

                    // Map other fields if available
                    bank_account_holder: data.full_name ? data.full_name.toUpperCase() : prev.bank_account_holder
                }))

                setOcrSuccess(true)
                toast.success(`✅ Quét thành công: ${data.full_name || 'Hồ sơ'}`)
                setTimeout(() => setShowScanner(false), 1500)
            } else {
                toast.warning("⚠️ Không tìm thấy thông tin trên thẻ. Vui lòng chụp ảnh rõ nét hơn hoặc điền tay.")
            }
        } catch (error) {
            console.error(error)
            const detail = error.response?.data?.detail || error.message || 'Lỗi hệ thống OCR'
            toast.error(`Trích xuất thất bại: ${detail}`)
        } finally {
            setOcrLoading(false)
        }
    }

    const [formData, setFormData] = useState({
        full_name: user?.full_name || '',
        identity_number: user?.identity_number || '',
        date_of_birth: user?.date_of_birth || '',
        gender: user?.gender || '',
        nationality: user?.nationality || 'Việt Nam',
        place_of_origin: user?.place_of_origin || '',
        permanent_address: user?.permanent_address || '',
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
            toast.success('Upload tĩnh đại diện thành công!')
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Upload thất bại')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validate required fields
        if (!avatarUrl) return toast.error('Vui lòng upload ảnh đại diện')
        if (!formData.full_name) return toast.error('Vui lòng nhập họ và tên')
        if (!formData.identity_number) return toast.error('Vui lòng nhập số CCCD')
        if (!formData.phone) return toast.error('Vui lòng nhập số điện thoại')
        if (!formData.department) return toast.error('Vui lòng chọn phòng ban')
        if (!formData.position) return toast.error('Vui lòng nhập chức vụ')
        if (!formData.bank_name) return toast.error('Vui lòng chọn ngân hàng')
        if (!formData.bank_account_number) return toast.error('Vui lòng nhập số tài khoản')

        setLoading(true)
        try {
            const response = await userAPI.updateProfile({
                ...formData,
                avatar: avatarUrl
            })
            updateUser({ ...formData, avatar: avatarUrl, employee_id: response.data.employee_id })
            toast.success('Hồ sơ đã được lưu trữ an toàn!')
            navigate('/face-enrollment')
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Cập nhật thất bại')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
            <div className="w-full max-w-5xl bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl shadow-blue-500/10 rounded-3xl overflow-hidden flex flex-col md:flex-row">
                
                {/* LEFT COLUMN - Avatar & Scan */}
                <div className="md:w-1/3 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                        <div className="absolute top-[-20%] left-[-20%] w-64 h-64 rounded-full bg-white blur-3xl"></div>
                        <div className="absolute bottom-[-20%] right-[-20%] w-64 h-64 rounded-full bg-indigo-300 blur-3xl"></div>
                    </div>

                    <div className="relative z-10 w-full flex flex-col items-center text-center">
                        <span className="text-blue-200 font-semibold tracking-wider text-sm mb-2 uppercase">Thiết lập E-Profile</span>
                        <h2 className="text-3xl font-extrabold mb-8">Bước 1/2</h2>

                        {/* Avatar */}
                        <div className="relative mb-6 group cursor-pointer" onClick={handleAvatarClick}>
                            <div className={`w-40 h-40 rounded-full flex items-center justify-center text-5xl border-4 shadow-xl transition-all duration-300 overflow-hidden ${avatarUrl ? 'border-emerald-400' : 'border-white/30 group-hover:border-blue-300'}`}>
                                {avatarUrl ? (
                                    <img src={`${API_URL}${avatarUrl}`} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/50 backdrop-blur-md">
                                        Ảnh
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                <Camera size={20} />
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
                        </div>
                        <p className="text-sm text-blue-200 mb-10">
                            {avatarUrl ? 'Ảnh đại diện chuẩn.' : 'Hãy chọn một bức ảnh chụp rõ khuôn mặt của bạn.'}
                        </p>

                        {/* OCR Divider */}
                        <div className="w-full h-px bg-white/20 mb-8 relative">
                            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-700 px-3 text-xs font-medium text-blue-200 rounded-full border border-white/10">HOẶC NHANH HƠN</span>
                        </div>

                        {/* OCR Button */}
                        <button
                            type="button"
                            onClick={() => setShowScanner(true)}
                            className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/30 p-4 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg hover:-translate-y-1 group"
                        >
                            <ScanFace size={36} className="text-blue-100 group-hover:text-white transition-colors" />
                            <div>
                                <h4 className="font-bold text-lg text-white">Quét thẻ CCCD</h4>
                                <p className="text-xs text-blue-200">AI tự động điền thông tin (E-KYC)</p>
                            </div>
                        </button>

                        {formData.identity_number && (
                            <div className="mt-4 flex items-center gap-2 text-emerald-300 text-sm font-medium bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-500/30">
                                <CheckCircle2 size={16} /> Đã có thông tin định danh
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN - Form */}
                <div className="md:w-2/3 p-8 md:p-12 overflow-y-auto max-h-[90vh]">
                    <div className="mb-8">
                        <h1 className="text-2xl font-extrabold text-slate-800">Thông tin cá nhân</h1>
                        <p className="text-slate-500">Vui lòng kiểm tra và điền chính xác hồ sơ hành chính của bạn.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Section 1 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Họ và tên <span className="text-red-500">*</span>
                                </label>
                                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} placeholder="VD: NGUYEN VAN A" className="input-field uppercase" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Số định danh (CCCD) <span className="text-red-500">*</span>
                                </label>
                                <input type="text" name="identity_number" value={formData.identity_number} onChange={handleChange} placeholder="012345678901" className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Ngày sinh</label>
                                <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Giới tính</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} className="input-field py-0 h-[46px]">
                                    <option value="">-- Chọn --</option>
                                    <option value="MALE">Nam</option>
                                    <option value="FEMALE">Nữ</option>
                                    <option value="OTHER">Khác</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Quốc tịch</label>
                                <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="Việt Nam" className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Số điện thoại <span className="text-red-500">*</span>
                                </label>
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="0901234567" className="input-field" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Quê quán</label>
                                <input type="text" name="place_of_origin" value={formData.place_of_origin} onChange={handleChange} placeholder="VD: Hà Nội" className="input-field" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Nơi thường trú</label>
                                <input type="text" name="permanent_address" value={formData.permanent_address} onChange={handleChange} placeholder="VD: Q. Đống Đa, Hà Nội" className="input-field" />
                            </div>
                        </div>

                        {/* Section 2 */}
                        <div className="pt-6 border-t border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Vị trí công tác</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Phòng ban <span className="text-red-500">*</span>
                                    </label>
                                    <select name="department" value={formData.department} onChange={handleChange} className="input-field py-0 h-[46px]">
                                        <option value="">-- Chọn --</option>
                                        <option value="IT">Công nghệ thông tin</option>
                                        <option value="HR">Nhân sự</option>
                                        <option value="Finance">Tài chính</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="Sales">Kinh doanh</option>
                                        <option value="Operations">Vận hành</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Chức vụ <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="position" value={formData.position} onChange={handleChange} placeholder="VD: Backend Developer" className="input-field" />
                                </div>
                            </div>
                        </div>

                        {/* Section 3 */}
                        <div className="pt-6 border-t border-slate-100">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Tài khoản trả lương</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Ngân hàng <span className="text-red-500">*</span>
                                    </label>
                                    <select name="bank_name" value={formData.bank_name} onChange={handleChange} className="input-field py-0 h-[46px]">
                                        <option value="">-- Chọn --</option>
                                        <option value="Vietcombank">Vietcombank</option>
                                        <option value="Techcombank">Techcombank</option>
                                        <option value="MB Bank">MB Bank</option>
                                        <option value="BIDV">BIDV</option>
                                        <option value="Vietinbank">Vietinbank</option>
                                        <option value="ACB">ACB</option>
                                        <option value="TPBank">TPBank</option>
                                        <option value="VPBank">VPBank</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Số tài khoản <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="bank_account_number" value={formData.bank_account_number} onChange={handleChange} placeholder="VD: 1903..." className="input-field" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Tên chủ TK <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="bank_account_holder" value={formData.bank_account_holder} onChange={handleChange} placeholder="VD: NGUYEN VAN A" className="input-field uppercase" />
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="pt-6 flex justify-end">
                            <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-10 py-4 text-lg shadow-xl shadow-blue-500/20">
                                {loading ? 'Đang mã hóa & lưu...' : 'Tiếp tục đăng ký khuôn mặt ➔'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* OCR Scanner Modal - REDESIGNED */}
            {showScanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => !ocrLoading && setShowScanner(false)}></div>
                    
                    <div className="bg-white/90 backdrop-blur-2xl border border-white rounded-3xl w-full max-w-2xl relative overflow-hidden shadow-2xl flex flex-col md:max-h-[85vh] animate-[fadeIn_0.3s_ease-out]">
                        
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white/50">
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                        <ScanFace size={20} />
                                    </div>
                                    Hệ thống E-KYC
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">AI Trích xuất dứ liệu tự động từ giấy tờ tùy thân</p>
                            </div>
                            <button onClick={() => setShowScanner(false)} disabled={ocrLoading} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                ✕
                            </button>
                        </div>

                        {/* Mode Switcher */}
                        <div className="p-8 pb-4">
                            <div className="flex p-1 bg-slate-100 rounded-2xl w-full">
                                <button
                                    onClick={() => setScanMode('upload')}
                                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all ${scanMode === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Upload size={18} /> Tải ảnh từ máy
                                </button>
                                <button
                                    onClick={() => setScanMode('camera')}
                                    className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all ${scanMode === 'camera' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Camera size={18} /> Chụp trực tiếp
                                </button>
                            </div>
                        </div>

                        {/* Scanner Area */}
                        <div className="px-8 pb-8 flex-1 overflow-y-auto relative min-h-[350px]">
                            
                            {/* Loading Overlay */}
                            {ocrLoading && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-2xl mx-8 mb-8 border border-blue-100">
                                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 relative">
                                        <div className="absolute inset-0 border-4 border-t-blue-600 border-blue-200 rounded-full animate-spin"></div>
                                        <ScanFace className="text-blue-600 w-8 h-8 animate-pulse" />
                                    </div>
                                    <p className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Đang quét siêu dữ liệu...</p>
                                    <p className="text-sm text-slate-500 mt-2 text-center max-w-xs">Quá trình này có thể mất vài giây. Vui lòng giữ nguyên cửa sổ.</p>
                                </div>
                            )}

                            {/* Success Overlay */}
                            {ocrSuccess && !ocrLoading && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-emerald-50/95 backdrop-blur-sm rounded-2xl mx-8 mb-8 border border-emerald-200">
                                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                                        <CheckCircle2 className="text-emerald-500 w-10 h-10" />
                                    </div>
                                    <p className="text-xl font-bold text-emerald-700">Trích xuất thành công!</p>
                                </div>
                            )}

                            <label htmlFor={scanMode === 'upload' ? 'cccd-upload' : undefined} className="h-full w-full bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer block">
                                {scanMode === 'upload' ? (
                                    <>
                                        <input
                                            type="file"
                                            id="cccd-upload"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files[0]) processOCR(e.target.files[0])
                                            }}
                                        />
                                        <div className="text-center p-8 pointer-events-none w-full">
                                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mx-auto mb-6 group-hover:scale-110 transition-transform loop-float">
                                                <Upload size={32} className="text-blue-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-700 mb-2">Nhấn để chọn ảnh CCCD</h3>
                                            <p className="text-slate-400 text-sm">Hỗ trợ định dạng JPG, PNG. Ảnh cần đảm bảo rõ nét, không mờ nhòe.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full h-full p-2">
                                        <div className="bg-black/5 rounded-2xl w-full h-full overflow-hidden border border-slate-200 relative">
                                            <WebcamCapture
                                                onCapture={(imageSrc) => {
                                                    if (imageSrc) processOCR(imageSrc)
                                                }}
                                                instruction="Giữ CCCD nằm gọn trong khung hình"
                                                singleShot={true}
                                                hideGallery={true}
                                            />
                                            {/* Corner brackets for aesthetic */}
                                            <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-white/50 rounded-tl-lg pointer-events-none z-10"></div>
                                            <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-white/50 rounded-tr-lg pointer-events-none z-10"></div>
                                            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-white/50 rounded-bl-lg pointer-events-none z-10"></div>
                                            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-white/50 rounded-br-lg pointer-events-none z-10"></div>
                                        </div>
                                    </div>
                                )}
                            </label>
                        </div>

                        {/* Tips */}
                        {!ocrLoading && !ocrSuccess && (
                            <div className="px-8 pb-8">
                                <div className="bg-amber-50 rounded-xl p-4 flex items-start gap-3 border border-amber-100">
                                    <AlertCircle className="text-amber-500 mt-0.5" size={18} />
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800">Lưu ý để AI nhận diện tốt nhất:</h4>
                                        <ul className="text-xs text-amber-700/80 mt-1 list-disc pl-4 space-y-1">
                                            <li>Ảnh chụp đủ sáng, không bị bóng lóa (glow).</li>
                                            <li>Thông tin chữ trên thẻ đọc được bằng mắt thường.</li>
                                            <li>Chụp vừa sát viền thẻ CCCD.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userAPI } from '../api'
import WebcamCapture from '../components/WebcamCapture'

export default function AdminFaceEnrollPage() {
    const { userId } = useParams()
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [enrolling, setEnrolling] = useState(false)
    const [capturedImages, setCapturedImages] = useState([])
    const [step, setStep] = useState('info') // info, capture, processing, done

    useEffect(() => {
        loadUser()
    }, [userId])

    const loadUser = async () => {
        try {
            const response = await userAPI.getUser(userId)
            setUser(response.data)
        } catch (error) {
            toast.error('Không tìm thấy người dùng')
            navigate('/admin/users')
        } finally {
            setLoading(false)
        }
    }

    const handleCaptureComplete = async (images) => {
        setCapturedImages(images)
        setStep('processing')
        setEnrolling(true)

        try {
            await userAPI.enrollFace(userId, images)
            toast.success('Đăng ký khuôn mặt thành công!')
            setStep('done')
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Đăng ký khuôn mặt thất bại')
            setStep('capture')
        } finally {
            setEnrolling(false)
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
            <div className="glass-card p-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/users')}
                        className="text-slate-400 hover:text-white"
                    >
                        ← Quay lại
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold">Đăng ký khuôn mặt</h1>
                        <p className="text-slate-400">Cho nhân viên: {user?.full_name || user?.email}</p>
                    </div>
                </div>
            </div>

            {/* User Info */}
            {step === 'info' && (
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold mb-4">Thông tin nhân viên</h2>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <p className="text-slate-400 text-sm">Họ tên</p>
                            <p className="font-medium">{user?.full_name || 'Chưa cập nhật'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Email</p>
                            <p className="font-medium">{user?.email}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Phòng ban</p>
                            <p className="font-medium">{user?.department || '-'}</p>
                        </div>
                        <div>
                            <p className="text-slate-400 text-sm">Chức vụ</p>
                            <p className="font-medium">{user?.position || '-'}</p>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                        <h3 className="font-medium text-blue-300 mb-2">Hướng dẫn chụp ảnh</h3>
                        <ul className="text-sm text-slate-300 space-y-1">
                            <li>• Đảm bảo ánh sáng đủ, không ngược sáng</li>
                            <li>• Nhìn thẳng vào camera, theo hướng dẫn</li>
                            <li>• Không đeo kính râm, khẩu trang</li>
                            <li>• Hệ thống sẽ chụp 150 ảnh với 5 góc nhìn khác nhau</li>
                        </ul>
                    </div>

                    <button
                        onClick={() => setStep('capture')}
                        className="w-full btn-primary py-4 text-lg"
                    >
                        Bắt đầu chụp ảnh
                    </button>
                </div>
            )}

            {/* Capture */}
            {step === 'capture' && (
                <div className="glass-card p-6">
                    <WebcamCapture
                        mode="auto"
                        totalImages={150}
                        onComplete={handleCaptureComplete}
                        onCancel={() => setStep('info')}
                    />
                </div>
            )}

            {/* Processing */}
            {step === 'processing' && (
                <div className="glass-card p-12 text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold mb-2">Đang xử lý...</h3>
                    <p className="text-slate-400">
                        AI đang phân tích {capturedImages.length} ảnh khuôn mặt
                    </p>
                </div>
            )}

            {/* Done */}
            {step === 'done' && (
                <div className="glass-card p-12 text-center">
                    <div className="text-6xl mb-4">OK</div>
                    <h3 className="text-xl font-semibold mb-2 text-green-400">
                        Đăng ký thành công!
                    </h3>
                    <p className="text-slate-400 mb-6">
                        Nhân viên {user?.full_name} đã có thể sử dụng nhận diện khuôn mặt để chấm công
                    </p>
                    <button
                        onClick={() => navigate('/admin/users')}
                        className="btn-primary"
                    >
                        Quay lại danh sách
                    </button>
                </div>
            )}
        </div>
    )
}

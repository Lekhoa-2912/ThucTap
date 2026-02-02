import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { userAPI } from '../api'
import WebcamCapture from '../components/WebcamCapture'

export default function FaceEnrollmentPage() {
    const navigate = useNavigate()
    const { updateUser } = useAuth()
    const [capturedImages, setCapturedImages] = useState([])
    const [submitting, setSubmitting] = useState(false)

    const handleCapture = useCallback((imageSrc) => {
        setCapturedImages(prev => {
            if (prev.length >= 3) return prev
            return [...prev, imageSrc]
        })
    }, [])

    const handleRemoveImage = (index) => {
        setCapturedImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (capturedImages.length < 1) {
            toast.error('Vui lòng chụp ít nhất 1 ảnh')
            return
        }

        setSubmitting(true)
        try {
            const response = await userAPI.enrollFace(capturedImages)
            toast.success(response.data.message)

            const newStatus = response.data.status || 'PENDING'

            updateUser({
                status: newStatus,
                face_registered: true
            })

            if (newStatus === 'ACTIVE') {
                navigate('/dashboard')
            } else {
                navigate('/pending')
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Đăng ký khuôn mặt thất bại')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="glass-card p-8 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Side: Instructions & Webcam */}
                <div>
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold mb-2">Đăng ký khuôn mặt</h1>
                        <p className="text-slate-400 text-sm">
                            Hệ thống AI mới chỉ cần 1-3 ảnh là đủ.
                        </p>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                        <h3 className="font-medium text-blue-400 mb-2">Hướng dẫn</h3>
                        <ul className="text-sm text-slate-300 space-y-1">
                            <li>• Giữ khuôn mặt trong khung hình</li>
                            <li>• Nhìn thẳng vào camera, đủ sáng</li>
                            <li>• Không đeo khẩu trang/kính râm</li>
                            <li>• <b>Chụp 3 ảnh</b> để có kết quả tốt nhất</li>
                        </ul>
                    </div>

                    <div className="rounded-xl overflow-hidden shadow-lg border border-slate-700 bg-black/50">
                        {capturedImages.length < 3 ? (
                            <WebcamCapture
                                onCapture={handleCapture}
                                autoCapture={false}
                                maxCaptures={3}
                                showGuide={true}
                            />
                        ) : (
                            <div className="aspect-video flex items-center justify-center bg-green-500/10 text-green-400 flex-col gap-2">
                                <div className="text-4xl">✓</div>
                                <p>Đã chụp đủ 3 ảnh</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Gallery & Actions */}
                <div className="flex flex-col">
                    <h3 className="font-medium text-white mb-4">Ảnh đã chụp ({capturedImages.length}/3)</h3>

                    <div className="flex-1 grid grid-cols-1 gap-4 content-start">
                        {capturedImages.map((img, idx) => (
                            <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-black">
                                <img src={img} alt={`Capture ${idx + 1}`} className="w-full h-full object-cover" />
                                <button
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110"
                                    title="Xóa ảnh này"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                                    Ảnh {idx + 1}
                                </div>
                            </div>
                        ))}

                        {Array.from({ length: Math.max(0, 3 - capturedImages.length) }).map((_, i) => (
                            <div key={`empty-${i}`} className="border-2 border-dashed border-slate-700 rounded-lg aspect-video flex items-center justify-center text-slate-500">
                                <span>Trống</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-700">
                        <button
                            onClick={handleSubmit}
                            disabled={capturedImages.length === 0 || submitting}
                            className="w-full btn-primary py-3 text-lg"
                        >
                            {submitting ? 'Đang xử lý...' : `Hoàn tất đăng ký (${capturedImages.length} ảnh)`}
                        </button>
                        {capturedImages.length > 0 && capturedImages.length < 3 && (
                            <p className="text-center text-yellow-500 text-sm mt-2">
                                Khuyên dùng đủ 3 ảnh để nhận diện tốt hơn
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { attendanceAPI } from '../api'
import WebcamCapture from '../components/WebcamCapture'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export default function AttendancePage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState('checking') // checking, denied, camera, success
    const [location, setLocation] = useState(null)
    const [locationError, setLocationError] = useState(null)
    const [distance, setDistance] = useState(null)
    const [todayStatus, setTodayStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    const [attendanceLogs, setAttendanceLogs] = useState([])

    // State cho hiển thị tên người dùng sau khi chấm công
    const [successInfo, setSuccessInfo] = useState(null)
    // State cho thông báo lỗi/feedback trực tiếp trên camera
    const [cameraFeedback, setCameraFeedback] = useState(null)
    // Flag để dừng hoàn toàn luồng chấm công (sau thành công hoặc lỗi critical)
    const [attendanceComplete, setAttendanceComplete] = useState(false)

    useEffect(() => {
        loadTodayStatus()
        loadAttendanceLogs()
        requestLocation()
    }, [])

    const loadTodayStatus = async () => {
        try {
            const response = await attendanceAPI.getTodayStatus()
            setTodayStatus(response.data)
        } catch (error) {
            console.error('Failed to load today status:', error)
        }
    }

    const loadAttendanceLogs = async () => {
        try {
            const response = await attendanceAPI.getLogs()
            setAttendanceLogs(response.data)
        } catch (error) {
            console.error('Failed to load logs:', error)
        }
    }

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Trình duyệt không hỗ trợ GPS')
            setStep('denied')
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords
                setLocation({ latitude, longitude, accuracy })

                // Check if within geofence
                try {
                    const response = await attendanceAPI.checkLocation(latitude, longitude)
                    const { allowed, distance: dist, message } = response.data
                    setDistance(dist)

                    if (allowed) {
                        setStep('confirm')
                    } else {
                        setStep('denied')
                        setLocationError(message)
                    }
                } catch (error) {
                    setStep('denied')
                    setLocationError('Không thể kiểm tra vị trí')
                }
            },
            (error) => {
                setLocationError('Vui lòng cho phép truy cập vị trí để chấm công')
                setStep('denied')
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    // Ref for tracking stranger detection time
    const strangerDetectionStart = useRef(null)

    const handleCapture = useCallback(async (imageSrc) => {
        // Dừng nếu đã hoàn tất hoặc đang xử lý
        if (loading || !location || attendanceComplete) return

        setLoading(true)
        setLoading(true)
        // setCameraFeedback(null) // Không reset vội để logic render có thể dùng nếu cần, nhưng ở đây ta unmount luôn

        try {
            const isCheckOut = todayStatus?.checked_in && !todayStatus?.checked_out

            const data = {
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                face_image: imageSrc
            }

            let response
            if (isCheckOut) {
                response = await attendanceAPI.checkOut(data)
            } else {
                response = await attendanceAPI.checkIn(data)
            }

            // THÀNH CÔNG - Dừng hoàn toàn
            setAttendanceComplete(true)
            strangerDetectionStart.current = null // Reset stranger timer on success

            // Lưu thông tin thành công để hiển thị
            setSuccessInfo({
                userName: response.data.user_name || user?.fullname || user?.email || 'Nhân viên',
                type: isCheckOut ? 'CHECK_OUT' : 'CHECK_IN',
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                message: response.data.message
            })

            toast.success(response.data.message)
            setStep('success')
            loadTodayStatus()
            loadAttendanceLogs()
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'Chấm công thất bại'
            // console.error("Attendance error:", errorMsg); // Giảm log spam

            // Kiểm tra nếu đã check-in rồi -> DỪNG HOÀN TOÀN, không retry
            if (errorMsg.includes('đã check-in') || errorMsg.includes('đã check-out') ||
                errorMsg.includes('already checked')) {
                setAttendanceComplete(true)
                toast.warning(errorMsg)
                loadTodayStatus()
                loadAttendanceLogs()
                return
            }

            // Phân loại lỗi để hiển thị feedback phù hợp
            if (errorMsg.includes('chưa đăng ký khuôn mặt')) {
                setCameraFeedback({ type: 'error', message: 'Bạn chưa đăng ký khuôn mặt. Vui lòng đăng ký trước khi chấm công.' });
            } else if (errorMsg.includes('độ tin cậy') || errorMsg.includes('Khuôn mặt không khớp')) {
                // Trích xuất % độ tin cậy nếu có
                const match = errorMsg.match(/(\d+\.?\d*)%/);
                const confidence = match ? match[1] + '%' : '';
                setCameraFeedback({ type: 'error', message: `Không khớp! ${confidence}` });

                // STRANGER DETECTION LOGIC
                if (!strangerDetectionStart.current) {
                    strangerDetectionStart.current = Date.now();
                } else if (Date.now() - strangerDetectionStart.current > 2000) {
                    toast.error("⚠️ Phát hiện gương mặt lạ!");
                    strangerDetectionStart.current = Date.now();
                }
            } else if (errorMsg.includes('Không phát hiện được khuôn mặt')) {
                setCameraFeedback({ type: 'error', message: 'Không tìm thấy khuôn mặt!' });
                strangerDetectionStart.current = null;
            } else {
                setCameraFeedback({ type: 'error', message: errorMsg });
                strangerDetectionStart.current = null;
            }

            // Với logic mới: Camera đã đóng khi bắt đầu xử lý.
            // Nếu lỗi, ta giữ nguyên trạng thái 'camera' nhưng hiển thị UI lỗi thay vì Webcam
            // UI lỗi sẽ có nút "Thử lại" để reset feedback và có thể là chuyển về step 'confirm' hoặc mount lại camera
            // Việc setCameraFeedback ở trên đã đủ để trigger UI lỗi trong phần render

        } finally {
            setLoading(false)
        }
    }, [location, todayStatus, loading, user, attendanceComplete])

    const isCheckOut = todayStatus?.checked_in && !todayStatus?.checked_out
    const isComplete = todayStatus?.checked_in && todayStatus?.checked_out

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="glass-card p-6">
                <h1 className="text-2xl font-bold mb-2">Chấm công</h1>
                <p className="text-slate-400">
                    {format(new Date(), "EEEE, 'ngày' dd 'tháng' MM, yyyy", { locale: vi })}
                </p>
            </div>

            {/* Today Status */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Trạng thái hôm nay</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-xl ${todayStatus?.checked_in ? 'bg-green-500/20 border border-green-500/30' : 'bg-slate-700/50'}`}>
                        <p className="text-sm text-slate-400">Check-in</p>
                        {todayStatus?.checkin_time ? (
                            <>
                                <p className="text-xl font-bold">{format(new Date(todayStatus.checkin_time), 'HH:mm')}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${todayStatus.checkin_status === 'ON_TIME' ? 'status-active' : 'status-late'
                                    }`}>
                                    {todayStatus.checkin_status === 'ON_TIME' ? 'Đúng giờ' : 'Đi muộn'}
                                </span>
                            </>
                        ) : (
                            <p className="text-xl font-bold text-slate-500">--:--</p>
                        )}
                    </div>
                    <div className={`p-4 rounded-xl ${todayStatus?.checked_out ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-700/50'}`}>
                        <p className="text-sm text-slate-400">Check-out</p>
                        {todayStatus?.checkout_time ? (
                            <>
                                <p className="text-xl font-bold">{format(new Date(todayStatus.checkout_time), 'HH:mm')}</p>
                                <span className={`text-xs px-2 py-1 rounded-full ${todayStatus.checkout_status === 'ON_TIME' ? 'status-active' : 'status-late'
                                    }`}>
                                    {todayStatus.checkout_status === 'ON_TIME' ? 'Đúng giờ' : 'Về sớm'}
                                </span>
                            </>
                        ) : (
                            <p className="text-xl font-bold text-slate-500">--:--</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Attendance Action */}
            {!isComplete && (
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold mb-4">
                        {isCheckOut ? 'Check-out' : 'Check-in'}
                    </h2>

                    {step === 'checking' && (
                        <div className="text-center py-8">
                            <div className="spinner mx-auto mb-4"></div>
                            <p>Đang kiểm tra vị trí...</p>
                        </div>
                    )}

                    {step === 'denied' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">Vị trí</span>
                            </div>
                            <p className="text-red-400 mb-4">{locationError}</p>
                            {distance && (
                                <p className="text-slate-400 mb-4">Khoảng cách: {Math.round(distance)}m</p>
                            )}
                            <button onClick={requestLocation} className="btn-primary">
                                Thử lại
                            </button>
                        </div>
                    )}

                    {step === 'confirm' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">?</span>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
                                <p className="text-green-400 flex items-center gap-2 justify-center">
                                    ✓ Vị trí hợp lệ ({Math.round(distance)}m)
                                </p>
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Xác nhận chấm công</h3>
                            <p className="text-slate-400 mb-6">
                                Bạn có muốn {isCheckOut ? 'Check-out' : 'Check-in'} ngay bây giờ?
                                <br />Camera sẽ được bật để xác thực.
                            </p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setStep('camera')} className="btn-primary px-8">
                                    Mở Camera
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'camera' && !loading && !attendanceComplete && (
                        <div>
                            <p className="text-slate-400 mb-4 text-center">
                                Đưa khuôn mặt vào vòng tròn xanh và giữ yên để tự động chấm công
                            </p>
                            <WebcamCapture
                                onCapture={handleCapture}
                                autoCapture={false}
                                autoAttendance={!attendanceComplete}
                                attendanceDelay={2000}
                                showGuide={true}
                                isProcessing={loading || attendanceComplete}
                                feedback={cameraFeedback}
                            />
                        </div>
                    )}

                    {/* Processing State - Camera Closed */}
                    {(loading || (step === 'camera' && attendanceComplete)) && step !== 'success' && (
                        <div className="text-center py-12">
                            <div className="spinner mx-auto mb-4"></div>
                            <p className="text-slate-300 font-medium">Đang xử lý hình ảnh...</p>
                            <p className="text-slate-500 text-sm mt-2">Camera đã tắt để bảo vệ riêng tư</p>
                        </div>
                    )}

                    {/* Error State with Retry/Register - Camera Closed */}
                    {cameraFeedback?.type === 'error' && !loading && !attendanceComplete && step === 'camera' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">⚠</span>
                            </div>
                            <p className="text-red-400 mb-2 font-medium">{cameraFeedback.message}</p>

                            {cameraFeedback.message?.includes('chưa đăng ký') ? (
                                <div className="flex flex-col gap-3 max-w-xs mx-auto mt-4">
                                    <button
                                        onClick={() => navigate('/face-enrollment')}
                                        className="btn-primary w-full"
                                    >
                                        Đăng ký khuôn mặt ngay
                                    </button>
                                    <button
                                        onClick={() => { setCameraFeedback(null); setStep('confirm'); }}
                                        className="btn-secondary w-full"
                                    >
                                        Để sau
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-slate-500 mb-6 font-sm">Vui lòng thử lại</p>
                                    <button onClick={() => { setCameraFeedback(null); setStep('confirm'); }} className="btn-secondary">
                                        Thử lại
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'success' && successInfo && (
                        <div className="text-center py-8">
                            {/* Animation thành công */}
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                {/* Vòng tròn hiệu ứng */}
                                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                                <div className="relative w-full h-full bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                                    <span className="text-4xl">✓</span>
                                </div>
                            </div>

                            {/* Thông tin người dùng */}
                            <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-2xl p-6 mb-4">
                                <p className="text-2xl font-bold text-white mb-2">
                                    {successInfo.userName}
                                </p>
                                <p className="text-green-400 text-lg font-medium mb-1">
                                    {successInfo.type === 'CHECK_IN' ? 'Check-in thành công!' : 'Check-out thành công!'}
                                </p>
                                <p className="text-slate-300 text-lg">
                                    Lúc: {successInfo.time}
                                </p>
                            </div>

                            <p className="text-slate-400">
                                {successInfo.type === 'CHECK_IN'
                                    ? 'Chúc bạn một ngày làm việc hiệu quả!'
                                    : 'Hẹn gặp lại bạn ngày mai!'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {isComplete && (
                <div className="glass-card p-6 text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">Success</span>
                    </div>
                    <p className="text-lg font-medium mb-2">Bạn đã hoàn tất chấm công hôm nay!</p>
                    <p className="text-slate-400">Hẹn gặp lại ngày mai</p>
                </div>
            )}

            {/* Recent Logs */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Lịch sử chấm công</h2>
                <div className="space-y-2">
                    {attendanceLogs.slice(0, 10).map(log => (
                        <div key={log.id} className="flex items-center justify-between py-3 border-b border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${log.status === 'ON_TIME' ? 'bg-green-500' :
                                    log.status === 'LATE' ? 'bg-red-500' : 'bg-yellow-500'
                                    }`} />
                                <div>
                                    <p>{log.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'}</p>
                                    <p className="text-xs text-slate-400">
                                        {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-sm px-2 py-1 rounded-full ${log.status === 'ON_TIME' ? 'status-active' : 'status-late'
                                }`}>
                                {log.status === 'ON_TIME' ? 'Đúng giờ' :
                                    log.status === 'LATE' ? 'Đi muộn' : 'Về sớm'}
                            </span>
                        </div>
                    ))}
                    {attendanceLogs.length === 0 && (
                        <p className="text-center text-slate-400 py-4">Chưa có lịch sử chấm công</p>
                    )}
                </div>
            </div>
        </div>
    )
}

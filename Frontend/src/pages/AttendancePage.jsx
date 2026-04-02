import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { attendanceAPI } from '../api'
import WebcamCapture from '../components/WebcamCapture'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
    Calendar as CalendarIcon, MapPin, Camera, CheckCircle2,
    Clock, AlertCircle, Fingerprint, ChevronRight, Check
} from 'lucide-react'

export default function AttendancePage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [step, setStep] = useState('checking') // checking, denied, confirm, camera, success
    const [location, setLocation] = useState(null)
    const [locationError, setLocationError] = useState(null)
    const [distance, setDistance] = useState(null)
    const [todayStatus, setTodayStatus] = useState(null)
    const [loading, setLoading] = useState(false)
    const [attendanceLogs, setAttendanceLogs] = useState([])

    const [successInfo, setSuccessInfo] = useState(null)
    const [cameraFeedback, setCameraFeedback] = useState(null)
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
        setStep('checking')
        if (!navigator.geolocation) {
            setLocationError('Trình duyệt không hỗ trợ định vị GPS')
            setStep('denied')
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords
                setLocation({ latitude, longitude, accuracy })

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
                    setLocationError('Không thể kiểm tra vị trí với máy chủ')
                }
            },
            (error) => {
                setLocationError('Vui lòng cấp quyền quyệt vị trí để chấm công')
                setStep('denied')
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const strangerDetectionStart = useRef(null)

    const handleCapture = useCallback(async (imageSrc) => {
        if (loading || !location || attendanceComplete) return

        setLoading(true)

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

            setAttendanceComplete(true)
            strangerDetectionStart.current = null

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

            if (errorMsg.includes('đã check-in') || errorMsg.includes('đã check-out') ||
                errorMsg.includes('already checked')) {
                setAttendanceComplete(true)
                toast.warning(errorMsg)
                loadTodayStatus()
                loadAttendanceLogs()
                return
            }

            if (errorMsg.includes('chưa đăng ký khuôn mặt')) {
                setCameraFeedback({ type: 'error', message: 'Bạn chưa đăng ký khuôn mặt để chấm công.' })
            } else if (errorMsg.includes('độ tin cậy') || errorMsg.includes('Khuôn mặt không khớp')) {
                const match = errorMsg.match(/(\d+\.?\d*)%/)
                const confidence = match ? match[1] + '%' : ''
                setCameraFeedback({ type: 'error', message: `Mặt không khớp! (${confidence})` })

                if (!strangerDetectionStart.current) {
                    strangerDetectionStart.current = Date.now()
                } else if (Date.now() - strangerDetectionStart.current > 2000) {
                    toast.error("⚠️ Phát hiện gương mặt lạ!")
                    strangerDetectionStart.current = Date.now()
                }
            } else if (errorMsg.includes('Không phát hiện được khuôn mặt')) {
                setCameraFeedback({ type: 'error', message: 'Không tìm thấy khuôn mặt trong khung hình!' })
                strangerDetectionStart.current = null
            } else {
                setCameraFeedback({ type: 'error', message: errorMsg })
                strangerDetectionStart.current = null
            }

        } finally {
            setLoading(false)
        }
    }, [location, todayStatus, loading, user, attendanceComplete])

    const isCheckOut = todayStatus?.checked_in && !todayStatus?.checked_out
    const isComplete = todayStatus?.checked_in && todayStatus?.checked_out

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/70 p-6 rounded-3xl border border-white backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div>
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                        Chấm Công AI
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium">
                        <CalendarIcon size={16} className="text-blue-500" />
                        {format(new Date(), "EEEE, 'ngày' dd 'tháng' MM, yyyy", { locale: vi })}
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white/80 px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                    <Clock size={20} className="text-blue-500 animate-pulse-slow" />
                    <span className="font-mono text-xl font-bold tracking-wider text-slate-700">
                        {format(new Date(), 'HH:mm')}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Action & Camera */}
                <div className="lg:col-span-7 space-y-8">
                    {!isComplete ? (
                        <div className="p-1.5 rounded-[28px] overflow-hidden relative group bg-gradient-to-br from-blue-50/50 to-indigo-50/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-1000"></div>
                            
                            <div className="bg-white/80 backdrop-blur-2xl rounded-[22px] p-6 sm:p-8 relative z-10 border border-white shadow-inner flex flex-col justify-center min-h-[440px]">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                        <Fingerprint className="text-blue-500" />
                                        {isCheckOut ? 'Xác thực Check-out' : 'Xác thực Check-in'}
                                    </h2>
                                    {location && (
                                        <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full border border-emerald-100">
                                            <MapPin size={12} />
                                            Sẵn sàng
                                        </span>
                                    )}
                                </div>

                                {step === 'checking' && (
                                    <div className="flex flex-col items-center justify-center flex-1 py-12 text-center animate-fade-in">
                                        <div className="relative w-20 h-20 mb-6">
                                            <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin flex items-center justify-center"></div>
                                            <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500" size={32} />
                                        </div>
                                        <p className="text-lg font-bold text-slate-800">Đang quét vị trí định vị GPS...</p>
                                        <p className="text-sm text-slate-500 mt-2">Vui lòng kiên nhẫn trong giây lát</p>
                                    </div>
                                )}

                                {step === 'denied' && (
                                    <div className="flex flex-col items-center justify-center flex-1 py-12 text-center animate-fade-in">
                                        <div className="w-20 h-20 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                            <AlertCircle size={40} className="text-red-500" />
                                        </div>
                                        <p className="text-xl font-bold text-slate-800 mb-2">Vị trí không hợp lệ</p>
                                        <p className="text-red-600 bg-red-50/80 px-4 py-2 rounded-xl text-sm max-w-sm mb-6 font-medium">{locationError}</p>
                                        {distance && (
                                            <div className="flex items-center gap-2 text-slate-600 text-sm bg-slate-50 px-4 py-2 rounded-full mb-8 font-medium">
                                                <MapPin size={14} />
                                                Khoảng cách hiện tại: <span className="font-mono text-slate-800 font-bold">{Math.round(distance)}m</span>
                                            </div>
                                        )}
                                        <button onClick={requestLocation} className="btn-primary flex items-center gap-2 group shadow-lg shadow-blue-500/20">
                                            Quét lại vị trí 
                                            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                )}

                                {step === 'confirm' && (
                                    <div className="flex flex-col items-center justify-center flex-1 py-8 text-center animate-fade-in">
                                        <div className="w-24 h-24 mb-8 relative">
                                            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping-slow"></div>
                                            <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30">
                                                <Camera size={40} className="text-white" />
                                            </div>
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-800 mb-3">Sẵn sàng AI E-KYC</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto mb-8 font-medium leading-relaxed">
                                            Vị trí của bạn đã hợp lệ ({Math.round(distance)}m). Hệ thống sẽ mở AI Camera để tiến hành xác thực sinh trắc học.
                                        </p>
                                        <button onClick={() => setStep('camera')} className="btn-primary w-full sm:w-auto px-10 py-3.5 text-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 flex items-center gap-2 justify-center">
                                            <Camera size={20} />
                                            Mở Camera Nhận Diện
                                        </button>
                                    </div>
                                )}

                                {step === 'camera' && !loading && !attendanceComplete && (
                                    <div className="flex-1 flex flex-col items-center justify-center animate-fade-in w-full h-full">
                                        <p className="text-blue-700 text-sm font-semibold mb-4 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 flex items-center gap-2 shadow-sm">
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                                            Đưa khuôn mặt vào vùng nhận diện
                                        </p>
                                        <div className="w-full max-w-md rounded-[20px] overflow-hidden shadow-2xl shadow-slate-200/50 border-4 border-white bg-black">
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
                                    </div>
                                )}

                                {(loading || (step === 'camera' && attendanceComplete)) && step !== 'success' && (
                                    <div className="flex flex-col items-center justify-center flex-1 py-12 text-center animate-fade-in">
                                        <div className="relative w-24 h-24 mb-8">
                                            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping"></div>
                                            <div className="relative w-full h-full bg-slate-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
                                                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-blue-400/20 to-transparent animate-scan"></div>
                                                <Fingerprint size={40} className="text-blue-500" />
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Đang phân tích sinh trắc</h3>
                                        <p className="text-slate-500 text-sm font-medium">Hệ thống AI đang so khớp khuôn mặt...</p>
                                    </div>
                                )}

                                {cameraFeedback?.type === 'error' && !loading && !attendanceComplete && step === 'camera' && (
                                    <div className="flex flex-col items-center justify-center flex-1 py-10 text-center animate-fade-in">
                                        <div className="w-20 h-20 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                            <AlertCircle size={40} className="text-red-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-800 mb-2">Lỗi xác thực</h3>
                                        <p className="text-red-700 font-medium bg-red-50 px-5 py-3 rounded-xl mb-8 max-w-sm border border-red-100 shadow-sm">
                                            {cameraFeedback.message}
                                        </p>

                                        {cameraFeedback.message?.includes('chưa đăng ký') ? (
                                            <div className="flex gap-3 w-full max-w-xs flex-col sm:flex-row">
                                                <button onClick={() => navigate('/face-enrollment')} className="btn-primary flex-1 shadow-lg shadow-blue-500/20">
                                                    Đăng ký ngay
                                                </button>
                                                <button onClick={() => { setCameraFeedback(null); setStep('confirm') }} className="btn-secondary flex-1 bg-white border-slate-200 text-slate-600 hover:bg-slate-50">
                                                    Hủy bỏ
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setCameraFeedback(null); setStep('confirm') }} className="btn-primary flex items-center gap-2 shadow-lg shadow-blue-500/20">
                                                Thử lại lần nữa
                                                <ChevronRight size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {step === 'success' && successInfo && (
                                    <div className="flex flex-col items-center justify-center flex-1 py-8 text-center animate-fade-in-up">
                                        <div className="relative w-28 h-28 mx-auto mb-8">
                                            <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping-slow"></div>
                                            <div className="absolute inset-2 bg-emerald-50 rounded-full animate-pulse-slow"></div>
                                            <div className="relative w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 border-4 border-white">
                                                <Check size={50} className="text-white" strokeWidth={3} />
                                            </div>
                                        </div>

                                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100/50 rounded-2xl p-6 w-full max-w-sm relative overflow-hidden shadow-sm">
                                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white blur-2xl rounded-full opacity-60"></div>
                                            
                                            <p className="text-emerald-700 text-sm font-bold tracking-wider uppercase mb-2">
                                                {successInfo.type === 'CHECK_IN' ? 'Check-in Thành Công' : 'Check-out Thành Công'}
                                            </p>
                                            <p className="text-2xl font-black text-slate-800 mb-1">
                                                {successInfo.userName}
                                            </p>
                                            <div className="flex items-center justify-center gap-2 text-slate-600 mt-4 bg-white/60 py-2 rounded-lg font-medium border border-emerald-100/30">
                                                <Clock size={16} className="text-emerald-500" />
                                                <span className="font-mono text-lg">{successInfo.time}</span>
                                            </div>
                                        </div>

                                        <p className="text-slate-500 mt-6 text-sm font-medium">
                                            {successInfo.type === 'CHECK_IN'
                                                ? 'Chúc bạn một ngày làm việc tràn đầy năng lượng!'
                                                : 'Cảm ơn bạn đã làm việc chăm chỉ. Hẹn gặp lại ngày mai!'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-1.5 rounded-[28px] overflow-hidden relative bg-gradient-to-br from-emerald-50/50 to-teal-50/50 h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="bg-white/80 backdrop-blur-xl rounded-[22px] p-8 h-full flex flex-col items-center justify-center text-center border border-white relative shadow-inner">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-blue-50/30"></div>
                                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 mb-8 relative z-10 border-4 border-white">
                                    <CheckCircle2 size={48} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-extrabold text-slate-800 mb-3 relative z-10">Tuyệt vời, nhiệm vụ hoàn tất!</h2>
                                <p className="text-slate-500 max-w-sm relative z-10 font-medium leading-relaxed">Bạn đã thực hiện đầy đủ Check-in và Check-out cho ngày làm việc hôm nay. Chúc bạn có thời gian nghỉ ngơi thư giãn vui vẻ.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Status & History */}
                <div className="lg:col-span-5 space-y-6">
                    {/* Today Status Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`p-6 rounded-[24px] relative overflow-hidden transition-all duration-500 ${todayStatus?.checked_in 
                            ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 shadow-md shadow-emerald-100' 
                            : 'bg-white/70 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl'}`}>
                            
                            {todayStatus?.checked_in && <div className="absolute -right-4 -top-4 w-24 h-24 bg-white blur-2xl rounded-full opacity-60"></div>}
                            
                            <p className="text-sm font-bold tracking-wide text-slate-500 mb-4 flex items-center gap-1.5 uppercase">
                                <MapPin size={16} className={todayStatus?.checked_in ? "text-emerald-500" : "text-slate-400"} />
                                Vào (Check-in)
                            </p>
                            
                            {todayStatus?.checkin_time ? (
                                <div className="relative z-10">
                                    <p className="text-4xl font-mono font-black text-slate-800 mb-3">
                                        {format(new Date(todayStatus.checkin_time), 'HH:mm')}
                                    </p>
                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-3 py-1.5 rounded-full shadow-sm ${
                                        todayStatus.checkin_status === 'ON_TIME' 
                                            ? 'bg-white text-emerald-600 border border-emerald-100' 
                                            : 'bg-white text-amber-500 border border-amber-100'
                                    }`}>
                                        {todayStatus.checkin_status === 'ON_TIME' ? <Check size={14} strokeWidth={3}/> : <AlertCircle size={14} strokeWidth={3}/>}
                                        {todayStatus.checkin_status === 'ON_TIME' ? 'Đúng giờ' : 'Đi muộn'}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-4xl font-mono font-black text-slate-300">--:--</p>
                            )}
                        </div>

                        <div className={`p-6 rounded-[24px] relative overflow-hidden transition-all duration-500 ${todayStatus?.checked_out 
                            ? 'bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100 shadow-md shadow-indigo-100' 
                            : 'bg-white/70 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl'}`}>
                            
                            {todayStatus?.checked_out && <div className="absolute -right-4 -top-4 w-24 h-24 bg-white blur-2xl rounded-full opacity-60"></div>}
                            
                            <p className="text-sm font-bold tracking-wide text-slate-500 mb-4 flex items-center gap-1.5 uppercase">
                                <Clock size={16} className={todayStatus?.checked_out ? "text-indigo-500" : "text-slate-400"} />
                                Ra (Check-out)
                            </p>
                            
                            {todayStatus?.checkout_time ? (
                                <div className="relative z-10">
                                    <p className="text-4xl font-mono font-black text-slate-800 mb-3">
                                        {format(new Date(todayStatus.checkout_time), 'HH:mm')}
                                    </p>
                                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase px-3 py-1.5 rounded-full shadow-sm ${
                                        todayStatus.checkout_status === 'ON_TIME' 
                                            ? 'bg-white text-indigo-600 border border-indigo-100' 
                                            : 'bg-white text-orange-500 border border-orange-100'
                                    }`}>
                                        {todayStatus.checkout_status === 'ON_TIME' ? <Check size={14} strokeWidth={3}/> : <AlertCircle size={14} strokeWidth={3}/>}
                                        {todayStatus.checkout_status === 'ON_TIME' ? 'Đúng giờ' : 'Về sớm'}
                                    </span>
                                </div>
                            ) : (
                                <p className="text-4xl font-mono font-black text-slate-300">--:--</p>
                            )}
                        </div>
                    </div>

                    {/* History Logs */}
                    <div className="bg-white/80 p-6 rounded-[24px] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl flex flex-col h-[420px]">
                        <h2 className="text-lg font-extrabold mb-5 flex items-center justify-between text-slate-800">
                            Lịch sử hoạt động
                            <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-slate-500 shadow-sm">10 Lượt gần nhất</span>
                        </h2>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                            {attendanceLogs.slice(0, 10).map(log => (
                                <div key={log.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-100 rounded-[18px] transition-all group shadow-sm hover:shadow-md">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-sm ${
                                            log.type === 'CHECK_IN' ? 'bg-emerald-50 border-emerald-100 text-emerald-500' : 'bg-indigo-50 border-indigo-100 text-indigo-500'
                                        }`}>
                                            {log.type === 'CHECK_IN' ? <MapPin size={20}/> : <Clock size={20}/>}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                                                {log.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'}
                                            </p>
                                            <p className="text-xs text-slate-500 font-mono mt-1 font-medium">
                                                {format(new Date(log.timestamp), 'dd/MM/yyyy • HH:mm')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full border shadow-sm ${
                                        log.status === 'ON_TIME' 
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        log.status === 'LATE' 
                                            ? 'bg-rose-50 text-rose-500 border-rose-100' : 
                                            'bg-amber-50 text-amber-500 border-amber-100'
                                    }`}>
                                        {log.status === 'ON_TIME' ? 'Đúng giờ' :
                                         log.status === 'LATE' ? 'Đi muộn' : 'Về sớm'}
                                    </span>
                                </div>
                            ))}
                            {attendanceLogs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-10">
                                    <CalendarIcon size={48} className="mb-4 opacity-20" />
                                    <p className="font-medium text-slate-500">Chưa có dữ liệu chấm công</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out forwards;
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-pulse-slow {
                    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                .animate-ping-slow {
                    animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                .animate-scan {
                    animation: scan 2.5s linear infinite;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(200%); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    )
}

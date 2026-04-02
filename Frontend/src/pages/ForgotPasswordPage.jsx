import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Webcam from 'react-webcam';
import { 
    KeyRound, ChevronLeft, Camera, Upload, CheckCircle2, 
    Mail, ShieldAlert, Image as ImageIcon, AlertCircle, Loader2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STEPS = {
    FORM: 'form',
    CAPTURE_FACE: 'capture_face',
    CAPTURE_CCCD_FRONT: 'capture_cccd_front',
    CAPTURE_CCCD_BACK: 'capture_cccd_back',
    REVIEW: 'review',
    SUCCESS: 'success',
};

function dataURLtoFile(dataURL, filename) {
    const [header, data] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const binary = atob(data);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new File([arr], filename, { type: mime });
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ─── Reusable CCCD Step (camera + upload) ───────────────────────────────────
function CccdStep({ title, tip, onCapture, onBack }) {
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null);
    const [mode, setMode] = useState('camera'); // 'camera' | 'upload'
    const [preview, setPreview] = useState(null);

    const handleCapture = () => {
        const img = webcamRef.current?.getScreenshot();
        if (!img) { 
            toast.error('Không chụp được ảnh, thử lại'); 
            return; 
        }
        setPreview(img);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { 
            toast.error('Vui lòng chọn file ảnh (jpg, png, ...)'); 
            return; 
        }
        if (file.size > 10 * 1024 * 1024) { 
            toast.error('File ảnh không được vượt quá 10MB'); 
            return; 
        }
        const dataURL = await fileToDataURL(file);
        setPreview(dataURL);
    };

    const handleConfirm = () => {
        if (!preview) { 
            toast.error('Vui lòng chụp hoặc chọn ảnh'); 
            return; 
        }
        onCapture(preview);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 justify-center mb-6 text-indigo-600 bg-indigo-50 py-2 px-4 rounded-full w-max mx-auto border border-indigo-100">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-sm font-medium">{tip}</span>
            </div>

            {/* Mode toggle */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-xl mb-6 shadow-inner ring-1 ring-slate-200/50">
                <button
                    onClick={() => { setMode('camera'); setPreview(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                        mode === 'camera' 
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <Camera className="w-4 h-4" /> Chụp camera
                </button>
                <button
                    onClick={() => { setMode('upload'); setPreview(null); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
                        mode === 'upload' 
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                    }`}
                >
                    <Upload className="w-4 h-4" /> Tải ảnh lên
                </button>
            </div>

            {/* Preview area */}
            {preview ? (
                <div className="relative mb-6 rounded-2xl overflow-hidden shadow-lg border-4 border-white group">
                    <img
                        src={preview}
                        alt="preview"
                        className="w-full object-cover max-h-[300px] bg-slate-50 transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <button
                        onClick={() => setPreview(null)}
                        className="absolute top-4 right-4 bg-white/90 hover:bg-red-500 hover:text-white text-slate-700 backdrop-blur-md rounded-full w-8 h-8 flex items-center justify-center transition-all duration-300 shadow-lg"
                    >
                        ✕
                    </button>
                </div>
            ) : mode === 'camera' ? (
                <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-slate-900 mb-6 aspect-video relative">
                    <Webcam
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                        videoConstraints={{ facingMode: 'environment' }}
                    />
                    <div className="absolute inset-0 pointer-events-none border-[3px] border-indigo-500/30 rounded-xl m-4 border-dashed" />
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl p-10 text-center cursor-pointer mb-6 transition-all duration-300 group"
                >
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                        <ImageIcon className="w-8 h-8 text-indigo-500" />
                    </div>
                    <p className="text-indigo-900 font-semibold mb-1">Nhấn để chọn ảnh</p>
                    <p className="text-slate-500 text-sm">JPG, PNG, WEBP (tối đa 10MB)</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-8">
                <button
                    onClick={onBack}
                    className="flex-1 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-sm transition-all duration-200 hover:shadow"
                >
                    ← Quay lại
                </button>

                {!preview && mode === 'camera' && (
                    <button
                        onClick={handleCapture}
                        className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                        📷 Chụp ảnh
                    </button>
                )}

                {!preview && mode === 'upload' && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                        📁 Chọn file
                    </button>
                )}

                {preview && (
                    <button
                        onClick={handleConfirm}
                        className="flex-[2] py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                        ✅ Dùng ảnh này
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
    const [step, setStep] = useState(STEPS.FORM);
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [facePhoto, setFacePhoto] = useState(null);
    const [cccdFront, setCccdFront] = useState(null);
    const [cccdBack, setCccdBack] = useState(null);
    const [loading, setLoading] = useState(false);
    const webcamFaceRef = useRef(null);

    const validateEmail = () => {
        if (!email.trim()) { setEmailError('Vui lòng nhập email'); return false; }
        if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Email không hợp lệ'); return false; }
        setEmailError(''); return true;
    };

    const captureAndNextFace = () => {
        const img = webcamFaceRef.current?.getScreenshot();
        if (!img) { toast.error('Không chụp được ảnh, vui lòng thử lại'); return; }
        setFacePhoto(img); setStep(STEPS.CAPTURE_CCCD_FRONT);
    };

    const handleSubmit = async () => {
        if (!facePhoto || !cccdFront || !cccdBack) { 
            toast.error('Thiếu ảnh xác minh'); 
            return; 
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('email', email);
            formData.append('face_photo', dataURLtoFile(facePhoto, 'face.jpg'));
            formData.append('cccd_front', dataURLtoFile(cccdFront, 'cccd_front.jpg'));
            formData.append('cccd_back', dataURLtoFile(cccdBack, 'cccd_back.jpg'));
            
            await axios.post(`${API_URL}/api/password-reset/request`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setStep(STEPS.SUCCESS);
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Gửi yêu cầu thất bại, vui lòng thử lại');
        } finally { 
            setLoading(false); 
        }
    };

    const STEP_LIST = [STEPS.FORM, STEPS.CAPTURE_FACE, STEPS.CAPTURE_CCCD_FRONT, STEPS.CAPTURE_CCCD_BACK, STEPS.REVIEW];

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 font-sans relative overflow-hidden"
             style={{ backgroundImage: 'radial-gradient(circle at top right, #eef2ff, #f8fafc, #f1f5f9)' }}>
            
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

            <Toaster position="top-center" />

            <div className="w-full max-w-lg bg-white/80 backdrop-blur-2xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-8 md:p-10 relative z-10">
                
                {/* Header */}
                {step !== STEPS.SUCCESS && (
                    <div className="text-center mb-8 animate-in slide-in-from-top-4 duration-500">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center mx-auto mb-5 rotate-3 hover:rotate-0 transition-transform duration-300">
                            <KeyRound className="text-white w-8 h-8" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Khôi phục mật khẩu</h1>
                        <p className="text-slate-500 mt-2 text-sm font-medium">Hoàn thành xác thực để gửi yêu cầu tới HR</p>
                    </div>
                )}

                {/* Progress Indicator */}
                {step !== STEPS.SUCCESS && (
                    <div className="flex justify-between items-center mb-10 relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-slate-100 -z-10" />
                        
                        {['Email', 'Khuôn mặt', 'CCCD trước', 'CCCD sau', 'Xác nhận'].map((label, i) => {
                            const idx = STEP_LIST.indexOf(step);
                            const done = i < idx;
                            const active = i === idx;
                            
                            return (
                                <div key={i} className="flex flex-col items-center gap-2 relative">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all duration-300 ${
                                        done ? 'bg-emerald-500 text-white shadow-emerald-200' 
                                        : active ? 'bg-indigo-600 text-white shadow-indigo-200 ring-4 ring-indigo-50' 
                                        : 'bg-white border-2 border-slate-200 text-slate-400'
                                    }`}>
                                        {done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                                    </div>
                                    <span className={`text-[11px] font-semibold tracking-wide absolute -bottom-6 w-max ${
                                        active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-slate-400'
                                    }`}>
                                        {label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-8">
                    {/* ── STEP 1: Email ── */}
                    {step === STEPS.FORM && (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                                    Email công ty
                                </label>
                                <div className="relative flex items-center">
                                    <Mail className="absolute left-4 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email" 
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                                        placeholder="timcook@company.com"
                                        className={`w-full pl-11 pr-4 py-3.5 bg-slate-50 border rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all duration-200 shadow-sm ${
                                            emailError ? 'border-red-300 focus:ring-red-200 bg-red-50/50' : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 focus:bg-white'
                                        }`}
                                    />
                                </div>
                                {emailError && (
                                    <p className="flex items-center gap-1.5 text-red-500 text-[13px] mt-2 ml-1 font-medium animate-in slide-in-from-top-1">
                                        <AlertCircle className="w-4 h-4" /> {emailError}
                                    </p>
                                )}
                            </div>

                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 mb-8 text-sm text-indigo-900/80 shadow-sm">
                                <p className="font-semibold mb-3 text-indigo-900 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> Để xác minh, bạn cần chuẩn bị:
                                </p>
                                <ul className="space-y-3 font-medium">
                                    <li className="flex items-start gap-2">
                                        <div className="mt-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-500 text-xs shadow-indigo-100">1</div>
                                        <span>Chụp ảnh khuôn mặt hiện tại</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="mt-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm text-indigo-500 text-xs shadow-indigo-100">2</div>
                                        <span>Căn cước công dân (Mặt trước & sau) bằng cách chụp hoặc tải ảnh lên.</span>
                                    </li>
                                </ul>
                            </div>

                            <button
                                onClick={() => validateEmail() && setStep(STEPS.CAPTURE_FACE)}
                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex justify-center items-center gap-2"
                            >
                                Bắt đầu xác minh
                            </button>
                        </div>
                    )}

                    {/* ── STEP 2: Face ── */}
                    {step === STEPS.CAPTURE_FACE && (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="flex items-center gap-2 justify-center mb-6 text-emerald-600 bg-emerald-50 py-2 px-4 rounded-full w-max mx-auto border border-emerald-100">
                                <ShieldAlert className="w-4 h-4" />
                                <span className="text-sm font-medium">Nhìn thẳng vào camera, giữ mặt rõ ràng</span>
                            </div>

                            {facePhoto ? (
                                <div className="relative mb-8 rounded-2xl overflow-hidden shadow-lg border-4 border-white group">
                                    <img src={facePhoto} alt="face" className="w-full object-cover max-h-[300px] transition-transform duration-500 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    <button
                                        onClick={() => setFacePhoto(null)}
                                        className="absolute top-4 right-4 bg-white/90 hover:bg-red-500 hover:text-white text-slate-700 backdrop-blur-md rounded-full w-8 h-8 flex items-center justify-center transition-all duration-300 shadow-lg"
                                    >✕</button>
                                </div>
                            ) : (
                                <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-slate-900 mb-8 aspect-[4/3] relative">
                                    <Webcam
                                        ref={webcamFaceRef}
                                        screenshotFormat="image/jpeg"
                                        className="w-full h-full object-cover block"
                                        videoConstraints={{ facingMode: 'user' }}
                                    />
                                    {/* Face Overlay Guide */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-[60%] h-[70%] border-2 border-dashed border-emerald-400/60 rounded-[100px] shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setStep(STEPS.FORM); setFacePhoto(null); }}
                                    className="flex-1 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-sm transition-all duration-200"
                                >
                                    Quay lại
                                </button>

                                {!facePhoto ? (
                                    <button
                                        onClick={captureAndNextFace}
                                        className="flex-[2] py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex justify-center items-center gap-2"
                                    >
                                        <Camera className="w-5 h-5" /> Chụp tự sướng
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setStep(STEPS.CAPTURE_CCCD_FRONT)}
                                        className="flex-[2] py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex justify-center items-center gap-2"
                                    >
                                        <CheckCircle2 className="w-5 h-5" /> Dùng ảnh này
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3 & 4: CCCD ── */}
                    {step === STEPS.CAPTURE_CCCD_FRONT && (
                        <CccdStep
                            title="Mặt trước CCCD"
                            tip="Chụp mặt TRƯỚC của CCCD/CMND"
                            onCapture={img => { setCccdFront(img); setStep(STEPS.CAPTURE_CCCD_BACK); }}
                            onBack={() => setStep(STEPS.CAPTURE_FACE)}
                        />
                    )}

                    {step === STEPS.CAPTURE_CCCD_BACK && (
                        <CccdStep
                            title="Mặt sau CCCD"
                            tip="Tiếp tục chụp mặt SAU của CCCD/CMND"
                            onCapture={img => { setCccdBack(img); setStep(STEPS.REVIEW); }}
                            onBack={() => setStep(STEPS.CAPTURE_CCCD_FRONT)}
                        />
                    )}

                    {/* ── STEP 5: Review ── */}
                    {step === STEPS.REVIEW && (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                            <div className="bg-amber-50 text-amber-600 font-medium p-3 rounded-xl mb-6 text-sm flex items-center justify-center gap-2 border border-amber-100">
                                <AlertCircle className="w-4 h-4" /> Kiểm tra lại thông tin cẩn thận trước khi nộp
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-6">
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Email khôi phục</p>
                                        <p className="text-slate-800 font-bold truncate">{email}</p>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Khuôn mặt', src: facePhoto },
                                        { label: 'CCCD Trước', src: cccdFront },
                                        { label: 'CCCD Sau',   src: cccdBack },
                                    ].map(({ label, src }) => (
                                        <div key={label} className="text-center group">
                                            <div className="relative rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm mb-2 aspect-square group-hover:border-indigo-300 transition-colors">
                                                <img src={src} alt={label} className="w-full h-full object-cover" />
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase">{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setStep(STEPS.CAPTURE_CCCD_BACK)}
                                    className="flex-1 py-4 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-sm transition-all duration-200"
                                >
                                    Sửa lại
                                </button>
                                <button
                                    onClick={handleSubmit} 
                                    disabled={loading}
                                    className="flex-[2] py-4 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-lg shadow-slate-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Đang xử lý...</>
                                    ) : (
                                        <><CheckCircle2 className="w-5 h-5" /> Gửi yêu cầu ngay</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 6: Success ── */}
                    {step === STEPS.SUCCESS && (
                        <div className="text-center py-6 animate-in zoom-in-95 duration-500">
                            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative">
                                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-20"></div>
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 relative z-10" />
                            </div>
                            <h2 className="text-2xl font-extrabold text-slate-800 mb-3">Gửi yêu cầu thành công!</h2>
                            <p className="text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
                                Yêu cầu cấp lại mật khẩu cho tài khoản <strong className="text-slate-800 break-all">{email}</strong> đã được gửi thành công. Bộ phận HR sẽ đối chiếu và duyệt trong thời gian sớm nhất.
                            </p>
                            
                            <Link 
                                to="/login" 
                                className="block w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all duration-300"
                            >
                                Quay về trang đăng nhập
                            </Link>
                        </div>
                    )}
                </div>

                {/* Back to login */}
                {step !== STEPS.SUCCESS && (
                    <div className="mt-8 text-center">
                        <Link 
                            to="/login" 
                            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 text-sm font-semibold transition-colors duration-200"
                        >
                            <ChevronLeft className="w-4 h-4" /> Trở lại Trang Đăng Nhập
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Webcam from 'react-webcam'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STEPS = {
    FORM: 'form',
    CAPTURE_FACE: 'capture_face',
    CAPTURE_CCCD_FRONT: 'capture_cccd_front',
    CAPTURE_CCCD_BACK: 'capture_cccd_back',
    REVIEW: 'review',
    SUCCESS: 'success',
}

function dataURLtoFile(dataURL, filename) {
    const [header, data] = dataURL.split(',')
    const mime = header.match(/:(.*?);/)[1]
    const binary = atob(data)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
    return new File([arr], filename, { type: mime })
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => resolve(e.target.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

// ─── Reusable CCCD Step (camera + upload) ───────────────────────────────────
function CccdStep({ title, tip, onCapture, onBack }) {
    const webcamRef = useRef(null)
    const fileInputRef = useRef(null)
    const [mode, setMode] = useState('camera') // 'camera' | 'upload'
    const [preview, setPreview] = useState(null)
    const [error, setError] = useState('')

    const handleCapture = () => {
        const img = webcamRef.current?.getScreenshot()
        if (!img) { setError('Không chụp được ảnh, thử lại'); return }
        setPreview(img)
        setError('')
    }

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { setError('Vui lòng chọn file ảnh (jpg, png, ...)'); return }
        if (file.size > 10 * 1024 * 1024) { setError('File ảnh không được vượt quá 10MB'); return }
        const dataURL = await fileToDataURL(file)
        setPreview(dataURL)
        setError('')
    }

    const handleConfirm = () => {
        if (!preview) { setError('Vui lòng chụp hoặc chọn ảnh'); return }
        onCapture(preview)
    }

    const btnBase = {
        padding: '10px 20px', borderRadius: '10px', border: 'none',
        cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s',
    }

    return (
        <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>💡 {tip}</p>

            {/* Mode toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '4px', marginBottom: '16px' }}>
                {[
                    { key: 'camera', icon: '📷', label: 'Chụp camera' },
                    { key: 'upload', icon: '📁', label: 'Upload file' },
                ].map(({ key, icon, label }) => (
                    <button
                        key={key}
                        onClick={() => { setMode(key); setPreview(null); setError('') }}
                        style={{
                            ...btnBase, flex: 1,
                            background: mode === key ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                            color: mode === key ? '#fff' : '#94a3b8',
                        }}
                    >{icon} {label}</button>
                ))}
            </div>

            {/* Preview area */}
            {preview ? (
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                    <img
                        src={preview}
                        alt="preview"
                        style={{
                            width: '100%', borderRadius: '14px',
                            border: '2px solid rgba(99,102,241,0.5)',
                            display: 'block', objectFit: 'cover', maxHeight: '220px',
                        }}
                    />
                    <button
                        onClick={() => setPreview(null)}
                        style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                            color: '#fff', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px',
                        }}
                    >✕</button>
                </div>
            ) : mode === 'camera' ? (
                <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(99,102,241,0.4)', marginBottom: '16px' }}>
                    <Webcam
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        style={{ width: '100%', display: 'block' }}
                        videoConstraints={{ facingMode: 'environment' }}
                    />
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        border: '2px dashed rgba(99,102,241,0.4)', borderRadius: '16px',
                        padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                        marginBottom: '16px', transition: 'border-color 0.2s',
                        background: 'rgba(99,102,241,0.04)',
                    }}
                    onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.8)'}
                    onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
                >
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
                    <p style={{ color: '#a5b4fc', fontWeight: 600, margin: '0 0 6px' }}>Nhấn để chọn ảnh</p>
                    <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>JPG, PNG, WEBP — tối đa 10MB</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </div>
            )}

            {error && <p style={{ color: '#f87171', textAlign: 'center', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    onClick={onBack}
                    style={{ ...btnBase, flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1' }}
                >← Quay lại</button>

                {!preview && mode === 'camera' && (
                    <button
                        onClick={handleCapture}
                        style={{ ...btnBase, flex: 2, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
                    >📷 Chụp ảnh</button>
                )}

                {!preview && mode === 'upload' && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{ ...btnBase, flex: 2, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
                    >📁 Chọn file</button>
                )}

                {preview && (
                    <button
                        onClick={handleConfirm}
                        style={{ ...btnBase, flex: 2, background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: '#fff' }}
                    >✅ Dùng ảnh này</button>
                )}
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
    const [step, setStep] = useState(STEPS.FORM)
    const [email, setEmail] = useState('')
    const [emailError, setEmailError] = useState('')
    const [facePhoto, setFacePhoto] = useState(null)
    const [cccdFront, setCccdFront] = useState(null)
    const [cccdBack, setCccdBack] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const webcamFaceRef = useRef(null)
    const [faceError, setFaceError] = useState('')

    const validateEmail = () => {
        if (!email.trim()) { setEmailError('Vui lòng nhập email'); return false }
        if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Email không hợp lệ'); return false }
        setEmailError(''); return true
    }

    const captureAndNextFace = () => {
        const img = webcamFaceRef.current?.getScreenshot()
        if (!img) { setFaceError('Không chụp được ảnh, vui lòng thử lại'); return }
        setFacePhoto(img); setFaceError(''); setStep(STEPS.CAPTURE_CCCD_FRONT)
    }

    const handleSubmit = async () => {
        if (!facePhoto || !cccdFront || !cccdBack) { setError('Thiếu ảnh xác minh'); return }
        setLoading(true); setError('')
        try {
            const formData = new FormData()
            formData.append('email', email)
            formData.append('face_photo', dataURLtoFile(facePhoto, 'face.jpg'))
            formData.append('cccd_front', dataURLtoFile(cccdFront, 'cccd_front.jpg'))
            formData.append('cccd_back', dataURLtoFile(cccdBack, 'cccd_back.jpg'))
            await axios.post(`${API_URL}/api/password-reset/request`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            setStep(STEPS.SUCCESS)
        } catch (err) {
            setError(err.response?.data?.detail || 'Gửi yêu cầu thất bại, vui lòng thử lại')
        } finally { setLoading(false) }
    }

    // ── common styles ──
    const card = {
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
        padding: '40px', width: '100%', maxWidth: '480px',
    }

    const STEP_LIST = [STEPS.FORM, STEPS.CAPTURE_FACE, STEPS.CAPTURE_CCCD_FRONT, STEPS.CAPTURE_CCCD_BACK, STEPS.REVIEW]

    return (
        <div className="min-h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
            <div style={card}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 14px', fontSize: '26px',
                    }}>🔑</div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>Quên mật khẩu</h1>
                    <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px' }}>Gửi yêu cầu cấp lại mật khẩu cho HR xét duyệt</p>
                </div>

                {/* Progress steps */}
                {step !== STEPS.SUCCESS && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
                        {['Email', 'Khuôn mặt', 'CCCD trước', 'CCCD sau', 'Xác nhận'].map((label, i) => {
                            const idx = STEP_LIST.indexOf(step)
                            const done = i < idx, active = i === idx
                            return (
                                <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{
                                        width: '26px', height: '26px', borderRadius: '50%', margin: '0 auto 4px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px', fontWeight: 700, transition: 'all 0.3s',
                                        background: done ? '#22c55e' : active ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.1)',
                                        color: (done || active) ? '#fff' : '#64748b',
                                    }}>{done ? '✓' : i + 1}</div>
                                    <p style={{ fontSize: '10px', color: active ? '#a5b4fc' : done ? '#86efac' : '#475569', margin: 0 }}>{label}</p>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ── STEP 1: Email ── */}
                {step === STEPS.FORM && (
                    <div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                                📧 Email tài khoản
                            </label>
                            <input
                                type="email" value={email}
                                onChange={e => { setEmail(e.target.value); setEmailError('') }}
                                placeholder="email@company.com"
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.07)',
                                    border: emailError ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.12)',
                                    color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                            {emailError && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '6px' }}>{emailError}</p>}
                        </div>
                        <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.7, marginBottom: '24px' }}>
                            Bước tiếp theo, bạn cần:<br />
                            📷 Chụp ảnh khuôn mặt qua camera<br />
                            🪪 CCCD — có thể <strong style={{ color: '#a5b4fc' }}>chụp camera hoặc upload ảnh</strong> từ máy
                        </p>
                        <button
                            onClick={() => { if (validateEmail()) setStep(STEPS.CAPTURE_FACE) }}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff', fontWeight: 600, fontSize: '15px', border: 'none', cursor: 'pointer',
                            }}
                        >Tiếp tục →</button>
                    </div>
                )}

                {/* ── STEP 2: Face (camera only) ── */}
                {step === STEPS.CAPTURE_FACE && (
                    <div>
                        <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>
                            💡 Nhìn thẳng vào camera, giữ mặt rõ ràng trong khung hình
                        </p>

                        {facePhoto ? (
                            <div style={{ marginBottom: '16px', position: 'relative' }}>
                                <img src={facePhoto} alt="face" style={{
                                    width: '100%', borderRadius: '14px',
                                    border: '2px solid rgba(34,197,94,0.5)', display: 'block', objectFit: 'cover', maxHeight: '240px',
                                }} />
                                <button
                                    onClick={() => setFacePhoto(null)}
                                    style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                                        color: '#fff', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px',
                                    }}
                                >✕</button>
                            </div>
                        ) : (
                            <div style={{ borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(99,102,241,0.5)', marginBottom: '16px' }}>
                                <Webcam
                                    ref={webcamFaceRef}
                                    screenshotFormat="image/jpeg"
                                    style={{ width: '100%', display: 'block' }}
                                    videoConstraints={{ facingMode: 'user' }}
                                />
                            </div>
                        )}

                        {faceError && <p style={{ color: '#f87171', textAlign: 'center', fontSize: '13px', marginBottom: '12px' }}>{faceError}</p>}

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => { setStep(STEPS.FORM); setFacePhoto(null) }}
                                style={{
                                    flex: 1, padding: '13px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#cbd5e1', cursor: 'pointer', fontWeight: 500,
                                }}
                            >← Quay lại</button>

                            {!facePhoto ? (
                                <button
                                    onClick={captureAndNextFace}
                                    style={{
                                        flex: 2, padding: '13px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer',
                                    }}
                                >📷 Chụp ảnh</button>
                            ) : (
                                <button
                                    onClick={() => setStep(STEPS.CAPTURE_CCCD_FRONT)}
                                    style={{
                                        flex: 2, padding: '13px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                                        color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer',
                                    }}
                                >✅ Dùng ảnh này</button>
                            )}
                        </div>
                    </div>
                )}

                {/* ── STEP 3: CCCD Front ── */}
                {step === STEPS.CAPTURE_CCCD_FRONT && (
                    <CccdStep
                        title="CCCD – Mặt trước"
                        tip="Đặt CCCD phẳng, đủ sáng, không bị lóa"
                        onCapture={img => { setCccdFront(img); setStep(STEPS.CAPTURE_CCCD_BACK) }}
                        onBack={() => setStep(STEPS.CAPTURE_FACE)}
                    />
                )}

                {/* ── STEP 4: CCCD Back ── */}
                {step === STEPS.CAPTURE_CCCD_BACK && (
                    <CccdStep
                        title="CCCD – Mặt sau"
                        tip="Lật mặt sau CCCD, giữ nguyên như mặt trước"
                        onCapture={img => { setCccdBack(img); setStep(STEPS.REVIEW) }}
                        onBack={() => setStep(STEPS.CAPTURE_CCCD_FRONT)}
                    />
                )}

                {/* ── STEP 5: Review ── */}
                {step === STEPS.REVIEW && (
                    <div>
                        <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '18px' }}>
                            Kiểm tra lại ảnh trước khi gửi
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                            {[
                                { label: '🤳 Khuôn mặt', src: facePhoto },
                                { label: '📄 CCCD trước', src: cccdFront },
                                { label: '📄 CCCD sau',   src: cccdBack },
                            ].map(({ label, src }) => (
                                <div key={label} style={{ textAlign: 'center' }}>
                                    <img src={src} alt={label} style={{
                                        width: '100%', borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        aspectRatio: '1', objectFit: 'cover',
                                    }} />
                                    <p style={{ color: '#94a3b8', fontSize: '10px', marginTop: '5px' }}>{label}</p>
                                </div>
                            ))}
                        </div>
                        <div style={{
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '10px', padding: '10px 14px', marginBottom: '18px',
                        }}>
                            <p style={{ color: '#a5b4fc', fontSize: '13px', margin: 0 }}>
                                ✉️ Email: <strong style={{ color: '#fff' }}>{email}</strong>
                            </p>
                        </div>
                        {error && <p style={{ color: '#f87171', textAlign: 'center', marginBottom: '12px', fontSize: '13px' }}>{error}</p>}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setStep(STEPS.CAPTURE_CCCD_BACK)}
                                style={{
                                    flex: 1, padding: '13px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: '#cbd5e1', cursor: 'pointer', fontWeight: 500,
                                }}
                            >← Chụp lại</button>
                            <button
                                onClick={handleSubmit} disabled={loading}
                                style={{
                                    flex: 2, padding: '13px', borderRadius: '12px',
                                    background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff', fontWeight: 600, border: 'none',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                }}
                            >{loading ? '⏳ Đang gửi...' : '✅ Gửi yêu cầu'}</button>
                        </div>
                    </div>
                )}

                {/* ── STEP 6: Success ── */}
                {step === STEPS.SUCCESS && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '60px', marginBottom: '14px' }}>🎉</div>
                        <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: '10px' }}>Đã gửi yêu cầu!</h2>
                        <p style={{ color: '#94a3b8', lineHeight: 1.7, marginBottom: '24px' }}>
                            Yêu cầu cấp lại mật khẩu đã được gửi tới HR.<br />
                            Vui lòng chờ HR xét duyệt.
                        </p>
                        <div style={{
                            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                            borderRadius: '12px', padding: '14px', marginBottom: '22px',
                        }}>
                            <p style={{ color: '#86efac', margin: 0, fontSize: '14px' }}>
                                📧 HR sẽ liên hệ qua email <strong>{email}</strong>
                            </p>
                        </div>
                        <Link to="/login" style={{
                            display: 'block', padding: '14px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff', fontWeight: 600, textDecoration: 'none', textAlign: 'center',
                        }}>← Quay lại đăng nhập</Link>
                    </div>
                )}

                {/* Back to login */}
                {step !== STEPS.SUCCESS && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <Link to="/login" style={{ color: '#6366f1', fontSize: '14px', textDecoration: 'none' }}>
                            ← Quay lại đăng nhập
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}

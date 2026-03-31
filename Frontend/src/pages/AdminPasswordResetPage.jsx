import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_LABELS = {
    PENDING:  { label: 'Chờ duyệt',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    APPROVED: { label: 'Đã duyệt',   color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
    REJECTED: { label: 'Từ chối',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
}

export default function AdminPasswordResetPage() {
    const { token } = useAuth()
    const headers = { Authorization: `Bearer ${token}` }

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('PENDING')
    const [selected, setSelected] = useState(null)
    const [newPassword, setNewPassword] = useState('')
    const [rejectReason, setRejectReason] = useState('')
    const [actionLoading, setActionLoading] = useState(false)
    const [previewImg, setPreviewImg] = useState(null)

    const fetchRequests = async () => {
        setLoading(true)
        try {
            const params = filterStatus ? { status: filterStatus } : {}
            const { data } = await axios.get(`${API_URL}/api/password-reset/requests`, { headers, params })
            setRequests(data)
        } catch {
            toast.error('Không tải được danh sách yêu cầu')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchRequests() }, [filterStatus])

    const handleApprove = async () => {
        if (!newPassword.trim()) { toast.error('Vui lòng nhập mật khẩu mới'); return }
        if (newPassword.length < 6) { toast.error('Mật khẩu phải ít nhất 6 ký tự'); return }
        setActionLoading(true)
        try {
            await axios.put(`${API_URL}/api/password-reset/requests/${selected.id}/approve`,
                { new_password: newPassword }, { headers })
            toast.success('✅ Đã duyệt và cập nhật mật khẩu mới')
            setSelected(null)
            setNewPassword('')
            fetchRequests()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Lỗi khi duyệt')
        } finally {
            setActionLoading(false)
        }
    }

    const handleReject = async () => {
        setActionLoading(true)
        try {
            await axios.put(`${API_URL}/api/password-reset/requests/${selected.id}/reject`,
                { reason: rejectReason || 'Yêu cầu bị từ chối' }, { headers })
            toast.success('Đã từ chối yêu cầu')
            setSelected(null)
            setRejectReason('')
            fetchRequests()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Lỗi khi từ chối')
        } finally {
            setActionLoading(false)
        }
    }

    const formatDate = (iso) => {
        if (!iso) return '—'
        const d = new Date(iso)
        return d.toLocaleString('vi-VN')
    }

    return (
        <div style={{ padding: '24px', color: '#e2e8f0' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>🔑 Yêu cầu cấp lại mật khẩu</h1>
                <p style={{ color: '#64748b', marginTop: '6px' }}>Xét duyệt yêu cầu đặt lại mật khẩu từ nhân viên</p>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {[
                    { label: '⏳ Chờ duyệt', value: 'PENDING' },
                    { label: '✅ Đã duyệt',  value: 'APPROVED' },
                    { label: '❌ Từ chối',   value: 'REJECTED' },
                    { label: '🔍 Tất cả',    value: '' },
                ].map(({ label, value }) => (
                    <button
                        key={value}
                        onClick={() => setFilterStatus(value)}
                        style={{
                            padding: '8px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                            background: filterStatus === value
                                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                : 'rgba(255,255,255,0.06)',
                            color: filterStatus === value ? '#fff' : '#94a3b8',
                            fontWeight: 500, fontSize: '14px', transition: 'all 0.2s',
                        }}
                    >{label}</button>
                ))}
            </div>

            {/* Table */}
            <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>⏳ Đang tải...</div>
                ) : requests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>Không có yêu cầu nào</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                {['Nhân viên', 'Email', 'Phòng ban', 'Ngày gửi', 'Trạng thái', 'Hành động'].map(h => (
                                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((req, i) => {
                                const st = STATUS_LABELS[req.status] || STATUS_LABELS.PENDING
                                return (
                                    <tr key={req.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                    }}>
                                        <td style={{ padding: '14px 16px', fontWeight: 500 }}>{req.full_name || '—'}</td>
                                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>{req.email}</td>
                                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>{req.department || '—'}</td>
                                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>{formatDate(req.created_at)}</td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{
                                                padding: '4px 12px', borderRadius: '20px',
                                                background: st.bg, color: st.color, fontSize: '12px', fontWeight: 600,
                                            }}>{st.label}</span>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <button
                                                onClick={() => setSelected(req)}
                                                style={{
                                                    padding: '7px 16px', borderRadius: '8px', border: 'none',
                                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    color: '#fff', cursor: 'pointer', fontSize: '13px',
                                                }}
                                            >Xem chi tiết</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Detail Modal ── */}
            {selected && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px',
                }} onClick={e => e.target === e.currentTarget && setSelected(null)}>
                    <div style={{
                        background: '#1e293b', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)',
                        padding: '32px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Chi tiết yêu cầu</h2>
                                <p style={{ color: '#64748b', marginTop: '4px', fontSize: '13px' }}>ID: {selected.id}</p>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}
                            >✕</button>
                        </div>

                        {/* Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                            {[
                                ['👤 Họ tên', selected.full_name || '—'],
                                ['📧 Email', selected.email],
                                ['🏢 Phòng ban', selected.department || '—'],
                                ['📅 Ngày gửi', formatDate(selected.created_at)],
                            ].map(([label, val]) => (
                                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 16px' }}>
                                    <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
                                    <p style={{ margin: 0, fontWeight: 500 }}>{val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Photos */}
                        <p style={{ color: '#94a3b8', fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>📸 Ảnh xác minh</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '28px' }}>
                            {[
                                { label: '🤳 Khuôn mặt', url: selected.face_photo_url },
                                { label: '📄 CCCD mặt trước', url: selected.cccd_front_url },
                                { label: '📄 CCCD mặt sau', url: selected.cccd_back_url },
                            ].map(({ label, url }) => (
                                <div key={label} style={{ textAlign: 'center' }}>
                                    <img
                                        src={`${API_URL}${url}`}
                                        alt={label}
                                        onClick={() => setPreviewImg(`${API_URL}${url}`)}
                                        style={{
                                            width: '100%', aspectRatio: '1', objectFit: 'cover',
                                            borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                                            cursor: 'zoom-in', transition: 'transform 0.2s',
                                        }}
                                        onMouseOver={e => e.target.style.transform = 'scale(1.03)'}
                                        onMouseOut={e => e.target.style.transform = 'scale(1)'}
                                    />
                                    <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Actions – only for PENDING */}
                        {selected.status === 'PENDING' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                {/* Approve */}
                                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', padding: '16px' }}>
                                    <p style={{ color: '#86efac', fontWeight: 600, marginBottom: '10px' }}>✅ Duyệt yêu cầu</p>
                                    <input
                                        type="password"
                                        placeholder="Mật khẩu mới (≥6 ký tự)"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#fff', outline: 'none', marginBottom: '10px', boxSizing: 'border-box',
                                        }}
                                    />
                                    <button
                                        onClick={handleApprove}
                                        disabled={actionLoading}
                                        style={{
                                            width: '100%', padding: '10px', borderRadius: '8px',
                                            background: actionLoading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg, #16a34a, #22c55e)',
                                            color: '#fff', fontWeight: 600, border: 'none',
                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                        }}
                                    >{actionLoading ? 'Đang xử lý...' : 'Xác nhận duyệt'}</button>
                                </div>

                                {/* Reject */}
                                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '16px' }}>
                                    <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '10px' }}>❌ Từ chối yêu cầu</p>
                                    <input
                                        type="text"
                                        placeholder="Lý do từ chối (tuỳ chọn)"
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        style={{
                                            width: '100%', padding: '10px 14px', borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#fff', outline: 'none', marginBottom: '10px', boxSizing: 'border-box',
                                        }}
                                    />
                                    <button
                                        onClick={handleReject}
                                        disabled={actionLoading}
                                        style={{
                                            width: '100%', padding: '10px', borderRadius: '8px',
                                            background: actionLoading ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #b91c1c, #ef4444)',
                                            color: '#fff', fontWeight: 600, border: 'none',
                                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                                        }}
                                    >{actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}</button>
                                </div>
                            </div>
                        )}

                        {/* Already processed */}
                        {selected.status !== 'PENDING' && (
                            <div style={{
                                background: STATUS_LABELS[selected.status]?.bg,
                                border: `1px solid ${STATUS_LABELS[selected.status]?.color}40`,
                                borderRadius: '12px', padding: '16px',
                            }}>
                                <p style={{ color: STATUS_LABELS[selected.status]?.color, fontWeight: 600, margin: '0 0 6px' }}>
                                    {STATUS_LABELS[selected.status]?.label}
                                </p>
                                {selected.reviewed_by && <p style={{ color: '#94a3b8', margin: '0 0 4px', fontSize: '14px' }}>Người duyệt: {selected.reviewed_by}</p>}
                                {selected.reason && <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Lý do: {selected.reason}</p>}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Image Preview Lightbox ── */}
            {previewImg && (
                <div
                    onClick={() => setPreviewImg(null)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000, cursor: 'zoom-out',
                    }}
                >
                    <img src={previewImg} alt="preview" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
                </div>
            )}
        </div>
    )
}

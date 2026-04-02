import { useState, useEffect } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { Key, CheckCircle2, XCircle, Search, Mail, Building2, Calendar as CalendarIcon, User, Camera, Image as ImageIcon } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_LABELS = {
    PENDING:  { label: 'Chờ duyệt',  color: 'text-amber-600', bg: 'bg-amber-100/50', border: 'border-amber-200' },
    APPROVED: { label: 'Đã duyệt',   color: 'text-emerald-600', bg: 'bg-emerald-100/50', border: 'border-emerald-200' },
    REJECTED: { label: 'Từ chối',    color: 'text-rose-600', bg: 'bg-rose-100/50', border: 'border-rose-200' },
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
            toast.success('Đã duyệt và cấp mật khẩu mới')
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
        return d.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-card p-6 border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                        <Key size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Yêu cầu cấp mật khẩu</h1>
                        <p className="text-slate-500 font-medium">Xét duyệt các yêu cầu quên mật khẩu từ nhân viên</p>
                    </div>
                </div>
            </div>

            {/* Filter tags */}
            <div className="flex gap-3">
                {[
                    { label: 'Chờ duyệt', value: 'PENDING', icon: Search },
                    { label: 'Đã duyệt',  value: 'APPROVED', icon: CheckCircle2 },
                    { label: 'Từ chối',   value: 'REJECTED', icon: XCircle },
                    { label: 'Tất cả',    value: '', icon: Key },
                ].map(({ label, value, icon: Icon }) => {
                    const isActive = filterStatus === value;
                    return (
                        <button
                            key={value}
                            onClick={() => setFilterStatus(value)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 border ${
                                isActive 
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-md shadow-indigo-500/20' 
                                : 'bg-white/60 text-slate-600 border-slate-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200'
                            }`}
                        >
                            <Icon size={16} />
                            {label}
                        </button>
                    )
                })}
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden border border-slate-200">
                {loading ? (
                    <div className="flex justify-center py-20"><div className="spinner"></div></div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Key size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-slate-500 text-lg">Không có yêu cầu nào</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-200">
                                    {['Nhân viên', 'Liên hệ', 'Phòng ban', 'Thời gian', 'Trạng thái', 'Thao tác'].map(h => (
                                        <th key={h} className="text-left py-4 px-6 text-slate-600 font-bold text-xs uppercase tracking-wider">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {requests.map((req) => {
                                    const st = STATUS_LABELS[req.status] || STATUS_LABELS.PENDING
                                    return (
                                        <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                                        {req.full_name?.[0] || '?'}
                                                    </div>
                                                    <span className="font-bold text-slate-700">{req.full_name || '—'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 font-medium text-slate-600">{req.email}</td>
                                            <td className="py-4 px-6">
                                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">{req.department || '—'}</span>
                                            </td>
                                            <td className="py-4 px-6 text-sm font-medium text-slate-500">{formatDate(req.created_at)}</td>
                                            <td className="py-4 px-6">
                                                <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${st.bg} ${st.color} ${st.border} shadow-sm inline-flex items-center gap-1`}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                <button
                                                    onClick={() => setSelected(req)}
                                                    className="btn-primary text-xs py-2 px-4 shadow-md shadow-indigo-500/20"
                                                >
                                                    Chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal Chi Tiết (White Glassmorphism) ── */}
            {selected && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={e => e.target === e.currentTarget && setSelected(null)}
                >
                    <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-8 w-full max-w-4xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white max-h-[95vh] overflow-y-auto">
                        
                        {/* Header Modal */}
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                                    <Search size={28} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Kiểm tra thông tin</h2>
                                    <p className="text-slate-500 text-sm font-medium mt-1">ID Yêu cầu: <span className="font-mono text-slate-400">{selected.id}</span></p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                            >
                                <XCircle size={28} />
                            </button>
                        </div>

                        {/* Thông tin Text */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            {[
                                { icon: User, label: 'Nhân viên yêu cầu', val: selected.full_name || '—' },
                                { icon: Mail, label: 'Email tài khoản', val: selected.email },
                                { icon: Building2, label: 'Phòng ban hiện tại', val: selected.department || '—' },
                                { icon: CalendarIcon, label: 'Thời gian gửi', val: formatDate(selected.created_at) },
                            ].map(({ icon: Icon, label, val }) => (
                                <div key={label} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4">
                                    <div className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm border border-slate-100"><Icon size={20} /></div>
                                    <div>
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                                        <p className="text-slate-800 font-semibold">{val}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Hình ảnh */}
                        <div className="mb-8">
                            <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
                                <Camera size={20} className="text-indigo-500" /> Dữ liệu hình ảnh đối chiếu
                            </h3>
                            <div className="grid grid-cols-3 gap-6">
                                {[
                                    { title: 'Ảnh chân dung trực tiếp', url: selected.face_photo_url },
                                    { title: 'CCCD - Mặt trước', url: selected.cccd_front_url },
                                    { title: 'CCCD - Mặt sau', url: selected.cccd_back_url },
                                ].map(({ title, url }) => (
                                    <div key={title} className="group relative bg-slate-50 rounded-2xl p-2 border border-slate-200">
                                        <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors rounded-2xl z-10 cursor-zoom-in" onClick={() => setPreviewImg(`${API_URL}${url}`)} />
                                        <img
                                            src={`${API_URL}${url}`}
                                            alt={title}
                                            className="w-full aspect-[4/3] object-cover rounded-xl shadow-sm bg-slate-200"
                                            onError={(e) => { e.target.src = 'https://placehold.co/400x300/e2e8f0/64748b?text=Không+có+ảnh' }}
                                        />
                                        <div className="p-3 text-center">
                                            <p className="text-slate-700 font-semibold text-sm">{title}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Khối Hành động (Duyệt / Từ chối) */}
                        {selected.status === 'PENDING' && (
                            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200">
                                {/* CARD DUYỆT */}
                                <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-6 relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 text-emerald-100"><CheckCircle2 size={100} /></div>
                                    <div className="relative z-10">
                                        <h3 className="text-emerald-800 font-bold text-lg mb-4 flex items-center gap-2">
                                            <div className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg"><CheckCircle2 size={18}/></div>
                                            Chấp thuận & Cấp mật khẩu
                                        </h3>
                                        <div className="space-y-3">
                                            <input
                                                type="password"
                                                placeholder="Nhập mật khẩu mới (Tối thiểu 6 ký tự)"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full bg-white border-emerald-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium placeholder:text-slate-400 shadow-sm"
                                            />
                                            <button
                                                onClick={handleApprove}
                                                disabled={actionLoading}
                                                className={`w-full py-3 rounded-xl font-bold text-white shadow-md shadow-emerald-500/20 transition-all ${
                                                    actionLoading ? 'bg-emerald-300 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg hover:-translate-y-0.5'
                                                }`}
                                            >
                                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận cấp mới'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* CARD TỪ CHỐI */}
                                <div className="bg-rose-50/50 border border-rose-100 rounded-3xl p-6 relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 text-rose-100"><XCircle size={100} /></div>
                                    <div className="relative z-10">
                                        <h3 className="text-rose-800 font-bold text-lg mb-4 flex items-center gap-2">
                                            <div className="bg-rose-100 text-rose-600 p-1.5 rounded-lg"><XCircle size={18}/></div>
                                            Từ chối yêu cầu
                                        </h3>
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                placeholder="Lý do từ chối (Không hợp lệ, ảnh mờ...)"
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                className="w-full bg-white border-rose-200 text-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-rose-500/20 font-medium placeholder:text-slate-400 shadow-sm"
                                            />
                                            <button
                                                onClick={handleReject}
                                                disabled={actionLoading}
                                                className={`w-full py-3 rounded-xl font-bold text-white shadow-md shadow-rose-500/20 transition-all ${
                                                    actionLoading ? 'bg-rose-300 cursor-not-allowed' : 'bg-gradient-to-r from-rose-500 to-red-500 hover:shadow-lg hover:-translate-y-0.5'
                                                }`}
                                            >
                                                {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Đã xử lý state */}
                        {selected.status !== 'PENDING' && (
                            <div className={`mt-6 p-6 rounded-2xl border ${STATUS_LABELS[selected.status].bg} ${STATUS_LABELS[selected.status].border}`}>
                                <p className={`font-bold text-lg mb-2 flex items-center gap-2 ${STATUS_LABELS[selected.status].color}`}>
                                    {selected.status === 'APPROVED' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                                    Trạng thái: {STATUS_LABELS[selected.status].label}
                                </p>
                                <div className="space-y-1 text-sm font-medium">
                                    {selected.reviewed_by && <p className="text-slate-600">Người xét duyệt: <span className="text-slate-800">{selected.reviewed_by}</span></p>}
                                    {selected.reason && <p className="text-slate-600">Ghi chú/Lý do: <span className="text-slate-800">{selected.reason}</span></p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Xem ảnh phóng to */}
            {previewImg && (
                <div
                    onClick={() => setPreviewImg(null)}
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[2000] cursor-zoom-out p-8"
                >
                    <img 
                        src={previewImg} 
                        alt="Zoomed preview" 
                        className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain border border-white/10" 
                        onError={(e) => { e.target.src = 'https://placehold.co/800x600/e2e8f0/64748b?text=Không+có+ảnh' }}
                    />
                </div>
            )}
        </div>
    )
}

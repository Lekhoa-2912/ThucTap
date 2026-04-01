import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { leaveAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

const LEAVE_TYPES = [
    { value: 'ANNUAL',      label: 'Nghỉ phép năm',  color: 'bg-blue-100 text-blue-700' },
    { value: 'SICK',        label: 'Nghỉ ốm',         color: 'bg-green-100 text-green-700' },
    { value: 'PERSONAL',    label: 'Việc riêng',       color: 'bg-purple-100 text-purple-700' },
    { value: 'MATERNITY',   label: 'Thai sản',         color: 'bg-pink-100 text-pink-700' },
    { value: 'WEDDING',     label: 'Nghỉ cưới',        color: 'bg-yellow-100 text-yellow-700' },
    { value: 'BEREAVEMENT', label: 'Nghỉ tang',        color: 'bg-slate-100 text-slate-700' },
    { value: 'UNPAID',      label: 'Không lương',      color: 'bg-orange-100 text-orange-700' },
]

const STATUS_CONFIG = {
    PENDING:   { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    APPROVED:  { label: 'Đã duyệt',  color: 'bg-green-100 text-green-700 border-green-300' },
    REJECTED:  { label: 'Từ chối',   color: 'bg-red-100 text-red-700 border-red-300' },
    CANCELLED: { label: 'Đã hủy',    color: 'bg-slate-100 text-slate-600 border-slate-300' },
}

const getLeaveTypeInfo = (type) => LEAVE_TYPES.find(t => t.value === type) || LEAVE_TYPES[0]

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
    return (
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${cfg.color}`}>
            {cfg.label}
        </span>
    )
}

const LeaveTypeBadge = ({ type }) => {
    const cfg = getLeaveTypeInfo(type)
    return <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
}

// =====================================================================
// ADMIN VIEW — Quản lý nghỉ phép
// =====================================================================
function AdminLeavesView() {
    const [activeTab, setActiveTab] = useState('pending')
    const [stats, setStats] = useState(null)
    const [allLeaves, setAllLeaves] = useState([])
    const [pendingLeaves, setPendingLeaves] = useState([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState('')
    const [filterYear, setFilterYear] = useState(new Date().getFullYear())
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [selectedLeave, setSelectedLeave] = useState(null)
    const [rejectReason, setRejectReason] = useState('')

    const currentYear = new Date().getFullYear()
    const years = [currentYear, currentYear - 1, currentYear - 2]

    useEffect(() => { loadData() }, [activeTab, filterStatus, filterYear])

    const loadData = async () => {
        setLoading(true)
        try {
            if (activeTab === 'pending') {
                const [pendingRes, statsRes] = await Promise.all([
                    leaveAPI.getPendingLeaves(),
                    leaveAPI.getLeaveStats(filterYear),
                ])
                setPendingLeaves(pendingRes.data)
                setStats(statsRes.data)
            } else {
                const [allRes, statsRes] = await Promise.all([
                    leaveAPI.getAllLeaves(filterStatus || undefined, undefined, filterYear),
                    leaveAPI.getLeaveStats(filterYear),
                ])
                setAllLeaves(allRes.data)
                setStats(statsRes.data)
            }
        } catch (err) {
            toast.error('Không tải được dữ liệu nghỉ phép')
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (leaveId) => {
        try {
            await leaveAPI.approveLeave(leaveId)
            toast.success('✓ Đã duyệt đơn nghỉ phép!')
            loadData()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Duyệt thất bại')
        }
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return }
        try {
            await leaveAPI.rejectLeave(selectedLeave.id, rejectReason)
            toast.success('Đã từ chối đơn')
            setShowRejectModal(false)
            setRejectReason('')
            setSelectedLeave(null)
            loadData()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Từ chối thất bại')
        }
    }

    const openReject = (leave) => { setSelectedLeave(leave); setShowRejectModal(true) }

    const displayLeaves = activeTab === 'pending' ? pendingLeaves : allLeaves

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Quản lý nghỉ phép</h1>
                <p className="text-slate-500 mt-1">Thống kê và duyệt đơn nghỉ phép nhân viên</p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Tổng đơn', value: stats.total ?? 0, color: 'border-l-slate-400', text: 'text-slate-700' },
                        { label: 'Chờ duyệt', value: stats.pending ?? 0, color: 'border-l-yellow-400', text: 'text-yellow-600' },
                        { label: 'Đã duyệt', value: stats.approved ?? 0, color: 'border-l-green-400', text: 'text-green-600' },
                        { label: 'Từ chối', value: stats.rejected ?? 0, color: 'border-l-red-400', text: 'text-red-600' },
                    ].map(s => (
                        <div key={s.label} className={`glass-card p-4 border-l-4 ${s.color}`}>
                            <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
                            <p className="text-sm text-slate-500 mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter + Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {[
                        { id: 'pending', label: `⏳ Chờ duyệt${pendingLeaves.length > 0 ? ` (${pendingLeaves.length})` : ''}` },
                        { id: 'all',     label: '📋 Tất cả đơn' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-white shadow text-blue-700'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                    {/* Year filter */}
                    <select
                        value={filterYear}
                        onChange={e => setFilterYear(Number(e.target.value))}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    {/* Status filter (only in all-tab) */}
                    {activeTab === 'all' && (
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Tất cả trạng thái</option>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="spinner" />
                    </div>
                ) : displayLeaves.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">📋</p>
                        <p className="text-slate-400">
                            {activeTab === 'pending' ? 'Không có đơn nào chờ duyệt' : 'Không có đơn nghỉ phép nào'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Nhân viên</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Loại</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Thời gian</th>
                                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Số ngày</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Lý do</th>
                                    {activeTab === 'all' && (
                                        <th className="text-center py-3 px-4 font-semibold text-slate-600">Trạng thái</th>
                                    )}
                                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayLeaves.map(leave => (
                                    <tr key={leave.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                                        {/* Employee */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                    {leave.user?.name?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800">{leave.user?.name}</p>
                                                    {leave.user?.department && (
                                                        <p className="text-xs text-slate-400">{leave.user.department}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {/* Type */}
                                        <td className="py-3 px-4">
                                            <LeaveTypeBadge type={leave.leave_type} />
                                        </td>
                                        {/* Date range */}
                                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                            {format(new Date(leave.start_date), 'dd/MM/yyyy')}
                                            {leave.start_date !== leave.end_date && (
                                                <> → {format(new Date(leave.end_date), 'dd/MM/yyyy')}</>
                                            )}
                                        </td>
                                        {/* Days */}
                                        <td className="py-3 px-4 text-center font-semibold text-slate-700">
                                            {leave.days}{leave.half_day ? ' (½)' : ''}
                                        </td>
                                        {/* Reason */}
                                        <td className="py-3 px-4 text-slate-500 max-w-xs">
                                            <p className="truncate" title={leave.reason}>{leave.reason}</p>
                                            {leave.rejected_reason && (
                                                <p className="text-xs text-red-500 mt-0.5">↳ {leave.rejected_reason}</p>
                                            )}
                                        </td>
                                        {/* Status badge (only in all tab) */}
                                        {activeTab === 'all' && (
                                            <td className="py-3 px-4 text-center">
                                                <StatusBadge status={leave.status} />
                                            </td>
                                        )}
                                        {/* Actions */}
                                        <td className="py-3 px-4">
                                            {(leave.status === 'PENDING' || activeTab === 'pending') && leave.status === 'PENDING' ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => handleApprove(leave.id)}
                                                        className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        ✓ Duyệt
                                                    </button>
                                                    <button
                                                        onClick={() => openReject(leave)}
                                                        className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        ✕ Từ chối
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 block text-center">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* By-type breakdown */}
            {stats?.by_type && Object.keys(stats.by_type).length > 0 && (
                <div className="glass-card p-5">
                    <h3 className="font-semibold text-slate-700 mb-4">📊 Thống kê theo loại ({filterYear})</h3>
                    <div className="flex flex-wrap gap-3">
                        {LEAVE_TYPES.map(lt => {
                            const count = stats.by_type[lt.value] || 0
                            if (count === 0) return null
                            return (
                                <div key={lt.value} className={`px-4 py-2 rounded-xl ${lt.color} flex items-center gap-2`}>
                                    <span className="font-semibold text-lg">{count}</span>
                                    <span className="text-sm">{lt.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedLeave && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Từ chối đơn nghỉ phép</h3>
                        <p className="text-slate-500 mb-4 text-sm">
                            Đơn của: <strong className="text-slate-700">{selectedLeave.user?.name}</strong>
                        </p>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Lý do từ chối *</label>
                        <textarea
                            autoFocus
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 h-24 resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            placeholder="Nhập lý do từ chối..."
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => { setShowRejectModal(false); setRejectReason('') }}
                                className="flex-1 btn-secondary"
                            >Hủy</button>
                            <button
                                onClick={handleReject}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                            >Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// =====================================================================
// EMPLOYEE VIEW — Đơn nghỉ phép của tôi
// =====================================================================
function EmployeeLeavesView() {
    const [myLeaves, setMyLeaves] = useState([])
    const [summary, setSummary] = useState({ total_used: 0, annual_quota: 12, remaining: 12 })
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newLeave, setNewLeave] = useState({
        leave_type: 'ANNUAL', start_date: '', end_date: '', reason: '', half_day: false
    })

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await leaveAPI.getMyLeaves()
            setMyLeaves(res.data.leaves)
            setSummary(res.data.summary)
        } catch {
            toast.error('Không tải được đơn nghỉ phép')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async () => {
        if (!newLeave.start_date || !newLeave.end_date || !newLeave.reason.trim()) {
            toast.error('Vui lòng nhập đầy đủ thông tin'); return
        }
        try {
            await leaveAPI.createLeave(newLeave)
            toast.success('Đã gửi đơn xin nghỉ phép!')
            setShowCreateModal(false)
            setNewLeave({ leave_type: 'ANNUAL', start_date: '', end_date: '', reason: '', half_day: false })
            loadData()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Gửi đơn thất bại')
        }
    }

    const handleCancel = async (leaveId) => {
        if (!confirm('Bạn có chắc muốn hủy đơn này?')) return
        try {
            await leaveAPI.cancelLeave(leaveId)
            toast.success('Đã hủy đơn')
            loadData()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Hủy đơn thất bại')
        }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Nghỉ phép</h1>
                    <p className="text-slate-500">Quản lý đơn xin nghỉ phép của bạn</p>
                </div>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">+ Tạo đơn nghỉ</button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Tổng ngày phép', value: summary.annual_quota, color: 'text-blue-600' },
                    { label: 'Đã sử dụng',     value: summary.total_used,  color: 'text-orange-600' },
                    { label: 'Còn lại',         value: summary.remaining,   color: 'text-green-600' },
                ].map(s => (
                    <div key={s.label} className="glass-card p-4 text-center">
                        <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-sm text-slate-500 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Leave list */}
            <div className="glass-card overflow-hidden">
                {myLeaves.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-3">🌴</p>
                        <p className="text-slate-400">Chưa có đơn nghỉ phép nào</p>
                        <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4 text-sm">
                            + Tạo đơn đầu tiên
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Loại</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Thời gian</th>
                                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Số ngày</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Lý do</th>
                                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Trạng thái</th>
                                    <th className="text-center py-3 px-4 font-semibold text-slate-600">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myLeaves.map(leave => (
                                    <tr key={leave.id} className="border-t border-slate-100 hover:bg-slate-50">
                                        <td className="py-3 px-4"><LeaveTypeBadge type={leave.leave_type} /></td>
                                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                            {format(new Date(leave.start_date), 'dd/MM/yyyy')}
                                            {leave.start_date !== leave.end_date && (
                                                <> → {format(new Date(leave.end_date), 'dd/MM/yyyy')}</>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center font-semibold text-slate-700">{leave.days}</td>
                                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{leave.reason}</td>
                                        <td className="py-3 px-4 text-center">
                                            <StatusBadge status={leave.status} />
                                            {leave.status === 'REJECTED' && leave.rejected_reason && (
                                                <p className="text-xs text-red-500 mt-1" title={leave.rejected_reason}>
                                                    Lý do: {leave.rejected_reason.substring(0, 40)}...
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {leave.status === 'PENDING' && (
                                                <button
                                                    onClick={() => handleCancel(leave.id)}
                                                    className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                                                >Hủy</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold text-slate-800">Tạo đơn xin nghỉ phép</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Loại nghỉ phép</label>
                                <select
                                    value={newLeave.leave_type}
                                    onChange={e => setNewLeave({ ...newLeave, leave_type: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày *</label>
                                    <input
                                        type="date"
                                        value={newLeave.start_date}
                                        onChange={e => setNewLeave({ ...newLeave, start_date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày *</label>
                                    <input
                                        type="date"
                                        value={newLeave.end_date}
                                        onChange={e => setNewLeave({ ...newLeave, end_date: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newLeave.half_day}
                                    onChange={e => setNewLeave({ ...newLeave, half_day: e.target.checked })}
                                    className="rounded"
                                />
                                <span className="text-sm text-slate-600">Nghỉ nửa ngày</span>
                            </label>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Lý do *</label>
                                <textarea
                                    value={newLeave.reason}
                                    onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Nhập lý do xin nghỉ..."
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary">Hủy</button>
                            <button onClick={handleCreate} className="flex-1 btn-primary">Gửi đơn</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// =====================================================================
// ROOT — Route to correct view based on role
// =====================================================================
export default function LeavesPage() {
    const { hasRole } = useAuth()
    const isAdmin = hasRole(['SUPER_ADMIN', 'HR_MANAGER'])

    return isAdmin ? <AdminLeavesView /> : <EmployeeLeavesView />
}

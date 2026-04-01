import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { projectAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format, differenceInDays } from 'date-fns'
import { Upload, FileText, X, Download } from 'lucide-react'

const PRIORITY_CONFIG = {
    URGENT: { label: 'Khẩn cấp', color: 'bg-red-500/20 text-red-400 border-red-500/40',       dot: 'bg-red-500' },
    HIGH:   { label: 'Cao',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', dot: 'bg-orange-500' },
    MEDIUM: { label: 'Trung bình',color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',dot: 'bg-yellow-500' },
    LOW:    { label: 'Thấp',     color: 'bg-green-500/20 text-green-400 border-green-500/40',  dot: 'bg-green-500' },
}

const STATUS_CONFIG = {
    ASSIGNED:    { label: 'Chờ nhận',   color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    IN_PROGRESS: { label: 'Đang làm',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    COMPLETED:   { label: 'Hoàn thành', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    REJECTED:    { label: 'Từ chối',    color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    TODO:        { label: 'Mới',        color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

function DeadlineLabel({ deadline }) {
    if (!deadline) return null
    const d = new Date(deadline)
    const days = differenceInDays(d, new Date())
    let cls = 'text-slate-400 bg-slate-700/50'
    let icon = '📅'
    let extra = ''
    if (days < 0)       { cls = 'text-red-400 bg-red-500/10 border border-red-500/30'; icon = '⚠️'; extra = ' (Quá hạn)' }
    else if (days === 0){ cls = 'text-red-400 bg-red-500/10 border border-red-500/30'; icon = '🔥'; extra = ' (Hôm nay)' }
    else if (days <= 2) { cls = 'text-red-400 bg-red-500/10 border border-red-500/30'; icon = '🔴'; extra = ` (${days} ngày)` }
    else if (days <= 7) { cls = 'text-orange-400 bg-orange-500/10 border border-orange-500/30'; icon = '🟠'; extra = ` (${days} ngày)` }
    return (
        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${cls}`}>
            {icon} {format(d, 'dd/MM/yyyy')}{extra}
        </span>
    )
}

export default function TasksPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [tasks, setTasks] = useState([])
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [selectedTask, setSelectedTask] = useState(null)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [progressInput, setProgressInput] = useState({})
    const [savingProgress, setSavingProgress] = useState({})

    // Completion modal state
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [taskToComplete, setTaskToComplete] = useState(null)
    const [completeFile, setCompleteFile] = useState(null)
    const [completeNotes, setCompleteNotes] = useState('')
    const [completing, setCompleting] = useState(false)

    useEffect(() => { loadTasks() }, [filter])

    const loadTasks = async () => {
        setLoading(true)
        try {
            const status = filter === 'all' ? null : filter
            const response = await projectAPI.getMyTasks(status)
            setTasks(response.data)
        } catch {
            toast.error('Không tải được danh sách công việc')
        } finally {
            setLoading(false)
        }
    }

    const handleAcceptTask = async (taskId) => {
        try {
            await projectAPI.respondToTask(taskId, true)
            toast.success('✓ Đã nhận việc!')
            loadTasks()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Thao tác thất bại')
        }
    }

    const handleRejectTask = async () => {
        if (!rejectReason.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return }
        try {
            await projectAPI.respondToTask(selectedTask.id, false, rejectReason)
            toast.success('Đã từ chối task')
            setShowRejectModal(false)
            setRejectReason('')
            setSelectedTask(null)
            loadTasks()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Thao tác thất bại')
        }
    }

    const handleUpdateProgress = async (taskId, progress) => {
        if (Number(progress) === 100) {
            setTaskToComplete(tasks.find(t => t.id === taskId))
            setShowCompleteModal(true)
            return
        }
        setSavingProgress(p => ({ ...p, [taskId]: true }))
        try {
            await projectAPI.updateTaskProgress(taskId, Number(progress))
            toast.success(`Đã cập nhật tiến độ: ${progress}%`)
            loadTasks()
        } catch {
            toast.error('Cập nhật thất bại')
        } finally {
            setSavingProgress(p => ({ ...p, [taskId]: false }))
        }
    }

    const handleCompleteTask = async (e) => {
        e.preventDefault()
        if (!completeFile) {
            toast.error("Vui lòng đính kèm tập tin kết quả công việc")
            return
        }
        
        setCompleting(true)
        try {
            await projectAPI.completeTask(taskToComplete.id, completeFile, completeNotes)
            toast.success("Đã nộp bài và hoàn thành công việc")
            setShowCompleteModal(false)
            setCompleteFile(null)
            setCompleteNotes('')
            setTaskToComplete(null)
            loadTasks()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Lỗi nộp bài')
        } finally {
            setCompleting(false)
        }
    }

    const quickProgress = [25, 50, 75, 100]

    // Summary stats
    const stats = {
        total: tasks.length,
        assigned: tasks.filter(t => t.status === 'ASSIGNED').length,
        inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Công việc của tôi</h1>
                <p className="text-slate-400">Theo dõi và cập nhật tiến độ công việc</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng', value: stats.total, color: 'bg-slate-700/50' },
                    { label: 'Chờ nhận', value: stats.assigned, color: 'bg-amber-500/10 border border-amber-500/20' },
                    { label: 'Đang làm', value: stats.inProgress, color: 'bg-blue-500/10 border border-blue-500/20' },
                    { label: 'Hoàn thành', value: stats.completed, color: 'bg-green-500/10 border border-green-500/20' },
                ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm transition-all ${filter === status
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {status === 'all' ? 'Tất cả' : STATUS_CONFIG[status]?.label || status}
                        {status === 'ASSIGNED' && stats.assigned > 0 && (
                            <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">
                                {stats.assigned}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Task List */}
            <div className="space-y-4">
                {tasks.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <p className="text-5xl mb-4">✅</p>
                        <p className="text-slate-400 text-lg">Không có công việc nào</p>
                    </div>
                ) : (
                    tasks.map(task => {
                        const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM
                        const sCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.TODO
                        const curProgress = progressInput[task.id] !== undefined ? progressInput[task.id] : task.progress

                        return (
                            <div key={task.id} className="glass-card p-5 card-hover">
                                {/* Top row */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-2 mb-2">
                                            <span className={`text-xs px-1.5 py-0.5 rounded border ${pCfg.color}`}>
                                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${pCfg.dot} mr-1 align-middle`}></span>
                                                {pCfg.label}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${sCfg.color}`}>{sCfg.label}</span>
                                        </div>
                                        <h3 className="text-base font-semibold mb-1">{task.title}</h3>
                                        {task.description && (
                                            <p className="text-slate-400 text-sm line-clamp-2 mb-2">{task.description}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            {task.project_id && (
                                                <button
                                                    onClick={() => navigate(`/projects/${task.project_id}`)}
                                                    className="text-blue-400 hover:text-blue-300 hover:underline text-xs transition-colors"
                                                >
                                                    📁 {task.project_name}
                                                </button>
                                            )}
                                            <DeadlineLabel deadline={task.deadline} />
                                        </div>
                                    </div>

                                    {/* Actions for ASSIGNED status */}
                                    {task.status === 'ASSIGNED' && (
                                        <div className="flex flex-col gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => handleAcceptTask(task.id)}
                                                className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
                                            >✓ Nhận việc</button>
                                            <button
                                                onClick={() => { setSelectedTask(task); setShowRejectModal(true) }}
                                                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl text-sm hover:bg-red-500/20 transition-all flex items-center gap-1 justify-center"
                                            >✕ Từ chối</button>
                                        </div>
                                    )}
                                </div>

                                {/* Progress section for IN_PROGRESS tasks */}
                                {task.status === 'IN_PROGRESS' && (
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm text-slate-400 font-medium">Tiến độ</span>
                                            <span className="text-sm font-bold text-blue-400">{curProgress}%</span>
                                        </div>

                                        {/* Slider */}
                                        <div className="mb-3">
                                            <input
                                                type="range"
                                                min="0" max="100" step="5"
                                                value={curProgress}
                                                onChange={e => setProgressInput(p => ({ ...p, [task.id]: Number(e.target.value) }))}
                                                className="w-full accent-blue-500"
                                            />
                                            <div className="bg-slate-700 rounded-full h-1.5 mt-1">
                                                <div
                                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all"
                                                    style={{ width: `${curProgress}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Quick buttons + save */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {quickProgress.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setProgressInput(prev => ({ ...prev, [task.id]: p }))}
                                                    className={`text-xs px-2.5 py-1 rounded-lg transition-all ${curProgress >= p
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                                >{p}%</button>
                                            ))}
                                            <button
                                                onClick={() => handleUpdateProgress(task.id, curProgress)}
                                                disabled={savingProgress[task.id] || curProgress === task.progress}
                                                className="ml-auto btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {savingProgress[task.id] ? '...' : '💾 Lưu'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Completed progress display */}
                                {task.status === 'COMPLETED' && (
                                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-700 rounded-full h-2">
                                                <div className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full" style={{ width: '100%' }} />
                                            </div>
                                            <span className="text-xs text-green-400 font-medium">100% ✓</span>
                                        </div>
                                    </div>
                                )}

                                {/* Rejection reason */}
                                {task.status === 'REJECTED' && task.rejection_reason && (
                                    <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                        <p className="text-sm text-red-400">
                                            <strong>Lý do từ chối:</strong> {task.rejection_reason}
                                        </p>
                                    </div>
                                )}

                                {/* Show uploaded file if completed */}
                                {task.status === 'COMPLETED' && task.completion_file_name && (
                                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                                        <p className="text-sm text-slate-400 mb-2">Tập tin nộp bài:</p>
                                        <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                            <FileText className="text-blue-400" size={18} />
                                            <span className="text-sm text-slate-300 truncate font-medium flex-1">
                                                {task.completion_file_name}
                                            </span>
                                            <a
                                                href={`http://localhost:8000/api/files/${task.completion_file_id}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                                                title="Tải xuống"
                                            >
                                                <Download size={18} />
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-md p-6 border border-slate-700">
                        <h2 className="text-xl font-bold mb-4">Từ chối nhận việc</h2>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do từ chối..."
                            className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-300 focus:outline-none focus:border-blue-500 mb-4 resize-none"
                        ></textarea>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setRejectReason('')
                                }}
                                className="px-4 py-2 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
                            >Hủy</button>
                            <button
                                onClick={handleRejectTask}
                                disabled={!rejectReason.trim()}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors disabled:opacity-50"
                            >Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Complete Task File Upload Modal */}
            {showCompleteModal && taskToComplete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 flex flex-col my-8">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 rounded-t-2xl sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-100">Nộp bài & Hoàn thành</h2>
                                <p className="text-sm text-slate-400 mt-1 truncate max-w-[300px]">Task: {taskToComplete.title}</p>
                            </div>
                            <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCompleteTask} className="p-5 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Tập tin nộp bài <span className="text-red-400">*</span>
                                </label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-xl hover:border-blue-500 hover:bg-slate-800/50 transition-all group relative">
                                    <div className="space-y-2 text-center">
                                        <Upload className={`mx-auto h-10 w-10 ${completeFile ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'} transition-colors`} />
                                        <div className="flex text-sm text-slate-400 justify-center">
                                            <label className="relative cursor-pointer rounded-md font-medium text-blue-400 hover:text-blue-300 focus-within:outline-none">
                                                <span>{completeFile ? 'Chọn tệp khác' : 'Tải tệp lên'}</span>
                                                <input required type="file" className="sr-only" onChange={(e) => setCompleteFile(e.target.files[0])} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                {completeFile && (
                                    <div className="mt-3 flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 text-sm">
                                        <FileText size={18} className="flex-shrink-0" />
                                        <span className="truncate">{completeFile.name}</span>
                                        <span className="flex-shrink-0 opacity-70">({(completeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Ghi chú (Tùy chọn)</label>
                                <textarea
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 h-24 focus:outline-none focus:border-blue-500 transition-colors"
                                    placeholder="Ghi chú thêm về kết quả công việc..."
                                    value={completeNotes}
                                    onChange={(e) => setCompleteNotes(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCompleteModal(false)} className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors border border-slate-600">
                                    Hủy
                                </button>
                                <button type="submit" disabled={completing} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl text-white font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {completing ? <div className="spinner border-2 border-white w-4 h-4"></div> : <Upload size={18} />}
                                    Nộp bài
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

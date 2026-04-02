import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { projectAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format, differenceInDays } from 'date-fns'
import { Upload, FileText, X, Download } from 'lucide-react'

const PRIORITY_CONFIG = {
    URGENT: { label: 'Khẩn cấp', color: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
    HIGH:   { label: 'Cao',      color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    MEDIUM: { label: 'Trung bình',color: 'bg-amber-50 text-amber-700 border-amber-200',dot: 'bg-amber-500' },
    LOW:    { label: 'Thấp',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200',  dot: 'bg-emerald-500' },
}

const STATUS_CONFIG = {
    ASSIGNED:    { label: 'Chờ nhận',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
    IN_PROGRESS: { label: 'Đang làm',   color: 'bg-blue-50 text-blue-700 border-blue-200' },
    COMPLETED:   { label: 'Hoàn thành', color: 'bg-green-50 text-green-700 border-green-200' },
    REJECTED:    { label: 'Từ chối',    color: 'bg-red-50 text-red-700 border-red-200' },
    TODO:        { label: 'Mới',        color: 'bg-slate-50 text-slate-700 border-slate-200' },
}

function DeadlineLabel({ deadline }) {
    if (!deadline) return null
    const d = new Date(deadline)
    const days = differenceInDays(d, new Date())
    let cls = 'text-slate-600 bg-slate-50 border border-slate-200'
    let icon = '📅'
    let extra = ''
    if (days < 0)       { cls = 'text-red-700 bg-red-50 border border-red-200'; icon = '⚠️'; extra = ' (Quá hạn)' }
    else if (days === 0){ cls = 'text-red-600 bg-red-50 border border-red-200'; icon = '🔥'; extra = ' (Hôm nay)' }
    else if (days <= 2) { cls = 'text-orange-700 bg-orange-50 border border-orange-200'; icon = '🔴'; extra = ` (${days} ngày)` }
    else if (days <= 7) { cls = 'text-amber-700 bg-amber-50 border border-amber-200'; icon = '🟠'; extra = ` (${days} ngày)` }
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
                <h1 className="text-2xl font-bold text-slate-800">Công việc của tôi</h1>
                <p className="text-slate-500">Theo dõi và cập nhật tiến độ công việc</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng', value: stats.total, color: 'bg-white border border-slate-200 text-slate-800 shadow-sm' },
                    { label: 'Chờ nhận', value: stats.assigned, color: 'bg-amber-50 border border-amber-200 text-amber-800 shadow-sm' },
                    { label: 'Đang làm', value: stats.inProgress, color: 'bg-blue-50 border border-blue-200 text-blue-800 shadow-sm' },
                    { label: 'Hoàn thành', value: stats.completed, color: 'bg-green-50 border border-green-200 text-green-800 shadow-sm' },
                ].map(s => (
                    <div key={s.label} className={`${s.color} rounded-2xl p-5 text-center transition-transform hover:-translate-y-1 duration-300`}>
                        <p className="text-3xl font-extrabold">{s.value}</p>
                        <p className="text-sm font-medium opacity-80 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === status
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'}`}
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
            <div className="space-y-4 pt-2">
                {tasks.length === 0 ? (
                    <div className="glass-card p-16 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <span className="text-3xl">✅</span>
                        </div>
                        <p className="text-slate-500 text-lg font-medium">Không có công việc nào</p>
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
                                        <h3 className="text-base font-bold text-slate-800 mb-1">{task.title}</h3>
                                        {task.description && (
                                            <p className="text-slate-500 text-sm line-clamp-2 mb-3">{task.description}</p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-3 text-sm">
                                            {task.project_id && (
                                                <button
                                                    onClick={() => navigate(`/projects/${task.project_id}`)}
                                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-500 hover:underline text-xs font-medium bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg transition-colors"
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
                                     <div className="mt-5 pt-5 border-t border-slate-100">
                                         <div className="flex items-center justify-between mb-4">
                                             <div className="flex flex-col">
                                                 <span className="text-sm text-slate-500 font-medium">Tiến độ hiện tại</span>
                                                 <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 leading-none mt-1 drop-shadow-sm">{curProgress}%</span>
                                             </div>
                                             
                                             <button
                                                 onClick={() => handleUpdateProgress(task.id, curProgress)}
                                                 disabled={savingProgress[task.id] || (curProgress === task.progress && curProgress !== 100)}
                                                 className={`text-sm px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                                                     savingProgress[task.id] || (curProgress === task.progress && curProgress !== 100) 
                                                     ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200' 
                                                     : curProgress === 100
                                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/20 hover:scale-[1.02] hover:-translate-y-0.5 ring-2 ring-emerald-500/30 ring-offset-1'
                                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:scale-[1.02] hover:-translate-y-0.5'
                                                 }`}
                                             >
                                                 {savingProgress[task.id] ? <div className="spinner w-4 h-4 border-2 border-slate-400"></div> : curProgress === 100 ? '⬆️ Nộp báo cáo' : '💾 Cập nhật'}
                                             </button>
                                         </div>

                                         {/* Custom Visual Progress Bar */}
                                         <div className="relative pt-1 mb-6">
                                             <div className="flex h-3 overflow-hidden bg-slate-100/80 rounded-full shadow-inner ring-1 ring-slate-200/50">
                                                 <div
                                                     style={{ width: `${curProgress}%` }}
                                                     className="flex flex-col justify-center bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)] transition-all duration-500 ease-out"
                                                 ></div>
                                             </div>
                                         </div>

                                         {/* Quick Segmented Stepper */}
                                         <div className="flex items-center justify-between gap-1.5 p-1.5 bg-slate-50/80 rounded-xl border border-slate-200/60 shadow-sm backdrop-blur-sm">
                                             {[0, 25, 50, 75, 100].map(p => {
                                                 const isActive = curProgress >= p;
                                                 const isExact = curProgress === p;
                                                 return (
                                                     <button
                                                         key={p}
                                                         onClick={() => setProgressInput(prev => ({ ...prev, [task.id]: p }))}
                                                         className={`flex-1 relative py-2.5 text-xs font-bold rounded-lg transition-all duration-300 outline-none ${
                                                             isExact 
                                                                 ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/80 z-10 scale-[1.02] transform' 
                                                                 : isActive 
                                                                     ? 'text-blue-500 hover:text-blue-600 hover:bg-white/50' 
                                                                     : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                                         }`}
                                                     >
                                                         {p}%
                                                         {isActive && !isExact && (
                                                            <div className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-200/50 rounded-t-sm"></div> 
                                                         )}
                                                     </button>
                                                 )
                                             })}
                                         </div>
                                     </div>
                                 )}

                                 {/* Completed progress display */}
                                 {task.status === 'COMPLETED' && (
                                     <div className="mt-5 pt-5 border-t border-slate-100">
                                         <div className="flex items-center justify-between mb-3">
                                             <span className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                                                <span className="relative flex h-2.5 w-2.5 mt-0.5">
                                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                </span>
                                                Hoàn thành
                                             </span>
                                             <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">100%</span>
                                         </div>
                                         <div className="flex h-3 overflow-hidden bg-slate-100 rounded-full shadow-inner ring-1 ring-slate-200/50">
                                             <div className="w-full bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[inset_0_1px_3px_rgba(255,255,255,0.4)]" />
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
                                     <div className="mt-4 pt-4 border-t border-slate-100">
                                         <p className="text-sm font-medium text-slate-600 mb-2">Tệp kết quả nghiệm thu:</p>
                                         <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 transition-colors">
                                             <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                <FileText size={18} />
                                             </div>
                                             <span className="text-sm text-slate-700 truncate font-semibold flex-1">
                                                 {task.completion_file_name}
                                             </span>
                                             <a
                                                 href={`http://localhost:8000/api/files/${task.completion_file_id}`}
                                                 target="_blank" rel="noopener noreferrer"
                                                 className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-blue-600"
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
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card rounded-2xl w-full max-w-md p-6 border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Từ chối nhận việc</h2>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Nhập lý do từ chối (bắt buộc)..."
                            className="w-full h-32 bg-white/60 border border-slate-200 rounded-xl p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-4 resize-none shadow-sm"
                        ></textarea>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setRejectReason('')
                                }}
                                className="px-5 py-2 hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-colors font-medium"
                            >Hủy</button>
                            <button
                                onClick={handleRejectTask}
                                disabled={!rejectReason.trim()}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors disabled:opacity-50 font-medium shadow-md shadow-red-500/20"
                            >Xác nhận từ chối</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Complete Task File Upload Modal */}
            {showCompleteModal && taskToComplete && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="glass-card rounded-2xl w-full max-w-md border border-slate-200 flex flex-col my-8">
                        <div className="p-5 border-b border-slate-200/60 flex justify-between items-center bg-white/50 rounded-t-2xl sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Nộp bài & Hoàn thành</h2>
                                <p className="text-sm text-slate-500 mt-1 truncate max-w-[300px]">Task: {taskToComplete.title}</p>
                            </div>
                            <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-red-500 hover:bg-slate-50 p-2 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCompleteTask} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Tập tin nộp bài <span className="text-red-500">*</span>
                                </label>
                                <label htmlFor={`file-upload-complete-${taskToComplete.id}`} className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-blue-500 hover:bg-blue-50/50 transition-all group relative bg-white/60 cursor-pointer w-full">
                                    <div className="space-y-2 text-center pointer-events-none">
                                        <Upload className={`mx-auto h-12 w-12 ${completeFile ? 'text-blue-500' : 'text-slate-400 group-hover:text-blue-500'} transition-colors`} />
                                        <div className="flex text-sm text-slate-500 justify-center">
                                            <span className="relative font-medium text-blue-600 group-hover:text-blue-700">
                                                {completeFile ? 'Chọn tệp khác' : 'Tải file kết quả lên'}
                                            </span>
                                        </div>
                                    </div>
                                </label>
                                <input id={`file-upload-complete-${taskToComplete.id}`} required type="file" className="sr-only" onChange={(e) => setCompleteFile(e.target.files[0])} />
                                {completeFile && (
                                    <div className="mt-3 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm shadow-sm">
                                        <FileText size={18} className="flex-shrink-0" />
                                        <span className="truncate font-medium">{completeFile.name}</span>
                                        <span className="flex-shrink-0 opacity-70">({(completeFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Ghi chú (Tùy chọn)</label>
                                <textarea
                                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                                    placeholder="Ghi chú thêm về kết quả công việc, link tham khảo..."
                                    value={completeNotes}
                                    onChange={(e) => setCompleteNotes(e.target.value)}
                                ></textarea>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button type="button" onClick={() => setShowCompleteModal(false)} className="flex-1 px-4 py-2.5 bg-white hover:bg-slate-50 rounded-xl text-slate-700 font-medium transition-colors border border-slate-200 shadow-sm">
                                    Hủy
                                </button>
                                <button type="submit" disabled={completing} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-medium shadow-md shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {completing ? <div className="spinner border-2 border-white w-4 h-4"></div> : <Upload size={18} />}
                                    Hoàn tất & Nộp bài
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { projectAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format, differenceInDays } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_CONFIG = {
    PLANNING: { label: 'Lên kế hoạch', color: 'bg-slate-100 text-slate-600 border-slate-300' },
    TODO: { label: 'Chờ xử lý', color: 'bg-slate-100 text-slate-600 border-slate-300' },
    ASSIGNED: { label: 'Đã giao', color: 'bg-amber-100 text-amber-700 border-amber-300' },
    IN_PROGRESS: { label: 'Đang làm', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    ON_HOLD: { label: 'Tạm dừng', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    COMPLETED: { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    CANCELLED: { label: 'Đã hủy', color: 'bg-red-100 text-red-700 border-red-300' },
}

function Avatar({ user, size = 8 }) {
    const cls = `w-${size} h-${size} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0 border-2 border-white shadow-sm`
    if (!user) return <div className={cls}>?</div>
    return (
        <div className={cls} title={user.full_name}>
            {user.avatar
                ? <img src={`${API_URL}${user.avatar}`} className="w-full h-full object-cover" alt="" />
                : <span>{user.full_name?.[0] || '?'}</span>
            }
        </div>
    )
}

export default function ProjectDetailPage() {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const { hasRole } = useAuth()

    const [project, setProject] = useState(null)
    const [historyLogs, setHistoryLogs] = useState([])
    const [loading, setLoading] = useState(true)

    const canManage = hasRole(['SUPER_ADMIN', 'HR_MANAGER', 'LEADER'])

    useEffect(() => {
        if (projectId && projectId !== 'null') loadData()
    }, [projectId])

    const loadData = async () => {
        setLoading(true)
        try {
            // Load the standalone task/project data
            const projRes = await projectAPI.getProject(projectId)
            setProject(projRes.data)

            // Try to load history logs (since project = task)
            try {
                const histRes = await projectAPI.getTaskHistory(projectId)
                setHistoryLogs(histRes.data || [])
            } catch {
                setHistoryLogs([])
            }
        } catch {
            toast.error('Không thể tải dữ liệu công việc')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteProject = async () => {
        if (!confirm('Bạn có chắc muốn XÓA công việc này? Hồ sơ và file báo cáo sẽ bị mất vĩnh viễn.')) return
        try {
            await projectAPI.deleteProject(projectId)
            toast.success('Đã xóa dữ liệu thành công')
            navigate('/projects')
        } catch { toast.error('Xóa thất bại') }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
    if (!project) return <div className="glass-card p-12 text-center text-slate-500">Không tìm thấy công việc</div>

    const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.TODO
    const progress = project.progress || 0
    const isCompleted = project.status === 'COMPLETED' || progress === 100

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            {/* BACK BUTTON & HEADER */}
            <div className="flex items-center justify-between">
                <button onClick={() => navigate('/projects')} className="text-slate-500 hover:text-blue-600 font-medium text-sm flex items-center gap-1.5 transition-colors bg-white/50 px-4 py-2 rounded-xl shadow-sm border border-slate-200">
                    ← Quay lại danh sách
                </button>
                {canManage && (
                    <button onClick={handleDeleteProject} className="text-red-500 hover:bg-red-50 font-medium text-sm px-4 py-2 rounded-xl transition-colors">
                        Xóa công việc
                    </button>
                )}
            </div>

            {/* MAIN CARD */}
            <div className="glass-card overflow-hidden">
                <div className="p-8 border-b border-slate-100">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-extrabold text-slate-800 mb-2 leading-tight">{project.name}</h1>
                            <p className="text-slate-500">{project.description || 'Không có mô tả chi tiết cho công việc này.'}</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border font-bold text-sm shadow-sm ${statusCfg.color}`}>
                            {statusCfg.label}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-8 gap-y-4 mt-6 text-sm">
                        <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block mb-1 font-medium">Thời gian bắt đầu</span>
                            <span className="font-semibold text-slate-700">
                                {project.start_date ? format(new Date(project.start_date), 'dd/MM/yyyy') : 'Chưa định khung'}
                            </span>
                        </div>
                        <div className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                            <span className="text-slate-400 block mb-1 font-medium">Hạn chót (Deadline)</span>
                            <span className="font-bold text-slate-700">
                                {project.end_date ? format(new Date(project.end_date), 'dd/MM/yyyy') : 'Vô thời hạn'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* PROGRESS SECTION */}
                <div className="p-8 bg-gradient-to-b from-white to-slate-50">
                    <div className="flex justify-between items-end mb-3">
                        <h3 className="font-bold text-slate-700 text-lg">Tiến độ thực hiện</h3>
                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{progress}%</span>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                                progress === 100 
                                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' 
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                            }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* RESULTS & SUBMISSION SECTION */}
            {isCompleted && project.completion_file_name && (
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl shadow-emerald-500/20 overflow-hidden text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl transform translate-x-8 -translate-y-8 pointer-events-none">🎉</div>
                    <div className="p-8 relative z-10">
                        <h2 className="text-2xl font-black mb-1">🏁 Kết quả nghiệm thu</h2>
                        <p className="text-emerald-100 mb-6">Nhân viên đã hoàn thành 100% công việc và nộp báo cáo.</p>
                        
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/20">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center text-3xl shadow-inner">
                                    📁
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-1 block">Tập tin Đính kèm</span>
                                    <h4 className="font-bold text-lg truncate" title={project.completion_file_name}>
                                        {project.completion_file_name}
                                    </h4>
                                    {project.completed_at && (
                                        <p className="text-xs text-emerald-100 mt-1">Nộp lúc: {new Date(project.completed_at).toLocaleString('vi-VN')}</p>
                                    )}
                                </div>
                                <a
                                    href={`${API_URL}/api/files/${project.completion_file_id}`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="bg-white text-emerald-600 hover:bg-emerald-50 px-6 py-3 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    📥 Tải File Xuống
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* MEMBERS LEFT COL */}
                <div className="md:col-span-1 space-y-6">
                    <div className="glass-card p-6">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            👥 Nhân sự phụ trách
                        </h3>
                        {project.team_members && project.team_members.length > 0 ? (
                            <div className="space-y-3">
                                {project.team_members.map(member => (
                                    <div key={member.id} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                        <Avatar user={member} size={10} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-700 truncate">{member.full_name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-slate-100 italic">
                                Chưa phân công nhân sự
                            </div>
                        )}
                    </div>
                </div>

                {/* HISTORY RIGHT COL */}
                <div className="md:col-span-2">
                    <div className="glass-card p-6 h-full">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                            ⏳ Lịch sử hoạt động
                        </h3>
                        {historyLogs.length > 0 ? (
                            <div className="space-y-4">
                                {historyLogs.map(log => (
                                    <div key={log.id} className="relative pl-6 border-l-2 border-slate-200 last:border-transparent pb-4 last:pb-0">
                                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-500"></div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-slate-700">{log.user?.full_name || 'Nhân viên'}</span>
                                                <span className="text-xs font-semibold text-slate-400 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                                                    {new Date(log.created_at).toLocaleString('vi-VN')}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                Cập nhật tiến độ: <span className="font-bold text-blue-600">{log.old_progress}% ➔ {log.new_progress}%</span>
                                            </p>
                                            {log.note && (
                                                <div className="mt-2 p-3 bg-white rounded-lg border border-slate-100 text-sm text-slate-600 italic">
                                                    "{log.note}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                Chưa có hoạt động cập nhật nào.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

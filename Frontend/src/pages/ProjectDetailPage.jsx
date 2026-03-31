import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { projectAPI, userAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format, differenceInDays, isPast } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const KANBAN_COLUMNS = [
    { id: 'TODO',        label: 'Chờ xử lý',   color: 'bg-slate-100 dark:bg-slate-700/60',   textColor: 'text-slate-600',   dot: 'bg-slate-400' },
    { id: 'ASSIGNED',   label: 'Đã giao',       color: 'bg-amber-50 dark:bg-amber-900/20',    textColor: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-400' },
    { id: 'IN_PROGRESS',label: 'Đang làm',      color: 'bg-blue-50 dark:bg-blue-900/20',      textColor: 'text-blue-700 dark:text-blue-400',    dot: 'bg-blue-400' },
    { id: 'COMPLETED',  label: 'Hoàn thành',    color: 'bg-green-50 dark:bg-green-900/20',    textColor: 'text-green-700 dark:text-green-400',  dot: 'bg-green-400' },
]

const PRIORITY_CONFIG = {
    URGENT: { label: 'Khẩn cấp', color: 'bg-red-500/20 text-red-400 border-red-500/40',       dot: 'bg-red-500' },
    HIGH:   { label: 'Cao',      color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', dot: 'bg-orange-500' },
    MEDIUM: { label: 'TB',       color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', dot: 'bg-yellow-500' },
    LOW:    { label: 'Thấp',     color: 'bg-green-500/20 text-green-400 border-green-500/40',  dot: 'bg-green-500' },
}

const STATUS_LABELS = {
    PLANNING:    'Lên kế hoạch',
    IN_PROGRESS: 'Đang thực hiện',
    ON_HOLD:     'Tạm dừng',
    COMPLETED:   'Hoàn thành',
    CANCELLED:   'Đã hủy',
}

const EMPTY_TASK = { title: '', description: '', priority: 'MEDIUM', deadline: '', assigned_to: [], progress: 0, notes: '' }

function Avatar({ user, size = 8 }) {
    const cls = `w-${size} h-${size} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0`
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

function DeadlineBadge({ deadline }) {
    if (!deadline) return null
    const d = new Date(deadline)
    const days = differenceInDays(d, new Date())
    let cls = 'text-slate-400'
    if (days < 0) cls = 'text-red-400 font-medium'
    else if (days <= 3) cls = 'text-red-400'
    else if (days <= 7) cls = 'text-orange-400'
    return <span className={`text-xs ${cls}`}>⏰ {format(d, 'dd/MM')}{days < 0 ? ' (quá hạn)' : days <= 3 ? ` (${days}n)` : ''}</span>
}

export default function ProjectDetailPage() {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const { hasRole, user } = useAuth()

    const [project, setProject] = useState(null)
    const [tasks, setTasks] = useState([])
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('kanban')

    // Modals
    const [showTaskModal, setShowTaskModal] = useState(false)
    const [showMemberModal, setShowMemberModal] = useState(false)
    const [editingTask, setEditingTask] = useState(null)

    const [taskForm, setTaskForm] = useState(EMPTY_TASK)
    const [availableUsers, setAvailableUsers] = useState([])       // for member modal
    const [allCompanyUsers, setAllCompanyUsers] = useState([])     // for task assign
    const [memberSearch, setMemberSearch] = useState('')
    const [assignSearch, setAssignSearch] = useState('')           // search in assign list
    const [loadingUsers, setLoadingUsers] = useState(false)

    const canManage = hasRole(['SUPER_ADMIN', 'HR_MANAGER', 'LEADER'])

    useEffect(() => { loadData() }, [projectId])

    const loadData = async () => {
        try {
            const [projRes, tasksRes, membersRes] = await Promise.all([
                projectAPI.getProject(projectId),
                projectAPI.getProjectTasks(projectId),
                projectAPI.getProjectMembers(projectId),
            ])
            setProject(projRes.data)
            setTasks(tasksRes.data)
            setMembers(membersRes.data)
        } catch {
            toast.error('Không thể tải dữ liệu dự án')
        } finally {
            setLoading(false)
        }
    }

    const loadAvailableUsers = async () => {
        setLoadingUsers(true)
        try {
            const res = await userAPI.searchUsers('')
            setAvailableUsers(res.data || [])
        } catch { toast.error('Không tải được danh sách nhân viên') }
        finally { setLoadingUsers(false) }
    }

    const loadAllCompanyUsers = async () => {
        try {
            const res = await userAPI.searchUsers('')
            setAllCompanyUsers(res.data || [])
        } catch { console.error('Failed to load users') }
    }

    // ---- Task CRUD ----
    const openCreateTask = () => {
        setEditingTask(null)
        setTaskForm(EMPTY_TASK)
        setAssignSearch('')
        setShowTaskModal(true)
        loadAllCompanyUsers()
    }

    const [taskHistory, setTaskHistory] = useState([])

    const openEditTask = async (task) => {
        setEditingTask(task)
        setTaskForm({
            title: task.title || '',
            description: task.description || '',
            priority: task.priority || 'MEDIUM',
            deadline: task.deadline ? task.deadline.substring(0, 10) : '',
            assigned_to: (task.assigned_to || []).map(a => a.id || a),  // extract IDs from objects
            progress: task.progress || 0,
            notes: '',
        })
        setAssignSearch('')
        setShowTaskModal(true)
        loadAllCompanyUsers()
        
        try {
            const res = await projectAPI.getTaskHistory(task.id)
            setTaskHistory(res.data)
        } catch { setTaskHistory([]) }
    }

    const handleSaveTask = async () => {
        if (!taskForm.title.trim()) { toast.error('Vui lòng nhập tiêu đề task'); return }
        try {
            const payload = {
                title: taskForm.title,
                description: taskForm.description || null,
                priority: taskForm.priority,
                deadline: taskForm.deadline || null,
                assigned_to: taskForm.assigned_to,  // already an array
            }
            if (editingTask) {
                const isAssignee = taskForm.assigned_to.includes(user?.id)
                if (isAssignee && !canManage) {
                    await projectAPI.updateTaskProgress(editingTask.id, taskForm.progress, taskForm.notes)
                    toast.success('Cập nhật tiến độ thành công!')
                } else {
                    await projectAPI.updateTask(editingTask.id, { ...payload, progress: taskForm.progress })
                    toast.success('Cập nhật task thành công!')
                }
            } else {
                await projectAPI.createTask(projectId, payload)
                toast.success('Tạo task thành công!')
            }
            setShowTaskModal(false)
            loadData()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Thao tác thất bại')
        }
    }

    const handleDeleteTask = async (taskId) => {
        if (!confirm('Bạn có chắc muốn xóa task này?')) return
        try {
            await projectAPI.deleteTask(taskId)
            toast.success('Đã xóa task')
            setShowTaskModal(false)
            loadData()
        } catch { toast.error('Xóa task thất bại') }
    }

    const handleMoveTask = async (taskId, newStatus) => {
        try {
            await projectAPI.updateTask(taskId, { status: newStatus })
            loadData()
        } catch { toast.error('Cập nhật trạng thái thất bại') }
    }

    const handleAcceptTask = async (taskId) => {
        try {
            await projectAPI.respondToTask(taskId, true)
            toast.success('✓ Đã nhận công việc!')
            setShowTaskModal(false)
            loadData()
        } catch { toast.error('Nhận công việc thất bại') }
    }

    const handleRejectTask = async (taskId) => {
        const reason = prompt('Nhập lý do từ chối công việc:')
        if (reason === null) return // cancelled
        if (!reason.trim()) { toast.error('Vui lòng nhập lý do từ chối'); return }
        try {
            await projectAPI.respondToTask(taskId, false, reason)
            toast.success('Đã từ chối công việc')
            setShowTaskModal(false)
            loadData()
        } catch { toast.error('Thao tác thất bại') }
    }

    // ---- Members ----
    const handleAddMember = async (userId) => {
        try {
            await projectAPI.addProjectMembers(projectId, [userId])
            toast.success('Đã thêm thành viên')
            loadData()
        } catch { toast.error('Thêm thành viên thất bại') }
    }

    const handleRemoveMember = async (memberId) => {
        if (!confirm('Xóa thành viên này khỏi dự án?')) return
        try {
            await projectAPI.removeProjectMember(projectId, memberId)
            toast.success('Đã xóa thành viên')
            loadData()
        } catch { toast.error('Xóa thành viên thất bại') }
    }

    // ---- Project status ----
    const handleUpdateStatus = async (status) => {
        try {
            await projectAPI.updateProjectStatus(projectId, status)
            toast.success('Cập nhật trạng thái dự án thành công')
            loadData()
        } catch { toast.error('Cập nhật thất bại') }
    }

    const handleDeleteProject = async () => {
        if (!confirm('Bạn có chắc muốn XÓA dự án này? Tất cả task sẽ bị xóa.')) return
        try {
            await projectAPI.deleteProject(projectId)
            toast.success('Đã xóa dự án')
            navigate('/projects')
        } catch { toast.error('Xóa dự án thất bại') }
    }

    // ---- Helpers ----
    const getTasksByStatus = (status) => tasks.filter(t => t.status === status)

    const filteredMemberSearch = availableUsers.filter(u =>
        !members.find(m => m.id === u.id) &&
        ((u.full_name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
         (u.email || '').toLowerCase().includes(memberSearch.toLowerCase()))
    )

    // For task assignment: all company users filtered by search
    const filteredAssignUsers = allCompanyUsers.filter(u =>
        (u.full_name || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(assignSearch.toLowerCase()) ||
        (u.department || '').toLowerCase().includes(assignSearch.toLowerCase())
    )

    const toggleAssignUser = (userId) => {
        setTaskForm(f => ({
            ...f,
            assigned_to: f.assigned_to.includes(userId)
                ? f.assigned_to.filter(id => id !== userId)
                : [...f.assigned_to, userId]
        }))
    }

    const completedCount = tasks.filter(t => t.status === 'COMPLETED').length
    const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

    if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
    if (!project) return <div className="glass-card p-8 text-center text-slate-500">Không tìm thấy dự án</div>

    return (
        <div className="space-y-6">
            {/* ===== HEADER CARD ===== */}
            <div className="glass-card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <button onClick={() => navigate('/projects')} className="text-slate-400 hover:text-slate-200 text-sm mb-3 flex items-center gap-1 transition-colors">
                            ← Quay lại danh sách
                        </button>
                        <h1 className="text-2xl font-bold mb-1">{project.name}</h1>
                        <p className="text-slate-400 text-sm">{project.description || 'Không có mô tả'}</p>
                        {(project.start_date || project.end_date) && (
                            <div className="flex items-center gap-3 mt-2 text-sm text-slate-400">
                                {project.start_date && <span>🗓 Bắt đầu: {format(new Date(project.start_date), 'dd/MM/yyyy')}</span>}
                                {project.end_date && <span>🏁 Kết thúc: {format(new Date(project.end_date), 'dd/MM/yyyy')}</span>}
                            </div>
                        )}
                    </div>
                    {/* Removed header state dropdown and delete button */}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-slate-700/50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold">{tasks.length}</p>
                        <p className="text-xs text-slate-400 mt-1">Tổng tasks</p>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-400">{getTasksByStatus('IN_PROGRESS').length}</p>
                        <p className="text-xs text-slate-400 mt-1">Đang làm</p>
                    </div>
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-400">{completedCount}</p>
                        <p className="text-xs text-slate-400 mt-1">Hoàn thành</p>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-400">{members.length}</p>
                        <p className="text-xs text-slate-400 mt-1">Thành viên</p>
                    </div>
                </div>

                {/* Progress bar */}
                {tasks.length > 0 && (
                    <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-400">Tiến độ dự án</span>
                            <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="bg-slate-700 rounded-full h-2">
                            <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* ===== TABS ===== */}
            <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1 w-fit">
                {[
                    { id: 'kanban', label: '📋 Kanban' },
                    { id: 'members', label: '👥 Thành viên' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'text-slate-400 hover:text-white'
                        }`}
                    >{tab.label}</button>
                ))}
            </div>

            {/* ===== KANBAN TAB ===== */}
            {activeTab === 'kanban' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Bảng công việc</h2>
                        {canManage && (
                            <button onClick={openCreateTask} className="btn-primary text-sm flex items-center gap-1">
                                Cập nhật dự án
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {KANBAN_COLUMNS.map(col => {
                            const colTasks = getTasksByStatus(col.id)
                            return (
                                <div key={col.id} className={`${col.color} rounded-2xl p-4 min-h-[320px]`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                                            <h3 className={`font-semibold text-sm ${col.textColor}`}>{col.label}</h3>
                                        </div>
                                        <span className="text-xs bg-white/70 dark:bg-black/20 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300 font-medium shadow-sm">
                                            {colTasks.length}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        {colTasks.map(task => {
                                            const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM
                                            return (
                                                <div
                                                    key={task.id}
                                                    className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-white/50 dark:border-slate-700/50 group"
                                                    onClick={() => openEditTask(task)}
                                                >
                                                    {/* Priority badge + move arrows */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-xs px-1.5 py-0.5 rounded border ${pCfg.color}`}>
                                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${pCfg.dot} mr-1 align-middle`}></span>
                                                            {pCfg.label}
                                                        </span>
                                                        {canManage && (
                                                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
                                                                {col.id !== 'TODO' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const order = ['TODO','ASSIGNED','IN_PROGRESS','COMPLETED']
                                                                            const idx = order.indexOf(col.id)
                                                                            if (idx > 0) handleMoveTask(task.id, order[idx - 1])
                                                                        }}
                                                                        className="w-5 h-5 bg-slate-200 dark:bg-slate-600 rounded text-xs hover:bg-slate-300 dark:hover:bg-slate-500 flex items-center justify-center"
                                                                        title="Chuyển sang cột trước"
                                                                    >←</button>
                                                                )}
                                                                {col.id !== 'COMPLETED' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const order = ['TODO','ASSIGNED','IN_PROGRESS','COMPLETED']
                                                                            const idx = order.indexOf(col.id)
                                                                            if (idx < 3) handleMoveTask(task.id, order[idx + 1])
                                                                        }}
                                                                        className="w-5 h-5 bg-blue-100 dark:bg-blue-900/40 rounded text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/60 flex items-center justify-center"
                                                                        title="Chuyển sang cột tiếp"
                                                                    >→</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Task title */}
                                                    <h4 className="font-medium text-sm text-slate-800 dark:text-slate-100 mb-2 leading-tight">{task.title}</h4>

                                                    {/* Footer: assignee + deadline */}
                                                    <div className="flex items-center justify-between mt-2">
                                                        {task.assigned_to && task.assigned_to.length > 0 ? (
                                                             <div className="flex items-center">
                                                                 {task.assigned_to.slice(0, 3).map((a, i) => (
                                                                     <div key={a.id || i} className="-ml-1.5 first:ml-0 border border-white dark:border-slate-800 rounded-full" title={a.full_name}>
                                                                         <Avatar user={a} size={6} />
                                                                     </div>
                                                                 ))}
                                                                 {task.assigned_to.length > 3 && (
                                                                     <span className="text-xs text-slate-400 ml-1">+{task.assigned_to.length - 3}</span>
                                                                 )}
                                                             </div>
                                                         ) : (
                                                             <span className="text-xs text-slate-400 italic">Chưa giao</span>
                                                         )}
                                                        <DeadlineBadge deadline={task.deadline} />
                                                    </div>

                                                    {/* Progress bar if in progress */}
                                                    {task.progress > 0 && task.status !== 'COMPLETED' && (
                                                        <div className="mt-2 bg-slate-200 dark:bg-slate-700 rounded-full h-1">
                                                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${task.progress}%` }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}

                                        {colTasks.length === 0 && (
                                            <div className="text-center py-8 text-slate-400 text-sm opacity-60">Không có task</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ===== MEMBERS TAB ===== */}
            {activeTab === 'members' && (
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold">Thành viên dự án ({members.length})</h2>
                        {canManage && (
                            <button
                                onClick={() => { setShowMemberModal(true); setMemberSearch(''); loadAvailableUsers(); }}
                                className="btn-primary text-sm flex items-center gap-1"
                            >+ Thêm thành viên</button>
                        )}
                    </div>
                    {members.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-4xl mb-3">👥</p>
                            <p className="text-slate-400">Chưa có thành viên nào trong dự án</p>
                            {canManage && (
                                <button onClick={() => { setShowMemberModal(true); loadAvailableUsers(); }} className="btn-primary mt-4 text-sm">+ Thêm thành viên</button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {members.map(member => (
                                <div key={member.id} className="flex items-center gap-3 p-4 bg-slate-700/30 border border-slate-600/50 rounded-xl group hover:border-slate-500 transition-all">
                                    <Avatar user={member} size={10} />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{member.full_name}</p>
                                        <p className="text-xs text-slate-400 truncate">{member.position || member.department || member.email}</p>
                                    </div>
                                    {canManage && (
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all p-1 rounded"
                                            title="Xóa khỏi dự án"
                                        >✕</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ===== CREATE/EDIT TASK MODAL ===== */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="px-6 pt-6 pb-4 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">
                                {editingTask ? '✏️ Sửa task' : '✚ Tạo task mới'}
                            </h3>
                            <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-xl">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Tiêu đề <span className="text-red-400">*</span></label>
                                <input
                                    autoFocus
                                    type="text"
                                    disabled={!canManage}
                                    value={taskForm.title}
                                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
                                    placeholder="Tên công việc..."
                                />
                            </div>
                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Mô tả</label>
                                <textarea
                                    disabled={!canManage}
                                    value={taskForm.description}
                                    onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 h-20 resize-none text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
                                    placeholder="Mô tả chi tiết..."
                                />
                            </div>
                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Mức ưu tiên</label>
                                <select
                                    disabled={!canManage}
                                    value={taskForm.priority}
                                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                >
                                    <option value="LOW">🟢 Thấp</option>
                                    <option value="MEDIUM">🟡 Trung bình</option>
                                    <option value="HIGH">🟠 Cao</option>
                                    <option value="URGENT">🔴 Khẩn cấp</option>
                                </select>
                            </div>
                            {/* Deadline */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Hạn hoàn thành</label>
                                <input
                                    type="date"
                                    disabled={!canManage}
                                    value={taskForm.deadline}
                                    onChange={e => setTaskForm({ ...taskForm, deadline: e.target.value })}
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                                />
                            </div>
                            
                            {/* Progress Slider (for assignees) */}
                            {editingTask && taskForm.assigned_to.includes(user?.id) && editingTask.status === 'IN_PROGRESS' && (
                                <div className="mt-2 pt-2 border-t border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-slate-300">Cập nhật tiến độ</label>
                                        <span className="text-sm font-bold text-blue-400">{taskForm.progress}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0" max="100" step="5"
                                        value={taskForm.progress}
                                        onChange={e => setTaskForm({ ...taskForm, progress: Number(e.target.value) })}
                                        className="w-full accent-blue-500"
                                    />
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {[25, 50, 75, 100].map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setTaskForm({ ...taskForm, progress: p })}
                                                className={`text-xs px-2 py-0.5 rounded ${taskForm.progress >= p ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                                            >{p}%</button>
                                        ))}
                                    </div>
                                    {!canManage && (
                                        <input
                                            type="text"
                                            placeholder="Ghi chú báo cáo (Ví dụ: Đã thiết kế xong layout...)"
                                            value={taskForm.notes || ''}
                                            onChange={e => setTaskForm({ ...taskForm, notes: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 mt-2 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    )}
                                </div>
                            )}

                            {/* Audit History Logs */}
                            {editingTask && taskHistory.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-700">
                                    <label className="block text-sm font-medium text-slate-300 mb-2">📝 Lịch sử tiến độ</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {taskHistory.map(log => (
                                            <div key={log.id} className="text-xs bg-slate-700/30 p-2 rounded-lg border border-slate-600/50">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-blue-400">{log.user?.full_name}</span>
                                                    <span className="text-slate-500">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                                                </div>
                                                <div className="text-slate-200 mt-1">
                                                    Tăng: {log.old_progress}% ➔ {log.new_progress}%
                                                </div>
                                                {log.note && <div className="text-slate-400 mt-0.5 italic">" {log.note} "</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Assign to member */}
                            {canManage && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Giao cho nhân viên</label>
                                    <input
                                        type="text"
                                        value={assignSearch}
                                        onChange={e => setAssignSearch(e.target.value)}
                                        placeholder="🔍 Tìm nhân viên..."
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 mb-2"
                                    />
                                    <div className="space-y-1 max-h-44 overflow-y-auto pr-1 bg-slate-700/30 rounded-xl p-2 border border-slate-600">
                                        {filteredAssignUsers.length === 0 ? (
                                            <div className="text-center py-4 text-slate-400 text-sm">Không tìm thấy</div>
                                        ) : (
                                            filteredAssignUsers.map(u => {
                                                const isSelected = taskForm.assigned_to.includes(u.id)
                                                return (
                                                    <div
                                                        key={u.id}
                                                        onClick={() => toggleAssignUser(u.id)}
                                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-blue-500/10 border-blue-500/30 border' : 'hover:bg-slate-700/50 border border-transparent'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            readOnly
                                                            className="form-checkbox h-4 w-4 text-blue-500 rounded border-slate-600 bg-slate-700/50"
                                                        />
                                                        <Avatar user={u} size={6} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{u.full_name}</p>
                                                            <p className="text-xs text-slate-400 truncate">{u.department || u.email}</p>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Status handlers for Assignee if task is ASSIGNED or TODO */}
                        {editingTask && taskForm.assigned_to.some(uid => uid === user?.id) && ['ASSIGNED', 'TODO'].includes(editingTask.status) && (
                            <div className="px-6 pb-2 flex gap-3">
                                <button onClick={() => handleAcceptTask(editingTask.id)} className="flex-1 btn-primary py-3">✓ Nhận việc</button>
                                <button onClick={() => handleRejectTask(editingTask.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl font-medium transition-colors">✕ Từ chối</button>
                            </div>
                        )}

                        <div className="px-6 pb-6 flex gap-3">
                            {editingTask && canManage && (
                                <button onClick={() => handleDeleteTask(editingTask.id)} className="px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded-xl text-sm hover:bg-red-500/20 transition-colors">Xóa</button>
                            )}
                            <button onClick={() => setShowTaskModal(false)} className="flex-1 btn-secondary">Hủy</button>
                            <button onClick={handleSaveTask} className="flex-1 btn-primary">
                                {editingTask ? 'Lưu thay đổi' : 'Tạo task'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== ADD MEMBER MODAL ===== */}
            {showMemberModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="px-6 pt-6 pb-4 border-b border-slate-700 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">👥 Thêm thành viên</h3>
                            <button onClick={() => setShowMemberModal(false)} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-xl">✕</button>
                        </div>
                        <div className="p-6">
                            <input
                                autoFocus
                                type="text"
                                value={memberSearch}
                                onChange={e => setMemberSearch(e.target.value)}
                                placeholder="🔍 Tìm tên, email..."
                                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 mb-4"
                            />
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {loadingUsers ? (
                                    <div className="text-center py-8 text-slate-400">Đang tải...</div>
                                ) : filteredMemberSearch.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        {availableUsers.length === 0 ? 'Không có nhân viên nào' : 'Tất cả đã trong dự án'}
                                    </div>
                                ) : (
                                    filteredMemberSearch.map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => { handleAddMember(user.id); setShowMemberModal(false); }}
                                            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-700/50 border border-transparent hover:border-slate-600 transition-all"
                                        >
                                            <Avatar user={user} size={10} />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm">{user.full_name}</p>
                                                <p className="text-xs text-slate-400 truncate">{user.department || user.position || user.email}</p>
                                            </div>
                                            <span className="text-blue-400 text-xs font-medium flex-shrink-0">+ Thêm</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="px-6 pb-6">
                            <button onClick={() => setShowMemberModal(false)} className="w-full btn-secondary">Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { projectAPI, userAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format, differenceInDays } from 'date-fns'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const STATUS_CONFIG = {
    PLANNING:    { label: 'Lên kế hoạch', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
    IN_PROGRESS: { label: 'Đang thực hiện', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ON_HOLD:     { label: 'Tạm dừng',       color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    COMPLETED:   { label: 'Hoàn thành',     color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    CANCELLED:   { label: 'Đã hủy',         color: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const EMPTY_PROJECT = {
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    team_members: [],
}

export default function ProjectsPage() {
    const navigate = useNavigate()
    const { hasRole } = useAuth()
    const [projects, setProjects] = useState([])
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [modalStep, setModalStep] = useState(1)   // 1: info, 2: members
    const [newProject, setNewProject] = useState(EMPTY_PROJECT)

    // Member picker
    const [allUsers, setAllUsers] = useState([])
    const [userSearch, setUserSearch] = useState('')
    const [loadingUsers, setLoadingUsers] = useState(false)
    const searchRef = useRef(null)

    const canManage = hasRole(['SUPER_ADMIN', 'HR_MANAGER', 'LEADER'])

    useEffect(() => { loadProjects() }, [filter])

    const loadProjects = async () => {
        setLoading(true)
        try {
            const status = filter === 'all' ? null : filter
            const response = await projectAPI.getProjects(status)
            setProjects(response.data)
        } catch {
            toast.error('Không tải được danh sách dự án')
        } finally {
            setLoading(false)
        }
    }

    const loadUsers = async () => {
        setLoadingUsers(true)
        try {
            const res = await userAPI.searchUsers('')
            setAllUsers(res.data || [])
        } catch {
            toast.error('Không tải được danh sách nhân viên')
        } finally {
            setLoadingUsers(false)
        }
    }

    const openCreateModal = () => {
        setNewProject(EMPTY_PROJECT)
        setModalStep(1)
        setUserSearch('')
        setShowCreateModal(true)
        loadUsers()
    }

    const handleNextStep = () => {
        if (!newProject.name.trim()) { toast.error('Vui lòng nhập tên dự án'); return }
        setModalStep(2)
        setTimeout(() => searchRef.current?.focus(), 100)
    }

    const toggleMember = (userId) => {
        setNewProject(p => ({
            ...p,
            team_members: p.team_members.includes(userId)
                ? p.team_members.filter(id => id !== userId)
                : [...p.team_members, userId]
        }))
    }

    const handleCreateProject = async () => {
        try {
            const payload = {
                name: newProject.name,
                description: newProject.description || null,
                start_date: newProject.start_date || null,
                end_date: newProject.end_date || null,
                team_members: newProject.team_members,
            }
            await projectAPI.createProject(payload)
            toast.success('Tạo dự án thành công!')
            setShowCreateModal(false)
            setNewProject(EMPTY_PROJECT)
            loadProjects()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Tạo dự án thất bại')
        }
    }

    const filteredUsers = allUsers.filter(u =>
        (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.department || '').toLowerCase().includes(userSearch.toLowerCase())
    )

    const selectedUsers = allUsers.filter(u => newProject.team_members.includes(u.id))

    const getDeadlineStyle = (endDate) => {
        if (!endDate) return ''
        const days = differenceInDays(new Date(endDate), new Date())
        if (days < 0) return 'text-red-400'
        if (days <= 7) return 'text-orange-400'
        return 'text-slate-400'
    }

    if (loading && projects.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Dự án</h1>
                    <p className="text-slate-400">Quản lý và theo dõi các dự án</p>
                </div>
                {canManage && (
                    <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
                        <span className="text-lg leading-none">+</span> Tạo dự án
                    </button>
                )}
            </div>

            {/* Status Filters */}
            <div className="flex gap-2 flex-wrap">
                {['all', 'PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`px-4 py-2 rounded-xl text-sm transition-all ${filter === s
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {s === 'all' ? 'Tất cả' : STATUS_CONFIG[s]?.label || s}
                    </button>
                ))}
            </div>

            {/* Project Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.length === 0 ? (
                    <div className="col-span-full glass-card p-12 text-center">
                        <p className="text-5xl mb-4">📋</p>
                        <p className="text-slate-400 text-lg">Chưa có dự án nào</p>
                        {canManage && (
                            <button onClick={openCreateModal} className="btn-primary mt-4">
                                Tạo dự án đầu tiên
                            </button>
                        )}
                    </div>
                ) : (
                    projects.map(project => {
                        const members = project.team_members || []
                        const statusCfg = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING
                        return (
                            <div
                                key={project.id}
                                className="glass-card p-6 card-hover cursor-pointer flex flex-col gap-4"
                                onClick={() => navigate(`/projects/${project.id}`)}
                            >
                                {/* Title + Status */}
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-lg font-semibold leading-tight">{project.name}</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap flex-shrink-0 ${statusCfg.color}`}>
                                        {statusCfg.label}
                                    </span>
                                </div>

                                {/* Description */}
                                <p className="text-slate-400 text-sm line-clamp-2 flex-1">
                                    {project.description || 'Không có mô tả'}
                                </p>

                                {/* Dates */}
                                {(project.start_date || project.end_date) && (
                                    <div className="flex items-center gap-3 text-xs text-slate-400">
                                        {project.start_date && (
                                            <span>🗓 {format(new Date(project.start_date), 'dd/MM/yyyy')}</span>
                                        )}
                                        {project.end_date && (
                                            <span className={getDeadlineStyle(project.end_date)}>
                                                → {format(new Date(project.end_date), 'dd/MM/yyyy')}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Footer: members + task count */}
                                <div className="flex items-center justify-between">
                                    {/* Member avatars */}
                                    <div className="flex items-center">
                                        {members.slice(0, 5).map((m, i) => (
                                            <div
                                                key={i}
                                                className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-slate-800 flex items-center justify-center text-white text-xs font-bold -ml-2 first:ml-0 overflow-hidden"
                                                title={typeof m === 'object' ? m.full_name : ''}
                                            >
                                                {typeof m === 'object' && m.avatar
                                                    ? <img src={`${API_URL}${m.avatar}`} className="w-full h-full object-cover" alt="" />
                                                    : <span>{(typeof m === 'object' ? m.full_name : '?')?.[0] || '?'}</span>
                                                }
                                            </div>
                                        ))}
                                        {members.length > 5 && (
                                            <span className="ml-2 text-xs text-slate-400">+{members.length - 5}</span>
                                        )}
                                        {members.length === 0 && (
                                            <span className="text-xs text-slate-500">Chưa có thành viên</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {members.length} thành viên
                                    </span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* ===== CREATE PROJECT MODAL ===== */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white">
                                    {modalStep === 1 ? '📋 Tạo dự án mới' : '👥 Chọn thành viên'}
                                </h3>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-slate-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700"
                                >✕</button>
                            </div>
                            {/* Step indicator */}
                            <div className="flex gap-2 mt-4">
                                {[1, 2].map(step => (
                                    <div
                                        key={step}
                                        className={`flex-1 h-1.5 rounded-full transition-all ${step <= modalStep ? 'bg-blue-500' : 'bg-slate-600'}`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Bước {modalStep}/2: {modalStep === 1 ? 'Thông tin dự án' : 'Thêm thành viên (tuỳ chọn)'}
                            </p>
                        </div>

                        {/* Step 1: Project Info */}
                        {modalStep === 1 && (
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Tên dự án <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newProject.name}
                                        onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleNextStep()}
                                        autoFocus
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="VD: Website thương mại điện tử"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Mô tả</label>
                                    <textarea
                                        value={newProject.description}
                                        onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 h-24 resize-none text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Mô tả chi tiết về dự án..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Ngày bắt đầu</label>
                                        <input
                                            type="date"
                                            value={newProject.start_date}
                                            onChange={e => setNewProject({ ...newProject, start_date: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Ngày kết thúc</label>
                                        <input
                                            type="date"
                                            value={newProject.end_date}
                                            onChange={e => setNewProject({ ...newProject, end_date: e.target.value })}
                                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary">Hủy</button>
                                    <button onClick={handleNextStep} className="flex-1 btn-primary">
                                        Tiếp theo →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Select Members */}
                        {modalStep === 2 && (
                            <div className="p-6">
                                {/* Search */}
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    placeholder="🔍 Tìm theo tên, email, phòng ban..."
                                    className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                                />

                                {/* Selected members chips */}
                                {selectedUsers.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-700/30 rounded-xl border border-slate-600/50">
                                        {selectedUsers.map(u => (
                                            <div key={u.id} className="flex items-center gap-1.5 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-full px-2 py-1 text-xs">
                                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0">
                                                    {u.avatar
                                                        ? <img src={`${API_URL}${u.avatar}`} className="w-full h-full object-cover" alt="" />
                                                        : u.full_name?.[0]
                                                    }
                                                </div>
                                                <span>{u.full_name}</span>
                                                <button onClick={() => toggleMember(u.id)} className="text-blue-400 hover:text-red-400 ml-0.5">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* User list */}
                                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                    {loadingUsers ? (
                                        <div className="text-center py-8 text-slate-400">Đang tải...</div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">Không tìm thấy nhân viên</div>
                                    ) : filteredUsers.map(user => {
                                        const isSelected = newProject.team_members.includes(user.id)
                                        return (
                                            <div
                                                key={user.id}
                                                onClick={() => toggleMember(user.id)}
                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected
                                                    ? 'bg-blue-500/20 border border-blue-500/40'
                                                    : 'hover:bg-slate-700/50 border border-transparent'
                                                }`}
                                            >
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                                                    {user.avatar
                                                        ? <img src={`${API_URL}${user.avatar}`} className="w-full h-full object-cover" alt="" />
                                                        : user.full_name?.[0] || '?'
                                                    }
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm text-white truncate">{user.full_name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{user.department || user.position || user.email}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-500'}`}>
                                                    {isSelected && <span className="text-xs">✓</span>}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <p className="text-xs text-slate-500 mt-3 text-center">
                                    Đã chọn {newProject.team_members.length} người
                                </p>

                                <div className="flex gap-3 mt-4">
                                    <button onClick={() => setModalStep(1)} className="flex-1 btn-secondary">← Quay lại</button>
                                    <button onClick={handleCreateProject} className="flex-1 btn-primary">
                                        ✓ Tạo dự án
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

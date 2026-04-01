import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { departmentAPI, userAPI } from '../api'

export default function DepartmentsPage() {
    const { hasRole } = useAuth()
    const [departments, setDepartments] = useState([])
    const [managers, setManagers] = useState([])
    const [showDeptModal, setShowDeptModal] = useState(false)
    const [deptForm, setDeptForm] = useState({ id: null, name: '', description: '', manager_id: '' })
    const [loading, setLoading] = useState(true)

    const isSuperAdmin = hasRole('SUPER_ADMIN')

    useEffect(() => {
        loadDepartments()
        loadAllUsers()
    }, [])

    const loadDepartments = async () => {
        setLoading(true)
        try {
            const response = await departmentAPI.getDepartments()
            setDepartments(response.data)
        } catch (error) {
            console.error(error)
            toast.error('Lỗi tải phòng ban: ' + (error.response?.data?.detail || error.message))
        } finally {
            setLoading(false)
        }
    }

    const loadAllUsers = async () => {
        try {
            const response = await userAPI.listUsers('ACTIVE')
            setManagers(response.data || [])
        } catch {}
    }

    const openDeptModal = (dept = null) => {
        if (dept) {
            setDeptForm({ id: dept.id, name: dept.name, description: dept.description || '', manager_id: dept.manager_id || '' })
        } else {
            setDeptForm({ id: null, name: '', description: '', manager_id: '' })
        }
        setShowDeptModal(true)
    }

    const handleSaveDept = async () => {
        if (!deptForm.name) return toast.warning('Vui lòng nhập tên phòng ban')
        try {
            if (deptForm.id) {
                await departmentAPI.updateDepartment(deptForm.id, deptForm)
                toast.success('Cập nhật phòng ban thành công!')
            } else {
                await departmentAPI.createDepartment(deptForm)
                toast.success('Tạo phòng ban thành công!')
            }
            setShowDeptModal(false)
            loadDepartments()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Thao tác thất bại')
        }
    }

    const handleDeleteDept = async (id) => {
        if (!window.confirm('Bạn có chắc muốn xóa phòng ban này?')) return
        try {
            await departmentAPI.deleteDepartment(id)
            toast.success('Đã xóa phòng ban!')
            loadDepartments()
        } catch (error) {
            toast.error('Xóa phòng ban thất bại')
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Quản lý Phòng ban</h2>
                    {isSuperAdmin && <button onClick={() => openDeptModal()} className="btn-primary text-sm px-4 py-2">+ Thêm mới</button>}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="py-3 px-4 font-semibold">Tên Phòng</th>
                                <th className="py-3 px-4 font-semibold">Nhân sự</th>
                                <th className="py-3 px-4 font-semibold">Trưởng phòng</th>
                                <th className="py-3 px-4 font-semibold text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map((dept, idx) => {
                                const boss = managers.find(m => m.id === dept.manager_id)
                                return (
                                    <tr key={dept.id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-4">
                                            <div className="font-bold text-slate-800">{dept.name}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-xs">{dept.description || 'Chưa có mô tả'}</div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className="bg-blue-100 text-blue-700 font-medium text-xs px-2.5 py-1 rounded-full">
                                                {dept.member_count || 0} Người
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-slate-600">
                                            {boss ? boss.full_name : <span className="text-slate-400 italic">Chưa phân bổ</span>}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            {isSuperAdmin && (
                                                <div className="flex gap-3 justify-end">
                                                    <button onClick={() => openDeptModal(dept)} className="text-blue-500 hover:text-blue-700 font-medium transition-colors">Sửa</button>
                                                    <button onClick={() => handleDeleteDept(dept.id)} className="text-red-500 hover:text-red-700 font-medium transition-colors">Xóa</button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {departments.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center py-8 text-slate-400">
                                        Chưa có phòng ban nào
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Department Add/Edit Modal */}
            {showDeptModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card w-full max-w-md p-6 shadow-2xl animate-fadeIn bg-white">
                        <h3 className="text-xl font-bold mb-4 text-slate-800">{deptForm.id ? 'Sửa phòng ban' : 'Tạo mới phòng ban'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Tên phòng ban <span className="text-red-500">*</span></label>
                                <input type="text" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" placeholder="Ví dụ: Phòng Nhân sự" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Mô tả</label>
                                <textarea value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all min-h-[100px] resize-none" placeholder="Mô tả công việc chung..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700">Trưởng phòng</label>
                                <select value={deptForm.manager_id || ''} onChange={e => setDeptForm({ ...deptForm, manager_id: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
                                    <option value="">Chọn một Trưởng phòng...</option>
                                    {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                                <button onClick={() => setShowDeptModal(false)} className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors">Hủy</button>
                                <button onClick={handleSaveDept} className="btn-primary px-6 py-2.5 font-medium">Lưu thay đổi</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

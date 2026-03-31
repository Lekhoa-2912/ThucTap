import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import api, { departmentAPI, userAPI } from '../api'

export default function SettingsPage() {
    const { hasRole, user } = useAuth()
    const [activeTab, setActiveTab] = useState('company')
    const [settings, setSettings] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        company_name: '',
        latitude: '',
        longitude: '',
        radius_meters: 50,
        address: '',
        work_start_time: '08:00',
        work_end_time: '17:00',
        late_threshold_minutes: 15,
        early_leave_threshold_minutes: 30
    })

    // Department States
    const [departments, setDepartments] = useState([])
    const [managers, setManagers] = useState([])
    const [showDeptModal, setShowDeptModal] = useState(false)
    const [deptForm, setDeptForm] = useState({ id: null, name: '', description: '', manager_id: '' })

    const isSuperAdmin = hasRole('SUPER_ADMIN')

    useEffect(() => {
        if (activeTab === 'company') {
            loadSettings()
        } else if (activeTab === 'departments') {
            loadDepartments()
            loadLeaders()
        }
    }, [activeTab])

    const loadSettings = async () => {
        setLoading(true)
        try {
            const response = await api.get('/api/settings/company')
            setSettings(response.data)
            setFormData({
                company_name: response.data.company_name || '',
                latitude: response.data.latitude || '',
                longitude: response.data.longitude || '',
                radius_meters: response.data.radius_meters || 50,
                address: response.data.address || '',
                work_start_time: response.data.work_start_time || '08:00',
                work_end_time: response.data.work_end_time || '17:00',
                late_threshold_minutes: response.data.late_threshold_minutes || 15,
                early_leave_threshold_minutes: response.data.early_leave_threshold_minutes || 30
            })
        } catch (error) {
            console.error('Failed to load settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadDepartments = async () => {
        setLoading(true)
        try {
            const response = await departmentAPI.getDepartments()
            setDepartments(response.data)
        } catch (error) {
            toast.error('Không thể tải phòng ban')
        } finally {
            setLoading(false)
        }
    }

    const loadLeaders = async () => {
        try {
            const response = await userAPI.listUsers('ACTIVE', 'LEADER')
            setManagers(response.data || [])
        } catch {}
    }

    const handleChange = (e) => {
        const { name, value, type } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }))
    }

    const handleSave = async () => {
        if (!isSuperAdmin) {
            toast.error('Chỉ Super Admin mới có thể thay đổi cấu hình')
            return
        }
        setSaving(true)
        try {
            await api.put('/api/settings/company', formData)
            toast.success('Đã lưu cấu hình thành công!')
            loadSettings()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Lưu cấu hình thất bại')
        } finally {
            setSaving(false)
        }
    }

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Trình duyệt không hỗ trợ GPS')
            return
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }))
                toast.success('Đã lấy vị trí hiện tại thành công!')
            },
            () => toast.error('Không thể lấy vị trí. Vui lòng cho phép truy cập GPS'),
            { enableHighAccuracy: true }
        )
    }

    // Departments CRUD
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Tabs */}
            <div className="glass-card p-4 flex gap-2">
                <button
                    onClick={() => setActiveTab('company')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'company' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700/50 text-slate-400'}`}
                >🏢 Cấu hình công ty</button>
                <button
                    onClick={() => setActiveTab('departments')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'departments' ? 'bg-blue-600 text-white' : 'hover:bg-slate-700/50 text-slate-400'}`}
                >👥 Quản lý phòng ban</button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
            ) : activeTab === 'company' ? (
                <>
                    {/* Existing Company Info, Location, Work Hours render... */}
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold mb-4">Thông tin công ty</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Tên công ty</label>
                                <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} disabled={!isSuperAdmin} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Địa chỉ</label>
                                <input type="text" name="address" value={formData.address} onChange={handleChange} disabled={!isSuperAdmin} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50" />
                            </div>
                        </div>
                    </div>
                    {/* Geofencing */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Vị trí GPS (Geofencing)</h2>
                            {isSuperAdmin && <button onClick={getCurrentLocation} className="btn-secondary text-sm px-4 py-2">Lấy vị trí hiện tại</button>}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div><label className="block text-sm">Vĩ độ</label><input type="number" name="latitude" value={formData.latitude} onChange={handleChange} disabled={!isSuperAdmin} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2" /></div>
                            <div><label className="block text-sm">Kinh độ</label><input type="number" name="longitude" value={formData.longitude} onChange={handleChange} disabled={!isSuperAdmin} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2" /></div>
                            <div><label className="block text-sm">Bán kính (mét)</label><input type="number" name="radius_meters" value={formData.radius_meters} onChange={handleChange} disabled={!isSuperAdmin} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2" /></div>
                        </div>
                    </div>
                    {/* Save Config Button */}
                    {isSuperAdmin && (
                        <div className="flex justify-end"><button onClick={handleSave} disabled={saving} className="btn-primary px-8">{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button></div>
                    )}
                </>
            ) : (
                <>
                    {/* Departments View Dashboard */}
                    <div className="glass-card p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">Danh sách Phòng ban</h2>
                            {isSuperAdmin && <button onClick={() => openDeptModal()} className="btn-primary text-sm px-4 py-2">+ Thêm mới</button>}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="border-bottom border-slate-700 text-slate-400">
                                        <th className="py-3 px-2">Tên Phòng</th>
                                        <th className="py-3 px-2">Nhân sự</th>
                                        <th className="py-3 px-2">Trưởng phòng</th>
                                        <th className="py-3 px-2">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departments.map((dept, idx) => {
                                        const boss = managers.find(m => m.id === dept.manager_id)
                                        return (
                                            <tr key={dept.id || idx} className="border-t border-slate-800 hover:bg-slate-800/20">
                                                <td className="py-4 px-2">
                                                    <div className="font-bold text-white">{dept.name}</div>
                                                    <div className="text-xs text-slate-400 truncate max-w-xs">{dept.description || 'Chưa có mô tả'}</div>
                                                </td>
                                                <td className="py-4 px-2"><span className="bg-blue-600/20 text-blue-400 text-xs px-2 py-1 rounded-lg">{dept.member_count} Người</span></td>
                                                <td className="py-4 px-2 text-slate-300">{boss ? boss.full_name : 'N/A'}</td>
                                                <td className="py-4 px-2">
                                                    {isSuperAdmin && (
                                                        <div className="flex gap-2">
                                                            <button onClick={() => openDeptModal(dept)} className="text-blue-400 hover:underline">Sửa</button>
                                                            <button onClick={() => handleDeleteDept(dept.id)} className="text-red-400 hover:underline">Xóa</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Department Add/Edit Modal */}
                    {showDeptModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="glass-card w-full max-w-md p-6 animate-fadeIn">
                                <h3 className="text-xl font-bold mb-4">{deptForm.id ? 'Sửa phòng ban' : 'Tạo mới phòng ban'}</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Tên phòng ban *</label>
                                        <input type="text" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-2" placeholder="Ví dụ: Phòng Nhân sự" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Mô tả</label>
                                        <textarea value={deptForm.description} onChange={e => setDeptForm({ ...deptForm, description: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-2 text-sm" placeholder="Mô tả công việc chung..." />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Trưởng phòng</label>
                                        <select value={deptForm.manager_id || ''} onChange={e => setDeptForm({ ...deptForm, manager_id: e.target.value })} className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-2 text-sm">
                                            <option value="">Chọn một Trưởng phòng...</option>
                                            {managers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-4">
                                        <button onClick={() => setShowDeptModal(false)} className="btn-secondary text-sm px-4 py-2">Hủy</button>
                                        <button onClick={handleSaveDept} className="btn-primary text-sm px-4 py-2">💾 Lưu</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}


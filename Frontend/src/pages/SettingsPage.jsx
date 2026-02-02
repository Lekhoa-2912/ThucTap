import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function SettingsPage() {
    const { hasRole } = useAuth()
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

    const isSuperAdmin = hasRole('SUPER_ADMIN')

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
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
            (error) => {
                toast.error('Không thể lấy vị trí. Vui lòng cho phép truy cập GPS.')
            },
            { enableHighAccuracy: true }
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="glass-card p-6">
                <h1 className="text-2xl font-bold">Cấu hình hệ thống</h1>
                <p className="text-slate-400">Quản lý thông tin công ty và cấu hình chấm công</p>
            </div>

            {/* Company Info */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Thông tin công ty</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Tên công ty</label>
                        <input
                            type="text"
                            name="company_name"
                            value={formData.company_name}
                            onChange={handleChange}
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Địa chỉ</label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            disabled={!isSuperAdmin}
                            placeholder="VD: 123 Nguyễn Văn A, Q.1, TP.HCM"
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            {/* Location Settings */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Vị trí GPS (Geofencing)</h2>
                    {isSuperAdmin && (
                        <button
                            onClick={getCurrentLocation}
                            className="btn-secondary text-sm px-4 py-2"
                        >
                            Lấy vị trí hiện tại
                        </button>
                    )}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-300">
                        Nhân viên chỉ có thể chấm công khi ở trong bán kính cho phép từ vị trí công ty.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Vĩ độ (Latitude)</label>
                        <input
                            type="number"
                            name="latitude"
                            value={formData.latitude}
                            onChange={handleChange}
                            step="0.000001"
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Kinh độ (Longitude)</label>
                        <input
                            type="number"
                            name="longitude"
                            value={formData.longitude}
                            onChange={handleChange}
                            step="0.000001"
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Bán kính (mét)</label>
                        <input
                            type="number"
                            name="radius_meters"
                            value={formData.radius_meters}
                            onChange={handleChange}
                            min="10"
                            max="1000"
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                </div>

                {/* Map Preview */}
                {formData.latitude && formData.longitude && (
                    <div className="mt-4">
                        <p className="text-sm text-slate-400 mb-2">Xem trước trên Google Maps:</p>
                        <a
                            href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline text-sm"
                        >
                            Mở Google Maps ({formData.latitude}, {formData.longitude})
                        </a>
                    </div>
                )}
            </div>

            {/* Work Hours */}
            <div className="glass-card p-6">
                <h2 className="text-lg font-semibold mb-4">Giờ làm việc</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Giờ bắt đầu</label>
                        <input
                            type="time"
                            name="work_start_time"
                            value={formData.work_start_time}
                            onChange={handleChange}
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Giờ kết thúc</label>
                        <input
                            type="time"
                            name="work_end_time"
                            value={formData.work_end_time}
                            onChange={handleChange}
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Ngưỡng đi muộn (phút)</label>
                        <input
                            type="number"
                            name="late_threshold_minutes"
                            value={formData.late_threshold_minutes}
                            onChange={handleChange}
                            min="0"
                            max="60"
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Ngưỡng về sớm (phút)</label>
                        <input
                            type="number"
                            name="early_leave_threshold_minutes"
                            value={formData.early_leave_threshold_minutes}
                            onChange={handleChange}
                            min="0"
                            max="60"
                            disabled={!isSuperAdmin}
                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            {/* Last Updated */}
            {settings?.updated_at && (
                <div className="text-sm text-slate-400 text-center">
                    Cập nhật lần cuối: {new Date(settings.updated_at).toLocaleString('vi-VN')}
                    {settings.updated_by && ` bởi ${settings.updated_by}`}
                </div>
            )}

            {/* Save Button */}
            {isSuperAdmin && (
                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary px-8"
                    >
                        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                    </button>
                </div>
            )}

            {!isSuperAdmin && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
                    <p className="text-yellow-400">
                        Chỉ Super Admin mới có quyền thay đổi cấu hình hệ thống
                    </p>
                </div>
            )}
        </div>
    )
}

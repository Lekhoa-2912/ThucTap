import { useState, useEffect } from 'react'
import { Search, Clock, Save, LogOut, MapPin, Map, Navigation } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function AdminAttendancePage() {
    const { token } = useAuth()
    const [activeTab, setActiveTab] = useState('logs') // 'logs' or 'setup'
    const [loading, setLoading] = useState(true)

    // Logs state
    const [logs, setLogs] = useState([])
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    })
    const [searchQuery, setSearchQuery] = useState('')

    // Setup state
    const [settings, setSettings] = useState({
        work_start_time: '08:30',
        work_end_time: '17:30',
        late_threshold_minutes: 15,
        company_latitude: 21.028511,
        company_longitude: 105.804817,
        radius_meters: 50
    })
    const [savingSettings, setSavingSettings] = useState(false)

    useEffect(() => {
        if (activeTab === 'logs') {
            fetchLogs()
        } else {
            fetchSettings()
        }
    }, [activeTab, dateRange])

    const fetchLogs = async () => {
        try {
            setLoading(true)
            const response = await axios.get(`${API_URL}/api/attendance/admin/logs`, {
                params: {
                    start_date: dateRange.startDate ? new Date(dateRange.startDate).toISOString() : null,
                    end_date: dateRange.endDate ? new Date(new Date(dateRange.endDate).setHours(23, 59, 59, 999)).toISOString() : null
                },
                headers: { Authorization: `Bearer ${token}` }
            })
            setLogs(response.data)
        } catch (error) {
            console.error('Error fetching logs:', error)
            toast.error('Lỗi khi tải lịch sử chấm công')
        } finally {
            setLoading(false)
        }
    }

    const fetchSettings = async () => {
        try {
            setLoading(true)
            const response = await axios.get(`${API_URL}/api/attendance/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setSettings(response.data)
        } catch (error) {
            console.error('Error fetching settings:', error)
            toast.error('Lỗi khi tải cài đặt')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveSettings = async (e) => {
        e.preventDefault()
        try {
            setSavingSettings(true)
            await axios.put(`${API_URL}/api/attendance/settings`, settings, {
                headers: { Authorization: `Bearer ${token}` }
            })
            toast.success('Lưu cài đặt thành công')
        } catch (error) {
            console.error('Error saving settings:', error)
            toast.error('Lỗi khi lưu cài đặt')
        } finally {
            setSavingSettings(false)
        }
    }

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Trình duyệt của bạn không hỗ trợ định vị')
            return
        }

        toast.loading('Đang lấy vị trí...', { id: 'location-toast' })
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setSettings(prev => ({
                    ...prev,
                    company_latitude: position.coords.latitude,
                    company_longitude: position.coords.longitude
                }))
                toast.success('Đã cập nhật vị trí', { id: 'location-toast' })
            },
            (error) => {
                toast.error('Không thể lấy vị trí. Vui lòng kiểm tra quyền truy cập.', { id: 'location-toast' })
                console.error('Geolocation error:', error)
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        )
    }

    const filteredLogs = logs.filter(log => 
        log.user_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Quản lý Chấm công</h1>
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                        activeTab === 'logs'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Danh sách Lượt chấm công
                </button>
                <button
                    onClick={() => setActiveTab('setup')}
                    className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                        activeTab === 'setup'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Cài đặt thông số
                </button>
            </div>

            {activeTab === 'logs' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-4 mb-6 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Tìm kiếm nhân viên
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Tên nhân viên..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Từ ngày</label>
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Đến ngày</label>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Nhân viên</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Loại</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Thời gian</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Trạng thái</th>
                                    <th className="px-6 py-4 font-semibold text-slate-700">Độ chính xác khuôn mặt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                            <div className="spinner mx-auto mb-2"></div>
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                                            Không có dữ liệu chấm công trong khoảng thời gian này
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-4 font-medium text-slate-800">
                                                {log.user_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                                                    log.type === 'CHECK_IN' 
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                    {log.type === 'CHECK_IN' ? <Clock size={14} /> : <LogOut size={14} />}
                                                    {log.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {new Date(log.timestamp).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-sm ${
                                                    log.status === 'ON_TIME' ? 'bg-green-100 text-green-700' :
                                                    log.status === 'LATE' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {log.status === 'ON_TIME' ? 'Đúng giờ' :
                                                     log.status === 'LATE' ? 'Đi muộn' :
                                                     'Về sớm'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {log.face_confidence ? `${log.face_confidence.toFixed(1)}%` : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-3xl">
                    <form onSubmit={handleSaveSettings} className="space-y-8">
                        {/* Section 1: Time Configuration */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Clock className="text-blue-500" size={20} />
                                Cấu hình Thời gian làm việc
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Giờ bắt đầu làm việc</label>
                                    <input
                                        type="time"
                                        value={settings.work_start_time}
                                        onChange={(e) => setSettings({...settings, work_start_time: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Giờ check-in tiêu chuẩn</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Giờ kết thúc làm việc</label>
                                    <input
                                        type="time"
                                        value={settings.work_end_time}
                                        onChange={(e) => setSettings({...settings, work_end_time: e.target.value})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Giờ check-out tối thiểu (về sớm hơn sẽ bị ghi nhận)</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Thời gian châm chước đi muộn (phút)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={settings.late_threshold_minutes}
                                        onChange={(e) => setSettings({...settings, late_threshold_minutes: parseInt(e.target.value)})}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                                        required
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Số phút cho phép nhân viên check-in trễ tính từ giờ bắt đầu.</p>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Geofencing */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <MapPin className="text-purple-500" size={20} />
                                Cấu hình Vị trí Công ty (Geofencing)
                            </h3>
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 space-y-6">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-600">
                                        Giới hạn vị trí sẽ bắt buộc nhân viên phải đứng trong phạm vi quanh văn phòng mới có thể check-in/out.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleGetCurrentLocation}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-blue-600 hover:bg-slate-50 hover:border-blue-200 transition-colors"
                                    >
                                        <Navigation size={16} />
                                        Lấy vị trí hiện tại
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Vĩ độ (Latitude)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={settings.company_latitude}
                                            onChange={(e) => setSettings({...settings, company_latitude: parseFloat(e.target.value)})}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Kinh độ (Longitude)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={settings.company_longitude}
                                            onChange={(e) => setSettings({...settings, company_longitude: parseFloat(e.target.value)})}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Bán kính cho phép (mét)</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="10"
                                            max="500"
                                            step="10"
                                            value={settings.radius_meters}
                                            onChange={(e) => setSettings({...settings, radius_meters: parseInt(e.target.value)})}
                                            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                        <div className="w-24 text-right">
                                            <span className="inline-block px-3 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700">
                                                {settings.radius_meters}m
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingSettings}
                                className="btn-primary flex items-center justify-center gap-2"
                            >
                                {savingSettings ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>Đang lưu...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        <span>Lưu thay đổi</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

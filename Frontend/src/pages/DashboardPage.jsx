import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { attendanceAPI, projectAPI, leaveAPI, userAPI } from '../api'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export default function DashboardPage() {
    const navigate = useNavigate()
    const { user, hasRole } = useAuth()
    const [todayStatus, setTodayStatus] = useState(null)
    const [performance, setPerformance] = useState([])
    const [pendingLeaves, setPendingLeaves] = useState(0)
    const [leaveSummary, setLeaveSummary] = useState({ remaining: 0 })
    const [totalEmployees, setTotalEmployees] = useState(0)
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, pending: 0 })
    const [loading, setLoading] = useState(true)

    // Dynamic Chart Data
    const [chartPieData, setChartPieData] = useState([])
    const [chartBarData, setChartBarData] = useState([])

    const isManager = hasRole(['SUPER_ADMIN', 'HR_MANAGER', 'LEADER'])

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            // Load today's attendance status
            const attendanceRes = await attendanceAPI.getTodayStatus()
            setTodayStatus(attendanceRes.data)

            // Load leave summary
            try {
                const leaveRes = await leaveAPI.getMyLeaves()
                if (leaveRes.data?.summary) {
                    setLeaveSummary(leaveRes.data.summary)
                }
            } catch (e) { }

            // Load Employee or Manager specific stats
            if (isManager) {
                try {
                    const pendingRes = await leaveAPI.getPendingLeaves()
                    setPendingLeaves(pendingRes.data?.length || 0)
                } catch (e) { }

                try {
                    const perfRes = await projectAPI.getEmployeePerformance()
                    const perfData = perfRes.data || []
                    setPerformance(perfData)

                    const totalT = perfData.reduce((sum, emp) => sum + (emp.total_tasks || 0), 0)
                    const completedT = perfData.reduce((sum, emp) => sum + (emp.completed_tasks || 0), 0)
                    setTaskStats({
                        total: totalT,
                        completed: completedT,
                        pending: totalT - completedT
                    })
                } catch (e) { }

                try {
                    const usersRes = await userAPI.listUsers('ACTIVE')
                    setTotalEmployees(usersRes.data?.length || 0)
                } catch (e) { }
            } else {
                try {
                    const tasksRes = await projectAPI.getMyTasks()
                    const tasks = tasksRes.data || []
                    const completed = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED').length
                    setTaskStats({
                        total: tasks.length,
                        completed,
                        pending: tasks.length - completed
                    })
                } catch (e) { }
            }

            // --- LOAD REAL DYNAMIC CHART DATA ---
            try {
                const today = new Date()
                const currMonth = today.getMonth() + 1
                const currYear = today.getFullYear()
                
                // Generate last 6 months list
                const last6Months = []
                for (let i = 5; i >= 0; i--) {
                    let m = currMonth - i
                    let y = currYear
                    if (m <= 0) {
                        m += 12
                        y -= 1
                    }
                    last6Months.push({ month: m, year: y })
                }

                if (isManager) {
                    const reports = await Promise.all(last6Months.map(d => attendanceAPI.getTeamReport(d.month, d.year)))
                    const pBar = reports.map((res, idx) => {
                        const data = res.data
                        const total = data.total_checkins || 0
                        const onTimeRate = data.overall_on_time_rate || 0
                        const onTime = total > 0 ? Math.round((onTimeRate * total) / 100) : 0
                        const late = total - onTime
                        return { month: `T${last6Months[idx].month}`, onTime, late, absent: 0 } // Absent metric requires complex days integration
                    })
                    setChartBarData(pBar)
                    
                    const currData = pBar[5]
                    setChartPieData([
                        { name: 'Đúng giờ', value: currData.onTime || 0, color: '#22c55e' },
                        { name: 'Đi muộn', value: currData.late || 0, color: '#f59e0b' },
                        { name: 'Vắng mặt', value: currData.absent || 0, color: '#ef4444' }
                    ])
                } else {
                    const reports = await Promise.all(last6Months.map(d => attendanceAPI.getMonthlyReport(d.month, d.year)))
                    const pBar = reports.map((res, idx) => {
                        const data = res.data
                        return { month: `T${last6Months[idx].month}`, onTime: data.on_time_days || 0, late: data.late_days || 0, absent: 0 }
                    })
                    setChartBarData(pBar)
                    
                    const currData = pBar[5]
                    setChartPieData([
                        { name: 'Đúng giờ', value: currData.onTime || 0, color: '#22c55e' },
                        { name: 'Đi muộn', value: currData.late || 0, color: '#f59e0b' },
                        { name: 'Vắng mặt', value: currData.absent || 0, color: '#ef4444' }
                    ])
                }
            } catch(e) {
                console.error("Failed to load chart data:", e)
                // Fallback zero state
                setChartPieData([{ name: 'Đang tải', value: 1, color: '#cbd5e1' }])
            }

        } catch (error) {
            console.error('Failed to load dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>
    }

    // Check if pie chart is fully empty (0 records)
    const emptyPieData = chartPieData.every(d => d.value === 0)
    const pieDataToRender = emptyPieData ? [{ name: 'Chưa có dl', value: 1, color: '#cbd5e1' }] : chartPieData

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">
                            Xin chào, {user?.full_name || 'Bạn'}!
                        </h1>
                        <p className="text-slate-500">
                            {format(new Date(), "EEEE, 'ngày' dd 'tháng' MM, yyyy", { locale: vi })}
                        </p>
                    </div>
                    {/* Quick Actions */}
                    <div className="flex gap-2">
                        {!isManager && (
                            <>
                                <button onClick={() => navigate('/attendance')} className="btn-primary text-sm">
                                    Chấm công
                                </button>
                                <button onClick={() => navigate('/leaves')} className="btn-secondary text-sm">
                                    Xin nghỉ
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Today Status */}
                {!isManager && (
                    <div className="glass-card p-5 card-hover cursor-pointer border border-slate-200" onClick={() => navigate('/attendance')}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${todayStatus?.checked_in ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {todayStatus?.checked_in ? 'Đã chấm công' : 'Chưa chấm công'}
                            </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-700">Chấm công hôm nay</h3>
                        {todayStatus?.checkin_time && (
                            <p className="text-slate-500 text-sm mt-1 font-mono">
                                Vào: {format(new Date(todayStatus.checkin_time), 'HH:mm')}
                                {todayStatus?.checkout_time && ` → Ra: ${format(new Date(todayStatus.checkout_time), 'HH:mm')}`}
                            </p>
                        )}
                    </div>
                )}

                {/* Leave Balance / Total Employees */}
                {isManager ? (
                    <div className="glass-card p-5 card-hover cursor-pointer border border-slate-200" onClick={() => navigate('/admin/users')}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-3xl font-extrabold text-blue-600">{totalEmployees}</span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-700">Tổng nhân viên</h3>
                        <p className="text-slate-500 text-sm mt-1">Đang làm việc</p>
                    </div>
                ) : (
                    <div className="glass-card p-5 card-hover cursor-pointer border border-slate-200" onClick={() => navigate('/leaves')}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-3xl font-extrabold text-blue-600">{leaveSummary.remaining}</span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-700">Ngày phép còn lại</h3>
                        <p className="text-slate-500 text-sm mt-1">Đã dùng: {leaveSummary.total_used || 0}/{leaveSummary.annual_quota || 12} ngày</p>
                    </div>
                )}

                {/* Tasks Widget */}
                <div 
                    className="glass-card p-5 card-hover cursor-pointer border border-slate-200" 
                    onClick={() => navigate(isManager ? '/projects' : '/tasks')}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl font-extrabold text-purple-600">
                            {taskStats.completed}<span className="text-xl text-slate-400">/{taskStats.total}</span>
                        </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-700">
                        {isManager ? 'Tổng tiến độ dự án' : 'Tiến độ cá nhân'}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                        Hoàn thành: {taskStats.completed} | Đang chờ: {taskStats.pending}
                    </p>
                </div>

                {/* HR Widget - Pending Leaves */}
                {isManager ? (
                    <div className="glass-card p-5 card-hover cursor-pointer border border-slate-200" onClick={() => navigate('/leaves')}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-3xl font-extrabold ${pendingLeaves > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {pendingLeaves}
                            </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-700">Yêu cầu xin nghỉ</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            {pendingLeaves > 0 ? 'Có đơn đang đợi duyệt' : 'Chưa có đơn mới'}
                        </p>
                    </div>
                ) : (
                    <div className="glass-card p-5 card-hover cursor-pointer border border-slate-200" onClick={() => navigate('/projects')}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-3xl font-extrabold text-orange-500">—</span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-700">Khám phá nội bộ</h3>
                        <p className="text-slate-500 text-sm mt-1">Xem dự án của công ty</p>
                    </div>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Attendance Pie Chart */}
                <div className="glass-card p-6 border border-slate-200">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Tỷ lệ chấm công tháng này</h3>
                        <p className="text-sm text-slate-500 mt-1">Dữ liệu thời gian thực được tính toán từ các lượt quét khuôn mặt</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <defs>
                                <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                                </linearGradient>
                                <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fcd34d" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#d97706" stopOpacity={1} />
                                </linearGradient>
                                <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fca5a5" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#dc2626" stopOpacity={1} />
                                </linearGradient>
                                <filter id="shadowPie" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
                                </filter>
                            </defs>
                            <Pie
                                data={pieDataToRender}
                                cx="50%"
                                cy="50%"
                                innerRadius={75}
                                outerRadius={105}
                                paddingAngle={6}
                                dataKey="value"
                                stroke="none"
                                cornerRadius={8}
                                filter="url(#shadowPie)"
                            >
                                {pieDataToRender.map((entry, index) => {
                                    let fillId = entry.color
                                    if (entry.name === 'Đúng giờ') fillId = 'url(#colorOnTime)';
                                    else if (entry.name === 'Đi muộn') fillId = 'url(#colorLate)';
                                    else if (entry.name === 'Vắng mặt') fillId = 'url(#colorAbsent)';
                                    return <Cell key={`cell-${index}`} fill={fillId} />
                                })}
                            </Pie>
                            {!emptyPieData && (
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '12px', 
                                        border: 'none', 
                                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                        padding: '12px'
                                    }}
                                    itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                                />
                            )}
                            <Legend 
                                verticalAlign="bottom" 
                                height={36} 
                                iconType="circle"
                                wrapperStyle={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Monthly Bar Chart */}
                <div className="glass-card p-6 border border-slate-200">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Thống kê 6 tháng gần nhất</h3>
                        <p className="text-sm text-slate-500 mt-1">Lịch sử tình trạng chuyên cần thực tế</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartBarData} barGap={6} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="barOnTime" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                                </linearGradient>
                                <linearGradient id="barLate" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fcd34d" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#d97706" stopOpacity={1} />
                                </linearGradient>
                                <linearGradient id="barAbsent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fca5a5" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#dc2626" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} 
                                dy={10} 
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} 
                            />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                                    padding: '12px'
                                }}
                                itemStyle={{ fontWeight: 600 }}
                            />
                            <Legend 
                                iconType="circle" 
                                wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 600, color: '#475569' }}
                            />
                            <Bar dataKey="onTime" name="Đúng giờ" fill="url(#barOnTime)" maxBarSize={16} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="late" name="Đi muộn" fill="url(#barLate)" maxBarSize={16} radius={[6, 6, 0, 0]} />
                            {/* Absent counts are not reliably calculated per month right now, but left here for future */}
                            {/* <Bar dataKey="absent" name="Vắng" fill="url(#barAbsent)" maxBarSize={16} radius={[6, 6, 0, 0]} /> */}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Employee Performance (Leaders/Admins only) */}
            {isManager && performance.length > 0 && (
                <div className="glass-card p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Top hiệu suất nhân viên</h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left py-4 px-5 text-slate-600 font-bold tracking-wide uppercase text-xs">Nhân viên</th>
                                    <th className="text-center py-4 px-5 text-slate-600 font-bold tracking-wide uppercase text-xs">Tổng task</th>
                                    <th className="text-center py-4 px-5 text-slate-600 font-bold tracking-wide uppercase text-xs">Hoàn thành</th>
                                    <th className="text-center py-4 px-5 text-slate-600 font-bold tracking-wide uppercase text-xs">Đang xử lý</th>
                                    <th className="text-center py-4 px-5 text-slate-600 font-bold tracking-wide uppercase text-xs">Tỷ lệ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {performance.slice(0, 5).map((emp) => (
                                    <tr key={emp.user_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                    {emp.full_name?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{emp.full_name}</p>
                                                    <p className="text-xs font-semibold text-slate-500">{emp.department}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center py-4 px-5 font-bold text-slate-700">{emp.total_tasks}</td>
                                        <td className="text-center py-4 px-5 font-bold text-emerald-600">{emp.completed_tasks}</td>
                                        <td className="text-center py-4 px-5 font-bold text-blue-600">{emp.in_progress_tasks}</td>
                                        <td className="text-center py-4 px-5">
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider ${emp.completion_rate >= 80 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                emp.completion_rate >= 50 ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                    'bg-rose-50 text-rose-600 border border-rose-100'
                                                }`}>
                                                {emp.completion_rate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

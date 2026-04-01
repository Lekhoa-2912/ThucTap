import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import api, { payrollAPI, userAPI } from '../api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

export default function PayrollPage() {
    const { user, hasRole } = useAuth()
    const [payrolls, setPayrolls] = useState([])
    const [selectedPayroll, setSelectedPayroll] = useState(null)
    const [loading, setLoading] = useState(true)
    const [currentMonth] = useState(new Date().getMonth() + 1)
    const [currentYear] = useState(new Date().getFullYear())

    const [showCalcModal, setShowCalcModal] = useState(false)
    const [usersList, setUsersList] = useState([])
    const [calcData, setCalcData] = useState({ user_id: '', month: currentMonth, year: currentYear, base_salary: '', bonuses: [] })
    const [calculating, setCalculating] = useState(false)

    const [showPenaltyModal, setShowPenaltyModal] = useState(false)
    const [penaltyData, setPenaltyData] = useState({ late_penalty: 50000, early_leave_penalty: 50000, absent_penalty: 200000 })
    const [savingPenalty, setSavingPenalty] = useState(false)

    const isAdminOrAccountant = hasRole(['SUPER_ADMIN', 'ACCOUNTANT'])

    useEffect(() => {
        loadPayrolls()
        if (isAdminOrAccountant) {
            loadUsers()
        }
    }, [])

    const handleOpenPenaltyModal = async () => {
        try {
            const res = await api.get('/api/settings/company')
            setPenaltyData({
                late_penalty: res.data.late_penalty || 50000,
                early_leave_penalty: res.data.early_leave_penalty || 50000,
                absent_penalty: res.data.absent_penalty || 200000
            })
            setShowPenaltyModal(true)
        } catch (error) {
            toast.error('Lỗi khi tải cấu hình phạt')
        }
    }

    const handleSavePenalty = async () => {
        if (!hasRole(['SUPER_ADMIN'])) {
            toast.error('Chỉ Super Admin mới được thay đổi cấu hình')
            return
        }
        setSavingPenalty(true)
        try {
            await api.put('/api/settings/company', penaltyData)
            toast.success('Đã lưu cấu hình phạt')
            setShowPenaltyModal(false)
        } catch (error) {
            toast.error('Lỗi khi lưu cấu hình')
        } finally {
            setSavingPenalty(false)
        }
    }

    const loadUsers = async () => {
        try {
            const res = await userAPI.listUsers(null, null)
            setUsersList(res.data)
        } catch (error) {
            console.error('Failed to load users:', error)
        }
    }

    const loadPayrolls = async () => {
        try {
            let response
            if (isAdminOrAccountant) {
                response = await payrollAPI.getPayrolls(currentMonth, currentYear)
            } else {
                response = await payrollAPI.getMyPayroll()
            }
            setPayrolls(response.data)
        } catch (error) {
            console.error('Failed to load payrolls:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (payrollIds) => {
        try {
            await payrollAPI.approvePayrolls(payrollIds)
            toast.success('Đã duyệt bảng lương')
            loadPayrolls()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Duyệt thất bại')
        }
    }

    const handlePay = async (payrollId) => {
        try {
            await payrollAPI.payPayroll(payrollId, 'BANK_TRANSFER')
            toast.success('Đã thanh toán')
            loadPayrolls()
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Thanh toán thất bại')
        }
    }

    const handleCalculate = async () => {
        if (!calcData.user_id || !calcData.base_salary) {
            toast.error('Vui lòng chọn nhân viên và nhập lương cơ bản')
            return
        }
        setCalculating(true)
        try {
            await payrollAPI.calculatePayroll(calcData.user_id, calcData.month, calcData.year, Number(calcData.base_salary), calcData.bonuses)
            toast.success('Tính lương thành công')
            setShowCalcModal(false)
            loadPayrolls()
            setCalcData({ ...calcData, user_id: '', base_salary: '' })
        } catch (error) {
            toast.error(error.response?.data?.detail || 'Tính lương thất bại')
        } finally {
            setCalculating(false)
        }
    }

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount)
    }

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PAID':
                return <span className="status-active px-2 py-1 rounded-full text-xs">Đã thanh toán</span>
            case 'APPROVED':
                return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded-full text-xs">Đã duyệt</span>
            default:
                return <span className="status-pending px-2 py-1 rounded-full text-xs">Nháp</span>
        }
    }

    if (loading) {
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
                    <h1 className="text-2xl font-bold">Quản lý bảng lương</h1>
                    <p className="text-slate-400">
                        {isAdminOrAccountant ? 'Quản lý và phê duyệt bảng lương' : 'Xem lịch sử bảng lương của bạn'}
                    </p>
                </div>
                {isAdminOrAccountant && (
                    <div className="flex gap-4">
                        {hasRole(['SUPER_ADMIN']) && (
                            <button onClick={handleOpenPenaltyModal} className="btn-secondary">⚙️ Cấu hình phạt</button>
                        )}
                        <button onClick={() => setShowCalcModal(true)} className="btn-primary">+ Tính lương</button>
                    </div>
                )}
            </div>

            {/* Payroll List */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-700/50">
                                {isAdminOrAccountant && <th className="text-left py-4 px-6">Nhân viên</th>}
                                <th className="text-left py-4 px-6">Tháng</th>
                                <th className="text-right py-4 px-6">Lương cơ bản</th>
                                <th className="text-right py-4 px-6">Khấu trừ</th>
                                <th className="text-right py-4 px-6">Thưởng</th>
                                <th className="text-right py-4 px-6">Thực lĩnh</th>
                                <th className="text-center py-4 px-6">Ngày công</th>
                                <th className="text-center py-4 px-6">Trạng thái</th>
                                <th className="text-center py-4 px-6">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payrolls.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdminOrAccountant ? 9 : 8} className="text-center py-8 text-slate-400">
                                        Chưa có bảng lương nào
                                    </td>
                                </tr>
                            ) : (
                                payrolls.map(payroll => (
                                    <tr key={payroll.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                                        {isAdminOrAccountant && (
                                            <td className="py-4 px-6">
                                                <div>
                                                    <p className="font-medium">{payroll.user_name}</p>
                                                    <p className="text-xs text-slate-400">{payroll.department}</p>
                                                </div>
                                            </td>
                                        )}
                                        <td className="py-4 px-6">
                                            {payroll.month}/{payroll.year}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {formatMoney(payroll.base_salary)}
                                        </td>
                                        <td className="py-4 px-6 text-right text-red-400">
                                            -{formatMoney(payroll.total_deductions)}
                                        </td>
                                        <td className="py-4 px-6 text-right text-green-400">
                                            +{formatMoney(payroll.total_bonuses)}
                                        </td>
                                        <td className="py-4 px-6 text-right font-bold text-blue-400">
                                            {formatMoney(payroll.net_salary)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div>
                                                <span>{payroll.working_days}</span>
                                                {payroll.late_days > 0 && (
                                                    <p className="text-xs text-red-400">({payroll.late_days} ngày muộn)</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {getStatusBadge(payroll.status)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <button
                                                    onClick={() => setSelectedPayroll(payroll)}
                                                    className="text-blue-400 hover:underline text-sm"
                                                >
                                                    Chi tiết
                                                </button>
                                                {hasRole(['SUPER_ADMIN']) && payroll.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleApprove([payroll.id])}
                                                        className="text-green-400 hover:underline text-sm"
                                                    >
                                                        Duyệt
                                                    </button>
                                                )}
                                                {hasRole(['SUPER_ADMIN', 'ACCOUNTANT']) && payroll.status === 'APPROVED' && (
                                                    <button
                                                        onClick={() => handlePay(payroll.id)}
                                                        className="text-purple-400 hover:underline text-sm"
                                                    >
                                                        Thanh toán
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payroll Detail Modal */}
            {selectedPayroll && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold">Chi tiết bảng lương</h3>
                            <button
                                onClick={() => setSelectedPayroll(null)}
                                className="text-slate-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Nhân viên</span>
                                <span className="font-medium">{selectedPayroll.user_name}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Kỳ lương</span>
                                <span className="font-medium">{selectedPayroll.month}/{selectedPayroll.year}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Lương cơ bản</span>
                                <span className="font-medium">{formatMoney(selectedPayroll.base_salary)}</span>
                            </div>

                            {/* Deductions */}
                            {selectedPayroll.deductions?.length > 0 && (
                                <div className="py-2 border-b border-slate-700">
                                    <p className="text-slate-400 mb-2">Khấu trừ:</p>
                                    {selectedPayroll.deductions.map((d, i) => (
                                        <div key={i} className="flex justify-between text-sm ml-4">
                                            <span className="text-red-300">- {d.description}</span>
                                            <span className="text-red-400">{formatMoney(d.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Bonuses */}
                            {selectedPayroll.bonuses?.length > 0 && (
                                <div className="py-2 border-b border-slate-700">
                                    <p className="text-slate-400 mb-2">Thưởng:</p>
                                    {selectedPayroll.bonuses.map((b, i) => (
                                        <div key={i} className="flex justify-between text-sm ml-4">
                                            <span className="text-green-300">+ {b.description}</span>
                                            <span className="text-green-400">{formatMoney(b.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Tổng khấu trừ</span>
                                <span className="text-red-400 font-medium">-{formatMoney(selectedPayroll.total_deductions)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-slate-700">
                                <span className="text-slate-400">Tổng thưởng</span>
                                <span className="text-green-400 font-medium">+{formatMoney(selectedPayroll.total_bonuses)}</span>
                            </div>
                            <div className="flex justify-between py-3 bg-blue-500/10 rounded-lg px-4">
                                <span className="font-semibold">THỰC LĨNH</span>
                                <span className="text-xl font-bold text-blue-400">{formatMoney(selectedPayroll.net_salary)}</span>
                            </div>

                            {selectedPayroll.paid_at && (
                                <p className="text-center text-sm text-slate-400">
                                    Đã thanh toán: {format(new Date(selectedPayroll.paid_at), 'dd/MM/yyyy HH:mm')}
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => setSelectedPayroll(null)}
                            className="w-full btn-secondary mt-6"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
            {/* Calculate Payroll Modal */}
            {showCalcModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold">Tính lương tháng {currentMonth}/{currentYear}</h3>
                            <button onClick={() => setShowCalcModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Nhân viên</label>
                                <select 
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3"
                                    value={calcData.user_id}
                                    onChange={(e) => {
                                        const uid = e.target.value
                                        const selectedU = usersList.find(u => u.id === uid)
                                        setCalcData({ ...calcData, user_id: uid, base_salary: selectedU?.base_salary || 0 })
                                    }}
                                >
                                    <option value="">Chọn nhân viên</option>
                                    {usersList.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name || u.email} ({u.department || 'Chưa xếp'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Lương cơ bản (VND)</label>
                                <input 
                                    type="number" 
                                    value={calcData.base_salary} 
                                    onChange={(e) => setCalcData({ ...calcData, base_salary: e.target.value })} 
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" 
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button onClick={() => setShowCalcModal(false)} className="flex-1 btn-secondary" disabled={calculating}>Hủy</button>
                            <button onClick={handleCalculate} className="flex-1 btn-primary" disabled={calculating}>{calculating ? 'Đang xử lý...' : 'Tính lương'}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Penalty Configuration Modal */}
            {showPenaltyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold">Cấu hình mức phạt chuyên cần</h3>
                            <button onClick={() => setShowPenaltyModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Phạt đi muộn / ngày (VNĐ)</label>
                                <input 
                                    type="number" 
                                    value={penaltyData.late_penalty} 
                                    onChange={(e) => setPenaltyData({ ...penaltyData, late_penalty: Number(e.target.value) })} 
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Phạt về sớm / ngày (VNĐ)</label>
                                <input 
                                    type="number" 
                                    value={penaltyData.early_leave_penalty} 
                                    onChange={(e) => setPenaltyData({ ...penaltyData, early_leave_penalty: Number(e.target.value) })} 
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Phạt vắng mặt / ngày (VNĐ)</label>
                                <input 
                                    type="number" 
                                    value={penaltyData.absent_penalty} 
                                    onChange={(e) => setPenaltyData({ ...penaltyData, absent_penalty: Number(e.target.value) })} 
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3" 
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                            <button onClick={() => setShowPenaltyModal(false)} className="flex-1 btn-secondary" disabled={savingPenalty}>Hủy</button>
                            <button onClick={handleSavePenalty} className="flex-1 btn-primary" disabled={savingPenalty}>{savingPenalty ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

from datetime import datetime
from typing import List, Optional
from ..database import get_attendance_collection, get_users_collection
from ..models.attendance import AttendanceStatus
from ..models.payroll import Payroll, PayrollDeduction, PayrollStatus

class PayrollService:
    """
    Payroll calculation service.
    Automatically calculates salary based on attendance logs.
    """
    
    async def _get_penalty_rates(self):
        from ..database import get_database
        db = get_database()
        settings = await db["settings"].find_one({"type": "company"})
        if settings:
            return {
                "late": settings.get("late_penalty", 50000),
                "early_leave": settings.get("early_leave_penalty", 50000),
                "absent": settings.get("absent_penalty", 200000)
            }
        return {"late": 50000, "early_leave": 50000, "absent": 200000}
    
    async def calculate_working_days(self, user_id: str, month: int, year: int) -> dict:
        """Calculate working statistics for a user in a specific month"""
        attendance_col = get_attendance_collection()
        
        # Get all attendance logs for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        logs = await attendance_col.find({
            "user_id": user_id,
            "timestamp": {"$gte": start_date, "$lt": end_date}
        }).to_list(None)
        
        # Count different statuses
        late_days = set()
        early_leave_days = set()
        on_time_days = set()
        
        for log in logs:
            day = log["timestamp"].date()
            status = log.get("status")
            
            if status == AttendanceStatus.LATE.value:
                late_days.add(day)
            elif status == AttendanceStatus.EARLY_LEAVE.value:
                early_leave_days.add(day)
            elif status == AttendanceStatus.ON_TIME.value:
                on_time_days.add(day)
        
        # Calculate working days in month (excluding weekends)
        import calendar
        total_working_days = 0
        cal = calendar.monthcalendar(year, month)
        for week in cal:
            for i, day in enumerate(week):
                if day != 0 and i < 5:  # Monday to Friday
                    total_working_days += 1
        
        actual_days = len(late_days | early_leave_days | on_time_days)
        absent_days = total_working_days - actual_days
        
        return {
            "total_working_days": total_working_days,
            "actual_working_days": actual_days,
            "late_days": len(late_days),
            "early_leave_days": len(early_leave_days),
            "absent_days": max(0, absent_days)
        }
    
    async def calculate_payroll(
        self, 
        user_id: str, 
        month: int, 
        year: int,
        base_salary: float,
        bonuses: List[dict] = None
    ) -> Payroll:
        """
        Calculate payroll for a user.
        
        Formula:
        Net Salary = Base Salary - Deductions + Bonuses
        
        Deductions:
        - Late days * LATE_DEDUCTION_RATE
        - Early leave days * EARLY_LEAVE_DEDUCTION_RATE
        - Absent days * ABSENT_DEDUCTION_RATE
        """
        users_col = get_users_collection()
        user = await users_col.find_one({"_id": user_id})
        
        # Get working statistics
        stats = await self.calculate_working_days(user_id, month, year)
        
        # Get dynamic penalty rates
        penalties = await self._get_penalty_rates()
        
        # Calculate deductions
        deductions = []
        
        if stats["late_days"] > 0:
            deductions.append(PayrollDeduction(
                type="late",
                description=f"Đi muộn {stats['late_days']} ngày",
                amount=stats["late_days"] * penalties["late"]
            ))
        
        if stats["early_leave_days"] > 0:
            deductions.append(PayrollDeduction(
                type="early_leave",
                description=f"Về sớm {stats['early_leave_days']} ngày",
                amount=stats["early_leave_days"] * penalties["early_leave"]
            ))
        
        if stats["absent_days"] > 0:
            deductions.append(PayrollDeduction(
                type="absent",
                description=f"Vắng mặt {stats['absent_days']} ngày",
                amount=stats["absent_days"] * penalties["absent"]
            ))
        
        total_deductions = sum(d.amount for d in deductions)
        total_bonuses = sum(b.get("amount", 0) for b in (bonuses or []))
        net_salary = base_salary - total_deductions + total_bonuses
        
        payroll = Payroll(
            user_id=user_id,
            user_name=user.get("full_name", "Unknown") if user else "Unknown",
            department=user.get("department") if user else None,
            month=month,
            year=year,
            total_working_days=stats["total_working_days"],
            actual_working_days=stats["actual_working_days"],
            late_days=stats["late_days"],
            early_leave_days=stats["early_leave_days"],
            absent_days=stats["absent_days"],
            base_salary=base_salary,
            deductions=deductions,
            bonuses=bonuses or [],
            total_deductions=total_deductions,
            total_bonuses=total_bonuses,
            net_salary=max(0, net_salary),
            status=PayrollStatus.DRAFT
        )
        
        return payroll
    
    def generate_payment_qr(self, payroll: Payroll, bank_account: str) -> str:
        """
        Generate QR code for bank transfer.
        Uses VietQR format.
        """
        # Simple QR content for bank transfer
        # In production, use VietQR API
        qr_content = f"BANK_TRANSFER|{bank_account}|{payroll.net_salary}|{payroll.user_name}|Luong_thang_{payroll.month}_{payroll.year}"
        return qr_content

# Singleton instance
payroll_service = PayrollService()

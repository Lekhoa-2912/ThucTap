import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuth } from './context/AuthContext'

// Components (keep synchronous - small and always needed)
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'

// Loading component
const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-slate-400">Đang tải...</p>
        </div>
    </div>
)

// Lazy load pages - code splitting for faster initial load
const LoginPage = lazy(() => import('./pages/LoginPage'))
const LogoutPage = lazy(() => import('./pages/LogoutPage'))
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage'))
const FaceEnrollmentPage = lazy(() => import('./pages/FaceEnrollmentPage'))
const PendingPage = lazy(() => import('./pages/PendingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const PayrollPage = lazy(() => import('./pages/PayrollPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const AdminPendingPage = lazy(() => import('./pages/AdminPendingPage'))
const AdminFaceEnrollPage = lazy(() => import('./pages/AdminFaceEnrollPage'))
const AdminAttendancePage = lazy(() => import('./pages/AdminAttendancePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'))
const LeavesPage = lazy(() => import('./pages/LeavesPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const OvertimePage = lazy(() => import('./pages/OvertimePage'))
const KPIPage = lazy(() => import('./pages/KPIPage'))
const ContractsPage = lazy(() => import('./pages/ContractsPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const AdminPasswordResetPage = lazy(() => import('./pages/AdminPasswordResetPage'))

// Layout with Sidebar
function MainLayout({ children }) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-6 transition-all duration-300">
                {children}
            </main>
        </div>
    )
}


export default function App() {
    const { loading, isAuthenticated, needsProfileSetup, isPending } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner"></div>
            </div>
        )
    }

    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* Public Routes */}
                <Route
                    path="/login"
                    element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />}
                />
                <Route path="/logout" element={<LogoutPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                {/* Onboarding Routes */}
                <Route
                    path="/setup-profile"
                    element={
                        isAuthenticated && needsProfileSetup
                            ? <ProfileSetupPage />
                            : <Navigate to="/dashboard" />
                    }
                />
                <Route
                    path="/face-enrollment"
                    element={
                        isAuthenticated
                            ? <FaceEnrollmentPage />
                            : <Navigate to="/dashboard" />
                    }
                />
                <Route
                    path="/pending"
                    element={
                        isAuthenticated && isPending
                            ? <PendingPage />
                            : <Navigate to="/dashboard" />
                    }
                />

                {/* Protected Routes with Sidebar Layout */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <MainLayout><DashboardPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/attendance"
                    element={
                        <ProtectedRoute roles={['SUPER_ADMIN', 'LEADER', 'EMPLOYEE']}>
                            <MainLayout><AttendancePage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/chat"
                    element={
                        <ProtectedRoute>
                            <MainLayout><ChatPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects"
                    element={
                        <ProtectedRoute>
                            <MainLayout><ProjectsPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/projects/:projectId"
                    element={
                        <ProtectedRoute>
                            <MainLayout><ProjectDetailPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/tasks"
                    element={
                        <ProtectedRoute>
                            <MainLayout><TasksPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/leaves"
                    element={
                        <ProtectedRoute>
                            <MainLayout><LeavesPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/reports"
                    element={
                        <ProtectedRoute>
                            <MainLayout><ReportsPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/calendar"
                    element={
                        <ProtectedRoute>
                            <MainLayout><CalendarPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/overtime"
                    element={
                        <ProtectedRoute>
                            <MainLayout><OvertimePage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/kpi"
                    element={
                        <ProtectedRoute>
                            <MainLayout><KPIPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/contracts"
                    element={
                        <ProtectedRoute>
                            <MainLayout><ContractsPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/payroll"
                    element={
                        <ProtectedRoute>
                            <MainLayout><PayrollPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <MainLayout><ProfilePage /></MainLayout>
                        </ProtectedRoute>
                    }
                />

                {/* Admin Routes */}
                <Route
                    path="/admin/users"
                    element={
                        <ProtectedRoute roles={['SUPER_ADMIN', 'HR_MANAGER']}>
                            <MainLayout><AdminUsersPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/pending"
                    element={
                        <ProtectedRoute roles={['SUPER_ADMIN', 'HR_MANAGER']}>
                            <MainLayout><AdminPendingPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/face-enroll/:userId"
                    element={
                        <ProtectedRoute roles={['SUPER_ADMIN', 'HR_MANAGER']}>
                            <MainLayout><AdminFaceEnrollPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin/password-reset"
                    element={
                        <ProtectedRoute roles={['SUPER_ADMIN', 'HR_MANAGER']}>
                            <MainLayout><AdminPasswordResetPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <ProtectedRoute roles={['SUPER_ADMIN']}>
                            <MainLayout><SettingsPage /></MainLayout>
                        </ProtectedRoute>
                    }
                />

                {/* Default Redirect */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Suspense>
    )
}

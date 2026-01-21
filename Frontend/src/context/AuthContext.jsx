import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [loading, setLoading] = useState(true)

    // Load user on mount
    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                try {
                    const response = await authAPI.getMe()
                    setUser(response.data)
                } catch (error) {
                    console.error('Failed to load user:', error)
                    logout()
                }
            }
            setLoading(false)
        }
        loadUser()
    }, [token])

    const login = async (email, password) => {
        const response = await authAPI.login(email, password)
        const { access_token, user: userData } = response.data

        localStorage.setItem('token', access_token)
        localStorage.setItem('user', JSON.stringify(userData))

        setToken(access_token)
        setUser(userData)

        return userData
    }

    const logout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
    }

    const updateUser = (userData) => {
        setUser(prev => ({ ...prev, ...userData }))
        localStorage.setItem('user', JSON.stringify({ ...user, ...userData }))
    }

    const isAuthenticated = !!token && !!user

    const hasRole = (roles) => {
        if (!user || !user.role) return false

        // Normalize user role: uppercase and handle team_leader -> LEADER
        const normalizedUserRole = user.role.toUpperCase().replace('TEAM_LEADER', 'LEADER')

        // Handle single role or array of roles
        const roleList = typeof roles === 'string' ? [roles] : roles

        // Check if user's normalized role matches any of the required roles
        return roleList.some(r => {
            const normalizedRequired = r.toUpperCase().replace('TEAM_LEADER', 'LEADER')
            return normalizedUserRole === normalizedRequired
        })
    }

    const isActive = user?.status?.toUpperCase() === 'ACTIVE'
    const needsProfileSetup = user?.status?.toUpperCase() === 'INIT'
    const isPending = user?.status?.toUpperCase() === 'PENDING'

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            isAuthenticated,
            isActive,
            needsProfileSetup,
            isPending,
            login,
            logout,
            updateUser,
            hasRole
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

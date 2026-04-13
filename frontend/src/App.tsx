import React, { useEffect, useMemo, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './AppLayout'
import LoginPage from './pages/Login'
import ConfigPage from './pages/Config'
import GroupsPage from './pages/Groups'
import WorkbenchPage from './pages/Workbench'
import TaskDetailPage from './pages/Workbench/TaskDetail'
import TeamHealthPage from './pages/Analytics'
import { useAppStore } from './store'

const isAuthenticated = () => !!localStorage.getItem('token')

const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  return isAuthenticated() ? <>{element}</> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute element={<AppLayout />} />,
    children: [
      { index: true, element: <Navigate to="/config" replace /> },
      { path: 'config', element: <ConfigPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'workbench', element: <WorkbenchPage /> },
      { path: 'workbench/task/:taskId', element: <TaskDetailPage /> },
      { path: 'analytics/team-health', element: <TeamHealthPage /> },
    ],
  },
])

type ResolvedTheme = 'light' | 'dark'

const getSystemTheme = (): ResolvedTheme => {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const App: React.FC = () => {
  const themeMode = useAppStore((s) => s.themeMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light')
    onChange()

    mq.addEventListener('change', onChange)

    return () => {
      mq.removeEventListener('change', onChange)
    }
  }, [])

  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const antdTheme = useMemo(() => {
    const algorithm = resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm
    const baseToken = {
      colorPrimary: '#667eea',
      borderRadius: 8,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }

    if (resolvedTheme === 'dark') {
      return {
        algorithm,
        token: {
          ...baseToken,
          colorBgContainer: 'rgba(255,255,255,0.04)',
          colorBgElevated: '#1a1a2e',
        },
      }
    }

    return {
      algorithm,
      token: {
        ...baseToken,
      },
    }
  }, [resolvedTheme])

  return (
    <ConfigProvider locale={zhCN} theme={antdTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

export default App

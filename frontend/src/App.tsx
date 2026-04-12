import React from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AppLayout from './AppLayout'
import LoginPage from './pages/Login'
import ConfigPage from './pages/Config'
import GroupsPage from './pages/Groups'
import WorkbenchPage from './pages/Workbench'
import TaskDetailPage from './pages/Workbench/TaskDetail'

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
    ],
  },
])

const App: React.FC = () => (
  <ConfigProvider
    locale={zhCN}
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#667eea',
        borderRadius: 8,
        fontFamily: 'Inter, -apple-system, sans-serif',
        colorBgContainer: 'rgba(255,255,255,0.04)',
        colorBgElevated: '#1a1a2e',
      },
    }}
  >
    <RouterProvider router={router} />
  </ConfigProvider>
)

export default App

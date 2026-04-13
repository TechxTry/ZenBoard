import { Layout, Menu, Select, Space, Typography, Avatar } from 'antd'
import {
  SettingOutlined, TeamOutlined, BarChartOutlined, LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAppStore } from './store'
import { listGroups } from './api'
import { useEffect, useMemo, useState } from 'react'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface Group { id: number; name: string }

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedGroupId, setGroup, themeMode, setThemeMode } = useAppStore()
  const [groups, setGroups] = useState<Group[]>([])
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(mq.matches ? 'dark' : 'light')
    onChange()

    mq.addEventListener('change', onChange)

    return () => {
      mq.removeEventListener('change', onChange)
    }
  }, [])

  const resolvedTheme = useMemo<'light' | 'dark'>(
    () => (themeMode === 'system' ? systemTheme : themeMode),
    [systemTheme, themeMode],
  )

  useEffect(() => {
    listGroups().then((d: { data: Group[] }) => {
      setGroups(d.data ?? [])
      if (!selectedGroupId && d.data?.length > 0) {
        setGroup(d.data[0].id, d.data[0].name)
      }
    }).catch(() => {})
  }, [])

  const selectedKey = location.pathname.startsWith('/groups')
    ? '/groups'
    : location.pathname.startsWith('/analytics')
    ? '/analytics/team-health'
    : location.pathname.startsWith('/workbench')
    ? '/workbench'
    : '/config'

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <Layout
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--app-bg)',
      }}
    >
      <Sider
        theme={resolvedTheme}
        width={220}
        style={{
          height: '100vh',
          overflowY: 'auto',
          position: 'relative',
          background: 'var(--app-sider-bg)',
          borderRight: '1px solid var(--app-sider-border)',
        }}
      >
        <div style={{
          padding: '24px 20px 16px',
          borderBottom: '1px solid var(--app-sider-border)',
          marginBottom: 8,
        }}>
          <Space>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--app-brand-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🧘</div>
            <Text strong style={{ fontSize: 15 }}>ZenBoard</Text>
          </Space>
        </div>

        <Menu
          theme={resolvedTheme}
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ background: 'transparent', border: 'none', padding: '0 8px' }}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/config', icon: <SettingOutlined />, label: '系统配置' },
            { key: '/groups', icon: <TeamOutlined />, label: '项目组管理' },
            { key: '/workbench', icon: <BarChartOutlined />, label: '数据工作台' },
            { key: '/analytics/team-health', icon: <BarChartOutlined />, label: '负荷与健康度' },
          ]}
        />

        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 16px' }}>
          <div
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 8, cursor: 'pointer', color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
              transition: 'all .2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = resolvedTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogoutOutlined /> 退出登录
          </div>
        </div>
      </Sider>

      <Layout
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header
          style={{
            flexShrink: 0,
            background: 'var(--app-header-bg)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--app-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', height: 56,
          }}
        >
          <Text style={{ color: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)', fontSize: 13 }}>
            当前视角：项目组
          </Text>
          <Space>
            <Select
              value={themeMode}
              onChange={(val) => setThemeMode(val)}
              style={{ width: 140 }}
              options={[
                { value: 'system', label: '跟随系统' },
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
              ]}
            />
            <Select
              placeholder="选择项目组"
              value={selectedGroupId ?? undefined}
              onChange={(val, opt: any) => setGroup(val, opt.label)}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              style={{ width: 200 }}
              variant="filled"
            />
            <Avatar
              style={{ background: 'var(--app-brand-gradient)', cursor: 'default' }}
              size={32}
            >A</Avatar>
          </Space>
        </Header>

        <Content
          style={{
            flex: 1,
            minHeight: 0,
            margin: 24,
            background: 'transparent',
            borderRadius: 12,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AppLayout

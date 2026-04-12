import React from 'react'
import { Layout, Menu, Select, Space, Typography, Avatar } from 'antd'
import {
  SettingOutlined, TeamOutlined, BarChartOutlined, LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAppStore } from './store'
import { listGroups } from './api'
import { useEffect, useState } from 'react'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface Group { id: number; name: string }

const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedGroupId, setGroup } = useAppStore()
  const [groups, setGroups] = useState<Group[]>([])

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
        background: '#0d0d1a',
      }}
    >
      <Sider
        theme="dark"
        width={220}
        style={{
          height: '100vh',
          overflowY: 'auto',
          position: 'relative',
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{
          padding: '24px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 8,
        }}>
          <Space>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🧘</div>
            <Text strong style={{ color: '#fff', fontSize: 15 }}>ZenBoard</Text>
          </Space>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ background: 'transparent', border: 'none', padding: '0 8px' }}
          onClick={({ key }) => navigate(key)}
          items={[
            { key: '/config', icon: <SettingOutlined />, label: '系统配置' },
            { key: '/groups', icon: <TeamOutlined />, label: '项目组管理' },
            { key: '/workbench', icon: <BarChartOutlined />, label: '数据工作台' },
          ]}
        />

        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, padding: '0 16px' }}>
          <div
            onClick={logout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
              transition: 'all .2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
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
            background: 'rgba(13,13,26,0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', height: 56,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            当前视角：项目组
          </Text>
          <Space>
            <Select
              placeholder="选择项目组"
              value={selectedGroupId ?? undefined}
              onChange={(val, opt: any) => setGroup(val, opt.label)}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
              style={{ width: 200 }}
              variant="filled"
            />
            <Avatar
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', cursor: 'default' }}
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

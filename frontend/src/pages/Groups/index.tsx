import React, { useEffect, useMemo, useState } from 'react'
import { Row, Col, Card, Button, Input, Modal, Form, Transfer, Table, Space,
  Typography, Popconfirm, message, Tag, Spin } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { listGroups, createGroup, updateGroup, deleteGroup,
  getGroupMembers, updateGroupMembers, listUsers } from '../../api'

const { Title, Text } = Typography

interface Group { id: number; name: string; description: string }
interface User { id: number; account: string; realname: string; role: string }

const cardStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
}

const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [targetKeys, setTargetKeys] = useState<string[]>([])
  /** 已选成员账号 → 姓名（来自接口 JOIN local_users，与左侧展示规则一致） */
  const [memberRealnames, setMemberRealnames] = useState<Record<string, string>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Group | null>(null)
  const [loading, setLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [form] = Form.useForm()

  useEffect(() => { fetchGroups() }, [])
  useEffect(() => { fetchUsers() }, [userSearch])
  useEffect(() => {
    if (selectedGroup) fetchMembers(selectedGroup.id)
  }, [selectedGroup])

  const fetchGroups = async () => {
    const d = await listGroups()
    setGroups(d.data ?? [])
  }

  const fetchUsers = async () => {
    const d = await listUsers({ q: userSearch, page: 1, page_size: 200 })
    setUsers(d.data ?? [])
  }

  const fetchMembers = async (groupId: number) => {
    setLoading(true)
    try {
      const d = await getGroupMembers(groupId) as {
        accounts?: string[]
        members?: { account: string; realname: string }[]
      }
      setTargetKeys(d.accounts ?? [])
      const map: Record<string, string> = {}
      for (const m of d.members ?? []) {
        if (m.account) map[m.account] = m.realname ?? ''
      }
      setMemberRealnames(map)
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditTarget(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (g: Group) => {
    setEditTarget(g)
    form.setFieldsValue({ name: g.name, description: g.description })
    setModalOpen(true)
  }

  const handleSaveGroup = async () => {
    const values = form.getFieldsValue()
    try {
      if (editTarget) {
        await updateGroup(editTarget.id, values)
        message.success('项目组已更新')
      } else {
        await createGroup(values)
        message.success('项目组已创建')
      }
      setModalOpen(false)
      fetchGroups()
    } catch (e: any) {
      message.error(e.response?.data?.error ?? '操作失败')
    }
  }

  const handleDelete = async (id: number) => {
    await deleteGroup(id)
    message.success('已删除')
    if (selectedGroup?.id === id) setSelectedGroup(null)
    fetchGroups()
  }

  const handleSaveMembers = async () => {
    if (!selectedGroup) return
    await updateGroupMembers(selectedGroup.id, targetKeys)
    message.success('成员已保存')
  }

  const formatUserLabel = (realname: string, account: string) => {
    const name = (realname || '').trim()
    return name ? `${name} (${account})` : `${account}（未同步姓名）`
  }

  // Transfer 只渲染 dataSource 里存在的 key；已选成员若被搜索/分页排除在 users 外，必须补一条否则右侧有数量无明细
  const transferDataSource = useMemo(() => {
    const fromUsers = users.map((u) => ({
      key: u.account,
      title: formatUserLabel(u.realname, u.account),
      description: u.role,
    }))
    const inList = new Set(users.map((u) => u.account))
    const extra = targetKeys
      .filter((acc) => acc && !inList.has(acc))
      .map((acc) => ({
        key: acc,
        title: formatUserLabel(memberRealnames[acc] ?? '', acc),
        description: '',
      }))
    return [...fromUsers, ...extra]
  }, [users, targetKeys, memberRealnames])

  return (
    <div>
      <Title level={4} style={{ color: '#fff', marginBottom: 24 }}>项目组管理</Title>
      <Row gutter={24}>
        {/* Group List */}
        <Col span={8}>
          <Card
            title={<Text style={{ color: '#fff' }}>项目组列表</Text>}
            style={cardStyle}
            styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none' }}>
                新建
              </Button>
            }
          >
            {groups.length === 0 && (
              <Text style={{ color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', padding: 24 }}>
                暂无项目组，点击新建
              </Text>
            )}
            {groups.map((g) => (
              <div
                key={g.id}
                onClick={() => setSelectedGroup(g)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  marginBottom: 6,
                  cursor: 'pointer',
                  transition: 'all .2s',
                  background: selectedGroup?.id === g.id
                    ? 'linear-gradient(135deg, rgba(102,126,234,0.2), rgba(118,75,162,0.2))'
                    : 'rgba(255,255,255,0.03)',
                  border: selectedGroup?.id === g.id
                    ? '1px solid rgba(102,126,234,0.4)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <TeamOutlined style={{ color: '#667eea' }} />
                    <Text style={{ color: '#fff', fontWeight: 500 }}>{g.name}</Text>
                  </Space>
                  <Space size={4} onClick={(e) => e.stopPropagation()}>
                    <Button size="small" type="text" icon={<EditOutlined />}
                      style={{ color: 'rgba(255,255,255,0.4)' }} onClick={() => openEdit(g)} />
                    <Popconfirm title="确认删除此项目组？" onConfirm={() => handleDelete(g.id)}>
                      <Button size="small" type="text" icon={<DeleteOutlined />}
                        style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </Popconfirm>
                  </Space>
                </div>
                {g.description && (
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4, display: 'block' }}>
                    {g.description}
                  </Text>
                )}
              </div>
            ))}
          </Card>
        </Col>

        {/* Member Transfer */}
        <Col span={16}>
          <Card
            title={
              <Text style={{ color: '#fff' }}>
                {selectedGroup ? `成员分配 — ${selectedGroup.name}` : '请选择项目组'}
              </Text>
            }
            style={cardStyle}
            styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            extra={
              selectedGroup && (
                <Button type="primary" onClick={handleSaveMembers}
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none' }}>
                  保存成员
                </Button>
              )
            }
          >
            {!selectedGroup ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
                ← 从左侧选择一个项目组开始分配成员
              </div>
            ) : (
              <Spin spinning={loading}>
                <div style={{ marginBottom: 12 }}>
                  <Input.Search
                    placeholder="搜索姓名/账号"
                    onSearch={setUserSearch}
                    onChange={(e) => !e.target.value && setUserSearch('')}
                    style={{ width: 240 }}
                    allowClear
                  />
                </div>
                <Transfer
                  dataSource={transferDataSource}
                  titles={[`全量人员 (${users.length})`, `已选成员 (${targetKeys.length})`]}
                  targetKeys={targetKeys}
                  onChange={(keys) => setTargetKeys(keys as string[])}
                  render={(item) => item.title ?? ''}
                  showSearch
                  listStyle={{ width: '100%', height: 380, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                />
              </Spin>
            )}
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal
        title={<Text style={{ color: '#fff' }}>{editTarget ? '编辑项目组' : '新建项目组'}</Text>}
        open={modalOpen}
        onOk={handleSaveGroup}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        styles={{ content: { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }, header: { background: '#1a1a2e' }, footer: { background: '#1a1a2e' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>组名</Text>}
            rules={[{ required: true, message: '请输入组名' }]}>
            <Input placeholder="如：后端团队" />
          </Form.Item>
          <Form.Item name="description" label={<Text style={{ color: 'rgba(255,255,255,0.7)' }}>描述</Text>}>
            <Input.TextArea placeholder="可选" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupsPage

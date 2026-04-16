import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Row, Col, Card, Button, Input, Modal, Form, Transfer, Table, Space,
  Typography, Popconfirm, message, Tag, Spin } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { listGroups, createGroup, updateGroup, deleteGroup,
  getGroupMembers, updateGroupMembers, listUsers } from '../../api'

const { Title, Text } = Typography

interface Group { id: number; name: string; description: string }
interface User { id: number; account: string; realname: string; role: string }

type TransferItem = {
  key: string
  title?: string
  description?: string
}

const cardStyle = {
  background: 'var(--zb-bg-surface)',
  border: '1px solid var(--zb-border-subtle)',
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
  const [userSearchInput, setUserSearchInput] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(20)
  const [userTotal, setUserTotal] = useState(0)
  const fetchUsersSeq = useRef(0)
  const [form] = Form.useForm()
  const transferWrapRef = useRef<HTMLDivElement | null>(null)
  const [transferListHeight, setTransferListHeight] = useState<number>(380)

  useEffect(() => { fetchGroups() }, [])
  useEffect(() => { fetchUsers() }, [userSearch, userPage, userPageSize])
  useEffect(() => {
    if (selectedGroup) fetchMembers(selectedGroup.id)
  }, [selectedGroup])

  useEffect(() => {
    const t = setTimeout(() => {
      setUserPage(1)
      setUserSearch(userSearchInput.trim())
    }, 250)
    return () => clearTimeout(t)
  }, [userSearchInput])

  const fetchGroups = async () => {
    const d = await listGroups()
    setGroups(d.data ?? [])
  }

  const fetchUsers = async () => {
    const seq = ++fetchUsersSeq.current
    const d = await listUsers({ q: userSearch, page: userPage, page_size: userPageSize }) as {
      data?: User[]
      total?: number
      page?: number
      page_size?: number
    }
    if (seq !== fetchUsersSeq.current) return
    setUsers(d.data ?? [])
    setUserTotal(d.total ?? 0)
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

  const leftTableColumns = useMemo(() => ([
    {
      title: '成员',
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => <Text style={{ color: 'var(--zb-text-primary)' }}>{v}</Text>,
    },
    {
      title: '角色',
      dataIndex: 'description',
      key: 'description',
      width: 120,
      render: (v: string) => (v ? <Tag color="blue">{v}</Tag> : null),
    },
  ]), [])

  const rightTableColumns = useMemo(() => ([
    {
      title: '已选成员',
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => <Text style={{ color: 'var(--zb-text-primary)' }}>{v}</Text>,
    },
  ]), [])

  useLayoutEffect(() => {
    const root = transferWrapRef.current
    if (!root) return

    const calc = () => {
      const lists = Array.from(root.querySelectorAll('.ant-transfer-list')) as HTMLElement[]
      if (lists.length === 0) return

      const maxScrollH = Math.max(...lists.map((el) => el.scrollHeight || 0))
      // 预留一点空间避免边框/阴影导致的微小溢出
      const desired = Math.ceil(maxScrollH + 2)

      const minH = 380
      const maxH = Math.max(minH, Math.floor(window.innerHeight - 260))
      const next = Math.min(maxH, Math.max(minH, desired))
      setTransferListHeight((prev) => (prev === next ? prev : next))
    }

    calc()
    const ro = new ResizeObserver(() => calc())
    ro.observe(root)
    window.addEventListener('resize', calc)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', calc)
    }
  }, [
    selectedGroup?.id,
    userSearch,
    userPage,
    userPageSize,
    userTotal,
    targetKeys.length,
    transferDataSource.length,
    loading,
  ])

  return (
    <div>
      <Title level={4} style={{ color: 'var(--zb-text-primary)', marginBottom: 24 }}>项目组管理</Title>
      <Row gutter={24}>
        {/* Group List */}
        <Col span={8}>
          <Card
            title={<Text style={{ color: 'var(--zb-text-primary)' }}>项目组列表</Text>}
            style={cardStyle}
            styles={{ header: { borderBottom: '1px solid var(--zb-border-subtle)' } }}
            extra={
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}
                style={{ background: 'var(--zb-brand-gradient)', border: 'none' }}>
                新建
              </Button>
            }
          >
            {groups.length === 0 && (
              <Text style={{ color: 'var(--zb-text-muted)', display: 'block', textAlign: 'center', padding: 24 }}>
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
                    ? 'var(--zb-primary-bg)'
                    : 'var(--zb-bg-surface-muted)',
                  border: selectedGroup?.id === g.id
                    ? '1px solid var(--zb-primary-text)'
                    : '1px solid var(--zb-border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <TeamOutlined style={{ color: 'var(--zb-primary-text)' }} />
                    <Text style={{ color: 'var(--zb-text-primary)', fontWeight: 500 }}>{g.name}</Text>
                  </Space>
                  <Space size={4} onClick={(e) => e.stopPropagation()}>
                    <Button size="small" type="text" icon={<EditOutlined />}
                      style={{ color: 'var(--zb-text-muted)' }} onClick={() => openEdit(g)} />
                    <Popconfirm title="确认删除此项目组？" onConfirm={() => handleDelete(g.id)}>
                      <Button size="small" type="text" icon={<DeleteOutlined />}
                        style={{ color: 'var(--zb-text-muted)' }} />
                    </Popconfirm>
                  </Space>
                </div>
                {g.description && (
                  <Text style={{ color: 'var(--zb-text-muted)', fontSize: 12, marginTop: 4, display: 'block' }}>
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
              <Text style={{ color: 'var(--zb-text-primary)' }}>
                {selectedGroup ? `成员分配 — ${selectedGroup.name}` : '请选择项目组'}
              </Text>
            }
            style={cardStyle}
            styles={{ header: { borderBottom: '1px solid var(--zb-border-subtle)' } }}
            extra={
              selectedGroup && (
                <Button type="primary" onClick={handleSaveMembers}
                  style={{ background: 'var(--zb-brand-gradient)', border: 'none' }}>
                  保存成员
                </Button>
              )
            }
          >
            {!selectedGroup ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--zb-text-muted)' }}>
                ← 从左侧选择一个项目组开始分配成员
              </div>
            ) : (
              <Spin spinning={loading}>
                <div ref={transferWrapRef}>
                  <Transfer
                    dataSource={transferDataSource}
                    titles={[`全量人员 (${userTotal})`, `已选成员 (${targetKeys.length})`]}
                    targetKeys={targetKeys}
                    onChange={(keys) => setTargetKeys(keys as string[])}
                    render={(item) => item.title ?? ''}
                    listStyle={{ width: '100%', height: transferListHeight, background: 'var(--zb-bg-surface-muted)', border: '1px solid var(--zb-border-subtle)' }}
                  >
                    {({
                      direction,
                      filteredItems,
                      onItemSelect,
                      onItemSelectAll,
                      selectedKeys,
                      disabled,
                    }) => {
                      const columns = direction === 'left' ? leftTableColumns : rightTableColumns

                      const rowSelection = {
                        getCheckboxProps: () => ({ disabled }),
                        onChange: (selectedRowKeys: React.Key[]) => {
                          onItemSelectAll(selectedRowKeys as string[], 'replace')
                        },
                        selectedRowKeys: selectedKeys,
                      }

                      const data = filteredItems as unknown as TransferItem[]

                      return (
                        <div>
                          {direction === 'left' && (
                            <div style={{ padding: 12, paddingBottom: 0 }}>
                              <Input
                                placeholder="搜索姓名/账号"
                                value={userSearchInput}
                                onChange={(e) => setUserSearchInput(e.target.value)}
                                allowClear
                              />
                            </div>
                          )}
                          <Table
                            rowSelection={rowSelection as any}
                            columns={columns as any}
                            dataSource={data}
                            size="small"
                            pagination={direction === 'left' ? {
                              current: userPage,
                              pageSize: userPageSize,
                              total: userTotal,
                              showSizeChanger: true,
                              onChange: (page, pageSize) => {
                                setUserPage(page)
                                setUserPageSize(pageSize)
                              },
                            } : false}
                            rowKey="key"
                            style={{
                              padding: 12,
                              paddingTop: direction === 'left' ? 8 : 12,
                              background: 'transparent',
                            }}
                            onRow={(record) => ({
                              onClick: () => onItemSelect(record.key, !selectedKeys.includes(record.key)),
                              onDoubleClick: () => {
                                if (direction !== 'left') return
                                setTargetKeys((prev) => (prev.includes(record.key) ? prev : [...prev, record.key]))
                              },
                            })}
                          />
                        </div>
                      )
                    }}
                  </Transfer>
                </div>
              </Spin>
            )}
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal
        title={<Text style={{ color: 'var(--zb-text-primary)' }}>{editTarget ? '编辑项目组' : '新建项目组'}</Text>}
        open={modalOpen}
        onOk={handleSaveGroup}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        styles={{
          content: { background: 'var(--zb-bg-surface)', border: '1px solid var(--zb-border-subtle)' },
          header: { background: 'var(--zb-bg-surface)' },
          footer: { background: 'var(--zb-bg-surface)' },
        }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={<Text style={{ color: 'var(--zb-text-secondary)' }}>组名</Text>}
            rules={[{ required: true, message: '请输入组名' }]}>
            <Input placeholder="如：后端团队" />
          </Form.Item>
          <Form.Item name="description" label={<Text style={{ color: 'var(--zb-text-secondary)' }}>描述</Text>}>
            <Input.TextArea placeholder="可选" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default GroupsPage

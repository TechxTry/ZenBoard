import React, { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Typography, Button, Table, Space, DatePicker, Tag, Tooltip, Modal, message,
} from 'antd'
import { ArrowLeftOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons'
import JsonView from '@uiw/react-json-view'
import dayjs, { Dayjs } from 'dayjs'
import { getTask, listEfforts } from '../../api'
import { useAuthStore } from '../../store/auth'
import { taskTypeLabel, taskStatusLabel, useMemberPersonDisplay } from './workbenchDisplay'

const { RangePicker } = DatePicker
const { Text } = Typography

const STATUS_COLORS: Record<string, string> = {
  done: 'green', closed: 'default', active: 'blue',
  wait: 'orange', doing: 'blue', resolved: 'cyan', rejected: 'red',
  pause: 'default', cancel: 'red',
}

const RawDataModal: React.FC<{ data: object | null; onClose: () => void }> = ({ data, onClose }) => (
  <Modal
    open={!!data}
    title={<Text style={{ color: 'var(--zb-text-primary)' }}>原始数据 (raw_data)</Text>}
    onCancel={onClose}
    footer={null}
    width={700}
    styles={{
      content: { background: 'var(--zb-bg-surface)', border: '1px solid var(--zb-border-subtle)', borderRadius: 12 },
      header: { background: 'var(--zb-bg-surface)' },
    }}
  >
    {data && (
      <JsonView
        value={data}
        collapsed={2}
        style={{ background: 'transparent', fontSize: 13, fontFamily: 'monospace' }}
      />
    )}
  </Modal>
)

/** 任务详情：展示任务字段 + 该任务下的报工明细 */
const TaskDetailPage: React.FC = () => {
  const { taskId: taskIdParam } = useParams<{ taskId: string }>()
  const taskId = Number(taskIdParam)
  const location = useLocation()
  const me = useAuthStore((s) => s.me)
  const sp = new URLSearchParams(location.search)
  const initialGroupId = (() => {
    const raw = sp.get('group_id')
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? n : undefined
  })()
  const backTo = sp.get('from') || '/workbench'
  const fromMyWorkbench = backTo === '/my-workbench'
  const backLabel = fromMyWorkbench ? '我的工作台' : '数据明细'
  const [groupId, setGroupId] = useState<number | undefined>(initialGroupId)
  const dataScope = String(me?.user?.data_scope ?? '').toUpperCase()
  const defaultGroupId = me?.user?.default_group_id ?? undefined
  const effectiveGroupId = groupId ?? (dataScope === 'GROUP' ? (defaultGroupId ?? undefined) : undefined)
  const personOf = useMemberPersonDisplay(effectiveGroupId ?? undefined)

  const [task, setTask] = useState<Record<string, unknown> | null>(null)
  const [taskLoading, setTaskLoading] = useState(true)
  const [efforts, setEfforts] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [effortLoading, setEffortLoading] = useState(false)
  const [rawData, setRawData] = useState<object | null>(null)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(89, 'day'),
    dayjs(),
  ])

  const loadTask = useCallback(async () => {
    if (!Number.isFinite(taskId) || taskId <= 0) return
    setTaskLoading(true)
    try {
      const row = await getTask(taskId, fromMyWorkbench
        ? { my_binding: 1 }
        : { group_id: effectiveGroupId ?? undefined })
      setTask(row as Record<string, unknown>)
    } catch (e: any) {
      message.error(e.response?.data?.error ?? '加载任务失败')
      setTask(null)
    } finally {
      setTaskLoading(false)
    }
  }, [taskId, effectiveGroupId, fromMyWorkbench])

  const loadEfforts = useCallback(async () => {
    if (!Number.isFinite(taskId) || taskId <= 0) return
    if (!task) {
      setEfforts([])
      setTotal(0)
      return
    }
    const from = dateRange[0].format('YYYY-MM-DD')
    const to = dateRange[1].format('YYYY-MM-DD')
    setEffortLoading(true)
    try {
      const res = await listEfforts(fromMyWorkbench
        ? {
            my_binding: 1,
            task_id: taskId,
            date_from: from,
            date_to: to,
            page,
            page_size: 20,
          }
        : {
            group_id: effectiveGroupId ?? undefined,
            task_id: taskId,
            date_from: from,
            date_to: to,
            page,
            page_size: 20,
          })
      setEfforts(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      message.error(e.response?.data?.error ?? '加载报工失败')
    } finally {
      setEffortLoading(false)
    }
  }, [task, taskId, effectiveGroupId, dateRange, page, fromMyWorkbench])

  useEffect(() => {
    loadTask()
  }, [loadTask])

  useEffect(() => {
    loadEfforts()
  }, [loadEfforts])

  const handleSearch = () => {
    void loadEfforts()
  }

  const effortColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '登记人',
      dataIndex: 'account',
      width: 160,
      render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{personOf(v)}</Text>,
    },
    { title: '日期', dataIndex: 'work_date', width: 100, render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
    { title: '消耗(h)', dataIndex: 'consumed', width: 80 },
    { title: '工作内容', dataIndex: 'work', render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{v}</Text> },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, row: any) => (
        <Tooltip title="查看原始数据">
          <Button
            size="small" type="text" icon={<EyeOutlined />}
            style={{ color: 'var(--zb-text-muted)' }}
            onClick={() => setRawData(row.raw_data ?? row)}
          />
        </Tooltip>
      ),
    },
  ]

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <div>
        <Text type="danger">无效的任务 ID</Text>
        <div style={{ marginTop: 16 }}>
          <Link to={backTo}>返回{backLabel}</Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Link to={backTo}>
          <Button type="text" icon={<ArrowLeftOutlined />} style={{ color: 'var(--zb-text-secondary)' }}>
            {backLabel}
          </Button>
        </Link>
      </Space>

      <div style={{ marginBottom: 20 }}>
        <Text style={{ color: 'var(--zb-text-primary)', fontSize: 18, fontWeight: 600 }}>任务详情</Text>
        <Tag color="purple" style={{ marginLeft: 12 }}>#{taskId}</Tag>
        <Space style={{ marginLeft: 12 }} wrap>
          {effectiveGroupId
            ? <Tag color="blue">group_id: {effectiveGroupId}</Tag>
            : <Tag>未指定小组</Tag>}
        </Space>
        <Link to={`/my-workbench?task_id=${taskId}`} style={{ marginLeft: 12 }}>
          <Button type="primary" size="small" style={{ background: 'var(--zb-brand-gradient)', border: 'none' }}>
            报工
          </Button>
        </Link>
      </div>

      {taskLoading ? (
        <Text style={{ color: 'var(--zb-text-muted)' }}>加载中…</Text>
      ) : !task ? (
        <Text type="danger">任务不存在或无权查看</Text>
      ) : (
        <>
          <div style={{
            background: 'var(--zb-bg-surface)',
            border: '1px solid var(--zb-border-subtle)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
          }}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text style={{ color: 'var(--zb-text-primary)', fontSize: 16 }}>{String(task.name ?? '')}</Text>
              <Space wrap>
                <Tag color={STATUS_COLORS[String(task.status)] ?? 'default'}>
                  {taskStatusLabel(String(task.status ?? ''))}
                </Tag>
                <Text type="secondary">类型 {taskTypeLabel(String(task.type ?? ''))}</Text>
                <Text type="secondary">指派 {personOf(String(task.assigned_to ?? ''))}</Text>
                <Text type="secondary">预估(h) {String(task.estimate ?? '-')}</Text>
                <Text type="secondary">消耗(h) {String(task.consumed ?? '-')}</Text>
              </Space>
            </Space>
          </div>

          <div style={{
            background: 'var(--zb-bg-surface)',
            border: '1px solid var(--zb-border-subtle)',
            borderRadius: 12,
            padding: '16px 20px',
          }}>
            <Text style={{ color: 'var(--zb-text-primary)', fontWeight: 600, display: 'block', marginBottom: 12 }}>报工明细</Text>
            <div style={{ marginBottom: 8, color: 'var(--zb-text-muted)', fontSize: 12 }}>
              仅展示关联本任务的报工记录；时间跨度最多 6 个月
            </div>
            <Space wrap style={{ marginBottom: 16 }}>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  if (dates?.[0] && dates?.[1]) {
                    setDateRange([dates[0], dates[1]])
                    setPage(1)
                  }
                }}
                disabledDate={(current) => {
                  if (!dateRange) return false
                  return Math.abs(current.diff(dateRange[0], 'day')) > 180
                }}
                placeholder={['开始日期', '结束日期 (最多半年)']}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                style={{ background: 'var(--zb-brand-gradient)', border: 'none' }}
              >
                查询
              </Button>
            </Space>
            <Table
              dataSource={efforts}
              columns={effortColumns}
              rowKey="id"
              loading={effortLoading}
              size="small"
              pagination={{
                current: page,
                total,
                pageSize: 20,
                showTotal: (t) => `共 ${t} 条`,
                onChange: setPage,
                showSizeChanger: false,
              }}
              scroll={{ x: 800 }}
              style={{ background: 'transparent' }}
            />
          </div>
        </>
      )}
      <RawDataModal data={rawData} onClose={() => setRawData(null)} />
    </div>
  )
}

export default TaskDetailPage

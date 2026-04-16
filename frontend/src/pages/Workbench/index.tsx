import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, Table, Space, Button, Select, DatePicker, Modal, Typography,
  Tag, Tooltip, message } from 'antd'
import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import JsonView from '@uiw/react-json-view'
import { useAppStore } from '../../store'
import { listTasks, listStories, listBugs, listEfforts, listExecutions,
  getGroupMembers, WorkbenchParams } from '../../api'
import dayjs, { Dayjs } from 'dayjs'
import {
  taskTypeLabel,
  taskStatusLabel,
  storyStatusLabel,
  STORY_STATUS_TAG_COLOR,
  bugStatusLabel,
  BUG_STATUS_TAG_COLOR,
  bugResolutionLabel,
  executionStatusLabel,
  EXECUTION_STATUS_TAG_COLOR,
  useMemberPersonDisplay,
} from './workbenchDisplay'

const { RangePicker } = DatePicker
const { Text } = Typography

/** 当前项目组下可选迭代（与「迭代」Tab 同源接口） */
function useExecutionOptions(groupId: number | undefined) {
  const [options, setOptions] = useState<{ value: number; label: string }[]>([])
  useEffect(() => {
    if (!groupId) {
      setOptions([])
      return
    }
    let cancelled = false
    listExecutions({ group_id: groupId, page: 1, page_size: 200 })
      .then((res) => {
        if (cancelled) return
        const rows = res.data ?? []
        setOptions(
          rows.map((e: { id: number; name: string }) => ({
            value: e.id,
            label: e.name ? `${e.id} · ${e.name}` : String(e.id),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [groupId])
  return options
}

/** 当前项目组成员（账号 + 姓名），用于「按人员」筛选 */
function useGroupMemberOptions(groupId: number | undefined) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])
  useEffect(() => {
    if (!groupId) {
      setOptions([])
      return
    }
    let cancelled = false
    getGroupMembers(groupId)
      .then((d: { members?: { account: string; realname: string }[] }) => {
        if (cancelled) return
        const rows = d.members ?? []
        setOptions(
          rows.map((m) => ({
            value: m.account,
            label: m.realname?.trim()
              ? `${m.realname.trim()}（${m.account}）`
              : m.account,
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [groupId])
  return options
}

const MemberSelect: React.FC<{
  groupId: number | undefined
  value?: string
  placeholder?: string
  onChange: (account: string | undefined) => void
}> = ({ groupId, value, placeholder = '按人员筛选', onChange }) => {
  const options = useGroupMemberOptions(groupId)
  return (
    <Select
      placeholder={placeholder}
      allowClear
      showSearch
      optionFilterProp="label"
      disabled={!groupId}
      style={{ minWidth: 220 }}
      options={options}
      value={value}
      onChange={(v) => onChange(v as string | undefined)}
    />
  )
}

const IterationSelect: React.FC<{
  groupId: number | undefined
  /** 受控：与查询参数 execution_id 同步，避免界面与请求参数不一致 */
  value?: number
  onChange: (executionId: number | undefined) => void
}> = ({ groupId, value, onChange }) => {
  const options = useExecutionOptions(groupId)
  return (
    <Select
      placeholder="按迭代筛选"
      allowClear
      showSearch
      optionFilterProp="label"
      disabled={!groupId}
      style={{ minWidth: 220 }}
      options={options}
      value={value}
      onChange={(v) => onChange(v as number | undefined)}
    />
  )
}

// ---- Status tag colors ----
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

// ---- Generic workbench tab ----
interface ColDef { title: string; dataIndex: string; key?: string; width?: number; render?: (v: any, r: any) => React.ReactNode }

type WorkbenchFilterCtx = {
  params: WorkbenchParams
  setParams: React.Dispatch<React.SetStateAction<WorkbenchParams>>
}

function useWorkbenchTab(
  fetcher: (p: WorkbenchParams) => Promise<any>,
  columns: ColDef[],
  extraFilters?: React.ReactNode | ((ctx: WorkbenchFilterCtx) => React.ReactNode),
  requireDateRange?: boolean,
) {
  const { selectedGroupId } = useAppStore()
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [params, setParams] = useState<WorkbenchParams>({})
  const [rawData, setRawData] = useState<object | null>(null)
  /** 供「仅依赖 group/page 的 effect」读取最新筛选条件，避免闭包陈旧 */
  const paramsRef = useRef(params)
  paramsRef.current = params

  const fetch = useCallback(async (p?: WorkbenchParams, pg?: number) => {
    const merged = p ?? paramsRef.current
    const pageNum = pg ?? page
    if (requireDateRange && (!merged.date_from || !merged.date_to)) {
      setData([]); setTotal(0); return
    }
    setLoading(true)
    try {
      const res = await fetcher({ ...merged, group_id: selectedGroupId ?? undefined, page: pageNum, page_size: 20 })
      setData(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      message.error(e.response?.data?.error ?? '查询失败')
    } finally {
      setLoading(false)
    }
  }, [page, selectedGroupId, fetcher, requireDateRange])

  useEffect(() => { void fetch() }, [selectedGroupId, page, fetch])

  const allColumns = [
    ...columns,
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: any, row: any) => (
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

  const handleSearch = () => {
    setPage(1)
    void fetch(paramsRef.current, 1)
  }

  const filterSlot = typeof extraFilters === 'function'
    ? extraFilters({ params, setParams })
    : extraFilters

  return {
    node: (
      <div>
        <Space wrap style={{ marginBottom: 16 }}>
          {filterSlot}
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}
            style={{ background: 'var(--zb-brand-gradient)', border: 'none' }}>
            查询
          </Button>
        </Space>
        <Table
          dataSource={data}
          columns={allColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: page, total, pageSize: 20, showTotal: (t) => `共 ${t} 条`,
            onChange: setPage, showSizeChanger: false,
          }}
          scroll={{ x: 900 }}
          style={{ background: 'transparent' }}
        />
        <RawDataModal data={rawData} onClose={() => setRawData(null)} />
      </div>
    ),
    setParams,
    params,
  }
}

// ---- Task Tab ----
const TASK_STATUS_FILTER_OPTIONS = [
  { value: 'wait', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'closed', label: '已关闭' },
]

const TaskTab: React.FC = () => {
  const { selectedGroupId } = useAppStore()
  const personOf = useMemberPersonDisplay(selectedGroupId ?? undefined)
  const taskColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      {
        title: '任务名',
        dataIndex: 'name',
        render: (v: string, r: { id: number }) => (
          <Link to={`/workbench/task/${r.id}`} style={{ color: 'var(--zb-text-primary)' }}>
            {v}
          </Link>
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        width: 90,
        render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{taskTypeLabel(v)}</Text>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (v: string) => (
          <Tag color={STATUS_COLORS[v] ?? 'default'}>{taskStatusLabel(v)}</Tag>
        ),
      },
      {
        title: '指派给',
        dataIndex: 'assigned_to',
        width: 160,
        render: (v: string) => (
          <Text style={{ color: 'var(--zb-text-secondary)' }}>{personOf(v)}</Text>
        ),
      },
      { title: '预估(h)', dataIndex: 'estimate', width: 80 },
      { title: '消耗(h)', dataIndex: 'consumed', width: 80 },
      { title: '最后编辑', dataIndex: 'last_edited_date', width: 130, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    ],
    [personOf],
  )
  const { node, setParams } = useWorkbenchTab(
    listTasks,
    taskColumns,
    ({ params, setParams }) => (
      <>
        <IterationSelect
          groupId={selectedGroupId ?? undefined}
          value={params.execution_id}
          onChange={(id) => setParams((p) => ({ ...p, execution_id: id }))}
        />
        <MemberSelect
          groupId={selectedGroupId ?? undefined}
          value={params.assigned_to}
          onChange={(acc) => setParams((p) => ({ ...p, assigned_to: acc }))}
        />
        <Select
          placeholder="状态"
          allowClear
          style={{ width: 120 }}
          value={params.status}
          onChange={(v) => setParams((p) => ({ ...p, status: v }))}
          options={TASK_STATUS_FILTER_OPTIONS}
        />
      </>
    ),
  )
  useLayoutEffect(() => {
    setParams((p) => ({ ...p, assigned_to: undefined }))
  }, [selectedGroupId])
  return node
}

// ---- Story Tab ----
const StoryTab: React.FC = () => {
  const { selectedGroupId } = useAppStore()
  const personOf = useMemberPersonDisplay(selectedGroupId ?? undefined)
  const storyColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      { title: '需求标题', dataIndex: 'title', render: (v: string) => <Text style={{ color: 'var(--zb-text-primary)' }}>{v}</Text> },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (v: string) => (
          <Tag color={STORY_STATUS_TAG_COLOR[v] ?? STATUS_COLORS[v] ?? 'default'}>
            {storyStatusLabel(v)}
          </Tag>
        ),
      },
      {
        title: '指派给',
        dataIndex: 'assigned_to',
        width: 160,
        render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{personOf(v)}</Text>,
      },
      { title: '预估(h)', dataIndex: 'estimate', width: 80 },
      { title: '最后编辑', dataIndex: 'last_edited_date', width: 130, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    ],
    [personOf],
  )
  const { node, setParams } = useWorkbenchTab(
    listStories,
    storyColumns,
    ({ params, setParams }) => (
      <>
        <IterationSelect
          groupId={selectedGroupId ?? undefined}
          value={params.execution_id}
          onChange={(id) => setParams((p) => ({ ...p, execution_id: id }))}
        />
        <MemberSelect
          groupId={selectedGroupId ?? undefined}
          value={params.assigned_to}
          onChange={(acc) => setParams((p) => ({ ...p, assigned_to: acc }))}
        />
      </>
    ),
  )
  useLayoutEffect(() => {
    setParams((p) => ({ ...p, assigned_to: undefined }))
  }, [selectedGroupId])
  return node
}

// ---- Bug Tab ----
const BugTab: React.FC = () => {
  const { selectedGroupId } = useAppStore()
  const personOf = useMemberPersonDisplay(selectedGroupId ?? undefined)
  const bugColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      { title: '缺陷标题', dataIndex: 'title', render: (v: string) => <Text style={{ color: 'var(--zb-text-primary)' }}>{v}</Text> },
      { title: '严重性', dataIndex: 'severity', width: 70, render: (v: number) => <Tag color={v <= 2 ? 'red' : v <= 3 ? 'orange' : 'default'}>P{v}</Tag> },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (v: string) => (
          <Tag color={BUG_STATUS_TAG_COLOR[v] ?? STATUS_COLORS[v] ?? 'default'}>
            {bugStatusLabel(v)}
          </Tag>
        ),
      },
      {
        title: '指派给',
        dataIndex: 'assigned_to',
        width: 160,
        render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{personOf(v)}</Text>,
      },
      {
        title: '解决人',
        dataIndex: 'resolved_by',
        width: 160,
        render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{personOf(v)}</Text>,
      },
      {
        title: '解决方案',
        dataIndex: 'resolution',
        width: 120,
        render: (v: string) => (
          <Text style={{ color: 'var(--zb-text-secondary)' }}>{bugResolutionLabel(v)}</Text>
        ),
      },
      { title: '最后编辑', dataIndex: 'last_edited_date', width: 130, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
    ],
    [personOf],
  )
  const { node, setParams } = useWorkbenchTab(
    listBugs,
    bugColumns,
    ({ params, setParams }) => (
      <>
        <IterationSelect
          groupId={selectedGroupId ?? undefined}
          value={params.execution_id}
          onChange={(id) => setParams((p) => ({ ...p, execution_id: id }))}
        />
        <MemberSelect
          groupId={selectedGroupId ?? undefined}
          value={params.assigned_to}
          onChange={(acc) => setParams((p) => ({ ...p, assigned_to: acc }))}
        />
      </>
    ),
  )
  useLayoutEffect(() => {
    setParams((p) => ({ ...p, assigned_to: undefined }))
  }, [selectedGroupId])
  return node
}

// ---- Effort Tab ----
const EffortTab: React.FC = () => {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [taskIdFilter, setTaskIdFilter] = useState<number | undefined>()
  const [taskOptions, setTaskOptions] = useState<{ value: number; label: string }[]>([])
  const { selectedGroupId } = useAppStore()
  const personOf = useMemberPersonDisplay(selectedGroupId ?? undefined)
  const effortColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      {
        title: '登记人',
        dataIndex: 'account',
        width: 160,
        render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{personOf(v)}</Text>,
      },
      { title: '日期', dataIndex: 'work_date', width: 100, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
      { title: '消耗(h)', dataIndex: 'consumed', width: 80 },
      { title: '工作内容', dataIndex: 'work', render: (v: string) => <Text style={{ color: 'var(--zb-text-secondary)' }}>{v}</Text> },
      { title: '关联类型', dataIndex: 'object_type', width: 80 },
      { title: '关联ID', dataIndex: 'object_id', width: 80 },
    ],
    [personOf],
  )
  const { node, setParams, params } = useWorkbenchTab(
    listEfforts,
    effortColumns,
    ({ params, setParams }) => (
      <>
        <IterationSelect
          groupId={selectedGroupId ?? undefined}
          value={params.execution_id}
          onChange={(id) => {
            setTaskIdFilter(undefined)
            setParams((p) => ({ ...p, execution_id: id, task_id: undefined }))
          }}
        />
        <MemberSelect
          groupId={selectedGroupId ?? undefined}
          value={params.account}
          placeholder="按登记人筛选"
          onChange={(acc) => setParams((p) => ({ ...p, account: acc }))}
        />
        <Select
          placeholder="按任务筛选"
          allowClear
          showSearch
          optionFilterProp="label"
          disabled={!selectedGroupId}
          style={{ minWidth: 280 }}
          options={taskOptions}
          value={taskIdFilter}
          onChange={(v) => {
            if (v === undefined) {
              setTaskIdFilter(undefined)
              setParams((p) => ({ ...p, task_id: undefined }))
              return
            }
            const id = Number(v)
            if (!Number.isFinite(id)) {
              setTaskIdFilter(undefined)
              setParams((p) => ({ ...p, task_id: undefined }))
              return
            }
            setTaskIdFilter(id)
            setParams((p) => ({ ...p, task_id: id }))
          }}
        />
        <RangePicker
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              const from = dates[0].format('YYYY-MM-DD')
              const to = dates[1].format('YYYY-MM-DD')
              setParams((p) => ({ ...p, date_from: from, date_to: to }))
              setDateRange([dates[0], dates[1]])
            } else {
              setParams((p) => ({ ...p, date_from: undefined, date_to: undefined }))
              setDateRange(null)
            }
          }}
          disabledDate={(current) => {
            if (!dateRange) return false
            return Math.abs(current.diff(dateRange[0], 'day')) > 180
          }}
          placeholder={['开始日期', '结束日期 (最多半年)']}
        />
      </>
    ),
    true, // requireDateRange
  )

  useEffect(() => {
    if (!selectedGroupId) {
      setTaskOptions([])
      return
    }
    let cancelled = false
    listTasks({
      group_id: selectedGroupId,
      execution_id: params.execution_id,
      page: 1,
      page_size: 200,
    })
      .then((res) => {
        if (cancelled) return
        const rows = res.data ?? []
        setTaskOptions(
          rows.map((t: { id: number; name: string }) => ({
            value: t.id,
            label: t.name ? `${t.id} · ${t.name}` : String(t.id),
          })),
        )
      })
      .catch(() => {
        if (!cancelled) setTaskOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedGroupId, params.execution_id])

  useLayoutEffect(() => {
    setTaskIdFilter(undefined)
    setParams((p) => ({ ...p, task_id: undefined, account: undefined }))
  }, [selectedGroupId])

  return (
    <div>
      <div style={{ marginBottom: 8, color: 'var(--zb-text-muted)', fontSize: 12 }}>
        展示当前项目组（成员）在禅道登记的报工明细；可按迭代、登记人、任务筛选；数据量大，时间跨度限制为 6 个月内，请务必选择时间范围。
        登记人与任务、迭代等条件为「且」关系；若选任务后无数据，可尝试清空「按登记人筛选」后再查（任务详情页不按登记人过滤）。
      </div>
      {node}
    </div>
  )
}

// ---- Execution Tab ----
const ExecutionTab: React.FC = () => {
  const executionColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      { title: '迭代名', dataIndex: 'name', render: (v: string) => <Text style={{ color: 'var(--zb-text-primary)' }}>{v}</Text> },
      {
        title: '状态',
        dataIndex: 'status',
        width: 96,
        render: (v: string) => (
          <Tag color={EXECUTION_STATUS_TAG_COLOR[v] ?? STATUS_COLORS[v] ?? 'default'}>
            {executionStatusLabel(v)}
          </Tag>
        ),
      },
      { title: '开始', dataIndex: 'begin_date', width: 110, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
      { title: '结束', dataIndex: 'end_date', width: 110, render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
    ],
    [],
  )
  const { node } = useWorkbenchTab(listExecutions, executionColumns)
  return node
}

// ---- Main Workbench Page ----
const WorkbenchPage: React.FC = () => {
  const { selectedGroupName, selectedGroupId } = useAppStore()

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Text style={{ color: 'var(--zb-text-primary)', fontSize: 18, fontWeight: 600 }}>数据工作台</Text>
        {selectedGroupId ? (
          <Tag color="purple" style={{ marginLeft: 12 }}>{selectedGroupName}</Tag>
        ) : (
          <Tag style={{ marginLeft: 12 }}>请在顶部选择项目组</Tag>
        )}
      </div>

      <div style={{
        background: 'var(--zb-bg-surface)',
        border: '1px solid var(--zb-border-subtle)',
        borderRadius: 12,
        padding: '16px 20px',
      }}>
        <Tabs
          defaultActiveKey="tasks"
          items={[
            { key: 'tasks', label: '📋 任务', children: <TaskTab /> },
            { key: 'efforts', label: '⏱ 报工', children: <EffortTab /> },
            { key: 'stories', label: '📖 需求', children: <StoryTab /> },
            { key: 'bugs', label: '🐛 缺陷', children: <BugTab /> },
            { key: 'executions', label: '🚀 迭代', children: <ExecutionTab /> },
          ]}
        />
      </div>
    </div>
  )
}

export default WorkbenchPage

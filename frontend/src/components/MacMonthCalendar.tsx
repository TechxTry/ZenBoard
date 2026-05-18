import React, { useMemo, useState } from 'react'
import { Button, Modal, Segmented, Space, Typography } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { CalendarExternalEvent } from '../api'

const { Text } = Typography

type ViewMode = 'month' | 'list'

export const CALENDAR_CATEGORY_COLORS = {
  effort: '#1677ff',
  taskPlan: '#52c41a',
  external: '#fa8c16',
} as const

export function getCalendarEventCategory(event: CalendarExternalEvent): 'taskPlan' | 'external' {
  return event.source_type === 'task' ? 'taskPlan' : 'external'
}

export function getCalendarEventDisplayColor(event: CalendarExternalEvent): string {
  return CALENDAR_CATEGORY_COLORS[getCalendarEventCategory(event)]
}

type NormalizedEvent = CalendarExternalEvent & {
  _startDay: Dayjs
  _endDay: Dayjs
  _key: string
}

function normalizeEvent(e: CalendarExternalEvent): NormalizedEvent | null {
  const s = dayjs(e.start)
  const endRaw = dayjs(e.end)
  if (!s.isValid() || !endRaw.isValid()) return null

  // iCal all-day 常见语义：end 为次日 00:00（exclusive）
  let end = endRaw
  if (e.all_day && endRaw.hour() === 0 && endRaw.minute() === 0 && endRaw.second() === 0) {
    end = endRaw.subtract(1, 'day')
  }

  const startDay = s.startOf('day')
  const endDay = end.startOf('day')
  if (endDay.isBefore(startDay)) return null

  const key = `${e.source_type}:${e.source_id}:${e.title}:${e.start}:${e.end}`
  return { ...e, _startDay: startDay, _endDay: endDay, _key: key }
}

function clampDay(d: Dayjs, lo: Dayjs, hi: Dayjs) {
  if (d.isBefore(lo, 'day')) return lo
  if (d.isAfter(hi, 'day')) return hi
  return d
}

function daySpanInclusive(a: Dayjs, b: Dayjs) {
  return b.startOf('day').diff(a.startOf('day'), 'day') + 1
}

type WeekSeg = {
  key: string
  ev: NormalizedEvent
  lane: number
  startIdx: number // 0..6 within week
  span: number // 1..7
  isStart: boolean
  isEnd: boolean
}

const MAX_EVENT_LANES = 3
const EVENT_ROW_STEP = 20
const EVENT_BAR_HEIGHT = 16
const CELL_HEADER_TOP = 8
const CELL_HEADER_HEIGHT = 24
const CELL_OVERLAY_TOP = CELL_HEADER_TOP + CELL_HEADER_HEIGHT + 2
const CELL_MIN_HEIGHT = CELL_OVERLAY_TOP + (MAX_EVENT_LANES + 1) * EVENT_ROW_STEP + 8

function packWeekSegments(weekStart: Dayjs, events: NormalizedEvent[], maxLanes: number) {
  const weekEnd = weekStart.add(6, 'day')
  const intersects = events
    .filter((e) => !e._endDay.isBefore(weekStart, 'day') && !e._startDay.isAfter(weekEnd, 'day'))
    .sort((a, b) => {
      const ds = a._startDay.diff(b._startDay, 'day')
      if (ds !== 0) return ds
      const de = b._endDay.diff(a._endDay, 'day')
      if (de !== 0) return de
      return a.title.localeCompare(b.title)
    })

  const lanesEnd: Dayjs[] = []
  const segs: WeekSeg[] = []

  for (const ev of intersects) {
    const segStart = clampDay(ev._startDay, weekStart, weekEnd)
    const segEnd = clampDay(ev._endDay, weekStart, weekEnd)
    const startIdx = segStart.diff(weekStart, 'day')
    const span = daySpanInclusive(segStart, segEnd)

    let lane = -1
    for (let i = 0; i < lanesEnd.length; i++) {
      if (lanesEnd[i].isBefore(segStart, 'day')) {
        lane = i
        break
      }
    }
    if (lane === -1) {
      lane = lanesEnd.length
      lanesEnd.push(segEnd)
    } else {
      lanesEnd[lane] = segEnd
    }

    if (lane < maxLanes) {
      segs.push({
        key: `${ev._key}:${weekStart.format('YYYY-MM-DD')}`,
        ev,
        lane,
        startIdx,
        span,
        isStart: ev._startDay.isSame(segStart, 'day'),
        isEnd: ev._endDay.isSame(segEnd, 'day'),
      })
    }
  }

  const hidden = segs.length < intersects.length ? intersects.length - segs.length : 0
  return { segs, hidden }
}

export const MacMonthCalendar: React.FC<{
  month: Dayjs
  selectedDay: Dayjs
  events: CalendarExternalEvent[]
  loading?: boolean
  getCellDots?: (d: Dayjs) => { colors: string[]; n?: number }
  onMonthChange: (d: Dayjs) => void
  onSelectDay: (d: Dayjs) => void
}> = ({ month, selectedDay, events, loading, getCellDots, onMonthChange, onSelectDay }) => {
  const [mode, setMode] = useState<ViewMode>('month')
  const [openEv, setOpenEv] = useState<NormalizedEvent | null>(null)

  const normalized = useMemo(() => {
    const out: NormalizedEvent[] = []
    for (const e of events ?? []) {
      const ne = normalizeEvent(e)
      if (ne) out.push(ne)
    }
    return out
  }, [events])

  const grid = useMemo(() => {
    const base = month.startOf('month')
    const start = base.startOf('week')
    const end = base.endOf('month').endOf('week')
    const days: Dayjs[] = []
    for (let d = start; !d.isAfter(end, 'day'); d = d.add(1, 'day')) days.push(d)
    const weeks: Dayjs[][] = []
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
    return { start, weeks }
  }, [month])

  const listByDay = useMemo(() => {
    const mStart = month.startOf('month')
    const mEnd = month.endOf('month')
    const rows = normalized
      .filter((e) => !e._endDay.isBefore(mStart, 'day') && !e._startDay.isAfter(mEnd, 'day'))
      .sort((a, b) => {
        const ds = a._startDay.diff(b._startDay, 'day')
        if (ds !== 0) return ds
        const de = a._endDay.diff(b._endDay, 'day')
        if (de !== 0) return de
        return a.title.localeCompare(b.title)
      })
    return rows
  }, [normalized, month])

  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六']
  const today = dayjs()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <Space wrap>
          <Button size="small" onClick={() => onMonthChange(month.subtract(1, 'month'))}>
            上月
          </Button>
          <Button size="small" onClick={() => onMonthChange(dayjs())}>
            今天
          </Button>
          <Button size="small" onClick={() => onMonthChange(month.add(1, 'month'))}>
            下月
          </Button>
          <Text strong style={{ color: 'var(--zb-text-primary)' }}>
            {month.format('YYYY 年 M 月')}
          </Text>
          {loading ? <Text style={{ color: 'var(--zb-text-muted)', fontSize: 12 }}>加载中…</Text> : null}
        </Space>
        <Segmented
          size="middle"
          value={mode}
          onChange={(v) => setMode(v as ViewMode)}
          options={[
            { label: '月视图', value: 'month' },
            { label: '列表', value: 'list' },
          ]}
        />
      </div>
      <Space size={12} wrap style={{ marginBottom: 10 }}>
        <Space size={6}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: CALENDAR_CATEGORY_COLORS.effort,
              display: 'inline-block',
            }}
          />
          <Text style={{ color: 'var(--zb-text-muted)', fontSize: 12 }}>禅道报工</Text>
        </Space>
        <Space size={6}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: CALENDAR_CATEGORY_COLORS.taskPlan,
              display: 'inline-block',
            }}
          />
          <Text style={{ color: 'var(--zb-text-muted)', fontSize: 12 }}>任务计划</Text>
        </Space>
        <Space size={6}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: CALENDAR_CATEGORY_COLORS.external,
              display: 'inline-block',
            }}
          />
          <Text style={{ color: 'var(--zb-text-muted)', fontSize: 12 }}>外部日历事件</Text>
        </Space>
      </Space>

      {mode === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {listByDay.length === 0 ? (
            <div style={{ color: 'var(--zb-text-muted)', fontSize: 12 }}>本月无外部日历事件</div>
          ) : (
            listByDay.map((e) => {
              const span = daySpanInclusive(e._startDay, e._endDay)
              const hint = span > 1 ? `（跨 ${span} 天）` : ''
              return (
                <button
                  key={e._key}
                  onClick={() => setOpenEv(e)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--zb-border-subtle)',
                    background: 'var(--zb-bg-surface)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: getCalendarEventDisplayColor(e),
                        flexShrink: 0,
                      }}
                    />
                    <Text style={{ color: 'var(--zb-text-primary)', fontWeight: 600 }}>
                      {e.title} <Text style={{ color: 'var(--zb-text-muted)', fontSize: 12 }}>{hint}</Text>
                    </Text>
                  </div>
                  <div style={{ marginTop: 2, color: 'var(--zb-text-muted)', fontSize: 12 }}>
                    {e._startDay.format('MM-DD')} → {e._endDay.format('MM-DD')} · {e.source_name}
                  </div>
                </button>
              )
            })
          )}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--zb-border-subtle)', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(255,255,255,0.03)' }}>
            {weekdayLabels.map((w) => (
              <div key={w} style={{ padding: '8px 10px', color: 'var(--zb-text-muted)', fontSize: 12, borderBottom: '1px solid var(--zb-border-subtle)' }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateRows: `repeat(${grid.weeks.length}, auto)` }}>
            {grid.weeks.map((week, wi) => {
              const weekStart = week[0]
              const { segs } = packWeekSegments(weekStart, normalized, MAX_EVENT_LANES)
              return (
                <div key={weekStart.toString()} style={{ position: 'relative', borderBottom: wi === grid.weeks.length - 1 ? 'none' : '1px solid var(--zb-border-subtle)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                    {week.map((d) => {
                      const inMonth = d.isSame(month, 'month')
                      const isSelected = d.isSame(selectedDay, 'day')
                      const isToday = d.isSame(today, 'day')
                      const dots = getCellDots ? getCellDots(d) : null
                      return (
                        <button
                          key={d.toString()}
                          onClick={() => onSelectDay(d)}
                          style={{
                            position: 'relative',
                            display: 'block',
                            minHeight: CELL_MIN_HEIGHT,
                            padding: 8,
                            border: 'none',
                            borderRight: d.day() === 6 ? 'none' : '1px solid var(--zb-border-subtle)',
                            background: isSelected ? 'rgba(22,119,255,0.14)' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: CELL_HEADER_TOP,
                              left: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              fontSize: 12,
                              color: !inMonth ? 'rgba(255,255,255,0.35)' : 'var(--zb-text-primary)',
                              background: isToday ? 'rgba(255,77,79,0.18)' : 'transparent',
                              border: isToday ? '1px solid rgba(255,77,79,0.35)' : '1px solid transparent',
                            }}
                          >
                            {d.date()}
                          </span>
                          {dots && (dots.colors?.length ?? 0) > 0 ? (
                            <div
                              style={{
                                position: 'absolute',
                                top: CELL_HEADER_TOP + 8,
                                right: 8,
                                display: 'flex',
                                gap: 4,
                                flexWrap: 'wrap',
                                justifyContent: 'flex-end',
                                maxWidth: 'calc(100% - 42px)',
                              }}
                            >
                              {dots.colors.slice(0, 6).map((c, idx) => (
                                <span
                                  key={`${c}-${idx}`}
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 999,
                                    background: c,
                                    display: 'inline-block',
                                    opacity: 0.95,
                                  }}
                                />
                              ))}
                              {typeof dots.n === 'number' && dots.n > dots.colors.length ? (
                                <span style={{ fontSize: 10, color: 'var(--zb-text-muted)', lineHeight: '6px' }}>
                                  +{dots.n - dots.colors.length}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>

                  {/* event lanes overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: CELL_OVERLAY_TOP,
                      padding: '0 6px',
                      pointerEvents: 'none',
                    }}
                  >
                    {segs.map((s) => {
                      const leftPct = (s.startIdx / 7) * 100
                      const widthPct = (s.span / 7) * 100
                      const barTop = s.lane * EVENT_ROW_STEP
                      const spanDays = daySpanInclusive(s.ev._startDay, s.ev._endDay)
                      const showSpan = spanDays > 1 && s.isEnd
                      const endHint = showSpan ? ` · ${spanDays}天` : ''
                      return (
                        <div
                          key={s.key}
                          onClick={() => setOpenEv(s.ev)}
                          style={{
                            pointerEvents: 'auto',
                            position: 'absolute',
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                            top: barTop,
                            height: EVENT_BAR_HEIGHT,
                            background: getCalendarEventDisplayColor(s.ev),
                            color: 'white',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 6px',
                            fontSize: 11,
                            lineHeight: `${EVENT_BAR_HEIGHT}px`,
                            boxShadow: '0 1px 0 rgba(0,0,0,0.25)',
                            opacity: 0.92,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            userSelect: 'none',
                          }}
                          title={`${s.ev.title} (${s.ev._startDay.format('YYYY-MM-DD')} → ${s.ev._endDay.format('YYYY-MM-DD')})`}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.ev.title}
                            {endHint}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal
        open={!!openEv}
        onCancel={() => setOpenEv(null)}
        footer={null}
        title="日程详情"
        width={680}
      >
        {openEv ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: getCalendarEventDisplayColor(openEv),
                }}
              />
              <Text strong style={{ color: 'var(--zb-text-primary)', fontSize: 16 }}>{openEv.title}</Text>
            </div>
            <div style={{ color: 'var(--zb-text-muted)', fontSize: 13 }}>
              {openEv._startDay.format('YYYY-MM-DD')} → {openEv._endDay.format('YYYY-MM-DD')}
              {' · '}
              {openEv.all_day ? '全天' : `${dayjs(openEv.start).format('HH:mm')}–${dayjs(openEv.end).format('HH:mm')}`}
              {' · '}
              {openEv.source_name}
            </div>
            <div>
              <Button size="small" onClick={() => { onSelectDay(openEv._startDay); setOpenEv(null) }}>
                跳到开始日
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}


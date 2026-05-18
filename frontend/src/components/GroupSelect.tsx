import React, { useEffect, useMemo, useState } from 'react'
import { Select } from 'antd'
import { listGroups } from '../api'

export type GroupOption = { id: number; name: string }

export function useGroupOptions() {
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listGroups()
      .then((d: { data?: GroupOption[] }) => {
        if (!cancelled) setGroups(d.data ?? [])
      })
      .catch(() => {
        if (!cancelled) setGroups([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(
    () => groups.map((g) => ({ value: g.id, label: g.name })),
    [groups],
  )

  return { groups, options, loading }
}

export const GroupSelect: React.FC<{
  value?: number
  onChange: (groupId: number | undefined, groupName: string) => void
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
  allowedGroupIds?: number[]
}> = ({ value, onChange, placeholder = '选择小组', style, disabled, allowedGroupIds }) => {
  const { groups, options, loading } = useGroupOptions()
  const filteredOptions = useMemo(() => {
    if (!allowedGroupIds || allowedGroupIds.length === 0) return options
    const allow = new Set(allowedGroupIds)
    return options.filter((o) => allow.has(Number(o.value)))
  }, [allowedGroupIds, options])

  return (
    <Select
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      value={value}
      loading={loading}
      options={filteredOptions}
      style={{ width: 220, ...style }}
      allowClear
      disabled={disabled}
      onChange={(v) => {
        if (v === undefined) {
          onChange(undefined, '')
          return
        }
        const id = Number(v)
        const name = groups.find((g) => g.id === id)?.name ?? String(id)
        onChange(id, name)
      }}
    />
  )
}


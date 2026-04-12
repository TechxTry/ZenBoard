import { useState, useEffect, useCallback } from 'react'
import { getGroupMembers } from '../../api'

/** 禅道 zt_task.type 常见取值 → 中文 */
export const TASK_TYPE_LABEL: Record<string, string> = {
  design: '设计',
  devel: '开发',
  test: '测试',
  study: '研究',
  discuss: '讨论',
  ui: '界面',
  affair: '事务',
  misc: '其他',
}

/** 禅道任务状态 → 中文 */
export const TASK_STATUS_LABEL: Record<string, string> = {
  wait: '未开始',
  doing: '进行中',
  done: '已完成',
  pause: '已暂停',
  cancel: '已取消',
  closed: '已关闭',
}

export function taskTypeLabel(code: string | undefined | null): string {
  if (code == null || code === '') return '-'
  return TASK_TYPE_LABEL[code] ?? code
}

export function taskStatusLabel(code: string | undefined | null): string {
  if (code == null || code === '') return '-'
  return TASK_STATUS_LABEL[code] ?? code
}

/** 禅道 zt_story.status 常见取值 → 中文（不同版本可能略有差异，未命中则回退原文） */
export const STORY_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  reviewing: '评审中',
  active: '激活',
  changing: '变更中',
  changed: '已变更',
  closed: '已关闭',
}

/** 需求状态 Tag 颜色（与列表其它 Tab 风格一致） */
export const STORY_STATUS_TAG_COLOR: Record<string, string> = {
  draft: 'default',
  reviewing: 'cyan',
  active: 'blue',
  changing: 'purple',
  changed: 'purple',
  closed: 'default',
}

export function storyStatusLabel(code: string | undefined | null): string {
  if (code == null || code === '') return '-'
  return STORY_STATUS_LABEL[code] ?? code
}

/** 禅道 zt_bug.status */
export const BUG_STATUS_LABEL: Record<string, string> = {
  active: '激活',
  resolved: '已解决',
  closed: '已关闭',
  wait: '待确认',
  activating: '激活中',
}

export const BUG_STATUS_TAG_COLOR: Record<string, string> = {
  active: 'blue',
  resolved: 'cyan',
  closed: 'default',
  wait: 'orange',
  activating: 'blue',
}

export function bugStatusLabel(code: string | undefined | null): string {
  if (code == null || code === '') return '-'
  return BUG_STATUS_LABEL[code] ?? code
}

/** 禅道 zt_bug.resolution（关闭/解决时的方案代码） */
export const BUG_RESOLUTION_LABEL: Record<string, string> = {
  fixed: '已解决',
  postponed: '延期处理',
  wontfix: '不予解决',
  duplicate: '重复缺陷',
  external: '外部原因',
  bydesign: '设计如此',
  tostory: '转为需求',
  tobug: '转为缺陷',
  notrepro: '无法重现',
  fixedinbranch: '分支已解决',
  later: '以后处理',
}

export function bugResolutionLabel(code: string | undefined | null): string {
  if (code == null || code === '') return '-'
  const k = String(code).trim()
  if (k === '') return '-'
  return BUG_RESOLUTION_LABEL[k] ?? code
}

/** 禅道迭代/执行 zt_project.status（sprint 等） */
export const EXECUTION_STATUS_LABEL: Record<string, string> = {
  wait: '未开始',
  doing: '进行中',
  suspended: '已挂起',
  closed: '已关闭',
  pause: '已暂停',
  delay: '已延期',
}

export const EXECUTION_STATUS_TAG_COLOR: Record<string, string> = {
  wait: 'orange',
  doing: 'blue',
  suspended: 'default',
  closed: 'default',
  pause: 'default',
  delay: 'orange',
}

export function executionStatusLabel(code: string | undefined | null): string {
  if (code == null || code === '') return '-'
  return EXECUTION_STATUS_LABEL[code] ?? code
}

/** 账号 → 成员真实姓名（无姓名时回退为账号） */
export function useMemberRealnameLookup(groupId: number | undefined) {
  const [accountToName, setAccountToName] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!groupId) {
      setAccountToName({})
      return
    }
    let cancelled = false
    getGroupMembers(groupId)
      .then((d: { members?: { account: string; realname: string }[] }) => {
        if (cancelled) return
        const m: Record<string, string> = {}
        for (const row of d.members ?? []) {
          if (row.account) {
            m[row.account] = row.realname?.trim() || row.account
          }
        }
        setAccountToName(m)
      })
      .catch(() => {
        if (!cancelled) setAccountToName({})
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  return useCallback(
    (account: string | undefined | null) => {
      if (account == null || account === '') return '-'
      return accountToName[account] ?? account
    },
    [accountToName],
  )
}

/**
 * 人员展示：姓名（账号）。有姓名且与账号不同时使用该格式；否则仅显示账号（无映射时亦为账号）。
 */
export function useMemberPersonDisplay(groupId: number | undefined) {
  const [accountToRealname, setAccountToRealname] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!groupId) {
      setAccountToRealname({})
      return
    }
    let cancelled = false
    getGroupMembers(groupId)
      .then((d: { members?: { account: string; realname: string }[] }) => {
        if (cancelled) return
        const m: Record<string, string> = {}
        for (const row of d.members ?? []) {
          if (row.account) {
            m[row.account] = row.realname?.trim() ?? ''
          }
        }
        setAccountToRealname(m)
      })
      .catch(() => {
        if (!cancelled) setAccountToRealname({})
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  return useCallback(
    (account: string | undefined | null) => {
      if (account == null || account === '') return '-'
      const rn = accountToRealname[account]
      if (rn != null && rn !== '' && rn !== account) {
        return `${rn}（${account}）`
      }
      return account
    },
    [accountToRealname],
  )
}

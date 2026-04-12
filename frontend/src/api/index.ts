import http from './http'

// ---- Auth ----
export const login = (username: string, password: string) =>
  http.post('/login', { username, password }).then((r) => r.data)

// ---- Config ----
export const getDatasource = () => http.get('/config/datasource').then((r) => r.data)
export const putDatasource = (data: object) => http.put('/config/datasource', data).then((r) => r.data)
export const testDatasource = (data: object) => http.post('/config/datasource/test', data).then((r) => r.data)
export const getLocalStats = () => http.get('/config/local-stats').then((r) => r.data)

export const getSyncSettings = () => http.get('/config/sync-settings').then((r) => r.data)
export const putSyncSettings = (data: { interval_minutes: number }) =>
  http.put('/config/sync-settings', data).then((r) => r.data)

// ---- Users ----
export const listUsers = (params?: { q?: string; page?: number; page_size?: number }) =>
  http.get('/users', { params }).then((r) => r.data)

// ---- Groups ----
export const listGroups = () => http.get('/groups').then((r) => r.data)
export const createGroup = (data: { name: string; description?: string }) =>
  http.post('/groups', data).then((r) => r.data)
export const updateGroup = (id: number, data: { name: string; description?: string }) =>
  http.put(`/groups/${id}`, data).then((r) => r.data)
export const deleteGroup = (id: number) => http.delete(`/groups/${id}`).then((r) => r.data)
export const getGroupMembers = (id: number) => http.get(`/groups/${id}/members`).then((r) => r.data)
export const updateGroupMembers = (id: number, accounts: string[]) =>
  http.put(`/groups/${id}/members`, { accounts }).then((r) => r.data)

// ---- Workbench ----
export type WorkbenchParams = {
  group_id?: number
  status?: string
  assigned_to?: string
  severity?: string
  account?: string
  /** 禅道迭代 (zt_project) ID，用于筛选任务/需求/缺陷/日志 */
  execution_id?: number
  /** 仅报工：筛选关联到指定任务 ID 的报工（object_type=task） */
  task_id?: number
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}
export const listTasks = (params: WorkbenchParams) => http.get('/workbench/tasks', { params }).then((r) => r.data)
export const getTask = (id: number, params?: { group_id?: number }) =>
  http.get(`/workbench/tasks/${id}`, { params }).then((r) => r.data)
export const listStories = (params: WorkbenchParams) => http.get('/workbench/stories', { params }).then((r) => r.data)
export const listBugs = (params: WorkbenchParams) => http.get('/workbench/bugs', { params }).then((r) => r.data)
export const listEfforts = (params: WorkbenchParams) => http.get('/workbench/efforts', { params }).then((r) => r.data)
export const listExecutions = (params: WorkbenchParams) => http.get('/workbench/executions', { params }).then((r) => r.data)

// ---- Sync ----
export const triggerSync = () => http.post('/sync/trigger').then((r) => r.data)
export const getSyncStatus = () => http.get('/sync/status').then((r) => r.data)

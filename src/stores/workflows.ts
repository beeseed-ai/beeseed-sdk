import { createStore } from 'zustand/vanilla'
import type { KyInstance } from 'ky'
import type {
  AppRuntimeConfig,
  Workflow,
  WorkflowApproval,
  WorkflowExecutor,
  WorkflowGraph,
  WorkflowMetrics,
  WorkflowNodeRun,
  WorkflowNodeRunEvent,
  WorkflowRun,
  WorkflowTemplate,
  WorkflowTemplateImportPayload,
  WorkflowTrigger,
  WorkflowValidationError,
  WorkflowVersion,
} from '../core/types.js'

export interface WorkflowRunDetail {
  run: WorkflowRun
  node_runs: WorkflowNodeRun[]
  events: WorkflowNodeRunEvent[]
}

export interface WorkflowApprovalActionResult extends WorkflowRunDetail {
  approval: WorkflowApproval
}

export interface WorkflowsState {
  workflows: Workflow[]
  runs: WorkflowRun[]
  versions: WorkflowVersion[]
  triggers: WorkflowTrigger[]
  templates: WorkflowTemplate[]
  selectedRun: WorkflowRunDetail | null
  metrics: WorkflowMetrics | null
  loading: boolean
  runsLoading: boolean
  templatesLoading: boolean
  saving: boolean
  importingTemplate: boolean
  templateError: string
  validationErrors: WorkflowValidationError[]

  fetchWorkflows: (channelId: string) => Promise<void>
  fetchWorkflowsForChannels: (channelIds: string[]) => Promise<void>
  createWorkflow: (channelId: string, data: { name: string; description?: string; graph_json?: WorkflowGraph; settings?: Record<string, unknown> }) => Promise<Workflow | null>
  updateWorkflow: (channelId: string, workflowId: string, patch: Partial<Workflow> & { graph_json?: WorkflowGraph }) => Promise<Workflow | null>
  deleteWorkflow: (channelId: string, workflowId: string) => Promise<boolean>
  fetchTemplates: () => Promise<void>
  importWorkflowTemplate: (channelId: string, templateId: string, options?: { versionId?: string; executor?: WorkflowExecutor }) => Promise<Workflow | null>
  validateWorkflow: (channelId: string, workflowId: string, graph: WorkflowGraph) => Promise<boolean>
  publishWorkflow: (channelId: string, workflowId: string, graph: WorkflowGraph) => Promise<WorkflowVersion | null>
  fetchTriggers: (channelId: string, workflowId: string) => Promise<void>
  createMessageTrigger: (channelId: string, workflowId: string, keyword: string, enabled?: boolean) => Promise<WorkflowTrigger | null>
  createScheduleTrigger: (channelId: string, workflowId: string, rule: string, timezone?: string, enabled?: boolean) => Promise<WorkflowTrigger | null>
  createTaskEventTrigger: (channelId: string, workflowId: string, eventType: string, enabled?: boolean) => Promise<WorkflowTrigger | null>
  createStorageEventTrigger: (channelId: string, workflowId: string, eventType: string, enabled?: boolean) => Promise<WorkflowTrigger | null>
  createWebhookTrigger: (channelId: string, workflowId: string, enabled?: boolean) => Promise<WorkflowTrigger | null>
  updateTrigger: (channelId: string, workflowId: string, triggerId: string, patch: Partial<WorkflowTrigger>) => Promise<WorkflowTrigger | null>
  deleteTrigger: (channelId: string, workflowId: string, triggerId: string) => Promise<void>
  runWorkflow: (channelId: string, workflowId: string) => Promise<WorkflowRunDetail | null>
  fetchVersions: (channelId: string, workflowId: string) => Promise<void>
  fetchRuns: (channelId: string, workflowId?: string) => Promise<void>
  getRun: (channelId: string, runId: string) => Promise<WorkflowRunDetail | null>
  cancelRun: (channelId: string, runId: string) => Promise<void>
  actApproval: (channelId: string, runId: string, nodeRunId: string, decision: 'approved' | 'rejected', note?: string) => Promise<WorkflowRunDetail | null>
  fetchMetrics: (channelId: string) => Promise<void>
  reset: () => void
}

export interface WorkflowsStoreConfig {
  api: KyInstance
  useMock?: boolean
  getAppConfig?: () => AppRuntimeConfig | undefined
}

export function createWorkflowsStore(config: WorkflowsStoreConfig) {
  return createStore<WorkflowsState>()((set, get) => ({
    workflows: [],
    runs: [],
    versions: [],
    triggers: [],
    templates: [],
    selectedRun: null,
    metrics: null,
    loading: false,
    runsLoading: false,
    templatesLoading: false,
    saving: false,
    importingTemplate: false,
    templateError: '',
    validationErrors: [],

    fetchWorkflows: async (channelId) => {
      if (config.useMock) {
        set({ workflows: [], loading: false })
        return
      }
      set({ loading: true })
      try {
        const data = await config.api.get(`channels/${channelId}/workflows`).json<{ workflows: Workflow[] }>()
        set({
          workflows: mergeWorkflowChannel(get().workflows, channelId, data.workflows || []),
          loading: false,
        })
      } catch {
        set({ loading: false })
      }
    },

    fetchWorkflowsForChannels: async (channelIds) => {
      const uniqueChannelIds = Array.from(new Set(channelIds.map((id) => id.trim()).filter(Boolean)))
      if (config.useMock || uniqueChannelIds.length === 0) {
        set({ workflows: [], loading: false })
        return
      }
      set({ loading: true })
      try {
        const results = await Promise.all(uniqueChannelIds.map(async (channelId) => {
          try {
            const data = await config.api.get(`channels/${channelId}/workflows`).json<{ workflows: Workflow[] }>()
            return data.workflows || []
          } catch {
            return [] as Workflow[]
          }
        }))
        set({ workflows: sortWorkflows(results.flat()), loading: false })
      } catch {
        set({ loading: false })
      }
    },

    createWorkflow: async (channelId, data) => {
      if (config.useMock) return null
      set({ saving: true })
      try {
        const workflow = await config.api.post(`channels/${channelId}/workflows`, { json: data }).json<Workflow>()
        set({ workflows: [workflow, ...get().workflows], saving: false })
        return workflow
      } catch {
        set({ saving: false })
        return null
      }
    },

    fetchTemplates: async () => {
      if (config.useMock) {
        set({ templates: [], templatesLoading: false, templateError: '' })
        return
      }
      const platformURL = workflowPlatformExternalURL(config.getAppConfig?.())
      if (!platformURL) {
        set({ templates: [], templatesLoading: false, templateError: '当前应用缺少 Hive 平台入口配置' })
        return
      }
      set({ templatesLoading: true, templateError: '' })
      try {
        const url = new URL('/api/workflow-templates', platformURL)
        const response = await fetch(url.toString())
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const data = await response.json() as { templates?: WorkflowTemplate[] }
        set({ templates: data.templates || [], templatesLoading: false })
      } catch {
        set({ templates: [], templatesLoading: false, templateError: '模板库加载失败' })
      }
    },

    importWorkflowTemplate: async (channelId, templateId, options) => {
      if (config.useMock) return null
      const platformURL = workflowPlatformExternalURL(config.getAppConfig?.())
      if (!platformURL) {
        set({ templateError: '当前应用缺少 Hive 平台入口配置' })
        return null
      }
      set({ importingTemplate: true, templateError: '' })
      try {
        const url = new URL(`/api/workflow-templates/${templateId}/import-payload`, platformURL)
        if (options?.versionId) url.searchParams.set('version_id', options.versionId)
        const response = await fetch(url.toString())
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const payload = await response.json() as WorkflowTemplateImportPayload
        const graph = bindTemplateExecutor(payload.workflow.graph_json, options?.executor)
        const workflow = await config.api.post(`channels/${channelId}/workflows`, {
          json: {
            name: payload.workflow.name,
            description: payload.workflow.description,
            settings: payload.workflow.settings,
            graph_json: graph,
          },
        }).json<Workflow>()
        set({
          workflows: [workflow, ...get().workflows],
          importingTemplate: false,
          templateError: '',
        })
        return workflow
      } catch {
        set({ importingTemplate: false, templateError: '模板导入失败' })
        return null
      }
    },

    updateWorkflow: async (channelId, workflowId, patch) => {
      if (config.useMock) return null
      set({ saving: true })
      try {
        const workflow = await config.api.patch(`channels/${channelId}/workflows/${workflowId}`, { json: patch }).json<Workflow>()
        set({ workflows: get().workflows.map((item) => item.id === workflow.id ? workflow : item), saving: false })
        return workflow
      } catch {
        set({ saving: false })
        return null
      }
    },

    deleteWorkflow: async (channelId, workflowId) => {
      if (config.useMock) return false
      try {
        await config.api.delete(`channels/${channelId}/workflows/${workflowId}`)
        set({
          workflows: get().workflows.filter((item) => item.id !== workflowId),
          triggers: [],
          versions: [],
          runs: get().runs.filter((item) => item.workflow_id !== workflowId),
          selectedRun: get().selectedRun?.run.workflow_id === workflowId ? null : get().selectedRun,
          validationErrors: [],
        })
        return true
      } catch {
        return false
      }
    },

    validateWorkflow: async (channelId, workflowId, graph) => {
      if (config.useMock) {
        set({ validationErrors: [] })
        return true
      }
      try {
        const result = await config.api.post(`channels/${channelId}/workflows/${workflowId}/validate`, { json: { graph_json: graph } })
          .json<{ valid: boolean; errors: WorkflowValidationError[] }>()
        set({ validationErrors: result.errors || [] })
        return result.valid
      } catch {
        set({ validationErrors: [{ code: 'request_failed', message: '校验请求失败', severity: 'error' }] })
        return false
      }
    },

    publishWorkflow: async (channelId, workflowId, graph) => {
      if (config.useMock) return null
      set({ saving: true })
      try {
        const result = await config.api.post(`channels/${channelId}/workflows/${workflowId}/publish`, { json: { graph_json: graph } })
          .json<{ workflow: Workflow; version: WorkflowVersion }>()
        set({
          workflows: get().workflows.map((item) => item.id === result.workflow.id ? result.workflow : item),
          versions: [result.version, ...get().versions.filter((item) => item.id !== result.version.id)],
          validationErrors: [],
          saving: false,
        })
        return result.version
      } catch {
        set({ saving: false })
        return null
      }
    },

    fetchTriggers: async (channelId, workflowId) => {
      if (config.useMock) {
        set({ triggers: [] })
        return
      }
      try {
        const data = await config.api.get(`channels/${channelId}/workflows/${workflowId}/triggers`).json<{ triggers: WorkflowTrigger[] }>()
        set({ triggers: data.triggers || [] })
      } catch { /* noop */ }
    },

    createMessageTrigger: async (channelId, workflowId, keyword, enabled = true) => {
      if (config.useMock) return null
      const cleanKeyword = keyword.trim()
      if (!cleanKeyword) return null
      try {
        const trigger = await config.api.post(`channels/${channelId}/workflows/${workflowId}/triggers`, {
          json: {
            type: 'message',
            enabled,
            condition_json: {
              op: 'contains',
              left: { var: 'message.content' },
              right: cleanKeyword,
            },
            concurrency_policy: 'skip',
          },
        }).json<WorkflowTrigger>()
        set({ triggers: [trigger, ...get().triggers.filter((item) => item.id !== trigger.id)] })
        return trigger
      } catch {
        return null
      }
    },

    createScheduleTrigger: async (channelId, workflowId, rule, timezone = 'Asia/Shanghai', enabled = true) => {
      if (config.useMock) return null
      const cleanRule = rule.trim()
      const cleanTimezone = timezone.trim() || 'Asia/Shanghai'
      if (!cleanRule) return null
      try {
        const trigger = await config.api.post(`channels/${channelId}/workflows/${workflowId}/triggers`, {
          json: {
            type: 'schedule',
            enabled,
            schedule_rule: cleanRule,
            timezone: cleanTimezone,
            condition_json: {},
            concurrency_policy: 'skip',
          },
        }).json<WorkflowTrigger>()
        set({ triggers: [trigger, ...get().triggers.filter((item) => item.id !== trigger.id)] })
        return trigger
      } catch {
        return null
      }
    },

    createTaskEventTrigger: async (channelId, workflowId, eventType, enabled = true) => {
      if (config.useMock) return null
      const cleanEventType = eventType.trim()
      if (!cleanEventType) return null
      try {
        const trigger = await config.api.post(`channels/${channelId}/workflows/${workflowId}/triggers`, {
          json: {
            type: 'task_event',
            enabled,
            condition_json: {
              op: 'eq',
              left: { var: 'event.type' },
              right: cleanEventType,
            },
            concurrency_policy: 'skip',
          },
        }).json<WorkflowTrigger>()
        set({ triggers: [trigger, ...get().triggers.filter((item) => item.id !== trigger.id)] })
        return trigger
      } catch {
        return null
      }
    },

    createStorageEventTrigger: async (channelId, workflowId, eventType, enabled = true) => {
      if (config.useMock) return null
      const cleanEventType = eventType.trim()
      if (!cleanEventType) return null
      try {
        const trigger = await config.api.post(`channels/${channelId}/workflows/${workflowId}/triggers`, {
          json: {
            type: 'storage_event',
            enabled,
            condition_json: {
              op: 'eq',
              left: { var: 'event.type' },
              right: cleanEventType,
            },
            concurrency_policy: 'skip',
          },
        }).json<WorkflowTrigger>()
        set({ triggers: [trigger, ...get().triggers.filter((item) => item.id !== trigger.id)] })
        return trigger
      } catch {
        return null
      }
    },

    createWebhookTrigger: async (channelId, workflowId, enabled = true) => {
      if (config.useMock) return null
      try {
        const trigger = await config.api.post(`channels/${channelId}/workflows/${workflowId}/triggers`, {
          json: {
            type: 'webhook',
            enabled,
            condition_json: {},
            concurrency_policy: 'skip',
          },
        }).json<WorkflowTrigger>()
        set({ triggers: [trigger, ...get().triggers.filter((item) => item.id !== trigger.id)] })
        return trigger
      } catch {
        return null
      }
    },

    updateTrigger: async (channelId, workflowId, triggerId, patch) => {
      if (config.useMock) return null
      try {
        const trigger = await config.api.patch(`channels/${channelId}/workflows/${workflowId}/triggers/${triggerId}`, { json: patch }).json<WorkflowTrigger>()
        set({ triggers: get().triggers.map((item) => item.id === trigger.id ? trigger : item) })
        return trigger
      } catch {
        return null
      }
    },

    deleteTrigger: async (channelId, workflowId, triggerId) => {
      if (config.useMock) return
      try {
        await config.api.delete(`channels/${channelId}/workflows/${workflowId}/triggers/${triggerId}`)
        set({ triggers: get().triggers.filter((item) => item.id !== triggerId) })
      } catch { /* noop */ }
    },

    runWorkflow: async (channelId, workflowId) => {
      if (config.useMock) return null
      try {
        const result = await config.api.post(`channels/${channelId}/workflows/${workflowId}/runs`, {
          json: { trigger_type: 'manual', idempotency_key: `manual-${Date.now()}` },
        }).json<WorkflowRunDetail>()
        set({
          selectedRun: result,
          runs: [result.run, ...get().runs.filter((item) => item.id !== result.run.id)],
        })
        return result
      } catch {
        return null
      }
    },

    fetchVersions: async (channelId, workflowId) => {
      if (config.useMock) {
        set({ versions: [] })
        return
      }
      try {
        const data = await config.api.get(`channels/${channelId}/workflows/${workflowId}/versions`).json<{ versions: WorkflowVersion[] }>()
        set({ versions: data.versions || [] })
      } catch { /* noop */ }
    },

    fetchRuns: async (channelId, workflowId) => {
      if (config.useMock) {
        set({ runs: [], runsLoading: false })
        return
      }
      set({ runsLoading: true })
      try {
        const searchParams = workflowId ? { workflow_id: workflowId } : undefined
        const data = await config.api.get(`channels/${channelId}/workflow-runs`, { searchParams }).json<{ runs: WorkflowRun[] }>()
        set({ runs: data.runs || [], runsLoading: false })
      } catch {
        set({ runsLoading: false })
      }
    },

    getRun: async (channelId, runId) => {
      if (config.useMock) return null
      try {
        const detail = await config.api.get(`channels/${channelId}/workflow-runs/${runId}`).json<WorkflowRunDetail>()
        set({
          selectedRun: detail,
          runs: get().runs.some((item) => item.id === detail.run.id)
            ? get().runs.map((item) => item.id === detail.run.id ? detail.run : item)
            : [detail.run, ...get().runs],
        })
        return detail
      } catch {
        return null
      }
    },

    cancelRun: async (channelId, runId) => {
      if (config.useMock) return
      try {
        const run = await config.api.post(`channels/${channelId}/workflow-runs/${runId}/cancel`).json<WorkflowRun>()
        set({ runs: get().runs.map((item) => item.id === run.id ? run : item) })
        if (get().selectedRun?.run.id === run.id) {
          void get().getRun(channelId, run.id)
        }
      } catch { /* noop */ }
    },

    actApproval: async (channelId, runId, nodeRunId, decision, note = '') => {
      if (config.useMock) return null
      try {
        const result = await config.api.post(`channels/${channelId}/workflow-runs/${runId}/approvals/${nodeRunId}`, {
          json: { decision, note },
        }).json<WorkflowApprovalActionResult>()
        set({
          selectedRun: result,
          runs: get().runs.some((item) => item.id === result.run.id)
            ? get().runs.map((item) => item.id === result.run.id ? result.run : item)
            : [result.run, ...get().runs],
        })
        return result
      } catch {
        return null
      }
    },

    fetchMetrics: async (channelId) => {
      if (config.useMock) {
        set({ metrics: null })
        return
      }
      try {
        const metrics = await config.api.get(`channels/${channelId}/workflow-metrics`).json<WorkflowMetrics>()
        set({ metrics })
      } catch { /* noop */ }
    },

    reset: () => set({
      workflows: [],
      runs: [],
      versions: [],
      triggers: [],
      templates: [],
      selectedRun: null,
      metrics: null,
      loading: false,
      runsLoading: false,
      templatesLoading: false,
      saving: false,
      importingTemplate: false,
      templateError: '',
      validationErrors: [],
    }),
  }))
}

function mergeWorkflowChannel(current: Workflow[], channelId: string, next: Workflow[]): Workflow[] {
  return sortWorkflows([...current.filter((workflow) => workflow.channel_id !== channelId), ...next])
}

function sortWorkflows(workflows: Workflow[]): Workflow[] {
  return [...workflows].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

function workflowPlatformExternalURL(appConfig?: AppRuntimeConfig): string | null {
  const configured = appConfig?.platform?.external_url?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  if (typeof window === 'undefined') return null

  const { protocol, hostname } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  const parts = hostname.split('.').filter(Boolean)
  if (parts.length < 2) return null
  parts[0] = 'hive'
  return `${protocol}//${parts.join('.')}`
}

function bindTemplateExecutor(graph: WorkflowGraph, executor?: WorkflowExecutor): WorkflowGraph {
  if (!executor?.type || !executor.ref) return graph
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.type !== 'task' || node.executor?.ref) return node
      return {
        ...node,
        executor: {
          ...(node.executor || {}),
          type: executor.type,
          ref: executor.ref,
        },
      }
    }),
  }
}

export type WorkflowsStore = ReturnType<typeof createWorkflowsStore>

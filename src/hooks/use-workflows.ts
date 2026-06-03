import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useBeeSeedContext } from '../provider/BeeSeedProvider.js'

export function useWorkflows(channelId: string | null, workflowId?: string | null) {
  const { workflowsStore } = useBeeSeedContext()
  const state = useStore(workflowsStore)

  useEffect(() => {
    if (!channelId) return
    void state.fetchWorkflows(channelId)
    void state.fetchRuns(channelId, workflowId || undefined)
    void state.fetchMetrics(channelId)
  }, [channelId, workflowId])

  useEffect(() => {
    if (!channelId || !workflowId) return
    void state.fetchVersions(channelId, workflowId)
    void state.fetchTriggers(channelId, workflowId)
  }, [channelId, workflowId])

  return {
    workflows: state.workflows,
    runs: state.runs,
    versions: state.versions,
    triggers: state.triggers,
    templates: state.templates,
    selectedRun: state.selectedRun,
    metrics: state.metrics,
    loading: state.loading,
    runsLoading: state.runsLoading,
    templatesLoading: state.templatesLoading,
    saving: state.saving,
    importingTemplate: state.importingTemplate,
    templateError: state.templateError,
    validationErrors: state.validationErrors,
    fetchWorkflows: () => channelId ? state.fetchWorkflows(channelId) : Promise.resolve(),
    fetchWorkflowsForChannels: state.fetchWorkflowsForChannels,
    createWorkflow: (data: Parameters<typeof state.createWorkflow>[1], targetChannelId = channelId) => targetChannelId ? state.createWorkflow(targetChannelId, data) : Promise.resolve(null),
    updateWorkflow: (workflowId: string, patch: Parameters<typeof state.updateWorkflow>[2], targetChannelId = channelId) => targetChannelId ? state.updateWorkflow(targetChannelId, workflowId, patch) : Promise.resolve(null),
    deleteWorkflow: (workflowId: string, targetChannelId = channelId) => targetChannelId ? state.deleteWorkflow(targetChannelId, workflowId) : Promise.resolve(false),
    fetchTemplates: state.fetchTemplates,
    importWorkflowTemplate: (templateId: string, options?: Parameters<typeof state.importWorkflowTemplate>[2], targetChannelId = channelId) => targetChannelId ? state.importWorkflowTemplate(targetChannelId, templateId, options) : Promise.resolve(null),
    validateWorkflow: (workflowId: string, graph: Parameters<typeof state.validateWorkflow>[2], targetChannelId = channelId) => targetChannelId ? state.validateWorkflow(targetChannelId, workflowId, graph) : Promise.resolve(false),
    publishWorkflow: (workflowId: string, graph: Parameters<typeof state.publishWorkflow>[2], targetChannelId = channelId) => targetChannelId ? state.publishWorkflow(targetChannelId, workflowId, graph) : Promise.resolve(null),
    fetchTriggers: (workflowId: string, targetChannelId = channelId) => targetChannelId ? state.fetchTriggers(targetChannelId, workflowId) : Promise.resolve(),
    createMessageTrigger: (workflowId: string, keyword: string, enabled?: boolean, targetChannelId = channelId) => targetChannelId ? state.createMessageTrigger(targetChannelId, workflowId, keyword, enabled) : Promise.resolve(null),
    createScheduleTrigger: (workflowId: string, rule: string, timezone?: string, enabled?: boolean, targetChannelId = channelId) => targetChannelId ? state.createScheduleTrigger(targetChannelId, workflowId, rule, timezone, enabled) : Promise.resolve(null),
    createTaskEventTrigger: (workflowId: string, eventType: string, enabled?: boolean, targetChannelId = channelId) => targetChannelId ? state.createTaskEventTrigger(targetChannelId, workflowId, eventType, enabled) : Promise.resolve(null),
    createStorageEventTrigger: (workflowId: string, eventType: string, enabled?: boolean, targetChannelId = channelId) => targetChannelId ? state.createStorageEventTrigger(targetChannelId, workflowId, eventType, enabled) : Promise.resolve(null),
    createWebhookTrigger: (workflowId: string, enabled?: boolean, targetChannelId = channelId) => targetChannelId ? state.createWebhookTrigger(targetChannelId, workflowId, enabled) : Promise.resolve(null),
    updateTrigger: (workflowId: string, triggerId: string, patch: Parameters<typeof state.updateTrigger>[3], targetChannelId = channelId) => targetChannelId ? state.updateTrigger(targetChannelId, workflowId, triggerId, patch) : Promise.resolve(null),
    deleteTrigger: (workflowId: string, triggerId: string, targetChannelId = channelId) => targetChannelId ? state.deleteTrigger(targetChannelId, workflowId, triggerId) : Promise.resolve(),
    runWorkflow: (workflowId: string, targetChannelId = channelId) => targetChannelId ? state.runWorkflow(targetChannelId, workflowId) : Promise.resolve(null),
    fetchVersions: (workflowId: string, targetChannelId = channelId) => targetChannelId ? state.fetchVersions(targetChannelId, workflowId) : Promise.resolve(),
    fetchRuns: (workflowId?: string, targetChannelId = channelId) => targetChannelId ? state.fetchRuns(targetChannelId, workflowId) : Promise.resolve(),
    getRun: (runId: string, targetChannelId = channelId) => targetChannelId ? state.getRun(targetChannelId, runId) : Promise.resolve(null),
    cancelRun: (runId: string, targetChannelId = channelId) => targetChannelId ? state.cancelRun(targetChannelId, runId) : Promise.resolve(),
    actApproval: (runId: string, nodeRunId: string, decision: 'approved' | 'rejected', note?: string, targetChannelId = channelId) => targetChannelId ? state.actApproval(targetChannelId, runId, nodeRunId, decision, note) : Promise.resolve(null),
    fetchMetrics: (targetChannelId = channelId) => targetChannelId ? state.fetchMetrics(targetChannelId) : Promise.resolve(),
  }
}

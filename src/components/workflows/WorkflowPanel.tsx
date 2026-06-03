import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AlertTriangle, CheckCircle2, GitBranch, PauseCircle, Play, Plus, Save, Trash2, XCircle } from 'lucide-react'
import { useWorkflows } from '../../hooks/use-workflows.js'
import { useAuth } from '../../hooks/use-auth.js'
import { useDetailPanel } from '../../hooks/use-detail-panel.js'
import { useBeeSeedContext } from '../../provider/BeeSeedProvider.js'
import type {
  ChannelMemberInfo,
  ChannelWithMeta,
  Workflow,
  WorkflowGraph,
  WorkflowGraphEdge,
  WorkflowGraphNode,
  WorkflowNodeRun,
  WorkflowNodeRunStatus,
  WorkflowNodeType,
  WorkflowPort,
  WorkflowRun,
  WorkflowTrigger,
  WorkflowValidationError,
} from '../../core/types.js'
import { Button } from '../ui/button.js'
import { Badge } from '../ui/badge.js'
import { Input } from '../ui/input.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.js'
import { cn } from '../../lib/cn.js'
import { formatTime } from '../../lib/format.js'

interface Props {
  channelId: string | null
  channelName?: string | null
  channels?: ChannelWithMeta[]
  onChannelScopeChange?: (channelId: string) => void
  members?: ChannelMemberInfo[]
}

type WorkflowNodeData = { label: string; node: WorkflowGraphNode; status?: WorkflowNodeRunStatus; selected?: boolean; issues?: WorkflowValidationError[] }
type WorkflowFlowNode = Node<WorkflowNodeData, 'workflow'>
type ConditionBranchKind = 'rule' | 'default'
type WorkflowFlowMode = 'editor' | 'viewer'
type WorkflowContextMenu =
  | { kind: 'pane'; x: number; y: number; position: XYPosition }
  | { kind: 'node'; x: number; y: number; nodeId: string }
  | { kind: 'edge'; x: number; y: number; edgeId: string }
  | null
type WorkflowInspectorSection = 'node' | 'triggers' | 'validation'
type WorkflowTriggerType = WorkflowTrigger['type']
type WorkflowNotice = { kind: 'success' | 'warning' | 'error'; message: string } | null
type WorkflowModelOption = { id: string; label?: string; provider: string }
type WorkflowPortKind = 'inputs' | 'outputs'
type WorkflowPortSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array'
type WorkflowMappingSuggestion = { value: string; label: string; detail?: string }
type WorkflowMappingSuggestionGroup = { label: string; items: WorkflowMappingSuggestion[] }

const NODE_TYPE_LABEL: Record<WorkflowNodeType, string> = {
  trigger: '触发',
  task: '任务',
  condition: '条件',
  human_approval: '审批',
  end: '结束',
}

const NODE_STATUS_LABEL: Record<string, string> = {
  pending: '等待',
  ready: '就绪',
  running: '执行中',
  awaiting_user: '待人工',
  succeeded: '成功',
  failed: '失败',
  skipped: '跳过',
  cancelled: '取消',
}

const WORKFLOW_ACTIVE_NODE_STATUSES = new Set<WorkflowNodeRunStatus>(['ready', 'running', 'awaiting_user'])

const WORKFLOW_STATUS_LABEL: Record<string, string> = {
  draft: '未发布',
  enabled: '已启用',
  disabled: '已停用',
  archived: '已归档',
}

const TASK_EVENT_TRIGGER_OPTIONS = [
  { value: 'task_created', label: '任务创建' },
  { value: 'task_ready', label: '任务就绪' },
  { value: 'task_awaiting_verification', label: '等待验收' },
  { value: 'task_verified', label: '验收通过' },
  { value: 'task_verification_rejected', label: '验收退回' },
  { value: 'task_done', label: '任务完成' },
  { value: 'task_failed', label: '任务失败' },
  { value: 'task_blocked', label: '任务阻塞' },
  { value: 'task_updated', label: '任意更新' },
] as const

const STORAGE_EVENT_TRIGGER_OPTIONS = [
  { value: 'storage_object_available', label: '文件上传完成' },
] as const

const WORKFLOW_TRIGGER_TYPE_OPTIONS: Array<{ value: WorkflowTriggerType; label: string }> = [
  { value: 'manual', label: '手动运行' },
  { value: 'message', label: '消息关键词' },
  { value: 'schedule', label: '定时规则' },
  { value: 'task_event', label: '任务事件' },
  { value: 'storage_event', label: '文件事件' },
  { value: 'webhook', label: 'Webhook' },
]

const WORKFLOW_PORT_TYPE_OPTIONS: Array<{ value: WorkflowPortSchemaType; label: string }> = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔' },
  { value: 'object', label: '对象' },
  { value: 'array', label: '数组' },
]

const WORKFLOW_NODE_WIDTH = 216
const WORKFLOW_NODE_HEIGHT = 88

const WORKFLOW_NODE_TYPES = {
  workflow: WorkflowCanvasNode,
}

export function WorkflowPanel({ channelId, channelName, channels = [], onChannelScopeChange, members = [] }: Props) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'runs'>('editor')
  const [channelFilterId, setChannelFilterId] = useState<'all' | string>('all')
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false)
  const [templateExecutorType, setTemplateExecutorType] = useState<'agent' | 'user'>('agent')
  const [templateExecutorRef, setTemplateExecutorRef] = useState('')
  const [workflowName, setWorkflowName] = useState('新的工作流')
  const [graph, setGraph] = useState<WorkflowGraph>(() => defaultWorkflowGraph())
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<WorkflowContextMenu>(null)
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowFlowNode, Edge> | null>(null)
  const [workflowNotice, setWorkflowNotice] = useState<WorkflowNotice>(null)
  const [inspectorSectionRequest, setInspectorSectionRequest] = useState<{ section: WorkflowInspectorSection; serial: number } | null>(null)
  const [modelOptions, setModelOptions] = useState<WorkflowModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const workflowIndexFetchKeyRef = useRef('')
  const workflowDetailFetchKeyRef = useRef('')
  const pendingRunFetchKeyRef = useRef('')
  const runDetailAutoloadKeyRef = useRef('')
  const { api } = useBeeSeedContext()
  const { user } = useAuth()
  const { pendingWorkflowRunId, pendingWorkflowCreateChannelId, consumeWorkflowRunTarget, consumeWorkflowCreateTarget } = useDetailPanel()
  const {
    workflows,
    runs,
    versions,
    triggers,
    templates,
    selectedRun,
    metrics,
    loading,
    runsLoading,
    templatesLoading,
    saving,
    importingTemplate,
    templateError,
    validationErrors,
    fetchWorkflowsForChannels,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    fetchTemplates,
    importWorkflowTemplate,
    validateWorkflow,
    publishWorkflow,
    createMessageTrigger,
    createScheduleTrigger,
    createTaskEventTrigger,
    createStorageEventTrigger,
    createWebhookTrigger,
    updateTrigger,
    deleteTrigger,
    runWorkflow,
    fetchVersions,
    fetchTriggers,
    fetchRuns,
    getRun,
    cancelRun,
    actApproval,
  } = useWorkflows(channelId, null)

  const channelOptions = useMemo(() => channels.length > 0 ? channels : channelId ? [{ id: channelId, name: channelName || null } as ChannelWithMeta] : [], [channelId, channelName, channels])
  const channelNameById = useMemo(() => new Map(channelOptions.map((channel) => [channel.id, channel.name?.trim() || '未命名频道'])), [channelOptions])
  const workflowChannelIds = useMemo(
    () => Array.from(new Set(channelOptions.map((channel) => channel.id.trim()).filter(Boolean))).sort(),
    [channelOptions],
  )
  const workflowChannelIdsKey = workflowChannelIds.join('|')
  const filteredWorkflows = useMemo(
    () => channelFilterId === 'all' ? workflows : workflows.filter((workflow) => workflow.channel_id === channelFilterId),
    [channelFilterId, workflows],
  )
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) || null
  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) || null
  const createChannelId = (channelFilterId === 'all' ? channelId : channelFilterId) || channelId
  const createChannelLabel = createChannelId ? channelNameById.get(createChannelId) || channelName || '当前频道' : '当前频道'
  const agentMembers = members.filter((member) => member.member_type === 'agent' && member.agent_id)
  const userMembers = members.filter((member) => member.member_type === 'user' && member.user_id)
  const templateExecutorOptions = useMemo(() => [
    ...agentMembers.map((member) => ({
      type: 'agent' as const,
      ref: member.agent_id || '',
      label: member.display_name || member.nickname || member.chinese_name || member.agent_id || 'Agent',
    })),
    ...userMembers.map((member) => ({
      type: 'user' as const,
      ref: member.user_id || '',
      label: member.display_name || member.nickname || member.user_id || '用户',
    })),
  ].filter((item) => item.ref), [agentMembers, userMembers])
  const currentMember = members.find((member) => member.member_type === 'user' && member.user_id === user?.id)
  const canManage = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'super_admin' || currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const defaultConditionModel = modelOptions[0]?.id || ''

  useEffect(() => {
    let active = true
    setModelsLoading(true)
    api.get('models').json<WorkflowModelOption[]>()
      .then((models) => {
        if (!active) return
        setModelOptions(sortWorkflowModelOptions(models || []))
      })
      .catch(() => {
        if (active) setModelOptions([])
      })
      .finally(() => {
        if (active) setModelsLoading(false)
      })
    return () => {
      active = false
    }
  }, [api])

  useEffect(() => {
    if (!pendingWorkflowCreateChannelId) return
    const targetChannelId = consumeWorkflowCreateTarget() || channelId
    if (!targetChannelId) return

    setActiveTab('editor')
    setTemplatePanelOpen(false)
    if (channelOptions.some((channel) => channel.id === targetChannelId)) {
      setChannelFilterId(targetChannelId)
    }
    if (!canManage) {
      setWorkflowNotice({ kind: 'warning', message: '只有频道 owner/admin 可以新建工作流。' })
      return
    }

    void createWorkflow({
      name: '新的工作流',
      description: '',
      graph_json: defaultWorkflowGraph(),
    }, targetChannelId).then((workflow) => {
      if (!workflow) {
        setWorkflowNotice({ kind: 'error', message: '新建工作流失败，请稍后重试。' })
        return
      }
      if (workflow.channel_id !== channelId) onChannelScopeChange?.(workflow.channel_id)
      setSelectedWorkflowId(workflow.id)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setWorkflowNotice({ kind: 'success', message: '已创建新的工作流草稿。' })
    })
  }, [pendingWorkflowCreateChannelId])

  useEffect(() => {
    if (!workflowChannelIdsKey) return
    if (workflowIndexFetchKeyRef.current === workflowChannelIdsKey) return
    workflowIndexFetchKeyRef.current = workflowChannelIdsKey
    void fetchWorkflowsForChannels(workflowChannelIds)
  }, [workflowChannelIdsKey])

  useEffect(() => {
    if (channelFilterId === 'all') return
    if (channelOptions.some((channel) => channel.id === channelFilterId)) return
    setChannelFilterId('all')
  }, [channelFilterId, channelOptions])

  useEffect(() => {
    if (selectedWorkflowId && filteredWorkflows.some((workflow) => workflow.id === selectedWorkflowId)) return
    setSelectedWorkflowId(filteredWorkflows[0]?.id ?? null)
  }, [filteredWorkflows, selectedWorkflowId])

  useEffect(() => {
    if (!selectedWorkflow) {
      setGraph(defaultWorkflowGraph())
      setWorkflowName('新的工作流')
      setSelectedNodeId(null)
      return
    }
    const draft = draftGraphFromWorkflow(selectedWorkflow)
    setGraph(draft || defaultWorkflowGraph())
    setWorkflowName(selectedWorkflow.name || '新的工作流')
    setSelectedNodeId(null)
  }, [selectedWorkflow?.id])

  useEffect(() => {
    if (!selectedWorkflow) {
      workflowDetailFetchKeyRef.current = ''
      return
    }
    const detailKey = `${selectedWorkflow.channel_id}:${selectedWorkflow.id}`
    if (workflowDetailFetchKeyRef.current === detailKey) return
    workflowDetailFetchKeyRef.current = detailKey
    void fetchVersions(selectedWorkflow.id, selectedWorkflow.channel_id)
    void fetchTriggers(selectedWorkflow.id, selectedWorkflow.channel_id)
    void fetchRuns(selectedWorkflow.id, selectedWorkflow.channel_id)
  }, [selectedWorkflow?.channel_id, selectedWorkflow?.id])

  useEffect(() => {
    if (!channelId || !pendingWorkflowRunId) return
    const pendingKey = `${channelId}:${pendingWorkflowRunId}`
    if (pendingRunFetchKeyRef.current === pendingKey) return
    pendingRunFetchKeyRef.current = pendingKey
    const runId = consumeWorkflowRunTarget() || pendingWorkflowRunId
    setActiveTab('runs')
    void getRun(runId, channelId).then((detail) => {
      if (!detail) return
      setSelectedWorkflowId(detail.run.workflow_id)
      void fetchRuns(detail.run.workflow_id, detail.run.channel_id)
    })
  }, [channelId, pendingWorkflowRunId])

  useEffect(() => {
    if (!templatePanelOpen) return
    void fetchTemplates()
  }, [templatePanelOpen])

  useEffect(() => {
    if (activeTab !== 'runs' || runsLoading || runs.length === 0) return
    const selectedRunInList = !!selectedRun && runs.some((run) => run.id === selectedRun.run.id)
    if (selectedRunInList) return
    const firstRun = runs[0]
    const autoLoadKey = `${firstRun.channel_id}:${firstRun.id}`
    if (runDetailAutoloadKeyRef.current === autoLoadKey) return
    runDetailAutoloadKeyRef.current = autoLoadKey
    void getRun(firstRun.id, firstRun.channel_id)
  }, [activeTab, runs, runsLoading, selectedRun?.run.id])

  useEffect(() => {
    const currentExists = templateExecutorOptions.some((item) => item.type === templateExecutorType && item.ref === templateExecutorRef)
    if (currentExists) return
    const first = templateExecutorOptions[0]
    setTemplateExecutorType(first?.type || 'agent')
    setTemplateExecutorRef(first?.ref || '')
  }, [templateExecutorOptions, templateExecutorRef, templateExecutorType])

  const runGraph = useMemo(() => {
    if (!selectedRun) return graph
    const versionGraph = versions.find((version) => version.id === selectedRun.run.workflow_version_id)?.graph_json
    const snapshotGraph = normalizeWorkflowGraph(versionGraph || graphFromNodeRuns(selectedRun.node_runs))
    return workflowGraphWithPreferredPositions(snapshotGraph, graph)
  }, [graph, selectedRun, versions])

  const runNodeStatus = useMemo(() => {
    const out = new Map<string, WorkflowNodeRunStatus>()
    selectedRun?.node_runs.forEach((nodeRun) => out.set(nodeRun.node_id, nodeRun.status))
    return out
  }, [selectedRun])

  const localValidationErrors = useMemo(
    () => validateWorkflowGraphLocally(graph, agentMembers, userMembers),
    [agentMembers, graph, userMembers],
  )
  const nodeIssues = useMemo(() => workflowIssuesByNode(localValidationErrors), [localValidationErrors])
  const shownValidationErrors = useMemo(
    () => mergeWorkflowValidationErrors(localValidationErrors, validationErrors),
    [localValidationErrors, validationErrors],
  )

  const editorFlow = useMemo(() => graphToFlow(graph, undefined, selectedNodeId, nodeIssues), [graph, nodeIssues, selectedNodeId])
  const viewerFlow = useMemo(() => graphToFlow(runGraph, runNodeStatus, null, undefined, 'viewer'), [runGraph, runNodeStatus])

  const onNodesChange = useCallback((changes: NodeChange<WorkflowFlowNode>[]) => {
    const nextNodes = applyNodeChanges(changes, editorFlow.nodes)
    setGraph(flowToGraph(nextNodes, editorFlow.edges))
  }, [editorFlow.edges, editorFlow.nodes])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const nextEdges = applyEdgeChanges(changes, editorFlow.edges)
    setGraph(flowToGraph(editorFlow.nodes, nextEdges))
  }, [editorFlow.edges, editorFlow.nodes])

  const onConnect = useCallback((connection: Connection) => {
    const nextEdges = addEdge({ ...connection, id: `edge-${Date.now()}`, type: 'smoothstep' }, editorFlow.edges)
    setGraph(flowToGraph(editorFlow.nodes, nextEdges))
    setContextMenu(null)
  }, [editorFlow.edges, editorFlow.nodes])

  async function handleCreateWorkflow() {
    if (!canManage || !createChannelId) return
    const workflow = await createWorkflow({
      name: '新的工作流',
      description: '',
      graph_json: defaultWorkflowGraph(),
    }, createChannelId)
    if (workflow) {
      if (workflow.channel_id !== channelId) onChannelScopeChange?.(workflow.channel_id)
      setSelectedWorkflowId(workflow.id)
      setActiveTab('editor')
    }
  }

  async function handleDeleteWorkflow(workflow: Workflow) {
    if (!canManage) return
    const confirmed = window.confirm(`删除工作流「${workflow.name}」？删除后它不会再出现在当前频道的工作流列表中。`)
    if (!confirmed) return
    const nextWorkflow = filteredWorkflows.find((item) => item.id !== workflow.id) || null
    const deleted = await deleteWorkflow(workflow.id, workflow.channel_id)
    if (!deleted) return
    if (selectedWorkflowId === workflow.id) {
      setSelectedWorkflowId(nextWorkflow?.id ?? null)
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setContextMenu(null)
    }
  }

  async function handleImportTemplate(templateId: string) {
    if (!canManage || !createChannelId) return
    const workflow = await importWorkflowTemplate(templateId, {
      executor: templateExecutorRef ? { type: templateExecutorType, ref: templateExecutorRef } : undefined,
    }, createChannelId)
    if (!workflow) return
    if (workflow.channel_id !== channelId) onChannelScopeChange?.(workflow.channel_id)
    setSelectedWorkflowId(workflow.id)
    setActiveTab('editor')
    setTemplatePanelOpen(false)
  }

  async function saveDraft() {
    if (!canManage) return null
    if (!selectedWorkflow) {
      if (!createChannelId) return null
      const workflow = await createWorkflow({ name: workflowName.trim() || '新的工作流', graph_json: graph }, createChannelId)
      if (workflow) setSelectedWorkflowId(workflow.id)
      return workflow
    }
    return updateWorkflow(selectedWorkflow.id, { name: workflowName.trim() || selectedWorkflow.name, description: selectedWorkflow.description, graph_json: graph }, selectedWorkflow.channel_id)
  }

  async function handleValidate() {
    setWorkflowNotice(null)
    const workflow = await saveDraft()
    if (!workflow) return
    const valid = await validateWorkflow(workflow.id, graph, workflow.channel_id)
    setInspectorSectionRequest({ section: 'validation', serial: Date.now() })
    setWorkflowNotice(valid
      ? { kind: 'success', message: '校验通过，可以发布并启用。' }
      : { kind: 'warning', message: '校验未通过，先处理右侧列出的配置问题。' })
  }

  async function handlePublish() {
    setWorkflowNotice(null)
    const workflow = await saveDraft()
    if (!workflow) return
    const valid = await validateWorkflow(workflow.id, graph, workflow.channel_id)
    if (!valid) {
      setInspectorSectionRequest({ section: 'validation', serial: Date.now() })
      setWorkflowNotice({ kind: 'warning', message: '发布失败：当前工作流还有校验错误，修正后才能生成可运行版本。' })
      return
    }
    const version = await publishWorkflow(workflow.id, graph, workflow.channel_id)
    if (!version) {
      setInspectorSectionRequest({ section: 'validation', serial: Date.now() })
      setWorkflowNotice({ kind: 'error', message: '发布失败：服务端没有创建版本，请稍后重试或检查控制台错误。' })
      return
    }
    setWorkflowNotice({ kind: 'success', message: `已发布并启用版本 v${version.version_no}。` })
  }

  async function handleRun() {
    if (!selectedWorkflow || !canManage) return
    const detail = await runWorkflow(selectedWorkflow.id, selectedWorkflow.channel_id)
    if (detail) {
      setActiveTab('runs')
      await getRun(detail.run.id, selectedWorkflow.channel_id)
      await fetchRuns(selectedWorkflow.id, selectedWorkflow.channel_id)
    }
  }

  async function handleCancelRun(runId: string) {
    const run = selectedRun?.run.id === runId ? selectedRun.run : runs.find((item) => item.id === runId)
    await cancelRun(runId, run?.channel_id || selectedWorkflow?.channel_id || channelId || undefined)
  }

  async function handleApproval(runId: string, nodeRunId: string, decision: 'approved' | 'rejected', note?: string) {
    const run = selectedRun?.run.id === runId ? selectedRun.run : runs.find((item) => item.id === runId)
    return actApproval(runId, nodeRunId, decision, note, run?.channel_id || selectedWorkflow?.channel_id || channelId || undefined)
  }

  async function handleAddMessageTrigger(keyword: string) {
    if (!selectedWorkflow || !canManage) return null
    return createMessageTrigger(selectedWorkflow.id, keyword, true, selectedWorkflow.channel_id)
  }

  async function handleAddScheduleTrigger(rule: string, timezone: string) {
    if (!selectedWorkflow || !canManage) return null
    return createScheduleTrigger(selectedWorkflow.id, rule, timezone, true, selectedWorkflow.channel_id)
  }

  async function handleAddTaskEventTrigger(eventType: string) {
    if (!selectedWorkflow || !canManage) return null
    return createTaskEventTrigger(selectedWorkflow.id, eventType, true, selectedWorkflow.channel_id)
  }

  async function handleAddStorageEventTrigger(eventType: string) {
    if (!selectedWorkflow || !canManage) return null
    return createStorageEventTrigger(selectedWorkflow.id, eventType, true, selectedWorkflow.channel_id)
  }

  async function handleAddWebhookTrigger() {
    if (!selectedWorkflow || !canManage) return null
    return createWebhookTrigger(selectedWorkflow.id, true, selectedWorkflow.channel_id)
  }

  async function handleToggleTrigger(trigger: WorkflowTrigger) {
    if (!selectedWorkflow || !canManage) return
    await updateTrigger(selectedWorkflow.id, trigger.id, { enabled: !trigger.enabled }, selectedWorkflow.channel_id)
  }

  async function handleDeleteTrigger(trigger: WorkflowTrigger) {
    if (!selectedWorkflow || !canManage) return
    await deleteTrigger(selectedWorkflow.id, trigger.id, selectedWorkflow.channel_id)
  }

  function updateSelectedNode(patch: Partial<WorkflowGraphNode>) {
    if (!selectedNode) return
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === selectedNode.id ? { ...node, ...patch } : node),
    }))
  }

  function updateGraphEdge(edgeId: string, patch: Partial<WorkflowGraphEdge>) {
    if (!canManage) return
    setGraph((current) => ({
      ...current,
      edges: current.edges.map((edge) => edge.id === edgeId ? { ...edge, ...patch } : edge),
    }))
  }

  function nextNodePosition(explicit?: XYPosition): XYPosition {
    if (explicit) return explicit
    const selected = graph.nodes.find((node) => node.id === selectedNodeId)
    if (selected?.ui?.position) {
      return { x: selected.ui.position.x + 280, y: selected.ui.position.y }
    }
    const rightmost = graph.nodes.reduce((max, node) => Math.max(max, node.ui?.position?.x ?? 80), 80)
    return { x: rightmost + 280, y: 160 }
  }

  function addNode(type: WorkflowNodeType, position?: XYPosition) {
    if (!canManage) return
    const id = `${type}-${Date.now()}`
    const node: WorkflowGraphNode = {
      id,
      key: id,
      type,
      title: NODE_TYPE_LABEL[type],
      inputs: [],
      outputs: [],
      ui: { position: nextNodePosition(position) },
    }
    if (type === 'task') {
      node.title = '新任务'
      node.executor = { type: 'agent', ref: agentMembers[0]?.agent_id || '' }
      node.require_user_verification = true
    } else if (type === 'condition') {
      node.title = '智能分支'
      node.condition_mode = 'llm'
      node.condition_model = defaultConditionModel
      node.condition_selection = 'single'
      node.condition_fallback = 'default'
      node.condition_confidence_threshold = 0.35
    } else if (type === 'human_approval') {
      node.title = '人工审批'
    } else if (type === 'end') {
      node.title = '结束'
    } else if (type === 'trigger') {
      node.title = '触发'
    }
    setGraph((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
    setContextMenu(null)
  }

  function createConditionBranch(conditionNodeId: string, kind: ConditionBranchKind) {
    if (!canManage) return
    setGraph((current) => {
      const condition = current.nodes.find((item) => item.id === conditionNodeId)
      if (!condition) return current
      const outgoingCount = current.edges.filter((edge) => edge.source === conditionNodeId).length
      const suffix = `${Date.now()}-${outgoingCount + 1}`
      const nodeId = `task-${suffix}`
      const basePosition = condition.ui?.position || { x: 120, y: 120 }
      const branchLabel = kind === 'default' ? 'default' : `branch_${outgoingCount + 1}`
      const branchTitle = kind === 'default' ? '默认分支任务' : `分支任务 ${outgoingCount + 1}`
      const node: WorkflowGraphNode = {
        id: nodeId,
        key: nodeId,
        type: 'task',
        title: branchTitle,
        executor: { type: 'agent', ref: agentMembers[0]?.agent_id || '' },
        require_user_verification: true,
        inputs: [],
        outputs: [],
        ui: { position: { x: basePosition.x + 300, y: basePosition.y + outgoingCount * 150 } },
      }
      const edge: WorkflowGraphEdge = {
        id: `edge-${conditionNodeId}-${nodeId}`,
        source: conditionNodeId,
        target: nodeId,
        source_handle: branchLabel,
        branch_description: kind === 'default' ? '其他分支都不适合或不确定时走这里。' : '符合这个分支语义时执行。',
      }
      return { ...current, nodes: [...current.nodes, node], edges: [...current.edges, edge] }
    })
    setSelectedNodeId(conditionNodeId)
    setSelectedEdgeId(null)
    setContextMenu(null)
  }

  function duplicateNode(nodeId: string) {
    if (!canManage) return
    const source = graph.nodes.find((node) => node.id === nodeId)
    if (!source) return
    const id = `${source.type}-${Date.now()}`
    const position = source.ui?.position || { x: 120, y: 120 }
    const node: WorkflowGraphNode = {
      ...source,
      id,
      key: id,
      title: `${source.title || NODE_TYPE_LABEL[source.type]} 副本`,
      ui: { ...(source.ui || {}), position: { x: position.x + 40, y: position.y + 40 } },
    }
    setGraph((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelectedNodeId(id)
    setSelectedEdgeId(null)
    setContextMenu(null)
  }

  function deleteNode(nodeId: string) {
    if (!canManage) return
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    }))
    setSelectedNodeId((current) => (current === nodeId ? null : current))
    setContextMenu(null)
  }

  function deleteEdge(edgeId: string) {
    if (!canManage) return
    setGraph((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== edgeId),
    }))
    setSelectedEdgeId((current) => (current === edgeId ? null : current))
    setContextMenu(null)
  }

  function deleteSelected() {
    if (selectedNodeId) {
      deleteNode(selectedNodeId)
      return
    }
    if (selectedEdgeId) {
      deleteEdge(selectedEdgeId)
    }
  }

  function selectWorkflow(workflow: Workflow) {
    setSelectedWorkflowId(workflow.id)
    if (workflow.channel_id !== channelId) {
      onChannelScopeChange?.(workflow.channel_id)
    }
  }

  function insertDefaultGraph() {
    if (!canManage) return
    const next = defaultWorkflowGraph()
    setGraph(next)
    setSelectedNodeId(next.nodes.find((node) => node.type === 'task')?.id || next.nodes[0]?.id || null)
    setSelectedEdgeId(null)
    setContextMenu(null)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!canManage || activeTab !== 'editor') return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (target?.isContentEditable) return
      if (!selectedNodeId && !selectedEdgeId) return
      event.preventDefault()
      deleteSelected()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, canManage, selectedEdgeId, selectedNodeId])

  function openPaneMenu(event: ReactMouseEvent | MouseEvent) {
    if (!canManage || !flowInstance) return
    event.preventDefault()
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setContextMenu({
      kind: 'pane',
      x: event.clientX,
      y: event.clientY,
      position: flowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    })
  }

  function openNodeMenu(event: ReactMouseEvent, node: WorkflowFlowNode) {
    if (!canManage) return
    event.preventDefault()
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setContextMenu({ kind: 'node', x: event.clientX, y: event.clientY, nodeId: node.id })
  }

  function openEdgeMenu(event: ReactMouseEvent, edge: Edge) {
    if (!canManage) return
    event.preventDefault()
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
    setContextMenu({ kind: 'edge', x: event.clientX, y: event.clientY, edgeId: edge.id })
  }

  if (!channelId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#fafafa] p-6 text-sm text-muted-foreground">
        选择一个频道后查看工作流
      </div>
    )
  }

  const emptyWorkflow = !loading && filteredWorkflows.length === 0
  const filterLabel = channelFilterId === 'all' ? '全部频道' : channelNameById.get(channelFilterId) || '未命名频道'
  const visibleWorkflowCount = filteredWorkflows.length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fafafa]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-lg font-semibold text-[#181d26]">工作流</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">跨频道流程索引；编辑、发布和运行按工作流绑定频道生效</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {metrics && (
            <div className="hidden gap-2 text-xs text-muted-foreground md:flex">
              <span>活跃 {metrics.active_runs}</span>
              <span>待人工 {metrics.awaiting_user_runs}</span>
              <span>24h 成功 {metrics.succeeded_24h}</span>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleCreateWorkflow} disabled={!canManage || !createChannelId} title={`在 #${createChannelLabel} 新建工作流`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新建工作流
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTemplatePanelOpen((open) => !open)} disabled={!canManage || !createChannelId} title={`导入模板到 #${createChannelLabel}`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            导入模板
          </Button>
          <Button size="sm" onClick={handleRun} disabled={!canManage || !selectedWorkflow?.active_version_id}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            运行
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-b border-border bg-white lg:border-b-0 lg:border-r">
          <div className="space-y-2 p-3">
            <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-3 py-2">
              <label className="block text-xs font-medium text-muted-foreground">
                频道筛选
                <select
                  value={channelFilterId}
                  onChange={(event) => setChannelFilterId(event.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-[#dddddd] bg-white px-2 text-xs text-[#181d26] outline-none focus:border-[#181d26]"
                >
                  <option value="all">全部频道</option>
                  {channelOptions.map((channel) => (
                    <option key={channel.id} value={channel.id}># {channel.name?.trim() || '未命名频道'}</option>
                  ))}
                </select>
              </label>
              <div className="mt-2 text-xs leading-5 text-muted-foreground">
                当前显示 {visibleWorkflowCount} / {workflows.length} 个工作流；新建和导入会进入 # {createChannelLabel}。
              </div>
            </div>
            {canManage && templatePanelOpen && (
              <div className="mb-3 rounded-md border border-[#dddddd] bg-[#f8fafc] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#181d26]">模板库</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">导入到 # {createChannelLabel}</div>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-[#181d26]"
                    onClick={() => setTemplatePanelOpen(false)}
                  >
                    关闭
                  </button>
                </div>
                <label className="mt-3 block text-xs font-medium text-muted-foreground">
                  默认执行者
                  <select
                    className="mt-1 h-8 w-full rounded-md border border-[#dddddd] bg-white px-2 text-xs text-[#181d26] outline-none focus:border-[#181d26]"
                    value={templateExecutorRef ? `${templateExecutorType}:${templateExecutorRef}` : ''}
                    onChange={(event) => {
                      const [type, ref] = event.target.value.split(':')
                      setTemplateExecutorType(type === 'user' ? 'user' : 'agent')
                      setTemplateExecutorRef(ref || '')
                    }}
                  >
                    <option value="">导入后手动绑定</option>
                    {templateExecutorOptions.map((option) => (
                      <option key={`${option.type}:${option.ref}`} value={`${option.type}:${option.ref}`}>
                        {option.type === 'agent' ? 'Agent' : '用户'} · {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 space-y-2">
                  {templatesLoading ? (
                    <div className="rounded-md border border-dashed border-[#dddddd] bg-white p-3 text-xs text-muted-foreground">正在加载模板...</div>
                  ) : templates.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#dddddd] bg-white p-3 text-xs text-muted-foreground">暂无可用模板</div>
                  ) : templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="w-full rounded-md border border-[#dddddd] bg-white p-3 text-left transition-colors hover:border-[#9297a0]"
                      disabled={importingTemplate}
                      onClick={() => void handleImportTemplate(template.id)}
                    >
                      <div className="truncate text-sm font-medium text-[#181d26]">{template.display_name}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{template.description || 'Workflow 模板'}</div>
                      <div className="mt-2 text-xs text-[#1b61c9]">{importingTemplate ? '导入中...' : '导入为草稿'}</div>
                    </button>
                  ))}
                </div>
                {templateError && <div className="mt-2 text-xs text-red-600">{templateError}</div>}
              </div>
            )}
            {loading ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">正在加载...</div>
            ) : filteredWorkflows.length === 0 ? (
              <button
                type="button"
                className="w-full rounded-md border border-dashed p-4 text-left text-sm text-muted-foreground hover:border-[#9297a0] hover:bg-[#f8fafc]"
                onClick={handleCreateWorkflow}
                disabled={!canManage}
              >
                {channelFilterId === 'all' ? '还没有工作流' : `# ${filterLabel} 还没有工作流`}
              </button>
            ) : filteredWorkflows.map((workflow) => {
              const active = workflow.id === selectedWorkflowId
              const workflowChannelLabel = channelNameById.get(workflow.channel_id) || '未知频道'
              return (
              <div
                key={workflow.id}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md border px-3 py-2 transition-colors',
                  active ? 'border-[#181d26] bg-[#181d26] text-white' : 'border-[#dddddd] bg-white hover:border-[#9297a0] hover:bg-[#f8fafc]',
                )}
              >
                <button
                  type="button"
                  onClick={() => selectWorkflow(workflow)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{workflow.name}</span>
                    <WorkflowStatusBadge status={workflow.status} active={active} />
                  </div>
                  <div className={cn('mt-1 truncate text-xs', active ? 'text-white/70' : 'text-muted-foreground')}>
                    绑定 # {workflowChannelLabel} · {workflow.active_version_id ? '已有可运行版本' : '还没有发布版本'}
                  </div>
                </button>
                {canManage && (
                  <button
                    type="button"
                    title="删除工作流"
                    aria-label={`删除工作流 ${workflow.name}`}
                    onClick={() => void handleDeleteWorkflow(workflow)}
                    className={cn(
                      'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                      active ? 'text-white/65 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]',
                    )}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
              )
            })}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden">
          {emptyWorkflow ? (
            <EmptyWorkflowState
              canManage={canManage}
              channelName={createChannelLabel}
              allChannels={channelFilterId === 'all'}
              onCreate={handleCreateWorkflow}
              onOpenTemplates={() => setTemplatePanelOpen(true)}
            />
          ) : (
          <Tabs defaultValue="editor" value={activeTab} onValueChange={(value) => setActiveTab(value as 'editor' | 'runs')} className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
              <TabsList className="max-w-full overflow-x-auto">
                <TabsTrigger value="editor">编辑器</TabsTrigger>
                <TabsTrigger value="runs">运行查看器</TabsTrigger>
              </TabsList>
              {activeTab === 'editor' && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleValidate} disabled={!canManage}>校验</Button>
                  <Button size="sm" variant="outline" onClick={() => void saveDraft()} disabled={saving || !canManage}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    保存
                  </Button>
                  <Button size="sm" onClick={handlePublish} disabled={saving || !canManage}>发布</Button>
                </div>
              )}
            </div>

            <TabsContent value="editor" className="min-h-0 flex-1 overflow-hidden">
              <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-h-[460px] overflow-hidden bg-white">
                  <ReactFlow
                    nodes={editorFlow.nodes}
                    edges={editorFlow.edges}
                    nodeTypes={WORKFLOW_NODE_TYPES}
                    onInit={setFlowInstance}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_, node) => {
                      setSelectedNodeId(node.id)
                      setSelectedEdgeId(null)
                      setContextMenu(null)
                    }}
                    onEdgeClick={(_, edge) => {
                      setSelectedEdgeId(edge.id)
                      setSelectedNodeId(null)
                      setContextMenu(null)
                    }}
                    onNodeContextMenu={openNodeMenu}
                    onEdgeContextMenu={openEdgeMenu}
                    onPaneContextMenu={openPaneMenu}
                    onPaneClick={() => {
                      setSelectedNodeId(null)
                      setSelectedEdgeId(null)
                      setContextMenu(null)
                    }}
                    onSelectionChange={({ nodes, edges }) => {
                      if (nodes[0]) {
                        setSelectedNodeId(nodes[0].id)
                        setSelectedEdgeId(null)
                        return
                      }
                      if (edges[0]) {
                        setSelectedEdgeId(edges[0].id)
                        setSelectedNodeId(null)
                      }
                    }}
                    nodesDraggable={canManage}
                    nodesConnectable={canManage}
                    elementsSelectable={canManage}
                    deleteKeyCode={null}
                    minZoom={0.2}
                    maxZoom={1.15}
                    fitView
                    fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
                  >
                    <Panel position="top-left" className="m-3">
                      <WorkflowNodePalette
                        canManage={canManage}
                        empty={editorFlow.nodes.length === 0}
                        onAddNode={addNode}
                        onInsertDefaultGraph={insertDefaultGraph}
                      />
                    </Panel>
                    {contextMenu && (
                      <WorkflowContextMenuLayer
                        menu={contextMenu}
                        graph={graph}
                        onAddNode={addNode}
                        onDuplicateNode={duplicateNode}
                        onDeleteNode={deleteNode}
                        onDeleteEdge={deleteEdge}
                        onClose={() => setContextMenu(null)}
                      />
                    )}
                    {editorFlow.nodes.length === 0 && (
                      <Panel position="bottom-center" className="mb-5">
                        <div className="rounded-md border border-[#dddddd] bg-white px-3 py-2 text-xs leading-5 text-[#41454d] shadow-sm">
                          右侧触发配置只决定何时启动；画布节点需要从左上方节点库添加。
                        </div>
                      </Panel>
                    )}
                    <Background />
                    <Controls />
                    <MiniMap pannable zoomable />
                  </ReactFlow>
                </div>
                <WorkflowInspector
                  workflow={selectedWorkflow}
                  workflowName={workflowName}
                  graph={graph}
                  node={selectedNode}
                  triggers={triggers}
                  validationErrors={shownValidationErrors}
                  notice={workflowNotice}
                  sectionRequest={inspectorSectionRequest}
                  canManage={canManage}
                  agentMembers={agentMembers}
                  userMembers={userMembers}
                  modelOptions={modelOptions}
                  modelsLoading={modelsLoading}
                  onWorkflowNameChange={setWorkflowName}
                  onNodeChange={canManage ? updateSelectedNode : () => {}}
                  onEdgeChange={updateGraphEdge}
                  onAddMessageTrigger={handleAddMessageTrigger}
                  onAddScheduleTrigger={handleAddScheduleTrigger}
                  onAddTaskEventTrigger={handleAddTaskEventTrigger}
                  onAddStorageEventTrigger={handleAddStorageEventTrigger}
                  onAddWebhookTrigger={handleAddWebhookTrigger}
                  onToggleTrigger={handleToggleTrigger}
                  onDeleteTrigger={handleDeleteTrigger}
                  onDeleteNode={deleteNode}
                  onCreateConditionBranch={createConditionBranch}
                />
              </div>
            </TabsContent>

            <TabsContent value="runs" className="min-h-0 flex-1 overflow-hidden">
              <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_360px]">
                <RunList
                  runs={runs}
                  loading={runsLoading}
                  selectedRunId={selectedRun?.run.id}
                  onSelect={(run) => void getRun(run.id, run.channel_id)}
                />
                <RunGraphViewer flow={viewerFlow} detail={selectedRun} />
                <RunTimeline detail={selectedRun} canManage={canManage} onCancel={handleCancelRun} onApproval={handleApproval} />
              </div>
            </TabsContent>
          </Tabs>
          )}
        </main>
      </div>
    </div>
  )
}

function EmptyWorkflowState({
  canManage,
  channelName,
  allChannels,
  onCreate,
  onOpenTemplates,
}: {
  canManage: boolean
  channelName: string
  allChannels: boolean
  onCreate: () => Promise<void>
  onOpenTemplates: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-white p-4 sm:p-8">
      <div className="w-full max-w-[36rem] rounded-lg border border-[#dddddd] bg-[#f8fafc] p-5 sm:p-6">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#dddddd] bg-white text-[#181d26]">
          <GitBranch className="h-4 w-4" />
        </div>
        <h2 className="mt-4 text-xl font-medium leading-8 text-[#181d26]">{allChannels ? '还没有工作流' : '当前筛选频道还没有工作流'}</h2>
        <div className="mt-2 inline-flex max-w-full items-center rounded-md border border-[#dddddd] bg-white px-2 py-1 text-sm font-medium text-[#181d26]">
          <span className="truncate">新建和导入目标：# {channelName}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[#41454d]">
          可以从官方模板导入一张可编辑 DAG，也可以先创建空白工作流。发布后才能手动运行，并在运行查看器里审核节点、审批和任务结果。
        </p>
        {canManage ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={onOpenTemplates}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              从模板导入
            </Button>
            <Button variant="outline" onClick={() => void onCreate()}>
              新建空白工作流
            </Button>
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm text-muted-foreground">
            只有频道 owner/admin 可以创建、导入、发布和运行工作流。
          </div>
        )}
      </div>
    </div>
  )
}

function WorkflowNodePalette({
  canManage,
  empty,
  onAddNode,
  onInsertDefaultGraph,
}: {
  canManage: boolean
  empty: boolean
  onAddNode: (type: WorkflowNodeType) => void
  onInsertDefaultGraph: () => void
}) {
  return (
    <div className="inline-flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-lg border border-[#dddddd] bg-white/95 p-1 shadow-sm backdrop-blur">
      <span className="px-2 text-xs font-medium text-[#41454d]">节点</span>
      <WorkflowPaletteButton label="触发" disabled={!canManage} onClick={() => onAddNode('trigger')} />
      <WorkflowPaletteButton label="任务" disabled={!canManage} onClick={() => onAddNode('task')} />
      <WorkflowPaletteButton label="条件" disabled={!canManage} onClick={() => onAddNode('condition')} />
      <WorkflowPaletteButton label="审批" disabled={!canManage} onClick={() => onAddNode('human_approval')} />
      <WorkflowPaletteButton label="结束" disabled={!canManage} onClick={() => onAddNode('end')} />
      {empty && (
        <button
          type="button"
          onClick={onInsertDefaultGraph}
          disabled={!canManage}
          className="ml-1 rounded-md border border-[#dddddd] bg-[#f8fafc] px-2 py-1.5 text-xs font-medium text-[#181d26] transition-colors hover:border-[#9297a0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          基础流程
        </button>
      )}
    </div>
  )
}

function WorkflowPaletteButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#181d26] transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={`添加${label}节点`}
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function WorkflowContextMenuLayer({
  menu,
  graph,
  onAddNode,
  onDuplicateNode,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: {
  menu: Exclude<WorkflowContextMenu, null>
  graph: WorkflowGraph
  onAddNode: (type: WorkflowNodeType, position?: XYPosition) => void
  onDuplicateNode: (nodeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onClose: () => void
}) {
  const node = menu.kind === 'node' ? graph.nodes.find((item) => item.id === menu.nodeId) : null
  const left = typeof window === 'undefined' ? menu.x : Math.min(Math.max(menu.x, 8), window.innerWidth - 208)
  const top = typeof window === 'undefined' ? menu.y : Math.min(Math.max(menu.y, 8), window.innerHeight - 220)
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="关闭工作流菜单"
        onClick={onClose}
      />
      <div
        className="fixed z-50 min-w-[188px] overflow-hidden rounded-lg border border-[#dddddd] bg-white py-1 shadow-lg"
        style={{ left, top }}
        role="menu"
      >
        {menu.kind === 'pane' && (
          <>
            <ContextMenuItem label="添加任务节点" onClick={() => onAddNode('task', menu.position)} />
            <ContextMenuItem label="添加条件节点" onClick={() => onAddNode('condition', menu.position)} />
            <ContextMenuItem label="添加审批节点" onClick={() => onAddNode('human_approval', menu.position)} />
            <ContextMenuItem label="添加结束节点" onClick={() => onAddNode('end', menu.position)} />
          </>
        )}
        {menu.kind === 'node' && (
          <>
            <div className="border-b border-[#eeeeee] px-3 py-2">
              <div className="truncate text-xs font-medium text-[#181d26]">{node?.title || '节点'}</div>
              <div className="truncate font-mono text-[11px] text-muted-foreground">{node?.key || menu.nodeId}</div>
            </div>
            <ContextMenuItem label="复制节点" onClick={() => onDuplicateNode(menu.nodeId)} />
            <ContextMenuItem label="删除节点" danger onClick={() => onDeleteNode(menu.nodeId)} />
          </>
        )}
        {menu.kind === 'edge' && (
          <ContextMenuItem label="删除连线" danger onClick={() => onDeleteEdge(menu.edgeId)} />
        )}
      </div>
    </>
  )
}

function ContextMenuItem({ label, danger = false, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center px-3 py-2 text-left text-sm transition-colors',
        danger ? 'text-[#aa2d00] hover:bg-[#fff4ef]' : 'text-[#181d26] hover:bg-[#f8fafc]',
      )}
    >
      {label}
    </button>
  )
}

function WorkflowCanvasNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const node = data.node
  const isTerminal = node.type === 'end'
  const isStart = node.type === 'trigger'
  const inputCount = node.inputs?.length || 0
  const outputCount = node.outputs?.length || 0
  const mappingCount = Object.keys(node.input_mapping || {}).length + Object.keys(node.output_mapping || {}).length
  const status = data.status
  const isSelected = selected || data.selected
  const issues = data.issues || []
  const hasIssue = issues.length > 0
  const firstIssue = issues[0]
  const isActive = !!status && WORKFLOW_ACTIVE_NODE_STATUSES.has(status)
  const isRunning = status === 'running'
  const statusTone = workflowNodeStatusTone(status)
  return (
    <div
      title={firstIssue?.message}
      className={cn(
        'relative min-w-[168px] overflow-hidden rounded-md border bg-white px-3 py-2 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200',
        hasIssue ? 'border-[#d9a441] bg-[#fff8df]' : 'border-[#dddddd]',
        isSelected && 'ring-2 ring-[#181d26]/20',
        status && workflowNodeClass(status),
        isActive && 'workflow-node-current',
        isRunning && 'workflow-node-running-orbit',
      )}
    >
      {!isStart && <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-[#9297a0] !bg-white" />}
      {!isTerminal && <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-[#9297a0] !bg-white" />}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-sm border border-[#dddddd] bg-[#f8fafc] px-1.5 py-0.5 text-[11px] leading-4 text-[#41454d]">
          {status && <span className={cn('h-1.5 w-1.5 rounded-full', statusTone.dot, isActive && 'animate-pulse')} />}
          <span>{NODE_TYPE_LABEL[node.type]}</span>
        </span>
        {hasIssue ? (
          <span className="inline-flex items-center gap-1 rounded-sm border border-[#d9a441]/60 bg-white/75 px-1.5 py-0.5 text-[11px] leading-4 text-[#6b4a00]">
            <AlertTriangle className="h-3 w-3" />
            待配置
          </span>
        ) : status ? (
          <span className={cn('rounded-sm border px-1.5 py-0.5 text-[11px] leading-4', statusTone.badge)}>
            {NODE_STATUS_LABEL[status] || status}
          </span>
        ) : null}
      </div>
      <div className="mt-2 max-w-[13rem] truncate text-sm font-medium text-[#181d26]">{node.title || node.key}</div>
      <div className="mt-1 max-w-[13rem] truncate font-mono text-[11px] text-muted-foreground">{hasIssue ? firstIssue?.message : node.key}</div>
      {(inputCount > 0 || outputCount > 0 || mappingCount > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {inputCount > 0 && (
            <span className="rounded-sm border border-[#dddddd] bg-white/80 px-1.5 py-0.5 text-[10px] leading-3 text-[#41454d]">输入 {inputCount}</span>
          )}
          {outputCount > 0 && (
            <span className="rounded-sm border border-[#dddddd] bg-white/80 px-1.5 py-0.5 text-[10px] leading-3 text-[#41454d]">输出 {outputCount}</span>
          )}
          {mappingCount > 0 && (
            <span className="rounded-sm border border-[#dddddd] bg-white/80 px-1.5 py-0.5 text-[10px] leading-3 text-[#41454d]">映射 {mappingCount}</span>
          )}
        </div>
      )}
    </div>
  )
}

function WorkflowInspector({
  workflow,
  workflowName,
  graph,
  node,
  triggers,
  validationErrors,
  notice,
  sectionRequest,
  canManage,
  agentMembers,
  userMembers,
  modelOptions,
  modelsLoading,
  onWorkflowNameChange,
  onNodeChange,
  onEdgeChange,
  onAddMessageTrigger,
  onAddScheduleTrigger,
  onAddTaskEventTrigger,
  onAddStorageEventTrigger,
  onAddWebhookTrigger,
  onToggleTrigger,
  onDeleteTrigger,
  onDeleteNode,
  onCreateConditionBranch,
}: {
  workflow: Workflow | null
  workflowName: string
  graph: WorkflowGraph
  node: WorkflowGraphNode | null
  triggers: WorkflowTrigger[]
  validationErrors: { code: string; message: string; node_id?: string; severity: string }[]
  notice: WorkflowNotice
  sectionRequest: { section: WorkflowInspectorSection; serial: number } | null
  canManage: boolean
  agentMembers: ChannelMemberInfo[]
  userMembers: ChannelMemberInfo[]
  modelOptions: WorkflowModelOption[]
  modelsLoading: boolean
  onWorkflowNameChange: (name: string) => void
  onNodeChange: (patch: Partial<WorkflowGraphNode>) => void
  onEdgeChange: (edgeId: string, patch: Partial<WorkflowGraphEdge>) => void
  onAddMessageTrigger: (keyword: string) => Promise<WorkflowTrigger | null>
  onAddScheduleTrigger: (rule: string, timezone: string) => Promise<WorkflowTrigger | null>
  onAddTaskEventTrigger: (eventType: string) => Promise<WorkflowTrigger | null>
  onAddStorageEventTrigger: (eventType: string) => Promise<WorkflowTrigger | null>
  onAddWebhookTrigger: () => Promise<WorkflowTrigger | null>
  onToggleTrigger: (trigger: WorkflowTrigger) => Promise<void>
  onDeleteTrigger: (trigger: WorkflowTrigger) => Promise<void>
  onDeleteNode: (nodeId: string) => void
  onCreateConditionBranch: (conditionNodeId: string, kind: ConditionBranchKind) => void
}) {
  const [messageKeyword, setMessageKeyword] = useState('')
  const [scheduleRule, setScheduleRule] = useState('0 9 * * *')
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Shanghai')
  const [taskEventType, setTaskEventType] = useState('task_verified')
  const [storageEventType, setStorageEventType] = useState('storage_object_available')
  const [lastWebhookTrigger, setLastWebhookTrigger] = useState<WorkflowTrigger | null>(null)
  const [activeSection, setActiveSection] = useState<WorkflowInspectorSection>('node')
  const messageTriggers = triggers.filter((trigger) => trigger.type === 'message')
  const scheduleTriggers = triggers.filter((trigger) => trigger.type === 'schedule')
  const taskEventTriggers = triggers.filter((trigger) => trigger.type === 'task_event')
  const storageEventTriggers = triggers.filter((trigger) => trigger.type === 'storage_event')
  const webhookTriggers = triggers.filter((trigger) => trigger.type === 'webhook')
  const triggerCount = triggers.length
  const validationCount = validationErrors.length
  const hasBlockingValidation = validationErrors.some((error) => error.severity !== 'warning')
  useEffect(() => {
    if (node) setActiveSection('node')
  }, [node?.id])
  useEffect(() => {
    if (!sectionRequest) return
    setActiveSection(sectionRequest.section)
  }, [sectionRequest?.serial, sectionRequest?.section])
  async function handleAddTrigger() {
    const keyword = messageKeyword.trim()
    if (!keyword) return
    await onAddMessageTrigger(keyword)
    setMessageKeyword('')
  }
  async function handleAddScheduleTrigger() {
    const rule = scheduleRule.trim()
    const timezone = scheduleTimezone.trim() || 'Asia/Shanghai'
    if (!rule) return
    await onAddScheduleTrigger(rule, timezone)
  }
  async function handleAddTaskEventTrigger() {
    await onAddTaskEventTrigger(taskEventType)
  }
  async function handleAddStorageEventTrigger() {
    await onAddStorageEventTrigger(storageEventType)
  }
  async function handleAddWebhookTrigger() {
    const trigger = await onAddWebhookTrigger()
    if (trigger?.webhook_secret) {
      setLastWebhookTrigger(trigger)
    }
  }
  return (
    <aside className="min-h-0 overflow-y-auto border-t border-border bg-white p-4 lg:border-l lg:border-t-0">
      <div className="space-y-3">
        {notice && (
          <div className={cn(
            'rounded-md border px-3 py-2 text-sm leading-5',
            notice.kind === 'success' && 'border-[#39bf45]/50 bg-[#f0fbf1] text-[#006400]',
            notice.kind === 'warning' && 'border-[#d9a441]/60 bg-[#fff8df] text-[#6b4a00]',
            notice.kind === 'error' && 'border-[#aa2d00]/40 bg-[#fff4ef] text-[#aa2d00]',
          )}>
            {notice.message}
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground">工作流名称</label>
          <Input value={workflowName} onChange={(event) => onWorkflowNameChange(event.target.value)} disabled={!workflow || !canManage} className="mt-1" />
        </div>

        <div className="grid grid-cols-3 rounded-lg border border-[#dddddd] bg-[#f8fafc] p-1" role="tablist" aria-label="工作流配置分区">
          <InspectorSectionButton
            active={activeSection === 'node'}
            label="节点"
            count={node ? 1 : 0}
            onClick={() => setActiveSection('node')}
          />
          <InspectorSectionButton
            active={activeSection === 'triggers'}
            label="触发"
            count={triggerCount}
            onClick={() => setActiveSection('triggers')}
          />
          <InspectorSectionButton
            active={activeSection === 'validation'}
            label="校验"
            count={validationCount}
            alert={hasBlockingValidation}
            onClick={() => setActiveSection('validation')}
          />
        </div>

        {activeSection === 'triggers' && (
          <>
        <div className="space-y-2 rounded-md border border-[#dddddd] p-3">
          <div className="text-sm font-medium text-[#181d26]">消息触发器</div>
          <div className="flex gap-2">
            <Input
              value={messageKeyword}
              onChange={(event) => setMessageKeyword(event.target.value)}
              disabled={!workflow || !canManage}
              placeholder="关键词，例如：日报"
            />
            <Button size="sm" variant="outline" onClick={() => void handleAddTrigger()} disabled={!workflow || !canManage || !messageKeyword.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {messageTriggers.length === 0 ? (
            <div className="text-xs text-muted-foreground">暂无消息触发器</div>
          ) : (
            <div className="space-y-1.5">
              {messageTriggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-[#dddddd] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void onToggleTrigger(trigger)}
                    disabled={!canManage}
                    className={cn(
                      'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]',
                      trigger.enabled ? 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' : 'border-[#dddddd] bg-white text-muted-foreground',
                    )}
                  >
                    {trigger.enabled ? '启用' : '停用'}
                  </button>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {workflowTriggerSummary(trigger)}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      title="删除触发器"
                      onClick={() => void onDeleteTrigger(trigger)}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-[#dddddd] p-3">
          <div className="text-sm font-medium text-[#181d26]">定时触发器</div>
          <div className="grid grid-cols-[minmax(0,1fr)_112px_auto] gap-2">
            <Input
              value={scheduleRule}
              onChange={(event) => setScheduleRule(event.target.value)}
              disabled={!workflow || !canManage}
              placeholder="0 9 * * *"
            />
            <Input
              value={scheduleTimezone}
              onChange={(event) => setScheduleTimezone(event.target.value)}
              disabled={!workflow || !canManage}
              placeholder="Asia/Shanghai"
            />
            <Button size="sm" variant="outline" onClick={() => void handleAddScheduleTrigger()} disabled={!workflow || !canManage || !scheduleRule.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {scheduleTriggers.length === 0 ? (
            <div className="text-xs text-muted-foreground">暂无定时触发器</div>
          ) : (
            <div className="space-y-1.5">
              {scheduleTriggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-[#dddddd] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void onToggleTrigger(trigger)}
                    disabled={!canManage}
                    className={cn(
                      'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]',
                      trigger.enabled ? 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' : 'border-[#dddddd] bg-white text-muted-foreground',
                    )}
                  >
                    {trigger.enabled ? '启用' : '停用'}
                  </button>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {workflowTriggerSummary(trigger)}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      title="删除触发器"
                      onClick={() => void onDeleteTrigger(trigger)}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-[#dddddd] p-3">
          <div className="text-sm font-medium text-[#181d26]">任务事件触发器</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select
              value={taskEventType}
              onChange={(event) => setTaskEventType(event.target.value)}
              disabled={!workflow || !canManage}
              className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm"
            >
              {TASK_EVENT_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => void handleAddTaskEventTrigger()} disabled={!workflow || !canManage || !taskEventType}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {taskEventTriggers.length === 0 ? (
            <div className="text-xs text-muted-foreground">暂无任务事件触发器</div>
          ) : (
            <div className="space-y-1.5">
              {taskEventTriggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-[#dddddd] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void onToggleTrigger(trigger)}
                    disabled={!canManage}
                    className={cn(
                      'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]',
                      trigger.enabled ? 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' : 'border-[#dddddd] bg-white text-muted-foreground',
                    )}
                  >
                    {trigger.enabled ? '启用' : '停用'}
                  </button>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {workflowTriggerSummary(trigger)}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      title="删除触发器"
                      onClick={() => void onDeleteTrigger(trigger)}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-[#dddddd] p-3">
          <div className="text-sm font-medium text-[#181d26]">文件事件触发器</div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <select
              value={storageEventType}
              onChange={(event) => setStorageEventType(event.target.value)}
              disabled={!workflow || !canManage}
              className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm"
            >
              {STORAGE_EVENT_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => void handleAddStorageEventTrigger()} disabled={!workflow || !canManage || !storageEventType}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {storageEventTriggers.length === 0 ? (
            <div className="text-xs text-muted-foreground">暂无文件事件触发器</div>
          ) : (
            <div className="space-y-1.5">
              {storageEventTriggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-[#dddddd] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void onToggleTrigger(trigger)}
                    disabled={!canManage}
                    className={cn(
                      'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]',
                      trigger.enabled ? 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' : 'border-[#dddddd] bg-white text-muted-foreground',
                    )}
                  >
                    {trigger.enabled ? '启用' : '停用'}
                  </button>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {workflowTriggerSummary(trigger)}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      title="删除触发器"
                      onClick={() => void onDeleteTrigger(trigger)}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-[#dddddd] p-3">
          <div className="text-sm font-medium text-[#181d26]">Webhook 触发器</div>
          <Button size="sm" variant="outline" onClick={() => void handleAddWebhookTrigger()} disabled={!workflow || !canManage}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新建
          </Button>
          {lastWebhookTrigger?.webhook_secret && (
            <div className="space-y-1 rounded-md border border-[#d9a441]/50 bg-[#fff8df] p-2 text-[11px] text-[#6b4a00]">
              <div className="font-medium">Secret 只显示一次</div>
              <div className="break-all font-mono">POST /api/workflow-webhooks/{lastWebhookTrigger.id}</div>
              <div className="break-all font-mono">Authorization: Bearer {lastWebhookTrigger.webhook_secret}</div>
              <div className="break-all font-mono">X-BeeSeed-Event-Id: 外部事件 ID</div>
            </div>
          )}
          {webhookTriggers.length === 0 ? (
            <div className="text-xs text-muted-foreground">暂无 Webhook 触发器</div>
          ) : (
            <div className="space-y-1.5">
              {webhookTriggers.map((trigger) => (
                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-[#dddddd] px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => void onToggleTrigger(trigger)}
                    disabled={!canManage}
                    className={cn(
                      'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]',
                      trigger.enabled ? 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' : 'border-[#dddddd] bg-white text-muted-foreground',
                    )}
                  >
                    {trigger.enabled ? '启用' : '停用'}
                  </button>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                    {workflowTriggerSummary(trigger)}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      title="删除触发器"
                      onClick={() => void onDeleteTrigger(trigger)}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {activeSection === 'node' && (node ? (
      <WorkflowNodeEditor
        node={node}
        graph={graph}
        workflow={workflow}
        triggers={triggers}
        canManage={canManage}
        agentMembers={agentMembers}
        userMembers={userMembers}
        modelOptions={modelOptions}
        modelsLoading={modelsLoading}
        onNodeChange={onNodeChange}
            onEdgeChange={onEdgeChange}
            onDeleteNode={onDeleteNode}
            onAddMessageTrigger={onAddMessageTrigger}
            onAddScheduleTrigger={onAddScheduleTrigger}
            onAddTaskEventTrigger={onAddTaskEventTrigger}
            onAddStorageEventTrigger={onAddStorageEventTrigger}
            onAddWebhookTrigger={onAddWebhookTrigger}
            onToggleTrigger={onToggleTrigger}
            onDeleteTrigger={onDeleteTrigger}
            onCreateConditionBranch={onCreateConditionBranch}
          />
        ) : (
          <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] p-4 text-sm text-muted-foreground">未选择节点</div>
        ))}

        {activeSection === 'validation' && (
        <div>
          <div className="mb-2 text-sm font-medium text-[#181d26]">校验结果</div>
          {validationErrors.length === 0 ? (
            <div className="flex items-center gap-2 rounded-md border border-[#39bf45]/50 bg-[#f0fbf1] px-3 py-2 text-sm text-[#006400]">
              <CheckCircle2 className="h-4 w-4" />
              暂无错误
            </div>
          ) : (
            <div className="space-y-2">
              {validationErrors.map((error, index) => {
                const warning = error.severity === 'warning'
                return (
                  <div
                    key={`${error.code}-${index}`}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm',
                      warning ? 'border-[#d9a441]/60 bg-[#fff8df] text-[#6b4a00]' : 'border-[#aa2d00]/40 bg-[#fff4ef] text-[#aa2d00]',
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      {warning && <AlertTriangle className="h-3.5 w-3.5" />}
                      <span>{error.message}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] opacity-75">{error.node_id || error.code}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}
      </div>
    </aside>
  )
}

function RunList({
  runs,
  loading,
  selectedRunId,
  onSelect,
}: {
  runs: WorkflowRun[]
  loading: boolean
  selectedRunId?: string
  onSelect: (run: WorkflowRun) => void
}) {
  return (
    <aside className="min-h-0 overflow-y-auto border-b border-border bg-white p-3 xl:border-b-0 xl:border-r">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">运行记录</div>
        <div className="text-[11px] text-muted-foreground">{runs.length}</div>
      </div>
      {loading ? (
        <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] p-4 text-sm text-muted-foreground">正在加载运行记录...</div>
      ) : runs.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] p-4 text-sm text-muted-foreground">暂无运行记录</div>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const active = selectedRunId === run.id
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelect(run)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35',
                  active ? 'border-[#181d26] bg-[#181d26] text-white' : 'border-[#dddddd] bg-white hover:border-[#9297a0] hover:bg-[#f8fafc]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">#{run.id.slice(0, 8)}</span>
                  <RunStatusBadge status={run.status} active={active} />
                </div>
                <div className={cn('mt-1 text-xs', active ? 'text-white/70' : 'text-muted-foreground')}>
                  {formatTime(run.created_at)}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}

function RunGraphViewer({
  flow,
  detail,
}: {
  flow: { nodes: WorkflowFlowNode[]; edges: Edge[] }
  detail: ReturnType<typeof useWorkflows>['selectedRun']
}) {
  const activeNodes = useMemo(
    () => detail?.node_runs.filter((nodeRun) => WORKFLOW_ACTIVE_NODE_STATUSES.has(nodeRun.status)) || [],
    [detail],
  )
  const completedCount = detail?.node_runs.filter((nodeRun) => nodeRun.status === 'succeeded').length || 0
  const totalCount = detail?.node_runs.length || 0
  const activeSummary = activeNodes.length > 0
    ? activeNodes.map((nodeRun) => `${nodeRun.node_key || nodeRun.node_id} · ${NODE_STATUS_LABEL[nodeRun.status] || nodeRun.status}`).join(' / ')
    : detail ? '当前没有活动节点' : '选择一次运行查看 DAG'

  return (
    <div className="relative min-h-[420px] overflow-hidden border-b border-border bg-white 2xl:border-b-0">
      <WorkflowRunAnimationStyles />
      <ReactFlow
        className="workflow-run-flow"
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={WORKFLOW_NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.25}
        maxZoom={1.25}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 0.85 }}
      >
        <Panel position="top-left" className="m-3">
          <div className="max-w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-[#dddddd] bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <RunStatusBadge status={detail?.run.status || 'pending'} />
              <span className="text-xs font-medium text-[#181d26]">{activeSummary}</span>
            </div>
            {detail && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                已完成 {completedCount} / {totalCount} 个节点，运行 #{detail.run.id.slice(0, 8)}
              </div>
            )}
          </div>
        </Panel>
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}

function WorkflowRunAnimationStyles() {
  return (
    <style>{`
      .workflow-run-flow .react-flow__edge.workflow-edge-active path {
        stroke-dasharray: 10 8;
        animation: workflow-edge-flow 900ms linear infinite;
      }

      @property --workflow-node-orbit-angle {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
      }

      .workflow-node-current {
        box-shadow: 0 0 0 1px rgba(69, 143, 255, 0.18), 0 8px 20px rgba(37, 79, 173, 0.08);
      }

      .workflow-node-running-orbit::before {
        content: '';
        position: absolute;
        inset: -1px;
        z-index: 1;
        border-radius: inherit;
        padding: 2px;
        pointer-events: none;
        background:
          conic-gradient(
            from var(--workflow-node-orbit-angle),
            rgba(69, 143, 255, 0) 0deg,
            rgba(69, 143, 255, 0) 225deg,
            rgba(69, 143, 255, 0.22) 268deg,
            rgba(69, 143, 255, 0.95) 310deg,
            rgba(69, 143, 255, 0) 360deg
          );
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        animation: workflow-node-orbit 1500ms linear infinite;
      }

      @keyframes workflow-edge-flow {
        to { stroke-dashoffset: -18; }
      }

      @keyframes workflow-node-orbit {
        to { --workflow-node-orbit-angle: 360deg; }
      }

      @media (prefers-reduced-motion: reduce) {
        .workflow-run-flow .react-flow__edge.workflow-edge-active path,
        .workflow-node-running-orbit::before {
          animation: none;
        }

        .workflow-node-running-orbit::before {
          background: rgba(69, 143, 255, 0.58);
        }
      }
    `}</style>
  )
}

function RunTimeline({
  detail,
  canManage,
  onCancel,
  onApproval,
}: {
  detail: ReturnType<typeof useWorkflows>['selectedRun']
  canManage: boolean
  onCancel: (runId: string) => Promise<void>
  onApproval: (runId: string, nodeRunId: string, decision: 'approved' | 'rejected', note?: string) => Promise<unknown>
}) {
  const [actingNodeId, setActingNodeId] = useState<string | null>(null)
  if (!detail) {
    return <aside className="min-h-0 overflow-y-auto border-t border-border bg-white p-4 xl:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0"><div className="text-sm text-muted-foreground">选择一次运行查看详情</div></aside>
  }
  const runId = detail.run.id
  const canCancel = detail.run.status === 'queued' || detail.run.status === 'running' || detail.run.status === 'awaiting_user'
  const pendingApprovals = detail.node_runs.filter((nodeRun) => nodeRun.node_type === 'human_approval' && nodeRun.status === 'awaiting_user')
  const activeNodes = detail.node_runs.filter((nodeRun) => WORKFLOW_ACTIVE_NODE_STATUSES.has(nodeRun.status))
  const completedCount = detail.node_runs.filter((nodeRun) => nodeRun.status === 'succeeded').length
  async function handleApproval(nodeRun: WorkflowNodeRun, decision: 'approved' | 'rejected') {
    if (!canManage || actingNodeId) return
    setActingNodeId(nodeRun.id)
    try {
      await onApproval(runId, nodeRun.id, decision, decision === 'rejected' ? '审核拒绝' : '')
    } finally {
      setActingNodeId(null)
    }
  }
  return (
    <aside className="min-h-0 overflow-y-auto border-t border-border bg-white xl:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-mono text-xs text-muted-foreground">#{detail.run.id}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <RunStatusBadge status={detail.run.status} />
              <span className="text-xs text-muted-foreground">{formatTime(detail.run.created_at)}</span>
            </div>
          </div>
          {canCancel && canManage && (
            <Button size="sm" variant="outline" onClick={() => void onCancel(detail.run.id)}>
              取消
            </Button>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-2 py-1.5">
            <div className="text-muted-foreground">节点进度</div>
            <div className="mt-0.5 font-medium text-[#181d26]">{completedCount} / {detail.node_runs.length}</div>
          </div>
          <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-2 py-1.5">
            <div className="text-muted-foreground">当前信号</div>
            <div className="mt-0.5 font-medium text-[#181d26]">{activeNodes.length}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {activeNodes.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">当前节点</div>
            <div className="space-y-2">
              {activeNodes.map((nodeRun) => (
                <div
                  key={nodeRun.id}
                  className={cn(
                    'rounded-md border px-3 py-2',
                    nodeRun.status === 'awaiting_user' ? 'border-[#d9a441]/60 bg-[#fff8df]' : 'border-[#458fff]/60 bg-[#f1f6ff]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-medium text-[#181d26]">{nodeRun.node_key || nodeRun.node_id}</div>
                    <RunStatusBadge status={nodeRun.status} />
                  </div>
                  {nodeRun.task_id && <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">task {nodeRun.task_id}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">待审批</div>
            {pendingApprovals.map((nodeRun) => (
              <div key={nodeRun.id} className="rounded-md border border-[#d9a441]/60 bg-[#fff8df] px-3 py-2">
                <div className="text-sm font-medium text-[#181d26]">{nodeRun.node_key || '人工审核'}</div>
                <div className="mt-1 text-xs text-[#6b4a00]">等待 owner/admin 审核</div>
                {canManage && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => void handleApproval(nodeRun, 'approved')} disabled={actingNodeId === nodeRun.id}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      通过
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void handleApproval(nodeRun, 'rejected')} disabled={actingNodeId === nodeRun.id}>
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      拒绝
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <RunNodeIOPanel nodeRuns={detail.node_runs} />

        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">事件时间线</div>
          {detail.events.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] px-3 py-3 text-sm text-muted-foreground">暂无事件</div>
          ) : (
            <div className="relative space-y-3 pl-4">
              <div className="absolute bottom-2 left-[5px] top-2 w-px bg-[#e0e2e6]" />
              {detail.events.map((event) => (
                <div key={event.id} className="relative">
                  <span className="absolute -left-[15px] top-2 h-2.5 w-2.5 rounded-full border border-[#9297a0] bg-white" />
                  <div className="rounded-md border border-[#dddddd] bg-white px-3 py-2">
                    <div className="break-words text-sm font-medium leading-5 text-[#181d26]">{event.message || event.event_type}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">{event.event_type}</span>
                      <span>{formatTime(event.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function RunNodeIOPanel({ nodeRuns }: { nodeRuns: WorkflowNodeRun[] }) {
  if (nodeRuns.length === 0) return null
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">节点输入 / 输出</div>
      <div className="space-y-2">
        {nodeRuns.map((nodeRun) => {
          const shouldOpen = nodeRun.status === 'failed' || WORKFLOW_ACTIVE_NODE_STATUSES.has(nodeRun.status)
          const stableInputs = workflowPayloadSection(nodeRun.input_payload, 'inputs')
          const stableOutputs = workflowPayloadSection(nodeRun.output_payload, 'outputs')
          const hasStableIO = Object.keys(stableInputs).length > 0 || Object.keys(stableOutputs).length > 0
          return (
            <WorkflowDisclosure
              key={nodeRun.id}
              defaultOpen={shouldOpen}
              resetKey={nodeRun.id}
              className="rounded-md border border-[#dddddd] bg-white"
              summaryClassName="flex w-full items-center gap-2 px-3 py-2 text-left"
              summary={(
                <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[#181d26]">{nodeRun.node_key || nodeRun.node_id}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{NODE_TYPE_LABEL[nodeRun.node_type]}</span>
                    <span className="font-mono">#{nodeRun.id.slice(0, 8)}</span>
                  </div>
                </div>
                <RunStatusBadge status={nodeRun.status} />
                </>
              )}
            >
              <div className="space-y-2 border-t border-[#eeeeee] px-3 py-3">
                {nodeRun.failure_detail && (
                  <div className="rounded-md border border-[#aa2d00]/30 bg-[#fff4ef] px-3 py-2 text-xs leading-5 text-[#aa2d00]">
                    {nodeRun.failure_detail}
                  </div>
                )}
                {hasStableIO ? (
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                    <WorkflowPayloadBlock title="稳定输入" value={stableInputs} emptyLabel="没有稳定输入" />
                    <WorkflowPayloadBlock title="稳定输出" value={stableOutputs} emptyLabel="没有稳定输出" />
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-muted-foreground">
                    暂无稳定输入 / 输出
                  </div>
                )}
                <WorkflowDisclosure
                  defaultOpen={nodeRun.status === 'failed'}
                  resetKey={`${nodeRun.id}:payload`}
                  className="rounded-md border border-[#eeeeee] bg-[#f8fafc]"
                  summaryClassName="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left"
                  summary={(
                    <>
                      <span className="text-xs font-medium text-[#41454d]">调试 payload</span>
                      <span className="text-[10px] text-muted-foreground">input / output</span>
                    </>
                  )}
                >
                  <div className="grid gap-2 border-t border-[#eeeeee] p-2">
                    <WorkflowPayloadBlock title="input_payload" value={nodeRun.input_payload} />
                    <WorkflowPayloadBlock title="output_payload" value={nodeRun.output_payload} />
                  </div>
                </WorkflowDisclosure>
              </div>
            </WorkflowDisclosure>
          )
        })}
      </div>
    </div>
  )
}

function WorkflowPayloadBlock({ title, value, emptyLabel = '{}' }: { title: string; value?: Record<string, unknown>; emptyLabel?: string }) {
  const empty = !value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0
  return (
    <div className="rounded-md border border-[#eeeeee] bg-[#f8fafc]">
      <div className="border-b border-[#eeeeee] px-3 py-1.5 text-xs font-medium text-[#41454d]">{title}</div>
      {empty ? (
        <div className="px-3 py-2 text-xs leading-5 text-muted-foreground">{emptyLabel}</div>
      ) : (
        <pre className="max-h-44 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 text-[#181d26]">{formatWorkflowPayload(value)}</pre>
      )}
    </div>
  )
}

function WorkflowDisclosure({
  defaultOpen = false,
  resetKey,
  className,
  summaryClassName,
  summary,
  children,
}: {
  defaultOpen?: boolean
  resetKey?: string
  className?: string
  summaryClassName?: string
  summary: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    setOpen(defaultOpen)
  }, [resetKey])
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])
  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn('transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35', summaryClassName)}
      >
        {summary}
      </button>
      {open && children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function NodeIOSection({
  node,
  graph,
  canManage,
  onAddPort,
  onUpdatePort,
  onDeletePort,
  onUpdateMapping,
}: {
  node: WorkflowGraphNode
  graph: WorkflowGraph
  canManage: boolean
  onAddPort: (kind: WorkflowPortKind) => void
  onUpdatePort: (kind: WorkflowPortKind, index: number, patch: Partial<WorkflowPort>) => void
  onDeletePort: (kind: WorkflowPortKind, index: number) => void
  onUpdateMapping: (kind: WorkflowPortKind, key: string, value: string) => void
}) {
  const inputCount = node.inputs?.length || 0
  const outputCount = node.outputs?.length || 0
  const mappingCount = Object.keys(node.input_mapping || {}).length + Object.keys(node.output_mapping || {}).length
  const shouldOpen = inputCount > 0 || outputCount > 0 || mappingCount > 0
  const inputSuggestions = useMemo(() => workflowInputMappingSuggestions(graph, node), [graph, node])
  const outputSuggestions = useMemo(() => workflowOutputMappingSuggestions(node), [node])
  return (
    <WorkflowDisclosure
      defaultOpen={shouldOpen}
      resetKey={node.id}
      className="rounded-md border border-[#dddddd] bg-white"
      summaryClassName="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      summary={(
        <>
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#181d26]">输入 / 输出接口</div>
            <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">可选配置，运行时会自动记录实际 payload。</div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-sm border border-[#dddddd] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] leading-3 text-[#41454d]">入 {inputCount}</span>
            <span className="rounded-sm border border-[#dddddd] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] leading-3 text-[#41454d]">出 {outputCount}</span>
          </div>
        </>
      )}
    >
      <div className="space-y-3 border-t border-[#eeeeee] px-3 py-3">
        <WorkflowPortList
          kind="inputs"
          title="输入字段"
          ports={node.inputs || []}
          mapping={node.input_mapping || {}}
          suggestions={inputSuggestions}
          canManage={canManage}
          onAdd={() => onAddPort('inputs')}
          onUpdate={(index, patch) => onUpdatePort('inputs', index, patch)}
          onDelete={(index) => onDeletePort('inputs', index)}
          onUpdateMapping={(key, value) => onUpdateMapping('inputs', key, value)}
        />
        <WorkflowPortList
          kind="outputs"
          title="输出字段"
          ports={node.outputs || []}
          mapping={node.output_mapping || {}}
          suggestions={outputSuggestions}
          canManage={canManage}
          onAdd={() => onAddPort('outputs')}
          onUpdate={(index, patch) => onUpdatePort('outputs', index, patch)}
          onDelete={(index) => onDeletePort('outputs', index)}
          onUpdateMapping={(key, value) => onUpdateMapping('outputs', key, value)}
        />
      </div>
    </WorkflowDisclosure>
  )
}

function WorkflowPortList({
  kind,
  title,
  ports,
  mapping,
  suggestions,
  canManage,
  onAdd,
  onUpdate,
  onDelete,
  onUpdateMapping,
}: {
  kind: WorkflowPortKind
  title: string
  ports: WorkflowPort[]
  mapping: Record<string, string>
  suggestions: WorkflowMappingSuggestionGroup[]
  canManage: boolean
  onAdd: () => void
  onUpdate: (index: number, patch: Partial<WorkflowPort>) => void
  onDelete: (index: number) => void
  onUpdateMapping: (key: string, value: string) => void
}) {
  const isInput = kind === 'inputs'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd} disabled={!canManage}>
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>
      {ports.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-muted-foreground">
          未声明{isInput ? '输入' : '输出'}字段。
        </div>
      ) : (
        <div className="space-y-2">
          {ports.map((port, index) => {
            const portKey = port.key || ''
            const currentMapping = portKey ? mapping[portKey] || '' : ''
            const suggestionValues = new Set(suggestions.flatMap((group) => group.items.map((item) => item.value)))
            const selectValue = currentMapping && suggestionValues.has(currentMapping) ? currentMapping : ''
            return (
              <div key={`${portKey || index}-${index}`} className="space-y-2 rounded-md border border-[#eeeeee] bg-[#f8fafc] p-2">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px_auto] gap-2">
                  <Field label="字段 Key">
                    <Input
                      value={portKey}
                      onChange={(event) => onUpdate(index, { key: normalizeWorkflowPortKey(event.target.value) })}
                      disabled={!canManage}
                      placeholder={isInput ? 'request' : 'result'}
                    />
                  </Field>
                  <Field label="显示名">
                    <Input
                      value={port.label || ''}
                      onChange={(event) => onUpdate(index, { label: event.target.value })}
                      disabled={!canManage}
                      placeholder={isInput ? '请求内容' : '处理结果'}
                    />
                  </Field>
                  <Field label="类型">
                    <select
                      value={workflowPortSchemaType(port)}
                      onChange={(event) => onUpdate(index, { schema: { ...(port.schema || {}), type: event.target.value } })}
                      disabled={!canManage}
                      className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {WORKFLOW_PORT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex items-end justify-end gap-1">
                    {isInput && (
                      <label className="mb-2 inline-flex items-center gap-1.5 text-xs text-[#41454d]">
                        <input
                          type="checkbox"
                          checked={!!port.required}
                          onChange={(event) => onUpdate(index, { required: event.target.checked })}
                          disabled={!canManage}
                        />
                        必填
                      </label>
                    )}
                    <button
                      type="button"
                      title="删除字段"
                      onClick={() => onDelete(index)}
                      disabled={!canManage}
                      className="mb-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#fff4ef] hover:text-[#aa2d00] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{isInput ? '输入来源' : '输出表达式'}</span>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {isInput ? `inputs.${portKey || 'key'}` : `outputs.${portKey || 'key'}`}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_132px]">
                    <Input
                      value={currentMapping}
                      onChange={(event) => onUpdateMapping(portKey, event.target.value)}
                      disabled={!canManage || !portKey}
                      placeholder={isInput ? 'nodes.task.output.outputs.summary' : 'result_json.summary'}
                      className="font-mono text-xs"
                    />
                    <select
                      value={selectValue}
                      onChange={(event) => {
                        if (event.target.value) onUpdateMapping(portKey, event.target.value)
                      }}
                      disabled={!canManage || !portKey || suggestions.every((group) => group.items.length === 0)}
                      className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-xs text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={isInput ? '选择输入来源' : '选择输出表达式'}
                    >
                      <option value="">{isInput ? '选择来源' : '选择表达式'}</option>
                      {suggestions.map((group) => group.items.length > 0 && (
                        <optgroup key={group.label} label={group.label}>
                          {group.items.map((item) => (
                            <option key={`${group.label}:${item.value}`} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {currentMapping && !selectValue && (
                    <div className="truncate font-mono text-[10px] leading-4 text-muted-foreground">
                      手动：{currentMapping}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function WorkflowNodeEditor({
  node,
  graph,
  workflow,
  triggers,
  canManage,
  agentMembers,
  userMembers,
  modelOptions,
  modelsLoading,
  onNodeChange,
  onEdgeChange,
  onDeleteNode,
  onAddMessageTrigger,
  onAddScheduleTrigger,
  onAddTaskEventTrigger,
  onAddStorageEventTrigger,
  onAddWebhookTrigger,
  onToggleTrigger,
  onDeleteTrigger,
  onCreateConditionBranch,
}: {
  node: WorkflowGraphNode
  graph: WorkflowGraph
  workflow: Workflow | null
  triggers: WorkflowTrigger[]
  canManage: boolean
  agentMembers: ChannelMemberInfo[]
  userMembers: ChannelMemberInfo[]
  modelOptions: WorkflowModelOption[]
  modelsLoading: boolean
  onNodeChange: (patch: Partial<WorkflowGraphNode>) => void
  onEdgeChange: (edgeId: string, patch: Partial<WorkflowGraphEdge>) => void
  onDeleteNode: (nodeId: string) => void
  onAddMessageTrigger: (keyword: string) => Promise<WorkflowTrigger | null>
  onAddScheduleTrigger: (rule: string, timezone: string) => Promise<WorkflowTrigger | null>
  onAddTaskEventTrigger: (eventType: string) => Promise<WorkflowTrigger | null>
  onAddStorageEventTrigger: (eventType: string) => Promise<WorkflowTrigger | null>
  onAddWebhookTrigger: () => Promise<WorkflowTrigger | null>
  onToggleTrigger: (trigger: WorkflowTrigger) => Promise<void>
  onDeleteTrigger: (trigger: WorkflowTrigger) => Promise<void>
  onCreateConditionBranch: (conditionNodeId: string, kind: ConditionBranchKind) => void
}) {
  const executorType = node.executor?.type === 'user' ? 'user' : 'agent'
  const retryPolicy = node.retry_policy || {}
  const maxAttempts = typeof retryPolicy.max_attempts === 'number' ? retryPolicy.max_attempts : 1
  const backoff = retryPolicy.backoff === 'exponential' ? 'exponential' : 'fixed'
  const backoffSeconds = typeof retryPolicy.backoff_seconds === 'number' ? retryPolicy.backoff_seconds : 60

  function updateExecutor(patch: Partial<NonNullable<WorkflowGraphNode['executor']>>) {
    onNodeChange({
      executor: {
        ...(node.executor || { type: 'agent' }),
        ...patch,
      },
    })
  }

  function updateRetryPolicy(patch: Record<string, unknown>) {
    onNodeChange({
      retry_policy: {
        max_attempts: maxAttempts,
        backoff,
        backoff_seconds: backoffSeconds,
        ...retryPolicy,
        ...patch,
      },
    })
  }

  function updateApprovalScope(role: string) {
    const executor = node.executor || { type: 'user' as const }
    onNodeChange({
      executor: {
        ...executor,
        config: {
          ...(executor.config || {}),
          approver_scope: { role },
        },
      },
    })
  }

  function addPort(kind: WorkflowPortKind) {
    const ports = node[kind] || []
    onNodeChange({ [kind]: [...ports, createWorkflowPort(kind, ports)] } as Partial<WorkflowGraphNode>)
  }

  function updatePort(kind: WorkflowPortKind, index: number, patch: Partial<WorkflowPort>) {
    const ports = [...(node[kind] || [])]
    const currentPort = ports[index]
    if (!currentPort) return
    const previousKey = currentPort.key
    const nextPort = { ...currentPort, ...patch }
    ports[index] = nextPort
    const mappingField = kind === 'inputs' ? 'input_mapping' : 'output_mapping'
    const nextMapping = { ...(node[mappingField] || {}) } as Record<string, string>
    if (patch.key !== undefined && previousKey !== nextPort.key) {
      if (previousKey && nextMapping[previousKey] !== undefined) {
        if (nextPort.key) nextMapping[nextPort.key] = nextMapping[previousKey]
        delete nextMapping[previousKey]
      }
    }
    const nextPatch: Partial<WorkflowGraphNode> = { [kind]: ports } as Partial<WorkflowGraphNode>
    if (kind === 'inputs') nextPatch.input_mapping = compactWorkflowMapping(nextMapping)
    else nextPatch.output_mapping = compactWorkflowMapping(nextMapping)
    onNodeChange(nextPatch)
  }

  function deletePort(kind: WorkflowPortKind, index: number) {
    const ports = [...(node[kind] || [])]
    const [removed] = ports.splice(index, 1)
    const mappingField = kind === 'inputs' ? 'input_mapping' : 'output_mapping'
    const nextMapping = { ...(node[mappingField] || {}) } as Record<string, string>
    if (removed?.key) delete nextMapping[removed.key]
    const nextPatch: Partial<WorkflowGraphNode> = { [kind]: ports } as Partial<WorkflowGraphNode>
    if (kind === 'inputs') nextPatch.input_mapping = compactWorkflowMapping(nextMapping)
    else nextPatch.output_mapping = compactWorkflowMapping(nextMapping)
    onNodeChange(nextPatch)
  }

  function updatePortMapping(kind: WorkflowPortKind, key: string, value: string) {
    if (!key) return
    const mappingField = kind === 'inputs' ? 'input_mapping' : 'output_mapping'
    const nextMapping = { ...(node[mappingField] || {}), [key]: value } as Record<string, string>
    if (kind === 'inputs') onNodeChange({ input_mapping: compactWorkflowMapping(nextMapping) })
    else onNodeChange({ output_mapping: compactWorkflowMapping(nextMapping) })
  }

  return (
    <div className="rounded-md border border-[#dddddd]">
      <div className="flex items-center justify-between gap-2 border-b border-[#eeeeee] px-3 py-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-sm font-medium text-[#181d26]">{node.title || node.key}</div>
            <Badge variant="outline">{NODE_TYPE_LABEL[node.type]}</Badge>
          </div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{node.id}</div>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => onDeleteNode(node.id)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#aa2d00] transition-colors hover:bg-[#fff4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aa2d00]/20"
          >
            <Trash2 className="size-3.5" />
            删除
          </button>
        )}
      </div>

      <div className="space-y-3 p-3">
        <Field label="标题">
          <Input value={node.title} onChange={(event) => onNodeChange({ title: event.target.value })} disabled={!canManage} />
        </Field>
        <Field label="Key">
          <Input value={node.key} onChange={(event) => onNodeChange({ key: event.target.value })} disabled={!canManage} />
        </Field>
        <Field label={node.type === 'human_approval' ? '审批提示' : '说明'}>
          <textarea
            value={node.description || ''}
            onChange={(event) => onNodeChange({ description: event.target.value })}
            disabled={!canManage}
            rows={3}
            className="min-h-20 w-full resize-y rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm leading-5 text-[#181d26] outline-none transition-colors focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </Field>

        <NodeIOSection
          node={node}
          graph={graph}
          canManage={canManage}
          onAddPort={addPort}
          onUpdatePort={updatePort}
          onDeletePort={deletePort}
          onUpdateMapping={updatePortMapping}
        />

        {node.type === 'trigger' && (
          <TriggerNodeSettings
            node={node}
            workflow={workflow}
            triggers={triggers}
            canManage={canManage}
            onNodeChange={onNodeChange}
            onAddMessageTrigger={onAddMessageTrigger}
            onAddScheduleTrigger={onAddScheduleTrigger}
            onAddTaskEventTrigger={onAddTaskEventTrigger}
            onAddStorageEventTrigger={onAddStorageEventTrigger}
            onAddWebhookTrigger={onAddWebhookTrigger}
            onToggleTrigger={onToggleTrigger}
            onDeleteTrigger={onDeleteTrigger}
          />
        )}

        {node.type === 'task' && (
          <div className="space-y-3 border-t border-[#eeeeee] pt-3">
            <div className="text-xs font-medium text-muted-foreground">任务设置</div>
            <Field label="执行者类型">
              <select
                value={executorType}
                onChange={(event) => onNodeChange({ executor: { type: event.target.value as 'agent' | 'user', ref: '', prompt_template: node.executor?.prompt_template } })}
                disabled={!canManage}
                className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="agent">Agent</option>
                <option value="user">频道用户</option>
              </select>
            </Field>
            <Field label="执行者">
              <select
                value={node.executor?.ref || ''}
                onChange={(event) => updateExecutor({ type: executorType, ref: event.target.value })}
                disabled={!canManage}
                className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">未选择</option>
                {(executorType === 'user' ? userMembers : agentMembers).map((member) => (
                  <option key={member.id} value={executorType === 'user' ? member.user_id || '' : member.agent_id || ''}>
                    {member.display_name || member.nickname || member.agent_id || member.user_id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="执行提示">
              <textarea
                value={node.executor?.prompt_template || ''}
                onChange={(event) => updateExecutor({ type: executorType, prompt_template: event.target.value })}
                disabled={!canManage}
                rows={5}
                className="min-h-28 w-full resize-y rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm leading-5 text-[#181d26] outline-none transition-colors focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </Field>
            <Field label="超时秒数">
              <Input
                type="number"
                min={0}
                value={node.timeout_seconds ?? ''}
                onChange={(event) => onNodeChange({ timeout_seconds: optionalPositiveInteger(event.target.value) })}
                disabled={!canManage}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="尝试">
                <Input
                  type="number"
                  min={1}
                  value={maxAttempts}
                  onChange={(event) => updateRetryPolicy({ max_attempts: positiveInteger(event.target.value, 1) })}
                  disabled={!canManage}
                />
              </Field>
              <Field label="退避">
                <select
                  value={backoff}
                  onChange={(event) => updateRetryPolicy({ backoff: event.target.value })}
                  disabled={!canManage}
                  className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="fixed">固定</option>
                  <option value="exponential">指数</option>
                </select>
              </Field>
              <Field label="间隔">
                <Input
                  type="number"
                  min={0}
                  value={backoffSeconds}
                  onChange={(event) => updateRetryPolicy({ backoff_seconds: positiveInteger(event.target.value, 0) })}
                  disabled={!canManage}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#181d26]">
              <input
                type="checkbox"
                checked={node.require_user_verification !== false}
                onChange={(event) => onNodeChange({ require_user_verification: event.target.checked })}
                disabled={!canManage}
              />
              需要人工审核
            </label>
            {node.require_user_verification === false && (
              <div className="rounded-md border border-[#d9a441]/60 bg-[#fff8df] px-3 py-2 text-xs leading-5 text-[#6b4a00]">
                执行者完成后自动推进。
              </div>
            )}
          </div>
        )}

        {node.type === 'condition' && (
          <ConditionBranchEditor
            node={node}
            graph={graph}
            canManage={canManage}
            modelOptions={modelOptions}
            modelsLoading={modelsLoading}
            onNodeChange={onNodeChange}
            onEdgeChange={onEdgeChange}
            onCreateBranch={onCreateConditionBranch}
          />
        )}

        {node.type === 'human_approval' && (
          <div className="space-y-3 border-t border-[#eeeeee] pt-3">
            <div className="text-xs font-medium text-muted-foreground">审批设置</div>
            <Field label="审批范围">
              <select
                value={approvalScopeRole(node)}
                onChange={(event) => updateApprovalScope(event.target.value)}
                disabled={!canManage}
                className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="channel_admin">频道 owner/admin</option>
                <option value="channel_member">频道成员</option>
              </select>
            </Field>
            <Field label="超时秒数">
              <Input
                type="number"
                min={0}
                value={node.timeout_seconds ?? ''}
                onChange={(event) => onNodeChange({ timeout_seconds: optionalPositiveInteger(event.target.value) })}
                disabled={!canManage}
              />
            </Field>
          </div>
        )}

      </div>
    </div>
  )
}

function TriggerNodeSettings({
  node,
  workflow,
  triggers,
  canManage,
  onNodeChange,
  onAddMessageTrigger,
  onAddScheduleTrigger,
  onAddTaskEventTrigger,
  onAddStorageEventTrigger,
  onAddWebhookTrigger,
  onToggleTrigger,
  onDeleteTrigger,
}: {
  node: WorkflowGraphNode
  workflow: Workflow | null
  triggers: WorkflowTrigger[]
  canManage: boolean
  onNodeChange: (patch: Partial<WorkflowGraphNode>) => void
  onAddMessageTrigger: (keyword: string) => Promise<WorkflowTrigger | null>
  onAddScheduleTrigger: (rule: string, timezone: string) => Promise<WorkflowTrigger | null>
  onAddTaskEventTrigger: (eventType: string) => Promise<WorkflowTrigger | null>
  onAddStorageEventTrigger: (eventType: string) => Promise<WorkflowTrigger | null>
  onAddWebhookTrigger: () => Promise<WorkflowTrigger | null>
  onToggleTrigger: (trigger: WorkflowTrigger) => Promise<void>
  onDeleteTrigger: (trigger: WorkflowTrigger) => Promise<void>
}) {
  const [messageKeyword, setMessageKeyword] = useState('')
  const [scheduleRule, setScheduleRule] = useState('0 9 * * *')
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Shanghai')
  const [taskEventType, setTaskEventType] = useState('task_verified')
  const [storageEventType, setStorageEventType] = useState('storage_object_available')
  const [lastWebhookTrigger, setLastWebhookTrigger] = useState<WorkflowTrigger | null>(null)
  const selectedType = triggerTypeFromNode(node)
  const typeTriggers = triggers.filter((trigger) => trigger.type === selectedType)
  const linkedTriggerId = typeof node.trigger_condition?.trigger_id === 'string' ? node.trigger_condition.trigger_id : ''

  function updateTriggerNode(type: WorkflowTriggerType, trigger?: WorkflowTrigger | null) {
    const triggerCondition: Record<string, unknown> = {
      ...(node.trigger_condition || {}),
      trigger_type: type,
    }
    if (trigger?.id) {
      triggerCondition.trigger_id = trigger.id
    } else if (type === 'manual') {
      delete triggerCondition.trigger_id
    }
    onNodeChange({
      title: shouldReplaceTriggerTitle(node.title) ? triggerNodeTitle(type) : node.title,
      trigger_condition: triggerCondition,
    })
  }

  async function createAndBind(create: () => Promise<WorkflowTrigger | null>) {
    const trigger = await create()
    if (!trigger) return
    if (trigger.type === 'webhook' && trigger.webhook_secret) {
      setLastWebhookTrigger(trigger)
    }
    updateTriggerNode(trigger.type, trigger)
  }

  return (
    <div className="space-y-3 border-t border-[#eeeeee] pt-3">
      <div className="text-xs font-medium text-muted-foreground">触发设置</div>
      <Field label="触发类型">
        <select
          value={selectedType}
          onChange={(event) => updateTriggerNode(event.target.value as WorkflowTriggerType)}
          disabled={!canManage}
          className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {WORKFLOW_TRIGGER_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </Field>

      {selectedType === 'manual' && (
        <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#41454d]">
          手动运行不需要额外触发器，使用顶部“运行”按钮启动。
        </div>
      )}

      {selectedType === 'message' && (
        <div className="space-y-2">
          <Field label="消息关键词">
            <div className="flex gap-2">
              <Input
                value={messageKeyword}
                onChange={(event) => setMessageKeyword(event.target.value)}
                disabled={!workflow || !canManage}
                placeholder="例如：日报"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void createAndBind(() => onAddMessageTrigger(messageKeyword))}
                disabled={!workflow || !canManage || !messageKeyword.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Field>
        </div>
      )}

      {selectedType === 'schedule' && (
        <div className="grid grid-cols-[minmax(0,1fr)_112px_auto] gap-2">
          <Input
            value={scheduleRule}
            onChange={(event) => setScheduleRule(event.target.value)}
            disabled={!workflow || !canManage}
            placeholder="0 9 * * *"
          />
          <Input
            value={scheduleTimezone}
            onChange={(event) => setScheduleTimezone(event.target.value)}
            disabled={!workflow || !canManage}
            placeholder="Asia/Shanghai"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createAndBind(() => onAddScheduleTrigger(scheduleRule, scheduleTimezone))}
            disabled={!workflow || !canManage || !scheduleRule.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {selectedType === 'task_event' && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select
            value={taskEventType}
            onChange={(event) => setTaskEventType(event.target.value)}
            disabled={!workflow || !canManage}
            className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {TASK_EVENT_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createAndBind(() => onAddTaskEventTrigger(taskEventType))}
            disabled={!workflow || !canManage || !taskEventType}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {selectedType === 'storage_event' && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <select
            value={storageEventType}
            onChange={(event) => setStorageEventType(event.target.value)}
            disabled={!workflow || !canManage}
            className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {STORAGE_EVENT_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createAndBind(() => onAddStorageEventTrigger(storageEventType))}
            disabled={!workflow || !canManage || !storageEventType}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {selectedType === 'webhook' && (
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void createAndBind(onAddWebhookTrigger)}
            disabled={!workflow || !canManage}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            创建 Webhook
          </Button>
          {lastWebhookTrigger?.webhook_secret && (
            <div className="space-y-1 rounded-md border border-[#d9a441]/50 bg-[#fff8df] p-2 text-[11px] text-[#6b4a00]">
              <div className="font-medium">Secret 只显示一次</div>
              <div className="break-all font-mono">POST /api/workflow-webhooks/{lastWebhookTrigger.id}</div>
              <div className="break-all font-mono">Authorization: Bearer {lastWebhookTrigger.webhook_secret}</div>
            </div>
          )}
        </div>
      )}

      {selectedType !== 'manual' && (
        <TriggerList
          triggers={typeTriggers}
          linkedTriggerId={linkedTriggerId}
          canManage={canManage}
          onBind={(trigger) => updateTriggerNode(trigger.type, trigger)}
          onToggleTrigger={onToggleTrigger}
          onDeleteTrigger={onDeleteTrigger}
        />
      )}
    </div>
  )
}

function TriggerList({
  triggers,
  linkedTriggerId,
  canManage,
  onBind,
  onToggleTrigger,
  onDeleteTrigger,
}: {
  triggers: WorkflowTrigger[]
  linkedTriggerId: string
  canManage: boolean
  onBind: (trigger: WorkflowTrigger) => void
  onToggleTrigger: (trigger: WorkflowTrigger) => Promise<void>
  onDeleteTrigger: (trigger: WorkflowTrigger) => Promise<void>
}) {
  if (triggers.length === 0) {
    return <div className="rounded-md border border-dashed border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs text-muted-foreground">暂无同类型触发器</div>
  }
  return (
    <div className="space-y-1.5">
      {triggers.map((trigger) => {
        const linked = trigger.id === linkedTriggerId
        return (
          <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-[#dddddd] px-2 py-1.5">
            <button
              type="button"
              onClick={() => void onToggleTrigger(trigger)}
              disabled={!canManage}
              className={cn(
                'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px]',
                trigger.enabled ? 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' : 'border-[#dddddd] bg-white text-muted-foreground',
              )}
            >
              {trigger.enabled ? '启用' : '停用'}
            </button>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {workflowTriggerSummary(trigger)}
            </span>
            <button
              type="button"
              onClick={() => onBind(trigger)}
              disabled={!canManage || linked}
              className={cn(
                'shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors disabled:cursor-default',
                linked ? 'border-[#181d26] bg-[#181d26] text-white' : 'border-[#dddddd] text-[#41454d] hover:border-[#9297a0]',
              )}
            >
              {linked ? '已绑定' : '绑定'}
            </button>
            {canManage && (
              <button
                type="button"
                title="删除触发器"
                onClick={() => void onDeleteTrigger(trigger)}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-[#fff4ef] hover:text-[#aa2d00]"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ConditionBranchEditor({
  node,
  graph,
  canManage,
  modelOptions,
  modelsLoading,
  onNodeChange,
  onEdgeChange,
  onCreateBranch,
}: {
  node: WorkflowGraphNode
  graph: WorkflowGraph
  canManage: boolean
  modelOptions: WorkflowModelOption[]
  modelsLoading: boolean
  onNodeChange: (patch: Partial<WorkflowGraphNode>) => void
  onEdgeChange: (edgeId: string, patch: Partial<WorkflowGraphEdge>) => void
  onCreateBranch: (conditionNodeId: string, kind: ConditionBranchKind) => void
}) {
  const outgoing = graph.edges.filter((edge) => edge.source === node.id)
  const mode = conditionMode(node)
  const selection = node.condition_selection === 'multiple' ? 'multiple' : 'single'
  const defaultModelId = modelOptions[0]?.id || ''
  const conditionModelOptions = workflowConditionModelOptions(modelOptions, node.condition_model)
  useEffect(() => {
    if (node.condition_mode) return
    onNodeChange({
      condition_mode: 'llm',
      condition_model: node.condition_model || defaultModelId,
      condition_selection: node.condition_selection || 'single',
      condition_fallback: node.condition_fallback || 'default',
      condition_confidence_threshold: node.condition_confidence_threshold ?? 0.35,
    })
  }, [defaultModelId, node.condition_confidence_threshold, node.condition_fallback, node.condition_mode, node.condition_model, node.condition_selection, onNodeChange])
  useEffect(() => {
    if (!canManage || mode !== 'llm' || node.condition_model?.trim() || !defaultModelId) return
    onNodeChange({ condition_model: defaultModelId })
  }, [canManage, defaultModelId, mode, node.condition_model, onNodeChange])
  return (
    <div className="space-y-3 border-t border-[#eeeeee] pt-3">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">分支路由</div>
        <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#41454d]">
          智能分支由 LLM 根据上游输出和分支说明选择后续路径；规则判断适合审批结果、数值阈值这类确定条件。
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-lg border border-[#dddddd] bg-[#f8fafc] p-1" role="tablist" aria-label="条件分支模式">
        <ModeButton
          active={mode === 'llm'}
          label="智能判断"
          onClick={() => onNodeChange({
            title: shouldReplaceConditionTitle(node.title) ? '智能分支' : node.title,
            condition_mode: 'llm',
            condition_model: node.condition_model || '',
            condition_selection: selection,
            condition_fallback: node.condition_fallback || 'default',
            condition_confidence_threshold: node.condition_confidence_threshold ?? 0.35,
          })}
        />
        <ModeButton
          active={mode === 'rule'}
          label="规则判断"
          onClick={() => onNodeChange({
            title: shouldReplaceConditionTitle(node.title) ? '条件分支' : node.title,
            condition_mode: 'rule',
          })}
        />
      </div>

      {mode === 'llm' && (
        <div className="space-y-3 rounded-md border border-[#dddddd] p-3">
          <div className="text-xs font-medium text-muted-foreground">智能判断设置</div>
          <Field label="判断模型">
            <select
              value={node.condition_model || ''}
              onChange={(event) => onNodeChange({ condition_model: event.target.value })}
              disabled={!canManage || modelsLoading || conditionModelOptions.length === 0}
              className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="" disabled>{modelsLoading ? '正在加载模型...' : '请选择模型'}</option>
              {conditionModelOptions.map((model) => (
                <option key={`${model.provider}:${model.id}`} value={model.id}>
                  {workflowModelOptionLabel(model)}
                </option>
              ))}
            </select>
            <div className="mt-1 text-[11px] leading-5 text-muted-foreground">
              从当前 App 可用模型列表选择，用于判断走哪条分支。
            </div>
          </Field>
          <Field label="判断要求">
            <textarea
              value={node.condition_prompt || ''}
              onChange={(event) => onNodeChange({ condition_prompt: event.target.value })}
              disabled={!canManage}
              rows={3}
              placeholder="例如：根据用户需求是否明确、资料是否完整、风险是否需要人工确认来选择分支。"
              className="min-h-20 w-full resize-y rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm leading-5 text-[#181d26] outline-none transition-colors focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="选择方式">
              <select
                value={selection}
                onChange={(event) => onNodeChange({ condition_selection: event.target.value as 'single' | 'multiple' })}
                disabled={!canManage}
                className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="single">单选分支</option>
                <option value="multiple">可并行多选</option>
              </select>
            </Field>
            <Field label="低置信度">
              <select
                value={node.condition_fallback || 'default'}
                onChange={(event) => onNodeChange({ condition_fallback: event.target.value as 'default' | 'fail' })}
                disabled={!canManage}
                className="h-9 w-full rounded-md border border-[#dddddd] bg-white px-2 text-sm text-[#181d26] outline-none focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="default">走 default</option>
                <option value="fail">标记失败</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      {outgoing.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed border-[#dddddd] bg-white px-3 py-3">
          <div className="text-sm font-medium text-[#181d26]">还没有分支</div>
          <div className="text-xs leading-5 text-muted-foreground">
            先创建一条业务分支，再按需要添加 default 兜底分支。
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onCreateBranch(node.id, 'rule')} disabled={!canManage}>
              <Plus className="size-3.5" />
              业务分支
            </Button>
            <Button size="sm" variant="outline" onClick={() => onCreateBranch(node.id, 'default')} disabled={!canManage}>
              <Plus className="size-3.5" />
              默认分支
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-muted-foreground">出边分支 {outgoing.length}</div>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="outline" onClick={() => onCreateBranch(node.id, 'rule')} disabled={!canManage}>
                <Plus className="size-3.5" />
                分支
              </Button>
              <Button size="sm" variant="outline" onClick={() => onCreateBranch(node.id, 'default')} disabled={!canManage}>
                <Plus className="size-3.5" />
                默认
              </Button>
            </div>
          </div>
          <div className="divide-y divide-[#eeeeee] rounded-md border border-[#dddddd]">
            {outgoing.map((edge) => {
              const target = graph.nodes.find((item) => item.id === edge.target)
              const isDefault = (edge.source_handle || '').trim().toLowerCase() === 'default'
              const hasCondition = !!edge.condition && Object.keys(edge.condition).length > 0
              const alwaysMatch = !isDefault && !hasCondition
              return (
                <div key={edge.id} className="space-y-2 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-xs font-medium text-[#181d26]">
                      到 {target?.title || edge.target}
                    </div>
                    <Badge variant="outline">{isDefault ? '兜底' : mode === 'llm' ? '分支' : '规则'}</Badge>
                  </div>
                  <Field label="分支名">
                    <Input
                      value={edge.source_handle || ''}
                      onChange={(event) => {
                        const sourceHandle = event.target.value.trim() || undefined
                        onEdgeChange(edge.id, {
                          source_handle: sourceHandle,
                          condition: sourceHandle === 'default' ? undefined : edge.condition,
                        })
                      }}
                      disabled={!canManage}
                      placeholder="通过 / 退回 / default"
                    />
                  </Field>
                  {mode === 'llm' ? (
                    <Field label={isDefault ? '兜底说明' : '什么时候走这条分支'}>
                      <textarea
                        value={edge.branch_description || ''}
                        onChange={(event) => onEdgeChange(edge.id, { branch_description: event.target.value })}
                        disabled={!canManage}
                        rows={3}
                        placeholder={isDefault ? '其他分支都不适合或模型不确定时走这里。' : '例如：资料齐全，可以直接执行。'}
                        className="min-h-20 w-full resize-y rounded-md border border-[#dddddd] bg-white px-3 py-2 text-sm leading-5 text-[#181d26] outline-none transition-colors focus:border-[#181d26] disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </Field>
                  ) : (
                    isDefault ? (
                      <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#41454d]">
                        default 是兜底分支，不需要命中条件。
                      </div>
                    ) : (
                      <>
                        <JSONField
                          label="命中条件"
                          value={edge.condition}
                          disabled={!canManage}
                          onChange={(value) => onEdgeChange(edge.id, { condition: value })}
                          placeholder={'{"op":"eq","left":{"var":"nodes.task.output.approved"},"right":true}'}
                        />
                        {alwaysMatch && (
                          <div className="rounded-md border border-[#d9a441]/60 bg-[#fff8df] px-3 py-2 text-xs leading-5 text-[#6b4a00]">
                            当前未设置条件，这条分支会总是命中。
                          </div>
                        )}
                      </>
                    )
                  )}
                  {mode === 'llm' && isDefault && (
                    <div className="rounded-md border border-[#dddddd] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#41454d]">
                      default 会在模型低置信度、无有效命中或其他分支都不适合时执行。
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function JSONField({
  label,
  value,
  disabled,
  onChange,
  placeholder,
}: {
  label: string
  value?: Record<string, unknown>
  disabled?: boolean
  onChange: (value: Record<string, unknown> | undefined) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(() => stringifyJSON(value))
  const [error, setError] = useState('')
  useEffect(() => {
    setDraft(stringifyJSON(value))
    setError('')
  }, [value])

  function applyDraft() {
    const text = draft.trim()
    if (!text) {
      setError('')
      onChange(undefined)
      return
    }
    try {
      const parsed = JSON.parse(text) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('必须是 JSON 对象')
        return
      }
      setError('')
      onChange(parsed as Record<string, unknown>)
    } catch {
      setError('JSON 格式不正确')
    }
  }

  return (
    <Field label={label}>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={applyDraft}
        disabled={disabled}
        rows={4}
        placeholder={placeholder}
        className={cn(
          'min-h-24 w-full resize-y rounded-md border bg-white px-3 py-2 font-mono text-xs leading-5 text-[#181d26] outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-[#aa2d00] focus:border-[#aa2d00]' : 'border-[#dddddd] focus:border-[#181d26]',
        )}
      />
      {error && <div className="text-xs text-[#aa2d00]">{error}</div>}
    </Field>
  )
}

function stringifyJSON(value?: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) return ''
  return JSON.stringify(value, null, 2)
}

function formatWorkflowPayload(value?: Record<string, unknown>) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) return '{}'
  return JSON.stringify(value, null, 2)
}

function workflowPayloadSection(value: Record<string, unknown> | undefined, key: 'inputs' | 'outputs'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const section = value[key]
  if (!section || typeof section !== 'object' || Array.isArray(section)) return {}
  return section as Record<string, unknown>
}

function workflowInputMappingSuggestions(graph: WorkflowGraph, node: WorkflowGraphNode): WorkflowMappingSuggestionGroup[] {
  const nodesById = new Map(graph.nodes.map((item) => [item.id, item]))
  const directSourceIds = new Set(graph.edges.filter((edge) => edge.target === node.id).map((edge) => edge.source))
  const directSources = Array.from(directSourceIds).map((id) => nodesById.get(id)).filter(Boolean) as WorkflowGraphNode[]
  return [
    {
      label: 'Run 输入',
      items: [
        { value: 'run.input', label: '完整运行输入' },
        { value: 'run.input.message.content', label: '消息内容' },
        { value: 'run.input.payload', label: 'Webhook payload' },
        { value: 'run.input.object.display_name', label: '上传文件名' },
        { value: 'run.input.task.title', label: '触发任务标题' },
      ],
    },
    { label: '直接上游', items: workflowNodeOutputPathSuggestions(directSources) },
  ]
}

function workflowOutputMappingSuggestions(node: WorkflowGraphNode): WorkflowMappingSuggestionGroup[] {
  const jsonFieldSuggestions = (node.outputs || [])
    .filter((port) => port.key?.trim())
    .map((port) => ({
      value: `result_json.${port.key.trim()}`,
      label: `JSON 字段 · ${port.label || port.key}`,
    }))
  const groups: WorkflowMappingSuggestionGroup[] = []
  if (node.type === 'task') {
    groups.push({
      label: '任务结果',
      items: [
        { value: 'result', label: '完整文本结果' },
        ...jsonFieldSuggestions,
        { value: 'output.result', label: '原始 result' },
        { value: 'output.task_id', label: '任务 ID' },
      ],
    })
  } else if (node.type === 'condition') {
    groups.push({
      label: '分支结果',
      items: [
        { value: 'output.matched_handles', label: '命中分支 Handle' },
        { value: 'output.matched_edges', label: '命中连线 ID' },
        { value: 'output.decision.reason', label: '智能判断原因' },
        { value: 'output.decision.confidence', label: '智能判断置信度' },
        { value: 'output.decision.selected_edges', label: '模型选择连线' },
      ],
    })
  } else if (node.type === 'human_approval') {
    groups.push({
      label: '审批结果',
      items: [
        { value: 'output.decision', label: '审批结论' },
        { value: 'output.decision_note', label: '审批备注' },
        { value: 'output.acted_by', label: '审批人' },
      ],
    })
  }
  groups.push({
    label: '原始输出',
    items: [
      { value: 'output', label: '完整原始输出' },
      { value: 'node.output', label: '当前节点输出' },
    ],
  })
  return groups
}

function workflowNodeOutputPathSuggestions(nodes: WorkflowGraphNode[]): WorkflowMappingSuggestion[] {
  const suggestions: WorkflowMappingSuggestion[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    const key = node.key?.trim()
    if (!key) continue
    const prefix = workflowNodeOptionLabel(node)
    for (const port of node.outputs || []) {
      const portKey = port.key?.trim()
      if (!portKey) continue
      const value = `nodes.${key}.output.outputs.${portKey}`
      if (seen.has(value)) continue
      seen.add(value)
      suggestions.push({ value, label: `${prefix} · ${port.label || portKey}` })
    }
    const rawResultValue = `nodes.${key}.output.result`
    if (node.type === 'task' && !seen.has(rawResultValue)) {
      seen.add(rawResultValue)
      suggestions.push({ value: rawResultValue, label: `${prefix} · 文本结果` })
    }
    for (const port of node.outputs || []) {
      const portKey = port.key?.trim()
      if (!portKey) continue
      const value = `nodes.${key}.output.result_json.${portKey}`
      if (node.type === 'task' && !seen.has(value)) {
        seen.add(value)
        suggestions.push({ value, label: `${prefix} · JSON ${portKey}` })
      }
    }
    if (node.type === 'condition') {
      for (const item of [
        { value: `nodes.${key}.output.matched_handles`, label: `${prefix} · 命中分支` },
        { value: `nodes.${key}.output.decision.reason`, label: `${prefix} · 判断原因` },
      ]) {
        if (seen.has(item.value)) continue
        seen.add(item.value)
        suggestions.push(item)
      }
    }
    if (node.type === 'human_approval') {
      for (const item of [
        { value: `nodes.${key}.output.decision`, label: `${prefix} · 审批结论` },
        { value: `nodes.${key}.output.decision_note`, label: `${prefix} · 审批备注` },
      ]) {
        if (seen.has(item.value)) continue
        seen.add(item.value)
        suggestions.push(item)
      }
    }
  }
  return suggestions
}

function workflowNodeOptionLabel(node: WorkflowGraphNode) {
  return `${node.title || node.key} (${node.key})`
}

function workflowPortSchemaType(port: WorkflowPort): WorkflowPortSchemaType {
  const type = typeof port.schema?.type === 'string' ? port.schema.type : ''
  return WORKFLOW_PORT_TYPE_OPTIONS.some((option) => option.value === type) ? (type as WorkflowPortSchemaType) : 'string'
}

function createWorkflowPort(kind: WorkflowPortKind, ports: WorkflowPort[]): WorkflowPort {
  const prefix = kind === 'inputs' ? 'input' : 'output'
  let index = ports.length + 1
  while (ports.some((port) => port.key === `${prefix}_${index}`)) index += 1
  return {
    key: `${prefix}_${index}`,
    label: kind === 'inputs' ? `输入 ${index}` : `输出 ${index}`,
    schema: { type: 'string' },
    required: kind === 'inputs' ? true : undefined,
  }
}

function normalizeWorkflowPortKey(value: string) {
  return value.trim().replace(/\s+/g, '_')
}

function compactWorkflowMapping(mapping?: Record<string, string>) {
  const next: Record<string, string> = {}
  Object.entries(mapping || {}).forEach(([key, value]) => {
    const cleanKey = key.trim()
    const cleanValue = String(value || '').trim()
    if (cleanKey && cleanValue) next[cleanKey] = cleanValue
  })
  return Object.keys(next).length > 0 ? next : undefined
}

function optionalPositiveInteger(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return positiveInteger(trimmed, 0)
}

function positiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(fallback, parsed)
}

function approvalScopeRole(node: WorkflowGraphNode) {
  const configScope = node.executor?.config?.approver_scope
  if (configScope && typeof configScope === 'object' && !Array.isArray(configScope)) {
    const role = (configScope as Record<string, unknown>).role
    if (role === 'channel_member') return 'channel_member'
  }
  const conditionScope = node.trigger_condition?.approver_scope
  if (conditionScope && typeof conditionScope === 'object' && !Array.isArray(conditionScope)) {
    const role = (conditionScope as Record<string, unknown>).role
    if (role === 'channel_member') return 'channel_member'
  }
  return 'channel_admin'
}

function triggerTypeFromNode(node: WorkflowGraphNode): WorkflowTriggerType {
  const type = node.trigger_condition?.trigger_type
  if (type === 'message' || type === 'schedule' || type === 'task_event' || type === 'storage_event' || type === 'webhook' || type === 'manual') {
    return type
  }
  return 'manual'
}

function conditionMode(node: WorkflowGraphNode): 'llm' | 'rule' {
  return node.condition_mode === 'llm' ? 'llm' : node.condition_mode === 'rule' ? 'rule' : 'llm'
}

function sortWorkflowModelOptions(models: WorkflowModelOption[]): WorkflowModelOption[] {
  const seen = new Set<string>()
  return models
    .map((model) => ({
      id: String(model.id || '').trim(),
      label: String(model.label || '').trim(),
      provider: String(model.provider || '').trim() || 'default',
    }))
    .filter((model) => {
      if (!model.id) return false
      const key = `${model.provider}:${model.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id))
}

function workflowConditionModelOptions(models: WorkflowModelOption[], currentModel?: string): WorkflowModelOption[] {
  const current = String(currentModel || '').trim()
  if (!current || models.some((model) => model.id === current)) return models
  return [{ id: current, label: `${current}（当前配置）`, provider: '当前配置' }, ...models]
}

function workflowModelOptionLabel(model: WorkflowModelOption) {
  const name = model.label?.trim() || model.id
  return model.provider ? `${model.provider} · ${name}` : name
}

function shouldReplaceConditionTitle(title: string) {
  const clean = title.trim()
  return !clean || clean === '条件分支' || clean === '智能分支'
}

function triggerNodeTitle(type: WorkflowTriggerType) {
  switch (type) {
    case 'message': return '消息触发'
    case 'schedule': return '定时触发'
    case 'task_event': return '任务事件触发'
    case 'storage_event': return '文件事件触发'
    case 'webhook': return 'Webhook 触发'
    default: return '手动触发'
  }
}

function shouldReplaceTriggerTitle(title: string) {
  const clean = title.trim()
  if (!clean || clean === '触发') return true
  return WORKFLOW_TRIGGER_TYPE_OPTIONS.some((option) => clean === option.label) || [
    '手动触发',
    '消息触发',
    '定时触发',
    '任务事件触发',
    '文件事件触发',
    'Webhook 触发',
  ].includes(clean)
}

function InspectorSectionButton({
  active,
  label,
  count,
  alert = false,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  alert?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35',
        active ? 'bg-white text-[#181d26] shadow-sm' : 'text-[#41454d] hover:bg-white/75 hover:text-[#181d26]',
      )}
    >
      <span className="truncate">{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'min-w-4 rounded-full px-1 text-center text-[10px] leading-4',
            alert ? 'bg-[#fff4ef] text-[#aa2d00]' : active ? 'bg-[#f8fafc] text-[#41454d]' : 'bg-white text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-0 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9297a0]/35',
        active ? 'bg-white text-[#181d26] shadow-sm' : 'text-[#41454d] hover:bg-white/75 hover:text-[#181d26]',
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  )
}

function WorkflowStatusBadge({ status, active = false }: { status: string; active?: boolean }) {
  return (
    <span className={cn('rounded-md border px-1.5 py-0.5 text-[11px]', active ? 'border-white/30 text-white/85' : 'border-[#dddddd] text-muted-foreground')}>
      {WORKFLOW_STATUS_LABEL[status] || status}
    </span>
  )
}

function RunStatusBadge({ status, active = false }: { status: string; active?: boolean }) {
  const Icon = status === 'succeeded' ? CheckCircle2 : status === 'failed' ? XCircle : status === 'awaiting_user' ? PauseCircle : status === 'cancelled' ? XCircle : AlertTriangle
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]', active ? 'border-white/30 text-white/85' : runStatusClass(status))}>
      <Icon className="h-3 w-3" />
      {NODE_STATUS_LABEL[status] || status}
    </span>
  )
}

function graphToFlow(
  graph: WorkflowGraph,
  statusByNode = new Map<string, WorkflowNodeRunStatus>(),
  selectedNodeId?: string | null,
  issuesByNode = new Map<string, WorkflowValidationError[]>(),
  mode: WorkflowFlowMode = 'editor',
): { nodes: WorkflowFlowNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node, index) => {
      const status = statusByNode.get(node.id)
      const issues = issuesByNode.get(node.id) || []
      return {
        id: node.id,
        type: 'workflow',
        position: node.ui?.position || { x: 80 + index * 190, y: 140 },
        data: { label: `${NODE_TYPE_LABEL[node.type]} · ${node.title}`, node, status, selected: selectedNodeId === node.id, issues },
        initialWidth: WORKFLOW_NODE_WIDTH,
        initialHeight: WORKFLOW_NODE_HEIGHT,
        measured: { width: WORKFLOW_NODE_WIDTH, height: WORKFLOW_NODE_HEIGHT },
        style: { width: WORKFLOW_NODE_WIDTH },
        className: cn(
          'workflow-node',
          status && workflowNodeClass(status),
          issues.length > 0 && 'workflow-node-warning',
        ),
      }
    }),
    edges: graph.edges.map((edge) => {
      const sourceStatus = statusByNode.get(edge.source)
      const targetStatus = statusByNode.get(edge.target)
      const activeEdge = mode === 'viewer' && !!targetStatus && WORKFLOW_ACTIVE_NODE_STATUSES.has(targetStatus) && sourceStatus === 'succeeded'
      const completeEdge = mode === 'viewer' && sourceStatus === 'succeeded' && !!targetStatus && targetStatus !== 'pending'
      const skippedEdge = mode === 'viewer' && (sourceStatus === 'skipped' || targetStatus === 'skipped')
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label: edge.source_handle || undefined,
        animated: activeEdge,
        className: cn(activeEdge && 'workflow-edge-active', completeEdge && 'workflow-edge-complete', skippedEdge && 'workflow-edge-skipped'),
        style: {
          stroke: activeEdge ? '#254fad' : skippedEdge ? '#9297a0' : completeEdge ? '#39bf45' : '#cbd5e1',
          strokeWidth: activeEdge ? 2.5 : completeEdge ? 2 : 1.35,
          strokeDasharray: skippedEdge ? '5 5' : undefined,
        },
        data: { edge },
      }
    }),
  }
}

function flowToGraph(nodes: WorkflowFlowNode[], edges: Edge[]): WorkflowGraph {
  return {
    schema_version: 1,
    nodes: nodes.map((flowNode) => ({
      ...flowNode.data.node,
      ui: { ...(flowNode.data.node.ui || {}), position: flowNode.position },
    })),
    edges: edges.map((edge): WorkflowGraphEdge => {
      const original = (edge.data as { edge?: WorkflowGraphEdge } | undefined)?.edge
      return {
        ...(original || {}),
        id: edge.id,
        source: edge.source,
        target: edge.target,
        source_handle: typeof edge.label === 'string' ? edge.label : original?.source_handle,
      }
    }),
  }
}

function defaultWorkflowGraph(): WorkflowGraph {
  return {
    schema_version: 1,
    nodes: [
      { id: 'trigger', key: 'trigger', type: 'trigger', title: '手动触发', outputs: [], ui: { position: { x: 80, y: 160 } } },
      { id: 'task', key: 'task', type: 'task', title: '执行任务', executor: { type: 'agent', ref: '' }, require_user_verification: true, inputs: [], outputs: [], ui: { position: { x: 320, y: 160 } } },
      { id: 'end', key: 'end', type: 'end', title: '结束', inputs: [], ui: { position: { x: 560, y: 160 } } },
    ],
    edges: [
      { id: 'edge-trigger-task', source: 'trigger', target: 'task' },
      { id: 'edge-task-end', source: 'task', target: 'end' },
    ],
  }
}

function draftGraphFromWorkflow(workflow: Workflow): WorkflowGraph | null {
  const settings = typeof workflow.settings === 'string' ? parseJSON<Record<string, unknown>>(workflow.settings) : workflow.settings
  const graph = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).draft_graph : null
  return normalizeWorkflowGraph(graph)
}

function normalizeWorkflowGraph(value: unknown): WorkflowGraph {
  if (!value || typeof value !== 'object') return defaultWorkflowGraph()
  const graph = value as Partial<WorkflowGraph>
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return defaultWorkflowGraph()
  return {
    schema_version: graph.schema_version || 1,
    nodes: graph.nodes as WorkflowGraphNode[],
    edges: graph.edges as WorkflowGraphEdge[],
    variables: graph.variables,
  }
}

function workflowGraphWithPreferredPositions(graph: WorkflowGraph, preferredGraph: WorkflowGraph): WorkflowGraph {
  const positionsById = new Map<string, XYPosition>()
  const positionsByKey = new Map<string, XYPosition>()
  for (const node of preferredGraph.nodes) {
    const position = node.ui?.position
    if (!position) continue
    positionsById.set(node.id, position)
    if (node.key) positionsByKey.set(node.key, position)
  }
  if (positionsById.size === 0 && positionsByKey.size === 0) return graph

  let changed = false
  const nodes = graph.nodes.map((node) => {
    const position = positionsById.get(node.id) || (node.key ? positionsByKey.get(node.key) : undefined)
    if (!position) return node
    const current = node.ui?.position
    if (current?.x === position.x && current?.y === position.y) return node
    changed = true
    return {
      ...node,
      ui: {
        ...(node.ui || {}),
        position: { x: position.x, y: position.y },
      },
    }
  })

  return changed ? { ...graph, nodes } : graph
}

function graphFromNodeRuns(nodeRuns: WorkflowNodeRun[]): WorkflowGraph {
  return {
    schema_version: 1,
    nodes: nodeRuns.map((nodeRun, index) => ({
      id: nodeRun.node_id,
      key: nodeRun.node_key,
      type: nodeRun.node_type,
      title: nodeRun.node_key,
      ui: { position: { x: 80 + index * 190, y: 160 } },
    })),
    edges: [],
  }
}

function validateWorkflowGraphLocally(graph: WorkflowGraph, agentMembers: ChannelMemberInfo[], userMembers: ChannelMemberInfo[]): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = []
  if (!graph.nodes.length) {
    return [{ code: 'missing_nodes', message: 'Workflow 至少需要一个节点', severity: 'error' }]
  }

  const nodes = new Map<string, WorkflowGraphNode>()
  const keys = new Map<string, string>()
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  let triggerCount = 0
  let endCount = 0

  for (const node of graph.nodes) {
    const id = node.id.trim()
    if (!id) {
      errors.push({ code: 'missing_node_id', message: '节点缺少 id', severity: 'error' })
      continue
    }
    if (nodes.has(id)) errors.push({ code: 'duplicate_node_id', message: '节点 id 重复', node_id: id, severity: 'error' })
    nodes.set(id, node)
    const key = node.key?.trim()
    if (!key) {
      errors.push({ code: 'missing_node_key', message: '节点缺少 key', node_id: id, severity: 'error' })
    } else if (keys.has(key)) {
      errors.push({ code: 'duplicate_node_key', message: '节点 key 重复', node_id: id, severity: 'error' })
    }
    keys.set(key, id)

    if (node.type === 'trigger') triggerCount += 1
    if (node.type === 'end') endCount += 1
    if (!['trigger', 'task', 'condition', 'human_approval', 'end'].includes(node.type)) {
      errors.push({ code: 'invalid_node_type', message: '节点类型不支持', node_id: id, severity: 'error' })
    }
    for (const input of node.inputs || []) {
      const inputKey = input.key.trim()
      const mappingExpression = (node.input_mapping || {})[inputKey]
      if (input.required && !mappingExpression) {
        errors.push({ code: 'missing_input_mapping', message: '必填输入缺少映射', node_id: id, severity: 'error' })
      }
      const mappingIssue = workflowMappingReferenceIssue(mappingExpression, graph)
      if (mappingIssue) {
        errors.push({ code: 'invalid_input_mapping_reference', message: mappingIssue, node_id: id, severity: 'warning' })
      }
    }
    for (const output of node.outputs || []) {
      const outputKey = output.key.trim()
      if (outputKey && !(node.output_mapping || {})[outputKey]) {
        errors.push({ code: 'missing_output_mapping', message: `输出字段「${outputKey}」缺少映射`, node_id: id, severity: 'warning' })
      }
      const mappingIssue = workflowMappingReferenceIssue((node.output_mapping || {})[outputKey], graph)
      if (mappingIssue) {
        errors.push({ code: 'invalid_output_mapping_reference', message: mappingIssue, node_id: id, severity: 'warning' })
      }
    }
  }

  if (triggerCount === 0) errors.push({ code: 'missing_trigger', message: 'Workflow 至少需要一个 trigger 节点', severity: 'error' })
  if (endCount === 0) errors.push({ code: 'missing_end', message: 'Workflow 至少需要一个 end 节点', severity: 'error' })

  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const source = edge.source?.trim()
    const target = edge.target?.trim()
    if (!nodes.has(source)) {
      errors.push({ code: 'missing_edge_source', message: '边 source 不存在', edge_id: edge.id, severity: 'error' })
    }
    if (!nodes.has(target)) {
      errors.push({ code: 'missing_edge_target', message: '边 target 不存在', edge_id: edge.id, severity: 'error' })
    }
    if (source && target) {
      adjacency.set(source, [...(adjacency.get(source) || []), target])
      outgoing.set(source, (outgoing.get(source) || 0) + 1)
      incoming.set(target, (incoming.get(target) || 0) + 1)
    }
    if (nodes.get(source)?.type === 'end') {
      errors.push({ code: 'end_has_outgoing', message: 'end 节点不能有出边', node_id: source, edge_id: edge.id, severity: 'error' })
    }
  }

  const agentRefs = new Set(agentMembers.map((member) => member.agent_id).filter(Boolean))
  const userRefs = new Set(userMembers.map((member) => member.user_id).filter(Boolean))
  for (const [id, node] of nodes.entries()) {
    if ((incoming.get(id) || 0) === 0 && (outgoing.get(id) || 0) === 0 && node.type !== 'trigger') {
      errors.push({ code: 'isolated_node', message: '不允许孤立节点', node_id: id, severity: 'error' })
    }
    if (node.type === 'condition') {
      const outgoingEdges = graph.edges.filter((edge) => edge.source === id)
      const hasDefault = outgoingEdges.some((edge) => edge.source_handle === 'default')
      if (outgoingEdges.length < 2 && !hasDefault) {
        errors.push({ code: 'condition_branch_required', message: 'condition 节点需要明确分支或 default 出口', node_id: id, severity: 'error' })
      }
      if (conditionMode(node) === 'llm' && !node.condition_model?.trim()) {
        errors.push({ code: 'condition_model_required', message: '智能分支缺少判断模型', node_id: id, severity: 'error' })
      }
    }
    if (node.type === 'task') {
      const executor = node.executor
      const ref = executor?.ref?.trim() || ''
      if (executor?.type === 'agent') {
        if (!ref) errors.push({ code: 'missing_executor', message: '任务节点缺少 Agent 执行者', node_id: id, severity: 'error' })
        else if (!agentRefs.has(ref)) errors.push({ code: 'missing_executor', message: '任务节点 Agent 不在当前频道中', node_id: id, severity: 'error' })
      } else if (executor?.type === 'user') {
        if (!ref) errors.push({ code: 'missing_executor', message: '任务节点缺少用户执行者', node_id: id, severity: 'error' })
        else if (!userRefs.has(ref)) errors.push({ code: 'missing_executor', message: '任务节点用户不在当前频道中', node_id: id, severity: 'error' })
      } else {
        errors.push({ code: 'invalid_executor', message: '任务节点执行者类型必须是 agent 或 user', node_id: id, severity: 'error' })
      }
    }
  }

  if (workflowHasCycle(nodes, adjacency)) {
    errors.push({ code: 'cycle_detected', message: 'DAG 不能包含环', severity: 'error' })
  }
  return errors
}

function workflowMappingReferenceIssue(expression: string | undefined, graph: WorkflowGraph): string | null {
  const value = expression?.trim()
  if (!value || value.startsWith('{') || value.startsWith('[') || value.startsWith('json:') || value.startsWith('literal:')) return null
  const parts = value.split('.').map((part) => part.trim()).filter(Boolean)
  if (parts[0] !== 'nodes') return null
  const nodeKey = parts[1]
  if (!nodeKey) return '映射引用缺少节点 Key'
  const sourceNode = graph.nodes.find((item) => item.key === nodeKey)
  if (!sourceNode) return `映射引用的节点不存在：${nodeKey}`
  if (parts[2] === 'output' && parts[3] === 'outputs' && parts[4]) {
    const outputKey = parts[4]
    const hasOutput = (sourceNode.outputs || []).some((port) => port.key === outputKey)
    if (!hasOutput) return `节点「${nodeKey}」没有稳定输出：${outputKey}`
  }
  return null
}

function workflowIssuesByNode(errors: WorkflowValidationError[]): Map<string, WorkflowValidationError[]> {
  const out = new Map<string, WorkflowValidationError[]>()
  for (const error of errors) {
    if (!error.node_id) continue
    out.set(error.node_id, [...(out.get(error.node_id) || []), error])
  }
  return out
}

function mergeWorkflowValidationErrors(...groups: WorkflowValidationError[][]): WorkflowValidationError[] {
  const out: WorkflowValidationError[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const error of group) {
      const key = `${error.code}:${error.node_id || ''}:${error.edge_id || ''}:${error.message}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(error)
    }
  }
  return out
}

function workflowHasCycle(nodes: Map<string, WorkflowGraphNode>, adjacency: Map<string, string[]>): boolean {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true
    if (visited.has(id)) return false
    visiting.add(id)
    for (const next of adjacency.get(id) || []) {
      if (nodes.has(next) && visit(next)) return true
    }
    visiting.delete(id)
    visited.add(id)
    return false
  }
  for (const id of nodes.keys()) {
    if (visit(id)) return true
  }
  return false
}

function parseJSON<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function workflowNodeStatusTone(status?: WorkflowNodeRunStatus) {
  switch (status) {
    case 'succeeded':
      return { dot: 'bg-[#006400]', badge: 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]' }
    case 'failed':
      return { dot: 'bg-[#aa2d00]', badge: 'border-[#aa2d00]/50 bg-[#fff4ef] text-[#aa2d00]' }
    case 'awaiting_user':
      return { dot: 'bg-[#d9a441]', badge: 'border-[#d9a441]/60 bg-[#fff8df] text-[#6b4a00]' }
    case 'running':
    case 'ready':
      return { dot: 'bg-[#254fad]', badge: 'border-[#458fff]/60 bg-[#f1f6ff] text-[#254fad]' }
    case 'skipped':
    case 'cancelled':
      return { dot: 'bg-[#9297a0]', badge: 'border-[#dddddd] bg-[#f8fafc] text-[#41454d]' }
    default:
      return { dot: 'bg-[#9297a0]', badge: 'border-[#dddddd] bg-white text-muted-foreground' }
  }
}

function workflowNodeClass(status: WorkflowNodeRunStatus) {
  switch (status) {
    case 'succeeded': return '!border-[#39bf45] !bg-[#f0fbf1]'
    case 'failed': return '!border-[#aa2d00] !bg-[#fff4ef]'
    case 'awaiting_user': return '!border-[#d9a441] !bg-[#fff8df]'
    case 'ready':
    case 'running': return '!border-[#458fff] !bg-[#f1f6ff]'
    default: return ''
  }
}

function runStatusClass(status: string) {
  switch (status) {
    case 'succeeded': return 'border-[#39bf45]/60 bg-[#f0fbf1] text-[#006400]'
    case 'failed': return 'border-[#aa2d00]/50 bg-[#fff4ef] text-[#aa2d00]'
    case 'awaiting_user': return 'border-[#d9a441]/60 bg-[#fff8df] text-[#6b4a00]'
    case 'running': return 'border-[#458fff]/60 bg-[#f1f6ff] text-[#254fad]'
    default: return 'border-[#dddddd] bg-white text-muted-foreground'
  }
}

function workflowTriggerSummary(trigger: WorkflowTrigger) {
  if (trigger.type === 'message') {
    const condition = trigger.condition_json || {}
    const right = condition.right
    if (typeof right === 'string' && right.trim()) return `消息包含「${right.trim()}」`
    return '匹配所有用户消息'
  }
  if (trigger.type === 'schedule') {
    const timezone = trigger.timezone || 'Asia/Shanghai'
    return `${trigger.schedule_rule || '未设置规则'} / ${timezone}`
  }
  if (trigger.type === 'task_event') {
    const condition = trigger.condition_json || {}
    const right = condition.right
    if (typeof right === 'string' && right.trim()) {
      const option = TASK_EVENT_TRIGGER_OPTIONS.find((item) => item.value === right.trim())
      return `任务事件：${option?.label || right.trim()}`
    }
    return '任务事件：未设置条件'
  }
  if (trigger.type === 'storage_event') {
    const condition = trigger.condition_json || {}
    const right = condition.right
    if (typeof right === 'string' && right.trim()) {
      const option = STORAGE_EVENT_TRIGGER_OPTIONS.find((item) => item.value === right.trim())
      return `文件事件：${option?.label || right.trim()}`
    }
    return '文件事件：未设置条件'
  }
  if (trigger.type === 'webhook') {
    return `Webhook / ${trigger.webhook_secret_prefix || trigger.id.slice(0, 8)}`
  }
  return trigger.type
}

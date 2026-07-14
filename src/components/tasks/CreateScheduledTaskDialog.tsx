import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AlignLeft, CalendarClock, CalendarPlus, Repeat2, UserRound } from 'lucide-react'
import { Button } from '../ui/button.js'
import { Input } from '../ui/input.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog.js'
import type { CreateScheduledTaskInput } from '../../stores/tasks.js'
import type { ChannelMemberInfo } from '../../core/types.js'

interface Props {
  agents?: ChannelMemberInfo[]
  onSubmit: (data: CreateScheduledTaskInput) => void
}

type RecurrencePreset = 'daily_9' | 'weekday_9' | 'weekly_monday_9' | 'monthly_first_9' | 'hourly' | 'custom'
type CustomScheduleMode = 'builder' | 'advanced'
type CustomFrequency = 'daily' | 'weekday' | 'weekly' | 'monthly' | 'hourly'

const RECURRENCE_PRESETS: Array<{
  value: RecurrencePreset
  label: string
  description: string
  cron: string
}> = [
  { value: 'daily_9', label: '每天 09:00', description: '每天上午 9 点执行一次', cron: '0 9 * * *' },
  { value: 'weekday_9', label: '工作日 09:00', description: '周一到周五上午 9 点执行', cron: '0 9 * * 1-5' },
  { value: 'weekly_monday_9', label: '每周一 09:00', description: '每周一上午 9 点执行', cron: '0 9 * * 1' },
  { value: 'monthly_first_9', label: '每月 1 日 09:00', description: '每月 1 号上午 9 点执行', cron: '0 9 1 * *' },
  { value: 'hourly', label: '每小时', description: '每个整点执行一次', cron: '0 * * * *' },
  { value: 'custom', label: '自定义重复', description: '用中文选项配置执行周期', cron: '' },
]

const defaultRecurrencePreset = RECURRENCE_PRESETS[1]
const WEEKDAY_OPTIONS = [
  { value: '1', label: '周一' },
  { value: '2', label: '周二' },
  { value: '3', label: '周三' },
  { value: '4', label: '周四' },
  { value: '5', label: '周五' },
  { value: '6', label: '周六' },
  { value: '0', label: '周日' },
]

export function CreateScheduledTaskDialog({ agents = [], onSubmit }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [runAt, setRunAt] = useState('')
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>(defaultRecurrencePreset.value)
  const [cronExpr, setCronExpr] = useState(defaultRecurrencePreset.cron)
  const [customScheduleMode, setCustomScheduleMode] = useState<CustomScheduleMode>('builder')
  const [customFrequency, setCustomFrequency] = useState<CustomFrequency>('weekday')
  const [customTime, setCustomTime] = useState('09:00')
  const [customWeekday, setCustomWeekday] = useState('1')
  const [customMonthDay, setCustomMonthDay] = useState('1')
  const [mode, setMode] = useState<'once' | 'recurring'>('once')
  const [assignedAgentId, setAssignedAgentId] = useState('')
  const firstAgentId = agents[0]?.agent_id || ''
  const hasAgents = agents.length > 0
  const selectedPreset = RECURRENCE_PRESETS.find((preset) => preset.value === recurrencePreset) || defaultRecurrencePreset
  const generatedCustomCron = buildCustomCronExpression({
    frequency: customFrequency,
    time: customTime,
    weekday: customWeekday,
    monthDay: customMonthDay,
  })
  const cronValidationMessage = mode === 'recurring' ? validateCronExpression(cronExpr) : ''
  const customScheduleSummary = describeCustomSchedule({
    frequency: customFrequency,
    time: customTime,
    weekday: customWeekday,
    monthDay: customMonthDay,
  })

  useEffect(() => {
    if (open && !assignedAgentId && firstAgentId) {
      setAssignedAgentId(firstAgentId)
    }
  }, [open, assignedAgentId, firstAgentId])

  const handleSubmit = () => {
    if (!title.trim()) return
    if (mode === 'once' && !runAt.trim()) return
    if (mode === 'recurring' && !cronExpr.trim()) return
    if (mode === 'recurring' && cronValidationMessage) return
    if (!assignedAgentId) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      assigned_agent_id: assignedAgentId || undefined,
      run_at: runAt ? new Date(runAt).toISOString() : undefined,
      cron_expr: mode === 'recurring' ? cronExpr.trim() : undefined,
      timezone: 'Asia/Shanghai',
      overlap_policy: 'skip',
      catch_up_policy: 'latest',
    })
    setTitle('')
    setDescription('')
    setRunAt('')
    setRecurrencePreset(defaultRecurrencePreset.value)
    setCronExpr(defaultRecurrencePreset.cron)
    setCustomScheduleMode('builder')
    setCustomFrequency('weekday')
    setCustomTime('09:00')
    setCustomWeekday('1')
    setCustomMonthDay('1')
    setAssignedAgentId('')
    setMode('once')
    setOpen(false)
  }

  const switchMode = (nextMode: 'once' | 'recurring') => {
    setMode(nextMode)
    if (nextMode === 'recurring' && !cronExpr.trim()) {
      setRecurrencePreset(defaultRecurrencePreset.value)
      setCronExpr(defaultRecurrencePreset.cron)
    }
  }

  const updateRecurrencePreset = (value: RecurrencePreset) => {
    setRecurrencePreset(value)
    const preset = RECURRENCE_PRESETS.find((item) => item.value === value)
    if (preset && value !== 'custom') {
      setCronExpr(preset.cron)
      return
    }
    if (value === 'custom') {
      setCustomScheduleMode('builder')
      setCronExpr(generatedCustomCron)
    }
  }

  const updateCustomBuilder = (patch: Partial<{
    frequency: CustomFrequency
    time: string
    weekday: string
    monthDay: string
  }>) => {
    const next = {
      frequency: patch.frequency ?? customFrequency,
      time: patch.time ?? customTime,
      weekday: patch.weekday ?? customWeekday,
      monthDay: patch.monthDay ?? customMonthDay,
    }
    if (patch.frequency) setCustomFrequency(patch.frequency)
    if (patch.time !== undefined) setCustomTime(patch.time)
    if (patch.weekday !== undefined) setCustomWeekday(patch.weekday)
    if (patch.monthDay !== undefined) setCustomMonthDay(patch.monthDay)
    if (recurrencePreset === 'custom' && customScheduleMode === 'builder') {
      setCronExpr(buildCustomCronExpression(next))
    }
  }

  const switchCustomScheduleMode = (nextMode: CustomScheduleMode) => {
    setCustomScheduleMode(nextMode)
    if (nextMode === 'builder') {
      setCronExpr(generatedCustomCron)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="计划任务">
        <CalendarPlus className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={() => setOpen(false)}>
        <DialogContent className="w-[min(100vw-2rem,760px)] p-0" onClose={() => setOpen(false)}>
          <DialogHeader className="px-4 py-3 border-b border-border">
            <DialogTitle>自动任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-[#f3f6f9] p-1">
              <button
                type="button"
                onClick={() => switchMode('once')}
                className={mode === 'once' ? 'rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#172033] shadow-sm' : 'rounded-md px-3 py-2 text-sm font-semibold text-[#465267] hover:bg-white/65'}
              >
                一次
              </button>
              <button
                type="button"
                onClick={() => switchMode('recurring')}
                className={mode === 'recurring' ? 'rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#172033] shadow-sm' : 'rounded-md px-3 py-2 text-sm font-semibold text-[#465267] hover:bg-white/65'}
              >
                重复
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel label="标题" />
                <Input placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
              </div>

              <div>
                <FieldLabel label="执行人" icon={<UserRound className="w-3.5 h-3.5" />} />
                <select
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                  disabled={!hasAgents}
                  className="h-8 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {!hasAgents && <option value="">无可用 Agent</option>}
                  {agents.map((agent) => (
                    <option key={agent.agent_id || agent.id} value={agent.agent_id || ''}>
                      {agent.display_name || agent.agent_id}
                    </option>
                  ))}
                </select>
                {!hasAgents && (
                  <div className="mt-1.5 text-xs text-destructive">当前频道没有 Agent，无法创建自动任务。</div>
                )}
              </div>
            </div>

            {mode === 'once' ? (
              <div>
                <FieldLabel label="执行时间" icon={<CalendarClock className="w-3.5 h-3.5" />} />
                <Input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-[#fbfcfd] p-3">
                <FieldLabel label="重复周期" icon={<Repeat2 className="w-3.5 h-3.5" />} />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                  <select
                    value={recurrencePreset}
                    onChange={(e) => updateRecurrencePreset(e.target.value as RecurrencePreset)}
                    className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium text-[#172033] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {RECURRENCE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                  <div className="rounded-lg border border-border bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {selectedPreset.description}
                    {recurrencePreset !== 'custom' && <span className="ml-2 font-mono text-[#465267]">{selectedPreset.cron}</span>}
                  </div>
                </div>
                {recurrencePreset === 'custom' && (
                  <div className="mt-3 rounded-lg border border-border bg-white p-3">
                    <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-[#f3f6f9] p-1">
                      <button
                        type="button"
                        onClick={() => switchCustomScheduleMode('builder')}
                        className={customScheduleMode === 'builder' ? 'rounded-sm bg-white px-3 py-1.5 text-xs font-semibold text-[#172033] shadow-sm' : 'rounded-sm px-3 py-1.5 text-xs font-semibold text-[#465267] hover:bg-white/65'}
                      >
                        中文配置
                      </button>
                      <button
                        type="button"
                        onClick={() => switchCustomScheduleMode('advanced')}
                        className={customScheduleMode === 'advanced' ? 'rounded-sm bg-white px-3 py-1.5 text-xs font-semibold text-[#172033] shadow-sm' : 'rounded-sm px-3 py-1.5 text-xs font-semibold text-[#465267] hover:bg-white/65'}
                      >
                        高级 Cron
                      </button>
                    </div>
                    {customScheduleMode === 'builder' ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <FieldLabel label="频率" />
                            <select
                              value={customFrequency}
                              onChange={(e) => updateCustomBuilder({ frequency: e.target.value as CustomFrequency })}
                              className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium text-[#172033] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <option value="daily">每天</option>
                              <option value="weekday">每个工作日</option>
                              <option value="weekly">每周</option>
                              <option value="monthly">每月</option>
                              <option value="hourly">每小时</option>
                            </select>
                          </div>
                          {customFrequency !== 'hourly' && (
                            <div>
                              <FieldLabel label="时间" />
                              <Input type="time" value={customTime} onChange={(e) => updateCustomBuilder({ time: e.target.value })} />
                            </div>
                          )}
                          {customFrequency === 'weekly' && (
                            <div>
                              <FieldLabel label="星期" />
                              <select
                                value={customWeekday}
                                onChange={(e) => updateCustomBuilder({ weekday: e.target.value })}
                                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium text-[#172033] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                {WEEKDAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                              </select>
                            </div>
                          )}
                          {customFrequency === 'monthly' && (
                            <div>
                              <FieldLabel label="日期" />
                              <select
                                value={customMonthDay}
                                onChange={(e) => updateCustomBuilder({ monthDay: e.target.value })}
                                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm font-medium text-[#172033] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              >
                                {Array.from({ length: 31 }, (_, index) => String(index + 1)).map((day) => <option key={day} value={day}>{day} 日</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg border border-[#dfe7ef] bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#465267]">
                          <div><span className="font-semibold text-[#172033]">将会执行：</span>{customScheduleSummary}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">系统保存规则：<span className="font-mono">{generatedCustomCron}</span></div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <FieldLabel label="Cron 表达式" />
                        <Input placeholder="例如：0 9 * * 1-5" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
                        {cronValidationMessage && <div className="mt-1.5 text-xs font-medium text-destructive">{cronValidationMessage}</div>}
                        <div className="mt-2 grid gap-1 rounded-lg bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-muted-foreground sm:grid-cols-5">
                          <span>分钟</span>
                          <span>小时</span>
                          <span>日期</span>
                          <span>月份</span>
                          <span>星期</span>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                          <span className="rounded-md border border-border bg-white px-2 py-1.5">工作日 9 点：<span className="font-mono text-[#465267]">0 9 * * 1-5</span></span>
                          <span className="rounded-md border border-border bg-white px-2 py-1.5">每周一 9 点：<span className="font-mono text-[#465267]">0 9 * * 1</span></span>
                          <span className="rounded-md border border-border bg-white px-2 py-1.5">每 30 分钟：<span className="font-mono text-[#465267]">*/30 * * * *</span></span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <FieldLabel label="描述" icon={<AlignLeft className="w-3.5 h-3.5" />} />
              <textarea
                placeholder="描述（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-xl px-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!hasAgents || !assignedAgentId || !title.trim() || (mode === 'once' ? !runAt.trim() : !cronExpr.trim() || Boolean(cronValidationMessage))}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function buildCustomCronExpression(input: { frequency: CustomFrequency; time: string; weekday: string; monthDay: string }) {
  if (input.frequency === 'hourly') return '0 * * * *'
  const { hour, minute } = parseTimeInput(input.time)
  if (input.frequency === 'daily') return `${minute} ${hour} * * *`
  if (input.frequency === 'weekday') return `${minute} ${hour} * * 1-5`
  if (input.frequency === 'weekly') return `${minute} ${hour} * * ${input.weekday || '1'}`
  const day = Math.max(1, Math.min(31, Number(input.monthDay || 1)))
  return `${minute} ${hour} ${day} * *`
}

function describeCustomSchedule(input: { frequency: CustomFrequency; time: string; weekday: string; monthDay: string }) {
  if (input.frequency === 'hourly') return '每小时整点执行一次（北京时间）'
  const time = formatTimeLabel(input.time)
  if (input.frequency === 'daily') return `每天 ${time} 执行一次（北京时间）`
  if (input.frequency === 'weekday') return `每个工作日 ${time} 执行一次（北京时间）`
  if (input.frequency === 'weekly') return `每周${weekdayLabel(input.weekday)} ${time} 执行一次（北京时间）`
  return `每月 ${Math.max(1, Math.min(31, Number(input.monthDay || 1)))} 日 ${time} 执行一次（北京时间）`
}

function parseTimeInput(value: string) {
  const [hourRaw, minuteRaw] = String(value || '09:00').split(':')
  const hour = Math.max(0, Math.min(23, Number(hourRaw || 9)))
  const minute = Math.max(0, Math.min(59, Number(minuteRaw || 0)))
  return { hour, minute }
}

function formatTimeLabel(value: string) {
  const { hour, minute } = parseTimeInput(value)
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function weekdayLabel(value: string) {
  return WEEKDAY_OPTIONS.find((option) => option.value === value)?.label.replace('周', '') || '一'
}

function validateCronExpression(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length !== 5) return 'Cron 表达式需要 5 段：分钟 小时 日期 月份 星期'
  return ''
}

function FieldLabel({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  )
}

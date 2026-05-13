import { useState, useCallback, useEffect } from 'react'
import type { AskUserQuestion, AskUserData } from '../../core/types.js'
import { cn } from '../../lib/cn.js'
import { SingleSelect } from './ask-user/SingleSelect.js'
import { MultiSelect } from './ask-user/MultiSelect.js'
import { TextInput } from './ask-user/TextInput.js'
import { ConfirmAction } from './ask-user/ConfirmAction.js'
import { ImageGrid } from './ask-user/ImageGrid.js'
import { QuestionPager } from './ask-user/QuestionPager.js'

interface Props {
  data: AskUserData
  currentUserId?: string
  onSubmit: (answers: Record<string, unknown>) => void
  className?: string
}

export function AskUserCard({ data, currentUserId, onSubmit, className }: Props) {
  const questions = Array.isArray(data.questions) ? data.questions : []
  const expiresAtMs = data.expiresAt ? Date.parse(data.expiresAt) : NaN
  const [now, setNow] = useState(() => Date.now())
  const answered = data.status === 'answered'
  const expired = data.status === 'expired' || (Number.isFinite(expiresAtMs) && expiresAtMs <= now)
  const targetUserIds = data.targetUserIds || (data.targetUserId ? [data.targetUserId] : [])
  const isSingleTarget = !data.visibility || data.visibility === 'target_user'
  const isTargetUser = data.visibility === 'all_members' || (currentUserId ? targetUserIds.includes(currentUserId) : false) || (isSingleTarget && targetUserIds.length === 0)
  const readOnly = answered || expired || !isTargetUser
  const audienceLabel =
    data.visibility === 'all_members' ? '全员可回答' :
    data.visibility === 'room_admins' ? '管理员可回答' :
    targetUserIds.length > 1 ? '指定成员可回答' :
    '仅你可回答'

  const [currentPage, setCurrentPage] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    if (data.answers) return data.answers
    const init: Record<string, unknown> = {}
    for (const q of questions) {
      if (q.type === 'multi_select' || q.type === 'image_grid') init[q.id] = []
      else if (q.type === 'text_input') init[q.id] = ''
      else init[q.id] = null
    }
    return init
  })

  const setAnswer = useCallback((id: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleSubmit = useCallback(() => {
    if (readOnly) return
    onSubmit(answers)
  }, [answers, onSubmit, readOnly])

  useEffect(() => {
    if (answered || expired || !Number.isFinite(expiresAtMs)) return
    const delay = Math.max(0, expiresAtMs - Date.now() + 250)
    const timer = window.setTimeout(() => setNow(Date.now()), delay)
    return () => window.clearTimeout(timer)
  }, [answered, expired, expiresAtMs])

  const canSubmit = questions.every((q) => {
    if (q.required === false) return true
    const val = answers[q.id]
    if (val === null || val === undefined) return false
    if (q.type === 'text_input' && (val as string).trim() === '') return false
    if ((q.type === 'multi_select' || q.type === 'image_grid') && (val as string[]).length === 0) return false
    return true
  })

  const question = questions[currentPage]
  if (!question) return null

  const renderQuestion = (q: AskUserQuestion) => {
    const val = answered ? (data.answers?.[q.id] ?? answers[q.id]) : answers[q.id]
    switch (q.type) {
      case 'single_select':
        return <SingleSelect question={q} value={val as string | null} onChange={(v) => setAnswer(q.id, v)} disabled={readOnly} />
      case 'multi_select':
        return <MultiSelect question={q} value={(val as string[]) || []} onChange={(v) => setAnswer(q.id, v)} disabled={readOnly} />
      case 'text_input':
        return <TextInput question={q} value={(val as string) || ''} onChange={(v) => setAnswer(q.id, v)} disabled={readOnly} />
      case 'confirm':
        return <ConfirmAction question={q} value={val as boolean | null} onChange={(v) => setAnswer(q.id, v)} disabled={readOnly} />
      case 'image_grid':
        return <ImageGrid question={q} value={(val as string[]) || []} onChange={(v) => setAnswer(q.id, v)} disabled={readOnly} />
      default:
        return <div className="text-xs text-muted-foreground">不支持的问题类型</div>
    }
  }

  return (
    <div className={cn('mx-12 my-2', className)}>
      <div className="rounded-xl border border-border bg-background overflow-hidden max-w-md shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">?</span>
          </div>
          <span className="text-sm font-medium">
            {answered ? '已回答' : expired ? '已超时' : !isTargetUser ? '等待回答' : '请回答'}
          </span>
          <span className="text-xs text-muted-foreground">{audienceLabel}</span>
          {questions.length > 1 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {currentPage + 1}/{questions.length}
            </span>
          )}
        </div>

        {/* Question */}
        <div className="px-4 py-3 space-y-3">
          <div>
            <h4 className="text-sm font-medium">{question.title}</h4>
            {question.description && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{question.description}</p>
            )}
          </div>
          {renderQuestion(question)}
        </div>

        {/* Pager + Submit */}
        <div className="px-4 pb-3 space-y-2">
          <QuestionPager total={questions.length} current={currentPage} onPageChange={setCurrentPage} />
          {expired && (
            <div className="text-xs text-muted-foreground text-center">回答时间已过，Agent 已停止等待。</div>
          )}
          {!answered && !expired && isTargetUser && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full rounded-lg px-4 py-2 text-sm font-medium transition-all',
                canSubmit
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              提交
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

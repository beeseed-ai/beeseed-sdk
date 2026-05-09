import { useTasks } from '../../hooks/use-tasks.js'
import { TaskItem } from './TaskItem.js'
import { CreateTaskDialog } from './CreateTaskDialog.js'

interface Props {
  roomId: string | null
}

export function TaskPanel({ roomId }: Props) {
  const { projects, tasks, loading, createTask } = useTasks(roomId)

  if (!roomId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">选择一个对话查看任务</div>
  }

  const groupedByProject = projects.map((proj) => ({
    project: proj,
    tasks: tasks.filter((t) => t.project_id === proj.id),
  }))
  const orphanTasks = tasks.filter((t) => !t.project_id)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold">任务</h2>
        <CreateTaskDialog onSubmit={(data) => createTask(data)} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">加载中...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">暂无任务</div>
        ) : (
          <>
            {groupedByProject.map(({ project, tasks: pTasks }) => (
              <div key={project.id} className="mb-3">
                <div className="flex items-center gap-2 px-2 py-1">
                  <span className="text-xs font-medium text-muted-foreground">{project.title}</span>
                  <span className="text-[10px] text-muted-foreground/60">{project.done_count}/{project.task_count}</span>
                </div>
                {pTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            ))}
            {orphanTasks.length > 0 && (
              <div className="mb-3">
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">未分组</div>
                {orphanTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

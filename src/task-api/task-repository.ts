import type { ExportTask } from "../shared/types.js";

export class InMemoryExportTaskRepository {
  private readonly tasks = new Map<string, ExportTask>();
  private readonly idempotencyIndex = new Map<string, string>();
  private sequence = 0;

  nextTaskId(): string {
    this.sequence += 1;
    return `export-task-${String(this.sequence).padStart(6, "0")}`;
  }

  save(task: ExportTask): ExportTask {
    this.tasks.set(task.taskId, task);
    this.idempotencyIndex.set(task.idempotencyScope, task.taskId);
    return task;
  }

  findById(taskId: string): ExportTask | undefined {
    return this.tasks.get(taskId);
  }

  findByIdempotencyScope(idempotencyScope: string): ExportTask | undefined {
    const taskId = this.idempotencyIndex.get(idempotencyScope);
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  list(): ExportTask[] {
    return [...this.tasks.values()];
  }
}

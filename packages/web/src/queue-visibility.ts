import type { Task } from "@forge/core";

export function shouldShowDoneInQueue(tasks: Task[], showDone: boolean): boolean {
  if (showDone) {
    return true;
  }
  const hasClosed = tasks.some(isClosedTask);
  const hasUnfinished = tasks.some((task) => !isClosedTask(task));
  return hasClosed && !hasUnfinished;
}

function isClosedTask(task: Task) {
  return task.status === "done" || task.status === "canceled";
}

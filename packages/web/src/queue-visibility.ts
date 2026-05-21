import type { Task } from "@forge/core";

export function shouldShowDoneInQueue(_tasks: Task[], showDone: boolean): boolean {
  return showDone;
}

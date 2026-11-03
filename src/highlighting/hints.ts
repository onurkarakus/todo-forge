import { daysUntil } from "../syntax/metadata";
import type { Priority, TodoMatch } from "../types";

export type DueTone = "overdue" | "today" | "soon" | "later";

export interface DueHint {
  tone: DueTone;
  /** Days until due; negative when overdue. */
  days: number;
}

export const SOON_DAYS = 7;

export const dueHint = (match: Pick<TodoMatch, "meta">, today: string): DueHint | undefined => {
  const due = match.meta?.due;
  if (!due) {
    return undefined;
  }
  const days = daysUntil(due, today);
  if (days < 0) {
    return { tone: "overdue", days };
  }
  if (days === 0) {
    return { tone: "today", days };
  }
  return { tone: days <= SOON_DAYS ? "soon" : "later", days };
};

export interface HintStrings {
  overdue: (days: number) => string;
  today: string;
  dueIn: (days: number) => string;
  priority: (priority: Priority) => string;
}

/** Text shown after a TODO line, such as `overdue 3d · !high`. */
export const hintText = (match: Pick<TodoMatch, "meta">, today: string, strings: HintStrings): string | undefined => {
  const parts: string[] = [];
  const due = dueHint(match, today);
  if (due) {
    parts.push(
      due.tone === "overdue" ? strings.overdue(-due.days) : due.tone === "today" ? strings.today : strings.dueIn(due.days),
    );
  }
  if (match.meta?.priority === "high") {
    parts.push(strings.priority("high"));
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
};

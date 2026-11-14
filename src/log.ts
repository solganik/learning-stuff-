export type StepRecord = {
  type: 'move' | 'split' | 'round' | 'merge' | 'undo' | 'reset' | 'no-shortcut';
  expr: string;
};

export type ProblemLog = {
  problemId: number;
  problem: string;
  steps: StepRecord[];
  wrongAttempts: number[];
  finalAnswer: number | null;
  finalExpr: string;
  smart: boolean;
  revealed: boolean;
  stars: number;
  seconds: number;
};

export type Session = { id: string; startedAt: string; problems: ProblemLog[] };

const KEY = 'math-adventure.sessions.v1';

export function loadSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Session[];
  } catch {
    return [];
  }
}

export const startSession = (): Session => ({
  id: Date.now().toString(36),
  startedAt: new Date().toISOString(),
  problems: [],
});

export function recordProblem(session: Session, entry: ProblemLog): void {
  session.problems.push(entry);
  const others = loadSessions().filter((s) => s.id !== session.id);
  localStorage.setItem(KEY, JSON.stringify([...others, session]));
}

export const clearSessions = (): void => localStorage.removeItem(KEY);

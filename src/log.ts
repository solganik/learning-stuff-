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

// ---------- exam / practice results ----------

export type ExamItem = {
  type: string;
  prompt: string;
  chosen: number | null;
  correct: number;
  ok: boolean;
  seconds: number;
};

export type ExamRecord = {
  id: string;
  startedAt: string;
  mode: 'exam' | 'practice';
  label: string;
  seed: number;
  durationSec: number;
  timedOut: boolean;
  items: ExamItem[];
};

const EXAM_KEY = 'math-adventure.exams.v1';

export function loadExams(): ExamRecord[] {
  try {
    return JSON.parse(localStorage.getItem(EXAM_KEY) ?? '[]') as ExamRecord[];
  } catch {
    return [];
  }
}

export function saveExam(rec: ExamRecord): void {
  const others = loadExams().filter((e) => e.id !== rec.id);
  localStorage.setItem(EXAM_KEY, JSON.stringify([...others, rec]));
}

export const clearExams = (): void => localStorage.removeItem(EXAM_KEY);

export type AnswerKind = "choice" | "integer" | "number";

function normalizeNumeric(value: string): string | null {
  const match = value.trim().match(/^(-?)(?:(\d+)(?:\.(\d+))?|\.(\d+))$/);
  if (!match) return null;

  const whole = (match[2] || "0").replace(/^0+(?=\d)/, "");
  const fraction = (match[3] || match[4] || "").replace(/0+$/, "");
  const isZero = whole === "0" && fraction.length === 0;
  return `${match[1] === "-" && !isZero ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function isAnswerCorrect(kind: AnswerKind, expected: string, submitted: string): boolean {
  if (kind === "integer" || kind === "number") {
    const pattern = kind === "integer" ? /^-?\d+$/ : /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
    if (!pattern.test(submitted.trim()) || !pattern.test(expected.trim())) return false;
    return normalizeNumeric(submitted) === normalizeNumeric(expected);
  }
  return submitted.trim() === expected.trim();
}

export function nextStreak(current: number, isCorrect: boolean): number {
  return isCorrect ? current + 1 : 0;
}

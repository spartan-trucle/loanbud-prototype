import type { ContactLeadAnswer } from "@/app/types";

/**
 * Selectors over the lead-answer rows.
 *
 * These exist because answers are stored normalised — one row per contact per
 * question — rather than as a map hanging off the Contact. Reading them is a
 * lookup, which is the same shape the real system uses (a join), and it is what
 * makes every answer filterable in the segment builder.
 */

/** Every answer a contact has given, newest question first is not meaningful — keyed lookups are. */
export function answersForContact(
  contactId: string,
  answers: ContactLeadAnswer[],
): ContactLeadAnswer[] {
  return answers.filter((a) => a.contactId === contactId);
}

/** One answer, or undefined when the contact never answered that question. */
export function answerFor(
  contactId: string,
  targetKey: string,
  answers: ContactLeadAnswer[],
): ContactLeadAnswer | undefined {
  return answers.find((a) => a.contactId === contactId && a.targetKey === targetKey);
}

/** The raw answer text, for display and for equality filters. */
export function answerValue(
  contactId: string,
  targetKey: string,
  answers: ContactLeadAnswer[],
): string | undefined {
  return answerFor(contactId, targetKey, answers)?.value;
}

/**
 * Answers projected to `{ questionKey: value }` for one contact.
 *
 * For display and equality only. Range filtering must read `valueMin`/`valueMax`
 * off the rows — flattening to strings is exactly the loss this model avoids.
 */
export function answerMapForContact(
  contactId: string,
  answers: ContactLeadAnswer[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const a of answers) {
    if (a.contactId === contactId) map[a.targetKey] = a.value;
  }
  return map;
}

/** Indexes answers by contact id so a list screen does one pass instead of one scan per row. */
export function answersByContact(
  answers: ContactLeadAnswer[],
): Map<string, ContactLeadAnswer[]> {
  const byContact = new Map<string, ContactLeadAnswer[]>();
  for (const a of answers) {
    const bucket = byContact.get(a.contactId);
    if (bucket) bucket.push(a);
    else byContact.set(a.contactId, [a]);
  }
  return byContact;
}

/** Every question anyone has answered — the vocabulary the segment builder offers. */
export function answeredKeys(answers: ContactLeadAnswer[]): string[] {
  return [...new Set(answers.map((a) => a.targetKey))].sort();
}

/** Distinct answers to one question, for a filter's dropdown options. */
export function distinctValues(targetKey: string, answers: ContactLeadAnswer[]): string[] {
  return [
    ...new Set(answers.filter((a) => a.targetKey === targetKey).map((a) => a.value)),
  ].sort();
}

/**
 * Applies a submission's answers to the stored set.
 *
 * Newest wins **by `answeredAt`, not by arrival** — a submission that reaches us
 * second but was answered first leaves the existing answer alone. Questions the
 * submission did not ask are untouched rather than cleared.
 */
export function upsertAnswers(
  existing: ContactLeadAnswer[],
  contactId: string,
  incoming: Record<string, string>,
  answeredAt: string,
  leadFormId?: string,
): ContactLeadAnswer[] {
  const next = [...existing];
  for (const [targetKey, value] of Object.entries(incoming)) {
    const at = next.findIndex((a) => a.contactId === contactId && a.targetKey === targetKey);
    const bounds = parseBounds(value);
    if (at === -1) {
      next.push({
        id: `cla-${contactId}-${targetKey}-${answeredAt}`,
        contactId,
        targetKey,
        value,
        ...bounds,
        leadFormId,
        answeredAt,
      });
    } else if (answeredAt >= next[at].answeredAt) {
      next[at] = { ...next[at], value, ...bounds, leadFormId, answeredAt };
    }
  }
  return next;
}

const TIMELINE_DAYS: Record<string, [number, number | undefined]> = {
  immediately: [0, 13],
  "2 – 4 weeks": [14, 28],
  "2-4 weeks": [14, 28],
  "4 weeks+": [29, undefined],
};

/**
 * Derives the numeric bounds a range filter needs.
 *
 * Returns nothing for a categorical answer ("Working capital") — that is correct,
 * not a parse failure: those are only ever filtered by equality.
 */
export function parseBounds(value: string): { valueMin?: number; valueMax?: number } {
  const v = value.trim();

  const timeline = TIMELINE_DAYS[v.toLowerCase()];
  if (timeline) return { valueMin: timeline[0], valueMax: timeline[1] };

  const range = v.match(/^\$?([\d.,km$]+)\s*[-–]\s*\$?([\d.,km$]+)/i);
  if (range) {
    const lo = toNumber(range[1]);
    const hi = toNumber(range[2]);
    if (lo !== undefined && hi !== undefined) return { valueMin: lo, valueMax: hi };
  }

  const under = v.match(/^(?:under|below|less than)\s+\$?([\d.,km]+)$/i);
  if (under) return { valueMax: toNumber(under[1]) };

  const over = v.match(/^(?:over|above|more than)\s+\$?([\d.,km]+)$/i);
  if (over) return { valueMin: toNumber(over[1]) };

  const bare = v.replace(/[$,]/g, "");
  if (/^[\d.]+\+$/.test(bare)) return { valueMin: toNumber(v) };
  if (/^[\d.]+[km]?$/i.test(bare)) {
    const n = toNumber(v);
    return n === undefined ? {} : { valueMin: n, valueMax: n };
  }

  return {};
}

function toNumber(token: string): number | undefined {
  const cleaned = token.trim().toLowerCase().replace(/[$,]/g, "").replace(/\+$/, "");
  const match = cleaned.match(/^([\d.]+)\s*([km])?$/);
  if (!match) return undefined;
  const scale = match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : 1;
  return Number(match[1]) * scale;
}

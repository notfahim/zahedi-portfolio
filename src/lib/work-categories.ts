/**
 * The browser side of `shared/work-categories.mjs`, which holds the list
 * itself — the publish CLIs read the same file, so a category is defined in
 * one place only.
 */
import {
  WORK_CATEGORIES as CATEGORIES,
  WORK_CATEGORY_IDS as IDS,
  CREDIT_LABELS as LABELS,
  creditFieldsFor,
} from "../../shared/work-categories.mjs";

/**
 * A credit row's field name, e.g. `"client"`: the key in `work.json`, and the
 * suffix of the card's `data-project-*` attribute.
 */
export type CreditField = string;

export interface WorkCategoryDef {
  id: string;
  /** On the jump-bar button, which names a group. */
  plural: string;
  /** In the lightbox and on a card, which names one project. */
  singular: string;
  /** The credits this kind of project carries beyond title/category/year. */
  fields: CreditField[];
}

export const WORK_CATEGORIES = CATEGORIES as readonly WorkCategoryDef[];
export const CREDIT_LABELS = LABELS as Record<CreditField, string>;
export { creditFieldsFor };

/**
 * Ids are validated by the schema's enum at build time, so nothing downstream
 * needs a narrower type than the string it reads out of JSON or a dataset.
 */
export type WorkCategoryId = string;

export const WORK_CATEGORY_IDS = IDS as [string, ...string[]];

/**
 * The singular label for a category id. Falls back to the raw id rather than
 * an empty string, so a category added to the content but not to this list
 * still reads as something.
 */
export function categoryLabel(id: string | undefined): string {
  if (!id) return "";
  return WORK_CATEGORIES.find((c) => c.id === id)?.singular ?? id;
}

/**
 * How many projects each category holds. A category with none gets a jump-bar
 * button that is present but disabled: the range of work on offer is part of
 * the page, so a missing button would say less than a dimmed one.
 */
export function categoryCounts(
  projects: { category?: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { id } of WORK_CATEGORIES) counts[id] = 0;
  for (const project of projects) {
    if (project.category && project.category in counts) counts[project.category] += 1;
  }
  return counts;
}

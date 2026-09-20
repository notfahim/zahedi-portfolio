/**
 * The five kinds of work, and the credit block each one carries.
 *
 * Plain `.mjs` because both sides need it: the browser build
 * (`src/lib/work-categories.ts`) and the Node publish CLIs, which seed a new
 * project's fields from the category folder it was published from.
 *
 * Every project has a title, a category and a year; `fields` is what that kind
 * of project carries on top of those. Adding a category, or moving a field
 * between categories, is an edit here and nowhere else.
 *
 * @module shared/work-categories
 */

export const CREDIT_LABELS = {
  client: "Client",
  director: "Director",
  producer: "Producer",
  runtime: "Run Time",
  artist: "Artist",
};

/**
 * Every category, in the order the site shows them: the Work grid runs through
 * these groups top to bottom and the jump bar lists them left to right.
 *
 * @type {{ id: string, plural: string, singular: string, fields: string[] }[]}
 */
export const WORK_CATEGORIES = [
  {
    id: "short-film",
    plural: "Short Films",
    singular: "Short Film",
    fields: ["director", "producer", "runtime"],
  },
  {
    id: "commercial",
    plural: "Commercials",
    singular: "Commercial",
    fields: ["client", "director"],
  },
  {
    id: "documentary",
    plural: "Documentaries",
    singular: "Documentary",
    fields: ["client", "runtime"],
  },
  {
    id: "music-video",
    plural: "Music Videos",
    singular: "Music Video",
    fields: ["artist", "director"],
  },
  {
    id: "feature",
    plural: "Features",
    singular: "Feature",
    fields: ["director", "producer", "runtime"],
  },
];

export const WORK_CATEGORY_IDS = WORK_CATEGORIES.map((c) => c.id);

/**
 * Every field any category uses. The schema allows all of them on any entry
 * rather than validating per category, so re-filing a project keeps the words
 * already typed into it.
 *
 * @type {string[]}
 */
export const ALL_CREDIT_FIELDS = [...new Set(WORK_CATEGORIES.flatMap((c) => c.fields))];

/**
 * The fields a category shows, in the order it shows them.
 *
 * @param {string | undefined} id Category id, e.g. `"music-video"`.
 * @returns {string[]} Empty for an unknown or missing category, which still
 *   shows its category and year.
 */
export function creditFieldsFor(id) {
  return WORK_CATEGORIES.find((c) => c.id === id)?.fields ?? [];
}

/**
 * The work folders the publish CLIs accept, e.g. `"work/commercial"`.
 *
 * @type {string[]}
 */
export const WORK_FOLDERS = WORK_CATEGORY_IDS.map((id) => `work/${id}`);

/**
 * Split a publish CLI's folder argument into an R2 prefix and a category. For
 * work, the folder names the category too, so the bucket stays organised by
 * kind of project and a new entry inherits the category it was published from.
 *
 * @param {string} arg Folder argument, e.g. `"work/commercial"` or `"photography"`.
 * @returns {{ prefix: string, category: string | undefined, isWork: boolean } | null}
 *   `null` for a work folder naming no category, or one this list does not
 *   know: a bare `"work/"` would store the object where nothing else lives and
 *   leave its entry uncategorised.
 */
export function parseWorkFolder(arg) {
  const parts = String(arg).split("/").filter(Boolean);
  if (parts[0] !== "work") return { prefix: parts.join("/"), category: undefined, isWork: false };
  const category = parts.length === 2 ? parts[1] : undefined;
  if (!category || !WORK_CATEGORY_IDS.includes(category)) return null;
  return { prefix: `work/${category}`, category, isWork: true };
}

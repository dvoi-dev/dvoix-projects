// Reads projects out of notes, without any DOM. A project is an ordinary note
// whose frontmatter says `type: project`:
//
//   ---
//   type: project          # or: projekt (German alias)
//   status: active         # idea | active | waiting | done | cancelled
//   due: 2026-12-01        # optional
//   start: 2026-11-01      # optional
//   priority: high         # optional: high | medium | low
//   area: Work             # optional, free-form
//   ---
//
// Its tasks are the checkboxes in the note, in the task syntax of the app
// (`crates/dvoix-core/src/tasks.rs`). German values are accepted as aliases,
// so vaults from before keep working. This was `project.rs` in the app.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The statuses in the order the panel sorts them. */
export const STATUSES = ["active", "waiting", "idea", "done", "cancelled"];

const STATUS_WORDS = {
  active: ["active", "aktiv", "doing", "in progress", "in arbeit", "laufend"],
  waiting: ["waiting", "wartend", "paused", "pausiert", "on-hold", "on hold", "blocked", "blockiert"],
  idea: ["idea", "idee", "planned", "geplant", "todo", "backlog"],
  done: ["done", "erledigt", "finished", "fertig", "abgeschlossen", "completed"],
  cancelled: ["cancelled", "abgebrochen", "canceled", "dropped", "verworfen"],
};

/** A status word in English or German, null when unknown. */
export function parseStatus(s) {
  const w = String(s).trim().toLowerCase();
  for (const [status, words] of Object.entries(STATUS_WORDS)) if (words.includes(w)) return status;
  return null;
}

/** A priority word (English, German alias, or 1-3), null when unknown. */
export function parsePriority(s) {
  const w = String(s).trim().toLowerCase();
  if (["hoch", "high", "1", "dringend", "urgent"].includes(w)) return "high";
  if (["mittel", "medium", "normal", "2"].includes(w)) return "medium";
  if (["niedrig", "low", "3"].includes(w)) return "low";
  return null;
}

/** `2026-12-01`, or a YAML date/datetime that starts with one. */
export function normalizeDate(s) {
  const d = String(s).trim().slice(0, 10);
  return DATE.test(d) ? d : null;
}

/** The frontmatter block and the body after it; `yaml` is null without frontmatter. */
export function splitFrontmatter(content) {
  const m = /^---\r?\n/.exec(content);
  if (!m) return { yaml: null, body: content, bodyLine: 0 };
  let offset = m[0].length;
  let line = 1;
  while (offset <= content.length) {
    const end = content.indexOf("\n", offset);
    const text = content.slice(offset, end < 0 ? content.length : end);
    if (text.trimEnd() === "---") {
      const next = end < 0 ? content.length : end + 1;
      return { yaml: content.slice(m[0].length, offset), body: content.slice(next), bodyLine: line + 1 };
    }
    if (end < 0) break;
    offset = end + 1;
    line++;
  }
  return { yaml: null, body: content, bodyLine: 0 };
}

/**
 * The top-level `key: value` scalars of a YAML block. Projects only need
 * plain scalars; lists, nested maps and block strings are skipped, so a full
 * YAML parser (and a dependency) is not needed.
 */
export function readScalars(yaml) {
  const out = {};
  for (const line of yaml.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*)\s*:(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (!value || value.startsWith("[") || value.startsWith("{") || value === "|" || value === ">") continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      // A comment after a plain value.
      value = value.replace(/\s+#.*$/, "");
    }
    if (value === "~" || value === "null") continue;
    out[m[1]] = value;
  }
  return out;
}

/** Due date of a task line, in the task syntax of the app. */
function taskDue(text) {
  const tokens = text.split(/\s+/);
  let due = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if ((t === "📅" || t === "🗓" || t === "🗓️") && DATE.test(tokens[i + 1] ?? "")) due = tokens[++i];
    else if (t.startsWith("due:") && DATE.test(t.slice(4))) due = t.slice(4);
    else if (t.startsWith("📅") && DATE.test(t.slice(2))) due = t.slice(2);
  }
  return due;
}

const CHECKBOX = /^\s*(?:[-*+]|\d{1,9}[.)])[ \t]+\[(.)\](?:[ \t]+(.*))?$/;

/** The checkbox tasks of a body, skipping fenced code blocks: open and done count and the earliest open due date. */
export function countTasks(body) {
  let open = 0;
  let done = 0;
  let nextDue = null;
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    const t = line.trimStart();
    if (fence) {
      if (t.startsWith(fence)) fence = null;
      continue;
    }
    if (t.startsWith("```") || t.startsWith("~~~")) {
      fence = t.slice(0, 3);
      continue;
    }
    const m = CHECKBOX.exec(line);
    if (!m) continue;
    if (m[1] === " ") {
      open++;
      const due = taskDue(m[2] ?? "");
      if (due && (!nextDue || due < nextDue)) nextDue = due;
    } else {
      done++;
    }
  }
  return { openTasks: open, doneTasks: done, nextDue };
}

/** The title of a note: `title` in the frontmatter, else the first `# heading`, else the file name. */
function titleOf(fm, body, path) {
  if (fm.title) return fm.title;
  const h = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body);
  if (h) return h[1].trim();
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/i, "");
}

/** The project of a note, or null when the note is no project. */
export function readProject(path, content) {
  const { yaml, body } = splitFrontmatter(content);
  if (yaml == null) return null;
  const fm = readScalars(yaml);
  const type = (fm.type ?? "").trim().toLowerCase();
  if (type !== "project" && type !== "projekt") return null;
  return {
    path,
    title: titleOf(fm, body, path),
    status: (fm.status && parseStatus(fm.status)) || "active",
    due: fm.due ? normalizeDate(fm.due) : null,
    start: fm.start ? normalizeDate(fm.start) : null,
    priority: fm.priority ? parsePriority(fm.priority) : null,
    area: fm.area?.trim() || null,
    ...countTasks(body),
  };
}

export const closed = (status) => status === "done" || status === "cancelled";

/** Running first by status, then by due date, then by title. */
export function sortProjects(list) {
  return [...list].sort((a, b) => {
    const s = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    if (s) return s;
    const ad = a.due ?? "9999";
    const bd = b.due ?? "9999";
    return ad < bd ? -1 : ad > bd ? 1 : a.title.localeCompare(b.title, "en");
  });
}

export function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

/** "overdue", "today", "week", "later" or "none", like the task overview of the app. */
export function dueBucket(due, now) {
  if (!due) return "none";
  if (due < now) return "overdue";
  if (due === now) return "today";
  if (due <= addDays(now, 7)) return "week";
  return "later";
}

const dateShort = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });
const dateLong = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

/** "today", "tomorrow", "yesterday" or "Dec 3" (with the year if not this year). */
export function formatDue(due, now) {
  if (due === now) return "today";
  if (due === addDays(now, 1)) return "tomorrow";
  if (due === addDays(now, -1)) return "yesterday";
  const [y, m, d] = due.split("-").map(Number);
  return (due.slice(0, 4) === now.slice(0, 4) ? dateShort : dateLong).format(new Date(y, m - 1, d));
}

/** The text of a new project note. */
export function newProjectNote(name, today) {
  return `---\ntype: project\nstatus: active\nstart: ${today}\ndue:\npriority:\narea:\n---\n# ${name}\n\n## Goal\n\n\n## Tasks\n\n- [ ] \n`;
}

/** A free path for a new project: `New project.md`, in a `Projects` folder if there is one. */
export function newProjectPath(entries) {
  const folder = entries.find((e) => e.isDir && /^(projects?|projekte?)$/i.test(e.path))?.path;
  const prefix = folder ? `${folder}/` : "";
  const taken = new Set(entries.map((e) => e.path.toLowerCase()));
  let name = "New project";
  for (let n = 2; taken.has(`${prefix}${name}.md`.toLowerCase()); n++) name = `New project ${n}`;
  return { path: `${prefix}${name}.md`, name };
}

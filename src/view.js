// The projects panel in plain DOM: a filter (running, closed, all), one card
// per project with status, area, priority, due dates and task progress, and a
// button for a new project. Notes are read through `dvoix.vault` and cached by
// their modification time, so a change on disk reads only what changed.
import { closed, dueBucket, formatDue, isoDate, newProjectNote, newProjectPath, readProject, sortProjects } from "./project.js";

const STATUS_LABELS = { active: "Active", waiting: "Waiting", idea: "Idea", done: "Done", cancelled: "Cancelled" };
const PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
const PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

/** All projects of the vault, kept up to date by the change events. */
export class ProjectStore {
  constructor(dvoix) {
    this.dvoix = dvoix;
    /** path -> { modified, project | null } */
    this.cache = new Map();
    this.projects = [];
    this.loaded = false;
    this.listeners = new Set();
    this.loading = null;
    this.again = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Reads the notes that are new or changed since the last load; one load at a time. */
  load() {
    if (this.loading) {
      this.again = true;
      return this.loading;
    }
    this.loading = this.read().finally(() => {
      this.loading = null;
      if (this.again) {
        this.again = false;
        void this.load();
      }
    });
    return this.loading;
  }

  async read() {
    const notes = this.dvoix.vault.list().filter((e) => !e.isDir && e.path.toLowerCase().endsWith(".md"));
    const seen = new Set();
    for (const e of notes) {
      seen.add(e.path);
      const hit = this.cache.get(e.path);
      if (hit && hit.modified === e.modified && hit.size === e.size) continue;
      try {
        const project = readProject(e.path, await this.dvoix.vault.read(e.path));
        this.cache.set(e.path, { modified: e.modified, size: e.size, project });
      } catch {
        this.cache.delete(e.path);
      }
    }
    for (const path of [...this.cache.keys()]) if (!seen.has(path)) this.cache.delete(path);
    this.projects = [...this.cache.values()].map((c) => c.project).filter(Boolean);
    this.loaded = true;
    for (const fn of this.listeners) fn();
  }

  /** Forgets the given paths, so the next load reads them again even if size and time match. */
  invalidate(paths) {
    for (const p of paths) this.cache.delete(p);
  }
}

export function mountPanel(el, store, dvoix) {
  let show = "running";
  el.classList.add("pj-panel");

  const createProject = async () => {
    const { path, name } = newProjectPath(dvoix.vault.list());
    try {
      await dvoix.vault.write(path, newProjectNote(name, isoDate(new Date())));
      await dvoix.vault.openFile(path);
    } catch (e) {
      console.error(e);
    }
  };

  const draw = () => {
    const now = isoDate(new Date());
    const projects = store.projects;
    const visible = sortProjects(
      projects.filter((p) => (show === "all" ? true : show === "closed" ? closed(p.status) : !closed(p.status))),
    );
    const running = projects.filter((p) => !closed(p.status)).length;
    const active = dvoix.workspace?.activeFile?.() ?? null;
    const tone = (due, status) => {
      if (closed(status)) return "pj-dim";
      const b = dueBucket(due, now);
      return b === "overdue" ? "pj-overdue" : b === "today" ? "pj-today" : "pj-soft";
    };
    const segment = (value, label) =>
      h("button", { class: `pj-seg ${show === value ? "pj-on" : ""}`, onclick: () => ((show = value), draw()) }, label);

    const card = (p) => {
      const total = p.openTasks + p.doneTasks;
      return h(
        "button",
        { class: `pj-card ${active === p.path ? "pj-active" : ""}`, onclick: () => void dvoix.vault.openFile(p.path) },
        h("div", { class: "pj-head" }, h("span", { class: "pj-title" }, p.title), h("span", { class: `pj-status pj-${p.status}` }, STATUS_LABELS[p.status])),
        h(
          "div",
          { class: "pj-meta" },
          p.area ? h("span", {}, p.area) : null,
          p.priority ? h("span", { class: `pj-prio-${p.priority}` }, PRIORITY_LABELS[p.priority]) : null,
          p.due ? h("span", { class: tone(p.due, p.status), title: `Due on ${p.due}` }, `due ${formatDue(p.due, now)}`) : null,
          p.nextDue && !closed(p.status) ? h("span", { class: tone(p.nextDue, p.status), title: "Next open task" }, `next task ${formatDue(p.nextDue, now)}`) : null,
        ),
        total
          ? h(
              "div",
              { class: "pj-progress" },
              h("div", { class: "pj-bar" }, h("div", { class: "pj-fill", style: `width:${(p.doneTasks / total) * 100}%` })),
              h("span", { class: "pj-count" }, `${p.doneTasks}/${total}`),
            )
          : null,
      );
    };

    let list;
    if (visible.length) list = visible.map(card);
    else if (!store.loaded) list = [];
    else if (projects.length) list = [h("p", { class: "pj-empty" }, "No projects in this view.")];
    else
      list = [
        h(
          "div",
          { class: "pj-empty" },
          h("p", {}, "No projects yet. A project is a note with this frontmatter:"),
          h("pre", { class: "pj-pre" }, "---\ntype: project\nstatus: active\ndue: 2026-12-01\n---"),
          h("p", { class: "pj-small" }, "Status: active, waiting, idea, done, cancelled. The checkboxes in the note are the project's tasks."),
          h("button", { class: "pj-link", onclick: () => void createProject() }, "Create new project"),
        ),
      ];

    el.replaceChildren(
      h(
        "div",
        { class: "pj-top" },
        h("div", { class: "pj-segments", role: "group", "aria-label": "Show" }, segment("running", `Running ${running}`), segment("closed", "Closed"), segment("all", "All")),
        h("button", { class: "pj-icon", title: "New project", "aria-label": "New project", html: PLUS, onclick: () => void createProject() }),
      ),
      h("div", { class: "pj-list" }, list),
    );
  };

  const off = store.subscribe(draw);
  draw();
  void store.load();
  return () => {
    off();
    el.replaceChildren();
  };
}

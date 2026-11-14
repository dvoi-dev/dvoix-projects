// The project dashboard, a view in its own tab: every project as a row of a
// table (sortable by clicking a column head) with a timeline from start to due
// date next to it. It draws from the same ProjectStore as the panel, so it
// keeps no data of its own.
import { closed, daysBetween, dueBucket, formatDue, isoDate, sortProjects, STATUSES, timelineRange } from "./project.js";
import { h, PRIORITY_LABELS, STATUS_LABELS } from "./view.js";

const PRIORITIES = ["high", "medium", "low"];

/** Compare functions per column; projects without a value go last. */
const COLUMNS = [
  { key: "title", label: "Project", cmp: (a, b) => a.title.localeCompare(b.title, "en") },
  { key: "status", label: "Status", cmp: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) },
  { key: "area", label: "Area", cmp: (a, b) => last(a.area, b.area) ?? a.area.localeCompare(b.area, "en") },
  { key: "priority", label: "Priority", cmp: (a, b) => last(a.priority, b.priority) ?? PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) },
  { key: "start", label: "Start", cmp: (a, b) => last(a.start, b.start) ?? a.start.localeCompare(b.start) },
  { key: "due", label: "Due", cmp: (a, b) => last(a.due, b.due) ?? a.due.localeCompare(b.due) },
  { key: "progress", label: "Tasks", cmp: (a, b) => last(ratio(a), ratio(b)) ?? ratio(a) - ratio(b) },
];

function last(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return null;
}

function ratio(p) {
  const total = p.openTasks + p.doneTasks;
  return total ? p.doneTasks / total : null;
}

export function mountDashboard(el, store, dvoix) {
  let show = "running";
  let sort = null; // { key, dir } or null for the panel's order
  el.classList.add("pj-dash");

  const sorted = (list) => {
    if (!sort) return sortProjects(list);
    const col = COLUMNS.find((c) => c.key === sort.key);
    // Missing values stay at the end in both directions.
    return [...sortProjects(list)].sort((a, b) => {
      const miss = col.key === "title" || col.key === "status" ? null : last(col.key === "progress" ? ratio(a) : a[col.key], col.key === "progress" ? ratio(b) : b[col.key]);
      if (miss != null && miss !== 0) return miss;
      return col.cmp(a, b) * sort.dir;
    });
  };

  const draw = () => {
    const now = isoDate(new Date());
    const projects = store.projects;
    const visible = sorted(projects.filter((p) => (show === "all" ? true : show === "closed" ? closed(p.status) : !closed(p.status))));
    const range = timelineRange(visible, now);
    const pct = (iso) => (daysBetween(range.from, iso) / range.days) * 100;
    const tone = (due, status) => {
      if (closed(status)) return "pj-dim";
      const b = dueBucket(due, now);
      return b === "overdue" ? "pj-overdue" : b === "today" ? "pj-today" : "";
    };

    const segment = (value, label) =>
      h("button", { class: `pj-seg ${show === value ? "pj-on" : ""}`, onclick: () => ((show = value), draw()) }, label);

    const head = (c) => {
      const on = sort?.key === c.key;
      return h(
        "th",
        { "aria-sort": on ? (sort.dir > 0 ? "ascending" : "descending") : null },
        h(
          "button",
          {
            class: `pj-th ${on ? "pj-on" : ""}`,
            title: "Sort",
            onclick: () => {
              // Ascending, descending, then back to the default order.
              sort = !on ? { key: c.key, dir: 1 } : sort.dir > 0 ? { key: c.key, dir: -1 } : null;
              draw();
            },
          },
          c.label,
          on ? (sort.dir > 0 ? " ↑" : " ↓") : "",
        ),
      );
    };

    const bar = (p) => {
      if (!range || (!p.start && !p.due)) return h("div", { class: "pj-lane" });
      // A project with only one date shows as a short mark at that date.
      const from = p.start ?? p.due;
      const to = p.due ?? p.start;
      const left = pct(from <= to ? from : to);
      const width = Math.max(Math.abs(pct(to) - pct(from)), 100 / range.days);
      const r = ratio(p);
      return h(
        "div",
        { class: "pj-lane" },
        h(
          "div",
          {
            class: `pj-span pj-${p.status} ${p.due && !closed(p.status) && p.due < now ? "pj-late" : ""}`,
            style: `left:${left}%;width:${width}%`,
            title: `${p.title}: ${p.start ?? "?"} → ${p.due ?? "?"}`,
          },
          r != null ? h("div", { class: "pj-span-fill", style: `width:${r * 100}%` }) : null,
        ),
      );
    };

    const row = (p) => {
      const total = p.openTasks + p.doneTasks;
      return h(
        "tr",
        { class: "pj-row", onclick: () => void dvoix.vault.openFile(p.path), title: p.folder ? `Folder ${p.folder} (${p.notes} notes)` : p.path },
        h("td", { class: "pj-cell-title" }, p.title, p.folder ? h("span", { class: "pj-folder" }, ` ${p.notes} notes`) : null),
        h("td", {}, h("span", { class: `pj-status pj-${p.status}` }, STATUS_LABELS[p.status])),
        h("td", { class: "pj-soft" }, p.area ?? ""),
        h("td", {}, p.priority ? h("span", { class: `pj-prio-${p.priority}` }, PRIORITY_LABELS[p.priority]) : ""),
        h("td", { class: "pj-soft pj-nowrap" }, p.start ? formatDue(p.start, now) : ""),
        h("td", { class: `pj-nowrap ${p.due ? tone(p.due, p.status) : ""}` }, p.due ? formatDue(p.due, now) : ""),
        h(
          "td",
          { class: "pj-nowrap" },
          total
            ? h("div", { class: "pj-progress" }, h("div", { class: "pj-bar" }, h("div", { class: "pj-fill", style: `width:${(p.doneTasks / total) * 100}%` })), h("span", { class: "pj-count" }, `${p.doneTasks}/${total}`))
            : "",
        ),
        h("td", { class: "pj-cell-time" }, bar(p)),
      );
    };

    const axis = () => {
      if (!range) return h("th", { class: "pj-cell-time" });
      // One tick per month start inside the range, plus a line for today.
      const ticks = [];
      let [y, m] = range.from.split("-").map(Number);
      for (;;) {
        m += 1;
        if (m > 12) ((m = 1), (y += 1));
        const iso = `${y}-${String(m).padStart(2, "0")}-01`;
        if (iso > range.to) break;
        ticks.push(h("span", { class: "pj-tick", style: `left:${pct(iso)}%` }, new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(y, m - 1, 1))));
      }
      return h("th", { class: "pj-cell-time" }, h("div", { class: "pj-axis" }, ticks, h("span", { class: "pj-now", style: `left:${pct(now)}%`, title: "Today" })));
    };

    let body;
    if (!store.loaded) body = null;
    else if (!visible.length) body = h("p", { class: "pj-empty" }, projects.length ? "No projects in this view." : "No projects yet. A project is a note with `type: project` in its frontmatter.");
    else
      body = h(
        "table",
        { class: "pj-table" },
        h("thead", {}, h("tr", {}, COLUMNS.map(head), axis())),
        h("tbody", {}, visible.map(row)),
      );

    const running = projects.filter((p) => !closed(p.status)).length;
    el.replaceChildren(
      h(
        "div",
        { class: "pj-dash-top" },
        h("h1", { class: "pj-dash-title" }, "Projects"),
        h("div", { class: "pj-segments", role: "group", "aria-label": "Show" }, segment("running", `Running ${running}`), segment("closed", "Closed"), segment("all", "All")),
      ),
      h("div", { class: "pj-dash-body" }, body),
    );
  };

  const off = store.subscribe(draw);
  draw();
  void store.load();
  // The timeline's "today" moves at midnight.
  const tick = setInterval(draw, 60 * 60 * 1000);
  return () => {
    off();
    clearInterval(tick);
    el.replaceChildren();
  };
}

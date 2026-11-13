// Tests for reading projects out of notes: frontmatter, German aliases, task
// counts, due dates and the order of the panel.
import assert from "node:assert/strict";
import { test } from "node:test";
import { countTasks, dueBucket, formatDue, newProjectPath, readProject, readScalars, sortProjects } from "../src/project.js";

const NOTE = "---\ntype: project\nstatus: active\ndue: 2026-12-01\npriority: high\narea: \"Work\" \ntags: [a, b]\n---\n# Move\n- [ ] Boxes 📅 2026-11-20\n- [x] Cancel contract\n- [ ] Re-register due:2026-11-15 !high\n```\n- [ ] in code\n```\n";

test("reads a project with its tasks", () => {
  assert.deepEqual(readProject("projects/move.md", NOTE), {
    path: "projects/move.md",
    title: "Move",
    status: "active",
    due: "2026-12-01",
    start: null,
    priority: "high",
    area: "Work",
    openTasks: 2,
    doneTasks: 1,
    nextDue: "2026-11-15",
  });
});

test("German aliases and defaults", () => {
  const p = readProject("x/Umzug.md", "---\ntype: Projekt\nstatus: erledigt\npriority: mittel\ndue: 2026-12-01T10:00\n---\nText");
  assert.equal(p.status, "done");
  assert.equal(p.priority, "medium");
  assert.equal(p.due, "2026-12-01");
  assert.equal(p.title, "Umzug");
  assert.equal(readProject("a.md", "---\ntype: project\nstatus: odd\n---\n").status, "active");
  assert.equal(readProject("a.md", "---\ntitle: T\ntype: project\n---\n# H").title, "T");
});

test("notes that are no project", () => {
  assert.equal(readProject("a.md", "# Just a note\n- [ ] task"), null);
  assert.equal(readProject("a.md", "---\ntype: note\n---\n"), null);
  assert.equal(readProject("a.md", "---\ntype: project\nno end"), null);
});

test("scalars skip lists, comments and empty values", () => {
  assert.deepEqual(readScalars("a: 1 # c\nb:\nc: [x]\nd: 'q # r'\ne: ~\n  f: nested"), { a: "1", d: "q # r" });
});

test("CRLF notes", () => {
  const p = readProject("a.md", NOTE.replace(/\n/g, "\r\n"));
  assert.equal(p.openTasks, 2);
  assert.equal(p.title, "Move");
});

test("task counts and order", () => {
  assert.deepEqual(countTasks("1. [ ] a\n* [X] b\n- not\n-[ ] no"), { openTasks: 1, doneTasks: 1, nextDue: null });
  const list = sortProjects([
    { title: "B", status: "done", due: null },
    { title: "C", status: "active", due: null },
    { title: "A", status: "active", due: "2026-01-01" },
  ]);
  assert.deepEqual(list.map((p) => p.title), ["A", "C", "B"]);
});

test("due dates and new project paths", () => {
  assert.equal(dueBucket("2026-11-12", "2026-11-13"), "overdue");
  assert.equal(dueBucket("2026-11-20", "2026-11-13"), "week");
  assert.equal(formatDue("2026-11-14", "2026-11-13"), "tomorrow");
  assert.equal(formatDue("2027-01-05", "2026-11-13"), "Jan 5, 2027");
  const entries = [{ path: "Projects", isDir: true }, { path: "Projects/New project", isDir: true }];
  assert.deepEqual(newProjectPath(entries), { path: "Projects/New project 2/New project 2.md", name: "New project 2" });
  assert.deepEqual(newProjectPath([]), { path: "New project/New project.md", name: "New project" });
});

test("timelineRange spans all dates and today, with padding", async () => {
  const { timelineRange, daysBetween } = await import("../src/project.js");
  assert.equal(timelineRange([{ start: null, due: null }], "2026-11-13"), null);
  const r = timelineRange([{ start: "2026-11-01", due: "2026-12-01" }, { start: null, due: "2026-11-20" }], "2026-11-13");
  assert.deepEqual(r, { from: "2026-10-29", to: "2026-12-04", days: 36 });
  const past = timelineRange([{ start: null, due: "2026-01-10" }], "2026-11-13");
  assert.equal(past.to, "2026-11-16");
  assert.equal(daysBetween("2026-03-28", "2026-03-30"), 2);
});

test("a project note alone in its folder makes the folder the project", async () => {
  const { assembleProjects } = await import("../src/project.js");
  const p = (path) => ({ path, title: path, status: "active", openTasks: 1, doneTasks: 0, nextDue: null });
  const t = (open, done, nextDue = null) => ({ openTasks: open, doneTasks: done, nextDue });
  const out = assembleProjects([
    { path: "Projects/House/House.md", project: p("Projects/House/House.md"), tasks: t(1, 0) },
    { path: "Projects/House/Offers.md", project: null, tasks: t(2, 1, "2026-11-20") },
    { path: "Projects/House/Garden/Plan.md", project: null, tasks: t(0, 3) },
    { path: "Projects/House/Shed/Shed.md", project: p("Projects/House/Shed/Shed.md"), tasks: t(1, 0) },
    { path: "Projects/House/Shed/Wood.md", project: null, tasks: t(1, 1) },
    { path: "Projects/A.md", project: p("Projects/A.md"), tasks: t(1, 0) },
    { path: "Work/X.md", project: p("Work/X.md"), tasks: t(1, 0) },
    { path: "Work/Y.md", project: p("Work/Y.md"), tasks: t(1, 0) },
    { path: "Top.md", project: p("Top.md"), tasks: t(1, 0) },
  ]);
  const by = Object.fromEntries(out.map((x) => [x.path, x]));
  assert.deepEqual(
    [by["Projects/House/House.md"].folder, by["Projects/House/House.md"].openTasks, by["Projects/House/House.md"].doneTasks, by["Projects/House/House.md"].nextDue, by["Projects/House/House.md"].notes],
    ["Projects/House", 3, 4, "2026-11-20", 3],
  );
  assert.deepEqual([by["Projects/House/Shed/Shed.md"].openTasks, by["Projects/House/Shed/Shed.md"].doneTasks], [2, 1]);
  // Projects folder, a folder with two projects and the root stay single notes.
  for (const k of ["Projects/A.md", "Work/X.md", "Work/Y.md", "Top.md"]) assert.equal(by[k].folder, null);
});

# dvoix Projects

The official Projects plugin for [dvoix](https://github.com/dvoi-dev/dvoix). It lists notes with `type: project` in their frontmatter as projects, with status, due date and the progress of their checkboxes. Install it in the app under **Settings → Plugin store**. It used to be a core plugin of the app; existing project notes keep working unchanged.

## Project notes

A project is an ordinary note with this frontmatter; its tasks are the checkboxes in it:

```yaml
---
type: project          # or: projekt (German alias)
status: active         # idea | active | waiting | done | cancelled
due: 2026-12-01        # optional
start: 2026-11-01      # optional
priority: high         # optional: high | medium | low
area: Work             # optional, free-form
---
```

### Project folders

A project is usually a folder. When a project note is the only project note in its folder, the whole folder is the project: the checkboxes of every note in it and in its subfolders count towards its progress and next due task. A subfolder with a project note of its own is a separate project. The vault root and a top-level `Projects` folder are never a project folder, so many single-note projects can live there side by side.

German values (`aktiv`, `wartend`, `erledigt`, `hoch`, ...) are accepted as aliases. Tasks use the syntax of the app: `- [ ] Call back 📅 2026-11-20` or `due:2026-11-20`.

## The panel

**Projects** in the sidebar shows running projects (or closed ones, or all), sorted by status and due date. Each card shows the status, area, priority, the due date, the next due open task and a progress bar. The plus button creates a folder `New project` with the note `New project.md` in it, inside a `Projects` folder if the vault has one.

## The dashboard

The grid button in the panel (or the command **Open project dashboard**) opens all projects in a tab: a table with status, area, priority, start, due date and task progress, sortable by clicking a column head, and a timeline from each project's start to its due date with a line for today. Overdue running projects are outlined in red.

## Permissions

- **Read files** (`vault:read`): reads the notes to find projects and follows changes.
- **Change files** (`vault:write`): creates the note of a new project. Existing notes are never changed.

## Development

```sh
npm install
npm test
npm run build    # dist/ with manifest.json, main.js, styles.css
```

To try it without the store, copy the three files from `dist/` to `<vault>/.dvoix/plugins/projects/`. A release is created automatically when `main` has a new `version` in `manifest.json` and `package.json`.

## License

MIT or Apache-2.0, at your option.

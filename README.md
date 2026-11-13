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

German values (`aktiv`, `wartend`, `erledigt`, `hoch`, ...) are accepted as aliases. Tasks use the syntax of the app: `- [ ] Call back 📅 2026-11-20` or `due:2026-11-20`.

## The panel

**Projects** in the sidebar shows running projects (or closed ones, or all), sorted by status and due date. Each card shows the status, area, priority, the due date, the next due open task and a progress bar. The plus button creates `New project.md` with the frontmatter above, in a `Projects` folder if the vault has one.

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

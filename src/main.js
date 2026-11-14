// Entry point of the Projects plugin for dvoix: registers the projects panel
// and keeps its list fresh with the vault's change events. Bundled into one
// `main.js`, because the app loads store plugins as one ES module without imports.
import { mountDashboard } from "./dashboard.js";
import { ProjectStore, mountPanel } from "./view.js";

const icon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/></svg>';

export default {
  onload(dvoix) {
    if (!dvoix.vault?.onChange) {
      throw new Error("This version of dvoix is too old for the Projects plugin. Please update the app.");
    }
    const store = new ProjectStore(dvoix);
    dvoix.registerView({ id: "dashboard", label: "Projects", icon, mount: (el) => mountDashboard(el, store, dvoix) });
    const openDashboard = () => void dvoix.openView("dashboard");
    dvoix.addCommand({ id: "open-dashboard", name: "Open project dashboard", run: openDashboard });
    dvoix.addPanel({ id: "projects", label: "Projects", icon, order: 50, mount: (el) => mountPanel(el, store, dvoix, openDashboard) });

    // A batch of changes is read once it settled; the changed notes are read
    // again even if their size and time look the same.
    let timer;
    dvoix.vault.onChange((paths) => {
      store.invalidate(paths);
      clearTimeout(timer);
      // The app lists new files a moment after it reports them.
      timer = setTimeout(() => void store.load(), 500);
    });
    dvoix.register(() => clearTimeout(timer));
  },

  onunload() {},
};

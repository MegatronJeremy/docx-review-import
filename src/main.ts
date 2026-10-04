import { App, Notice, Plugin, PluginSettingTab, Setting, normalizePath, requestUrl } from "obsidian";
import { convertDocx, type MarkupStyle } from "./convert";
import { linkFor, uniquePath } from "./paths";
import type { TrackedMode } from "./prepass";
import { HOW_TO_GET_PRO_URL } from "./config";
import { verifyLicense, type HttpPost } from "./license";
import { FreeGate, PRO_FEATURE_LABELS, UnlockedGate, type ProGate } from "./pro";

interface Settings {
  licenseKey: string;
  /** Result of the last manual check. Pro stays unlocked offline until the user re-checks. */
  proActive: boolean;
  trackedMode: TrackedMode;
  importComments: boolean;
  markupStyle: MarkupStyle;
  outputFolder: string;
  attachmentsFolder: string;
}

const DEFAULTS: Settings = {
  licenseKey: "",
  proActive: false,
  trackedMode: "mark",
  importComments: true,
  markupStyle: "plain",
  outputFolder: "",
  attachmentsFolder: "attachments",
};

const MAX_BATCH = 100;
const MAX_BYTES = 50 * 1024 * 1024;

/** Adapt Obsidian's requestUrl to the fetch-like shape license.ts expects. */
const obsidianPost: HttpPost = async (url, init) => {
  const r = await requestUrl({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
  return { status: r.status, json: () => Promise.resolve(r.json as unknown) };
};

const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]/g, "-").trim() || "Imported";

/**
 * DOCX Review Import. Free: import one or several .docx files (headings, lists, tables, links, comments, footnotes, images).
 * Pro (licence key from Gumroad): tracked changes marked or resolved.
 * Network: exactly one call to api.gumroad.com when the user presses Verify/Re-check. No telemetry.
 */
export default class DocxReviewImport extends Plugin {
  settings: Settings = { ...DEFAULTS };

  get gate(): ProGate {
    return this.settings.proActive ? new UnlockedGate() : new FreeGate();
  }

  async onload() {
    const saved = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULTS, ...saved };
    this.addSettingTab(new ImportSettingTab(this.app, this));
    this.addCommand({ id: "import-docx", name: "Import a .docx file", callback: () => this.pick(false) });
    this.addCommand({ id: "import-docx-batch", name: "Import several .docx files", callback: () => this.pick(true) });
    this.addRibbonIcon("file-up", "Import a .docx file", () => this.pick(false));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** Open the system file picker (desktop only plugin; no vault access beyond what the user picks). */
  private pick(batch: boolean) {
    const input = createEl("input");
    input.type = "file";
    input.accept = ".docx";
    input.multiple = batch;
    input.onchange = () => {
      const files = Array.from(input.files ?? []).slice(0, batch ? MAX_BATCH : 1);
      if (files.length) void this.importFiles(files);
    };
    input.click();
  }

  private async importFiles(files: File[]) {
    let ok = 0;
    let failed = 0;
    let last = "";
    for (const f of files) {
      try {
        if (f.size > MAX_BYTES) throw new Error("file larger than 50 MB");
        last = await this.importOne(f.name.replace(/\.docx$/i, ""), new Uint8Array(await f.arrayBuffer()));
        ok++;
      } catch (e) {
        failed++;
        console.error("DOCX Review Import:", f.name, e);
      }
    }
    new Notice(files.length === 1 && ok ? `Imported to ${last}` : `Imported ${ok} file(s)${failed ? `, ${failed} failed (see console)` : ""}.`);
  }

  private async ensureFolder(path: string) {
    if (!path || path === "/") return;
    const p = normalizePath(path);
    if (!this.app.vault.getAbstractFileByPath(p)) await this.app.vault.createFolder(p);
  }

  private unique(base: string, ext: string, reserved?: Set<string>): string {
    return uniquePath((p) => !!this.app.vault.getAbstractFileByPath(p), normalizePath(base), ext, reserved);
  }

  private async importOne(name: string, bytes: Uint8Array): Promise<string> {
    const s = this.settings;
    const title = safeName(name);
    const mode: TrackedMode = this.gate.has("trackedChanges") ? s.trackedMode : "accept";
    const att = s.attachmentsFolder.trim();
    // Pick each image's saved path first and link to exactly that path.
    const reserved = new Set<string>();
    const imagePaths = new Map<number, string>();
    const result = await convertDocx(bytes, {
      tracked: mode,
      comments: s.importComments,
      style: s.markupStyle,
      imageLink: (i, ext) => {
        const p = this.unique(`${att ? att + "/" : ""}${title}-image-${i}`, ext, reserved);
        imagePaths.set(i, p);
        return linkFor(p);
      },
    });
    if (result.images.length) await this.ensureFolder(att);
    for (const img of result.images) {
      const p = imagePaths.get(img.index);
      if (!p) continue;
      await this.app.vault.createBinary(p, img.data.buffer.slice(img.data.byteOffset, img.data.byteOffset + img.data.byteLength) as ArrayBuffer);
    }
    await this.ensureFolder(s.outputFolder.trim());
    const out = s.outputFolder.trim();
    const path = this.unique(`${out ? out + "/" : ""}${title}`, "md");
    await this.app.vault.create(path, result.markdown);
    return path;
  }
}

class ImportSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: DocxReviewImport) {
    super(app, plugin);
  }

  display() {
    const { containerEl: el } = this;
    const s = this.plugin.settings;
    el.empty();

    new Setting(el).setName("Import").setHeading();
    new Setting(el).setName("Output folder").setDesc("Vault folder for imported notes. Empty = vault root.").addText((t) =>
      t.setValue(s.outputFolder).onChange((v) => {
        s.outputFolder = v;
        void this.plugin.saveSettings();
      }),
    );
    new Setting(el).setName("Attachments folder").setDesc("Vault folder for extracted images.").addText((t) =>
      t.setValue(s.attachmentsFolder).onChange((v) => {
        s.attachmentsFolder = v;
        void this.plugin.saveSettings();
      }),
    );
    new Setting(el).setName("Import comments").setDesc("Plain style: comments become footnotes named c1, c2 and so on, with author and date. CriticMarkup style: comments follow the text they annotate.").addToggle((t) =>
      t.setValue(s.importComments).onChange((v) => {
        s.importComments = v;
        void this.plugin.saveSettings();
      }),
    );

    new Setting(el)
      .setName("Markup style")
      .setDesc("Plain: footnotes, ==highlight== and ~~strikethrough~~, readable in stock Obsidian. CriticMarkup: marks the Track Changes community plugin can review, accept and reject.")
      .addDropdown((d) =>
        d
          .addOption("plain", "Plain markdown")
          .addOption("critic", "CriticMarkup")
          .setValue(s.markupStyle)
          .onChange((v) => {
            s.markupStyle = v as MarkupStyle;
            void this.plugin.saveSettings();
          }),
      );

    new Setting(el).setName("Pro licence").setHeading();
    el.createEl("p", {
      text:
        "Optional paid upgrade (one-time purchase on Gumroad). Pro unlocks: " +
        Object.values(PRO_FEATURE_LABELS).join("; ") +
        ". Without Pro, tracked changes are accepted silently. Network use: pressing Verify sends your licence key and the product id to api.gumroad.com, once per press. Nothing else is ever sent. No telemetry.",
    });
    el.createEl("p", { text: s.proActive ? "Status: Pro active." : "Status: free version." });
    el.createEl("p").createEl("a", { text: "Get a licence key", href: HOW_TO_GET_PRO_URL });
    let key = s.licenseKey;
    new Setting(el)
      .setName("Licence key")
      .addText((t) => t.setPlaceholder("Paste your key").setValue(key).onChange((v) => (key = v)))
      .addButton((b) =>
        b.setButtonText(s.proActive ? "Re-check" : "Verify").onClick(() => {
          b.setDisabled(true);
          void (async () => {
            const r = await verifyLicense(key, obsidianPost);
            s.proActive = r.status === "valid";
            s.licenseKey = r.status === "valid" || r.status === "refunded" ? key.trim() : s.licenseKey;
            await this.plugin.saveSettings();
            new Notice(r.message);
            this.display();
          })();
        }),
      );

    if (!s.proActive) return;
    new Setting(el).setName("Tracked changes").setDesc("Mark = inserted and deleted text with author and date, in the markup style above. Accept / reject resolve them.").addDropdown((d) =>
      d
        .addOption("mark", "Mark changes")
        .addOption("accept", "Accept all")
        .addOption("reject", "Reject all")
        .setValue(s.trackedMode)
        .onChange((v) => {
          s.trackedMode = v as TrackedMode;
          void this.plugin.saveSettings();
        }),
    );
  }
}

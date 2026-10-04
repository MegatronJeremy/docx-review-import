import esbuild from "esbuild";
import { builtinModules as builtins } from "node:module";
import fs from "node:fs";

// jszip's setImmediate polyfills probe createElement("script") (IE-era fallbacks).
// Obsidian's review rejects script-element creation, so these dead branches are cut (keeping the setTimeout fallback) at build time.
const SCRIPT_PROBES = [
  [/"document"in \w+&&"onreadystatechange"in \w+\.document\.createElement\("script"\)\?function\(\)\{[^]*?\}:(function\(\)\{setTimeout)/g, "$1"],
  [/\w+&&"onreadystatechange"in \w+\.createElement\("script"\)\?\([^]*?\}\):(function\(\w+\)\{setTimeout)/g, "$1"],
];
const noScriptProbe = {
  name: "no-script-probe",
  setup(build) {
    build.onLoad({ filter: /node_modules[\\/]jszip[\\/]dist[\\/]jszip\.min\.js$/ }, (args) => {
      let code = fs.readFileSync(args.path, "utf8");
      for (const [probe, keep] of SCRIPT_PROBES) {
        if (!new RegExp(probe.source).test(code)) throw new Error("setImmediate polyfill pattern not found in jszip; update esbuild.config.mjs: " + probe);
        code = code.replace(probe, keep);
      }
      // also dead: jszip's setImmediate polyfill evaluates a non-function argument (see below)
      if (!/new Function\(""\+\w+\)/.test(code)) throw new Error("new Function pattern not found in jszip; update esbuild.config.mjs");
      code = code.replace(/new Function\(""\+(\w+)\)/, "function(){}");
      return { contents: code, loader: "js" };
    });
  },
};

// No dynamic code execution (the directory review flags eval / new Function). Each site below is dead code in our use
// (underscore's global-object fallback and template(), jszip's setImmediate polyfill for non-function arguments).
// The build fails if a pattern is not found, so a dependency update cannot silently reintroduce one.
const DYNAMIC = [
  [/node_modules[\\/]underscore[\\/]modules[\\/]_setup\.js$/, /Function\('return this'\)\(\)/, "{}"],
  [/node_modules[\\/]underscore[\\/]modules[\\/]template\.js$/, /new Function\(argument, '_', source\)/, '(function () { throw new Error("template() is not available"); })()'],
];
const noDynamicCode = {
  name: "no-dynamic-code",
  setup(build) {
    for (const [filter, pattern, replacement] of DYNAMIC) {
      build.onLoad({ filter }, (args) => {
        const code = fs.readFileSync(args.path, "utf8");
        if (!pattern.test(code)) throw new Error("dynamic-code pattern not found in " + args.path + "; update esbuild.config.mjs");
        return { contents: code.replace(pattern, replacement), loader: "js" };
      });
    }
  },
};

// Third-party licence notices travel inside main.js: Obsidian installs only main.js and manifest.json.
const notices = fs.readFileSync("THIRD-PARTY-NOTICES.md", "utf8").replaceAll("*/", "* /");

const production = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  plugins: [noScriptProbe, noDynamicCode],
  banner: { js: "/*!\n" + notices + "\n*/" },
  external: ["obsidian", "electron", ...builtins],
  format: "cjs",
  target: "es2020",
  platform: "browser",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  minify: false, // Obsidian policy: no obfuscation; keep readable
  treeShaking: true,
  outfile: "main.js",
});

if (production) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}

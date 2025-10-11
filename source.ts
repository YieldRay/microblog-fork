import { glob, readFile, writeFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { Project } from "ts-morph";

/**
 * Determine if a module specifier is a bare package name (e.g. "pkg" or "@scope/pkg").
 * We treat relative paths (./, ../, /) as non-bare and leave them unchanged.
 */
function isBareSpecifier(spec: string): boolean {
  if (spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/"))
    return false;
  if (spec.startsWith("node:")) return false; // Node protocol imports
  if (spec.startsWith("npm:")) return false; // already converted
  // Allow scoped packages like @scope/pkg; disallow subpath like pkg/sub
  // Rule: no "." prefix and no protocol, and not a URL
  const hasProtocol = spec.includes("://");
  if (hasProtocol) return false;
  // Treat any non-relative, non-URL specifier as a package (including subpaths):
  // examples: "pkg", "pkg/sub", "@scope/pkg", "@scope/pkg/sub"
  return true;
}

/**
 * Convert static import declarations in src TS/TSX files under src/ from "pkg" to "npm:pkg".
 */
export async function convertImportsToNpmProtocol(): Promise<number> {
  const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
  // Ensure src files are part of the project (in case tsconfig doesn't include them)
  project.addSourceFilesAtPaths(["src/**/*.ts", "src/**/*.tsx"]);
  const sourceFiles = project.getSourceFiles();
  let changed = 0;
  for (const sf of sourceFiles) {
    let fileChanged = false;
    // Static imports: import ... from "..." and side-effect imports: import "..."
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (isBareSpecifier(spec) && !isBuiltin(spec)) {
        imp.setModuleSpecifier(`npm:${spec}`);
        fileChanged = true;
        changed++;
      }
    }
    if (fileChanged) {
      await sf.save();
    }
  }
  return changed;
}

export async function convertJsxPragmaToNpm(): Promise<number> {
  let changed = 0;
  for await (const filePath of glob("src/**/*.tsx")) {
    const original = await readFile(filePath, "utf8");
    if (!original.includes("/** @jsxImportSource hono/jsx */")) continue;
    const updated = original.replaceAll(
      "/** @jsxImportSource hono/jsx */",
      "/** @jsxImportSource npm:hono/jsx */",
    );
    if (updated === original) continue;
    await writeFile(filePath, updated, "utf8");
    changed++;
  }
  return changed;
}

export async function revertJsxPragmaFromNpm(): Promise<number> {
  let changed = 0;
  for await (const filePath of glob("src/**/*.tsx")) {
    const original = await readFile(filePath, "utf8");
    if (!original.includes("/** @jsxImportSource npm:hono/jsx */")) continue;
    const updated = original.replaceAll(
      "/** @jsxImportSource npm:hono/jsx */",
      "/** @jsxImportSource hono/jsx */",
    );
    if (updated === original) continue;
    await writeFile(filePath, updated, "utf8");
    changed++;
  }
  return changed;
}
/**
 * Revert static import declarations from "npm:pkg" back to "pkg" in src TS/TSX files.
 */
export async function revertImportsFromNpmProtocol(): Promise<number> {
  const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
  project.addSourceFilesAtPaths(["src/**/*.ts", "src/**/*.tsx"]);
  const sourceFiles = project.getSourceFiles();
  let changed = 0;
  for (const sf of sourceFiles) {
    let fileChanged = false;
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (spec.startsWith("npm:")) {
        const reverted = spec.slice("npm:".length);
        imp.setModuleSpecifier(reverted);
        fileChanged = true;
        changed++;
      }
    }
    if (fileChanged) {
      await sf.save();
    }
  }
  return changed;
}

// Simple CLI: `tsx ./source.ts to-npm` or `tsx ./source.ts from-npm`
if (import.meta.main) {
  const mode = process.argv[2] ?? "to-npm";
  (async () => {
    if (mode === "to-npm") {
      const n1 = await convertImportsToNpmProtocol();
      const n2 = await convertJsxPragmaToNpm();
      console.log(
        `Converted ${n1} import specifier(s) and ${n2} JSX pragma(s) to npm: protocol.`,
      );
    } else if (mode === "from-npm") {
      const n1 = await revertImportsFromNpmProtocol();
      const n2 = await revertJsxPragmaFromNpm();
      console.log(
        `Reverted ${n1} import specifier(s) and ${n2} JSX pragma(s) from npm: protocol.`,
      );
    } else {
      console.error("Unknown mode. Use 'to-npm' or 'from-npm'.");
      process.exitCode = 1;
    }
  })();
}

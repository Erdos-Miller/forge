import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const packagesRoot = path.join(repoRoot, "packages");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

interface SourceFile {
  packageName: "core" | "cli" | "web";
  path: string;
  contents: string;
}

interface BoundaryFailure {
  sourcePath: string;
  importPath: string;
  reason: string;
}

describe("package module boundaries", () => {
  test("package source imports follow Forge layering", async () => {
    const sourceFiles = await loadPackageSourceFiles();
    const failures = sourceFiles.flatMap(checkSourceFile);

    expect(failures).toEqual([]);
  });
});

async function loadPackageSourceFiles(): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  for (const packageName of ["core", "cli", "web"] as const) {
    const sourceDir = path.join(packagesRoot, packageName, "src");
    for (const sourcePath of await listSourceFiles(sourceDir)) {
      files.push({
        packageName,
        path: sourcePath,
        contents: await fs.readFile(sourcePath, "utf8"),
      });
    }
  }

  return files;
}

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(entryPath);
      }
      return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return files.flat().sort();
}

function checkSourceFile(sourceFile: SourceFile): BoundaryFailure[] {
  const failures: BoundaryFailure[] = [];

  for (const importPath of findImportPaths(sourceFile.contents)) {
    const reason = getImportBoundaryFailure(sourceFile, importPath);
    if (reason) {
      failures.push({
        sourcePath: path.relative(repoRoot, sourceFile.path),
        importPath,
        reason,
      });
    }
  }

  if (sourceFile.packageName === "core") {
    for (const forbiddenGlobal of ["Bun.", "window.", "document.", "localStorage."]) {
      if (sourceFile.contents.includes(forbiddenGlobal)) {
        failures.push({
          sourcePath: path.relative(repoRoot, sourceFile.path),
          importPath: forbiddenGlobal,
          reason: "core must stay runtime and UI independent",
        });
      }
    }
  }

  return failures;
}

function findImportPaths(contents: string): string[] {
  const imports = new Set<string>();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'()]+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?[^"']+?\s+from\s+["']([^"']+)["']/g,
    /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      imports.add(match[1]);
    }
  }

  return Array.from(imports).sort();
}

function getImportBoundaryFailure(
  sourceFile: SourceFile,
  importPath: string,
): string | null {
  const targetPackage = getTargetPackage(sourceFile, importPath);

  if (sourceFile.packageName === "core") {
    if (targetPackage === "cli" || targetPackage === "web") {
      return "core must not import cli or web";
    }
    if (importPath === "react" || importPath.startsWith("react-dom")) {
      return "core must not import React";
    }
    if (importPath === "vite" || importPath.startsWith("@vitejs/")) {
      return "core must not import Vite";
    }
  }

  if (sourceFile.packageName === "cli" && targetPackage === "web") {
    return "cli must not import web";
  }

  if (sourceFile.packageName === "web" && targetPackage === "cli") {
    return "web must not import cli";
  }

  return null;
}

function getTargetPackage(
  sourceFile: SourceFile,
  importPath: string,
): "core" | "cli" | "web" | null {
  if (importPath === "@forge/core" || importPath.startsWith("@forge/core/")) {
    return "core";
  }
  if (importPath === "@forge/cli" || importPath.startsWith("@forge/cli/")) {
    return "cli";
  }
  if (importPath === "@forge/web" || importPath.startsWith("@forge/web/")) {
    return "web";
  }
  if (!importPath.startsWith(".")) {
    return null;
  }

  const resolvedPath = path.resolve(path.dirname(sourceFile.path), importPath);
  const relativeToPackages = path.relative(packagesRoot, resolvedPath);
  const [packageName] = relativeToPackages.split(path.sep);
  return packageName === "core" || packageName === "cli" || packageName === "web"
    ? packageName
    : null;
}

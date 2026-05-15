import { describe, expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const packagesRoot = path.join(repoRoot, "packages");
const checkedExtensions = new Set([".ts", ".tsx", ".css"]);
const lineBudgets = {
  source: 1000,
  test: 1200,
};
const maxLineLength = 120;

interface CheckedFile {
  path: string;
  relativePath: string;
  contents: string;
  kind: "source" | "test";
}

interface RatchetException {
  reason: string;
  cleanupTaskId: string;
}

interface FileRatchetException {
  lineCount?: RatchetException;
  maxLineLength?: RatchetException;
  compressedFunction?: RatchetException;
  multipleStatements?: RatchetException;
}

type RatchetRule = keyof FileRatchetException;

interface RatchetFailure {
  sourcePath: string;
  rule: RatchetRule;
  message: string;
}

const exceptions: Record<string, FileRatchetException> = {};

describe("source readability ratchet", () => {
  test("package source and test files stay within readability budgets", async () => {
    const files = await loadCheckedFiles();
    const failures = files.flatMap(checkFile);

    expect(failures).toEqual([]);
  });

  test("accepts readable examples", () => {
    expect(
      checkText("packages/example/src/ok.ts", [
        "export function addOne(value: number) {",
        "  return value + 1;",
        "}",
        "",
      ].join("\n")),
    ).toEqual([]);
  });

  test("rejects long lines, compressed functions, and multiple statements", () => {
    const failures = checkText("packages/example/src/bad.ts", [
      `const longLine = "${"x".repeat(maxLineLength)}";`,
      "function compact() { return true; }",
      "const first = 1; const second = 2;",
      "",
    ].join("\n"));

    expect(failures.map((failure) => failure.rule)).toEqual([
      "maxLineLength",
      "compressedFunction",
      "multipleStatements",
    ]);
    expect(failures.every((failure) => failure.message.includes("split by responsibility"))).toBe(true);
    expect(failures.every((failure) => failure.message.includes("reviewed exception"))).toBe(true);
  });

  test("rejects exceptions without a reason and cleanup task id", () => {
    const invalidExceptions: Record<string, FileRatchetException> = {
      "packages/example/src/bad.ts": {
        lineCount: { reason: "", cleanupTaskId: "F-0051" },
        maxLineLength: { reason: "Temporary", cleanupTaskId: "" },
      },
    };

    expect(validateExceptions(invalidExceptions)).toEqual([
      {
        sourcePath: "packages/example/src/bad.ts",
        rule: "lineCount",
        message: "ratchet exception must include a reason and cleanup task id",
      },
      {
        sourcePath: "packages/example/src/bad.ts",
        rule: "maxLineLength",
        message: "ratchet exception must include a reason and cleanup task id",
      },
    ]);
  });
});

async function loadCheckedFiles(): Promise<CheckedFile[]> {
  const files: CheckedFile[] = [];
  for (const sourcePath of await listCheckedFiles(packagesRoot)) {
    const relativePath = path.relative(repoRoot, sourcePath);
    files.push({
      path: sourcePath,
      relativePath,
      contents: await fs.readFile(sourcePath, "utf8"),
      kind: relativePath.includes("/test/") ? "test" : "source",
    });
  }
  return files;
}

async function listCheckedFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") {
          return [];
        }
        return listCheckedFiles(entryPath);
      }
      return checkedExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );

  return files.flat().sort();
}

function checkFile(file: CheckedFile): RatchetFailure[] {
  return [
    ...validateExceptions({ [file.relativePath]: exceptions[file.relativePath] ?? {} }),
    ...checkText(file.relativePath, file.contents, file.kind, exceptions[file.relativePath]),
  ];
}

function checkText(
  sourcePath: string,
  contents: string,
  kind: "source" | "test" = "source",
  fileExceptions: FileRatchetException = {},
): RatchetFailure[] {
  const failures: RatchetFailure[] = [];
  const lines = contents.split(/\r?\n/);
  const nonBlankLineCount = lines.filter((line) => line.trim()).length;
  const budget = lineBudgets[kind];

  if (nonBlankLineCount > budget && !hasException(fileExceptions, "lineCount")) {
    failures.push(
      failure(
        sourcePath,
        "lineCount",
        `${nonBlankLineCount} nonblank lines exceeds ${kind} budget ${budget}`,
      ),
    );
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (line.length > maxLineLength && !hasException(fileExceptions, "maxLineLength")) {
      failures.push(
        failure(
          sourcePath,
          "maxLineLength",
          `line ${lineNumber} has ${line.length} characters; max is ${maxLineLength}`,
        ),
      );
    }
    if (hasCompressedFunctionBody(line) && !hasException(fileExceptions, "compressedFunction")) {
      failures.push(
        failure(sourcePath, "compressedFunction", `line ${lineNumber} has a one-line function body`),
      );
    }
    if (hasMultipleExecutableStatements(line) && !hasException(fileExceptions, "multipleStatements")) {
      failures.push(
        failure(sourcePath, "multipleStatements", `line ${lineNumber} has multiple statements`),
      );
    }
  });

  return failures;
}

function validateExceptions(
  fileExceptions: Record<string, FileRatchetException>,
): RatchetFailure[] {
  const failures: RatchetFailure[] = [];
  for (const [sourcePath, exceptionByRule] of Object.entries(fileExceptions)) {
    for (const [rule, exception] of Object.entries(exceptionByRule) as Array<[RatchetRule, RatchetException]>) {
      if (!exception.reason.trim() || !/^F-\d+$/.test(exception.cleanupTaskId)) {
        failures.push({
          sourcePath,
          rule,
          message: "ratchet exception must include a reason and cleanup task id",
        });
      }
    }
  }
  return failures;
}

function hasException(
  fileExceptions: FileRatchetException,
  rule: RatchetRule,
): boolean {
  const exception = fileExceptions[rule];
  return Boolean(exception?.reason.trim() && /^F-\d+$/.test(exception.cleanupTaskId));
}

function hasCompressedFunctionBody(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.endsWith("}")) {
    return false;
  }
  return (
    /\bfunction\b[^{]*\{\s*(return|const|let|var|if|for|while|await)\b/.test(trimmed) ||
    /=>\s*\{\s*(return|const|let|var|if|for|while|await)\b/.test(trimmed)
  );
}

function hasMultipleExecutableStatements(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ")) {
    return false;
  }
  if (/^for\s*\(/.test(trimmed) || /\btype\b|\binterface\b/.test(trimmed)) {
    return false;
  }
  return /;\s*(const|let|var|return|if|for|while|await)\b/.test(stripStringLiterals(trimmed));
}

function stripStringLiterals(value: string): string {
  return value.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, "\"\"");
}

function failure(
  sourcePath: string,
  rule: RatchetRule,
  detail: string,
): RatchetFailure {
  return {
    sourcePath,
    rule,
    message: `${detail}; split by responsibility or add a reviewed exception with a reason and cleanup task id`,
  };
}

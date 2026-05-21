import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export const PERSONAL_GUIDANCE_RELATIVE_PATH = [".config", "forge", "guidance.md"];
export const PERSONAL_GUIDANCE_DISPLAY_PATH = "~/.config/forge/guidance.md";

export async function readPersonalGuidance(env: Record<string, string | undefined>) {
  const filePath = getPersonalGuidancePath(env);
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return {
      exists: true,
      path: filePath,
      contents,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        exists: false,
        path: filePath,
        contents: "",
      };
    }
    throw error;
  }
}

export function formatPersonalGuidancePrompt(contents: string): string {
  const trimmed = contents.trim();
  if (!trimmed) {
    return "";
  }
  return ["Personal user guidance:", trimmed].join("\n");
}

function getPersonalGuidancePath(env: Record<string, string | undefined>) {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  return path.join(home, ...PERSONAL_GUIDANCE_RELATIVE_PATH);
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

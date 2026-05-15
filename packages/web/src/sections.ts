export type CanonicalSectionKey =
  | "why"
  | "success"
  | "acceptance"
  | "dependencies"
  | "verification"
  | "notes"
  | "history";

export interface MarkdownSection {
  title: string;
  body: string;
  index: number;
}

export interface OrganizedTaskSections {
  why?: MarkdownSection;
  success?: MarkdownSection;
  acceptance?: MarkdownSection;
  dependencies?: MarkdownSection;
  verification?: MarkdownSection;
  notes: MarkdownSection[];
  implementationNotes: MarkdownSection[];
  history: MarkdownSection[];
  additional: MarkdownSection[];
  fallbackBody: string;
}

const implementationNoteTitles = new Set([
  "adr docs impact",
  "adr / docs impact",
  "boundary contract",
  "capability impact",
  "compatibility impact",
  "evidence",
  "harness evidence",
  "labels",
  "out of scope",
  "steps to reproduce",
]);

export function organizeTaskMarkdown(body: string): OrganizedTaskSections {
  const sections = parseMarkdownSections(body);
  const used = new Set<number>();

  const why = selectSection(sections, used, ["why", "problem", "context"]);
  const success = selectSection(sections, used, ["what success looks like", "goal", "outcome"]);
  const acceptance = selectSection(sections, used, ["acceptance criteria", "acceptance"]);
  const dependencies = selectSection(sections, used, ["dependencies", "dependency"]);
  const verification = selectSection(sections, used, ["verification", "verify"]);
  const notes = selectAllSections(sections, used, ["notes", "implementation notes"]);
  const history = selectAllSections(sections, used, ["history", "recent notes"]);
  const implementationNotes = sections.filter((section) => {
    if (used.has(section.index)) {
      return false;
    }
    if (!implementationNoteTitles.has(normalizeTitle(section.title))) {
      return false;
    }
    used.add(section.index);
    return true;
  });
  const additional = sections.filter((section) => !used.has(section.index));

  return {
    why,
    success,
    acceptance,
    dependencies,
    verification,
    notes,
    implementationNotes,
    history,
    additional,
    fallbackBody: sections.length === 0 ? stripLeadingTitle(body).trim() : "",
  };
}

export function parseMarkdownSections(body: string): MarkdownSection[] {
  const lines = stripLeadingTitle(body).split("\n");
  const sections: MarkdownSection[] = [];
  let current: { title: string; lines: string[]; index: number } | null = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      if (current && current.lines.join("\n").trim()) {
        sections.push({
          title: current.title,
          body: current.lines.join("\n").trim(),
          index: current.index,
        });
      }
      current = { title: heading[1].trim(), lines: [], index: sections.length };
      continue;
    }

    current?.lines.push(line);
  }

  if (current && current.lines.join("\n").trim()) {
    sections.push({
      title: current.title,
      body: current.lines.join("\n").trim(),
      index: current.index,
    });
  }

  return sections;
}

function selectSection(
  sections: MarkdownSection[],
  used: Set<number>,
  titles: string[],
): MarkdownSection | undefined {
  const section = sections.find((candidate) => {
    return !used.has(candidate.index) && titles.includes(normalizeTitle(candidate.title));
  });
  if (section) {
    used.add(section.index);
  }
  return section;
}

function selectAllSections(
  sections: MarkdownSection[],
  used: Set<number>,
  titles: string[],
): MarkdownSection[] {
  return sections.filter((section) => {
    if (used.has(section.index) || !titles.includes(normalizeTitle(section.title))) {
      return false;
    }
    used.add(section.index);
    return true;
  });
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingTitle(body: string) {
  return body.replace(/^\s*# .*(?:\r?\n){1,2}/, "");
}

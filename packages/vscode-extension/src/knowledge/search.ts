import { readAsset, listAssetFiles } from '../util/assets';
import { SKILLS } from './agentFiles';

export interface DocSection {
  heading: string;
  /** Heading trail, e.g. "Events Reference > select", prefixed by the source file for skill references. */
  trail: string;
  /** Ancestor headings only, without the source file. */
  parents: string;
  body: string;
}

let sectionCache: DocSection[] | undefined;
let apiCache: ApiReference | undefined;

interface ApiEndpoint {
  method: string;
  path: string;
  summary?: string;
}

/**
 * Generated in ft-skill by scripts/build-api-reference.py from the
 * develop-fieldtwin-integration catalog: routes only, grouped by resource,
 * plus the conventions every call has to follow.
 */
interface ApiReference {
  apiVersion: string;
  operationCount: number;
  conventions: Record<string, string>;
  groups: Record<string, ApiEndpoint[]>;
}

/** Split a markdown document on headings, keeping the trail. */
function split(text: string, source?: string): DocSection[] {
  const out: DocSection[] = [];
  const stack: string[] = [];
  let current: DocSection | undefined;
  let inFence = false;

  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;

    const match = !inFence ? /^(#{1,4})\s+(.*)$/.exec(line) : null;
    if (match) {
      if (current) out.push(current);
      const level = match[1].length;
      const heading = match[2].trim();
      stack.length = level - 1;
      stack[level - 1] = heading;
      const trail = stack.filter(Boolean).join(' > ');
      const parents = stack.slice(0, -1).filter(Boolean).join(' > ');
      current = { heading, trail: source ? `${source} > ${trail}` : trail, parents, body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) out.push(current);
  return out.filter((s) => s.body.trim().length > 0);
}

/**
 * The single-file guide first, then the Agent Skills' references, which
 * hold the exhaustive message catalog, Operation Mode, batch writes and
 * the testing guidance the guide only summarises.
 */
async function sections(): Promise<DocSection[]> {
  if (sectionCache) return sectionCache;

  const out = split(await readAsset('knowledge', 'fieldtwin-instructions.md'));
  for (const skill of SKILLS) {
    for (const rel of await listAssetFiles('skills', skill)) {
      if (!rel.startsWith('references/') || !rel.endsWith('.md')) continue;
      const text = await readAsset('skills', skill, ...rel.split('/'));
      out.push(...split(text, `${skill}/${rel}`));
    }
  }

  sectionCache = out;
  return sectionCache;
}

async function apiReference(): Promise<ApiReference> {
  if (!apiCache) apiCache = JSON.parse(await readAsset('knowledge', 'api-reference.json'));
  return apiCache!;
}

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1);
}

/**
 * Keyword scoring, deliberately simple: a hit in the section's own heading is
 * worth far more than one in a parent heading or the body, so
 * "visualFilterToggle" lands on its own section rather than on every code
 * sample that mentions it, and a file's title does not lift all its sections.
 */
export async function searchDocs(query: string, limit = 4): Promise<DocSection[]> {
  const all = await sections();
  const words = terms(query);
  if (words.length === 0) return all.slice(0, limit);

  const scored = all.map((section) => {
    const heading = section.heading.toLowerCase();
    const parents = section.parents.toLowerCase();
    const body = section.body.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (heading.includes(word)) score += 10;
      else if (parents.includes(word)) score += 2;
      const hits = body.split(word).length - 1;
      score += Math.min(hits, 5);
    }
    return { section, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.section);
}

export function renderSections(found: DocSection[]): string {
  if (found.length === 0) {
    return 'No matching section found in the FieldTwin documentation.';
  }
  return found
    .map((s) => `## ${s.trail}\n\n${s.body.trim()}`)
    .join('\n\n---\n\n');
}

export async function lookupApi(resource: string, limit = 25): Promise<string> {
  const ref = await apiReference();
  const words = terms(resource);
  const matches: string[] = [];

  for (const [group, endpoints] of Object.entries(ref.groups)) {
    const hits = endpoints.filter((e) => {
      const hay = `${group} ${e.path} ${e.summary ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (hits.length === 0) continue;

    const lines = hits.map(
      (e) => `- \`${e.method.padEnd(6)} ${e.path}\`${e.summary ? ` — ${e.summary}` : ''}`,
    );
    matches.push(`### ${group}\n${lines.join('\n')}`);
    if (matches.length >= limit) break;
  }

  if (matches.length === 0) {
    const names = Object.keys(ref.groups).join(', ');
    return `No endpoint matched "${resource}". Available groups: ${names}.`;
  }

  // The rules that make a route usable: root, scoping, auth, and any
  // convention the query itself touches (e.g. "metadata", "batch").
  const always = ['root', 'subprojectRoot', 'qualifiedSubProjectId', 'encoding', 'authentication'];
  const notes = Object.entries(ref.conventions)
    .filter(([key]) => always.includes(key) || words.some((w) => key.toLowerCase().includes(w)))
    .map(([key, text]) => `- **${key}**: ${text}`);

  return `${matches.join('\n\n')}\n\n### Conventions (API ${ref.apiVersion})\n${notes.join('\n')}`;
}

/** Used by the chat participant to ground every answer. */
export async function coreContext(): Promise<string> {
  return readAsset('knowledge', 'api-quick-reference.md');
}

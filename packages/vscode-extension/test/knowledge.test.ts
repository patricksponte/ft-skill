import { initAssets } from '../src/util/assets';
import { searchDocs, renderSections, lookupApi } from '../src/knowledge/search';

(async () => {
  initAssets({ extensionUri: { fsPath: process.cwd() } } as never);

  const checks: Array<[string, boolean, string]> = [];
  const ok = (name: string, cond: boolean, note = '') => checks.push([name, cond, note]);

  // ── searchDocs ──
  const filter = await searchDocs('visualFilterToggle');
  ok('searchDocs finds visualFilterToggle',
     filter.some(s => s.body.includes('visualFilterToggle')),
     filter.map(s => s.trail).join(' | '));

  const auth = await searchDocs('API calls fail 401');
  ok('searchDocs finds the 401 guidance',
     auth.some(s => s.body.includes('401')),
     auth.map(s => s.trail).join(' | '));

  const notLoaded = await searchDocs('never receives loaded');
  ok('searchDocs finds the loaded troubleshooting section',
     notLoaded.some(s => s.trail.includes('never receives')),
     notLoaded.map(s => s.trail).join(' | '));

  const bridge = await searchDocs('secure bridge');
  ok('the guide ranks ahead of the skill references for its own headings',
     bridge[0]?.trail.startsWith('FieldTwin Integration Guide'), bridge.map(s => s.trail).join(' | '));

  ok('sections keep their heading trail',
     filter.every(s => s.trail.length > 0 && s.body.trim().length > 0));

  ok('renderSections emits markdown headings',
     renderSections(filter).startsWith('## '));

  ok('renderSections handles no match',
     renderSections([]).includes('No matching section'));

  // Code fences must not be mistaken for headings.
  const all = await searchDocs('', 5000);
  ok('no section heading came from inside a code fence',
     !all.some(s => /^\s*(bash|javascript|json|python)\s*$/i.test(s.heading)),
     all.filter(s => /^(bash|javascript|json)$/i.test(s.heading)).map(s=>s.heading).join(','));

  const fromGuide = all.filter(s => !s.trail.includes('/references/'));
  const fromSkills = all.filter(s => s.trail.includes('/references/'));
  ok('parsed the single-file guide', fromGuide.length > 25 && fromGuide.length < 200, String(fromGuide.length));
  ok('indexed the Agent Skills references', fromSkills.length > 100, String(fromSkills.length));
  ok('skill sections name their source file',
     fromSkills.some(s => s.trail.startsWith('develop-fieldtwin-integration/references/message-catalog.md > ')));

  const operation = await searchDocs('operationSearchAction resultId');
  ok('searchDocs reaches Operation Mode in the skill references',
     operation.some(s => s.trail.includes('operation-mode.md')), operation.map(s => s.trail).join(' | '));

  // ── lookupApi ──
  const wells = await lookupApi('wells');
  ok('lookupApi finds well endpoints', wells.includes('/wells'), wells.slice(0, 80));
  ok('lookupApi shows full v1.10 paths', wells.includes('/API/v1.10/'), wells.slice(0, 200));
  ok('lookupApi includes the authentication convention', wells.includes('**authentication**'));
  ok('lookupApi explains the qualified subproject ID', wells.includes('subProjectId}:{streamId}'));

  const staged = await lookupApi('stagedAssets');
  ok('lookupApi finds stagedAssets', staged.includes('stagedAssets'));

  const missing = await lookupApi('zzzznotathing');
  ok('lookupApi reports no match with groups', missing.includes('No endpoint matched') && missing.includes('StagedAssets'),
     missing.slice(0,120));

  const meta = await lookupApi('metadata');
  ok('lookupApi is case-insensitive', meta.includes('metadatadefinitions'), meta.slice(0, 200));
  ok('lookupApi adds the convention the query touches', meta.includes('**metadata**: There is no per-resource'));

  const batch = await lookupApi('batch');
  ok('lookupApi surfaces the batch convention', batch.includes('**batch**'));

  let failed = 0;
  for (const [name, pass, note] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass || !note ? '' : `\n        ${note}`}`);
    if (!pass) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
})();

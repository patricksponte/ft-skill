import * as vscode from 'vscode';
import { searchDocs, renderSections, lookupApi } from '../knowledge/search';

class SearchDocsTool implements vscode.LanguageModelTool<{ query: string }> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{ query: string }>,
  ): Promise<vscode.LanguageModelToolResult> {
    const found = await searchDocs(options.input.query);
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(renderSections(found)),
    ]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<{ query: string }>,
  ): vscode.PreparedToolInvocation {
    return { invocationMessage: `Searching FieldTwin docs for “${options.input.query}”` };
  }
}

class LookupApiTool implements vscode.LanguageModelTool<{ resource: string }> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<{ resource: string }>,
  ): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(await lookupApi(options.input.resource)),
    ]);
  }

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<{ resource: string }>,
  ): vscode.PreparedToolInvocation {
    return { invocationMessage: `Looking up FieldTwin API for “${options.input.resource}”` };
  }
}

export function registerTools(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.lm.registerTool('fieldtwin_search_docs', new SearchDocsTool()),
    vscode.lm.registerTool('fieldtwin_lookup_api', new LookupApiTool()),
  );
}

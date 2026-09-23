import * as vscode from 'vscode';
import { searchDocs, renderSections, lookupApi, coreContext } from '../knowledge/search';
import { log } from '../util/log';

const SYSTEM = `You are the FieldTwin integration assistant, part of the FieldTwin Integration Kit for VS Code.

A FieldTwin integration is a web application shown in an iframe inside the FieldTwin
digital twin platform. It talks to the host with window.postMessage and to the backend
with the FieldTwin REST API.

Rules you always follow:
- Ground every answer in the reference material provided below. If the reference does
  not cover something, say so plainly instead of inventing an event, message or endpoint.
- Accept 'loaded' only from an exact allowlisted FieldTwin origin and the real host
  window (window.parent in an iframe, window.opener in a pop-out), then pin both. Send
  only to that pinned window and origin. Never use '*' as the target origin.
- Register the message listener in the first <script> in <head>, before 'loaded' arrives.
- Keep the JWT in memory only and replace it on 'tokenRefresh'. Never put it in URLs,
  storage, the DOM or logs. Account API tokens belong on servers, never in browser code.
- Never invent API paths. Build them from the trusted loaded fields:
  {backendUrl}/API/{APIVersion}/{projectId}/subProject/{subProject}/{resource}.
  loaded.subProject is already qualified as subProjectId:streamId — do not split it, and
  encodeURIComponent every path segment. There is no 'project/-' wildcard.
- Wait for APIServerIsReady, or for 'apiPodIsReady', before calling subproject routes.
- Collection shapes vary by endpoint (maps keyed by ID, arrays or wrappers), and a
  successful PATCH/DELETE can have an empty body. Parse by status and Content-Type.
- The integration JWT uses 'Authorization: Bearer <token>'; a server-side API token uses
  the 'token' header. Never send both on the same request.
- Write complete, runnable code, not fragments with "// ..." placeholders.`;

type Handler = vscode.ChatRequestHandler;

const handler: Handler = async (request, context, stream, token) => {
  try {
    if (request.command === 'new') {
      stream.markdown(
        'The scaffolder creates the project folder, the Hello World integration and the ' +
          'agent context files for the AI tools you pick.\n\n',
      );
      stream.button({
        command: 'fieldtwin.newIntegration',
        title: 'Create a FieldTwin integration',
      });
      return {};
    }

    stream.progress('Reading the FieldTwin reference…');

    // Ground the model in the sections that actually match the question,
    // plus the cheat sheet, rather than dumping 1000 lines into every turn.
    const grounding = await buildGrounding(request);

    const messages = [
      vscode.LanguageModelChatMessage.User(SYSTEM),
      vscode.LanguageModelChatMessage.User(`# FieldTwin reference\n\n${grounding}`),
      ...previousTurns(context),
      vscode.LanguageModelChatMessage.User(request.prompt || 'Explain how to get started.'),
    ];

    const response = await request.model.sendRequest(messages, {}, token);
    for await (const fragment of response.text) {
      stream.markdown(fragment);
    }

    stream.button({
      command: 'fieldtwin.preview',
      title: 'Test it in the FieldTwin simulator',
    });
    return {};
  } catch (err) {
    if (err instanceof vscode.LanguageModelError) {
      log.error(`chat: ${err.code} ${err.message}`);
      stream.markdown(`\n\nThe language model refused this request (${err.code}).`);
      return { errorDetails: { message: err.message } };
    }
    throw err;
  }
};

async function buildGrounding(request: vscode.ChatRequest): Promise<string> {
  const parts: string[] = [await coreContext()];

  if (request.command === 'api') {
    parts.push(await lookupApi(request.prompt));
  } else if (request.command === 'events') {
    parts.push(renderSections(await searchDocs('events FieldTwin integration messages host loaded select', 8)));
  } else if (request.command === 'debug') {
    parts.push(renderSections(await searchDocs('troubleshooting never receives loaded API calls fail nothing happens', 6)));
  }

  if (request.prompt.trim()) {
    parts.push(renderSections(await searchDocs(request.prompt, 4)));
  }

  return parts.join('\n\n---\n\n');
}

function previousTurns(context: vscode.ChatContext): vscode.LanguageModelChatMessage[] {
  const messages: vscode.LanguageModelChatMessage[] = [];
  // Only the last few turns — the grounding block is already large.
  for (const turn of context.history.slice(-6)) {
    if (turn instanceof vscode.ChatRequestTurn) {
      messages.push(vscode.LanguageModelChatMessage.User(turn.prompt));
    } else if (turn instanceof vscode.ChatResponseTurn) {
      const text = turn.response
        .filter((r): r is vscode.ChatResponseMarkdownPart => 'value' in r)
        .map((r) => r.value.value)
        .join('');
      if (text) messages.push(vscode.LanguageModelChatMessage.Assistant(text));
    }
  }
  return messages;
}

export function registerParticipant(context: vscode.ExtensionContext): void {
  const participant = vscode.chat.createChatParticipant('fieldtwin.agent', handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'icon.png');
  participant.followupProvider = {
    provideFollowups: () => [
      { prompt: 'Show me how to react to asset selection in the 3D view', label: 'React to selection' },
      { prompt: 'List every staged asset in the current subproject and render it as a table', label: 'List assets' },
      { prompt: 'My integration never receives the loaded event', label: 'Debug connection' },
    ],
  };
  context.subscriptions.push(participant);
}

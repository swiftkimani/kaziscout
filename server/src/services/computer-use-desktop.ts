import type { ComputerUseClient, ToolResult } from '@zavora-ai/computer-use-mcp/client';
import { UpstreamError } from '../errors.js';
import type { DesktopAssistant } from './apply.js';

function assertOk(result: ToolResult, action: string): void {
  if (!result.isError) return;
  const reason = result.content.find((block) => block.type === 'text')?.text ?? 'unknown error';
  throw new UpstreamError(`The desktop refused to ${action}.`, { reason });
}

/**
 * Desktop access through computer-use-mcp (https://github.com/zavora-ai/computer-use-mcp),
 * running in-process. The native module is loaded on first use so the server starts without it.
 */
export class ComputerUseDesktop implements DesktopAssistant {
  private client: Promise<ComputerUseClient> | undefined;

  private connect(): Promise<ComputerUseClient> {
    this.client ??= (async () => {
      const [{ createComputerUseServer }, { connectInProcess }] = await Promise.all([
        import('@zavora-ai/computer-use-mcp'),
        import('@zavora-ai/computer-use-mcp/client'),
      ]);
      return connectInProcess(createComputerUseServer());
    })();
    return this.client;
  }

  async copyToClipboard(text: string): Promise<void> {
    const client = await this.connect();
    assertOk(await client.writeClipboard(text), 'write to the clipboard');
  }

  async close(): Promise<void> {
    if (!this.client) return;
    const client = await this.client;
    this.client = undefined;
    await client.close();
  }
}

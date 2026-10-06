import type { Board } from '../boards/registry.js';
import type { FetchText } from './http.js';

/** A posting as a board publishes it, before KaziScout normalises and stores it. */
export interface RawJob {
  externalId: string;
  title: string;
  company?: string;
  location?: string;
  url: string;
  /** Body as the board supplies it; HTML or plain text. */
  bodyHtml: string;
  postedAt?: Date;
  /** When applications close, if the source states it. */
  closesAt?: Date;
  isRemote: boolean;
}

export interface ProviderContext {
  fetchText: FetchText;
  /** Clock for sources that publish relative dates such as "Posted 3 Days Ago". */
  now?: () => Date;
}

/** Reads the current postings from one board. Implementations make no more than one request. */
export type Provider = (board: Board, context: ProviderContext) => Promise<RawJob[]>;

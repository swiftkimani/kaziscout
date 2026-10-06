import type { Board } from '../boards/registry.js';
import {
  ashbyProvider,
  greenhouseProvider,
  leverProvider,
  recruiteeProvider,
  smartRecruitersProvider,
  workableProvider,
  workdayProvider,
} from './ats.js';
import { himalayasProvider, remoteOkProvider, remotiveProvider } from './remote-apis.js';
import { rssProvider } from './rss.js';
import type { Provider } from './types.js';

const API_PROVIDERS: Readonly<Record<string, Provider>> = {
  remotive: remotiveProvider,
  himalayas: himalayasProvider,
  remoteok: remoteOkProvider,
};

const ATS_PROVIDERS: Readonly<Record<string, Provider>> = {
  greenhouse: greenhouseProvider,
  lever: leverProvider,
  ashby: ashbyProvider,
  smartrecruiters: smartRecruitersProvider,
  workable: workableProvider,
  recruitee: recruiteeProvider,
};

/** Picks the provider that can read a board, or undefined for link-out boards. */
export function providerFor(board: Board): Provider | undefined {
  if (board.access.type === 'rss') return rssProvider;
  if (board.access.type === 'api') return API_PROVIDERS[board.access.provider];
  if (board.access.type === 'ats') return ATS_PROVIDERS[board.access.provider];
  if (board.access.type === 'workday') return workdayProvider;
  return undefined;
}

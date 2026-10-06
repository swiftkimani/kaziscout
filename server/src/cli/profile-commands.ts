import { readFileSync } from 'node:fs';
import { CliError, type CliValues, type Command, splitList } from './context.js';

interface ApiProfile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  cvText: string;
  skills: string[];
  targetTitles: string[];
  countries: string[];
  isRemoteOk: boolean;
}

const EMPTY_PROFILE: ApiProfile = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  cvText: '',
  skills: [],
  targetTitles: [],
  countries: [],
  isRemoteOk: true,
};

function readCvFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new CliError(`Couldn't read the CV file at ${path}.`);
  }
}

/** The profile fields named on the command line; fields not mentioned are left as they are. */
function changesFrom(values: CliValues): Partial<ApiProfile> {
  return {
    ...(values.name !== undefined && { fullName: values.name }),
    ...(values.headline !== undefined && { headline: values.headline }),
    ...(values.email !== undefined && { email: values.email }),
    ...(values.phone !== undefined && { phone: values.phone }),
    ...(values.roles !== undefined && { targetTitles: splitList(values.roles) }),
    ...(values.skills !== undefined && { skills: splitList(values.skills) }),
    ...(values.countries !== undefined && { countries: splitList(values.countries) }),
    ...(values['onsite-only'] !== undefined && { isRemoteOk: !values['onsite-only'] }),
    ...(values['cv-file'] !== undefined && { cvText: readCvFile(values['cv-file']) }),
  };
}

export const profile: Command = async ({ io, values, call }) => {
  let { data } = await call<{ data: ApiProfile | null }>('GET', '/v1/profile');
  const changes = changesFrom(values);
  if (Object.keys(changes).length > 0) {
    const saved = await call<{ data: ApiProfile; rescored: number }>('PUT', '/v1/profile', {
      ...EMPTY_PROFILE,
      ...data,
      ...changes,
    });
    data = saved.data;
    io.out(`Profile saved. ${saved.rescored} jobs re-scored.\n`);
  }
  if (!data) {
    io.out(
      'No profile yet. Create one with: ./kazi profile --name "Your Name" --roles "Job Title" --skills "A,B" --countries KE',
    );
    return;
  }
  const remote = data.isRemoteOk ? ' · open to remote' : '';
  const cv = data.cvText
    ? `${data.cvText.length.toLocaleString('en')} characters stored`
    : 'none; add one with --cv-file <path>';
  io.out(`${data.fullName}${data.headline ? ` — ${data.headline}` : ''}`);
  io.out(`Contact:   ${[data.email, data.phone].filter(Boolean).join(' · ') || 'none given'}`);
  io.out(`Roles:     ${data.targetTitles.join(', ') || 'none'}`);
  io.out(`Skills:    ${data.skills.join(', ') || 'none'}`);
  io.out(`Countries: ${data.countries.join(', ') || 'none'}${remote}`);
  io.out(`CV:        ${cv}`);
  if (values['show-cv'] && data.cvText) io.out(`\n${data.cvText}`);
};

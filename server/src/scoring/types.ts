export interface Profile {
  fullName: string;
  headline: string;
  cvText: string;
  skills: string[];
  targetTitles: string[];
  /** ISO codes of countries the person can work in. */
  countries: string[];
  isRemoteOk: boolean;
}

/** The parts of a job that scoring looks at. */
export interface ScorableJob {
  title: string;
  company?: string;
  location?: string;
  countryCode?: string;
  isRemote: boolean;
  /** Plain-text or Markdown body of the posting. */
  body: string;
  listedAt: Date;
}

export interface Evaluation {
  /** 1.0 (poor fit) to 5.0 (excellent fit), one decimal place. */
  score: number;
  evaluator: 'heuristic' | 'claude';
  /** One sentence the UI shows under the score. */
  verdict: string;
  strengths: string[];
  gaps: string[];
  matchedSkills: string[];
  /** A short tailored introduction for the application; only the Claude evaluator writes one. */
  pitch?: string;
}

export interface JobEvaluator {
  evaluate(job: ScorableJob, profile: Profile): Promise<Evaluation>;
}

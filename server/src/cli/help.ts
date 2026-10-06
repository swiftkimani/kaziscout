export const HELP = `KaziScout in the terminal

Usage: ./kazi <command> [options]

  today                  What needs you today: new matches, closing soon, follow-ups
  gaps                   Skills most often asked for in jobs you nearly match
  scan [board-id]        Scan every source, or one board
  jobs                   List jobs, best fit first
      --search <text>    Match title or company
      --country <code>   Two-letter country code, for example KE
      --remote           Remote roles only
      --min <score>      Lowest score to show, 1 to 5
      --newest           Sort by date instead of fit
      --limit <n>        How many to show (default 15)
  add <url>              Add a job from its posting link, and score it
  show <job-id>          One job: fit, reasons, link, description
  assess <job-id>        Save an assessment (for AI coding tools; see skills/kaziscout)
      --score <1-5>      --verdict <text>    --model <name>
      --strengths <a|b>  --gaps <a|b>        --matched <a,b>     --pitch <text>
  pack <job-id>          The application pack for a job
  track <job-id>         Save a job to the tracker
  tracker                What you are tracking, by status
  hide <job-id>          Dismiss a job so it leaves your lists (unhide <job-id> restores it)
  follow <job-link>      Follow the employer behind a job link (Greenhouse, Lever, Ashby,
                         Workable, SmartRecruiters, Workday, Recruitee, Teamtailor)
  unfollow <source-id>   Stop following an employer
  find-feed <board-url>  Look for a public feed on a job board (for adding boards)
  boards                 Sources and their status
      --scanned          Only the ones scanned automatically
  md <url>               Convert a web page to Markdown
  cv <file>              Set up your profile from your CV (PDF, Word, text or Markdown),
                         then answer a few follow-up questions
  profile                Show the saved profile, or change it with any of:
      --name <text>      --headline <text>   --email <address>   --phone <number>
      --roles <a,b>      Job titles you want, comma separated
      --skills <a,b>     Skills, comma separated
      --countries <a,b>  Country codes you can work in, for example KE,UG
      --onsite-only      Not open to remote work
      --cv-file <path>   Load your CV from a text or Markdown file
      --show-cv          Print the stored CV too
  help                   Show this help

Run the web app with: pnpm start`;

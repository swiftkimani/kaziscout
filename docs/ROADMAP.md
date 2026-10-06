# Roadmap: ideas for later

_Written 2026-10-06. Nothing here is built. It is a list to choose from, not a promise._

Each idea says what it is, why it would matter, and roughly how big it is: **S** is a day or
less, **M** is a few days, **L** is a week or more. Ideas marked ★ are the ones worth doing first:
high value for the effort, and they build on code that already exists.

## Automation

### Less work after each scan

|     | Idea                                                                                                                                                                                                                                                                     | Why                                                                                    | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---- |
| ★   | **Fetch the full posting automatically for strong matches.** Workday and SmartRecruiters jobs arrive with no description, so they are scored on the title alone. After a scan, fetch the page for any job scoring 3.5 or more that has no description, then re-score it. | Today those jobs are under-scored until someone presses "Fetch full posting".          | S    |
| ★   | **Two-stage assessment.** When an AI model is connected, assess only the jobs the keyword score already rates 4 or more, up to a daily cap the person sets.                                                                                                              | Gets real judgement on the handful of jobs that matter without paying to assess 3,000. | S    |
| ★   | **Merge duplicates across sources.** The same role often appears on two boards (seen: one Shopify role on both Remote OK and Remotive). Group by normalised title and company, show one card with "also on …".                                                           | Cleaner list, and applying twice by mistake is avoided.                                | M    |
|     | **Closing dates.** Read the deadline when a source gives one (Greenhouse `application_deadline`, "Expiry Date" in Zimbabwean feeds, "Closing Date" in posting text) and store it.                                                                                        | Enables "closing soon" and deadline reminders below.                                   | M    |
|     | **Retire dead postings.** A job missing from its feed for several scans, or whose page now returns 404, is marked closed and drops out of the default list.                                                                                                              | The list stops filling with jobs nobody can apply to.                                  | M    |
|     | **Legitimacy flags.** Warn on postings that ask applicants for a fee, give only a free-mail contact, or have no named employer.                                                                                                                                          | Fee-charging job scams are common; a warning protects the people this is built for.    | M    |

### Reminders and follow-through

|     | Idea                                                                                                                                                                                   | Why                                                                                         | Size |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| ★   | **Morning brief.** One message a day to the webhook already supported: new strong matches, jobs closing within three days, and applications with no update for a week.                 | Turns alerts from "something happened" into a daily habit.                                  | S    |
|     | **Follow-up nudges.** Seven days after "applied" with no change, suggest a follow-up and, with a model connected, draft it.                                                            | Most applications are lost to silence, not rejection.                                       | M    |
|     | **Interview pack.** When an application moves to "interview", prepare a one-page brief from the posting: what the role needs, likely questions, and which parts of the CV answer each. | The moment people most want help.                                                           | M    |
|     | **Calendar file.** Export deadlines and interviews as an `.ics` file any calendar can subscribe to.                                                                                    | No integration to maintain; works with every calendar.                                      | S    |
|     | **Saved searches.** Save a set of filters with a name, and alert on each separately.                                                                                                   | "Remote backend roles" and "Nairobi data roles" are different searches for the same person. | M    |

### Growing the source list by itself

|     | Idea                                                                                                                                                                                                            | Why                                                                                   | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- |
| ★   | **Recognise an employer from a pasted link.** When someone adds a job by link and the link is a Greenhouse, Lever, Ashby, Workable, SmartRecruiters or Workday address, offer to add that employer as a source. | The source list grows from what people actually apply to, with no manual lookup.      | S    |
| ★   | **Weekly source check on GitHub.** A scheduled workflow runs `pnpm boards:verify` and opens a pull request when a source changes status.                                                                        | The claim "every source was checked" stays true without anyone remembering to run it. | S    |
|     | **"Add to KaziScout" bookmarklet.** A browser bookmark that sends the current page to a running KaziScout.                                                                                                      | One click from any job page, with no extension to publish.                            | S    |
|     | **Feed finder.** Given a board's address, try the usual feed paths and report whether one works.                                                                                                                | This is how the first 25 feeds were found by hand; it should be a command.            | S    |

### Learning from the person

|     | Idea                                                                                                                                                         | Why                                                                                       | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---- |
| ★   | **Skills-gap radar.** Across jobs scoring 3 to 4, count the requirements that are missing most often. "PostgreSQL is asked for in 41 jobs you nearly match." | Tells a learner what to study next, which is the question a training cohort actually has. | M    |
|     | **Learn from what gets saved.** Use which jobs a person saves, applies to and hides to adjust the scoring weights for them.                                  | The keyword score is the same for everyone; behaviour says what they really want.         | L    |
|     | **Salary reading.** Pull pay ranges out of postings and show them in one currency.                                                                           | Pay is the first thing people look for and the last thing boards make easy to find.       | M    |

### Reaching people where they are

|     | Idea                                                                                                       | Why                                                                                   | Size |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- |
|     | **WhatsApp or Telegram assistant.** The same commands as `./kazi`, as a chat. "matches", "show 3", "save". | Most job sharing here already happens in chat groups; a laptop is not always at hand. | L    |
|     | **SMS digest.** The morning brief as a text message through an SMS gateway.                                | Works on any phone and with no data bundle.                                           | M    |
|     | **MCP server.** Expose scan, list, show and assess as tools so an AI agent needs no shell.                 | The terminal skill already proves the flow; this removes the shell requirement.       | M    |

## Interface

### Make the first screen answer "what should I do today?"

|     | Idea                                                                                                                    | Why                                                                               | Size |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---- |
| ★   | **A "Today" home screen.** Four short lists: new strong matches, closing soon, follow-ups due, and sources that failed. | The app opens on a list of 3,000 jobs. Most days the useful answer is five items. | M    |
| ★   | **Triage mode.** One job at a time, full width, with three keys: save, skip, hide. Hidden jobs stay hidden.             | Reviewing 40 new matches by opening each one is slow; this takes a minute.        | M    |
|     | **Keyboard everywhere.** `j`/`k` to move, `s` to save, `/` to search, and a command palette on `Ctrl+K`.                | People who use this daily will stop reaching for the mouse.                       | M    |

### Make the score explain itself

|     | Idea                                                                                                                               | Why                                                                                                                 | Size |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---- |
| ★   | **Score breakdown.** Show the four parts of the score (title, skills, location, freshness) as a small bar, not only a number.      | "3.4" raises a question the app can already answer.                                                                 | S    |
| ★   | **Requirements checklist.** On a job, list what the posting asks for with a mark beside each: in your CV, not in your CV, unclear. | Side-by-side with the posting, this is the fastest way to decide. With a model connected the data is already there. | M    |
|     | **"What would make this a 4?"** One line under a middling score: the two changes that would move it most.                          | Turns a verdict into advice.                                                                                        | S    |
|     | **Compare two jobs.** Pick two and see them in columns.                                                                            | The real decision is often between two offers, not about one.                                                       | M    |

### Make setup feel like a conversation

|     | Idea                                                                                                                                                            | Why                                                                                            | Size |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| ★   | **Guided setup.** After a CV import, ask the follow-up questions one per screen with large tap targets and the suggestion pre-filled, instead of one long form. | The questions already exist; presenting them one at a time is the friendlier half of the work. | M    |
|     | **Profile strength.** A short list of what is missing and what each addition unlocks ("add a phone number so application packs are complete").                  | Gives a reason to finish the profile.                                                          | S    |

### Tracker and documents

|     | Idea                                                                                                                                                    | Why                                                                           | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- |
|     | **Board view for the tracker.** Columns per status with drag and drop, and full keyboard support for moving cards.                                      | Matches how people picture a pipeline. The list view stays for small screens. | M    |
|     | **Application timeline.** Each application shows its history: saved, documents written, applied, followed up.                                           | Answers "what did I send them, and when?"                                     | M    |
|     | **Edit documents in place, with a fact check.** Edit the cover letter in the app, with any sentence that names something absent from the CV underlined. | The "reword, never invent" rule becomes visible instead of a promise.         | L    |

### Phone, language and place

|     | Idea                                                                                                                                                               | Why                                                       | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ---- |
| ★   | **Installable on a phone.** Bottom navigation on small screens and a web app manifest so it can be added to the home screen and opened offline with the last scan. | Many users will only have a phone.                        | M    |
|     | **Kiswahili and French.** Translate the interface. Francophone boards are already in the source list.                                                              | The audience is not all English-first.                    | M    |
|     | **Where the jobs are.** A view of job counts by country, as tappable chips or a simple map of Africa.                                                              | Makes the breadth of the source list visible at a glance. | M    |
|     | **Light data mode.** A setting that skips descriptions during scans and fetches them on demand.                                                                    | Data is paid for by the megabyte for many users.          | S    |

### For sharing and for cohorts

|     | Idea                                                                                                                                                         | Why                                                                                                 | Size |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---- |
|     | **Share a match.** Produce a short text card for a job (title, employer, link, closing date) ready to paste into a chat group.                               | Cohorts already share jobs this way; make the message a good one.                                   | S    |
|     | **Cohort view.** For a trainer: how many learners have a profile, have applied, have interviews, and which skills gaps are most common. Needs user accounts. | This is the paid product described in ADR-0005, and the report funders ask training programmes for. | L    |

## Suggested order

1. Fetch full postings for strong matches, and the score breakdown. Both are small and make
   the existing scores more trustworthy.
2. The "Today" screen and the morning brief. They share the same four lists.
3. Recognise employers from pasted links, and the weekly source check. The source list starts
   maintaining itself.
4. Guided setup and triage mode. The two places where the app currently asks for the most
   clicking.
5. Skills-gap radar. The feature most likely to matter to a training cohort.

## Not planned

- **Applying automatically.** KaziScout prepares; the person presses Submit. See ADR-0004.
- **Scraping boards that publish no feed.** See ADR-0001.
- **An all-dark theme by default.** A dark theme could be offered as a choice; it will not be
  the default.

# Database request for Lovable

The database is managed by Lovable (see `AGENTS.md`), so these changes are written as a request to paste into the Lovable editor. Nothing here has been applied.

Do not send this until the privacy notice has been updated to say that transcripts and a practice summary are stored, for how long, and how to delete them. Most users are under 18.

## Message to paste

> Please make these database changes. Keep all existing tables, functions, policies and credit rules exactly as they are.
>
> **1. Add columns to `interview_sessions`** (all nullable, no defaults, so existing rows and functions are unaffected):
> - `tutor_id text`
> - `card_ids text[]`
> - `reading_id text`
> - `transcript jsonb`
> - `turn_states jsonb`
> - `feedback jsonb`
> - `run_manifest jsonb`
> - `metrics jsonb`
> - `ended_at timestamptz`
>
> **2. New table `student_context`:**
> - `user_id uuid not null`
> - `tutor_id text not null`
> - `context jsonb not null`
> - `updated_at timestamptz not null default now()`
> - primary key `(user_id, tutor_id)`
> - Row-level security on. Signed-in users can `select` their own row only. No insert, update or delete policy for users.
>
> **3. New security-definer functions**, each using `auth.uid()`, raising "Sign in required" when it is null, with `search_path = public`, executable by `authenticated` and `service_role` only:
> - `save_interview_record(p_interview_id uuid, p_tutor_id text, p_card_ids text[], p_reading_id text, p_transcript jsonb, p_turn_states jsonb, p_run_manifest jsonb, p_metrics jsonb)` updates the caller's own row in `interview_sessions`, sets `ended_at = now()`, and returns true if a row was updated.
> - `save_interview_feedback(p_interview_id uuid, p_feedback jsonb)` updates the caller's own row and returns true if a row was updated.
> - `upsert_student_context(p_tutor_id text, p_context jsonb)` inserts or replaces the caller's own row in `student_context`.
> - `delete_my_interview_data()` sets `transcript`, `turn_states`, `feedback` and `metrics` to null on all the caller's `interview_sessions` rows and deletes the caller's `student_context` rows. It must not delete the session rows themselves or touch `purchases`, because credits depend on them.
>
> **4. A tester interview row.** Add `create_tester_interview(p_environment text)` that inserts an `interview_sessions` row for the caller with `purchase_id` null and returns its id, for accounts that bypass credits. It must not conflict with the existing unique index `one_free_interview_per_user_environment`; if it would, add a boolean column `is_test not null default false` and exclude test rows from that index.
>
> **5. Retention.** Add a scheduled job that, once a day, nulls `transcript`, `turn_states`, `feedback` and `metrics` on `interview_sessions` rows whose `created_at` is before the most recent 31 August.
>
> Do not change `consume_interview_credit`, `consume_feedback` or `release_interview_credit`.

## Why each piece

| Item | Used by |
|---|---|
| `tutor_id`, `card_ids`, `reading_id` | Avoiding repeated topics; history page |
| `transcript` | History page; feedback built from the server's copy instead of the browser's |
| `turn_states`, `metrics` | Monitoring and evaluation (shadow mode) |
| `feedback` | Showing past feedback |
| `run_manifest` | Knowing which prompt and model versions produced an interview |
| `student_context` | The per-student summary that shapes the next interview |
| `delete_my_interview_data` | The deletion promise in the privacy notice |
| Retention job | Deleting transcripts after each admissions cycle |

## Things to check after Lovable applies it

- `release_interview_credit` deletes an unused session row. Confirm it still works with the new columns.
- The tester row change does not let a normal user get a second free interview.
- A user cannot read another user's transcript or context (try with two accounts).

## Not requested yet

School accounts (organisations, seats, invite codes, teacher access) are a separate design and a separate request.

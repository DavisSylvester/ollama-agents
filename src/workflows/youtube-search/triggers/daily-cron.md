# Trigger: Daily Cron

## Responsibility
Run the research workflow for all registered topics on a daily schedule.

## Schedule
- Default: once per day (interval configurable via `CRON_SCHEDULE` env var, e.g. `"0 6 * * *"`)

## Flow
1. Load all registered topic/query pairs from the topic registry (see Notes)
2. For each `TopicInput`:
   a. Run the full research workflow (steps 01–09)
   b. On completion, log to run manifest
3. All topics are processed sequentially (not in parallel) to avoid API rate limits

## Notes
- The **topic registry** is a list of `TopicInput` objects. Its format will be designed in a future step, but it should live at a well-known path (e.g. `config/topics.json`)
- If a topic run fails entirely (not just a non-fatal error), log the failure and continue to the next topic — do not abort the full cron run
- `lookbackDays` defaults to **7** for all runs. Step 08 deduplication (by URL) prevents duplicate saves across daily runs. Override with `LOOKBACK_DAYS` env var.

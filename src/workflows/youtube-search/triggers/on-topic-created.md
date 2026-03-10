# Trigger: On Topic Created

## Responsibility
Kick off the full research workflow immediately when a new topic/query pair is registered.

## Trigger Event
- A new `TopicInput` is added to the system (e.g. via CLI command, config file update, or API call)

## Flow
1. Receive `TopicInput { topicName, queryName }`
2. Run the full research workflow (steps 01–09) for this single topic/query pair
3. On completion, log result to the run manifest

## Notes
- This trigger runs once, immediately — it is not a recurring job
- Uses the same `EnvState` and defaults as the daily cron trigger
- After the initial run, the daily cron (see `daily-cron.md`) will pick it up automatically on subsequent runs

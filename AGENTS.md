# Project implementation rules

- Integrations loads must have bounded waits, visible retryable errors, and stale-request protection so a failed connection never appears to be an empty workspace.
- Field-mapping saves must read current integration settings before merging changes and confirm an updated row before reporting success, preserving unrelated saved settings.
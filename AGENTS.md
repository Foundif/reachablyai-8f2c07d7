# Project implementation rules

- Integrations loads must have bounded waits, visible retryable errors, and stale-request protection so a failed connection never appears to be an empty workspace.
- Field-mapping saves must read current integration settings before merging changes and confirm an updated row before reporting success, preserving unrelated saved settings.
- Instagram shares CRM conversations/messages with a channel discriminator; every send and lookup must include workspace and channel to avoid cross-channel routing.
- Instagram tokens are server-only; signatures fail closed, event IDs are durably deduplicated, and only customer messages/postbacks open the 24-hour reply window.
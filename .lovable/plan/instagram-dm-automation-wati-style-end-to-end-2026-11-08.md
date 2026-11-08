# Instagram DM Automation (WATI-style), end to end

Goal: a business connects its Instagram professional account once, then Reachably answers DMs, comment replies and story replies automatically, and every Instagram chat sits in the same Inbox as WhatsApp.

Today only a mention of Instagram exists on Onboarding/Integrations; nothing is connected or automated yet.

## What the user will get

1. **Connect Instagram** (Settings → Channels): "Continue with Facebook/Instagram" button, pick the Instagram business account, see connected status, username and profile photo. Disconnect anytime.
2. **Unified Inbox**: Instagram chats appear next to WhatsApp with an Instagram badge and a channel filter (All / WhatsApp / Instagram). Staff reply, assign, tag, add notes and resolve the same way. Shows the 24-hour reply window (Instagram rule) and the "human agent" 7-day tag where allowed.
3. **Instagram automations** (new tab on Automations & AI):
   - **Comment to DM**: when someone comments a keyword (e.g. "PRICE") on a chosen post/reel, auto-reply publicly to the comment and send them a DM.
   - **Story reply / story mention**: auto-DM when someone replies to or mentions a story.
   - **Keyword DM replies**: same keyword rules as WhatsApp, for Instagram DMs.
   - **Welcome DM + Ice breakers**: first-message greeting and the tappable FAQ buttons shown when a new chat opens.
   - **Persistent menu**: fixed menu inside the Instagram chat (Book now, Prices, Talk to team).
   - **AI replies**: the same AI business info and credits answer Instagram DMs too, with a per-channel on/off switch.
   - **Quick reply buttons and images/cards** in auto-DMs, with links (booking page, payment link, WhatsApp chat link).
4. **Lead capture**: every Instagram contact becomes a Contact (username, name, source "Instagram", tags from the keyword they used). Ask for phone number in the DM and save it to the contact, so the business can later move them to WhatsApp.
5. **Broadcast-style follow-up** (limited by Instagram rules): message only people who messaged within the last 24 hours; clear warning in the UI. No cold mass DMs (Instagram does not allow them).
6. **Analytics**: Instagram DMs received, auto-replies sent, comment-to-DM conversions, leads captured, on Home and Analytics.
7. **Guide + Test**: setup checklist and a "Send test" box like the AI test, showing the result in Inbox.

## Phases (execution next session)

1. Connect Instagram + receive DMs into Inbox + manual replies.
2. Keyword DM replies, welcome DM, ice breakers, persistent menu, AI replies on Instagram.
3. Comment-to-DM and story reply/mention automations with post picker.
4. Lead capture, 24h follow-up, analytics, guide, end-to-end test with a real Instagram account.

## What you need to prepare

- An Instagram **Professional** (Business or Creator) account, linked to a Facebook Page.
- Our Meta app needs Instagram messaging permissions approved by Meta (App Review). Until approved, only accounts added as testers in the app can be used. Review can take several days.
- One real Instagram test account to send DMs and comments from.

## Technical details

- Meta Instagram API (Instagram Login or via Facebook Page): permissions instagram_basic, instagram_manage_messages, instagram_manage_comments, pages_manage_metadata; webhook fields messages, messaging_postbacks, comments, mentions, story_insights.
- New tables: instagram_accounts (workspace, ig user id, page id, token kept server-only), plus a `channel` column on wa_conversations/wa_messages (default whatsapp) so the existing Inbox is reused instead of duplicated; instagram_automations (type, post id, keyword, public reply, DM content, enabled, run count). RLS by workspace membership.
- Edge functions: instagram-oauth (connect/disconnect), instagram-webhook (verify + receive DMs/comments, run automations, AI), instagram-send (Inbox replies, buttons, media), instagram-profile-setup (ice breakers, persistent menu).
- Reuse existing AI reply code, credits counter, quick replies, tags and assignment; dedupe webhooks by message id; respect 24h window and rate limits; surface Meta errors in plain language.

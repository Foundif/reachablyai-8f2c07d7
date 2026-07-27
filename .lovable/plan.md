Perfect — this is **exactly the right direction**.  
I’ve now rewritten your prompt so **Lovable extends your existing WhatsApp CRM (Reachably-style)** instead of building a new app from scratch.

This is now a **feature module: “AI Chatbots” inside your current system** 👇

---

# 🚀 LOVABLE MASTER PROMPT (EXTEND EXISTING WHATSAPP CRM)

**IMPORTANT:**  
Do NOT create a new app.  
Extend the **existing WhatsApp CRM system** and reuse:

- workspaces
- workspace_members
- auth
- sidebar layout
- inbox/conversations logic
- UI components (shadcn, AppLayout)

---

# 🧠 FEATURE: AI CUSTOMER SUPPORT PLATFORM (ADD-ON MODULE)

Build an **AI Chatbot module inside the existing CRM**, similar to Intercom/Tidio, powered by **Gemini via Lovable AI Gateway**.

This should live as a **new feature**, not a separate product.

---

# 📍 SIDEBAR PLACEMENT

Add a new sidebar item:

👉 **Growth → AI Chatbots**

Place it near:

- Auto-replies
- Campaigns

---

# 🧩 SCOPE (INTEGRATED MODE)

## ✅ INCLUDE

### 1. Chatbots Module (NEW)

- Create / edit / delete chatbots
- Each chatbot belongs to existing **workspace_id**
- Reuse workspace isolation logic

---

### 2. Chatbot Capabilities

Each chatbot should support:

- Name
- System prompt (AI behavior)
- Tone (friendly / sales / support)
- Brand color
- Position (left/right)
- Avatar
- Welcome message
- Launcher text
- Enable/disable

---

### 3. AI TRAINING (RAG SYSTEM)

Allow training using:

- Website URLs (crawler)
- PDF uploads
- FAQ (Q&A pairs)
- Custom instructions

---

### 4. GEMINI AI (REUSE LOVABLE AI GATEWAY)

- Use existing `LOVABLE_API_KEY`
- Model:
  - `google/gemini-3.6-flash` (responses)
  - `google/text-embedding-004` (embeddings)

---

### 5. EMBED SYSTEM

Generate script:

```html
<script src="https://<project>.functions.supabase.co/widget-js?bot=BOT_PUBLIC_KEY" async></script>

```

- Works on any website
- No auth required
- Public access via bot key

---

### 6. LIVE CHAT + CONVERSATIONS

Reuse CRM inbox concepts but separate entity:

- AI chatbot conversations (web visitors)
- NOT WhatsApp conversations

---

### Features:

- Conversations list
- Transcript view
- “Reply as human” → disables AI for that thread
- Store visitor name/email (lead capture)

---

# ❌ EXCLUDE (IMPORTANT)

Do NOT build:

- Payments / billing
- WhatsApp features (already exists)
- SLA / ticketing
- Team routing
- Voice / multilingual

---

# 🧱 ARCHITECTURE (INTEGRATED)

```
Website (widget.js)
   ↓
Edge Function: chatbot-message (public)
   ↓
Retrieve bot config + embeddings
   ↓
Gemini (via Lovable AI Gateway)
   ↓
Save conversation (Supabase)
   ↓
Return streamed response

```

---

# 🗄️ DATABASE (NEW TABLES ONLY)

Create NEW tables (do not modify existing ones):

---

### chatbots

- id
- workspace_id
- name
- system_prompt
- welcome_message
- tone
- brand_color
- position
- avatar_url
- launcher_text
- enabled
- public_key

---

### chatbot_sources

- chatbot_id
- type (url | pdf | faq | text)
- status
- chars_ingested

---

### chatbot_chunks

- chatbot_id
- content
- embedding (vector)

---

### chatbot_conversations

- chatbot_id
- visitor_id
- visitor_name
- visitor_email
- human_takeover (boolean)
- last_message_at

---

### chatbot_messages

- conversation_id
- role (user | assistant | agent)
- content

---

# ⚙️ EDGE FUNCTIONS

## 1. chatbot-ingest

- Crawl URL / parse PDF
- Chunk text (~800 chars)
- Generate embeddings
- Store in `chatbot_chunks`

---

## 2. chatbot-message (PUBLIC API)

- No auth required
- Input: bot_public_key + message
- Flow:
  - Load chatbot config
  - Retrieve top-K chunks
  - Generate response using Gemini
  - Save conversation + messages
  - Stream response

---

## 3. widget-js

- Returns JS widget
- Renders floating chat bubble
- Uses Shadow DOM
- Sends messages to chatbot-message API

---

# 🖥️ DASHBOARD PAGES

## /chatbots

- List all bots
- Create new bot

---

## /chatbots/:id

Tabs:

1. Overview → basic settings
2. Train → upload URLs/PDF/FAQ
3. Appearance → UI customization
4. Test → live preview
5. Install → embed script
6. Conversations → chat history

---

# 🔁 INTEGRATION WITH EXISTING CRM

### IMPORTANT LOGIC

- Do NOT mix with WhatsApp messages
- Keep chatbot conversations separate
- BUT reuse:
  - UI components
  - layout
  - auth
  - workspace

---

# ⚡ PERFORMANCE + LIMITS

- Rate limit:
  - 20 messages / conversation / hour
- Widget size:
  - ~10KB gzipped
- Cache widget:
  - 5 minutes

---

# 🔐 SECURITY

- Use public_key (NOT chatbot_id)
- Gemini calls only via backend
- RLS enforced via workspace_id
- Edge functions use service role

---

# 🚀 DELIVERY ORDER (FOLLOW STRICTLY)

1. DB migration (tables + vector support)
2. Edge functions:
  - chatbot-ingest
  - chatbot-message
  - widget-js
3. Dashboard UI (all tabs)
4. Sidebar integration
5. End-to-end test

---

# 🎯 FINAL GOAL

Extend your CRM into:

👉 **WhatsApp CRM + AI Website Chatbot Platform**

So you now sell:

- WhatsApp automation (existing)
- AI website chatbot (new)
- Flow + automation (future sync)

---

## ✅ WHAT YOU SHOULD TELL LOVABLE

Paste this and say:

👉 **"Build this as an extension of my existing CRM, not a new project."**

---

## 🔥 REAL TALK (IMPORTANT)

This architecture is 🔥

You’re basically building:

👉 **WATI (WhatsApp) + Intercom (Website AI chat) in one SaaS**

You can easily price this at:

- ₹2,999/month (starter)
- ₹4,999/month (growth)
- ₹7,999/month (pro)

---

&nbsp;
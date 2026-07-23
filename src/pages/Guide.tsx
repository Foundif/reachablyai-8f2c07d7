import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  BookOpen, MessageSquare, GitBranch, Zap, Send, Sparkles,
  ArrowRight, CheckCircle2, PlayCircle, Inbox, Users, Settings, Bot,
} from 'lucide-react';

const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
      {n}
    </div>
    <div className="flex-1 pb-6 border-l border-border/40 pl-6 -ml-4">
      <h4 className="font-semibold text-foreground mb-1">{title}</h4>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </div>
  </div>
);

const Scenario = ({
  icon: Icon, badge, title, subtitle, children, cta,
}: {
  icon: any; badge: string; title: string; subtitle: string; children: React.ReactNode;
  cta?: { label: string; to: string };
}) => (
  <Card className="glass-card p-6 md:p-8 space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-foreground/5 border border-border/60 flex items-center justify-center">
          <Icon className="w-6 h-6 text-foreground" />
        </div>
        <div>
          <Badge variant="outline" className="mb-2 text-[10px] uppercase tracking-wider">{badge}</Badge>
          <h3 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        </div>
      </div>
      {cta && (
        <Button asChild variant="outline" size="sm" className="hidden md:flex">
          <Link to={cta.to}>{cta.label} <ArrowRight className="w-3 h-3 ml-1" /></Link>
        </Button>
      )}
    </div>
    <div className="pt-2">{children}</div>
    {cta && (
      <Button asChild variant="outline" size="sm" className="md:hidden w-full">
        <Link to={cta.to}>{cta.label} <ArrowRight className="w-3 h-3 ml-1" /></Link>
      </Button>
    )}
  </Card>
);

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded-md bg-foreground/[0.06] border border-border/60 text-[12px] font-mono text-foreground">
    {children}
  </code>
);

const Guide = () => {
  return (
    <AppLayout>
      <div className="p-4 md:p-8 lg:p-10 space-y-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-foreground text-background flex items-center justify-center">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              How to use Reachably messaging
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Four real scenarios, end-to-end. Follow any of these to start sending templates,
              automating replies, and running multi-step campaigns on WhatsApp.
            </p>
          </div>
        </div>

        {/* Prereqs */}
        <Card className="glass-card p-5 md:p-6 border-l-4 border-l-foreground/40">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Before you start</h3>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Connect your WhatsApp Business number in <Link to="/whatsapp-settings" className="text-foreground underline underline-offset-2">WhatsApp Settings</Link>.</li>
            <li>• Add at least one lead in <Link to="/leads" className="text-foreground underline underline-offset-2">Leads</Link> (or import a CSV).</li>
            <li>• Create or sync approved templates in <Link to="/templates" className="text-foreground underline underline-offset-2">Templates</Link>.</li>
          </ul>
        </Card>

        {/* Scenario 1 */}
        <Scenario
          icon={MessageSquare}
          badge="Scenario 1"
          title="Send a one-off template message"
          subtitle="Reach a specific lead with a pre-approved WhatsApp template."
          cta={{ label: 'Open Inbox', to: '/inbox' }}
        >
          <Step n={1} title="Open the lead's thread">
            Go to <Link to="/inbox" className="text-foreground underline">Unified Inbox</Link> and pick the contact from the left list.
            New contact? Add them first in <Link to="/leads" className="text-foreground underline">Leads</Link>, then start or continue the WhatsApp conversation.
          </Step>
          <Step n={2} title="Pick a template or type freely">
            Inside the conversation, click <Code>+ Template</Code> to insert an approved template, or type a free-form
            message (only works if the 24-hour conversation window is open).
          </Step>
          <Step n={3} title="Personalise & send">
            Replace placeholders like <Code>{`{{name}}`}</Code> from the lead record, then hit <Code>Send</Code>.
            Delivery status updates appear in real time via the webhook.
          </Step>
        </Scenario>

        {/* Scenario 2 */}
        <Scenario
          icon={GitBranch}
          badge="Scenario 2"
          title="Build a template with flow buttons"
          subtitle='Send a message with tappable reply buttons like "Interested" or "Call Us" that routes the lead through your flow.'
          cta={{ label: 'Open Flow Builder', to: '/flows' }}
        >
          <Step n={1} title="Create a new flow">
            Open <Link to="/flows" className="text-foreground underline">Flow Builder</Link> → <Code>New Flow</Code>.
            Give it a name like "Booking Confirmation".
          </Step>
          <Step n={2} title="Drag the Trigger node">
            From the left panel, drag a <Code>Trigger</Code> node onto the canvas. Set the trigger type
            (manual / keyword / API). For a button-driven journey, pick <Code>Manual</Code> — campaigns will start it.
          </Step>
          <Step n={3} title="Add a Message node with buttons">
            Drag a <Code>Message</Code> node, connect from Trigger. In its panel, write:
            <pre className="mt-2 p-3 rounded-lg bg-foreground/[0.04] border border-border/60 text-xs whitespace-pre-wrap">{`Hi {{name}} 👋 Ready to book your next appointment?`}</pre>
            Then add quick-reply buttons: <Code>Book Now</Code>, <Code>Maybe later</Code>, <Code>Talk to us</Code>.
          </Step>
          <Step n={4} title="Branch on the reply">
            Drag a <Code>Branch</Code> node, connect from Message. Add rules:
            <ul className="pl-4 mt-2 space-y-1 list-disc">
              <li>If reply = "Interested" → Message "Great! Our team will reach out shortly" → Action "Create follow-up task"</li>
              <li>If reply = "Maybe later" → Wait 48h → re-send</li>
              <li>If reply = "Talk to us" → Action "Assign to human"</li>
            </ul>
          </Step>
          <Step n={5} title="Simulate, then publish">
            Click <Code>Simulate</Code> at the top, paste a sample audience JSON, run a dry-run.
            When happy, click <Code>Publish</Code>. Trigger it from <Link to="/campaigns" className="text-foreground underline">Campaigns</Link>.
          </Step>
        </Scenario>

        {/* Scenario 3 */}
        <Scenario
          icon={Zap}
          badge="Scenario 3"
          title='Auto-reply when a lead texts "hi"'
          subtitle="The classic welcome bot: any inbound 'hi', 'hello', 'menu' starts a flow that greets and routes them."
          cta={{ label: 'Build the welcome flow', to: '/flows' }}
        >
          <Step n={1} title="New flow with a keyword trigger">
            <Link to="/flows" className="text-foreground underline">Flow Builder</Link> → <Code>New Flow</Code> → name it "Welcome Bot".
            Drag a <Code>Trigger</Code> node and configure:
            <ul className="pl-4 mt-2 space-y-1 list-disc">
              <li><b>Type:</b> Keyword (inbound message)</li>
              <li><b>Keywords:</b> <Code>hi</Code>, <Code>hello</Code>, <Code>hey</Code>, <Code>menu</Code></li>
              <li><b>Match:</b> case-insensitive, whole word</li>
            </ul>
          </Step>
          <Step n={2} title="Send the welcome message">
            Add a <Code>Message</Code> node:
            <pre className="mt-2 p-3 rounded-lg bg-foreground/[0.04] border border-border/60 text-xs whitespace-pre-wrap">{`Hi 👋 Welcome to {{business_name}}!

Reply with a number:
1️⃣ See our services
2️⃣ Book an appointment
3️⃣ Talk to a human`}</pre>
          </Step>
          <Step n={3} title="Branch on the lead's number">
            Add a <Code>Branch</Code> node with three paths:
            <ul className="pl-4 mt-2 space-y-1 list-disc">
              <li><b>1</b> → Message with services list (pull from <Link to="/services" className="text-foreground underline">Services & Tariff</Link>)</li>
              <li><b>2</b> → Booking flow (sub-flow from Scenario 2)</li>
              <li><b>3</b> → Action <Code>Assign to human</Code> + Notify staff in Inbox</li>
            </ul>
          </Step>
          <Step n={4} title="Publish — that's it">
            Click <Code>Publish</Code>. The <Code>whatsapp-webhook</Code> edge function automatically routes every
            inbound message through all published flows whose triggers match. No cron, no extra setup.
          </Step>
          <Step n={5} title="Test it">
            From any phone, send <Code>hi</Code> to your WhatsApp Business number. Within seconds you should
            see the auto-reply, and the conversation appears in <Link to="/inbox" className="text-foreground underline">Inbox</Link> with the flow tag.
          </Step>
        </Scenario>

        {/* Scenario 4 */}
        <Scenario
          icon={Send}
          badge="Scenario 4"
          title="Run a broadcast campaign to many leads"
          subtitle="Send a template to a segmented audience and watch the funnel: Sent → Delivered → Replied → Converted."
          cta={{ label: 'Open Campaigns', to: '/campaigns' }}
        >
          <Step n={1} title="Create the campaign">
            <Link to="/campaigns" className="text-foreground underline">Campaigns</Link> → <Code>New Campaign</Code> → name + description.
          </Step>
          <Step n={2} title="Pick an audience">
            Filter your leads by tag, status, source, or upload a CSV.
            Preview the count before continuing.
          </Step>
          <Step n={3} title="Attach a published flow">
            Select any flow you built (or a single template message). Variables like <Code>{`{{name}}`}</Code>{' '}
            auto-map from each contact's record.
          </Step>
          <Step n={4} title="Schedule or send now">
            Choose <Code>Send now</Code> or schedule for a specific time/timezone.
            The <Code>campaign-dispatch</Code> edge function fans out per-recipient sessions.
          </Step>
          <Step n={5} title="Track the funnel">
            On the campaign card, click <Code>Analytics</Code> for a real-time funnel chart, per-step
            drop-off, reply rate, opt-outs, and time-series delivery.
          </Step>
        </Scenario>

        {/* Tips */}
        <Card className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-foreground" />
            <h3 className="text-lg font-bold tracking-tight">Pro tips</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex gap-3">
              <Bot className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p><b className="text-foreground">Pair flows with an AI agent</b> — drop an "AI Reply" action node and the agent handles fuzzy questions with your business context.</p>
            </div>
            <div className="flex gap-3">
              <Users className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p><b className="text-foreground">Tag your leads</b> in Leads. Better tags = sharper audiences = higher conversion in campaigns.</p>
            </div>
            <div className="flex gap-3">
              <PlayCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p><b className="text-foreground">Always Simulate before publishing</b>. Dry-run with 3 sample contacts to catch broken variables or missing branches.</p>
            </div>
            <div className="flex gap-3">
              <Inbox className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p><b className="text-foreground">Keep an eye on Inbox</b> — even with full automation, human escalation improves lead conversion.</p>
            </div>
          </div>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2"><Link to="/inbox"><Inbox className="w-5 h-5" /><span>Open Inbox</span></Link></Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2"><Link to="/flows"><GitBranch className="w-5 h-5" /><span>Build a Flow</span></Link></Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2"><Link to="/campaigns"><Send className="w-5 h-5" /><span>New Campaign</span></Link></Button>
          <Button asChild variant="outline" className="h-auto py-4 flex-col gap-2"><Link to="/whatsapp-settings"><Settings className="w-5 h-5" /><span>WhatsApp Setup</span></Link></Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Guide;

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, LockKeyhole, Smartphone } from 'lucide-react';
import type { FlowComponent, FlowScreen } from '@/lib/flowStudio';

interface Props { screens: FlowScreen[]; initialScreen?: string }

const optionsOf = (component: FlowComponent) => component['data-source'] || [];

function PreviewComponent({ component, goTo }: { component: FlowComponent; goTo: (id: string) => void }) {
  const type = component.type || 'Unknown';
  if (type === 'Form') return <div className="space-y-4">{(component.children || []).map((child, index) => <PreviewComponent key={`${child.name || child.type}-${index}`} component={child} goTo={goTo} />)}</div>;
  if (type === 'TextHeading') return <h3 className="text-lg font-semibold leading-snug">{component.text || 'Heading'}</h3>;
  if (type === 'TextSubheading') return <h4 className="text-sm font-semibold">{component.text || 'Subheading'}</h4>;
  if (type === 'TextBody') return <p className="text-sm leading-relaxed text-foreground/90">{component.text || 'Body text'}</p>;
  if (type === 'TextCaption') return <p className="text-xs leading-relaxed text-muted-foreground">{component.text || 'Caption text'}</p>;
  if (type === 'TextInput' || type === 'DatePicker') return <div className="space-y-1.5"><Label className="text-xs">{component.label || component.name || 'Text field'}{component.required ? ' *' : ''}</Label><Input type={type === 'DatePicker' ? 'date' : 'text'} placeholder={type === 'DatePicker' ? '' : 'Type your answer'} className="h-10 bg-background" /></div>;
  if (type === 'TextArea') return <div className="space-y-1.5"><Label className="text-xs">{component.label || component.name || 'Long answer'}{component.required ? ' *' : ''}</Label><Textarea placeholder="Type your answer" rows={3} className="resize-none bg-background" /></div>;
  if (type === 'Dropdown') return <div className="space-y-1.5"><Label className="text-xs">{component.label || component.name || 'Select'}{component.required ? ' *' : ''}</Label><Select><SelectTrigger className="bg-background"><SelectValue placeholder="Select an option" /></SelectTrigger><SelectContent>{optionsOf(component).map((option, index) => <SelectItem key={option.id || index} value={option.id || String(index)}>{option.title || option.id || `Option ${index + 1}`}</SelectItem>)}</SelectContent></Select></div>;
  if (type === 'RadioButtonsGroup') return <fieldset className="space-y-2"><legend className="text-xs font-medium mb-2">{component.label || component.name || 'Choose one'}{component.required ? ' *' : ''}</legend>{optionsOf(component).map((option, index) => <label key={option.id || index} className="flex items-center gap-3 rounded-md border bg-background p-3 text-sm"><input type="radio" name={component.name || 'radio'} className="accent-primary" /><span>{option.title || option.id || `Option ${index + 1}`}</span></label>)}</fieldset>;
  if (type === 'CheckboxGroup') return <fieldset className="space-y-2"><legend className="text-xs font-medium mb-2">{component.label || component.name || 'Choose options'}{component.required ? ' *' : ''}</legend>{optionsOf(component).map((option, index) => <label key={option.id || index} className="flex items-center gap-3 rounded-md border bg-background p-3 text-sm"><Checkbox /><span>{option.title || option.id || `Option ${index + 1}`}</span></label>)}</fieldset>;
  if (type === 'OptIn') return <label className="flex items-start gap-3 text-sm"><Checkbox className="mt-0.5" /><span>{component.label || 'I agree'}</span></label>;
  if (type === 'EmbeddedLink') return <button type="button" className="text-sm font-medium underline underline-offset-4">{component.text || component.label || 'Open link'}</button>;
  if (type === 'Footer') {
    const target = component['on-click-action']?.next?.name;
    return <Button className="w-full mt-2" onClick={() => target && goTo(target)}>{component.label || (target ? 'Continue' : 'Submit')}</Button>;
  }
  return <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{type} preview</div>;
}

export default function FlowPhonePreview({ screens, initialScreen }: Props) {
  const [activeId, setActiveId] = useState(initialScreen || screens[0]?.id || '');
  useEffect(() => {
    if (!screens.some(screen => screen.id === activeId)) setActiveId(initialScreen || screens[0]?.id || '');
  }, [screens, initialScreen, activeId]);
  const activeIndex = Math.max(0, screens.findIndex(screen => screen.id === activeId));
  const screen = screens[activeIndex];
  const screenLabel = useMemo(() => `${activeIndex + 1} of ${screens.length}`, [activeIndex, screens.length]);

  if (!screen) return <div className="min-h-[520px] grid place-items-center rounded-lg border border-dashed text-center text-sm text-muted-foreground px-8"><div><Smartphone className="w-8 h-8 mx-auto mb-3" />Enter valid form code to see the live preview.</div></div>;

  return <div className="space-y-3">
    <div className="flex gap-2 overflow-x-auto pb-1">
      {screens.map((item, index) => <Button key={item.id} type="button" size="sm" variant={item.id === screen.id ? 'default' : 'outline'} className="shrink-0" onClick={() => setActiveId(item.id)}>{index + 1}. {item.title || item.id}</Button>)}
    </div>
    <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[28px] border-[6px] border-foreground bg-background shadow-elevated">
      <div className="flex h-8 items-center justify-center border-b bg-muted"><div className="h-1.5 w-16 rounded-full bg-foreground/30" /></div>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{screen.title || screen.id}</div><div className="text-[10px] text-muted-foreground">WhatsApp form · {screenLabel}</div></div>
      </div>
      <div className="h-[540px] overflow-y-auto bg-muted/30 px-4 py-5">
        <div className="space-y-4">{(screen.layout?.children || []).map((component, index) => <PreviewComponent key={`${component.name || component.type}-${index}`} component={component} goTo={setActiveId} />)}</div>
      </div>
    </div>
    <div className="flex items-center justify-between max-w-[390px] mx-auto">
      <Button type="button" size="sm" variant="ghost" disabled={activeIndex === 0} onClick={() => setActiveId(screens[activeIndex - 1]?.id || activeId)}><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
      <span className="text-xs text-muted-foreground">{screen.id}</span>
      <Button type="button" size="sm" variant="ghost" disabled={activeIndex === screens.length - 1} onClick={() => setActiveId(screens[activeIndex + 1]?.id || activeId)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
    </div>
  </div>;
}
import {describe,it,expect} from 'vitest';
import {nextReport,reportPeriod,summariseInsights,validateClient,validMetaSignature} from '../../supabase/functions/_shared/metaWorkflowRules';
const client={name:'Sports',destination:'+919876543210',ad_account_id:'123',page_id:'456',form_ids:['789'],kpis:['spend','leads'],cadence:'daily',report_time:'08:00',timezone:'Asia/Kolkata',weekday:1,monthday:1};
describe('Meta workflow rules',()=>{
 it('validates international WhatsApp destinations',()=>{expect(()=>validateClient(client)).not.toThrow();expect(()=>validateClient({...client,destination:'9876543210'})).toThrow();});
 it('schedules daily reports at 8 AM local time',()=>expect(nextReport(client,new Date('2026-10-22T01:00:00Z'))).toBe('2026-10-22T02:30:00.000Z'));
 it('schedules weekly on selected weekday',()=>expect(nextReport({...client,cadence:'weekly'},new Date('2026-10-22T01:00:00Z'))).toBe('2026-10-26T02:30:00.000Z'));
 it('schedules monthly on selected day',()=>expect(nextReport({...client,cadence:'monthly'},new Date('2026-10-22T01:00:00Z'))).toBe('2026-11-01T02:30:00.000Z'));
 it('uses complete daily weekly monthly periods',()=>{const now=new Date('2026-10-22T03:00:00Z');expect(reportPeriod(client,now)).toEqual({since:'2026-10-21',until:'2026-10-21'});expect(reportPeriod({...client,cadence:'weekly'},now)).toEqual({since:'2026-10-15',until:'2026-10-21'});expect(reportPeriod({...client,cadence:'monthly'},now)).toEqual({since:'2026-09-01',until:'2026-09-30'});});
 it('does not double-count overlapping lead actions',()=>expect(summariseInsights([{spend:'100',actions:[{action_type:'lead',value:'2'},{action_type:'leadgen_grouped',value:'2'}]}])).toMatchObject({leads:2,cpl:50}));
 it('rejects missing Meta signatures',async()=>expect(await validMetaSignature('test', '{}', null)).toBe(false));
});

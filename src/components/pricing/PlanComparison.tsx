import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';
import { COMPARISON, PLANS, type CompareValue } from '@/lib/plans';
import { cn } from '@/lib/utils';

const Cell = ({ v }: { v: CompareValue }) => {
  if (v === true) return <Check className="w-4 h-4 text-primary mx-auto" aria-label="Included" />;
  if (v === false) return <Minus className="w-4 h-4 text-muted-foreground/50 mx-auto" aria-label="Not included" />;
  return <span className="text-xs font-semibold">{v}</span>;
};

const PlanComparison = () => (
  <div className="mt-14">
    <h2 className="text-xl font-bold">Compare plans</h2>
    <p className="text-sm text-muted-foreground mt-1">Everything included in each plan, side by side.</p>

    <div className="mt-5 rounded-xl border border-border overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-0 bg-muted/60 backdrop-blur">
          <tr>
            <th className="text-left font-semibold p-3 w-[46%]">Feature</th>
            {PLANS.map((p) => (
              <th key={p.id} className={cn('p-3 text-center font-semibold', p.popular && 'text-primary')}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((g) => (
            <Fragment key={g.title}>
              <tr className="bg-muted/30">
                <td colSpan={4} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {g.title}
                </td>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="p-3 text-xs sm:text-sm">{r.label}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className={cn('p-3 text-center', PLANS[i]?.popular && 'bg-primary/5')}>
                      <Cell v={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default PlanComparison;

import AppLayout from '@/components/layout/AppLayout';
import { useEmployees } from '@/hooks/useEmployees';
import { DashboardSkeleton } from '@/components/ui/loading-skeleton';
import { UserCog, Phone } from 'lucide-react';

const Staffs = () => {
  const { employees, loading } = useEmployees();

  if (loading) return <AppLayout><DashboardSkeleton /></AppLayout>;

  // Staffs page shows all employees in a grid/card view
  const staff = employees.filter(e => e.role !== 'stylist'); // non-stylist staff
  const allStaff = staff.length > 0 ? staff : employees; // fallback to all if no distinction

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <UserCog className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Staffs</h1>
            <p className="text-muted-foreground">All salon staff members</p>
          </div>
        </div>

        {allStaff.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <UserCog className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Staff Members</h3>
            <p className="text-muted-foreground">Add employees from the Employees section.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allStaff.map((member, index) => (
              <div key={member.id} className="glass-card p-5 hover-lift animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <UserCog className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{member.name}</h3>
                    <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-primary/10 text-primary">{member.role}</span>
                  </div>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />{member.phone}
                  </div>
                )}
                <div className="mt-3 text-xs text-muted-foreground">
                  Commission: {member.commission_percentage}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Staffs;

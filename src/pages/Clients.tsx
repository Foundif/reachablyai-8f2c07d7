import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import TrustScoreDial from '@/components/TrustScoreDial';
import AddClientModal from '@/components/clients/AddClientModal';
import { ClientsListSkeleton } from '@/components/ui/loading-skeleton';
import { useClients, Client } from '@/hooks/useClients';
import { formatCurrency } from '@/data/mockData';
import { useCurrency } from '@/hooks/useCurrency';
import { exportToCSV, exportToExcel, ExportColumn } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  Building2, 
  MapPin,
  TrendingUp,
  TrendingDown,
  Users,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Clients = () => {
  const navigate = useNavigate();
  const { clients, loading, error } = useClients();
  const currency = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('trust_score');
  const [addModalOpen, setAddModalOpen] = useState(false);

  const filteredClients = useMemo(() => {
    let filtered = [...clients];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
      );
    }

    // Risk filter
    if (riskFilter !== 'all') {
      filtered = filtered.filter((c) => c.risk_level === riskFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trust_score':
          return b.trust_score - a.trust_score;
        case 'outstanding':
          return b.total_outstanding - a.total_outstanding;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [clients, searchQuery, riskFilter, sortBy]);

  const highRiskCount = clients.filter(c => c.risk_level === 'high').length;

  // Export columns configuration
  const exportColumns: ExportColumn<Client>[] = [
    { header: 'Name', accessor: 'name' },
    { header: 'Email', accessor: (c) => c.email || '' },
    { header: 'Company', accessor: (c) => c.company || '' },
    { header: 'Industry', accessor: (c) => c.industry || '' },
    { header: 'Country', accessor: (c) => c.country || '' },
    { header: 'Trust Score', accessor: 'trust_score' },
    { header: 'Risk Level', accessor: 'risk_level' },
    { header: 'Total Paid', accessor: 'total_paid' },
    { header: 'Total Outstanding', accessor: 'total_outstanding' },
    { header: 'Created At', accessor: (c) => new Date(c.created_at).toLocaleDateString() },
  ];

  const handleExportCSV = () => {
    exportToCSV(filteredClients, exportColumns, `clients-export-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportExcel = () => {
    exportToExcel(filteredClients, exportColumns, `clients-export-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-0.5 sm:mb-1">
              Clients
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {clients.length} clients {highRiskCount > 0 && `• ${highRiskCount} high risk`}
            </p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" className="flex-1 sm:flex-none" disabled={filteredClients.length === 0}>
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={handleExportCSV} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="trust" 
              size="default"
              className="flex-1 sm:flex-none"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border w-full"
              />
            </div>
            
            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full xs:w-[140px] bg-background text-sm">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risks</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="safe">Safe</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full xs:w-[160px] bg-background text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trust_score">Trust Score</SelectItem>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="glass-card p-6 text-center">
            <p className="text-destructive mb-2">Failed to load clients</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && <ClientsListSkeleton />}

        {/* Empty State */}
        {!loading && !error && clients.length === 0 && (
          <div className="glass-card p-8 sm:p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Add your first client to start tracking payment behavior and managing risk.
            </p>
            <Button variant="trust" onClick={() => setAddModalOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Your First Client
            </Button>
          </div>
        )}

        {/* No Results State */}
        {!loading && !error && clients.length > 0 && filteredClients.length === 0 && (
          <div className="glass-card p-8 sm:p-12 text-center">
            <p className="text-muted-foreground text-sm sm:text-base">No clients found matching your filters.</p>
          </div>
        )}

        {/* Client List */}
        {!loading && !error && filteredClients.length > 0 && (
          <div className="space-y-2 sm:space-y-3">
            {filteredClients.map((client, index) => (
              <ClientRow 
                key={client.id} 
                client={client} 
                index={index}
                onClick={() => navigate(`/clients/${client.id}`)} 
              />
            ))}
          </div>
        )}
      </div>

      <AddClientModal open={addModalOpen} onOpenChange={setAddModalOpen} />
    </AppLayout>
  );
};

interface ClientRowProps {
  client: Client;
  index: number;
  onClick: () => void;
}

const ClientRow = ({ client, index, onClick }: ClientRowProps) => {
  const currency = useCurrency();
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card p-3 sm:p-4 md:p-5 flex flex-col gap-3 sm:gap-4 hover-lift cursor-pointer animate-fade-up',
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Main Row */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Trust Score */}
        <div className="flex-shrink-0 scale-90 sm:scale-100">
          <TrustScoreDial score={client.trust_score} size="sm" showLabel={false} animated={false} />
        </div>
        
        {/* Client Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{client.name}</h3>
            <RiskBadge level={client.risk_level} size="sm" />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            {client.company && (
              <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                <Building2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                {client.company}
              </span>
            )}
            {client.country && (
              <span className="flex items-center gap-1 truncate max-w-[100px] sm:max-w-none">
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                {client.country}
              </span>
            )}
          </div>
        </div>
        
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
      </div>
      
      {/* Stats Row */}
      <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border/50">
        <div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Paid</p>
          <p className="font-semibold text-sm sm:text-base text-trust-safe flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {formatCurrency(client.total_paid, currency)}
          </p>
        </div>
        
        <div className="text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">Trust Score</p>
          <p className="font-semibold text-sm sm:text-base text-foreground">
            {client.trust_score}
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-[10px] sm:text-xs text-muted-foreground">Outstanding</p>
          <p className={cn(
            'font-semibold text-sm sm:text-base flex items-center gap-1 justify-end',
            client.total_outstanding > 0 ? 'text-risk-medium' : 'text-foreground'
          )}>
            {client.total_outstanding > 0 && <TrendingDown className="w-3 h-3" />}
            {formatCurrency(client.total_outstanding, currency)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Clients;

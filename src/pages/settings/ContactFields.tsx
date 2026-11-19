import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ListChecks, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface FieldItem {
  id: string;
  name: string;
  key: string;
  type: 'Text' | 'Number' | 'Date' | 'Phone';
  isSystem: boolean;
}

const DEFAULT_FIELDS: FieldItem[] = [
  { id: '1', name: 'Full Name', key: 'name', type: 'Text', isSystem: true },
  { id: '2', name: 'Phone Number', key: 'phone', type: 'Phone', isSystem: true },
  { id: '3', name: 'Email Address', key: 'email', type: 'Text', isSystem: true },
  { id: '4', name: 'Lead Source', key: 'source', type: 'Text', isSystem: true },
  { id: '5', name: 'Tags', key: 'tags', type: 'Text', isSystem: true },
  { id: '6', name: 'Assigned Agent', key: 'assigned_to', type: 'Text', isSystem: true },
];

export default function ContactFields() {
  const [fields, setFields] = useState<FieldItem[]>(DEFAULT_FIELDS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<'Text' | 'Number' | 'Date'>('Text');

  const handleAdd = () => {
    if (!fieldName.trim()) return toast.error('Field name required');
    const key = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setFields([...fields, {
      id: Date.now().toString(),
      name: fieldName.trim(),
      key,
      type: fieldType,
      isSystem: false,
    }]);
    toast.success('Custom field added');
    setFieldName('');
    setDialogOpen(false);
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-primary" /> Contact Fields
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage system default and custom contact fields for lead enrichment, Meta Lead ads, and CRM sync.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Custom Field
          </Button>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field Label</TableHead>
                <TableHead>Field Key</TableHead>
                <TableHead>Data Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-semibold text-sm">{f.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.key}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{f.type}</Badge></TableCell>
                  <TableCell>
                    {f.isSystem ? (
                      <Badge variant="outline" className="text-[11px] bg-muted gap-1 text-muted-foreground">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Default
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary">Custom</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Contact Field</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold mb-1 block">Field Label</label>
                <Input placeholder="e.g. Car Model, City, Package Name" value={fieldName} onChange={(e) => setFieldName(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Save Field</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

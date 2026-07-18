import AppLayout from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

const ComingSoonModule = ({ title = 'Coming soon', description = 'This module is coming in the next release.' }: { title?: string; description?: string }) => (
  <AppLayout>
    <div className="p-4 md:p-8">
      <Card className="p-12 text-center max-w-xl mx-auto">
        <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </Card>
    </div>
  </AppLayout>
);

export default ComingSoonModule;

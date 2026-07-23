import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { MODULE_GROUPS } from '@/lib/modules';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CommandPalette = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const { signOut, canAccess } = useAuth();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modules, customers, bookings…" />
      <CommandInput placeholder="Search modules, leads, campaigns…" />
      <CommandList className="custom-scrollbar">
        <CommandEmpty>No results found.</CommandEmpty>

        {MODULE_GROUPS.map((group) => (
          <div key={group.label}>
            <CommandSeparator />
            <CommandGroup heading={group.label}>
              {group.items.filter((item) => canAccess(item.to)).map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem key={item.to} onSelect={() => go(item.to)}>
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {item.status === 'soon' && (
                      <span className="ml-auto text-[9px] uppercase tracking-wider text-accent">Soon</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => go('/profile')}>
            <User className="w-4 h-4" /> Profile
          </CommandItem>
          <CommandItem onSelect={async () => { onOpenChange(false); await signOut(); navigate('/auth'); }}>
            <LogOut className="w-4 h-4" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;

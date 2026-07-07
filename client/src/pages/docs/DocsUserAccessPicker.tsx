import { useState, useMemo } from 'react';
import { Search, UserCheck } from 'lucide-react';
import type { SharePermission } from './docsData';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type UserOption = { id: number; name: string; email: string };

export type AccessMember = {
  user_id: number;
  name: string;
  email: string;
  permission: SharePermission;
};

type Props = {
  users: UserOption[];
  value: AccessMember[];
  onChange: (members: AccessMember[]) => void;
  excludeUserIds?: number[];
  disabled?: boolean;
};

export default function DocsUserAccessPicker({ users, value, onChange, excludeUserIds = [], disabled = false }: Props) {
  const [search, setSearch] = useState('');

  const selectedIds = useMemo(() => new Set(value.map((m) => m.user_id)), [value]);

  const availableUsers = useMemo(() => users.filter((u) => !excludeUserIds.includes(u.id)), [users, excludeUserIds]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableUsers;
    return availableUsers.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [availableUsers, search]);

  const toggleUser = (user: UserOption, checked: boolean) => {
    if (disabled) return;
    if (checked) onChange([...value, { user_id: user.id, name: user.name, email: user.email, permission: 'view' }]);
    else onChange(value.filter((m) => m.user_id !== user.id));
  };

  const setPermission = (userId: number, permission: SharePermission) => {
    if (disabled) return;
    onChange(value.map((m) => (m.user_id === userId ? { ...m, permission } : m)));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>
        <UserCheck size={14} /> Usuários com acesso
      </Label>
      <p className="-mt-1 text-xs text-muted-foreground">Marque quem pode abrir este repositório. Defina leitura ou edição para cada um.</p>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((m) => (
            <Badge key={m.user_id} variant="outline" className="gap-1.5 font-normal">
              {m.name}
              <span className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                {m.permission === 'edit' ? 'Edição' : 'Leitura'}
              </span>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          className="pl-8"
        />
      </div>

      <div className="flex max-h-[220px] flex-col gap-0.5 overflow-auto rounded-lg border border-input p-1.5" role="list">
        {filteredUsers.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground italic">Nenhum usuário encontrado.</p>
        ) : (
          filteredUsers.map((user) => {
            const checked = selectedIds.has(user.id);
            const member = value.find((m) => m.user_id === user.id);
            return (
              <div
                key={user.id}
                role="listitem"
                className={cn('flex items-center justify-between gap-2 rounded-md px-2 py-1.5', checked && 'bg-[var(--purple-light)]')}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                  <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => toggleUser(user, v === true)} />
                  <span className="flex min-w-0 flex-col">
                    <strong className="truncate text-sm font-semibold text-foreground">{user.name}</strong>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                </label>
                {checked && (
                  <Select value={member?.permission ?? 'view'} onValueChange={(v) => setPermission(user.id, v as SharePermission)}>
                    <SelectTrigger size="sm" className="w-[100px] shrink-0" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Leitura</SelectItem>
                      <SelectItem value="edit">Edição</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

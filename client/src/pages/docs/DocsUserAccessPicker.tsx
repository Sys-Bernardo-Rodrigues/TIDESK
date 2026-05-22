import { useState, useMemo } from 'react';
import { Search, UserCheck } from 'lucide-react';
import type { SharePermission } from './docsData';

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

export default function DocsUserAccessPicker({
  users,
  value,
  onChange,
  excludeUserIds = [],
  disabled = false,
}: Props) {
  const [search, setSearch] = useState('');

  const selectedIds = useMemo(() => new Set(value.map((m) => m.user_id)), [value]);

  const availableUsers = useMemo(
    () => users.filter((u) => !excludeUserIds.includes(u.id)),
    [users, excludeUserIds]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return availableUsers;
    return availableUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
  }, [availableUsers, search]);

  const toggleUser = (user: UserOption, checked: boolean) => {
    if (disabled) return;
    if (checked) {
      onChange([
        ...value,
        { user_id: user.id, name: user.name, email: user.email, permission: 'view' },
      ]);
    } else {
      onChange(value.filter((m) => m.user_id !== user.id));
    }
  };

  const setPermission = (userId: number, permission: SharePermission) => {
    if (disabled) return;
    onChange(value.map((m) => (m.user_id === userId ? { ...m, permission } : m)));
  };

  return (
    <div className="docs-access-picker">
      <label className="docs-form-label">
        <UserCheck size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
        Usuários com acesso
      </label>
      <p className="docs-access-picker__hint">
        Marque quem pode abrir este repositório. Defina leitura ou edição para cada um.
      </p>

      {value.length > 0 && (
        <div className="docs-access-picker__selected">
          {value.map((m) => (
            <span key={m.user_id} className="docs-access-chip">
              {m.name}
              <span className="docs-access-chip__perm">
                {m.permission === 'edit' ? 'Edição' : 'Leitura'}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="docs-search docs-access-picker__search">
        <Search size={16} className="docs-search__icon" />
        <input
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="docs-search__input"
          disabled={disabled}
        />
      </div>

      <div className="docs-access-picker__list" role="list">
        {filteredUsers.length === 0 ? (
          <p className="docs-access-picker__empty">Nenhum usuário encontrado.</p>
        ) : (
          filteredUsers.map((user) => {
            const checked = selectedIds.has(user.id);
            const member = value.find((m) => m.user_id === user.id);
            return (
              <div
                key={user.id}
                className={`docs-access-picker__row ${checked ? 'docs-access-picker__row--on' : ''}`}
                role="listitem"
              >
                <label className="docs-access-picker__check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => toggleUser(user, e.target.checked)}
                  />
                  <span className="docs-access-picker__user">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </span>
                </label>
                {checked && (
                  <select
                    className="docs-form-input docs-access-picker__perm-select"
                    value={member?.permission ?? 'view'}
                    disabled={disabled}
                    onChange={(e) =>
                      setPermission(user.id, e.target.value as SharePermission)
                    }
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="view">Leitura</option>
                    <option value="edit">Edição</option>
                  </select>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

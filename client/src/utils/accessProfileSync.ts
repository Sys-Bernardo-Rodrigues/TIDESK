/** Mesma lógica do servidor — mantém permissões e páginas do perfil alinhadas */

export type ProfilePermission = { resource: string; action: string };

export const PERMISSION_TO_PAGE: Record<string, string> = {
  'docs:view': '/docs',
  'tickets:view': '/tickets',
  'reports:view': '/relatorios',
  'history:view': '/historico',
  'forms:view': '/create/forms',
  'pages:view': '/create/pages',
  'webhooks:view': '/create/webhooks',
  'approve:view': '/acompanhar/aprovar',
  'track:view': '/acompanhar/acompanhar-tratativa',
  'agenda:view': '/agenda/calendario-de-servico',
  'sigma:view': '/consultar-os-sigma',
};

export const PAGE_TO_VIEW_PERMISSION: Record<string, ProfilePermission> = {
  '/docs': { resource: 'docs', action: 'view' },
  '/tickets': { resource: 'tickets', action: 'view' },
  '/relatorios': { resource: 'reports', action: 'view' },
  '/historico': { resource: 'history', action: 'view' },
  '/create/forms': { resource: 'forms', action: 'view' },
  '/create/pages': { resource: 'pages', action: 'view' },
  '/create/webhooks': { resource: 'webhooks', action: 'view' },
  '/acompanhar/aprovar': { resource: 'approve', action: 'view' },
  '/acompanhar/acompanhar-tratativa': { resource: 'track', action: 'view' },
  '/agenda/calendario-de-servico': { resource: 'agenda', action: 'view' },
  '/agenda/calendario-de-plantoes': { resource: 'agenda', action: 'view' },
  '/consultar-os-sigma': { resource: 'sigma', action: 'view' },
};

const RESOURCES_REQUIRING_VIEW = ['docs', 'tickets', 'forms', 'pages', 'webhooks', 'reports', 'history', 'agenda', 'sigma'];

function permKey(p: ProfilePermission) {
  return `${p.resource}:${p.action}`;
}

function hasPerm(perms: ProfilePermission[], resource: string, action: string) {
  return perms.some((p) => p.resource === resource && p.action === action);
}

function addPerm(perms: ProfilePermission[], resource: string, action: string) {
  if (!hasPerm(perms, resource, action)) {
    perms.push({ resource, action });
  }
}

export function normalizeProfileAccess(
  permissions: ProfilePermission[],
  pages: string[]
): { permissions: ProfilePermission[]; pages: string[] } {
  const perms = permissions.filter((p) => p.resource && p.action).map((p) => ({ ...p }));
  const pageSet = new Set(pages.filter(Boolean));

  for (const [key, pagePath] of Object.entries(PERMISSION_TO_PAGE)) {
    if (perms.some((p) => permKey(p) === key)) {
      pageSet.add(pagePath);
    }
  }

  for (const pagePath of [...pageSet]) {
    const viewPerm = PAGE_TO_VIEW_PERMISSION[pagePath];
    if (viewPerm) {
      addPerm(perms, viewPerm.resource, viewPerm.action);
    }
  }

  for (const resource of RESOURCES_REQUIRING_VIEW) {
    const hasAny = perms.some((p) => p.resource === resource);
    if (hasAny && !hasPerm(perms, resource, 'view')) {
      addPerm(perms, resource, 'view');
      const page = PERMISSION_TO_PAGE[`${resource}:view`];
      if (page) pageSet.add(page);
    }
  }

  return { permissions: perms, pages: [...pageSet].sort() };
}

export function applyPermissionToggle(
  permissions: ProfilePermission[],
  pages: string[],
  resource: string,
  action: string,
  enabled: boolean
): { permissions: ProfilePermission[]; pages: string[] } {
  let perms = [...permissions];
  let pageList = [...pages];

  if (enabled) {
    if (!hasPerm(perms, resource, action)) {
      perms.push({ resource, action });
    }
  } else {
    perms = perms.filter((p) => !(p.resource === resource && p.action === action));
    if (resource === 'docs' && action === 'view') {
      perms = perms.filter((p) => p.resource !== 'docs');
      pageList = pageList.filter((p) => p !== '/docs');
    }
  }

  return normalizeProfileAccess(perms, pageList);
}

export function applyPageToggle(
  permissions: ProfilePermission[],
  pages: string[],
  pagePath: string,
  enabled: boolean
): { permissions: ProfilePermission[]; pages: string[] } {
  let pageList = [...pages];
  let perms = [...permissions];

  if (enabled) {
    if (!pageList.includes(pagePath)) pageList.push(pagePath);
  } else {
    pageList = pageList.filter((p) => p !== pagePath);
    if (pagePath === '/docs') {
      perms = perms.filter((p) => p.resource !== 'docs');
    }
    const viewPerm = PAGE_TO_VIEW_PERMISSION[pagePath];
    if (viewPerm) {
      perms = perms.filter(
        (p) => !(p.resource === viewPerm.resource && p.action === viewPerm.action)
      );
    }
  }

  return normalizeProfileAccess(perms, pageList);
}

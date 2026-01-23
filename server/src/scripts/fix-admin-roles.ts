/**
 * Script para corrigir roles de usuários baseado em seus perfis de acesso
 * Execute este script para sincronizar o campo 'role' com os perfis de acesso
 */

import { dbGet, dbAll, dbRun } from '../database';

async function fixAdminRoles() {
  try {
    console.log('🔧 Iniciando correção de roles de usuários...\n');

    // Buscar todos os usuários
    const users = await dbAll('SELECT id, name, email, role FROM users');

    console.log(`📋 Encontrados ${users.length} usuários\n`);

    for (const user of users as any[]) {
      // Verificar perfis de acesso
      const profiles = await dbAll(`
        SELECT ap.name
        FROM user_access_profiles uap
        JOIN access_profiles ap ON uap.access_profile_id = ap.id
        WHERE uap.user_id = ?
      `, [user.id]);

      const profileNames = profiles.map((p: any) => p.name);
      const hasAdminProfile = profileNames.includes('Administrador');
      const hasAgentProfile = profileNames.includes('Agente');

      let newRole = user.role;

      // Determinar role baseado nos perfis
      if (hasAdminProfile) {
        newRole = 'admin';
      } else if (hasAgentProfile) {
        newRole = 'agent';
      } else {
        newRole = 'user';
      }

      // Atualizar se necessário
      if (user.role !== newRole) {
        await dbRun('UPDATE users SET role = ? WHERE id = ?', [newRole, user.id]);
        console.log(`✅ ${user.name} (${user.email}): ${user.role} → ${newRole}`);
      } else {
        console.log(`✓  ${user.name} (${user.email}): role correto (${user.role})`);
      }
    }

    console.log('\n✅ Correção de roles concluída!');
  } catch (error) {
    console.error('❌ Erro ao corrigir roles:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  fixAdminRoles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { fixAdminRoles };

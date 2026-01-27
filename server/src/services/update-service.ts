import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseNotes: string | null;
  releaseUrl: string | null;
  lastChecked: string | null;
}

export interface UpdateResult {
  success: boolean;
  message: string;
  output?: string;
  error?: string;
}

// Obter versão atual do package.json
export function getCurrentVersion(): string {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    return packageJson.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// Verificar atualizações no GitHub
export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = getCurrentVersion();
  
  try {
    // Verificar se estamos em um repositório git
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        releaseNotes: null,
        releaseUrl: null,
        lastChecked: new Date().toISOString()
      };
    }

    // Obter informações do repositório remoto
    const { stdout: remoteUrl } = await execAsync('git config --get remote.origin.url');
    const repoUrl = remoteUrl.trim();
    
    // Extrair owner/repo da URL
    let owner: string, repo: string;
    if (repoUrl.includes('github.com')) {
      const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (match) {
        owner = match[1];
        repo = match[2];
      } else {
        throw new Error('Não foi possível extrair informações do repositório');
      }
    } else {
      throw new Error('Repositório não é do GitHub');
    }

    // Verificar última tag/versão
    let latestTag: string;
    try {
      const { stdout: tags } = await execAsync('git fetch --tags && git tag --sort=-v:refname | head -n 1');
      latestTag = tags.trim();
    } catch {
      // Se não houver tags, usar o commit mais recente
      const { stdout: commit } = await execAsync('git rev-parse --short HEAD');
      latestTag = commit.trim();
    }

    // Verificar se há commits novos
    await execAsync('git fetch origin');
    const { stdout: status } = await execAsync('git status -sb');
    const isBehind = status.includes('[behind');

    // Obter informações da API do GitHub (se disponível)
    let releaseNotes: string | null = null;
    let releaseUrl: string | null = null;
    
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
      if (response.ok) {
        const release = await response.json() as { body?: string; html_url?: string; tag_name?: string };
        releaseNotes = release.body || null;
        releaseUrl = release.html_url || null;
        latestTag = release.tag_name || latestTag;
      }
    } catch {
      // Se a API falhar, continuar sem informações de release
    }

    const hasUpdate = isBehind || latestTag !== currentVersion;

    return {
      currentVersion,
      latestVersion: latestTag,
      hasUpdate,
      releaseNotes,
      releaseUrl,
      lastChecked: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Erro ao verificar atualizações:', error);
    return {
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      releaseNotes: null,
      releaseUrl: null,
      lastChecked: new Date().toISOString()
    };
  }
}

// Executar atualização (git pull)
export async function performUpdate(branch: string = 'main'): Promise<UpdateResult> {
  try {
    // Verificar se estamos em um repositório git
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
      return {
        success: false,
        message: 'Não é um repositório Git',
        error: 'Diretório .git não encontrado'
      };
    }

    // Verificar se há mudanças não commitadas
    const { stdout: status } = await execAsync('git status --porcelain');
    if (status.trim()) {
      return {
        success: false,
        message: 'Há mudanças não commitadas',
        error: 'Por favor, faça commit ou stash das mudanças antes de atualizar'
      };
    }

    // Fazer stash de mudanças locais (se houver)
    try {
      await execAsync('git stash');
    } catch {
      // Ignorar se não houver nada para fazer stash
    }

    // Fazer checkout da branch especificada
    try {
      await execAsync(`git checkout ${branch}`);
    } catch {
      // Se a branch não existir localmente, tentar criar a partir da remota
      await execAsync(`git checkout -b ${branch} origin/${branch}`);
    }

    // Fazer pull
    const { stdout, stderr } = await execAsync(`git pull origin ${branch}`);
    
    // Aplicar stash (se houver)
    try {
      await execAsync('git stash pop');
    } catch {
      // Ignorar se não houver stash
    }

    return {
      success: true,
      message: 'Atualização realizada com sucesso',
      output: stdout + (stderr ? '\n' + stderr : '')
    };
  } catch (error: any) {
    console.error('Erro ao atualizar:', error);
    return {
      success: false,
      message: 'Erro ao atualizar',
      error: error.message || 'Erro desconhecido'
    };
  }
}

// Obter histórico de commits recentes
export async function getRecentCommits(limit: number = 10): Promise<any[]> {
  try {
    const { stdout } = await execAsync(`git log --oneline --decorate -n ${limit}`);
    const commits = stdout.trim().split('\n').filter(Boolean).map(line => {
      const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
      if (match) {
        return {
          hash: match[1],
          message: match[2]
        };
      }
      return null;
    }).filter(Boolean);
    
    return commits;
  } catch (error) {
    console.error('Erro ao obter commits:', error);
    return [];
  }
}

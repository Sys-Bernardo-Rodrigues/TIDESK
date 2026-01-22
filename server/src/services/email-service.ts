import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  toEmails: string[];
}

const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  enabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  fromEmail: '',
  fromName: 'TIDESK Backup',
  toEmails: []
};

let transporter: nodemailer.Transporter | null = null;

function createTransporter(config: EmailConfig): nodemailer.Transporter | null {
  if (!config.enabled || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword
    }
  });
}

export async function sendBackupEmail(
  config: EmailConfig,
  backupFilePath: string,
  backupFilename: string,
  backupSize: number
): Promise<void> {
  if (!config.enabled || !config.smtpHost || config.toEmails.length === 0) {
    throw new Error('Configuração de email não está completa ou desativada');
  }

  if (!transporter) {
    transporter = createTransporter(config);
    if (!transporter) {
      throw new Error('Não foi possível criar o transportador de email');
    }
  }

  if (!fs.existsSync(backupFilePath)) {
    throw new Error('Arquivo de backup não encontrado');
  }

  const fileSizeMB = (backupSize / (1024 * 1024)).toFixed(2);
  const date = new Date().toLocaleString('pt-BR');

  const mailOptions = {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: config.toEmails.join(', '),
    subject: `Backup TIDESK - ${backupFilename}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #8a2be2;">Backup do Sistema TIDESK</h2>
        <p>Um backup do banco de dados foi gerado com sucesso.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Arquivo:</strong> ${backupFilename}</p>
          <p><strong>Tamanho:</strong> ${fileSizeMB} MB</p>
          <p><strong>Data:</strong> ${date}</p>
        </div>
        <p>O arquivo de backup está anexado a este email.</p>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Este é um email automático do sistema TIDESK.
        </p>
      </div>
    `,
    text: `
Backup do Sistema TIDESK

Um backup do banco de dados foi gerado com sucesso.

Arquivo: ${backupFilename}
Tamanho: ${fileSizeMB} MB
Data: ${date}

O arquivo de backup está anexado a este email.

Este é um email automático do sistema TIDESK.
    `,
    attachments: [
      {
        filename: backupFilename,
        path: backupFilePath
      }
    ]
  };

  await transporter.sendMail(mailOptions);
}

export function testEmailConfig(config: EmailConfig): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      const testTransporter = createTransporter(config);
      if (!testTransporter) {
        resolve(false);
        return;
      }
      await testTransporter.verify();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

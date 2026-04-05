import { select, input, confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import fs from 'node:fs';
import { FileRepository } from '../infrastructure/storage/file-repository.js';
import { BaileysProvider } from '../infrastructure/whatsapp/baileys-provider.js';
import { CheckpointRepository } from '../infrastructure/storage/checkpoint-repository.js';
import { ReportRepository } from '../infrastructure/storage/report-repository.js';
import { SettingsRepository } from '../infrastructure/storage/settings-repository.js';
import { ValidateContactsUseCase } from '../application/use-cases/validate-contacts.use-case.js';
import { PreviewBulkUseCase } from '../application/use-cases/preview-bulk.use-case.js';
import { BulkSendUseCase } from '../application/use-cases/bulk-send.use-case.js';
import { logger } from '../infrastructure/logging/pino-logger.js';

export async function startMenu() {
  const fileRepository = new FileRepository();
  const messagingProvider = new BaileysProvider();
  const checkpointRepository = new CheckpointRepository();
  const reportRepository = new ReportRepository();
  const settingsRepository = new SettingsRepository();

  const validateUseCase = new ValidateContactsUseCase(fileRepository);
  const previewUseCase = new PreviewBulkUseCase(fileRepository);
  const bulkSendUseCase = new BulkSendUseCase(
    fileRepository, 
    messagingProvider, 
    checkpointRepository, 
    reportRepository
  );

  console.log('\n' + pc.bold(pc.cyan('====================================')));
  console.log(pc.bold(pc.cyan('🚀 WhatsApp Bulk Sender')));
  console.log(pc.bold(pc.cyan('====================================')) + '\n');

  while (true) {
    const currentFile = await getDefaultFile(settingsRepository);

    const action = await select({
      message: `Menu Principal (Arquivo: ${pc.yellow(currentFile)})`,
      choices: [
        { name: '📨 Enviar mensagens (real)', value: 'send' },
        { name: '🔍 Preview de envio (simulação)', value: 'preview' },
        { name: '✅ Validar lista de contatos', value: 'validate' },
        { name: '⚙️  Alterar arquivo de contatos', value: 'config' },
        { name: '❌ Sair', value: 'exit' },
      ],
    });

    if (action === 'exit') {
      console.log(pc.yellow('\n👋 Encerrando aplicação... Até logo!\n'));
      process.exit(0);
    }

    if (action === 'config') {
      await askForFile(settingsRepository);
      continue;
    }

    try {
      if (action === 'validate') {
        await validateUseCase.execute(currentFile);
      } else if (action === 'preview') {
        const messageText = await input({
          message: 'Digite a mensagem (use {{name}} para personalizar):',
          default: 'Olá {{name}}, tudo bem?',
        });

        const items = await previewUseCase.getPreviewItems(currentFile, messageText);
        
        console.log('\n' + pc.bold(pc.cyan('📋 Preview da Campanha')) + '\n');
        console.log(`${pc.gray('Total de contatos:')} ${pc.bold(items.length)}\n`);

        for (const item of items) {
          console.log(`${pc.cyan(item.index)}. ${pc.bold(item.name)} ${pc.gray('→')} ${pc.yellow(item.phone)}`);
          console.log(`   ${pc.gray('Mensagem:')} "${pc.italic(item.message)}"\n`);
        }

        const confirmSim = await confirm({
          message: pc.white('Confirmar simulação passo a passo?'),
          default: true,
        });

        if (confirmSim) {
          await previewUseCase.executeSimulation(items);
        } else {
          console.log(pc.gray('\nSimulação pulada.\n'));
        }

      } else if (action === 'send') {
        process.stdout.write(pc.bold(pc.cyan('\n📨 Envio de Mensagens\n')));
        process.stdout.write(`${pc.gray('• Arquivo:')} ${pc.yellow(currentFile)}\n`);

        const message = await input({
          message: 'Digite a mensagem:',
          default: 'Olá {{name}}, esta é uma mensagem automática.',
        });

        process.stdout.write(`\n${pc.gray('• Mensagem:')} "${pc.italic(message)}"\n`);

        const isConfirmed = await confirm({
          message: pc.red(pc.bold('⚠️  Confirmar o envio das mensagens reais agora?')),
          default: false,
        });

        if (isConfirmed) {
          const controller = new AbortController();
          process.on('SIGINT', () => controller.abort());
          await bulkSendUseCase.execute(currentFile, message, true, controller.signal);
        } else {
          console.log(pc.yellow('\nOperação cancelada.\n'));
        }
      }
      
      await pressEnterToContinue();

    } catch (error: any) {
      console.error(pc.red(`\n❌ Ocorreu um erro: ${error.message}\n`));
      logger.error({ error }, 'Menu Action Error');
      await pressEnterToContinue();
    }

    console.log(pc.gray('\n' + '-'.repeat(40) + '\n'));
  }
}

async function pressEnterToContinue(): Promise<void> {
  console.log('\n');
  await input({
    message: pc.gray('Pressione Enter para retornar ao menu principal...'),
  });
}

async function getDefaultFile(settingsRepository: SettingsRepository): Promise<string> {
  const settings = settingsRepository.load();
  if (settings.lastFilePath && fs.existsSync(settings.lastFilePath)) {
    return settings.lastFilePath;
  }

  const fallback = 'contacts.example.csv';
  if (fs.existsSync(fallback)) {
    settingsRepository.save({ lastFilePath: fallback });
    return fallback;
  }

  const filesInDir = fs.readdirSync('.').filter(f => f.endsWith('.csv') || f.endsWith('.json'));
  if (filesInDir.length > 0) {
    settingsRepository.save({ lastFilePath: filesInDir[0] });
    return filesInDir[0];
  }

  console.log(pc.yellow('\nNenhum arquivo de contatos padrão encontrado. Selecione um:'));
  const file = await askForFile(settingsRepository);
  if (!file) throw new Error('Operação cancelada: Nenhum arquivo selecionado.');
  return file;
}

async function askForFile(settingsRepository: SettingsRepository): Promise<string | null> {
  const filesInDir = fs.readdirSync('.')
    .filter(f => (f.endsWith('.csv') || f.endsWith('.json')) && !f.startsWith('.'));
  
  const choices: any[] = filesInDir.map(f => ({ name: f, value: f }));
  
  choices.push({ name: '✍️  Digitar caminho manualmente...', value: 'manual' });
  choices.push({ name: '🔙 Voltar ao menu principal', value: 'back' });

  const selection = await select({
    message: 'Selecione o arquivo de contatos:',
    choices,
  });

  if (selection === 'back') return null;

  let finalPath = selection;
  if (selection === 'manual') {
    finalPath = await input({
      message: 'Informe o caminho do arquivo (CSV/JSON):',
      validate: (input) => fs.existsSync(input) || 'Arquivo não encontrado!',
    });
  }

  settingsRepository.save({ lastFilePath: finalPath });
  return finalPath;
}

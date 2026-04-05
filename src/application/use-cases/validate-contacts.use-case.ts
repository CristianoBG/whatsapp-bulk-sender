import pc from 'picocolors';
import { FileRepository } from '../../infrastructure/storage/file-repository.js';
import { logger } from '../../infrastructure/logging/pino-logger.js';

export class ValidateContactsUseCase {
  constructor(private fileRepository: FileRepository) {}

  async execute(filePath: string): Promise<void> {
    logger.info({ filePath }, 'Starting professional validation report');
    
    try {
      const report = await this.fileRepository.readContacts(filePath);
      
      console.log('\n' + pc.bold(pc.cyan('=== Resultado da Validação ===')) + '\n');
      
      console.log(`${pc.green('✅ Válidos:')} ${pc.bold(report.valid.length)}`);
      console.log(`${pc.red('❌ Inválidos:')} ${pc.bold(report.invalid.length)}`);
      
      if (report.invalid.length > 0) {
        console.log('\n' + pc.bold(pc.red('Erros Detalhados:')));
        console.log(pc.gray('----------------------------------------'));
        
        for (const err of report.invalid) {
          const lineInfo = pc.yellow(`Linha ${err.line}`);
          const phoneInfo = err.phone ? pc.gray(` (${err.phone})`) : '';
          const reasons = err.errors.join(', ');
          
          console.log(`${pc.red('•')} ${lineInfo}: ${reasons}${phoneInfo}`);
        }
        
        console.log(pc.gray('----------------------------------------'));
      }

      if (report.valid.length > 0 && report.invalid.length === 0) {
        console.log('\n' + pc.green('⭐ Tudo limpo! A lista está pronta para o disparo.'));
      } else if (report.valid.length > 0) {
        console.log('\n' + pc.yellow('⚠️  Atenção: A lista possui contatos válidos, mas ignore os erros acima.'));
      } else {
        console.log('\n' + pc.bgRed(pc.white(' ❌ ERRO CRÍTICO: Nenhum contato válido encontrado. ')));
      }
      
      console.log(''); // New line at the end
      
    } catch (error: any) {
      logger.error({ error: error.message }, 'Validation failed');
      console.error(pc.red(`\n❌ Falha fatal ao ler arquivo: ${error.message}\n`));
      throw error;
    }
  }
}


import { ActiveDefense } from '../active-defense';

export async function runCommand(cmdArgs: string[]) {
  if (cmdArgs.length === 0) {
    console.error('Usage: agent-guard run <command> [args...]');
    process.exit(1);
  }

  const [command, ...args] = cmdArgs;
  await ActiveDefense.run(command, args);
}

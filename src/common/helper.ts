import { execSync } from 'child_process';

/**
 * 可重用的Shell命令执行Helper函数 - 同步执行
 */
export function executeShellCommand(
  scriptPath: string,
  args: string[] = [],
  options?: {
    encoding?: BufferEncoding;
    maxBuffer?: number;
    cwd?: string;
  },
): string {
  try {
    const escapedArgs = args.map((arg) => `"${arg}"`).join(' ');
    const command = `bash -lc 'bash ${scriptPath} ${escapedArgs}'`;

    console.log(
      `Executing script (sync): ${scriptPath} with args: [${args.join(', ')}]`,
    );
    const result = execSync(command, {
      encoding: options?.encoding || 'utf-8',
      maxBuffer: options?.maxBuffer || 10 * 1024 * 1024, // 10MB buffer
      cwd: options?.cwd || process.cwd(),
    });
    return result.toString();
  } catch (error) {
    console.error(`Shell script failed: ${scriptPath}`, error);
    throw new Error(`Shell script execution failed: ${error.message}`);
  }
}

export function executeCMD(
  cmd: string,
  options?: {
    encoding?: BufferEncoding;
    maxBuffer?: number;
    cwd?: string;
  },
): string {
  return execSync(cmd, {
    encoding: options?.encoding || 'utf8',
    maxBuffer: options?.maxBuffer || 10 * 1024 * 1024,
    cwd: options?.cwd || process.cwd(),
  });
}

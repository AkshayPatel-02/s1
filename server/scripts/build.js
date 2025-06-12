import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function build() {
  try {
    // Clean dist directory
    console.log('Cleaning dist directory...');
    await execAsync('npm run clean');

    // Run TypeScript compiler
    console.log('Compiling TypeScript...');
    await execAsync('tsc');

    // Verify output
    console.log('Verifying build output...');
    const distDir = path.join(process.cwd(), 'dist');
    const files = await fs.readdir(distDir);
    
    if (files.length === 0) {
      throw new Error('No files were generated in dist directory');
    }

    console.log('Build completed successfully. Generated files:');
    for (const file of files) {
      const stats = await fs.stat(path.join(distDir, file));
      if (stats.isDirectory()) {
        const subFiles = await fs.readdir(path.join(distDir, file));
        console.log(`- ${file}/`);
        subFiles.forEach(subFile => console.log(`  - ${subFile}`));
      } else {
        console.log(`- ${file}`);
      }
    }

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build(); 
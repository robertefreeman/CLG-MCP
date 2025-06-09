#!/usr/bin/env tsx

/**
 * Deployment script for CLG-MCP Cloudflare Workers
 * 
 * This script handles the complete deployment process including:
 * - Environment validation
 * - KV namespace setup
 * - Build and deployment
 * - Post-deployment verification
 * 
 * Usage: npm run deploy:full
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface DeploymentConfig {
  environment: 'development' | 'production';
  kvNamespace?: string;
  kvPreviewNamespace?: string;
  workerName: string;
  customDomain?: string;
}

const DEFAULT_CONFIG: DeploymentConfig = {
  environment: 'production',
  workerName: 'clg-mcp',
};

class DeploymentManager {
  private config: DeploymentConfig;
  
  constructor(config: Partial<DeploymentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async deploy(): Promise<void> {
    console.log('🚀 Starting CLG-MCP deployment...\n');
    
    try {
      await this.validateEnvironment();
      await this.setupKVNamespaces();
      await this.buildProject();
      await this.deployWorker();
      await this.verifyDeployment();
      
      console.log('\n✅ Deployment completed successfully!');
      this.printDeploymentInfo();
    } catch (error) {
      console.error('\n❌ Deployment failed:', error);
      process.exit(1);
    }
  }

  private async validateEnvironment(): Promise<void> {
    console.log('🔍 Validating environment...');
    
    // Check if wrangler is installed
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
      console.log('✓ Wrangler CLI found');
    } catch {
      throw new Error('Wrangler CLI not found. Install with: npm install -g wrangler');
    }

    // Check if user is authenticated
    try {
      execSync('wrangler whoami', { stdio: 'pipe' });
      console.log('✓ Cloudflare authentication verified');
    } catch {
      throw new Error('Not authenticated with Cloudflare. Run: wrangler login');
    }

    // Check if wrangler.toml exists
    try {
      readFileSync('wrangler.toml');
      console.log('✓ wrangler.toml configuration found');
    } catch {
      throw new Error('wrangler.toml not found in project root');
    }
  }

  private async setupKVNamespaces(): Promise<void> {
    console.log('\n📦 Setting up KV namespaces...');
    
    const wranglerTomlPath = join(process.cwd(), 'wrangler.toml');
    let wranglerConfig = readFileSync(wranglerTomlPath, 'utf8');
    
    // Check if production KV namespace exists
    if (wranglerConfig.includes('your-kv-namespace-id')) {
      console.log('⚠️  Creating production KV namespace...');
      
      try {
        const output = execSync('wrangler kv:namespace create "CACHE"', { encoding: 'utf8' });
        const namespaceIdMatch = output.match(/id = "([^"]+)"/);
        
        if (namespaceIdMatch) {
          const namespaceId = namespaceIdMatch[1];
          wranglerConfig = wranglerConfig.replace(
            'id = "your-kv-namespace-id"',
            `id = "${namespaceId}"`
          );
          console.log(`✓ Production KV namespace created: ${namespaceId}`);
        }
      } catch (error) {
        console.log('ℹ️  KV namespace may already exist or user needs to create manually');
      }
    }

    // Check if preview KV namespace exists
    if (wranglerConfig.includes('your-kv-preview-id')) {
      console.log('⚠️  Creating preview KV namespace...');
      
      try {
        const output = execSync('wrangler kv:namespace create "CACHE" --preview', { encoding: 'utf8' });
        const previewIdMatch = output.match(/preview_id = "([^"]+)"/);
        
        if (previewIdMatch) {
          const previewId = previewIdMatch[1];
          wranglerConfig = wranglerConfig.replace(
            'preview_id = "your-kv-preview-id"',
            `preview_id = "${previewId}"`
          );
          console.log(`✓ Preview KV namespace created: ${previewId}`);
        }
      } catch (error) {
        console.log('ℹ️  Preview KV namespace may already exist or user needs to create manually');
      }
    }

    // Write updated config back to file
    writeFileSync(wranglerTomlPath, wranglerConfig);
    console.log('✓ wrangler.toml updated with KV namespace IDs');
  }

  private async buildProject(): Promise<void> {
    console.log('\n🔨 Building project...');
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✓ Project built successfully');
    } catch {
      throw new Error('Build failed. Check TypeScript compilation errors.');
    }
  }

  private async deployWorker(): Promise<void> {
    console.log('\n🚀 Deploying to Cloudflare Workers...');
    
    const deployCommand = this.config.environment === 'production' 
      ? 'wrangler deploy --env production'
      : 'wrangler deploy --env development';
    
    try {
      execSync(deployCommand, { stdio: 'inherit' });
      console.log('✓ Worker deployed successfully');
    } catch {
      throw new Error('Deployment to Cloudflare Workers failed');
    }
  }

  private async verifyDeployment(): Promise<void> {
    console.log('\n🔍 Verifying deployment...');
    
    // Get worker URL
    const workerUrl = this.getWorkerUrl();
    
    try {
      // Simple health check
      const response = await fetch(`${workerUrl}/health`);
      if (response.ok) {
        console.log('✓ Deployment health check passed');
      } else {
        console.log('⚠️  Health check returned non-200 status');
      }
    } catch (error) {
      console.log('⚠️  Could not verify deployment health:', error);
    }
  }

  private getWorkerUrl(): string {
    // Try to get custom domain first, otherwise use workers.dev
    if (this.config.customDomain) {
      return `https://${this.config.customDomain}`;
    }
    
    // Default workers.dev URL format
    return `https://${this.config.workerName}.YOUR_SUBDOMAIN.workers.dev`;
  }

  private printDeploymentInfo(): void {
    console.log('\n📋 Deployment Information:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Worker Name: ${this.config.workerName}`);
    console.log(`Worker URL: ${this.getWorkerUrl()}`);
    console.log('\n📖 Next Steps:');
    console.log('1. Update your MCP client configuration with the worker URL');
    console.log('2. Test the connection using: npm run test:connection');
    console.log('3. Monitor your worker in the Cloudflare dashboard');
    console.log('\n💡 Tip: Run "wrangler tail" to see real-time logs');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const environment = args.includes('--dev') ? 'development' : 'production';
  
  const deployment = new DeploymentManager({ environment });
  await deployment.deploy();
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { DeploymentManager };
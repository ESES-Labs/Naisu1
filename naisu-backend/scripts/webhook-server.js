#!/usr/bin/env bun
/**
 * Naisu Backend - Webhook Deployment Server
 * 
 * Alternative deployment method using webhooks instead of SSH.
 * GitHub Actions sends webhook to this server, which pulls and deploys.
 * 
 * Usage:
 *   bun run webhook-server.js
 *   
 * Environment variables:
 *   WEBHOOK_PORT - Port to listen on (default: 9000)
 *   WEBHOOK_SECRET - Secret token for authentication
 *   DEPLOY_PATH - Path to deployment directory
 *   DOCKER_USERNAME - Docker Hub username
 */

import { serve } from 'bun'
import { execSync } from 'child_process'
import { createHmac } from 'crypto'

// Configuration
const CONFIG = {
  port: parseInt(process.env.WEBHOOK_PORT || '9000'),
  secret: process.env.WEBHOOK_SECRET || '',
  deployPath: process.env.DEPLOY_PATH || '/opt/naisu-backend',
  dockerUsername: process.env.DOCKER_USERNAME || '',
  healthCheckUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:3000/api/v1/health',
  allowedIPs: (process.env.ALLOWED_IPS || '').split(',').filter(Boolean),
}

// Logging
const log = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
}

// Verify GitHub webhook signature
function verifySignature(body, signature) {
  if (!CONFIG.secret) {
    log.warn('WEBHOOK_SECRET not set, skipping signature verification')
    return true
  }
  
  const hmac = createHmac('sha256', CONFIG.secret)
  hmac.update(body)
  const digest = 'sha256=' + hmac.digest('hex')
  
  return digest === signature
}

// Verify client IP
function verifyIP(remoteAddr) {
  if (CONFIG.allowedIPs.length === 0) {
    return true
  }
  
  const ip = remoteAddr.replace(/^.*:/, '') // Remove IPv6 prefix if present
  return CONFIG.allowedIPs.includes(ip)
}

// Execute deployment
async function deploy(imageTag = 'latest') {
  log.info(`Starting deployment for image: ${CONFIG.dockerUsername}/naisu-backend:${imageTag}`)
  
  try {
    // Pull latest image
    log.info('Pulling Docker image...')
    execSync(`docker pull ${CONFIG.dockerUsername}/naisu-backend:${imageTag}`, {
      stdio: 'inherit',
      cwd: CONFIG.deployPath
    })
    
    // Deploy using docker-compose
    log.info('Restarting services...')
    execSync('docker-compose -f docker-compose.prod.yml down && docker-compose -f docker-compose.prod.yml up -d', {
      stdio: 'inherit',
      cwd: CONFIG.deployPath
    })
    
    // Wait for startup
    log.info('Waiting for services to start...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Health check
    log.info('Running health check...')
    const healthCheck = await fetch(CONFIG.healthCheckUrl)
    
    if (!healthCheck.ok) {
      throw new Error(`Health check failed: ${healthCheck.status}`)
    }
    
    // Cleanup
    log.info('Cleaning up old images...')
    execSync('docker image prune -af --filter "until=168h"', { stdio: 'ignore' })
    
    log.success('Deployment complete!')
    return { success: true, message: 'Deployment successful' }
    
  } catch (error) {
    log.error(`Deployment failed: ${error.message}`)
    return { success: false, message: error.message }
  }
}

// Main server
const server = serve({
  port: CONFIG.port,
  async fetch(request, server) {
    const url = new URL(request.url)
    const remoteAddr = server.requestIP(request)?.address || 'unknown'
    
    log.info(`${request.method} ${url.pathname} from ${remoteAddr}`)
    
    // Verify IP
    if (!verifyIP(remoteAddr)) {
      log.warn(`Rejected request from unauthorized IP: ${remoteAddr}`)
      return new Response(JSON.stringify({ error: 'Unauthorized IP' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Deploy endpoint
    if (url.pathname === '/deploy' && request.method === 'POST') {
      try {
        const body = await request.text()
        const signature = request.headers.get('x-hub-signature-256') || 
                         request.headers.get('x-signature')
        
        // Verify signature
        if (!verifySignature(body, signature)) {
          log.error('Invalid webhook signature')
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        // Parse payload
        let payload
        try {
          payload = JSON.parse(body)
        } catch {
          payload = {}
        }
        
        const imageTag = payload.image?.split(':').pop() || 'latest'
        
        // Run deployment
        const result = await deploy(imageTag)
        
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' }
        })
        
      } catch (error) {
        log.error(`Error processing deploy request: ${error.message}`)
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    // 404 for other routes
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  },
})

log.info(`Webhook server running on port ${CONFIG.port}`)
log.info(`Deploy path: ${CONFIG.deployPath}`)
log.info(`Endpoints:`)
log.info(`  - GET  /health - Health check`)
log.info(`  - POST /deploy - Trigger deployment`)

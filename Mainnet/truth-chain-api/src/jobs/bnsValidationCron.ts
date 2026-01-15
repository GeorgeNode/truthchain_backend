/**
 * CHECKPOINT 7: BNS Validation Cron Job
 * Periodically validates BNS ownership for all registrations
 * Runs every 24 hours to detect transfers
 */

import { bnsValidationService } from '../services/BNSValidationService';

const VALIDATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

let validationTimer: NodeJS.Timeout | null = null;

/**
 * Start the BNS validation cron job
 */
export function startBNSValidationCron(): void {
  if (validationTimer) {
    console.log('⚠️  BNS validation cron already running');
    return;
  }

  console.log('🚀 Starting BNS validation cron job (24-hour interval)');

  // Run immediately on startup (after 5 minute delay to allow system to stabilize)
  setTimeout(async () => {
    console.log('⏰ Running initial BNS validation...');
    await runValidation();
  }, 5 * 60 * 1000);

  // Then run every 24 hours
  validationTimer = setInterval(async () => {
    console.log('⏰ Running scheduled BNS validation...');
    await runValidation();
  }, VALIDATION_INTERVAL);

  console.log('✅ BNS validation cron job started successfully');
}

/**
 * Stop the BNS validation cron job
 */
export function stopBNSValidationCron(): void {
  if (validationTimer) {
    clearInterval(validationTimer);
    validationTimer = null;
    console.log('🛑 BNS validation cron job stopped');
  }
}

/**
 * Run validation for all stale registrations
 */
async function runValidation(): Promise<void> {
  try {
    console.log('🔍 Starting BNS validation batch...');
    const startTime = Date.now();

    const result = await bnsValidationService.validateStaleRegistrations();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ BNS validation completed:', {
      validated: result,
      duration: `${duration}s`
    });

  } catch (error) {
    console.error('❌ BNS validation failed:', error);
  }
}

/**
 * Manually trigger validation (for testing or admin endpoints)
 */
export async function triggerManualValidation(): Promise<number> {
  console.log('🔧 Manual BNS validation triggered');
  const result = await bnsValidationService.validateStaleRegistrations();
  return result;
}

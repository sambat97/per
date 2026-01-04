const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./logger');
const fs = require('fs');

class SheerIDAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      logger.info('Initializing browser for document upload...');
      
      this.browser = await chromium.launch({
        headless: config.HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      });

      this.page = await context.newPage();
      this.page.setDefaultTimeout(config.TIMEOUT);

      logger.success('Browser initialized');
    } catch (error) {
      logger.error('Failed to initialize browser', { error: error.message });
      throw error;
    }
  }

  async navigateToVerificationPage(url) {
    try {
      logger.info('Opening verification page');
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await this.page.waitForLoadState('domcontentloaded');
      
      logger.success('Page loaded');
    } catch (error) {
      logger.error('Navigation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Trigger upload document by clicking Portal Login → Back
   */
  async triggerDocumentUpload() {
    try {
      logger.info('Attempting to trigger document upload option...');

      // Screenshot awal
      await this.screenshot('/tmp/before_trigger.png');

      // Cari tombol Portal/Login
      const portalSelectors = [
        'button:has-text("Portal")',
        'a:has-text("Portal")',
        'button:has-text("Student Portal")',
        'button:has-text("Login")',
        'a:has-text("Login to Portal")',
        'button:has-text("Access Portal")',
        '[data-testid="portal-button"]'
      ];

      let portalButton = null;
      let usedSelector = null;

      for (const selector of portalSelectors) {
        try {
          portalButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (portalButton) {
            usedSelector = selector;
            logger.info('Portal button found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!portalButton) {
        logger.warn('Portal button not found, checking if upload already visible');
        
        // Cek apakah upload sudah langsung muncul
        const uploadInput = await this.page.$('input[type="file"]');
        if (uploadInput) {
          logger.info('Upload input already visible, skipping portal flow');
          return { triggered: true, method: 'already_visible' };
        }

        return { triggered: false, method: 'portal_not_found' };
      }

      // Klik Portal button
      logger.info('Clicking portal button...');
      await portalButton.click();
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000);
      
      await this.screenshot('/tmp/after_portal_click.png');

      // Klik tombol Back/Kembali
      const backSelectors = [
        'button:has-text("Back")',
        'button:has-text("Kembali")',
        'button:has-text("Return")',
        'button:has-text("Cancel")',
        'a:has-text("Back")',
        '[data-testid="back-button"]'
      ];

      let backButton = null;
      for (const selector of backSelectors) {
        try {
          backButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (backButton) {
            logger.info('Back button found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (backButton) {
        logger.info('Clicking back button...');
        await backButton.click();
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(2000);
        
        await this.screenshot('/tmp/after_back_click.png');
        logger.success('Portal → Back flow completed');
        
        return { triggered: true, method: 'portal_back_flow' };
      }

      logger.warn('Back button not found, trying browser back');
      await this.page.goBack();
      await this.page.waitForLoadState('networkidle');
      
      return { triggered: true, method: 'browser_back' };

    } catch (error) {
      logger.error('Failed to trigger document upload', { error: error.message });
      return { triggered: false, error: error.message };
    }
  }

  /**
   * Upload document (student ID card)
   */
  async uploadDocument(imageBuffer) {
    const tempFilePath = `/tmp/student_id_${Date.now()}.png`;
    
    try {
      logger.info('Looking for file upload input...');

      // Wait for file input
      const fileInput = await this.page.waitForSelector('input[type="file"]', { timeout: 15000 });
      
      if (!fileInput) {
        throw new Error('File upload input not found');
      }

      logger.info('File input found, uploading document...');

      // Write temp file
      fs.writeFileSync(tempFilePath, imageBuffer);
      logger.debug('Temp file created', { size: imageBuffer.length });

      // Upload
      await fileInput.setInputFiles(tempFilePath);
      await this.page.waitForTimeout(2000);
      
      await this.screenshot('/tmp/after_file_upload.png');
      logger.success('Document uploaded');

      // Cari dan klik submit button (kalau ada)
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Upload")',
        'button:has-text("Done")',
        'button:has-text("Complete")',
        'button:has-text("Finish")'
      ];

      for (const selector of submitSelectors) {
        try {
          const submitBtn = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (submitBtn) {
            logger.info('Submit button found, clicking...', { selector });
            await submitBtn.click();
            await this.page.waitForLoadState('networkidle');
            await this.screenshot('/tmp/after_submit.png');
            logger.success('Upload submitted');
            break;
          }
        } catch (e) {
          continue;
        }
      }

      return { success: true };

    } catch (error) {
      logger.error('Failed to upload document', { error: error.message });
      await this.screenshot('/tmp/upload_error.png');
      throw error;
    } finally {
      // Cleanup
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.debug('Temp file cleaned up');
        } catch (e) {
          logger.warn('Failed to cleanup temp file', { error: e.message });
        }
      }
    }
  }

  /**
   * Check verification status from page
   */
  async checkVerificationStatus() {
    try {
      await this.screenshot('/tmp/status_check.png');

      // Success patterns
      const successPatterns = [
        'text=/verified/i',
        'text=/success/i',
        'text=/approved/i',
        'text=/complete/i'
      ];

      for (const pattern of successPatterns) {
        const element = await this.page.$(pattern);
        if (element) {
          const text = await element.textContent();
          return { status: 'success', message: text.trim() };
        }
      }

      // Pending patterns
      const pendingPatterns = [
        'text=/pending/i',
        'text=/review/i',
        'text=/processing/i',
        'text=/under review/i'
      ];

      for (const pattern of pendingPatterns) {
        const element = await this.page.$(pattern);
        if (element) {
          const text = await element.textContent();
          return { status: 'pending', message: text.trim() };
        }
      }

      // Failed patterns
      const failedPatterns = [
        'text=/failed/i',
        'text=/rejected/i',
        'text=/error/i',
        'text=/invalid/i'
      ];

      for (const pattern of failedPatterns) {
        const element = await this.page.$(pattern);
        if (element) {
          const text = await element.textContent();
          return { status: 'failed', message: text.trim() };
        }
      }

      return { status: 'unknown', message: 'Status tidak dapat ditentukan' };

    } catch (error) {
      logger.error('Failed to check status', { error: error.message });
      return { status: 'error', message: error.message };
    }
  }

  async screenshot(filename) {
    try {
      await this.page.screenshot({ path: filename, fullPage: true });
      logger.info(`Screenshot saved: ${filename}`);
    } catch (error) {
      logger.warn('Screenshot failed', { error: error.message });
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('Browser closed');
      }
    } catch (error) {
      logger.error('Failed to close browser', { error: error.message });
    }
  }
}

module.exports = SheerIDAutomation;

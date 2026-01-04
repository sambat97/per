const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./logger');

class SheerIDAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      logger.info('Initializing Playwright browser...');
      
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
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      this.page = await context.newPage();
      this.page.setDefaultTimeout(config.TIMEOUT);
      
      logger.success('Browser initialized');
    } catch (error) {
      logger.error('Failed to initialize browser', { error: error.message });
      throw error;
    }
  }

  async navigateToVerificationURL(url) {
    try {
      logger.info('Navigating to verification URL');
      await this.page.goto(url, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);
      logger.success('Page loaded');
    } catch (error) {
      logger.error('Navigation failed', { error: error.message });
      throw error;
    }
  }

  async fillPersonalInfo(data) {
    try {
      logger.info('Filling personal information form');

      await this.page.waitForSelector('input[name="firstName"], input#firstName', { timeout: 10000 });

      await this.page.fill('input[name="firstName"], input#firstName', data.firstName);
      logger.debug('Filled first name');

      await this.page.fill('input[name="lastName"], input#lastName', data.lastName);
      logger.debug('Filled last name');

      if (data.birthDate) {
        const birthParts = data.birthDate.split('-');
        
        const dateField = await this.page.$('input[name="birthDate"], input[type="date"]');
        if (dateField) {
          await dateField.fill(data.birthDate);
        } else {
          await this.page.fill('select[name="birthDay"], input[name="day"]', birthParts[2]);
          await this.page.selectOption('select[name="birthMonth"], select[name="month"]', birthParts[1]);
          await this.page.fill('input[name="birthYear"], input[name="year"]', birthParts[0]);
        }
        logger.debug('Filled birth date');
      }

      await this.page.fill('input[name="email"], input[type="email"]', data.email);
      logger.debug('Filled email');

      await this.page.waitForTimeout(1000);
      logger.success('Personal info filled');
    } catch (error) {
      logger.error('Failed to fill personal info', { error: error.message });
      throw error;
    }
  }

  async selectUniversity(universityName) {
    try {
      logger.info('Selecting university', { universityName });

      await this.page.click('input[name="organization"], input[placeholder*="university"], input[placeholder*="school"]');
      await this.page.waitForTimeout(500);

      await this.page.fill('input[name="organization"], input[placeholder*="university"], input[placeholder*="school"]', universityName);
      await this.page.waitForTimeout(2000);

      await this.page.waitForSelector('div[role="option"], li[role="option"], .organization-option', { timeout: 5000 });
      await this.page.click('div[role="option"]:first-child, li[role="option"]:first-child, .organization-option:first-child');
      
      logger.success('University selected');
    } catch (error) {
      logger.error('Failed to select university', { error: error.message });
      throw error;
    }
  }

  async submitForm() {
    try {
      logger.info('Submitting form');
      
      await this.page.click('button[type="submit"], button:has-text("Submit"), button:has-text("Verify"), button:has-text("Continue")');
      await this.page.waitForTimeout(3000);
      
      logger.success('Form submitted');
    } catch (error) {
      logger.error('Failed to submit form', { error: error.message });
      throw error;
    }
  }

  async clickPortalLoginAndBack() {
    try {
      logger.info('Looking for portal login button...');

      const portalButton = await this.page.waitForSelector(
        'button:has-text("Portal"), a:has-text("Portal"), button:has-text("Login"), a:has-text("Student Portal")',
        { timeout: 10000 }
      );

      if (portalButton) {
        logger.info('Portal login button found, clicking...');
        await portalButton.click();
        await this.page.waitForTimeout(2000);

        logger.info('Clicking back button...');
        await this.page.click('button:has-text("Back"), button:has-text("Kembali"), button:has-text("Return"), a:has-text("Back")');
        await this.page.waitForTimeout(2000);
        
        logger.success('Clicked portal and returned');
        return true;
      }

      logger.warn('Portal button not found, proceeding...');
      return false;
    } catch (error) {
      logger.warn('Portal click flow skipped', { error: error.message });
      return false;
    }
  }

  async uploadDocument(imageBuffer) {
    try {
      logger.info('Uploading document...');

      const fileInput = await this.page.waitForSelector('input[type="file"]', { timeout: 10000 });
      
      const tempFilePath = '/tmp/student_id.png';
      const fs = require('fs');
      fs.writeFileSync(tempFilePath, imageBuffer);

      await fileInput.setInputFiles(tempFilePath);
      await this.page.waitForTimeout(2000);

      logger.success('Document uploaded');

      const submitBtn = await this.page.$('button[type="submit"]:has-text("Submit"), button:has-text("Upload"), button:has-text("Complete")');
      if (submitBtn) {
        await submitBtn.click();
        await this.page.waitForTimeout(3000);
        logger.success('Upload submitted');
      }

      fs.unlinkSync(tempFilePath);
    } catch (error) {
      logger.error('Failed to upload document', { error: error.message });
      throw error;
    }
  }

  async checkVerificationStatus() {
    try {
      const successIndicator = await this.page.$('text=/success|verified|approved|complete/i');
      if (successIndicator) {
        return { status: 'success', message: 'Verification successful!' };
      }

      const pendingIndicator = await this.page.$('text=/pending|review|processing/i');
      if (pendingIndicator) {
        return { status: 'pending', message: 'Verification pending review' };
      }

      const errorIndicator = await this.page.$('text=/error|failed|rejected/i');
      if (errorIndicator) {
        const errorText = await errorIndicator.textContent();
        return { status: 'failed', message: errorText };
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
      logger.error('Screenshot failed', { error: error.message });
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

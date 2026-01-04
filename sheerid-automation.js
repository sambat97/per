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

  async navigateToVerificationURL(url) {
    try {
      logger.info('Navigating to verification URL');
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await this.page.waitForLoadState('domcontentloaded');
      
      // Screenshot untuk debug
      await this.debugScreenshot('after_navigation');
      
      logger.success('Page loaded');
    } catch (error) {
      logger.error('Navigation failed', { error: error.message });
      throw error;
    }
  }

  async selectUniversity(universityName) {
    try {
      logger.info('Attempting to select university', { universityName });

      // Screenshot before selection
      await this.debugScreenshot('before_university_selection');

      // Log semua input fields untuk debugging
      const allInputs = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          type: input.type,
          className: input.className,
          value: input.value
        }));
      });
      logger.info('All input fields on page', { count: allInputs.length, inputs: allInputs });

      // Cek apakah universitas sudah terisi
      const prefilledValue = await this.page.evaluate(() => {
        const orgInput = document.querySelector('input[name="organization"]') ||
                        document.querySelector('input[id*="organi"]') ||
                        document.querySelector('input[placeholder*="university"]') ||
                        document.querySelector('input[placeholder*="school"]');
        return orgInput ? orgInput.value : null;
      });

      if (prefilledValue && prefilledValue.length > 0) {
        logger.info('University field already filled', { value: prefilledValue });
        return;
      }

      // Try multiple selectors
      const selectors = [
        'input[name="organization"]',
        'input[id="organization"]',
        'input[placeholder*="university" i]',
        'input[placeholder*="school" i]',
        'input[placeholder*="organisation" i]',
        '[data-testid="university-input"]',
        'input[type="text"]',
        'input[type="search"]'
      ];

      let inputElement = null;
      let foundSelector = null;

      for (const selector of selectors) {
        try {
          inputElement = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (inputElement) {
            foundSelector = selector;
            logger.info('Found university input', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!inputElement) {
        logger.warn('University input field not found, checking if form is already complete');
        await this.debugScreenshot('university_input_not_found');
        
        // Check if we can proceed without selecting university
        const continueButton = await this.page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Next")');
        if (continueButton) {
          logger.info('Form appears ready, skipping university selection');
          return;
        }
        
        throw new Error('University input field not found and cannot continue');
      }

      // Click input field
      await inputElement.click();
      await this.page.waitForTimeout(500);

      // Clear and type university name
      await inputElement.fill('');
      await this.page.waitForTimeout(300);
      
      // Type slowly to trigger autocomplete
      for (const char of universityName) {
        await inputElement.type(char, { delay: 100 });
      }

      logger.info('Typed university name, waiting for dropdown');
      await this.page.waitForTimeout(2000);

      // Screenshot after typing
      await this.debugScreenshot('after_typing_university');

      // Try to find and click dropdown option
      const dropdownSelectors = [
        'div[role="option"]:first-child',
        'li[role="option"]:first-child',
        '.dropdown-item:first-child',
        '.autocomplete-option:first-child',
        '[data-testid="university-option"]:first-child',
        '.organization-option:first-child',
        'ul[role="listbox"] li:first-child'
      ];

      let optionClicked = false;
      for (const selector of dropdownSelectors) {
        try {
          const option = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (option) {
            await option.click();
            logger.success('University option clicked', { selector });
            optionClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!optionClicked) {
        logger.warn('No dropdown option found, pressing Enter');
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(1000);
      }

      await this.page.waitForLoadState('domcontentloaded');
      await this.debugScreenshot('after_university_selection');
      
      logger.success('University selection completed');

    } catch (error) {
      logger.error('Failed to select university', { error: error.message });
      await this.debugScreenshot('university_selection_error');
      
      // Don't throw error, try to continue
      logger.warn('Continuing despite university selection error...');
    }
  }

  async fillPersonalInfo(data) {
    try {
      logger.info('Filling personal information form');
      await this.debugScreenshot('before_filling_personal_info');

      // First name
      await this.fillField(
        ['input[name="firstName"]', 'input#firstName', '[data-testid="first-name"]', 'input[placeholder*="First" i]'],
        data.firstName,
        'First name'
      );

      // Last name
      await this.fillField(
        ['input[name="lastName"]', 'input#lastName', '[data-testid="last-name"]', 'input[placeholder*="Last" i]'],
        data.lastName,
        'Last name'
      );

      // Birth date
      if (data.birthDate) {
        await this.fillBirthDate(data.birthDate);
      }

      // Email
      await this.fillField(
        ['input[name="email"]', 'input[type="email"]', '[data-testid="email"]', 'input[placeholder*="email" i]'],
        data.email,
        'Email'
      );

      await this.page.waitForLoadState('networkidle');
      await this.debugScreenshot('after_filling_personal_info');
      
      logger.success('Personal info filled');

    } catch (error) {
      logger.error('Failed to fill personal info', { error: error.message });
      await this.debugScreenshot('personal_info_error');
      throw error;
    }
  }

  async fillField(selectors, value, fieldName) {
    for (const selector of selectors) {
      try {
        const element = await this.page.waitForSelector(selector, { timeout: 5000 });
        if (element) {
          await element.fill(value);
          logger.debug(`Filled ${fieldName}`, { selector });
          return;
        }
      } catch (e) {
        continue;
      }
    }
    throw new Error(`Could not find field: ${fieldName}`);
  }

  async fillBirthDate(birthDate) {
    try {
      const birthParts = birthDate.split('-');
      
      // Try single date input
      const dateInput = await this.page.$('input[name="birthDate"], input[type="date"]');
      if (dateInput) {
        await dateInput.fill(birthDate);
        logger.debug('Filled birth date (single field)');
        return;
      }

      // Try separate fields
      const dayField = await this.page.$('select[name="birthDay"], input[name="day"]');
      const monthField = await this.page.$('select[name="birthMonth"], select[name="month"]');
      const yearField = await this.page.$('input[name="birthYear"], input[name="year"]');

      if (dayField && monthField && yearField) {
        await dayField.fill(birthParts[2]);
        await monthField.selectOption(birthParts[1]);
        await yearField.fill(birthParts[0]);
        logger.debug('Filled birth date (separate fields)');
        return;
      }

      logger.warn('Birth date field not found, skipping');
    } catch (error) {
      logger.warn('Failed to fill birth date', { error: error.message });
    }
  }

  async submitForm() {
    try {
      logger.info('Submitting form');
      await this.debugScreenshot('before_submit');

      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Verify")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
        '[data-testid="submit-button"]'
      ];

      for (const selector of submitSelectors) {
        try {
          const button = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (button) {
            await button.click();
            logger.info('Submit button clicked', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      await this.debugScreenshot('after_submit');
      
      logger.success('Form submitted');

    } catch (error) {
      logger.error('Failed to submit form', { error: error.message });
      await this.debugScreenshot('submit_error');
      throw error;
    }
  }

  async clickPortalLoginAndBack() {
    try {
      logger.info('Looking for portal login button...');
      await this.debugScreenshot('looking_for_portal');

      const portalSelectors = [
        'button:has-text("Portal")',
        'a:has-text("Portal")',
        'button:has-text("Login")',
        'a:has-text("Student Portal")',
        'button:has-text("Student Login")'
      ];

      let portalButton = null;
      for (const selector of portalSelectors) {
        try {
          portalButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (portalButton) {
            logger.info('Portal button found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (portalButton) {
        logger.info('Clicking portal button...');
        await portalButton.click();
        await this.page.waitForLoadState('domcontentloaded');
        await this.debugScreenshot('after_portal_click');

        // Click back
        const backSelectors = [
          'button:has-text("Back")',
          'button:has-text("Kembali")',
          'button:has-text("Return")',
          'a:has-text("Back")'
        ];

        for (const selector of backSelectors) {
          try {
            const backButton = await this.page.waitForSelector(selector, { timeout: 3000 });
            if (backButton) {
              await backButton.click();
              logger.info('Back button clicked');
              break;
            }
          } catch (e) {
            continue;
          }
        }

        await this.page.waitForLoadState('networkidle');
        logger.success('Portal flow completed');
        return true;
      }

      logger.warn('Portal button not found, skipping');
      return false;

    } catch (error) {
      logger.warn('Portal flow skipped', { error: error.message });
      return false;
    }
  }

  async uploadDocument(imageBuffer) {
    const tempFilePath = `/tmp/student_id_${Date.now()}.png`;
    
    try {
      logger.info('Uploading document...');
      await this.debugScreenshot('before_upload');

      const fileInput = await this.page.waitForSelector('input[type="file"]', { timeout: 15000 });

      // Write temp file
      fs.writeFileSync(tempFilePath, imageBuffer);
      logger.debug('Temp file created', { path: tempFilePath });

      // Upload file
      await fileInput.setInputFiles(tempFilePath);
      await this.page.waitForTimeout(2000);
      await this.debugScreenshot('after_file_selected');

      logger.success('Document file selected');

      // Try to find and click submit button
      const submitSelectors = [
        'button[type="submit"]:has-text("Submit")',
        'button:has-text("Upload")',
        'button:has-text("Complete")',
        'button:has-text("Done")',
        'button:has-text("Finish")'
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const submitBtn = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (submitBtn) {
            await submitBtn.click();
            logger.info('Upload submit button clicked', { selector });
            submitted = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (submitted) {
        await this.page.waitForLoadState('networkidle');
        await this.debugScreenshot('after_upload_submit');
        logger.success('Upload submitted');
      } else {
        logger.warn('Upload submit button not found, document may auto-submit');
      }

    } catch (error) {
      logger.error('Failed to upload document', { error: error.message });
      await this.debugScreenshot('upload_error');
      throw error;
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.debug('Temp file cleaned up', { path: tempFilePath });
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file', { error: cleanupError.message });
        }
      }
    }
  }

  async checkVerificationStatus() {
    try {
      await this.debugScreenshot('checking_status');

      // Success indicators
      const successIndicators = [
        'text=/success/i',
        'text=/verified/i',
        'text=/approved/i',
        'text=/complete/i',
        '[data-testid="success-message"]'
      ];

      for (const selector of successIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.textContent();
          logger.info('Success indicator found', { text });
          return { status: 'success', message: 'Verification successful!' };
        }
      }

      // Pending indicators
      const pendingIndicators = [
        'text=/pending/i',
        'text=/review/i',
        'text=/processing/i',
        'text=/submitted/i'
      ];

      for (const selector of pendingIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.textContent();
          logger.info('Pending indicator found', { text });
          return { status: 'pending', message: 'Verification pending review' };
        }
      }

      // Error indicators
      const errorIndicators = [
        'text=/error/i',
        'text=/failed/i',
        'text=/rejected/i',
        'text=/invalid/i'
      ];

      for (const selector of errorIndicators) {
        const element = await this.page.$(selector);
        if (element) {
          const text = await element.textContent();
          logger.info('Error indicator found', { text });
          return { status: 'failed', message: text };
        }
      }

      logger.warn('No status indicator found');
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

  async debugScreenshot(label) {
    try {
      const filename = `/tmp/debug_${label}_${Date.now()}.png`;
      await this.page.screenshot({ path: filename, fullPage: true });
      logger.debug(`Debug screenshot: ${filename}`);
    } catch (error) {
      // Ignore debug screenshot errors
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

/**
 * Label Regeneration Example
 *
 * Shows how to regenerate a label for an existing shipment.
 * Useful if the printer jammed or the label was lost.
 */

import { generateLabel } from '@jazzdev/dpd-local-sdk';
import type { DPDCredentials } from '@jazzdev/dpd-local-sdk';

async function regenerateLabelExample() {
  // Your DPD credentials
  const credentials: DPDCredentials = {
    accountNumber: process.env.DPD_ACCOUNT_NUMBER!,
    username: process.env.DPD_USERNAME!,
    password: process.env.DPD_PASSWORD!,
  };

  // IMPORTANT: You need the shipmentId from when you created the shipment
  // This is NOT the consignment number (10 digits) or parcel number (14 digits)
  const shipmentId = '12345678'; // Replace with your actual shipmentId

  try {
    console.log('🔄 Regenerating label...');

    // Generate label in ZPL format (for thermal printers)
    const result = await generateLabel(credentials, {
      shipmentId: shipmentId,
      labelFormat: 'zpl', // Options: 'zpl', 'clp', 'html'
    });

    if (result.success && result.labelData) {
      console.log('✅ Label regenerated successfully!');
      console.log(`Label size: ${result.labelData.length} characters`);

      // Save to file or send to printer
      // Example: fs.writeFileSync('label.zpl', result.labelData);

      return result.labelData;
    } else {
      console.error('❌ Failed to regenerate label:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('💥 Error:', error);
    throw error;
  }
}

// Alternative: Regenerate HTML label (for viewing in browser)
async function regenerateHTMLLabel() {
  const credentials: DPDCredentials = {
    accountNumber: process.env.DPD_ACCOUNT_NUMBER!,
    username: process.env.DPD_USERNAME!,
    password: process.env.DPD_PASSWORD!,
  };

  const shipmentId = '12345678'; // Your shipmentId

  const result = await generateLabel(credentials, {
    shipmentId: shipmentId,
    labelFormat: 'html',
  });

  if (result.success && result.labelData) {
    // Save HTML to file or display in browser
    // fs.writeFileSync('label.html', result.labelData);
    return result.labelData;
  }

  throw new Error(result.error);
}

// Export for use in your application
export { regenerateLabelExample, regenerateHTMLLabel };

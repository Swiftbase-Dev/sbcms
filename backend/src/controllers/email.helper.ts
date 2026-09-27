export interface SendEmailOptions {
  apiToken: string;
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

export async function sendPostmarkEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload = {
      From: options.from,
      To: options.to,
      Subject: options.subject,
      HtmlBody: options.htmlBody,
      TextBody: options.textBody || options.htmlBody.replace(/<[^>]*>/g, ""),
      ReplyTo: options.replyTo || options.from,
      MessageStream: "outbound",
    };

    const res = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": options.apiToken,
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data.ErrorCode === 0) {
      return { success: true, messageId: data.MessageID };
    } else {
      return {
        success: false,
        error: data.Message || `Postmark API error (Status ${res.status})`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach Postmark API" };
  }
}

export function formatShippingNotificationEmail(params: {
  siteTitle: string;
  customerName?: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  items?: Array<{ name: string; quantity: number }>;
  shippingAddress?: any;
}): { subject: string; htmlBody: string } {
  const itemsHtml = params.items && params.items.length > 0
    ? `<ul style="margin: 16px 0; padding-left: 20px; color: #333;">
        ${params.items.map(i => `<li style="margin-bottom: 6px;"><strong>${i.name}</strong> × ${i.quantity}</li>`).join("")}
      </ul>`
    : "";

  const trackingLinkHtml = params.trackingUrl
    ? `<a href="${params.trackingUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 12px;">Track Your Package</a>`
    : `<p style="font-family: monospace; font-size: 16px; background-color: #f1f5f9; padding: 10px 16px; border-radius: 6px; display: inline-block; margin-top: 10px; font-weight: bold;">${params.trackingNumber}</p>`;

  const addressHtml = params.shippingAddress
    ? `<div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; color: #475569;">
        <strong style="color: #0f172a; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Shipping To:</strong><br>
        ${params.shippingAddress.name ? `<strong>${params.shippingAddress.name}</strong><br>` : ""}
        ${params.shippingAddress.line1 || ""}<br>
        ${params.shippingAddress.line2 ? `${params.shippingAddress.line2}<br>` : ""}
        ${params.shippingAddress.city || ""}, ${params.shippingAddress.state || ""} ${params.shippingAddress.postalCode || ""}<br>
        ${params.shippingAddress.country || ""}
      </div>`
    : "";

  const subject = `Your order has shipped! (${params.siteTitle})`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.6;">
      <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Your order is on the way! 📦</h1>
      <p style="font-size: 15px; color: #475569; margin-top: 0;">
        Hello${params.customerName ? ` ${params.customerName}` : ""}, exciting news! Your order from <strong>${params.siteTitle}</strong> has been shipped.
      </p>

      <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border-left: 4px solid #0f172a; border-radius: 6px;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Carrier: <strong style="color: #0f172a;">${params.carrier}</strong></p>
        <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Tracking Number: <strong style="color: #0f172a;">${params.trackingNumber}</strong></p>
        ${trackingLinkHtml}
      </div>

      <div style="margin: 24px 0;">
        <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Items in this Shipment</h3>
        ${itemsHtml}
      </div>

      ${addressHtml}

      <p style="margin-top: 32px; font-size: 13px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        Thank you for your order! If you have any questions, feel free to reply directly to this email.
      </p>
    </div>
  `;

  return { subject, htmlBody };
}

export function formatOrderConfirmationEmail(params: {
  siteTitle: string;
  customerName?: string;
  orderId: string;
  amountTotalCents: number;
  items?: Array<{ name: string; quantity: number; unitAmountCents?: number }>;
  shippingAddress?: any;
}): { subject: string; htmlBody: string } {
  const itemsHtml = params.items && params.items.length > 0
    ? `<ul style="margin: 16px 0; padding-left: 20px; color: #333;">
        ${params.items.map(i => `<li style="margin-bottom: 6px;"><strong>${i.name}</strong> × ${i.quantity} ${i.unitAmountCents ? `($${(i.unitAmountCents / 100).toFixed(2)})` : ""}</li>`).join("")}
      </ul>`
    : "";

  const totalDollars = (params.amountTotalCents / 100).toFixed(2);
  const subject = `Order Confirmation - ${params.siteTitle}`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.6;">
      <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">Thank you for your order! 🎉</h1>
      <p style="font-size: 15px; color: #475569; margin-top: 0;">
        Hello${params.customerName ? ` ${params.customerName}` : ""}, we've received your order and are getting it ready.
      </p>

      <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Order Ref: <strong style="color: #0f172a;">${params.orderId}</strong></p>
        <p style="margin: 6px 0 0 0; font-size: 16px; color: #0f172a;">Total: <strong>$${totalDollars}</strong></p>
      </div>

      <div style="margin: 24px 0;">
        <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Order Summary</h3>
        ${itemsHtml}
      </div>

      <p style="margin-top: 32px; font-size: 13px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        You will receive another email with tracking details as soon as your package ships.
      </p>
    </div>
  `;

  return { subject, htmlBody };
}

export function formatNewOrderAdminNotificationEmail(params: {
  siteTitle: string;
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  amountTotalCents: number;
  items?: Array<{ name: string; quantity: number; unitAmountCents?: number; customFields?: any }>;
  shippingAddress?: any;
  adminUrl?: string;
}): { subject: string; htmlBody: string } {
  const itemsHtml = params.items && params.items.length > 0
    ? `<ul style="margin: 16px 0; padding-left: 20px; color: #333;">
        ${params.items.map(i => {
          let customFieldsSummary = "";
          if (i.customFields && typeof i.customFields === "object" && Object.keys(i.customFields).length > 0) {
            customFieldsSummary = ` <span style="display: block; font-size: 12px; color: #64748b; margin-top: 2px;">` +
              Object.entries(i.customFields).map(([k, v]) => `<em>${k}</em>: ${v}`).join(", ") +
              `</span>`;
          }
          return `<li style="margin-bottom: 8px;"><strong>${i.name}</strong> × ${i.quantity} ${i.unitAmountCents ? `($${(i.unitAmountCents / 100).toFixed(2)})` : ""}${customFieldsSummary}</li>`;
        }).join("")}
      </ul>`
    : "";

  const totalDollars = (params.amountTotalCents / 100).toFixed(2);

  const addressHtml = params.shippingAddress
    ? `<div style="margin-top: 20px; padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; color: #475569;">
        <strong style="color: #0f172a; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Shipping Address:</strong><br>
        ${params.shippingAddress.name ? `<strong>${params.shippingAddress.name}</strong><br>` : ""}
        ${params.shippingAddress.line1 || ""}<br>
        ${params.shippingAddress.line2 ? `${params.shippingAddress.line2}<br>` : ""}
        ${params.shippingAddress.city || ""}, ${params.shippingAddress.state || ""} ${params.shippingAddress.postalCode || ""}<br>
        ${params.shippingAddress.country || ""}${params.shippingAddress.phone ? `<br>📞 ${params.shippingAddress.phone}` : ""}
      </div>`
    : `<div style="margin-top: 16px; padding: 12px; background-color: #f1f5f9; border-radius: 6px; font-size: 13px; color: #64748b;">
        <em>Digital product / No shipping address required</em>
      </div>`;

  const adminButtonHtml = params.adminUrl
    ? `<div style="margin-top: 24px;">
        <a href="${params.adminUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">View Order in CMS Admin</a>
      </div>`
    : "";

  const subject = `🛒 New Order: #${params.orderId} - $${totalDollars} (${params.siteTitle})`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.6;">
      <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">New Order Received! 🛒</h1>
      <p style="font-size: 15px; color: #475569; margin-top: 0;">
        A new customer purchase was just completed on <strong>${params.siteTitle}</strong>.
      </p>

      <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Order Ref: <strong style="color: #0f172a;">${params.orderId}</strong></p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748b;">Customer: <strong style="color: #0f172a;">${params.customerName || "Customer"}</strong> (${params.customerEmail || "N/A"})</p>
        <p style="margin: 6px 0 0 0; font-size: 16px; color: #0f172a;">Order Total: <strong>$${totalDollars}</strong></p>
      </div>

      <div style="margin: 24px 0;">
        <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Purchased Items</h3>
        ${itemsHtml}
      </div>

      ${addressHtml}

      ${adminButtonHtml}

      <p style="margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        This automated notification was sent to all project administrators on ${params.siteTitle}.
      </p>
    </div>
  `;

  return { subject, htmlBody };
}

export function formatFreeEbookNotificationEmail(params: {
  siteTitle: string;
  recipientName?: string;
  bookTitle: string;
  downloadUrl: string;
  message?: string;
}): { subject: string; htmlBody: string } {
  const subject = `📖 Your complimentary copy of "${params.bookTitle}" is ready!`;
  const customMessageHtml = params.message
    ? `<div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border-left: 4px solid #6366f1; border-radius: 4px; font-style: italic; color: #334155; font-size: 14px;">
        "${params.message.replace(/\n/g, '<br>')}"
      </div>`
    : "";

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1e293b; line-height: 1.6;">
      <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 8px;">You've received a book! 📚</h1>
      <p style="font-size: 15px; color: #475569; margin-top: 0;">
        Hello ${params.recipientName || "there"}, you have been sent a complimentary digital copy of <strong>"${params.bookTitle}"</strong> from <strong>${params.siteTitle}</strong>.
      </p>

      ${customMessageHtml}

      <div style="margin: 28px 0; text-align: center;">
        <a href="${params.downloadUrl}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3);">
          Download E-book &rarr;
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        You can choose from multiple formats (EPUB, Kindle, PDF) and view simple instructions on how to load it onto your Kindle, Apple Books, Kobo, or mobile device.
      </p>

      <p style="margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        Sent via ${params.siteTitle} E-book Distribution.
      </p>
    </div>
  `;

  return { subject, htmlBody };
}


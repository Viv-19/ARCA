const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'mock_user',
    pass: process.env.SMTP_PASS || 'mock_pass'
  }
});

const buildEmailTemplate = (map, department) => {
  const deadlineStr = map.deadline ? new Date(map.deadline).toDateString() : 'N/A';
  const remainingDays = map.deadline 
    ? Math.max(0, Math.ceil((new Date(map.deadline) - new Date()) / (1000 * 60 * 60 * 24)))
    : 'N/A';
    
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Regulatory Action Required</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
        .container { max-width: 650px; background-color: #ffffff; margin: 0 auto; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; border-top: 5px solid #0056b3; }
        .header { background-color: #002e6e; color: #ffffff; padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
        .header p { margin: 5px 0 0 0; opacity: 0.8; font-size: 14px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .badge { display: inline-block; padding: 6px 12px; font-weight: bold; border-radius: 4px; font-size: 12px; text-transform: uppercase; margin-bottom: 15px; }
        .badge-critical { background-color: #ffd2d2; color: #d8000c; }
        .badge-high { background-color: #ffe8cc; color: #e65c00; }
        .badge-medium { background-color: #e2f0d9; color: #385723; }
        .badge-low { background-color: #e1f5fe; color: #0288d1; }
        .section-title { font-size: 16px; font-weight: bold; color: #002e6e; border-bottom: 2px solid #eef2f5; padding-bottom: 8px; margin-top: 25px; margin-bottom: 12px; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 3px solid #0056b3; }
        .meta-item { font-size: 13px; }
        .meta-label { font-weight: bold; color: #666666; display: block; margin-bottom: 2px; }
        .meta-value { font-weight: 600; color: #111111; }
        .evidence-list { list-style-type: none; padding-left: 0; }
        .evidence-list li { padding: 8px 12px; margin-bottom: 6px; background-color: #eef7ff; border-radius: 4px; font-size: 13px; border-left: 3px solid #0288d1; color: #0277bd; }
        .footer { background-color: #f8f9fa; color: #888888; text-align: center; padding: 15px; font-size: 12px; border-top: 1px solid #eeeeee; }
        .btn { display: inline-block; background-color: #0056b3; color: #ffffff !important; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px; margin-top: 20px; }
        .btn:hover { background-color: #004085; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SuRaksha Regulatory Intelligence Portal</h1>
          <p>Canara Bank Compliance Automated Dispatch System</p>
        </div>
        <div class="content">
          <div class="badge badge-${map.priority.toLowerCase()}">${map.priority} Priority Requirement</div>
          
          <p>Dear <strong>${department.name} Team</strong>,</p>
          <p>A new regulatory compliance action item has been approved by the Central Compliance Officer and routed to your department for implementation.</p>
          
          <div class="section-title">Requirement Overview</div>
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">MAP ID</span>
              <span class="meta-value">${map.mapCode}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Regulator & Circular</span>
              <span class="meta-value">${map.document?.regulator} - ${map.document?.title}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Deadline</span>
              <span class="meta-value">${deadlineStr} (${remainingDays} days left)</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Obligation Type</span>
              <span class="meta-value">${map.obligationType} (${map.classification})</span>
            </div>
            ${map.jiraTicketId ? `
            <div class="meta-item" style="grid-column: span 2;">
              <span class="meta-label">JIRA Ticket ID</span>
              <span class="meta-value" style="color: #0052cc;">${map.jiraTicketId}</span>
            </div>` : ''}
          </div>
          
          <div class="section-title">Required Compliance Task</div>
          <p style="background-color: #fffde7; padding: 15px; border-radius: 6px; border-left: 3px solid #fbc02d; font-size: 14px; font-weight: 500;">
            ${map.description}
          </p>

          <div class="section-title">Deliverable Expected</div>
          <p style="font-size: 14px;">${map.deliverable}</p>
          
          <div class="section-title">Evidence Required for Autonomous Validation</div>
          <ul class="evidence-list">
            ${map.evidenceRequired.map(e => `<li>${e}</li>`).join('')}
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/maps/${map.id}" class="btn">Submit Evidence & Validate</a>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated notification from the Canara Bank ARCA Platform. Please do not reply directly to this email.</p>
          <p>Confidentiality Warning: This communication is meant solely for the use of the authorized department group.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

async function sendMapAssignmentEmail(map, department) {
  try {
    const subject = `[ACTION REQUIRED] Compliance MAP ${map.mapCode} | ${map.priority} | Deadline: ${map.deadline ? new Date(map.deadline).toDateString() : 'N/A'}`;
    const html = buildEmailTemplate(map, department);

    const info = await transporter.sendMail({
      from: `"ARCA Compliance System" <${process.env.SMTP_USER || 'arca@canarabank.com'}>`,
      to: department.email,
      cc: 'compliance-central@canarabank.com',
      subject,
      html
    });

    console.log(`[Email Dispatched] Sent assignment email for MAP ${map.mapCode} to ${department.email}. MessageId: ${info.messageId}`);
    return info.messageId;
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${department.email}:`, error);
    return null;
  }
}

module.exports = { sendMapAssignmentEmail };

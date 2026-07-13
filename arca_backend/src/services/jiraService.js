const axios = require('axios');

// Configure Jira client using environment variables
const jiraClient = axios.create({
  baseURL: process.env.JIRA_BASE_URL || 'https://mock-jira.atlassian.net',
  auth: {
    username: process.env.JIRA_EMAIL || 'compliance-admin@canarabank.com',
    password: process.env.JIRA_API_TOKEN || 'mock_token'
  },
  timeout: 5000
});

const DEPARTMENT_JIRA_MAP = {
  "IT Security":       { projectKey: "ITSEC",  lead: "it-security-lead" },
  "Digital Banking IT":{ projectKey: "DIGIIT", lead: "digital-it-lead" },
  "Core Banking IT":   { projectKey: "CBSIT",  lead: "cbs-lead" },
};

const PRIORITY_MAP = {
  "CRITICAL": "Highest",
  "HIGH": "High",
  "MEDIUM": "Medium",
  "LOW": "Low"
};

const getDaysRemaining = (deadline) => {
  if (!deadline) return 'N/A';
  const remaining = Math.max(0, Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24)));
  return remaining;
};

function buildJiraDescription(map) {
  return `
*REGULATORY COMPLIANCE ACTION REQUIRED*
----
* *MAP ID:* ${map.mapCode}
* *Source circular:* ${map.document?.regulator || 'RBI'} — ${map.document?.title || 'Unknown Regulation'}
* *Section Reference:* ${map.sectionReference || 'General'}
* *Published Date:* ${map.document?.publicationDate ? new Date(map.document.publicationDate).toLocaleDateString() : 'N/A'}

*REQUIRED OPERATIONAL COMPLIANCE TASK*
{panel:title=Action Item|borderStyle=solid|borderColor=#ccc|titleBGColor=#F7D6C1|bgColor=#FFFFCE}
${map.description}
{panel}

* *COMPLIANCE DEADLINE:* ${map.deadline ? new Date(map.deadline).toLocaleDateString() : 'N/A'} (${getDaysRemaining(map.deadline)} days remaining)
* *PENALTY RISK / IMPACT:* ${map.riskDescription || 'Non-compliance will result in direct penal action by regulator.'}

*EVIDENCE REQUIRED FOR VALIDATION*
The following proof must be submitted in the compliance portal:
${(map.evidenceRequired || []).map(e => `* [ ] ${e}`).join('\n')}

----
*ARCA PORTAL URL:* ${process.env.FRONTEND_URL || 'http://localhost:3000'}/maps/${map.id}
  `.trim();
}

async function createComplianceTicket(map) {
  const departmentName = map.department?.name || map.department;
  const jiraProject = DEPARTMENT_JIRA_MAP[departmentName];
  
  if (!jiraProject) {
    console.log(`[Jira Alert] No JIRA project mapping configured for department: "${departmentName}". Skipping JIRA task creation.`);
    return null;
  }

  const isMock = !process.env.JIRA_BASE_URL ||
                 !process.env.JIRA_API_TOKEN ||
                 process.env.JIRA_API_TOKEN === 'mock_jira_token_for_hackathon' ||
                 process.env.JIRA_BASE_URL.includes('mock-jira.atlassian.net');

  if (isMock) {
    const syntheticId = `${jiraProject.projectKey}-${Math.floor(1000 + Math.random() * 9000)}`;
    console.log(`[Jira Integration Mocked] Created synthetic compliance ticket: ${syntheticId} for MAP ${map.mapCode}`);
    return syntheticId;
  }

  try {
    const ticketData = {
      fields: {
        project: { key: jiraProject.projectKey },
        summary: `[COMPLIANCE] ${map.mapCode} — ${map.title}`,
        description: buildJiraDescription(map),
        issuetype: { name: "Task" },
        priority: { name: PRIORITY_MAP[map.priority] || "Medium" },
        duedate: map.deadline ? new Date(map.deadline).toISOString().split('T')[0] : undefined,
        labels: ["regulatory-compliance", "arca-auto", (map.document?.regulator || 'rbi').toLowerCase()]
      }
    };

    const response = await jiraClient.post('/rest/api/2/issue', ticketData);
    console.log(`[Jira Success] Successfully created compliance ticket in JIRA for MAP ${map.mapCode}. TicketKey: ${response.data.key}`);
    return response.data.key;
  } catch (error) {
    console.error(`[Jira Service Error] Failed to create compliance issue for MAP ${map.mapCode}:`, error.message);
    
    // Graceful fallback for offline / credential issues
    const fallbackId = `${jiraProject.projectKey}-FALLBACK-${Math.floor(1000 + Math.random() * 9000)}`;
    console.log(`[Jira Fallback] Issued emergency synthetic ticket key: ${fallbackId}`);
    return fallbackId;
  }
}

module.exports = { createComplianceTicket };

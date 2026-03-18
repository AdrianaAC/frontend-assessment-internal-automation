# Workflow Diagram

```mermaid
flowchart TD
    A[Pipedrive Deal Won Event] --> B[Validate Deal Payload]
    B --> C[AI Enrichment]
    C --> D[Validate AI Output]
    C -. API unavailable or invalid output .-> J[Fallback Enrichment]
    J --> D
    D --> K{Approval Required?}
    K -- Yes --> L[Pause For Human Approval]
    L --> M[Resume Workflow]
    K -- No --> E[Prepare Outlook Notification]
    M --> E
    K -- No --> F[Move SharePoint Folder]
    M --> F
    K -- No --> G[Create ClickUp Project]
    M --> G
    K -- No --> H[Provision Teams Workspace]
    M --> H
    E --> I[Workflow Result UI]
    F --> I
    G --> I
    H --> I[Workflow Result UI]
```

## Notes

- Validation happens before the workflow starts and again after the AI step.
- The implemented prototype pauses before downstream provisioning when AI falls back or the project is classified as high risk.
- The workflow resumes through a dedicated backend endpoint after a human approval decision is submitted from the UI.
- Outlook, SharePoint, ClickUp, and Teams provisioning run in parallel after approval or on auto-proceeding runs.
- Low and medium risk runs continue automatically without the approval pause.

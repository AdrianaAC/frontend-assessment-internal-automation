# Workflow Diagram

```mermaid
flowchart TD
    A[Pipedrive Deal Won Event] --> B[Validate Deal Payload]
    B --> C[AI Enrichment]
    C --> D[Validate AI Output]
    D --> E[Prepare Outlook Notification]
    D --> F[Move SharePoint Folder]
    D --> G[Create ClickUp Project]
    D --> H[Provision Teams Workspace]
    E --> I[Workflow Result UI]
    F --> I
    G --> I
    H --> I

    C -. API unavailable or invalid output .-> J[Fallback Enrichment]
    J --> E
    J --> G
    J --> H
```

## Notes

- Validation happens before the workflow starts and again after the AI step.
- The prototype auto-proceeds after validation.
- In production, high-risk deals should pause for approval before email send and downstream provisioning.

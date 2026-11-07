# Architecture

The existing coding host owns planning and execution. The companion is a local presentation and question-routing layer.

```mermaid
flowchart LR
  User[Project owner] --> Host[Codex or Claude Code]
  Host --> Engineer[Superpowers workflow]
  Engineer --> Skills[User-selected skills]
  Host --> Hooks[Allowlisted lifecycle hooks]
  Hooks --> Spool[Bounded local spool]
  Spool --> Service[Private loopback service]
  Host <--> MCP[Companion MCP tools]
  MCP <--> Service
  Service <--> DB[(SQLite events and state)]
  Service <--> UI[Browser questions and pixel site]
  UI --> User
  Service --> Consent{Memory enabled?}
  Consent --> Vault[Owned Markdown pages]
  Vault -. optional viewing .-> Obsidian[Obsidian]
  style Engineer fill:#F5F0E6,stroke:#C35A21,color:#24211D
  style UI fill:#F5F0E6,stroke:#C35A21,color:#24211D
```

```mermaid
sequenceDiagram
  participant H as Native host
  participant M as MCP bridge
  participant B as Question broker
  participant U as Browser owner
  H->>M: Signed current context + request
  alt Verified question support
    M->>B: One question for this origin
    B->>U: Question ID + version
    U->>B: Reply with shown ID/version
    B->>M: Exact matching answer
    M->>H: Continue originating request
  else Unverified, timeout or disconnection
    M->>H: Native-chat fallback
  end
```

```mermaid
flowchart TD
  Goal[User project brief] --> Metadata[Installed-first bounded skill metadata]
  Metadata --> Offer[Up to three explained recommendations]
  Offer --> Installed[Use installed]
  Offer --> Review[Review catalog installation]
  Offer --> Alternate[Choose another]
  Offer --> Decline[Continue without]
  Installed --> Selected[Selected worker]
  Review --> Approval[Separate exact installation review]
  Approval --> Native[Native host permission and execution]
  Native --> Verify[Rediscovery and reload verification]
  Verify --> Selected
  Selected --> Evidence[Observed activity required for real progress]
  Decline --> Suppress[Suppress repeated offer for task and role]
```

The broker keys questions by project, host, session, turn and MCP request. The browser uses opaque session handles and cannot supply a different origin. Selected/declarative state stays separate from observed events. Native permission requests never become game approval buttons.

Public lead intake and HubSpot/GHL belong to the preserved V1 CRM prototype. V2 has no CRM credential or account dependency.

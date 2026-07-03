# Architecture decision records

ADRs document choices whose rationale would otherwise be lost. Statuses are
Proposed, Accepted, Superseded, or Rejected.

- [0001 — TypeScript on Node.js](0001-typescript-node.md)
- [0002 — Observe before transforming](0002-observe-before-transform.md)
- [0003 — Begin with OpenAI-compatible ingress](0003-openai-compatible-first.md)
- [0004 — Local SQLite with privacy-first events](0004-local-storage-and-privacy.md)
- [0005 — Token optimization portfolio](0005-token-optimization-portfolio.md)
- [0006 — Evolutionary package boundaries](0006-evolutionary-package-boundaries.md)
- [0007 — Tauri shell with an independent Node proxy](0007-workstation-distribution.md)
- [0008 — Local authentication and strict configuration](0008-local-authentication-and-configuration.md)
- [0009 — Transparent fidelity and compatibility guarantees](0009-transparent-fidelity-and-compatibility.md)
- [0010 — Execution and retry semantics](0010-execution-and-retry-semantics.md)
- [0011 — Event and session identity](0011-event-and-session-identity.md)
- [0012 — Resource and timeout limits](0012-resource-and-timeout-limits.md)
- [0013 — Explicit provider capability normalization](0013-provider-capability-normalization.md)
- [0014 — Retrieval requests use the next client turn](0014-retrieval-request-and-retry-semantics.md)
- [0015 — Persistent context artifacts are explicit raw retention](0015-persistent-artifact-privacy.md)
- [0016 — Negotiate adapters by ingress protocol](0016-protocol-capability-negotiation.md)

ADRs 0001–0016 are **Accepted** and form the reviewed foundation for
implementation. Future changes may supersede an ADR but do not silently rewrite
its history.

## See also

- [Architecture overview](../overview.md)
- [Package and module map](../package-map.md)
- [Engineering Reviews](../../engineering-reviews/README.md)
- [Engineering Review Packets](../../erp/README.md)

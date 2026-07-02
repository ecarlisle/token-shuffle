# Drift Detection

Architectural drift occurs when implementation, documentation, or practice diverges from accepted engineering knowledge.

Potential drift signals:

- Provider behavior changes without compatibility documentation.
- Implementation introduces concepts not represented in ADRs.
- ERPs marked complete without validation evidence.
- Release notes claim capabilities not supported by tests.
- Documentation references removed files or commands.

## Research Question

Can Token Shuffle detect possible drift without producing noisy warnings?

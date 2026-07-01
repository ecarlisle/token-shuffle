# Contributing

Every code change is a three-part change:

1. implementation;
2. tests that prove behavior or characterize an intentional limitation;
3. documentation explaining user-visible or architectural impact.

Use a meaningful, imperative commit subject such as:

```text
feat(proxy): record streamed usage events
fix(metrics): exclude cache discounts from tokens avoided
docs(adr): choose Anthropic ingress sequencing
```

Before committing, run:

```sh
pnpm check
```

The detailed workflow and definition of done live in
[docs/contributing/workflow.md](docs/contributing/workflow.md).

Documentation changes also follow the
[documentation quality standards](docs/contributing/documentation-standards.md).
Before starting, review any applicable
[Engineering Review Packets](docs/erp/README.md).

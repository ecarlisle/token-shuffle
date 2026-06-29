# Token economics

## Fundamental constraint

There is no universal proxy trick that lets a stateless model understand text it
never receives. Real token reductions require one of four things:

1. avoid an otherwise identical inference;
2. remove information that is provably redundant;
3. replace information with a smaller representation; or
4. make selected original information available on demand instead of eagerly.

Every mechanism trades portability, quality, latency, or implementation
complexity for savings. The product must expose those tradeoffs rather than hide
them behind one savings percentage.

## Optimization taxonomy

The mechanisms are related but not additive:

- **Response reuse** avoids an inference entirely.
- **Context externalization** is the storage and reference architecture.
- **Selection** decides which externalized material to inject.
- **Compaction** creates a smaller representation of material.
- **Deterministic reduction** removes known redundancy without model judgment.
- **Provider state** allows a delta or reference to rely on a shared baseline.
- **Economic routing** changes where work runs, not how many tokens it uses.

Context compaction, retrieval, tool-output compression, and delta prompting are
ways of using externalized state. If one block is externalized, retrieved, and
then compacted, its reduction must be counted once at the final request boundary.

## Recommended portfolio

| Mechanism | Literal token reduction? | Proxy feasibility | Priority | Principal risk |
| --- | ---: | ---: | ---: | --- |
| Deterministic tool-output compression | Yes | High | First active transform | A removed detail becomes relevant |
| Exact duplicate removal | Yes | High | First active transform | Repetition may be intentional |
| Dynamic tool-definition selection | Yes | Medium | Early experiment | A needed tool is unavailable |
| Structured conversation compaction | Yes | High | After deterministic transforms | Constraints are lost in a summary |
| Retrieval instead of replay | Yes | Medium | After externalized storage | Retrieval misses required context |
| Delta prompting | Conditional | Low for stateless APIs | Later | Receiver lacks the baseline |
| Exact response cache | Avoids the call | High | Conservative, specialized use | A cached action or answer is stale |
| Provider prompt caching | No | High | Measure early | Discounted tokens are mislabeled |
| Dynamic model/provider routing | No | High | Separate cost track | Quality loss or greater token use |

Priorities are hypotheses until v0.1 observations show where real agent
sessions spend context.

## Mechanism decisions

### Exact response cache

An exact response-cache hit can avoid an entire inference, including output
generation. It is valuable for deterministic requests, repeated evaluations,
development replay, and eligible retries, but organic agent sessions may have a
low exact-hit rate.

A cache key must cover the complete canonical request, model, provider,
sampling parameters, seed, tool definitions and choice, relevant provider
features, policy version, and any scoped project or environment identity.
Eligibility is as important as key construction:

- requests involving time, changing external state, or credentials are
  ineligible by default;
- responses containing tool calls or possible side effects are ineligible by
  default;
- nondeterministic requests require explicit opt-in and a bounded lifetime;
- authorization boundaries must never share cache entries;
- the UI must show the stored response, age, key factors, and bypass reason.

Report this as **inference avoided**, with estimated counterfactual input and
output tokens. Do not combine it with provider prompt-cache metrics.

### Context externalization

Externalization is foundational infrastructure, not an independent savings
claim. Token Shuffle may retain original conversation turns, files, tool
results, indexes, and summaries locally.

A stateless model cannot use an opaque local reference. Externalized content
must be resolved and injected, exposed through a retrieval tool, retained by a
provider stateful API, or coordinated through an agent integration. Savings are
attributed to the selection or compaction policy that determines the final
forwarded request.

### Structured context compaction

Long-session compaction should preserve structured state rather than only a
prose narrative:

- current objective and completion criteria;
- user constraints and preferences;
- decisions and their rationale;
- important files, symbols, and locations;
- changed artifacts;
- failed approaches and observed errors;
- open questions and outstanding work;
- a small verbatim active window.

Original material remains locally recoverable. Summaries have source ranges,
versions, invalidation rules, and explicit uncertainty. Tokens used to create or
refresh them count as optimization tokens.

### Retrieval instead of replay

Retrieval is preferred for large files, documentation, logs, test output, and
older conversation material because it can restore original passages instead of
depending solely on a lossy summary.

Use hybrid selection: exact file paths, symbols, identifiers, and recency before
semantic similarity. The model needs an escape hatch to request more context.
High-quality retrieval may require an agent tool or client integration because a
generic HTTP proxy sees context only after the agent has assembled it.

### Tool-output compression

Tool output is the leading candidate for the first active transform, subject to
v0.1 evidence. Begin with deterministic operations:

- remove ANSI and non-semantic control sequences;
- collapse repeated log lines while retaining counts;
- preserve commands, exit codes, filenames, line numbers, and error blocks;
- retain configurable head, tail, and error-adjacent regions;
- store the complete output locally;
- provide a way to request omitted ranges.

Model-generated summaries come later and must include their own token cost.

### Delta prompting

A delta is useful only when the receiver has a trustworthy baseline. This can be
true when the base remains in the active window, a provider maintains state, or
the model can retrieve the original artifact.

Git diffs and changed-line excerpts can be self-contained enough for early
measurement. Generalized delta prompting is deferred until session-state and
baseline invalidation semantics are explicit.

### Tool-definition selection

Tool schemas can occupy substantial repeated context. Supplying only relevant
tools can reduce literal input tokens, but a false negative can make a task
impossible. Early experiments must provide a capability-discovery or retry path,
charge any retry tokens to the policy, and avoid selecting tools through opaque
model judgment without a replay evaluation.

### Dynamic routing

Routing simple work to a cheaper model or provider is worthwhile, but it is an
economic optimization. It may use the same or more tokens and may change output
quality. Routing metrics, policies, and dashboard totals remain separate from
literal and net token reduction.

## Recommended sequence

1. Transparent measurement and structural analysis.
2. Deterministic tool-output compression.
3. Exact duplicate removal.
4. Shadow evaluation of dynamic tool-definition selection.
5. Structured context compaction.
6. Retrieval-backed externalized context.
7. Stateful and delta prompting.

Exact response caching can develop alongside this sequence for narrow eligible
requests. Provider prompt caching is measured from the beginning. Dynamic
routing belongs to a later parallel cost-optimization track.

## Metric contract

The UI and event model must keep these values separate:

- **Baseline input tokens**: tokens the unmodified request would send.
- **Forwarded input tokens**: tokens in the transformed request.
- **Literal input tokens avoided**: `max(0, baseline - forwarded)`.
- **Optimization tokens**: input and output used to produce a summary, select
  context, or perform another model-assisted transform.
- **Net tokens avoided**: literal tokens avoided minus optimization tokens.
- **Inference avoided**: an eligible response-cache hit, reported with estimated
  counterfactual input and output tokens.
- **Cache-read tokens**: forwarded tokens billed at a provider's cache rate.
- **Estimated money saved**: price-aware counterfactual, separate from tokens.
- **Proxy overhead**: added latency before first upstream byte and total latency.

Counts must be labeled as provider-reported, provider-tokenizer,
compatible-tokenizer, or estimate. Comparisons should use the same tokenizer
whenever possible. A token block affected by multiple policies is counted once
at the final request boundary, while each policy may record its marginal
decision for replay.

## Quality contract

A transform is not considered useful solely because it saves tokens. It must be
evaluated against representative replay fixtures:

- exact tool-call arguments where deterministic behavior is expected;
- task completion judged by project tests or a deterministic verifier;
- constraint retention checks;
- escalation rate, retries, and total session tokens;
- cache staleness and side-effect eligibility;
- retrieval misses and requests for additional context;
- user opt-out and manual replay inspection.

A locally smaller request can cause extra turns and increase total session
tokens. Session-level measurement is therefore required before promoting a
policy to a default. Quality gates may veto a policy regardless of its token or
cost savings.

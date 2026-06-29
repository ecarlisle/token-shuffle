# Token economics

## What can realistically reduce tokens?

There is no universal proxy trick that lets a stateless model understand text it
never receives. Real reductions require removing information, replacing it with
a smaller representation, or using a provider's stateful continuation feature.
Each method has a different quality and portability tradeoff.

| Mechanism | Literal token reduction? | Initial priority | Main risk |
| --- | ---: | ---: | --- |
| Remove exact redundant content | Yes | v0.1 candidate | A repeated item may be intentional |
| Bound or summarize old tool results | Yes | v0.2 | A discarded detail becomes relevant |
| Compact old conversation turns | Yes | v0.3 | Summary loses intent or constraints |
| Retrieve only relevant long-term context | Yes | Later | Retrieval misses required context |
| Provider stateful continuation | Often | Later | Provider lock-in and state mismatch |
| Stable-prefix/provider prompt caching | No | v0.1 measurement | Easy to mislabel discounted tokens |
| Route to a cheaper/smaller model | No | Later | Quality loss; it is cost routing |

### Recommended starting wedge

Start with an observe-only OpenAI-compatible proxy and collect structural
metrics without retaining raw text:

- input/output token counts and count provenance;
- message, tool-definition, and tool-result token share;
- stable-prefix size across turns;
- exact repeated-block size using keyed hashes;
- provider cache-read/cache-write usage when reported;
- end-to-end and proxy-added latency.

This reveals which optimization has real leverage for the user's actual agents.
The first active transform should be chosen from measured evidence, not assumed
in advance. A likely first candidate is an opt-in size policy for stale tool
results because coding agents often produce large, inspectable outputs, but that
hypothesis must be validated.

## Metric contract

The UI and event model must keep these values separate:

- **Baseline input tokens**: tokens the unmodified request would send.
- **Forwarded input tokens**: tokens in the transformed request.
- **Literal input tokens avoided**: `max(0, baseline - forwarded)`.
- **Optimization tokens**: input and output used to produce a summary or other
  model-assisted transform.
- **Net tokens avoided**: literal tokens avoided minus optimization tokens.
- **Cache-read tokens**: forwarded tokens billed at a provider's cache rate.
- **Estimated money saved**: price-aware counterfactual, separate from tokens.
- **Proxy overhead**: added latency before first upstream byte and total latency.

Counts must be labeled as provider-reported, provider-tokenizer,
compatible-tokenizer, or estimate. Comparisons should use the same tokenizer
whenever possible.

## Quality contract

A transform is not considered useful solely because it saves tokens. It must be
evaluated against representative replay fixtures:

- exact tool-call arguments where deterministic behavior is expected;
- task completion judged by project tests or a deterministic verifier;
- constraint retention checks;
- escalation rate, retries, and total session tokens;
- user opt-out and manual replay inspection.

A locally smaller request can cause extra turns and increase total session
tokens. Session-level measurement is therefore required before promoting a
policy to a default.

# Local dashboard

This directory is a deliberate architecture boundary, not an implemented app.
The dashboard begins in v0.2 after recorded event contracts and metrics are
stable enough to display without inventing meaning in the UI.

The first dashboard will show:

- baseline and forwarded input tokens;
- literal tokens avoided and confidence/source of each count;
- cache-discounted tokens and estimated money saved, separately;
- added optimization work such as summarization tokens;
- latency overhead;
- an inspectable before/after replay with sensitive fields redacted.

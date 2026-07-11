# Siltflow

A desktop app for language learners — read PDFs, look up words, build your vocabulary with spaced repetition.

## Settings Reference

### FSRS (Spaced Repetition) Parameters

These control how the built-in SRS schedules card reviews.

| Parameter | Default | Meaning |
|---|---|---|
| `request_retention` | `85%` | Target probability you'll recall a card when it's due. **Higher** → shorter intervals, more reviews, stronger memory. **Lower** → longer intervals, fewer reviews, more forgetting. |
| `maximum_interval` | `365 days` | Hard cap on days between reviews. No card exceeds this even if the algorithm computes a longer interval. |
| `enable_fuzz` | `true` | Adds small random jitter to intervals so cards from the same batch don't all fall due on the same day. Keep it on. |
| `enable_short_term` | `true` | When on, new & forgotten cards go through short (minute-level) steps before entering the long-term cycle. Turn off to skip straight to long-term scheduling. |
| `learning_steps` | `1m, 10m` | Progressive intervals for **new cards**: rate Good → wait 1 min → see it again → rate Good → wait 10 min → see it again → graduate to long-term. Rate Again to restart the current step. Supports `m` (minutes), `h` (hours), `d` (days). |
| `relearning_steps` | `10m` | Single-step catch-up for **forgotten cards** (rated Again after graduation). One short interval is usually enough to pull it back into the long-term schedule. |

### Keyboard Shortcuts

Available shortcuts can be customized in **Settings → Shortcuts**.

| Action | Default | Context |
|---|---|---|
| Docs tab | `Alt+1` | Global |
| Review tab | `Alt+2` | Global |
| Outlines tab | `Alt+3` | Global |
| Annotations tab | `Alt+A` | Global |
| Summary tab | `Alt+S` | Global |
| Toggle left panel | `Alt+[` | Global |
| Toggle right panel | `Alt+]` | Global |
| Open settings | `Ctrl+,` | Global |
| Toggle quick add | `Ctrl+I` | Global |
| Toggle fit width | `Ctrl+E` | PDF open |
| Start Learning | `Ctrl+S` | Annotations tab |
| Reveal / flip card | `Space` | Learning mode |
| Again (grade 1) | `Num1` | Learning mode |
| Hard (grade 2) | `Num2` | Learning mode |
| Good (grade 3) | `Num3` | Learning mode |
| Easy (grade 4) | `Num4` | Learning mode |
| Listen / stop audio | `Alt+L` | Learning mode |
| Back from learning | `Escape` | Learning mode |

### TTS (Text-to-Speech)

Supports two providers:

- **Edge-TTS** — local, via `pip install edge-tts`. Configurable voice per language, rate, volume, pitch, and binary path.
- **MiMo** — cloud API from XiaoMi. Requires an API key and supports preset voice models as well as voice design/cloning.
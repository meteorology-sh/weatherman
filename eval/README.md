# eval — the evaluation harness

Parses Texas rain-enhancement reports, scores each flare against Weatherman's
layers at that minute, and serves the comparison. The findings are
`docs/EVALUATION.md`.

The 2025 snapshot — reports, parsed records, and scored days — is the GitHub
release `eval-2025-v1`. The harness code stays in git. From the repository
root:

```bash
gh release download eval-2025-v1 -p eval-2025-v1.tar.gz
tar -xzf eval-2025-v1.tar.gz
```

| Directory | What it is |
| --------- | ---------- |
| `cache/`  | Source reports (PDFs) |
| `data/`   | Parsed records and region config for that season |
| `out/`    | Comparison to Weatherman's layers |

A later season can change formats, counties, or programmes. That is a new
snapshot, not a change to this code.

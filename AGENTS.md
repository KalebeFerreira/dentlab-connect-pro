# Architecture rules

- Preserve business history with `archived_at` soft deletion for primary records; hard-delete only disposable notes, messages, and files.
- Keep payment state synchronized through database triggers so every UI observes one authoritative status.
- Load large export libraries dynamically inside the user-triggered export action to keep mobile page bundles small.
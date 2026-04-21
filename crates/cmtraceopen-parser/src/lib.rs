// cmtraceopen-parser
//
// Pure-Rust log-format parsing, error-code database, and entry models.
// Scaffolded in Phase 1; module contents are moved in from src-tauri/src/
// in subsequent steps of this branch (see references/platform/phase-1-parser-extraction.md).
//
// Invariant: this crate compiles to both native and wasm32-unknown-unknown.
// No Tauri, no tokio, no notify, no evtx, no windows/winreg, no rayon, no filesystem I/O.

# Claude Code Instructions — Hive

## Build & Test Commands
- `npm run build:wasm` — Compile Rust engine to WASM (outputs to web/public/wasm/)
- `npm run dev` — Build WASM + start Next.js dev server
- `npm run build` — Full production build (WASM + Next.js static export)
- `npm test` — Run Rust engine tests (`cargo test`)
- `cd web && npx next build` — Build only the frontend (no WASM rebuild)
- Rust toolchain may not be in PATH by default; prefix with `export PATH="$HOME/.cargo/bin:$PATH"` if needed

## After Completing Each Task
- **Commit and push changes to main by default** after finishing each task or logical unit of work
- Write concise, descriptive commit messages that focus on the "why" not the "what"
- One logical commit per task/feature — don't batch unrelated changes
- Push commits together after a set of related tasks if they were done in sequence
- Use `git push` to push to main (this is a solo project, no PRs needed for regular work)
- If multiple tasks are completed before pushing, each should have its own commit

## Project Structure
- **engine/** — Rust crate: game rules, move generation, AI (compiles to WASM)
- **web/** — Next.js frontend (React, TypeScript, Tailwind CSS)
- **models/** — Trained AI model weights and example games
- All game logic and AI run client-side via WebAssembly — no server required

## Key Conventions
- Engine types are mirrored in `web/src/lib/types.ts` — keep them in sync with Rust
- WASM bindings are in `engine/src/wasm.rs` — thin JSON serialization wrappers
- Themes are in `web/src/themes/` — each theme implements the HiveTheme interface
- Game state crosses the WASM boundary as JSON via serde
- AI runs on the main thread (Web Worker integration is planned but not yet implemented)

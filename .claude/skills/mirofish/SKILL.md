---
name: mirofish
description: Set up and drive MiroFish (github.com/666ghj/MiroFish), an open-source multi-agent "swarm" prediction engine. Use when the user wants to simulate how a news event, policy draft, PR crisis, financial signal or story would play out on social media, with many AI personas, and get a prediction report. Also use for installing, running, or calling the MiroFish API.
---

# MiroFish

MiroFish turns seed documents (news, reports, policy drafts, novels) into a simulated social network of LLM-driven agents, runs the simulation on Twitter-like and Reddit-like platforms, then writes a prediction report and lets you interview individual agents.

Licence: AGPL-3.0. Do not copy its code into another project without checking that fits. Treat the clone as untrusted third-party code.

## Pipeline

1. **Graph build**: upload PDF/MD/TXT seeds plus a plain-language prediction goal. An LLM designs an ontology (entity and relationship types), the text is chunked (default 500 chars, 50 overlap) and loaded into a Zep Cloud knowledge graph (GraphRAG).
2. **Environment setup**: entities from the graph become agents. The LLM writes a persona for each (personality, stance, memory), and generates the simulation config (rounds, activity patterns, initial posts).
3. **Simulation**: runs on the OASIS engine (camel-ai/oasis), Twitter and Reddit in parallel. Agents post, comment, like and follow. Optionally agent activity is written back to the Zep graph as memory.
4. **Report**: a ReportAgent uses search and statistics tools over the simulation results to write a sectioned prediction report.
5. **Interaction**: chat with the ReportAgent, or interview any single agent (or all) while the environment is still alive.

## Requirements

- Node 18+, Python 3.11 to 3.12, `uv`
- `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_NAME` (any OpenAI-SDK-compatible API; the README suggests Qwen-plus)
- `ZEP_API_KEY` (Zep Cloud, free tier is enough for small runs)
- Optional `LLM_BOOST_*` variables for a faster secondary model. Omit them entirely if unused.
- Simulations use many LLM calls. Start with under 40 rounds.

Never write API keys into the repo or into chat. Ask the user to put them in `.env` themselves.

## Setup

```bash
git clone --depth 1 https://github.com/666ghj/MiroFish /path/to/mirofish
cd /path/to/mirofish
cp .env.example .env      # user fills in keys
npm run setup:all         # root + frontend + backend (uv venv)
npm run dev               # frontend :3000, backend :5001
```

Docker alternative: `cp .env.example .env && docker compose up -d`.

## API (backend, `http://localhost:5001/api`)

All responses are `{"success": bool, "data": ..., "error": ...}`. Long jobs return a `task_id` to poll.

| Step | Call |
|---|---|
| Ontology | `POST /graph/ontology/generate` multipart: `files[]`, `simulation_requirement` (required), `project_name`, `additional_context` -> `project_id` |
| Build graph | `POST /graph/build` `{project_id, graph_name?, chunk_size?, chunk_overlap?}` -> `task_id`; poll `GET /graph/task/<task_id>` |
| Create sim | `POST /simulation/create` `{project_id, enable_twitter?, enable_reddit?}` -> `simulation_id` |
| Prepare | `POST /simulation/prepare` `{simulation_id, entity_types?, use_llm_for_profiles?, parallel_profile_count?, force_regenerate?}`; poll `POST /simulation/prepare/status` |
| Run | `POST /simulation/start` `{simulation_id, platform: twitter/reddit/parallel, max_rounds?, enable_graph_memory_update?, force?}`; poll `GET /simulation/<id>/run-status` |
| Inspect | `GET /simulation/<id>/posts`, `/comments`, `/actions`, `/timeline`, `/agent-stats`, `/profiles` |
| Report | `POST /report/generate` `{simulation_id}`; poll `POST /report/generate/status`; fetch `GET /report/by-simulation/<id>` or `/report/<id>/download` |
| Ask report | `POST /report/chat` `{simulation_id, message, chat_history?}` |
| Interview | `POST /simulation/interview` `{simulation_id, agent_id, prompt, platform?}`; also `/interview/batch`, `/interview/all` (needs env still running; check `POST /simulation/env-status`, shut down with `/close-env`) |

## How to help the user

1. Check whether MiroFish is already cloned and `.env` exists. If not, set up as above and stop to let the user add keys.
2. Prefer the web UI for first runs; use the API for scripted or batch runs.
3. Help write a good `simulation_requirement`: name the event, the audience or platforms, the time horizon, and the question to answer (e.g. "How will students and media react to this statement over two weeks?").
4. Warn about cost (many LLM calls) and cap `max_rounds`.
5. Be honest about the output: it is a plausible LLM-driven scenario, not a statistically validated forecast. Report results as scenarios, not predictions of fact.
6. Do not run it on private or personal data the user has not cleared for sending to the configured LLM and Zep Cloud, since both receive the seed text.

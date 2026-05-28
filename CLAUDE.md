# CLAUDE.md — Gami DigiDouble Core

> Lis d'abord : AGENTS.md (règles Codex détaillées), README.md, KNOWLEDGE_BASE.md
> Contexte Gamilab : ~/CodeProjects/_shared/agent-context/00-memoways-context.md

## Contexte projet

Core SDK/API Audiogami (Gamilab SA). Produit principal : voice-to-structured-data.
Monorepo pnpm workspace avec Turborepo.

- Équipe : Ulrich Fischer (CEO), Nicolas Goy / kuon (CTO)
- Décisions d'architecture → coordonner avec Nicolas avant toute modification structurelle

## Stack

- Monorepo : pnpm workspace + Turborepo (`turbo.json`)
- Runtime : Node.js + TypeScript (ESLint config `eslint.config.mjs`)
- Docker : `Dockerfile` + `Dockerfile.dev` + `docker-compose.yml` + `docker-compose.e2e.yml`
- Structure : `apps/`, `packages/`, `infra/`, `docs/`
- Tests E2E : docker-compose.e2e.yml

## Règles projet

- Ce projet a déjà un `AGENTS.md` très complet — le lire en priorité pour les règles de code
- Ne jamais modifier l'architecture monorepo sans validation de Nicolas (CTO)
- Toujours utiliser pnpm (pas npm, pas yarn)
- Les commandes Docker passent par docker-compose, pas en direct
- Voir `API_GUIDE.md` avant tout travail sur les endpoints
- Voir `CONTRIBUTING.md` pour les conventions de contribution

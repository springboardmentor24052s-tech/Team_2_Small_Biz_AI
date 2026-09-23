# Contributing to MarketMind AI

Thanks for your interest in contributing! This project is built as part of the Infosys Springboard program and welcomes contributions from all team members.

## Project Structure

```
├── backend/      # API server (Node/Express)
├── frontend/     # Web application
├── ML/           # Machine learning training & pipelines
├── models/       # Trained model artifacts
└── sample-data/  # Sample datasets for local development
```

## Getting Started

1. Fork the repository (if you're an external contributor) or create a feature branch if you're a team member.
2. Follow the setup instructions in the main [README](README.md).
3. Create your branch from the appropriate base:

```bash
git checkout -b <your-name>/<feature> pre-dev
```

## Branching Model

| Branch | Purpose |
| --- | --- |
| `main` | Stable, reviewed code. Do not commit directly. |
| `pre-dev` | Integration branch for in-progress work. |
| `review` | Code ready for peer review. |
| `<name>/<feature>` | Individual feature branches. |

Work flows: `<name>/<feature>` → `pre-dev` → `review` → `main`.

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`.

Examples:

```
feat(audit): add login device intelligence
fix(deploy): resolve API base URL and CORS
docs: update setup instructions
```

Commit messages should describe the change itself. Do not add promotional trailers or attribution footers — commit authorship already records who made the change.

## Pull Requests

1. Push your branch and open a PR against `pre-dev` (or `review` if the work is integration-ready).
2. Fill in the PR description: what changed, why, and how to test it.
3. Request a review from at least one teammate.
4. PRs must be up to date with their base branch before merge.

## Code Style

- **Backend**: Follow the existing ESLint configuration; run `npm run lint` before pushing.
- **Frontend**: Keep components small and typed; match existing naming conventions.
- **ML**: Notebooks should start with a markdown cell explaining purpose, inputs, and outputs.

## Security

Never commit secrets, API keys, or credentials. Use environment variables (see the README's security notes). If you find a security issue, contact the repository maintainers directly rather than opening a public issue.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE) that covers this project.

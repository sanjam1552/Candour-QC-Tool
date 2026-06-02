# VisiQC

VisiQC is a browser-based quality control console designed for creative teams. It combines visual audit tools, copy and messaging review, trend research support, client/project workspace management, and a lightweight AI-assisted asset creator.

## Overview

The app is built as a static frontend application using plain HTML, CSS, and JavaScript. It stores workspace data in browser `localStorage`, supports multiple clients and projects, and provides a dynamic UX with animated scan effects and interactive dashboards.

## Key Features

- Client and project workspaces
- Visual creative audit with AI-based critique and scoring
- Copywriting audit with tone selection and grammar/proofreading support
- B2B marketing trend research dashboard
- AI image creator tab to generate and export creative assets via Pollinations
- Creative Requirements Queue: A priority-sorted assignment board for design leads (Suvrata, Alka, Durgesh) to log requirements across clients, upload reference briefs, and deep-link directly into audit and creator workspaces.
- Persistent workspace state stored in browser `localStorage`
- Configurable AI engine settings for Google Gemini or local Ollama
- Project history tracking with thumbnails and audit logs

## Application Structure

### Root

- `index.html` - Main frontend shell and layout.
- `README.md` - Project documentation.

### CSS

- `css/variables.css` - Theme variables and design tokens.
- `css/base.css` - Global reset and base styles.
- `css/layout.css` - Page layout and grid styling.
- `css/components.css` - Components such as buttons, cards, panels.
- `css/terminal.css` - Terminal-style log panels and pseudo-console UI.
- `css/modals.css` - Modal dialogs for client/project creation and settings.
- `css/scanner.css` - Visual scanner overlay and detection effects.
- `css/editor.css` - Creator canvas and editor-specific styles.
- `css/assignments.css` - Creative requirements cards and layout styling.

### JavaScript

- `js/app.js` - App bootstrap, initializes the state, UI, and editor modules.
- `js/state.js` - Persistent database layer using `localStorage`; manages clients, projects, history, assignments, and active workspace state.
- `js/ui.js` - Core UI controller and event binding for workspace selectors, modals, panels, audit flows, assignments, and settings.
- `js/render.js` - Rendering helpers for dynamic DOM updates, history cards, assignments queue, report panels, and formatted results.
- `js/api.js` - AI API request builder and retry helper, prompt construction for visual, text, and research evaluations.
- `js/editor.js` - AI asset creator logic for generated artwork and committing it to the visual audit workspace.

## How to Run

This project is static and does not require a backend server. Open `index.html` in a browser to use the app.

For best results, serve it from a local static server if the browser blocks `fetch` or `file://` operations:

1. `cd` into `Candour-QC-Tool`
2. Start a simple local server, for example:
   - Python 3: `python -m http.server 8000`
   - Node.js: `npx http-server .`
3. Open `http://localhost:8000` in your browser.

## Usage

### Workspace Setup

- Add a new client using the `Brand` button in the sidebar.
- Add project-specific context using the `Project` button.
- Each project can include references, design notes, and platform guidance.
- Select a client and project from the sidebar dropdowns.

### Creative Assignments Queue

- Open the `Assignments` tab in the navigation bar.
- Choose the target Client, type the creative brief title (e.g., "RVNL Kazipet Reel"), and select who requested it.
- Choose a priority level (High, Medium, Low) and enter specifications/guidelines.
- Drag or browse a local file in the reference creative drop zone (images will be automatically scaled and compressed to fit local storage parameters).
- Click `Publish Creative Assignment` to append it to the active queue.
- Use filters at the top of the queue to search by brand, status, or requester.
- Click `Audit` or `Create` on any assignment card to set the client context, load format settings, pre-fill prompts, and redirect to the corresponding workspace.

### Visual Audit

- Drag and drop an image or click the upload area.
- Select a target platform and AI model.
- Click `Analyze` to run a visual quality check.
- The tool simulates inspection animations, then displays a scored report.
- Audit results are persisted in the project history list.

### Copy Audit

- Switch to the `Text` tab.
- Enter source copy or generate copy from a prompt.
- Choose a tone and run analysis.
- Results include polished copy, grammar changes, and tone critique.

### Trend Research

- Open the `Research` tab.
- Enter a topic and select an industry.
- Run research to produce trend-oriented output for LinkedIn, Meta, X, and print.

### Asset Creator

- Use the `Creator` tab to generate an image asset from a prompt.
- Choose a format preset and click `Generate`.
- Export or commit the asset into the visual audit workspace.

## AI Engine Configuration

The app supports two AI engine modes from the settings modal:

- `gemini` mode: requires a Google Gemini API key and uses Gemini cloud endpoints.
- `ollama` mode: connects to a local Ollama daemon at `http://localhost:11434`.

Settings also allow custom instructions to be injected into prompts.

## Data Persistence

The following keys are used in `localStorage`:

- `visiqc_database_v2` - stores clients, projects, and audit history.
- `visiqc_active_state_v2` - stores the active client and project selections.
- `visiqc_connection_type` - selected AI engine mode.
- `visiqc_api_key` - saved Gemini API key.
- `visiqc_ollama_model` - selected Ollama model name.
- `visiqc_custom_instructions` - custom prompt instructions.

## Notes for Developers

- The app is designed for browser-native execution and uses vanilla JavaScript.
- `js/api.js` includes a retry helper for transient HTTP failures.
- Visual audit and copy audit flows both use simulated UI animations while awaiting API responses.
- The project uses dynamic DOM construction instead of a frontend framework.
- New features should be added inside the existing namespace `window.VisiQC`.

## Recommended Improvements

- Add input validation for all modal fields and form rows.
- Improve error handling for offline or invalid API responses.
- Add a dedicated build step or bundler for production packaging.
- Implement a proper parser for AI response sections to reduce reliance on heuristics.
- Provide a fallback when `localStorage` is disabled or unavailable.

## License

This project does not include a license file. Add a `LICENSE` if you plan to publish or share it publicly.

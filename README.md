# Draft Assistant

Draft Assistant is a minimalist, CLI-based tool designed to help writers analyze and improve their drafts using AI-powered suggestions. It provides a streamlined interface for selecting drafts, generating improvement paths, and receiving step-by-step guidance.

## Features

- Minimalist, hackery aesthetic reminiscent of 90s CLI apps
- Draft selection from a list of recent and random drafts
- AI-powered analysis and improvement suggestions
- Step-by-step guidance for implementing improvements
- Markdown-style text formatting in the terminal

## Requirements

- Node.js
- Blessed library
- Axios for API calls
- A local LLM server running on http://localhost:1234 (e.g., LM Studio)

## Installation

1. Clone the repository
2. Run `npm install` to install dependencies
3. Ensure your local LLM server is running on http://localhost:1234

## Usage

Run the app with:

```
node content.js
```

Navigation:
- Use arrow keys to navigate lists
- Enter to select a draft or confirm an action
- 'b' to go back
- 'n' for the next step in guidance
- 'z' to view draft metadata
- 'q' to quit

## Code Structure

The entire app is contained in a single file (`content.js`) for simplicity and ease of modification.

Key components:
- `draftList`: Main view showing all drafts
- `content`: Displays generated paths, steps, and guidance

Main functions:
- `ld()`: Loads and displays drafts
- `gt(draft)`: Generates improvement paths for a selected draft
- `getSteps(draft, path)`: Generates steps for a chosen improvement path
- `getGuidance(draft, step)`: Fetches specific guidance for a step

## Customization

- Draft location: Update the `d` variable to point to your drafts folder
- LLM model: Modify the `model` field in API requests to use a different model
- Formatting: Adjust the `formatText` function to change text formatting rules

## Adding New Features

To add new features:
1. Use Blessed library syntax for UI elements
2. Add new key handlers with `s.key([...], () => {...})`
3. Modify LLM prompts in the `messages` field of API requests

## Known Limitations

- The app doesn't save state between sessions
- There's no built-in way to edit drafts directly in the app
- Error handling could be more robust

## Tips for Future Developers

- Keep the aesthetic minimal - avoid colors and fancy styling
- Prioritize functionality and speed over visual flair
- When adding features, consider how they fit into the "video game quest" metaphor
- Test thoroughly with different drafts and edge cases

Remember, the core philosophy is minimalism with maximum functionality. Any new features should enhance the writing process without cluttering the experience.
# Hancom Docs Automation SDK Challenge

<p align="center">
  <img src="https://user-images.githubusercontent.com/55899582/231488871-e83fb827-1b25-4ec9-a326-b14244677e87.png" width="200">
</p>

## Goal

Build a programmatic SDK that can read and write documents on [Hancom Docs](https://www.hancomdocs.com).

## Context

Hancom Docs is a Korean cloud word processor with no public API. The editor renders everything on `<canvas>`, so standard DOM scraping will not work. You will need to reverse-engineer the web editor's internals to find how to extract and manipulate document content through a Chrome DevTools Protocol connection.

> **Tip**: You are encouraged to use AI assistants throughout this challenge — for brainstorming strategies, understanding code, and writing implementations. How effectively you leverage AI tools is part of what we're evaluating.

---

## Requirements

Build a library that connects to a running Chrome instance with a Hancom Docs editor tab open, and supports the following:

### Required Capabilities

1. **Read the full document text** — extract all text content from the document
2. **Read document structure** — identify paragraphs, tables, and images as distinct elements
3. **Read formatting** — for any paragraph, determine its font name, font size, whether it's bold/italic, and its text color
4. **Search text** — find all occurrences of a search query and return context around each match
5. **Export to Markdown** — convert the document to Markdown with proper heading levels, bold/italic markers
6. **Type text** — insert text at the current cursor position
7. **Find and replace** — replace all occurrences of a string in the document
8. **Create a table** — insert a table with specified rows and columns
9. **Fill table cells** — navigate between cells and type content into them
10. **Save the document** — trigger save

### Bonus Capabilities

- Navigate to a specific page number
- Insert/delete table rows
- Read paragraph style (alignment, line spacing)
- Insert images
- Export the full document as structured JSON with all formatting metadata

## Constraints

- You must use the **Chrome DevTools Protocol** (CDP) — connect to Chrome's WebSocket endpoint, send commands, evaluate JavaScript in the page context
- The editor renders everything on `<canvas>` — there is no DOM text to scrape
- `window.getSelection()` returns empty; clipboard API is blocked
- Standard approaches (DOM scraping, CSS selectors for text) will not work
- You'll need to find a different way to read document content

## Deliverables

1. **Source code** — a working library (TypeScript or Python) with:
   - A client class that connects to Chrome and the Hancom Docs tab
   - Methods for each required capability
   - At least one working example script
2. **Tests** — unit tests for any pure parsing/conversion logic
3. **Architecture doc** (1 page max) — explain:
   - How you discovered the APIs you're using
   - What the key technical insight was
   - What limitations exist
   - How your reading approach works (since DOM scraping doesn't)

## Getting Started

### 1. Set up Chrome remote debugging

Open Chrome and go to `chrome://inspect/#remote-debugging`. Enable remote debugging. Note the port number.

### 2. Open a Hancom Docs document

Go to [hancomdocs.com](https://www.hancomdocs.com), sign in, and open any document in the web editor. The URL should look like:

```
https://webhwp.hancomdocs.com/webhwp/?mode=HWP_EDITOR&docId=...
```

### 3. Reverse-engineer the editor

The web editor is a JavaScript application. Your job is to understand how it works well enough to automate it. How you approach this is part of the evaluation.

There are multiple valid paths — some lead to partial solutions, one leads to a breakthrough that makes everything dramatically easier. If you feel stuck on reading, keep exploring — there is a way to get structured content including formatting from this editor.

### 4. Build your SDK

Connect to Chrome via CDP (WebSocket), evaluate JavaScript in the page context, and send keyboard events. Your library should wrap these low-level operations into clean, high-level methods.

## FAQ

**Q: Can I use Puppeteer/Playwright?**
A: Use raw CDP. Connect to the existing Chrome instance's WebSocket endpoint, send `Runtime.evaluate` for JavaScript execution and `Input.dispatchKeyEvent` for keyboard input. This is the most reliable approach — higher-level libraries add unnecessary abstraction over what the editor needs.

**Q: What if I can't figure out how to read formatted text from canvas?**
A: Implement what you can. Partial solutions that show strong reverse-engineering thinking score well. But don't give up too early on reading — the gap between a partial reading approach and the best one is significant, and finding it is the core of this challenge.

## Related References

- [Chrome DevTools MCP: Debug your browser session](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session) — useful context on Chrome’s newer debugging workflows and how Chrome surfaces browser state for tool-driven inspection.

---

Good luck. We value the journey (your exploration process) as much as the destination (working code).

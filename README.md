# ZuzuMod Studio

A local-first Minecraft 1.21.1 NeoForge mod development studio. React interface, Monaco code editor, pixel-art tools, visual item/block creation, AI-assisted generation with review, real Gradle builds, and a local MCP server.

## Features available in the current development version

- Create a real NeoForge 1.21.1 mod from the official ModDevGradle MDK template.
- Explore and edit source files with syntax highlighting, multiple sections, and Ctrl+S to save.
- Add simple blocks and items without writing Java. ZuzuMod writes the Java registries, asset models, language entries, and PNG files.
- Draw and save 16×16 transparent PNG item and block textures in Sprite Studio.
- Build a JAR with Gradle, launch a development Minecraft client, and download build artifacts.
- Enter a Groq API key locally for AI proposals. Preview proposed changes and explicitly approve them before the studio writes them.
- Expose local projects, files, elements, and builds to MCP-compatible clients using stdio.
- Detect Java and optionally install Microsoft OpenJDK 21 on Windows through winget after explicit user confirmation.

## Run on Windows

1. Install Node.js 22 or later (or compatible Node 20.19+).
2. Clone this GitHub repository or download its ZIP.
3. Open PowerShell in the repository folder and run: npm install
4. Start the local engine and React interface: npm run dev
5. Open http://127.0.0.1:5173
6. Create a project. The first project downloads the official NeoForge MDK from GitHub.
7. To build a mod, install Java 21 using Settings > Install Java 21 (optional), or install Java 21 yourself and restart the studio if PATH needs updating.
8. Add an item or block, edit its 16×16 sprite, and press Build mod. First Gradle builds download Minecraft/NeoForge dependencies and may take some time.

You can also run npm run build followed by npm start to serve the production React UI from the local engine on http://127.0.0.1:4317.

## Where projects are stored

Projects live in ~/ZuzuModStudio/projects on the local machine. On Windows this is typically C:\Users\<your account>\ZuzuModStudio\projects. To change it, set the ZUZUMOD_WORKSPACE environment variable before running the server.

## AI setup

Get your own Groq API key. In Settings, enter it and click Connect. The key stays in process memory and is forgotten when the local engine stops. Alternatively set GROQ_API_KEY in your local environment. Never commit an API key. The model defaults to llama-3.3-70b-versatile and can be overridden through GROQ_MODEL.

AI output is a suggested change set, not a verified compilation result. Always review generated code and run a real build. Visual items/blocks are more reliable than arbitrary AI-generated behaviors.

## MCP

Run npm run mcp inside the repository to start a local stdio MCP server. It exposes:

- list_projects, create_project
- list_project_files, read_project_file, write_project_file
- list_elements, create_element
- build_project

ChatGPT does NOT connect directly to this local stdio server. ChatGPT custom MCP integrations require a supported remote endpoint or secure MCP tunnel, account/workspace permissions, and user configuration. This repository provides a local MCP foundation, not an already-connected ChatGPT app.

## Important limitations

This is a development version, not a signed one-click Windows installer. It has not yet been verified by running an end-to-end Gradle build in a clean Windows environment. It targets NeoForge 1.21.1, basic block/item registration, and 16×16 textures. Recipes, GUIs, animation, arbitrary behaviors, Fabric support, and automatic packaged Windows updates are not yet implemented. Java installation support is currently Windows/winget only.

The official NeoForge template, Gradle wrapper and dependencies are downloaded from their upstream sources. Running Gradle or generated Java can execute code locally; review untrusted projects and AI proposals before building.

## References

Official NeoForge documentation: https://docs.neoforged.net/docs/1.21.1/gettingstarted/

Official NeoForge MDK: https://github.com/NeoForgeMDKs/MDK-1.21.1-ModDevGradle

OpenAI MCP documentation: https://developers.openai.com/api/docs/guides/tools-connectors-mcp

## Development

Run npm run build to type-check and bundle the React studio.

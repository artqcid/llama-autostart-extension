
# Llama Autostart Extension

Diese Extension startet beim Öffnen von VS Code automatisch ein konfigurierbares PowerShell-Startscript (z.B. autostart.ps1), das den Llama-Server initialisiert. Sie ist unabhängig vom Workspace und benötigt keine Synchronisierung der mcp.json mehr.

## Features

- Automatischer Start des Llama-Servers beim Öffnen von VS Code
- Konfigurierbarer Pfad zum Startscript über die Extension-Einstellungen
- Status- und Fehlermeldungen direkt in der VS Code UI

## Voraussetzungen

- PowerShell muss installiert sein (Windows-Standard)
- Ein funktionsfähiges Startscript (z.B. autostart.ps1), das den Llama-Server startet

## Extension Settings

Diese Extension bietet folgende Einstellung:

- `llamaAutostart.autostartScriptPath`: Pfad zum PowerShell-Startscript (Standard: `C:/Users/marku/.continue/llama-vscode-autostart.ps1`)

## Bekannte Probleme

- Das Startscript muss eigenständig funktionieren und Fehler selbst melden.
- Die Extension prüft nicht, ob der Server bereits läuft.

## Release Notes

### 0.0.1
- Initiale Version: Automatischer Start des Llama-Servers beim Öffnen von VS Code.

### 1.0.1

Fixed issue #.

### 1.1.0

Added features X, Y, and Z.

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**

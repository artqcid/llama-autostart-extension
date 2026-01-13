// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Llama Autostart Extension aktiviert.');

	// Autostart-Script aus den Einstellungen lesen
	const config = vscode.workspace.getConfiguration('llamaAutostart');
	const scriptPath = config.get<string>('autostartScriptPath');

	if (!scriptPath) {
		vscode.window.showErrorMessage('Llama Autostart: Kein Pfad zum Startscript konfiguriert.');
		return;
	}

	vscode.window.showInformationMessage('Llama Autostart: Starte Llama-Server...');

	const ps = cp.spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
		detached: true,
		windowsHide: false
	});

	ps.on('error', (err) => {
		vscode.window.showErrorMessage('Llama Autostart: Fehler beim Starten des Scripts: ' + err.message);
	});

	ps.on('exit', (code) => {
		if (code === 0) {
			vscode.window.showInformationMessage('Llama Autostart: Llama-Server wurde gestartet.');
		} else {
			vscode.window.showErrorMessage('Llama Autostart: Script beendet mit Fehlercode ' + code);
		}
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Store running process IDs for cleanup
const runningProcesses: { name: string; pid: number }[] = [];
const terminals: vscode.Terminal[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('Llama Autostart Extension aktiviert.');

	// Autostart-Script aus den Einstellungen lesen
	const config = vscode.workspace.getConfiguration('llamaAutostart');
	const scriptPath = config.get<string>('autostartScriptPath');
	const mcpConfigPath = config.get<string>('mcpConfigPath');
	const enableMcpServer = config.get<boolean>('enableMcpServer', true);
	const useIntegratedTerminal = config.get<boolean>('useIntegratedTerminal', true);

	// Llama-Server starten
	if (scriptPath) {
		startLlamaServer(scriptPath, useIntegratedTerminal);
	} else {
		vscode.window.showWarningMessage('Llama Autostart: Kein Pfad zum Llama-Startscript konfiguriert.');
	}

	// MCP-Server starten (wenn aktiviert)
	if (enableMcpServer && mcpConfigPath) {
		startMcpServer(mcpConfigPath, useIntegratedTerminal);
	}
}

function startLlamaServer(scriptPath: string, useIntegratedTerminal: boolean) {
	if (!fs.existsSync(scriptPath)) {
		vscode.window.showErrorMessage(`Llama Autostart: Startscript nicht gefunden: ${scriptPath}`);
		return;
	}

	vscode.window.showInformationMessage('Llama Autostart: Starte Llama-Server...');

	if (useIntegratedTerminal) {
		// Starte im integrierten Terminal
		const terminal = vscode.window.createTerminal({
			name: 'Llama Server',
			hideFromUser: false
		});
		terminals.push(terminal);
		terminal.sendText(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`);
		
		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: Llama-Server wurde gestartet (siehe Terminal).');
		}, 2000);
	} else {
		// Starte als separater Prozess
		const ps = cp.spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
			detached: true,
			stdio: 'ignore',
			windowsHide: false
		});

		ps.unref();

		ps.on('error', (err) => {
			vscode.window.showErrorMessage('Llama Autostart: Fehler beim Starten des Scripts: ' + err.message);
		});

		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: Llama-Server wurde gestartet.');
		}, 2000);
	}
}

function startMcpServer(mcpConfigPath: string, useIntegratedTerminal: boolean) {
	if (!fs.existsSync(mcpConfigPath)) {
		vscode.window.showWarningMessage(`Llama Autostart: mcp.json nicht gefunden: ${mcpConfigPath}`);
		return;
	}

	try {
		const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
		const servers = mcpConfig.servers || {};

		Object.entries(servers).forEach(([name, config]: [string, any]) => {
			if (config.autoStart === false) {
				console.log(`MCP-Server "${name}" übersprungen (autoStart = false)`);
				return;
			}

			if (!config.command) {
				console.log(`MCP-Server "${name}" hat kein command-Feld`);
				return;
			}

			vscode.window.showInformationMessage(`Llama Autostart: Starte MCP-Server "${name}"...`);

			const args = config.args || [];
			const cwd = config.cwd || path.dirname(mcpConfigPath);

			if (useIntegratedTerminal) {
				// Starte im integrierten Terminal
				const terminal = vscode.window.createTerminal({
					name: `MCP: ${name}`,
					cwd: cwd,
					hideFromUser: false
				});
				terminals.push(terminal);
				
				const argsString = args.map((arg: string) => `"${arg}"`).join(' ');
				terminal.sendText(`& "${config.command}" ${argsString}`);
				
				console.log(`MCP-Server "${name}" gestartet im Terminal`);
			} else {
				// Starte als separater Prozess
				const mcpProcess = cp.spawn(config.command, args, {
					cwd: cwd,
					detached: true,
					stdio: 'ignore'
				});

				mcpProcess.unref();

				if (mcpProcess.pid) {
					runningProcesses.push({ name: `mcp-${name}`, pid: mcpProcess.pid });
				}

				mcpProcess.on('error', (err) => {
					vscode.window.showErrorMessage(`MCP-Server "${name}" konnte nicht gestartet werden: ${err.message}`);
				});

				console.log(`MCP-Server "${name}" gestartet (PID: ${mcpProcess.pid})`);
			}
		});
	} catch (err: any) {
		vscode.window.showErrorMessage(`Fehler beim Laden der mcp.json: ${err.message}`);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Llama Autostart Extension wird deaktiviert - stoppe Server...');

	// Schließe alle erstellten Terminals
	terminals.forEach(terminal => {
		terminal.dispose();
	});

	// Stoppe llama-server
	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force"', {
			windowsHide: true
		});
		console.log('llama-server gestoppt');
	} catch (err) {
		console.log('Kein llama-server-Prozess gefunden oder Fehler beim Stoppen');
	}

	// Stoppe alle gestarteten MCP-Server-Prozesse
	runningProcesses.forEach(proc => {
		try {
			process.kill(proc.pid, 'SIGTERM');
			console.log(`${proc.name} (PID: ${proc.pid}) gestoppt`);
		} catch (err) {
			console.log(`Fehler beim Stoppen von ${proc.name} (PID: ${proc.pid}):`, err);
		}
	});

	// Zusätzlich alle Python-Prozesse stoppen, die web_mcp.py ausführen
	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*web_mcp.py*\' } | Stop-Process -Force"', {
			windowsHide: true
		});
		console.log('MCP Python-Prozesse gestoppt');
	} catch (err) {
		console.log('Keine MCP Python-Prozesse gefunden oder Fehler beim Stoppen');
	}
}


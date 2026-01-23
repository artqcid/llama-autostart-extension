import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const runningProcesses: { name: string; pid: number }[] = [];
const terminals: vscode.Terminal[] = [];
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('Llama Autostart');
	context.subscriptions.push(outputChannel);
	
	outputChannel.appendLine('=== Llama Autostart Extension aktiviert ===');
	outputChannel.show(true);
	
	vscode.window.showInformationMessage('Llama Autostart Extension wurde aktiviert!');

	let startCommand = vscode.commands.registerCommand('llamaAutostart.startServers', () => {
		startServers();
	});

	let stopCommand = vscode.commands.registerCommand('llamaAutostart.stopServers', () => {
		stopServers();
	});

	context.subscriptions.push(startCommand, stopCommand);

	// Autostart on VS Code startup
	startServers();
}

function startServers() {
	outputChannel.appendLine('=== startServers() aufgerufen ===');
	
	const config = vscode.workspace.getConfiguration('llamaAutostart');
	const scriptPath = config.get<string>('autostartScriptPath');
	const useIntegratedTerminal = config.get<boolean>('useIntegratedTerminal', true);

	outputChannel.appendLine(`Konfiguration gelesen:`);
	outputChannel.appendLine(`  scriptPath: ${scriptPath}`);
	outputChannel.appendLine(`  useIntegratedTerminal: ${useIntegratedTerminal}`);

	if (scriptPath) {
		startLlamaServer(scriptPath, useIntegratedTerminal);
	} else {
		vscode.window.showWarningMessage('Llama Autostart: Kein Pfad zum Llama-Startscript konfiguriert.');
	}

	// Starte web_mcp.py direkt (ohne mcp.json)
	startWebMcp(useIntegratedTerminal);
	
	// Starte Embedding Server
	startEmbeddingServer(useIntegratedTerminal);
}

function stopServers() {
	vscode.window.showInformationMessage('Llama Autostart: Stoppe alle Server...');
	outputChannel.appendLine('=== stopServers() aufgerufen ===');
	
	terminals.forEach(terminal => {
		terminal.dispose();
	});
	terminals.length = 0;

	// Stop llama-server
	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force"', {
			windowsHide: true
		});
		outputChannel.appendLine('✓ llama-server gestoppt');
	} catch (err) {
		outputChannel.appendLine('ℹ Kein llama-server-Prozess gefunden');
	}

	// Stop embedding server
	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*embedding_server*\' } | Stop-Process -Force"', {
			windowsHide: true
		});
		outputChannel.appendLine('✓ Embedding Server gestoppt');
	} catch (err) {
		outputChannel.appendLine('ℹ Kein Embedding Server-Prozess gefunden');
	}

	// Stop MCP server
	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*mcp_server*\' } | Stop-Process -Force"', {
			windowsHide: true
		});
		outputChannel.appendLine('✓ MCP Server gestoppt');
	} catch (err) {
		outputChannel.appendLine('ℹ Kein MCP Server-Prozess gefunden');
	}

	runningProcesses.forEach(proc => {
		try {
			process.kill(proc.pid, 'SIGTERM');
			outputChannel.appendLine(`✓ ${proc.name} (PID: ${proc.pid}) gestoppt`);
		} catch (err) {
			outputChannel.appendLine(`ℹ ${proc.name} (PID: ${proc.pid}) konnte nicht gestoppt werden`);
		}
	});
	runningProcesses.length = 0;
}

function startLlamaServer(scriptPath: string, useIntegratedTerminal: boolean) {
	outputChannel.appendLine(`=== startLlamaServer() aufgerufen ===`);
	outputChannel.appendLine(`  scriptPath: ${scriptPath}`);
	outputChannel.appendLine(`  useIntegratedTerminal: ${useIntegratedTerminal}`);
	
	if (!fs.existsSync(scriptPath)) {
		outputChannel.appendLine(`  FEHLER: Startscript nicht gefunden!`);
		vscode.window.showErrorMessage(`Llama Autostart: Startscript nicht gefunden: ${scriptPath}`);
		return;
	}
	
	outputChannel.appendLine(`  Script existiert, starte Server...`);
	vscode.window.showInformationMessage('Llama Autostart: Starte Llama-Server...');

	if (useIntegratedTerminal) {
		const terminal = vscode.window.createTerminal({
			name: 'Llama Server',
			hideFromUser: false
		});
		terminals.push(terminal);
		
		outputChannel.appendLine(`  Terminal erstellt: "Llama Server"`);
		outputChannel.appendLine(`  Starte Befehl: powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`);
		
		terminal.show();
		terminal.sendText(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, true);
		
		outputChannel.appendLine(`  Befehl gesendet!`);
		
		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: Llama-Server wurde gestartet (siehe Terminal).');
		}, 2000);
	} else {
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

function startWebMcp(useIntegratedTerminal: boolean) {
	outputChannel.appendLine('=== startWebMcp() aufgerufen ===');
	
	const mcpServerDir = 'C:\\Users\\marku\\Documents\\GitHub\\artqcid\\ai-projects\\qwen2.5-7b-training\\mcp-server-misc';
	
	if (!fs.existsSync(mcpServerDir)) {
		outputChannel.appendLine(`  FEHLER: MCP Server Submodul nicht gefunden: ${mcpServerDir}`);
		outputChannel.appendLine('  Überspringe MCP Server Start');
		return;
	}

	outputChannel.appendLine(`  MCP Server Verzeichnis: ${mcpServerDir}`);
	vscode.window.showInformationMessage('Llama Autostart: Starte MCP Server (mcp-server-misc)...');

	if (useIntegratedTerminal) {
		const terminal = vscode.window.createTerminal({
			name: 'MCP: web-context',
			hideFromUser: false,
			cwd: mcpServerDir
		});
		terminals.push(terminal);
		
		outputChannel.appendLine(`  Terminal erstellt: "MCP: web-context"`);
		outputChannel.appendLine(`  Starte: python -m mcp_server`);
		
		terminal.show();
		terminal.sendText('python -m mcp_server', true);
		
		outputChannel.appendLine(`  Befehl gesendet!`);
		
		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: MCP Server wurde gestartet (siehe Terminal).');
		}, 2000);
	} else {
		const mcpProcess = cp.spawn('python', ['-m', 'mcp_server'], {
			cwd: mcpServerDir,
			detached: true,
			stdio: 'ignore',
			windowsHide: true
		});

		mcpProcess.unref();

		mcpProcess.on('error', (err) => {
			outputChannel.appendLine(`  FEHLER beim Starten: ${err.message}`);
			vscode.window.showErrorMessage(`Llama Autostart: MCP Server Fehler: ${err.message}`);
		});

		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: MCP Server wurde gestartet.');
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

export function deactivate() {
	console.log('Llama Autostart Extension wird deaktiviert - stoppe Server...');

	terminals.forEach(terminal => {
		terminal.dispose();
	});

	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force"', {
			windowsHide: true
		});
		console.log('llama-server gestoppt');
	} catch (err) {
		console.log('Kein llama-server-Prozess gefunden oder Fehler beim Stoppen');
	}

	runningProcesses.forEach(proc => {
		try {
			process.kill(proc.pid, 'SIGTERM');
			console.log(`${proc.name} (PID: ${proc.pid}) gestoppt`);
		} catch (err) {
			console.log(`Fehler beim Stoppen von ${proc.name} (PID: ${proc.pid}):`, err);
		}
	});

	try {
		cp.execSync('powershell -NoProfile -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*mcp_server*\' } | Stop-Process -Force"', {
			windowsHide: true
		});
		console.log('MCP Server Python-Prozesse gestoppt');
	} catch (err) {
		console.log('Keine MCP Server Python-Prozesse gefunden oder Fehler beim Stoppen');
	}
}

function startEmbeddingServer(useIntegratedTerminal: boolean) {
	outputChannel.appendLine('=== startEmbeddingServer() aufgerufen ===');
	
	const embeddingDir = 'C:\\Users\\marku\\Documents\\GitHub\\artqcid\\ai-projects\\qwen2.5-7b-training\\embedding-server-misc';
	
	if (!fs.existsSync(embeddingDir)) {
		outputChannel.appendLine(`  FEHLER: Embedding Server nicht gefunden: ${embeddingDir}`);
		outputChannel.appendLine('  Überspringe Embedding Server Start');
		return;
	}
	
	outputChannel.appendLine(`  Embedding Server Verzeichnis: ${embeddingDir}`);
	vscode.window.showInformationMessage('Llama Autostart: Starte Embedding Server...');

	if (useIntegratedTerminal) {
		const terminal = vscode.window.createTerminal({
			name: 'Embedding Server',
			hideFromUser: false,
			cwd: embeddingDir
		});
		terminals.push(terminal);
		
		outputChannel.appendLine(`  Terminal erstellt: "Embedding Server"`);
		outputChannel.appendLine(`  Starte: python -m embedding_server`);
		
		terminal.show();
		terminal.sendText('python -m embedding_server', true);
		
		outputChannel.appendLine(`  Befehl gesendet!`);
		
		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: Embedding Server wurde gestartet (siehe Terminal).');
		}, 2000);
	} else {
		const ps = cp.spawn('python', ['-m', 'embedding_server'], {
			cwd: embeddingDir,
			detached: true,
			stdio: 'ignore',
			windowsHide: true
		});

		ps.unref();

		ps.on('error', (err) => {
			outputChannel.appendLine(`  FEHLER beim Starten: ${err.message}`);
			vscode.window.showErrorMessage('Llama Autostart: Fehler beim Starten des Embedding Servers: ' + err.message);
		});

		setTimeout(() => {
			vscode.window.showInformationMessage('Llama Autostart: Embedding Server wurde gestartet.');
		}, 2000);
	}
}



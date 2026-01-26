import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const runningProcesses: { name: string; pid: number }[] = [];
const terminals: vscode.Terminal[] = [];
let outputChannel: vscode.OutputChannel;
let serversStarted = false;

// Server paths configuration (JUCE Development)
const SERVER_PATHS = {
	embedding: 'C:\\Users\\marku\\Documents\\GitHub\\artqcid\\ai-projects\\embedding-server-misc',
	rag: 'C:\\Users\\marku\\Documents\\GitHub\\artqcid\\ai-projects\\rag-server-misc',
	llama: 'C:\\Users\\marku\\.continue\\llama-vscode-autostart.ps1'
};

// Server ports for health checks
const SERVER_PORTS = {
	llama: 8080,
	embedding: 8001,
	rag: 8002
};

// Load paths from settings
function getServerPaths() {
	const config = vscode.workspace.getConfiguration('juce-server-autostart');
	return {
		embedding: config.get<string>('embeddingServerPath', SERVER_PATHS.embedding),
		rag: config.get<string>('ragServerPath', SERVER_PATHS.rag),
		llama: config.get<string>('llamaScriptPath', SERVER_PATHS.llama)
	};
}

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('JUCE Server Autostart');
	context.subscriptions.push(outputChannel);
	
	outputChannel.appendLine('[INFO] ===== JUCE Server Autostart Extension aktiviert =====');
	outputChannel.show(true);
	
	let startCommand = vscode.commands.registerCommand('serverAutostart.startServers', () => {
		startAllServers();
	});

	let stopCommand = vscode.commands.registerCommand('serverAutostart.stopServers', () => {
		stopAllServers();
	});

	let statusCommand = vscode.commands.registerCommand('serverAutostart.showStatus', () => {
		showServerStatus();
	});

	context.subscriptions.push(startCommand, stopCommand, statusCommand);

	// Autostart on VS Code startup
	const autoStartDelay = vscode.workspace.getConfiguration('juce-server-autostart').get<number>('autoStartDelay', 2000);
	outputChannel.appendLine(`[INFO] Starte alle Server beim Extension-Startup (Verzögerung: ${autoStartDelay}ms)...`);
	setTimeout(() => startAllServers(), autoStartDelay);
}

function startAllServers() {
	if (serversStarted) {
		outputChannel.appendLine('[WARN] Server sind bereits gestartet');
		vscode.window.showWarningMessage('Server sind bereits gestartet. Verwende Stop vor Start.');
		return;
	}

	outputChannel.appendLine('[INFO] ===== Starte alle Server =====');
	vscode.window.showInformationMessage('Starte AI-Server...');

	// Validate server paths
	const pathsValid = validateServerPaths();
	if (!pathsValid) {
		vscode.window.showErrorMessage('Ein oder mehrere Server-Pfade sind nicht konfiguriert!');
		return;
	}

	// Startup sequence with dependencies:
	// 1. Llama (Port 8080) - base
	// 2. Embedding (Port 8001) - needs Llama
	// 3. RAG (Port 8002) - needs Embedding + Qdrant
	// Note: MCP is managed by Continue, not by this extension
	
	outputChannel.appendLine('[INFO] Startup-Sequenz: Llama → Embedding → RAG');
	outputChannel.appendLine('[INFO] (MCP wird von Continue verwaltet)');
	startLlamaServer();
	
	// Start Embedding Server after Llama
	setTimeout(() => {
		startEmbeddingServer();
	}, 3000);
	
	// Start RAG Server after Embedding (with Qdrant auto-start)
	setTimeout(() => {
		startRagServer();
		outputChannel.appendLine('[OK] ===== Alle Server gestartet =====');
		vscode.window.showInformationMessage('Alle AI-Server wurden erfolgreich gestartet!');
	}, 8000);

	serversStarted = true;
}

function validateServerPaths(): boolean {
	const paths = getServerPaths();
	let allValid = true;
	
	if (!fs.existsSync(paths.llama)) {
		outputChannel.appendLine(`[ERROR] Llama Script nicht gefunden: ${paths.llama}`);
		allValid = false;
	}
	
	if (!fs.existsSync(paths.embedding)) {
		outputChannel.appendLine(`[ERROR] Embedding-Server Pfad nicht gefunden: ${paths.embedding}`);
		allValid = false;
	}

	if (!fs.existsSync(paths.rag)) {
		outputChannel.appendLine(`[ERROR] RAG-Server Pfad nicht gefunden: ${paths.rag}`);
		allValid = false;
	}
	
	return allValid;
}

function startLlamaServer() {
	const paths = getServerPaths();
	outputChannel.appendLine('[INFO] Starte Llama-Server auf Port 8080...');
	
	const terminal = vscode.window.createTerminal({
		name: 'Llama Server',
		hideFromUser: false
	});
	terminals.push(terminal);
	
	terminal.show();
	const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${paths.llama}"`;
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
	
	// Health check
	setTimeout(() => {
		checkServerHealth('Llama', SERVER_PORTS.llama);
	}, 5000);
}

/**
 * Health check for TCP port availability
 */
async function checkServerHealth(serverName: string, port: number, maxRetries: number = 10): Promise<boolean> {
	return new Promise((resolve) => {
		let retries = 0;
		const check = () => {
			const net = require('net');
			const socket = new net.Socket();
			
			socket.setTimeout(1000);
			socket.once('connect', () => {
				socket.destroy();
				outputChannel.appendLine(`[OK] ${serverName} ist verfügbar (Port ${port})`);
				resolve(true);
			});
			socket.once('timeout', () => {
				socket.destroy();
				retries++;
				if (retries < maxRetries) {
					setTimeout(check, 1000);
				} else {
					outputChannel.appendLine(`[WARN] ${serverName} hat nicht geantwortet nach ${maxRetries * 1000}ms`);
					resolve(false);
				}
			});
			socket.once('error', () => {
				socket.destroy();
				retries++;
				if (retries < maxRetries) {
					setTimeout(check, 1000);
				} else {
					outputChannel.appendLine(`[WARN] ${serverName} konnte nicht erreicht werden (Port ${port})`);
					resolve(false);
				}
			});
			
			socket.connect({ port, host: '127.0.0.1' });
		};
		check();
	});
}

function startEmbeddingServer() {
	const paths = getServerPaths();
	outputChannel.appendLine(`[INFO] Starte Embedding-Server auf Port 8001: ${paths.embedding}`);
	
	const startScript = path.join(paths.embedding, 'start.ps1');
	
	if (!fs.existsSync(startScript)) {
		outputChannel.appendLine(`[ERROR] start.ps1 nicht gefunden: ${startScript}`);
		vscode.window.showErrorMessage('Embedding Server start.ps1 nicht gefunden');
		return;
	}
	
	const terminal = vscode.window.createTerminal({
		name: 'Embedding Server',
		hideFromUser: false
	});
	terminals.push(terminal);
	
	terminal.show();
	const command = `pwsh -NoProfile -ExecutionPolicy Bypass -File "${startScript}"`;
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
	
	// Health check
	setTimeout(() => {
		checkServerHealth('Embedding', SERVER_PORTS.embedding);
	}, 3000);
}

function startRagServer() {
	const paths = getServerPaths();
	outputChannel.appendLine(`[INFO] Starte RAG-Server auf Port 8002: ${paths.rag}`);
	
	const startScript = path.join(paths.rag, 'start.ps1');
	
	if (!fs.existsSync(startScript)) {
		outputChannel.appendLine(`[ERROR] start.ps1 nicht gefunden: ${startScript}`);
		vscode.window.showErrorMessage('RAG Server start.ps1 nicht gefunden');
		return;
	}
	
	const terminal = vscode.window.createTerminal({
		name: 'RAG Server',
		hideFromUser: false
	});
	terminals.push(terminal);
	
	terminal.show();
	const command = `pwsh -NoProfile -ExecutionPolicy Bypass -File "${startScript}"`;
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
	
	// Health check
	setTimeout(() => {
		checkServerHealth('RAG', SERVER_PORTS.rag);
	}, 5000);
}

function stopAllServers() {
	outputChannel.appendLine('[INFO] ===== Stoppe alle Server =====');
	vscode.window.showInformationMessage('Stoppe alle Server...');

	// Dispose terminals
	terminals.forEach(terminal => {
		outputChannel.appendLine(`[INFO] Schließe Terminal: ${terminal.name}`);
		terminal.dispose();
	});
	terminals.length = 0;

	// Stop via PowerShell (Note: MCP is managed by Continue)
	const stopCommands = [
		{
			name: 'RAG Server + Qdrant',
			cmd: "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*rag*' } | Stop-Process -Force; Get-Process qdrant -ErrorAction SilentlyContinue | Stop-Process -Force"
		},
		{
			name: 'Embedding Server',
			cmd: "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*embedding_server*' } | Stop-Process -Force"
		},
		{
			name: 'Llama-Server',
			cmd: 'Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force'
		}
	];

	stopCommands.forEach(({ name, cmd }) => {
		try {
			cp.execSync(`powershell -NoProfile -Command "${cmd}"`, {
				windowsHide: true
			});
			outputChannel.appendLine(`[OK] ${name} gestoppt`);
		} catch (err) {
			outputChannel.appendLine(`[INFO] ${name} nicht aktiv`);
		}
	});

	serversStarted = false;
	outputChannel.appendLine('[OK] Alle Server gestoppt');
	vscode.window.showInformationMessage('Alle Server wurden gestoppt.');
}

function showServerStatus() {
	outputChannel.appendLine('[INFO] ===== Server Status =====');
	
	// Check Llama
	try {
		const result = cp.execSync(
			'powershell -NoProfile -Command "Get-Process llama-server -ErrorAction SilentlyContinue | Select-Object ProcessName, Id"',
			{ encoding: 'utf-8', windowsHide: true }
		);
		if (result) {
			outputChannel.appendLine('[OK] Llama-Server läuft');
		} else {
			outputChannel.appendLine('[STOP] Llama-Server nicht aktiv');
		}
	} catch {
		outputChannel.appendLine('[STOP] Llama-Server nicht aktiv');
	}
	
	// Check Embedding
	try {
		const result = cp.execSync(
			"powershell -NoProfile -Command \"Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*embedding*' } | Select-Object ProcessName, Id\"",
			{ encoding: 'utf-8', windowsHide: true }
		);
		if (result) {
			outputChannel.appendLine('[OK] Embedding-Server läuft');
		} else {
			outputChannel.appendLine('[STOP] Embedding-Server nicht aktiv');
		}
	} catch {
		outputChannel.appendLine('[STOP] Embedding-Server nicht aktiv');
	}

	// Check RAG
	try {
		const result = cp.execSync(
			"powershell -NoProfile -Command \"Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*rag*' } | Select-Object ProcessName, Id\"",
			{ encoding: 'utf-8', windowsHide: true }
		);
		if (result) {
			outputChannel.appendLine('[OK] RAG-Server läuft');
		} else {
			outputChannel.appendLine('[STOP] RAG-Server nicht aktiv');
		}
	} catch {
		outputChannel.appendLine('[STOP] RAG-Server nicht aktiv');
	}

	// Check Qdrant
	try {
		const result = cp.execSync(
			"powershell -NoProfile -Command \"Get-Process qdrant -ErrorAction SilentlyContinue | Select-Object ProcessName, Id\"",
			{ encoding: 'utf-8', windowsHide: true }
		);
		if (result) {
			outputChannel.appendLine('[OK] Qdrant läuft');
		} else {
			outputChannel.appendLine('[STOP] Qdrant nicht aktiv');
		}
	} catch {
		outputChannel.appendLine('[STOP] Qdrant nicht aktiv');
	}
	
	// Check MCP (managed by Continue, status only)
	outputChannel.appendLine('');
	outputChannel.appendLine('[INFO] --- Continue-verwaltete Server ---');
	try {
		const result = cp.execSync(
			"powershell -NoProfile -Command \"Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*mcp*' } | Select-Object ProcessName, Id\"",
			{ encoding: 'utf-8', windowsHide: true }
		);
		if (result) {
			outputChannel.appendLine('[OK] MCP-Server läuft (von Continue verwaltet)');
		} else {
			outputChannel.appendLine('[STOP] MCP-Server nicht aktiv (wird von Continue gestartet)');
		}
	} catch {
		outputChannel.appendLine('[STOP] MCP-Server nicht aktiv (wird von Continue gestartet)');
	}
	
	vscode.window.showInformationMessage('Server Status angezeigt (siehe Output)');
}

export function deactivate() {
	outputChannel.appendLine('[INFO] ===== Extension wird deaktiviert =====');
	
	terminals.forEach(terminal => {
		terminal.dispose();
	});
	terminals.length = 0;

	// Optional: Server beim Deaktivieren stoppen
	stopAllServers();
}



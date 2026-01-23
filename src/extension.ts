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
	mcp: 'C:\\Users\\marku\\Documents\\GitHub\\artqcid\\ai-projects\\mcp-server-misc',
	embedding: 'C:\\Users\\marku\\Documents\\GitHub\\artqcid\\ai-projects\\embedding-server-misc',
	llama: 'C:\\Users\\marku\\.continue\\llama-vscode-autostart.ps1'
};

// Load paths from settings
function getServerPaths() {
	const config = vscode.workspace.getConfiguration('juce-server-autostart');
	return {
		mcp: config.get<string>('mcpServerPath', SERVER_PATHS.mcp),
		embedding: config.get<string>('embeddingServerPath', SERVER_PATHS.embedding),
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

	// Start Llama Server (fixed path)
	startLlamaServer();
	
	// Start Embedding Server
	setTimeout(() => {
		startEmbeddingServer();
	}, 2000);
	
	// Start MCP Server
	setTimeout(() => {
		startMcpServer();
	}, 5000);

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
	
	if (!fs.existsSync(paths.mcp)) {
		outputChannel.appendLine(`[ERROR] MCP-Server Pfad nicht gefunden: ${paths.mcp}`);
		allValid = false;
	}
	
	return allValid;
}

function startLlamaServer() {
	const paths = getServerPaths();
	outputChannel.appendLine('[INFO] Starte Llama-Server...');
	
	const terminal = vscode.window.createTerminal({
		name: 'Llama Server',
		hideFromUser: false
	});
	terminals.push(terminal);
	
	terminal.show();
	const command = `powershell -NoProfile -ExecutionPolicy Bypass -File "${paths.llama}"`;
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
}

function startEmbeddingServer() {
	const paths = getServerPaths();
	outputChannel.appendLine(`[INFO] Starte Embedding-Server: ${paths.embedding}`);
	
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
}

function startMcpServer() {
	const paths = getServerPaths();
	outputChannel.appendLine(`[INFO] Starte MCP-Server: ${paths.mcp}`);
	
	const startScript = path.join(paths.mcp, 'start.ps1');
	
	if (!fs.existsSync(startScript)) {
		outputChannel.appendLine(`[ERROR] start.ps1 nicht gefunden: ${startScript}`);
		vscode.window.showErrorMessage('MCP Server start.ps1 nicht gefunden');
		return;
	}
	
	const terminal = vscode.window.createTerminal({
		name: 'MCP Server',
		hideFromUser: false
	});
	terminals.push(terminal);
	
	terminal.show();
	const command = `pwsh -NoProfile -ExecutionPolicy Bypass -File "${startScript}"`;
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
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

	// Stop via PowerShell
	const stopCommands = [
		{
			name: 'Llama-Server',
			cmd: 'Get-Process llama-server -ErrorAction SilentlyContinue | Stop-Process -Force'
		},
		{
			name: 'Embedding Server',
			cmd: "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*embedding_server*' } | Stop-Process -Force"
		},
		{
			name: 'MCP Server',
			cmd: "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*mcp_server*' } | Stop-Process -Force"
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
	
	// Check MCP
	try {
		const result = cp.execSync(
			"powershell -NoProfile -Command \"Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*mcp*' } | Select-Object ProcessName, Id\"",
			{ encoding: 'utf-8', windowsHide: true }
		);
		if (result) {
			outputChannel.appendLine('[OK] MCP-Server läuft');
		} else {
			outputChannel.appendLine('[STOP] MCP-Server nicht aktiv');
		}
	} catch {
		outputChannel.appendLine('[STOP] MCP-Server nicht aktiv');
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



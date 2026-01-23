import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const runningProcesses: { name: string; pid: number }[] = [];
const terminals: vscode.Terminal[] = [];
let outputChannel: vscode.OutputChannel;
let serversStarted = false;

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel('Server Autostart');
	context.subscriptions.push(outputChannel);
	
	outputChannel.appendLine('[INFO] ===== AI Server Autostart Extension aktiviert =====');
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
	outputChannel.appendLine('[INFO] Starte alle Server beim Extension-Startup...');
	setTimeout(() => startAllServers(), 2000);
}

function startAllServers() {
	if (serversStarted) {
		outputChannel.appendLine('[WARN] Server sind bereits gestartet');
		vscode.window.showWarningMessage('Server sind bereits gestartet. Verwende Stop vor Start.');
		return;
	}

	outputChannel.appendLine('[INFO] ===== Starte alle Server =====');
	vscode.window.showInformationMessage('Starte AI-Server...');

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		outputChannel.appendLine('[ERROR] Kein Workspace gefunden');
		vscode.window.showErrorMessage('Kein Workspace geöffnet.');
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const manageScriptPath = path.join(workspaceRoot, 'scripts', 'manage_servers.ps1');
	const startMcpScriptPath = path.join(workspaceRoot, 'scripts', 'start_mcp_server.ps1');

	// Starte Llama + Embedding via manage_servers.ps1
	startManagedServers(manageScriptPath);
	
	// Starte MCP Server standalone
	setTimeout(() => {
		startStandaloneMcp(startMcpScriptPath);
	}, 3000);

	serversStarted = true;
}

function startManagedServers(scriptPath: string) {
	outputChannel.appendLine(`[INFO] Starte Llama + Embedding via: ${scriptPath}`);
	
	if (!fs.existsSync(scriptPath)) {
		outputChannel.appendLine(`[ERROR] manage_servers.ps1 nicht gefunden: ${scriptPath}`);
		vscode.window.showErrorMessage(`Script nicht gefunden: ${scriptPath}`);
		return;
	}

	const terminal = vscode.window.createTerminal({
		name: 'AI Servers',
		hideFromUser: false
	});
	terminals.push(terminal);

	terminal.show();
	const command = `pwsh -NoProfile -Command "& '${scriptPath}' -Action 'start-all'"`;
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
}

function startStandaloneMcp(scriptPath: string) {
	outputChannel.appendLine(`[INFO] Starte Standalone MCP Server: ${scriptPath}`);
	
	if (!fs.existsSync(scriptPath)) {
		outputChannel.appendLine(`[WARN] start_mcp_server.ps1 nicht gefunden: ${scriptPath}`);
		outputChannel.appendLine('[INFO] MCP Server kann später manuell gestartet werden');
		return;
	}

	const terminal = vscode.window.createTerminal({
		name: 'MCP Server',
		hideFromUser: false
	});
	terminals.push(terminal);

	terminal.show();
	const command = `pwsh -NoProfile -Command "& '${scriptPath}'"`; 
	outputChannel.appendLine(`[CMD] ${command}`);
	terminal.sendText(command, true);
	
	outputChannel.appendLine('[OK] MCP Server Prozess gestartet');
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
	vscode.window.showInformationMessage('Zeige Server Status...');

	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		outputChannel.appendLine('[ERROR] Kein Workspace gefunden');
		return;
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const statusScriptPath = path.join(workspaceRoot, 'scripts', 'manage_servers.ps1');

	const terminal = vscode.window.createTerminal({
		name: 'Server Status',
		hideFromUser: false
	});
	terminals.push(terminal);

	terminal.show();
	const command = `pwsh -NoProfile -Command "& '${statusScriptPath}' -Action 'status'"`;
	terminal.sendText(command, true);
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



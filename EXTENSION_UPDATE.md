# VS Code Extension Update - Server Autostart Integration

## Overview
The vscode-autostart-extension has been completely refactored to support the new standalone server architecture. It now automatically starts all three servers (Llama, Embedding, and MCP) when VS Code loads.

## Changes Made

### Extension Architecture
- **Old**: Direct server launching via hardcoded paths
- **New**: Uses PowerShell scripts (manage_servers.ps1, start_mcp_server.ps1) via workspace root detection

### Functions Updated

#### 1. **activate()**
- Now uses workspace-relative paths instead of hardcoded paths
- Added 2-second delay before auto-starting servers
- Shows activation message in output channel

#### 2. **startAllServers()**
- New function that orchestrates all server launches
- Calls `startManagedServers()` for Llama + Embedding
- Calls `startStandaloneMcp()` after 3-second delay for MCP

#### 3. **startManagedServers(scriptPath: string)**
- Launches manage_servers.ps1 with `-Action 'start-all'`
- Creates terminal named 'AI Servers'
- Handles path validation and error messaging

#### 4. **startStandaloneMcp(scriptPath: string)**
- Launches start_mcp_server.ps1 independently
- Creates terminal named 'MCP Server'
- Non-blocking operation with grace delay

#### 5. **stopAllServers()**
- Disposes all active terminals
- Stops processes via PowerShell:
  - llama-server.exe
  - python embedding_server processes
  - python mcp_server processes
- Sets serversStarted flag to false

#### 6. **showServerStatus()**
- Executes manage_servers.ps1 with `-Action 'status'`
- Displays results in new terminal

### Removed Functions
- `startLlamaServer()` - Now handled by manage_servers.ps1
- `startWebMcp()` - Replaced by startStandaloneMcp()
- `startMcpServer()` - Configuration-based approach no longer needed
- `startEmbeddingServer()` - Now handled by manage_servers.ps1

### Command Registrations
```typescript
// Available commands:
- serverAutostart.startServers    → Manually start all servers
- serverAutostart.stopServers     → Manually stop all servers
- serverAutostart.showStatus      → Show server status
```

## Behavior

### On VS Code Startup
1. Extension activates
2. 2-second delay for VS Code to fully load
3. Auto-start begins:
   - Creates 'AI Servers' terminal
   - Executes manage_servers.ps1 start-all
   - After 3 seconds, creates 'MCP Server' terminal
   - Executes start_mcp_server.ps1

### Server Start Sequence
```
T+0s: Extension loads
T+2s: startAllServers() invoked
      → startManagedServers() [Llama + Embedding]
T+3s: startStandaloneMcp() [MCP Server]
T+X: Servers fully operational
```

### On VS Code Shutdown/Extension Deactivation
1. All terminals are disposed
2. All server processes are stopped:
   - llama-server
   - embedding server (Python)
   - MCP server (Python)

## Integration Points

### Scripts Used
- **manage_servers.ps1**: Handles Llama + Embedding lifecycle
- **start_mcp_server.ps1**: Handles standalone MCP startup
- **Port Configuration**: 
  - Llama: 8080 (managed by llama_config.json)
  - Embedding: 8001 (default)
  - MCP: 3001 (SSE endpoint, managed by mcp_config.json)

### Workspace Detection
- Automatically detects workspace root from VS Code
- Uses workspace root to locate scripts:
  - `{workspace}/scripts/manage_servers.ps1`
  - `{workspace}/scripts/start_mcp_server.ps1`

### Terminal Management
- All launched servers run in visible integrated terminals
- Terminals persist for manual control/inspection
- Can be manually closed without affecting extension state

## Error Handling

### Path Validation
- Checks if scripts exist before execution
- Shows error messages if scripts not found
- MCP startup is non-critical (marked as WARN if missing)

### Process Management
- Graceful handling of already-running servers
- Warnings if attempting to start servers when already started
- Silent handling if servers not running during stop

### Output Logging
- All operations logged to 'Server Autostart' output channel
- Log format: `[INFO]`, `[WARN]`, `[ERROR]`, `[OK]`, `[CMD]`
- Complete audit trail of server lifecycle

## Testing Checklist

- [ ] VS Code starts and extension auto-activates
- [ ] 'AI Servers' terminal appears with manage_servers.ps1 output
- [ ] Llama server starts on port 8080
- [ ] Embedding server starts on port 8001
- [ ] 'MCP Server' terminal appears after 3-second delay
- [ ] MCP server starts on port 3001 (SSE)
- [ ] All three servers operational simultaneously
- [ ] Stop command properly terminates all servers
- [ ] Status command shows accurate server states
- [ ] Output channel contains proper logging

## Configuration

The extension uses the following configuration files (auto-detected via workspace):
- `llama_config.json` - Llama server configuration
- `mcp_config.json` - MCP server configuration
- `web_context_sets.json` - Web scraping sources for MCP

No extension-specific settings needed; all configuration handled by manage_servers.ps1 and start_mcp_server.ps1.

## Future Enhancements
- Add settings page for startup delay customization
- Add option to disable auto-start on extension load
- Add per-server start/stop commands
- Add health check indicators
- Add configuration editor UI

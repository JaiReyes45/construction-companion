export function codexPackage(version){
 const identity={name:'construction-companion',version,description:'A local construction site beside your coding agent.',author:{name:'Construction Companion contributors'},license:'MIT'};
 const server={type:'stdio',command:'node',args:['bin/mcp.mjs','--host','codex'],cwd:'.'};
 const events=['SessionStart','SessionEnd','UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','SubagentStart','SubagentStop','Stop','Interrupt'];
 // Codex can execute hooks with either PowerShell or cmd. Resolve the root
 // inside Node so shell-specific environment expansion cannot change it.
 const windowsHook=`node -e "import(require('node:url').pathToFileURL(process.env.PLUGIN_ROOT+'/bin/hook.mjs').href)" -- --host codex`;
 const hooks={hooks:Object.fromEntries(events.map(event=>[event,[{hooks:[{type:'command',command:'node "${PLUGIN_ROOT}/bin/hook.mjs" --host codex',command_windows:windowsHook,timeout:3}]}]]))};
 // Codex 0.155.1 deliberately excludes hooks for the root AgentPlugin format.
 // Its supported Codex manifest keeps these local lifecycle hooks discoverable.
 return {installVerb:'add',files:{'.codex-plugin/plugin.json':{...identity,skills:'./skills/',mcpServers:'./mcp.json',hooks:'./hooks/hooks.json'},'mcp.json':{mcpServers:{'construction-companion':server}},'hooks/hooks.json':hooks}};
}

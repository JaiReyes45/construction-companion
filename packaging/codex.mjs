export function codexPackage(version){
 const identity={name:'construction-companion',version,description:'A local construction site beside your coding agent.',author:{name:'Construction Companion contributors'},license:'MIT'};
 const server={type:'stdio',command:'node',args:['${PLUGIN_ROOT}/bin/mcp.mjs','--host','codex']};
 const events=['SessionStart','SessionEnd','UserPromptSubmit','PreToolUse','PostToolUse','PermissionRequest','SubagentStart','SubagentStop','Stop','Interrupt'];
 const hooks={hooks:Object.fromEntries(events.map(event=>[event,[{hooks:[{type:'command',command:'node "${PLUGIN_ROOT}/bin/hook.mjs" --host codex',command_windows:'node "%PLUGIN_ROOT%/bin/hook.mjs" --host codex',timeout:3}]}]]))};
 return {installVerb:'add',files:{'plugin.json':{$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',...identity},'.codex-plugin/plugin.json':{...identity,skills:'./skills/',mcpServers:'./mcp.json',hooks:'./hooks/hooks.json'},'mcp.json':{$schema:'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',mcpServers:{'construction-companion':server}},'hooks/hooks.json':hooks}};
}

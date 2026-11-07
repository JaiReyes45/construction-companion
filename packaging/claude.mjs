export function claudePackage(version){
 const identity={name:'construction-companion',version,description:'A local construction site beside your coding agent.',author:{name:'Construction Companion contributors'},license:'MIT'};
 const events=['SessionStart','SessionEnd','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','PermissionRequest','SubagentStart','SubagentStop','TaskCompleted','Stop'];
 const hooks={hooks:Object.fromEntries(events.map(event=>[event,[{hooks:[{type:'command',command:'node "${CLAUDE_PLUGIN_ROOT}/bin/hook.mjs" --host claude',timeout:3}]}]]))};
 return {installVerb:'install',files:{'.claude-plugin/plugin.json':{...identity,skills:'./skills/'},'.mcp.json':{mcpServers:{'construction-companion':{type:'stdio',command:'node',args:['${CLAUDE_PLUGIN_ROOT}/bin/mcp.mjs','--host','claude']}}},'hooks/hooks.json':hooks}};
}

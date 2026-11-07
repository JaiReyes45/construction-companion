export function makeViewModel({scene,question,recommendations,installation,memory,connected}){
 const permission=Object.values(scene.permissions).some(p=>p.status==='waiting');
 const correlatedPermission=Object.values(scene.permissions).some(p=>p.status==='waiting'&&p.id!=='native-permission');
 // Codex PermissionRequest omits tool_use_id, so its resolution cannot be
 // inferred from a later, possibly parallel tool. Keep that notice historical.
 const permissionText=correlatedPermission?'Review the permission request in your coding host.':'A native permission was requested. Check your coding host for its current status.';
 const statusText=!connected?'Disconnected — reconnect to your local project.':question?.status==='open'?'Your head engineer has a question.':correlatedPermission?'Waiting for native permission. Return to your coding host.':permission?'Native permission status is available in your coding host.':'Watching your project. Continue in your coding host.';
 const actions=question?.status==='open'?question.options.map(o=>({id:o.id,label:o.label,enabled:connected})):[];
 const installationText=installation?.status==='awaiting-reload'?'Reload your coding host to finish setup.':installation?.status==='failed'?'Installation failed. Review it in your coding host.':installation?.status==='requested'?'Installation requested through your coding host.':installation?.status==='verified'?'Installation verified. Choose the skill to assign it.':installation?'Review the proposed installation.':'';
 return {statusText,actions,question,recommendations,installationText,memory,tasks:Object.values(scene.tasks),permission,permissionText,historyGap:scene.historyGap};
}

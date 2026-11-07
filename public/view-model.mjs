export function makeViewModel({scene,question,recommendations,installation,memory,connected}){
 const permission=Object.values(scene.permissions).some(p=>p.status==='waiting');
 const statusText=!connected?'Disconnected — reconnect to your local project.':permission?'Waiting for native permission. Return to your coding host.':question?.status==='open'?'Your head engineer has a question.':'Watching your project. Continue in your coding host.';
 const actions=question?.status==='open'?question.options.map(o=>({id:o.id,label:o.label,enabled:connected})):[];
 const installationText=installation?.status==='awaiting-reload'?'Reload your coding host to finish setup.':installation?.status==='failed'?'Installation failed. Review it in your coding host.':installation?.status==='requested'?'Installation requested through your coding host.':installation?.status==='verified'?'Installation verified. Choose the skill to assign it.':installation?'Review the proposed installation.':'';
 return {statusText,actions,question,recommendations,installationText,memory,tasks:Object.values(scene.tasks),permission,historyGap:scene.historyGap};
}

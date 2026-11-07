// Keep exact versions: a newer host is not evidence of a compatible hook protocol.
// Native acceptance must pass before publishing changes to this compatibility table.
export function resolveHostCapability({host,hostVersion,platform=process.platform}){
 const supported=host==='codex'&&hostVersion==='0.155.1'&&platform==='win32';
 return {host,hostVersion,platform,hooks:supported?'verified':'unverified',questionMode:supported?'verified-short':'native-chat'};
}

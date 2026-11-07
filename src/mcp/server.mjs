import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {registerTools} from './tools.mjs';
export async function startMcp({client,capability,transport=new StdioServerTransport()}){
 const server=new McpServer({name:'construction-companion',version:'0.1.0-preview.1'});
 registerTools(server,{client,capability});await server.connect(transport);return {close:()=>server.close()};
}

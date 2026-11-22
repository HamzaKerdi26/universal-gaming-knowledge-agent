// Importing this module registers every built-in MCP tool. Adding a new
// tool later means creating one new file under tools/ and adding one
// line here — nothing else (the registry, the agent capability that
// calls it) needs to change.
import { mcpRegistry } from "../registry";
import { getGameInfoTool } from "./getGameInfo.tool";

mcpRegistry.register(getGameInfoTool);

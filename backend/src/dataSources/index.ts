// Importing this module registers every built-in data source. Adding a
// new source later (Reddit, Discord, a general web source, etc.) means
// creating one new file under providers/ implementing DataSource, and
// adding one line here — nothing else (the registry, dataSourceService,
// the controller/routes) needs to change.
import { dataSourceRegistry } from "./registry";
import { RawgSource } from "./providers/rawgSource";
import { WikipediaSource } from "./providers/wikipediaSource";
import { env } from "../config/env";

// RawgSource is only registered when a key is actually configured —
// there's no way for it to function without one, so it isn't offered as
// a "source: rawg" option that would just fail on every call. Wikipedia
// needs no credentials and is always available.
if (env.dataSources.rawgApiKey) {
  dataSourceRegistry.register(new RawgSource(env.dataSources.rawgApiKey));
}
dataSourceRegistry.register(new WikipediaSource());

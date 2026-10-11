import { WORKSPACE_IDS, WORKSPACE_CATALOG, EXPLORE_GROUPS, FEATURED_WORKSPACE_IDS } from './entry-source/workspace-catalog.ts';
import { resolveAppRoute, canonicalUrlForRoute } from './entry-source/navigation.ts';
import { SCENARIO_PRESET_CARDS } from './entry-source/catalog.ts';
import { scenarioForPreset } from './entry-source/presets.ts';
import { buildJourneyScenario, journeyStateAt } from './entry-source/model.ts';
import { createPortableJourneyScenario, normalizePortableJourneyScenario, scenarioConfigFromPortable, encodeJourneyQuery, decodeJourneyQuery } from './entry-source/scenario.ts';
document.getElementById('hop-connected-review').entryDomain=Object.freeze({WORKSPACE_IDS,WORKSPACE_CATALOG,EXPLORE_GROUPS,FEATURED_WORKSPACE_IDS,SCENARIO_PRESET_CARDS,resolveAppRoute,canonicalUrlForRoute,scenarioForPreset,buildJourneyScenario,journeyStateAt,createPortableJourneyScenario,normalizePortableJourneyScenario,scenarioConfigFromPortable,encodeJourneyQuery,decodeJourneyQuery});

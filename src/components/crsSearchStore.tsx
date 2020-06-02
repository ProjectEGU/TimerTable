import { crsdb, Campus, Campus_Formatted } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"

import { store, view, batch } from "react-easy-state"
import { crs_arrange, SearchPrefs, DayLengthPreference, TimePreference } from "./schedule";

export enum SectionFilterMode {
    Solo, // indicates that solely those sections are to be included when searching.
    Exclude // indicates that those sections are to be excluded when searching.
}

export interface SearchInput {
    search_crs_list: Course[];
    search_crs_solo_sections_map: Map<string, Set<string>>,// map from course unique ID to a set of solo/exclude sections ids
    search_crs_exclude_sections_map: Map<string, Set<string>>, // at any point, the same course may not be in both solo_sections and exclude_sections
    search_crs_conflict_group_map: Map<string, string>,
    search_result_selections: number[]; // Array of selected indices for equivalent sections in the current search result.

    search_crs_enabled: boolean[],
    search_crs_sections_filtermode: SectionFilterMode[],

}

export interface crsSearchStoreFormat {
    cur_campus_set: Set<Campus>;
    cur_session: string; //a string that represents the current session, such as 20199 or 20205
    search_inputs_tbl: Map<string, SearchInput>;
    
    search_prefs: SearchPrefs;
    addSearchCrs: (crsObj: Course) => void; // add a search course to the current session
    removeSearchCrs: (crsObj: Course) => void; // remove a course from the current session
    updateSearchCrsFilterSections: (targetCrsObj: Course, new_solo_sections: Map<string, Set<string>>, new_exclude_sections: Map<string, Set<string>>) => void;
    toggleCrsIndex: (idx: number) => void;
}


const default_session = "20205";


const searchInputsTbl = new Map<string, SearchInput>();
crsdb.session_list().forEach(session => {searchInputsTbl.set(session,
    {
        search_crs_list: [],
        search_crs_solo_sections_map: new Map<string, Set<string>>(),
        search_crs_exclude_sections_map: new Map<string, Set<string>>(),
        search_crs_conflict_group_map: new Map<string, string>(),
        // at any point, a course may not have the same course in both solo_sections and exclude_sections
        search_crs_enabled: [],
        search_crs_sections_filtermode: [],
        search_result_selections: [],
    })});

const crsSearchStore = store<crsSearchStoreFormat>({
    cur_campus_set: new Set<Campus>([Campus.UTM, Campus.STG_ARTSCI]),
    cur_session: default_session,
    search_inputs_tbl: searchInputsTbl,
    search_prefs: {
        dayLengthPreference: DayLengthPreference.NoPreference,
        timePreference: TimePreference.NoPreference,
        prioritizeFreeDays: false
    },
    addSearchCrs: (crsObj: Course) => {
        let stbl = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);

        // if course is already in current list, then skip operation
        if (stbl.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id) != -1)
            return;

        batch(() => {
            stbl.search_crs_list.push(crsObj);

            stbl.search_crs_solo_sections_map.set(crsObj.unique_id, new Set<string>());
            stbl.search_crs_exclude_sections_map.set(crsObj.unique_id, new Set<string>());

            crs_arrange.get_conflict_map(stbl.search_crs_list, stbl.search_crs_solo_sections_map, stbl.search_crs_exclude_sections_map).forEach((val, key) => {
                stbl.search_crs_conflict_group_map.set(key, this.conflict_color_list[val % this.conflict_color_list.length]);
            });

            stbl.search_crs_enabled.push(true);
            stbl.search_crs_sections_filtermode.push(SectionFilterMode.Exclude);
        })
    },
    removeSearchCrs: (crsObj: Course) => {
        let stbl = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);

        let removeIdx = stbl.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id);
        console.assert(removeIdx != -1);

        batch(() => {
            stbl.search_crs_list.splice(removeIdx, 1);

            stbl.search_crs_solo_sections_map.delete(crsObj.unique_id);
            stbl.search_crs_exclude_sections_map.delete(crsObj.unique_id);

            crs_arrange.get_conflict_map(stbl.search_crs_list, stbl.search_crs_solo_sections_map, stbl.search_crs_exclude_sections_map).forEach((val, key) => {
                stbl.search_crs_conflict_group_map.set(key, this.conflict_color_list[val % this.conflict_color_list.length]);
            });
            stbl.search_crs_enabled.splice(removeIdx, 1);
            stbl.search_crs_sections_filtermode.splice(removeIdx, 1);
        });
    },
    updateSearchCrsFilterSections: (targetCrsObj: Course, new_solo_sections: Map<string, Set<string>>, new_exclude_sections: Map<string, Set<string>>) => {
        const stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);

        let crsIdx = stbl.search_crs_list.findIndex(crs => crs.unique_id == targetCrsObj.unique_id);
        console.assert(crsIdx != -1);

        batch(() => {
            // if a whitelist is specified, then activate the whitelist mode. otherwise, continue to use blacklist mode.
            stbl.search_crs_sections_filtermode[crsIdx] = new_solo_sections.get(targetCrsObj.unique_id).size != 0 ? SectionFilterMode.Solo : SectionFilterMode.Exclude;
            stbl.search_crs_solo_sections_map = new_solo_sections;
            stbl.search_crs_exclude_sections_map = new_exclude_sections;
        });

    },
    toggleCrsIndex: (idx: number) => {
        const stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);
        stbl.search_crs_enabled[idx] = !(stbl.search_crs_enabled[idx]);
    },
});

export default crsSearchStore;


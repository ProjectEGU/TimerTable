import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { Solution as DLXSolution } from "./dlxmatrix"
import { crsdb, Campus, Campus_Formatted } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"
import { SchedDisp } from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Icon, Input, Badge, Collapse, Pagination, Popover, Checkbox, message, Skeleton, Menu, Dropdown } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";
import { AssertionError } from "assert";
import { crs_arrange, SchedSearchResult } from "./schedule";
import { SettingsButton } from "./settings_button";
import { Tagged } from "./mutation_tagger";



/**
 * Jan 22 todo:
 * Priority 1
 * [ ] Sched rank algorithm. sort the schedules by rank.
 *      possible heuristics:
 *          - Prefer shorter days
 *          - Prefer earlier/middle/evening
 *          - Prefer free days
 *      prefilterable restrictions:
 *          - No courses within selected timeslots
 *          - Allow for conflicts of up to 30 mins or more
 *          - Allow for conflict with a specific course
 *          - No more than 3 hours of courses in a row
 *              (can also be no more than 3 hours of lectures)
 *          - At least 1 hour between courses of different campus
 * [X] Toggle courses on/off
 *      [ ] Cache previous search indices
 * [X] save courses with cookies ploX
 * [X] "Block sections" by excluding them, or "Lock" a section.
 *      [X] locking down lecture sections doesn't also mean locking down tutorials or practicals - TEMP FIXED 
 *              - more permanent solution requires to have separate sets for each section type for each course. this ends up to be 3 sets per course.
 *      [ ] group equivalent sections together by color on the right panel display
 *      [ ] show if any type of required section had been fully excluded.
 *      [ ] how to keep the same result while locked ? 
 * [ ] If error with added course (no meeting sections and whatnot) then display a warning.
 * [ ] Better displaying of currently selected campus(es)
 *       [X] Show clear difference between StG and UTM courses.
 * [ ] Use immutable.js
 * [ ] Allow saving of schedules
 * [ ] Allow for selection of sessions
 * 
 * Priority 2
 * [ ] Show hover effect when mouseover course list
 * [ ] Select unoccupied timeslots and find courses to occupy them.
 * [ ] Apply filters to results (on the right)
 * [ ] Show overview of sections in current view
 * [ ] Show helpful links to respective timetables tools (in particular, show coursefinder link under search for "advanced searching options"
 * [ ] Filter or prefer courses by their number of sections: [24L]
 * [ ] Allow temporary disable of selected courses in the bucket ( respective section blocks/prefers will also be disabled )
 * [ ] View schedule in text format / printable format
 * [ ] UI Polishment - theming
 * [ ] Display course info by hours per week.
 * [ ] Refactor code to lift components
 * [ ] cache the "previous search index" for searches.
 *  * [ ] Cached data refreshing / transfer using gzip
 * [ ] implement course exclusion (ie need to take CHM135, it's offered in both semesters, but only need to pick one semester.)
 * Priority 3
 * [ ] Async searches
 * [ ] Searches can auto skip to a predefined result.
 * [ ] !Find courses to fill empty slots.
 * 
 * Algorithmic improvement:
 * [ ] Finding smaller exclusion matrices is the same as finding connected components, and for every connected component, we add a column and set all the rows for nodes in that component to 1.
 * 
 * Oct 14 :
 * - Change timetable display to use position:absolute with nested div
 * - Add course selection button and made it its own component
 * - Implemented settings menu interface and functionality
 *      - Implement search from multiple campuses
 * - Implemented a solution limit to the schedule finding algorithm
 *      - This solution limit, should it be toggled from the options?
 * - Display status of search result in the label above the pagination
 * - Add instructions to overall web page
 * - Add display for date when data was updated
 * 
 * Oct 15 : 
 * X Package for online distribution on github
 * X Change algorithm to support grouping of 'equivalent' sections together into a single search result.
 * X Allow selection of equivalent sections.
 * X Fixed bug in crsdb.is_timeslot_conflict causing course sections with nonzero times to be incorrectly handled
 * X Notification when fail to load data
 * X Switch to winter / fall views if results contain only results in those respective terms, otherwise switch to the 'both' view
 * X Transition on mouseover of timetable slots
 * 
 * Algorithm task:
 * - Pre-compute the mutually exclusive courses prior to the calculation, and display the ones that are in a cycle
 * - Allow separately stepping through fall / winter semesters if there are no yearly courses
 * - Display conflict resolution methods
 * 
 * 
 * Other task :
 * - Make new CSS class for disabling selections, and apply it to parts where appropriate.
 * - Mobile display with menu
 * - Download the courses file as gzip
 * - Replace course list with a 'list' component which will allow removal / modification
 * X Search bar async operation / display
 * - Allow selection of equivalent sections to persist
 * X Replace autocomplete with Select component, with loading display and checked items, as well as menu offset
 *      Scrapped the idea and sticking with Select now.
 * - Optimization of the timetable display (consider changing to div layout to avoid intensive rowspan/colspan calculations)
 * - Improve filtering of 'dead' sections, which cannot be enrolled in for any reason. Find additional criterion for evaluating deadness of courses
 * - Display 'unable to retrieve course data' only once when failing
 * - Highlight course slots on TT when mouse over the respective items in list
 * - Search bar redo: able to add as optional or required course directly from dropdown menu item * - different colors for different courses on the TT
 * - on mobile display, add menu button to scroll to bottom / top when appropriate. also auto scroll to bottom on successful results
 * - on mobile display, add menu icon to collapse or expand that control menu
 * - show a list of selected sections
 * 
 * Longer term goals : 
 * - Automated testing of correctness
 *  - involves writing independent python backtracking calculation tool, which will operate on the same data set
 *  - dump all results in txt format (order-independent) and check for dupes
 * - Selection of constraints 
 *  - Only specific sections of a course to consider
 *  - Remove sections in specific blacklisted timeslots
 *  - Ranking of solutions based on preference
 *  - Any other ideas welcome
 */

interface AppProps {

}

interface CrsState {
    crs_obj_list: Course[];
    crs_sections: CourseSelection[];
}

interface SearchInput {
    search_crs_list: Course[];
    search_crs_solo_sections_map: Map<Course, Set<CourseSection>>,// map from course to a set of solo/exclude sections for all courses
    search_crs_exclude_sections_map: Map<Course, Set<CourseSection>>,// at any point, the same course may not be in both solo_sections and exclude_sections
    search_crs_conflict_group_map: Map<Course, string>,
    search_result_selections: number[]; // Array of selected indices for equivalent sections in the current search result.

    search_crs_enabled: boolean[],
    search_crs_sections_filtermode: SectionFilterMode[],
}

interface AppState {
    data_loaded: boolean;
    data_updated_date: string;

    data_load_error: boolean;
    data_load_error_reason: any;

    tt_tab_active: string;

    crs_search_str: string;
    crs_search_dropdown_open: boolean;
    cur_campus_set: Set<Campus>;
    cur_session: string;
    cur_search_status: string;

    search_inputs_tbl: Tagged<Map<string, SearchInput>>;

    search_result: DLXSolution<CourseSelection[]>[];
    search_result_idx: number;
    search_result_limit: number;

    setting_showLockExcludeBtn: boolean;


    preload_crs_skeleton_linecount: number;
}

interface AppCookieSearchTblEntry {
    crs_uids: string[];
    crs_solo_sections_obj: Object; // an object that maps the course's unique ID (string) to a list of its solo section IDs (string)
    crs_exclude_sections_obj: Object; // an object that maps the course's unique ID (string) to a list of its exclusion section IDs (string)
    crs_enabled: boolean[];
    crs_sections_filtermode: SectionFilterMode[];
}

interface AppCookie {
    search_inputs_tbl: Object; // Map<string, AppCookieSearchTblEntry>
    selected_session: string;
}

enum SectionFilterMode {
    Solo, // indicates that solely those sections are to be included when searching.
    Exclude // indicates that those sections are to be excluded when searching.
}

class App extends React.Component<AppProps, AppState> {
    dropdownRef: React.RefObject<AutoComplete>;
    searchInputsTbl: Map<string, SearchInput>;

    loadCookie(): AppCookie {
        if (document.cookie == null) return null;
        let foundCookies = document.cookie.split(";").filter(c => c.startsWith("data="));
        if (foundCookies.length == 0) return null;
        if (foundCookies.length != 1) {
            console.error("More than one data cookie found. Previous saved cookie data is not loaded.");
            return null;
        }

        return JSON.parse(atob(foundCookies[0].substr("data=".length)));
    }

    saveCookie(obj: AppCookie) {
        document.cookie = `data=${btoa(JSON.stringify(obj))};`; // setting the cookie will cause silent failure if the character count exceeds the maximum of 4096 on chrome.
    }

    parseCookieData() {
        try {
            let defaultTbl = new Map<string, AppCookieSearchTblEntry>();
            defaultTbl.set(this.state.cur_session, {
                crs_enabled: [],
                crs_solo_sections_obj: new Object(), crs_exclude_sections_obj: new Object(),
                crs_sections_filtermode: [], crs_uids: []
            });
            let loadedCookie: AppCookie = this.loadCookie() || {
                selected_session: this.state.cur_session,
                search_inputs_tbl: defaultTbl
            }

            crsdb.session_list().forEach((session) => {
                let crsObjs: Course[] = [];
                let soloSectionObjsMap = new Map<Course, Set<CourseSection>>();
                let excludeSectionObjsMap = new Map<Course, Set<CourseSection>>();

                // for each session in the cookie, populate the searchInputsTable. 
                // note- if a session is in the cookie but not in the sessions enumerated by crsdb, then it is lost.
                if (!(session in loadedCookie.search_inputs_tbl))
                    return;
                let cookieSesh: AppCookieSearchTblEntry = loadedCookie.search_inputs_tbl[session];
                cookieSesh.crs_uids.map((crs_uid, idx) => {
                    let crsObj = crsdb.get_crs_by_uid(crs_uid);
                    crsObjs.push(crsObj);

                    let soloSectionObjs = new Set<CourseSection>();
                    let excludeSectionObjs = new Set<CourseSection>();

                    cookieSesh.crs_solo_sections_obj[crs_uid].forEach(sectionId => {
                        let crsSectionObj = crsdb.get_crs_section_by_id(crsObj, sectionId);
                        soloSectionObjs.add(crsSectionObj);
                    });

                    cookieSesh.crs_exclude_sections_obj[crs_uid].forEach(sectionId => {
                        let crsSectionObj = crsdb.get_crs_section_by_id(crsObj, sectionId);
                        excludeSectionObjs.add(crsSectionObj);
                    });

                    soloSectionObjsMap.set(crsObj, soloSectionObjs);
                    excludeSectionObjsMap.set(crsObj, excludeSectionObjs);
                });

                this.searchInputsTbl.set(session, {
                    search_crs_list: crsObjs,
                    search_crs_solo_sections_map: soloSectionObjsMap,// a map of course object to the set of solo/exclude sections
                    search_crs_exclude_sections_map: excludeSectionObjsMap,
                    // at any point, a course may not have the same course in both solo_sections and exclude_sections
                    // search_crs_conflict_group_map: conflictGroupMap,
                    search_crs_enabled: cookieSesh.crs_enabled,
                    search_crs_sections_filtermode: cookieSesh.crs_sections_filtermode,
                    search_crs_conflict_group_map: new Map<Course, string>(), // maps from course to color. if a course is not in the map then it doesn't have a conflict group
                    search_result_selections: []
                });
            });

            this.setState({
                cur_session: loadedCookie.selected_session,
                search_inputs_tbl: new Tagged(this.searchInputsTbl)
            });
        } catch (error) {
            message.warning("Cookies failed to load. ", 3);
        }
    }

    saveData() {
        // convert javascript Maps into plain JS objects, so that they work with JSON.stringify.
        let newCookie: AppCookie = {
            search_inputs_tbl: new Object(),
            selected_session: this.state.cur_session
        };
        for (const session of this.searchInputsTbl.keys()) {
            let stbl: SearchInput = this.searchInputsTbl.get(session);
            let soloSectionsObj = new Object(); // a JS object with keys consisting of the course's unique ID, and values which are arrays of soloed section IDs for that course.
            let excludeSectionsObj = new Object();
            stbl.search_crs_solo_sections_map.forEach((val, key) => {
                soloSectionsObj[key.unique_id] = Array.from(val.values()).map(sec => sec.section_id);
            });
            stbl.search_crs_exclude_sections_map.forEach((val, key) => {
                excludeSectionsObj[key.unique_id] = Array.from(val.values()).map(sec => sec.section_id);
            });

            newCookie.search_inputs_tbl[session] = {
                crs_uids: stbl.search_crs_list.map(crs => crs.unique_id),
                crs_solo_sections_obj: soloSectionsObj,
                crs_exclude_sections_obj: excludeSectionsObj,
                crs_enabled: stbl.search_crs_enabled,
                crs_sections_filtermode: stbl.search_crs_sections_filtermode
            };
        }

        console.log(newCookie);
        this.saveCookie(newCookie);
    }

    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        this.dropdownRef = React.createRef<AutoComplete>();

        this.handleSelectionIndicesChanged = this.handleSelectionIndicesChanged.bind(this);

        this.crs_updateSearchCrsFilterSections = this.crs_updateSearchCrsFilterSections.bind(this);

        this.switchToSession = this.switchToSession.bind(this);

        this.loadCookie = this.loadCookie.bind(this);

        this.saveCookie = this.saveCookie.bind(this);

        this.loadAvailableSessionData = this.loadAvailableSessionData.bind(this);

        let default_session = "20205";

        this.searchInputsTbl = new Map<string, SearchInput>();

        crsdb.session_list().forEach(session => this.searchInputsTbl.set(session,
            {
                search_crs_list: [],
                search_crs_solo_sections_map: new Map<Course, Set<CourseSection>>(),
                search_crs_exclude_sections_map: new Map<Course, Set<CourseSection>>(),
                search_crs_conflict_group_map: new Map<Course, string>(),
                // at any point, a course may not have the same course in both solo_sections and exclude_sections
                search_crs_enabled: [],
                search_crs_sections_filtermode: [],
                search_result_selections: []
            }));

        // Set the state directly. Use props if necessary.
        this.state = {
            data_loaded: false,
            data_updated_date: "(unable to get data loaded date)",

            data_load_error: false,
            data_load_error_reason: null,

            tt_tab_active: 'F',

            crs_search_str: "",
            crs_search_dropdown_open: false,

            cur_campus_set: new Set<Campus>([Campus.UTM, Campus.STG_ARTSCI]),
            cur_session: default_session,

            cur_search_status: null,

            search_inputs_tbl: new Tagged(this.searchInputsTbl), // temporarily set it as null.

            search_result: [],
            search_result_idx: 0,

            search_result_limit: 1000000,

            setting_showLockExcludeBtn: true,

            preload_crs_skeleton_linecount: 0
        }

        this.initComponents();
    }

    componentDidMount() {
        this.initCookie();
        this.loadAvailableSessionData().then(() => {
            this.parseCookieData();
        });
        // this.switchToSession(this.state.cur_session);
    }

    initCookie() {
        let cookies: AppCookie = this.loadCookie();
        let crsSkeletonLineCount = 0;
        if (cookies != null && this.state.cur_session in cookies.search_inputs_tbl)
            crsSkeletonLineCount = cookies.search_inputs_tbl[cookies.selected_session].crs_uids.length

        this.setState({
            preload_crs_skeleton_linecount: crsSkeletonLineCount
        });
    }

    /*
    Load all session data
    */
    async loadAvailableSessionData() {
        this.setState({
            data_loaded: false,
            data_updated_date: "Loading data...",
        });

        // download the crs data file first before loading cookies.
        let errorEncountered = false;
        let promise_list = [];

        // load data for all available sessions, all available campuses, by create promises for them
        crsdb.session_list().forEach(session => {
            promise_list.push(...Object.keys(Campus).map(key => Campus[key]).map(campus => {
                return crsdb.fetch_crs_data(campus, session);
            }))
        });

        // use Promise.all to attach an aftereffect to when all promises completed.
        return Promise.all(promise_list).then(() => {
            console.log(crsdb.data_updated_date);
            this.setState({
                data_loaded: true,
                data_updated_date: crsdb.data_updated_date == null ? "(unable to get updated date)" : crsdb.data_updated_date.toDateString().substring(4),
            });
        }).catch(err => {
            // as multiple promises are being awaited in parallel, this error handler may get triggered multiple
            // times from each of the invidiual promises.
            console.log(err)
            if (!errorEncountered) {
                errorEncountered = true;
                message.error("Unable to retrieve course data. Please refresh the page.", 0);
                this.setState({
                    data_load_error: true,
                    data_load_error_reason: err
                });
            }
        });
    }

    /**
     * When switching to session on init:
     * - Check cookie
     * - Load Data
     * - Load session in cookie to memory
     * - Set session
     * 
     * When switching to session live:
     * - Load Data
     * - Set session
     * 
     * search_crs_list: [],
            search_crs_solo_sections_map: new Map<Course, Set<CourseSection>>(),
            search_crs_exclude_sections_map: new Map<Course, Set<CourseSection>>(),
            search_crs_conflict_group_map: new Map<Course, string>(),
            // at any point, a course may not have the same course in both solo_sections and exclude_sections
            
            search_result_selections: [],
     * */
    switchToSession(session) {
        console.log("switch to " + session);
        // console.log(this.searchInputsTbl.get(this.state.cur_session));
        this.setState({ 
            cur_session: session,
            search_result: [],
            search_inputs_tbl: new Tagged(this.searchInputsTbl),
            cur_search_status: null,
         });
        
    }

    conflict_color_list = ["#990000", "#009900", "#000099", "#999900", "#009999", "#990099"];
    crs_addSearchCrs(crsObj: Course) {
        let stbl = this.searchInputsTbl.get(this.state.cur_session);

        // if course is already in current list, then skip operation
        if (stbl.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id) != -1)
            return;
        /*
     
            crs: crsObj,
            solo_sections: new Set<CourseSection>(),
            exclude_sections: new Set<CourseSection>(),
            enabled: true,
            sections_filtermode: SectionFilterMode.Exclude
        */
        let new_crs_list = stbl.search_crs_list.concat(crsObj);

        let new_solo_map = new Map<Course, Set<CourseSection>>(stbl.search_crs_solo_sections_map);
        let new_exclusion_map = new Map<Course, Set<CourseSection>>(stbl.search_crs_exclude_sections_map);
        new_solo_map.set(crsObj, new Set<CourseSection>());
        new_exclusion_map.set(crsObj, new Set<CourseSection>());

        let new_conflict_group_map = new Map<Course, string>();
        crs_arrange.get_conflict_map(new_crs_list, new_solo_map, new_exclusion_map).forEach((val, key) => {
            new_conflict_group_map.set(key, this.conflict_color_list[val % this.conflict_color_list.length]);
        });

        this.searchInputsTbl.set(this.state.cur_session,
            {
                search_crs_list: new_crs_list,
                search_crs_enabled: stbl.search_crs_enabled.concat(true),
                search_crs_solo_sections_map: new_solo_map,
                search_crs_exclude_sections_map: new_exclusion_map,
                search_crs_conflict_group_map: new_conflict_group_map,
                search_crs_sections_filtermode: stbl.search_crs_sections_filtermode.concat(SectionFilterMode.Exclude),
                search_result_selections: stbl.search_result_selections
            }
        );

        this.setState({
            search_result: [],
            search_inputs_tbl: new Tagged(this.searchInputsTbl),
            cur_search_status: null,
        },
            this.saveData);
    }

    crs_removeSearchCrs(crsObj: Course) {
        let stbl = this.searchInputsTbl.get(this.state.cur_session);

        let removeIdx = stbl.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id);
        console.assert(removeIdx != -1);

        let new_crs_list = stbl.search_crs_list.filter((crs, idx) => idx != removeIdx);

        let new_solo_map = new Map<Course, Set<CourseSection>>(stbl.search_crs_solo_sections_map);
        let new_exclusion_map = new Map<Course, Set<CourseSection>>(stbl.search_crs_exclude_sections_map);
        new_solo_map.delete(crsObj);
        new_exclusion_map.delete(crsObj);

        let new_conflict_group_map = new Map<Course, string>();
        crs_arrange.get_conflict_map(new_crs_list, new_solo_map, new_exclusion_map).forEach((val, key) => {
            new_conflict_group_map.set(key, this.conflict_color_list[val % this.conflict_color_list.length]);
        });

        this.searchInputsTbl.set(this.state.cur_session,
            {
                search_crs_list: new_crs_list,
                search_crs_enabled: stbl.search_crs_enabled.filter((crs, idx) => idx != removeIdx),
                search_crs_solo_sections_map: new_solo_map,
                search_crs_exclude_sections_map: new_exclusion_map,

                search_crs_conflict_group_map: new_conflict_group_map,
                search_crs_sections_filtermode: stbl.search_crs_sections_filtermode.filter((crs, idx) => idx != removeIdx),

                search_result_selections: stbl.search_result_selections
            }
        );

        this.setState({
            search_result: [],
            cur_search_status: null,
            search_inputs_tbl: new Tagged(this.searchInputsTbl)

        },
            this.saveData);
    }

    crs_updateSearchCrsFilterSections(targetCrsObj: Course, new_solo_sections: Map<Course, Set<CourseSection>>, new_exclude_sections: Map<Course, Set<CourseSection>>) {
        const stbl: SearchInput = this.searchInputsTbl.get(this.state.cur_session);

        let crsIdx = stbl.search_crs_list.findIndex(crs => crs.unique_id == targetCrsObj.unique_id);
        console.assert(crsIdx != -1);
        /*let new_solo_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_solo_sections_map);
        let new_exclusion_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_exclude_sections_map);
        new_solo_map.set(crsObj, new_solo_sections);
        new_exclusion_map.set(crsObj, new_exclude_sections);*/
        // The entire map goes into the component's props, and we trust the component to properly modify the whole map, and pass it back to this callback.
        // console.log(new_solo_sections);
        // console.log(new_exclude_sections);

        // if a whitelist is specified, then activate the whitelist mode. otherwise, continue to use blacklist mode.
        let new_filtermodes_list = [...stbl.search_crs_sections_filtermode];
        new_filtermodes_list[crsIdx] = new_solo_sections.get(targetCrsObj).size != 0 ? SectionFilterMode.Solo : SectionFilterMode.Exclude;

        stbl.search_crs_sections_filtermode = new_filtermodes_list;
        stbl.search_crs_solo_sections_map = new_solo_sections;
        stbl.search_crs_exclude_sections_map = new_exclude_sections;
        // search_crs_solo_sections_all: new_search_crs_solo_sections.reduce((prev, cur) => { cur.forEach(sec => { prev.add(sec); }); return prev; }), // union of all sets in the list
        // search_crs_exclude_sections_all: new_search_crs_exclude_sections.reduce((prev, cur) => { cur.forEach(sec => { prev.add(sec); }); return prev; }), // union of all sets in the list

        this.setState(
            {
                search_inputs_tbl: new Tagged(this.searchInputsTbl)
            },
            () => {
                this.saveData(); // save data to cookies after updating the state.
                this.crs_doSearch(); // perform search again
            }
        );

    }

    crs_toggleCrsIndex(idx: number) {
        const stbl: SearchInput = this.searchInputsTbl.get(this.state.cur_session);

        let new_search_crs_enabled = [...stbl.search_crs_enabled];
        new_search_crs_enabled[idx] = !(new_search_crs_enabled[idx]);
        stbl.search_crs_enabled = new_search_crs_enabled;

        this.setState({ search_inputs_tbl: new Tagged(this.searchInputsTbl) },
            () => {
                this.crs_doSearch();
                this.saveData();
            }
        );
    }

    crs_doSearch() {
        const stbl: SearchInput = this.searchInputsTbl.get(this.state.cur_session);

        if (stbl.search_crs_list.length == 0) {
            this.setState({
                search_result: [],
                search_result_idx: 0,
                cur_search_status: "no courses selected"
            });
            return;
        }

        // Apply filters to the course sections passed into search algorithm
        let all_sections: CourseSelection[] = [];
        stbl.search_crs_list.forEach((crs, idx) => {
            // assert searchCrs.exclude_sections intersect searchCrs.soloSections is empty.
            // A section may not be excluded and soloed at the same time.
            if (stbl.search_crs_enabled[idx]) {
                let crs_sections = crsdb.list_all_crs_selections(crs);
                // TODO: this is a temporary fix to allow for whitelist/blacklist of mixed sections.
                // -> we will ignore the filter mode.
                let sectypes = ["LEC", "TUT", "PRA"];
                sectypes.forEach(sectype => {
                    // partition each set into the three section types.

                    let sections_t_whitelist = new Set<CourseSection>(Array.from(stbl.search_crs_solo_sections_map.get(crs).values()).filter(sec => sec.section_id.substr(0, 3) == sectype));
                    let sections_t_blacklist = new Set<CourseSection>(Array.from(stbl.search_crs_exclude_sections_map.get(crs).values()).filter(sec => sec.section_id.substr(0, 3) == sectype));

                    let sections_t = crs_sections.filter(sel => {
                        if (sel.sec.section_id.substr(0, 3) != sectype) return false;

                        if (sections_t_whitelist.size == 0) { // no whitelisted sections of the type: then, check the blacklist
                            return !sections_t_blacklist.has(sel.sec);
                        } else { // there are whitelisted sections of the type: then, check the whitelist 
                            return sections_t_whitelist.has(sel.sec);
                        }
                    });

                    all_sections.push(...sections_t);
                });
            }
        });

        let search_result: SchedSearchResult = crs_arrange.find_sched(all_sections, this.state.search_result_limit);
        let search_status: string;
        if (search_result.solutionSet.length == 0) {
            search_status = "no feasible schedules found";
        }
        else if (search_result.solutionLimitReached) {
            console.assert(search_result.solutionSet.length == this.state.search_result_limit);
            search_status = `limit of ${this.state.search_result_limit} schedules reached`;
        } else {
            search_status = `${search_result.solutionSet.length} schedules found`;
            if (all_sections.every(crs_sel => crs_sel.crs.term == 'F'))
                this.setState({ tt_tab_active: 'F' });
            else if (all_sections.every(crs_sel => crs_sel.crs.term == 'S'))
                this.setState({ tt_tab_active: 'S' });
            else
                this.setState({ tt_tab_active: 'Y' });
        }

        stbl.search_result_selections = new Array<number>(all_sections.length).fill(0);

        this.setState({
            search_result: search_result.solutionSet,
            search_result_idx: 0,
            cur_search_status: search_status,
            // TODO: create separate method for grouping courses, make it part of crsdb
            // TODO: use a map of crsgrp -> sel_idx as the search_result_selections, to help implement persistence
            search_inputs_tbl: new Tagged(this.searchInputsTbl)
        });
    }

    crs_listAllCourses(campus_set: Set<Campus>, session: string, search_str: string): Course[] {
        let all_results = [];
        campus_set.forEach(campus => {
            all_results.push(...crsdb.list_crs_by_code(campus, session, search_str));
        });

        return all_results;
    }

    handleSelectionIndicesChanged(new_indices: number[]) {
        const stbl: SearchInput = this.searchInputsTbl.get(this.state.cur_session);
        stbl.search_result_selections = new_indices;
        this.setState({ search_inputs_tbl: new Tagged(this.searchInputsTbl) });

    }

    sessionSelectorMenu;
    public initComponents() {
        this.sessionSelectorMenu = (
            <Menu>
                {
                    crsdb.session_list().map((session, idx) => (
                        <Menu.Item key={idx} onClick={() => this.switchToSession(session)}>
                            {crsdb.session_format(session)}
                        </Menu.Item>
                    ))
                }
            </Menu>

        );
    }
    public render() {

        const stbl = this.searchInputsTbl.get(this.state.cur_session);

        if (this.state.data_loaded) {
        }

        let dataSource = [];

        if (this.state.data_loaded && this.state.crs_search_str.length > 2) {
            let crs_results = this.crs_listAllCourses(this.state.cur_campus_set, this.state.cur_session, this.state.crs_search_str);
            dataSource = crs_results.map(crs => {
                let crs_code = crs.course_code;
                let crs_title = crs.course_name;
                return (
                    <AutoComplete.Option key={crs_code} value={crs_code} style={{
                        overflow: "hidden",
                        textOverflow: "clip",
                        whiteSpace: "nowrap",
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 0 0 0"
                    }}>
                        <div
                            style={{ padding: "5px 12px 5px 12px", width: "100%" }}
                            onClick={(evt: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
                                evt.preventDefault(); evt.stopPropagation();
                                // this.dropdownRef.current.blur();

                                // this.crs_addAllSections(crs);
                                this.crs_addSearchCrs(crs);
                            }}
                        >
                            {this.state.cur_campus_set.size > 1 ? `[${Campus_Formatted[crs.campus]}] ` : null /*  */}
                            {crs_code}: {crs_title} {/*[{Object.keys(crs.course_sections).join(',')}]*/}</div>
                    </AutoComplete.Option>

                );
            });
        }

        let crs_search_items;

        if (this.state.data_loaded) {
            crs_search_items = stbl.search_crs_list.map((crs, idx) => {
                let lockedSections = Array.from(stbl.search_crs_solo_sections_map.get(crs).values()).map((sec: CourseSection) => {
                    return (<div key={sec.section_id} className="filtered-section-soloed" style={{ width: "100%", cursor: "pointer" }}
                        onClick={() => {
                            let newSoloMap = new Map<Course, Set<CourseSection>>(stbl.search_crs_solo_sections_map);
                            let newSoloSet = new Set<CourseSection>(newSoloMap.get(crs));
                            newSoloSet.delete(sec);
                            newSoloMap.set(crs, newSoloSet);
                            this.crs_updateSearchCrsFilterSections(crs, newSoloMap, stbl.search_crs_exclude_sections_map);
                        }}
                    ><Icon type="lock" /> {sec.section_id}
                        {/*<span style={{ backgroundColor: "#aaeeee", float: "right", marginRight:"25%" }}>Conflict</span> */}
                    </div>)
                });

                let blockedSections = Array.from(stbl.search_crs_exclude_sections_map.get(crs).values()).map((sec: CourseSection) => {
                    return (<div key={sec.section_id} className="filtered-section-excluded" style={{ width: "100%", cursor: "pointer" }}
                        onClick={() => {
                            let newExcludeMap = new Map<Course, Set<CourseSection>>(stbl.search_crs_exclude_sections_map);
                            let newExcludeSet = new Set<CourseSection>(newExcludeMap.get(crs));
                            newExcludeSet.delete(sec);
                            newExcludeMap.set(crs, newExcludeSet);
                            this.crs_updateSearchCrsFilterSections(crs, stbl.search_crs_solo_sections_map, newExcludeMap);
                        }}
                    ><Icon type="minus-circle" theme="filled" /> {sec.section_id}
                        {/* <span style={{ backgroundColor: "#aaeeee", float: "right", marginRight:"25%" }}>Conflict</span> */}
                    </div>
                    )
                });
                let conflictMarker = stbl.search_crs_conflict_group_map.has(crs)
                    ? (<span style={{ backgroundColor: stbl.search_crs_conflict_group_map.get(crs) }}>Conflict</span>)
                    : (<span style={{}}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>);

                return (
                    <div key={crs.course_code} className="crs-bucket-item">
                        <div style={{ width: "100%" }}>
                            <span key="a" className="unselectable" style={{ width: "85%" }}>
                                <Checkbox
                                    checked={stbl.search_crs_enabled[idx]}
                                    onChange={() => {
                                        this.crs_toggleCrsIndex(idx);
                                    }}
                                    style={{ width: "60%" }}
                                >
                                    {`[${Campus_Formatted[crs.campus]}] `}{crs.course_code}
                                </Checkbox>

                                {conflictMarker}

                                <Icon type="close"
                                    onClick={() => {
                                        this.crs_removeSearchCrs(crs);
                                    }} />
                            </span>
                        </div>
                        <div key="c" className="unselectable" style={{ paddingLeft: "20px", }} >
                            {lockedSections}
                        </div>
                        <div key="d" className="unselectable" style={{ paddingLeft: "20px", }} >
                            {blockedSections}
                        </div>
                    </div>
                );
            });
        } else {
            crs_search_items = [];
            for (let index = 0; index < this.state.preload_crs_skeleton_linecount; index++) {
                crs_search_items.push(
                    <div key={index} className="crs-bucket-item-preload">
                        <span style={{ float: "left", width: "90%" }}>
                            <Skeleton active title={false} paragraph={{ rows: 1, style: { marginBottom: "0px" } }} />
                        </span>
                        <span style={{ float: "right" }}>&nbsp;<Icon type="close" /></span>
                        <br />
                    </div>
                );
            }
        }

        if (crs_search_items.length == 0) {
            crs_search_items = [(
                <p key="1"></p>
            )];
        }

        const showSearchResults = this.state.search_result.length > 0;
        let sectionsList = showSearchResults ? this.state.search_result[this.state.search_result_idx].data : [];

        let crs_dropdown_open = this.state.crs_search_dropdown_open && dataSource.length > 0;

        return (
            <div className="app">
                <div className="ctrls">
                    <Collapse
                        bordered={false}
                        activeKey={['1', '3', '4']}
                        style={{ backgroundColor: "darkgray" }}
                    >
                        <Collapse.Panel header="Courses list" key="1" disabled showArrow={true} extra={
                            <SettingsButton
                                currentSettings={{
                                    selectedCampus: this.state.cur_campus_set,
                                    showLockExcludeBtn: this.state.setting_showLockExcludeBtn
                                }}
                                onSettingsModified={(newSettings) => {
                                    this.setState({
                                        cur_campus_set: newSettings.selectedCampus,
                                        setting_showLockExcludeBtn: newSettings.showLockExcludeBtn
                                    });
                                }}
                                onSettingsCancelled={() => {
                                }}
                            />
                        }>
                            {/*<Card size="small" style={{ width: "auto" }}>
                                <p>Select courses:</p>
                                {crs_disp_items}
                        </Card>*/

                            }

                            <Card size="small" style={{ width: "auto" }}>
                                <p>Select courses from the dropdown below, and then press the 'Search' button to generate schedules.</p>
                                <p>Your list of courses will appear below.</p>
                                {crs_search_items}
                            </Card>
                            <div className="sel-crs">
                                <label>Add a course:</label>
                                <AutoComplete
                                    ref={this.dropdownRef} open={crs_dropdown_open} size="large" style={{ width: "100%" }} dropdownStyle={{ width: "auto" }}
                                    disabled={this.state.data_load_error}
                                    dataSource={dataSource}
                                    placeholder="Enter first 3 letters of course code"
                                    onChange={(v) => {
                                        this.setState({
                                            crs_search_str: v.toString(),
                                            crs_search_dropdown_open: v.toString().length >= 3
                                        });
                                    }}
                                    onBlur={() => {
                                        this.setState({
                                            crs_search_dropdown_open: false,
                                        });
                                    }}
                                    onSelect={(a, b) => false}
                                    optionLabelProp="value"
                                >
                                    <Input
                                        onFocus={() => {
                                            this.setState({ crs_search_dropdown_open: this.state.crs_search_str.length >= 3 });
                                        }}
                                        suffix={
                                            <div>
                                                {!this.state.data_loaded && this.state.crs_search_str.length > 2 ? <Icon type="loading" style={{ paddingRight: 12 }} /> : null}
                                                <Button
                                                    style={{ marginRight: -12, opacity: 1 }}
                                                    size="large"
                                                    type={crs_dropdown_open ? "primary" : "default"}
                                                    onClick={() => {
                                                        this.setState({ crs_search_dropdown_open: this.state.crs_search_str.length >= 3 && !crs_dropdown_open });
                                                    }}
                                                >
                                                    <Icon type={crs_dropdown_open ? "up" : "down"} />
                                                </Button>
                                            </div>
                                        }

                                    />
                                </AutoComplete>
                            </div>

                        </Collapse.Panel>
                        {/*<Collapse.Panel header="Constraints" key="2" showArrow={true}>
                            <p>This is currently a work in progress.</p>
                                        </Collapse.Panel>*/}
                        <Collapse.Panel header="Search" key="3" showArrow={true} >
                            {/*extra={<Badge
    count={4}
    style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
/>}*/}
                            <div>
                                <div>
                                    Press the button below to search for schedules
                                </div>
                                <Button icon="search" onClick={this.crs_doSearch.bind(this)}
                                    style={{}}
                                >
                                    Search
                            </Button>
                                <div style={{ marginTop: "10px", marginBottom: "10px" }}>
                                    {this.state.cur_search_status == null ? "View Results:" : `View results (${this.state.cur_search_status}):`}
                                </div>
                                <div>
                                    <Pagination
                                        current={this.state.search_result.length == 0 ? 0 : this.state.search_result_idx + 1}
                                        disabled={this.state.search_result.length == 0}
                                        simple

                                        defaultCurrent={0}
                                        total={this.state.search_result.length}
                                        pageSize={1}
                                        style={{ marginBottom: "10px" }}
                                        onChange={(idx) => {
                                            idx -= 1;
                                            if (idx >= this.state.search_result.length || idx < 0) return;
                                            else {
                                                const stbl: SearchInput = this.searchInputsTbl.get(this.state.cur_session);
                                                stbl.search_result_selections = new Array<number>(this.state.search_result[idx].data.length).fill(0)
                                                this.setState({
                                                    search_result_idx: idx,
                                                    search_inputs_tbl: new Tagged(this.searchInputsTbl)
                                                });
                                            }
                                        }}
                                    />

                                </div>
                                <span style={{ float: "right" }}></span>
                            </div>
                        </Collapse.Panel>
                        <Collapse.Panel header="About" key="4" showArrow={true}>
                            <p>Source Code: <a target="_blank" href="https://github.com/ProjectEGU/TimerTable">View on GitHub</a></p>
                            <p>{this.state.data_loaded ? `Data last updated: ${this.state.data_updated_date}` : "Loading data in progress..."}</p>
                            <p>This project is currently a work in progress.</p>
                        </Collapse.Panel>
                    </Collapse>
                </div>
                <div className="tt-tabs">
                    <Tabs
                        className="dtk"
                        defaultActiveKey="F" tabPosition="top"
                        onChange={activeKey => this.setState({ tt_tab_active: activeKey })}
                        activeKey={this.state.tt_tab_active}
                        tabBarExtraContent={
                            <Dropdown overlay={this.sessionSelectorMenu} trigger={['click']}>
                                <p>{crsdb.session_format(this.state.cur_session)} <Icon type="down" /> </p>
                            </Dropdown>
                        }
                    >
                        <Tabs.TabPane tab="Fall" key="F">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={stbl.search_result_selections} show_term={"F"}
                                crs_solo_sections_map={stbl.search_crs_solo_sections_map} crs_exclude_sections_map={stbl.search_crs_exclude_sections_map}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                                onCrsFilterSectionsChanged={this.crs_updateSearchCrsFilterSections}

                                showLockExcludeBtns={this.state.setting_showLockExcludeBtn}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Winter" key="S">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={stbl.search_result_selections} show_term={"S"}
                                crs_solo_sections_map={stbl.search_crs_solo_sections_map} crs_exclude_sections_map={stbl.search_crs_exclude_sections_map}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                                onCrsFilterSectionsChanged={this.crs_updateSearchCrsFilterSections}

                                showLockExcludeBtns={this.state.setting_showLockExcludeBtn}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Both" key="Y">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={stbl.search_result_selections} show_term={"Y"} show_double={true}
                                crs_solo_sections_map={stbl.search_crs_solo_sections_map} crs_exclude_sections_map={stbl.search_crs_exclude_sections_map}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                                onCrsFilterSectionsChanged={this.crs_updateSearchCrsFilterSections}

                                showLockExcludeBtns={this.state.setting_showLockExcludeBtn}
                            />
                        </Tabs.TabPane>
                    </Tabs>

                </div>

            </div >
        );
    }

}

declare let module: object;

export default hot(module)(App);

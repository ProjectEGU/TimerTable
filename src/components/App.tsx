import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { DLXMatrix } from "./dlxmatrix"
import { crsdb, Campus, Campus_Formatted } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"
import { SchedDisp } from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Icon, Input, Badge, Collapse, Pagination, Popover, Checkbox, message, Skeleton } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";
import { AssertionError } from "assert";
import { crs_arrange, SchedSearchResult } from "./schedule";
import { SettingsButton } from "./settings_button";

interface AppProps {

}

interface CrsState {
    crs_obj_list: Course[];
    crs_sections: CourseSelection[];
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

    search_crs_list: Course[];
    search_crs_solo_sections_map: Map<Course, Set<CourseSection>>,// map from course to a set of solo/exclude sections for all courses
    search_crs_exclude_sections_map: Map<Course, Set<CourseSection>>,// at any point, a course may not have the same course in both solo_sections and exclude_sections
    search_crs_conflict_group_map: Map<Course, string>,

    search_crs_enabled: boolean[],
    search_crs_sections_filtermode: SectionFilterMode[],

    search_result: CourseSelection[][][];
    search_result_idx: number;
    search_result_limit: number;

    setting_showLockExcludeBtn: boolean;

    /**
     * Array of selected indices for equivalent sections in the current search result.
     */
    search_result_selections: number[];

    preload_crs_skeleton_linecount: number;
}


/**
 * Jan 22 todo:
 * Priority 1
 * [ ] Show / highlight totally conflicting courses and show options for removing them
 *          [X] Algorithm to calculate which pair of courses cannot be scheduled together
 *              [ ] Optimize
 *          [ ] Show courses that have absolutely no sections, and exclude them from search results.
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
interface AppCookie {
    crs_uids: string[];
    crs_solo_sections_obj: Object; // an object that maps the course's unique ID (string) to a list of its solo section IDs (string)
    crs_exclude_sections_obj: Object; // an object that maps the course's unique ID (string) to a list of its exclusion section IDs (string)
    crs_enabled: boolean[];
    crs_sections_filtermode: SectionFilterMode[];
}
enum SectionFilterMode {
    Solo, // indicates that solely those sections are to be included when searching.
    Exclude // indicates that those sections are to be excluded when searching.
}

class App extends React.Component<AppProps, AppState> {
    dropdownRef: React.RefObject<AutoComplete>;

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

    loadData() {
        try {
            let loadedCookie: AppCookie = this.loadCookie() || {
                crs_enabled: [],
                crs_solo_sections_obj: new Object(), crs_exclude_sections_obj: new Object(),
                crs_sections_filtermode: [], crs_uids: []
            };
            /*
 search_crs_list: loadedCookie.crs_uids.map((crs_uid, idx) => {
                    let crsObj = crsdb.get_crs_by_uid(crs_uid);
                    let soloSectionObjs = new Set<CourseSection>();
                    loadedCookie.crs_solo_sections[idx].forEach(sectionId => {
                        soloSectionObjs.add(crsdb.get_crs_section_by_id(crsObj, sectionId));
                    });
                    let excludeSectionObjs = new Set<CourseSection>();
                    dataObj.crs_exclude_sections.forEach(sectionId => {
                        excludeSectionObjs.add(crsdb.get_crs_section_by_id(crsObj, sectionId));
                    });
                    return {
                        crs: crsObj,
                        solo_sections: soloSectionObjs,
                        exclude_sections: excludeSectionObjs,
                        enabled: dataObj.enabled,
                        sections_filtermode: dataObj.sections_filtermode
                    };
                }),
            */
            let crsObjs: Course[] = [];

            let soloSectionObjsMap = new Map<Course, Set<CourseSection>>();
            let excludeSectionObjsMap = new Map<Course, Set<CourseSection>>();

            loadedCookie.crs_uids.map((crs_uid, idx) => {
                let crsObj = crsdb.get_crs_by_uid(crs_uid);
                crsObjs.push(crsObj);

                let soloSectionObjs = new Set<CourseSection>();
                let excludeSectionObjs = new Set<CourseSection>();

                loadedCookie.crs_solo_sections_obj[crs_uid].forEach(sectionId => {
                    let crsSectionObj = crsdb.get_crs_section_by_id(crsObj, sectionId);
                    soloSectionObjs.add(crsSectionObj);
                });

                loadedCookie.crs_exclude_sections_obj[crs_uid].forEach(sectionId => {
                    let crsSectionObj = crsdb.get_crs_section_by_id(crsObj, sectionId);
                    excludeSectionObjs.add(crsSectionObj);
                });

                soloSectionObjsMap.set(crsObj, soloSectionObjs);
                excludeSectionObjsMap.set(crsObj, excludeSectionObjs);
            });

            let conflictGroupMap = new Map<Course, string>(); // maps from course to color. if a course is not in the map then it doesn't have a conflict gorup

            this.setState({
                search_crs_list: crsObjs,
                search_crs_solo_sections_map: soloSectionObjsMap,// a map of course object to the set of solo/exclude sections
                search_crs_exclude_sections_map: excludeSectionObjsMap,
                // at any point, a course may not have the same course in both solo_sections and exclude_sections
                search_crs_conflict_group_map: conflictGroupMap,
                search_crs_enabled: loadedCookie.crs_enabled,
                search_crs_sections_filtermode: loadedCookie.crs_sections_filtermode
            });
        } catch (error) {
            message.warning("Cookies failed to load. ", 3);
        }
    }

    saveData() {
        // convert javascript Maps into plain JS objects, so that they work with JSON.stringify.

        let soloSectionsObj = new Object(); // a JS object with keys consisting of the course's unique ID, and values which are arrays of soloed section IDs for that course.
        let excludeSectionsObj = new Object();
        this.state.search_crs_solo_sections_map.forEach((val, key) => {
            soloSectionsObj[key.unique_id] = Array.from(val.values()).map(sec => sec.section_id);
        });
        this.state.search_crs_exclude_sections_map.forEach((val, key) => {
            excludeSectionsObj[key.unique_id] = Array.from(val.values()).map(sec => sec.section_id);
        });

        this.saveCookie({
            crs_uids: this.state.search_crs_list.map(crs => crs.unique_id),
            crs_solo_sections_obj: soloSectionsObj,
            crs_exclude_sections_obj: excludeSectionsObj,
            crs_enabled: this.state.search_crs_enabled,
            crs_sections_filtermode: this.state.search_crs_sections_filtermode
        });
    }

    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        this.dropdownRef = React.createRef<AutoComplete>();

        this.handleSelectionIndicesChanged = this.handleSelectionIndicesChanged.bind(this);

        this.crs_updateSearchCrsFilterSections = this.crs_updateSearchCrsFilterSections.bind(this);

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
            cur_session: "20199",

            cur_search_status: null,

            search_crs_list: [],
            search_crs_solo_sections_map: new Map<Course, Set<CourseSection>>(),
            search_crs_exclude_sections_map: new Map<Course, Set<CourseSection>>(),
            search_crs_conflict_group_map: new Map<Course, string>(),
            // at any point, a course may not have the same course in both solo_sections and exclude_sections
            search_crs_enabled: [],
            search_crs_sections_filtermode: [],

            search_result: [],
            search_result_idx: 0,

            search_result_limit: 1000000,

            search_result_selections: [],

            setting_showLockExcludeBtn: true,

            preload_crs_skeleton_linecount: 0
        }
    }

    componentDidMount() {
        // Get values of enum: Object.keys(ENUM).map(key=>ENUM[key])
        // https://stackoverflow.com/a/39372911/4051435
        // Promise.all will return a new promise that resolves when the input list of promises have resolved.
        // It will resolve with an array of results for each promise in the input list.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all

        let cookies: AppCookie = this.loadCookie();
        let crsSkeletonLineCount = 0;
        if (cookies != null)
            crsSkeletonLineCount = cookies.crs_uids.length

        this.setState({
            preload_crs_skeleton_linecount: crsSkeletonLineCount
        });

        let errorEncountered = false;
        Promise.all(Object.keys(Campus).map(key => Campus[key]).map(campus => {
            return crsdb.fetch_crs_data(campus, this.state.cur_session);
        })).then(() => {
            console.log(crsdb.data_updated_date);
            this.loadData();
            this.setState({
                data_loaded: true,
                data_updated_date: crsdb.data_updated_date == null ? "(unable to get updated date)" : crsdb.data_updated_date.toDateString().substring(4)
            });
        }).catch(err => {
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

    conflict_color_list = ["#990000", "#009900", "#000099", "999900", "009999", "990099"];
    crs_addSearchCrs(crsObj: Course) {
        // if course is already in current list, then skip operation
        if (this.state.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id) != -1)
            return;
        /*
    
            crs: crsObj,
            solo_sections: new Set<CourseSection>(),
            exclude_sections: new Set<CourseSection>(),
            enabled: true,
            sections_filtermode: SectionFilterMode.Exclude
        */
        let new_crs_list = this.state.search_crs_list.concat(crsObj);

        let new_solo_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_solo_sections_map);
        let new_exclusion_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_exclude_sections_map);
        new_solo_map.set(crsObj, new Set<CourseSection>());
        new_exclusion_map.set(crsObj, new Set<CourseSection>());

        let new_conflict_group_map = new Map<Course, string>();
        crs_arrange.get_conflict_map(new_crs_list, new_solo_map, new_exclusion_map).forEach((val, key) => {
            new_conflict_group_map.set(key, this.conflict_color_list[val % this.conflict_color_list.length]);
        });

        this.setState({
            search_result: [],

            search_crs_list: new_crs_list,
            search_crs_enabled: this.state.search_crs_enabled.concat(true),
            search_crs_solo_sections_map: new_solo_map,
            search_crs_exclude_sections_map: new_exclusion_map,
            search_crs_conflict_group_map: new_conflict_group_map,
            search_crs_sections_filtermode: this.state.search_crs_sections_filtermode.concat(SectionFilterMode.Exclude),
            cur_search_status: null,
        },
            this.saveData);
    }

    crs_removeSearchCrs(crsObj: Course) {
        let removeIdx = this.state.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id);
        console.assert(removeIdx != -1);

        let new_crs_list = this.state.search_crs_list.filter((crs, idx) => idx != removeIdx);

        let new_solo_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_solo_sections_map);
        let new_exclusion_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_exclude_sections_map);
        new_solo_map.delete(crsObj);
        new_exclusion_map.delete(crsObj);

        let new_conflict_group_map = new Map<Course, string>();
        crs_arrange.get_conflict_map(new_crs_list, new_solo_map, new_exclusion_map).forEach((val, key) => {
            new_conflict_group_map.set(key, this.conflict_color_list[val % this.conflict_color_list.length]);
        });
        
        this.setState({
            search_result: [],
            cur_search_status: null,
            search_crs_list: new_crs_list,
            search_crs_enabled: this.state.search_crs_enabled.filter((crs, idx) => idx != removeIdx),
            search_crs_solo_sections_map: new_solo_map,
            search_crs_exclude_sections_map: new_exclusion_map,

            search_crs_conflict_group_map: new_conflict_group_map,
            search_crs_sections_filtermode: this.state.search_crs_sections_filtermode.filter((crs, idx) => idx != removeIdx),
        },
            this.saveData);
    }

    crs_updateSearchCrsFilterSections(targetCrsObj: Course, new_solo_sections: Map<Course, Set<CourseSection>>, new_exclude_sections: Map<Course, Set<CourseSection>>) {
        let crsIdx = this.state.search_crs_list.findIndex(crs => crs.unique_id == targetCrsObj.unique_id);
        console.assert(crsIdx != -1);
        /*let new_solo_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_solo_sections_map);
        let new_exclusion_map = new Map<Course, Set<CourseSection>>(this.state.search_crs_exclude_sections_map);
        new_solo_map.set(crsObj, new_solo_sections);
        new_exclusion_map.set(crsObj, new_exclude_sections);*/
        // The entire map goes into the component's props, and we trust the component to properly modify the whole map, and pass it back to this callback.
        // console.log(new_solo_sections);
        // console.log(new_exclude_sections);

        // if a whitelist is specified, then activate the whitelist mode. otherwise, continue to use blacklist mode.
        let new_filtermodes_list = [...this.state.search_crs_sections_filtermode];
        new_filtermodes_list[crsIdx] = new_solo_sections.get(targetCrsObj).size != 0 ? SectionFilterMode.Solo : SectionFilterMode.Exclude;
        this.setState(
            {
                search_crs_sections_filtermode: new_filtermodes_list,
                search_crs_solo_sections_map: new_solo_sections,
                search_crs_exclude_sections_map: new_exclude_sections,
                // search_crs_solo_sections_all: new_search_crs_solo_sections.reduce((prev, cur) => { cur.forEach(sec => { prev.add(sec); }); return prev; }), // union of all sets in the list
                // search_crs_exclude_sections_all: new_search_crs_exclude_sections.reduce((prev, cur) => { cur.forEach(sec => { prev.add(sec); }); return prev; }), // union of all sets in the list
            },
            () => {
                this.saveData(); // save data to cookies after updating the state.
                this.crs_doSearch(); // perform search again
            }
        );

    }

    crs_toggleCrsIndex(idx: number) {
        let new_search_crs_enabled = [...this.state.search_crs_enabled];
        new_search_crs_enabled[idx] = !(new_search_crs_enabled[idx]);
        this.setState({ search_crs_enabled: new_search_crs_enabled },
            () => {
                this.crs_doSearch();
                this.saveData();
            }
        );
    }

    crs_doSearch() {
        if (this.state.search_crs_list.length == 0) {
            this.setState({
                search_result: [],
                search_result_idx: 0,
                cur_search_status: "no courses selected"
            });
            return;
        }

        // Apply filters to the course sections passed into search algorithm
        let all_sections: CourseSelection[] = [];
        this.state.search_crs_list.forEach((crs, idx) => {
            // assert searchCrs.exclude_sections intersect searchCrs.soloSections is empty.
            // A section may not be excluded and soloed at the same time.
            if (this.state.search_crs_enabled[idx]) {
                let crs_sections = crsdb.list_all_crs_selections(crs);
                // TODO: this is a temporary fix to allow for whitelist/blacklist of mixed sections.
                // -> we will ignore the filter mode.
                let sectypes = ["LEC", "TUT", "PRA"];
                sectypes.forEach(sectype => {
                    // partition each set into the three section types.
                    let sections_t_whitelist = new Set<CourseSection>(Array.from(this.state.search_crs_solo_sections_map.get(crs).values()).filter(sec => sec.section_id.substr(0, 3) == sectype));
                    let sections_t_blacklist = new Set<CourseSection>(Array.from(this.state.search_crs_exclude_sections_map.get(crs).values()).filter(sec => sec.section_id.substr(0, 3) == sectype));

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


        this.setState({
            search_result: search_result.solutionSet,
            search_result_idx: 0,
            cur_search_status: search_status,
            // TODO: create separate method for grouping courses, make it part of crsdb
            // TODO: use a map of crsgrp -> sel_idx as the search_result_selections, to help implement persistence
            search_result_selections: new Array<number>(all_sections.length).fill(0)
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
        this.setState({ search_result_selections: new_indices });
    }

    public render() {
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
            crs_search_items = this.state.search_crs_list.map((crs, idx) => {
                let lockedSections = Array.from(this.state.search_crs_solo_sections_map.get(crs).values()).map((sec: CourseSection) => {
                    return (<div key={sec.section_id} className="filtered-section-soloed" style={{ width: "100%", cursor: "pointer" }}
                        onClick={() => {
                            let newSoloMap = new Map<Course, Set<CourseSection>>(this.state.search_crs_solo_sections_map);
                            let newSoloSet = new Set<CourseSection>(newSoloMap.get(crs));
                            newSoloSet.delete(sec);
                            newSoloMap.set(crs, newSoloSet);
                            this.crs_updateSearchCrsFilterSections(crs, newSoloMap, this.state.search_crs_exclude_sections_map);
                        }}
                    ><Icon type="lock" /> {sec.section_id}
                        {/*<span style={{ backgroundColor: "#aaeeee", float: "right", marginRight:"25%" }}>Conflict</span> */}
                    </div>)
                });

                let blockedSections = Array.from(this.state.search_crs_exclude_sections_map.get(crs).values()).map((sec: CourseSection) => {
                    return (<div key={sec.section_id} className="filtered-section-excluded" style={{ width: "100%", cursor: "pointer" }}
                        onClick={() => {
                            let newExcludeMap = new Map<Course, Set<CourseSection>>(this.state.search_crs_exclude_sections_map);
                            let newExcludeSet = new Set<CourseSection>(newExcludeMap.get(crs));
                            newExcludeSet.delete(sec);
                            newExcludeMap.set(crs, newExcludeSet);
                            this.crs_updateSearchCrsFilterSections(crs, this.state.search_crs_solo_sections_map, newExcludeMap);
                        }}
                    ><Icon type="minus-circle" theme="filled" /> {sec.section_id}
                        {/* <span style={{ backgroundColor: "#aaeeee", float: "right", marginRight:"25%" }}>Conflict</span> */}
                    </div>
                    )
                });
                let conflictMarker = this.state.search_crs_conflict_group_map.has(crs)
                    ? (<span style={{ backgroundColor: this.state.search_crs_conflict_group_map.get(crs) }}>Conflict</span>)
                    : (<span style={{ }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>);

                return (
                    <div key={crs.course_code} className="crs-bucket-item">
                        <div style={{ width: "100%" }}>
                            <span key="a" className="unselectable" style={{ width: "85%" }}>
                                <Checkbox
                                    checked={this.state.search_crs_enabled[idx]}
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
        let sectionsList = showSearchResults ? this.state.search_result[this.state.search_result_idx] : [];

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
                                            else this.setState({
                                                search_result_idx: idx,
                                                search_result_selections: new Array<number>(this.state.search_result[idx].length).fill(0)
                                            });
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
                    <Tabs defaultActiveKey="F" tabPosition="top"
                        onChange={activeKey => this.setState({ tt_tab_active: activeKey })}
                        activeKey={this.state.tt_tab_active}
                    >
                        <Tabs.TabPane tab="Fall" key="F">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={this.state.search_result_selections} show_term={"F"}
                                crs_solo_sections_map={this.state.search_crs_solo_sections_map} crs_exclude_sections_map={this.state.search_crs_exclude_sections_map}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                                onCrsFilterSectionsChanged={this.crs_updateSearchCrsFilterSections}

                                showLockExcludeBtns={this.state.setting_showLockExcludeBtn}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Winter" key="S">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={this.state.search_result_selections} show_term={"S"}
                                crs_solo_sections_map={this.state.search_crs_solo_sections_map} crs_exclude_sections_map={this.state.search_crs_exclude_sections_map}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                                onCrsFilterSectionsChanged={this.crs_updateSearchCrsFilterSections}

                                showLockExcludeBtns={this.state.setting_showLockExcludeBtn}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Both" key="Y">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={this.state.search_result_selections} show_term={"Y"} show_double={true}
                                crs_solo_sections_map={this.state.search_crs_solo_sections_map} crs_exclude_sections_map={this.state.search_crs_exclude_sections_map}
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

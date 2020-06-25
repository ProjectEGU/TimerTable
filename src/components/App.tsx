import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { Solution as DLXSolution, DLXMatrix } from "./dlxmatrix"
import { crsdb, Campus, Campus_Formatted } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"
import SchedDisp from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Input, Badge, Collapse, Pagination, Popover, Checkbox, message, Skeleton, Menu, Dropdown, Select, InputNumber, Radio, Modal } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";
import { AssertionError } from "assert";
import { crs_arrange, SchedSearchResult, DayLengthPreference, TimePreference, SearchPrefs } from "./schedule";
import { SettingsButton } from "./settings_button";

import { LockTwoTone, MinusCircleFilled, CloseOutlined, LoadingOutlined, UpOutlined, DownOutlined, SearchOutlined } from "@ant-design/icons";

import { view, store } from "react-easy-state";

import { SearchInput, SectionFilterMode, crsSearchStoreFormat } from "./crsSearchStore";
import crsSearchStore from "./crsSearchStore";
import { SelectValue } from "antd/lib/select";
import Fuse from "fuse.js"

interface AppProps {

}

interface AppState {
    data_loaded: boolean;
    data_updated_date: string;

    data_load_error: boolean;
    data_load_error_reason: any;

    tt_tab_active: string;

    crs_search_str: string;
    crs_search_dropdown_open: boolean;
    cur_search_status: string;

    search_result: DLXSolution<CourseSelection[]>[];
    search_result_idx: number;
    search_result_limit: number;

    setting_showLockExcludeBtn: boolean;

    preload_crs_skeleton_linecount: number;

    top_solutions_count: number;

    scheduleInfoVisible: boolean,
    scheduleInfoString: string
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
    searchprefs: SearchPrefs;
}


class App extends React.Component<AppProps, AppState> {
    dropdownRef: React.RefObject<Select<SelectValue>>;


    loadCookie(): AppCookie {
        let savedData = localStorage.getItem("data");
        if (savedData) {
            return JSON.parse(savedData);
        } else {
            return null;
        }
    }

    saveCookie(obj: AppCookie) {
        localStorage.setItem("data", JSON.stringify(obj));
        return;
    }

    parseCookieData() {
        try {
            let defaultTbl = new Map<string, AppCookieSearchTblEntry>();
            defaultTbl.set(crsSearchStore.cur_session, {
                crs_enabled: [],
                crs_solo_sections_obj: new Object(), crs_exclude_sections_obj: new Object(),
                crs_sections_filtermode: [], crs_uids: []
            });
            let loadedCookie: AppCookie = this.loadCookie() || {
                selected_session: crsSearchStore.cur_session,
                search_inputs_tbl: defaultTbl,
                searchprefs: {
                    dayLengthPreference: DayLengthPreference.NoPreference,
                    timePreference: TimePreference.NoPreference,
                    prioritizeFreeDays: false
                }
            }

            crsdb.session_list().forEach((session) => {
                let crsObjs: Course[] = [];
                let soloSectionObjsMap = new Map<string, Set<string>>();
                let excludeSectionObjsMap = new Map<string, Set<string>>();

                // for each session in the cookie, populate the searchInputsTable. 
                // note- if a session is in the cookie but not in the sessions enumerated by crsdb, then it is lost.
                if (!(session in loadedCookie.search_inputs_tbl))
                    return;
                let cookieSesh: AppCookieSearchTblEntry = loadedCookie.search_inputs_tbl[session];
                cookieSesh.crs_uids.map((crs_uid, idx) => {
                    let crsObj = crsdb.get_crs_by_uid(crs_uid);
                    crsObjs.push(crsObj);

                    let soloSectionObjs = new Set<string>();
                    let excludeSectionObjs = new Set<string>();

                    cookieSesh.crs_solo_sections_obj[crs_uid].forEach(sectionId => {
                        let crsSectionObj = crsdb.get_crs_section_by_id(crsObj, sectionId);
                        soloSectionObjs.add(crsSectionObj.section_id);
                    });

                    cookieSesh.crs_exclude_sections_obj[crs_uid].forEach(sectionId => {
                        let crsSectionObj = crsdb.get_crs_section_by_id(crsObj, sectionId);
                        excludeSectionObjs.add(crsSectionObj.section_id);
                    });

                    soloSectionObjsMap.set(crsObj.unique_id, soloSectionObjs);
                    excludeSectionObjsMap.set(crsObj.unique_id, excludeSectionObjs);
                });

                crsSearchStore.search_inputs_tbl.set(session, {
                    search_crs_list: crsObjs,
                    search_crs_solo_sections_map: soloSectionObjsMap,// a map of course object to the set of solo/exclude sections
                    search_crs_exclude_sections_map: excludeSectionObjsMap,
                    // at any point, a course may not have the same course in both solo_sections and exclude_sections
                    // search_crs_conflict_group_map: conflictGroupMap,
                    search_crs_enabled: cookieSesh.crs_enabled,
                    search_crs_sections_filtermode: cookieSesh.crs_sections_filtermode,
                    search_crs_conflict_group_map: new Map<string, string>(), // maps from course to color. if a course is not in the map then it doesn't have a conflict group
                    search_result_selections: [],
                });
            });
            if (crsSearchStore.search_inputs_tbl.has(loadedCookie.selected_session)) {
                crsSearchStore.cur_session = loadedCookie.selected_session;
                crsSearchStore.search_prefs = loadedCookie.searchprefs;
            } else {
                message.warning("The semester you previously selected is no longer available. ");
                this.saveData();
            }
            this.setState({});
        } catch (error) {
            message.warning("Cookies failed to load. ", 3);
        }
    }

    saveData() {
        // convert javascript Maps into plain JS objects, so that they work with JSON.stringify.
        let newCookie: AppCookie = {
            search_inputs_tbl: new Object(),
            selected_session: crsSearchStore.cur_session,
            searchprefs: crsSearchStore.search_prefs
        };
        for (const session of crsSearchStore.search_inputs_tbl.keys()) {
            let stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(session);
            let soloSectionsObj = new Object(); // a JS object with keys consisting of the course's unique ID, and values which are arrays of soloed section IDs for that course.
            let excludeSectionsObj = new Object();
            // the keys of these two maps are strings, representing the course unique ID.
            // the values of these two maps are arrays which represent section IDS associated with the course unique ID.
            stbl.search_crs_solo_sections_map.forEach((val, key) => {
                soloSectionsObj[key] = Array.from(val.values());
            });
            stbl.search_crs_exclude_sections_map.forEach((val, key) => {
                excludeSectionsObj[key] = Array.from(val.values());
            });

            newCookie.search_inputs_tbl[session] = {
                crs_uids: stbl.search_crs_list.map(crs => crs.unique_id),
                crs_solo_sections_obj: soloSectionsObj,
                crs_exclude_sections_obj: excludeSectionsObj,
                crs_enabled: stbl.search_crs_enabled,
                crs_sections_filtermode: stbl.search_crs_sections_filtermode
            };
        }

        // console.log(newCookie);
        this.saveCookie(newCookie);
    }

    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        this.dropdownRef = React.createRef<Select<SelectValue>>();

        this.handleSelectionIndicesChanged = this.handleSelectionIndicesChanged.bind(this);

        this.crs_updateSearchCrsFilterSections = this.crs_updateSearchCrsFilterSections.bind(this);

        this.crs_doSearch = this.crs_doSearch.bind(this);
        this.crs_doSearchNew = this.crs_doSearchNew.bind(this);

        this.switchToSession = this.switchToSession.bind(this);

        this.loadCookie = this.loadCookie.bind(this);

        this.saveCookie = this.saveCookie.bind(this);

        this.loadAvailableSessionData = this.loadAvailableSessionData.bind(this);

        this.showSchedule = this.showSchedule.bind(this);

        this.handleSearchResultClicked = this.handleSearchResultClicked.bind(this);

        // Set the state directly. Use props if necessary.
        this.state = {
            data_loaded: false,
            data_updated_date: "(unable to get data loaded date)",

            data_load_error: false,
            data_load_error_reason: null,

            tt_tab_active: 'F',

            crs_search_str: "",
            crs_search_dropdown_open: false,

            cur_search_status: null,

            search_result: [],
            search_result_idx: 0,

            search_result_limit: 0,

            setting_showLockExcludeBtn: true,

            preload_crs_skeleton_linecount: 0,

            top_solutions_count: 20,

            scheduleInfoVisible: false,
            scheduleInfoString: "",
        }

        this.initComponents();
    }

    componentDidMount() {
        console.log("component mounted");

        this.initCookie();
        this.loadAvailableSessionData().then(() => {
            this.parseCookieData();
        });
        // this.switchToSession(this.state.cur_session);
    }

    initCookie() {
        let cookies: AppCookie = this.loadCookie();
        let crsSkeletonLineCount = 0;
        if (cookies != null) {
            crsSkeletonLineCount = cookies.search_inputs_tbl[cookies.selected_session].crs_uids.length;
            // crsSearchStore.cur_session = cookies.selected_session;
        }

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

    showSchedule() {
        const showSearchResults = this.state.search_result.length > 0;
        let sectionsList = showSearchResults ? this.state.search_result[this.state.search_result_idx].data : [];

        const stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);
        let sectionSelections = stbl.search_result_selections;

        let outputString = "";

        let crsInfos = new Map<string, CourseSelection[]>();
        if (sectionsList.length > 0) {
            for (let i = 0; i < sectionsList.length; i++) {
                let selection = sectionsList[i][sectionSelections[i]];
                let uid = selection.crs.unique_id;
                if (!crsInfos.has(uid)) {
                    crsInfos.set(uid, []);
                }
                crsInfos.get(uid).push(selection);
            }
        }
        for (const uid of crsInfos.keys()) {
            let secList = crsInfos.get(uid);
            let crsInfo = secList[0].crs;
            outputString += `${crsInfo.course_code}: ${crsInfo.course_name} [${crsInfo.campus}] \n`;
            for (const sel of secList) {
                outputString += `    ${sel.sec.section_id}\n`;
                for (const ts of sel.sec.timeslots) {
                    outputString += `        ${ts.weekday} ${SchedDisp.format_timelist(ts.start_time)}`;
                    outputString += ` - ${SchedDisp.format_timelist(ts.end_time)}`;
                    outputString += ` @ ${ts.room_name_1} `;
                    if (ts.room_name_2)
                        outputString += ` / ${ts.room_name_2}`;
                    outputString += '\n';
                }

            }
            outputString += '\n';
        }
        this.setState({
            scheduleInfoString: outputString,
            scheduleInfoVisible: true
        });
    }

    switchToSession(session) {
        console.log("switch to " + session);
        // console.log(this.searchInputsTbl.get(this.state.cur_session));
        crsSearchStore.cur_session = session;

        this.setState({
            search_result: [],
            cur_search_status: null,
        }, this.saveData);
    }

    conflict_color_list = ["#990000", "#009900", "#000099", "#999900", "#009999", "#990099"];
    crs_addSearchCrs(crsObj: Course) {
        crsSearchStore.addSearchCrs(crsObj);
        //this.dropdownRef.current.focus();

        this.setState({
            search_result: [],
            cur_search_status: null,
        },
            () => {
                this.saveData();
                // temp dropdown fix
                let dropdownElement = document.querySelector('div .crs-sel-dropdown');
                if (dropdownElement) {
                    let boundingRect = (dropdownElement).getBoundingClientRect();
                    let yOffset = boundingRect.top + boundingRect.height + 4;
                    (document.querySelector("div .ant-select-dropdown") as HTMLElement).style.top = `${yOffset}px`;
                }
            });
    }

    crs_removeSearchCrs(crsObj: Course) {
        crsSearchStore.removeSearchCrs(crsObj);

        this.setState({
            search_result: [],
            cur_search_status: null,

        },
            this.saveData);
    }

    crs_updateSearchCrsFilterSections(targetCrsObj: Course, new_solo_sections: Map<string, Set<string>>, new_exclude_sections: Map<string, Set<string>>) {
        crsSearchStore.updateSearchCrsFilterSections(targetCrsObj, new_solo_sections, new_exclude_sections);

        // window.setTimeout(()=>this.crs_doSearch(), 200); // perform search again
        /*this.saveData(); // save data to cookies after updating the state.
        this.setState(
            {},
            () => {
            }
        );*/

    }

    crs_toggleCrsIndex(idx: number) {
        crsSearchStore.toggleCrsIndex(idx);


        this.setState({},
            () => {
                // this.crs_doSearch();
                this.saveData();
            }
        );
    }
    crs_doSearchNew() {
        this.crs_doSearch(true);
    }
    crs_doSearch(new_method?: boolean) {
        new_method = new_method === true;

        const stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);

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
                // -> we will ignore the filter mode.
                let sectypes = ["LEC", "TUT", "PRA"];
                sectypes.forEach(sectype => {
                    // partition each set into the three section types.
                    let sections_t_whitelist = new Set<string>(Array.from(stbl.search_crs_solo_sections_map.get(crs.unique_id).values()).filter(sec_id => sec_id.substr(0, 3) == sectype));
                    let sections_t_blacklist = new Set<string>(Array.from(stbl.search_crs_exclude_sections_map.get(crs.unique_id).values()).filter(sec_id => sec_id.substr(0, 3) == sectype));
                    // console.log(crs);
                    // console.log(sectype);
                    // console.log([...stbl.search_crs_solo_sections_map.get(crs.unique_id).values()].filter(sec => sec.section_id.substr(0, 3) == sectype));
                    // console.log([...stbl.search_crs_exclude_sections_map.get(crs.unique_id).values()].filter(sec => sec.section_id.substr(0, 3) == sectype));

                    let sections_t = crs_sections.filter(sel => {
                        if (sel.sec.section_id.substr(0, 3) != sectype) return false;

                        if (sections_t_whitelist.size == 0) { // no whitelisted sections of the type: then, check the blacklist
                            return !sections_t_blacklist.has(sel.sec.section_id);
                        } else { // there are whitelisted sections of the type: then, check the whitelist 
                            return sections_t_whitelist.has(sel.sec.section_id);
                        }
                    });

                    all_sections.push(...sections_t);
                });
            }
        });

        console.time("calculation");
        let search_result: SchedSearchResult = crs_arrange.find_sched(all_sections, crsSearchStore.search_prefs, this.state.search_result_limit, this.state.top_solutions_count, new_method);
        console.timeEnd("calculation");
        console.log("total solutions: " + search_result.solutionSet.length);//@@@@@
        // search_result.solutionSet.length = 0;//@@@@@
        let search_status: string;
        if (search_result.solutionSet.length == 0) {
            search_status = "no feasible schedules found";
        }
        else if (search_result.solutionLimitReached) {
            // console.assert(search_result.solutionSet.length == this.state.search_result_limit);
            search_status = `limit of ${this.state.search_result_limit} schedules reached`;
        } else {
            search_status = `${search_result.solutionSet.length} schedules found`;
        }

        if (search_result.solutionSet.length > 0) {
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
        });
    }

    crs_searchCourses(campus_set: Set<Campus>, session: string, search_str: string): Fuse.FuseResult<Course>[] {
        let all_results = [];
        campus_set.forEach(campus => {
            all_results.push(...crsdb.search_crs(campus, session, search_str));
        });

        return all_results;
    }

    handleSelectionIndicesChanged(new_indices: number[]) {
        const stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);
        stbl.search_result_selections = new_indices;

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

    handleSearchResultClicked(evt: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        evt.preventDefault(); evt.stopPropagation();
        // this.dropdownRef.current.blur();

        // this.crs_addAllSections(crs);
        this.crs_addSearchCrs(crsdb.get_crs_by_uid((evt.target as HTMLDivElement).id));
    };

    public render() {
        // console.log(crsSearchStore.cur_session);
        const stbl = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);

        if (this.state.data_loaded) {
        }

        let dataSource = [];

        if (this.state.data_loaded && this.state.crs_search_str.length > 2) {
            let fuse_results = this.crs_searchCourses(crsSearchStore.cur_campus_set, crsSearchStore.cur_session, this.state.crs_search_str);
            dataSource = fuse_results.map(fuseResult => {
                let crs = fuseResult.item;
                let crs_code = crs.course_code;
                let crs_title = crs.course_name;
                let searchResultHighlighted;
                let matchInfo = fuseResult.matches[0];
                let matchIndices = fuseResult.matches[0].indices[0];

                if (matchInfo.key === 'course_code') {
                    searchResultHighlighted = (<>
                        <span>{crs_code.substring(0, matchIndices[0])}</span>
                        <span className="search-result-highlighted">{crs_code.substring(matchIndices[0], matchIndices[1] + 1)}</span>
                        <span>{crs_code.substring(matchIndices[1] + 1)}</span>
                        <span>: {crs_title}</span></>)
                } else if (matchInfo.key === 'course_name') {
                    searchResultHighlighted = (<>
                        <span>{crs_code}: </span>
                        <span>{crs_title.substring(0, matchIndices[0])}</span>
                        <span className="search-result-highlighted">{crs_title.substring(matchIndices[0], matchIndices[1] + 1)}</span>
                        <span>{crs_title.substring(matchIndices[1] + 1)}</span></>)
                } else {
                    console.error("Invalid match key: " + matchInfo.key);
                    searchResultHighlighted = (<><span>{crs_code}: {crs_title}</span></>)
                }
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
                            onClick={this.handleSearchResultClicked}
                            id={crs.unique_id}
                        >
                            {crsSearchStore.cur_campus_set.size > 1 ? `[${Campus_Formatted[crs.campus]}] ` : null}
                            {searchResultHighlighted}
                        </div>
                    </AutoComplete.Option>

                );
            });
        }

        let crs_search_items;

        if (this.state.data_loaded) {
            crs_search_items = stbl.search_crs_list.map((crs, idx) => {
                let lockedSections = Array.from(stbl.search_crs_solo_sections_map.get(crs.unique_id).values()).map((sec_id: string) => {
                    return (<div key={sec_id} className="filtered-section-soloed" style={{ width: "100%", cursor: "pointer" }}
                        onClick={() => {
                            let newSoloMap = new Map<string, Set<string>>(stbl.search_crs_solo_sections_map);
                            let newSoloSet = new Set<string>(newSoloMap.get(crs.unique_id));
                            newSoloSet.delete(sec_id);
                            newSoloMap.set(crs.unique_id, newSoloSet);
                            this.crs_updateSearchCrsFilterSections(crs, newSoloMap, stbl.search_crs_exclude_sections_map);
                        }}
                    >
                        <LockTwoTone /> {sec_id}
                        {/*<span style={{ backgroundColor: "#aaeeee", float: "right", marginRight:"25%" }}>Conflict</span> */}
                    </div>)
                });

                let blockedSections = Array.from(stbl.search_crs_exclude_sections_map.get(crs.unique_id).values()).map((sec_id: string) => {
                    return (<div key={sec_id} className="filtered-section-excluded" style={{ width: "100%", cursor: "pointer" }}
                        onClick={() => {
                            let newExcludeMap = new Map<string, Set<string>>(stbl.search_crs_exclude_sections_map);
                            let newExcludeSet = new Set<string>(newExcludeMap.get(crs.unique_id));
                            newExcludeSet.delete(sec_id);
                            newExcludeMap.set(crs.unique_id, newExcludeSet);
                            this.crs_updateSearchCrsFilterSections(crs, stbl.search_crs_solo_sections_map, newExcludeMap);
                        }}
                    ><MinusCircleFilled />{sec_id}
                        {/* <span style={{ backgroundColor: "#aaeeee", float: "right", marginRight:"25%" }}>Conflict</span> */}
                    </div>
                    )
                });

                let conflictMarker = stbl.search_crs_conflict_group_map.has(crs.unique_id)
                    ? (<span style={{ backgroundColor: stbl.search_crs_conflict_group_map.get(crs.unique_id) }}>Conflict</span>)
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

                                <CloseOutlined
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
                        <span style={{ float: "right" }}>&nbsp;<CloseOutlined /></span>
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

        let sessionSelectorMenuDisplay = (<Dropdown overlay={this.sessionSelectorMenu} trigger={['click']}>
            <div className="session-selector-menu">
                <p>{crsdb.session_format(crsSearchStore.cur_session)} <DownOutlined /> </p>
            </div>
        </Dropdown>);
        return (
            <div className="app">
                <div className="ctrls">
                    <Collapse
                        bordered={false}
                        defaultActiveKey={['1', '2', '3']}
                        style={{}}
                    >
                        <Collapse.Panel header="Courses list" key="1" disabled
                            showArrow={false}
                            extra={
                                <SettingsButton
                                    currentSettings={{
                                        selectedCampus: crsSearchStore.cur_campus_set,
                                        showLockExcludeBtn: this.state.setting_showLockExcludeBtn
                                    }}
                                    onSettingsModified={(newSettings) => {
                                        crsSearchStore.cur_campus_set = newSettings.selectedCampus;
                                        this.setState({
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
                                {/*sessionSelectorMenuDisplay*/}
                                <p>Course list:</p>
                                {crs_search_items}

                                <div>
                                    <div style={{ marginTop: "10px", marginBottom: "10px" }}>
                                        {this.state.cur_search_status == null ? "View Results:" : `View results (${this.state.cur_search_status}):`}
                                    </div>
                                    <span style={{ float: "left", width: "67%" }}>
                                        <Pagination
                                            current={this.state.search_result.length == 0 ? 0 : this.state.search_result_idx + 1}
                                            disabled={this.state.search_result.length == 0}
                                            simple
                                            size={"small"}
                                            defaultCurrent={0}
                                            total={this.state.search_result.length}
                                            pageSize={1}
                                            style={{ marginBottom: "10px" }}
                                            onChange={(idx) => {
                                                idx -= 1;
                                                if (idx >= this.state.search_result.length || idx < 0) return;
                                                else {
                                                    const stbl: SearchInput = crsSearchStore.search_inputs_tbl.get(crsSearchStore.cur_session);
                                                    stbl.search_result_selections = new Array<number>(this.state.search_result[idx].data.length).fill(0)
                                                    this.setState({
                                                        search_result_idx: idx,
                                                    },
                                                        () => { console.log(`score at idx ${idx}: ${this.state.search_result[idx].score}`); });
                                                }
                                            }}
                                        />

                                    </span>
                                    <span style={{ float: "right" }}>
                                        <Button icon={<SearchOutlined />} style={{ display: "none" }} onClick={this.crs_doSearch as any}>
                                            Search (old)
                                        </Button>
                                        <Button onClick={this.showSchedule}>
                                            View Schedule
                                        </Button>
                                        <Modal
                                            title="View Schedule"
                                            visible={this.state.scheduleInfoVisible}
                                            onOk={e => { this.setState({ scheduleInfoVisible: false }) }}
                                            onCancel={e => { this.setState({ scheduleInfoVisible: false }) }}
                                            width={720}
                                        >
                                            <pre>
                                                {this.state.scheduleInfoString}
                                            </pre>
                                        </Modal>
                                        <Button icon={<SearchOutlined />} onClick={this.crs_doSearchNew}>
                                            Search
                                        </Button>
                                    </span>
                                </div>
                            </Card>

                            <div className="sel-crs">
                                <label>Add a course:</label>
                                <AutoComplete
                                    ref={this.dropdownRef}
                                    open={crs_dropdown_open}
                                    size="large"
                                    style={{ width: "100%" }}
                                    dropdownAlign={{
                                        points: ['tr', 'br'] // align to bottom-right or top-right : https://github.com/ant-design/ant-design/issues/18763
                                    }}
                                    dropdownMatchSelectWidth={400}
                                    disabled={this.state.data_load_error}
                                    dataSource={dataSource}
                                    placeholder="Enter first 3 letters of course code"
                                    className="crs-sel-dropdown"
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
                                    onSelect={(a, b) => { }}
                                >
                                    <Input
                                        onFocus={() => {
                                            this.setState({ crs_search_dropdown_open: this.state.crs_search_str.length >= 3 });
                                        }}

                                        suffix={
                                            <>
                                                {!this.state.data_loaded && this.state.crs_search_str.length > 2 ? <LoadingOutlined type="loading" style={{ paddingRight: 12 }} /> : null}
                                                <Button
                                                    size="small"
                                                    type={crs_dropdown_open ? "primary" : "default"}
                                                    onClick={() => {
                                                        this.setState({ crs_search_dropdown_open: this.state.crs_search_str.length >= 3 && !crs_dropdown_open });
                                                    }}
                                                >
                                                    {crs_dropdown_open ? <UpOutlined /> : <DownOutlined />}
                                                </Button>
                                            </>
                                        }

                                    />
                                </AutoComplete>
                            </div>

                        </Collapse.Panel>
                        <Collapse.Panel header="Tweak your schedule" key="2" showArrow={true}
                        > {/*extra={<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />}*/}
                            <div className="unselectable" style={{ marginTop: "0em", marginBottom: "0em" }}>Solution Count (0 = unlimited):&nbsp;
                            <InputNumber min={0} max={500} value={this.state.top_solutions_count} onChange={(val) => {
                                    this.setState({ top_solutions_count: val });
                                }} />
                            </div>
                            <p className="unselectable" style={{ marginTop: "1em", marginBottom: "0em" }}>Time preference</p>
                            <Radio.Group onChange={(evt) => {
                                crsSearchStore.search_prefs.timePreference = evt.target.value;
                                this.setState(
                                    {},
                                    () => {
                                        this.saveData(); // save data to cookies after updating the state.
                                    }
                                );
                            }}
                                value={crsSearchStore.search_prefs.timePreference}>
                                <Radio.Button value={TimePreference.NoPreference}>Any</Radio.Button>
                                <Radio.Button value={TimePreference.Morning}>Morning</Radio.Button>
                                <Radio.Button value={TimePreference.Noon}>Noon</Radio.Button>
                                <Radio.Button value={TimePreference.Evening}>Evening</Radio.Button>
                            </Radio.Group>
                            <p className="unselectable" style={{ marginTop: "1em", marginBottom: "0em" }}>Day length preference</p>
                            <Radio.Group onChange={(evt) => {
                                crsSearchStore.search_prefs.dayLengthPreference = evt.target.value;
                                this.setState(
                                    {},
                                    () => {
                                        this.saveData(); // save data to cookies after updating the state.
                                    }
                                );
                            }}
                                value={crsSearchStore.search_prefs.dayLengthPreference}>
                                <Radio.Button value={DayLengthPreference.NoPreference}>Any</Radio.Button>
                                <Radio.Button value={DayLengthPreference.Long2}>Long days</Radio.Button>
                                <Radio.Button value={DayLengthPreference.Short}>Short days</Radio.Button>
                                {/*<Radio.Button value={DayLengthPreference.Long2}>Long2</Radio.Button>*/}
                            </Radio.Group>
                            <p className="unselectable" style={{ marginTop: "1em", marginBottom: "0em" }}></p>
                            <Checkbox onChange={() => {
                                crsSearchStore.search_prefs.prioritizeFreeDays = !crsSearchStore.search_prefs.prioritizeFreeDays;
                                this.setState(
                                    {},
                                    () => {
                                        this.saveData(); // save data to cookies after updating the state.
                                    }
                                );
                            }}
                                checked={crsSearchStore.search_prefs.prioritizeFreeDays}>
                                Prioritize free days
                            </Checkbox>
                            <p className="unselectable" style={{ marginTop: "1em", marginBottom: "0em" }}>This is currently a work in progress.</p>
                        </Collapse.Panel>
                        {/*<Collapse.Panel header="Search" key="3" showArrow={true} >

                        </Collapse.Panel>*/}
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
                            sessionSelectorMenuDisplay
                        }
                    >
                        <Tabs.TabPane tab={crsSearchStore.cur_session.endsWith('9') ? "Fall" : "Term 1"} key="F">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={stbl.search_result_selections} show_term={"F"}
                                crs_solo_sections_map={stbl.search_crs_solo_sections_map} crs_exclude_sections_map={stbl.search_crs_exclude_sections_map}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                                onCrsFilterSectionsChanged={this.crs_updateSearchCrsFilterSections}

                                showLockExcludeBtns={this.state.setting_showLockExcludeBtn}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab={crsSearchStore.cur_session.endsWith('9') ? "Winter" : "Term 2"} key="S">
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
            </div>
        );
    }

}

declare let module: object;

export default hot(module)(view(App));

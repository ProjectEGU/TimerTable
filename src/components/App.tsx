import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { DLXMatrix } from "./dlxmatrix"
import { crsdb, Campus, Campus_Formatted } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"
import { SchedDisp } from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Icon, Input, Badge, Collapse, Pagination, Popover, Checkbox, message } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";
import { AssertionError } from "assert";
import { crs_arrange, SchedSearchResult } from "./schedule";
import { SettingsButton } from "./settings_button";

interface AppProps {

}

interface CrsState {
    crs_obj_list: Course[];
    crs_sections: CourseSelection[];
    /*
    TODO: Consider using a "unique id" -> CourseSelection[] mapping
    Advantage:
        - Faster addition / removal of all sections of a specific course
        - DLXSolver needs to generate a mapping of each section to its respective course anyways, in order to generate constraints.
    Disadvantage:
        - Need to group output from DLXSolver into the mapping format. DLXSolver returns lists of independent CourseSelection[]
            - In SetState, the new object must be a copy of the original. Copying dicts is difficult and we can consider using the "ReadOnly" library opensourced by facebook.
        - Difficult to loop through each value into the mapping unless a separate list is maintained. Looping through each CourseSection[] is required to draw the tables.
            - Can consider using Iterable, passed in to sched_disp which will use for(let..of) loop instead of length to iterate.
    */
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
    search_result: CourseSelection[][][];

    search_result_idx: number;
    search_result_limit: number;
    /**
     * Array of selected indices for equivalent sections in the current search result.
     */
    search_result_selections: number[];
}

/**
 * Dec 27 todo:
 * [ ] Better displaying of currently selected campus(es)
 * [ ] Show / highlight conflicting courses and show options for removing them
 * [ ] Select unoccupied timeslots and find courses to occupy them.
 * [ ] "Block sections" by excluding them.
 * [ ] Apply filters to results (on the right)
 * [ ] Show clear difference between StG and UTM courses.
 * [ ] UI Polishment
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
class App extends React.Component<AppProps, AppState> {
    dropdownRef: React.RefObject<AutoComplete>;
    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        this.dropdownRef = React.createRef<AutoComplete>();

        this.handleSelectionIndicesChanged = this.handleSelectionIndicesChanged.bind(this);

        // Set the state directly. Use props if necessary.
        this.state = {
            data_loaded: false,
            data_updated_date: "(unable to get data loaded date)",

            data_load_error: false,
            data_load_error_reason: null,

            tt_tab_active: 'F',

            crs_search_str: "",
            crs_search_dropdown_open: false,

            cur_campus_set: new Set<Campus>([Campus.STG_ARTSCI]),
            cur_session: "20199",

            cur_search_status: null,

            search_crs_list: [],

            search_result: [],
            search_result_idx: 0,

            search_result_limit: 1000000,

            search_result_selections: []
        }
    }

    componentDidMount() {
        // Get values of enum: Object.keys(ENUM).map(key=>ENUM[key])
        // https://stackoverflow.com/a/39372911/4051435
        // Promise.all will return a new promise that resolves when the input list of promises have resolved.
        // It will resolve with an array of results for each promise in the input list.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
        Promise.all(Object.keys(Campus).map(key => Campus[key]).map(campus => {
            return crsdb.fetch_crs_data(campus, this.state.cur_session);
        })).then(() => {
            console.log(crsdb.data_updated_date);
            this.setState({
                data_loaded: true,
                data_updated_date: crsdb.data_updated_date == null ? "(unable to get updated date)" : crsdb.data_updated_date.toDateString().substring(4)
            });
        }).catch(err => {
            console.log(err)

            if (!this.state.data_load_error) {
                message.error("Unable to retrieve course data. ", 0);
                this.setState({
                    data_load_error: true,
                    data_load_error_reason: err
                });
            }
        });
    }

    crs_listAllSections(crs: Course): CourseSelection[] {
        let output: CourseSelection[] = [];
        Object.keys(crs.course_sections).forEach(sec_type => {
            output.push(...crs.course_sections[sec_type].map<CourseSelection>((sec) => ({ crs: crs, sec: sec })));
        });

        return output;
    }

    crs_addSearchCrs(crsObj: Course) {
        // if course is already in current list, then skip operation
        if (this.state.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id) != -1)
            return;
        this.setState({
            search_result: [],
            search_crs_list: this.state.search_crs_list.concat(crsObj),
            cur_search_status: null
        });
    }

    crs_removeSearchCrs(crsObj: Course) {
        console.assert(this.state.search_crs_list.findIndex(crs => crs.unique_id == crsObj.unique_id) != -1);
        this.setState({
            search_result: [],
            search_crs_list: this.state.search_crs_list.filter(crs => crs != crsObj),
            cur_search_status: null
        });
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

        let all_sections: CourseSelection[] = [];
        this.state.search_crs_list.forEach((crs) => {
            all_sections.push(...this.crs_listAllSections(crs));
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
        //console.log(new_indices);
        //console.log(this.state.search_result[this.state.search_result_idx]);
        this.setState({ search_result_selections: new_indices });
    }

    public render() {

        if (this.state.data_loaded) {
        }
        // TODO: add buttons that show on hover: Info (contains edit sections / remove functionality), Edit sections, Remove

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

        let crs_search_items = this.state.search_crs_list.map(crs => {
            return (
                <div key={crs.course_code}>
                    <span style={{ float: "left" }}>{/*`[${Campus_Formatted[crs.campus]}] `*/}{crs.course_code}</span>
                    <span style={{ float: "right" }}>&nbsp;<Icon type="close" onClick={() => {
                        this.crs_removeSearchCrs(crs);

                    }} /></span>
                    <br />
                </div>
            );
        });

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
                                    selectedCampus: this.state.cur_campus_set
                                }}
                                onSettingsModified={(newSettings) => {
                                    this.setState({ cur_campus_set: newSettings.selectedCampus });
                                    // message.info("Changes saved.");
                                }}
                                onSettingsCancelled={() => {
                                    // message.info("Changes are not saved.");
                                }}
                            />
                        }>
                            {/*<Card size="small" style={{ width: "auto" }}>
                                <p>Select courses:</p>
                                {crs_disp_items}
                        </Card>*/}

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
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Winter" key="S">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={this.state.search_result_selections} show_term={"S"}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
                            />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Both" key="Y">
                            <SchedDisp crs_selections_groups={sectionsList} crs_selections_indices={this.state.search_result_selections} show_term={"Y"} show_double={true}
                                onSelectionIndicesChanged={this.handleSelectionIndicesChanged}
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

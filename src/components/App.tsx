import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { DLXMatrix } from "./dlxmatrix"
import { crsdb, Campus } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"
import { SchedDisp } from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Icon, Input, Badge, Collapse, Pagination } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";
import { AssertionError } from "assert";
import { crs_arrange } from "./schedule";

interface AppProps {

}

interface CrsState {
    crs_code_list: string[];
    crs_obj_list: Course[];
    crs_sections: CourseSelection[];
}

interface AppState {
    data_loaded: boolean;
    data: Course[];
    crs_search_str: string;
    crs_search_dropdown_open: boolean;
    cur_campus: string;
    cur_session: string;


    crs_state: CrsState;

    search_crs_list: Course[];
    search_result: CourseSelection[][];
    search_result_idx: number;
}

class App extends React.Component<AppProps, AppState> {
    dropdownRef: React.RefObject<AutoComplete>;
    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        this.dropdownRef = React.createRef<AutoComplete>();

        // Set the state directly. Use props if necessary.
        this.state = {
            data_loaded: false,
            data: [],
            crs_search_str: "",
            crs_search_dropdown_open: false,
            cur_campus: "stg_artsci",
            cur_session: "20199",

            crs_state: {
                crs_code_list: [],
                crs_obj_list: [],
                crs_sections: []
            },

            search_crs_list: [],

            search_result: [],
            search_result_idx: 0
        }
    }

    componentDidMount() {
        crsdb.fetch_crs_data(this.state.cur_campus, this.state.cur_session).then(
            (data: Course[]) => {
                // console.log(data);
                // setstate data
                this.setState({ data_loaded: true, data: data });
            }
        ).catch((err) => {
            console.log(err);
            // setstate err
        });
    }

    crs_getByCode(crs_code: string): Course {
        crs_code = crs_code.toUpperCase();
        let crsObj = crsdb.get_crs_by_code(this.state.cur_campus, this.state.cur_session, crs_code);
        console.assert(crsObj != null);

        return crsObj;
    }
    crs_listAllSections(crs: Course): CourseSelection[] {
        let output: CourseSelection[] = [];
        Object.keys(crs.course_sections).forEach(sec_type => {
            output.push(...crs.course_sections[sec_type].map<CourseSelection>((sec) => ({ crs: crs, sec: sec })));
            console.log(sec_type);
        });

        return output;
    }

    crs_addSearchCrs(crs_code: string) {
        let crsObj = this.crs_getByCode(crs_code);
        if (this.state.search_crs_list.indexOf(crsObj) != -1)
            return;
        this.setState({
            search_result: [],
            search_crs_list: this.state.search_crs_list.concat(crsObj)
        });
    }

    crs_removeSearchCrs(crs_code: string) {
        let crsObj = this.crs_getByCode(crs_code);
        console.assert(this.state.search_crs_list.indexOf(crsObj) != -1);
        this.setState({
            search_result: [],
            search_crs_list: this.state.search_crs_list.filter(crs => crs != crsObj)
        });
    }

    crs_doSearch() {
        this.setState({
            search_result: crs_arrange.find_sched(this.state.search_crs_list),
            search_result_idx: 0
        });
    }

    crs_addAllSections(crs_code: string) {
        if (this.state.crs_state.crs_code_list.indexOf(crs_code) != -1) {
            return;
        }
        let crsObj = this.crs_getByCode(crs_code);
        this.setState({
            crs_state:
            {
                crs_obj_list: this.state.crs_state.crs_obj_list.concat(crsObj),
                crs_sections: this.state.crs_state.crs_sections.concat(...this.crs_listAllSections(crsObj)),
                crs_code_list: this.state.crs_state.crs_code_list.concat(crs_code)
            }
        });
    }

    crs_removeAllSections(crs_code: string) {
        console.assert(this.state.crs_state.crs_code_list.indexOf(crs_code) != -1);
        this.setState({
            crs_state:
            {
                crs_obj_list: this.state.crs_state.crs_obj_list.filter(crs => crs.course_code != crs_code),
                crs_sections: this.state.crs_state.crs_sections.filter(crs_sel => crs_sel.crs.course_code != crs_code),
                crs_code_list: this.state.crs_state.crs_code_list.filter(crs_c => crs_c != crs_code)
            }
        });
    }

    public render() {
        let ccc = [];
        if (this.state.data_loaded) {
            /*//test 2 courses
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC367H5F"), "LEC0101", "PRA0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC411H5F"), "LEC0101", "TUT0102"));*/
            /*//test conflicting courses
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC236H5F"), "LEC0103", "TUT0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC290H5F"), "TUT0102", "LEC0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC324H5F"), "LEC0101", "PRA0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC347H5F"), "PRA0103", "LEC0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC411H5F"), "LEC0102", "TUT0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC477H5F"), "PRA0101", "LEC0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CHI311H5F"), "LEC0101"));
            ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "MAT102H5F"), "TUT0126", "LEC0101"));*/
            //ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC347H5F"), "PRA0103", "LEC0101"));
            //ccc.push(...crsdb.get_crs_selections(crsdb.get_crs_by_code("utm", "20199", "CSC411H5F"), "LEC0102", "TUT0101"));
        }
        // TODO: add buttons that show on hover: Info (contains edit sections / remove functionality), Edit sections, Remove

        let dataSource = (this.state.data_loaded && this.state.crs_search_str.length > 2) ?
            crsdb.list_crs_by_code(this.state.cur_campus, this.state.cur_session, this.state.crs_search_str)
                .map(crs => {
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
                            <div onClick={(evt: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
                                evt.preventDefault(); evt.stopPropagation();
                                // this.dropdownRef.current.blur();

                                // this.crs_addAllSections(crs_code);
                                this.crs_addSearchCrs(crs_code);
                            }}
                                style={{ padding: "5px 12px 5px 12px", width: "100%" }}
                            > {crs_code}: {crs_title} [{Object.keys(crs.course_sections).join(',')}]</div>
                        </AutoComplete.Option>

                    );
                })
            : [];

        let crs_disp_items = this.state.crs_state.crs_obj_list.map(crs => {
            return (
                <div key={crs.course_code}>
                    <span style={{ float: "left" }}>{crs.course_code}</span>
                    <span style={{ float: "right" }}>&nbsp;<Icon type="close" onClick={() => {
                        this.crs_removeAllSections(crs.course_code);
                    }} /></span>
                    <br />
                </div>
            );
        });

        let crs_search_items = this.state.search_crs_list.map(crs => {
            return (
                <div key={crs.course_code}>
                    <span style={{ float: "left" }}>{crs.course_code}</span>
                    <span style={{ float: "right" }}>&nbsp;<Icon type="close" onClick={() => {
                        this.crs_removeSearchCrs(crs.course_code);
                    }} /></span>
                    <br />
                </div>
            );
        });
        const showSearchResults = this.state.search_result.length > 0;
        let sectionsList = showSearchResults ? this.state.search_result[this.state.search_result_idx] : this.state.crs_state.crs_sections;
        let crs_dropdown_open = this.state.crs_search_dropdown_open && dataSource.length > 0;
        return (
            <div className="app">
                <div style={{ float: "left", width: "800px" }}>
                    <Tabs defaultActiveKey="1" tabPosition="top" >
                        <Tabs.TabPane tab="Fall" key="1">
                            <SchedDisp crs_selections={sectionsList} show_term={"F"} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Winter" key="2">
                            <SchedDisp crs_selections={sectionsList} show_term={"S"} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Both" key="3">
                            <div style={{ float: "left", width: "50%" }}><SchedDisp crs_selections={sectionsList} show_term={"F"} /></div>
                            <div style={{ float: "right", width: "50%" }}><SchedDisp crs_selections={sectionsList} show_term={"S"} /></div>
                        </Tabs.TabPane>
                    </Tabs>

                </div>
                <div className="ctrls" style={{ float: "left", width: "400px" }}>
                    <Collapse
                        defaultActiveKey={['1', '3']}
                    >
                        <Collapse.Panel header="Current Courses List" key="1" disabled showArrow={false} extra={<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />}>
                            <Card size="small" style={{ width: "auto" }}>
                                <p>Select courses:</p>
                                {crs_disp_items}
                            </Card>
                            <Card size="small" style={{ width: "auto" }}>
                                <p>Search Courses:</p>
                                {crs_search_items}
                            </Card>
                            <label>Add a course:</label>
                            <AutoComplete
                                ref={this.dropdownRef}
                                open={crs_dropdown_open}
                                size="large"
                                style={{ width: "100%" }}
                                dropdownStyle={{ width: "auto" }}
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
                                        <Button
                                            style={{ marginRight: -12, opacity: 1 }}
                                            size="large"
                                            type={crs_dropdown_open ? "primary" : "default"}
                                            onClick={() => {
                                                console.log("btn click");
                                                this.setState({ crs_search_dropdown_open: this.state.crs_search_str.length >= 3 && !crs_dropdown_open });
                                            }}
                                        >
                                            <Icon type={crs_dropdown_open ? "up" : "down"} />
                                        </Button>}

                                />
                            </AutoComplete>
                        </Collapse.Panel>
                        <Collapse.Panel header="Constraints" key="2" showArrow={false} extra={<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />}>
                            <div></div>
                        </Collapse.Panel>
                        <Collapse.Panel header="Search" key="3" showArrow={false} extra={<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />}>

                            <div>
                                <span>View Result:</span>
                                <span><Pagination
                                    current={this.state.search_result.length == 0 ? 0 : this.state.search_result_idx + 1}
                                    disabled={this.state.search_result.length == 0}
                                    simple
                                    defaultCurrent={0} 
                                    total={this.state.search_result.length}
                                    pageSize={1}

                                    style={{ width: "66%" }}
                                    onChange={(idx) => {
                                        idx -= 1;
                                        if (idx >= this.state.search_result.length || idx < 0) return;
                                        else this.setState({ search_result_idx: idx });
                                    }}
                                />
                                    <Button icon="search" onClick={this.crs_doSearch.bind(this)}>
                                        Search
                            </Button>
                                </span>
                                <span style={{ float: "right" }}></span>
                            </div>
                        </Collapse.Panel>
                    </Collapse>
                </div>
            </div >
        );
    }

}

declare let module: object;

export default hot(module)(App);
/*


                    <Card size="small" title="Small size card" extra={<a href="#">More</a>} style={{ width: "100%", float: "left" }}>
                        <p>Card content</p>
                        <p>Card content</p>
                        <p>Card content</p>
                        <Badge
                            count={4}
                            style={{ userSelect:"none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />
                    </Card>

*/

/*
<AutoComplete.Option key={`${crs_code}`} value={`${crs_code}`}>
            {crs_code}
        </AutoComplete.Option>
                <AutoComplete.OptGroup key={crs_code} label={<a><div style={{
                    overflow: "hidden",
                    textOverflow: "clip",
                    whiteSpace: "nowrap",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center"
                }}>{crs_code}: {crs_title}</div></a>}>
                </AutoComplete.OptGroup>
*/
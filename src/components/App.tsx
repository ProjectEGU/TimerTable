import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { DLXMatrix } from "./dlxmatrix"
import { crsdb, Campus } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot, CourseSelection } from "./course"
import { Schedule } from "./schedule"
import { SchedDisp } from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Icon, Input, Badge, Collapse, Pagination } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";
import { AssertionError } from "assert";

interface AppProps {

}
interface AppState {
    data_loaded: boolean;
    data: Course[];
    crs_search_str: string;
    crs_search_dropdown_open: boolean;
    cur_campus: string;
    cur_session: string;

    crs_code_list: string[];
    crs_obj_list: Course[];
    crs_sections: CourseSelection[];
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

            crs_code_list: [],
            crs_obj_list: [],
            crs_sections: []
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

    crs_addAllSections(crs_code: string) {
        crs_code = crs_code.toUpperCase();
        console.log(crs_code in this.state.crs_code_list);
        if(this.state.crs_code_list.indexOf(crs_code) != -1){
            return;
        }
        let crsObj = crsdb.get_crs_by_code(this.state.cur_campus, this.state.cur_session, crs_code);
        console.assert(crsObj != null);
        this.setState({
            crs_obj_list: this.state.crs_obj_list.concat(crsObj),
            crs_sections: this.state.crs_sections.concat(...crsObj.course_sections.LEC.map<CourseSelection>((sec) => ({crs: crsObj, sec: sec}))),
            crs_code_list: this.state.crs_code_list.concat(crs_code)
        });
    }

    crs_removeAllSections(crs_code: string) {
        crs_code = crs_code.toUpperCase();
        let crsObj = crsdb.get_crs_by_code(this.state.cur_campus, this.state.cur_session, crs_code);
        console.assert(this.state.crs_code_list.indexOf(crs_code) > -1);
        console.assert(crsObj != null);


        this.setState({
            crs_obj_list: this.state.crs_obj_list.splice(this.state.crs_obj_list.findIndex(crs => crs.course_code == crs_code)),
            crs_sections: this.state.crs_sections.filter(crs_sel => crs_sel.crs.course_code != crs_code),
            crs_code_list: this.state.crs_code_list.splice(this.state.crs_code_list.indexOf(crs_code))
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
                                this.crs_addAllSections(crs_code);
                            }}
                                style={{ padding: "5px 12px 5px 12px", width: "100%" }}
                            > {crs_code}: {crs_title} </div>
                        </AutoComplete.Option>

                    );
                })
            : [];

        let crs_disp_items = this.state.crs_obj_list.map(crs => {
            return (
                <div key={crs.course_code}>
                    <span style={{ float: "left" }}>{crs.course_code}</span><span><Icon type="close" onClick={() => { this.crs_removeAllSections(crs.course_code); }} /></span>
                </div>
            );
        });

        let crs_dropdown_open = this.state.crs_search_dropdown_open && dataSource.length > 0;
        return (
            <div className="app">
                <div style={{ float: "left", width: "800px" }}>
                    <Tabs defaultActiveKey="1" tabPosition="top" >
                        <Tabs.TabPane tab="Fall" key="1">
                            <SchedDisp crs_selections={this.state.crs_sections} show_term={"F"} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Winter" key="2">
                            <SchedDisp crs_selections={this.state.crs_sections} show_term={"S"} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Both" key="3">
                            <div style={{ float: "left", width: "50%" }}><SchedDisp crs_selections={this.state.crs_sections} show_term={"F"} /></div>
                            <div style={{ float: "right", width: "50%" }}><SchedDisp crs_selections={this.state.crs_sections} show_term={"S"} /></div>
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
                                {crs_disp_items}
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
                                    /*this.setState({
                                        crs_search_dropdown_open: false,
                                    });*/
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
                        <Collapse.Panel header="Search" key="3" showArrow={false} extra={[<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />, <Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />]}>
                            <div><span>View Result:<br /><br /></span>
                                <Pagination disabled={true} simple defaultCurrent={2} total={50} />
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
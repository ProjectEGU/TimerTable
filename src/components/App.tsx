import * as React from "react";
import { hot } from "react-hot-loader";

import "./../assets/scss/App.scss";
import 'antd/dist/antd.css';

import { DLXMatrix } from "./dlxmatrix"
import { crsdb, Campus } from "./crsdb"
import { Course, CourseSection, CourseSectionsDict, Timeslot } from "./course"
import { Schedule } from "./schedule"
import { SchedDisp } from "./sched_disp";
import { AutoComplete, Button, Card, Tabs, Icon, Input, Badge, Collapse } from 'antd';
import { AutoCompleteProps } from "antd/lib/auto-complete";

interface AppProps {

}
interface AppState {
    data_loaded: boolean;
    data: Course[];
    crs_search_str: string;
    crs_search_dropdown_open: boolean;
    cur_campus: string;
    cur_session: string;
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
            cur_session: "20199"
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
                        <AutoComplete.OptGroup key={crs_code} label={<div style={{
                            overflow: "hidden",
                            textOverflow: "clip",
                            whiteSpace: "nowrap",
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center"
                        }}><a>{crs_code}: {crs_title}</a></div>}>
                        </AutoComplete.OptGroup>

                    );
                })
            : [];
        /*
<AutoComplete.Option key={`${crs_code}`} value={`${crs_code}`}>
                    {crs_code}
                </AutoComplete.Option>
 <AutoComplete.OptGroup key={crs_code} label={<div style={{
                            overflow: "hidden",
                            textOverflow: "clip",
                            whiteSpace: "nowrap",
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center"
                        }}><a>{crs_code}: {crs_title}</a></div>}>
                        </AutoComplete.OptGroup>
       */
        // console.log(dataSource);//todo: change tabview key depending on if winter or fall | todo: make dropdown size larger
        // if (!this.state.crs_search_dropdown_open)
        //    this.dropdownRef.current.blur();
        let crs_dropdown_open = this.state.crs_search_dropdown_open && dataSource.length > 0;
        return (
            <div className="app">
                <div style={{ float: "left", width: "800px" }}>
                    <Tabs defaultActiveKey="1" tabPosition="top" >
                        <Tabs.TabPane tab="Fall" key="1">
                            <SchedDisp crs_selections={ccc} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Winter" key="2">
                            <SchedDisp crs_selections={ccc} />
                        </Tabs.TabPane>
                        <Tabs.TabPane tab="Both" key="3">
                            <div style={{ float: "left", width: "50%" }}><SchedDisp crs_selections={ccc} /></div>
                            <div style={{ float: "right", width: "50%" }}><SchedDisp crs_selections={ccc} /></div>
                        </Tabs.TabPane>
                    </Tabs>

                </div>
                <div className="ctrls" style={{ float: "left", width: "400px" }}>
                    <label>Search for a course:</label>
                    <AutoComplete
                        ref={this.dropdownRef}

                        open={crs_dropdown_open}
                        size="large"
                        style={{ width: "100%" }}
                        dropdownStyle={{ width: "500px" }}
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
                    <Collapse
                        defaultActiveKey={['1', '2', '3']}
                    >
                        <Collapse.Panel header="Current Courses List" key="1" disabled showArrow={false} extra={<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />}>
                            <Card size="small" style={{ width: "auto" }}>
                                <p>CSC477</p>
                            </Card>

                        </Collapse.Panel>
                        <Collapse.Panel header="Constraints" key="2" showArrow={false} extra={<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />}>
                            <div>321</div>
                        </Collapse.Panel>
                        <Collapse.Panel header="Search" key="3" showArrow={false} extra={[<Badge
                            count={4}
                            style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                        />,<Badge
                        count={4}
                        style={{ userSelect: "none", backgroundColor: '#fff', color: '#999', boxShadow: '0 0 0 1px #d9d9d9 inset' }}
                    />]}>
                            <div>123</div>
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
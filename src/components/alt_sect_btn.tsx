import * as React from "react";
import { Button, Popover } from 'antd';
import { CourseSelection, Timeslot } from "./course";
import "./../assets/scss/alt_sect_btn.scss";
import { EllipsisOutlined } from "@ant-design/icons";

interface ASBProps {
    onSectionSelected?: (idx: number, crs_sel: CourseSelection) => void;
    alternateSections: CourseSelection[],
    curTimeslot: Timeslot
}

interface ASBState {
    menuOpen: boolean;
    btnHover: boolean;
}

interface ASBListItem {

}

export class AlternateSectionButton extends React.Component<ASBProps, ASBState> {
    static defaultProps = {
    }
    popoverRef: React.RefObject<Popover>;
    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        // Set the state directly. Use props if necessary.
        this.state = {
            menuOpen: false,
            btnHover: false
        }

        this.sectionSelectedHandler = this.sectionSelectedHandler.bind(this);
    }

    sectionSelectedHandler(idx: number, crs_sel: CourseSelection) {
        if (this.props.onSectionSelected != undefined) {
            this.props.onSectionSelected(idx, crs_sel);
        }
    }

    shouldComponentUpdate(nextProps: Readonly<ASBProps>, nextState: Readonly<ASBState>) {
        // prevent blank updates from the parent component from triggering an unnecessary re-render here

        // check if list of alt sections have changed, if they have, then update the component
        if (nextProps.alternateSections.length != this.props.alternateSections.length)
            return true;
        else if (nextProps.alternateSections.some((v, idx) => this.props.alternateSections[idx] != v))
            return true;

        // if the list of alt sections have not changed, perform shallow comparison of state to determine whether or not to update component
        return !(Object.keys(nextState).every(key => nextState[key] == this.state[key]));

        // the goal is to prevent excess render() calls, which cause the popover to not show fadeout animation.
    }

    render() {
        let btnStyle = (this.state.btnHover || this.state.menuOpen) ? "sched-sel-alt-crs-btn-hover" : "sched-sel-alt-crs-btn";
        let menuContent = (
            this.props.alternateSections.map((val, idx) => {
                return (
                    <div key={idx}><a className="sched-sel-alt-crs-menu-item"
                        onClick={(evt) => {
                            this.sectionSelectedHandler(idx, val);
                            this.setState({ menuOpen: false });
                        }}

                    >{val.sec.section_id}</a></div>
                );
            })
        );

        return (
            <Popover placement="right" title={"Select alternate section"} content={menuContent} trigger="click"
                autoAdjustOverflow={false}
                visible={this.state.menuOpen}
                onVisibleChange={(visible) => { this.setState({ btnHover: visible, menuOpen: visible }); }}
            >
                <div className="sched-sel-alt-crs-div"
                    onMouseOver={(evt) => { this.setState({ btnHover: true }); }}
                    onMouseLeave={(evt) => { this.setState({ btnHover: false }); }}
                >
                    <Button type="dashed" shape="circle" icon={<EllipsisOutlined />}
                        className={btnStyle}
                    />
                </div>
            </Popover>
        );
    }
}
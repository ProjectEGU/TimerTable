import * as React from "react";
import { Row, Col, Icon, Button, Popover } from 'antd';
import { CourseSection } from "./course";
import "./../assets/scss/alt_sect_btn.scss";

interface ASBProps {
    onSectionSelected?: (idx: number, crs_sel: CourseSection) => void;
    alternateSections?: CourseSection[]
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
    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        // Set the state directly. Use props if necessary.
        this.state = {
            menuOpen: false,
            btnHover: false
        }
    }
    render() {
        let btnStyle = (this.state.btnHover || this.state.menuOpen) ? "sched-sel-alt-crs-btn-hover" : "sched-sel-alt-crs-btn";
        let menuContent = (
            ['a', 'b', 'c'].map((val, idx) => {
                return (<div key={idx}><a className="sched-sel-alt-crs-menu-item"
                    onClick={(evt) => { console.log('abc'); console.log(val); }}

                >{val}</a></div>);
            })
        );

        return (
            <Popover placement="right" title={"Select alternate section"} content={menuContent} trigger="click"
                autoAdjustOverflow={false}
                onVisibleChange={(visible) => { this.setState({ menuOpen: visible }); }}
            >
                <div className="sched-sel-alt-crs-div"
                onMouseOver={(evt) => { this.setState({ btnHover: true }); }}
                onMouseLeave={(evt) => { this.setState({ btnHover: false }); }}
                >
                    <Button type="dashed" shape="circle" icon="ellipsis"
                        className={btnStyle}
                    />
                </div>
            </Popover>
        );
    }
}
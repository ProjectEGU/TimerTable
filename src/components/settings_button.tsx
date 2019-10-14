import * as React from "react";
import { Row, Col, Icon, Button, Popover, Checkbox } from 'antd';
import { CourseSection } from "./course";
import { Campus } from "./crsdb";
import "./../assets/scss/alt_sect_btn.scss";

export interface SettingsInfo {
    selectedCampus: Set<Campus>
}

interface SettingsProps {
    onSettingsModified?: (newSettings: SettingsInfo) => void;
    currentSettings: SettingsInfo // The current unmodified settings which will be reflected in the menu once its hidden or if 'cancelled' is clicked.
}

interface SettingsState {
    // data model vars
    curCampusSelection: Set<Campus>;

    // display vars
    errorMsg: string,
    settingsValid: boolean,

    showMenu: boolean
}


export class SettingsButton extends React.Component<SettingsProps, SettingsState> {
    static defaultProps = {
    }

    constructor(props: SettingsProps) {
        // Required step: always call the parent class' constructor
        super(props);

        // Set the state directly. Use props if necessary.
        this.state = {
            curCampusSelection: props.currentSettings.selectedCampus,

            errorMsg: null,
            settingsValid: true,
            showMenu: false
        }

        this.settingsUpdated = this.settingsUpdated.bind(this);
        this.settingsValidation = this.settingsValidation.bind(this);
        this.campusSelectionHandler = this.campusSelectionHandler.bind(this);
    }

    menuVisibleChanged(isVisible) {
        if (this.state.settingsValid) {
            this.setState({
                showMenu: isVisible
            });
            // if the menu is being hidden (by loss of focus), then treat the changes as not taking effect
            // a menu-close triggered by the "OK" or "Cancel" button will not fire another menuVisibleChanged event.
            if (!isVisible)
                this.settingsRevert();
        } else {
            // if settings are invalid, then prevent menu from closing.
            // setting visibility like this should not trigger an onVisibleChanged event
            this.setState({
                showMenu: true
            });
        }
    }

    settingsValidation() {
        // settings validation: call this function each time settings has changed
        if (this.state.curCampusSelection.size == 0) {
            this.setState({ errorMsg: "Select at least one campus.", settingsValid: false });

        } else {
            this.setState({ errorMsg: null, settingsValid: true });
        }
    }

    settingsRevert() {
        // revert the settings when 'cancel' is clicked, or when menu is prematurely hidden

        this.setState({
            curCampusSelection: this.props.currentSettings.selectedCampus
        });
    }

    settingsUpdated() {
        // Settings updated: report new SettingInfo to parent if it's valid
        if (!this.state.settingsValid) {
            return;
        }

        // settings report
        if (this.props.onSettingsModified != undefined) {
            let newSettings: SettingsInfo = {
                selectedCampus: new Set<Campus>(this.state.curCampusSelection)
            }

            this.props.onSettingsModified(newSettings);
        }

    }

    campusSelectionHandler(campus: Campus, selected: boolean) {
        // update campus selections without modifying previous state

        let newCampusSelection = new Set(this.state.curCampusSelection);
        if (selected) {
            newCampusSelection.add(campus);
        } else {
            newCampusSelection.delete(campus);
        }
        this.setState({ curCampusSelection: newCampusSelection }, () => {
            this.settingsValidation(); // perform settingsValidation after the update to this.state has taken effect
        });

    }

    render() {
        return (
            <Popover placement="bottom" title={"Settings"} style={{ padding: "0px" }}
                trigger="click"
                autoAdjustOverflow={false}
                onVisibleChange={(isVisible) => { this.menuVisibleChanged(isVisible) }}
                visible={this.state.showMenu}
                content={
                    <div>
                        <div> Enable search in these campuses:</div>
                        <div>
                            <Checkbox onChange={e => {
                                this.campusSelectionHandler(Campus.UTM, e.target.checked);
                            }}
                                checked={this.state.curCampusSelection.has(Campus.UTM)}
                            // changing visibility via property will not fire off another onChange event.
                            >UTM</Checkbox>
                        </div>

                        <div>
                            <Checkbox onChange={e => {
                                this.campusSelectionHandler(Campus.STG_ARTSCI, e.target.checked);
                            }}
                                checked={this.state.curCampusSelection.has(Campus.STG_ARTSCI)}
                            >St. George</Checkbox>
                        </div>

                        <div>{this.state.settingsValid ? " " : this.state.errorMsg}</div>

                        <div style={{ textAlign: "right" }}>
                            <Button
                                style={{ marginTop: "5px", marginRight: "5px" }}
                                size="small"
                                type="default"
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    this.setState({ showMenu: false });
                                    this.settingsRevert();
                                }}
                            >Cancel</Button>
                            <Button
                                style={{ marginTop: "5px" }}
                                size="small"
                                type="default"
                                disabled={!this.state.settingsValid}
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    this.setState({ showMenu: false });
                                    this.settingsUpdated();
                                }}
                            >OK</Button>
                        </div>
                    </div>
                }
            >
                <Button
                    size="small"
                    type="default"
                    onClick={(evt) => {
                        evt.stopPropagation();
                    }}
                >
                    <Icon type="setting" />
                    Settings
                            </Button>
            </Popover>
        );
    }
}

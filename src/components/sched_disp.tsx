import * as React from "react";
import { Course, CourseSection, CourseSelection, Timeslot, wkday_idx } from "./course";
import "./../assets/scss/sched_disp.scss";
import { AssertionError } from "assert";
import { crsdb } from "./crsdb";
import { Button, Popover, Select } from 'antd';
import { AlternateSectionButton } from "./alt_sect_btn";
import { view } from "react-easy-state";
import { CloseSquareFilled, LockFilled } from "@ant-design/icons";

interface SchedDispProps {
    show_term: string,
    crs_selections_groups: CourseSelection[][],
    crs_selections_indices: number[],

    crs_solo_sections_map?: Map<string, Set<string>>, // A map of course unique id to a set of solo section ids.
    crs_exclude_sections_map?: Map<string, Set<string>>, // A map of course unique id to a set of exclude section ids.


    // A callback function when solo sections / exclude sections are added or removed. If this method is not null, then crs_solo_sections and crs_exclude_sections must also not be null.
    onCrsFilterSectionsChanged?: (targetCrsObj: Course, new_solo_sections: Map<string, Set<string>>, new_exclude_sections: Map<string, Set<string>>) => void,

    loading?: boolean,// show when crs data is being loaded
    next_selection?: CourseSelection, // shows a course pending to be added (such as during mouseover of a button for selection)
    startTime?: number[], // the start of the displayed time. if null, then use the earliest course start. specify as [hour, mins] in 24h format
    endTime?: number[], // the end of the displayed time. if null, then use the latest course end. specify as [hour, mins] in 24h format
    stepMins?: number,
    stepsPerLine?: number,
    labelsPerLine?: number,
    show_double?: boolean,
    showLockExcludeBtns: boolean,

    onSelectionIndicesChanged?: (new_indices: number[]) => void,
}

interface SchedDispState {
    current_selection?: CourseSelection
}

interface crs_tslot // represents a single timeslot of a course selection
{
    crs_grp_idx: number,
    crs_sel: CourseSelection,
    tslot: Timeslot,
    n_exclusions: number,
    placed?: boolean,
    selected: boolean,
    equiv_alternate_sections: CourseSelection[]
}

/**
 * TODO: Display different colors for course sections with waitlist or already filled.
 */
class SchedDisp extends React.Component<SchedDispProps, SchedDispState> {

    static defaultProps = {
        startTime: [8, 0],
        endTime: [21, 30],
        stepMins: 30, // the number of minutes increase per cell
        stepsPerLine: 2,// how many steps before drawing a line
        labelsPerLine: 2, // how many steps before showing a label
        show_double: false, // by default, only show a single semester
        showLockExcludeBtns: true
    }
    constructor(props) {
        // Required step: always call the parent class' constructor
        super(props);

        // Set the state directly. Use props if necessary.
        this.state = {
            current_selection: null
        }

        this.sectionChangedHandler = this.sectionChangedHandler.bind(this);
    }
    componentDidMount() {

    }

    componentDidUpdate() {
        console.assert(['F', 'Y', 'S'].indexOf(this.props.show_term) != -1);
        //console.assert(this.props.crs_selections_groups.length == this.props.crs_selections_indices.length)
    }

    shouldComponentUpdate(nextProps: SchedDispProps, nextState: SchedDispState) {
        // TODO: check if prev crs_list is the same as new crs_list. Can involve overriding equals in respective methods.
        return true;
    }

    sectionChangedHandler(grp_idx, new_selected_section) {

        if (this.props.onSelectionIndicesChanged != undefined) {
            let new_indices = this.props.crs_selections_indices.slice();
            new_indices[grp_idx] = this.props.crs_selections_groups[grp_idx].indexOf(new_selected_section);

            this.props.onSelectionIndicesChanged(new_indices);
        }
    }

    calc_tt_nodes(targetTerm) {
        // Algoritm Overview:
        /** For courses with conflict:
         * Overview: Create additional <td> within same day for max number of simultaneous conflicts
         * Outline:
         * Loop until no more unplaced conflict section:
         *      Place the conflict section into its own <td>
         *      For the next conflict section, see if it can be placed into any previous <td>
         *      If not, just create a new <td> and place it there
         * The number of <td> created will be added to the current day.
         * Non conflicting courses will have colspan = (number of <td> created).
         * 
         * */

        /** To schedule all times:
         * Overview: Create the table row-by-row and do not generate any <td> if slot is occupied due to previous cell rowspan
         * 
         * Each element of tt_days is of indexing: item[weekday][exclusion_group][item_idx]
         */
        let tt_days = { "MO": [[]], "TU": [[]], "WE": [[]], "TH": [[]], "FR": [[]] };

        // Organize crs_list into days
        let debugArr = []

        this.props.crs_selections_groups.forEach((crs_grp, crs_grp_idx) => {
            let crs_sel_idx = this.props.crs_selections_indices == undefined ? 0 : this.props.crs_selections_indices[crs_grp_idx];

            let crs_sel: CourseSelection = crs_grp[crs_sel_idx];

            if (crs_sel.crs.term != 'Y' && crs_sel.crs.term != targetTerm)
                return;
            crs_sel.sec.timeslots.forEach((tslot) => {
                debugArr.push(`${tslot.weekday}: ${crs_sel.crs.course_code} ${SchedDisp.format_timelist(tslot.start_time)} - ${SchedDisp.format_timelist(tslot.end_time)}`);
                tt_days[tslot.weekday][0].push(
                    {
                        crs_grp_idx: crs_grp_idx,
                        crs_sel: crs_sel,
                        tslot: tslot,
                        n_exclusions: 0,
                        selected: crs_sel == this.state.current_selection,
                        equiv_alternate_sections: crs_grp.filter((val, idx) => idx != crs_sel_idx)
                    } as crs_tslot
                );
            }
            );
        });
        debugArr.sort();
        // debugArr.forEach(x => console.log(x));

        // Sort each timeslot list in tt_days by end time
        Object.keys(wkday_idx).forEach((wkday, wkidx) => {
            let this_excl_grps: crs_tslot[][] = tt_days[wkday];
            this_excl_grps.forEach((excl_grp: crs_tslot[], excl_idx) => {
                excl_grp.sort((a: crs_tslot, b: crs_tslot): number => {
                    let aEnd = a.tslot.end_time[0] * 60 + a.tslot.end_time[1];
                    let bEnd = b.tslot.end_time[0] * 60 + b.tslot.end_time[1];
                    return bEnd - aEnd;
                });
            });
        });

        // Calculate tt_days conflicts
        let remainingRowspan = [[0], [0], [0], [0], [0]];
        Object.keys(wkday_idx).forEach((wkday, wkidx) => {
            let crs_remain: crs_tslot[]; // remaining conflict courses
            let cur_excl_idx = 0;
            let excl_grps: crs_tslot[][] = tt_days[wkday];

            do {
                crs_remain = [];
                // starting at current exclusion group, iterate through for conflicts, and move all conflicting sections to crs_remain
                let cur_excl_grp = excl_grps[cur_excl_idx];
                for (let idxA = 0; idxA < cur_excl_grp.length; idxA++) {
                    for (let idxB = cur_excl_grp.length - 1; idxB > idxA; idxB--) {
                        // check if current selection conflicts. if so, then move it to a new excl group.
                        if (crsdb.is_timeslot_conflict(cur_excl_grp[idxA].tslot, cur_excl_grp[idxB].tslot)) {
                            cur_excl_grp[idxA].n_exclusions += 1;
                            cur_excl_grp[idxB].n_exclusions += 1;
                            // ^ above does not work as intended. n_exclusions may report more conflicts than actual.

                            // add conflicting timeslot to crs_remain
                            crs_remain.push(cur_excl_grp[idxB]);
                            // remove conflicting timeslot from current exclusion group
                            cur_excl_grp.splice(idxB, 1);
                        }
                    }
                }

                // if there are remaining conflict courses, allocate new exclusion group
                if (crs_remain.length > 0) {
                    // add a new column counter for remaining rowspans
                    remainingRowspan[wkidx].push(0);
                    // set crs_remain as the next group. a new crs_remain array will be allocated on next iteration.
                    excl_grps.push(crs_remain);
                }

                if (++cur_excl_idx > 5) {
                    console.warn('max number of exclusion groups exceeded');
                    break; // limit the number of exclusion groups for sanity
                }
            } while (crs_remain.length > 0);
        });

        let colWidthsPercent = remainingRowspan.map(x => 20 / x.length);
        const wkday_str = [" ", "Mon", "Tue", "Wed", "Thu", "Fri"];
        let colGroups = <colgroup>{
            wkday_str.map((x, i) =>
                <col
                    key={`col-${x}`}
                    span={i == 0 ? 1 : remainingRowspan[i - 1].length}
                    className={i == 0 ? "sched-timecol" : "sched-weekcol"}
                    style={i == 0 ? {} : { width: `${colWidthsPercent[i - 1]}%` }}
                />
            )
        }</colgroup>
        let innerHead = wkday_str.map((x, i) =>
            <th
                key={`h-${x}`}
                colSpan={i == 0 ? 1 : remainingRowspan[i - 1].length}
            >{x}
            </th>
        );

        let innerRows = [];

        // convert times to 'mins since start of day'
        let curTime = this.props.startTime[0] * 60 + this.props.startTime[1];
        let endTime = this.props.endTime[0] * 60 + this.props.endTime[1];

        let stepCount = 0;

        while (curTime < endTime) {
            let thisRow = []

            thisRow.push(
                <td key={`d-${curTime}`}>
                    {
                        stepCount % this.props.stepsPerLine == 0 ? SchedDisp.format_mins(curTime) : '\u00A0'
                    }
                </td>);

            Object.keys(wkday_idx).forEach((wkday, wkidx) => {
                let this_excl_grps: crs_tslot[][] = tt_days[wkday];
                this_excl_grps.forEach((excl_grp, excl_idx) => {
                    let skipCell = false;
                    if (remainingRowspan[wkidx][excl_idx] > 1) {
                        remainingRowspan[wkidx][excl_idx]--;
                        skipCell = true;
                    }
                    if (skipCell) return;

                    let n_excl_grps = remainingRowspan[wkidx].length;

                    let place_ct: crs_tslot = null; // a (course-section)-timeslot object
                    let place_rowspan = null;
                    let place_colspan = null;

                    // attempt to find something to push for this weekday-exclusion division
                    excl_grp.forEach((ct: crs_tslot) => {
                        if (ct.placed) {
                            return;
                        }
                        // attempt to calculate the rowspan
                        // recomputing the starting time and ending time each time
                        let start_time = ct.tslot.start_time[0] * 60 + ct.tslot.start_time[1];
                        let end_time = ct.tslot.end_time[0] * 60 + ct.tslot.end_time[1];
                        if (start_time % this.props.stepMins != 0 || end_time % this.props.stepMins != 0) {
                            console.warn("timetable will display inaccuracy because course timeslot does not align with grid: " + ct.crs_sel.crs.course_code);
                            // todo - display actual warning (by coloring the cell)
                        }
                        if (curTime >= start_time) {
                            place_rowspan = Math.ceil((end_time - start_time) / this.props.stepMins);

                            // if this timeslot has no conflict with any other timeslots within the same day, make it take up the whole span
                            place_colspan = (excl_idx == 0 && ct.n_exclusions == 0) ? n_excl_grps : 1;
                            // console.log(wkday + " " + ct.crs_sel.crs.course_code + " " + n_excl_grps + " " + ct.n_exclusions);
                            // console.log(wkday + " " + ct.crs_sel.crs.course_code + " " + curTime + " " + start_time);
                            place_ct = ct;
                        }
                    });
                    let cell_lbd = excl_idx == 0 ? " sched-lbd-cell" : "";
                    let cell_rbd = excl_idx == n_excl_grps ? "sched-rbd-cell" : "";
                    //TODO: add hover effect on blank cells again 
                    if (place_ct == null || place_ct.placed) {
                        thisRow.push(<td key={`${wkday}-${excl_idx}-${curTime}`}
                            className={`sched-emptycell${cell_lbd}${cell_rbd}`}
                            style={{
                                padding: "0"
                            }}
                        >
                            &nbsp;
                            </td>
                        );
                    } else {

                        let lockExcludeBtns = (<ul style={{
                            listStyleType: "none",
                            overflow: "hidden",
                            margin: 0,
                            padding: 0,
                            position: "absolute",
                            top: "2px",
                            right: "2px",
                            left: "2px"
                        }}>
                            <li style={{ float: "right", cursor: "pointer" }}
                                onClick={() => {
                                    if (this.props.onCrsFilterSectionsChanged != null) {

                                        // Do not allow excluding a section that is in the whitelist
                                        if (this.props.crs_solo_sections_map.get(place_ct.crs_sel.crs.unique_id).has(place_ct.crs_sel.sec.section_id)) return;
                                        // Cross button clicked
                                        let new_exclude_sections_map = new Map<string, Set<string>>(this.props.crs_exclude_sections_map);
                                        let new_exclude_set = new Set<string>(new_exclude_sections_map.get(place_ct.crs_sel.crs.unique_id));

                                        // assert that the section clicked is not a part of blacklisted sections
                                        console.assert(!new_exclude_set.has(place_ct.crs_sel.sec.section_id));
                                        // add all the equivalent sections to the blacklist
                                        place_ct.equiv_alternate_sections.forEach(sel => new_exclude_set.add(sel.sec.section_id));
                                        new_exclude_set.add(place_ct.crs_sel.sec.section_id);
                                        new_exclude_sections_map.set(place_ct.crs_sel.crs.unique_id, new_exclude_set);

                                        this.props.onCrsFilterSectionsChanged(
                                            place_ct.crs_sel.crs,
                                            this.props.crs_solo_sections_map,
                                            new_exclude_sections_map);
                                    }
                                }}
                            >
                                <CloseSquareFilled className={
                                    this.props.crs_exclude_sections_map != null
                                        ? (this.props.crs_exclude_sections_map.get(place_ct.crs_sel.crs.unique_id).has(place_ct.crs_sel.sec.section_id) ? "adjButtonActive" :
                                            (this.props.crs_solo_sections_map.get(place_ct.crs_sel.crs.unique_id).has(place_ct.crs_sel.sec.section_id) ? "adjButtonLocked" : "adjButton"))
                                        : "adjButton"
                                } type="close-square" theme="filled"
                                    style={{ display: "block", padding: "5px 5px 3px 5px", margin: "2px 0px 5px 0px" }} />
                            </li>

                            <li style={{ float: "right", cursor: "pointer" }}
                                onClick={() => {
                                    if (this.props.onCrsFilterSectionsChanged != null) {
                                        // Lock button clicked
                                        let new_solo_sections_map = new Map<string, Set<string>>(this.props.crs_solo_sections_map);
                                        let new_solo_set = new Set<string>(new_solo_sections_map.get(place_ct.crs_sel.crs.unique_id));

                                        // check if the section clicked is a whitelisted section: if it is, then remove from whitelist.
                                        if (new_solo_set.has(place_ct.crs_sel.sec.section_id)) {
                                            // remove this section and all equivalent sections from whitelist
                                            place_ct.equiv_alternate_sections.forEach(sel => new_solo_set.delete(sel.sec.section_id));
                                            new_solo_set.delete(place_ct.crs_sel.sec.section_id);
                                        } else {
                                            // add all equivalent sections to the whitelist too
                                            place_ct.equiv_alternate_sections.forEach(sel => new_solo_set.add(sel.sec.section_id));
                                            new_solo_set.add(place_ct.crs_sel.sec.section_id);
                                        }

                                        new_solo_sections_map.set(place_ct.crs_sel.crs.unique_id, new_solo_set);
                                        this.props.onCrsFilterSectionsChanged(
                                            place_ct.crs_sel.crs,
                                            new_solo_sections_map,
                                            this.props.crs_exclude_sections_map);
                                    }
                                }}
                            >
                                <LockFilled className={
                                    this.props.crs_solo_sections_map != null
                                        ? (this.props.crs_solo_sections_map.get(place_ct.crs_sel.crs.unique_id).has(place_ct.crs_sel.sec.section_id) ? "adjButtonActive" : "adjButton")
                                        : "adjButton"
                                }  
                                    style={
                                        {
                                            display: "block", padding: "5px 5px 3px 5px", margin: "2px 0px 5px 0px",
                                        }
                                    } />
                            </li>

                        </ul>
                        );

                        thisRow.push(
                            <td key={`${wkday}-${excl_idx}-${curTime}`}
                                rowSpan={place_rowspan}
                                colSpan={place_colspan}
                                onMouseOver={(evt) => this.setState({ current_selection: place_ct.crs_sel })}
                                onMouseLeave={(evt) => this.setState({ current_selection: null })}
                                style={{
                                    padding: "0"
                                }}
                            >
                                <div
                                    title={
                                        `${place_ct.crs_sel.crs.course_code.substr(0, 6)} ${place_ct.crs_sel.sec.section_id}
${SchedDisp.format_timelist(place_ct.tslot.start_time)}-${SchedDisp.format_timelist(place_ct.tslot.end_time)}
${place_ct.tslot.room_name_1}
${place_ct.crs_sel.sec.instructors}`
                                    }
                                    className={(place_ct.n_exclusions == 0 ? `sched-crscell` : `sched-crscell-conflict`) + (place_ct.selected ? ` sched-crscell-hover` : ``)}
                                >

                                    {place_ct.crs_sel.crs.course_code.substr(0, 6)} {place_ct.crs_sel.sec.section_id}
                                    <br />
                                    {place_ct.crs_sel.crs.term == 'F' ? place_ct.tslot.room_name_1 : place_ct.tslot.room_name_2}
                                    <br />
                                    {SchedDisp.format_timelist(place_ct.tslot.start_time)}-{SchedDisp.format_timelist(place_ct.tslot.end_time)}
                                    <br />
                                    {place_ct.crs_sel.sec.instructors}
                                    {
                                        place_ct.equiv_alternate_sections.length == 0 ? null :
                                            <AlternateSectionButton
                                                alternateSections={place_ct.equiv_alternate_sections}
                                                curTimeslot={place_ct.tslot}
                                                onSectionSelected={(new_sel_idx, new_sel_section) => this.sectionChangedHandler(place_ct.crs_grp_idx, new_sel_section)}
                                            />
                                    }

                                    {this.props.showLockExcludeBtns ? lockExcludeBtns : null}
                                </div>
                            </td >
                        );
                        place_ct.placed = true;
                        remainingRowspan[wkidx][excl_idx] = place_rowspan;
                        // ensure all neighboring colspans are also hidden
                        // if this cell has been marked to take up the rest of the current weekday,
                        // then it's guaranteed that there is no other cells within the same weekday that will conflict.
                        for (let i = 1; i < place_colspan; i++) {
                            // ensure the other rows have no pending rowskips
                            console.assert(remainingRowspan[wkidx][excl_idx + i] <= 1);
                            // need to add 1 to account for the next-column iteration on the same row
                            remainingRowspan[wkidx][excl_idx + i] = place_rowspan + 1;
                        }
                    }
                });
            });
            //assert all crs_tslot placed
            let rowClass = "";
            if (stepCount % this.props.stepsPerLine == 0) {
                // line
                rowClass = "sched-rowline";
            } else {
                // no line
                rowClass = "sched-rownone";
            }

            innerRows.push(<tr className={rowClass} key={`r-${curTime}`}>{thisRow}</tr>)
            curTime += this.props.stepMins;

            stepCount++;
            if (stepCount >= 100)
                throw "exceeded max number of rows when drawing time table";
        }


        return (
            <table>
                {colGroups}
                <thead>
                    <tr>
                        {innerHead}
                    </tr>
                </thead>
                <tbody>
                    {innerRows}
                </tbody>
            </table>
        );
    }
    format_term(targetTerm: string): string {
        if (targetTerm == 'F') return "Fall";
        else if (targetTerm == 'S') return "Winter";
        else throw "Invalid Term: " + targetTerm;
    }

    /**
     * Format a list of hour, minutes in 24h format.
     * @param times 
     */
    static format_timelist(times: number[]) {
        return SchedDisp.format_mins(times[0] * 60 + times[1]);
    }

    // convert time from 'mins since start of day' to preferred format
    static format_mins(mins) {
        // return `${(Math.floor(mins / 60)).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
        let h = Math.floor(mins / 60);
        let m = mins % 60;
        console.assert(0 <= h && h <= 24);
        console.assert(0 <= m && m < 60);
        let pm = h >= 12;
        if (h == 0) h = 12;
        if (h > 12) h -= 12;

        return `${(h.toString().padStart(2, '0'))}:${m.toString().padStart(2, '0')} ${pm ? "PM" : "AM"}`;
    }

    render() {
        if (this.props.show_double) {
            return (
                <div>
                    <div style={{ float: "left", width: "50%" }}>{this.calc_tt_nodes('F')}</div>
                    <div style={{ float: "right", width: "50%" }}>{this.calc_tt_nodes('S')}</div>
                </div>
            );
        } else {
            return this.calc_tt_nodes(this.props.show_term);
        }
    }
}

export default view(SchedDisp);
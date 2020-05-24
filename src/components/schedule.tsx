import { Course, CourseSelection, CourseSection, Timeslot, wkday_idx } from "./course";
import { DLXMatrix, Solution as DLXSolution, DLXEvaluator, DLXIterationAction } from "./dlxmatrix"
import { string } from "prop-types";
import { AssertionError } from "assert";
import { crsdb } from "./crsdb";
import { S_IFCHR } from "constants";
import * as BronKerbosch from '@seregpie/bron-kerbosch';

interface crs_choice {
    crs: Course,
    secs: CourseSection[]
}

export enum TimePreference {
    NoPreference,
    Morning,
    Noon,
    Evening
}

export enum DayLengthPreference {
    Long,
    Short,
    NoPreference
}

export interface SearchPrefs {
    timePreference: TimePreference, // map of weekday -> time in [HH, MM] 24-hour format, or null if no preference.
    dayLengthPreference: DayLengthPreference, // map of weekday -> day length preference
    prioritizeFreeDays: boolean,
    // time preference: morning = 9am, afternoon = 12:30pm, evening = 9pm
    // prioritize free days: yes / no
    // time between courses: more, less - this is similar to day length
}
export interface SchedSearchResult {
    /**
     * The solutionSet is of this format:
     * solutionSet[solutionIndex] is an array of SectionGroups.
    * Example of sectionGroup:
    * For example:
    * [[SectionA], [SectionB, sectionC]]
    * SectionA is the only option for that section
    * SectionB, SectionC are alternatives for the same section.
    * */
    solutionSet: DLXSolution<CourseSelection[]>[],
    solutionLimitReached: boolean
}

export class crs_arrange {
    constructor(params) {

    }


    public static is_equiv_section(secA: CourseSelection, secB: CourseSelection): boolean {
        /**
         * Two sections are equivalent if:
         * 1. They are from the same course
         * 2. They are the same type (lecture / tutorial / practical)
         * 3. The meeting times are the exact same. 
         * 
         * Equivalent sections are allowed to have different rooms.
         */

        if (secA.crs.unique_id == secB.crs.unique_id && secA.sec.section_id.substr(0, 3) == secB.sec.section_id.substr(0, 3)) {
            let tslotsA = secA.sec.timeslots.map(tslot => `${tslot.weekday} ${tslot.start_time.join(":")} ${tslot.end_time.join(":")}`).sort().join("");
            let tslotsB = secB.sec.timeslots.map(tslot => `${tslot.weekday} ${tslot.start_time.join(":")} ${tslot.end_time.join(":")}`).sort().join("");

            return tslotsA == tslotsB;
        } else {
            return false;
        }
    }

    public static get_conflict_map(
        crs_list: Course[],
        whitelisted_sections: Map<string, Set<string>>,
        blacklisted_sections: Map<string, Set<string>>): Map<string, number> {
        // TEMP DISABLE DUE TO PERFORMANCE
        return new Map<string, number>();
    }

    public static find_sched(crs_list: CourseSelection[], searchprefs: SearchPrefs, solution_limit: number, top_n?: number, new_method?: boolean): SchedSearchResult {
        let crsSortValueMap = new Map();

        let getHeuristicRanking = (crsSel: CourseSelection): string => {
            if (crsSel.sec.timeslots.length === 0) return '0';
            if (searchprefs.dayLengthPreference === DayLengthPreference.Long)
                //return `${crsSel.sec.timeslots.map(tx => 
                //    Math.min(20*60 - tx.end_time[0] * 60 + tx.end_time[1], tx.end_time[0] * 60 + tx.end_time[1] - 10*60)).reduce((x, y) => x + y)}`
                return '0';
            else if (searchprefs.timePreference === TimePreference.Morning || searchprefs.timePreference === TimePreference.Noon)
                return `${crsSel.sec.timeslots.map(tx => tx.end_time[0] * 60 + tx.end_time[1]).reduce((x, y) => x + y)}`;
            else if (searchprefs.timePreference === TimePreference.Evening)
                return `${crsSel.sec.timeslots.map(tx => 24 * 60 - tx.end_time[0] * 60 + tx.end_time[1]).reduce((x, y) => x + y)}`;
            else
                return '0';
        }

        crs_list.forEach((crsSel: CourseSelection) => {
            crsSortValueMap.set(
                crsSel,
                String(['Y', 'F', 'S'].indexOf(crsSel.crs.term))
                + getHeuristicRanking(crsSel).padStart(6, '0')
                // + crsSel.crs.course_code
                // + String(['L', 'T', 'P'].indexOf(crsSel.sec.section_id[0]))
                // + crsSel.sec.section_id
            );
        });

        // For courses that have no timeslots or are closed, we skip feeding them into the algorithm.
        // then, we order courses by yearly, fall and winter, then suborder by course code
        crs_list = crs_list.filter(crs_sel => crsdb.is_section_open(crs_sel.sec) && crs_sel.sec.timeslots.length > 0)
            .sort((a, b) => crsSortValueMap.get(a).localeCompare(crsSortValueMap.get(b)));

        if (crs_list.length == 0) return { solutionSet: [], solutionLimitReached: false };

        // Assign a column number to each unique_id + section_types pair. 
        let id_sec_map = new Map<string, Map<string, number>>();
        let unfulfilled_sectypes = new Map<string, Set<string>>(); // check section fulfillment
        let column_id = 0;

        crs_list.forEach((crs_sel) => {
            let crs_unique_id = crs_sel.crs.unique_id;
            let sec_type = crs_sel.sec.section_id.substr(0, 3);

            if (!id_sec_map.has(crs_unique_id)) {
                id_sec_map.set(crs_unique_id, new Map<string, number>());
                unfulfilled_sectypes.set(crs_unique_id, new Set<string>(Object.keys(crs_sel.crs.course_sections)));
            }

            if (!id_sec_map.get(crs_unique_id).has(sec_type)) {
                // allocate a new column id for the lecture-sectiontype
                id_sec_map.get(crs_unique_id).set(sec_type, column_id);
                column_id += 1;
            }

            if (unfulfilled_sectypes.get(crs_unique_id).has(sec_type))
                unfulfilled_sectypes.get(crs_unique_id).delete(sec_type);
        });

        // Check if every section-type of every course is fulfilled
        unfulfilled_sectypes.forEach((sectypes_remain, unique_id) => {
            if (sectypes_remain.size != 0) {
                let remain_sectypes = [];
                sectypes_remain.forEach((v) => remain_sectypes.push(v));

                console.warn(`This course: ${unique_id} has some unchosen section types: ${remain_sectypes.join(', ')}`);
                return { solutionSet: null, solutionLimitReached: false };
            }
        });

        // Create groups of sections, grouped by lecture-sectype constraint
        let section_groups: CourseSelection[][] = [];
        crs_list.forEach((crs_sel) => {
            let crs_unique_id = crs_sel.crs.unique_id;
            let sec_type = crs_sel.sec.section_id.substr(0, 3);
            let sec_grp_idx = id_sec_map.get(crs_unique_id).get(sec_type);

            if (section_groups[sec_grp_idx] == undefined) {
                section_groups[sec_grp_idx] = [];
            }

            section_groups[sec_grp_idx].push(crs_sel);
        });

        // Grouped sections based on if they are equivalent
        // Output format example: [[SecA], [SecB, SecC]]
        const grouped_equiv_sections: CourseSelection[][] = [];
        section_groups.forEach((constraint_group) => {
            let cur_equiv_grps = [];

            for (let idxA = 0; idxA < constraint_group.length; idxA++) {
                if (constraint_group[idxA] == null)
                    continue;
                let cur_grp = [constraint_group[idxA]];

                for (let idxB = idxA + 1; idxB < constraint_group.length; idxB++) {
                    if (constraint_group[idxB] == null)
                        continue;
                    if (crs_arrange.is_equiv_section(constraint_group[idxA], constraint_group[idxB])) {
                        cur_grp.push(constraint_group[idxB]);
                        constraint_group[idxB] = null;
                    }
                }
                // sort the group by section ID
                cur_grp.sort((a: CourseSelection, b: CourseSelection) => a.sec.section_id < b.sec.section_id ? -1 : 1);
                cur_equiv_grps.push(cur_grp);
                constraint_group[idxA] = null;
            }
            grouped_equiv_sections.push(...cur_equiv_grps);
        });

        // sort rows by term, section type, then alphabetic order
        grouped_equiv_sections.sort((grpA, grpB) => {
            return crsSortValueMap.get(grpA[0]).localeCompare(crsSortValueMap.get(grpB[0]));
        });

        // Construct DLX Matrix
        let n_primary_cols = column_id;
        let n_secondary_cols = 0;
        let n_rows = grouped_equiv_sections.length;
        let data = []; // 0's can be left as undefined

        // debugging: store header info
        let colInfo = [];
        colInfo.length = n_primary_cols;

        // Calculate primary columns: required sections
        grouped_equiv_sections.forEach((crs_grp) => {
            let crs_sel = crs_grp[0];

            let unique_id = crs_sel.crs.unique_id;
            let sec_type = crs_sel.sec.section_id.substr(0, 3);

            let next_row = [];
            next_row[id_sec_map.get(unique_id).get(sec_type)] = 1;

            // add term info to column headers for the YFS mod
            colInfo[id_sec_map.get(unique_id).get(sec_type)] = crs_sel.crs.term; // `${unique_id.substr(-9, 6)} ${sec_type.substr(0, 3)}`;
            data.push(next_row);
        });

        // Calculate secondary columns: timeslot exclusions
        let edges = [];

        for (let idx1 = 0; idx1 < grouped_equiv_sections.length; idx1++) {
            for (let idx2 = idx1 + 1; idx2 < grouped_equiv_sections.length; idx2++) {
                // pick the first section from each group of equivalence
                let crsSelA = grouped_equiv_sections[idx1][0];
                let crsSelB = grouped_equiv_sections[idx2][0];

                // If two courses are in different sections, then don't check conflicts.
                // Assume that yearly courses will happen at the same times on both fall and winter semesters.
                if (crsSelA.crs.term != 'Y' && crsSelB.crs.term != 'Y') {
                    if (crsSelA.crs.term != crsSelB.crs.term) {
                        continue;
                    }
                }

                let ts1: Timeslot[] = crsSelA.sec.timeslots;
                let ts2: Timeslot[] = crsSelB.sec.timeslots;

                if (crsdb.is_timeslots_conflict(ts1, ts2)) {
                    edges.push([idx1, idx2])
                    // data[idx1][n_primary_cols + n_exclusions] = 1;
                    // data[idx2][n_primary_cols + n_exclusions] = 1;
                }
            }
        }

        // Clique finding
        console.time("find cliques");
        let cliques = BronKerbosch(edges) as number[][]; // cliques are fully connected components of a graph
        console.timeEnd("find cliques");
        let largeCliquesCount = 0;
        let cliqueColsSaved = 0;
        cliques.forEach((cliq, offset) => {
            cliq.forEach((rowIdx) => {
                data[rowIdx][n_primary_cols + offset] = 1;
            });
            if (cliq.length >= 1) {
                largeCliquesCount += 1;
                cliqueColsSaved += (cliq.length * (cliq.length - 1) / 2) - 1;
            }
        });
        n_secondary_cols = cliques.length;
        let n_cols = n_primary_cols + n_secondary_cols;
        console.log("nontrivial clique count: " + largeCliquesCount);
        console.log("secondary columns saved: " + cliqueColsSaved);

        console.log(`Calculation begins. Matrix Size (row, col): ${n_rows}, ${n_cols} ; n_primary_cols: ${n_primary_cols}; n_secondary_cols: ${n_secondary_cols};`)

        // Solve the matrix
        let mat: DLXMatrix<CourseSelection[]>
            = DLXMatrix.Initialize<CourseSelection[]>(n_rows, n_cols, grouped_equiv_sections, data, n_primary_cols, colInfo);

        mat.SetSolutionLimit(solution_limit);

        let [fEval, sEval] = crs_arrange.create_evaluators(grouped_equiv_sections, searchprefs);

        let YFSDict = new WeakMap<CourseSelection[], string>();
        grouped_equiv_sections.forEach((crs_grp) => {
            let crs_sel = crs_grp[0];
            YFSDict.set(crs_grp, crs_sel.crs.term);
        });
        let allEval = {
            curState: { rCount: 0, minSco: Infinity, maxSco: -Infinity },
            onAddRow: (state, row, coveredRows) => {
                let curYFS = YFSDict.get(row);
                if (curYFS === 'Y' || curYFS === 'F') fEval.onAddRow(fEval.curState, row, coveredRows);
                if (curYFS === 'Y' || curYFS === 'S') sEval.onAddRow(sEval.curState, row, coveredRows);
            },
            onRemoveRow: (state, row, coveredRows) => {
                let curYFS = YFSDict.get(row);
                if (curYFS === 'Y' || curYFS === 'F') fEval.onRemoveRow(fEval.curState, row, coveredRows);
                if (curYFS === 'Y' || curYFS === 'S') sEval.onRemoveRow(sEval.curState, row, coveredRows);
            },
            onTerminate: (state) => {
            },
            evaluateScore: (state, coveredRows) => {
                // return a decreasing score (as rows are added).
                let curScore = fEval.evaluateScore(fEval.curState, coveredRows) + sEval.evaluateScore(sEval.curState, coveredRows);
                return curScore;
            }
        };

        let solutions;
        if (new_method) {
            solutions = mat.Solve_YFSmod(fEval, sEval, top_n);
        } else {
            solutions = mat.Solve(allEval, top_n);
        }
        if (solutions.length <= 50) {
            solutions.forEach((s, i) => (console.log("score at idx " + i + ": " + s.score)));
        }
        // Interpret the results
        return { solutionSet: solutions, solutionLimitReached: mat.solutionLimitReached };
    }
    private static create_evaluators(grouped_equiv_sections: CourseSelection[][], options: SearchPrefs): DLXEvaluator<any, any>[] {
        let centerTime;
        switch (options.timePreference) {
            case TimePreference.Morning:
                centerTime = 9 * 60; // 9 am    
                break;
            case TimePreference.Noon:
                centerTime = 12 * 60; // 12pm
                break;
            case TimePreference.Evening:
                centerTime = 21 * 60; // 9 pm
                break;
            default: break;
        }

        // convert each timeslots' start/end times to total minutes format
        const section_timeslots = new WeakMap<CourseSelection[], { wkday, start_time, end_time }[]>();
        grouped_equiv_sections.forEach((crs_grp) => {
            section_timeslots.set(crs_grp, crs_grp[0].sec.timeslots.map((timeslot) => {
                return {
                    wkday: timeslot.weekday,
                    start_time: timeslot.start_time[0] * 60 + timeslot.start_time[1],
                    end_time: timeslot.end_time[0] * 60 + timeslot.end_time[1]
                };
            }));
        });

        // calculate time cost dict
        const timeCostDict = new Map<CourseSelection[], number>();
        let minPenalty = -Infinity; // all penalties are negative. the 'min penalty' is the penalty with the lowest value
        // each section's "time cost" is the sum of how much each of its timeslots deviates from the "center time"
        grouped_equiv_sections.forEach(grp => { // TODO: change to use section_timeslots
            let score = section_timeslots.get(grp).map(ts => {
                let { start_time, end_time } = ts;
                let penalty = 0;
                for (let tim = start_time; tim < end_time; tim += 15) {
                    if (centerTime) {
                        penalty -= Math.abs(Math.round(Math.pow(centerTime - tim, 1.0)));
                    } else {
                        penalty = 0;
                    }
                }
                return penalty;
            }).reduce((a, b) => a + b);

            if (score > minPenalty) {
                minPenalty = score;
            }
            timeCostDict.set(grp, score);
        });

        console.assert([...timeCostDict.values()].every(v => v <= 0), "all costs must be negative");

        // normalize item penalities
        [...timeCostDict.entries()].forEach((itm) => {
            timeCostDict.set(itm[0], Math.round((-minPenalty + itm[1]) / 1));
        });

        console.log(grouped_equiv_sections.map(grp => timeCostDict.get(grp)).join(", "));

        const dayLengthFactor = 15;
        const occupiedDayPenalty = 100000;
        const maxTotalDayLength = 14 * 60 * 5;
        const wkdays = Object.keys(wkday_idx);

        class MainEvaluator implements DLXEvaluator<any, CourseSelection[]> {
            curState: any;
            potentialDayLengths: Map<string, {
                beginTimes: { origObj: CourseSelection[], beginTime: number }[],
                endTimes: { origObj: CourseSelection[], endTime: number }[]
            }>;

            constructor(term: string) {
                // build potential longest times map
                this.potentialDayLengths = new Map();
                for (const wkday of wkdays)
                    this.potentialDayLengths.set(wkday, { beginTimes: [], endTimes: [] });

                for (const grp of grouped_equiv_sections) {
                    if (grp[0].crs.term !== term && grp[0].crs.term !== 'Y')
                        continue;

                    let earliestTimes = []; // earliest times for this section, indexed by weekday
                    let latestTimes = []; // latest times for this section, indexed by weekday
                    for (const ts of section_timeslots.get(grp)) {
                        let { start_time, end_time, wkday } = ts;

                        // calc earliest / latest
                        const wkidx = wkday_idx[wkday];
                        if (!earliestTimes[wkidx] || start_time < earliestTimes[wkidx])
                            earliestTimes[wkidx] = start_time;
                        if (!latestTimes[wkidx] || end_time > latestTimes[wkidx])
                            latestTimes[wkidx] = end_time;

                    }
                    // console.log("eT, lT", earliestTimes, latestTimes);
                    // assign each to the potentialDayLengths map
                    for (const wkday of wkdays) {
                        const beginTime = earliestTimes[wkday_idx[wkday]];
                        const endTime = latestTimes[wkday_idx[wkday]];
                        if (beginTime || endTime) {
                            console.assert(beginTime && endTime);
                            const wkdayObj = this.potentialDayLengths.get(wkday);
                            wkdayObj.beginTimes.push({ origObj: grp, beginTime: beginTime });
                            wkdayObj.endTimes.push({ origObj: grp, endTime: endTime });
                        }
                    }

                };

                // sort each beginTimes and endTimes in the potentialDayLengths
                for (const wkday of wkdays) {
                    const { beginTimes, endTimes } = this.potentialDayLengths.get(wkday);
                    console.assert(beginTimes.length === endTimes.length);
                    beginTimes.sort((objA, objB) => objA.beginTime - objB.beginTime);
                    endTimes.sort((objA, objB) => objB.endTime - objA.endTime);
                }

                // console.log("potentialDayLengths " + JSON.stringify([...this.potentialDayLengths.entries()]));

                let wkdayMap = new Map<string, { beginTimes: number[], endTimes: number[] }>();
                this.curState = {
                    scoreHistory: [0], // cache the earlier scores to avoid recalculating them
                    timeScore: 0,
                    wkdayTimes: wkdayMap, // a map of each weekday's start and end times
                    totalDayLengths: [],
                    potentialDayLengths: [],
                    occupiedDayCounts: [],
                    rowCount: 0,
                }
            }
            onAddRow = (state, row, coveredRows: ReadonlySet<CourseSelection[]>) => {
                const rCount = state.rowCount;
                let scoreDiff = timeCostDict.get(row);
                state.timeScore += scoreDiff;

                if (rCount === 0) {
                    // clear begin/end times
                    for (const wkday of wkdays) {
                        state.wkdayTimes.set(wkday, { beginTimes: [], endTimes: [] });
                    }
                    // initial begin/end times state
                    for (const timeslot of section_timeslots.get(row)) {
                        const { beginTimes, endTimes } = state.wkdayTimes.get(timeslot.wkday);
                        beginTimes[0] = timeslot.start_time;
                        endTimes[0] = timeslot.end_time;
                    }
                } else {
                    // copy old start/end times to the new state
                    for (const wkday of wkdays) {
                        const { beginTimes, endTimes } = state.wkdayTimes.get(wkday);
                        beginTimes[rCount] = beginTimes[rCount - 1];
                        endTimes[rCount] = endTimes[rCount - 1];
                    }

                    for (const timeslot of section_timeslots.get(row)) {
                        const { beginTimes, endTimes } = state.wkdayTimes.get(timeslot.wkday);
                        if (!beginTimes[rCount] && !endTimes[rCount]) {
                            beginTimes[rCount] = timeslot.start_time;
                            endTimes[rCount] = timeslot.end_time;
                        } else {
                            console.assert(beginTimes[rCount] && endTimes[rCount]);
                            if (timeslot.start_time < beginTimes[rCount]) {
                                beginTimes[rCount] = timeslot.start_time;
                            }
                            if (timeslot.end_time > endTimes[rCount]) {
                                endTimes[rCount] = timeslot.end_time;
                            }
                        }
                    }

                }

                // console.log(JSON.stringify([...state.wkdayTimes.entries()]));
                // recalculate totalDayLength and occupiedDayCount
                let dayLength = 0;

                let occupiedDayCount = 0;
                for (const wkday of wkdays) {
                    const { beginTimes, endTimes } = state.wkdayTimes.get(wkday);
                    if (beginTimes[rCount]) {
                        dayLength += endTimes[rCount] - beginTimes[rCount];
                        occupiedDayCount += 1;

                        console.assert(dayLength >= 0);
                    }

                }
                // recalculate potentialDayLength
                let potentialDayLength = 0;

                // console.log(rCount, "--------------");
                for (const wkday of wkdays) {
                    const { beginTimes, endTimes } = this.potentialDayLengths.get(wkday);
                    // console.log("coveredRows", JSON.stringify([...coveredRows.values()].map(x => x[0].sec.section_id)));
                    // console.log("pDL", wkday, JSON.stringify(beginTimes.map(x => x.beginTime)), JSON.stringify(endTimes.map(x => x.endTime)));
                    // console.log("pDL(cov)", wkday,
                      //  JSON.stringify(beginTimes.map(x => coveredRows.has(x.origObj) ? null : x.beginTime)),
                      //  JSON.stringify(endTimes.map(x => coveredRows.has(x.origObj) ? null : x.endTime)));
                    let potentialBeginTime, potentialEndTime;

                    // get the earliest potential time for this weekday
                    // by going through the rows that contribute to this weekday, sorted by start time (ascending),
                    // and finding the first uncovered element
                    for (let i = 0; i < beginTimes.length; i++) {
                        if (!coveredRows.has(beginTimes[i].origObj)) {
                            potentialBeginTime = beginTimes[i].beginTime;
                            break;
                        }
                    }
                    // get the latest potential time for this weekday
                    // by going through the rows that contribute to this weekday, sorted by end time (descending),
                    // and finding the first uncovered element
                    for (let i = 0; i < endTimes.length; i++) {
                        if (!coveredRows.has(endTimes[i].origObj)) {
                            potentialEndTime = endTimes[i].endTime;
                            break;
                        }
                    }

                    const wkdayInfo = state.wkdayTimes.get(wkday);
                    let curBeginTime = wkdayInfo.beginTimes[rCount]; // the time that the current day starts, so far
                    let curEndTime = wkdayInfo.endTimes[rCount]; // the time that the current day ends, so far
                    // if curBeginTime and curEndTime are undefined then there is currently nothing scheduled for that day
                    // if potentialBeginTime and potentialEndTime are undefined then there is nothing more that can be scheduled for that day
                    // console.assert((curBeginTime && curEndTime) || !(curBeginTime || curEndTime));
                    if (curBeginTime || curEndTime) {
                        // console.log("a curEnd/curBegin", curEndTime, curBeginTime);
                        // console.log("b potentialEnd/Begin", potentialEndTime, potentialBeginTime);
                        if (potentialBeginTime || potentialEndTime) {
                            console.assert(potentialBeginTime && potentialEndTime);
                            if (potentialBeginTime < curBeginTime) {
                                curBeginTime = potentialBeginTime; // temp disable due to performance
                            }
                            if (potentialEndTime > curEndTime) {
                                curEndTime = potentialEndTime;  // temp disable due to performance
                            }
                        }
                        potentialDayLength += curEndTime - curBeginTime;
                    } else {
                        if (potentialBeginTime || potentialEndTime) {
                            potentialDayLength += potentialEndTime - potentialBeginTime; // temp disable due to performance

                            // console.log("b potentialEnd/Begin", potentialEndTime, potentialBeginTime);
                        }
                    }
                }
                // console.log(rCount, potentialDayLength);
                // console.log(rCount, dayLength, occupiedDayCount);
                state.totalDayLengths[rCount] = dayLength;
                state.occupiedDayCounts[rCount] = occupiedDayCount;
                state.potentialDayLengths[rCount] = potentialDayLength;

                // note : calcScore is called before rowCount is implemented
                state.scoreHistory[rCount + 1] = this.calcScore(state); // debug

                console.assert(state.scoreHistory[rCount] >= state.scoreHistory[rCount + 1], "score must be nonincreasing");

                // console.log(JSON.stringify(state.scoreHistory));
                state.rowCount++;
            };
            onRemoveRow = (state, row) => {
                let scoreDiff = timeCostDict.get(row);
                state.timeScore -= scoreDiff;

                state.rowCount--;
            };
            onTerminate = (helperState: any) => { };
            evaluateScore = (state) => {
                return state.scoreHistory[state.rowCount];
            };
            calcScore = (state) => {

                const rCount = state.rowCount;
                let outputScore = state.timeScore;
                // note : calcScore is called before rowCount is implemented, so no need to subtract 1 from rCount
                const totalDayLength = state.totalDayLengths[rCount];
                const potentialTotalDayLength = state.potentialDayLengths[rCount];
                const occupiedDayCount = state.occupiedDayCounts[rCount];


                // console.log("rcount" + rCount, JSON.stringify(state.totalDayLengths), JSON.stringify(state.occupiedDayCounts));
                // console.log(rCount, totalDayLength, occupiedDayCount);
                if (options.dayLengthPreference === DayLengthPreference.Short) {
                    // if prioritize short days, penalize score by dayLengthFactor*totalDayLength
                    // this means that the higher the totalDayLength, the higher the penalty
                    const penalty = dayLengthFactor * totalDayLength
                    console.assert(penalty >= 0);
                    outputScore -= penalty;
                } else if (options.dayLengthPreference === DayLengthPreference.Long) {
                    // if prioritize long days, penalize score by dayLengthFactor*(maxTotalDayLength - potentialTotalDayLength). 
                    // this means that the smaller the totalDayLength, the higher the penalty
                    const penalty = dayLengthFactor * (maxTotalDayLength - potentialTotalDayLength);
                    // const penalty = dayLengthFactor * (maxTotalDayLength - totalDayLength); // temp substitute for performance
                    console.assert(penalty >= 0);
                    outputScore -= penalty;
                }

                if (options.prioritizeFreeDays) {
                    // if prioritize free days, penalize score occupiedDayPenalty*(occupiedDayCount)
                    // this meanas the lower the number of free days, the heavier the penalty
                    const penalty = occupiedDayPenalty * occupiedDayCount;
                    console.assert(penalty >= 0);
                    outputScore -= penalty;
                }

                return outputScore;
            }
        }
        let fEval = new MainEvaluator('F');
        let sEval = new MainEvaluator('S');
        return [fEval, sEval];
    }
}


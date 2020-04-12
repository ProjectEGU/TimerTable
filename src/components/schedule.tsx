import { Course, CourseSelection, CourseSection, Timeslot } from "./course";
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

    public static find_sched(crs_list: CourseSelection[], solution_limit: number, top_n?: number, new_method?: boolean): SchedSearchResult {
        let crsSortValueMap = new Map();
        crs_list.forEach((crsSel: CourseSelection) => {
            crsSortValueMap.set(
                crsSel,
                String(['Y', 'F', 'S'].indexOf(crsSel.crs.course_code[8]))
                + crsSel.crs.course_code
                + String(['L', 'T', 'P'].indexOf(crsSel.sec.section_id[0]))
                + crsSel.sec.section_id);
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
        let grouped_equiv_sections: CourseSelection[][] = [];
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

        /** Cost dict calculations */
        // calculate cost dict
        let costDict = new Map<CourseSelection[], number>();
        let minPenalty = -Infinity; // all penalties are negative. the 'min penalty' is the penalty with the lowest absolute value 
        grouped_equiv_sections.forEach(grp => {
            let score = grp[0].sec.timeslots.map(ts => {
                let start_time = ts.start_time[0] * 60 + ts.start_time[1];
                let end_time = ts.end_time[0] * 60 + ts.end_time[1];
                let penalty = 0;
                for (let tim = start_time; tim < end_time; tim += 30) {
                    penalty -= (2260 - Math.round(Math.pow(tim, 1.0)));
                    //penalty -= Math.round(Math.pow(tim, 1.0));
                }
                return penalty;
            }).reduce((a, b) => a + b)
            // score += Number(grp[0].crs.course_code.substr(3,3));
            // score += Number(grp[0].sec.section_id.substr(3,4)); // ensure nonuniformity
            if (score > minPenalty) {
                minPenalty = score;
            }
            costDict.set(grp, score);
        });
        console.assert([...costDict.values()].every(v => v <= 0), "all costs must be negative");

        // normalize item penalities
        [...costDict.entries()].forEach((itm) => {
            costDict.set(itm[0], Math.round((-minPenalty + itm[1]) / 1));
        });

        // sort rows by term, section type, then alphabetic order
        grouped_equiv_sections.sort((grpA, grpB) => {
            return crsSortValueMap.get(grpA[0]).localeCompare(crsSortValueMap.get(grpB[0]));
        });
        console.log(grouped_equiv_sections.map(grp => costDict.get(grp)).join(", "));

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
        let cliques = BronKerbosch(edges) as number[][];// cliques are fully connected components of a graph
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

        let YFSDict = new WeakMap<CourseSelection[], string>();
        grouped_equiv_sections.forEach((crs_grp) => {
            let crs_sel = crs_grp[0];
            YFSDict.set(crs_grp, crs_sel.crs.course_code[8]);
        });


        let fEval = {
            curState: {
                curScore: 500000 / 2,
                rCount: 0, minSco: Infinity, maxSco: -Infinity
            },
            onAddRow: (state, row) => {
                // assert that rows are added in YFS order
                let scoreDiff = costDict.get(row);
                state.curScore += scoreDiff;
                state.rCount++;
            },
            onRemoveRow: (state, row) => {
                let scoreDiff = costDict.get(row);
                state.curScore -= scoreDiff;
                state.rCount--;
            },
            onTerminate: (state) => {
            },
            evaluateScore: (state) => {
                return state.curScore;
            }
        };
        let sEval = {
            curState: {
                curScore: 500000 / 2,
                rCount: 0, minSco: Infinity, maxSco: -Infinity
            },
            onAddRow: (state, row) => {
                // assert that rows are added in YFS order
                let scoreDiff = costDict.get(row);
                state.curScore += scoreDiff;
                state.rCount++;
            },
            onRemoveRow: (state, row) => {
                let scoreDiff = costDict.get(row);
                state.curScore -= scoreDiff;
                state.rCount--;
            },
            onTerminate: (state) => {
            },
            evaluateScore: (state) => {
                return state.curScore;
            }
        }
        mat.SetEvaluator({
            curState: { rCount: 0, minSco: Infinity, maxSco: -Infinity },
            onAddRow: (state, row) => {
                let curYFS = YFSDict.get(row);
                if (curYFS === 'Y' || curYFS === 'F') fEval.onAddRow(fEval.curState, row);
                if (curYFS === 'Y' || curYFS === 'S') sEval.onAddRow(sEval.curState, row);
                state.rCount += 1;
            },
            onRemoveRow: (state, row) => {
                let curYFS = YFSDict.get(row);
                if (curYFS === 'Y' || curYFS === 'F') fEval.onRemoveRow(fEval.curState, row);
                if (curYFS === 'Y' || curYFS === 'S') sEval.onRemoveRow(sEval.curState, row);
                state.rCount -= 1;
            },
            onTerminate: (state) => {
            },
            evaluateScore: (state) => {
                // return a decreasing score (as rows are added).
                let curScore = fEval.evaluateScore(fEval.curState) + sEval.evaluateScore(sEval.curState);
                return curScore;
            }
        });

        let solutions;
        if (new_method) {
            solutions = mat.Solve_YFSmod(fEval, sEval, top_n);
        } else {
            solutions = mat.Solve(top_n);
        }
        if (solutions.length <= 50) {
            solutions.forEach((s, i) => (console.log("score at idx " + i + ": " + s.score)));
        }
        // Interpret the results
        return { solutionSet: solutions, solutionLimitReached: mat.solutionLimitReached };
    }
}

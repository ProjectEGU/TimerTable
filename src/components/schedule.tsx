import { Course, CourseSelection, CourseSection, Timeslot } from "./course";
import { DLXMatrix, Solution as DLXSolution } from "./dlxmatrix"
import { string } from "prop-types";
import { AssertionError } from "assert";
import { crsdb } from "./crsdb";
import { S_IFCHR } from "constants";

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
         * 3. The meeting times are the exact same. Just the rooms may be different.
         */

        if (secA.crs.unique_id == secB.crs.unique_id && secA.sec.section_id.substr(0, 3) == secB.sec.section_id.substr(0, 3)) {
            let tslotsA = secA.sec.timeslots.map(tslot => `${tslot.weekday} ${tslot.start_time.join(":")} ${tslot.end_time.join(":")}`).sort().join("");
            let tslotsB = secB.sec.timeslots.map(tslot => `${tslot.weekday} ${tslot.start_time.join(":")} ${tslot.end_time.join(":")}`).sort().join("");

            return tslotsA == tslotsB;
        } else {
            return false;
        }
    }



    // Return true if it's impossible to schedule the two courses together at all.
    public static is_total_conflict(crsA: Course, crsB: Course): boolean {//TODO
        let selA = crsdb.list_all_crs_selections(crsA);
        let selB = crsdb.list_all_crs_selections(crsB);

        // Currently, we run the arrangement algorithm with all of the course's sections
        let xx = crs_arrange.find_sched(selA.concat(selB), 1).solutionSet;
        return xx.length == 0;
    }

    static demarcate_component<T extends { edges: T[], mark: V }, V>(node: T, targetMark: V) {//TODO
        let nodes_remain: T[] = [];
        nodes_remain.push(node);

        let iter_limit = 5000;

        while (nodes_remain.length > 0 && iter_limit-- > 0) {
            let node_cur = nodes_remain.pop();
            if (node_cur.mark != targetMark) {
                node_cur.mark = targetMark;

                nodes_remain.push(...node_cur.edges.filter(n => n.mark != targetMark));
            }
        }

        if (nodes_remain.length > 0)
            console.error(`demarcate_component: traversal limit of ${iter_limit} exceeded`);
    }

    public static get_conflict_map(
        crs_list: Course[],
        whitelisted_sections: Map<string, Set<string>>,
        blacklisted_sections: Map<string, Set<string>>): Map<string, number> {
        // TEMP DISABLE DUE TO PERFORMANCE
        return new Map<string, number>();

        // Generate the nodes in the graph
        let linkmap = crs_list.map(crsObj => ({ crs: crsObj, edges: [], mark: -1 }));

        // Compute the edges in the graph
        for (let idxA = 0; idxA < linkmap.length - 1; idxA++) {
            const nodeA = linkmap[idxA];
            for (let idxB = idxA + 1; idxB < linkmap.length; idxB++) {
                const nodeB = linkmap[idxB];

                if (this.is_total_conflict(linkmap[idxA].crs, linkmap[idxB].crs)) {
                    nodeA.edges.push(nodeB);
                    nodeB.edges.push(nodeA);
                }
            }
        }

        // Demarcate the nodes in the components
        let componentID = 0;
        for (let index = 0; index < crs_list.length; index++) {
            let node = linkmap[index];

            // if a node has no children: it is not a part of any component.
            // otherwise, if the node hasn't already been marked: mark the node, along with all of its children, to a component id.
            if (node.edges.length > 0 && node.mark == -1) {
                this.demarcate_component(node, componentID);
                componentID += 1;
            }
        }

        // Iterate through the graph again and create a dictionary that maps node to an id representing which component they are in.
        let result = new Map<Course, number>();
        linkmap.forEach(node => {
            if (node.mark != -1)
                result.set(node.crs, node.mark)
        });
        // return result;
    }
    public static find_sched(crs_list: CourseSelection[], solution_limit: number,
        sched_rank_method?: (crs_sel_grps: CourseSelection[][]) => number): SchedSearchResult {
        // For courses that have no timeslots or are closed, we skip feeding them into the algorithm.
        crs_list = crs_list.filter(crs_sel => crsdb.is_section_open(crs_sel.sec) && crs_sel.sec.timeslots.length > 0);

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

        // console.log(JSON.parse(JSON.stringify((section_groups))));

        // Grouped sections based on if they are equivalent
        // [[SecA], [SecB, SecC]]
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

        // console.log(section_groups);

        // console.log(grouped_equiv_sections);

        // Construct DLX Matrix
        let n_primary_cols = column_id;
        let n_secondary_cols = 0;
        let n_rows = grouped_equiv_sections.length;
        let data = []; // 0's can be left as undefined

        // Calculate primary columns: required sections
        grouped_equiv_sections.forEach((crs_grp) => {
            let crs_sel = crs_grp[0];

            let unique_id = crs_sel.crs.unique_id;
            let sec_type = crs_sel.sec.section_id.substr(0, 3);

            let next_row = [];
            next_row[id_sec_map.get(unique_id).get(sec_type)] = 1;
            data.push(next_row);
        });

        // Calculate secondary columns: timeslot exclusions
        let n_exclusions = 0;
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
                    data[idx1][n_primary_cols + n_exclusions] = 1;
                    data[idx2][n_primary_cols + n_exclusions] = 1;
                    n_exclusions += 1;
                }
            }
        }

        n_secondary_cols = n_exclusions;
        let n_cols = n_primary_cols + n_secondary_cols;

        console.log(`Calculation begins. Matrix Size (row, col): ${n_rows}, ${n_cols} ; n_primary_cols: ${n_primary_cols}; n_secondary_cols: ${n_secondary_cols};`)

        // Solve the matrix
        let mat: DLXMatrix<CourseSelection[]>
            = DLXMatrix.Initialize<CourseSelection[]>(n_rows, n_cols, grouped_equiv_sections, data, n_primary_cols);

        mat.SetSolutionLimit(solution_limit);
        mat.Solve(sched_rank_method);

        // Interpret the results
        return { solutionSet: mat.solutionSet, solutionLimitReached: mat.solutionLimitReached };
    }
}
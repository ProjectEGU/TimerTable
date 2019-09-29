import { Course, CourseSelection, CourseSection, Timeslot } from "./course";
import { DLXMatrix } from "./dlxmatrix"
import { string } from "prop-types";
import { AssertionError } from "assert";
import { crsdb } from "./crsdb";

interface crs_choice {
    crs: Course,
    secs: CourseSection[]
}

export class crs_arrange {
    constructor(params) {

    }

    public static find_sched(crs_list: CourseSelection[]): CourseSelection[][] {
        // TODO: For each section for the same course with the same timeslots and type, we group them together.

        // Assign a column number to each unique_id + section_types pair. 
        let id_sec_map = new Map<string, Map<string, number>>();
        let unfulfilled_sectypes = new Map<string, Set<string>>(); // check section fulfillment
        let column_id = 0;
        crs_list.forEach((crs_sel) => {
            let crs_unique_id = crs_sel.crs.unique_id;
            let sec_type = crs_sel.sec.section_id.substr(0, 3); // TODO: build this into the CourseSection object?

            if (!id_sec_map.has(crs_unique_id)) {
                id_sec_map.set(crs_unique_id, new Map<string, number>());

                unfulfilled_sectypes.set(crs_unique_id, new Set<string>(Object.keys(crs_sel.crs.course_sections)));
            }
            if (!id_sec_map.get(crs_unique_id).has(sec_type)) {
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
                return [];
            }
        });

        // Construct DLX Matrix
        let n_primary_cols = column_id;
        let n_secondary_cols = 0;
        let n_rows = crs_list.length;
        let data = []; // 0's can be left as undefined

        // Calculate primary columns: required sections
        crs_list.forEach((crs_sel) => {
            let unique_id = crs_sel.crs.unique_id;
            let sec_type = crs_sel.sec.section_id.substr(0, 3);

            let next_row = [];
            next_row[id_sec_map.get(unique_id).get(sec_type)] = 1;
            data.push(next_row);
        });

        // Calculate secondary columns: timeslot exclusions
        let n_exclusions = 0;
        for (let idx1 = 0; idx1 < crs_list.length; idx1++) {
            for (let idx2 = idx1 + 1; idx2 < crs_list.length; idx2++) {
                let ts1: Timeslot[] = crs_list[idx1].sec.timeslots;
                let ts2: Timeslot[] = crs_list[idx2].sec.timeslots;

                if (crsdb.is_timeslots_conflict(ts1, ts2)) {
                    data[idx1][n_primary_cols + n_exclusions] = 1;
                    data[idx2][n_primary_cols + n_exclusions] = 1;
                    n_exclusions += 1;
                }
            }
        }

        n_secondary_cols = n_exclusions;
        let n_cols = n_primary_cols + n_secondary_cols;

        // Solve the matrix
        let mat: DLXMatrix<CourseSelection>
            = DLXMatrix.Initialize<CourseSelection>(n_rows, n_cols, crs_list, data, n_primary_cols);

        // Interpret the results
        mat.Solve();

        return mat.solutionSet;
    }
}
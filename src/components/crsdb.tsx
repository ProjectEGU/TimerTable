import { Course, CourseSelection, CourseSection, Timeslot } from "./course"

import { DLXMatrix } from "./dlxmatrix"
import { AssertionError } from "assert";

export enum Campus {
    UTM = 'utm',
    STG_ARTSCI = 'stg_artsci',
    UTSC = 'utsc'
}

export class crsdb {
    constructor(params) {

    }

    static crs_store = {}; // crs data store: crs_store[campus][session] : Course[]
    static crs_store_prefix = {}; // crs data store (uppercase prefix tree): crs_store[campus][session][letter1][letter2][letter3] : Course[]

    static async fetch_crs_data(campus, session, force_reload = false): Promise<Course[]> {
        // Check if current campus exist. If not, then add it.
        if (!(campus in crsdb.crs_store)) {
            crsdb.crs_store[campus] = {};
            crsdb.crs_store_prefix[campus] = {};
        }
        // If not forcing reload: Check is session pre-exists in current campus. If so, then return it.
        if (!force_reload && session in crsdb.crs_store[campus]) {
            return crsdb.crs_store[campus][session];
        }

        // Otherwise, continue to fetch data.
        let crs_data: Course[] = await fetch(`/data/course_data_${campus}_${session}`).then(
            (response) => {
                if (!response.ok) {
                    throw new Error(response.statusText);
                }
                return response.json();
            }
        ).then((data: Course[]) => {
            crsdb.crs_store[campus][session] = data;
            let crs_map = (crsdb.crs_store_prefix[campus][session] = {});
            // process each course into first 3 letter ids
            // add the campus and session info to each course object
            data.forEach((crs) => {
                console.assert(crs.course_code.length > 3);
                crs.campus = campus;
                crs.session = session;
                crs.unique_id = `${campus}-${session}-${crs.course_code}`;
                let map_pos = crs_map;
                for (let idx = 0; idx < 3; idx++) {
                    let letter = crs.course_code[idx].toUpperCase();
                    if (!(letter in map_pos)) {
                        map_pos[letter] = (idx == 2) ? [] : {};
                    }
                    map_pos = map_pos[letter];
                }

                (map_pos as any as Course[]).push(crs); // typescript type inference bypass required
            });
            return data;
        });

        return crs_data;
    }

    /**
     * Searches for course code using prefix tree lookup. Requires at least 3 letters of course code.
     * 
     * TODO: consider building prefix tree class which takes in a data store, and several types of keys, and generates up to N characters of prefix arrangement for each key (strings only)
     */
    static list_crs_by_code(campus, session, crs_code: string): Course[] {
        // console.log('lookup: ' + crs_code);
        if (crs_code.length < 3) return [];
        crs_code = crs_code.toUpperCase();
        let crs_list = crsdb.crs_store_prefix[campus] &&
            crsdb.crs_store_prefix[campus][session] &&
            crsdb.crs_store_prefix[campus][session][crs_code[0]] &&
            crsdb.crs_store_prefix[campus][session][crs_code[0]][crs_code[1]] &&
            crsdb.crs_store_prefix[campus][session][crs_code[0]][crs_code[1]][crs_code[2]]; // https://medium.com/javascript-inside/safely-accessing-deeply-nested-values-in-javascript-99bf72a0855a
        if (!crs_list) return [];
        else return crs_list.filter((x: Course) => x.course_code.toUpperCase().startsWith(crs_code));
    }

    /**
     * Get a course selection given a course object and a list of section id's to take.
     * If any section specified is invalid, or not all sections are filled exactly once, then an error will be thrown.
     * todo: allow partial selections ?
     * @param crs 
     * @param section_ids 
     */
    static get_crs_selections(crs: Course, ...section_ids: string[]) {
        console.log(crs);
        let output: CourseSelection[] = [];
        let satisfy_sections = Object.keys(crs.course_sections); // list of sectypes to satisfy
        section_ids.forEach((secId) => {
            let secType = secId.substr(0, 3);
            let secIdx = satisfy_sections.indexOf(secType);
            if (secIdx == -1) {
                throw `Invalid combination of sections selected: type not found: ${secId} in ${crs.course_code}`;
            }

            // assume all the section id's are already different in the JSON, otherwise it'd probably break acorn too :)
            let sec: CourseSection = crs.course_sections[secType].find(x => x.section_id == secId);
            if (sec == null) {
                throw `Could not find section: ${secId} in ${crs.course_code}`;
            }
            output.push(
                {
                    crs: crs,
                    sec: sec
                }
            );

            satisfy_sections.splice(secIdx, 1); // remove satisfied sectype from list
        });

        if (satisfy_sections.length > 0) {
            throw `Sections unsatisfied for ${crs.course_code}: ${satisfy_sections}`;
        }

        return output;
    }

    /**
     * Get Course by code. If not found or more than one result found, then return null.
     * @param campus 
     * @param session 
     * @param crs_code 
     */
    static get_crs_by_code(campus, session, crs_code) {
        let result = crsdb.list_crs_by_code(campus, session, crs_code);
        if (result.length != 1) return null;
        return result[0];
        /*let output = this.get_crs(campus, session, (crs: Course) => {
            return crs.course_code == crs_code;
        });
        if (!output) {
            throw `Error finding course: ${crs_code} at ${campus} session ${session}`;
        }
        return output;*/
    }

    // TODO: search crs functionality. - possibly for multiple courses
    static get_crs(campus, session, pred: (Course) => boolean): Course {
        if (!(campus in crsdb.crs_store)) {
            throw `Campus not loaded in data store: ${campus}`;
        }
        if (!(session in crsdb.crs_store[campus])) {
            throw `Session not loaded in data store: ${session}`;
        }
        return crsdb.crs_store[campus][session].find(pred);
    }

    /**
     * Check if two selected timeslots conflict with each other
     */
    static is_timeslot_conflict(a: Timeslot, b: Timeslot): boolean {
        if (a.weekday != b.weekday)
            return false;
        if (a.start_time <= b.start_time && a.end_time <= b.start_time)
            return false; // comparing list of ints in JS will compare elements with little endian priority
        if (a.start_time >= b.end_time && a.end_time >= b.end_time)
            return false;

        return true;
    }

    /**
     * Check if two selected lists of timeslots conflict with each other
     */
    static is_timeslots_conflict(a: Timeslot[], b: Timeslot[]): boolean {
        //TODO: is there a more optimal way to check two series of timeslots for conflict ?
        for (let idx1 = 0; idx1 < a.length; idx1++) {
            for (let idx2 = 0; idx2 < b.length; idx2++) {
                if (crsdb.is_timeslot_conflict(a[idx1], b[idx2])) {
                    return true;
                }
            }
        }
        return false;
    }

    static get_crs_all(campus, session, pred: (Course) => boolean): Course[] {
        return null; // TODO.
    }
}
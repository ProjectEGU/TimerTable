import { Course, CourseSelection, CourseSection, Timeslot } from "./course";
import { Skeleton } from 'antd';
import { DLXMatrix } from "./dlxmatrix"
import { AssertionError } from "assert";

export enum Campus {
    UTM = 'utm',
    STG_ARTSCI = 'stg_artsci',
    // UTSC = 'utsc'
}

export var Campus_Formatted = {
    'utm': "UTM",
    'stg_artsci': "StG"
}

export class crsdb {
    constructor(params) {

    }

    static crs_store = {}; // crs data store: crs_store[campus][session] : Course[]
    static crs_store_prefix = {}; // crs data store (uppercase prefix tree): crs_store_prefix[campus][session][letter1][letter2][letter3] : Course[]
    static crs_unique_id_map = {}; // crs unique-id map: crs_unique_id_map[unique_id] : Course

    public static data_updated_date: Date = null;
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
        let crs_data: Course[] = await fetch(`data/course_data_${campus}_${session}`, { headers: {} }).then(
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
                crsdb.crs_unique_id_map[crs.unique_id] = crs;
                // map_pos will be of format: {}{}{}[]
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

        let updated_date_str = await fetch(`data/crs_data_last_updated.txt`).then(
            (response) => {
                if (!response.ok)
                    crsdb.data_updated_date = null;
                else return response.text();
            }
        );

        crsdb.data_updated_date = updated_date_str == null ? null : new Date(updated_date_str);

        return crs_data;
    }

    /**
     * Searches for course code using prefix tree lookup. Requires at least 3 letters of course code.
     * 
     * TODO: consider building prefix tree class which takes in a data store, and several types of keys, and generates up to N characters of prefix arrangement for each key (strings only)
     */
    static list_crs_by_code(campus, session, crs_code: string): Course[] {
        if (crs_code.length < 3) return [];
        crs_code = crs_code.toUpperCase();
        let crs_list = crsdb.crs_store_prefix[campus] &&
            crsdb.crs_store_prefix[campus][session] &&
            crsdb.crs_store_prefix[campus][session][crs_code[0]] &&
            crsdb.crs_store_prefix[campus][session][crs_code[0]][crs_code[1]] &&
            crsdb.crs_store_prefix[campus][session][crs_code[0]][crs_code[1]][crs_code[2]];
        if (!crs_list) return [];
        else return crs_list.filter((x: Course) => x.course_code.toUpperCase().startsWith(crs_code));
    }

    static get_crs_by_uid(unique_id: string) {
        if (!(unique_id in crsdb.crs_unique_id_map)) {
            console.error("get_crs_selections_by_id: course unique id not found: " + unique_id);
            return null;
        }
        return crsdb.crs_unique_id_map[unique_id];
    }

    static get_crs_selections_by_id(unique_id: string, section_ids: string[]): CourseSelection[] {
        return crsdb.get_crs_selections(crsdb.get_crs_by_uid(unique_id), section_ids);
    }

    static get_crs_section_by_id(crs: Course, section_id: string) {
        let secType = section_id.substr(0, 3);
        let sec: CourseSection = crs.course_sections[secType].find(x => x.section_id == section_id);
        return sec;
    }

    /**
     * Get a course selection given a course object and a list of section id's to take.
     * If any section specified is invalid, or not all sections are filled exactly once, then an error will be thrown.
     * todo: allow partial selections ?
     * @param crs 
     * @param section_ids 
     */
    static get_crs_selections(crs: Course, section_ids: string[]): CourseSelection[] {
        let output: CourseSelection[] = [];
        let satisfy_sections = new Set<string>(Object.keys(crs.course_sections)); // list of sectypes to satisfy
        section_ids.forEach((secId) => {
            let secType = secId.substr(0, 3);

            let sec = crsdb.get_crs_section_by_id(crs, secId);
            if (sec == null) {
                throw `Could not find section: ${secId} in ${crs.course_code}`;
            }

            if (!satisfy_sections.has(secType)) {
                throw `Invalid combination of sections selected: type not found, or duplicate section selected: ${secId} in ${crs.course_code}`;
            }

            output.push(
                {
                    crs: crs,
                    sec: sec
                }
            );

            satisfy_sections.delete(secType); // remove satisfied sectype from list
        });

        if (satisfy_sections.size > 0) {
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
    static get_crs_by_code(campus: Campus, session: string, crs_code) {
        let result = crsdb.list_crs_by_code(campus, session, crs_code);
        if (result.length != 1) return null;
        return result[0];
    }

    static list_all_crs_selections(crs: Course): CourseSelection[] {
        let output: CourseSelection[] = [];
        Object.keys(crs.course_sections).forEach(sec_type => {
            output.push(...crs.course_sections[sec_type].map<CourseSelection>((sec) => ({ crs: crs, sec: sec })));
        });

        return output;
    }

    // TODO: search crs functionality. - possibly for multiple courses
    static get_crs(campus, session, pred: (arg0: Course) => boolean): Course {
        if (!(campus in crsdb.crs_store)) {
            throw `Campus not loaded in data store: ${campus}`;
        }
        if (!(session in crsdb.crs_store[campus])) {
            throw `Session not loaded in data store: ${session}`;
        }
        return crsdb.crs_store[campus][session].find(pred);
    }

    /**
     * Check if two selected timeslots conflict with each other.
     * 
     */
    static is_timeslot_conflict(a: Timeslot, b: Timeslot): boolean {
        // The two timeslots occur on different weekdays and therefore cannot conflict
        if (a.weekday != b.weekday)
            return false;

        // Each timeslot has the start and end times in [hour, minute] format.
        // Convert them into total minutes format.
        let start_A = a.start_time[0] * 60 + a.start_time[1];
        let start_B = b.start_time[0] * 60 + b.start_time[1];
        let end_A = a.end_time[0] * 60 + a.end_time[1];
        let end_B = b.end_time[0] * 60 + b.end_time[1];

        // The first timeslot starts and ends before the second timeslot even starts, so there is no conflict.
        if (start_A <= start_B && end_A <= start_B)
            return false;

        // The first timeslot starts and ends after the second timeslot has ended, so there is no conflict.
        if (start_A >= end_B && end_A >= end_B)
            return false;

        // All other cases ruled out: there is a conflict.
        return true;
    }

    /**
     * Check if two selected lists of timeslots conflict with each other
     */
    static is_timeslots_conflict(a: Timeslot[], b: Timeslot[]): boolean {
        for (let idx1 = 0; idx1 < a.length; idx1++) {
            for (let idx2 = 0; idx2 < b.length; idx2++) {
                if (crsdb.is_timeslot_conflict(a[idx1], b[idx2])) {
                    return true;
                }
            }
        }
        return false;
    }

    static is_section_open(sec: CourseSection) {
        return !sec.notes.includes("Closed") && !sec.notes.includes("Cancelled") && sec.timeslots.length > 0;
    }

    static session_format(session: string): string {
        console.assert(session.length == 5, "The session is of the wrong length.");
        let year = parseInt(session.substr(0, 4));
        let term = session[4]; // '9' means {year} fall to {year+1} winter

        if (term == '5') {
            return `${year} Summer`;
        } else if (term == '9') {
            return `${year} Fall - ${year + 1} Winter`;
        } else {
            console.error(`Invalid term code in ${session}`);
            return ``;
        }
    }

    /**
     * Returns a list of available sessions.
     * 
     * Return the current session, and next session.
     * */
    static session_list(): string[] {
        let dmx = new Date();
        let curYear = dmx.getFullYear();
        let curMonth = dmx.getMonth();

        if (curMonth >= 9) {
            // if after september of year X, then return the fall-winter semester of year X, and the summer semester of year X+1
            return [`${curYear}5`, `${curYear + 1}9`]; // return in order: current, next
        } else if (curMonth >= 5) {
            // if during summer of year X, then return the summer semester of year X, along with the fall-winter semester of year X
            return [`${curYear}5`, `${curYear}9`];
        } else {
            // if before summer of year X, then return the fall-winter semester of year X-1, alond with the summer semester of year X
            return [`${curYear - 1}9`, `${curYear}5`];
        }
    }

    static get_crs_all(campus, session, pred: (Course) => boolean): Course[] {
        return null; // TODO: get all crs that fulfill criteria
    }
}

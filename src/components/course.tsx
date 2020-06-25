
// Data model for course.
//
// JSON files will load from: data/course_data_<campus_name>_<session_id>
// e.g. course_data_utm_20199 or course_data_stg_20195 
//
// Each file will contain a single Course[] 

export const wkday_idx = {
    "MO": 0,
    "TU": 1,
    "WE": 2,
    "TH": 3,
    "FR": 4
}
export enum CourseSectionType {
    LEC = "LEC",
    PRA = "PRA",
    TUT = "TUT"
}

export enum DeliveryMode {
    Online = "Online",
    InClass = "InClass",
    Other = "Other"
}

export interface CourseSelection {
    crs: Course,
    sec: CourseSection
}

export interface CourseSection {
    enrolled_count: number;
    instructors: string;
    instructors_list: string[];
    is_closed: boolean;
    notes: string;
    section_id: string;
    timeslots: Timeslot[];
    total_count: number;
    waitlist_count: number;
}

export interface Timeslot {
    end_time: number[];
    room_name_1: string;
    room_name_2: string;
    start_time: number[];
    weekday: string;
}

export interface CourseSectionsDict {
    LEC: CourseSection[];
    PRA: CourseSection[];
    TUT: CourseSection[];
}

export interface Course {
    course_code: string;
    course_info: string;
    course_name: string;
    course_sections: CourseSectionsDict;
    enrl_controls: string;
    term: string;

    session: string;
    campus: string;
    unique_id: string; // an identifier for the course object. it will take into account the same course at different campus / session, etc.

    delivery_mode: string;
    prerequisites: string;
    corequisites: string;
    exclusions: string;

    
}

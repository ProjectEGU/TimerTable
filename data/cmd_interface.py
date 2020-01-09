"""
TODO
[ ] Fix it for new format of jsons
[ ] Search for nonconflicting courses in certain days by adding ~TU ~WE (etc) specifiers.
[ ] Search for courses by professor name.
[ ] Show courses with highest waitlist-to-enrolled ratio (this is how you identify bird courses)

CourseStatistics Web
- Prerequisite graphs for courses and departments
- Longest waitlist-to-enrolled ratio
- Make use of quercus course evaluation data ??
-https://platers.github.io/course-evals/
"""


"""
Cur Sched

MON
2:00p - 3:00p    MAT404    LEC101    IB220    Vakar T. | Kumar S.
3:00p - 5:00p    CSC414    TUT105    DH2020   George M.
5:00p - 6:00p    Break
6:00p - 7:00p    PHL204    LEC104    CC102    Frank J.

TUE

WED

THU

FRI

Options:

Add a course: add <courseID> <section1> <section2> ... (warn if not all sections are registered)
Remove a course (all sections): rm <courseID>
Remove a course (specific section): rm <courseID> <section1> <section2> ...
View possible courses: list
Edit courses taken via courses_taken.txt
Edit courses approval override via courses_approval.txt
----------------------------------------------------------------------------------
Possible courses list: display possible sections and enroll amounts

Open Spots:


Conflict/Full:
MAT324
    LEC102 6:00p - 7:00p  60/60 (15)   conflict with CSC324 LEC101 5:00p - 7:00p
    TUT104 4:00p - 5:30p  15/60        conflict with CSC324 LEC101 5:00p - 7:00p


"""
import json
import pickle
import os
from schedule import *
from course import *

help_msg = """Options:

Add a course: add <courseID> <section1> <section2> ... (all sections need to be registered)
Remove a course (all sections): rm <courseID>
View possible courses: list
View possible courses with course code or title containing all of query: list <keyword1> <keyword2> ...
View course info: view <courseID>
View current schedule: sched / schedule
Search course with course code or title containing all of query: search <keyword1> <keyword2> ...
"""

COURSE_SOURCE = 'UTM'  # POSSIBLE OPTIONS: 'STG_ARTSCI', 'UTM'


def load_data_from_file(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)


def save_data_to_file(data, filepath):
    with open(filepath, 'wb') as f:
        json.dump(data, f)


cur_sched = Schedule()
all_courses = []


def get_single(item_list, predicate):
    search_result = [c for c in item_list if predicate(c)]

    if(len(search_result) == 0):
        raise Exception("No match found.")
    elif(len(search_result) > 1):
        raise Exception("More than one match found.")

    return search_result[0]


def get_course(crs_name):
    crs_search = get_single(
        all_courses, lambda c: c.course_code.startswith(crs_name))

    return crs_search


def search_crs(*keyw):
    return [c for c in all_courses if all([q in c.course_code or q in c.course_name for q in keyw])]


def get_course_with_secs(crs_name, *sec_names):
    """
    \n
    :return: tuple of format (course, lec_section, tut_section, pra_section) with null when section doesn't exist
    """
    # find the course beginning with course code and ensure beginning with specified crs name
    crs_search = get_single(
        all_courses, lambda c: c.course_code.startswith(crs_name))
    course = crs_search

    # assert section names unique, and exactly one of each section

    if((len(set(sec_names)) != len(sec_names)) or (len(sec_names) != len(course.course_sections.keys()))):
        raise Exception("Select one of each section.")

    lec_section = None
    tut_section = None
    pra_section = None

    for sec in sec_names:
        if sec.startswith("LEC"):
            lec_section = get_single(course.course_sections_dict['LEC'], lambda s: s.section_id.startswith(sec))
        elif sec.startswith("TUT"):
            tut_section = get_single(course.course_sections_dict['TUT'], lambda s: s.section_id.startswith(sec))
        elif sec.startswith("PRA"):
            pra_section = get_single(course.course_sections_dict['PRA'], lambda s: s.section_id.startswith(sec))

    return (course, lec_section, tut_section, pra_section)


if os.path.isfile("sched.bin"):
    cur_sched = load_data_from_file("sched.bin")

if COURSE_SOURCE == 'STG_ARTSCI':
    all_courses = load_data_from_file("all_stg_courses")
elif COURSE_SOURCE == 'UTM':
    for i in range(1, 5):
        all_courses += load_data_from_file("course_data_utm_20199")


"""
test command-utm

add CSC
add CSC108H5F LEC0101 PRA0101
add MAT301H5F LEC0101 TUT0102
add MAT137Y5Y LEC0101 TUT0105

test command -stg
add ENG100H1F
add ENG100H1F
add ENG100H1F LEC5101
add ENG100H1S LEC5101
"""

if __name__ == "__main__":
    while True:
        print(help_msg)
        cmd = input("> ")
        cmd_split = cmd.strip().split(' ')

        try:
            if cmd_split[0] == "add":
                try:
                    crs = get_course_with_secs(cmd_split[1], *cmd_split[2:])
                    conflict_check = cur_sched.check_add_course_sections(*filter(lambda c: c is not None, crs), ignore_full_closed=True)

                    can_add_crs = conflict_check[0]
                    report_str = conflict_check[1]

                    if can_add_crs:
                        cur_sched.add_course(*crs)
                        print("Successfully added course.")
                    else:
                        print("Failure to add course: ")
                        print(report_str)
                except Exception as ex:
                    print("Error: " + str(ex))

            elif cmd_split[0] == "rm":
                crs = get_course(cmd_split[1])
                if(cur_sched.rm_course(crs)):
                    print("Successfully removed course.")
                else:
                    print("Failed to remove course.")

            elif cmd_split[0] == "list":
                search_results = search_crs(*cmd_split[1:])
                if len(search_results) == 0:
                    print("No matching courses.")

                else:
                    s_ok_courses = ""
                    s_conflict_courses = ""
                    for c in search_results:
                        res = cur_sched.check_add_course(c)
                        if res[0]:
                            s_ok_courses += res[1]
                        else:
                            s_conflict_courses += res[1]

                    s_result = "Can add courses:\n{0}\nConflicting/blocked courses:\n{1}".format(
                        s_ok_courses, s_conflict_courses)

                    print(s_result)
            elif cmd_split[0] == "view":
                print(get_course(cmd_split[1]).to_string())
            elif cmd_split[0] in ("sched", "schedule"):
                print("Cur Sched")
                print("")
                print(cur_sched.to_string())
                print("")
            elif cmd_split[0] == "search":
                search_results = search_crs(*cmd_split[1:])
                if len(search_results) == 0:
                    print("No courses found.")
                else:
                    for c in search_results:
                        print(c.to_string())

        except Exception as ex:
            print("[Error] " + str(ex))
            raise

        save_data_to_file(cur_sched, "sched.bin")

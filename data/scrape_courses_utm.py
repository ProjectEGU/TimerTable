#!/usr/bin/env python
# -*- coding: utf-8 -*-

import jsonpickle
import requests
from lxml import html
import json
from course import *
from schedule import *
import gzip

def get_url(year_of_study, session):
    """

    :param year_of_study: 1, 2, 3 or 4.
    :param session: Examples: 20199 is fall 2019. 20195 is summer 2019.
    :return:
    """

    return "https://student.utm.utoronto.ca/timetable/timetable?yos={0}&subjectarea=&session={1}&courseCode=&sname=&delivery=&courseTitle=".format(
        year_of_study, session)


def get_raw_tt(year_of_study, session):
    r = requests.get(get_url(year_of_study, session))
    return r.content


def parse_data(data):
    tree = html.fromstring(data)

    course_nodes = tree.xpath("/html/body/div/div[starts-with(@class, 'course')]")

    course_list = []

    for node in course_nodes:
        course_code = node.xpath("span[1]")[0].attrib["id"]
        course_title = ''.join(node.xpath("span[1]/h4")[0].itertext()).split(" - ")[1]
        course_info = '\n'.join(node.xpath("div[contains(@class, 'infoCourse')]")[0].itertext()).strip()
        enrl_controls_n = node.xpath("div[contains(@class, 'enrlControls')]")
        enrl_controls = "" if len(enrl_controls_n) == 0 else '\n'.join(enrl_controls_n[0].itertext())
        sections_n = node.xpath("table[starts-with(@id, 'tbl_')]/tbody/tr[starts-with(@id, 'tr_')]")

        term = course_code[-1]

        c_sections_dict = {}
        for sect_n in sections_n:
            section_name = sect_n.xpath("td[2]/label")[0].text
            instructors_list = [x.strip() for x in sect_n.xpath("td[3]")[0].itertext() if len(x.strip()) > 0]
            curr_enrolled = sect_n.xpath("td[4]")[0].text.strip()
            max_enrolled = sect_n.xpath("td[5]")[0].text.strip()
            waitlisted_count = sect_n.xpath("td[6]")[0].text.strip()

            weekdays_list = [x.text for x in sect_n.xpath("td[8]/abbr")]
            start_time_list = [x.strip() for x in sect_n.xpath("td[9]")[0].itertext() if len(x.strip()) > 0]
            end_time_list = [x.strip() for x in sect_n.xpath("td[10]")[0].itertext() if len(x.strip()) > 0]
            room_node = sect_n.xpath("td[11]")[0]

            notes_n = sect_n.xpath("td[12]")
            notes = ''.join([x.strip() for x in notes_n[0].itertext() if len(x.strip()) > 0])

            is_cancelled = "Cancelled" in notes or "Closed" in notes

            assert (len(weekdays_list) == len(start_time_list))
            assert (len(start_time_list) == len(end_time_list))

            if (len(start_time_list) == 0):
                if (is_cancelled):
                    print("INFO - SECTION IS CANCELLED: ", course_code, section_name)
                else:
                    print("INFO - NO TIMESLOTS FOR COURSE SECTION: ", course_code, section_name, len(notes))
            if (is_cancelled):
                print("INFO - SECTION IS CANCELLED BUT HAS TIMESLOTS: ", course_code, section_name)

            if term in ('F', 'S'):
                room_list = [text.strip() for text in room_node.itertext() if len(text.strip()) > 0]
                c_section_timeslots = [Timeslot(wk, strt, end, rm, rm) for wk, strt, end, rm in \
                                       zip(weekdays_list, start_time_list, end_time_list, room_list)]
            elif term == 'Y':  # for Y course, room_list is of format (slot1 F, slot1 S, slot2 F, slot2 S, etc)
                # print("test:", course_code)
                room_list = [x.xpath('span') for x in room_node.xpath('div')]
                room_list_grp = [[''.join(x[0].itertext()).strip(), ''.join(x[1].itertext()).strip()] for x in
                                 room_list]
                # print("test:", course_code, room_list_grp, weekdays_list)
                assert (all(len(x) == 2 for x in room_list_grp))
                if (len(room_list_grp) != len(weekdays_list)):
                    print("WARN ROOM INCONSISTENCY:", course_code, room_list_grp, weekdays_list)

                # room_list_grp = [room_list[i:i+2] for i in range(0, len(room_list), 2)]
                c_section_timeslots = [Timeslot(wk, strt, end, rm[0], rm[1]) for wk, strt, end, rm in \
                                       zip(weekdays_list, start_time_list, end_time_list, room_list_grp)]
            else:
                raise Exception("Invalid section term")

            c_section = SingleSection(section_name, instructors_list, notes, curr_enrolled,
                                      max_enrolled, waitlisted_count, c_section_timeslots)

            section_type = section_name[0:3]
            if section_type in ('PRA', 'LEC', 'TUT'):
                if section_type not in c_sections_dict:
                    c_sections_dict[section_type] = []

                c_sections_dict[section_type].append(c_section)
            else:
                raise Exception("Invalid section id. It must start with PRA, LEC, or TUT.")

        course_list.append(
            Course(course_code, course_title, course_info, enrl_controls, term, c_sections_dict)
        )

    for c in course_list:
        pass
        # print(c.to_string())
        # print(course_code, course_title, section_name, instructors, curr_enrolled, max_enrolled, waitlisted_count, \
        # start_time_list, end_time_list, room_list, notes)
    return course_list


def save_term_data(yr_of_study, term_code):
    parsed_list = parse_data(get_raw_tt(yr_of_study, term_code))
    with open(term_code + "_" + yr_of_study, 'w') as f:
        f.write(jsonpickle.encode(parsed_list, unpicklable=False))


def scrape_utm(session, useLocal=False, compressOutput=False):
    """

    :param session: 20199
    :param useLocal: Use locally cached copy of data to re-parse instead of downloading new data.
    :return:
    """
    all_list = []

    for yr_of_study in [str(x) for x in range(1, 5)]:
        print("Retrieve data for year " + yr_of_study)

        filename = "utm_{0}_{1}".format(session, yr_of_study)

        if useLocal:
            with open(filename, 'rb') as f:
                rawdata = f.read()
        else:
            rawdata = get_raw_tt(yr_of_study, session)

            with open(filename, 'wb') as f:
                f.write(rawdata)

        all_list.extend(parse_data(rawdata))

    all_list.sort(key=lambda c: c.course_code)
    openFunc = gzip.open if compressOutput else open
    fName = "course_data_utm_{0}".format(session) + ("_production" if compressOutput else "")
    with openFunc(fName, 'wb') as f:
        f.write(str.encode(jsonpickle.encode(all_list, unpicklable=False), encoding='utf8'))

# save_term_data('1', '20199')
"""
data = get_raw_tt('1', '20199')

with open("abc", "wb") as f:
    f.write(data)

data = open("abc","rb").read()
"""
"""
for i in range(1, 5):
    save_term_data(str(i),
                   '20199')  # YYYYF, where YYYY is the year and F is either 9 or 5, depending on if summer course or not.
"""

#!/usr/bin/env python
# -*- coding: utf-8 -*-

# https://timetable.iit.artsci.utoronto.ca/api/20199/courses?org=&code=&section=F&studyyear=&daytime=&weekday=&prof=&breadth=&online=&waitlist=&available=&title=

import jsonpickle
import json
from course import *
from schedule import *
import requests
import gzip


def get_url(session, term):
    return "https://timetable.iit.artsci.utoronto.ca/api/{0}/courses?org=&code=&section={1}&studyyear=&daytime=&weekday=&prof=&breadth=&online=&waitlist=&available=&title=".format(
        session, term
    )


def get_stg_json(session, term):
    r = requests.get(get_url(session, term))
    return r.content


def load_from_stg_json(filepath):
    with open(filepath, "r") as f:
        jsonObj = json.loads(f.read())

    course_list = []

    course_nodes = jsonObj

    for node_key in course_nodes:
        node = course_nodes[node_key]
        course_code = node['code']
        course_title = node['courseTitle']
        course_info = node['courseDescription'].strip()
        enrl_controls = ""
        sections_n = node['meetings']
        term = node['section']
        c_sections_dict = {}
        for section_name in sections_n:
            sect_n = sections_n[section_name]
            if sect_n["cancel"] == "Cancelled":
                continue
            instructors_list = [
                sect_n['instructors'][id]["lastName"] + ". " + sect_n['instructors'][id]["firstName"] + "." for id in
                sect_n['instructors']]
            curr_enrolled = sect_n['actualEnrolment']
            max_enrolled = sect_n['enrollmentCapacity']
            waitlisted_count = sect_n['actualWaitlist']
            timeslots_list = []

            for timeslot_id in sect_n['schedule']:
                timeslot_n = sect_n['schedule'][timeslot_id]
                weekday = timeslot_n['meetingDay']
                start_time = timeslot_n['meetingStartTime']
                end_time = timeslot_n['meetingEndTime']
                room1 = timeslot_n['assignedRoom1']
                room2 = timeslot_n['assignedRoom2']

                if weekday is None:
                    continue

                if term in ('F', 'Y', 'S'):
                    timeslots_list.append(Timeslot(weekday, start_time, end_time, room1, room2))
                else:
                    raise Exception("Invalid term " + term)

            if (len(timeslots_list) == 0):
                print("INFO - NO TIMESLOTS FOR COURSE SECTION: ", course_code, section_name)

            c_section = SingleSection(section_name.replace('-', ''), instructors_list, "", curr_enrolled,
                                      max_enrolled, waitlisted_count, timeslots_list)

            section_type = section_name[0:3]
            if section_type in ('PRA', 'LEC', 'TUT'):
                if section_type not in c_sections_dict:
                    c_sections_dict[section_type] = []

                c_sections_dict[section_type].append(c_section)
            else:
                raise Exception("Invalid section id. It must start with PRA, LEC, or TUT.")

        course_list.append(
            Course(course_code + term, course_title, course_info, enrl_controls, term, c_sections_dict)
        )

    for c in course_list:
        pass
        # print(c.to_string())
        # print(course_code, course_title, section_name, instructors, curr_enrolled, max_enrolled, waitlisted_count, \
        # start_time_list, end_time_list, room_list, notes)
    return course_list


def scrape_stg_artsci(session, useLocal=False, compressOutput=False):
    parsed_list = []

    for term in ('F', 'S', 'Y'):
        filename = "stg_artsci_{0}_{1}.json".format(session, term)
        if not useLocal:
            with open(filename, 'wb') as f:
                f.write(get_stg_json(session, term))

        parsed_list.extend(load_from_stg_json(filename))

    parsed_list.sort(key=lambda c: c.course_code)
    openFunc = gzip.open if compressOutput else open
    fName = "course_data_stg_artsci_{0}".format(session) + ("_production" if compressOutput else "")
    with openFunc(fName, 'wb') as f:
        f.write(str.encode(jsonpickle.encode(parsed_list, unpicklable=False), encoding='utf8'))

# "https://timetable.iit.artsci.utoronto.ca/api/{0}/courses?org=&code=&section={1}&studyyear=&daytime=&weekday=&prof=&breadth=&online=&waitlist=&available=&title=".format(session_id, term)

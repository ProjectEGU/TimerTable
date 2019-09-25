#!/usr/bin/env python
# -*- coding: utf-8 -*-

# https://timetable.iit.artsci.utoronto.ca/api/20199/courses?org=&code=&section=F&studyyear=&daytime=&weekday=&prof=&breadth=&online=&waitlist=&available=&title=

import jsonpickle
import json
from course import *
from schedule import *
import requests

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
            instructors_list = [sect_n['instructors'][id]["lastName"] + ". " + sect_n['instructors'][id]["firstName"] + "." for id in sect_n['instructors']]
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

                print(course_code, start_time)
                if term in ('F','Y','S'):
                    timeslots_list.append(Timeslot(weekday, start_time, end_time, room1, room2))
                else:
                    raise Exception("Invalid term " + term)

            c_section = SingleSection(section_name.replace('-',''), instructors_list, "", curr_enrolled,
                                      max_enrolled, waitlisted_count, timeslots_list)

            section_type = section_name[0:3]
            if section_type in ('PRA', 'LEC', 'TUT'):
                if section_type not in c_sections_dict:
                    c_sections_dict[section_type] = []

                c_sections_dict[section_type].append(c_section)
            else:
                raise Exception("Invalid section id. It must start with PRA, LEC, or TUT.")

        course_list.append(
            Course(course_code+term, course_title, course_info, enrl_controls, term, c_sections_dict)
        )

    for c in course_list:
        pass
        # print(c.to_string())
        # print(course_code, course_title, section_name, instructors, curr_enrolled, max_enrolled, waitlisted_count, \
        # start_time_list, end_time_list, room_list, notes)
    return course_list

parsed_list = load_from_stg_json("courses20199_F.json")
parsed_list += load_from_stg_json("courses20199_S_mod.json")
parsed_list += load_from_stg_json("courses20199_Y_mod.json")

parsed_list.sort(key=lambda c: c.course_code)

with open("course_data_stg_artsci_20199", 'w') as f:
    f.write(jsonpickle.encode(parsed_list, unpicklable=False))

#"https://timetable.iit.artsci.utoronto.ca/api/{0}/courses?org=&code=&section={1}&studyyear=&daytime=&weekday=&prof=&breadth=&online=&waitlist=&available=&title=".format(session_id, term)
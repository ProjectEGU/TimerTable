import jsonpickle
import os
from datetime import datetime

os.system("chcp 65001>nul") # avoids GBK codec error when reading JSON
print(datetime.now())
#course_data_utm_20205   course_data_stg_artsci_20205
with open("course_data_stg_artsci_20205", "r") as f:
    all_crs = jsonpickle.loads(f.read())

""" # Filter courses by certain criteria
def crsFilter(crs):
    #print(crs["course_name"], "(SSc)" in crs["course_name"])
    # return "(SSc)" in crs["course_name"]# get social science course
    return crs["course_code"][-1] == "S"

print('\n'.join(sorted(('{0}: {1}'.format(crs["course_code"], crs["course_name"]) for crs in all_crs
    if crsFilter(crs)), key=lambda c: c[3] + c[:3])))
"""

# rank courses by enroll count
# rank the courses by largest enrol count (lectures only), and highest enrolled-to-size (lectures only) ratio
def get_crs_waitlist_ratio(crs):
    # return tuple of (crs, waitlist ratio, waitlist count, enrolled count)
    crs_total_count = 0
    crs_enrolled_count = 0
    for secType in ('LEC',):
        if secType in crs['course_sections']:
            for sec in crs['course_sections'][secType]:
                if not sec["is_closed"]:
                    crs_total_count += sec['total_count']
                    crs_enrolled_count += sec['enrolled_count']
    if crs_enrolled_count == 0:
        crs_waitlist_ratio = 0
    else:
        crs_waitlist_ratio = crs_enrolled_count / crs_total_count

    return (crs, crs_waitlist_ratio,  crs_enrolled_count, crs_total_count)


crs_all_waitlist = [get_crs_waitlist_ratio(crs) for crs in all_crs if crs["course_code"][3] in ('1','2','3',)] #  and crs["course_code"][8] == 'S'
crs_all_waitlist_ratio = sorted(crs_all_waitlist, key=lambda a: -a[1])
crs_all_waitlist_count = sorted(crs_all_waitlist, key=lambda a: -a[2])
print("---- enrol count ----")
for obj in crs_all_waitlist_count[:44]:
    if(obj[2] == 0):
        continue
    print(obj[0]['course_code'], "{:<75}".format(obj[0]['course_name']), "enrolled count:", obj[2], "capacity:", obj[3])

print("---- enrol ratio ----")
for obj in crs_all_waitlist_ratio[:44]:
    if(obj[2] == 0):
        continue
    print(obj[0]['course_code'], "{:<75}".format(obj[0]['course_name']), "enrolled percent:", '{:.0%}'.format(obj[1]), "enrolled count:", obj[2], "capacity:", obj[3])

"""
# get st george summer courses from JSON
with open("stg_artsci_20205_Y.json", "r") as f:
    all_crs_dict = jsonpickle.loads(f.read())

def choiceCondition(crs):
    return "Social Science" in crs["distributionCategories"]

# from json:list all social science courses, and arrange them in ascending order, first by year, then by course code.
print('\n'.join(sorted(('{0}: {1}'.format(crs["code"], crs["courseTitle"]) for key, crs in all_crs_dict.items() 
    if choiceCondition(crs)), key=lambda c: c[3] + c[:3])))
"""

def has_tuesday_timeslot(lec_info):
    return any([ts['weekday'] == 'TU' for ts in lec_info['timeslots']])


def has_prof(prof_name, lec_secs):
    # [[print(instructor) for instructor in sec['instructors']] for sec in lec_secs]
    return any([prof_name.lower() in sec['instructors'].lower() for sec in lec_secs])




# rank courses by waitlist
# rank the courses by longest waitlist, and highest waitlist-to-enrolled ratio
def get_crs_waitlist_ratio(crs):
    # return tuple of (crs, waitlist ratio, waitlist count, enrolled count)
    crs_waitlist_count = 0
    crs_enrolled_count = 0
    for secType in ('LEC',):
        if secType in crs['course_sections']:
            crs_waitlist_count += sum([int(sec['waitlist_count']) for sec in crs['course_sections'][secType]])
            crs_enrolled_count += sum([int(sec['enrolled_count']) for sec in crs['course_sections'][secType]])
    if crs_enrolled_count == 0:
        crs_waitlist_ratio = 0
    else:
        crs_waitlist_ratio = crs_waitlist_count / crs_enrolled_count

    return (crs, crs_waitlist_ratio, crs_waitlist_count, crs_enrolled_count)


crs_all_waitlist = [get_crs_waitlist_ratio(crs) for crs in all_crs]
crs_all_waitlist_ratio = sorted(crs_all_waitlist, key=lambda a: -a[1])
crs_all_waitlist_count = sorted(crs_all_waitlist, key=lambda a: -a[2])
print("---- waitlist count ----")
for obj in crs_all_waitlist_count:
    if(obj[2] == 0):
        continue
    print(obj[0]['course_code'], "{:<75}".format(obj[0]['course_name']), "waitlist count:", obj[2], "enrolled count:", obj[3])
print("---- waitlist ratio ----")
for obj in crs_all_waitlist_ratio:
    if(obj[2] == 0):
        continue
    print(obj[0]['course_code'], "{:<75}".format(obj[0]['course_name']), "waitlist ratio:", '{:.0%}'.format(obj[1]), "waitlist count:", obj[2], "enrolled count:", obj[3])


""" # find courses taught by certain profs
for crs in all_crs:
    if(crs['course_code'][8] == 'S'):
        lec_secs = []
        for sectype in ('LEC','PRA','TUT'):
            if sectype in crs['course_sections']:
                lec_secs += crs['course_sections'][sectype]

        if has_prof("ikh", lec_secs):
            print("---------------------------------------")
            print()
            print("{0}".format(crs['course_code']))
"""
""" # find 24L courses within a certain time
for crs in all_crs:
    if '[24L]' in crs['course_info'] and crs['course_code'][3] in ('1', '2', '3') and crs['course_code'][8] == 'S':
        lec_secs = crs['course_sections']['LEC']
        if any(has_tuesday_timeslot(lec_info) for lec_info in lec_secs):
            print("---------------------------------------")
            print()
            print("{0}: {1} / {2} ({3})".format(crs['course_code'],
                                                lec_secs[0]['enrolled_count'],
                                                lec_secs[0]['total_count'],
                                                lec_secs[0]['waitlist_count']))
            print(crs['course_info'])
"""

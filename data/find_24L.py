import jsonpickle

with open("course_data_utm_20199", "r") as f:
    all_crs = jsonpickle.loads(f.read())


def has_tuesday_timeslot(lec_info):
    return any([ts['weekday'] == 'TU' for ts in lec_info['timeslots']])


def has_prof(prof_name, lec_secs):
    # [[print(instructor) for instructor in sec['instructors']] for sec in lec_secs]
    return any([prof_name.lower() in sec['instructors'].lower() for sec in lec_secs])


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


# rank the courses by longest waitlist, and highest waitlist-to-enrolled ratio
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
